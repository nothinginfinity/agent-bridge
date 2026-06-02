// afo-mobile-terminal-mcp v0.2.4
// Command-center layer above individual MCP tools.
// Orchestrates: deploy, smoke test, registry, handoff, Cloudflare inventory.
// All write actions are preview-first and confirmation-gated.
// Never expose secret values in UI, logs, receipts, or /health output.
//
// v0.2.0 — /cmd GET slash-command layer
// v0.2.1 — fix: unwrap safePost envelope in proxyToDeployMcp
// v0.2.2 — fix: normalize DEPLOY_MCP_URL to always POST to /mcp
// v0.2.3 — feat: script_name-only resolution via built-in DEFAULT_REGISTRY
// v0.2.4 — feat: /diag diagnostic layer + /diag/fetch direct fetch test
//           GET /diag               — full env + integration health report
//           GET /diag/fetch?url=... — direct fetch probe to isolate 404 origin
//           GET /diag/deploy-mcp    — targeted deploy-mcp connectivity + 404 diagnosis
//           GET /diag/routes        — route map with expected vs observed status
//           GET /diag/env           — safe env binding inventory (no secret values)

const VERSION = "0.2.4";
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

const WRITE_TOOLS = new Set(["deploy_worker", "register_worker", "write_handoff"]);

// ─── Built-in default registry ────────────────────────────────────────────────
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

function resolveWorkerArgs(args) {
  const { repo, branch, worker_path, script_name } = args || {};
  if (repo && branch && worker_path && script_name) return { ...args };
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
  const entry = DEFAULT_REGISTRY[script_name];
  if (!entry) {
    return {
      ok: false,
      error: "unknown_worker",
      script_name,
      hint: "Not in built-in registry. Provide full params or add to DEFAULT_REGISTRY.",
      known_workers: Object.keys(DEFAULT_REGISTRY)
    };
  }
  return {
    ...entry,
    ...Object.fromEntries(
      Object.entries(args).filter(([, v]) => v !== undefined && v !== null && v !== "")
    )
  };
}

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

      // ── /diag diagnostic layer ───────────────────────────────────────────
      if (request.method === "GET" && (url.pathname === "/diag" || url.pathname === "/diag/")) return jsonRes(await diagFull(url, env));
      if (request.method === "GET" && url.pathname === "/diag/env")    return jsonRes(diagEnv(env));
      if (request.method === "GET" && url.pathname === "/diag/routes") return jsonRes(await diagRoutes(url.origin, env));
      if (request.method === "GET" && url.pathname === "/diag/deploy-mcp") return jsonRes(await diagDeployMcp(env));
      if (request.method === "GET" && url.pathname === "/diag/fetch")  return jsonRes(await diagFetch(url, env));

      return jsonRes({ ok: false, error: "not_found", path: url.pathname }, 404);
    } catch (err) {
      return jsonRes({ ok: false, error: "internal_error", message: String(err?.message || err) }, 500);
    }
  }
};

// ─── /diag handlers ───────────────────────────────────────────────────────────

/**
 * GET /diag
 * Full diagnostic snapshot: env inventory + deploy-mcp reachability +
 * route health + known worker URL checks.
 */
async function diagFull(url, env) {
  const [envInfo, deployMcpInfo, routesInfo] = await Promise.all([
    Promise.resolve(diagEnv(env)),
    diagDeployMcp(env),
    diagRoutes(url.origin, env)
  ]);

  // Live URL check for each known worker
  const workerChecks = await Promise.all(
    Object.values(DEFAULT_REGISTRY).map(async (w) => {
      const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
      const base = `https://${w.script_name}.${subdomain}.workers.dev`;
      const [homeCheck, healthCheck, mcpCheck] = await Promise.all([
        fetchProbe(base + "/"),
        fetchProbe(base + "/health"),
        fetchProbe(base + "/tools/list")
      ]);
      return {
        script_name: w.script_name,
        base,
        home:    homeCheck,
        health:  healthCheck,
        tools:   mcpCheck
      };
    })
  );

  return {
    ok: true,
    version: VERSION,
    worker: WORKER_NAME,
    generated_at: new Date().toISOString(),
    env: envInfo,
    deploy_mcp: deployMcpInfo,
    routes: routesInfo,
    known_workers: workerChecks,
    diag_routes: {
      full:        `${url.origin}/diag`,
      env:         `${url.origin}/diag/env`,
      routes:      `${url.origin}/diag/routes`,
      deploy_mcp:  `${url.origin}/diag/deploy-mcp`,
      fetch:       `${url.origin}/diag/fetch?url=https://example.com/`
    }
  };
}

