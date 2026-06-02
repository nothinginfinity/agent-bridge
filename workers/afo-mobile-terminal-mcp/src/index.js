// afo-mobile-terminal-mcp v0.2.5
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
// v0.2.5 — fix: Worker-to-Worker via Cloudflare Service Binding (env.DEPLOY_MCP)
//           Bypasses workers.dev which returns CF error 1042 from inside a Worker.
//           Transport priority: service_binding → url_fallback (DEPLOY_MCP_URL / default)
//           /health reports deploy_mcp_transport: "service_binding" | "url_fallback"
//           /diag/deploy-mcp reports which transport was used at each step
// v0.2.6 — fix: repair unterminated string at line 1349 (confirmHandoff truncation)
// v0.2.7 — fix: restore file after empty-file wipe in bad commit; export default confirmed

const VERSION = "0.2.7";
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
      hint: "Provide at least script_name=afo-buttons-mcp. Known workers: " + Object.keys(DEFAULT_REGISTRY).join(", "),
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

// ─── Service binding transport ────────────────────────────────────────────────
function deployMcpTransport(env) {
  return env.DEPLOY_MCP ? "service_binding" : "url_fallback";
}

function deployMcpEndpoint(env) {
  const base = trimSlash(env.DEPLOY_MCP_URL || "https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev");
  return base.endsWith("/mcp") ? base : `${base}/mcp`;
}

async function deployMcpPost(body, env) {
  const payload = JSON.stringify(body);
  const headers = { "content-type": "application/json" };

  if (env.DEPLOY_MCP) {
    try {
      const req = new Request("https://worker/mcp", {
        method: "POST",
        headers,
        body: payload
      });
      const r = await env.DEPLOY_MCP.fetch(req);
      const json = await r.json().catch(() => ({}));
      return { http_ok: r.ok, status: r.status, result: json, transport: "service_binding" };
    } catch (err) {
      return {
        http_ok: false,
        status: 0,
        error: String(err?.message || err),
        result: {},
        transport: "service_binding",
        binding_error: true
      };
    }
  }

  const endpoint = deployMcpEndpoint(env);
  try {
    const r = await fetch(endpoint, {
      method: "POST",
      headers,
      body: payload,
      signal: AbortSignal.timeout(30000)
    });
    const json = await r.json().catch(() => ({}));
    return { http_ok: r.ok, status: r.status, result: json, transport: "url_fallback", endpoint };
  } catch (err) {
    return {
      http_ok: false,
      status: 0,
      error: String(err?.message || err),
      result: {},
      transport: "url_fallback",
      endpoint,
      note: "workers.dev URLs return CF error 1042 when called from inside a Worker. Add [[services]] binding in wrangler.toml."
    };
  }
}

async function deployMcpGet(path, env) {
  if (env.DEPLOY_MCP) {
    try {
      const req = new Request(`https://worker${path}`, { method: "GET" });
      const r = await env.DEPLOY_MCP.fetch(req);
      const text = await r.text().catch(() => "");
      const headers = {};
      r.headers.forEach((v, k) => { headers[k] = v; });
      return {
        transport: "service_binding",
        status: r.status,
        ok: r.ok,
        response_headers: headers,
        body_preview: text.slice(0, 500),
        body_length: text.length
      };
    } catch (err) {
      return { transport: "service_binding", status: 0, ok: false, error: String(err?.message || err), body_preview: "" };
    }
  }

  const base = trimSlash(env.DEPLOY_MCP_URL || "https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev");
  return fetchProbeVerbose(`${base}${path}`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));

      if (request.method === "GET" && url.pathname === "/health")      return jsonRes(healthPayload(env));
      if (request.method === "GET" && url.pathname === "/llms.txt")    return textRes(llmsText(url.origin));
      if (request.method === "GET" && url.pathname === "/tools/list")  return jsonRes({ ok: true, tools: toolsList() });
      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/ui")) return htmlRes(indexHtml());
      if (request.method === "GET" && (url.pathname === "/contracts/ui-contract.json" || url.pathname === "/ui-contract.json")) return jsonRes(uiContract());
      if (request.method === "POST" && url.pathname === "/mcp")        return jsonRes(await handleMcp(request, env));

      if (request.method === "GET" && (url.pathname === "/cmd" || url.pathname === "/cmd/")) return jsonRes(cmdHelp(url.origin));
      if (request.method === "GET" && url.pathname === "/cmd/help")    return jsonRes(cmdHelp(url.origin));
      if (request.method === "GET" && url.pathname.startsWith("/cmd/")) return jsonRes(await handleCmd(url, env));

      if (request.method === "GET" && (url.pathname === "/diag" || url.pathname === "/diag/")) return jsonRes(await diagFull(url, env));
      if (request.method === "GET" && url.pathname === "/diag/env")        return jsonRes(diagEnv(env));
      if (request.method === "GET" && url.pathname === "/diag/routes")     return jsonRes(await diagRoutes(url.origin, env));
      if (request.method === "GET" && url.pathname === "/diag/deploy-mcp") return jsonRes(await diagDeployMcp(env));
      if (request.method === "GET" && url.pathname === "/diag/fetch")      return jsonRes(await diagFetch(url, env));

      return jsonRes({ ok: false, error: "not_found", path: url.pathname }, 404);
    } catch (err) {
      return jsonRes({ ok: false, error: "internal_error", message: String(err?.message || err) }, 500);
    }
  }
};

