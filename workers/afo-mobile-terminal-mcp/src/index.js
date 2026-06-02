// afo-mobile-terminal-mcp v0.2.3
// Command-center layer above individual MCP tools.
// Orchestrates: deploy, smoke test, registry, handoff, Cloudflare inventory.
// All write actions are preview-first and confirmation-gated.
// Never expose secret values in UI, logs, receipts, or /health output.
//
// v0.2.0 — /cmd GET slash-command layer
// v0.2.1 — fix: unwrap safePost envelope in proxyToDeployMcp
// v0.2.2 — fix: normalize DEPLOY_MCP_URL to always POST to /mcp
// v0.2.3 — feat: script_name-only resolution via built-in DEFAULT_REGISTRY
//           /cmd/deploy_worker?script_name=afo-buttons-mcp resolves to full
//           { repo, branch, worker_path, script_name } without requiring all
//           four params. Unknown script_name returns unknown_worker (not 404).

const VERSION = "0.2.3";
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

// Write tools: GET /cmd will never execute these — always returns confirmation_required.
const WRITE_TOOLS = new Set(["deploy_worker", "register_worker", "write_handoff"]);

// ─── Built-in default registry ────────────────────────────────────────────────
// Maps script_name → canonical worker descriptor.
// This is the source-of-truth when no external REGISTRY_URL is configured.
// Add new workers here as they are deployed.
const DEFAULT_REGISTRY = {
  "afo-buttons-mcp": {
    script_name:  "afo-buttons-mcp",
    repo:         "nothinginfinity/agent-bridge",
    branch:       "main",
    worker_path:  "workers/afo-buttons-mcp",
    description:  "AFO buttons MCP — standard route contract proof worker",
    tags:         ["mcp", "buttons", "afo"]
  },
  "afo-mobile-deploy-mcp": {
    script_name:  "afo-mobile-deploy-mcp",
    repo:         "nothinginfinity/agent-bridge",
    branch:       "main",
    worker_path:  "workers/afo-mobile-deploy-mcp",
    description:  "Mobile deploy MCP — validate, preview, deploy, smoke test, receipts",
    tags:         ["mcp", "deploy", "mobile", "afo"]
  },
  "afo-mobile-terminal-mcp": {
    script_name:  "afo-mobile-terminal-mcp",
    repo:         "nothinginfinity/agent-bridge",
    branch:       "main",
    worker_path:  "workers/afo-mobile-terminal-mcp",
    description:  "Mobile terminal MCP — command-center layer above AFO MCP tools",
    tags:         ["mcp", "terminal", "mobile", "afo"]
  }
};

/**
 * Resolve args into a full worker descriptor.
 *
 * Priority:
 *   1. If all four fields are already present, pass through as-is.
 *   2. If only script_name is given, look it up in DEFAULT_REGISTRY.
 *   3. If script_name is missing entirely, return a missing_fields error.
 *   4. If script_name is present but not in DEFAULT_REGISTRY, return unknown_worker.
 *
 * Always returns either a full descriptor object or an error object
 * (error objects have ok:false).
 */
function resolveWorkerArgs(args) {
  const { repo, branch, worker_path, script_name } = args || {};

  // All four present — pass through
  if (repo && branch && worker_path && script_name) {
    return { ...args };
  }

  // No script_name at all
  if (!script_name) {
    return {
      ok: false,
      error: "missing_fields",
      required: ["script_name"],
      optional_full_form: ["repo", "branch", "worker_path", "script_name"],
      hint: "Provide at least ?script_name=afo-buttons-mcp. Known workers: " + Object.keys(DEFAULT_REGISTRY).join(", "),
      known_workers: Object.keys(DEFAULT_REGISTRY)
    };
  }

  // script_name present — look up in registry
  const entry = DEFAULT_REGISTRY[script_name];
  if (!entry) {
    return {
      ok: false,
      error: "unknown_worker",
      script_name,
      hint: "This worker is not in the built-in registry. Provide full params (repo, branch, worker_path, script_name) or add it to DEFAULT_REGISTRY.",
      known_workers: Object.keys(DEFAULT_REGISTRY)
    };
  }

  // Merge registry entry with any caller-supplied overrides
  return {
    ...entry,
    ...Object.fromEntries(
      Object.entries(args).filter(([, v]) => v !== undefined && v !== null && v !== "")
    )
  };
}

