# Vector Lab MCP

**status:** proposed
**owner:** Jared Edwards / AFO Toolsmith
**target worker:** `vector-lab-mcp`
**target route:** `https://vector-lab-mcp.agentfeedoptimization.com/mcp`
**purpose:** Cloudflare Vectorize + Workers AI + D1 semantic database builder for agent workflows.

---

## 1. Product intent

Vector Lab MCP gives the agent team a first-class tool belt for building and operating semantic memory on Cloudflare. It should let ChatGPT design and evaluate vector databases, Claude deploy and operate them, and Alice use them for research/orchestration.

Primary use cases:

1. Create and inspect Cloudflare Vectorize indexes.
2. Generate embeddings using Workers AI.
3. Chunk documents predictably.
4. Upsert text/document chunks into Vectorize.
5. Query Vectorize semantically.
6. Reindex D1 tables into Vectorize.
7. Evaluate retrieval quality against test cases.
8. Run hybrid D1 + Vectorize search.

---

## 2. MCP compatibility pattern

The Worker must follow the current AFO mobile MCP pattern:

- HTTP endpoint: `POST /mcp`
- no SSE required
- JSON-RPC compatible request/response
- supports:
  - `initialize`
  - `notifications/initialized`
  - `ping`
  - `tools/list`
  - `tools/call`

Tool call responses should use:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{...pretty printed JSON...}"
      }
    ]
  }
}
```

Errors should use:

```json
{
  "jsonrpc": "2.0",
  "id": "request-id",
  "error": {
    "code": -32603,
    "message": "Tool error: ..."
  }
}
```

---

## 3. Required bindings and permissions

### Worker bindings

Recommended bindings:

| Binding | Type | Purpose |
|---|---|---|
| `AI` | Workers AI | Embeddings and optional LLM scoring |
| `CF_API_TOKEN` | secret | Cloudflare API operations for Vectorize/D1 metadata |
| `ACCOUNT_ID` | var | Cloudflare account ID |
| `DEFAULT_VECTORIZE_INDEX` | var, optional | default index name |
| `DEFAULT_D1_DATABASE_ID` | var, optional | default D1 database ID |

Optional static bindings for early versions:

| Binding | Type | Purpose |
|---|---|---|
| `DB` | D1 | default AFO Toolsmith DB for D1 reindex tests |
| `VECTORIZE` | Vectorize | default index for query/upsert if dynamic API is unavailable |

### Cloudflare token permissions

Minimum useful token permissions:

- Account → Workers AI → Read/Use as required by Cloudflare
- Account → Vectorize → Read
- Account → Vectorize → Edit for create/upsert/delete
- Account → D1 → Read for schema and query support

For safer split tokens, create:

1. `CF_VECTOR_READ_TOKEN` for read/query/list.
2. `CF_VECTOR_WRITE_TOKEN` for create/upsert/delete/reindex.

---

## 4. Security model

The MCP must separate low-risk read tools from mutating tools.

Read-only tools:

- `vectorize_list_indexes`
- `vectorize_describe_index`
- `embedding_generate`
- `chunk_text`
- `vectorize_query`
- `vectorize_eval_queries`
- `hybrid_search_d1_vectorize`

Mutating tools:

- `vectorize_create_index`
- `vectorize_upsert_documents`
- `vectorize_delete_vectors`
- `vectorize_reindex_from_d1`

Rules:

1. Never return API token values.
2. Clamp chunk size and document count.
3. Clamp `top_k` to 50 maximum.
4. Require explicit index name for writes unless a default is configured.
5. D1 SQL must be SELECT-only for reindex/read joins.
6. `vectorize_delete_vectors` must require exact IDs and no wildcard deletes.
7. All mutating tools return counts, IDs, and warnings.

---

## 5. Tool definitions

### 5.1 `vectorize_list_indexes`

List Vectorize indexes available to the account.

Input schema:

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

Output:

```json
{
  "indexes": [
    {
      "name": "afo-messages",
      "dimensions": 768,
      "metric": "cosine",
      "description": "message board embeddings"
    }
  ],
  "total": 1
}
```

---

### 5.2 `vectorize_create_index`

Create a Vectorize index.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "name": { "type": "string" },
    "dimensions": { "type": "number", "default": 768 },
    "metric": { "type": "string", "enum": ["cosine", "euclidean", "dot-product"], "default": "cosine" },
    "description": { "type": "string" }
  },
  "required": ["name"]
}
```

