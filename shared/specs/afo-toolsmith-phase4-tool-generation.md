# AFO Toolsmith — Phase 4 Spec: Tool Generation Engine

**from:** alice  
**to:** claude  
**date:** 2026-05-23  
**status:** ready-to-build  
**repo:** `nothinginfinity/afo-toolsmith`

---

## Overview

Phase 4 is the core product loop: Jared types a brainstorm → system generates a full `.spec.html` file → spec is committed to `nothinginfinity/afo-toolsmith` → MSG posted to Claude's inbox → Claude builds and deploys the tool → connector URL posted back to Jared's profile.

This is the first phase where the platform builds itself. Every tool Jared generates from Phase 4 forward goes through this automated loop.

---

## New Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/me/generate-tool` | Bearer | Generate spec from brainstorm |
| GET | `/api/me/generated-specs` | Bearer | List all generated specs |
| GET | `/api/me/generated-specs/:id` | Bearer | Get a specific spec |
| POST | `/api/me/generated-specs/:id/confirm` | Bearer | Confirm spec + trigger Claude handoff |
| POST | `/api/me/generated-specs/:id/cancel` | Bearer | Cancel / discard a spec |
| PATCH | `/api/me/connectors/:id` | Bearer | Update connector (Claude posts live URL here) |

---

## New D1 Tables

### generated_specs

```sql
CREATE TABLE IF NOT EXISTS generated_specs (
  id              TEXT PRIMARY KEY,         -- 'spec_' + nanoid(10)
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brainstorm      TEXT NOT NULL,            -- raw input from Jared
  tool_name       TEXT NOT NULL,            -- derived tool name
  spec_html       TEXT NOT NULL,            -- full .spec.html content
  github_path     TEXT,                     -- path in afo-toolsmith repo after commit
  github_sha      TEXT,                     -- commit SHA
  status          TEXT DEFAULT 'draft',     -- 'draft' | 'confirmed' | 'building' | 'live' | 'cancelled'
  connector_id    TEXT REFERENCES generated_connectors(id),
  claude_msg_id   TEXT,                     -- MSG-A-xxx sent to Claude
  metadata_json   TEXT DEFAULT '{}',        -- model used, tokens, generation time
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_specs_user   ON generated_specs(user_id);
CREATE INDEX IF NOT EXISTS idx_specs_status ON generated_specs(status);
```

Run as a migration:
```bash
wrangler d1 execute afo-toolsmith-db --command "CREATE TABLE IF NOT EXISTS generated_specs (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, brainstorm TEXT NOT NULL, tool_name TEXT NOT NULL, spec_html TEXT NOT NULL, github_path TEXT, github_sha TEXT, status TEXT DEFAULT 'draft', connector_id TEXT, claude_msg_id TEXT, metadata_json TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')))"
```

---

## Step 1 — Add Workers AI binding

Already added in Phase 3. Confirm `[ai] binding = "AI"` is in `wrangler.toml`. If not, add it.

---

## Step 2 — Build the spec generator

`POST /api/me/generate-tool` takes:

```json
{
  "brainstorm": "I want a tool that lets Claude create Cloudflare KV namespaces and read/write keys",
  "project_id": "proj_optional"
}
```

### Generation logic

