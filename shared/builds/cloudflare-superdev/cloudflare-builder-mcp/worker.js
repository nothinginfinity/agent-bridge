// cloudflare-builder-mcp v0.1.0
// Guarded Cloudflare builder MCP for AFO SuperDev.
// Required bindings: CF_API_TOKEN, ACCOUNT_ID, ZONE_ID.
// High-risk tools require confirm=true and exact names/IDs. Secrets are never returned.

const VERSION = '0.1.0';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id'
};

const TOOLS = [
  {
    name: 'get_worker_metadata',
    description: 'Read Worker metadata before deploy/update operations.',
    inputSchema: { type: 'object', properties: { script_name: { type: 'string' } }, required: ['script_name'] }
  },
  {
    name: 'create_worker_route',
    description: 'Attach a Worker to a route pattern. Requires confirm=true.',
    inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, script_name: { type: 'string' }, confirm: { type: 'boolean' } }, required: ['pattern', 'script_name', 'confirm'] }
  },
  {
    name: 'delete_worker_route',
    description: 'Delete a Worker route by exact route ID. Requires confirm=true.',
    inputSchema: { type: 'object', properties: { route_id: { type: 'string' }, confirm: { type: 'boolean' } }, required: ['route_id', 'confirm'] }
  },
  {
    name: 'set_worker_secret_instruction',
    description: 'Return safe instructions for setting a Worker secret. This tool never accepts or stores secret values.',
    inputSchema: { type: 'object', properties: { script_name: { type: 'string' }, secret_name: { type: 'string' } }, required: ['script_name', 'secret_name'] }
  },
  {
    name: 'purge_cache_urls',
    description: 'Purge specific URLs from Cloudflare cache. Requires confirm=true. Does not support purge everything.',
    inputSchema: { type: 'object', properties: { urls: { type: 'array', items: { type: 'string' } }, confirm: { type: 'boolean' } }, required: ['urls', 'confirm'] }
  },
  {
    name: 'deploy_worker_instruction',
    description: 'Return a preserve-bindings deployment checklist for a Worker. v0.1.0 does not deploy source directly.',
    inputSchema: { type: 'object', properties: { script_name: { type: 'string' }, health_url: { type: 'string' } }, required: ['script_name'] }
  },
  {
    name: 'binding_manifest_instruction',
    description: 'Return a binding manifest template for a Worker.',
    inputSchema: { type: 'object', properties: { script_name: { type: 'string' } }, required: ['script_name'] }
  }
];

function rpc(id, result) { return Response.json({ jsonrpc: '2.0', id, result }, { headers: CORS }); }
function rpcErr(id, code, message) { return Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { headers: CORS }); }
function toolResult(id, result) { return rpc(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }); }
function req(env, name) { if (!env[name]) throw new Error(`${name} not configured`); return env[name]; }
function assertConfirm(args, label) { if (args.confirm !== true) throw new Error(`${label} requires confirm=true`); }

async function cfAccount(env, path, options = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${req(env, 'ACCOUNT_ID')}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${req(env, 'CF_API_TOKEN')}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok || data.success === false) throw new Error(`Cloudflare API ${res.status}: ${JSON.stringify(data.errors || data).slice(0, 500)}`);
  return data.result ?? data;
}

async function cfZone(env, path, options = {}) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${req(env, 'ZONE_ID')}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${req(env, 'CF_API_TOKEN')}`, 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const data = await res.json();
  if (!res.ok || data.success === false) throw new Error(`Cloudflare API ${res.status}: ${JSON.stringify(data.errors || data).slice(0, 500)}`);
  return data.result ?? data;
}

async function getScriptSourceInfo(env, scriptName) {
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${req(env, 'ACCOUNT_ID')}/workers/scripts/${encodeURIComponent(scriptName)}`, {
    headers: { Authorization: `Bearer ${req(env, 'CF_API_TOKEN')}`, Accept: 'application/javascript' }
  });
  if (res.status === 404) return { found: false, script_name: scriptName };
  if (!res.ok) throw new Error(`Cloudflare API ${res.status}`);
  const text = await res.text();
  return { found: true, script_name: scriptName, source_size_bytes: text.length };
}

