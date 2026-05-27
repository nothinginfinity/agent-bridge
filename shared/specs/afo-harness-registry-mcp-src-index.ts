// afo-harness-registry-mcp — v0.1.0
// GitHub-backed, read-only boot command registry
// Alice — 2026-05-27

const NAME = 'afo-harness-registry-mcp';
const VERSION = '0.1.0';
const REPO = 'nothinginfinity/versioned-agent-harness';
const HARNESS_DIRS = ['alice', 'claude', 'chatgpt'];
const SHARED_FILES = ['boot-list'];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const R = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { ...CORS, 'cache-control': 'no-store' } });

const ok = (content: unknown) => ({
  jsonrpc: '2.0',
  result: { content: [{ type: 'text', text: JSON.stringify(content, null, 2) }] },
});

const er = (id: unknown, code: number, message: string) => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
});

interface Env {
  GITHUB_TOKEN: string;
}

interface HarnessCommand {
  name: string;
  agent: string;
  path: string;
  description: string;
  load_instruction: string;
  sha: string;
  github_url: string;
  content?: string;
}

async function githubGet(path: string, token: string): Promise<Response> {
  return fetch(`https://api.github.com/repos/${REPO}/contents/${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': `${NAME}/${VERSION}`,
    },
  });
}

function extractDescription(content: string): string {
  // Extract first > blockquote line as description
  const match = content.match(/^>\s*(.+)$/m);
  return match ? match[1].trim() : '';
}

function decodeBase64(encoded: string): string {
  // Cloudflare Workers atob
  return atob(encoded.replace(/\n/g, ''));
}

async function listCommandsForAgent(agent: string, token: string): Promise<HarnessCommand[]> {
  const res = await githubGet(`harnesses/${agent}`, token);
  if (!res.ok) return [];
  const files: Array<{ name: string; path: string; sha: string; html_url: string }> = await res.json();
  return files
    .filter((f) => f.name.endsWith('.md') && f.name.startsWith('boot-'))
    .map((f) => ({
      name: f.name.replace('.md', ''),
      agent,
      path: f.path,
      description: '',
      load_instruction: `Load: ${REPO} \u2192 ${f.path}`,
      sha: f.sha,
      github_url: f.html_url,
    }));
}

async function enrichWithDescriptions(
  commands: HarnessCommand[],
  token: string
): Promise<HarnessCommand[]> {
  return Promise.all(
    commands.map(async (cmd) => {
      try {
        const res = await githubGet(cmd.path, token);
        if (!res.ok) return cmd;
        const data: { content: string } = await res.json();
        const raw = decodeBase64(data.content);
        return { ...cmd, description: extractDescription(raw) };
      } catch {
        return cmd;
      }
    })
  );
}

async function getAllCommands(token: string): Promise<HarnessCommand[]> {
  const perAgent = await Promise.all(HARNESS_DIRS.map((a) => listCommandsForAgent(a, token)));
  const all = perAgent.flat();
  return enrichWithDescriptions(all, token);
}

// --- Tool handlers ---

async function harness_status(env: Env) {
  const commands = await getAllCommands(env.GITHUB_TOKEN);
  return {
    worker: NAME,
    version: VERSION,
    status: 'ok',
    github_repo: REPO,
    total_commands: commands.length,
    agents: HARNESS_DIRS,
    last_checked: new Date().toISOString(),
  };
}

async function list_boot_commands(args: { agent?: string }, env: Env) {
  const all = await getAllCommands(env.GITHUB_TOKEN);
  if (!args.agent || args.agent === 'all') return all;
  return all.filter((c) => c.agent === args.agent);
}

async function get_boot_command(args: { name: string }, env: Env) {
  if (!args.name) throw new Error('name is required');
  const all = await getAllCommands(env.GITHUB_TOKEN);
  const cmd = all.find(
    (c) => c.name === args.name || c.name === args.name.replace(/^\.?boot-/, 'boot-')
  );
  if (!cmd) throw new Error(`Boot command not found: ${args.name}`);

  // Fetch full content
  const res = await githubGet(cmd.path, env.GITHUB_TOKEN);
  if (!res.ok) throw new Error(`Could not fetch content for ${args.name}`);
  const data: { content: string } = await res.json();
  const content = decodeBase64(data.content);

  return { ...cmd, content };
}

async function search_boot_commands(args: { query: string }, env: Env) {
  if (!args.query) throw new Error('query is required');
  const all = await getAllCommands(env.GITHUB_TOKEN);
  const q = args.query.toLowerCase();
  return all.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q) ||
      c.agent.toLowerCase().includes(q)
  );
}

// --- MCP handler ---

async function mcp(req: Request, env: Env): Promise<Response> {
  const body = await req.json() as { jsonrpc: string; id: unknown; method: string; params: Record<string, unknown> };
  const { id, method, params } = body;

  if (method === 'initialize') {
    return R({
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: NAME, version: VERSION },
      },
    });
  }

  if (method === 'notifications/initialized') return R({ jsonrpc: '2.0', id, result: {} });

  if (method === 'tools/list') {
    return R({
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: 'harness_status',
            description: 'Returns registry health, total command count, and agent list.',
            inputSchema: { type: 'object', properties: {}, required: [] },
          },
          {
            name: 'list_boot_commands',
            description: 'Returns all available boot commands as structured objects. Filterable by agent.',
            inputSchema: {
              type: 'object',
              properties: {
                agent: {
                  type: 'string',
                  enum: ['alice', 'claude', 'chatgpt', 'all'],
                  description: "Filter by agent. Omit or pass 'all' for the full list.",
                },
              },
              required: [],
            },
          },
          {
            name: 'get_boot_command',
            description: 'Returns full structured object for a named boot command, including complete markdown content.',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: "Boot command name, e.g. 'boot-deploy' or 'boot-list'",
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'search_boot_commands',
            description: 'Keyword search across command names and descriptions.',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: "Search keyword, e.g. 'deploy', 'D1', 'spec'",
                },
              },
              required: ['query'],
            },
          },
        ],
      },
    });
  }

  if (method === 'tools/call') {
    const name = (params as { name: string }).name;
    const args = ((params as { arguments?: Record<string, unknown> }).arguments ?? {}) as Record<string, string>;
    try {
      let result;
      if (name === 'harness_status') result = await harness_status(env);
      else if (name === 'list_boot_commands') result = await list_boot_commands(args as { agent?: string }, env);
      else if (name === 'get_boot_command') result = await get_boot_command(args as { name: string }, env);
      else if (name === 'search_boot_commands') result = await search_boot_commands(args as { query: string }, env);
      else return R({ ...er(id, -32601, `Unknown tool: ${name}`), id }, 200);
      return R({ jsonrpc: '2.0', id, ...ok(result) });
    } catch (e) {
      return R({ ...er(id, -32000, (e as Error).message), id }, 200);
    }
  }

  return R({ ...er(id, -32601, `Unknown method: ${method}`), id }, 200);
}

// --- Main fetch handler ---

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    if (req.method === 'GET' && url.pathname === '/health') {
      return R({
        status: 'ok',
        worker: NAME,
        version: VERSION,
        bindings: { GITHUB_TOKEN: !!env.GITHUB_TOKEN },
      });
    }

    if (req.method === 'POST' && url.pathname === '/mcp') {
      return mcp(req, env);
    }

    return R({ error: 'Not found' }, 404);
  },
};