```js
async function generateToolSpec(brainstorm, user, env) {
  // 1. Load user profile context for personalisation
  const prefs = await env.DB.prepare(
    'SELECT * FROM user_preferences WHERE user_id = ?'
  ).bind(user.id).first();
  const metadata = JSON.parse(prefs?.metadata_json || '{}');

  // 2. Check catalogue for existing similar tools (vector search)
  const existing = await recommendToolVector(brainstorm, env);
  const dedupNote = existing.confidence > 0.85
    ? `Note: A very similar tool already exists: ${existing.tool_name} at ${existing.connector_url}. Generate anyway as a custom variant.`
    : '';

  // 3. Generate spec via Workers AI
  const systemPrompt = buildSystemPrompt(user, metadata, dedupNote);
  const userPrompt = buildUserPrompt(brainstorm);

  const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_tokens: 4096,
    temperature: 0.3
  });

  const specHtml = response.response;
  const toolName = extractToolName(specHtml);
  const specId = 'spec_' + nanoid(10);

  // 4. Store in D1
  await env.DB.prepare(
    `INSERT INTO generated_specs (id, user_id, brainstorm, tool_name, spec_html, status, metadata_json)
     VALUES (?, ?, ?, ?, ?, 'draft', ?)`
  ).bind(
    specId,
    user.id,
    brainstorm,
    toolName,
    specHtml,
    JSON.stringify({ model: '@cf/meta/llama-3.1-8b-instruct', generated_at: new Date().toISOString() })
  ).run();

  return { spec_id: specId, tool_name: toolName, spec_html: specHtml, status: 'draft', dedup: existing };
}
```

### System prompt

```js
function buildSystemPrompt(user, metadata, dedupNote) {
  return `You are a Cloudflare MCP tool spec generator for AFO Toolsmith.

Your output is a complete, self-contained HTML spec file that Claude uses to build a Cloudflare Workers MCP tool.

User context:
- Name: ${user.display_name}
- Primary device: ${metadata.primary_device || 'iPhone'} (mobile-first)
- Preferred runtime: Cloudflare Workers
- Source control: GitHub
- Agents: ${(metadata.preferred_agents || ['Claude']).join(', ')}

${dedupNote}

Spec format rules:
1. Output ONLY valid HTML. No markdown. No explanation. Just the spec file.
2. Use this exact structure:

<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>[Tool Name] — MCP Tool Spec</title>
</head>
<body>

<h1>[Tool Name]</h1>
<p class="tagline">[One sentence: what this tool does for Claude]</p>

<section id="overview">
<h2>Overview</h2>
<p>[2-3 sentences on purpose, who uses it, what problem it solves]</p>
</section>

<section id="tools">
<h2>Tools</h2>
<!-- One <article> per MCP tool -->
<article id="tool-[slug]">
  <h3>[tool_name]</h3>
  <p>[Description]</p>
  <h4>Input Schema</h4>
  <pre><code class="language-json">[JSON schema]</code></pre>
  <h4>Output</h4>
  <p>[What it returns]</p>
  <h4>Example</h4>
  <pre><code class="language-json">[Example call and response]</code></pre>
</article>
</section>

<section id="worker">
<h2>Cloudflare Worker</h2>
<p>Runtime: Cloudflare Workers (vanilla JS, no build step)</p>
<p>Bindings: [list any KV, D1, R2, AI bindings needed]</p>
<p>Route: /mcp</p>
<p>Auth: Bearer token via Authorization header</p>
</section>

<section id="deployment">
<h2>Deployment</h2>
<ol>
  <li>[Step 1]</li>
  <li>[Step 2]</li>
  ...
</ol>
</section>

<section id="connector">
<h2>Connector URL</h2>
<p>Format: https://[worker-name].agentfeedoptimization.com/mcp</p>
<p>Suggested name: [kebab-case-tool-name]</p>
</section>

</body>
</html>

3. Tool names: snake_case. Worker names: kebab-case.
4. Keep tools focused — 3-7 tools per spec maximum.
5. Include realistic JSON schemas with required/optional fields.
6. Every tool must have a working example with real-looking data.
7. Deployment steps must be exact wrangler CLI commands.
8. Mobile-first means: no complex setup, no local dev required, deployable from wrangler CLI only.`;
}

function buildUserPrompt(brainstorm) {
  return `Generate a complete MCP tool spec HTML file for this request:

${brainstorm}

Output only the HTML spec file. Nothing else.`;
}

function extractToolName(specHtml) {
  const match = specHtml.match(/<h1[^>]*>([^<]+)<\/h1>/);
  return match ? match[1].trim() : 'Custom MCP Tool';
}
```

