// afo-index-core-mcp
// version: 0.1.0
// AFO Mobile MCP Protocol — hand-rolled JSON-RPC 2.0
// Tools: create_index, list_indexes, get_index, add_index_item, search_index,
//        publish_index_item, unpublish_index_item, delete_index_item,
//        create_api_token, resolve_api_token, get_token_usage, index_core_status

const VERSION = "0.1.0";
const WORKER_NAME = "afo-index-core-mcp";

const VALID_INDEX_TYPES = [
  "toolsmith_index",
  "parsed_web_index",
  "semantic_index",
  "agent_feed_index",
  "prompt_index",
  "faq_index",
  "agent_review_index",
];

const VALID_VISIBILITY = ["public", "private", "trial", "paid"];
const FREE_TRIAL_LIMIT = 3;

// ── Helpers ──────────────────────────────────────────────────────────────────

function uid(prefix) {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${ts}${rand}`;
}

function now() {
  return new Date().toISOString();
}

function hashToken(token) {
  // Simple deterministic hash — good enough for D1 lookup key
  let h = 0;
  for (let i = 0; i < token.length; i++) {
    h = (Math.imul(31, h) + token.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(8, "0") + token.slice(-8);
}

function ok(data) {
  return { ok: true, ...data };
}

function err(msg, code = 400) {
  return { ok: false, error: msg, code };
}

function jsonResp(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mkcors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function index_core_status(env) {
  const counts = {};
  try {
    const r1 = await env.DB.prepare("SELECT COUNT(*) as c FROM indexes").first();
    const r2 = await env.DB.prepare("SELECT COUNT(*) as c FROM index_items").first();
    const r3 = await env.DB.prepare("SELECT COUNT(*) as c FROM api_tokens").first();
    const r4 = await env.DB.prepare(
      "SELECT COUNT(*) as c FROM index_items WHERE visibility = 'public'"
    ).first();
    counts.indexes = r1?.c ?? 0;
    counts.items = r2?.c ?? 0;
    counts.public_items = r4?.c ?? 0;
    counts.api_tokens = r3?.c ?? 0;
  } catch (e) {
    counts.error = e.message;
  }
  return ok({
    worker: WORKER_NAME,
    version: VERSION,
    bindings: { DB: !!env.DB },
    counts,
    index_types: VALID_INDEX_TYPES,
    visibility_tiers: VALID_VISIBILITY,
  });
}

async function create_index(env, { user_id, tenant_id, name, type, visibility }) {
  if (!user_id) return err("user_id required");
  if (!name) return err("name required");
  if (!type || !VALID_INDEX_TYPES.includes(type))
    return err(`type must be one of: ${VALID_INDEX_TYPES.join(", ")}`);
  const vis = visibility || "private";
  if (!VALID_VISIBILITY.includes(vis)) return err("invalid visibility");

  const id = uid("idx");
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO indexes (id, user_id, tenant_id, name, type, visibility, item_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`
  )
    .bind(id, user_id, tenant_id || "", name, type, vis, ts, ts)
    .run();

  return ok({ index: { id, user_id, tenant_id, name, type, visibility: vis, item_count: 0, created_at: ts } });
}

async function list_indexes(env, { user_id, tenant_id, type }) {
  if (!user_id && !tenant_id) return err("user_id or tenant_id required");
  let sql = "SELECT * FROM indexes WHERE 1=1";
  const params = [];
  if (user_id) { sql += " AND user_id = ?"; params.push(user_id); }
  if (tenant_id) { sql += " AND tenant_id = ?"; params.push(tenant_id); }
  if (type) { sql += " AND type = ?"; params.push(type); }
  sql += " ORDER BY updated_at DESC LIMIT 100";

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return ok({ indexes: rows.results || [], count: (rows.results || []).length });
}

async function get_index(env, { index_id }) {
  if (!index_id) return err("index_id required");
  const row = await env.DB.prepare("SELECT * FROM indexes WHERE id = ?").bind(index_id).first();
  if (!row) return err("index not found", 404);
  return ok({ index: row });
}

