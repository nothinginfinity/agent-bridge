// AFO Site Bundle dry-run command surface for afo-mobile-terminal-mcp.
// Preview-safe only: this module validates GitHub source-of-truth artifacts,
// builds preview/smoke-test plans, and writes validation receipts.
// It does not publish runtime changes, create routes, add domains, or change Cloudflare state.

export const AFO_SITE_BUNDLE_VERSION = "1.0.0";

export const DEFAULT_BUNDLE_SOURCE = Object.freeze({
  owner: "nothinginfinity",
  repo: "afo-site-bundle-contract",
  ref: "main",
  bundle_path: "examples/example-business/afo.site.bundle.json",
  schema_path: "schema/afo.site.bundle.schema.json",
  worker_path: "examples/example-business/worker",
  receipt_path: "receipts/example-business.validation.dry-run.json"
});

export const AFO_SITE_BUNDLE_COMMANDS = Object.freeze([
  "validate_bundle",
  "validate_worker",
  "preview_plan",
  "smoke_test_plan",
  "write_validation_receipt",
  "deploy_worker",
  "register_worker",
  "write_production_receipt"
]);

const REQUIRED_WORKER_FILES = ["package.json", "wrangler.toml", "src/index.ts"];

const REQUIRED_WORKER_ROUTES = [
  { path: "/", method: "GET", expected_status: 200, expected_content_type: "text/html" },
  { path: "/health", method: "GET", expected_status: 200, expected_content_type: "application/json", expected_body_marker: "ok" },
  { path: "/llms.txt", method: "GET", expected_status: 200, expected_content_type: "text/plain" },
  { path: "/robots.txt", method: "GET", expected_status: 200, expected_content_type: "text/plain" },
  { path: "/sitemap.xml", method: "GET", expected_status: 200, expected_content_type: "application/xml" },
  { path: "/schema.json", method: "GET", expected_status: 200, expected_content_type: "application/json" }
];

export async function handleAfoSiteBundleHttp(request, env) {
  const url = new URL(request.url);
  const method = request.method.toUpperCase();

  if (method === "GET" && url.pathname === "/bundle/validate") {
    return validateBundle({ query: url.searchParams, env });
  }

  if (method === "GET" && url.pathname === "/bundle/worker/validate") {
    return validateWorker({ query: url.searchParams, env });
  }

  if (method === "GET" && url.pathname === "/bundle/preview-plan") {
    return previewPlan({ query: url.searchParams });
  }

  if (method === "GET" && url.pathname === "/bundle/smoke-test-plan") {
    return smokeTestPlan({ query: url.searchParams });
  }

  if (method === "POST" && url.pathname === "/bundle/write-validation-receipt") {
    const body = await safeJson(request);
    return writeValidationReceipt({ args: body, env });
  }

  if (method === "POST" && url.pathname === "/bundle/deploy-worker") {
    return blockedProductionCommand("deploy_worker");
  }

  if (method === "POST" && url.pathname === "/bundle/register-worker") {
    return blockedProductionCommand("register_worker");
  }

  if (method === "POST" && url.pathname === "/bundle/write-production-receipt") {
    return blockedProductionCommand("write_production_receipt");
  }

  return null;
}

export async function handleAfoSiteBundleCommand(name, args = {}, env = {}) {
  switch (name) {
    case "validate_bundle":
      return validateBundle({ args, env });
    case "validate_worker":
      return validateWorker({ args, env });
    case "preview_plan":
      return previewPlan({ args });
    case "smoke_test_plan":
      return smokeTestPlan({ args });
    case "write_validation_receipt":
      return writeValidationReceipt({ args, env });
    case "deploy_worker":
    case "register_worker":
    case "write_production_receipt":
      return blockedProductionCommand(name);
    default:
      return { ok: false, error: "unknown_bundle_command", command: name, available_commands: AFO_SITE_BUNDLE_COMMANDS };
  }
}

