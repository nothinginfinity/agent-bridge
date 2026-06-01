# AFO UI Belt — Perplexity Handoff

from: ChatGPT  
to: Perplexity / Alice / Claude / AFO agents  
project: afo-ui-belt  
type: implementation handoff  
date: 2026-06-01  
priority: high  

---

## Context

Jared wants a small internal **AFO UI Belt**: a group of Cloudflare Worker MCPs/apps that can generate, validate, repair, and assemble functional UIs for AFO dashboards.

The goal is not fancy design first. The goal is:

> Functional UI that just works: buttons click, tabs switch, forms submit, tables search/filter, endpoints bind, copy buttons copy, admin gates work, and the page exposes a contract that can be audited.

Core principle from `shared/specs/afo-ui-belt-v0.1.md`:

> The MCPs are the factory. The final deployed page is still one normal Cloudflare Worker.

---

## Existing Spec

Primary spec already exists at:

```text
shared/specs/afo-ui-belt-v0.1.md
```

It defines:

- `afo-buttons-mcp`
- `afo-forms-mcp`
- `afo-tables-mcp`
- `afo-layout-mcp`
- `afo-api-binder-mcp`
- `afo-ui-auditor-mcp`
- `afo-ui-composer-mcp`

Every generated UI should expose:

```text
GET /health
GET /ui-contract.json
GET /api/self-test
GET /api/ui-audit
```

Every UI component should be contract-bound, not raw untracked HTML.

---

## What ChatGPT Already Built

### 1. `afo-buttons-mcp`

Deployed Cloudflare Worker:

```text
https://afo-buttons-mcp.jaredtechfit.workers.dev/
https://afo-buttons-mcp.jaredtechfit.workers.dev/health
https://afo-buttons-mcp.jaredtechfit.workers.dev/llms.txt
https://afo-buttons-mcp.jaredtechfit.workers.dev/mcp
```

Build id:

```text
AFO_BUTTONS_MCP_v0_1_2026-06-01
```

Current tools exposed:

```text
buttons_status
audit_html_buttons
validate_ui_contract
generate_safe_tab_ui
generate_button_patch
audit_live_page
```

Current purpose:

- static audit of HTML buttons/tabs/sections/forms
- detect missing tab sections
- detect missing click handlers
- detect duplicate ids
- detect missing explicit `type="button"`
- generate safe tab UI
- generate safe tab/button patch
- audit live page HTML

Important: this is v0.1 and should be backed into GitHub source under:

```text
workers/afo-buttons-mcp/worker.js
workers/afo-buttons-mcp/wrangler.toml
workers/afo-buttons-mcp/ui-contract.json
workers/afo-buttons-mcp/README.md
```

### 2. `afo-tool-url-code-index-v1`

Separate Worker created for Jared’s Worker URL/code index. It does **not** touch `workshop.agentfeedoptimization.com`.

Working URL pattern:

```text
https://afo-tool-url-code-index-v1.jaredtechfit.workers.dev/
```

Goal:

- Tool URL Index
- MCP Connect Index
- Worker Code Index
- Admin Source Vault with simple passcode

Problem discovered:

- UI buttons/tabs broke in the front-end, which is exactly why AFO Buttons MCP was needed.
- Backend/source-vault concept is useful, but UI needs to be repaired using AFO Buttons / UI Belt standards.

Admin passcode used in previous attempt:

```text
AFO-SourceVault-v1-7392
```

Do not assume this is final or safe long-term. Treat it as temporary.

---

## Recommended Next Work

### Immediate Task A — Put `afo-buttons-mcp` source into GitHub

Create:

```text
workers/afo-buttons-mcp/worker.js
workers/afo-buttons-mcp/wrangler.toml
workers/afo-buttons-mcp/ui-contract.json
workers/afo-buttons-mcp/README.md
```

The Worker should include:

```text
GET /
GET /health
GET /llms.txt
GET /ui-contract.json
GET /api/self-test
GET /api/ui-audit
GET /mcp
POST /mcp
POST /audit/html
POST /audit/contract
POST /generate/tab-ui
```

MCP tools:

