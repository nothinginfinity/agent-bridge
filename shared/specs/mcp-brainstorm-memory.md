# MCP Brainstorm Memory

**status:** proposed
**owner:** Jared Edwards / AFO Toolsmith
**target worker:** `mcp-brainstorm`
**target route:** `https://mcp-brainstorm.agentfeedoptimization.com/mcp`
**purpose:** Capture ChatGPT/Claude brainstorm turns into durable structured memory and vector search.

---

## 1. Product intent

`mcp-brainstorm` gives Jared perpetual semantic memory for brainstorm sessions.

The core idea:

```txt
Every prompt + every response
→ captured as a turn
→ stored in D1
→ chunked and embedded
→ upserted into Vectorize
→ searchable by future LLM sessions
```

This turns normal chat into a durable project memory layer.

Initial operating assumption:

```txt
Version 1 = the assistant calls the MCP after each turn because project instructions tell it to.
Version 2 = a gateway/wrapper captures turns automatically without relying on the assistant to remember.
```

---

## 2. Why MCP is the right interface

The MCP does not magically read ChatGPT's private UI history. Instead, it gives the assistant a tool it can call after each response.

For v1, Jared can create ChatGPT Project Instructions like:

```txt
After every substantive reply, call the mcp-brainstorm tool `capture_turn` with the user's prompt, your response, project name, tags, and a short summary. If the tool is unavailable, say memory capture is unavailable.
```

That makes memory capture part of the project workcell behavior.

---

## 3. Version roadmap

### Version 1: agent-called capture

Flow:

```txt
Jared prompt
→ ChatGPT response
→ ChatGPT calls capture_turn
→ Worker stores turn in D1
→ Worker chunks prompt/response
→ Worker generates embeddings
→ Worker upserts chunks to Vectorize
→ future sessions search with MCP tools
```

Pros:

- Fast to build.
- Works with current MCP pattern.
- No custom ChatGPT wrapper needed.
- Fits AFO Toolsmith project instructions and belts.

Limitations:

- Capture depends on the assistant calling the tool.
- It may miss turns if the tool is disconnected or the instruction is not followed.
- It cannot capture hidden chain-of-thought or UI-only state.

### Version 2: automatic capture gateway

Flow:

```txt
Custom chat/workcell client
→ sends prompt to LLM
→ receives response
→ writes prompt/response to mcp-brainstorm automatically
→ displays response to user
```

Pros:

- Reliable automatic capture.
- Does not depend on assistant behavior.
- Can enforce project/session metadata.

Limitations:

- Requires custom client, wrapper, extension, or gateway.
- More auth and privacy surface.

---

## 4. Storage architecture

Recommended Cloudflare stack:

- Worker: MCP endpoint + ingest/search API.
- D1: canonical structured conversation store.
- Vectorize: semantic chunk search.
- Workers AI: embeddings and optional summaries/classification.
- Optional R2: long exported transcripts or attachments.

Recommended Vectorize index:

```txt
brainstorm-memory
```

Temporary fallback if a dedicated index is not ready:

```txt
afo-messages with strong namespace: brainstorm:{conversation_id}:{turn_id}:{chunk_index}
```

Do not mix memory vectors without strong metadata namespacing.

---

## 5. D1 schema

### `brainstorm_conversations`

```sql
CREATE TABLE IF NOT EXISTS brainstorm_conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  project TEXT,
  client TEXT,
  model TEXT,
  user_id TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  tags TEXT,
  metadata_json TEXT
);
```

### `brainstorm_turns`

```sql
CREATE TABLE IF NOT EXISTS brainstorm_turns (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  turn_index INTEGER,
  project TEXT,
  user_prompt TEXT NOT NULL,
  assistant_response TEXT NOT NULL,
  summary TEXT,
  tags TEXT,
  decisions_json TEXT,
  tasks_json TEXT,
  entities_json TEXT,
  source_client TEXT,
  model TEXT,
  created_at TEXT NOT NULL,
  embedding_status TEXT DEFAULT 'pending',
  metadata_json TEXT,
  FOREIGN KEY (conversation_id) REFERENCES brainstorm_conversations(id)
);
```

### `brainstorm_chunks`

```sql
CREATE TABLE IF NOT EXISTS brainstorm_chunks (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL,
  turn_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  role TEXT NOT NULL,
  text TEXT NOT NULL,
  vector_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (turn_id) REFERENCES brainstorm_turns(id)
);
```