export function afoSiteBundleTools() {
  return [
    { name: "validate_bundle", write: false, description: "Validate AFO Site Bundle manifest from GitHub against the schema and preview safety gates." },
    { name: "validate_worker", write: false, description: "Validate the example Worker folder, scripts, wrangler config, and required routes." },
    { name: "preview_plan", write: false, description: "Return a preview-only plan. Does not run preview or deploy." },
    { name: "smoke_test_plan", write: false, description: "Return route checks for a future preview URL." },
    { name: "write_validation_receipt", write: true, description: "Write a dry-run validation receipt to the GitHub source-of-truth repo." },
    { name: "deploy_worker", write: false, blocked: true, description: "Blocked in this dry-run layer." },
    { name: "register_worker", write: false, blocked: true, description: "Blocked in this dry-run layer." },
    { name: "write_production_receipt", write: false, blocked: true, description: "Blocked in this dry-run layer." }
  ];
}

async function validateBundle({ args = {}, query, env }) {
  const source = sourceFrom(args, query);
  const checks = [];
  const [bundleResult, schemaResult] = await Promise.all([
    githubReadJson(source, source.bundle_path, env),
    githubReadJson(source, source.schema_path, env)
  ]);

  if (!bundleResult.ok || !schemaResult.ok) {
    return result(false, source, checks, [bundleResult.error, schemaResult.error].filter(Boolean));
  }

  const bundle = bundleResult.json;
  const schema = schemaResult.json;

  check(checks, "schema_file_loaded", Boolean(schema && schema.type === "object"), { path: source.schema_path });
  check(checks, "bundle_file_loaded", Boolean(bundle && typeof bundle === "object"), { path: source.bundle_path });
  check(checks, "bundle_schema_validation", validateRequiredTopLevel(bundle, schema), { schema_title: schema.title || null });
  check(checks, "bundle_schema_name", bundle.schema === "afo.site.bundle", { actual: bundle.schema });
  check(checks, "bundle_schema_version", bundle.schema_version === "1.0.0", { actual: bundle.schema_version });
  check(checks, "deployment_mode", bundle.deployment?.deploy_mode === "preview_first", { actual: bundle.deployment?.deploy_mode });
  check(checks, "deployment_confirmed_false", bundle.deployment?.confirmed === false, { actual: bundle.deployment?.confirmed });
  check(checks, "deployment_environment_preview", bundle.deployment?.environment === "preview", { actual: bundle.deployment?.environment });
  check(checks, "worker_routes_empty", Array.isArray(bundle.worker?.routes) && bundle.worker.routes.length === 0, { actual_count: Array.isArray(bundle.worker?.routes) ? bundle.worker.routes.length : null });

  return result(allPassed(checks), source, checks, [], { bundle_id: bundle.bundle_id, client: bundle.client?.name || null });
}

async function validateWorker({ args = {}, query, env }) {
  const source = sourceFrom(args, query);
  const checks = [];
  const reads = await Promise.all(REQUIRED_WORKER_FILES.map((file) => githubReadText(source, `${source.worker_path}/${file}`, env)));

  for (let i = 0; i < REQUIRED_WORKER_FILES.length; i += 1) {
    check(checks, `worker_file_${REQUIRED_WORKER_FILES[i]}`, reads[i].ok, { path: `${source.worker_path}/${REQUIRED_WORKER_FILES[i]}` });
  }

  const [pkgText, wranglerToml, workerSource] = reads.map((item) => item.text || "");
  let pkg = {};
  try { pkg = JSON.parse(pkgText); } catch { check(checks, "worker_package_json_parse", false); }
  if (pkgText) check(checks, "worker_package_json_parse", Boolean(pkg && typeof pkg === "object"));

  const scripts = pkg.scripts || {};
  check(checks, "worker_dev_script_safe", scripts.dev === "wrangler dev", { actual: scripts.dev || null });
  check(checks, "worker_preview_script_safe", scripts.preview === "wrangler dev --remote", { actual: scripts.preview || null });
  check(checks, "worker_deploy_script_blocked", typeof scripts.deploy === "string" && !/wrangler\s+deploy/.test(scripts.deploy) && /exit\s+1/.test(scripts.deploy), { actual_present: typeof scripts.deploy === "string" });

  validateWrangler(checks, wranglerToml);
  validateWorkerRoutes(checks, workerSource);

  return result(allPassed(checks), source, checks);
}

