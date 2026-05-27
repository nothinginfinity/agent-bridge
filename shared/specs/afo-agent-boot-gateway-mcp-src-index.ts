// afo-agent-boot-gateway-mcp — v0.1.0
// Compositor: assembles startup context packets for AFO agents
// Alice — 2026-05-27

const NAME = 'afo-agent-boot-gateway-mcp';
const VERSION = '0.1.0';
const AGENT_BRIDGE_REPO = 'nothinginfinity/agent-bridge';
const HARNESS_REPO = 'nothinginfinity/versioned-agent-harness';
const MODES_PATH = 'harnesses/modes.json';
const BULLETIN_PATH = 'shared/bulletin.md';
const HANDOFFS_PATH = 'shared/handoffs.md';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const R = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { ...CORS, 'cache-control': 'no-store' } });

const ok = (content: unknown) => ({
  result: { content: [{ type: 'text', text: JSON.stringify(content, null, 2) }] },
});

const er = (code: number, message: string) => ({ error: { code, message } });

interface Env {
  GATEWAY_GITHUB_TOKEN: string;
  HARNESS_REGISTRY_URL: string;
}

interface BootMode {
  mode: string;
  aliases: string[];
  default_agent: string;
  boot_command: string;
  project?: string;
  tool_belts?: string[];
  context_sources?: string[];
  first_action?: string;
}

interface ContextSource {
  name: string;
  status: 'ok' | 'degraded' | 'unavailable';
  fallback_used: boolean;
}

interface StartupPacket {
  schema_version: string;
  agent: string;
  mode: string;
  project: string;
  boot: {
    command: string;
    agent: string;
    content: string;
    source: string;
    sha: string;
  } | null;
  context_sources: ContextSource[];
  recent_handoffs: unknown[];
  recent_bulletins: string[];
  available_tools: { name: string; description: string }[];
  tool_belts: { name: string; description: string }[];
  permissions: string[];
  recommended_first_action: string;
  fallback_used: boolean;
  warnings: string[];
  loaded_at: string;
}

// --- GitHub helpers ---

async function ghGet(path: string, repo: string, token: string): Promise<Response> {
  return fetch(`https://api.github.com/repos/${repo}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': `${NAME}/${VERSION}`,
    },
  });
}

function b64(encoded: string): string {
  return atob(encoded.replace(/\n/g, ''));
}

async function fetchModes(token: string): Promise<BootMode[]> {
  try {
    const res = await ghGet(MODES_PATH, HARNESS_REPO, token);
    if (!res.ok) return [];
    const data: { content: string } = await res.json();
    const parsed = JSON.parse(b64(data.content));
    return parsed.modes ?? [];
  } catch {
    return [];
  }
}

function resolveMode(modes: BootMode[], input: string): BootMode | null {
  const q = input.toLowerCase().trim();
  return (
    modes.find((m) => m.mode === q) ??
    modes.find((m) => m.aliases?.some((a) => a.toLowerCase().includes(q) || q.includes(a.toLowerCase()))) ??
    null
  );
}

async function fetchBootCommand(
  registryUrl: string,
  commandName: string
): Promise<{ content: string; sha: string; agent: string } | null> {
  try {
    const res = await fetch(`${registryUrl}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_boot_command', arguments: { name: commandName } },
      }),
    });
    if (!res.ok) return null;
    const data: { result?: { content?: Array<{ text?: string }> } } = await res.json();
    const text = data?.result?.content?.[0]?.text;
    if (!text) return null;
    const parsed = JSON.parse(text);
    return { content: parsed.content ?? '', sha: parsed.sha ?? '', agent: parsed.agent ?? '' };
  } catch {
    return null;
  }
}