Indexes:

```sql
CREATE INDEX IF NOT EXISTS idx_brainstorm_conversations_project ON brainstorm_conversations(project);
CREATE INDEX IF NOT EXISTS idx_brainstorm_turns_conversation ON brainstorm_turns(conversation_id);
CREATE INDEX IF NOT EXISTS idx_brainstorm_turns_project ON brainstorm_turns(project);
CREATE INDEX IF NOT EXISTS idx_brainstorm_turns_created_at ON brainstorm_turns(created_at);
CREATE INDEX IF NOT EXISTS idx_brainstorm_chunks_turn ON brainstorm_chunks(turn_id);
```

---

## 6. Required MCP tools

### 6.1 `deployment_status`

Return Worker status, binding presence, configured index, DB status, and tool count.

Input schema:

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

---

### 6.2 `capture_turn`

Capture one user prompt + assistant response pair.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "conversation_id": { "type": "string" },
    "conversation_title": { "type": "string" },
    "turn_index": { "type": "number" },
    "project": { "type": "string" },
    "user_prompt": { "type": "string" },
    "assistant_response": { "type": "string" },
    "summary": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "source_client": { "type": "string", "default": "chatgpt" },
    "model": { "type": "string" },
    "metadata": { "type": "object" },
    "embed_now": { "type": "boolean", "default": true }
  },
  "required": ["user_prompt", "assistant_response"]
}
```

Output:

```json
{
  "conversation_id": "conv_...",
  "turn_id": "turn_...",
  "chunks": 4,
  "embedding_status": "embedded",
  "vector_ids": ["brainstorm:conv_:turn_:0"]
}
```

Behavior:

1. Generate `conversation_id` if missing.
2. Create or update conversation row.
3. Create turn row.
4. Chunk user prompt and assistant response.
5. Store chunks in D1.
6. If `embed_now=true`, generate embeddings and upsert vectors.
7. Return IDs and status.

---

### 6.3 `capture_summary`

Capture a compact session summary or milestone checkpoint.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "conversation_id": { "type": "string" },
    "project": { "type": "string" },
    "summary": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "metadata": { "type": "object" },
    "embed_now": { "type": "boolean", "default": true }
  },
  "required": ["summary"]
}
```

Use this when a turn is too long, or when the assistant needs to checkpoint a long brainstorm.

---

### 6.4 `search_memory`

Semantic search over captured brainstorm chunks.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "query": { "type": "string" },
    "project": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "conversation_id": { "type": "string" },
    "top_k": { "type": "number", "default": 8 }
  },
  "required": ["query"]
}
```

Output:

```json
{
  "results": [
    {
      "turn_id": "turn_...",
      "conversation_id": "conv_...",
      "score": 0.91,
      "role": "assistant",
      "text": "...",
      "project": "tool-notes",
      "created_at": "2026-05-24T...Z"
    }
  ]
}
```

---

### 6.5 `get_turn`

Retrieve a full captured turn.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "turn_id": { "type": "string" }
  },
  "required": ["turn_id"]
}
```

---

### 6.6 `list_recent_turns`

List recent captured turns.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "project": { "type": "string" },
    "limit": { "type": "number", "default": 20 }
  },
  "required": []
}
```

---

### 6.7 `list_conversations`

List captured conversations.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "project": { "type": "string" },
    "limit": { "type": "number", "default": 20 }
  },
  "required": []
}
```

---

### 6.8 `tag_turn`

Add tags or project metadata to a turn.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "turn_id": { "type": "string" },
    "tags": { "type": "array", "items": { "type": "string" } },
    "project": { "type": "string" }
  },
  "required": ["turn_id"]
}
```

---

### 6.9 `extract_tasks_from_turn`

Extract tasks/follow-ups from a captured turn. V0 can do this with deterministic prompting or return a placeholder unless LLM classification is wired.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "turn_id": { "type": "string" }
  },
  "required": ["turn_id"]
}
```

---

### 6.10 `extract_decisions_from_turn`

Extract durable decisions from a captured turn. Should not auto-write to `shared/decisions.md`; it should return candidate decisions for review.

Input schema:

```json
{
  "type": "object",
  "properties": {
    "turn_id": { "type": "string" }
  },
  "required": ["turn_id"]
}
```

---

## 7. Non-MCP ingestion endpoints

These support v2 and external clients.

