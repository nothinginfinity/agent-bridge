// ============================================================
// afo-github-clone-mcp
// Clones files from one GitHub repo/path to another,
// with optional string replacements — server-side, no size limits.
//
// Required bindings:
//   GITHUB_TOKEN   (secret) — GitHub PAT with repo read+write
//   DEFAULT_OWNER  (text)   — default GitHub org/user
//
// Deploy: wrangler deploy
// URL:    https://afo-github-clone-mcp.<your-subdomain>.workers.dev/mcp
// ============================================================

const NAME    = 'afo-github-clone-mcp';
const VERSION = '1.0.0';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// ── JSON-RPC helpers ──────────────────────────────────────────────────────────
const R   = (x, s = 200) => Response.json(x, { status: s, headers: { ...CORS, 'cache-control': 'no-store' } });
const ok  = (id, x)      => R({ jsonrpc: '2.0', id, result: x });
const txt = (id, x)      => R({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(x, null, 2) }] } });
const er  = (id, e)      => R({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e?.message || e) } });

// ── GitHub API helpers ────────────────────────────────────────────────────────
function b64encode(s) {
  const bytes = new TextEncoder().encode(String(s ?? ''));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function b64decode(s) {
  return decodeURIComponent(escape(atob((s || '').replace(/\n/g, ''))));
}

function encodePath(p) {
  return p.split('/').map(encodeURIComponent).join('/');
}

function requireEnv(env, key) {
  if (!env[key]) throw new Error(`${key} binding is missing — add it as a Worker secret`);
  return env[key];
}

async function gh(env, method, path, body) {
  const token = requireEnv(env, 'GITHUB_TOKEN');
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization:          `Bearer ${token}`,
      Accept:                 'application/vnd.github+json',
      'Content-Type':         'application/json',
      'User-Agent':           NAME,
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) throw new Error(json.message || text || `GitHub HTTP ${res.status}`);
  return json;
}

async function getFileSHA(env, owner, repo, path, branch) {
  try {
    const ref = branch ? `?ref=${encodeURIComponent(branch)}` : '';
    const r = await gh(env, 'GET', `/repos/${owner}/${repo}/contents/${encodePath(path)}${ref}`);
    return r.sha || null;
  } catch {
    return null;
  }
}

async function readFile(env, owner, repo, path, branch) {
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : '';
  const r = await gh(env, 'GET', `/repos/${owner}/${repo}/contents/${encodePath(path)}${ref}`);
  if (r.type !== 'file') throw new Error(`${path} is not a file (type: ${r.type})`);
  return { content: b64decode(r.content), sha: r.sha };
}

async function listTree(env, owner, repo, treePath, branch) {
  const branchData = await gh(env, 'GET', `/repos/${owner}/${repo}/branches/${encodeURIComponent(branch || 'main')}`);
  const treeSHA    = branchData.commit.commit.tree.sha;
  const tree       = await gh(env, 'GET', `/repos/${owner}/${repo}/git/trees/${treeSHA}?recursive=1`);
  const prefix     = treePath ? treePath.replace(/\/$/, '') + '/' : '';
  return tree.tree
    .filter(item => item.type === 'blob' && item.path.startsWith(prefix))
    .map(item => item.path);
}

async function writeFile(env, owner, repo, path, content, branch, message) {
  const sha  = await getFileSHA(env, owner, repo, path, branch);
  const body = {
    message: message || `clone: write ${path}`,
    content: b64encode(content),
    branch:  branch || 'main',
  };
  if (sha) body.sha = sha;
  const r = await gh(env, 'PUT', `/repos/${owner}/${repo}/contents/${encodePath(path)}`, body);
  return {
    path,
    sha:        r.content?.sha,
    commit_sha: r.commit?.sha,
    commit_url: r.commit?.html_url,
    action:     sha ? 'updated' : 'created',
  };
}