// ─── /diag handlers ───────────────────────────────────────────────────────────

async function diagFull(url, env) {
  const [envInfo, deployMcpInfo, routesInfo] = await Promise.all([
    Promise.resolve(diagEnv(env)),
    diagDeployMcp(env),
    diagRoutes(url.origin, env)
  ]);

  const workerChecks = await Promise.all(
    Object.values(DEFAULT_REGISTRY).map(async (w) => {
      const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
      const base = `https://${w.script_name}.${subdomain}.workers.dev`;
      const [homeCheck, healthCheck] = await Promise.all([
        fetchProbe(base + "/"),
        fetchProbe(base + "/health")
      ]);
      return {
        script_name: w.script_name,
        base,
        note: w.script_name === "afo-mobile-deploy-mcp" ? "external URL probes may 1042 — see deploy_mcp section for service binding results" : undefined,
        home:   homeCheck,
        health: healthCheck
      };
    })
  );

  return {
    ok: true,
    version: VERSION,
    worker: WORKER_NAME,
    generated_at: new Date().toISOString(),
    deploy_mcp_transport: deployMcpTransport(env),
    env: envInfo,
    deploy_mcp: deployMcpInfo,
    routes: routesInfo,
    known_workers: workerChecks,
    diag_routes: {
      full:       `${url.origin}/diag`,
      env:        `${url.origin}/diag/env`,
      routes:     `${url.origin}/diag/routes`,
      deploy_mcp: `${url.origin}/diag/deploy-mcp`,
      fetch:      `${url.origin}/diag/fetch`
    }
  };
}

function diagEnv(env) {
  return {
    ok: true,
    deploy_mcp_binding: env.DEPLOY_MCP ? "present" : "missing",
    deploy_mcp_url: env.DEPLOY_MCP_URL ? "set" : "not_set (will use default)",
    deploy_mcp_transport: deployMcpTransport(env),
    cf_workers_subdomain: env.CF_WORKERS_SUBDOMAIN ? "set" : "not_set (will use jaredtechfit)",
    github_token: env.GITHUB_TOKEN ? "set" : "not_set",
    cf_account_id: env.CF_ACCOUNT_ID ? "set" : "not_set",
    cf_api_token: env.CF_API_TOKEN ? "set" : "not_set"
  };
}

async function diagRoutes(origin, env) {
  const routes = ["/", "/health", "/llms.txt", "/tools/list", "/contracts/ui-contract.json"];
  const results = await Promise.all(
    routes.map(async (r) => {
      const result = await fetchProbeVerbose(`${origin}${r}`);
      return { route: r, ...result };
    })
  );
  return { ok: true, origin, routes: results };
}

async function diagDeployMcp(env) {
  const transport = deployMcpTransport(env);
  const healthResult = await deployMcpGet("/health", env);
  const toolsResult = await deployMcpGet("/tools/list", env);
  return {
    ok: true,
    transport,
    deploy_mcp_url_setting: env.DEPLOY_MCP_URL || "(default)",
    health: healthResult,
    tools_list: toolsResult
  };
}

async function diagFetch(url, env) {
  const target = url.searchParams.get("url");
  if (!target) {
    return {
      ok: false,
      error: "missing_url_param",
      usage: "/diag/fetch?url=https://example.com",
      example: `/diag/fetch?url=${encodeURIComponent("https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev/health")}`
    };
  }
  return fetchProbeVerbose(target);
}

// ─── /cmd handlers ────────────────────────────────────────────────────────────

function cmdHelp(origin) {
  return {
    ok: true,
    description: "GET /cmd/<tool_name>?param=value — slash-command surface for MCP tools",
    usage: `${origin}/cmd/<tool_name>?param=value`,
    examples: [
      `${origin}/cmd/list_command_belts`,
      `${origin}/cmd/list_registered_workers`,
      `${origin}/cmd/validate_worker?script_name=afo-buttons-mcp`,
      `${origin}/cmd/deploy_worker?script_name=afo-buttons-mcp&confirmed=true`
    ],
    tools: TOOL_NAMES
  };
}

async function handleCmd(url, env) {
  const parts = url.pathname.split("/").filter(Boolean);
  const toolName = parts[1];
  if (!toolName || !TOOL_NAMES.includes(toolName)) {
    return { ok: false, error: "unknown_tool", tool: toolName, available: TOOL_NAMES };
  }
  const args = Object.fromEntries(url.searchParams.entries());
  return runTool(toolName, args, env);
}

// ─── MCP protocol handler ─────────────────────────────────────────────────────

async function handleMcp(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return { ok: false, error: "invalid_json" };
  }

  const { method, params } = body;

  if (method === "tools/list") {
    return { ok: true, tools: toolsList() };
  }

  if (method === "tools/call") {
    const toolName = params?.name;
    const args = params?.arguments || {};
    if (!toolName || !TOOL_NAMES.includes(toolName)) {
      return { ok: false, error: "unknown_tool", tool: toolName, available: TOOL_NAMES };
    }
    const result = await runTool(toolName, args, env);
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
    };
  }

  return { ok: false, error: "unknown_method", method };
}

// ─── Tool definitions ─────────────────────────────────────────────────────────

