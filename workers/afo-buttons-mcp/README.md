# afo-buttons-mcp

**AFO UI Belt — Button System Generator + Auditor**

A stateless Cloudflare Worker MCP that generates, audits, and repairs button systems for Cloudflare Worker UIs. Part of the [AFO UI Belt](../../shared/specs/afo-ui-belt-v0.1.md).

> This is a **factory tool**, not a button itself. It outputs HTML + JS snippets that get assembled into a final Worker page by `afo-ui-composer-mcp`.

---

## Endpoints

| Route | Method | Description |
|---|---|---|
| `/health` | GET | Health check |
| `/mcp` | POST | MCP JSON-RPC 2.0 endpoint |

---

## Tools

| Tool | Description |
|---|---|
| `generate_button` | Generate a single contract-bound button HTML + JS snippet |
| `generate_button_group` | Generate a toolbar from multiple button specs |
| `generate_copy_button` | Generate a clipboard copy button with ✓ success feedback |
| `generate_admin_button` | Generate an admin-gated button hidden until passcode resolves |
| `audit_buttons` | Audit all declared buttons against a UI contract |
| `repair_button` | Return corrected HTML + JS for a button that failed audit |

---

## Deploy

```bash
wrangler deploy
```

Then add custom domain in Cloudflare dashboard:
`buttons.agentfeedoptimization.com` → `afo-buttons-mcp`

---

## No bindings required

Stateless code generator. No D1, no KV, no secrets.

---

## The Button Contract

Every generated button is a **declared action**:

```json
{
  "id": "loadSource",
  "label": "Load source",
  "variant": "primary",
  "action": "fetch",
  "endpoint": "/api/source/:worker",
  "method": "GET",
  "requires": ["admin_passcode", "worker_id"],
  "loading_label": "Loading…",
  "success_target": "sourceOut",
  "error_target": "sourceStatus"
}
```

All generated buttons use `window.__afoState` as the shared state bus. Never localStorage.

---

## Audit checks

`audit_buttons` performs static analysis on a page HTML string:

- `exists` — `data-btn-id` found in HTML
- `has_handler` — JS event listener referencing button's `data-btn-id`
- `has_loading` — `data-loading-label` attribute present (fetch only)
- `has_requires_guard` — all `requires` vars checked in handler
- `has_success_target` — `success_target` id referenced in JS
- `has_error_target` — `error_target` id referenced in JS
- `danger_has_confirm` — `confirm()` call present for danger buttons
- `admin_has_guard` — `afo:passcode-resolved` gate present for admin buttons
- `target_exists` — success/error target DOM ids found in page source

---

## Examples

See `examples/`:
- `valid-button-page.html` — all buttons pass audit
- `broken-button-page.html` — buttons with known issues for testing repair flow

---

*Spec: [shared/specs/afo-buttons-mcp-v0.1.md](../../shared/specs/afo-buttons-mcp-v0.1.md)*  
*Belt: [afo-ui-belt](../../shared/specs/afo-ui-belt-v0.1.md)*
