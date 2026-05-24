// vector-lab-mcp v0.1.0
// Cloudflare Vectorize + Workers AI + D1 semantic database workbench.
// Required bindings for core tools: AI, VECTORIZE. Optional: DB, DEFAULT_VECTORIZE_INDEX.
// Dynamic account-level index creation is exposed as a guarded not-yet-enabled tool until API token/binding policy is finalized.

const VERSION = '0.1.0';
const DEFAULT_MODEL = '@cf/baai/bge-base-en-v1.5';
const MAX_TOP_K = 50;
const MAX_TEXT_CHARS = 200000;
const MAX_CHUNKS = 500;
const MAX_DOCS = 100;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id'
};

const TOOLS = [
  { name: 'vectorize_list_indexes', description: 'Return configured/default Vectorize index info for this Worker deployment.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'vectorize_describe_index', description: 'Describe the bound Vectorize index.', inputSchema: { type: 'object', properties: { index: { type: 'string' } }, required: [] } },
  { name: 'vectorize_create_index', description: 'Planned account-level Vectorize index creation. Returns required config and guardrail guidance in v0.1.0.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, dimensions: { type: 'number', default: 768 }, metric: { type: 'string', default: 'cosine' }, description: { type: 'string' } }, required: ['name'] } },
  { name: 'embedding_generate', description: 'Generate Workers AI embeddings. Full vectors are hidden unless return_vectors=true.', inputSchema: { type: 'object', properties: { texts: { type: 'array', items: { type: 'string' } }, model: { type: 'string', default: DEFAULT_MODEL }, return_vectors: { type: 'boolean', default: false } }, required: ['texts'] } },
  { name: 'chunk_text', description: 'Deterministically chunk text for embedding.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, max_chars: { type: 'number', default: 1200 }, overlap: { type: 'number', default: 150 }, prefix: { type: 'string', default: 'chunk' } }, required: ['text'] } },
  { name: 'vectorize_upsert_documents', description: 'Chunk, embed, and upsert documents into the bound Vectorize index.', inputSchema: { type: 'object', properties: { index: { type: 'string' }, documents: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, text: { type: 'string' }, metadata: { type: 'object' } }, required: ['id', 'text'] } }, model: { type: 'string', default: DEFAULT_MODEL }, chunking: { type: 'object', properties: { max_chars: { type: 'number' }, overlap: { type: 'number' } } } }, required: ['documents'] } },
  { name: 'vectorize_query', description: 'Semantic query against the bound Vectorize index.', inputSchema: { type: 'object', properties: { index: { type: 'string' }, query: { type: 'string' }, top_k: { type: 'number', default: 8 }, filter: { type: 'object' }, include_values: { type: 'boolean', default: false } }, required: ['query'] } },
  { name: 'vectorize_eval_queries', description: 'Evaluate retrieval quality against expected IDs.', inputSchema: { type: 'object', properties: { index: { type: 'string' }, tests: { type: 'array', items: { type: 'object', properties: { query: { type: 'string' }, expected_ids: { type: 'array', items: { type: 'string' } }, top_k: { type: 'number', default: 5 } }, required: ['query', 'expected_ids'] } } }, required: ['tests'] } },
  { name: 'vectorize_reindex_from_d1', description: 'Read rows from bound D1 DB, compose text, embed, and upsert to Vectorize.', inputSchema: { type: 'object', properties: { table: { type: 'string' }, id_column: { type: 'string' }, text_columns: { type: 'array', items: { type: 'string' } }, metadata_columns: { type: 'array', items: { type: 'string' } }, where: { type: 'string' }, limit: { type: 'number', default: 1000 }, index: { type: 'string' } }, required: ['table', 'id_column', 'text_columns'] } },
  { name: 'hybrid_search_d1_vectorize', description: 'Run vector search then join IDs back to rows in bound D1 DB.', inputSchema: { type: 'object', properties: { query: { type: 'string' }, table: { type: 'string' }, id_column: { type: 'string' }, select_columns: { type: 'array', items: { type: 'string' } }, top_k: { type: 'number', default: 10 }, index: { type: 'string' } }, required: ['query', 'table', 'id_column'] } }
];

function rpc(id, result) { return Response.json({ jsonrpc: '2.0', id, result }, { headers: CORS }); }
function rpcErr(id, code, message) { return Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { headers: CORS }); }
function toolResult(id, result) { return rpc(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }); }
function clamp(n, min, max) { return Math.min(Math.max(Number(n) || min, min), max); }
function req(env, name) { if (!env[name]) throw new Error(`${name} not configured`); return env[name]; }
function ident(x) { if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(String(x || ''))) throw new Error(`Invalid identifier: ${x}`); return x; }
function activeIndex(args, env) { return args.index || env.DEFAULT_VECTORIZE_INDEX || 'bound-vectorize-index'; }

