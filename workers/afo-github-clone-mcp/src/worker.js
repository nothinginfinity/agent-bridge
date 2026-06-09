// ============================================================
// afo-github-clone-mcp  v1.2.0
// v1.2.0: adds name_only_files — files where replacements apply
//         only to lines starting with `name =` (e.g. wrangler.toml),
//         leaving binding values, index names, db names untouched.
//
// Required bindings:
//   GITHUB_TOKEN   (secret) — GitHub PAT with repo read+write
//   DEFAULT_OWNER  (text)   — default GitHub org/user
// ============================================================

const NAME    = 'afo-github-clone-mcp';
const VERSION = '1.2.0';

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

// ── Repo helpers ──────────────────────────────────────────────────────────────

async function repoExists(env, owner, repo) {
  try {
    await gh(env, 'GET', `/repos/${owner}/${repo}`);
    return true;
  } catch (e) {
    if (e.message && (e.message.includes('404') || e.message.toLowerCase().includes('not found'))) return false;
    throw e;
  }
}

async function createRepo(env, owner, repo, opts = {}) {
  const body = {
    name:         repo,
    description:  opts.description || '',
    private:      opts.private !== false,
    auto_init:    false,
    has_issues:   true,
    has_projects: false,
    has_wiki:     false,
  };
  let result;
  try {
    result = await gh(env, 'POST', `/orgs/${owner}/repos`, body);
  } catch {
    result = await gh(env, 'POST', `/user/repos`, body);
  }
  return {
    created:        true,
    repo:           result.name,
    owner:          result.owner?.login,
    full_name:      result.full_name,
    private:        result.private,
    html_url:       result.html_url,
    default_branch: result.default_branch || 'main',
  };
}

// ── File helpers ──────────────────────────────────────────────────────────────

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

// ── Replacement helpers ───────────────────────────────────────────────────────

// Full replacement: apply to entire content
function applyReplacements(content, replacements) {
  if (!Array.isArray(replacements) || !replacements.length) return content;
  let out = content;
  for (const { from, to } of replacements) {
    if (!from) continue;
    out = out.split(from).join(to ?? '');
  }
  return out;
}

// Name-only replacement: only replace on lines that start with `name =`
// Leaves database_name, index_name, bucket_name, binding values etc. untouched.
function applyNameOnlyReplacements(content, replacements) {
  if (!Array.isArray(replacements) || !replacements.length) return content;
  return content.split('\n').map(line => {
    // Only touch lines like: name = "contractor-v005-dev"
    if (/^\s*name\s*=/.test(line)) {
      return applyReplacements(line, replacements);
    }
    return line;
  }).join('\n');
}

// ── Tool implementations ──────────────────────────────────────────────────────

async function toolCreateRepo(args, env) {
  const owner = args.owner || env.DEFAULT_OWNER || 'nothinginfinity';
  if (!args.repo) throw new Error('repo is required');
  const exists = await repoExists(env, owner, args.repo);
  if (exists) {
    return { created: false, repo: args.repo, owner, note: 'Repo already exists — no action taken.', html_url: `https://github.com/${owner}/${args.repo}` };
  }
  return createRepo(env, owner, args.repo, { description: args.description || '', private: args.private !== false });
}

