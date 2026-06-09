# afo-github-clone-mcp

Cloudflare Worker MCP — clones files from one GitHub repo/path to another,
with optional string replacements. Server-side, no size limits.

## Tools

| Tool | Description |
|---|---|
| `clone_status` | Health check — confirms bindings are set |
| `clone_repo_path` | Clone all files from a src directory → dst directory |
| `clone_single_file` | Clone one specific file src → dst |
| `preview_replacements` | Dry-run replacements without writing |

## Required Secrets

Set via Cloudflare dashboard or `wrangler secret put`:

| Secret | Description |
|---|---|
| `GITHUB_TOKEN` | GitHub PAT with `repo` read+write scope |

## Required Vars

Set in `wrangler.toml` or Cloudflare dashboard:

| Var | Description |
|---|---|
| `DEFAULT_OWNER` | Default GitHub org/user (e.g. `nothinginfinity`) |

## GitHub Actions Secrets Required

| Secret | Description |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API token with Workers:Edit permission |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `WORKER_GITHUB_TOKEN` | GitHub PAT — injected as `GITHUB_TOKEN` Worker secret on deploy |

## Endpoint

```
POST https://afo-github-clone-mcp.<your-subdomain>.workers.dev/mcp
GET  https://afo-github-clone-mcp.<your-subdomain>.workers.dev/health
```

## Deploy

Auto-deploys on push to `main` when files under `workers/afo-github-clone-mcp/` change.

Manual deploy:
```bash
cd workers/afo-github-clone-mcp
wrangler deploy
```