function applyReplacements(content, replacements) {
  if (!Array.isArray(replacements) || !replacements.length) return content;
  let out = content;
  for (const { from, to } of replacements) {
    if (!from) continue;
    out = out.split(from).join(to ?? '');
  }
  return out;
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function cloneRepoPath(args, env) {
  const defaultOwner = env.DEFAULT_OWNER || 'nothinginfinity';

  const srcOwner  = args.src_owner  || defaultOwner;
  const srcRepo   = args.src_repo;
  const srcPath   = args.src_path   || '';
  const srcBranch = args.src_branch || 'main';

  const dstOwner  = args.dst_owner  || srcOwner;
  const dstRepo   = args.dst_repo   || srcRepo;
  const dstPath   = args.dst_path   || srcPath;
  const dstBranch = args.dst_branch || 'main';

  const replacements  = args.replacements  || [];
  const excludeGlobs  = args.exclude_files || [];
  const commitMessage = args.commit_message || `clone: ${srcRepo}/${srcPath} → ${dstRepo}/${dstPath}`;

  if (!srcRepo) throw new Error('src_repo is required');
  if (!dstRepo) throw new Error('dst_repo is required');

  const allPaths = await listTree(env, srcOwner, srcRepo, srcPath, srcBranch);
  if (!allPaths.length) throw new Error(`No files found at ${srcOwner}/${srcRepo}:${srcPath}`);

  const toClone = allPaths.filter(p => {
    const filename = p.split('/').pop();
    return !excludeGlobs.includes(filename) && !excludeGlobs.includes(p);
  });

  const results = [];
  const errors  = [];

  for (const srcFilePath of toClone) {
    try {
      const { content } = await readFile(env, srcOwner, srcRepo, srcFilePath, srcBranch);
      const relativePath = srcFilePath.slice(srcPath.replace(/\/$/, '').length).replace(/^\//, '');
      const dstFilePath  = dstPath
        ? `${dstPath.replace(/\/$/, '')}/${relativePath}`
        : relativePath;
      const newContent   = applyReplacements(content, replacements);
      const finalDstPath = applyReplacements(dstFilePath, replacements);
      const writeResult  = await writeFile(env, dstOwner, dstRepo, finalDstPath, newContent, dstBranch, commitMessage);
      results.push({ src: srcFilePath, dst: finalDstPath, action: writeResult.action, sha: writeResult.sha, commit: writeResult.commit_sha });
    } catch (e) {
      errors.push({ path: srcFilePath, error: e.message });
    }
  }

  return {
    ok: errors.length === 0,
    src: `${srcOwner}/${srcRepo}:${srcPath}@${srcBranch}`,
    dst: `${dstOwner}/${dstRepo}:${dstPath}@${dstBranch}`,
    replacements: replacements.length,
    files_found: toClone.length,
    files_cloned: results.length,
    files_errored: errors.length,
    results,
    errors,
    commit_message: commitMessage,
  };
}

async function cloneSingleFile(args, env) {
  const defaultOwner = env.DEFAULT_OWNER || 'nothinginfinity';

  const srcOwner  = args.src_owner  || defaultOwner;
  const srcRepo   = args.src_repo;
  const srcFile   = args.src_file;
  const srcBranch = args.src_branch || 'main';

  const dstOwner  = args.dst_owner  || srcOwner;
  const dstRepo   = args.dst_repo   || srcRepo;
  const dstFile   = args.dst_file   || applyReplacements(srcFile, args.replacements || []);
  const dstBranch = args.dst_branch || 'main';

  if (!srcRepo) throw new Error('src_repo is required');
  if (!srcFile) throw new Error('src_file is required');

  const { content } = await readFile(env, srcOwner, srcRepo, srcFile, srcBranch);
  const newContent  = applyReplacements(content, args.replacements || []);
  const message     = args.commit_message || `clone: ${srcFile} → ${dstFile}`;
  const result      = await writeFile(env, dstOwner, dstRepo, dstFile, newContent, dstBranch, message);

  return {
    ok:           true,
    src:          `${srcOwner}/${srcRepo}:${srcFile}@${srcBranch}`,
    dst:          `${dstOwner}/${dstRepo}:${dstFile}@${dstBranch}`,
    action:       result.action,
    sha:          result.sha,
    commit_sha:   result.commit_sha,
    commit_url:   result.commit_url,
    replacements: (args.replacements || []).length,
    src_bytes:    new TextEncoder().encode(content).length,
    dst_bytes:    new TextEncoder().encode(newContent).length,
  };
}

async function previewReplacements(args, env) {
  const owner  = args.owner  || env.DEFAULT_OWNER || 'nothinginfinity';
  const repo   = args.repo;
  const file   = args.file;
  const branch = args.branch || 'main';

  if (!repo) throw new Error('repo is required');
  if (!file) throw new Error('file is required');

  const { content } = await readFile(env, owner, repo, file, branch);
  const replacements = args.replacements || [];

  const hits = replacements.map(({ from, to }) => ({
    from,
    to,
    count: content.split(from).length - 1,
    sample: (() => {
      const idx = content.indexOf(from);
      if (idx === -1) return null;
      return content.slice(Math.max(0, idx - 40), idx + (from?.length || 0) + 40);
    })(),
  }));

  const newContent  = applyReplacements(content, replacements);
  const totalHits   = hits.reduce((s, h) => s + h.count, 0);

  return {
    ok:           true,
    file:         `${owner}/${repo}:${file}@${branch}`,
    src_bytes:    new TextEncoder().encode(content).length,
    dst_bytes:    new TextEncoder().encode(newContent).length,
    total_hits:   totalHits,
    replacements: hits,
    note:         'This is a dry run — no files were written.',
  };
}

function cloneStatus(env) {
  return {
    worker:  NAME,
    version: VERSION,
    status:  'ok',
    bindings: {
      GITHUB_TOKEN:  Boolean(env.GITHUB_TOKEN),
      DEFAULT_OWNER: Boolean(env.DEFAULT_OWNER),
    },
    default_owner: env.DEFAULT_OWNER || null,
    tools: TOOLS.map(t => t.name),
  };
}

// ── Tool definitions (MCP schema) ─────────────────────────────────────────────
const REPLACEMENTS_SCHEMA = {
  type: 'array',
  description: 'String replacements to apply to every file\'s content (and destination path). Applied in order.',
  items: {
    type: 'object',
    properties: {
      from: { type: 'string', description: 'Exact string to find' },
      to:   { type: 'string', description: 'Replacement string' },
    },
    required: ['from', 'to'],
  },
};

const TOOLS = [
  {
    name: 'clone_status',
    description: 'Health check — confirms GITHUB_TOKEN is bound and lists available tools.',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'clone_repo_path',
    description: 'Clone all files from a source repo directory into a destination repo directory. Reads every file server-side (no size limits), applies string replacements to both file contents and destination paths, then commits each file to the target repo. Triggers any GitHub Actions wired to the target repo on push. Use this to fork/clone a whole worker directory (e.g. v004 → v005).',
    inputSchema: {
      type: 'object',
      properties: {
        src_repo:       { type: 'string', description: 'Source repo name (e.g. contractor-v004-demo)' },
        src_path:       { type: 'string', description: 'Source directory path (e.g. workers/contractor-v004-demo)' },
        src_owner:      { type: 'string', description: 'Source GitHub owner. Defaults to DEFAULT_OWNER binding.' },
        src_branch:     { type: 'string', description: 'Source branch. Default: main' },
        dst_repo:       { type: 'string', description: 'Destination repo name. Defaults to src_repo.' },
        dst_path:       { type: 'string', description: 'Destination directory path. Defaults to src_path.' },
        dst_owner:      { type: 'string', description: 'Destination GitHub owner. Defaults to src_owner.' },
        dst_branch:     { type: 'string', description: 'Destination branch. Default: main' },
        replacements:   REPLACEMENTS_SCHEMA,
        exclude_files:  { type: 'array', items: { type: 'string' }, description: 'Filenames to skip (e.g. [".deploy-touch", "seed.sql"])' },
        commit_message: { type: 'string', description: 'Git commit message for all writes.' },
      },
      required: ['src_repo'],
    },
  },
  {
    name: 'clone_single_file',
    description: 'Clone one specific file from src to dst with optional string replacements. Handles arbitrarily large files — reads and writes server-side via GitHub API. dst_file defaults to src_file with replacements applied to the path.',
    inputSchema: {
      type: 'object',
      properties: {
        src_repo:       { type: 'string', description: 'Source repo name' },
        src_file:       { type: 'string', description: 'Full source file path (e.g. workers/contractor-v004-demo/contractor-v004-demo.js)' },
        src_owner:      { type: 'string', description: 'Source GitHub owner' },
        src_branch:     { type: 'string', description: 'Source branch. Default: main' },
        dst_repo:       { type: 'string', description: 'Destination repo name' },
        dst_file:       { type: 'string', description: 'Destination file path. Defaults to src_file with replacements applied.' },
        dst_owner:      { type: 'string', description: 'Destination GitHub owner' },
        dst_branch:     { type: 'string', description: 'Destination branch. Default: main' },
        replacements:   REPLACEMENTS_SCHEMA,
        commit_message: { type: 'string', description: 'Git commit message' },
      },
      required: ['src_repo', 'src_file'],
    },
  },
  {
    name: 'preview_replacements',
    description: 'Dry-run a set of replacements against a file without writing anything. Shows hit counts and context samples for each replacement. Use this to verify your replacement list before running clone_single_file or clone_repo_path.',
    inputSchema: {
      type: 'object',
      properties: {
        repo:         { type: 'string', description: 'Repo name' },
        file:         { type: 'string', description: 'File path in the repo' },
        owner:        { type: 'string', description: 'GitHub owner' },
        branch:       { type: 'string', description: 'Branch. Default: main' },
        replacements: REPLACEMENTS_SCHEMA,
      },
      required: ['repo', 'file'],
    },
  },
];

// ── Dispatcher ────────────────────────────────────────────────────────────────
async function dispatch(name, args, env) {
  switch (name) {
    case 'clone_status':         return cloneStatus(env);
    case 'clone_repo_path':      return cloneRepoPath(args, env);
    case 'clone_single_file':    return cloneSingleFile(args, env);
    case 'preview_replacements': return previewReplacements(args, env);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// ── MCP request handler ───────────────────────────────────────────────────────
async function handleMCP(req, env) {
  let body;
  try { body = await req.json(); } catch (e) { return er(null, 'Invalid JSON'); }

  const { id = null, method, params = {} } = body;

  try {
    if (method === 'initialize') {
      return ok(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: NAME, version: VERSION },
      });
    }
    if (method === 'notifications/initialized') return new Response(null, { status: 204, headers: CORS });
    if (method === 'tools/list') return ok(id, { tools: TOOLS });
    if (method === 'tools/call') return txt(id, await dispatch(params.name, params.arguments || {}, env));
    return er(id, `Method not found: ${method}`);
  } catch (e) {
    return er(id, e);
  }
}

// ── Worker entry point ────────────────────────────────────────────────────────
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health') return R(cloneStatus(env));
    if (url.pathname === '/mcp' && req.method === 'POST') return handleMCP(req, env);
    return new Response(`${NAME} v${VERSION} — POST /mcp`, { status: 404, headers: CORS });
  },
};
