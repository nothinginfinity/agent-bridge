// afo-mobile-terminal-mcp v0.1.0
// Command-center layer above individual MCP tools.
// Orchestrates: deploy, smoke test, registry, handoff, Cloudflare inventory.
// All write actions are preview-first and confirmation-gated.
// Never expose secret values in UI, logs, receipts, or /health output.

const VERSION = "0.1.0";
const WORKER_NAME = "afo-mobile-terminal-mcp";

const TOOL_NAMES = [
  "list_command_belts",
  "list_registered_workers",
  "open_worker_urls",
  "validate_worker",
  "preview_worker_deploy",
  "deploy_worker",
  "run_smoke_test",
  "list_recent_deploys",
  "register_worker",
  "write_handoff"
];

// Integration targets (env-configured)
// DEPLOY_MCP_URL  — afo-mobile-deploy-mcp base URL
// REGISTRY_URL    — AFO Tool Index / registry if available
// HANDOFF_MCP_URL — Message OS / handoff inbox if available
// CF_GATEWAY_URL  — Cloudflare infra gateway if available
// GITHUB_TOKEN    — GitHub repo source-of-truth
// CF_ACCOUNT_ID   — Cloudflare account (write actions only)
// CF_API_TOKEN    — Cloudflare API token (write actions only)
// CF_WORKERS_SUBDOMAIN — workers.dev subdomain

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (request.method === "GET" && url.pathname === "/health") return jsonRes(healthPayload(env));
      if (request.method === "GET" && url.pathname === "/llms.txt") return textRes(llmsText(url.origin));
      if (request.method === "GET" && url.pathname === "/tools/list") return jsonRes({ ok: true, tools: toolsList() });
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/ui")) return htmlRes(indexHtml());
      if (request.method === "GET" && (url.pathname === "/contracts/ui-contract.json" || url.pathname === "/ui-contract.json")) return jsonRes(uiContract());
      if (request.method === "POST" && url.pathname === "/mcp") return jsonRes(await handleMcp(request, env));
      return jsonRes({ ok: false, error: "not_found", path: url.pathname }, 404);
    } catch (err) {
      return jsonRes({ ok: false, error: "internal_error", message: String(err?.message || err) }, 500);
    }
  }
};

// ─── MCP dispatcher ───────────────────────────────────────────────────────────

async function handleMcp(request, env) {
  const body = await request.json().catch(() => ({}));
  const method = body.method || body.name || body.tool_name;
  if (method === "tools/list" || method === "list_tools") return { ok: true, tools: toolsList() };
  if (method === "tools/call") {
    const p = body.params || body.arguments || {};
    return dispatch(p.name || p.tool_name, p.arguments || p.params || {}, env);
  }
  return dispatch(method, body.arguments || body.params || {}, env);
}

async function dispatch(name, args, env) {
  if (!TOOL_NAMES.includes(name)) return { ok: false, error: "unknown_tool", name, available_tools: TOOL_NAMES };
  switch (name) {
    case "list_command_belts":    return listCommandBelts(args, env);
    case "list_registered_workers": return listRegisteredWorkers(args, env);
    case "open_worker_urls":      return openWorkerUrls(args, env);
    case "validate_worker":       return validateWorker(args, env);
    case "preview_worker_deploy": return previewWorkerDeploy(args, env);
    case "deploy_worker":         return deployWorker(args, env);
    case "run_smoke_test":        return runSmokeTest(args, env);
    case "list_recent_deploys":   return listRecentDeploys(args, env);
    case "register_worker":       return registerWorker(args, env);
    case "write_handoff":         return writeHandoff(args, env);
  }
}

// ─── Tool implementations ─────────────────────────────────────────────────────

/** list_command_belts — list available command belts / integration targets */
async function listCommandBelts(args, env) {
  const deployMcpUrl = env.DEPLOY_MCP_URL || "https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev";
  const belts = [
    { name: "afo-mobile-deploy-mcp", url: deployMcpUrl, status: await pingHealth(deployMcpUrl), role: "deploy" },
    { name: "afo-mobile-terminal-mcp", url: env.TERMINAL_SELF_URL || "https://afo-mobile-terminal-mcp.jaredtechfit.workers.dev", status: "self", role: "command-center" },
    { name: "registry", url: env.REGISTRY_URL || null, status: env.REGISTRY_URL ? await pingHealth(env.REGISTRY_URL) : "not_configured", role: "registry" },
    { name: "handoff-mcp", url: env.HANDOFF_MCP_URL || null, status: env.HANDOFF_MCP_URL ? await pingHealth(env.HANDOFF_MCP_URL) : "not_configured", role: "handoff" },
    { name: "cf-gateway", url: env.CF_GATEWAY_URL || null, status: env.CF_GATEWAY_URL ? await pingHealth(env.CF_GATEWAY_URL) : "not_configured", role: "cloudflare_infra" }
  ];
  return { ok: true, belts };
}

