# AFO Site Bundle dry-run commands

This document describes the preview-safe AFO Site Bundle command surface for `afo-mobile-terminal-mcp`.

Implementation:

```text
workers/afo-mobile-terminal-mcp/src/afo-site-bundle-commands.js
```

Default GitHub source:

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

## Safe commands

| Command | Effect |
|---|---|
| `validate_bundle` | Reads the bundle and schema from GitHub and validates schema and preview gates. |
| `validate_worker` | Reads Worker files from GitHub and validates required files, config safety, scripts, and routes. |
| `preview_plan` | Returns a preview-only plan. Does not run the plan. |
| `smoke_test_plan` | Returns route checks for a future preview URL. |
| `write_validation_receipt` | Writes a dry-run validation receipt to GitHub only through POST or a guarded GET/cmd fallback. |

## Receipt write routes

`POST /bundle/write-validation-receipt` remains supported for real HTTP clients that can issue true POST requests.

For mobile/agent tools that cannot reliably issue true external POST requests, the Worker also exposes this guarded GET action:

```text
GET /bundle/write-validation-receipt-action?confirm=dry-run-receipt
```

If the `confirm` query parameter is missing or incorrect, the route returns `blocked: true`, `ok: false`, and writes nothing.

When confirmed, the route runs the same `write_validation_receipt` logic and writes or updates:

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
- `invocation_method: "GET guarded action"`

## `/cmd` write guard

Read-only commands may remain GET-accessible through `/cmd/:command`:

- `/cmd/validate_bundle`
- `/cmd/validate_worker`
- `/cmd/preview_plan`
- `/cmd/smoke_test_plan`

The GET slash command for writing receipts is guarded:

```text
GET /cmd/write_validation_receipt?confirm=dry-run-receipt
```

Without `confirm=dry-run-receipt`, `/cmd/write_validation_receipt` returns a blocked response and writes nothing.

## Blocked commands

These commands exist as blocked/no-op responses only:

| Command | Status |
|---|---|
| `deploy_worker` | blocked |
| `register_worker` | blocked |
| `write_production_receipt` | blocked |

Each blocked command returns a response explaining that this layer is dry-run only, production requires `deployment.confirmed = true`, production requires explicit operator approval in the current task, and no production action was taken.

## HTTP route mapping

| Route | Method | Command |
|---|---:|---|
| `/bundle/validate` | GET | `validate_bundle` |
| `/bundle/worker/validate` | GET | `validate_worker` |
| `/bundle/preview-plan` | GET | `preview_plan` |
| `/bundle/smoke-test-plan` | GET | `smoke_test_plan` |
| `/bundle/write-validation-receipt` | POST | `write_validation_receipt` |
| `/bundle/write-validation-receipt-action?confirm=dry-run-receipt` | GET | guarded `write_validation_receipt` |
| `/bundle/deploy-worker` | POST | blocked `deploy_worker` |
| `/bundle/register-worker` | POST | blocked `register_worker` |
| `/bundle/write-production-receipt` | POST | blocked `write_production_receipt` |

## Safety constraints

This layer only validates, plans, and writes dry-run validation receipts. It does not create runtime routes, attach domains, alter account identifiers, change protected runtime values, mark the bundle as confirmed, or write production receipts.
