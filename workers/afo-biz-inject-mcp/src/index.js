import { mapBusinessDataToSiteContent } from "./mapper.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function json(value, status = 200) {
  return new Response(JSON.stringify(value, null, 2), { status, headers: JSON_HEADERS });
}
function methodNotAllowed() { return json({ ok: false, error: "method_not_allowed" }, 405); }
function getCorsHeaders() {
  return { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,authorization" };
}
function withCors(response) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(getCorsHeaders())) headers.set(k, v);
  return new Response(response.body, { status: response.status, headers });
}
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function assertWriteAllowed(args) {
  if (args?.confirm_write !== true) throw new Error("confirm_write_required");
}

// ── Cloudflare D1 REST API ────────────────────────────────────────────────────

async function cloudflareD1Query(env, args, sql, params = []) {
  const accountId  = args.account_id     || env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken   = args.api_token      || env.CLOUDFLARE_API_TOKEN;
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
  if (!response.ok || body.success === false) throw new Error(`d1_query_failed:${response.status}:${JSON.stringify(body)}`);
  return body;
}

// ── Demo DB mode: writes to demo_content (slug, section, data) ────────────────
// Used when args.tenant_slug is provided — targets afo-demo-db shared database.

async function upsertDemoContentRows(env, args, rows, slug) {
  const now = new Date().toISOString();
  const written = [];

  // Merge scalar contact fields into one contact section blob
  const contactFields = ["company_name", "phone", "email", "address", "website",
                         "primary_color", "secondary_color", "accent_color", "hours", "tagline", "hero_image"];
  const contactBlob = {};
  const otherRows   = [];

  for (const row of rows) {
    if (contactFields.includes(row.key)) {
      // Map mapper field names to template field names
      const keyMap = { company_name: "company" };
      const k = keyMap[row.key] || row.key;
      contactBlob[k] = row.value;
    } else if (row.key === "hours") {
      contactBlob.hours = row.value;
    } else {
      otherRows.push(row);
    }
  }

  if (Object.keys(contactBlob).length > 0) {
    await cloudflareD1Query(env, args,
      `INSERT INTO demo_content (slug, section, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(slug, section) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
      [slug, "contact", JSON.stringify(contactBlob), now]
    );
    written.push("contact");
  }

  for (const row of otherRows) {
    if (row.key === "business_profile") continue; // skip — not needed in demo DB
    const data = row.type === "json" ? row.value : JSON.stringify(row.value);
    await cloudflareD1Query(env, args,
      `INSERT INTO demo_content (slug, section, data, updated_at) VALUES (?, ?, ?, ?)
       ON CONFLICT(slug, section) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
      [slug, row.key, data, now]
    );
    written.push(row.key);
  }

  return written;
}

// ── Legacy site_content mode: writes to site_content (section, data) ──────────
// Used when no tenant_slug — targets contractor/existing demo workers.