function toolsList() {
  return [
    {
      name: "list_command_belts",
      description: "List available command belts and MCP tool surfaces in the AFO ecosystem.",
      inputSchema: { type: "object", properties: {}, required: [] }
    },
    {
      name: "list_registered_workers",
      description: "List all registered Workers in the AFO Tool Index / registry.",
      inputSchema: { type: "object", properties: {}, required: [] }
    },
    {
      name: "open_worker_urls",
      description: "Return live URLs for a deployed Worker. Provide script_name.",
      inputSchema: {
        type: "object",
        properties: {
          script_name: { type: "string", description: "e.g. afo-buttons-mcp" }
        },
        required: ["script_name"]
      }
    },
    {
      name: "validate_worker",
      description: "Validate a Worker folder structure in GitHub before deploy.",
      inputSchema: {
        type: "object",
        properties: {
          repo:        { type: "string", description: "owner/repo" },
          branch:      { type: "string", description: "Git branch" },
          worker_path: { type: "string", description: "Path to worker folder" },
          script_name: { type: "string", description: "Worker script name" }
        },
        required: []
      }
    },
    {
      name: "preview_worker_deploy",
      description: "Preview a deploy (dry-run). Shows what would be deployed without doing it.",
      inputSchema: {
        type: "object",
        properties: {
          repo:        { type: "string" },
          branch:      { type: "string" },
          worker_path: { type: "string" },
          script_name: { type: "string" }
        },
        required: []
      }
    },
    {
      name: "deploy_worker",
      description: "Deploy a Worker from GitHub to Cloudflare via afo-mobile-deploy-mcp. Requires confirmed=true.",
      inputSchema: {
        type: "object",
        properties: {
          repo:        { type: "string" },
          branch:      { type: "string" },
          worker_path: { type: "string" },
          script_name: { type: "string" },
          confirmed:   { type: "boolean", description: "Must be true to execute" }
        },
        required: ["confirmed"]
      }
    },
    {
      name: "run_smoke_test",
      description: "Run smoke tests against a deployed Worker's standard routes.",
      inputSchema: {
        type: "object",
        properties: {
          script_name:  { type: "string" },
          base_url:     { type: "string", description: "Override base URL if not workers.dev" }
        },
        required: []
      }
    },
    {
      name: "list_recent_deploys",
      description: "List recent deployment receipts from GitHub.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max receipts to return (default 10)" }
        },
        required: []
      }
    },
    {
      name: "register_worker",
      description: "Register or update Worker metadata in the AFO Tool Index. Requires confirmed=true.",
      inputSchema: {
        type: "object",
        properties: {
          script_name:  { type: "string" },
          description:  { type: "string" },
          tags:         { type: "array", items: { type: "string" } },
          confirmed:    { type: "boolean" }
        },
        required: ["script_name", "confirmed"]
      }
    },
    {
      name: "write_handoff",
      description: "Write a handoff note to shared/handoffs.md in GitHub. Requires confirmed=true.",
      inputSchema: {
        type: "object",
        properties: {
          note:       { type: "string", description: "Handoff note content" },
          from_agent: { type: "string", description: "Source agent name" },
          to_agent:   { type: "string", description: "Target agent name" },
          confirmed:  { type: "boolean" }
        },
        required: ["note", "confirmed"]
      }
    }
  ];
}

// ─── Tool runner ──────────────────────────────────────────────────────────────

async function runTool(name, args, env) {
  if (WRITE_TOOLS.has(name) && !args.confirmed) {
    return previewGate(name, args);
  }

  switch (name) {
    case "list_command_belts":      return listCommandBelts(env);
    case "list_registered_workers": return listRegisteredWorkers(env);
    case "open_worker_urls":        return openWorkerUrls(args, env);
    case "validate_worker":         return validateWorker(args, env);
    case "preview_worker_deploy":   return previewWorkerDeploy(args, env);
    case "deploy_worker":           return deployWorker(args, env);
    case "run_smoke_test":          return runSmokeTest(args, env);
    case "list_recent_deploys":     return listRecentDeploys(args, env);
    case "register_worker":         return registerWorker(args, env);
    case "write_handoff":           return writeHandoff(args, env);
    default:
      return { ok: false, error: "unknown_tool", tool: name };
  }
}

function previewGate(name, args) {
  return {
    ok: false,
    error: "confirmation_required",
    tool: name,
    preview: args,
    message: `Preview: call ${name} with confirmed=true to execute.`,
    hint: "All write actions require confirmed=true. Review the preview above before confirming."
  };
}

// ─── Tool implementations ─────────────────────────────────────────────────────

function listCommandBelts(env) {
  const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
  return {
    ok: true,
    belts: [
      {
        name: "message-os-cloud-social-builder-belt",
        description: "Primary builder belt for Message OS Cloud Social MVP",
        tools: ["afo-mobile-terminal-mcp", "afo-mobile-deploy-mcp", "handoff-mcp", "context-belt-mcp"]
      },
      {
        name: "afo-deploy-belt",
        description: "Deployment workflow belt",
        tools: ["afo-mobile-deploy-mcp", "afo-mobile-terminal-mcp"]
      }
    ],
    integrations: {
      deploy_mcp:   `https://afo-mobile-deploy-mcp.${subdomain}.workers.dev`,
      terminal_mcp: `https://afo-mobile-terminal-mcp.${subdomain}.workers.dev`,
      registry:     env.REGISTRY_URL || "https://github.com/nothinginfinity/agent-bridge/blob/main/shared/specs/toolsmith-tool-inventory.md",
      handoff_inbox: "https://github.com/nothinginfinity/agent-bridge/blob/main/shared/handoffs.md"
    }
  };
}