async function fetchBulletins(token: string): Promise<string[]> {
  try {
    const res = await ghGet(BULLETIN_PATH, AGENT_BRIDGE_REPO, token);
    if (!res.ok) return [];
    const data: { content: string } = await res.json();
    const raw = b64(data.content);
    // Extract last 3 ## sections
    const sections = raw.split(/^## /m).filter(Boolean).slice(-3);
    return sections.map((s) => s.split('\n')[0].trim());
  } catch {
    return [];
  }
}

interface HandoffEntry {
  id: string;
  from: string;
  to: string;
  project: string;
  type: string;
  date: string;
  status: string;
  priority: string;
  summary: string;
}

async function fetchHandoffs(token: string, agent?: string, limit = 5): Promise<HandoffEntry[]> {
  try {
    const res = await ghGet(HANDOFFS_PATH, AGENT_BRIDGE_REPO, token);
    if (!res.ok) return [];
    const data: { content: string } = await res.json();
    const raw = b64(data.content);
    const blocks = raw.split(/^---$/m).filter((b) => b.includes('from:'));
    const parsed: HandoffEntry[] = blocks.map((block) => {
      const get = (key: string) => block.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim() ?? '';
      const idMatch = block.match(/##\s*(\[MSG[^\]]*\])/);
      const bodyStart = block.indexOf('\n\n');
      const summary = bodyStart > -1 ? block.slice(bodyStart).trim().slice(0, 200) : '';
      return {
        id: idMatch?.[1] ?? '',
        from: get('from'),
        to: get('to'),
        project: get('project'),
        type: get('type'),
        date: get('date'),
        status: get('status'),
        priority: get('priority'),
        summary,
      };
    }).filter((h) => h.id);

    const filtered = agent ? parsed.filter((h) => h.to === agent) : parsed;
    return filtered.slice(-limit).reverse();
  } catch {
    return [];
  }
}

// --- Tool handlers ---

async function boot_gateway_status(env: Env) {
  const modes = await fetchModes(env.GATEWAY_GITHUB_TOKEN);
  return {
    worker: NAME,
    version: VERSION,
    status: 'ok',
    harness_registry_url: env.HARNESS_REGISTRY_URL,
    github_repo: AGENT_BRIDGE_REPO,
    modes_count: modes.length,
    last_checked: new Date().toISOString(),
  };
}

async function list_boot_modes(args: { agent?: string }, env: Env) {
  const modes = await fetchModes(env.GATEWAY_GITHUB_TOKEN);
  if (!args.agent) return modes;
  return modes.filter((m) => m.default_agent === args.agent);
}

async function boot_agent(
  args: { agent: string; mode: string; project?: string },
  env: Env
): Promise<StartupPacket> {
  const warnings: string[] = [];
  const contextSources: ContextSource[] = [];
  const now = new Date().toISOString();

  // 1. Resolve mode
  const modes = await fetchModes(env.GATEWAY_GITHUB_TOKEN);
  const resolvedMode = resolveMode(modes, args.mode);
  if (!resolvedMode) {
    throw new Error(
      `Unknown mode: "${args.mode}". Call list_boot_modes to see available modes.`
    );
  }

  // 2. Boot command from harness registry
  let bootData: { content: string; sha: string; agent: string } | null = null;
  try {
    bootData = await fetchBootCommand(env.HARNESS_REGISTRY_URL, resolvedMode.boot_command);
    contextSources.push({
      name: 'harness_registry',
      status: bootData ? 'ok' : 'degraded',
      fallback_used: !bootData,
    });
    if (!bootData) warnings.push(`Harness registry returned no content for ${resolvedMode.boot_command}.`);
  } catch {
    contextSources.push({ name: 'harness_registry', status: 'unavailable', fallback_used: true });
    warnings.push('Harness registry unavailable; boot content not loaded.');
  }

  // 3. Bulletins
  let bulletins: string[] = [];
  try {
    bulletins = await fetchBulletins(env.GATEWAY_GITHUB_TOKEN);
    contextSources.push({ name: 'agent_bridge_bulletins', status: 'ok', fallback_used: false });
  } catch {
    contextSources.push({ name: 'agent_bridge_bulletins', status: 'degraded', fallback_used: true });
    warnings.push('Bulletins unavailable.');
  }

  // 4. Handoffs
  let handoffs: HandoffEntry[] = [];
  try {
    handoffs = await fetchHandoffs(env.GATEWAY_GITHUB_TOKEN, args.agent, 3);
    contextSources.push({ name: 'agent_bridge_handoffs', status: 'ok', fallback_used: false });
  } catch {
    contextSources.push({ name: 'agent_bridge_handoffs', status: 'degraded', fallback_used: true });
    warnings.push('Handoffs unavailable.');
  }

  // 5. Tool belts (Toolsmith — degraded OK)
  // v0.1: return names only from modes.json; Toolsmith integration is v0.2
  const toolBelts = (resolvedMode.tool_belts ?? []).map((name) => ({
    name,
    description: `Belt: ${name}`,
  }));
  contextSources.push({ name: 'toolsmith_registry', status: 'degraded', fallback_used: true });
  if (toolBelts.length > 0) warnings.push('Toolsmith registry not yet integrated; belt metadata from modes.json only.');

  const anyFallback = contextSources.some((s) => s.fallback_used);

  return {
    schema_version: '0.1',
    agent: args.agent,
    mode: resolvedMode.mode,
    project: args.project ?? resolvedMode.project ?? '',
    boot: bootData
      ? {
          command: resolvedMode.boot_command,
          agent: bootData.agent,
          content: bootData.content,
          source: 'afo-harness-registry-mcp',
          sha: bootData.sha,
        }
      : null,
    context_sources: contextSources,
    recent_handoffs: handoffs,
    recent_bulletins: bulletins,
    available_tools: [],
    tool_belts: toolBelts,
    permissions: ['read_public_context', 'load_boot_files'],
    recommended_first_action: resolvedMode.first_action ?? '',
    fallback_used: anyFallback,
    warnings,
    loaded_at: now,
  };
}

async function load_project_context(args: { project: string }, env: Env) {
  if (!args.project) throw new Error('project is required');
  try {
    const res = await ghGet('shared/specs', AGENT_BRIDGE_REPO, env.GATEWAY_GITHUB_TOKEN);
    if (!res.ok) return { project: args.project, specs: [], fallback_used: true };
    const files: Array<{ name: string; path: string; sha: string; html_url: string }> = await res.json();
    const slug = args.project.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const matching = files.filter((f) => f.name.toLowerCase().includes(slug));
    return {
      project: args.project,
      specs: matching.map((f) => ({ name: f.name, path: f.path, sha: f.sha, github_url: f.html_url })),
      fallback_used: false,
    };
  } catch {
    return { project: args.project, specs: [], fallback_used: true };
  }
}

async function load_recent_handoffs(args: { agent?: string; limit?: number }, env: Env) {
  return fetchHandoffs(env.GATEWAY_GITHUB_TOKEN, args.agent, args.limit ?? 5);
}

async function load_tool_belt(args: { belt_name: string }) {
  // v0.1: Toolsmith not yet integrated — return name only
  return {
    belt_name: args.belt_name,
    description: `Belt: ${args.belt_name}`,
    tools: [],
    source: 'static',
    fallback_used: true,
    warning: 'Toolsmith registry integration is planned for v0.2.',
  };
}

async function compose_startup_context(
  args: {
    agent: string;
    boot_command: string;
    project?: string;
    tool_belts?: string[];
    include_handoffs?: boolean;
    include_bulletins?: boolean;
  },
  env: Env
): Promise<StartupPacket> {
  const warnings: string[] = [];
  const contextSources: ContextSource[] = [];
  const now = new Date().toISOString();

  const [bootData, bulletins, handoffs] = await Promise.allSettled([
    fetchBootCommand(env.HARNESS_REGISTRY_URL, args.boot_command),
    args.include_bulletins !== false ? fetchBulletins(env.GATEWAY_GITHUB_TOKEN) : Promise.resolve([]),
    args.include_handoffs !== false ? fetchHandoffs(env.GATEWAY_GITHUB_TOKEN, args.agent, 3) : Promise.resolve([]),
  ]);

  const boot = bootData.status === 'fulfilled' && bootData.value ? bootData.value : null;
  if (!boot) {
    warnings.push(`Boot command "${args.boot_command}" not available from harness registry.`);
    contextSources.push({ name: 'harness_registry', status: 'degraded', fallback_used: true });
  } else {
    contextSources.push({ name: 'harness_registry', status: 'ok', fallback_used: false });
  }

  const bl = bulletins.status === 'fulfilled' ? bulletins.value : [];
  const hf = handoffs.status === 'fulfilled' ? handoffs.value : [];
  if (bulletins.status === 'rejected') { warnings.push('Bulletins unavailable.'); contextSources.push({ name: 'agent_bridge_bulletins', status: 'unavailable', fallback_used: true }); }
  else contextSources.push({ name: 'agent_bridge_bulletins', status: 'ok', fallback_used: false });
  if (handoffs.status === 'rejected') { warnings.push('Handoffs unavailable.'); contextSources.push({ name: 'agent_bridge_handoffs', status: 'unavailable', fallback_used: true }); }
  else contextSources.push({ name: 'agent_bridge_handoffs', status: 'ok', fallback_used: false });

  const toolBelts = (args.tool_belts ?? []).map((n) => ({ name: n, description: `Belt: ${n}` }));

  return {
    schema_version: '0.1',
    agent: args.agent,
    mode: 'manual',
    project: args.project ?? '',
    boot: boot ? { command: args.boot_command, agent: boot.agent, content: boot.content, source: 'afo-harness-registry-mcp', sha: boot.sha } : null,
    context_sources: contextSources,
    recent_handoffs: hf,
    recent_bulletins: bl,
    available_tools: [],
    tool_belts: toolBelts,
    permissions: ['read_public_context', 'load_boot_files'],
    recommended_first_action: '',
    fallback_used: warnings.length > 0,
    warnings,
    loaded_at: now,
  };
}

// --- MCP surface ---

const TOOLS = [
  { name: 'boot_gateway_status', description: 'Returns gateway health, modes count, and binding status.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'list_boot_modes', description: 'Returns all available boot modes from modes.json. Filterable by agent.', inputSchema: { type: 'object', properties: { agent: { type: 'string', description: 'Filter by default_agent.' } }, required: [] } },
  { name: 'boot_agent', description: 'Core tool. Resolves mode → boot command → full startup context packet.', inputSchema: { type: 'object', properties: { agent: { type: 'string' }, mode: { type: 'string' }, project: { type: 'string' } }, required: ['agent', 'mode'] } },
  { name: 'load_project_context', description: 'Lists project-specific spec files from agent-bridge.', inputSchema: { type: 'object', properties: { project: { type: 'string' } }, required: ['project'] } },
  { name: 'load_recent_handoffs', description: 'Returns recent handoffs from agent-bridge, filterable by agent.', inputSchema: { type: 'object', properties: { agent: { type: 'string' }, limit: { type: 'number' } }, required: [] } },
  { name: 'load_tool_belt', description: 'Returns tool names and descriptions for a named belt.', inputSchema: { type: 'object', properties: { belt_name: { type: 'string' } }, required: ['belt_name'] } },
  { name: 'compose_startup_context', description: 'Fan-out compositor. Assembles startup context packet from explicit inputs.', inputSchema: { type: 'object', properties: { agent: { type: 'string' }, boot_command: { type: 'string' }, project: { type: 'string' }, tool_belts: { type: 'array', items: { type: 'string' } }, include_handoffs: { type: 'boolean' }, include_bulletins: { type: 'boolean' } }, required: ['agent', 'boot_command'] } },
];

async function mcp(req: Request, env: Env): Promise<Response> {
  const body = await req.json() as { jsonrpc: string; id: unknown; method: string; params: Record<string, unknown> };
  const { id, method, params } = body;

  if (method === 'initialize') return R({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: NAME, version: VERSION } } });
  if (method === 'notifications/initialized') return R({ jsonrpc: '2.0', id, result: {} });
  if (method === 'tools/list') return R({ jsonrpc: '2.0', id, result: { tools: TOOLS } });

  if (method === 'tools/call') {
    const name = (params as { name: string }).name;
    const args = ((params as { arguments?: Record<string, unknown> }).arguments ?? {}) as Record<string, unknown>;
    try {
      let result;
      if (name === 'boot_gateway_status') result = await boot_gateway_status(env);
      else if (name === 'list_boot_modes') result = await list_boot_modes(args as { agent?: string }, env);
      else if (name === 'boot_agent') result = await boot_agent(args as { agent: string; mode: string; project?: string }, env);
      else if (name === 'load_project_context') result = await load_project_context(args as { project: string }, env);
      else if (name === 'load_recent_handoffs') result = await load_recent_handoffs(args as { agent?: string; limit?: number }, env);
      else if (name === 'load_tool_belt') result = await load_tool_belt(args as { belt_name: string });
      else if (name === 'compose_startup_context') result = await compose_startup_context(args as { agent: string; boot_command: string; project?: string; tool_belts?: string[]; include_handoffs?: boolean; include_bulletins?: boolean }, env);
      else return R({ jsonrpc: '2.0', id, ...er(-32601, `Unknown tool: ${name}`) });
      return R({ jsonrpc: '2.0', id, ...ok(result) });
    } catch (e) {
      return R({ jsonrpc: '2.0', id, ...er(-32000, (e as Error).message) });
    }
  }

  return R({ jsonrpc: '2.0', id, ...er(-32601, `Unknown method: ${method}`) });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (req.method === 'GET' && url.pathname === '/health') return R({ status: 'ok', worker: NAME, version: VERSION, bindings: { GATEWAY_GITHUB_TOKEN: !!env.GATEWAY_GITHUB_TOKEN, HARNESS_REGISTRY_URL: !!env.HARNESS_REGISTRY_URL } });
    if (req.method === 'POST' && url.pathname === '/mcp') return mcp(req, env);
    return R({ error: 'Not found' }, 404);
  },
};