async function cloneRepoPath(args, env) {
  const defaultOwner  = env.DEFAULT_OWNER || 'nothinginfinity';
  const srcOwner      = args.src_owner  || defaultOwner;
  const srcRepo       = args.src_repo;
  const srcPath       = args.src_path   || '';
  const srcBranch     = args.src_branch || 'main';
  const dstOwner      = args.dst_owner  || srcOwner;
  const dstRepo       = args.dst_repo;
  const dstPath       = args.dst_path   || srcPath;
  const dstBranch     = args.dst_branch || 'main';
  const replacements  = args.replacements   || [];
  const excludeGlobs  = args.exclude_files  || [];
  // Files where replacements only apply to `name =` lines. wrangler.toml always included.
  const nameOnlyFiles = ['wrangler.toml', ...(args.name_only_files || [])];
  const commitMessage = args.commit_message || `clone: ${srcRepo}/${srcPath} → ${dstRepo}/${dstPath}`;
  const autoCreate    = args.auto_create_repo !== false;

  if (!srcRepo) throw new Error('src_repo is required');
  if (!dstRepo) throw new Error('dst_repo is required');

  let repoCreated = false;
  const exists = await repoExists(env, dstOwner, dstRepo);
  if (!exists) {
    if (!autoCreate) throw new Error(`Destination repo ${dstOwner}/${dstRepo} does not exist. Set auto_create_repo: true to create it.`);
    await createRepo(env, dstOwner, dstRepo, { description: `Clone of ${srcOwner}/${srcRepo}`, private: true });
    repoCreated = true;
  }

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
      const { content }  = await readFile(env, srcOwner, srcRepo, srcFilePath, srcBranch);
      const relativePath = srcFilePath.slice(srcPath.replace(/\/$/, '').length).replace(/^\//, '');
      const dstFilePath  = dstPath ? `${dstPath.replace(/\/$/, '')}/${relativePath}` : relativePath;
      const finalDstPath = applyReplacements(dstFilePath, replacements);

      // For name_only_files, only replace on `name =` lines; otherwise full replacement
      const filename   = srcFilePath.split('/').pop();
      const nameOnly   = nameOnlyFiles.includes(filename);
      const newContent = nameOnly
        ? applyNameOnlyReplacements(content, replacements)
        : applyReplacements(content, replacements);

      const writeResult = await writeFile(env, dstOwner, dstRepo, finalDstPath, newContent, dstBranch, commitMessage);
      results.push({
        src:       srcFilePath,
        dst:       finalDstPath,
        mode:      nameOnly ? 'name_only' : 'full',
        action:    writeResult.action,
        sha:       writeResult.sha,
        commit:    writeResult.commit_sha,
      });
    } catch (e) {
      errors.push({ path: srcFilePath, error: e.message });
    }
  }

  return {
    ok:             errors.length === 0,
    repo_created:   repoCreated,
    src:            `${srcOwner}/${srcRepo}:${srcPath}@${srcBranch}`,
    dst:            `${dstOwner}/${dstRepo}:${dstPath}@${dstBranch}`,
    dst_url:        `https://github.com/${dstOwner}/${dstRepo}`,
    replacements:   replacements.length,
    name_only_files: nameOnlyFiles,
    files_found:    toClone.length,
    files_cloned:   results.length,
    files_errored:  errors.length,
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
    ok: true,
    src: `${srcOwner}/${srcRepo}:${srcFile}@${srcBranch}`,
    dst: `${dstOwner}/${dstRepo}:${dstFile}@${dstBranch}`,
    action: result.action, sha: result.sha, commit_sha: result.commit_sha, commit_url: result.commit_url,
    replacements: (args.replacements || []).length,
    src_bytes: new TextEncoder().encode(content).length,
    dst_bytes: new TextEncoder().encode(newContent).length,
  };
}

async function previewReplacements(args, env) {
  const owner  = args.owner  || env.DEFAULT_OWNER || 'nothinginfinity';
  if (!args.repo) throw new Error('repo is required');
  if (!args.file) throw new Error('file is required');
  const { content }  = await readFile(env, owner, args.repo, args.file, args.branch || 'main');
  const replacements = args.replacements || [];
  const hits = replacements.map(({ from, to }) => ({
    from, to,
    count:  content.split(from).length - 1,
    sample: (() => { const idx = content.indexOf(from); if (idx === -1) return null; return content.slice(Math.max(0, idx - 40), idx + (from?.length || 0) + 40); })(),
  }));
  const newContent = applyReplacements(content, replacements);
  return {
    ok: true,
    file: `${owner}/${args.repo}:${args.file}@${args.branch || 'main'}`,
    src_bytes: new TextEncoder().encode(content).length,
    dst_bytes: new TextEncoder().encode(newContent).length,
    total_hits: hits.reduce((s, h) => s + h.count, 0),
    replacements: hits,
    note: 'This is a dry run — no files were written.',
  };
}

function cloneStatus(env) {
  return {
    worker: NAME, version: VERSION, status: 'ok',
    bindings: { GITHUB_TOKEN: Boolean(env.GITHUB_TOKEN), DEFAULT_OWNER: Boolean(env.DEFAULT_OWNER) },
    default_owner: env.DEFAULT_OWNER || null,
    tools: TOOLS.map(t => t.name),
  };
}

