// cloudflare-auditor-mcp v0.1.0
// Read-only Cloudflare inspection MCP for AFO SuperDev.
// Required bindings: CF_API_TOKEN, ACCOUNT_ID, ZONE_ID.

const VERSION = '0.1.0';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id'
};

const TOOLS = [
  {
    name: 'list_workers',
    description: 'List Cloudflare Workers in the account with basic metadata.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_worker_source',
    description: 'Read live deployed Worker source by script name.',
    inputSchema: { type: 'object', properties: { script_name: { type: 'string' } }, required: ['script_name'] }
  },
  {
    name: 'list_worker_routes',
    description: 'List Worker routes for the configured zone.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'audit_routes',
    description: 'List routes and flag legacy or sensitive-looking route mappings.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'list_dns_records',
    description: 'List DNS records for the configured zone. Optional filters: type, name.',
    inputSchema: { type: 'object', properties: { type: { type: 'string' }, name: { type: 'string' } }, required: [] }
  },
  {
    name: 'worker_health_check',
    description: 'Fetch one or more health URLs and summarize status, content type, and small JSON body when present.',
    inputSchema: {
      type: 'object',
      properties: {
        checks: {
          type: 'array',
          items: { type: 'object', properties: { name: { type: 'string' }, url: { type: 'string' } }, required: ['url'] }
        }
      },
      required: ['checks']
    }
  },
  {
    name: 'afo_harness_validate',
    description: 'Validate AFO page harness basics for a URL.',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
  }
];

function rpc(id, result) { return Response.json({ jsonrpc: '2.0', id, result }, { headers: CORS }); }
function rpcErr(id, code, message) { return Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { headers: CORS }); }
function toolResult(id, result) { return rpc(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }); }
function req(env, name) { if (!env[name]) throw new Error(`${name} not configured`); return env[name]; }

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

function scriptRisk(name = '') {
  const n = name.toLowerCase();
  const tags = [];
  if (n.includes('bridge') || n.includes('gateway') || n.includes('message-bus')) tags.push('legacy_comms_candidate');
  if (n.includes('alice-to-claude') || n.includes('alice-bridge')) tags.push('deprecated_bridge_candidate');
  if (n.includes('chatgpt')) tags.push('chatgpt_legacy_candidate');
  return tags;
}

async function handleTool(name, args, env) {
  switch (name) {
    case 'list_workers': {
      const result = await cfAccount(env, '/workers/scripts');
      const workers = (Array.isArray(result) ? result : result.items || result.result || []).map(w => ({
        id: w.id || w.script || w.name,
        name: w.id || w.script || w.name,
        created_on: w.created_on,
        modified_on: w.modified_on,
        risk_tags: scriptRisk(w.id || w.script || w.name)
      }));
      return { workers, total: workers.length };
    }
    case 'get_worker_source': {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${req(env, 'ACCOUNT_ID')}/workers/scripts/${encodeURIComponent(args.script_name)}`, {
        headers: { Authorization: `Bearer ${req(env, 'CF_API_TOKEN')}`, Accept: 'application/javascript' }
      });
      if (res.status === 404) return { found: false, script_name: args.script_name };
      if (!res.ok) throw new Error(`Cloudflare API ${res.status}`);
      const source = await res.text();
      return { found: true, script_name: args.script_name, size_bytes: source.length, source };
    }
    case 'list_worker_routes': {
      const routes = await cfZone(env, '/workers/routes?per_page=100');
      return { routes: routes.map(r => ({ id: r.id, pattern: r.pattern, script: r.script })), total: routes.length };
    }
    case 'audit_routes': {
      const routes = await cfZone(env, '/workers/routes?per_page=100');
      return { routes: routes.map(r => ({ id: r.id, pattern: r.pattern, script: r.script, risk_tags: scriptRisk(r.script) })), cleanup_candidates: routes.filter(r => scriptRisk(r.script).length).map(r => r.script) };
    }
    case 'list_dns_records': {
      const qs = new URLSearchParams({ per_page: '100' });
      if (args.type) qs.set('type', args.type);
      if (args.name) qs.set('name', args.name);
      const records = await cfZone(env, `/dns_records?${qs.toString()}`);
      return { records: records.map(r => ({ id: r.id, type: r.type, name: r.name, content: r.content, proxied: r.proxied, ttl: r.ttl })), total: records.length };
    }
    case 'worker_health_check': {
      const checks = (args.checks || []).slice(0, 20);
      const results = [];
      for (const c of checks) {
        try {
          const res = await fetch(c.url, { method: 'GET' });
          const ct = res.headers.get('content-type') || '';
          let body = null;
          if (ct.includes('application/json')) body = await res.clone().json().catch(() => null);
          results.push({ name: c.name || c.url, url: c.url, ok: res.ok, status: res.status, content_type: ct, json: body });
        } catch (e) {
          results.push({ name: c.name || c.url, url: c.url, ok: false, error: e.message });
        }
      }
      return { all_ok: results.every(r => r.ok), results };
    }
    case 'afo_harness_validate': {
      const res = await fetch(args.url);
      const html = await res.text();
      const wellKnownUrl = new URL('/.well-known/afo.json', args.url).toString();
      let afo = null;
      try { const j = await fetch(wellKnownUrl); afo = j.ok ? await j.json() : null; } catch {}
      const checks = {
        creator_visible: /Jared Edwards/i.test(html),
        category_visible: /Developer Tool|MCP Tool Generator/i.test(html),
        json_ld_present: /application\/ld\+json/i.test(html),
        afo_meta_present: /name=['"]afo:/i.test(html),
        agent_mirror_present: /id=['"]afo-identity/i.test(html),
        well_known_present: !!afo,
        corrections_present: /not SEO|not GEO|not an agency/i.test(html)
      };
      const score = Object.values(checks).filter(Boolean).length;
      return { url: args.url, score, max_score: Object.keys(checks).length, checks, afo_identity: afo?.identity || null };
    }
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ status: 'ok', worker: 'cloudflare-auditor-mcp', version: VERSION, tools: TOOLS.length }, { headers: CORS });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname !== '/mcp' || request.method !== 'POST') return new Response('not found', { status: 404, headers: CORS });
    let body;
    try { body = await request.json(); } catch { return rpcErr(null, -32700, 'Parse error'); }
    const { id, method, params } = body;
    if (method === 'initialize') return rpc(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'cloudflare-auditor-mcp', version: VERSION } });
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
