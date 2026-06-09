import { mapBusinessDataToSiteContent } from "./mapper.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), { status, headers: JSON_HEADERS });
}

function methodNotAllowed() {
  return json({ ok: false, error: "method_not_allowed" }, 405);
}

function getCorsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization"
  };
}

function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(getCorsHeaders())) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function assertWriteAllowed(args) {
  if (args?.confirm_write !== true) throw new Error("confirm_write_required");
}

async function cloudflareD1Query(env, args, sql, params = []) {
  const accountId  = args.account_id    || env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken   = args.api_token     || env.CLOUDFLARE_API_TOKEN;
  const databaseId = args.d1_database_id || args.database_id || env.DEFAULT_D1_DATABASE_ID;
  if (!accountId)  throw new Error("missing_account_id");
  if (!apiToken)   throw new Error("missing_api_token");
  if (!databaseId) throw new Error("missing_d1_database_id");
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "authorization": `Bearer ${apiToken}`, "content-type": "application/json" },
    body: JSON.stringify({ sql, params })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.success === false) {
    throw new Error(`d1_query_failed:${response.status}:${JSON.stringify(body)}`);
  }
  return body;
}

async function upsertSiteContentRows(env, args, rows) {
  const mode  = args.mode  || "replace_keys";
  const table = args.table || "site_content";
  const now   = new Date().toISOString();
  const written = [];
  for (const row of rows) {
    const key = args.key_prefix ? `${args.key_prefix}${row.key}` : row.key;
    if (mode === "insert_only") {
      await cloudflareD1Query(env, args,
        `INSERT INTO ${table} (key, value, type, updated_at) VALUES (?, ?, ?, ?)`,
        [key, row.value, row.type || "text", now]
      );
    } else {
      await cloudflareD1Query(env, args,
        `INSERT INTO ${table} (key, value, type, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, type = excluded.type, updated_at = excluded.updated_at`,
        [key, row.value, row.type || "text", now]
      );
    }
    written.push(key);
  }
  return written;
}

async function triggerSnapshot(args) {
  const url = args.snapshot_url ||
    (args.target_worker_url && `${String(args.target_worker_url).replace(/\/$/, "")}/api/admin/snapshot`);
  if (!url) return { ok: false, skipped: true, reason: "missing_snapshot_url" };
  const headers = { "content-type": "application/json" };
  if (args.admin_token)    headers.authorization       = `Bearer ${args.admin_token}`;
  if (args.admin_password) headers["x-admin-password"] = args.admin_password;
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ source: "afo-biz-inject-mcp" })
  });
  const body = await response.text();
  return { ok: response.ok, status: response.status, body: body.slice(0, 2000) };
}

const tools = [
  {
    name: "inject_status",
    description: "Health check for the AFO business data injection MCP.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "inject_business_data",
    description: "Write normalized business data into a target Cloudflare D1 site_content table. Requires confirm_write: true.",
    inputSchema: {
      type: "object",
      properties: {
        confirm_write:     { type: "boolean", description: "Must be true to execute writes." },
        business:          { type: "object",  description: "Raw or normalized business data from DocParse." },
        normalized:        { type: "object",  description: "Pre-normalized business data (alternative to business)." },
        account_id:        { type: "string",  description: "Cloudflare account ID." },
        api_token:         { type: "string",  description: "Cloudflare API token." },
        d1_database_id:    { type: "string",  description: "Target D1 database UUID." },
        table:             { type: "string",  description: "Table name. Default: site_content." },
        key_prefix:        { type: "string",  description: "Optional prefix for all written keys." },
        mode:              { type: "string",  description: "replace_keys (default) or insert_only." },
        trigger_snapshot:  { type: "boolean", description: "Trigger snapshot rebuild after write. Default: true." },
        target_worker_url: { type: "string",  description: "Base URL of the demo worker." },
        snapshot_url:      { type: "string",  description: "Explicit snapshot endpoint URL." },
        admin_token:       { type: "string",  description: "Bearer token for snapshot auth." },
        admin_password:    { type: "string",  description: "x-admin-password header value." }
      },
      required: ["confirm_write"]
    }
  },
  {
    name: "trigger_snapshot",
    description: "Trigger a snapshot rebuild on a cloned demo worker. Requires confirm_write: true.",
    inputSchema: {
      type: "object",
      properties: {
        confirm_write:     { type: "boolean" },
        target_worker_url: { type: "string" },
        snapshot_url:      { type: "string" },
        admin_token:       { type: "string" },
        admin_password:    { type: "string" }
      },
      required: ["confirm_write"]
    }
  }
];

async function callTool(env, name, args = {}) {
  if (name === "inject_status") {
    return { ok: true, worker: env.MCP_SERVER_NAME || "afo-biz-inject-mcp", version: env.MCP_SERVER_VERSION || "0.1.0", tools: tools.map(t => t.name) };
  }
  if (name === "trigger_snapshot") {
    assertWriteAllowed(args);
    return triggerSnapshot(args);
  }
  if (name === "inject_business_data") {
    assertWriteAllowed(args);
    const rows         = mapBusinessDataToSiteContent(args);
    const written_keys = await upsertSiteContentRows(env, args, rows);
    const snapshot     = args.trigger_snapshot === false ? { ok: true, skipped: true } : await triggerSnapshot(args);
    return { ok: true, written_keys, row_count: written_keys.length, snapshot };
  }
  throw new Error(`unknown_tool:${name}`);
}

async function handleMcp(request, env) {
  if (request.method === "GET") {
    return json({ ok: true, name: env.MCP_SERVER_NAME || "afo-biz-inject-mcp", version: env.MCP_SERVER_VERSION || "0.1.0", tools });
  }
  if (request.method !== "POST") return methodNotAllowed();

  const body   = await readJson(request);
  const method = body.method || body.type;
  const id     = body.id ?? null;

  if (method === "initialize") {
    return json({
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities:    { tools: {} },
        serverInfo:      { name: env.MCP_SERVER_NAME || "afo-biz-inject-mcp", version: env.MCP_SERVER_VERSION || "0.1.0" }
      }
    });
  }

  if (method === "notifications/initialized") {
    return new Response(null, { status: 204, headers: getCorsHeaders() });
  }

  if (method === "tools/list") {
    return json({ jsonrpc: "2.0", id, result: { tools } });
  }

  if (method === "tools/call") {
    const name = body.params?.name || body.name;
    const args = body.params?.arguments || body.arguments || {};
    try {
      const result = await callTool(env, name, args);
      return json({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result } });
    } catch (error) {
      return json({ jsonrpc: "2.0", id, error: { code: -32603, message: error.message } }, 400);
    }
  }

  return json({ ok: false, error: "unsupported_mcp_method", supported: ["initialize", "tools/list", "tools/call"] }, 400);
}

async function handleHttp(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null, { headers: getCorsHeaders() });
  if (url.pathname === "/" || url.pathname === "/health" || url.pathname === "/status") return json(await callTool(env, "inject_status", {}));
  if (url.pathname === "/mcp")        return handleMcp(request, env);
  if (url.pathname === "/tools/list") return json({ tools });
  if (url.pathname === "/tools/call") {
    if (request.method !== "POST") return methodNotAllowed();
    const body = await readJson(request);
    try {
      return json(await callTool(env, body.name || body.tool_name, body.arguments || body));
    } catch (error) {
      return json({ ok: false, error: error.message }, 400);
    }
  }
  return json({ ok: false, error: "not_found" }, 404);
}

export default {
  async fetch(request, env) {
    return withCors(await handleHttp(request, env));
  }
};