const REPLACEMENTS_SCHEMA = {
  type: 'array',
  description: 'String replacements applied in order to file contents and destination paths.',
  items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] },
};

const TOOLS = [
  { name: 'clone_status', description: 'Health check — confirms GITHUB_TOKEN is bound and lists available tools.', inputSchema: { type: 'object', properties: {}, required: [] } },
  {
    name: 'create_repo',
    description: 'Create a new GitHub repository. Idempotent — if repo already exists, returns its info without error.',
    inputSchema: { type: 'object', properties: { repo: { type: 'string' }, owner: { type: 'string' }, description: { type: 'string' }, private: { type: 'boolean' } }, required: ['repo'] },
  },
  {
    name: 'clone_repo_path',
    description: 'Clone all files from a source repo directory into a destination repo. Auto-creates dst_repo if needed. wrangler.toml is always treated as name_only (replacements apply only to `name =` lines, leaving binding values untouched). No file size limits.',
    inputSchema: {
      type: 'object',
      properties: {
        src_repo: { type: 'string' }, src_path: { type: 'string' }, src_owner: { type: 'string' }, src_branch: { type: 'string' },
        dst_repo: { type: 'string' }, dst_path: { type: 'string' }, dst_owner: { type: 'string' }, dst_branch: { type: 'string' },
        replacements:     REPLACEMENTS_SCHEMA,
        exclude_files:    { type: 'array', items: { type: 'string' }, description: 'Filenames to skip entirely.' },
        name_only_files:  { type: 'array', items: { type: 'string' }, description: 'Extra filenames where replacements apply only to `name =` lines. wrangler.toml is always included.' },
        commit_message:   { type: 'string' },
        auto_create_repo: { type: 'boolean', description: 'Create dst_repo if it does not exist. Default: true.' },
      },
      required: ['src_repo', 'dst_repo'],
    },
  },
  {
    name: 'clone_single_file',
    description: 'Clone one file from src to dst with optional replacements. Handles any file size.',
    inputSchema: {
      type: 'object',
      properties: {
        src_repo: { type: 'string' }, src_file: { type: 'string' }, src_owner: { type: 'string' }, src_branch: { type: 'string' },
        dst_repo: { type: 'string' }, dst_file: { type: 'string' }, dst_owner: { type: 'string' }, dst_branch: { type: 'string' },
        replacements: REPLACEMENTS_SCHEMA, commit_message: { type: 'string' },
      },
      required: ['src_repo', 'src_file'],
    },
  },
  {
    name: 'preview_replacements',
    description: 'Dry-run replacements against a file — shows hit counts and context. Run before clone_repo_path to verify.',
    inputSchema: { type: 'object', properties: { repo: { type: 'string' }, file: { type: 'string' }, owner: { type: 'string' }, branch: { type: 'string' }, replacements: REPLACEMENTS_SCHEMA }, required: ['repo', 'file'] },
  },
];

async function dispatch(name, args, env) {
  switch (name) {
    case 'clone_status':         return cloneStatus(env);
    case 'create_repo':          return toolCreateRepo(args, env);
    case 'clone_repo_path':      return cloneRepoPath(args, env);
    case 'clone_single_file':    return cloneSingleFile(args, env);
    case 'preview_replacements': return previewReplacements(args, env);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

async function handleMCP(req, env) {
  let body;
  try { body = await req.json(); } catch { return er(null, 'Invalid JSON'); }
  const { id = null, method, params = {} } = body;
  try {
    if (method === 'initialize')                return ok(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: NAME, version: VERSION } });
    if (method === 'notifications/initialized') return new Response(null, { status: 204, headers: CORS });
    if (method === 'tools/list')                return ok(id, { tools: TOOLS });
    if (method === 'tools/call')                return txt(id, await dispatch(params.name, params.arguments || {}, env));
    return er(id, `Method not found: ${method}`);
  } catch (e) { return er(id, e); }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS')                         return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === '/health')                       return R(cloneStatus(env));
    if (url.pathname === '/mcp' && req.method === 'POST') return handleMCP(req, env);
    return new Response(`${NAME} v${VERSION} — POST /mcp`, { status: 404, headers: CORS });
  },
};