/** list_registered_workers — list workers from registry or GitHub deployments folder */
async function listRegisteredWorkers(args, env) {
  if (env.REGISTRY_URL) {
    const res = await safePost(`${trimSlash(env.REGISTRY_URL)}/mcp`, { method: "tools/call", params: { name: "list_workers", arguments: args } });
    if (res.ok) return { ok: true, source: "registry", workers: res.result?.workers || res.result || [] };
  }
  // Fallback: list from GitHub deployments folder
  const repo = args.repo || "nothinginfinity/agent-bridge";
  const path = args.deployments_path || "shared/deployments";
  return githubListContent(env, ...parseRepo(repo), path, args.branch || "main");
}

/** open_worker_urls — return live URLs for a given worker script_name */
async function openWorkerUrls(args, env) {
  const scriptName = args.script_name;
  if (!scriptName) return { ok: false, error: "script_name required" };
  const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
  const customDomain = args.custom_domain || null;
  const base = customDomain ? `https://${customDomain}` : `https://${scriptName}.${subdomain}.workers.dev`;
  const urls = {
    home: base,
    health: `${base}/health`,
    mcp: `${base}/mcp`,
    llms: `${base}/llms.txt`,
    tools: `${base}/tools/list`,
    ui_contract: `${base}/contracts/ui-contract.json`
  };
  // Optionally smoke-check reachability
  if (args.check_live !== false) {
    urls._health_ok = await httpOk(urls.health);
  }
  return { ok: true, script_name: scriptName, base, urls };
}

/** validate_worker — proxy to afo-mobile-deploy-mcp validate_worker_folder */
async function validateWorker(args, env) {
  return proxyToDeployMcp("validate_worker_folder", args, env);
}

/** preview_worker_deploy — preview without writing to Cloudflare */
async function previewWorkerDeploy(args, env) {
  const validation = await proxyToDeployMcp("preview_worker_from_github", args, env);
  return {
    ok: validation.ok,
    mode: "preview",
    note: "No changes written to Cloudflare. Call deploy_worker with confirmed:true to proceed.",
    preview: validation
  };
}

/** deploy_worker — confirmation-gated deploy via afo-mobile-deploy-mcp */
async function deployWorker(args, env) {
  if (!args.confirmed) {
    const preview = await previewWorkerDeploy(args, env);
    return {
      ok: false,
      error: "confirmation_required",
      message: "Review the preview and call deploy_worker again with confirmed:true to proceed.",
      preview
    };
  }
  return proxyToDeployMcp("deploy_worker_from_github", args, env);
}

/** run_smoke_test — proxy to afo-mobile-deploy-mcp run_worker_smoke_test */
async function runSmokeTest(args, env) {
  return proxyToDeployMcp("run_worker_smoke_test", args, env);
}

/** list_recent_deploys — proxy to afo-mobile-deploy-mcp list_recent_deploys */
async function listRecentDeploys(args, env) {
  return proxyToDeployMcp("list_recent_deploys", args, env);
}

/** register_worker — confirmation-gated. Upsert worker metadata to registry or GitHub. */
async function registerWorker(args, env) {
  if (!args.confirmed) {
    return {
      ok: false,
      error: "confirmation_required",
      message: "Review the payload below and call register_worker again with confirmed:true to proceed.",
      preview: buildRegistrationPayload(args, env)
    };
  }
  const payload = buildRegistrationPayload(args, env);
  // Attempt registry MCP if available
  if (env.REGISTRY_URL) {
    const res = await safePost(`${trimSlash(env.REGISTRY_URL)}/mcp`, { method: "tools/call", params: { name: "upsert_worker", arguments: payload } });
    if (res.ok) return { ok: true, source: "registry", result: res.result, payload };
  }
  // Fallback: write registration JSON to GitHub
  const repo = args.repo || "nothinginfinity/agent-bridge";
  const branch = args.branch || "main";
  const scriptName = args.script_name || "unknown-worker";
  const path = `shared/workers/${scriptName}/registration.json`;
  const put = await githubPutContent(env, ...parseRepo(repo), path, branch, {
    message: `Register worker: ${scriptName}`,
    content: JSON.stringify(payload, null, 2) + "\n"
  });
  return { ok: put.ok, source: "github", path, status: put.status, payload };
}