// Integration targets (env-configured)
// DEPLOY_MCP_URL  — afo-mobile-deploy-mcp base URL (with or without /mcp — normalised at runtime)
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

      // ── Standard routes ──────────────────────────────────────────────────
      if (request.method === "GET" && url.pathname === "/health")      return jsonRes(healthPayload(env));
      if (request.method === "GET" && url.pathname === "/llms.txt")    return textRes(llmsText(url.origin));
      if (request.method === "GET" && url.pathname === "/tools/list")  return jsonRes({ ok: true, tools: toolsList() });
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/ui")) return htmlRes(indexHtml());
      if (request.method === "GET" && (url.pathname === "/contracts/ui-contract.json" || url.pathname === "/ui-contract.json")) return jsonRes(uiContract());
      if (request.method === "POST" && url.pathname === "/mcp")        return jsonRes(await handleMcp(request, env));

      // ── /cmd slash-command GET layer ─────────────────────────────────────
      if (request.method === "GET" && (url.pathname === "/cmd" || url.pathname === "/cmd/")) return jsonRes(cmdHelp(url.origin));
      if (request.method === "GET" && url.pathname === "/cmd/help")    return jsonRes(cmdHelp(url.origin));
      if (request.method === "GET" && url.pathname.startsWith("/cmd/")) return jsonRes(await handleCmd(url, env));

      return jsonRes({ ok: false, error: "not_found", path: url.pathname }, 404);
    } catch (err) {
      return jsonRes({ ok: false, error: "internal_error", message: String(err?.message || err) }, 500);
    }
  }
};

// ─── /cmd handler ─────────────────────────────────────────────────────────────