```text
buttons_status
audit_html_buttons
validate_ui_contract
generate_safe_tab_ui
generate_button_patch
audit_live_page
```

Add tests/examples for:

- valid tab UI
- broken tab UI with missing section
- missing click handler
- duplicate ids
- copy button warning

---

### Immediate Task B — Write `afo-buttons-mcp-v0.1.md`

Create:

```text
shared/specs/afo-buttons-mcp-v0.1.md
```

It should include:

- purpose
- routes
- tools
- input/output schemas
- examples
- UI contract shape
- non-destructive rules
- future browser-click-test extension

---

### Immediate Task C — Repair `afo-tool-url-code-index-v1` using UI Belt rules

Do **not** touch:

```text
workshop.agentfeedoptimization.com
DNS
routes
existing MCP Workers
```

Only repair the separate index Worker.

The UI must expose:

```text
GET /health
GET /ui-contract.json
GET /api/self-test
GET /api/ui-audit
GET /api/url-index
GET /api/code-index
GET /api/url-index.csv
GET /api/source/:worker  (admin passcode protected)
```

UI tabs:

```text
urls
connect
code
source
exports
```

Required buttons/controls:

```text
refresh
copyAll
csv
savePass
loadSource
copySource
```

Use contract-bound actions. Avoid inline generated JS that uses brittle `onclick=` strings. Use `addEventListener` after DOM load.

Add `/ui-contract.json` and make AFO Buttons audit pass before deploy.

---

## Architecture Recommendation

Build the UI Belt in GitHub first, then deploy to Cloudflare.

Recommended repo layout:

```text
shared/specs/
  afo-ui-belt-v0.1.md
  afo-buttons-mcp-v0.1.md
  afo-tables-mcp-v0.1.md
  afo-forms-mcp-v0.1.md
  afo-layout-mcp-v0.1.md
  afo-api-binder-mcp-v0.1.md
  afo-ui-auditor-mcp-v0.1.md
  afo-ui-composer-mcp-v0.1.md

workers/
  afo-buttons-mcp/
    worker.js
    wrangler.toml
    ui-contract.json
    README.md

  afo-tool-url-code-index-v1/
    worker.js
    wrangler.toml
    ui-contract.json
    README.md
```

Later add:

```text
workers/afo-tables-mcp/
workers/afo-forms-mcp/
workers/afo-layout-mcp/
workers/afo-api-binder-mcp/
workers/afo-ui-auditor-mcp/
workers/afo-ui-composer-mcp/
```

---

## Safety / Non-Destructive Rules

Add this explicitly to specs:

```text
UI Belt MCPs do not mutate existing Workers by default.
UI Belt MCPs generate patches, source, contracts, and audits.
Deployment requires a separate deploy tool and explicit approval.
Existing production pages are never overwritten unless Jared explicitly requests it.
```

This is important because Jared is worried about breaking working pages.

---

## Component Output Shape Standard

Every generator should return:

```json
{
  "ok": true,
  "component_type": "button_group",
  "html": "...",
  "css": "...",
  "js": "...",
  "contract": {},
  "dependencies": [],
  "warnings": []
}
```

Composer should only assemble components that conform to this shape.

---

## First Implementation Priority

1. Finalize `afo-buttons-mcp` in GitHub.
2. Add `/ui-contract.json`, `/api/self-test`, `/api/ui-audit` to `afo-buttons-mcp`.
3. Use `afo-buttons-mcp` to audit/repair `afo-tool-url-code-index-v1`.
4. Create specs for `afo-tables-mcp` and `afo-forms-mcp`.
5. Build `afo-tables-mcp` next.
6. Build `afo-forms-mcp` next.
7. Build composer only after smaller tools have stable output contracts.

---

## Perplexity Prompt Summary

Jared needs help finishing the AFO UI Belt. Start by reading:

```text
shared/specs/afo-ui-belt-v0.1.md
shared/hand-offs/afo-ui-belt-perplexity-handoff-2026-06-01.md
```

Then create the GitHub source and specs for `afo-buttons-mcp`, repair the separate `afo-tool-url-code-index-v1` UI using contract-bound tabs/buttons, and do not touch `workshop.agentfeedoptimization.com`.