/** write_handoff — confirmation-gated. Write a handoff note to GitHub or handoff MCP. */
async function writeHandoff(args, env) {
  if (!args.confirmed) {
    return {
      ok: false,
      error: "confirmation_required",
      message: "Review the handoff note below and call write_handoff again with confirmed:true to proceed.",
      preview: buildHandoffNote(args)
    };
  }
  const note = buildHandoffNote(args);
  // Attempt handoff MCP if available
  if (env.HANDOFF_MCP_URL) {
    const res = await safePost(`${trimSlash(env.HANDOFF_MCP_URL)}/mcp`, { method: "tools/call", params: { name: "write_handoff", arguments: note } });
    if (res.ok) return { ok: true, source: "handoff-mcp", result: res.result };
  }
  // Fallback: write to GitHub shared/handoffs
  const repo = args.repo || "nothinginfinity/agent-bridge";
  const branch = args.branch || "main";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = `shared/handoffs/handoff-${stamp}.md`;
  const put = await githubPutContent(env, ...parseRepo(repo), path, branch, {
    message: `Write handoff: ${args.title || "untitled"}`,
    content: renderHandoffMd(note)
  });
  return { ok: put.ok, source: "github", path, status: put.status, note };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function proxyToDeployMcp(toolName, args, env) {
  const base = trimSlash(env.DEPLOY_MCP_URL || "https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev");
  // Forward GITHUB_TOKEN / CF creds via args so deploy-mcp can use them
  const enriched = {
    ...args,
    ...(env.GITHUB_TOKEN ? { _github_token: env.GITHUB_TOKEN } : {}),
    ...(env.CF_ACCOUNT_ID ? { _cf_account_id: env.CF_ACCOUNT_ID } : {}),
    ...(env.CF_API_TOKEN ? { _cf_api_token: env.CF_API_TOKEN } : {})
  };
  // Note: deploy-mcp reads creds from its own env bindings;
  // these _prefixed fields are informational only and ignored by current deploy-mcp.
  // Real credential forwarding requires deploy-mcp env bindings to be set directly.
  const res = await safePost(`${base}/mcp`, {
    method: "tools/call",
    params: { name: toolName, arguments: args }
  });
  return res;
}

function buildRegistrationPayload(args, env) {
  const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
  const scriptName = args.script_name || "unknown-worker";
  const base = args.custom_domain ? `https://${args.custom_domain}` : `https://${scriptName}.${subdomain}.workers.dev`;
  return {
    script_name: scriptName,
    display_name: args.display_name || scriptName,
    description: args.description || "",
    repo: args.repo || "nothinginfinity/agent-bridge",
    worker_path: args.worker_path || `workers/${scriptName}`,
    base_url: base,
    health_url: args.health_url || `${base}/health`,
    mcp_url: args.mcp_url || `${base}/mcp`,
    llms_url: `${base}/llms.txt`,
    tools_url: `${base}/tools/list`,
    tags: args.tags || [],
    registered_at: new Date().toISOString(),
    registered_by: WORKER_NAME
  };
}

function buildHandoffNote(args) {
  return {
    title: args.title || "Untitled Handoff",
    from: args.from || WORKER_NAME,
    to: args.to || "all",
    project: args.project || "",
    type: args.type || "handoff",
    status: args.status || "",
    body: args.body || args.message || "",
    next_steps: args.next_steps || [],
    created_at: new Date().toISOString()
  };
}

function renderHandoffMd(note) {
  const steps = Array.isArray(note.next_steps) && note.next_steps.length
    ? "\n\n## Next Steps\n" + note.next_steps.map((s, i) => `${i + 1}. ${s}`).join("\n")
    : "";
  return `# ${note.title}\n\nfrom: ${note.from}\nto: ${note.to}\nproject: ${note.project}\ntype: ${note.type}\nstatus: ${note.status}\ndate: ${note.created_at}\n\n---\n\n${note.body}${steps}\n`;
}

async function pingHealth(url) {
  if (!url) return "not_configured";
  try {
    const r = await fetch(`${trimSlash(url)}/health`, { signal: AbortSignal.timeout(4000) });
    return r.ok ? "ok" : `error_${r.status}`;
  } catch {
    return "unreachable";
  }
}

async function httpOk(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(5000) }); return r.ok; } catch { return false; }
}

