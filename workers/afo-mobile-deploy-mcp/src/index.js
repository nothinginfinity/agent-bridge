const VERSION = "0.1.0";
const TOOL_NAMES = [
  "deploy_worker_from_github",
  "preview_worker_from_github",
  "validate_worker_folder",
  "read_worker_bundle",
  "deploy_with_bindings",
  "run_worker_smoke_test",
  "write_deploy_receipt",
  "list_recent_deploys",
  "rollback_worker_to_github_version",
  "diff_live_vs_github"
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (request.method === "GET" && url.pathname === "/health") return json({ ok: true, worker: "afo-mobile-deploy-mcp", version: VERSION, tools: TOOL_NAMES.length });
      if (request.method === "GET" && url.pathname === "/llms.txt") return text(llmsText(url.origin));
      if (request.method === "GET" && url.pathname === "/tools/list") return json({ ok: true, tools: toolsList() });
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/ui")) return html(indexHtml());
      if (request.method === "POST" && url.pathname === "/mcp") return json(await handleMcp(request, env));
      return json({ ok: false, error: "not_found", path: url.pathname }, 404);
    } catch (error) {
      return json({ ok: false, error: "internal_error", message: String(error?.message || error) }, 500);
    }
  }
};

async function handleMcp(request, env) {
  const body = await request.json().catch(() => ({}));
  const method = body.method || body.name || body.tool_name;
  if (method === "tools/list" || method === "list_tools") return { ok: true, tools: toolsList() };
  if (method === "tools/call") {
    const params = body.params || body.arguments || {};
    return dispatch(params.name || params.tool_name, params.arguments || params.params || {}, env);
  }
  return dispatch(method, body.arguments || body.params || {}, env);
}

async function dispatch(name, args, env) {
  if (!TOOL_NAMES.includes(name)) return { ok: false, error: "unknown_tool", name, available_tools: TOOL_NAMES };
  if (name === "validate_worker_folder") return validateWorkerFolder(args, env);
  if (name === "read_worker_bundle") return readWorkerBundle(args, env);
  if (name === "preview_worker_from_github") return previewWorkerFromGithub(args, env);
  if (name === "deploy_worker_from_github") return deployWorkerFromGithub(args, env);
  if (name === "deploy_with_bindings") return deployWorkerFromGithub({ ...args, preserve_bindings: true }, env);
  if (name === "run_worker_smoke_test") return runWorkerSmokeTest(args, env);
  if (name === "write_deploy_receipt") return writeDeployReceipt(args, env);
  if (name === "list_recent_deploys") return listRecentDeploys(args, env);
  if (name === "rollback_worker_to_github_version") return deployWorkerFromGithub({ ...args, branch: args.ref || args.branch, rollback: true }, env);
  if (name === "diff_live_vs_github") return diffLiveVsGithub(args, env);
}

function toolsList() {
  return TOOL_NAMES.map((name) => ({ name, description: descriptions[name], input_schema: { type: "object" } }));
}

const descriptions = {
  deploy_worker_from_github: "Read a Worker folder from GitHub, validate it, deploy to Cloudflare Workers, run smoke tests, and optionally write a GitHub receipt.",
  preview_worker_from_github: "Return the deployment plan without writing to Cloudflare.",
  validate_worker_folder: "Validate wrangler.toml and Worker entrypoint availability in GitHub.",
  read_worker_bundle: "Read Worker source/config files from GitHub.",
  deploy_with_bindings: "Deploy with explicit Cloudflare metadata bindings.",
  run_worker_smoke_test: "Hit /health, /mcp tools/list, /llms.txt, and optional routes.",
  write_deploy_receipt: "Write a deployment receipt JSON file back to GitHub.",
  list_recent_deploys: "List deployment receipt files from GitHub.",
  rollback_worker_to_github_version: "Deploy a Worker from a specified GitHub ref.",
  diff_live_vs_github: "Compare GitHub bundle hash against Cloudflare settings where available."
};

async function validateWorkerFolder(args, env) {
  const bundle = await readWorkerBundle({ ...args, include_source: false }, env);
  if (!bundle.ok) return bundle;
  return { ok: true, repo: args.repo, branch: args.branch || "main", worker_path: cleanPath(args.worker_path), script_name: args.script_name || inferScriptName(args.worker_path), entrypoint: bundle.entrypoint, found: bundle.found, missing: bundle.missing, wrangler: parseWrangler(bundle.files["wrangler.toml"]?.content || ""), warnings: bundle.warnings };
}

