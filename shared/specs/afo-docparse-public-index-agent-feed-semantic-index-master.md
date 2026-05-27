# AFO DocParse · Public Index · Agent Feed · Semantic Index — Master Spec
_author: Claude · date: 2026-05-26 · status: live_

---

## 1. Project Overview

This project is the **AI-readability and content intelligence layer for AFO (Agent Feed Optimization)**. It parses web content into structured, agent-readable formats and exposes three distinct product lanes targeting different user types.

**Core thesis:** The web is not readable by AI agents today. This project makes it readable — and helps website owners, researchers, and SEO teams understand and improve their AI-readability.

---

## 2. Product Lanes

| Lane | Worker | Audience | Core Value |
|---|---|---|---|
| **Parsed Web Index** | `afo-docparse-public-web` | Creators / researchers | Parse any URL or text into structured content; save, search, share |
| **Agent Feed** | `afo-agent-feed-web` | Website owners / brands | AI-readiness score (A–F), checklist, Agent Feed preview JSON |
| **Semantic Index** | `afo-semantic-index-web` | SEO / GEO / marketing | Semantic topic map, entities, keyword candidates, QA intents, content brief |

---

## 3. Confirmed Deployed Workers (as of 2026-05-26)

### DocParse Spine (internal — MCP-to-MCP)
| Worker | Role | Notes |
|---|---|---|
| `afo-docparse-schema-mcp` | Schema definitions | Core data types |
| `afo-docparse-queue-mcp` | Parse job queue | Async job dispatch |
| `afo-docparse-bench-mcp` | Quality benchmarking | Confidence scoring |
| `afo-docparse-router-mcp` | Input routing | Dispatches to correct parser |
| `afo-docparse-native-mcp` | Native text/HTML parser | Digital content |
| `afo-docparse-kv-table-mcp` | Key-value / table enrichment | Structured data extraction |
| `afo-docparse-evidence-mcp` | Evidence extraction | Claims + citations |
| `afo-docparse-result-normalizer-mcp` | Output normalisation | Uniform schema output |
| `afo-docparse-orchestrator-mcp` | End-to-end orchestration | Coordinates full parse pipeline |
| `afo-docparse-geometry-mcp` | OCR / spatial geometry | Tesseract TSV + PaddleOCR |

### Public-Facing MCPs
| Worker | Role | Notes |
|---|---|---|
| `afo-docparse-library-mcp` | Saved parse results | User library storage |
| `afo-docparse-public-index-mcp` | Public items, search, digest, publish | Core content index |
| `afo-docparse-try-api-mcp` | 3 free URL parses/day | Growth / trial gate |
| `afo-docparse-web-mvp` | Internal dev parse UI | Early prototype |

### Web UIs
| Worker | Role | Notes |
|---|---|---|
| `afo-docparse-public-web` | Main public web UI | v0.2.6-access-banner-lite; SSR forms |
| `afo-agent-feed-web` | Agent Feed web UI | AI-readiness for site owners |
| `afo-semantic-index-web` | Semantic Index web UI | SEO/GEO marketing |
| `afo-growth-dashboard-web` | Internal growth dashboard | Leads, events, notes, CSV |
| `afo-signup-router-test-web` | Signup router test UI | Internal smoke test |

### Email / Growth / Routing MCPs
| Worker | Role | Notes |
|---|---|---|
| `afo-email-automation-mcp` | Resend + D1 email events | Confirmed real email delivery |
| `afo-growth-dashboard-mcp` | Leads, events, notes, CSV export, growth digest | Internal |
| `afo-signup-router-mcp` | Saves lead → public index → sends welcome email | Confirmed working |
| `afo-agent-feed-audit-mcp` | URL/result → AI-readiness score, grade, checklist | Powers Agent Feed web |
| `afo-semantic-index-mcp` | Semantic topic map, entities, QA intents, content brief | Powers Semantic Index web |

---

## 4. Current Public Web — Key UX Decisions

- **Core actions use server-side HTML forms** (not fragile mobile JS) — confirmed stable on iPhone
- **Sticky header** with parse input always visible
- **Token tank** visible per parse result
- **Artifact accordions** for structured output sections
- **Access banner** for upgrade prompt (v0.2.6)
- **Flow:** parse webpage → signup → search → recent → digest → publish → artifact accordions

---

## 5. Email / Growth Loop (Confirmed Working)

- Signup via `afo-docparse-public-web` → `afo-signup-router-mcp` → save lead to public index → send welcome email via Resend
- FROM: `onboarding@agentfeedoptimization.com`
- Email delivery confirmed to Jared's inbox
- Growth events tracked in `afo-growth-dashboard-mcp` with CSV export

---

## 6. What Does NOT Exist Yet (Next Build Queue)

### 6.1 `afo-index-core-mcp` ← TOP PRIORITY
The unified account and index layer. Everything downstream depends on it.

**Purpose:** Single MCP that manages all index types, API tokens, and visibility tiers across the entire AFO platform.

**Index types to support:**
- `toolsmith_index`
- `parsed_web_index`
- `semantic_index`
- `agent_feed_index`
- `prompt_index`
- `faq_index`
- `agent_review_index`

**Visibility tiers:**
- `public` — anyone can read
- `trial` — 3 free operations, then upgrade prompt
- `private` — token required
- `paid` — subscription gated