function listRegisteredWorkers(env) {
  const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
  const workers = Object.entries(DEFAULT_REGISTRY).map(([key, w]) => ({
    ...w,
    live_url: `https://${w.script_name}.${subdomain}.workers.dev`
  }));
  return { ok: true, count: workers.length, workers };
}

function openWorkerUrls(args, env) {
  const resolved = resolveWorkerArgs(args);
  if (resolved.ok === false) return resolved;
  const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
  const base = `https://${resolved.script_name}.${subdomain}.workers.dev`;
  return {
    ok: true,
    script_name: resolved.script_name,
    base_url: base,
    urls: {
      home:           base + "/",
      health:         base + "/health",
      llms_txt:       base + "/llms.txt",
      tools_list:     base + "/tools/list",
      mcp_endpoint:   base + "/mcp",
      ui_contract:    base + "/contracts/ui-contract.json",
      diag:           base + "/diag"
    }
  };
}

async function validateWorker(args, env) {
  const resolved = resolveWorkerArgs(args);
  if (resolved.ok === false) return resolved;
  const result = await deployMcpPost({
    method: "tools/call",
    params: { name: "validate_worker_folder", arguments: resolved }
  }, env);
  return { ok: result.http_ok, tool: "validate_worker", worker: resolved.script_name, transport: result.transport, result: result.result };
}

async function previewWorkerDeploy(args, env) {
  const resolved = resolveWorkerArgs(args);
  if (resolved.ok === false) return resolved;
  const result = await deployMcpPost({
    method: "tools/call",
    params: { name: "preview_worker_from_github", arguments: resolved }
  }, env);
  return { ok: result.http_ok, tool: "preview_worker_deploy", worker: resolved.script_name, transport: result.transport, result: result.result };
}

async function deployWorker(args, env) {
  const resolved = resolveWorkerArgs(args);
  if (resolved.ok === false) return resolved;
  const result = await deployMcpPost({
    method: "tools/call",
    params: { name: "deploy_worker_from_github", arguments: { ...resolved, confirmed: true } }
  }, env);
  return { ok: result.http_ok, tool: "deploy_worker", worker: resolved.script_name, transport: result.transport, result: result.result };
}

async function runSmokeTest(args, env) {
  const { script_name, base_url } = args;
  const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
  const base = base_url || (script_name ? `https://${script_name}.${subdomain}.workers.dev` : null);
  if (!base) return { ok: false, error: "missing_params", required: ["script_name"] };

  const routes = ["/", "/health", "/llms.txt", "/tools/list", "/contracts/ui-contract.json"];
  const results = await Promise.all(
    routes.map(async (r) => {
      const probe = await fetchProbeVerbose(`${base}${r}`);
      return { route: r, ...probe };
    })
  );

  const passed = results.filter(r => r.ok).length;
  return {
    ok: passed === routes.length,
    script_name: script_name || "custom",
    base_url: base,
    passed,
    total: routes.length,
    results
  };
}

async function listRecentDeploys(args, env) {
  const limit = args.limit || 10;
  if (!env.GITHUB_TOKEN) {
    return {
      ok: false,
      error: "github_token_missing",
      hint: "Set GITHUB_TOKEN env binding on the Worker to read receipts from GitHub."
    };
  }

  try {
    const apiUrl = "https://api.github.com/repos/nothinginfinity/agent-bridge/contents/shared/receipts";
    const r = await fetch(apiUrl, {
      headers: {
        "Authorization": `token ${env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": WORKER_NAME
      }
    });
    if (!r.ok) {
      const text = await r.text();
      return { ok: false, error: "github_api_error", status: r.status, detail: text.slice(0, 200) };
    }
    const files = await r.json();
    const receipts = files
      .filter(f => f.name.endsWith(".json") || f.name.endsWith(".md"))
      .sort((a, b) => b.name.localeCompare(a.name))
      .slice(0, limit)
      .map(f => ({ name: f.name, path: f.path, sha: f.sha, html_url: f.html_url }));
    return { ok: true, count: receipts.length, receipts };
  } catch (err) {
    return { ok: false, error: "fetch_error", message: String(err?.message || err) };
  }
}

async function registerWorker(args, env) {
  const { script_name, description, tags } = args;
  if (!script_name) return { ok: false, error: "missing_fields", required: ["script_name"] };
  if (!env.GITHUB_TOKEN) return { ok: false, error: "github_token_missing" };

  const subdomain = env.CF_WORKERS_SUBDOMAIN || "jaredtechfit";
  const entry = {
    script_name,
    description: description || DEFAULT_REGISTRY[script_name]?.description || "",
    tags: tags || DEFAULT_REGISTRY[script_name]?.tags || [],
    live_url: `https://${script_name}.${subdomain}.workers.dev`,
    registered_at: new Date().toISOString(),
    registered_by: WORKER_NAME
  };

  try {
    const path = `shared/registry/${script_name}.json`;
    const apiUrl = `https://api.github.com/repos/nothinginfinity/agent-bridge/contents/${path}`;
    const headers = {
      "Authorization": `token ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": WORKER_NAME,
      "Content-Type": "application/json"
    };

    let sha;
    const existing = await fetch(apiUrl, { headers });
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
    }

    const content = btoa(JSON.stringify(entry, null, 2) + "\n");
    const body = {
      message: `registry: register ${script_name} via ${WORKER_NAME}`,
      content,
      ...(sha ? { sha } : {})
    };

    const resp = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: "github_write_error", status: resp.status, detail: text.slice(0, 200) };
    }

    const result = await resp.json();
    return {
      ok: true,
      action: sha ? "updated" : "created",
      script_name,
      path,
      commit: result.commit?.sha
    };
  } catch (err) {
    return { ok: false, error: "fetch_error", message: String(err?.message || err) };
  }
}

async function writeHandoff(args, env) {
  const { note, from_agent, to_agent } = args;
  if (!note) return { ok: false, error: "missing_fields", required: ["note"] };
  if (!env.GITHUB_TOKEN) return { ok: false, error: "github_token_missing" };

  const ts = new Date().toISOString();
  const entry = `\n---\n**From:** ${from_agent || WORKER_NAME}  \n**To:** ${to_agent || "next-agent"}  \n**At:** ${ts}\n\n${note}\n`;

  try {
    const path = "shared/handoffs.md";
    const apiUrl = `https://api.github.com/repos/nothinginfinity/agent-bridge/contents/${path}`;
    const headers = {
      "Authorization": `token ${env.GITHUB_TOKEN}`,
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": WORKER_NAME,
      "Content-Type": "application/json"
    };

    const existing = await fetch(apiUrl, { headers });
    let currentContent = "";
    let sha;
    if (existing.ok) {
      const data = await existing.json();
      sha = data.sha;
      currentContent = atob(data.content.replace(/\n/g, ""));
    }

    const newContent = currentContent + entry;
    const encodedContent = btoa(unescape(encodeURIComponent(newContent)));

    const resp = await fetch(apiUrl, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `handoff: note from ${from_agent || WORKER_NAME} at ${ts}`,
        content: encodedContent,
        ...(sha ? { sha } : {})
      })
    });

    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: "github_write_error", status: resp.status, detail: text.slice(0, 200) };
    }

    const result = await resp.json();
    return {
      ok: true,
      path,
      commit: result.commit?.sha,
      from_agent: from_agent || WORKER_NAME,
      to_agent: to_agent || "next-agent",
      written_at: ts
    };
  } catch (err) {
    return { ok: false, error: "fetch_error", message: String(err?.message || err) };
  }
}

