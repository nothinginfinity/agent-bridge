# toolsmith-builder-mcp — Spec v0.1

**Worker name:** `toolsmith-builder-mcp`  
**Version:** 0.1.0  
**Author:** Alice  
**Date:** 2026-05-27  
**Status:** Draft — pending Claude/ChatGPT review  
**Health URL:** `https://toolsmith-builder-mcp.agentfeedoptimization.com/health`  
**MCP URL:** `https://toolsmith-builder-mcp.agentfeedoptimization.com/mcp`  

---

## Purpose

This MCP exists to turn pasted ideas, URLs, documents, and agent responses into structured build jobs that produce deployable software artifacts.

> "This MCP exists to receive any input — idea, URL, doc, repo, or paste — and produce a structured build plan that other agents can execute to create, deploy, and register a working tool or application."

If the sentence above ever grows a second `and` describing two unrelated jobs, split the MCP.

---

## Position in the Automatic Application Builder Belt

```
1. GitZip v0.2             — atomic repo commit layer
2. toolsmith-builder-mcp   ← THIS SPEC
3. Repo Composer           — manifest → runnable package
4. CF deploy-from-repo     — commit SHA → live Worker
5. Smoke Test MCP          — verify before register
6. Toolsmith registry MCP  — register deployed tools
```

This MCP is the **intake and planning layer**. It does not deploy, commit, or register. It classifies intent, estimates capabilities needed, and produces a `build_job` object that downstream agents act on.

---

## Core Object: `build_job`

```ts
interface BuildJob {
  id: string;                    // UUID
  created_at: string;            // ISO 8601
  updated_at: string;
  source_type: BuildSourceType;
  source_ref: string;            // raw input, URL, or repo path
  intent: BuildIntent;
  plan: BuildPlan;
  status: BuildStatus;
  steps: BuildStep[];
  agent_assignments: Record<string, string>; // step_id → agent name
  result?: BuildResult;
  error?: string;
}

type BuildSourceType =
  | 'prompt'
  | 'url'
  | 'doc'
  | 'repo_path'
  | 'parse_result'
  | 'chatgpt_response';

type BuildIntent =
  | 'worker_mcp'
  | 'worker_site'
  | 'content_api'
  | 'static_blog'
  | 'prompt_library'
  | 'd1_index_app'
  | 'full_site'
  | 'tool_belt'
  | 'knowledge_product'
  | 'unknown';

type BuildStatus =
  | 'planning'
  | 'composing'
  | 'committing'
  | 'deploying'
  | 'testing'
  | 'registering'
  | 'complete'
  | 'failed'
  | 'cancelled'
  | 'awaiting_approval';

interface BuildPlan {
  repo_type: BuildIntent;
  worker_name?: string;           // afo-<domain>-<purpose>-mcp
  required_mcps: string[];
  cloudflare_resources: string[];
  composer_template?: string;
  estimated_files: number;
  notes: string;
}

interface BuildStep {
  id: string;
  order: number;
  type: 'parse' | 'compose' | 'commit' | 'deploy' | 'test' | 'register';
  status: 'pending' | 'running' | 'complete' | 'failed' | 'skipped';
  tool_call?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}

interface BuildResult {
  repo_url?: string;
  commit_sha?: string;
  deploy_url?: string;
  mcp_url?: string;
  health_url?: string;
  toolsmith_tool_id?: string;
  smoke_test_passed?: boolean;
}
```

---

## Tools — v0.1 (8 core tools)

### 1. `toolsmith_builder_status`

Returns worker name, version, bindings, and tool list.

```json
{
  "name": "toolsmith_builder_status",
  "description": "Return toolsmith-builder-mcp status, version, and binding health.",
  "inputSchema": {
    "type": "object",
    "properties": {},
    "required": []
  }
}
```

---

### 2. `classify_build_intent`

Accepts a raw input string and returns a classified `BuildIntent` with confidence and reasoning.

