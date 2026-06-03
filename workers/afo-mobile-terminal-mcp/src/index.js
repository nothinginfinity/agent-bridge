// afo-mobile-terminal-mcp v0.3.1
// Preview-safe Mobile Terminal command router for AFO Site Bundle dry-run integration.
// GitHub is source of truth. This Worker does not deploy, create production routes,
// add custom domains, add protected runtime values, or mutate Cloudflare runtime state.

import {
  AFO_SITE_BUNDLE_COMMANDS,
  AFO_SITE_BUNDLE_VERSION,
  DEFAULT_BUNDLE_SOURCE,
  afoSiteBundleTools,
  handleAfoSiteBundleCommand,
  handleAfoSiteBundleHttp
} from "./afo-site-bundle-commands.js";

const VERSION = "0.3.1";
const WORKER_NAME = "afo-mobile-terminal-mcp";
const ROUTES = [
  "GET /",
  "GET /health",
  "GET /llms.txt",
  "GET /tools/list",
  "POST /mcp",
  "GET /cmd/help",
  "GET /cmd/:command",
  "GET /bundle/validate",
  "GET /bundle/worker/validate",
  "GET /bundle/preview-plan",
  "GET /bundle/smoke-test-plan",
  "POST /bundle/write-validation-receipt",
  "GET /bundle/write-validation-receipt-action (guarded)",
  "POST /bundle/deploy-worker (blocked)",
  "POST /bundle/register-worker (blocked)",
  "POST /bundle/write-production-receipt (blocked)"
];

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));

    const url = new URL(request.url);

    try {
      const bundleRoute = await handleAfoSiteBundleHttp(request, env);
      if (bundleRoute) return json(bundleRoute, bundleRoute.ok === false && bundleRoute.blocked ? 403 : 200);

      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/ui")) {
        return html(indexHtml(url.origin));
      }

      if (request.method === "GET" && url.pathname === "/health") {
        return json(healthPayload(env));
      }

      if (request.method === "GET" && url.pathname === "/llms.txt") {
        return text(llmsText(url.origin), "text/plain; charset=utf-8");
      }

      if (request.method === "GET" && url.pathname === "/tools/list") {
        return json({ ok: true, tools: toolsList() });
      }

      if (request.method === "GET" && (url.pathname === "/cmd" || url.pathname === "/cmd/" || url.pathname === "/cmd/help")) {
        return json(cmdHelp(url.origin));
      }

      if (request.method === "GET" && url.pathname.startsWith("/cmd/")) {
        return json(await handleCmd(url, env));
      }

      if (request.method === "POST" && url.pathname === "/mcp") {
        return json(await handleMcp(request, env));
      }

      return json({ ok: false, error: "not_found", path: url.pathname, routes: ROUTES }, 404);
    } catch (err) {
      return json({ ok: false, error: "internal_error", message: String(err?.message || err) }, 500);
    }
  }
};

function healthPayload(env) {
  return {
    ok: true,
    worker: WORKER_NAME,
    version: VERSION,
    site_bundle_version: AFO_SITE_BUNDLE_VERSION,
    dry_run_only: true,
    deployed: false,
    runtime_publish_enabled: false,
    github_token: env?.GITHUB_TOKEN ? "configured" : "not_configured",
    routes: ROUTES,
    source: DEFAULT_BUNDLE_SOURCE
  };
}

function toolsList() {
  return afoSiteBundleTools().map((tool) => ({
    name: tool.name,
    description: tool.description,
    blocked: Boolean(tool.blocked),
    guarded: Boolean(tool.guarded),
    required_confirm: tool.confirm || null,
    write: tool.name === "write_validation_receipt",
    inputSchema: siteBundleInputSchema(tool.name)
  }));
}

function siteBundleInputSchema(name) {
  const sourceProperties = {
    owner: { type: "string", default: DEFAULT_BUNDLE_SOURCE.owner },
    repo: { type: "string", default: DEFAULT_BUNDLE_SOURCE.repo },
    ref: { type: "string", default: DEFAULT_BUNDLE_SOURCE.ref },
    bundle_path: { type: "string", default: DEFAULT_BUNDLE_SOURCE.bundle_path },
    schema_path: { type: "string", default: DEFAULT_BUNDLE_SOURCE.schema_path },
    worker_path: { type: "string", default: DEFAULT_BUNDLE_SOURCE.worker_path },
    receipt_path: { type: "string", default: DEFAULT_BUNDLE_SOURCE.receipt_path },
    confirm: { type: "string", description: "Required for GET/cmd write_validation_receipt: dry-run-receipt" }
  };

  return {
    type: "object",
    properties: sourceProperties,
    required: [],
    description: name === "write_validation_receipt"
      ? "Writes a dry-run validation receipt to GitHub. POST remains supported; GET/cmd fallback requires confirm=dry-run-receipt. Does not deploy."
      : "Reads GitHub source-of-truth files and returns dry-run validation output."
  };
}