### `POST /api/turns/capture`

Same payload as `capture_turn`, but for a custom chat client or automation.

### `POST /api/summaries/capture`

Same payload as `capture_summary`.

### `GET /api/search?q=...`

Optional search endpoint for UI/client usage.

---

## 8. Security and privacy model

This tool stores potentially sensitive personal and project conversations. Treat it as private memory infrastructure.

Rules:

1. Never capture without Jared's explicit project-level instruction or client-level opt-in.
2. Provide `capture_enabled` setting at the project/workcell level.
3. Do not capture hidden chain-of-thought or internal model reasoning.
4. Capture only user-visible prompt and assistant-visible final response.
5. Allow per-turn tags and project scope.
6. Support `private`, `project`, and `shareable` visibility metadata.
7. Search tools should accept project filters and limits.
8. No delete tool in v0.1 unless Jared explicitly asks for it.
9. Add export tools before delete tools.
10. Return only relevant snippets by default, not entire conversation history.
11. Respect secrets: do not intentionally store API keys, PATs, passwords, or private tokens.
12. Add redaction later for secret-like strings.

---

## 9. Project instructions for ChatGPT

Suggested ChatGPT Project Instruction for Version 1:

```txt
Brainstorm Memory Mode is enabled.

After each substantive assistant reply, call the `mcp-brainstorm` tool `capture_turn` with:
- the user's prompt
- the assistant's final visible response
- project name
- conversation title if known
- relevant tags
- a short summary
- source_client = chatgpt

Do not capture secrets, passwords, API keys, private tokens, or anything Jared explicitly marks as not for memory.
If the capture tool is unavailable, briefly say: “Brainstorm memory capture is unavailable in this session.”
```

Suggested lightweight command language:

```txt
memory on = capture every substantive turn
memory off = stop capture
save this = capture current turn
forget this = do not capture current turn
project: X = set project metadata
```

---

## 10. Toolsmith registration

Register as:

```json
{
  "id": "tool_11_mcp_brainstorm",
  "name": "MCP Brainstorm Memory",
  "description": "Captures user prompts and assistant responses into D1 and Vectorize for perpetual brainstorm memory.",
  "connector_id": "conn_mcp_brainstorm",
  "connector_url": "https://mcp-brainstorm.agentfeedoptimization.com/mcp",
  "risk_profile": "private-memory-write",
  "bundle": "memory-spine",
  "tags": ["brainstorm", "memory", "vector-search", "conversation-capture", "d1", "vectorize"]
}
```

Recommended belt:

```txt
Brainstorm Memory Belt
```

Suggested connectors:

```txt
conn_agent_bridge_comms
conn_mcp_brainstorm
conn_vector_lab
conn_toolsmith_admin
```

---

## 11. Acceptance criteria for v0.1

1. `GET /health` returns Worker status.
2. `POST /mcp` initializes correctly.
3. `tools/list` returns v0.1 tools.
4. `capture_turn` stores a prompt/response pair in D1.
5. `capture_turn` creates chunks for prompt and response.
6. `capture_turn` embeds chunks when `embed_now=true`.
7. `search_memory` can retrieve captured content semantically.
8. `get_turn` returns the full captured turn.
9. `list_recent_turns` returns recent captures.
10. The tool never returns secret bindings.
11. The tool does not capture hidden chain-of-thought.
12. The tool supports project/tags metadata.

---

## 12. Open decisions

1. Dedicated `brainstorm-memory` Vectorize index or temporary namespace in `afo-messages`?
2. Should capture be default-on only inside a special ChatGPT Project?
3. Should captured turns be mirrored to GitHub markdown or only stored in D1/Vectorize?
4. Should there be a redaction pass before storage?
5. Should `delete_turn` be omitted until export/redaction tools exist?
6. Should this live as its own repo, or as an AFO Toolsmith-generated MCP first?

Recommended defaults:

- Start with a dedicated Worker: `mcp-brainstorm`.
- Use D1 for canonical memory.
- Use Vectorize for retrieval.
- Use project instructions for v1 auto-calling.
- Avoid delete tools in v0.1.
- Add redaction in v0.2.

---

## 13. Notes

This MCP is the beginning of a durable **Memory Spine**.

Comms Spine preserves coordination.
Memory Spine preserves learning.

Together:

```txt
Comms Spine + Memory Spine + Task Tool Pack = high-continuity workcell
```