async function safePost(url, body) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });
    const json = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, result: json };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

async function githubGetContent(env, owner, repo, path, ref) {
  if (!env.GITHUB_TOKEN) return { ok: false, error: "missing_GITHUB_TOKEN" };
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref || "main")}`,
    { headers: githubHeaders(env) }
  );
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const body = await res.json();
  if (Array.isArray(body)) return { ok: false, error: "path_is_directory" };
  const content = body.encoding === "base64" ? decodeBase64(body.content || "") : await (await fetch(body.download_url)).text();
  return { ok: true, sha: body.sha, size: body.size, path: body.path, content };
}

async function githubListContent(env, owner, repo, path, ref) {
  if (!env.GITHUB_TOKEN) return { ok: false, error: "missing_GITHUB_TOKEN" };
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref || "main")}`,
    { headers: githubHeaders(env) }
  );
  const body = await safeJson(res);
  return {
    ok: res.ok, status: res.status, path,
    items: Array.isArray(body) ? body.map(x => ({ name: x.name, path: x.path, type: x.type, size: x.size, sha: x.sha, url: x.html_url })) : [],
    error: res.ok ? undefined : body
  };
}

async function githubPutContent(env, owner, repo, path, branch, data) {
  if (!env.GITHUB_TOKEN) return { ok: false, error: "missing_GITHUB_TOKEN" };
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}`,
    {
      method: "PUT",
      headers: githubHeaders(env),
      body: JSON.stringify({ message: data.message, content: encodeBase64(data.content), branch: branch || "main" })
    }
  );
  return { ok: res.ok, status: res.status, result: await safeJson(res) };
}

function githubHeaders(env) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${env.GITHUB_TOKEN}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": WORKER_NAME
  };
}

function parseRepo(repo) { const [owner, name] = String(repo || "").split("/"); return [owner, name]; }
function cleanPath(p) { return String(p || "").replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/"); }
function trimSlash(s) { return String(s || "").replace(/\/+$/g, ""); }
function encodePath(path) { return cleanPath(path).split("/").map(encodeURIComponent).join("/"); }
function decodeBase64(s) { const bin = atob(String(s).replace(/\s/g, "")); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
function encodeBase64(s) { let bin = ""; for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b); return btoa(bin); }
async function safeJson(res) { const txt = await res.text(); try { return JSON.parse(txt); } catch { return { raw: txt }; } }

// ─── Response helpers ─────────────────────────────────────────────────────────

function jsonRes(obj, status = 200) { return cors(new Response(JSON.stringify(obj, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8" } })); }
function textRes(s, status = 200) { return cors(new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } })); }
function htmlRes(s, status = 200) { return cors(new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8" } })); }
function cors(res) {
  const h = new Headers(res.headers);
  h.set("access-control-allow-origin", "*");
  h.set("access-control-allow-methods", "GET,POST,OPTIONS");
  h.set("access-control-allow-headers", "content-type,authorization");
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

// ─── Static payloads ──────────────────────────────────────────────────────────

function healthPayload(env) {
  return {
    ok: true,
    worker: WORKER_NAME,
    version: VERSION,
    tools: TOOL_NAMES.length,
    integrations: {
      deploy_mcp: env.DEPLOY_MCP_URL ? "configured" : "default",
      registry: env.REGISTRY_URL ? "configured" : "not_configured",
      handoff_mcp: env.HANDOFF_MCP_URL ? "configured" : "not_configured",
      cf_gateway: env.CF_GATEWAY_URL ? "configured" : "not_configured",
      github: env.GITHUB_TOKEN ? "configured" : "not_configured"
      // Note: never expose token values here
    }
  };
}

function toolsList() {
  return TOOL_NAMES.map(name => ({ name, description: DESCRIPTIONS[name], input_schema: { type: "object" } }));
}

const DESCRIPTIONS = {
  list_command_belts: "List all configured command belts and their live status (deploy-mcp, registry, handoff-mcp, cf-gateway).",
  list_registered_workers: "List registered workers from registry or GitHub deployments folder.",
  open_worker_urls: "Return all live URLs for a given worker script_name (home, health, mcp, llms, tools, ui_contract).",
  validate_worker: "Validate a Worker folder structure and entrypoint in GitHub. Proxies to afo-mobile-deploy-mcp.",
  preview_worker_deploy: "Preview a deployment plan without writing to Cloudflare. Returns validation + URLs.",
  deploy_worker: "Deploy a Worker from GitHub to Cloudflare. Preview-first — requires confirmed:true to execute.",
  run_smoke_test: "Run smoke tests against a live Worker (health, mcp tools/list, llms.txt, optional custom paths).",
  list_recent_deploys: "List recent deployment receipts from GitHub for a given worker or the default deployments folder.",
  register_worker: "Register or update Worker metadata in the registry or GitHub. Requires confirmed:true to write.",
  write_handoff: "Write a handoff note to the handoff MCP or GitHub shared/handoffs. Requires confirmed:true to write."
};

function llmsText(origin) {
  return `# ${WORKER_NAME}\n\nPurpose: Command-center layer above AFO MCP tools. Orchestrates deploy, smoke test, registry, handoff, and Cloudflare inventory for mobile-first workflows.\n\nBase URL: ${origin}\n\nRoutes:\n- GET /       — Mobile terminal UI\n- GET /health — Health check (no secrets exposed)\n- GET /llms.txt\n- GET /tools/list\n- POST /mcp   — MCP tool surface\n- GET /contracts/ui-contract.json\n\nTools (${TOOL_NAMES.length}):\n${TOOL_NAMES.map(n => `- ${n}`).join("\n")}\n\nIntegration targets:\n- afo-mobile-deploy-mcp (deploy, validate, smoke test, receipts)\n- AFO Tool Index / registry (list workers, register)\n- Message OS handoff-mcp (write handoffs)\n- Cloudflare infra gateway (inventory)\n- GitHub (source-of-truth for source, receipts, handoffs)\n\nAll write actions are preview-first and confirmation-gated.\nNever exposes secret values in UI, logs, receipts, or /health.\n`;
}

