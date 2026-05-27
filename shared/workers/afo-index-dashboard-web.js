// afo-index-dashboard-web
// version: 0.1.0
// Thin SSR dashboard over afo-index-core-mcp
// Screens: Login, Home, Indexes, Index Detail, API Tokens, Saved Parses

const VERSION = "0.1.0";
const WORKER_NAME = "afo-index-dashboard-web";
const CORE_API = "https://afo-index-core-mcp.agentfeedoptimization.com/mcp";

// ── Hardcoded dev session (replace with token login after UI proves flow) ─────
const DEV_USER = "usr_jared";
const DEV_TENANT = "ten_afo";

// ── Core API client ───────────────────────────────────────────────────────────

async function core(tool, args = {}) {
  const res = await fetch(CORE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "tools/call",
      params: { name: tool, arguments: args }
    })
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return JSON.parse(json.result.content[0].text);
}

// ── Session helpers ───────────────────────────────────────────────────────────

function getSession(req) {
  const cookie = req.headers.get("Cookie") || "";
  const match = cookie.match(/afo_user=([^;]+)/);
  if (match) {
    try { return JSON.parse(decodeURIComponent(match[1])); } catch {}
  }
  // Dev fallback — no auth yet
  return { user_id: DEV_USER, tenant_id: DEV_TENANT, name: "Jared" };
}

function sessionCookie(user_id, tenant_id, name) {
  const val = encodeURIComponent(JSON.stringify({ user_id, tenant_id, name }));
  return `afo_user=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`;
}

// ── HTML shell ────────────────────────────────────────────────────────────────

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#020617;--surface:#0b1120;--card:#0f172a;--border:#1e293b;
  --border2:#263550;--text:#e2e8f0;--muted:#64748b;--dim:#94a3b8;
  --accent:#6366f1;--accent2:#818cf8;--green:#34d399;--red:#f87171;
  --yellow:#fbbf24;--blue:#3b82f6;
}
html,body{min-height:100%;background:var(--bg);color:var(--text);
  font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,monospace;font-size:13px}
a{color:var(--accent2);text-decoration:none}
a:hover{text-decoration:underline}

/* NAV */
.nav{position:sticky;top:0;z-index:10;background:var(--bg)ee;
  border-bottom:1px solid var(--border);padding:0 16px}
.nav-inner{max-width:960px;margin:auto;display:flex;align-items:center;
  justify-content:space-between;height:48px;gap:12px}
.brand{font:800 11px ui-monospace;color:var(--accent2);letter-spacing:.1em;
  text-transform:uppercase;white-space:nowrap}
.brand span{color:var(--muted)}
.nav-links{display:flex;gap:2px}
.nav-links a{padding:6px 10px;border-radius:8px;color:var(--dim);
  font:700 11px ui-monospace;text-transform:uppercase;letter-spacing:.06em;
  transition:all .15s}
.nav-links a:hover,.nav-links a.active{background:var(--border);
  color:var(--text);text-decoration:none}
.nav-user{font:700 10px ui-monospace;color:var(--muted);white-space:nowrap}

/* LAYOUT */
.wrap{max-width:960px;margin:auto;padding:20px 16px}
.page-title{font:800 18px ui-monospace;color:var(--text);
  letter-spacing:-.01em;margin-bottom:4px}
.page-sub{color:var(--muted);font-size:12px;margin-bottom:20px}

/* CARDS */
.card{background:var(--card);border:1px solid var(--border);
  border-radius:16px;padding:16px;margin-bottom:14px}
.card-title{font:800 11px ui-monospace;color:var(--dim);
  text-transform:uppercase;letter-spacing:.08em;margin-bottom:12px}
.grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.grid4{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}

/* STAT TILES */
.stat{background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:14px}
.stat-val{font:800 24px ui-monospace;color:var(--green);line-height:1}
.stat-val.acc{color:var(--accent2)}
.stat-val.yel{color:var(--yellow)}
.stat-label{font:700 10px ui-monospace;color:var(--muted);
  text-transform:uppercase;letter-spacing:.08em;margin-top:4px}

/* INDEX ROWS */
.idx-row{background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:12px 14px;margin-bottom:8px;
  display:flex;align-items:center;justify-content:space-between;gap:12px}