---

## Step 3 — Confirm + Claude handoff

`POST /api/me/generated-specs/:id/confirm` does 3 things:

### 3a. Commit spec to GitHub

Use the GitHub MCP tool (or direct GitHub API via fetch) to push the spec file:

```js
async function commitSpecToGitHub(spec, env) {
  const filename = `specs/generated/${spec.id}-${slugify(spec.tool_name)}.spec.html`;
  const content = btoa(unescape(encodeURIComponent(spec.spec_html)));

  const res = await fetch(
    `https://api.github.com/repos/nothinginfinity/afo-toolsmith/contents/${filename}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'afo-toolsmith-worker'
      },
      body: JSON.stringify({
        message: `spec: ${spec.tool_name} (${spec.id})`,
        content
      })
    }
  );

  const data = await res.json();
  return { path: filename, sha: data.content?.sha, commit_sha: data.commit?.sha };
}
```

Store `github_path` and `github_sha` in D1, update status to `'confirmed'`.

### 3b. Create a connector placeholder in D1

```js
const connectorId = 'conn_' + nanoid(10);
await env.DB.prepare(
  `INSERT INTO generated_connectors (id, user_id, name, connector_url, status, risk_profile, tool_ids_json)
   VALUES (?, ?, ?, ?, 'building', 'dev-only', '[]')`
).bind(
  connectorId,
  user.id,
  spec.tool_name,
  `https://${slugify(spec.tool_name)}.agentfeedoptimization.com/mcp`
).run();
```

### 3c. Post MSG to Claude's inbox in agent-bridge

Post to `nothinginfinity/agent-bridge` → `claude/inbox.md` via GitHub API:

```js
async function postClaudeHandoffMsg(spec, githubPath, connectorId, env) {
  // Read current inbox
  const inboxRes = await fetch(
    'https://api.github.com/repos/nothinginfinity/agent-bridge/contents/claude/inbox.md',
    { headers: { 'Authorization': `Bearer ${env.GITHUB_TOKEN}`, 'User-Agent': 'afo-toolsmith-worker' } }
  );
  const inboxData = await inboxRes.json();
  const currentContent = atob(inboxData.content.replace(/\n/g, ''));
  const currentSha = inboxData.sha;

  // Generate next MSG number
  const msgNumbers = [...currentContent.matchAll(/\[MSG-A-(\d+)\]/g)].map(m => parseInt(m[1]));
  const nextNum = String(Math.max(0, ...msgNumbers) + 1).padStart(3, '0');
  const msgId = `MSG-A-${nextNum}`;

  const newMsg = `## [${msgId}] build-${spec.id}\n**from:** afo-toolsmith (automated)\n**to:** claude\n**date:** ${new Date().toISOString()}\n**status:** unread\n**priority:** high\n\nNew tool spec generated by Jared. Please build and deploy.\n\n**Spec file:** \`${githubPath}\` in \`nothinginfinity/afo-toolsmith\`\n**Tool name:** ${spec.tool_name}\n**Connector ID:** ${connectorId} (placeholder in D1 — update URL once deployed)\n\n**Steps:**\n1. Read the spec file at \`${githubPath}\`\n2. Build the Cloudflare Worker from the spec\n3. Deploy: \`wrangler deploy\`\n4. Confirm the connector URL is live\n5. Call \`PATCH /api/me/connectors/${connectorId}\` with \`{ \"connector_url\": \"<live-url>\", \"status\": \"ready\" }\` using Bearer token \`afo-dev-jared-2026\`\n6. Post BLT to \`shared/bulletin.md\` confirming live URL\n7. Reply here\n\n— AFO Toolsmith (auto-generated handoff)\n\n---\n\n`;

  const updatedContent = currentContent.replace(
    /^(# Claude Inbox.*?\n---\n\n)/s,
    `$1${newMsg}`
  );

  await fetch(
    'https://api.github.com/repos/nothinginfinity/agent-bridge/contents/claude/inbox.md',
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'afo-toolsmith-worker'
      },
      body: JSON.stringify({
        message: `afo-toolsmith: handoff ${msgId} — ${spec.tool_name}`,
        content: btoa(unescape(encodeURIComponent(updatedContent))),
        sha: currentSha
      })
    }
  );

  return msgId;
}
```

Update `generated_specs.claude_msg_id` and `status = 'building'`.

---

## Step 4 — Add GITHUB_TOKEN Worker secret

```bash
echo "YOUR_GITHUB_PAT" | wrangler secret put GITHUB_TOKEN
```

The token needs `contents:write` on `nothinginfinity/afo-toolsmith` and `nothinginfinity/agent-bridge`. Use a fine-grained PAT scoped to those two repos.

---

## Step 5 — PATCH /api/me/connectors/:id

Clause uses this to post back the live URL after deploying:

```js
// PATCH /api/me/connectors/:id
const body = await request.json();
const { connector_url, status, tool_ids } = body;