async function readWorkerBundle(args, env) {
  const repo = parseRepo(args.repo);
  const branch = args.branch || "main";
  const workerPath = cleanPath(args.worker_path || "");
  if (!repo.owner || !repo.name || !workerPath) return { ok: false, error: "missing_required_fields", required: ["repo", "worker_path"] };
  const candidates = ["wrangler.toml", "package.json", "ui-contract.json", "contracts/ui-contract.json", "src/index.js", "src/worker.js", "worker.js", "index.js"];
  const files = {}, missing = [];
  for (const rel of candidates) {
    const got = await githubGetContent(env, repo.owner, repo.name, `${workerPath}/${rel}`, branch);
    if (got.ok) files[rel] = { path: got.path, sha: got.sha, size: got.size, content: args.include_source === false ? undefined : got.content, hash: got.content ? await sha256(got.content) : undefined };
    else missing.push(rel);
  }
  const entrypoint = ["src/index.js", "src/worker.js", "worker.js", "index.js"].find((p) => files[p]);
  const warnings = [];
  if (!files["wrangler.toml"]) warnings.push("wrangler.toml not found");
  if (!files["ui-contract.json"] && !files["contracts/ui-contract.json"]) warnings.push("ui-contract.json not found; continuing");
  if (!entrypoint) return { ok: false, error: "entrypoint_missing", found: Object.keys(files), missing, warnings };
  const bundle_hash = await sha256(JSON.stringify(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.hash || v.sha || ""]))));
  return { ok: true, repo: args.repo, branch, worker_path: workerPath, entrypoint, found: Object.keys(files), missing, files, bundle_hash, warnings };
}

async function previewWorkerFromGithub(args, env) {
  const validation = await validateWorkerFolder(args, env);
  if (!validation.ok) return validation;
  return { ok: true, mode: "preview", deploy_would_write: false, script_name: validation.script_name, urls: urlsFor(args, env), validation };
}

async function deployWorkerFromGithub(args, env) {
  requireEnv(env, ["GITHUB_TOKEN", "CF_ACCOUNT_ID", "CF_API_TOKEN"]);
  const bundle = await readWorkerBundle(args, env);
  if (!bundle.ok) return bundle;
  const scriptName = args.script_name || inferScriptName(args.worker_path);
  const source = bundle.files[bundle.entrypoint]?.content;
  const metadata = { main_module: bundle.entrypoint, compatibility_date: args.compatibility_date || parseWrangler(bundle.files["wrangler.toml"]?.content || "").compatibility_date || "2026-06-01", bindings: normalizeBindings(args.bindings || []) };
  const fd = new FormData();
  fd.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  fd.append(bundle.entrypoint, new Blob([source], { type: "application/javascript+module" }), bundle.entrypoint);
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${encodeURIComponent(scriptName)}`;
  const cfRes = await fetch(endpoint, { method: "PUT", headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` }, body: fd });
  const cfBody = await safeJson(cfRes);
  const urls = urlsFor({ ...args, script_name: scriptName }, env);
  const smoke_tests = args.run_smoke_tests === false ? null : await runWorkerSmokeTest({ ...args, script_name: scriptName, base_url: urls.primary }, env);
  const receipt = { ok: cfRes.ok && cfBody.success !== false, script_name: scriptName, deployed: cfRes.ok, rollback: Boolean(args.rollback), repo: args.repo, branch: args.branch || "main", worker_path: cleanPath(args.worker_path), entrypoint: bundle.entrypoint, bundle_hash: bundle.bundle_hash, urls, smoke_tests, cloudflare: { status: cfRes.status, success: cfBody.success, errors: cfBody.errors || [] }, deployed_at: new Date().toISOString() };
  if (args.write_receipt !== false) receipt.receipt = await writeDeployReceipt({ ...args, script_name: scriptName, receipt }, env);
  return receipt;
}

async function runWorkerSmokeTest(args, env) {
  const urls = urlsFor(args, env);
  const checks = { health: await httpOk(urls.health), llms: await httpOk(urls.llms), mcp_tools_list: await postMcpList(urls.mcp) };
  for (const p of args.smoke_paths || []) checks[p] = await httpOk(`${trimSlash(urls.primary)}${p.startsWith("/") ? p : `/${p}`}`);
  return { ok: Object.values(checks).every(Boolean), urls, checks };
}