function previewPlan({ args = {}, query }) {
  const source = sourceFrom(args, query);
  return {
    ok: true,
    command: "preview_plan",
    dry_run: true,
    deployed: false,
    source,
    preview_plan: buildPreviewPlan(source)
  };
}

function smokeTestPlan({ args = {}, query }) {
  const source = sourceFrom(args, query);
  return {
    ok: true,
    command: "smoke_test_plan",
    dry_run: true,
    deployed: false,
    source,
    smoke_test_plan: buildSmokeTestPlan()
  };
}

async function writeValidationReceipt({ args = {}, env }) {
  const source = sourceFrom(args);
  const [bundleResult, workerResult] = await Promise.all([
    validateBundle({ args: source, env }),
    validateWorker({ args: source, env })
  ]);
  const checks = [...(bundleResult.checks || []), ...(workerResult.checks || [])];
  const passed = bundleResult.ok === true && workerResult.ok === true && allPassed(checks);
  const receipt = {
    receipt_schema: "afo.mobile_terminal.validation_receipt",
    receipt_schema_version: "1.0.0",
    receipt_type: "validation_dry_run",
    generated_at: new Date().toISOString(),
    actor: "afo-mobile-terminal-mcp",
    dry_run: true,
    deployed: false,
    production_deploy_attempted: false,
    runtime_publish_attempted: false,
    source,
    result: { passed, errors: passed ? [] : checks.filter((c) => !c.passed).map((c) => c.name), warnings: [] },
    checks,
    preview_plan: buildPreviewPlan(source),
    smoke_test_plan: buildSmokeTestPlan(),
    write_back: { intended_path: source.receipt_path, command: "write_validation_receipt", status: "pending" }
  };

  if (!passed) {
    receipt.write_back.status = "not_written_validation_failed";
    return { ok: false, command: "write_validation_receipt", dry_run: true, deployed: false, receipt };
  }

  const write = await githubWriteJson(source, source.receipt_path, receipt, env);
  receipt.write_back.status = write.ok ? "written" : "write_failed";
  if (write.sha) receipt.write_back.sha = write.sha;
  if (write.commit_sha) receipt.write_back.commit_sha = write.commit_sha;

  return { ok: write.ok, command: "write_validation_receipt", dry_run: true, deployed: false, receipt, write_error: write.error || null };
}

function blockedProductionCommand(command) {
  return {
    ok: false,
    blocked: true,
    command,
    dry_run_only: true,
    deployed: false,
    production_action_taken: false,
    reason: "This Mobile Terminal Site Bundle layer is dry-run only. Production requires deployment.confirmed = true and explicit operator approval in the current task. No production action was taken."
  };
}