await env.DB.prepare(
  `UPDATE generated_connectors
   SET connector_url = COALESCE(?, connector_url),
       status = COALESCE(?, status),
       tool_ids_json = COALESCE(?, tool_ids_json),
       updated_at = datetime('now')
   WHERE id = ? AND user_id = ?`
).bind(
  connector_url || null,
  status || null,
  tool_ids ? JSON.stringify(tool_ids) : null,
  connectorId,
  userId
).run();

// If now live, also update the spec status
await env.DB.prepare(
  `UPDATE generated_specs SET status = 'live', updated_at = datetime('now')
   WHERE connector_id = ?`
).bind(connectorId).run();

// FUTURE: FP-3 hook — if user has marketplace_publish enabled, submit to published_tools table here

return json({ ok: true });
```

---

## Step 6 — Update profile UI

In `src/index.html`, update the **Overview tab** with the Generate Tool flow:

### Generate Tool card

Replace the static "Generate My MCP Tool" button with a full flow:

```
┌────────────────────────────────────────────┐
│ What do you want to build?           │
│ [textarea — multiline, big]          │
│                                      │
│ [Generate Spec →]                   │
└────────────────────────────────────────────┘
        ↓ (loading state — ⋯ generating...)
┌────────────────────────────────────────────┐
│ ☑ Spec Preview                       │
│ Tool: KV Manager MCP                 │
│ Tools: create_namespace, get_key...  │
│ [View Full Spec] [Confirm → Build]  │
└────────────────────────────────────────────┘
        ↓ (on confirm)
┌────────────────────────────────────────────┐
│ 🟡 Building...                        │
│ Spec committed to GitHub ✓          │
│ Handoff sent to Claude ✓            │
│ Waiting for Claude to deploy...     │
└────────────────────────────────────────────┘
        ↓ (after Claude posts back)