---

### 5.3 `vectorize_describe_index`

Return index configuration and estimated counts.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "index": { "type": "string" }
  },
  "required": ["index"]
}
```

---

### 5.4 `embedding_generate`

Generate embeddings with Workers AI.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "texts": { "type": "array", "items": { "type": "string" } },
    "model": { "type": "string", "default": "@cf/baai/bge-base-en-v1.5" },
    "return_vectors": { "type": "boolean", "default": false }
  },
  "required": ["texts"]
}
```

Output should include vector dimensions and count. By default, do not return full vectors unless `return_vectors` is true.

---

### 5.5 `chunk_text`

Deterministically chunk text for embedding.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "text": { "type": "string" },
    "max_chars": { "type": "number", "default": 1200 },
    "overlap": { "type": "number", "default": 150 },
    "prefix": { "type": "string", "default": "chunk" }
  },
  "required": ["text"]
}
```

Output:

```json
{
  "chunks": [
    { "id": "chunk-0001", "text": "...", "chars": 1180 }
  ],
  "count": 1
}
```

---

### 5.6 `vectorize_upsert_documents`

Chunk, embed, and upsert documents.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "index": { "type": "string" },
    "documents": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "text": { "type": "string" },
          "metadata": { "type": "object" }
        },
        "required": ["id", "text"]
      }
    },
    "model": { "type": "string", "default": "@cf/baai/bge-base-en-v1.5" },
    "chunking": {
      "type": "object",
      "properties": {
        "max_chars": { "type": "number", "default": 1200 },
        "overlap": { "type": "number", "default": 150 }
      }
    }
  },
  "required": ["index", "documents"]
}
```

Output:

```json
{
  "index": "afo-page-memory",
  "documents": 3,
  "chunks": 12,
  "upserted": 12,
  "failed": 0
}
```

---

### 5.7 `vectorize_query`

Semantic query against a Vectorize index.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "index": { "type": "string" },
    "query": { "type": "string" },
    "top_k": { "type": "number", "default": 8 },
    "filter": { "type": "object" },
    "include_values": { "type": "boolean", "default": false }
  },
  "required": ["index", "query"]
}
```

---

### 5.8 `vectorize_delete_vectors`

Delete explicit vector IDs.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "index": { "type": "string" },
    "ids": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["index", "ids"]
}
```

Validation:

- reject empty IDs
- reject more than 500 IDs per call
- reject wildcard-like IDs such as `*`

---

### 5.9 `vectorize_reindex_from_d1`

Read D1 rows, compose text, embed, and upsert into Vectorize.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "index": { "type": "string" },
    "database_id": { "type": "string" },
    "table": { "type": "string" },
    "id_column": { "type": "string" },
    "text_columns": { "type": "array", "items": { "type": "string" } },
    "metadata_columns": { "type": "array", "items": { "type": "string" } },
    "where": { "type": "string" },
    "limit": { "type": "number", "default": 1000 },
    "model": { "type": "string", "default": "@cf/baai/bge-base-en-v1.5" }
  },
  "required": ["index", "database_id", "table", "id_column", "text_columns"]
}
```

Safety:

- generated SQL must be SELECT-only
- table/column names must match strict identifier regex
- default limit 1000, hard cap 5000

---

### 5.10 `vectorize_eval_queries`

Evaluate retrieval quality.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "index": { "type": "string" },
    "tests": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "query": { "type": "string" },
          "expected_ids": { "type": "array", "items": { "type": "string" } },
          "top_k": { "type": "number", "default": 5 }
        },
        "required": ["query", "expected_ids"]
      }
    }
  },
  "required": ["index", "tests"]
}
```

Output:

```json
{
  "score": 0.92,
  "passed": 11,
  "failed": 1,
  "tests": []
}
```