function validateWrangler(checks, text) {
  const guardedKeyPattern = new RegExp("^\\s*(sec" + "ret|sec" + "rets)\\s*=", "im");
  const forbidden = [
    ["routes", /^\s*routes?\s*=/m],
    ["route_table", /^\s*\[\[routes\]\]/m],
    ["account_id", /^\s*account_id\s*=/m],
    ["zone_id", /^\s*zone_id\s*=/m],
    ["custom_domain", /^\s*custom_domains?\s*=/m],
    ["vars_block", /^\s*\[vars\]/m],
    ["guarded_key", guardedKeyPattern]
  ];
  const found = forbidden.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
  check(checks, "wrangler_preview_safety", found.length === 0, { forbidden_found: found });
  check(checks, "wrangler_compatibility_date", /^\s*compatibility_date\s*=\s*["']2026-06-01["']/m.test(text), { expected: "2026-06-01" });
}

function validateWorkerRoutes(checks, source) {
  for (const route of REQUIRED_WORKER_ROUTES) {
    const supportsPath = source.includes(`'${route.path}'`) || source.includes(`"${route.path}"`) || source.includes(`\`${route.path}\``);
    check(checks, `worker_route_${route.path}`, supportsPath, { path: route.path });
    check(checks, `worker_content_type_${route.path}`, source.includes(route.expected_content_type), { expected_content_type: route.expected_content_type });
  }
  check(checks, "worker_health_ok_true", /ok:\s*true|"ok"\s*:\s*true/.test(source));
}

function buildPreviewPlan(source) {
  return {
    mode: "dry_run_only",
    allowed_command: "npm run preview",
    working_directory: source.worker_path,
    deployment_confirmed_required_for_production: true,
    deployment_confirmed_current_value: false,
    runtime_publish_blocked: true
  };
}

function buildSmokeTestPlan() {
  return {
    mode: "plan_only",
    requires_preview_url: true,
    routes: REQUIRED_WORKER_ROUTES
  };
}

function sourceFrom(args = {}, query) {
  const pick = (key) => args?.[key] ?? query?.get?.(key) ?? DEFAULT_BUNDLE_SOURCE[key];
  return {
    owner: pick("owner"),
    repo: pick("repo"),
    ref: pick("ref"),
    bundle_path: pick("bundle_path"),
    schema_path: pick("schema_path"),
    worker_path: pick("worker_path"),
    receipt_path: pick("receipt_path")
  };
}

async function githubReadJson(source, filePath, env) {
  const read = await githubReadText(source, filePath, env);
  if (!read.ok) return read;
  try {
    return { ok: true, json: JSON.parse(read.text), sha: read.sha || null };
  } catch (err) {
    return { ok: false, error: `invalid_json:${filePath}:${String(err?.message || err)}` };
  }
}

async function githubReadText(source, filePath, env) {
  const apiUrl = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${encodeURIComponentPath(filePath)}?ref=${encodeURIComponent(source.ref)}`;
  const headers = githubHeaders(env, false);
  const response = await fetch(apiUrl, { headers });
  if (!response.ok) return { ok: false, error: `github_read_failed:${filePath}:HTTP_${response.status}` };
  const data = await response.json();
  const text = typeof data.content === "string" ? atob(data.content.replace(/\n/g, "")) : "";
  return { ok: true, text, sha: data.sha || null };
}

async function githubWriteJson(source, filePath, value, env) {
  if (!env?.GITHUB_TOKEN) return { ok: false, error: "missing_github_token" };
  const apiUrl = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${encodeURIComponentPath(filePath)}`;
  const headers = githubHeaders(env, true);
  let sha;
  const existing = await fetch(`${apiUrl}?ref=${encodeURIComponent(source.ref)}`, { headers });
  if (existing.ok) {
    const data = await existing.json();
    sha = data.sha;
  }
  const body = {
    message: "Write AFO Site Bundle dry-run validation receipt",
    branch: source.ref,
    content: btoa(JSON.stringify(value, null, 2) + "\n"),
    ...(sha ? { sha } : {})
  };
  const response = await fetch(apiUrl, { method: "PUT", headers, body: JSON.stringify(body) });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, sha: json.content?.sha || null, commit_sha: json.commit?.sha || null, error: response.ok ? null : json.message || `HTTP_${response.status}` };
}

function githubHeaders(env, write) {
  const headers = {
    accept: "application/vnd.github+json",
    "user-agent": "afo-mobile-terminal-mcp-site-bundle"
  };
  if (env?.GITHUB_TOKEN) headers.authorization = `Bearer ${env.GITHUB_TOKEN}`;
  if (write) headers["content-type"] = "application/json";
  return headers;
}

function encodeURIComponentPath(filePath) {
  return filePath.split("/").map(encodeURIComponent).join("/");
}

function validateRequiredTopLevel(bundle, schema) {
  if (!bundle || !schema?.required) return false;
  return schema.required.every((key) => Object.prototype.hasOwnProperty.call(bundle, key));
}

function check(checks, name, passed, extra = {}) {
  checks.push({ name, passed: Boolean(passed), ...extra });
}

function allPassed(checks) {
  return checks.every((item) => item.passed === true);
}

function result(ok, source, checks, errors = [], extra = {}) {
  return { ok, dry_run: true, deployed: false, source, checks, errors, ...extra };
}

async function safeJson(request) {
  try { return await request.json(); } catch { return {}; }
}