/**
 * GET /diag/env
 * Safe env binding inventory — reports which bindings are set, never their values.
 */
function diagEnv(env) {
  const bindings = {
    DEPLOY_MCP_URL:       envStatus(env.DEPLOY_MCP_URL),
    REGISTRY_URL:         envStatus(env.REGISTRY_URL),
    HANDOFF_MCP_URL:      envStatus(env.HANDOFF_MCP_URL),
    CF_GATEWAY_URL:       envStatus(env.CF_GATEWAY_URL),
    CF_WORKERS_SUBDOMAIN: envStatus(env.CF_WORKERS_SUBDOMAIN),
    GITHUB_TOKEN:         envSecret(env.GITHUB_TOKEN),
    CF_ACCOUNT_ID:        envSecret(env.CF_ACCOUNT_ID),
    CF_API_TOKEN:         envSecret(env.CF_API_TOKEN),
    TERMINAL_SELF_URL:    envStatus(env.TERMINAL_SELF_URL)
  };

  const missing = Object.entries(bindings).filter(([, v]) => v.status === "missing").map(([k]) => k);
  const configured = Object.entries(bindings).filter(([, v]) => v.status !== "missing").map(([k]) => k);

  return {
    ok: true,
    bindings,
    configured,
    missing,
    computed: {
      deploy_mcp_endpoint: deployMcpEndpoint(env),
      workers_subdomain: env.CF_WORKERS_SUBDOMAIN || "jaredtechfit (default)"
    }
  };
}

function envStatus(val) {
  if (!val) return { status: "missing" };
  return { status: "set", value: val };   // URL bindings are not secret; expose for diagnostics
}

function envSecret(val) {
  if (!val) return { status: "missing" };
  const len = String(val).length;
  return { status: "set", length: len, hint: `${String(val).slice(0, 4)}...` };
}

/**
 * GET /diag/routes
 * Probes all standard routes on self and reports expected vs observed status codes.
 * Helps confirm routing is wired correctly after a fresh deploy.
 */
async function diagRoutes(origin, env) {
  const routes = [
    { method: "GET",  path: "/",                      expect: 200 },
    { method: "GET",  path: "/health",                expect: 200 },
    { method: "GET",  path: "/llms.txt",              expect: 200 },
    { method: "GET",  path: "/tools/list",            expect: 200 },
    { method: "GET",  path: "/ui-contract.json",      expect: 200 },
    { method: "GET",  path: "/contracts/ui-contract.json", expect: 200 },
    { method: "GET",  path: "/cmd",                   expect: 200 },
    { method: "GET",  path: "/cmd/help",              expect: 200 },
    { method: "GET",  path: "/cmd/list_registered_workers", expect: 200 },
    { method: "GET",  path: "/diag",                  expect: 200 },
    { method: "GET",  path: "/diag/env",              expect: 200 },
    { method: "GET",  path: "/does-not-exist",        expect: 404 }
  ];

  const results = await Promise.all(
    routes.map(async (r) => {
      const probe = await fetchProbe(`${origin}${r.path}`, r.method);
      return {
        method: r.method,
        path: r.path,
        expected: r.expect,
        observed: probe.status,
        pass: probe.status === r.expect,
        latency_ms: probe.latency_ms,
        error: probe.error || undefined
      };
    })
  );

  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;

  return {
    ok: failed === 0,
    summary: `${passed}/${results.length} routes pass`,
    passed,
    failed,
    results
  };
}

/**
 * GET /diag/deploy-mcp
 * Targeted connectivity + 404 diagnosis for afo-mobile-deploy-mcp.
 * Tests: base URL, /health, /tools/list, /mcp (POST tools/list), /mcp (POST validate_worker_folder).
 * Reports exact HTTP status, headers, and first 500 chars of body at each step
 * so we can see exactly where a 404 originates.
 */