.idx-row:hover{border-color:var(--border2)}
.idx-name{font:700 13px ui-monospace;color:var(--text)}
.idx-meta{font:600 11px ui-monospace;color:var(--muted);margin-top:2px}
.idx-right{display:flex;align-items:center;gap:8px;flex-shrink:0}

/* ITEM ROWS */
.item-row{background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:12px 14px;margin-bottom:8px}
.item-title{font:700 12px ui-monospace;color:var(--text);margin-bottom:4px}
.item-url{font:600 11px ui-monospace;color:var(--muted);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  max-width:400px;display:block}
.item-footer{display:flex;align-items:center;gap:8px;margin-top:8px;flex-wrap:wrap}

/* TOKEN ROWS */
.tok-row{background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:12px 14px;margin-bottom:8px;
  display:flex;align-items:center;justify-content:space-between;gap:12px}

/* PILLS / BADGES */
.pill{display:inline-block;border-radius:6px;padding:3px 7px;
  font:700 10px ui-monospace;text-transform:uppercase;letter-spacing:.05em}
.pill-pub{background:#052e16;color:var(--green);border:1px solid #14532d}
.pill-priv{background:#1e293b;color:var(--dim);border:1px solid #334155}
.pill-trial{background:#1c1917;color:var(--yellow);border:1px solid #44403c}
.pill-paid{background:#1a1a2e;color:var(--accent2);border:1px solid #312e81}
.pill-type{background:#0c1330;color:#818cf8;border:1px solid #1e2d5a;
  font-size:9px;padding:2px 6px}

/* FORMS */
label{display:block;color:var(--dim);font:700 10px ui-monospace;
  text-transform:uppercase;letter-spacing:.06em;margin:10px 0 4px}
input,select,textarea{width:100%;border:1px solid var(--border);
  background:var(--bg);color:var(--text);border-radius:10px;
  padding:9px 11px;font:13px ui-monospace;
  transition:border-color .15s;outline:none}
input:focus,select:focus,textarea:focus{border-color:var(--accent)}
textarea{min-height:70px;resize:vertical}
.btn{display:inline-block;border:0;border-radius:10px;padding:9px 14px;
  font:700 12px ui-monospace;cursor:pointer;
  background:var(--accent);color:white;letter-spacing:.02em}
.btn:hover{background:#4f46e5}
.btn-sm{padding:5px 10px;font-size:11px;border-radius:8px}
.btn-ghost{background:transparent;border:1px solid var(--border);
  color:var(--dim)}
.btn-ghost:hover{border-color:var(--border2);color:var(--text)}
.btn-red{background:#450a0a;color:var(--red);border:1px solid #7f1d1d}
.btn-red:hover{background:#7f1d1d}
.btn-green{background:#052e16;color:var(--green);border:1px solid #14532d}
.btn-green:hover{background:#14532d}
.row-actions{display:flex;gap:6px;flex-wrap:wrap}

/* USAGE BAR */
.usage-bar{background:var(--border);border-radius:999px;height:6px;
  margin:6px 0;overflow:hidden}
.usage-fill{height:100%;border-radius:999px;background:var(--green);
  transition:width .4s}
.usage-fill.warn{background:var(--yellow)}
.usage-fill.over{background:var(--red)}

/* LOGIN */
.login-wrap{min-height:100vh;display:flex;align-items:center;
  justify-content:center;padding:20px}
.login-card{background:var(--card);border:1px solid var(--border);
  border-radius:20px;padding:32px;width:100%;max-width:380px}
.login-brand{font:800 13px ui-monospace;color:var(--accent2);
  letter-spacing:.1em;text-transform:uppercase;margin-bottom:24px}
.login-title{font:800 20px ui-monospace;color:var(--text);margin-bottom:6px}
.login-sub{color:var(--muted);font-size:12px;margin-bottom:24px;
  line-height:1.6}

/* ALERTS */
.alert{border-radius:10px;padding:10px 14px;margin-bottom:12px;
  font:600 12px ui-monospace}
.alert-ok{background:#052e16;border:1px solid #14532d;color:var(--green)}
.alert-err{background:#450a0a;border:1px solid #7f1d1d;color:var(--red)}

/* EMPTY */
.empty{text-align:center;padding:40px 20px;color:var(--muted);
  font:600 12px ui-monospace}
.empty big{display:block;font-size:28px;margin-bottom:8px}

/* BACK LINK */
.back{display:inline-flex;align-items:center;gap:6px;
  color:var(--muted);font:700 11px ui-monospace;margin-bottom:16px}
.back:hover{color:var(--text);text-decoration:none}

/* DIVIDER */
.divider{border:none;border-top:1px solid var(--border);margin:16px 0}

/* PULSE DOT */
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;
  background:var(--green);box-shadow:0 0 8px var(--green);flex-shrink:0}

@media(max-width:640px){
  .grid2,.grid3,.grid4{grid-template-columns:1fr}
  .idx-row{flex-direction:column;align-items:flex-start}
  .tok-row{flex-direction:column;align-items:flex-start}
  .nav-links a{padding:6px 8px;font-size:10px}
}
`;

function shell(title, body, { session, active = "" } = {}) {
  const user = session?.name || "guest";
  const nav = [
    ["home", "/", "Home"],
    ["indexes", "/indexes", "Indexes"],
    ["tokens", "/tokens", "API Tokens"],
    ["parses", "/parses", "Saved Parses"],
  ].map(([key, href, label]) =>
    `<a href="${href}" class="${active === key ? "active" : ""}">${label}</a>`
  ).join("");

  return `<!doctype html><html lang=en><head>
<meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>${title} — AFO Index</title>
<style>${CSS}</style>
</head><body>
<nav class=nav><div class=nav-inner>
  <div class=brand>AFO <span>//</span> INDEX</div>
  <div class=nav-links>${nav}</div>
  <div class=nav-user><span class=dot></span> ${escHtml(user)}</div>
</div></nav>
<div class=wrap>${body}</div>
</body></html>`;
}

function escHtml(s) {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function pillVis(v) {
  const cls = { public:"pill-pub", private:"pill-priv", trial:"pill-trial", paid:"pill-paid" }[v] || "pill-priv";
  return `<span class="pill ${cls}">${escHtml(v)}</span>`;
}

function pillType(t) {
  return `<span class="pill pill-type">${escHtml(t?.replace(/_index$/,""))}</span>`;
}

function fmtNum(n) { return Number(n || 0).toLocaleString(); }

function redirect(url) {
  return new Response(null, { status: 302, headers: { Location: url } });
}

function html(content, status = 200) {
  return new Response(content, { status, headers: { "Content-Type": "text/html;charset=utf-8" } });
}

// ── Page renderers ────────────────────────────────────────────────────────────

async function pageHome(session) {
  const [status, usage] = await Promise.all([
    core("index_core_status", {}),
    core("get_token_usage", { user_id: session.user_id }),
  ]);
  const counts = status.counts || {};
  const pct = Math.min(100, Math.round(((usage.items_today || 0) / (usage.trial_limit || 3)) * 100));
  const fillCls = pct >= 100 ? "over" : pct >= 70 ? "warn" : "";

  const body = `
<div class=page-title>Dashboard</div>
<div class=page-sub>Account overview for ${escHtml(session.user_id)} · ${escHtml(session.tenant_id)}</div>

<div class=grid4>
  <div class=stat>
    <div class="stat-val">${fmtNum(counts.indexes)}</div>
    <div class=stat-label>Indexes</div>
  </div>
  <div class=stat>
    <div class="stat-val">${fmtNum(counts.items)}</div>
    <div class=stat-label>Total Items</div>
  </div>
  <div class=stat>
    <div class="stat-val acc">${fmtNum(counts.public_items)}</div>
    <div class=stat-label>Public Items</div>
  </div>
  <div class=stat>
    <div class="stat-val yel">${fmtNum(counts.api_tokens)}</div>
    <div class=stat-label>API Tokens</div>
  </div>
</div>

<div class=grid2 style="margin-top:12px">
  <div class=card>
    <div class=card-title>Token Usage — Today</div>
    <div style="display:flex;justify-content:space-between;align-items:baseline">
      <span style="font:800 20px ui-monospace;color:var(--green)">${usage.items_today || 0}</span>
      <span style="color:var(--muted);font-size:11px">of ${usage.trial_limit} trial items</span>
    </div>
    <div class=usage-bar><div class="usage-fill ${fillCls}" style="width:${pct}%"></div></div>
    <div style="display:flex;justify-content:space-between;margin-top:6px">
      <span style="color:var(--muted);font-size:11px">${usage.trial_remaining} remaining</span>
      <span style="color:var(--muted);font-size:11px">${fmtNum(usage.total_tokens_estimated)} tk total</span>
    </div>
  </div>
  <div class=card>
    <div class=card-title>System</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
      <span class=dot></span>
      <span style="font:700 11px ui-monospace;color:var(--green)">afo-index-core-mcp</span>
      <span style="color:var(--muted);font-size:10px">v${escHtml(status.version || "—")}</span>
    </div>
    <div style="color:var(--muted);font-size:11px;line-height:1.7">
      Index types: ${(status.index_types || []).length}<br>
      Visibility tiers: ${(status.visibility_tiers || []).join(", ")}
    </div>
  </div>
</div>

<div class=card>
  <div class=card-title>Quick Actions</div>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <a class="btn btn-sm" href="/indexes/new">+ New Index</a>
    <a class="btn btn-sm btn-ghost" href="/indexes">Browse Indexes</a>
    <a class="btn btn-sm btn-ghost" href="/tokens/new">+ API Token</a>
    <a class="btn btn-sm btn-ghost" href="/parses">Saved Parses</a>
  </div>
</div>`;

  return html(shell("Home", body, { session, active: "home" }));
}

async function pageIndexes(session, msg = "") {
  const r = await core("list_indexes", { user_id: session.user_id });
  const indexes = r.indexes || [];

  const alert = msg ? `<div class="alert alert-ok">${escHtml(msg)}</div>` : "";
  const rows = indexes.length === 0
    ? `<div class=empty><big>📂</big>No indexes yet.<br><a href="/indexes/new">Create your first index →</a></div>`
    : indexes.map(idx => `
<div class=idx-row>
  <div>
    <div class=idx-name><a href="/indexes/${escHtml(idx.id)}">${escHtml(idx.name)}</a></div>
    <div class=idx-meta>${pillType(idx.type)} ${pillVis(idx.visibility)} &nbsp;${fmtNum(idx.item_count)} items</div>
  </div>
  <div class=idx-right>
    <a class="btn btn-sm btn-ghost" href="/indexes/${escHtml(idx.id)}">Open →</a>
  </div>
</div>`).join("");

  const body = `
<div class=page-title>Indexes</div>
<div class=page-sub>All indexes for ${escHtml(session.user_id)}</div>
${alert}
<div class=card>
  <div class=card-title>Create New Index</div>
  <form method=post action=/indexes/new>
    <div class=grid2>
      <div>
        <label>Name</label>
        <input name=name placeholder="My Parsed Web Index" required>
      </div>
      <div>
        <label>Type</label>
        <select name=type>
          <option value=parsed_web_index>parsed_web_index</option>
          <option value=toolsmith_index>toolsmith_index</option>
          <option value=semantic_index>semantic_index</option>
          <option value=agent_feed_index>agent_feed_index</option>
          <option value=prompt_index>prompt_index</option>
          <option value=faq_index>faq_index</option>
          <option value=agent_review_index>agent_review_index</option>
        </select>
      </div>
    </div>
    <div style="margin-top:10px">
      <label>Visibility</label>
      <select name=visibility>
        <option value=private>private</option>
        <option value=public>public</option>
        <option value=trial>trial</option>
      </select>
    </div>
    <div style="margin-top:12px">
      <button class=btn type=submit>Create Index</button>
    </div>
  </form>
</div>
<div class=card>
  <div class=card-title>Your Indexes (${indexes.length})</div>
  ${rows}
</div>`;

  return html(shell("Indexes", body, { session, active: "indexes" }));
}

async function pageIndexDetail(session, index_id, msg = "") {
  const [idxR, searchR] = await Promise.all([
    core("get_index", { index_id }),
    core("search_index", { index_id, q: " ", limit: 50 }).catch(() => ({ results: [] }))
  ]);

  if (!idxR.ok) return html(shell("Not Found", `<div class=empty><big>⚠️</big>Index not found.</div>`, { session, active: "indexes" }), 404);

  const idx = idxR.index;
  const items = searchR.results || [];
  const alert = msg ? `<div class="alert alert-ok">${escHtml(msg)}</div>` : "";

  const itemRows = items.length === 0
    ? `<div class=empty><big>📄</big>No items yet. Add one below.</div>`
    : items.map(it => `
<div class=item-row>
  <div class=item-title>${escHtml(it.title || "(untitled)")}</div>
  <span class=item-url>${escHtml(it.url || "")}</span>
  <div class=item-footer>
    ${pillVis(it.visibility)}
    <span style="color:var(--muted);font-size:10px">${fmtNum(it.token_estimate)} tk</span>
    <div class=row-actions>
      ${it.visibility === "public"
        ? `<form method=post action=/indexes/${escHtml(index_id)}/unpublish style=display:inline>
             <input type=hidden name=item_id value="${escHtml(it.id)}">
             <button class="btn btn-sm btn-ghost" type=submit>Unpublish</button>
           </form>`
        : `<form method=post action=/indexes/${escHtml(index_id)}/publish style=display:inline>
             <input type=hidden name=item_id value="${escHtml(it.id)}">
             <button class="btn btn-sm btn-green" type=submit>Publish</button>
           </form>`
      }
      <form method=post action=/indexes/${escHtml(index_id)}/delete-item style=display:inline
        onsubmit="return confirm('Delete this item?')">
        <input type=hidden name=item_id value="${escHtml(it.id)}">
        <button class="btn btn-sm btn-red" type=submit>Delete</button>
      </form>
    </div>
  </div>
</div>`).join("");

  const body = `
<a class=back href=/indexes>← Indexes</a>
<div class=page-title>${escHtml(idx.name)}</div>
<div class=page-sub>${pillType(idx.type)} ${pillVis(idx.visibility)} · ${fmtNum(idx.item_count)} items · id: ${escHtml(idx.id)}</div>
${alert}
<div class=card>
  <div class=card-title>Add Item</div>
  <form method=post action=/indexes/${escHtml(index_id)}/add-item>
    <label>Title</label>
    <input name=title placeholder="Page title">
    <label>URL</label>
    <input name=url placeholder="https://..." inputmode=url>
    <label>Body Text</label>
    <textarea name=body_text placeholder="Paste content or summary..."></textarea>
    <div style="margin-top:8px;display:flex;align-items:center;gap:10px">
      <select name=visibility style="width:auto">
        <option value=private>private</option>
        <option value=public>public</option>
      </select>
      <button class=btn type=submit>Add Item</button>
    </div>
  </form>
</div>
<div class=card>
  <div class=card-title>Items (${items.length})</div>
  ${itemRows}
</div>`;

  return html(shell(idx.name, body, { session, active: "indexes" }));
}

async function pageTokens(session, msg = "") {
  const usage = await core("get_token_usage", { user_id: session.user_id });
  const alert = msg ? `<div class="alert ${msg.startsWith("Error") ? "alert-err" : "alert-ok"}">${escHtml(msg)}</div>` : "";

  const body = `
<div class=page-title>API Tokens</div>
<div class=page-sub>Create and manage API tokens for ${escHtml(session.user_id)}</div>
${alert}
<div class=grid2>
  <div class=stat>
    <div class="stat-val yel">${fmtNum(usage.total_items)}</div>
    <div class=stat-label>Total Index Items</div>
  </div>
  <div class=stat>
    <div class="stat-val">${fmtNum(usage.total_tokens_estimated)}</div>
    <div class=stat-label>Est. Token Budget</div>
  </div>
</div>
<div class=card style="margin-top:12px">
  <div class=card-title>Create New API Token</div>
  <form method=post action=/tokens/new>
    <div class=grid2>
      <div>
        <label>Token Name</label>
        <input name=name placeholder="my-app-token" required>
      </div>
      <div>
        <label>Tier</label>
        <select name=tier>
          <option value=trial>trial</option>
          <option value=private>private</option>
          <option value=paid>paid</option>
        </select>
      </div>
    </div>
    <div style="margin-top:12px">
      <button class=btn type=submit>Create Token</button>
    </div>
  </form>
  <hr class=divider>
  <div style="color:var(--muted);font-size:11px;line-height:1.7">
    ⚠️ The raw token is shown once after creation. Copy and store it securely.<br>
    Token hashes are stored — the raw value is never retained.
  </div>
</div>
<div class=card>
  <div class=card-title>Today's Usage</div>
  <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
    <span style="font:700 12px ui-monospace">${usage.items_today || 0} items added today</span>
    <span style="color:var(--muted);font-size:11px">${usage.trial_remaining} trial slots remaining</span>
  </div>
  <div class=usage-bar>
    <div class="usage-fill" style="width:${Math.min(100, Math.round(((usage.items_today||0)/(usage.trial_limit||3))*100))}%"></div>
  </div>
  <div style="color:var(--muted);font-size:11px;margin-top:6px">
    Trial limit: ${usage.trial_limit} items/day · Total est. tokens: ${fmtNum(usage.total_tokens_estimated)}
  </div>
</div>`;

  return html(shell("API Tokens", body, { session, active: "tokens" }));
}

async function pageParses(session) {
  const r = await core("list_indexes", { user_id: session.user_id, type: "parsed_web_index" });
  const indexes = r.indexes || [];

  let items = [];
  let activeIdx = null;
  if (indexes.length > 0) {
    activeIdx = indexes[0];
    const sr = await core("search_index", { index_id: activeIdx.id, q: " ", limit: 50 }).catch(() => ({ results: [] }));
    items = sr.results || [];
  }

  const indexTabs = indexes.map(idx =>
    `<a href="/parses?idx=${encodeURIComponent(idx.id)}" class="${activeIdx?.id === idx.id ? "active" : ""}"
      style="padding:5px 10px;border-radius:8px;font:700 11px ui-monospace;
      ${activeIdx?.id === idx.id ? "background:var(--border);color:var(--text)" : "color:var(--muted)"}">
      ${escHtml(idx.name)} <span style="color:var(--muted)">(${fmtNum(idx.item_count)})</span>
    </a>`
  ).join("");

  const rows = items.length === 0
    ? `<div class=empty><big>📄</big>No saved parses yet.<br><a href="/parses/add">Add your first parse →</a></div>`
    : items.map(it => `
<div class=item-row>
  <div class=item-title>${escHtml(it.title || "(untitled)")}</div>
  <a class=item-url href="${escHtml(it.url || "#")}" target=_blank>${escHtml(it.url || "")}</a>
  <div class=item-footer>
    ${pillVis(it.visibility)}
    <span style="color:var(--muted);font-size:10px">${fmtNum(it.token_estimate)} tokens</span>
    ${activeIdx ? `<a class="btn btn-sm btn-ghost" href="/indexes/${escHtml(activeIdx.id)}">Manage →</a>` : ""}
  </div>
</div>`).join("");

  const body = `
<div class=page-title>Saved Parses</div>
<div class=page-sub>Your parsed_web_index items</div>
${indexes.length === 0 ? "" : `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">${indexTabs}</div>`}
${indexes.length === 0
  ? `<div class=card><div class=empty><big>📂</big>No parsed_web_index found.<br>
     <a href="/indexes/new">Create one →</a> then add items.</div></div>`
  : `<div class=card>
       <div class=card-title>${escHtml(activeIdx?.name || "")} — ${items.length} items</div>
       ${rows}
       <hr class=divider>
       <a class="btn btn-sm btn-ghost" href="/indexes/${escHtml(activeIdx?.id || "")}">Manage this index →</a>
     </div>`
}`;

  return html(shell("Saved Parses", body, { session, active: "parses" }));
}

async function pageTokenCreated(session, token, tokenId, name, tier) {
  const body = `
<a class=back href=/tokens>← API Tokens</a>
<div class=page-title>Token Created</div>
<div class=page-sub>Copy this token now — it will not be shown again.</div>
<div class=card>
  <div class="alert alert-ok">✅ Token created: ${escHtml(name)} (${escHtml(tier)})</div>
  <div class=card-title>Raw Token — Copy Now</div>
  <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;
    padding:12px;font:12px ui-monospace;color:var(--accent2);
    overflow-x:auto;white-space:nowrap;user-select:all;margin-bottom:10px">
    ${escHtml(token)}
  </div>
  <div style="color:var(--muted);font-size:11px;line-height:1.7">
    Token ID: ${escHtml(tokenId)}<br>
    Tier: ${escHtml(tier)}<br>
    ⚠️ This is the only time you'll see this token. Store it in a secret manager.
  </div>
  <hr class=divider>
  <a class="btn btn-sm btn-ghost" href=/tokens>← Back to Tokens</a>
</div>`;

  return html(shell("Token Created", body, { session, active: "tokens" }));
}

// ── POST handlers ─────────────────────────────────────────────────────────────

async function handleCreateIndex(req, session) {
  const form = await req.formData();
  const name = form.get("name")?.trim();
  const type = form.get("type");
  const visibility = form.get("visibility") || "private";
  if (!name) return redirect("/indexes?msg=Name+required");
  const r = await core("create_index", { user_id: session.user_id, tenant_id: session.tenant_id, name, type, visibility });
  if (!r.ok) return redirect(`/indexes?msg=${encodeURIComponent("Error: " + r.error)}`);
  return redirect(`/indexes/${r.index.id}?msg=Index+created`);
}

async function handleAddItem(req, session, index_id) {
  const form = await req.formData();
  const title = form.get("title")?.trim();
  const url = form.get("url")?.trim();
  const body_text = form.get("body_text")?.trim();
  const visibility = form.get("visibility") || "private";
  const r = await core("add_index_item", { index_id, user_id: session.user_id, title, url, body_text, visibility });
  if (!r.ok) return redirect(`/indexes/${index_id}?msg=${encodeURIComponent("Error: " + r.error)}`);
  return redirect(`/indexes/${index_id}?msg=Item+added`);
}

async function handlePublish(req, session, index_id, action) {
  const form = await req.formData();
  const item_id = form.get("item_id");
  const tool = action === "publish" ? "publish_index_item" : "unpublish_index_item";
  await core(tool, { item_id, user_id: session.user_id });
  return redirect(`/indexes/${index_id}?msg=${action === "publish" ? "Published" : "Unpublished"}`);
}

async function handleDeleteItem(req, session, index_id) {
  const form = await req.formData();
  const item_id = form.get("item_id");
  await core("delete_index_item", { item_id, user_id: session.user_id });
  return redirect(`/indexes/${index_id}?msg=Item+deleted`);
}

async function handleCreateToken(req, session) {
  const form = await req.formData();
  const name = form.get("name")?.trim();
  const tier = form.get("tier") || "trial";
  if (!name) return redirect("/tokens?msg=Name+required");
  const r = await core("create_api_token", { user_id: session.user_id, tenant_id: session.tenant_id, name, tier });
  if (!r.ok) return redirect(`/tokens?msg=${encodeURIComponent("Error: " + r.error)}`);
  return pageTokenCreated(session, r.token, r.token_id, r.name, r.tier);
}

// ── Router ────────────────────────────────────────────────────────────────────

export default {
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;
    const msg = url.searchParams.get("msg") || "";

    if (path === "/health") {
      return new Response(JSON.stringify({ status: "ok", worker: WORKER_NAME, version: VERSION }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    const session = getSession(req);

    try {
      // GET routes
      if (req.method === "GET") {
        if (path === "/" || path === "/home") return pageHome(session);
        if (path === "/indexes") return pageIndexes(session, msg);
        if (path === "/indexes/new") return pageIndexes(session, msg);
        if (path.match(/^\/indexes\/([^/]+)$/)) {
          const id = path.match(/^\/indexes\/([^/]+)$/)[1];
          return pageIndexDetail(session, id, msg);
        }
        if (path === "/tokens" || path === "/tokens/new") return pageTokens(session, msg);
        if (path === "/parses") return pageParses(session);
        return html(shell("Not Found", `<div class=empty><big>🔍</big>Page not found. <a href="/">Go home</a></div>`, { session }), 404);
      }

      // POST routes
      if (req.method === "POST") {
        if (path === "/indexes/new") return handleCreateIndex(req, session);
        const addItem = path.match(/^\/indexes\/([^/]+)\/add-item$/);
        if (addItem) return handleAddItem(req, session, addItem[1]);
        const publish = path.match(/^\/indexes\/([^/]+)\/(publish|unpublish)$/);
        if (publish) return handlePublish(req, session, publish[1], publish[2]);
        const delItem = path.match(/^\/indexes\/([^/]+)\/delete-item$/);
        if (delItem) return handleDeleteItem(req, session, delItem[1]);
        if (path === "/tokens/new") return handleCreateToken(req, session);
        return redirect("/");
      }

      return redirect("/");
    } catch (e) {
      const errBody = `<div class=card><div class="alert alert-err">Error: ${escHtml(e.message)}</div>
        <a class="btn btn-sm btn-ghost" href="/">← Home</a></div>`;
      return html(shell("Error", errBody, { session }), 500);
    }
  }
};