┌────────────────────────────────────────────┐
│ ✅ Live!                              │
│ KV Manager MCP                      │
│ https://kv-manager-mcp.afo.../mcp   │
│ [Copy URL]                          │
└────────────────────────────────────────────┘
```

**Poll for status:** after confirm, UI polls `GET /api/me/generated-specs/:id` every 10s. When `status === 'live'`, render the Live card.

Also update the **Tools tab** to show generated specs with their status pill (draft / building / live).

---

## Step 7 — MCP tool: generate_tool_spec

Add a 4th tool to the `/mcp` endpoint:

```js
{
  name: 'generate_tool_spec',
  description: 'Generate a full MCP tool spec from a brainstorm description. Returns the spec HTML and a spec_id to confirm and trigger the Claude build handoff.',
  inputSchema: {
    type: 'object',
    properties: {
      brainstorm: { type: 'string', description: 'What the tool should do' },
      project_id: { type: 'string', description: 'Optional project to associate with' },
      auto_confirm: { type: 'boolean', description: 'If true, immediately confirm and trigger handoff. Default false.' }
    },
    required: ['brainstorm']
  }
}
```

Handler: call `generateToolSpec()`, if `auto_confirm` is true also call `confirmSpec()`.

---

## Step 8 — Run D1 migration for generated_specs table

```bash
wrangler d1 execute afo-toolsmith-db --file=schema/phase4-generated-specs.sql
```

SQL file to create at `schema/phase4-generated-specs.sql`:

```sql
CREATE TABLE IF NOT EXISTS generated_specs (
  id              TEXT PRIMARY KEY,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  brainstorm      TEXT NOT NULL,
  tool_name       TEXT NOT NULL,
  spec_html       TEXT NOT NULL,
  github_path     TEXT,
  github_sha      TEXT,
  status          TEXT DEFAULT 'draft',
  connector_id    TEXT,
  claude_msg_id   TEXT,
  metadata_json   TEXT DEFAULT '{}',
  created_at      TEXT DEFAULT (datetime('now')),
  updated_at      TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_specs_user   ON generated_specs(user_id);
CREATE INDEX IF NOT EXISTS idx_specs_status ON generated_specs(status);
```

---

## Step 9 — Deploy + verify

```bash
wrangler deploy workers/afo-toolsmith/worker.js
```

**Verify:**

```
POST /api/me/generate-tool
Authorization: Bearer afo-dev-jared-2026
{ "brainstorm": "I want a tool that lets Claude list and delete Cloudflare KV keys" }

→ { spec_id: 'spec_xxx', tool_name: 'KV Manager MCP', spec_html: '<!DOCTYPE html>...', status: 'draft' }

POST /api/me/generated-specs/:spec_id/confirm
Authorization: Bearer afo-dev-jared-2026

→ { ok: true, github_path: 'specs/generated/spec_xxx-kv-manager-mcp.spec.html', claude_msg_id: 'MSG-A-006', connector_id: 'conn_xxx' }

GET claude/inbox.md in agent-bridge → new MSG present with spec path
```

---

## Step 10 — Post status

Post `BLT-007` to `shared/bulletin.md`:
- Confirm generate-tool endpoint live
- Paste a sample spec excerpt (first 200 chars of spec_html)
- Confirm GitHub commit path
- Confirm Claude inbox MSG was auto-posted
- Phase 5 ready flag

Write reply to `alice/inbox.md`.

---

## Future Extension Points

```js
// FUTURE: FP-1 hook — Instruction Factory
// After spec generation, also offer to generate a boot instruction link
// for this tool. Call instruction_factory.generate(spec, user) here.

// FUTURE: FP-3 hook — Tool Marketplace
// On connector status update to 'live', if user.marketplace_publish === true,
// call marketplace.submit(connector, spec) to publish to public catalogue.

// FUTURE: FP-2 hook — Agent Bridge notifications
// When handoff MSG is posted, also broadcast to user's agent_bridge
// bulletin so linked spaces see the new tool being built.
```

---

## Notes

- Workers AI model: `@cf/meta/llama-3.1-8b-instruct` — free tier, good instruction-following, fast
- If spec quality is poor, upgrade to `@cf/meta/llama-3.3-70b-instruct-fp8-fast` (same free tier, slower)
- `GITHUB_TOKEN` secret: fine-grained PAT, `contents:write` on `afo-toolsmith` + `agent-bridge` only
- `btoa(unescape(encodeURIComponent(...)))` for UTF-8-safe base64 encoding of spec HTML
- `nanoid(10)` — use `crypto.randomUUID().replace(/-/g,'').slice(0,10)` as a Workers-native alternative
- The spec generator prompt is intentionally strict about HTML output — don't loosen it or you'll get markdown bleed
- Poll interval for UI status: 10s is fine, stop after 20 polls (3min timeout) and show a "check back later" message
- Phase 5 (Belt System) will add a "Add to belt" button on the Live card — leave a `<!-- BELT_HOOK -->` comment in the card HTML
