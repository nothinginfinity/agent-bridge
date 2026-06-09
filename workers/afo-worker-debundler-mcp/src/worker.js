// ============================================================
// afo-worker-debundler-mcp  v1.0.0
// Reads a single-file Cloudflare Worker from GitHub,
// splits it into a modular src/ structure, and commits
// all files back to the repo.
//
// Required bindings:
//   GITHUB_TOKEN  (secret)
//   DEFAULT_OWNER (var)
// ============================================================

const NAME    = 'afo-worker-debundler-mcp';
const VERSION = '1.0.0';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const R   = (x, s = 200) => Response.json(x, { status: s, headers: { ...CORS, 'cache-control': 'no-store' } });
const ok  = (id, x)      => R({ jsonrpc: '2.0', id, result: x });
const txt = (id, x)      => R({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(x, null, 2) }] } });
const er  = (id, e)      => R({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e?.message || e) } });

function b64encode(s) {
  const bytes = new TextEncoder().encode(String(s ?? ''));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64decode(s) {
  return decodeURIComponent(escape(atob((s || '').replace(/\n/g, ''))));
}
function encodePath(p) { return p.split('/').map(encodeURIComponent).join('/'); }

async function gh(env, method, path, body) {
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN binding is missing');
  const res = await fetch('https://api.github.com' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': NAME,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(json.message || text || 'GitHub HTTP ' + res.status);
  return json;
}

async function readGHFile(env, owner, repo, path, branch) {
  const ref = branch ? '?ref=' + encodeURIComponent(branch) : '';
  const r = await gh(env, 'GET', '/repos/' + owner + '/' + repo + '/contents/' + encodePath(path) + ref);
  if (r.type !== 'file') throw new Error(path + ' is not a file');
  return { content: b64decode(r.content), sha: r.sha };
}

async function writeGHFile(env, owner, repo, path, content, branch, message) {
  let sha = null;
  try {
    const ref = branch ? '?ref=' + encodeURIComponent(branch) : '';
    const r = await gh(env, 'GET', '/repos/' + owner + '/' + repo + '/contents/' + encodePath(path) + ref);
    sha = r.sha || null;
  } catch { /* new file */ }
  const body = { message: message || 'debundle: write ' + path, content: b64encode(content), branch: branch || 'main' };
  if (sha) body.sha = sha;
  const r = await gh(env, 'PUT', '/repos/' + owner + '/' + repo + '/contents/' + encodePath(path), body);
  return { path, sha: r.content && r.content.sha, commit_sha: r.commit && r.commit.sha, action: sha ? 'updated' : 'created' };
}

// ── Routing rules: function name → target file ────────────────────────────────

const ROUTING_RULES = [
  { pattern: /^(esc|j|h|now)\b/,                                                                                              file: 'src/utils.js' },
  { pattern: /^(dbFirst|dbAll|dbRun|loadSection|loadAllContent|defaultContact|defaultServices|defaultTestimonials)\b/,        file: 'src/db.js' },
  { pattern: /^checkAuth\b/,                                                                                                  file: 'src/auth.js' },
  { pattern: /^renderLogin\b/,                                                                                                file: 'src/render/login.js' },
  { pattern: /^renderAdmin\b/,                                                                                                file: 'src/render/admin.js' },
  { pattern: /^renderPage\b/,                                                                                                 file: 'src/render/page.js' },
  { pattern: /^handleHome\b/,                                                                                                 file: 'src/handlers/home.js' },
  { pattern: /^handlePublish\b/,                                                                                              file: 'src/handlers/publish.js' },
  { pattern: /^handleLead\b/,                                                                                                 file: 'src/handlers/lead.js' },
  { pattern: /^handleStatus\b/,                                                                                               file: 'src/handlers/status.js' },
  { pattern: /^handleContent\b/,                                                                                              file: 'src/handlers/content.js' },
  { pattern: /^handleAdmin/,                                                                                                  file: 'src/handlers/admin.js' },
];

const FILE_IMPORTS = {
  'src/db.js':               [],
  'src/utils.js':            [],
  'src/auth.js':             [],
  'src/render/login.js':     ["import { esc } from '../utils.js';"],
  'src/render/admin.js':     ["import { esc } from '../utils.js';"],
  'src/render/page.js':      ["import { esc } from '../utils.js';"],
  'src/handlers/home.js':    ["import { h } from '../utils.js';", "import { dbFirst, loadSection, defaultContact, defaultServices, defaultTestimonials } from '../db.js';", "import { renderPage } from '../render/page.js';"],
  'src/handlers/publish.js': ["import { j } from '../utils.js';", "import { dbRun, loadSection, defaultContact, defaultServices, defaultTestimonials } from '../db.js';", "import { renderPage } from '../render/page.js';"],
  'src/handlers/lead.js':    ["import { j } from '../utils.js';", "import { dbRun } from '../db.js';"],
  'src/handlers/status.js':  ["import { j } from '../utils.js';", "import { dbFirst, loadSection } from '../db.js';"],
  'src/handlers/content.js': ["import { j } from '../utils.js';", "import { dbAll } from '../db.js';"],
  'src/handlers/admin.js':   ["import { h, j } from '../utils.js';", "import { dbFirst, dbAll, dbRun, loadSection, defaultContact, defaultServices, defaultTestimonials } from '../db.js';", "import { checkAuth } from '../auth.js';", "import { renderLogin } from '../render/login.js';", "import { renderAdmin } from '../render/admin.js';"],
};

const FILE_EXPORTS = {
  'src/utils.js':            ['esc', 'j', 'h', 'now'],
  'src/db.js':               ['dbFirst', 'dbAll', 'dbRun', 'loadSection', 'loadAllContent', 'defaultContact', 'defaultServices', 'defaultTestimonials'],
  'src/auth.js':             ['checkAuth'],
  'src/render/login.js':     ['renderLogin'],
  'src/render/admin.js':     ['renderAdmin'],
  'src/render/page.js':      ['renderPage'],
  'src/handlers/home.js':    ['handleHome'],
  'src/handlers/publish.js': ['handlePublish'],
  'src/handlers/lead.js':    ['handleLead'],
  'src/handlers/status.js':  ['handleStatus'],
  'src/handlers/content.js': ['handleContent'],
  'src/handlers/admin.js':   ['handleAdmin', 'handleAdminAuth', 'handleAdminContent'],
};

// ── Parser ────────────────────────────────────────────────────────────────────

function extractFunctions(source) {
  const functions = [];
  const lines = source.split('\n');
  let i = 0;
  while (i < lines.length) {
    const trimmed = lines[i].trim();
    const fnMatch      = trimmed.match(/^(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/);
    const constFnMatch = trimmed.match(/^const\s+(\w+)\s*=\s*(?:async\s+)?function/);
    const arrowMatch   = trimmed.match(/^const\s+(\w+)\s*=\s*(?:async\s+)?\(/);
    const match = fnMatch || constFnMatch || arrowMatch;
    if (match) {
      const name = match[1];
      const startLine = i;
      let depth = 0, started = false, endLine = i;
      for (let j = i; j < lines.length; j++) {
        const l = lines[j];
        for (let k = 0; k < l.length; k++) {
          if (l[k] === '{') { depth++; started = true; }
          else if (l[k] === '}') { depth--; }
        }
        if (started && depth === 0) { endLine = j; break; }
      }
      functions.push({ name, startLine, endLine, body: lines.slice(startLine, endLine + 1).join('\n') });
      i = endLine + 1;
      continue;
    }
    i++;
  }
  return functions;
}

function extractConstants(source) {
  const lines = source.split('\n');
  const constants = [];
  for (const line of lines) {
    const t = line.trim();
    if (/^const\s+\w+\s*=\s*[^({]/.test(t) && !t.includes('=>')) constants.push(line);
  }
  return constants;
}

function extractExportDefault(source) {
  const idx = source.indexOf('export default {');
  if (idx === -1) return null;
  return source.slice(idx);
}

function routeFunction(name) {
  for (const rule of ROUTING_RULES) {
    if (rule.pattern.test(name)) return rule.file;
  }
  return null;
}

function buildFileContents(functions, constants, exportDefault, workerName, workerVersion) {
  const fileMap = {};
  for (const fn of functions) {
    const target = routeFunction(fn.name);
    if (!target) continue;
    if (!fileMap[target]) fileMap[target] = [];
    fileMap[target].push(fn);
  }

  const files = {};
  for (const [filePath, fns] of Object.entries(fileMap)) {
    const imports  = (FILE_IMPORTS[filePath] || []).join('\n');
    const fnBodies = fns.map(function(fn) {
      let body = fn.body.replace(/^export\s+/, '');
      return body.startsWith('export') ? body : 'export ' + body;
    }).join('\n\n');
    files[filePath] = ['// ' + filePath + ' — ' + workerName, imports || '', fnBodies].filter(Boolean).join('\n');
  }

  const constLines = constants.filter(function(c) { return /const\s+(VERSION|WORKER)\s*=/.test(c); });
  const allImports = [
    "import { esc, j, h, now } from './utils.js';",
    "import { dbFirst, dbAll, dbRun, loadSection, loadAllContent, defaultContact, defaultServices, defaultTestimonials } from './db.js';",
    "import { checkAuth } from './auth.js';",
    "import { renderLogin } from './render/login.js';",
    "import { renderAdmin } from './render/admin.js';",
    "import { renderPage } from './render/page.js';",
    "import { handleHome } from './handlers/home.js';",
    "import { handlePublish } from './handlers/publish.js';",
    "import { handleLead } from './handlers/lead.js';",
    "import { handleStatus } from './handlers/status.js';",
    "import { handleContent } from './handlers/content.js';",
    "import { handleAdmin, handleAdminAuth, handleAdminContent } from './handlers/admin.js';",
  ].join('\n');

  files['src/index.js'] = [
    '// ============================================================',
    '// ' + workerName + '  v' + workerVersion,
    '// Entry point — routing only. Edit individual src/ files.',
    '// ============================================================',
    '',
    constLines.join('\n'),
    '',
    allImports,
    '',
    exportDefault || '// export default fetch handler not found — add manually',
  ].join('\n');

  return files;
}

function analyzeSource(source) {
  const functions = extractFunctions(source);
  const routed = {}, unrouted = [];
  for (const fn of functions) {
    const file = routeFunction(fn.name);
    if (file) { if (!routed[file]) routed[file] = []; routed[file].push(fn.name); }
    else if (fn.name !== 'fetch') unrouted.push(fn.name);
  }
  return {
    total_functions: functions.length,
    total_constants: extractConstants(source).length,
    routed_files: Object.keys(routed).length,
    routing: routed,
    unrouted,
    functions: functions.map(function(f) { return { name: f.name, lines: f.endLine - f.startLine + 1, target: routeFunction(f.name) || 'src/index.js' }; }),
  };
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function toolAnalyzeWorker(args, env) {
  const owner  = args.owner  || env.DEFAULT_OWNER || 'nothinginfinity';
  const repo   = args.repo;
  const file   = args.file   || 'src/worker.js';
  const branch = args.branch || 'main';
  if (!repo) throw new Error('repo is required');
  const { content } = await readGHFile(env, owner, repo, file, branch);
  const analysis = analyzeSource(content);
  return { ok: true, source: owner + '/' + repo + ':' + file + '@' + branch, source_bytes: new TextEncoder().encode(content).length, source_lines: content.split('\n').length, analysis, output_files: Object.keys(FILE_EXPORTS), note: 'Dry run — no files written. Run debundle_worker to execute.' };
}

async function toolDebundleWorker(args, env) {
  const owner     = args.owner      || env.DEFAULT_OWNER || 'nothinginfinity';
  const repo      = args.repo;
  const file      = args.file       || 'src/worker.js';
  const branch    = args.branch     || 'main';
  const dstRepo   = args.dst_repo   || repo;
  const dstBranch = args.dst_branch || branch;
  const dstBase   = args.dst_base   || '';
  const message   = args.commit_message || 'debundle: split worker into modular src/ structure';
  if (!repo) throw new Error('repo is required');

  const { content } = await readGHFile(env, owner, repo, file, branch);
  const versionMatch  = content.match(/const VERSION\s*=\s*['"]([^'"]+)['"]/);
  const workerMatch   = content.match(/const WORKER\s*=\s*['"]([^'"]+)['"]/);
  const workerVersion = versionMatch ? versionMatch[1] : '1.0.0';
  const workerName    = workerMatch  ? workerMatch[1]  : repo;

  const functions     = extractFunctions(content);
  const constants     = extractConstants(content);
  const exportDefault = extractExportDefault(content);
  const fileContents  = buildFileContents(functions, constants, exportDefault, workerName, workerVersion);

  const written = [], errors = [];
  for (const [relPath, fileContent] of Object.entries(fileContents)) {
    const fullPath = dstBase ? dstBase.replace(/\/$/, '') + '/' + relPath : relPath;
    try {
      const result = await writeGHFile(env, owner, dstRepo, fullPath, fileContent, dstBranch, message);
      written.push({ path: fullPath, action: result.action, sha: result.sha });
    } catch (e) { errors.push({ path: fullPath, error: e.message }); }
  }

  if (args.keep_original !== false) {
    const bakPath = (dstBase ? dstBase.replace(/\/$/, '') + '/' : '') + file + '.bak';
    try { await writeGHFile(env, owner, dstRepo, bakPath, content, dstBranch, message + ' [backup]'); written.push({ path: bakPath, action: 'backup' }); } catch { /* non-fatal */ }
  }

  return {
    ok: errors.length === 0, worker: workerName, version: workerVersion,
    source: owner + '/' + repo + ':' + file + '@' + branch,
    dst: owner + '/' + dstRepo + '@' + dstBranch,
    functions_found: functions.length, files_written: written.length, files_errored: errors.length,
    written, errors,
    next_step: errors.length === 0
      ? 'Update wrangler.toml main = "src/index.js" then push .deploy-touch to redeploy.'
      : 'Some files failed — check errors.',
  };
}

async function toolVerifyDebundle(args, env) {
  const owner  = args.owner  || env.DEFAULT_OWNER || 'nothinginfinity';
  const repo   = args.repo;
  const branch = args.branch || 'main';
  const base   = args.base   || '';
  if (!repo) throw new Error('repo is required');
  const results = [];
  for (const [relPath, exports] of Object.entries(FILE_EXPORTS)) {
    const fullPath = base ? base.replace(/\/$/, '') + '/' + relPath : relPath;
    try {
      const { content } = await readGHFile(env, owner, repo, fullPath, branch);
      const missing = exports.filter(function(name) { return !content.includes(name); });
      results.push({ file: fullPath, exists: true, size: content.length, missing_exports: missing, ok: missing.length === 0 });
    } catch (e) { results.push({ file: fullPath, exists: false, ok: false, error: e.message }); }
  }
  const allOk = results.every(function(r) { return r.ok; });
  return { ok: allOk, repo: owner + '/' + repo + '@' + branch, files_checked: results.length, files_ok: results.filter(function(r) { return r.ok; }).length, files_missing: results.filter(function(r) { return !r.exists; }).length, results, note: allOk ? 'All files present. Safe to deploy.' : 'Some files missing or exports not found.' };
}

function debundlerStatus(env) {
  return { worker: NAME, version: VERSION, status: 'ok', bindings: { GITHUB_TOKEN: Boolean(env.GITHUB_TOKEN), DEFAULT_OWNER: Boolean(env.DEFAULT_OWNER) }, default_owner: env.DEFAULT_OWNER || null, tools: TOOLS.map(function(t) { return t.name; }) };
}

const TOOLS = [
  { name: 'debundler_status', description: 'Health check.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'analyze_worker',   description: 'Dry-run analysis of a single-file worker — shows proposed split without writing anything.', inputSchema: { type: 'object', properties: { repo: { type: 'string' }, file: { type: 'string' }, owner: { type: 'string' }, branch: { type: 'string' } }, required: ['repo'] } },
  { name: 'debundle_worker',  description: 'Split a single-file CF Worker into modular src/ files and commit to GitHub. Backs up original as worker.js.bak. Update wrangler.toml main to src/index.js after.', inputSchema: { type: 'object', properties: { repo: { type: 'string' }, file: { type: 'string' }, owner: { type: 'string' }, branch: { type: 'string' }, dst_repo: { type: 'string' }, dst_branch: { type: 'string' }, dst_base: { type: 'string', description: 'Base path in dst repo e.g. workers/watersedge-demo' }, keep_original: { type: 'boolean' }, commit_message: { type: 'string' } }, required: ['repo'] } },
  { name: 'verify_debundle',  description: 'Verify all expected files exist and exports are present after debundling.', inputSchema: { type: 'object', properties: { repo: { type: 'string' }, owner: { type: 'string' }, branch: { type: 'string' }, base: { type: 'string' } }, required: ['repo'] } },
];

async function dispatch(name, args, env) {
  switch (name) {
    case 'debundler_status': return debundlerStatus(env);
    case 'analyze_worker':   return toolAnalyzeWorker(args, env);
    case 'debundle_worker':  return toolDebundleWorker(args, env);
    case 'verify_debundle':  return toolVerifyDebundle(args, env);
    default: throw new Error('Unknown tool: ' + name);
  }
}

async function handleMCP(req, env) {
  let body;
  try { body = await req.json(); } catch { return er(null, 'Invalid JSON'); }
  const id = body.id ?? null, method = body.method, params = body.params || {};
  try {
    if (method === 'initialize')                return ok(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: NAME, version: VERSION } });
    if (method === 'notifications/initialized') return new Response(null, { status: 204, headers: CORS });
    if (method === 'tools/list')                return ok(id, { tools: TOOLS });
    if (method === 'tools/call')                return txt(id, await dispatch(params.name, params.arguments || {}, env));
    return er(id, 'Method not found: ' + method);
  } catch (e) { return er(id, e); }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS')                         return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health')                       return R(debundlerStatus(env));
    if (url.pathname === '/mcp' && req.method === 'POST') return handleMCP(req, env);
    return new Response(NAME + ' v' + VERSION + ' — POST /mcp', { status: 404, headers: CORS });
  },
};