async function handleCmd(url, env) {
  const toolName = url.pathname.replace(/^\/cmd\//, "").split("/")[0];

  if (!toolName) return cmdHelp(url.origin);
  if (!TOOL_NAMES.includes(toolName)) {
    return {
      ok: false,
      error: "unknown_command",
      command: toolName,
      available_commands: TOOL_NAMES,
      help: `${url.origin}/cmd/help`
    };
  }

  // Parse query params into args object
  const args = {};
  for (const [k, v] of url.searchParams.entries()) {
    if (v === "true")       args[k] = true;
    else if (v === "false") args[k] = false;
    else                    args[k] = v;
  }

  // Write tools via GET → always return confirmation_required, never execute
  if (WRITE_TOOLS.has(toolName)) {
    if (toolName === "deploy_worker") {
      // Resolve args first (may be script_name-only)
      const resolved = resolveWorkerArgs(args);
      if (resolved.ok === false) return resolved;

      // Run the preview directly (no writes) and embed it
      const preview = await previewWorkerDeploy(resolved, env);
      return {
        ok: false,
        error: "confirmation_required",
        via: "GET /cmd — writes disabled via GET",
        message: "GET /cmd route returns preview only. To deploy, POST to /mcp with confirmed:true.",
        resolved_worker: resolved,
        post_example: {
          url: `${url.origin}/mcp`,
          method: "POST",
          body: {
            method: "tools/call",
            params: { name: "deploy_worker", arguments: { ...resolved, confirmed: true } }
          }
        },
        preview
      };
    }
    if (toolName === "register_worker") {
      return {
        ok: false,
        error: "confirmation_required",
        via: "GET /cmd",
        message: "POST to /mcp with confirmed:true to register.",
        preview: buildRegistrationPayload(args, env)
      };
    }
    // write_handoff
    return {
      ok: false,
      error: "confirmation_required",
      via: "GET /cmd",
      message: "POST to /mcp with confirmed:true to write handoff.",
      preview: buildHandoffNote(args)
    };
  }

  // Read / preview tools — resolve worker args where applicable, then run
  const workerTools = new Set(["validate_worker", "preview_worker_deploy", "run_smoke_test", "list_recent_deploys", "open_worker_urls"]);
  if (workerTools.has(toolName)) {
    const resolved = resolveWorkerArgs(args);
    if (resolved.ok === false) return resolved;
    return dispatch(toolName, resolved, env);
  }

  return dispatch(toolName, args, env);
}

function cmdHelp(origin) {
  const knownWorkers = Object.keys(DEFAULT_REGISTRY);
  const examples = [
    { cmd: `GET ${origin}/cmd/list_command_belts`, description: "List all configured command belts + status" },
    { cmd: `GET ${origin}/cmd/list_registered_workers`, description: "List registered workers" },
    // script_name-only shortcuts
    { cmd: `GET ${origin}/cmd/open_worker_urls?script_name=afo-buttons-mcp`, description: "Get live URLs — script_name only (auto-resolves)" },
    { cmd: `GET ${origin}/cmd/validate_worker?script_name=afo-buttons-mcp`, description: "Validate — script_name only (auto-resolves)" },
    { cmd: `GET ${origin}/cmd/preview_worker_deploy?script_name=afo-buttons-mcp`, description: "Preview deploy — script_name only (auto-resolves)" },
    { cmd: `GET ${origin}/cmd/run_smoke_test?script_name=afo-buttons-mcp`, description: "Smoke test — script_name only (auto-resolves)" },
    { cmd: `GET ${origin}/cmd/list_recent_deploys?script_name=afo-buttons-mcp`, description: "Recent deploys — script_name only (auto-resolves)" },
    { cmd: `GET ${origin}/cmd/deploy_worker?script_name=afo-buttons-mcp`, description: "[PREVIEW ONLY via GET] Full preview + confirm instructions, script_name only" },
    // full-form overrides
    { cmd: `GET ${origin}/cmd/validate_worker?repo=nothinginfinity/agent-bridge&branch=main&worker_path=workers/afo-buttons-mcp&script_name=afo-buttons-mcp`, description: "Validate — full form (overrides registry)" },
    { cmd: `GET ${origin}/cmd/deploy_worker?repo=nothinginfinity/agent-bridge&branch=main&worker_path=workers/afo-buttons-mcp&script_name=afo-buttons-mcp`, description: "[PREVIEW ONLY via GET] Full form" },
    { cmd: `GET ${origin}/cmd/register_worker?script_name=afo-buttons-mcp&description=AFO+buttons+MCP`, description: "[PREVIEW ONLY via GET] Registration preview + confirm instructions" },
    { cmd: `GET ${origin}/cmd/write_handoff?title=Handoff+title&to=alice&body=Work+done`, description: "[PREVIEW ONLY via GET] Handoff preview + confirm instructions" }
  ];

  return {
    ok: true,
    name: WORKER_NAME,
    version: VERSION,
    description: "GET /cmd slash-command layer. script_name-only commands auto-resolve via built-in registry. Read and preview tools run immediately. Write tools return a preview and instructions to confirm via POST /mcp.",
    known_workers: knownWorkers,
    routes: {
      help:  `GET ${origin}/cmd`,
      run:   `GET ${origin}/cmd/{tool_name}?param=value`,
      tools: `GET ${origin}/tools/list`,
      mcp:   `POST ${origin}/mcp  (canonical agent endpoint)`
    },
    safety: {
      read_tools:    TOOL_NAMES.filter(n => !WRITE_TOOLS.has(n)),
      write_tools:   [...WRITE_TOOLS],
      write_via_get: "Always returns confirmation_required. No writes executed via GET /cmd."
    },
    examples
  };
}

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
    case "list_command_belts":      return listCommandBelts(args, env);
    case "list_registered_workers": return listRegisteredWorkers(args, env);
    case "open_worker_urls":        return openWorkerUrls(args, env);
    case "validate_worker":         return validateWorker(args, env);
    case "preview_worker_deploy":   return previewWorkerDeploy(args, env);
    case "deploy_worker":           return deployWorker(args, env);
    case "run_smoke_test":          return runSmokeTest(args, env);
    case "list_recent_deploys":     return listRecentDeploys(args, env);
    case "register_worker":         return registerWorker(args, env);
    case "write_handoff":           return writeHandoff(args, env);
  }
}

// ─── Tool implementations ─────────────────────────────────────────────────────

async function listCommandBelts(args, env) {
  const deployMcpBase = trimSlash(env.DEPLOY_MCP_URL || "https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev");
  const belts = [
    { name: "afo-mobile-deploy-mcp",   url: deployMcpBase, status: await pingHealth(deployMcpBase), role: "deploy" },
    { name: "afo-mobile-terminal-mcp", url: env.TERMINAL_SELF_URL || "https://afo-mobile-terminal-mcp.jaredtechfit.workers.dev", status: "self", role: "command-center" },
    { name: "registry",                url: env.REGISTRY_URL || null, status: env.REGISTRY_URL ? await pingHealth(env.REGISTRY_URL) : "not_configured", role: "registry" },
    { name: "handoff-mcp",             url: env.HANDOFF_MCP_URL || null, status: env.HANDOFF_MCP_URL ? await pingHealth(env.HANDOFF_MCP_URL) : "not_configured", role: "handoff" },
    { name: "cf-gateway",              url: env.CF_GATEWAY_URL || null, status: env.CF_GATEWAY_URL ? await pingHealth(env.CF_GATEWAY_URL) : "not_configured", role: "cloudflare_infra" }
  ];
  return { ok: true, belts };
}