async function embed(env, texts, model = DEFAULT_MODEL) {
  req(env, 'AI');
  const clean = texts.map(t => String(t || '').slice(0, 4096));
  const res = await env.AI.run(model, { text: clean });
  return res.data || [];
}

function chunkText(text, opts = {}) {
  const s = String(text || '');
  if (s.length > MAX_TEXT_CHARS) throw new Error(`text too large; max ${MAX_TEXT_CHARS}`);
  const max = clamp(opts.max_chars || 1200, 300, 8000);
  const overlap = clamp(opts.overlap || 150, 0, Math.floor(max / 2));
  const prefix = opts.prefix || 'chunk';
  const chunks = [];
  let i = 0;
  while (i < s.length) {
    const part = s.slice(i, i + max);
    chunks.push({ id: `${prefix}-${String(chunks.length + 1).padStart(4, '0')}`, text: part, chars: part.length });
    if (chunks.length > MAX_CHUNKS) throw new Error(`too many chunks; max ${MAX_CHUNKS}`);
    if (i + max >= s.length) break;
    i += max - overlap;
  }
  return chunks;
}

async function queryD1(env, sql, params = []) {
  req(env, 'DB');
  const stmt = env.DB.prepare(sql);
  const bound = params.length ? stmt.bind(...params) : stmt;
  const res = await bound.all();
  return res.results || [];
}

function vectorize(env) { return req(env, 'VECTORIZE'); }

async function upsertDocs(args, env) {
  const vx = vectorize(env);
  const docs = args.documents || [];
  if (!Array.isArray(docs) || !docs.length) throw new Error('documents required');
  if (docs.length > MAX_DOCS) throw new Error(`max ${MAX_DOCS} documents`);
  const all = [];
  for (const doc of docs) {
    if (!doc.id || !doc.text) throw new Error('each document requires id and text');
    const chunks = chunkText(doc.text, { ...(args.chunking || {}), prefix: doc.id });
    for (const chunk of chunks) all.push({ doc, chunk });
  }
  if (all.length > MAX_CHUNKS) throw new Error(`max ${MAX_CHUNKS} chunks`);
  let upserted = 0;
  for (let i = 0; i < all.length; i += 20) {
    const batch = all.slice(i, i + 20);
    const vectors = await embed(env, batch.map(x => x.chunk.text), args.model || DEFAULT_MODEL);
    await vx.upsert(batch.map((x, j) => ({
      id: x.chunk.id,
      values: vectors[j],
      metadata: { ...(x.doc.metadata || {}), doc_id: x.doc.id, text: x.chunk.text, chars: x.chunk.chars }
    })));
    upserted += batch.length;
  }
  return { index: activeIndex(args, env), documents: docs.length, chunks: all.length, upserted };
}

async function semanticQuery(args, env) {
  const vx = vectorize(env);
  if (!args.query) throw new Error('query required');
  const [qv] = await embed(env, [args.query], args.model || DEFAULT_MODEL);
  const topK = clamp(args.top_k || 8, 1, MAX_TOP_K);
  const result = await vx.query(qv, { topK, filter: args.filter, returnMetadata: 'all', returnValues: !!args.include_values });
  return { index: activeIndex(args, env), query: args.query, count: result.matches?.length || 0, matches: result.matches || [] };
}