async function diagDeployMcp(env) {
  const base = trimSlash(env.DEPLOY_MCP_URL || "https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev");
  const mcpEndpoint = base.endsWith("/mcp") ? base : `${base}/mcp`;

  const t0 = Date.now();

  // Step 1: base /
  const homeProbe = await fetchProbeVerbose(base + "/");

  // Step 2: /health
  const healthProbe = await fetchProbeVerbose(base + "/health");

  // Step 3: /tools/list
  const toolsProbe = await fetchProbeVerbose(base + "/tools/list");

  // Step 4: POST /mcp — tools/list (should always work if Worker is up)
  const mcpListProbe = await fetchProbeVerbosePost(mcpEndpoint, {
    method: "tools/list"
  });

  // Step 5: POST /mcp — validate_worker_folder (real tool call)
  const mcpValidateProbe = await fetchProbeVerbosePost(mcpEndpoint, {
    method: "tools/call",
    params: {
      name: "validate_worker_folder",
      arguments: {
        repo: "nothinginfinity/agent-bridge",
        branch: "main",
        worker_path: "workers/afo-buttons-mcp",
        script_name: "afo-buttons-mcp"
      }
    }
  });

  const elapsed = Date.now() - t0;

  // ── 404 origin analysis ──────────────────────────────────────────────────
  const fourOhFours = [];
  const steps = { homeProbe, healthProbe, toolsProbe, mcpListProbe, mcpValidateProbe };
  for (const [name, probe] of Object.entries(steps)) {
    if (probe.status === 404) fourOhFours.push({ step: name, url: probe.url, body_preview: probe.body_preview });
  }

  const diagnosis = fourOhFours.length === 0
    ? { ok: true, message: "No 404s detected across all deploy-mcp probe steps." }
    : {
        ok: false,
        message: `404 detected at ${fourOhFours.length} step(s). See 404_sources below.`,
        "404_sources": fourOhFours,
        likely_causes: [
          "Worker not deployed or route not published to workers.dev subdomain",
          "DEPLOY_MCP_URL env binding points to wrong hostname or path",
          "Worker is deployed but the requested path/tool is not wired in the Worker router",
          "Cloudflare subdomain not enabled for the Worker script (check wrangler.toml: workers_dev = true)"
        ]
      };

  return {
    ok: fourOhFours.length === 0,
    base,
    mcp_endpoint: mcpEndpoint,
    elapsed_ms: elapsed,
    steps: {
      "1_home":              homeProbe,
      "2_health":            healthProbe,
      "3_tools_list":        toolsProbe,
      "4_mcp_list":          mcpListProbe,
      "5_mcp_validate":      mcpValidateProbe
    },
    diagnosis
  };
}

/**
 * GET /diag/fetch?url=<url>[&method=GET|POST][&body=<json>]
 *
 * Direct fetch probe to any URL the caller specifies.
 * Returns status, headers, and body preview — enough to see where a 404
 * originates without needing a separate HTTP client.
 *
 * Use to isolate: is the 404 coming from Cloudflare edge, the Worker,
 * a downstream MCP, or GitHub?
 *
 * Example:
 *   GET /diag/fetch?url=https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/health
 *   GET /diag/fetch?url=https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/mcp&method=POST&body={"method":"tools/list"}
 */