async function listRegisteredWorkers(args, env) {
  if (env.REGISTRY_URL) {
    const res = await safePost(`${trimSlash(env.REGISTRY_URL)}/mcp`, { method: "tools/call", params: { name: "list_workers", arguments: args } });
    if (res.http_ok) return { ok: true, source: "registry", workers: res.result?.workers || res.result || [] };
  }
  // Fallback: return built-in registry
  const workers = Object.values(DEFAULT_REGISTRY);
  return { ok: true, source: "built-in_registry", count: workers.length, workers };
}

async function openWorkerUrls(args, env) {
  const scriptName = args.script_name;
  if (!scriptName) return { ok: false, error: "script_name required", hint: "Add ?script_name=your-worker-name", known_workers: Object.keys(DEFAULT_REGISTRY) };
  const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
  const base = args.custom_domain ? `https://${args.custom_domain}` : `https://${scriptName}.${subdomain}.workers.dev`;
  const urls = {
    home:        base,
    health:      `${base}/health`,
    mcp:         `${base}/mcp`,
    llms:        `${base}/llms.txt`,
    tools:       `${base}/tools/list`,
    ui_contract: `${base}/contracts/ui-contract.json`
  };
  if (args.check_live !== false) urls._health_ok = await httpOk(urls.health);
  return { ok: true, script_name: scriptName, base, urls };
}

async function validateWorker(args, env) {
  return proxyToDeployMcp("validate_worker_folder", args, env);
}

async function previewWorkerDeploy(args, env) {
  const result = await proxyToDeployMcp("preview_worker_from_github", args, env);
  return {
    ok: result.ok,
    mode: "preview",
    note: "No changes written to Cloudflare. Call deploy_worker with confirmed:true to proceed.",
    result
  };
}

async function deployWorker(args, env) {
  // Resolve script_name-only args before any gate
  const resolved = resolveWorkerArgs(args);
  if (resolved.ok === false) return resolved;

  if (!resolved.confirmed) {
    const preview = await previewWorkerDeploy(resolved, env);
    return {
      ok: false,
      error: "confirmation_required",
      message: "Review the preview and call deploy_worker again with confirmed:true to proceed.",
      resolved_worker: resolved,
      preview
    };
  }
  return proxyToDeployMcp("deploy_worker_from_github", resolved, env);
}

async function runSmokeTest(args, env) {
  return proxyToDeployMcp("run_worker_smoke_test", args, env);
}

async function listRecentDeploys(args, env) {
  return proxyToDeployMcp("list_recent_deploys", args, env);
}

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
  if (env.REGISTRY_URL) {
    const res = await safePost(`${trimSlash(env.REGISTRY_URL)}/mcp`, { method: "tools/call", params: { name: "upsert_worker", arguments: payload } });
    if (res.http_ok) return { ok: true, source: "registry", result: res.result, payload };
  }
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
  if (env.HANDOFF_MCP_URL) {
    const res = await safePost(`${trimSlash(env.HANDOFF_MCP_URL)}/mcp`, { method: "tools/call", params: { name: "write_handoff", arguments: note } });
    if (res.http_ok) return { ok: true, source: "handoff-mcp", result: res.result };
  }
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

/**
 * Normalise DEPLOY_MCP_URL so we always POST to the /mcp endpoint.
 *
 * Accepts any of these inputs and always returns the /mcp endpoint URL:
 *   https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev          → .../mcp
 *   https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/         → .../mcp
 *   https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/mcp      → .../mcp  (no-op)
 *   https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/mcp/     → .../mcp  (no-op)
 */
function deployMcpEndpoint(env) {
  const base = trimSlash(env.DEPLOY_MCP_URL || "https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev");
  return base.endsWith("/mcp") ? base : `${base}/mcp`;
}

/**
 * Proxy a tool call to afo-mobile-deploy-mcp and return the UNWRAPPED
 * tool result (the JSON the deploy-mcp returned), not the fetch envelope.
 */
async function proxyToDeployMcp(toolName, args, env) {
  const endpoint = deployMcpEndpoint(env);
  const envelope = await safePost(endpoint, {
    method: "tools/call",
    params: { name: toolName, arguments: args }
  });

  if (!envelope.http_ok) {
    return {
      ok: false,
      error: "deploy_mcp_unreachable",
      deploy_mcp_endpoint: endpoint,
      tool: toolName,
      detail: envelope.error || `HTTP ${envelope.status}`
    };
  }

  if (envelope.status >= 400) {
    return {
      ok: false,
      error: "deploy_mcp_http_error",
      deploy_mcp_endpoint: endpoint,
      tool: toolName,
      http_status: envelope.status,
      result: envelope.result
    };
  }

  return envelope.result;
}