function uiContract() {
  return {
    name: WORKER_NAME,
    version: VERSION,
    cards: [
      { id: "deploy_worker",       label: "Deploy Worker",      tool: "deploy_worker",         inputs: ["repo","branch","worker_path","script_name"], confirm_required: true },
      { id: "smoke_test",          label: "Smoke Test Worker",  tool: "run_smoke_test",         inputs: ["script_name","smoke_paths"] },
      { id: "list_recent_deploys", label: "List Recent Deploys",tool: "list_recent_deploys",    inputs: ["repo","script_name"] },
      { id: "register_worker",     label: "Register Worker",    tool: "register_worker",        inputs: ["script_name","description","tags"], confirm_required: true },
      { id: "open_urls",           label: "Open Tool URLs",     tool: "open_worker_urls",       inputs: ["script_name","custom_domain"] },
      { id: "write_handoff",       label: "Write Handoff",      tool: "write_handoff",          inputs: ["title","from","to","project","body","next_steps"], confirm_required: true }
    ]
  };
}

function indexHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>AFO Mobile Terminal</title>
  <style>
    :root {
      --bg: #0b1020; --surface: #121a33; --surface2: #1a2540;
      --border: #26345f; --text: #eef2ff; --muted: #8899cc;
      --accent: #3b82f6; --accent2: #60a5fa; --success: #22c55e;
      --warn: #f59e0b; --error: #ef4444;
      --radius: 14px; --transition: 160ms cubic-bezier(0.16,1,0.3,1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100dvh; }
    header { padding: 18px 20px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
    header svg { flex-shrink: 0; }
    header h1 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
    header .version { font-size: 11px; color: var(--muted); background: var(--surface2); padding: 2px 8px; border-radius: 99px; border: 1px solid var(--border); }
    main { max-width: 680px; margin: 0 auto; padding: 20px 16px 80px; }
    .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 24px 0 10px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
    .card h2 { font-size: 14px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .card h2 .icon { width: 28px; height: 28px; background: var(--surface2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; margin-top: 10px; }
    input, select, textarea {
      width: 100%; padding: 10px 12px; background: var(--surface2); border: 1px solid var(--border);
      border-radius: 10px; color: var(--text); font-size: 14px;
      transition: border-color var(--transition);
    }
    input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
    textarea { resize: vertical; min-height: 80px; }
    .btn-row { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    button {
      flex: 1; min-width: 120px; padding: 11px 16px; border: none; border-radius: 10px;
      font-size: 14px; font-weight: 600; cursor: pointer;
      transition: opacity var(--transition), transform var(--transition);
    }
    button:active { transform: scale(0.97); }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
    .btn-danger { background: #7f1d1d; color: #fca5a5; }
    .output {
      margin-top: 14px; background: #080d1c; border-radius: 10px; padding: 12px 14px;
      font-family: "Menlo", "Monaco", monospace; font-size: 12px; line-height: 1.6;
      white-space: pre-wrap; color: #94a3b8; max-height: 320px; overflow-y: auto;
    }
    .output.ok   { border-left: 3px solid var(--success); }
    .output.err  { border-left: 3px solid var(--error); }
    .output.warn { border-left: 3px solid var(--warn); }
    .tag { display: inline-block; font-size: 11px; padding: 2px 8px; border-radius: 99px; margin-right: 4px; }
    .tag-ok   { background: #14532d; color: #86efac; }
    .tag-warn { background: #78350f; color: #fde68a; }
    .tag-err  { background: #7f1d1d; color: #fca5a5; }
    .confirm-gate {
      background: #1c1408; border: 1px solid #78350f; border-radius: 10px;
      padding: 12px 14px; margin-top: 12px; font-size: 13px; color: #fde68a; display: none;
    }
    .confirm-gate.visible { display: block; }
  </style>
</head>
<body>
<header>
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-label="AFO Terminal">
    <rect width="32" height="32" rx="9" fill="#1e3a8a"/>
    <rect x="6" y="9" width="20" height="14" rx="2" stroke="#60a5fa" stroke-width="1.5" fill="none"/>
    <path d="M9 13l3 3-3 3" stroke="#93c5fd" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M15 19h8" stroke="#60a5fa" stroke-width="1.5" stroke-linecap="round"/>
  </svg>
  <h1>AFO Mobile Terminal</h1>
  <span class="version">v${VERSION}</span>
</header>

<main>

  <p class="section-label">Worker Target</p>
  <div class="card">
    <h2><span class="icon">🎯</span> Target Worker</h2>
    <label>Repo (owner/name)</label>
    <input id="repo" value="nothinginfinity/agent-bridge">
    <label>Branch</label>
    <input id="branch" value="main">
    <label>Worker Path</label>
    <input id="worker_path" placeholder="workers/my-worker">
    <label>Script Name (Cloudflare)</label>
    <input id="script_name" placeholder="my-worker">
  </div>

  <p class="section-label">Build Pipeline</p>

  <div class="card">
    <h2><span class="icon">✅</span> Validate Worker</h2>
    <div class="btn-row">
      <button class="btn-secondary" onclick="callTool('validate_worker')">Validate Folder</button>
      <button class="btn-secondary" onclick="callTool('preview_worker_deploy')">Preview Deploy</button>
    </div>
    <div id="out-validate" class="output">Ready.</div>
  </div>

  <div class="card">
    <h2><span class="icon">🚀</span> Deploy Worker</h2>
    <div class="confirm-gate visible" id="deploy-gate">
      ⚠️ Write action — run Preview first, then click Deploy with Confirm to proceed.
    </div>
    <div class="btn-row">
      <button class="btn-primary" onclick="deployConfirmed()">Deploy (confirmed)</button>
    </div>
    <div id="out-deploy" class="output">Not yet deployed.</div>
  </div>

  <div class="card">
    <h2><span class="icon">🧪</span> Smoke Test</h2>
    <label>Extra smoke paths (comma-separated, optional)</label>
    <input id="smoke_paths" placeholder="/ui,/contracts/ui-contract.json">
    <div class="btn-row">
      <button class="btn-secondary" onclick="callSmokeTest()">Run Smoke Test</button>
    </div>
    <div id="out-smoke" class="output">Not yet tested.</div>
  </div>

  <p class="section-label">Discovery</p>

  <div class="card">
    <h2><span class="icon">🔗</span> Open Tool URLs</h2>
    <div class="btn-row">
      <button class="btn-secondary" onclick="callOpenUrls()">Get Live URLs</button>
    </div>
    <div id="out-urls" class="output">Enter script name above.</div>
  </div>

  <div class="card">
    <h2><span class="icon">📋</span> Recent Deploys</h2>
    <div class="btn-row">
      <button class="btn-secondary" onclick="callTool('list_recent_deploys', null, 'out-receipts')">List Recent Deploys</button>
    </div>
    <div id="out-receipts" class="output">Enter repo + script name above.</div>
  </div>

  <div class="card">
    <h2><span class="icon">🗂️</span> Command Belts</h2>
    <div class="btn-row">
      <button class="btn-secondary" onclick="callTool('list_command_belts', {}, 'out-belts')">List Belts</button>
    </div>
    <div id="out-belts" class="output">Not fetched.</div>
  </div>

  <p class="section-label">Write Actions (confirmation-gated)</p>

  <div class="card">
    <h2><span class="icon">📝</span> Register Worker</h2>
    <label>Description</label>
    <input id="reg-description" placeholder="What does this worker do?">
    <label>Tags (comma-separated)</label>
    <input id="reg-tags" placeholder="deploy, mobile, mcp">
    <div class="btn-row">
      <button class="btn-secondary" onclick="previewRegister()">Preview Registration</button>
      <button class="btn-danger" onclick="confirmRegister()">Register (confirmed)</button>
    </div>
    <div id="out-register" class="output">Not yet registered.</div>
  </div>

  <div class="card">
    <h2><span class="icon">🤝</span> Write Handoff</h2>
    <label>Title</label>
    <input id="ho-title" placeholder="Handoff title">
    <label>To (agent or team)</label>
    <input id="ho-to" value="all">
    <label>Project</label>
    <input id="ho-project" placeholder="project name">
    <label>Body</label>
    <textarea id="ho-body" placeholder="What happened, what's next..."></textarea>
    <label>Next Steps (one per line)</label>
    <textarea id="ho-steps" placeholder="Step 1&#10;Step 2"></textarea>
    <div class="btn-row">
      <button class="btn-secondary" onclick="previewHandoff()">Preview Handoff</button>
      <button class="btn-danger" onclick="confirmHandoff()">Write Handoff (confirmed)</button>
    </div>
    <div id="out-handoff" class="output">Not yet written.</div>
  </div>

</main>

<script>
function baseArgs() {
  return {
    repo: document.getElementById('repo').value,
    branch: document.getElementById('branch').value,
    worker_path: document.getElementById('worker_path').value,
    script_name: document.getElementById('script_name').value
  };
}

async function callTool(name, extraArgs = {}, outId = 'out-validate') {
  const out = document.getElementById(outId);
  out.className = 'output warn';
  out.textContent = 'Running ' + name + '...';
  try {
    const res = await fetch('/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'tools/call', params: { name, arguments: { ...baseArgs(), ...extraArgs } } })
    });
    const data = await res.json();
    out.className = 'output ' + (data.ok === false ? 'err' : 'ok');
    out.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    out.className = 'output err';
    out.textContent = 'Error: ' + err.message;
  }
}

async function deployConfirmed() {
  await callTool('deploy_worker', { confirmed: true }, 'out-deploy');
}

async function callSmokeTest() {
  const extra = document.getElementById('smoke_paths').value;
  const paths = extra ? extra.split(',').map(s => s.trim()).filter(Boolean) : [];
  await callTool('run_smoke_test', { smoke_paths: paths }, 'out-smoke');
}

async function callOpenUrls() {
  await callTool('open_worker_urls', { check_live: true }, 'out-urls');
}

async function previewRegister() {
  const extra = {
    description: document.getElementById('reg-description').value,
    tags: document.getElementById('reg-tags').value.split(',').map(s => s.trim()).filter(Boolean)
  };
  await callTool('register_worker', extra, 'out-register');
}

async function confirmRegister() {
  const extra = {
    description: document.getElementById('reg-description').value,
    tags: document.getElementById('reg-tags').value.split(',').map(s => s.trim()).filter(Boolean),
    confirmed: true
  };
  await callTool('register_worker', extra, 'out-register');
}

async function previewHandoff() {
  const extra = handoffArgs(false);
  await callTool('write_handoff', extra, 'out-handoff');
}

async function confirmHandoff() {
  const extra = handoffArgs(true);
  await callTool('write_handoff', extra, 'out-handoff');
}

function handoffArgs(confirmed) {
  const steps = document.getElementById('ho-steps').value
    .split('\n').map(s => s.trim()).filter(Boolean);
  return {
    title: document.getElementById('ho-title').value,
    to: document.getElementById('ho-to').value,
    project: document.getElementById('ho-project').value,
    body: document.getElementById('ho-body').value,
    next_steps: steps,
    confirmed
  };
}
<\/script>
</body>
</html>`;
}