// ─── Health payload ───────────────────────────────────────────────────────────

function healthPayload(env) {
  return {
    ok: true,
    worker: WORKER_NAME,
    version: VERSION,
    timestamp: new Date().toISOString(),
    routes: ["GET /", "GET /health", "GET /llms.txt", "GET /tools/list", "POST /mcp",
             "GET /contracts/ui-contract.json", "GET /cmd/:tool", "GET /diag"],
    tools: TOOL_NAMES,
    integrations: {
      deploy_mcp_transport: deployMcpTransport(env),
      deploy_mcp_url: env.DEPLOY_MCP_URL || "(default workers.dev)",
      github_token: env.GITHUB_TOKEN ? "set" : "not_set",
      cf_account_id: env.CF_ACCOUNT_ID ? "set" : "not_set"
    }
  };
}

// ─── llms.txt ─────────────────────────────────────────────────────────────────

function llmsText(origin) {
  return `# ${WORKER_NAME} v${VERSION}
> Command-center MCP layer above afo-mobile-deploy-mcp.
> Orchestrates: deploy, smoke test, registry, handoff, Cloudflare inventory.

## Endpoints
- GET ${origin}/             — UI
- GET ${origin}/health       — Health check (JSON)
- GET ${origin}/llms.txt     — This file
- GET ${origin}/tools/list   — Tool inventory (JSON)
- POST ${origin}/mcp         — MCP protocol endpoint
- GET ${origin}/contracts/ui-contract.json — UI card contract
- GET ${origin}/cmd/:tool    — Slash-command GET surface
- GET ${origin}/diag         — Diagnostics

## Tools
${TOOL_NAMES.map(t => `- ${t}`).join("\n")}

## Security
- All write actions (deploy_worker, register_worker, write_handoff) require confirmed=true
- Secret values are never exposed in UI, logs, receipts, or /health output
- Preview-first: omit confirmed to see what would happen

## Integration
- Calls afo-mobile-deploy-mcp for deploy/validate/smoke-test operations
- Uses Cloudflare Service Binding (DEPLOY_MCP) when available, URL fallback otherwise
- Writes receipts and handoffs to GitHub via GITHUB_TOKEN
`;
}

// ─── UI Contract ──────────────────────────────────────────────────────────────

