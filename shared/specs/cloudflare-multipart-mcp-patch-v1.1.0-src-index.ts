/**
 * cloudflare-multipart-mcp — v1.1.0 patch
 * Adds: list_d1_databases, create_d1_database
 * Existing tools unchanged: deploy_worker_with_bindings, execute_d1_sql, query_d1_sql
 *
 * Deploy as patch over existing Worker: cloudflare-multipart-mcp
 * Domain: cloudflare-multipart-mcp.agentfeedoptimization.com
 */

const NAME = 'cloudflare-multipart-mcp';
const VERSION = '1.1.0';

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

const CF_BASE = 'https://api.cloudflare.com/client/v4';

async function cfFetch(env: Env, path: string, method = 'GET', body?: unknown) {
  const res = await fetch(`${CF_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json() as Promise<{ success: boolean; result: unknown; errors: unknown[] }>;
}

// ── Tool handlers ────────────────────────────────────────────────────────────

async function deployWorkerWithBindings(env: Env, args: Record<string, unknown>) {
  const { script_name, worker_source, bindings = [], compatibility_date = '2024-01-01' } = args as {
    script_name: string;
    worker_source: string;
    bindings: Array<{ type: string; name: string; [k: string]: unknown }>;
    compatibility_date: string;
  };

  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date,
    bindings,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }), 'metadata.json');
  form.append('worker.mjs', new Blob([worker_source], { type: 'application/javascript+module' }), 'worker.mjs');

  const res = await fetch(
    `${CF_BASE}/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${script_name}`,
    {
      method: 'PUT',
      headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` },
      body: form,
    }
  );
  const data = (await res.json()) as { success: boolean; result: unknown; errors: unknown[] };
  if (!data.success) return { success: false, errors: data.errors };
  return { success: true, script_name, message: `Worker ${script_name} deployed at v${VERSION}` };
}

async function executeD1Sql(env: Env, args: Record<string, unknown>) {
  const { database_id, sql, params = [] } = args as { database_id: string; sql: string; params: unknown[] };
  const data = await cfFetch(
    env,
    `/accounts/${env.CF_ACCOUNT_ID}/d1/database/${database_id}/query`,
    'POST',
    { sql, params }
  );
  if (!data.success) return { success: false, errors: data.errors };
  return { success: true, result: data.result };
}

async function queryD1Sql(env: Env, args: Record<string, unknown>) {
  return executeD1Sql(env, args);
}

// ── NEW v1.1.0 ───────────────────────────────────────────────────────────────

async function listD1Databases(env: Env, args: Record<string, unknown>) {
  const { name_filter } = args as { name_filter?: string };
  const qs = name_filter ? `?name=${encodeURIComponent(name_filter)}` : '';
  const data = await cfFetch(env, `/accounts/${env.CF_ACCOUNT_ID}/d1/database${qs}`);
  if (!data.success) return { success: false, errors: data.errors };
  const dbs = (data.result as Array<{ uuid: string; name: string; created_at: string }>) || [];
  return {
    success: true,
    count: dbs.length,
    databases: dbs.map(d => ({ uuid: d.uuid, name: d.name, created_at: d.created_at })),
  };
}

async function createD1Database(env: Env, args: Record<string, unknown>) {
  const { name } = args as { name: string };
  if (!name || typeof name !== 'string') return { success: false, error: 'name is required' };
  const data = await cfFetch(
    env,
    `/accounts/${env.CF_ACCOUNT_ID}/d1/database`,
    'POST',
    { name }
  );
  if (!data.success) return { success: false, errors: data.errors };
  const db = data.result as { uuid: string; name: string; created_at: string };
  return {
    success: true,
    uuid: db.uuid,
    name: db.name,
    created_at: db.created_at,
    message: `D1 database "${name}" created. UUID: ${db.uuid}`,
  };
}

// ── Tools manifest ───────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: 'multipart_status',
    description: 'Health and version status of cloudflare-multipart-mcp.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'deploy_worker_with_bindings',
    description: 'Deploy a Cloudflare Worker with D1, KV, R2, or other bindings using multipart form upload.',
    inputSchema: {
      type: 'object',
      properties: {
        script_name: { type: 'string', description: 'Cloudflare Worker script name' },
        worker_source: { type: 'string', description: 'Full Worker source code as a string' },
        bindings: {
          type: 'array',
          description: 'Array of binding objects (D1, KV, R2, plain_text, secret_text, etc.)',
          items: { type: 'object' },
        },
        compatibility_date: { type: 'string', description: 'Compatibility date, e.g. 2024-01-01' },
      },
      required: ['script_name', 'worker_source'],
    },
  },
  {
    name: 'execute_d1_sql',
    description: 'Execute a write SQL statement (INSERT, UPDATE, DELETE, CREATE TABLE) against a D1 database.',
    inputSchema: {
      type: 'object',
      properties: {
        database_id: { type: 'string', description: 'D1 database UUID' },
        sql: { type: 'string', description: 'SQL statement to execute' },
        params: { type: 'array', description: 'Positional parameters for the SQL statement', items: {} },
      },
      required: ['database_id', 'sql'],
    },
  },
  {
    name: 'query_d1_sql',
    description: 'Run a SELECT query against a D1 database and return rows.',
    inputSchema: {
      type: 'object',
      properties: {
        database_id: { type: 'string', description: 'D1 database UUID' },
        sql: { type: 'string', description: 'SELECT statement to run' },
        params: { type: 'array', description: 'Positional parameters', items: {} },
      },
      required: ['database_id', 'sql'],
    },
  },
  {
    name: 'list_d1_databases',
    description: 'List all D1 databases in the Cloudflare account. Returns name and UUID for each. Eliminates dashboard UUID lookup.',
    inputSchema: {
      type: 'object',
      properties: {
        name_filter: { type: 'string', description: 'Optional: filter databases by name prefix' },
      },
      required: [],
    },
  },
  {
    name: 'create_d1_database',
    description: 'Create a new D1 database in the Cloudflare account. Returns the UUID immediately.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name for the new D1 database, e.g. afo-index-core-db' },
      },
      required: ['name'],
    },
  },
];

// ── MCP router ───────────────────────────────────────────────────────────────

async function mcp(req: Request, env: Env): Promise<Response> {
  let body: { jsonrpc: string; id: string | null; method: string; params?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return er(null, 'PARSE_ERROR', 'Invalid JSON');
  }

  const { id = null, method, params = {} } = body;

  if (method === 'initialize') {
    return ok(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: NAME, version: VERSION },
    });
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
        case 'multipart_status':
          result = {
            name: NAME, version: VERSION,
            bindings: { cf_api_token: !!env.CF_API_TOKEN, cf_account_id: !!env.CF_ACCOUNT_ID },
            tools: TOOLS.map(t => t.name),
          };
          break;
        case 'deploy_worker_with_bindings': result = await deployWorkerWithBindings(env, args); break;
        case 'execute_d1_sql': result = await executeD1Sql(env, args); break;
        case 'query_d1_sql': result = await queryD1Sql(env, args); break;
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
      return R({
        status: 'ok',
        name: NAME,
        version: VERSION,
        bindings: {
          cf_api_token: !!env.CF_API_TOKEN,
          cf_account_id: !!env.CF_ACCOUNT_ID,
        },
      });
    }

    if (req.method === 'POST' && url.pathname === '/mcp') return mcp(req, env);

    return R({ error: 'Not found' }, 404);
  },
};