async function writeDeployReceipt(args, env) {
  requireEnv(env, ["GITHUB_TOKEN"]);
  const repo = parseRepo(args.repo || args.receipt?.repo);
  const branch = args.branch || args.receipt?.branch || "main";
  const script = args.script_name || args.receipt?.script_name || "unknown-worker";
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = args.receipt_path || `shared/deployments/${script}/${stamp}.json`;
  const content = JSON.stringify(args.receipt || args, null, 2) + "\n";
  const put = await githubPutContent(env, repo.owner, repo.name, path, branch, { message: `Deploy receipt for ${script}`, content });
  return { ok: put.ok, path, branch, status: put.status, result: put.result };
}

async function listRecentDeploys(args, env) {
  const repo = parseRepo(args.repo);
  const branch = args.branch || "main";
  const path = args.path || `shared/deployments/${args.script_name || ""}`.replace(/\/$/, "");
  return githubListContent(env, repo.owner, repo.name, path, branch);
}

async function diffLiveVsGithub(args, env) {
  const bundle = await readWorkerBundle(args, env);
  const live = await getCloudflareScriptSettings(env, args.script_name || inferScriptName(args.worker_path));
  return { ok: bundle.ok && live.ok, github: { repo: args.repo, branch: args.branch || "main", worker_path: cleanPath(args.worker_path), entrypoint: bundle.entrypoint, bundle_hash: bundle.bundle_hash }, live, note: "v0.1 compares GitHub bundle metadata against Cloudflare settings exposed by token permissions." };
}

async function githubGetContent(env, owner, repo, path, ref) {
  if (!env.GITHUB_TOKEN) return { ok: false, error: "missing_GITHUB_TOKEN" };
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref || "main")}`, { headers: githubHeaders(env) });
  if (!res.ok) return { ok: false, status: res.status, error: await res.text() };
  const body = await res.json();
  if (Array.isArray(body)) return { ok: false, error: "path_is_directory" };
  const content = body.encoding === "base64" ? decodeBase64(body.content || "") : await (await fetch(body.download_url)).text();
  return { ok: true, sha: body.sha, size: body.size, path: body.path, content };
}

async function githubListContent(env, owner, repo, path, ref) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}?ref=${encodeURIComponent(ref || "main")}`, { headers: githubHeaders(env) });
  const body = await safeJson(res);
  return { ok: res.ok, status: res.status, path, items: Array.isArray(body) ? body.map((x) => ({ name: x.name, path: x.path, type: x.type, size: x.size, sha: x.sha, url: x.html_url })) : [], error: res.ok ? undefined : body };
}

async function githubPutContent(env, owner, repo, path, branch, data) {
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${encodePath(path)}`, { method: "PUT", headers: githubHeaders(env), body: JSON.stringify({ message: data.message, content: encodeBase64(data.content), branch: branch || "main" }) });
  return { ok: res.ok, status: res.status, result: await safeJson(res) };
}

async function getCloudflareScriptSettings(env, scriptName) {
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) return { ok: false, error: "missing_cloudflare_env" };
  const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/workers/scripts/${encodeURIComponent(scriptName)}/settings`, { headers: { Authorization: `Bearer ${env.CF_API_TOKEN}` } });
  const body = await safeJson(res);
  return { ok: res.ok && body.success !== false, status: res.status, result: body.result || null, errors: body.errors || [] };
}

