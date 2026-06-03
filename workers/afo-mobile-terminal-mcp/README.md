# afo-mobile-terminal-mcp

> Preview-safe Mobile Terminal command surface for AFO Site Bundle validation and dry-run planning.

**Repo path:** `workers/afo-mobile-terminal-mcp/`  
**Version:** `0.3.0`  
**Source of truth:** GitHub  
**Runtime rule:** this layer does not deploy or mutate Cloudflare runtime state.

---

## AFO Site Bundle source

Default source consumed by the bundle commands:

```json
{
  "owner": "nothinginfinity",
  "repo": "afo-site-bundle-contract",
  "ref": "main",
  "bundle_path": "examples/example-business/afo.site.bundle.json",
  "schema_path": "schema/afo.site.bundle.schema.json",
  "worker_path": "examples/example-business/worker",
  "receipt_path": "receipts/example-business.validation.dry-run.json"
}
```

---

## HTTP routes

| Route | Method | Description |
|---|---:|---|
| `/` | GET | Minimal command UI |
| `/health` | GET | Health check; exposes no secret values |
| `/llms.txt` | GET | LLM-readable command description |
| `/tools/list` | GET | MCP tool catalog |
| `/mcp` | POST | MCP `tools/list` and `tools/call` endpoint |
| `/cmd/help` | GET | Slash-command help |
| `/cmd/:command` | GET | Slash-command wrapper for Site Bundle commands |
| `/bundle/validate` | GET | Runs `validate_bundle` |
| `/bundle/worker/validate` | GET | Runs `validate_worker` |
| `/bundle/preview-plan` | GET | Runs `preview_plan` |
| `/bundle/smoke-test-plan` | GET | Runs `smoke_test_plan` |
| `/bundle/write-validation-receipt` | POST | Runs `write_validation_receipt` |
| `/bundle/deploy-worker` | POST | Blocked/no-op `deploy_worker` response |
| `/bundle/register-worker` | POST | Blocked/no-op `register_worker` response |
| `/bundle/write-production-receipt` | POST | Blocked/no-op `write_production_receipt` response |

---

## Safe commands

### `validate_bundle`

Reads the bundle and schema from GitHub and confirms:

- `schema` is `afo.site.bundle`
- `schema_version` is `1.0.0`
- `deployment.deploy_mode` is `preview_first`
- `deployment.confirmed` is `false`
- `deployment.environment` is `preview`
- `worker.routes` is empty

### `validate_worker`

Reads Worker files from GitHub and confirms:

- `package.json` exists
- `wrangler.toml` exists
- `src/index.ts` exists
- Wrangler config has no live route entries
- Wrangler config has no account-scoped identifiers
- Wrangler config has no custom domain entries
- Wrangler config has no vars block
- Wrangler config has no protected key entries
- Worker source explicitly supports `/`, `/health`, `/llms.txt`, `/robots.txt`, `/sitemap.xml`, and `/schema.json`

### `preview_plan`

Returns a preview-only plan. It does not run preview.

Expected plan values:

```json
{
  "mode": "dry_run_only",
  "allowed_command": "npm run preview",
  "working_directory": "examples/example-business/worker",
  "runtime_publish_blocked": true
}
```

### `smoke_test_plan`

Returns route checks for a future preview URL:

- `GET /` expects `200` and `text/html`
- `GET /health` expects `200` and `application/json`
- `GET /llms.txt` expects `200` and `text/plain`
- `GET /robots.txt` expects `200` and `text/plain`
- `GET /sitemap.xml` expects `200` and `application/xml`
- `GET /schema.json` expects `200` and `application/json`

### `write_validation_receipt`

Writes or updates a dry-run validation receipt at:

```text
receipts/example-business.validation.dry-run.json
```

The receipt includes:

- `dry_run: true`
- `deployed: false`
- `production_deploy_attempted: false`
- `runtime_publish_attempted: false`
- source repo info
- validation checks
- preview plan
- smoke-test plan
- timestamp
- acting system name

---

## Blocked commands

These commands are present only as blocked/no-op responses in this layer:

- `deploy_worker`
- `register_worker`
- `write_production_receipt`

Each blocked response explains that:

- this layer is dry-run only
- production requires `deployment.confirmed = true`
- production requires explicit operator approval in the current task
- no production action was taken

---

## MCP usage

List tools:

```json
{
  "method": "tools/list"
}
```

Call a tool:

```json
{
  "method": "tools/call",
  "params": {
    "name": "validate_bundle",
    "arguments": {}
  }
}
```

---

## Local checks

```bash
cd workers/afo-mobile-terminal-mcp
npm install
npm run check
```

`npm run check` performs JavaScript syntax checks only. It does not deploy.

---

## Safety constraints

This layer does not:

- run `wrangler deploy`
- create production routes
- add custom domains
- add account-scoped identifiers
- add protected runtime values
- set `deployment.confirmed` to `true`
- mutate Cloudflare runtime state

The only write operation is `write_validation_receipt`, which writes a dry-run receipt to the GitHub source-of-truth repo after validation passes.