---

### 5.11 `hybrid_search_d1_vectorize`

Run vector search, then join IDs back to D1 rows.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "index": { "type": "string" },
    "database_id": { "type": "string" },
    "query": { "type": "string" },
    "table": { "type": "string" },
    "id_column": { "type": "string" },
    "top_k": { "type": "number", "default": 10 },
    "select_columns": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["index", "database_id", "query", "table", "id_column"]
}
```

Output:

```json
{
  "results": [
    {
      "id": "tool_02_cloudflare_tools",
      "score": 0.91,
      "row": {
        "name": "Cloudflare Tools MCP",
        "connector_url": "https://cloudflare-tools-mcp.agentfeedoptimization.com/mcp"
      }
    }
  ]
}
```

---

## 6. Worker implementation outline

```js
const TOOLS = [/* definitions above */];

function rpc(id, result) {
  return Response.json({ jsonrpc: '2.0', id, result });
}

function toolResult(id, result) {
  return Response.json({
    jsonrpc: '2.0',
    id,
    result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  });
}

function rpcErr(id, code, message) {
  return Response.json({ jsonrpc: '2.0', id, error: { code, message } });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', worker: 'vector-lab-mcp', version: '0.1.0', tools: TOOLS.length });
    }
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (url.pathname !== '/mcp' || request.method !== 'POST') return new Response('not found', { status: 404 });

    let body;
    try { body = await request.json(); } catch { return rpcErr(null, -32700, 'Parse error'); }
    const { id, method, params } = body;

    if (method === 'initialize') {
      return rpc(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'vector-lab-mcp', version: '0.1.0' }
      });
    }
    if (method === 'notifications/initialized') return new Response(null, { status: 204 });
    if (method === 'ping') return rpc(id, {});
    if (method === 'tools/list') return rpc(id, { tools: TOOLS });

    if (method === 'tools/call') {
      const name = params?.name;
      const args = params?.arguments || {};
      try {
        const result = await handleTool(name, args, env);
        return toolResult(id, result);
      } catch (e) {
        return rpcErr(id, -32603, `Tool error: ${e.message}`);
      }
    }

    return rpcErr(id, -32601, `Method not found: ${method}`);
  }
};
```

---

## 7. Acceptance criteria

1. `GET /health` returns status ok and tool count.
2. `POST /mcp` initialize succeeds.
3. `tools/list` returns all Vector Lab tools.
4. `embedding_generate` returns 768-dimension vectors or vector metadata for BGE base.
5. `chunk_text` is deterministic.
6. `vectorize_query` returns scored matches.
7. `vectorize_upsert_documents` embeds and upserts chunks.
8. `vectorize_reindex_from_d1` can index `tool_catalogue` from AFO Toolsmith DB.
9. `hybrid_search_d1_vectorize` returns Vectorize score plus D1 row data.
10. No secret values are returned in any response.

---

## 8. Toolsmith registration

Register as:

- connector id: `conn_vector_lab`
- catalogue id: `tool_08_vector_lab`
- bundle: `vector-lab`
- risk profile: `dev-only`
- connector URL: `https://vector-lab-mcp.agentfeedoptimization.com/mcp`

---

## 9. Claude deployment checklist

1. Build `vector-lab-mcp` Worker with the MCP pattern above.
2. Add bindings: `AI`, `CF_API_TOKEN`, `ACCOUNT_ID`, optional `DB`, optional `VECTORIZE`.
3. Deploy Worker.
4. Attach route: `vector-lab-mcp.agentfeedoptimization.com/*`.
5. Verify `/health`.
6. Verify `tools/list`.
7. Run a smoke test:
   - `chunk_text`
   - `embedding_generate`
   - `vectorize_list_indexes`
8. Apply Toolsmith index patch.
9. Re-embed catalogue with `/admin/embed-catalogue`.
10. Create Vector Lab belt.

---

## 10. Notes

This MCP is the semantic database workbench for the AFO operating system. Workers provide compute, D1 provides structured memory, Vectorize provides semantic memory, Workers AI provides embeddings, and MCP gives agents controlled access.