async function httpOk(url) { try { const r = await fetch(url); return r.ok; } catch { return false; } }
async function postMcpList(url) { try { const r = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method: "tools/list" }) }); return r.ok; } catch { return false; } }
function githubHeaders(env) { return { Accept: "application/vnd.github+json", Authorization: `Bearer ${env.GITHUB_TOKEN}`, "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "afo-mobile-deploy-mcp" }; }
function parseWrangler(text) { const out = { raw_present: Boolean(text), bindings: [] }; for (const line of text.split(/\r?\n/)) { const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*"?([^"#]+)"?\s*$/); if (m) out[m[1]] = m[2].trim().replace(/^"|"$/g, ""); } for (const m of text.matchAll(/binding\s*=\s*"([^"]+)"/g)) out.bindings.push({ name: m[1], type: "unresolved_from_wrangler" }); return out; }
function normalizeBindings(bindings) { return Array.isArray(bindings) ? bindings.filter(Boolean).map((b) => b.type === "plain_text" || b.type === "secret_text" ? { type: b.type, name: b.name, text: b.text || b.value || "" } : b.type === "kv_namespace" ? { type: "kv_namespace", name: b.name, namespace_id: b.namespace_id || b.id } : b.type === "d1" ? { type: "d1", name: b.name, id: b.id || b.database_id } : b.type === "r2_bucket" ? { type: "r2_bucket", name: b.name, bucket_name: b.bucket_name } : b).filter(Boolean) : []; }
function urlsFor(args, env) { const script = args.script_name || inferScriptName(args.worker_path); const subdomain = args.workers_subdomain || env.CF_WORKERS_SUBDOMAIN || "jaredtechfit"; const primary = args.base_url || `https://${script}.${subdomain}.workers.dev`; return { primary, health: `${trimSlash(primary)}/health`, mcp: `${trimSlash(primary)}/mcp`, llms: `${trimSlash(primary)}/llms.txt` }; }
function parseRepo(repo) { const [owner, name] = String(repo || "").split("/"); return { owner, name }; }
function cleanPath(p) { return String(p || "").replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/"); }
function inferScriptName(workerPath) { const parts = cleanPath(workerPath).split("/"); return parts[parts.length - 1] || "worker"; }
function requireEnv(env, keys) { const missing = keys.filter((k) => !env[k]); if (missing.length) throw new Error(`Missing required env bindings: ${missing.join(", ")}`); }
function encodePath(path) { return cleanPath(path).split("/").map(encodeURIComponent).join("/"); }
function decodeBase64(s) { const bin = atob(String(s).replace(/\s/g, "")); return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))); }
function encodeBase64(s) { let bin = ""; for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b); return btoa(bin); }
async function sha256(s) { const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join(""); }
async function safeJson(res) { const txt = await res.text(); try { return JSON.parse(txt); } catch { return { raw: txt }; } }
function trimSlash(s) { return String(s || "").replace(/\/+$/g, ""); }
function json(obj, status = 200) { return cors(new Response(JSON.stringify(obj, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8" } })); }
function text(s, status = 200) { return cors(new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } })); }
function html(s, status = 200) { return cors(new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8" } })); }
function cors(res) { const h = new Headers(res.headers); h.set("access-control-allow-origin", "*"); h.set("access-control-allow-methods", "GET,POST,OPTIONS"); h.set("access-control-allow-headers", "content-type,authorization"); return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h }); }
function llmsText(origin) { return `# afo-mobile-deploy-mcp\n\nPurpose: mobile deployment terminal for agents.\n\nBase URL: ${origin}\n\nRoutes:\n- GET /health\n- GET /llms.txt\n- GET /tools/list\n- POST /mcp\n\nPrimary workflow:\n1. validate_worker_folder\n2. preview_worker_from_github\n3. deploy_worker_from_github\n4. run_worker_smoke_test\n5. write_deploy_receipt\n`; }
function indexHtml() { return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>afo-mobile-deploy-mcp</title><style>body{font-family:system-ui;margin:0;background:#0b1020;color:#eef2ff}main{max-width:920px;margin:auto;padding:28px}.card{background:#121a33;border:1px solid #26345f;border-radius:18px;padding:20px}input,button{width:100%;box-sizing:border-box;border-radius:12px;border:1px solid #36456f;background:#0f172e;color:#eef2ff;padding:12px;margin:6px 0}button{background:#3147ff;border:0;font-weight:700}pre{white-space:pre-wrap;background:#080d1c;border-radius:12px;padding:14px}</style></head><body><main><h1>afo-mobile-deploy-mcp</h1><p>GitHub source-of-truth → Cloudflare Worker runtime → smoke tests → GitHub receipt.</p><div class="card"><input id="repo" value="nothinginfinity/agent-bridge"><input id="branch" value="main"><input id="worker_path" value="workers/afo-buttons-mcp"><input id="script_name" value="afo-buttons-mcp"><button onclick="callTool('validate_worker_folder')">Validate</button><button onclick="callTool('preview_worker_from_github')">Preview</button><button onclick="callTool('deploy_worker_from_github')">Deploy</button><pre id="out">Ready.</pre></div></main><script>async function callTool(name){const args={repo:repo.value,branch:branch.value,worker_path:worker_path.value,script_name:script_name.value,run_smoke_tests:true,write_receipt:true};out.textContent='Running '+name;const res=await fetch('/mcp',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({method:'tools/call',params:{name,arguments:args}})});out.textContent=JSON.stringify(await res.json(),null,2)}</script></body></html>`; }
