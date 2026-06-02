# afo-mobile-terminal-mcp

> Command-center layer above individual AFO MCP tools.  
> Orchestrates deploy, smoke test, registry, handoff, and Cloudflare inventory.

**Live URL:** https://afo-mobile-terminal-mcp.jaredtechfit.workers.dev  
**Version:** 0.1.0  
**Repo:** `workers/afo-mobile-terminal-mcp/`

---

## Routes

| Route | Method | Description |
|---|---|---|
| `/` | GET | Mobile terminal UI |
| `/health` | GET | Health check (no secrets exposed) |
| `/llms.txt` | GET | LLM-readable description |
| `/tools/list` | GET | JSON tool catalog |
| `/mcp` | POST | MCP tool surface |
| `/contracts/ui-contract.json` | GET | UI card contract |

---

## Tools

| Tool | Write? | Description |
|---|---|---|
| `list_command_belts` | No | List all configured command belts + live status |
| `list_registered_workers` | No | List workers from registry or GitHub deploys folder |
| `open_worker_urls` | No | Return all live URLs for a worker |
| `validate_worker` | No | Validate Worker folder in GitHub |
| `preview_worker_deploy` | No | Preview deploy plan without writing |
| `deploy_worker` | **Yes** | Deploy from GitHub to Cloudflare (requires `confirmed:true`) |
| `run_smoke_test` | No | Smoke test a live Worker |
| `list_recent_deploys` | No | List deployment receipts from GitHub |
| `register_worker` | **Yes** | Register/update Worker metadata (requires `confirmed:true`) |
| `write_handoff` | **Yes** | Write handoff note (requires `confirmed:true`) |

---

## Integration Targets

| Target | Env Key | Role | Default |
|---|---|---|---|
| `afo-mobile-deploy-mcp` | `DEPLOY_MCP_URL` | deploy, validate, smoke test, receipts | `https://afo-mobile-deploy-mcp.jaredtechfit.workers.dev` |
| AFO registry | `REGISTRY_URL` | list/register workers | not configured |
| handoff-mcp | `HANDOFF_MCP_URL` | write handoffs | not configured |
| Cloudflare gateway | `CF_GATEWAY_URL` | inventory | not configured |
| GitHub | `GITHUB_TOKEN` | source-of-truth, receipts, handoffs | required |

---

## Mobile CLI Pattern

```
iPhone
  → MCP command surface (afo-mobile-terminal-mcp)
    → validate_worker / preview_worker_deploy
    → deploy_worker (confirmed:true)
      → afo-mobile-deploy-mcp → Cloudflare
    → run_smoke_test
    → open_worker_urls
    → list_recent_deploys
    → register_worker (confirmed:true)
    → write_handoff (confirmed:true)
```

---

## Deploy

```bash
cd workers/afo-mobile-terminal-mcp
npm install
npx wrangler deploy
```

Or use GitHub Actions (`.github/workflows/deploy-afo-mobile-terminal-mcp.yml`).

---

## Required Env Bindings (Cloudflare)

| Binding | Type | Notes |
|---|---|---|
| `GITHUB_TOKEN` | Secret | GitHub API token — write receipts, handoffs, register workers |
| `CF_ACCOUNT_ID` | Secret | Cloudflare account ID — needed for `deploy_worker` |
| `CF_API_TOKEN` | Secret | Cloudflare API token — needed for `deploy_worker` |
| `DEPLOY_MCP_URL` | Var | Optional override for afo-mobile-deploy-mcp URL |
| `REGISTRY_URL` | Var | Optional AFO registry URL |
| `HANDOFF_MCP_URL` | Var | Optional handoff-mcp URL |
| `CF_GATEWAY_URL` | Var | Optional Cloudflare infra gateway URL |

> ⚠️ Never expose secret values in `/health`, UI, logs, or receipts.

---

## Security Model

- All **write actions** (`deploy_worker`, `register_worker`, `write_handoff`) are **preview-first** and require `confirmed: true`
- All secrets are server-side env bindings only
- `/health` reports binding presence as `configured` / `not_configured` — never the values
- No credentials forwarded through the UI or logs

---

## Definition of Done — v0.1

An iPhone user can:

1. ✅ Select or type `repo/branch/worker_path/script_name`
2. ✅ Validate Worker folder
3. ✅ Preview deploy
4. ✅ Deploy through `afo-mobile-deploy-mcp`
5. ✅ See smoke-test results
6. ✅ See/open live URLs
7. ✅ See deployment receipt path
8. ✅ Write a handoff note
9. ✅ Register or update Worker metadata