async function handleTool(name, args, env) {
  switch (name) {
    case 'get_worker_metadata': {
      const source = await getScriptSourceInfo(env, args.script_name);
      let routes = [];
      try {
        const allRoutes = await cfZone(env, '/workers/routes?per_page=100');
        routes = allRoutes.filter(r => r.script === args.script_name).map(r => ({ id: r.id, pattern: r.pattern, script: r.script }));
      } catch (e) {
        routes = [{ warning: `route listing failed: ${e.message}` }];
      }
      return { ...source, routes, note: 'Binding metadata requires Cloudflare API token scope for Workers script settings; add in v0.2.0 if needed.' };
    }
    case 'create_worker_route': {
      assertConfirm(args, 'create_worker_route');
      if (!args.pattern || !args.script_name) throw new Error('pattern and script_name required');
      const result = await cfZone(env, '/workers/routes', { method: 'POST', body: JSON.stringify({ pattern: args.pattern, script: args.script_name }) });
      return { created: true, route: { id: result.id, pattern: result.pattern, script: result.script } };
    }
    case 'delete_worker_route': {
      assertConfirm(args, 'delete_worker_route');
      if (!args.route_id) throw new Error('route_id required');
      const result = await cfZone(env, `/workers/routes/${encodeURIComponent(args.route_id)}`, { method: 'DELETE' });
      return { deleted: true, id: result.id || args.route_id };
    }
    case 'set_worker_secret_instruction': {
      if (!args.script_name || !args.secret_name) throw new Error('script_name and secret_name required');
      return {
        script_name: args.script_name,
        secret_name: args.secret_name,
        status: 'instruction_only',
        reason: 'MCP should not receive secret plaintext from chat. Set the secret through Cloudflare dashboard, Wrangler secret put, or a dedicated secure secret-setting flow.',
        wrangler: `wrangler secret put ${args.secret_name} --name ${args.script_name}`
      };
    }
    case 'purge_cache_urls': {
      assertConfirm(args, 'purge_cache_urls');
      const urls = args.urls || [];
      if (!Array.isArray(urls) || !urls.length) throw new Error('urls required');
      if (urls.length > 30) throw new Error('max 30 URLs per purge');
      const result = await cfZone(env, '/purge_cache', { method: 'POST', body: JSON.stringify({ files: urls }) });
      return { purged: true, urls, result };
    }
    case 'deploy_worker_instruction': {
      return {
        script_name: args.script_name,
        status: 'instruction_only_v0.1.0',
        reason: 'Direct deploy is intentionally disabled until preserve-bindings behavior is verified with the active Cloudflare token.',
        preserve_bindings_sequence: [
          '1. Read live source and metadata.',
          '2. Save a snapshot to GitHub.',
          '3. Read existing D1/KV/R2/AI/secret/service bindings by name only.',
          '4. Deploy new Worker source.',
          '5. Reattach exact binding manifest.',
          '6. Run health check.',
          '7. Roll back snapshot if health check fails.'
        ],
        health_url: args.health_url || null
      };
    }
    case 'binding_manifest_instruction': {
      return {
        script_name: args.script_name,
        manifest_template: {
          d1_databases: [{ binding: 'DB', database_name: 'afo-toolsmith-db', database_id: '<uuid>' }],
          vectorize: [{ binding: 'VECTORIZE', index_name: '<index-name>' }],
          ai: [{ binding: 'AI' }],
          vars: {},
          secrets: ['GITHUB_TOKEN', 'CF_API_TOKEN']
        },
        warning: 'Never store secret values in GitHub. Store only secret binding names.'
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ status: 'ok', worker: 'cloudflare-builder-mcp', version: VERSION, tools: TOOLS.length }, { headers: CORS });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname !== '/mcp' || request.method !== 'POST') return new Response('not found', { status: 404, headers: CORS });
    let body;
    try { body = await request.json(); } catch { return rpcErr(null, -32700, 'Parse error'); }
    const { id, method, params } = body;
    if (method === 'initialize') return rpc(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'cloudflare-builder-mcp', version: VERSION } });
    if (method === 'notifications/initialized') return new Response(null, { status: 204, headers: CORS });
    if (method === 'ping') return rpc(id, {});
    if (method === 'tools/list') return rpc(id, { tools: TOOLS });
    if (method === 'tools/call') {
      try { return toolResult(id, await handleTool(params?.name, params?.arguments || {}, env)); }
      catch (e) { return rpcErr(id, -32603, `Tool error: ${e.message}`); }
    }
    return rpcErr(id, -32601, `Method not found: ${method}`);
  }
};