**Core tools:**
| Tool | Description |
|---|---|
| `create_index` | Create a named index of a given type |
| `list_indexes` | List user's indexes with type + visibility |
| `get_index` | Get index metadata + item count |
| `add_index_item` | Add item to index with token estimate |
| `search_index` | Full-text search within an index |
| `publish_index_item` | Set item visibility to public |
| `unpublish_index_item` | Revert to private |
| `create_api_token` | Create named API token for user |
| `resolve_api_token` | Validate token → return user/tenant |
| `get_token_usage` | Token budget consumed vs. limit |
| `delete_index_item` | Remove item |

**D1 Schema (new database: `afo-index-core-db`):**
```sql
CREATE TABLE IF NOT EXISTS api_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  tier TEXT NOT NULL DEFAULT 'trial',
  created_at TEXT NOT NULL,
  expires_at TEXT,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS indexes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  item_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS index_items (
  id TEXT PRIMARY KEY,
  index_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  body_text TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  token_estimate INTEGER,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(index_id) REFERENCES indexes(id)
);

CREATE INDEX IF NOT EXISTS idx_index_items_index_id ON index_items(index_id);
CREATE INDEX IF NOT EXISTS idx_index_items_user_id ON index_items(user_id);
CREATE INDEX IF NOT EXISTS idx_index_items_type ON indexes(type);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON api_tokens(user_id);
```

---

### 6.2 `afo-index-dashboard-web`
Minimal web dashboard for account holders to view and manage their indexes.

**Auth:** API token login or email/token flow (no password)

**Pages / tabs:**
- **Home** — account summary, token usage, recent activity
- **Indexes** — list all indexes by type, item counts, visibility
- **Saved Parses** — browse parsed web index items
- **Prompts** — prompt index items
- **Agent Messages** — messages/reviews from agents (Message OS integration)
- **Upgrade** — tier/plan placeholder

**Design constraints:**
- Mobile-first SSR (iPhone 16 primary)
- Server-side HTML forms where possible (pattern from public web)
- No fragile mobile JS for core actions

---

### 6.3 `afo-token-tank-summary-mcp`
Token-budgeted structured summaries from parsed websites.

**Input:** parsed URL/text + target token count + mode
**Modes:** `article_brief` | `seo_brief` | `agent_feed` | `executive_summary` | `prompt_context`
**Output:** summary, estimated tokens, compression ratio, facts kept/omitted, recommended next prompts

---

### 6.4 `afo-prompt-index-mcp`
Generate multiple prompt formats from one parsed webpage.

**Prompt types per page:**
- Article
- Newsletter
- Video script
- Image prompt
- SEO brief
- Agent FAQ
- Comparison
- Social thread
- Landing page rewrite
- Semantic expansion

All prompts token-tank budgeted. Stored in `prompt_index` via `afo-index-core-mcp`.

---

### 6.5 Agent Reviews / Messages / FAQ Layer
Tie all product pages into the Message OS and Toolsmith ecosystems.

**Target integration points:**
- `https://message-os-cloud.agentfeedoptimization.com/dashboard` (inbox tab)
- `https://afo-toolsmith.agentfeedoptimization.com/belt/blt_hdewr4xttb6sgg63`
- `https://messages.agentfeedoptimization.com/`

**Per-page agent capabilities:**
- Leave reviews
- Post update suggestions
- Add/read FAQs (agent-focused)
- See claim boundaries, do-not-claim notes, provenance, changelog

---

## 7. Recommended Build Sequence

| Step | Task | Depends On |
|---|---|---|
| 1 | Audit live Worker health + D1 table states | Nothing |
| 2 | Build `afo-index-core-mcp` | Step 1 |
| 3 | Build minimal `afo-index-dashboard-web` | Step 2 |
| 4 | Build `afo-token-tank-summary-mcp` | Step 2 |
| 5 | Build `afo-prompt-index-mcp` | Steps 2 + 4 |
| 6 | Agent reviews / FAQ layer | Step 2 + Message OS Cloud |

---

## 8. Key Environment Variables (Reference)

| Var | Worker | Purpose |
|---|---|---|
| `RESEND_API_KEY` | email-automation, signup-router | Email delivery |
| `RESEND_FROM_EMAIL` | email-automation | `onboarding@agentfeedoptimization.com` |
| `DB` | all D1-backed workers | D1 binding |
| `APP_BASE_URL` | cross-worker | `https://afo-docparse-public-web.agentfeedoptimization.com` (or custom domain) |

---

## 9. Protocol Standard

All Workers follow **AFO Mobile MCP Protocol:**
- `POST /mcp` — JSON-RPC 2.0 tool calls
- `GET /health` — deployment status
- Hand-rolled JSON-RPC (no Wrangler MCP SDK dependency)
- Custom domain pattern: `{worker-name}.agentfeedoptimization.com`

---

## 10. Agent Coordination Notes

- **ChatGPT** built the majority of the DocParse spine and product lanes on 2026-05-26
- **Claude** owns this spec and the next build phase (`afo-index-core-mcp` and beyond)
- **Alice** is tracking tool-notes / Toolsmith catalogue work in parallel
- Worker source reads currently blocked (mcp-prax auth issue) — audit via health endpoints instead
- Jared works primarily from iPhone 16 — prefer CF deploy + tool-driven changes over manual dashboard edits

---

## 11. Open Questions / Risks

| Item | Notes |
|---|---|
| D1 database IDs for docparse workers | Not confirmed — need health check audit |
| `afo-docparse-public-web` custom domain | Assumed pattern; confirm with Jared |
| Token tank implementation | Depends on what `afo-docparse-result-normalizer-mcp` already outputs |
| Email flow for index-dashboard login | Email/token vs. full auth TBD |
| mcp-prax auth fix | Needed to read live Worker source; track separately |

---

_spec: Claude · 2026-05-26 · project: afo-docparse-public-index-agent-feed-semantic-index_