function buildRegistrationPayload(args, env) {
  const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
  const scriptName = args.script_name || "unknown-worker";
  const base = args.custom_domain ? `https://${args.custom_domain}` : `https://${scriptName}.${subdomain}.workers.dev`;
  return {
    script_name:   scriptName,
    display_name:  args.display_name || scriptName,
    description:   args.description  || "",
    repo:          args.repo         || "nothinginfinity/agent-bridge",
    worker_path:   args.worker_path  || `workers/${scriptName}`,
    base_url:      base,
    health_url:    args.health_url   || `${base}/health`,
    mcp_url:       args.mcp_url      || `${base}/mcp`,
    llms_url:      `${base}/llms.txt`,
    tools_url:     `${base}/tools/list`,
    tags:          args.tags         || [],
    registered_at: new Date().toISOString(),
    registered_by: WORKER_NAME
  };
}

function buildHandoffNote(args) {
  return {
    title:      args.title      || "Untitled Handoff",
    from:       args.from       || WORKER_NAME,
    to:         args.to         || "all",
    project:    args.project    || "",
    type:       args.type       || "handoff",
    status:     args.status     || "",
    body:       args.body       || args.message || "",
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
  } catch { return "unreachable"; }
}

async function httpOk(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(5000) }); return r.ok; } catch { return false; }
}

/**
 * safePost — returns { http_ok, status, result } envelope.
 * http_ok = true means the HTTP request itself succeeded (2xx).
 * result  = parsed JSON body from the server.
 */
async function safePost(url, body) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000)
    });
    const json = await r.json().catch(() => ({}));
    return { http_ok: r.ok, status: r.status, result: json };
  } catch (err) {
    return { http_ok: false, status: 0, error: String(err?.message || err), result: {} };
  }
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