```json
{
  "name": "classify_build_intent",
  "description": "Classify a raw input — idea, URL, doc, or paste — into a build intent category.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "source_type": {
        "type": "string",
        "enum": ["prompt","url","doc","repo_path","parse_result","chatgpt_response"]
      },
      "source_ref": {
        "type": "string",
        "description": "The raw input text, URL, or repo path to classify."
      }
    },
    "required": ["source_type", "source_ref"]
  }
}
```

**Returns:**
```json
{
  "intent": "worker_mcp",
  "confidence": "high",
  "reasoning": "Input describes a Cloudflare Worker with JSON-RPC tools.",
  "suggested_worker_name": "afo-example-mcp",
  "suggested_composer_template": null
}
```

---

### 3. `create_build_plan`

Takes classified intent + source and returns a full `BuildPlan` with ordered `BuildStep[]`.

```json
{
  "name": "create_build_plan",
  "description": "Produce a structured build plan from a source input and classified intent.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "source_type": { "type": "string" },
      "source_ref": { "type": "string" },
      "intent": { "type": "string" },
      "worker_name": { "type": "string", "description": "Optional afo-<domain>-<purpose>-mcp override." },
      "options": { "type": "object", "description": "Optional flags: skip_deploy, skip_test, experimental." }
    },
    "required": ["source_type", "source_ref", "intent"]
  }
}
```

---

### 4. `start_build_job`

Creates and persists a `BuildJob` in D1. Returns `job_id` for tracking.

```json
{
  "name": "start_build_job",
  "description": "Create and store a build job from a build plan. Returns job_id.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "source_type": { "type": "string" },
      "source_ref": { "type": "string" },
      "intent": { "type": "string" },
      "plan": { "type": "object", "description": "BuildPlan object from create_build_plan." }
    },
    "required": ["source_type", "source_ref", "intent", "plan"]
  }
}
```

---

### 5. `get_build_job_status`

Fetch a build job by ID. Returns current status, steps, and results.

```json
{
  "name": "get_build_job_status",
  "description": "Fetch a build job by ID and return its current status, steps, and results.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "job_id": { "type": "string" }
    },
    "required": ["job_id"]
  }
}
```

---

### 6. `approve_build_step`

Advance a step from `awaiting_approval` to `running`.

```json
{
  "name": "approve_build_step",
  "description": "Approve a pending build step so it can proceed.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "job_id": { "type": "string" },
      "step_id": { "type": "string" },
      "approved_by": { "type": "string" }
    },
    "required": ["job_id", "step_id"]
  }
}
```

---

### 7. `cancel_build_job`

Cancel a job. Requires explicit `confirm: true` (AFO destructive action rule).

```json
{
  "name": "cancel_build_job",
  "description": "Cancel a build job. Requires confirm: true.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "job_id": { "type": "string" },
      "reason": { "type": "string" },
      "confirm": { "type": "boolean" }
    },
    "required": ["job_id", "confirm"]
  }
}
```

---

### 8. `list_build_jobs`

Return recent build jobs, filterable by status or intent.

```json
{
  "name": "list_build_jobs",
  "description": "List recent build jobs with optional status and intent filters.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "status": { "type": "string" },
      "intent": { "type": "string" },
      "limit": { "type": "number" }
    },
    "required": []
  }
}
```

---

## Endpoints

```
GET  /health   → { status, worker, version, bindings, tools }
POST /mcp      → JSON-RPC surface
OPTIONS *      → 204 CORS preflight
```

## Health Response Shape

```json
{
  "status": "ok",
  "worker": "toolsmith-builder-mcp",
  "version": "0.1.0",
  "bindings": {
    "DB": true,
    "OPENAI_API_KEY": true
  },
  "tools": [
    "toolsmith_builder_status",
    "classify_build_intent",
    "create_build_plan",
    "start_build_job",
    "get_build_job_status",
    "approve_build_step",
    "cancel_build_job",
    "list_build_jobs"
  ]
}
```

---

## Bindings Required