function uiContract() {
  return {
    worker: WORKER_NAME,
    version: VERSION,
    cards: [
      {
        id: "deploy-worker",
        title: "Deploy Worker",
        description: "Validate, preview, and deploy a Worker from GitHub to Cloudflare",
        tools: ["validate_worker", "preview_worker_deploy", "deploy_worker"],
        fields: ["script_name", "repo", "branch", "worker_path"],
        write: true,
        confirmation_required: true
      },
      {
        id: "smoke-test",
        title: "Smoke Test Worker",
        description: "Run smoke tests against a deployed Worker's standard routes",
        tools: ["run_smoke_test"],
        fields: ["script_name", "base_url"],
        write: false
      },
      {
        id: "recent-deploys",
        title: "List Recent Deploys",
        description: "List recent deployment receipts from GitHub",
        tools: ["list_recent_deploys"],
        fields: ["limit"],
        write: false
      },
      {
        id: "register-worker",
        title: "Register Worker",
        description: "Register or update Worker metadata in the AFO Tool Index",
        tools: ["register_worker"],
        fields: ["script_name", "description", "tags"],
        write: true,
        confirmation_required: true
      },
      {
        id: "open-urls",
        title: "Open Tool URLs",
        description: "Get live URLs for a deployed Worker",
        tools: ["open_worker_urls"],
        fields: ["script_name"],
        write: false
      },
      {
        id: "write-handoff",
        title: "Write Handoff",
        description: "Write a handoff note to the shared handoff inbox in GitHub",
        tools: ["write_handoff"],
        fields: ["note", "from_agent", "to_agent"],
        write: true,
        confirmation_required: true
      }
    ],
    integration_targets: [
      { name: "afo-mobile-deploy-mcp", transport: ["service_binding", "url_fallback"] },
      { name: "github", capabilities: ["read_receipts", "write_registry", "write_handoffs"] },
      { name: "cloudflare", capabilities: ["deploy_workers"] }
    ]
  };
}

// ─── Fetch probe helpers ──────────────────────────────────────────────────────

async function fetchProbe(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    return { ok: r.ok, status: r.status };
  } catch (err) {
    return { ok: false, status: 0, error: String(err?.message || err) };
  }
}

async function fetchProbeVerbose(url) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const text = await r.text().catch(() => "");
    const headers = {};
    r.headers.forEach((v, k) => { headers[k] = v; });
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return {
      ok: r.ok,
      status: r.status,
      response_headers: headers,
      content_type: headers["content-type"] || "",
      body_length: text.length,
      body_preview: text.slice(0, 300),
      json
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: String(err?.message || err),
      body_preview: "",
      json: null
    };
  }
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function cors(res) {
  res.headers.set("access-control-allow-origin", "*");
  res.headers.set("access-control-allow-methods", "GET, POST, OPTIONS");
  res.headers.set("access-control-allow-headers", "content-type");
  return res;
}

function jsonRes(data, status = 200) {
  return cors(new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  }));
}

function textRes(text, status = 200) {
  return cors(new Response(text, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8" }
  }));
}

function htmlRes(html, status = 200) {
  return cors(new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  }));
}

function trimSlash(s) { return s ? s.replace(/\/+$/, "") : ""; }

// ─── UI ───────────────────────────────────────────────────────────────────────

function indexHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AFO Mobile Terminal</title>
<style>
:root {
  --bg: #0f1117;
  --surface: #1a1d26;
  --surface2: #22263a;
  --border: #2e3347;
  --text: #e4e6f0;
  --muted: #8891b0;
  --accent: #4f8ef7;
  --success: #3ecf8e;
  --warn: #f5a623;
  --error: #f5475e;
  --radius: 10px;
  --font: 'SF Mono', 'Fira Code', 'Consolas', monospace;
}
* { box-sizing: border-box; margin: 0; padding: 0; }
body { background: var(--bg); color: var(--text); font-family: var(--font); font-size: 14px; min-height: 100vh; }
header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 14px 20px; display: flex; align-items: center; gap: 12px; position: sticky; top: 0; z-index: 10; }
header svg { flex-shrink: 0; }
.header-title { font-size: 15px; font-weight: 600; color: var(--text); }
.header-sub { font-size: 11px; color: var(--muted); }
.badge { font-size: 10px; padding: 2px 7px; border-radius: 99px; background: var(--surface2); border: 1px solid var(--border); color: var(--muted); margin-left: auto; }
.badge.ok { border-color: var(--success); color: var(--success); }
.badge.error { border-color: var(--error); color: var(--error); }
main { padding: 20px; max-width: 700px; margin: 0 auto; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 24px; }
@media (max-width: 500px) { .grid { grid-template-columns: 1fr; } }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; cursor: pointer; transition: border-color 0.15s; }
.card:hover { border-color: var(--accent); }
.card.active { border-color: var(--accent); background: #1e2235; }
.card-title { font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 4px; }
.card-desc { font-size: 11px; color: var(--muted); line-height: 1.5; }
.panel { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; margin-bottom: 24px; display: none; }
.panel.visible { display: block; }
.panel-title { font-size: 13px; font-weight: 600; color: var(--accent); margin-bottom: 14px; }
label { display: block; font-size: 11px; color: var(--muted); margin-bottom: 4px; margin-top: 12px; }
label:first-of-type { margin-top: 0; }
input, textarea { width: 100%; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; color: var(--text); font-family: var(--font); font-size: 13px; outline: none; transition: border-color 0.15s; }
input:focus, textarea:focus { border-color: var(--accent); }
textarea { min-height: 80px; resize: vertical; }
.row { display: flex; gap: 10px; margin-top: 16px; }
button { padding: 8px 16px; border-radius: 6px; border: none; font-family: var(--font); font-size: 12px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
button:active { opacity: 0.8; }
.btn-primary { background: var(--accent); color: #fff; }
.btn-secondary { background: var(--surface2); color: var(--text); border: 1px solid var(--border); }
.btn-confirm { background: var(--success); color: #0f1117; display: none; }
.output { display: none; margin-top: 14px; background: var(--surface2); border: 1px solid var(--border); border-radius: 6px; padding: 12px; font-size: 11px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; max-height: 320px; overflow-y: auto; color: var(--text); }
.output.ok { border-color: var(--success); color: var(--success); }
.output.warn { border-color: var(--warn); color: var(--warn); }
.output.error { border-color: var(--error); color: var(--error); }
.divider { border: none; border-top: 1px solid var(--border); margin: 24px 0; }
footer { text-align: center; padding: 20px; font-size: 11px; color: var(--muted); }
</style>
</head>
<body>
<header>
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4f8ef7" stroke-width="2" aria-label="Terminal">
    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
  </svg>
  <div>
    <div class="header-title">AFO Mobile Terminal</div>
    <div class="header-sub">afo-mobile-terminal-mcp &bull; v${VERSION}</div>
  </div>
  <div class="badge" id="status-badge">checking...</div>
</header>

<main>
  <div class="grid">
    <div class="card" onclick="showPanel('deploy')">
      <div class="card-title">&#x1F680; Deploy Worker</div>
      <div class="card-desc">Validate, preview, and deploy from GitHub to Cloudflare</div>
    </div>
    <div class="card" onclick="showPanel('smoke')">
      <div class="card-title">&#x1F9EA; Smoke Test</div>
      <div class="card-desc">Test a deployed Worker's standard routes</div>
    </div>
    <div class="card" onclick="showPanel('deploys')">
      <div class="card-title">&#x1F4CB; Recent Deploys</div>
      <div class="card-desc">List recent deployment receipts from GitHub</div>
    </div>
    <div class="card" onclick="showPanel('register')">
      <div class="card-title">&#x1F4DD; Register Worker</div>
      <div class="card-desc">Register or update Worker metadata in AFO registry</div>
    </div>
    <div class="card" onclick="showPanel('urls')">
      <div class="card-title">&#x1F517; Open Tool URLs</div>
      <div class="card-desc">Get all live URLs for a deployed Worker</div>
    </div>
    <div class="card" onclick="showPanel('handoff')">
      <div class="card-title">&#x270D;&#xFE0F; Write Handoff</div>
      <div class="card-desc">Write a handoff note to the shared inbox in GitHub</div>
    </div>
  </div>

  <!-- Deploy Worker -->
  <div class="panel" id="panel-deploy">
    <div class="panel-title">&#x1F680; Deploy Worker</div>
    <label>Script Name (or leave blank for full form)</label>
    <input id="d-script" type="text" placeholder="afo-buttons-mcp">
    <label>Repo (optional if script_name known)</label>
    <input id="d-repo" type="text" placeholder="nothinginfinity/agent-bridge">
    <label>Branch</label>
    <input id="d-branch" type="text" placeholder="main">
    <label>Worker Path</label>
    <input id="d-path" type="text" placeholder="workers/afo-buttons-mcp">
    <div class="row">
      <button class="btn-secondary" onclick="runValidate()">Validate</button>
      <button class="btn-secondary" onclick="runPreview()">Preview Deploy</button>
      <button class="btn-primary" onclick="startDeploy()">Deploy</button>
      <button class="btn-confirm" id="btn-confirm-deploy" onclick="confirmDeploy()">&#x2714; Confirm Deploy</button>
    </div>
    <div class="output" id="out-deploy"></div>
  </div>

  <!-- Smoke Test -->
  <div class="panel" id="panel-smoke">
    <div class="panel-title">&#x1F9EA; Smoke Test Worker</div>
    <label>Script Name</label>
    <input id="s-script" type="text" placeholder="afo-buttons-mcp">
    <label>Base URL (optional — overrides workers.dev default)</label>
    <input id="s-url" type="text" placeholder="https://afo-buttons-mcp.jaredtechfit.workers.dev">
    <div class="row">
      <button class="btn-primary" onclick="runSmoke()">Run Smoke Test</button>
    </div>
    <div class="output" id="out-smoke"></div>
  </div>

  <!-- Recent Deploys -->
  <div class="panel" id="panel-deploys">
    <div class="panel-title">&#x1F4CB; Recent Deploys</div>
    <label>Limit (default 10)</label>
    <input id="dl-limit" type="number" placeholder="10" min="1" max="50">
    <div class="row">
      <button class="btn-primary" onclick="runListDeploys()">List Deploys</button>
    </div>
    <div class="output" id="out-deploys"></div>
  </div>

  <!-- Register Worker -->
  <div class="panel" id="panel-register">
    <div class="panel-title">&#x1F4DD; Register Worker</div>
    <label>Script Name</label>
    <input id="r-script" type="text" placeholder="afo-buttons-mcp">
    <label>Description</label>
    <input id="r-desc" type="text" placeholder="Short description of this Worker">
    <label>Tags (comma-separated)</label>
    <input id="r-tags" type="text" placeholder="mcp, afo, buttons">
    <div class="row">
      <button class="btn-primary" onclick="startRegister()">Preview Register</button>
      <button class="btn-confirm" id="btn-confirm-register" onclick="confirmRegister()">&#x2714; Confirm Register</button>
    </div>
    <div class="output" id="out-register"></div>
  </div>

  <!-- Open URLs -->
  <div class="panel" id="panel-urls">
    <div class="panel-title">&#x1F517; Open Tool URLs</div>
    <label>Script Name</label>
    <input id="u-script" type="text" placeholder="afo-buttons-mcp">
    <div class="row">
      <button class="btn-primary" onclick="runOpenUrls()">Get URLs</button>
    </div>
    <div class="output" id="out-urls"></div>
  </div>

  <!-- Write Handoff -->
  <div class="panel" id="panel-handoff">
    <div class="panel-title">&#x270D;&#xFE0F; Write Handoff</div>
    <label>Handoff Note</label>
    <textarea id="h-note" placeholder="Describe what was done and what comes next..."></textarea>
    <label>From Agent</label>
    <input id="h-from" type="text" placeholder="alice">
    <label>To Agent</label>
    <input id="h-to" type="text" placeholder="claude">
    <div class="row">
      <button class="btn-primary" onclick="startHandoff()">Preview Handoff</button>
      <button class="btn-confirm" id="btn-confirm-handoff" onclick="confirmHandoff()">&#x2714; Confirm Write</button>
    </div>
    <div class="output" id="out-handoff"></div>
  </div>

</main>
<hr class="divider">
<footer>afo-mobile-terminal-mcp v${VERSION} &bull; <a href="/health" style="color:var(--accent)" target="_blank">/health</a> &bull; <a href="/tools/list" style="color:var(--accent)" target="_blank">/tools/list</a> &bull; <a href="/diag" style="color:var(--accent)" target="_blank">/diag</a></footer>

<script>
const BASE = '';

async function callTool(name, args, outId) {
  const out = document.getElementById(outId);
  out.className = 'output warn';
  out.style.display = 'block';
  out.textContent = 'Running ' + name + '...';
  try {
    const r = await fetch(BASE + '/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ method: 'tools/call', params: { name, arguments: args } })
    });
    const data = await r.json();
    const text = data?.content?.[0]?.text || JSON.stringify(data, null, 2);
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = null; }
    const ok = parsed ? (parsed.ok !== false && !parsed.error) : r.ok;
    out.className = 'output ' + (ok ? 'ok' : 'error');
    out.textContent = text;
    return parsed || data;
  } catch (err) {
    out.className = 'output error';
    out.textContent = 'Error: ' + err.message;
    return null;
  }
}

function deployArgs() {
  return {
    script_name: document.getElementById('d-script').value.trim() || undefined,
    repo: document.getElementById('d-repo').value.trim() || undefined,
    branch: document.getElementById('d-branch').value.trim() || undefined,
    worker_path: document.getElementById('d-path').value.trim() || undefined
  };
}

function showPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('visible'));
  document.querySelectorAll('.card').forEach(c => c.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) { panel.classList.add('visible'); panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

async function runValidate() { await callTool('validate_worker', deployArgs(), 'out-deploy'); }
async function runPreview()   { await callTool('preview_worker_deploy', deployArgs(), 'out-deploy'); }

async function startDeploy() {
  const result = await callTool('preview_worker_deploy', deployArgs(), 'out-deploy');
  if (result) {
    document.getElementById('btn-confirm-deploy').style.display = 'inline-block';
  }
}

async function confirmDeploy() {
  document.getElementById('btn-confirm-deploy').style.display = 'none';
  await callTool('deploy_worker', { ...deployArgs(), confirmed: true }, 'out-deploy');
}

async function runSmoke() {
  const args = {};
  const s = document.getElementById('s-script').value.trim();
  const u = document.getElementById('s-url').value.trim();
  if (s) args.script_name = s;
  if (u) args.base_url = u;
  await callTool('run_smoke_test', args, 'out-smoke');
}

async function runListDeploys() {
  const limit = parseInt(document.getElementById('dl-limit').value) || 10;
  await callTool('list_recent_deploys', { limit }, 'out-deploys');
}

function registerArgs() {
  const tags = document.getElementById('r-tags').value.trim();
  return {
    script_name: document.getElementById('r-script').value.trim() || undefined,
    description: document.getElementById('r-desc').value.trim() || undefined,
    tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined
  };
}

async function startRegister() {
  const result = await callTool('register_worker', registerArgs(), 'out-register');
  if (result) {
    document.getElementById('btn-confirm-register').style.display = 'inline-block';
  }
}

async function confirmRegister() {
  document.getElementById('btn-confirm-register').style.display = 'none';
  await callTool('register_worker', { ...registerArgs(), confirmed: true }, 'out-register');
}

async function runOpenUrls() {
  const script_name = document.getElementById('u-script').value.trim();
  await callTool('open_worker_urls', { script_name }, 'out-urls');
}

function handoffArgs(confirmed) {
  return {
    note: document.getElementById('h-note').value.trim(),
    from_agent: document.getElementById('h-from').value.trim() || undefined,
    to_agent: document.getElementById('h-to').value.trim() || undefined,
    confirmed
  };
}

async function startHandoff() {
  const result = await callTool('write_handoff', handoffArgs(false), 'out-handoff');
  if (result) {
    document.getElementById('btn-confirm-handoff').style.display = 'inline-block';
  }
}

async function confirmHandoff() {
  document.getElementById('btn-confirm-handoff').style.display = 'none';
  await callTool('write_handoff', handoffArgs(true), 'out-handoff');
}

// Boot: check health and set status badge
(async () => {
  const badge = document.getElementById('status-badge');
  try {
    const r = await fetch(BASE + '/health');
    const d = await r.json().catch(() => null);
    if (r.ok && d?.ok) {
      badge.textContent = 'v' + (d.version || '?') + ' ok';
      badge.className = 'badge ok';
    } else {
      badge.textContent = 'degraded';
      badge.className = 'badge error';
    }
  } catch {
    badge.textContent = 'offline';
    badge.className = 'badge error';
  }
})();
</script>
</body>
</html>`;
}