async function add_index_item(env, { index_id, user_id, title, url, body_text, payload, visibility }) {
  if (!index_id) return err("index_id required");
  if (!user_id) return err("user_id required");

  // Verify index exists
  const idx = await env.DB.prepare("SELECT id FROM indexes WHERE id = ?").bind(index_id).first();
  if (!idx) return err("index not found", 404);

  const vis = visibility || "private";
  if (!VALID_VISIBILITY.includes(vis)) return err("invalid visibility");

  // Rough token estimate: ~1 token per 4 chars
  const textLen = (body_text || "").length + (title || "").length;
  const token_estimate = Math.ceil(textLen / 4);

  const id = uid("itm");
  const ts = now();
  await env.DB.prepare(
    `INSERT INTO index_items (id, index_id, user_id, title, url, body_text, payload_json, token_estimate, visibility, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id, index_id, user_id,
      title || null, url || null, body_text || null,
      JSON.stringify(payload || {}),
      token_estimate, vis, ts, ts
    )
    .run();

  // Update item_count
  await env.DB.prepare(
    "UPDATE indexes SET item_count = item_count + 1, updated_at = ? WHERE id = ?"
  ).bind(ts, index_id).run();

  return ok({ item: { id, index_id, user_id, title, url, token_estimate, visibility: vis, created_at: ts } });
}

async function search_index(env, { index_id, user_id, q, visibility, limit }) {
  if (!index_id) return err("index_id required");
  if (!q) return err("q (search query) required");
  const lim = Math.min(limit || 20, 100);
  const like = `%${q}%`;

  let sql = `SELECT id, index_id, user_id, title, url, token_estimate, visibility, created_at
             FROM index_items WHERE index_id = ?
             AND (title LIKE ? OR body_text LIKE ? OR url LIKE ?)`;
  const params = [index_id, like, like, like];

  if (user_id) { sql += " AND user_id = ?"; params.push(user_id); }
  if (visibility) { sql += " AND visibility = ?"; params.push(visibility); }
  sql += " ORDER BY updated_at DESC LIMIT ?";
  params.push(lim);

  const rows = await env.DB.prepare(sql).bind(...params).all();
  return ok({ results: rows.results || [], count: (rows.results || []).length, q });
}

async function set_item_visibility(env, { item_id, user_id, visibility }) {
  if (!item_id) return err("item_id required");
  if (!user_id) return err("user_id required");
  if (!VALID_VISIBILITY.includes(visibility)) return err("invalid visibility");

  const row = await env.DB.prepare(
    "SELECT id, user_id FROM index_items WHERE id = ?"
  ).bind(item_id).first();
  if (!row) return err("item not found", 404);
  if (row.user_id !== user_id) return err("forbidden", 403);

  const ts = now();
  await env.DB.prepare(
    "UPDATE index_items SET visibility = ?, updated_at = ? WHERE id = ?"
  ).bind(visibility, ts, item_id).run();

  return ok({ item_id, visibility, updated_at: ts });
}

async function delete_index_item(env, { item_id, user_id }) {
  if (!item_id) return err("item_id required");
  if (!user_id) return err("user_id required");

  const row = await env.DB.prepare(
    "SELECT id, user_id, index_id FROM index_items WHERE id = ?"
  ).bind(item_id).first();
  if (!row) return err("item not found", 404);
  if (row.user_id !== user_id) return err("forbidden", 403);

  await env.DB.prepare("DELETE FROM index_items WHERE id = ?").bind(item_id).run();
  const ts = now();
  await env.DB.prepare(
    "UPDATE indexes SET item_count = MAX(0, item_count - 1), updated_at = ? WHERE id = ?"
  ).bind(ts, row.index_id).run();

  return ok({ deleted: item_id });
}

async function create_api_token(env, { user_id, tenant_id, name, tier }) {
  if (!user_id) return err("user_id required");
  if (!name) return err("name required");

  const validTiers = ["trial", "private", "paid"];
  const t = tier || "trial";
  if (!validTiers.includes(t)) return err(`tier must be one of: ${validTiers.join(", ")}`);

  // Generate token
  const raw = uid("tok") + Math.random().toString(36).slice(2);
  const token_hash = hashToken(raw);
  const id = uid("atk");
  const ts = now();

  await env.DB.prepare(
    `INSERT INTO api_tokens (id, user_id, tenant_id, name, token_hash, tier, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, user_id, tenant_id || "", name, token_hash, t, ts).run();

  // Return raw token once — not stored, only hash kept
  return ok({ token_id: id, token: raw, name, tier: t, created_at: ts,
    warning: "Store this token securely — it will not be shown again." });
}

async function resolve_api_token(env, { token }) {
  if (!token) return err("token required");
  const token_hash = hashToken(token);
  const row = await env.DB.prepare(
    "SELECT id, user_id, tenant_id, name, tier, created_at, expires_at, last_used_at FROM api_tokens WHERE token_hash = ?"
  ).bind(token_hash).first();
  if (!row) return err("invalid token", 401);

  // Check expiry
  if (row.expires_at && new Date(row.expires_at) < new Date()) return err("token expired", 401);

  // Update last_used_at
  await env.DB.prepare(
    "UPDATE api_tokens SET last_used_at = ? WHERE id = ?"
  ).bind(now(), row.id).run();

  return ok({ valid: true, token_id: row.id, user_id: row.user_id,
    tenant_id: row.tenant_id, name: row.name, tier: row.tier });
}

async function get_token_usage(env, { user_id, token_id }) {
  if (!user_id && !token_id) return err("user_id or token_id required");

  // For trial tier: count items created this calendar day
  let sql = "SELECT COUNT(*) as c FROM index_items WHERE 1=1";
  const params = [];
  if (user_id) { sql += " AND user_id = ?"; params.push(user_id); }

  const today = new Date().toISOString().slice(0, 10);
  sql += " AND created_at >= ?";
  params.push(today + "T00:00:00.000Z");

  const row = await env.DB.prepare(sql).bind(...params).first();
  const items_today = row?.c ?? 0;

  // Total items
  let sql2 = "SELECT COUNT(*) as c, SUM(token_estimate) as t FROM index_items WHERE 1=1";
  const params2 = [];
  if (user_id) { sql2 += " AND user_id = ?"; params2.push(user_id); }
  const row2 = await env.DB.prepare(sql2).bind(...params2).first();

  return ok({
    user_id,
    items_today,
    trial_limit: FREE_TRIAL_LIMIT,
    trial_remaining: Math.max(0, FREE_TRIAL_LIMIT - items_today),
    total_items: row2?.c ?? 0,
    total_tokens_estimated: row2?.t ?? 0,
  });
}

// ── Tool dispatch ─────────────────────────────────────────────────────────────

const TOOLS_MANIFEST = [
  {
    name: "index_core_status",
    description: "Show afo-index-core-mcp status, counts, and available index types.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "create_index",
    description: "Create a named index of a given type for a user.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        tenant_id: { type: "string" },
        name: { type: "string" },
        type: { type: "string", enum: VALID_INDEX_TYPES },
        visibility: { type: "string", enum: VALID_VISIBILITY },
      },
      required: ["user_id", "name", "type"],
    },
  },
  {
    name: "list_indexes",
    description: "List all indexes for a user or tenant, optionally filtered by type.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        tenant_id: { type: "string" },
        type: { type: "string", enum: VALID_INDEX_TYPES },
      },
      required: [],
    },
  },
  {
    name: "get_index",
    description: "Get metadata and item count for a specific index.",
    inputSchema: {
      type: "object",
      properties: { index_id: { type: "string" } },
      required: ["index_id"],
    },
  },
  {
    name: "add_index_item",
    description: "Add an item to an index. Returns token estimate.",
    inputSchema: {
      type: "object",
      properties: {
        index_id: { type: "string" },
        user_id: { type: "string" },
        title: { type: "string" },
        url: { type: "string" },
        body_text: { type: "string" },
        payload: { type: "object" },
        visibility: { type: "string", enum: VALID_VISIBILITY },
      },
      required: ["index_id", "user_id"],
    },
  },
  {
    name: "search_index",
    description: "Full-text search within an index across title, body, and URL.",
    inputSchema: {
      type: "object",
      properties: {
        index_id: { type: "string" },
        user_id: { type: "string" },
        q: { type: "string" },
        visibility: { type: "string" },
        limit: { type: "number" },
      },
      required: ["index_id", "q"],
    },
  },
  {
    name: "publish_index_item",
    description: "Set an item's visibility to public.",
    inputSchema: {
      type: "object",
      properties: { item_id: { type: "string" }, user_id: { type: "string" } },
      required: ["item_id", "user_id"],
    },
  },
  {
    name: "unpublish_index_item",
    description: "Set an item's visibility back to private.",
    inputSchema: {
      type: "object",
      properties: { item_id: { type: "string" }, user_id: { type: "string" } },
      required: ["item_id", "user_id"],
    },
  },
  {
    name: "delete_index_item",
    description: "Permanently delete an item from an index.",
    inputSchema: {
      type: "object",
      properties: { item_id: { type: "string" }, user_id: { type: "string" } },
      required: ["item_id", "user_id"],
    },
  },
  {
    name: "create_api_token",
    description: "Create a named API token for a user. Returns raw token once — store it securely.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        tenant_id: { type: "string" },
        name: { type: "string" },
        tier: { type: "string", enum: ["trial", "private", "paid"] },
      },
      required: ["user_id", "name"],
    },
  },
  {
    name: "resolve_api_token",
    description: "Validate an API token and return user/tenant info.",
    inputSchema: {
      type: "object",
      properties: { token: { type: "string" } },
      required: ["token"],
    },
  },
  {
    name: "get_token_usage",
    description: "Get token budget usage for a user — items today vs trial limit, total items, total token estimate.",
    inputSchema: {
      type: "object",
      properties: {
        user_id: { type: "string" },
        token_id: { type: "string" },
      },
      required: [],
    },
  },
];