| Binding | Type | Required | Purpose |
|---|---|---|---|
| `DB` | D1 | Yes | Persist build jobs, steps, results |
| `OPENAI_API_KEY` | Secret | Optional | Power `classify_build_intent` LLM call (v0.1 uses heuristics) |
| `DEFAULT_OWNER` | Plain var | Yes | GitHub org default (`nothinginfinity`) |
| `DEFAULT_REPO` | Plain var | No | Default artifact repo |

---

## Worker MCP Skeleton (AFO Pattern)

```js
const NAME = 'toolsmith-builder-mcp';
const VERSION = '0.1.0';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};

const R = (x, status = 200) => Response.json(x, {
  status,
  headers: { ...CORS, 'cache-control': 'no-store' }
});

function ok(id, result) {
  return R({ jsonrpc: '2.0', id, result });
}
function txt(id, x) {
  return R({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(x, null, 2) }] } });
}
function er(id, e) {
  return R({ jsonrpc: '2.0', id, error: { code: -32603, message: String(e.message || e) } });
}

// tools array, call(), mcp(), export default fetch() — see full src/index.ts
```

See `src/index.ts` for complete implementation (to be committed by Claude/ChatGPT after deploy prep).

---

## Example User Flow

```
User pastes: "Build an MCP that takes a URL and returns structured contact info"

→ classify_build_intent
    source_type: 'prompt'
    → intent: 'worker_mcp', suggested_worker_name: 'afo-contact-extractor-mcp'

→ create_build_plan
    → required_mcps: ['cloudflare-multipart-mcp', 'afo-gitzip-push-mcp']
    → steps: [compose → commit → deploy → test → register]

→ start_build_job
    → job_id: 'bld-20260527-001'
    → status: 'planning'

→ [Claude] executes commit + deploy steps
→ [Smoke Test MCP] runs tests
→ [Toolsmith registry MCP] registers tool
→ build_job status: 'complete'
→ result: { repo_url, deploy_url, mcp_url, toolsmith_tool_id }
```

---

## v0.1 Acceptance Criteria

- [ ] `GET /health` returns 200 with binding booleans only
- [ ] `POST /mcp` handles all 8 tools
- [ ] `classify_build_intent` returns intent + confidence for a test prompt
- [ ] `create_build_plan` returns valid plan with ordered steps for `worker_mcp` intent
- [ ] `start_build_job` persists a job to D1 and returns job_id
- [ ] `get_build_job_status` retrieves the job correctly
- [ ] `cancel_build_job` requires `confirm: true` or returns error
- [ ] `list_build_jobs` returns recent jobs with correct shape
- [ ] CORS headers on all responses
- [ ] No secrets exposed in any response

---

## v0.2 Planned Additions

```
generate_tool_spec          — produce full MCP tool spec from build plan
generate_repo_spec          — produce wrangler.toml + file manifest
estimate_required_capabilities — token/complexity estimate
resume_build_job            — retry a failed step
attach_build_result         — add deploy URL / commit SHA / smoke test to job
```

---

## Agent Responsibilities

| Agent | Responsibility |
|---|---|
| **Alice** | This spec, registry tool, build job model, review gates |
| **Claude** | GitZip atomic commit, Cloudflare deploy/status, D1/binding integration |
| **ChatGPT** | Roadmap/specs, schema validation, composer output tests, handoff specs |

---

## Post-Deploy Handoff Checklist

1. Claude: `create_d1_database("toolsmith-builder-db")` via AFO D1 Admin MCP
2. Claude: `deploy_worker_with_bindings` via cloudflare-multipart-mcp
3. Jared: add custom domain `toolsmith-builder-mcp.agentfeedoptimization.com`
4. Jared: add `OPENAI_API_KEY` secret if LLM classification wanted in v0.1
5. Any agent: run `toolsmith_builder_status` smoke test
6. Alice: post handoff bulletin to `shared/bulletin.md`

---

## References

- ChatGPT bulletin: `shared/bulletin.md` — `[MSG-C-S-20260527]` Toolsmith Automatic Application Builder
- AFO doctrine: `shared/instructions/afo-mcp-builder-doctrine.md`
- Long-form guide: `nothinginfinity/repo-copilot` → `docs/afo-mcp-builder-space-instructions.md`