async function handleTool(name, args, env) {
  switch (name) {
    case 'vectorize_list_indexes':
      return { indexes: [{ name: activeIndex({}, env), binding: 'VECTORIZE', mode: 'static-binding' }], total: env.VECTORIZE ? 1 : 0 };
    case 'vectorize_describe_index':
      return { index: activeIndex(args, env), binding: 'VECTORIZE', available: !!env.VECTORIZE, note: 'v0.1.0 uses static Vectorize binding for query/upsert.' };
    case 'vectorize_create_index':
      return { created: false, requested: args, status: 'not_enabled_in_v0.1.0', next_step: 'Create index in Cloudflare, bind it as VECTORIZE, set DEFAULT_VECTORIZE_INDEX, then redeploy.' };
    case 'embedding_generate': {
      const texts = args.texts || [];
      if (!Array.isArray(texts) || !texts.length) throw new Error('texts required');
      if (texts.length > 100) throw new Error('max 100 texts');
      const vectors = await embed(env, texts, args.model || DEFAULT_MODEL);
      return { model: args.model || DEFAULT_MODEL, count: vectors.length, dimensions: vectors[0]?.length || 0, vectors: args.return_vectors ? vectors : undefined };
    }
    case 'chunk_text':
      return { count: chunkText(args.text, args).length, chunks: chunkText(args.text, args) };
    case 'vectorize_upsert_documents':
      return upsertDocs(args, env);
    case 'vectorize_query':
      return semanticQuery(args, env);
    case 'vectorize_eval_queries': {
      const tests = (args.tests || []).slice(0, 50);
      let passed = 0;
      const rows = [];
      for (const t of tests) {
        const res = await semanticQuery({ index: args.index, query: t.query, top_k: t.top_k || 5 }, env);
        const topIds = (res.matches || []).map(m => String(m.id));
        const ok = (t.expected_ids || []).some(id => topIds.includes(String(id)));
        if (ok) passed++;
        rows.push({ query: t.query, passed: ok, expected_ids: t.expected_ids || [], top_ids: topIds, matches: res.matches });
      }
      return { score: tests.length ? passed / tests.length : 0, passed, failed: tests.length - passed, tests: rows };
    }
    case 'vectorize_reindex_from_d1': {
      const table = ident(args.table);
      const idCol = ident(args.id_column);
      const textCols = (args.text_columns || []).map(ident);
      const metaCols = (args.metadata_columns || []).map(ident);
      if (!textCols.length) throw new Error('text_columns required');
      const limit = clamp(args.limit || 1000, 1, 5000);
      const cols = Array.from(new Set([idCol, ...textCols, ...metaCols]));
      const where = args.where ? ` WHERE ${String(args.where).replace(/;/g, '')}` : '';
      if (/\b(insert|update|delete|drop|alter|pragma|attach|detach)\b/i.test(where)) throw new Error('unsafe where clause');
      const sql = `SELECT ${cols.map(c => `"${c}"`).join(', ')} FROM "${table}"${where} LIMIT ${limit}`;
      const rows = await queryD1(env, sql);
      const documents = rows.map(row => ({ id: String(row[idCol]), text: textCols.map(c => `${c}: ${row[c] ?? ''}`).join('\n'), metadata: Object.fromEntries(metaCols.map(c => [c, row[c]])) }));
      const result = await upsertDocs({ index: args.index, documents, chunking: { max_chars: 1800, overlap: 120 } }, env);
      return { ...result, rows_read: rows.length, sql };
    }
    case 'hybrid_search_d1_vectorize': {
      const res = await semanticQuery(args, env);
      const ids = (res.matches || []).map(m => String(m.id).split('-000')[0]);
      if (!ids.length) return { results: [] };
      const table = ident(args.table);
      const idCol = ident(args.id_column);
      const selectCols = (args.select_columns?.length ? args.select_columns : ['*']).map(c => c === '*' ? '*' : ident(c));
      const sql = `SELECT ${selectCols.includes('*') ? '*' : selectCols.map(c => `"${c}"`).join(', ')} FROM "${table}" WHERE "${idCol}" IN (${ids.map(() => '?').join(',')})`;
      const rows = await queryD1(env, sql, ids);
      const byId = Object.fromEntries(rows.map(r => [String(r[idCol]), r]));
      return { results: (res.matches || []).map(m => ({ id: m.id, score: m.score, metadata: m.metadata, row: byId[String(m.id).split('-000')[0]] || null })) };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') return Response.json({ status: 'ok', worker: 'vector-lab-mcp', version: VERSION, tools: TOOLS.length, ai: !!env.AI, vectorize: !!env.VECTORIZE, db: !!env.DB }, { headers: CORS });
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    if (url.pathname !== '/mcp' || request.method !== 'POST') return new Response('not found', { status: 404, headers: CORS });
    let body;
    try { body = await request.json(); } catch { return rpcErr(null, -32700, 'Parse error'); }
    const { id, method, params } = body;
    if (method === 'initialize') return rpc(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'vector-lab-mcp', version: VERSION } });
    if (method === 'notifications/initialized') return new Response(null, { status: 204, headers: CORS });
    if (method === 'ping') return rpc(id, {});
    if (method === 'tools/list') return rpc(id, { tools: TOOLS });
    if (method === 'tools/call') {
      try { return toolResult(id, await handleTool(params?.name, params?.arguments || {}, env)); }
      catch (e) { return rpcErr(id, -32603, `Tool error: ${e.message}`); }
    }
    return rpcErr(id, -32601, `Method not found: ${method}`);
  }
};