async function diagFetch(url, env) {
  const targetUrl = url.searchParams.get("url");
  if (!targetUrl) {
    return {
      ok: false,
      error: "missing_url_param",
      usage: "/diag/fetch?url=https://target.workers.dev/path",
      examples: [
        "/diag/fetch?url=https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/",
        "/diag/fetch?url=https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/health",
        "/diag/fetch?url=https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/tools/list",
        "/diag/fetch?url=https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/mcp&method=POST&body=%7B%22method%22%3A%22tools%2Flist%22%7D"
      ]
    };
  }

  const method = (url.searchParams.get("method") || "GET").toUpperCase();
  const bodyParam = url.searchParams.get("body");

  let parsedBody = undefined;
  if (bodyParam) {
    try { parsedBody = JSON.parse(bodyParam); }
    catch { parsedBody = bodyParam; }
  }

  const probe = method === "POST" && parsedBody !== undefined
    ? await fetchProbeVerbosePost(targetUrl, parsedBody)
    : await fetchProbeVerbose(targetUrl, method);

  // ── 404 origin analysis ──────────────────────────────────────────────────
  let origin_analysis = null;
  if (probe.status === 404) {
    const body = probe.body_preview || "";
    let source = "unknown";
    let detail = "";

    if (body.includes("workers.dev") && (body.includes("error") || body.toLowerCase().includes("not found"))) {
      source = "cloudflare_edge";
      detail = "Cloudflare returned 404 before the Worker ran — Worker may not be deployed or subdomain not enabled.";
    } else if (body.includes("not_found") || body.includes("\"path\"")) {
      source = "worker_router";
      detail = "Worker ran but its router returned 404 — path is not handled in the Worker's fetch handler.";
    } else if (body.includes("\"error\"") && body.includes("tool")) {
      source = "mcp_tool_dispatch";
      detail = "Worker ran and MCP dispatcher returned 404 — tool name not found in TOOL_NAMES list.";
    } else if (body.toLowerCase().includes("not found") || body.trim() === "") {
      source = "likely_cloudflare_edge_or_worker_router";
      detail = "Empty or generic 'not found' body — Worker may not be deployed, or path is unrouted.";
    }

    origin_analysis = {
      "404_origin": source,
      detail,
      raw_body_preview: body,
      response_headers: probe.response_headers,
      likely_causes: [
        "Worker not deployed (run: wrangler deploy)",
        "workers_dev = false in wrangler.toml",
        "Route not defined in the Worker's fetch handler",
        "Wrong URL — check DEPLOY_MCP_URL env binding",
        "MCP tool name mismatch — check tools/list"
      ]
    };
  }

  return {
    ok: probe.status >= 200 && probe.status < 300,
    target_url: targetUrl,
    method,
    ...probe,
    origin_analysis
  };
}

// ─── Verbose fetch probes ──────────────────────────────────────────────────────

/**
 * fetchProbeVerbose — GET (or any method) a URL and return full diagnostic details.
 * Captures: status, latency, response headers, first 500 chars of body.
 */
async function fetchProbeVerbose(url, method = "GET") {
  const start = Date.now();
  try {
    const r = await fetch(url, {
      method,
      headers: { "user-agent": `${WORKER_NAME}/${VERSION} diag` },
      signal: AbortSignal.timeout(10000)
    });
    const text = await r.text().catch(() => "");
    const latency = Date.now() - start;
    const headers = {};
    r.headers.forEach((v, k) => { headers[k] = v; });
    return {
      url,
      method,
      status: r.status,
      ok: r.ok,
      latency_ms: latency,
      response_headers: headers,
      body_preview: text.slice(0, 500),
      body_length: text.length
    };
  } catch (err) {
    return {
      url,
      method,
      status: 0,
      ok: false,
      latency_ms: Date.now() - start,
      error: String(err?.message || err),
      body_preview: ""
    };
  }
}

/**
 * fetchProbeVerbosePost — POST JSON to a URL and return full diagnostic details.
 */
async function fetchProbeVerbosePost(url, body) {
  const start = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "user-agent": `${WORKER_NAME}/${VERSION} diag`
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000)
    });
    const text = await r.text().catch(() => "");
    const latency = Date.now() - start;
    const headers = {};
    r.headers.forEach((v, k) => { headers[k] = v; });
    return {
      url,
      method: "POST",
      request_body: body,
      status: r.status,
      ok: r.ok,
      latency_ms: latency,
      response_headers: headers,
      body_preview: text.slice(0, 500),
      body_length: text.length
    };
  } catch (err) {
    return {
      url,
      method: "POST",
      request_body: body,
      status: 0,
      ok: false,
      latency_ms: Date.now() - start,
      error: String(err?.message || err),
      body_preview: ""
    };
  }
}

/**
 * fetchProbe — lightweight probe (status + latency only, no headers/body).
 * Used in diagFull for the known-worker grid.
 */
