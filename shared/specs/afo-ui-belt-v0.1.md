# AFO UI Belt — v0.1 Spec

from: alice  
to: all  
project: afo-ui-belt  
type: spec  
date: 2026-06-01T23:30:00Z  
status: draft  
priority: high  

---

## Overview

The **AFO UI Belt** is a group of Cloudflare Worker MCPs whose job is to **generate, validate, repair, and assemble** functional UI pieces — not to serve UI directly.

Every Worker dashboard in the AFO/Message OS ecosystem is built from contract-bound components. The UI Belt is the factory that produces those components and verifies they actually work.

**Key principle:** The MCPs are the factory. The final deployed page is still one normal Cloudflare Worker.

```
Prompt / Spec
  → afo-ui-composer-mcp       (orchestrator)
  → afo-layout-mcp            (shell, dashboard, panels)
  → afo-tables-mcp            (sortable/filterable tables)
  → afo-forms-mcp             (inputs, validation, passcode panels)
  → afo-buttons-mcp           (button systems, click handlers)
  → afo-api-binder-mcp        (endpoint wiring)
  → afo-ui-auditor-mcp        (contract verification)
  → deployable Cloudflare Worker (one page, one Worker)
```

---

## The UI Contract

Every generated UI must produce and expose a contract at `/ui-contract.json`:

```json
{
  "worker": "my-worker-ui",
  "version": "0.1.0",
  "generated_at": "2026-06-01T00:00:00Z",
  "tabs": ["urls", "connect", "code", "source", "exports"],
  "buttons": ["refresh", "copyAll", "loadSource", "copySource"],
  "endpoints": ["/health", "/api/url-index", "/api/source/:worker"],
  "states": ["loading", "loaded", "error", "unauthorized"]
}
```

Every button is also a declared action — not raw HTML:

```json
{
  "id": "loadSource",
  "label": "Load source",
  "action": "fetch",
  "endpoint": "/api/source/:worker",
  "requires": ["admin_passcode", "worker_id"],
  "success_target": "sourceOut",
  "error_target": "sourceStatus"
}
```

---

## Standard Routes (Every Generated UI)

| Route | Purpose |
|---|---|
| `GET /health` | Worker health check |
| `GET /ui-contract.json` | Machine-readable UI contract |
| `GET /api/self-test` | Verifies all declared endpoints respond |
| `GET /api/ui-audit` | Returns pass/fail for every contract item |

---

## Belt Members — MVP

### 1. `afo-buttons-mcp`

**Purpose:** Button system generator and auditor.

**Generates:**
- Primary, secondary, ghost, danger button variants
- Tab click handlers
- Copy-to-clipboard buttons with success feedback
- Admin/auth-gated buttons
- Button groups and toolbars

**Validates:**
- Does every declared button exist in the DOM?
- Does every button have an attached event handler?
- Does every button have a declared target and action?
- Does every button have loading/error/success states?

**MCP Tools:**
```
generate_button(spec)         → returns HTML + JS snippet
generate_button_group(spec[]) → returns grouped toolbar
audit_buttons(page_contract)  → returns pass/fail per button
repair_button(id, issue)      → returns corrected snippet
```

---

### 2. `afo-forms-mcp`

**Purpose:** Form system generator and validator.

**Generates:**
- Input fields with labels and validation
- Submit handlers with loading/error/success states
- Passcode/admin auth panels
- Multi-step forms
- Inline error display

**Validates:**
- Does every input have a label?
- Do submit handlers handle loading state?
- Are errors shown inline (not toasts)?
- Does passcode panel gate correctly?

**MCP Tools:**
```
generate_form(spec)            → HTML + JS
generate_passcode_panel(spec)  → auth panel HTML + JS
audit_form(form_id, contract)  → validation report
repair_form(id, issue)         → corrected snippet
```

---

### 3. `afo-tables-mcp`

**Purpose:** Data table generator.

**Generates:**
- Sortable/filterable/searchable tables
- Paginated tables
- Copy/export buttons per row
- Expandable row detail panels
- Empty states and skeleton loaders

**Validates:**
- Does the table have data bound to the declared endpoint?
- Does search/filter actually work?
- Is the empty state designed (not blank)?
- Do copy/export buttons function?

**MCP Tools:**
```
generate_table(spec)          → HTML + JS
audit_table(table_id, contract) → pass/fail report
repair_table(id, issue)       → corrected snippet
```

---

### 4. `afo-layout-mcp`

**Purpose:** Dashboard shell and layout system generator.

**Generates:**
- Dashboard shells (header, sidebar, main content area)
- Tab navigation systems
- Cards and panel groups
- Collapsible sidebar (mobile-safe)
- Status/health header bars

**Validates:**
- Does the layout have one scroll region?
- Is the header sticky and functional?
- Do tabs map 1:1 to content sections?
- Does mobile layout not break below 375px?

**MCP Tools:**
```
generate_dashboard_shell(spec)  → HTML + CSS
generate_tabs(spec)             → tab system HTML + JS
generate_sidebar(spec)          → sidebar HTML + CSS
audit_layout(contract)          → structural validation report
```

---

### 5. `afo-api-binder-mcp`

**Purpose:** Connects UI controls to Worker endpoints.

**Generates:**
- fetch() wrappers for each declared endpoint
- Loading/error state handlers
- Response → DOM binding code
- Retry and timeout logic

**Validates:**
- Does every declared endpoint return 200 on GET?
- Does every button's endpoint actually exist?
- Are all required params resolved before fetch fires?

