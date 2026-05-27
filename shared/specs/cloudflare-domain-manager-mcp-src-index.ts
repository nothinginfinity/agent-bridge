/**
 * cloudflare-domain-manager-mcp — v0.1.0
 * Resolves BLT-016 gaps 1, 4, 5 (domain lifecycle) + gaps 2, 3 (D1 convenience tools)
 *
 * Doctrine: Always Custom Domain API. Never zone-level Worker routes.
 *
 * Tools:
 *   domain_manager_status
 *   add_custom_domain
 *   remove_custom_domain
 *   list_custom_domains
 *   list_all_worker_domains
 *   check_domain_health
 *   list_d1_databases
 *   create_d1_database
 */

const NAME = 'cloudflare-domain-manager-mcp';
const VERSION = '0.1.0';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const R = (x: unknown, status = 200) =>
  Response.json(x, { status, headers: { ...CORS, 'cache-control': 'no-store' } });

const er = (id: string | null, code: string, msg: string) =>
  R({ jsonrpc: '2.0', id, error: { code: -32000, message: `${code}: ${msg}` } });

const ok = (id: string | null, result: unknown) =>
  R({ jsonrpc: '2.0', id, result });

interface Env {
  CF_API_TOKEN: string;
  CF_ACCOUNT_ID: string;
}

const CF = 'https://api.cloudflare.com/client/v4';

async function cfGet(env: Env, path: string) {
  const r = await fetch(`${CF}${path}`, {
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
  });
  return r.json() as Promise<{ success: boolean; result: unknown; errors: { message: string }[] }>;
}