async function fetchProbe(url, method = "GET") {
  const start = Date.now();
  try {
    const r = await fetch(url, {
      method,
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": `${WORKER_NAME}/${VERSION} diag` }
    });
    return { url, status: r.status, ok: r.ok, latency_ms: Date.now() - start };
  } catch (err) {
    return { url, status: 0, ok: false, latency_ms: Date.now() - start, error: String(err?.message || err) };
  }
}

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

  const args = {};
  for (const [k, v] of url.searchParams.entries()) {
    if (v === "true")       args[k] = true;
    else if (v === "false") args[k] = false;
    else                    args[k] = v;
  }

  if (WRITE_TOOLS.has(toolName)) {
    if (toolName === "deploy_worker") {
      const resolved = resolveWorkerArgs(args);
      if (resolved.ok === false) return resolved;
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
          body: { method: "tools/call", params: { name: "deploy_worker", arguments: { ...resolved, confirmed: true } } }
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
    return {
      ok: false,
      error: "confirmation_required",
      via: "GET /cmd",
      message: "POST to /mcp with confirmed:true to write handoff.",
      preview: buildHandoffNote(args)
    };
  }

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
    { cmd: `GET ${origin}/cmd/open_worker_urls?script_name=afo-buttons-mcp`, description: "Get live URLs — script_name only" },
    { cmd: `GET ${origin}/cmd/validate_worker?script_name=afo-buttons-mcp`, description: "Validate — script_name only" },
    { cmd: `GET ${origin}/cmd/preview_worker_deploy?script_name=afo-buttons-mcp`, description: "Preview deploy" },
    { cmd: `GET ${origin}/cmd/run_smoke_test?script_name=afo-buttons-mcp`, description: "Smoke test" },
    { cmd: `GET ${origin}/cmd/list_recent_deploys?script_name=afo-buttons-mcp`, description: "Recent deploys" },
    { cmd: `GET ${origin}/cmd/deploy_worker?script_name=afo-buttons-mcp`, description: "[PREVIEW ONLY via GET]" },
    { cmd: `GET ${origin}/diag`, description: "Full diagnostic snapshot (v0.2.4+)" },
    { cmd: `GET ${origin}/diag/deploy-mcp`, description: "Deploy-mcp 404 origin analysis" },
    { cmd: `GET ${origin}/diag/fetch?url=https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/health`, description: "Direct fetch probe" }
  ];
  return {
    ok: true,
    name: WORKER_NAME,
    version: VERSION,
    description: "GET /cmd slash-command layer. script_name-only commands auto-resolve. Diagnostic layer at /diag (v0.2.4+).",
    known_workers: knownWorkers,
    routes: {
      help:       `GET ${origin}/cmd`,
      run:        `GET ${origin}/cmd/{tool_name}?param=value`,
      tools:      `GET ${origin}/tools/list`,
      mcp:        `POST ${origin}/mcp`,
      diag:       `GET ${origin}/diag`,
      diag_fetch: `GET ${origin}/diag/fetch?url=<target>`
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

// ─── Proxy + helpers ──────────────────────────────────────────────────────────

function deployMcpEndpoint(env) {
  const base = trimSlash(env.DEPLOY_MCP_URL || "https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev");
  return base.endsWith("/mcp") ? base : `${base}/mcp`;
}

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
      detail: envelope.error || `HTTP ${envelope.status}`,
      diag_hint: `Run GET /diag/deploy-mcp or GET /diag/fetch?url=${encodeURIComponent(endpoint)} to diagnose.`
    };
  }

  if (envelope.status >= 400) {
    return {
      ok: false,
      error: "deploy_mcp_http_error",
      deploy_mcp_endpoint: endpoint,
      tool: toolName,
      http_status: envelope.status,
      result: envelope.result,
      diag_hint: `Run GET /diag/deploy-mcp to see step-by-step 404 origin analysis.`
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
    diag_layer: "enabled",
    deploy_mcp_endpoint: deployMcpEndpoint(env),
    built_in_registry: Object.keys(DEFAULT_REGISTRY),
    integrations: {
      deploy_mcp:  env.DEPLOY_MCP_URL  ? "configured" : "default",
      registry:    env.REGISTRY_URL    ? "configured" : "not_configured",
      handoff_mcp: env.HANDOFF_MCP_URL ? "configured" : "not_configured",
      cf_gateway:  env.CF_GATEWAY_URL  ? "configured" : "not_configured",
      github:      env.GITHUB_TOKEN    ? "configured" : "not_configured"
    },
    diag_urls: {
      full:       "/diag",
      env:        "/diag/env",
      routes:     "/diag/routes",
      deploy_mcp: "/diag/deploy-mcp",
      fetch:      "/diag/fetch?url=<target>"
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
  list_command_belts:      "List all configured command belts and their live status.",
  list_registered_workers: "List registered workers from registry or built-in DEFAULT_REGISTRY.",
  open_worker_urls:        "Return all live URLs for a given worker script_name.",
  validate_worker:         "Validate a Worker folder structure and entrypoint in GitHub. Proxies to afo-mobile-deploy-mcp.",
  preview_worker_deploy:   "Preview a deployment plan without writing to Cloudflare.",
  deploy_worker:           "Deploy a Worker from GitHub to Cloudflare. Requires confirmed:true.",
  run_smoke_test:          "Run smoke tests against a live Worker.",
  list_recent_deploys:     "List recent deployment receipts from GitHub.",
  register_worker:         "Register or update Worker metadata. Requires confirmed:true.",
  write_handoff:           "Write a handoff note. Requires confirmed:true."
};

function llmsText(origin) {
  return `# ${WORKER_NAME} v${VERSION}\n\nPurpose: Command-center layer above AFO MCP tools. Orchestrates deploy, smoke test, registry, handoff, and Cloudflare inventory.\n\nBase URL: ${origin}\n\nRoutes:\n- GET /                             — Mobile terminal UI\n- GET /health                       — Health check\n- GET /llms.txt\n- GET /tools/list\n- POST /mcp                         — MCP tool surface\n- GET /contracts/ui-contract.json\n- GET /cmd                          — Slash-command help\n- GET /cmd/{tool_name}?script_name= — Run any tool\n- GET /diag                         — Full diagnostic snapshot (v0.2.4+)\n- GET /diag/env                     — Safe env binding inventory\n- GET /diag/routes                  — Route health matrix\n- GET /diag/deploy-mcp              — Deploy-mcp 404 origin analysis\n- GET /diag/fetch?url=<target>      — Direct fetch probe to any URL\n\nDiagnostic layer (v0.2.4+):\n  /diag/deploy-mcp probes all 5 steps of the deploy-mcp call chain and\n  classifies any 404 as cloudflare_edge | worker_router | mcp_tool_dispatch.\n  /diag/fetch?url= makes a direct fetch from the Worker runtime (bypassing\n  your local network) and reports status, headers, and body preview.\n\nBuilt-in registry: ${Object.keys(DEFAULT_REGISTRY).join(", ")}\n\nTools (${TOOL_NAMES.length}):\n${TOOL_NAMES.map(n => `- ${n}${WRITE_TOOLS.has(n) ? " [write — requires confirmed:true]" : ""}`).join("\n")}\n\nSecurity:\n- All write actions require confirmed:true via POST /mcp\n- GET /cmd never executes writes\n- No secrets exposed in /health, /diag/env, UI, logs, or receipts\n`;
}

function uiContract() {
  return {
    name: WORKER_NAME,
    version: VERSION,
    known_workers: Object.keys(DEFAULT_REGISTRY),
    diag_layer: {
      full:       "/diag",
      env:        "/diag/env",
      routes:     "/diag/routes",
      deploy_mcp: "/diag/deploy-mcp",
      fetch:      "/diag/fetch?url=<target>"
    },
    cards: [
      { id: "deploy_worker",       label: "Deploy Worker",       tool: "deploy_worker",      inputs: ["script_name","repo","branch","worker_path"], confirm_required: true },
      { id: "smoke_test",          label: "Smoke Test Worker",   tool: "run_smoke_test",     inputs: ["script_name","smoke_paths"] },
      { id: "list_recent_deploys", label: "List Recent Deploys", tool: "list_recent_deploys",inputs: ["script_name","repo"] },
      { id: "register_worker",     label: "Register Worker",     tool: "register_worker",    inputs: ["script_name","description","tags"], confirm_required: true },
      { id: "open_urls",           label: "Open Tool URLs",      tool: "open_worker_urls",   inputs: ["script_name","custom_domain"] },
      { id: "write_handoff",       label: "Write Handoff",       tool: "write_handoff",      inputs: ["title","from","to","project","body","next_steps"], confirm_required: true }
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
      --warn: #f59e0b; --error: #ef4444; --diag: #a78bfa;
      --radius: 14px; --transition: 160ms cubic-bezier(0.16,1,0.3,1);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100dvh; }
    header { padding: 18px 20px 14px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
    header svg { flex-shrink: 0; }
    header h1 { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; }
    header .version { font-size: 11px; color: var(--muted); background: var(--surface2); padding: 2px 8px; border-radius: 99px; border: 1px solid var(--border); }
    header .cmd-hint { font-size: 11px; color: var(--muted); margin-left: auto; display: flex; gap: 10px; }
    header .cmd-hint a { color: var(--accent2); text-decoration: none; }
    header .cmd-hint a.diag { color: var(--diag); }
    main { max-width: 680px; margin: 0 auto; padding: 20px 16px 80px; }
    .section-label { font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 24px 0 10px; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; margin-bottom: 12px; }
    .card.diag-card { border-color: #3b2f6f; background: #0f0d1f; }
    .card h2 { font-size: 14px; font-weight: 700; margin-bottom: 10px; display: flex; align-items: center; gap: 8px; }
    .card h2 .icon { width: 28px; height: 28px; background: var(--surface2); border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
    .cmd-badge { font-size: 10px; font-family: monospace; background: #0f172e; border: 1px solid var(--border); color: var(--muted); padding: 2px 7px; border-radius: 6px; margin-left: auto; cursor: pointer; }
    .cmd-badge:hover { border-color: var(--accent); color: var(--accent2); }
    .diag-badge { font-size: 10px; font-family: monospace; background: #1a1030; border: 1px solid #4c2f8e; color: var(--diag); padding: 2px 7px; border-radius: 6px; cursor: pointer; }
    .diag-badge:hover { border-color: var(--diag); }
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
    .btn-diag { background: #1a1030; color: var(--diag); border: 1px solid #4c2f8e; font-size: 12px; padding: 8px 12px; min-width: 80px; }
    .btn-diag:hover { background: #241640; }
    .output { margin-top: 14px; background: #080d1c; border-radius: 10px; padding: 12px 14px; font-family: "Menlo","Monaco",monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; color: #94a3b8; max-height: 360px; overflow-y: auto; }
    .output.ok   { border-left: 3px solid var(--success); }
    .output.err  { border-left: 3px solid var(--error); }
    .output.warn { border-left: 3px solid var(--warn); }
    .output.diag { border-left: 3px solid var(--diag); }
    .confirm-gate { background: #1c1408; border: 1px solid #78350f; border-radius: 10px; padding: 12px 14px; margin-top: 12px; font-size: 13px; color: #fde68a; }
    .diag-info { background: #110d20; border: 1px solid #3b2f6f; border-radius: 10px; padding: 12px 14px; margin-bottom: 14px; font-size: 12px; color: #c4b5fd; line-height: 1.6; }
    .diag-info code { background: #1a1030; padding: 1px 5px; border-radius: 4px; font-family: monospace; }
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
  <span class="cmd-hint">
    <a href="/cmd" target="_blank">/cmd</a>
    <a href="/diag" target="_blank" class="diag">🔬 /diag</a>
  </span>
</header>

<main>
  <p class="section-label">Worker Target</p>
  <div class="card">
    <h2><span class="icon">🎯</span> Target Worker</h2>
    <label>Script Name <span style="color:var(--accent2)">(required — auto-resolves known workers)</span></label>
    <input id="script_name" placeholder="afo-buttons-mcp">
    <p class="hint">Known: afo-buttons-mcp · afo-mobile-deploy-mcp · afo-mobile-terminal-mcp</p>
    <label>Repo <span style="color:var(--muted)">(optional)</span></label>
    <input id="repo" placeholder="nothinginfinity/agent-bridge">
    <label>Branch <span style="color:var(--muted)">(optional)</span></label>
    <input id="branch" placeholder="main">
    <label>Worker Path <span style="color:var(--muted)">(optional)</span></label>
    <input id="worker_path" placeholder="workers/my-worker">
  </div>

  <p class="section-label">🔬 Diagnostics (v0.2.4)</p>

  <div class="card diag-card">
    <h2><span class="icon">🔬</span> Diagnostic Layer <span class="diag-badge" onclick="window.open('/diag','_blank')">Open /diag</span></h2>
    <div class="diag-info">
      Use these tools to isolate where a 404 originates — Cloudflare edge, Worker router, or MCP tool dispatch.
      <br><code>/diag/deploy-mcp</code> runs 5 sequential probes against afo-mobile-deploy-mcp.
      <br><code>/diag/fetch?url=</code> makes a direct fetch from Worker runtime to any URL.
    </div>
    <label>Direct fetch target URL</label>
    <input id="diag-url" placeholder="https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/health">
    <div class="btn-row">
      <button class="btn-diag" onclick="runDiag('full')">Full /diag</button>
      <button class="btn-diag" onclick="runDiag('deploy-mcp')">Deploy-MCP probe</button>
      <button class="btn-diag" onclick="runDiag('env')">Env inventory</button>
      <button class="btn-diag" onclick="runDiag('routes')">Route matrix</button>
    </div>
    <div class="btn-row">
      <button class="btn-diag" onclick="runDiagFetch()" style="flex:2">Direct Fetch (URL above)</button>
      <button class="btn-diag" onclick="runDiagFetchPost()" style="flex:2">Direct Fetch POST /mcp</button>
    </div>
    <div id="out-diag" class="output diag">Diagnostics not yet run.</div>
  </div>

  <p class="section-label">Build Pipeline</p>

  <div class="card">
    <h2><span class="icon">✅</span> Validate &amp; Preview <span class="cmd-badge" title="Copy /cmd URL" onclick="copyCmdUrl('validate_worker')">⌘ /cmd</span></h2>
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
    <h2><span class="icon">🗂️</span> Command Belts</h2>
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
  const steps = document.getElementById('ho-steps').value.split('\\n').map(s => s.trim()).filter(Boolean);
  return { title: document.getElementById('ho-title').value, to: document.getElementById('ho-to').value, project: document.getElementById('ho-project').value, body: document.getElementById('ho-body').value, next_steps: steps, confirmed };
}

// ── Diagnostic panel ──────────────────────────────────────────────────────────
async function runDiag(sub) {
  const out = document.getElementById('out-diag');
  out.className = 'output diag';
  out.textContent = 'Running /diag/' + sub + ' ...';
  try {
    const path = sub === 'full' ? '/diag' : '/diag/' + sub;
    const res = await fetch(path);
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
    out.className = 'output ' + (data.ok === false ? 'err' : 'diag');
  } catch (err) {
    out.className = 'output err';
    out.textContent = 'Error: ' + err.message;
  }
}

async function runDiagFetch() {
  const url = document.getElementById('diag-url').value.trim();
  if (!url) { alert('Enter a target URL first'); return; }
  const out = document.getElementById('out-diag');
  out.className = 'output diag';
  out.textContent = 'Probing ' + url + ' ...';
  try {
    const res = await fetch('/diag/fetch?url=' + encodeURIComponent(url));
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
    out.className = 'output ' + (data.ok === false ? 'err' : 'diag');
  } catch (err) {
    out.className = 'output err';
    out.textContent = 'Error: ' + err.message;
  }
}

async function runDiagFetchPost() {
  const rawUrl = document.getElementById('diag-url').value.trim();
  const scriptName = document.getElementById('script_name').value.trim() || 'afo-buttons-mcp';
  const base = rawUrl || 'https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev';
  const mcpUrl = base.endsWith('/mcp') ? base : base.replace(/\\/+$/, '') + '/mcp';
  const body = JSON.stringify({ method: 'tools/list' });
  const out = document.getElementById('out-diag');
  out.className = 'output diag';
  out.textContent = 'POST probing ' + mcpUrl + ' ...';
  try {
    const params = new URLSearchParams({ url: mcpUrl, method: 'POST', body });
    const res = await fetch('/diag/fetch?' + params.toString());
    const data = await res.json();
    out.textContent = JSON.stringify(data, null, 2);
    out.className = 'output ' + (data.ok === false ? 'err' : 'diag');
  } catch (err) {
    out.className = 'output err';
    out.textContent = 'Error: ' + err.message;
  }
}
<\/script>
</body>
</html>`;
}
