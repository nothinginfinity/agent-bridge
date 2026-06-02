# afo-mobile-deploy-mcp

Mobile deployment MCP for the AFO tool belt.

It turns this terminal command:

`cd workers/afo-buttons-mcp && wrangler deploy`

into this agent command:

`Deploy workers/afo-buttons-mcp from nothinginfinity/agent-bridge main to Cloudflare as afo-buttons-mcp. Run smoke tests and write receipt.`

## Runtime

iPhone → ChatGPT / Claude / Perplexity → MCP tool belt → GitHub source-of-truth → Cloudflare deploy/runtime → live apps

## Routes

- `GET /health`
- `GET /llms.txt`
- `GET /tools/list`
- `POST /mcp`
- `GET /ui`

## Tools

- `deploy_worker_from_github`
- `preview_worker_from_github`
- `validate_worker_folder`
- `read_worker_bundle`
- `deploy_with_bindings`
- `run_worker_smoke_test`
- `write_deploy_receipt`
- `list_recent_deploys`
- `rollback_worker_to_github_version`
- `diff_live_vs_github`

## Required Cloudflare secrets

- `GITHUB_TOKEN`
- `CF_ACCOUNT_ID`
- `CF_API_TOKEN`

## Optional vars

- `CF_WORKERS_SUBDOMAIN`

## Deploy

```bash
npm install
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put CF_ACCOUNT_ID
npx wrangler secret put CF_API_TOKEN
npx wrangler deploy
```

## Example MCP call

```json
{
  "method": "tools/call",
  "params": {
    "name": "deploy_worker_from_github",
    "arguments": {
      "repo": "nothinginfinity/agent-bridge",
      "branch": "main",
      "worker_path": "workers/afo-buttons-mcp",
      "script_name": "afo-buttons-mcp",
      "run_smoke_tests": true,
      "write_receipt": true
    }
  }
}
```

## Receipt path

`shared/deployments/{script_name}/{timestamp}.json`

## Notes

The MVP uploads module-format Workers through Cloudflare's Worker script upload API. It can parse simple `wrangler.toml` values and accepts explicit `bindings` in tool arguments for D1, KV, R2, and text bindings.