async function cfPost(env: Env, path: string, body: unknown) {
  const r = await fetch(`${CF}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json() as Promise<{ success: boolean; result: unknown; errors: { message: string }[] }>;
}

async function cfPut(env: Env, path: string, body: unknown) {
  const r = await fetch(`${CF}${path}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json() as Promise<{ success: boolean; result: unknown; errors: { message: string }[] }>;
}

async function cfDelete(env: Env, path: string) {
  const r = await fetch(`${CF}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
  });
  if (r.status === 204) return { success: true, result: null, errors: [] };
  return r.json() as Promise<{ success: boolean; result: unknown; errors: { message: string }[] }>;
}

// ── Tool implementations ─────────────────────────────────────────────────────

async function addCustomDomain(env: Env, args: Record<string, unknown>) {
  const { script_name, hostname, zone_id } = args as { script_name: string; hostname: string; zone_id: string };
  if (!script_name || !hostname || !zone_id) return { success: false, error: 'script_name, hostname, zone_id are required' };
  const data = await cfPut(env, `/accounts/${env.CF_ACCOUNT_ID}/workers/domains`, {
    hostname,
    service: script_name,
    environment: 'production',
    zone_id,
  });
  if (!data.success) return { success: false, errors: data.errors };
  const res = data.result as { id: string; hostname: string; service: string };
  return {
    success: true,
    id: res.id,
    hostname: res.hostname,
    script_name: res.service,
    message: `Custom domain ${hostname} attached to ${script_name}. DNS managed by Cloudflare.`,
  };
}

async function removeCustomDomain(env: Env, args: Record<string, unknown>) {
  const { domain_id } = args as { domain_id: string };
  if (!domain_id) return { success: false, error: 'domain_id is required' };
  const data = await cfDelete(env, `/accounts/${env.CF_ACCOUNT_ID}/workers/domains/${domain_id}`);
  if (!data.success) return { success: false, errors: data.errors };
  return { success: true, domain_id, message: `Custom domain ${domain_id} detached.` };
}

async function listCustomDomains(env: Env, args: Record<string, unknown>) {
  const { script_name } = args as { script_name: string };
  if (!script_name) return { success: false, error: 'script_name is required' };
  const data = await cfGet(env, `/accounts/${env.CF_ACCOUNT_ID}/workers/domains?service=${encodeURIComponent(script_name)}`);
  if (!data.success) return { success: false, errors: data.errors };
  const domains = (data.result as Array<{ id: string; hostname: string; zone_id: string; created_on: string }>) || [];
  return { success: true, script_name, count: domains.length, domains };
}

async function listAllWorkerDomains(env: Env) {
  const data = await cfGet(env, `/accounts/${env.CF_ACCOUNT_ID}/workers/domains`);
  if (!data.success) return { success: false, errors: data.errors };
  const all = (data.result as Array<{ id: string; hostname: string; service: string; zone_id: string }>) || [];
  const grouped: Record<string, { hostname: string; id: string; zone_id: string }[]> = {};
  for (const d of all) {
    if (!grouped[d.service]) grouped[d.service] = [];
    grouped[d.service].push({ hostname: d.hostname, id: d.id, zone_id: d.zone_id });
  }
  return { success: true, total_domains: all.length, workers: grouped };
}

async function checkDomainHealth(env: Env, args: Record<string, unknown>) {
  const { hostname, path = '/health' } = args as { hostname: string; path?: string };
  if (!hostname) return { success: false, error: 'hostname is required' };
  const url = `https://${hostname}${path}`;
  const start = Date.now();
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const text = await res.text().catch(() => '');
    return {
      hostname,
      url,
      status_code: res.status,
      ok: res.ok,
      latency_ms: Date.now() - start,
      body_preview: text.slice(0, 200),
    };
  } catch (e) {
    return {
      hostname,
      url,
      status_code: null,
      ok: false,
      latency_ms: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function listD1Databases(env: Env, args: Record<string, unknown>) {
  const { name_filter } = args as { name_filter?: string };
  const qs = name_filter ? `?name=${encodeURIComponent(name_filter)}` : '';
  const data = await cfGet(env, `/accounts/${env.CF_ACCOUNT_ID}/d1/database${qs}`);
  if (!data.success) return { success: false, errors: data.errors };
  const dbs = (data.result as Array<{ uuid: string; name: string; created_at: string }>) || [];
  return { success: true, count: dbs.length, databases: dbs.map(d => ({ uuid: d.uuid, name: d.name, created_at: d.created_at })) };
}

async function createD1Database(env: Env, args: Record<string, unknown>) {
  const { name } = args as { name: string };
  if (!name) return { success: false, error: 'name is required' };
  const data = await cfPost(env, `/accounts/${env.CF_ACCOUNT_ID}/d1/database`, { name });
  if (!data.success) return { success: false, errors: data.errors };
  const db = data.result as { uuid: string; name: string; created_at: string };
  return { success: true, uuid: db.uuid, name: db.name, created_at: db.created_at, message: `D1 database "${name}" created. UUID: ${db.uuid}` };
}

// ── Tools manifest ───────────────────────────────────────────────────────────

const TOOLS = [
  { name: 'domain_manager_status', description: 'Health and version status.', inputSchema: { type: 'object', properties: {}, required: [] } },
  {
    name: 'add_custom_domain',
    description: 'Attach a custom hostname to a Worker using the Cloudflare Custom Domain API. Handles DNS automatically. Always use this — never zone-level Worker routes.',
    inputSchema: { type: 'object', properties: { script_name: { type: 'string' }, hostname: { type: 'string' }, zone_id: { type: 'string' } }, required: ['script_name', 'hostname', 'zone_id'] },
  },
  {
    name: 'remove_custom_domain',
    description: 'Detach a custom domain from a Worker by domain record ID.',
    inputSchema: { type: 'object', properties: { domain_id: { type: 'string' } }, required: ['domain_id'] },
  },
  {
    name: 'list_custom_domains',
    description: 'List all custom domains attached to a specific Worker.',
    inputSchema: { type: 'object', properties: { script_name: { type: 'string' } }, required: ['script_name'] },
  },
  {
    name: 'list_all_worker_domains',
    description: 'Full account domain map — all custom domains across all Workers, grouped by Worker name.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'check_domain_health',
    description: 'HTTP health check a hostname. Returns status code, latency, and body preview.',
    inputSchema: { type: 'object', properties: { hostname: { type: 'string' }, path: { type: 'string', description: 'Path to check, defaults to /health' } }, required: ['hostname'] },
  },
  {
    name: 'list_d1_databases',
    description: 'List all D1 databases in the account with name and UUID. Eliminates dashboard UUID lookups.',
    inputSchema: { type: 'object', properties: { name_filter: { type: 'string' } }, required: [] },
  },
  {
    name: 'create_d1_database',
    description: 'Create a new D1 database by name. Returns UUID immediately.',
    inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
  },
];

// ── MCP router ───────────────────────────────────────────────────────────────

async function mcp(req: Request, env: Env): Promise<Response> {
  let body: { jsonrpc: string; id: string | null; method: string; params?: Record<string, unknown> };
  try { body = await req.json(); } catch { return er(null, 'PARSE_ERROR', 'Invalid JSON'); }
  const { id = null, method, params = {} } = body;

  if (method === 'initialize') {
    return ok(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: NAME, version: VERSION } });
  }
  if (method === 'notifications/initialized') return ok(id, {});
  if (method === 'tools/list') return ok(id, { tools: TOOLS });

  if (method === 'tools/call') {
    const { name, arguments: args = {} } = params as { name: string; arguments: Record<string, unknown> };
    if (!env.CF_API_TOKEN) return er(id, 'CONFIG_ERROR', 'CF_API_TOKEN secret not set');
    if (!env.CF_ACCOUNT_ID) return er(id, 'CONFIG_ERROR', 'CF_ACCOUNT_ID var not set');
    try {
      let result: unknown;
      switch (name) {
        case 'domain_manager_status':
          result = { name: NAME, version: VERSION, bindings: { cf_api_token: !!env.CF_API_TOKEN, cf_account_id: !!env.CF_ACCOUNT_ID }, tools: TOOLS.map(t => t.name) };
          break;
        case 'add_custom_domain': result = await addCustomDomain(env, args); break;
        case 'remove_custom_domain': result = await removeCustomDomain(env, args); break;
        case 'list_custom_domains': result = await listCustomDomains(env, args); break;
        case 'list_all_worker_domains': result = await listAllWorkerDomains(env); break;
        case 'check_domain_health': result = await checkDomainHealth(env, args); break;
        case 'list_d1_databases': result = await listD1Databases(env, args); break;
        case 'create_d1_database': result = await createD1Database(env, args); break;
        default: return er(id, 'UNKNOWN_TOOL', `Unknown tool: ${name}`);
      }
      return ok(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] });
    } catch (e) {
      return er(id, 'TOOL_ERROR', e instanceof Error ? e.message : String(e));
    }
  }
  return er(id, 'UNKNOWN_METHOD', `Unknown method: ${method}`);
}

// ── Fetch handler ────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    if (req.method === 'GET' && url.pathname === '/health') {
      return R({ status: 'ok', name: NAME, version: VERSION, bindings: { cf_api_token: !!env.CF_API_TOKEN, cf_account_id: !!env.CF_ACCOUNT_ID } });
    }
    if (req.method === 'POST' && url.pathname === '/mcp') return mcp(req, env);
    return R({ error: 'Not found' }, 404);
  },
};