function parseRepo(repo)   { const [owner, name] = String(repo || "").split("/"); return [owner, name]; }
function cleanPath(p)      { return String(p || "").replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/"); }
function trimSlash(s)      { return String(s || "").replace(/\/+$/g, ""); }
function encodePath(path)  { return cleanPath(path).split("/").map(encodeURIComponent).join("/"); }
function encodeBase64(s)   { let bin = ""; for (const b of new TextEncoder().encode(s)) bin += String.fromCharCode(b); return btoa(bin); }
async function safeJson(res) { const txt = await res.text(); try { return JSON.parse(txt); } catch { return { raw: txt }; } }

// ─── Response helpers ─────────────────────────────────────────────────────────

function jsonRes(obj, status = 200) { return cors(new Response(JSON.stringify(obj, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8" } })); }
function textRes(s, status = 200)   { return cors(new Response(s, { status, headers: { "content-type": "text/plain; charset=utf-8" } })); }
function htmlRes(s, status = 200)   { return cors(new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8" } })); }
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
    cmd_layer: "enabled",
    deploy_mcp_endpoint: deployMcpEndpoint(env),
    built_in_registry: Object.keys(DEFAULT_REGISTRY),
    integrations: {
      deploy_mcp:  env.DEPLOY_MCP_URL  ? "configured" : "default",
      registry:    env.REGISTRY_URL    ? "configured" : "not_configured",
      handoff_mcp: env.HANDOFF_MCP_URL ? "configured" : "not_configured",
      cf_gateway:  env.CF_GATEWAY_URL  ? "configured" : "not_configured",
      github:      env.GITHUB_TOKEN    ? "configured" : "not_configured"
    }
  };
}

function toolsList() {
  return TOOL_NAMES.map(name => ({
    name,
    description: DESCRIPTIONS[name],
    input_schema: { type: "object" },
    via_get: !WRITE_TOOLS.has(name),
    write_requires_confirm: WRITE_TOOLS.has(name)
  }));
}

const DESCRIPTIONS = {
  list_command_belts:      "List all configured command belts and their live status (deploy-mcp, registry, handoff-mcp, cf-gateway).",
  list_registered_workers: "List registered workers from registry or built-in DEFAULT_REGISTRY.",
  open_worker_urls:        "Return all live URLs for a given worker script_name (home, health, mcp, llms, tools, ui_contract). Accepts script_name only — auto-resolves via built-in registry.",
  validate_worker:         "Validate a Worker folder structure and entrypoint in GitHub. Accepts script_name only — auto-resolves via built-in registry. Proxies to afo-mobile-deploy-mcp.",
  preview_worker_deploy:   "Preview a deployment plan without writing to Cloudflare. Accepts script_name only. Returns validation + URLs.",
  deploy_worker:           "Deploy a Worker from GitHub to Cloudflare. Accepts script_name only. Preview-first — requires confirmed:true to execute. GET /cmd returns preview only.",
  run_smoke_test:          "Run smoke tests against a live Worker (health, mcp tools/list, llms.txt, optional custom paths). Accepts script_name only.",
  list_recent_deploys:     "List recent deployment receipts from GitHub for a given worker or the default deployments folder.",
  register_worker:         "Register or update Worker metadata in the registry or GitHub. Requires confirmed:true to write. GET /cmd returns preview only.",
  write_handoff:           "Write a handoff note to the handoff MCP or GitHub shared/handoffs. Requires confirmed:true to write. GET /cmd returns preview only."
};

function llmsText(origin) {
  return `# ${WORKER_NAME} v${VERSION}\n\nPurpose: Command-center layer above AFO MCP tools. Orchestrates deploy, smoke test, registry, handoff, and Cloudflare inventory for mobile-first workflows.\n\nBase URL: ${origin}\n\nRoutes:\n- GET /                             — Mobile terminal UI\n- GET /health                       — Health check (no secrets exposed)\n- GET /llms.txt\n- GET /tools/list\n- POST /mcp                         — MCP tool surface (canonical agent endpoint)\n- GET /contracts/ui-contract.json\n- GET /cmd                          — Slash-command help + known_workers list\n- GET /cmd/help                     — Slash-command help\n- GET /cmd/{tool_name}?script_name= — Run any tool with script_name only (auto-resolves)\n\nBuilt-in registry: ${Object.keys(DEFAULT_REGISTRY).join(", ")}\n\nTools (${TOOL_NAMES.length}):\n${TOOL_NAMES.map(n => `- ${n}${WRITE_TOOLS.has(n) ? " [write — GET /cmd returns preview only]" : ""}`).join("\n")}\n\nscript_name-only resolution:\n  All worker tools accept ?script_name=afo-buttons-mcp without requiring\n  repo, branch, or worker_path. The built-in DEFAULT_REGISTRY resolves these.\n  Unknown script_name returns unknown_worker (not a 404).\n\nIntegration targets:\n- afo-mobile-deploy-mcp (DEPLOY_MCP_URL env)   — POST to /mcp (normalised at runtime)\n- AFO registry           (REGISTRY_URL env)      — list/register workers\n- handoff-mcp            (HANDOFF_MCP_URL env)   — write handoffs\n- Cloudflare gateway     (CF_GATEWAY_URL env)    — inventory\n- GitHub                 (GITHUB_TOKEN env)       — source-of-truth, receipts, handoffs\n\nSecurity:\n- All write actions require confirmed:true via POST /mcp\n- GET /cmd never executes writes\n- No secrets exposed in /health, UI, logs, or receipts\n`;
}

function uiContract() {
  return {
    name: WORKER_NAME,
    version: VERSION,
    known_workers: Object.keys(DEFAULT_REGISTRY),
    cards: [
      { id: "deploy_worker",       label: "Deploy Worker",       tool: "deploy_worker",      inputs: ["script_name","repo","branch","worker_path"], confirm_required: true, shortcut: "script_name only supported" },
      { id: "smoke_test",          label: "Smoke Test Worker",   tool: "run_smoke_test",     inputs: ["script_name","smoke_paths"], shortcut: "script_name only supported" },
      { id: "list_recent_deploys", label: "List Recent Deploys", tool: "list_recent_deploys",inputs: ["script_name","repo"] },
      { id: "register_worker",     label: "Register Worker",     tool: "register_worker",    inputs: ["script_name","description","tags"], confirm_required: true },
      { id: "open_urls",           label: "Open Tool URLs",      tool: "open_worker_urls",   inputs: ["script_name","custom_domain"], shortcut: "script_name only supported" },
      { id: "write_handoff",       label: "Write Handoff",       tool: "write_handoff",      inputs: ["title","from","to","project","body","next_steps"], confirm_required: true }
    ],
    cmd_layer: {
      help:    "https://afo-mobile-terminal-mcp.jaredtechfit.workers.dev/cmd",
      pattern: "/cmd/{tool_name}?script_name=worker-name",
      write_tools_blocked_via_get: [...WRITE_TOOLS]
    }
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
    header .cmd-hint { font-size: 11px; color: var(--muted); margin-left: auto; }
    header .cmd-hint a { color: var(--accent2); text-decoration: none; }
    main { max-width: 680px; margin: 0 auto; padding: 20px 16px 80px; }
    .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 24px 0 10px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
    .card h2 { font-size: 14px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .card h2 .icon { width: 28px; height: 28px; background: var(--surface2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
    .cmd-badge { font-size: 10px; font-family: monospace; background: #0f172e; border: 1px solid var(--border); color: var(--muted); padding: 2px 7px; border-radius: 6px; margin-left: auto; cursor: pointer; }
    .cmd-badge:hover { border-color: var(--accent); color: var(--accent2); }
    label { display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; margin-top: 10px; }
    input, select, textarea { width: 100%; padding: 10px 12px; background: var(--surface2); border: 1px solid var(--border); border-radius: 10px; color: var(--text); font-size: 14px; transition: border-color var(--transition); }
    input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); }
    textarea { resize: vertical; min-height: 80px; }
    .hint { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .btn-row { display: flex; gap: 8px; margin-top: 14px; flex-wrap: wrap; }
    button { flex: 1; min-width: 120px; padding: 11px 16px; border: none; border-radius: 10px; font-size: 14px; font-weight: 600; cursor: pointer; transition: opacity var(--transition), transform var(--transition); }
    button:active { transform: scale(0.97); }
    .btn-primary { background: var(--accent); color: #fff; }
    .btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
    .btn-danger { background: #7f1d1d; color: #fca5a5; }
    .btn-ghost { background: transparent; color: var(--muted); border: 1px solid var(--border); font-size: 12px; padding: 8px 12px; min-width: 80px; }
    .output { margin-top: 14px; background: #080d1c; border-radius: 10px; padding: 12px 14px; font-family: "Menlo","Monaco",monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; color: #94a3b8; max-height: 320px; overflow-y: auto; }
    .output.ok   { border-left: 3px solid var(--success); }
    .output.err  { border-left: 3px solid var(--error); }
    .output.warn { border-left: 3px solid var(--warn); }
    .confirm-gate { background: #1c1408; border: 1px solid #78350f; border-radius: 10px; padding: 12px 14px; margin-top: 12px; font-size: 13px; color: #fde68a; }
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
  <span class="cmd-hint"><a href="/cmd" target="_blank">/cmd help</a></span>
</header>

<main>
  <p class="section-label">Worker Target</p>
  <div class="card">
    <h2><span class="icon">🎯</span> Target Worker</h2>
    <label>Script Name <span style="color:var(--accent2)">(required — auto-resolves known workers)</span></label>
    <input id="script_name" placeholder="afo-buttons-mcp">
    <p class="hint">Known: afo-buttons-mcp · afo-mobile-deploy-mcp · afo-mobile-terminal-mcp</p>
    <label>Repo <span style="color:var(--muted)">(optional — filled from registry if blank)</span></label>
    <input id="repo" placeholder="nothinginfinity/agent-bridge">
    <label>Branch <span style="color:var(--muted)">(optional)</span></label>
    <input id="branch" placeholder="main">
    <label>Worker Path <span style="color:var(--muted)">(optional)</span></label>
    <input id="worker_path" placeholder="workers/my-worker">
  </div>

  <p class="section-label">Build Pipeline</p>

  <div class="card">
    <h2><span class="icon">✅</span> Validate &amp; Preview <span class="cmd-badge" title="Copy GET /cmd URL" onclick="copyCmdUrl('validate_worker')">⌘ /cmd</span></h2>
    <div class="btn-row">
      <button class="btn-secondary" onclick="callTool('validate_worker', {}, 'out-validate')">Validate Folder</button>
      <button class="btn-secondary" onclick="callTool('preview_worker_deploy', {}, 'out-validate')">Preview Deploy</button>
      <button class="btn-ghost" onclick="openCmd('validate_worker')">Open in browser</button>
    </div>
    <div id="out-validate" class="output">Enter script_name above then run.</div>
  </div>

  <div class="card">
    <h2><span class="icon">🚀</span> Deploy Worker</h2>
    <div class="confirm-gate">
      ⚠️ Write action — run Preview first, then click Deploy (confirmed) to proceed.
    </div>
    <div class="btn-row">
      <button class="btn-primary" onclick="deployConfirmed()">Deploy (confirmed)</button>
    </div>
    <div id="out-deploy" class="output">Not yet deployed.</div>
  </div>

  <div class="card">
    <h2><span class="icon">🧪</span> Smoke Test <span class="cmd-badge" onclick="copyCmdUrl('run_smoke_test')">⌘ /cmd</span></h2>
    <label>Extra smoke paths (comma-separated, optional)</label>
    <input id="smoke_paths" placeholder="/ui,/contracts/ui-contract.json">
    <div class="btn-row">
      <button class="btn-secondary" onclick="callSmokeTest()">Run Smoke Test</button>
      <button class="btn-ghost" onclick="openCmd('run_smoke_test')">Open in browser</button>
    </div>
    <div id="out-smoke" class="output">Not yet tested.</div>
  </div>

  <p class="section-label">Discovery</p>

  <div class="card">
    <h2><span class="icon">🔗</span> Open Tool URLs <span class="cmd-badge" onclick="copyCmdUrl('open_worker_urls')">⌘ /cmd</span></h2>
    <div class="btn-row">
      <button class="btn-secondary" onclick="callOpenUrls()">Get Live URLs</button>
      <button class="btn-ghost" onclick="openCmd('open_worker_urls')">Open in browser</button>
    </div>
    <div id="out-urls" class="output">Enter script_name above.</div>
  </div>

  <div class="card">
    <h2><span class="icon">📋</span> Recent Deploys <span class="cmd-badge" onclick="copyCmdUrl('list_recent_deploys')">⌘ /cmd</span></h2>
    <div class="btn-row">
      <button class="btn-secondary" onclick="callTool('list_recent_deploys', {}, 'out-receipts')">List Recent Deploys</button>
      <button class="btn-ghost" onclick="openCmd('list_recent_deploys')">Open in browser</button>
    </div>
    <div id="out-receipts" class="output">Enter script_name above.</div>
  </div>

  <div class="card">
    <h2><span class="icon">🗂️</span> Command Belts <span class="cmd-badge" onclick="window.open('/cmd/list_command_belts','_blank')">⌘ /cmd</span></h2>
    <div class="btn-row">
      <button class="btn-secondary" onclick="callTool('list_command_belts', {}, 'out-belts')">List Belts</button>
      <button class="btn-ghost" onclick="window.open('/cmd/list_command_belts','_blank')">Open in browser</button>
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
  const a = { script_name: document.getElementById('script_name').value };
  const repo = document.getElementById('repo').value;
  const branch = document.getElementById('branch').value;
  const worker_path = document.getElementById('worker_path').value;
  if (repo) a.repo = repo;
  if (branch) a.branch = branch;
  if (worker_path) a.worker_path = worker_path;
  return a;
}

function buildCmdUrl(toolName, extra = {}) {
  const args = { ...baseArgs(), ...extra };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(args)) if (v) params.set(k, String(v));
  return '/cmd/' + toolName + '?' + params.toString();
}

function openCmd(toolName, extra = {}) { window.open(buildCmdUrl(toolName, extra), '_blank'); }
function copyCmdUrl(toolName, extra = {}) {
  const url = location.origin + buildCmdUrl(toolName, extra);
  navigator.clipboard?.writeText(url).catch(() => {});
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

async function deployConfirmed() { await callTool('deploy_worker', { confirmed: true }, 'out-deploy'); }

async function callSmokeTest() {
  const extra = document.getElementById('smoke_paths').value;
  const paths = extra ? extra.split(',').map(s => s.trim()).filter(Boolean) : [];
  await callTool('run_smoke_test', { smoke_paths: paths }, 'out-smoke');
}

async function callOpenUrls() { await callTool('open_worker_urls', { check_live: true }, 'out-urls'); }

async function previewRegister() {
  const extra = { description: document.getElementById('reg-description').value, tags: document.getElementById('reg-tags').value.split(',').map(s => s.trim()).filter(Boolean) };
  await callTool('register_worker', extra, 'out-register');
}

async function confirmRegister() {
  const extra = { description: document.getElementById('reg-description').value, tags: document.getElementById('reg-tags').value.split(',').map(s => s.trim()).filter(Boolean), confirmed: true };
  await callTool('register_worker', extra, 'out-register');
}

async function previewHandoff() { await callTool('write_handoff', handoffArgs(false), 'out-handoff'); }
async function confirmHandoff()  { await callTool('write_handoff', handoffArgs(true),  'out-handoff'); }

function handoffArgs(confirmed) {
  const steps = document.getElementById('ho-steps').value.split('\n').map(s => s.trim()).filter(Boolean);
  return { title: document.getElementById('ho-title').value, to: document.getElementById('ho-to').value, project: document.getElementById('ho-project').value, body: document.getElementById('ho-body').value, next_steps: steps, confirmed };
}
<\/script>
</body>
</html>`;
}