async function dispatch(tool, args, env) {
  switch (tool) {
    case "index_core_status":    return index_core_status(env);
    case "create_index":         return create_index(env, args);
    case "list_indexes":         return list_indexes(env, args);
    case "get_index":            return get_index(env, args);
    case "add_index_item":       return add_index_item(env, args);
    case "search_index":         return search_index(env, args);
    case "publish_index_item":   return set_item_visibility(env, { ...args, visibility: "public" });
    case "unpublish_index_item": return set_item_visibility(env, { ...args, visibility: "private" });
    case "delete_index_item":    return delete_index_item(env, args);
    case "create_api_token":     return create_api_token(env, args);
    case "resolve_api_token":    return resolve_api_token(env, args);
    case "get_token_usage":      return get_token_usage(env, args);
    default: return err(`unknown tool: ${tool}`, 404);
  }
}

// ── MCP handler ───────────────────────────────────────────────────────────────

async function handleMCP(req, env) {
  let body;
  try { body = await req.json(); } catch { return jsonResp({ error: "invalid JSON" }, 400); }

  const { jsonrpc, id, method, params } = body;

  if (method === "tools/list") {
    return jsonResp({ jsonrpc: "2.0", id, result: { tools: TOOLS_MANIFEST } });
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};
    if (!toolName) return jsonResp({ jsonrpc: "2.0", id, error: { code: -32602, message: "name required" } });

    if (!env.DB) {
      return jsonResp({ jsonrpc: "2.0", id, error: { code: -32603, message: "DB binding not configured" } });
    }

    try {
      const result = await dispatch(toolName, args, env);
      return jsonResp({
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },
      });
    } catch (e) {
      return jsonResp({ jsonrpc: "2.0", id, error: { code: -32603, message: e.message } });
    }
  }

  return jsonResp({ jsonrpc: "2.0", id, error: { code: -32601, message: `unknown method: ${method}` } });
}

// ── Main fetch handler ────────────────────────────────────────────────────────

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = mkcors();

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // Health
    if (url.pathname === "/health" && req.method === "GET") {
      const status = await index_core_status(env).catch(e => ({ error: e.message }));
      return new Response(JSON.stringify({ status: "ok", ...status }, null, 2), {
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    // MCP endpoint
    if (url.pathname === "/mcp" && req.method === "POST") {
      const resp = await handleMCP(req, env);
      Object.entries(cors).forEach(([k, v]) => resp.headers.set(k, v));
      return resp;
    }

    return new Response(JSON.stringify({ error: "not found", worker: WORKER_NAME }), {
      status: 404,
      headers: { "Content-Type": "application/json", ...cors },
    });
  },
};