async function handleMcp(request, env) {
  const body = await safeJson(request);
  const { method, params } = body || {};

  if (method === "tools/list") {
    return { ok: true, tools: toolsList() };
  }

  if (method === "tools/call") {
    const name = params?.name;
    const args = params?.arguments || {};
    if (!AFO_SITE_BUNDLE_COMMANDS.includes(name)) {
      return { ok: false, error: "unknown_tool", tool: name, available: AFO_SITE_BUNDLE_COMMANDS };
    }
    const result = await handleAfoSiteBundleCommand(name, args, env);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  }

  return { ok: false, error: "unknown_method", method, supported_methods: ["tools/list", "tools/call"] };
}

async function handleCmd(url, env) {
  const parts = url.pathname.split("/").filter(Boolean);
  const command = parts[1];
  if (!AFO_SITE_BUNDLE_COMMANDS.includes(command)) {
    return { ok: false, error: "unknown_command", command, available: AFO_SITE_BUNDLE_COMMANDS };
  }
  const args = Object.fromEntries(url.searchParams.entries());
  return handleAfoSiteBundleCommand(command, args, env);
}

function cmdHelp(origin) {
  return {
    ok: true,
    worker: WORKER_NAME,
    version: VERSION,
    dry_run_only: true,
    description: "AFO Mobile Terminal dry-run command surface for AFO Site Bundle validation.",
    commands: AFO_SITE_BUNDLE_COMMANDS,
    examples: {
      validate_bundle: `${origin}/cmd/validate_bundle`,
      validate_worker: `${origin}/cmd/validate_worker`,
      preview_plan: `${origin}/cmd/preview_plan`,
      smoke_test_plan: `${origin}/cmd/smoke_test_plan`,
      guarded_write_validation_receipt: `${origin}/bundle/write-validation-receipt-action?confirm=dry-run-receipt`,
      guarded_cmd_write_validation_receipt: `${origin}/cmd/write_validation_receipt?confirm=dry-run-receipt`,
      blocked_deploy_worker: `${origin}/bundle/deploy-worker`
    },
    routes: ROUTES,
    blocked_commands: ["deploy_worker", "register_worker", "write_production_receipt"]
  };
}

function llmsText(origin) {
  return `# AFO Mobile Terminal MCP\n\nPreview-safe Mobile Terminal command surface for AFO Site Bundle dry-run validation.\n\nSource of truth: GitHub. Runtime deployment is not performed by this layer.\n\nSafe commands:\n- validate_bundle\n- validate_worker\n- preview_plan\n- smoke_test_plan\n- write_validation_receipt (guarded for GET/cmd fallback)\n\nGuarded GET write action:\n- ${origin}/bundle/write-validation-receipt-action?confirm=dry-run-receipt\n\nBlocked commands:\n- deploy_worker\n- register_worker\n- write_production_receipt\n\nHTTP routes:\n${ROUTES.map((route) => `- ${origin}${route.replace(/^[A-Z]+ /, "")}`).join("\n")}\n`;
}

function indexHtml(origin) {
  const rows = ROUTES.map((route) => `<li><code>${escapeHtml(route)}</code></li>`).join("\n");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AFO Mobile Terminal MCP</title>
</head>
<body>
  <main>
    <h1>AFO Mobile Terminal MCP</h1>
    <p>Preview-safe dry-run command surface for AFO Site Bundle validation.</p>
    <p>No production deployment, route creation, custom domain wiring, or runtime publish action is performed by this layer.</p>
    <h2>Routes</h2>
    <ul>${rows}</ul>
    <h2>Quick links</h2>
    <ul>
      <li><a href="${origin}/bundle/validate">Validate bundle</a></li>
      <li><a href="${origin}/bundle/worker/validate">Validate Worker</a></li>
      <li><a href="${origin}/bundle/preview-plan">Preview plan</a></li>
      <li><a href="${origin}/bundle/smoke-test-plan">Smoke-test plan</a></li>
      <li><a href="${origin}/bundle/write-validation-receipt-action">Guarded receipt action without confirm (blocked)</a></li>
      <li><a href="${origin}/tools/list">Tools list</a></li>
    </ul>
  </main>
</body>
</html>`;
}

function json(payload, status = 200) {
  return withCors(new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" }
  }));
}

function html(body, status = 200) {
  return withCors(new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" }
  }));
}

function text(body, contentType, status = 200) {
  return withCors(new Response(body, {
    status,
    headers: { "content-type": contentType }
  }));
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "content-type,authorization");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[char]));
}