async function upsertSiteContentRows(env, args, rows) {
  const table = args.table || "site_content";
  const now   = new Date().toISOString();
  const written = [];

  const contactFields = ["company_name", "phone", "email", "address", "website",
                         "primary_color", "secondary_color", "accent_color"];
  const contactBlob = {};
  const otherRows   = [];

  for (const row of rows) {
    if (contactFields.includes(row.key)) contactBlob[row.key] = row.value;
    else otherRows.push(row);
  }

  if (Object.keys(contactBlob).length > 0) {
    let existing = {};
    try {
      const res = await cloudflareD1Query(env, args, `SELECT data FROM ${table} WHERE section=?`, ["contact"]);
      const dataStr = res.results?.[0]?.[0]?.data || res.results?.[0]?.data;
      if (dataStr) existing = JSON.parse(dataStr);
    } catch { /* fresh start */ }
    const merged = { ...existing, ...contactBlob };
    await cloudflareD1Query(env, args,
      `INSERT INTO ${table} (section, data, updated_at) VALUES (?,?,?)
       ON CONFLICT(section) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
      ["contact", JSON.stringify(merged), now]
    );
    written.push("contact");
  }

  for (const row of otherRows) {
    const data = row.type === "json" ? row.value : JSON.stringify(row.value);
    await cloudflareD1Query(env, args,
      `INSERT INTO ${table} (section, data, updated_at) VALUES (?,?,?)
       ON CONFLICT(section) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at`,
      [row.key, data, now]
    );
    written.push(row.key);
  }

  return written;
}

// ── Register tenant in demo_tenants table ─────────────────────────────────────

async function registerTenant(env, args, slug, business) {
  const now  = new Date().toISOString();
  const name = business.company_name || business.business_name || business.name || slug;
  await cloudflareD1Query(env, args,
    `INSERT INTO tenants (slug, name, vertical, source_url, created_at, updated_at) VALUES (?,?,?,?,?,?)
     ON CONFLICT(slug) DO UPDATE SET name=excluded.name, vertical=excluded.vertical, source_url=excluded.source_url, updated_at=excluded.updated_at`,
    [slug, name, args.vertical || "generic", business.website || business.source_url || "", now, now]
  );
}

// ── Snapshot trigger ──────────────────────────────────────────────────────────

async function triggerSnapshot(args) {
  const base = args.target_worker_url ? String(args.target_worker_url).replace(/\/$/, "") : null;
  const url  = args.snapshot_url || (base && `${base}/api/publish`);
  if (!url) return { ok: false, skipped: true, reason: "missing_snapshot_url" };
  const headers = { "content-type": "application/json" };
  if (args.admin_token)    headers.authorization       = `Bearer ${args.admin_token}`;
  if (args.admin_password) headers["x-admin-password"] = args.admin_password;
  const response = await fetch(url, { method: "POST", headers, body: JSON.stringify({ source: "afo-biz-inject-mcp" }) });
  const body = await response.text();
  return { ok: response.ok, status: response.status, body: body.slice(0, 2000) };
}

// ── Tools ─────────────────────────────────────────────────────────────────────

const tools = [
  {
    name: "inject_status",
    description: "Health check for the AFO business data injection MCP.",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "inject_business_data",
    description: "Write normalized business data into a Cloudflare D1 database and trigger a snapshot rebuild. Supports two modes: (1) tenant_slug mode — writes to afo-demo-db demo_content table keyed by slug, for use with afo-demo-template clones; (2) legacy mode — writes to site_content table in contractor/custom worker DBs. Requires confirm_write: true.",
    inputSchema: {
      type: "object",
      properties: {
        confirm_write:     { type: "boolean",  description: "Must be true to execute writes." },
        business:          { type: "object",   description: "Business data from DocParse or manual entry." },
        tenant_slug:       { type: "string",   description: "Demo slug (e.g. watersedge). When set, writes to demo_content table in afo-demo-db and registers the tenant. Use this for afo-demo-template deployments." },
        vertical:          { type: "string",   description: "Business vertical (restaurant, contractor, spa, etc). Stored on tenant record." },
        account_id:        { type: "string",   description: "Cloudflare account ID. Falls back to CLOUDFLARE_ACCOUNT_ID secret." },
        api_token:         { type: "string",   description: "Cloudflare API token. Falls back to CLOUDFLARE_API_TOKEN secret." },
        d1_database_id:    { type: "string",   description: "Target D1 database UUID. Use afo-demo-db UUID for demo template deployments." },
        table:             { type: "string",   description: "Table name for legacy mode. Default: site_content." },
        trigger_snapshot:  { type: "boolean",  description: "Call /api/publish on target worker after write. Default: true." },
        target_worker_url: { type: "string",   description: "Base URL of the demo worker." },
        snapshot_url:      { type: "string",   description: "Override snapshot endpoint URL." },
        admin_token:       { type: "string",   description: "Bearer token for snapshot auth." },
        admin_password:    { type: "string",   description: "x-admin-password header value." }
      },
      required: ["confirm_write"]
    }
  },
  {
    name: "trigger_snapshot",
    description: "Trigger a snapshot rebuild on a demo worker via POST /api/publish. Requires confirm_write: true.",
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
    return { ok: true, worker: env.MCP_SERVER_NAME || "afo-biz-inject-mcp", version: env.MCP_SERVER_VERSION || "0.3.0", tools: tools.map(t => t.name) };
  }
  if (name === "trigger_snapshot") {
    assertWriteAllowed(args);
    return triggerSnapshot(args);
  }
  if (name === "inject_business_data") {
    assertWriteAllowed(args);
    const business = args.business || args.normalized || args;
    const rows     = mapBusinessDataToSiteContent(args);
    let written_keys;

    if (args.tenant_slug) {
      // Demo DB mode — write to demo_content keyed by slug
      written_keys = await upsertDemoContentRows(env, args, rows, args.tenant_slug);
      // Register/update tenant record
      await registerTenant(env, args, args.tenant_slug, business);
    } else {
      // Legacy mode — write to site_content
      written_keys = await upsertSiteContentRows(env, args, rows);
    }

    const snapshot = args.trigger_snapshot === false
      ? { ok: true, skipped: true }
      : await triggerSnapshot(args);

    return { ok: true, mode: args.tenant_slug ? "demo_db" : "legacy", tenant_slug: args.tenant_slug || null, written_keys, row_count: written_keys.length, snapshot };
  }
  throw new Error(`unknown_tool:${name}`);
}

// ── MCP protocol ──────────────────────────────────────────────────────────────

async function handleMcp(request, env) {
  if (request.method === "GET") return json({ ok: true, name: env.MCP_SERVER_NAME || "afo-biz-inject-mcp", version: env.MCP_SERVER_VERSION || "0.3.0", tools });
  if (request.method !== "POST") return methodNotAllowed();
  const body   = await readJson(request);
  const method = body.method || body.type;
  const id     = body.id ?? null;
  if (method === "initialize") return json({ jsonrpc: "2.0", id, result: { protocolVersion: "2024-11-05", capabilities: { tools: {} }, serverInfo: { name: env.MCP_SERVER_NAME || "afo-biz-inject-mcp", version: env.MCP_SERVER_VERSION || "0.3.0" } } });
  if (method === "notifications/initialized") return new Response(null, { status: 204, headers: getCorsHeaders() });
  if (method === "tools/list") return json({ jsonrpc: "2.0", id, result: { tools } });
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
  return json({ ok: false, error: "unsupported_mcp_method" }, 400);
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
    try { return json(await callTool(env, body.name || body.tool_name, body.arguments || body)); }
    catch (error) { return json({ ok: false, error: error.message }, 400); }
  }
  return json({ ok: false, error: "not_found" }, 404);
}

export default {
  async fetch(request, env) { return withCors(await handleHttp(request, env)); }
};