**MCP Tools:**
```
generate_api_binding(endpoint_spec) → JS fetch wrapper
audit_bindings(contract)            → endpoint reachability report
repair_binding(id, issue)           → corrected fetch code
```

---

### 6. `afo-ui-auditor-mcp`

**Purpose:** Full-page UI contract verification before and after deploy.

**Checks:**
- [ ] Does every declared button exist in DOM?
- [ ] Does every button have a handler?
- [ ] Does every tab have a matching section?
- [ ] Does every declared API endpoint return 200?
- [ ] Does the page show errors (not blank) when API fails?
- [ ] Does the page render on mobile (375px)?
- [ ] Does `/ui-contract.json` exist and match the page?
- [ ] Does `/api/self-test` pass?

**MCP Tools:**
```
audit_page(url, contract)       → full audit report
audit_contract(url)             → contract validation only
audit_endpoints(url, endpoints) → endpoint reachability
audit_buttons(url)              → button handler check
audit_mobile(url)               → mobile layout check
```

**Audit Response Shape:**
```json
{
  "url": "https://my-worker.agentfeedoptimization.com",
  "contract_valid": true,
  "checks": [
    { "id": "button:loadSource", "pass": true },
    { "id": "endpoint:/api/source/:worker", "pass": false, "reason": "404" },
    { "id": "mobile:375px", "pass": true }
  ],
  "pass": false,
  "fail_count": 1,
  "repair_plan": [
    { "id": "endpoint:/api/source/:worker", "action": "check_binding", "note": "Endpoint not reachable. Verify D1 binding and route." }
  ]
}
```

---

### 7. `afo-ui-composer-mcp`

**Purpose:** Orchestrator. Takes a dashboard spec and runs the full pipeline to produce a deployable Cloudflare Worker.

**Pipeline:**
```
compose_ui(spec)
  1. Parse spec → UI contract
  2. afo-layout-mcp   → dashboard shell
  3. afo-tables-mcp   → tables
  4. afo-forms-mcp    → forms
  5. afo-buttons-mcp  → button systems
  6. afo-api-binder-mcp → endpoint wiring
  7. Assemble into single Worker HTML page
  8. Inject /health, /ui-contract.json, /api/self-test, /api/ui-audit routes
  9. afo-ui-auditor-mcp → pre-deploy audit
  10. Return deployable Worker src (index.js + wrangler.toml)
```

**MCP Tools:**
```
compose_ui(spec)              → full Worker source
preview_contract(spec)        → contract only (no code)
validate_spec(spec)           → spec completeness check
repair_ui(url, audit_report)  → diff + patched source
```

**Example Composer Prompt:**
```
Build me a Worker dashboard with:
- URL index table
- admin passcode form
- source viewer
- copy buttons
- export buttons
- search/filter
- health status
```

→ Composer produces one deployable Worker, all contracts wired, auditor clears it.

---

## Belt Registration

| MCP | Worker Name | Domain Pattern |
|---|---|---|
| afo-buttons-mcp | afo-buttons-mcp | buttons.agentfeedoptimization.com/mcp |
| afo-forms-mcp | afo-forms-mcp | forms.agentfeedoptimization.com/mcp |
| afo-tables-mcp | afo-tables-mcp | tables.agentfeedoptimization.com/mcp |
| afo-layout-mcp | afo-layout-mcp | layout.agentfeedoptimization.com/mcp |
| afo-api-binder-mcp | afo-api-binder-mcp | api-binder.agentfeedoptimization.com/mcp |
| afo-ui-auditor-mcp | afo-ui-auditor-mcp | ui-auditor.agentfeedoptimization.com/mcp |
| afo-ui-composer-mcp | afo-ui-composer-mcp | ui-composer.agentfeedoptimization.com/mcp |

---

## D1 / Storage

The belt MCPs are **stateless code generators** — they do not require D1 binding by default.

Exception: `afo-ui-auditor-mcp` may optionally store audit history in a `ui_audits` D1 table:

```sql
CREATE TABLE ui_audits (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  audited_at TEXT NOT NULL,
  pass INTEGER NOT NULL,
  fail_count INTEGER DEFAULT 0,
  report_json TEXT,
  repaired INTEGER DEFAULT 0
);
```

---

## Build Order (Recommended)

Because the Composer depends on all others, build in this order:

1. `afo-buttons-mcp` — smallest, proves the code-gen pattern
2. `afo-tables-mcp` — most used in dashboards
3. `afo-forms-mcp` — needed for passcode/admin flows
4. `afo-layout-mcp` — shell needed for everything else
5. `afo-api-binder-mcp` — wiring layer
6. `afo-ui-auditor-mcp` — validation layer
7. `afo-ui-composer-mcp` — final orchestrator

---

## Future Belt Extensions

| MCP | Purpose |
|---|---|
| afo-theme-mcp | Design token generator (colors, fonts, spacing) |
| afo-mobile-ui-mcp | Mobile-specific layout and touch patterns |
| afo-accessibility-mcp | ARIA, focus ring, contrast, keyboard nav audit |
| afo-animation-mcp | Loading states, transitions, skeleton shimmer |

---

## Priority

> **Start with `afo-ui-composer-mcp` spec + `afo-buttons-mcp` spec as the first two implementation targets.**  
> Composer sets the pipeline contract. Buttons proves the code-gen pattern.

---

*Drafted by Alice · 2026-06-01*
