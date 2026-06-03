# AFO Site Bundle dry-run commands

This document describes the preview-safe AFO Site Bundle command surface added for `afo-mobile-terminal-mcp`.

The implementation lives in:

```text
workers/afo-mobile-terminal-mcp/src/afo-site-bundle-commands.js
```

It consumes the GitHub source-of-truth bundle from:

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

The module exports `handleAfoSiteBundleCommand(name, args, env)` and supports:

| Command | Effect |
|---|---|
| `validate_bundle` | Reads the bundle and schema from GitHub and validates schema/safety gates. |
| `validate_worker` | Reads Worker files from GitHub and validates required files, Wrangler safety, scripts, and routes. |
| `preview_plan` | Returns a preview-only plan. Does not run preview and does not publish runtime changes. |
| `smoke_test_plan` | Returns route checks for a future preview URL. |
| `write_validation_receipt` | Writes a dry-run validation receipt to GitHub when validation passes. |

## Blocked commands

These commands exist as blocked/no-op responses only:

| Command | Status |
|---|---|
| `deploy_worker` | blocked |
| `register_worker` | blocked |
| `write_production_receipt` | blocked |

Each blocked command returns a response explaining that this layer is dry-run only, production requires `deployment.confirmed = true`, production requires explicit operator approval in the current task, and no production action was taken.

## Suggested HTTP route mapping

The module exports `handleAfoSiteBundleHttp(request, env)` for Worker route integration.

| Route | Method | Command |
|---|---:|---|
| `/bundle/validate` | GET | `validate_bundle` |
| `/bundle/worker/validate` | GET | `validate_worker` |
| `/bundle/preview-plan` | GET | `preview_plan` |
| `/bundle/smoke-test-plan` | GET | `smoke_test_plan` |
| `/bundle/write-validation-receipt` | POST | `write_validation_receipt` |
| `/bundle/deploy-worker` | POST | blocked `deploy_worker` |
| `/bundle/register-worker` | POST | blocked `register_worker` |
| `/bundle/write-production-receipt` | POST | blocked `write_production_receipt` |

## Required entrypoint wiring

To expose the HTTP routes from `src/index.js`, import the handler:

```js
import { handleAfoSiteBundleHttp, handleAfoSiteBundleCommand, afoSiteBundleTools } from "./afo-site-bundle-commands.js";
```

Then call `handleAfoSiteBundleHttp(request, env)` near the top of the `fetch` handler, before the final not-found response:

```js
const bundleResponse = await handleAfoSiteBundleHttp(request, env);
if (bundleResponse) return jsonRes(bundleResponse);
```

To expose MCP commands, dispatch the Site Bundle tool names before existing deploy/registry command handling:

```js
const siteBundleTools = new Set([
  "validate_bundle",
  "validate_worker",
  "preview_plan",
  "smoke_test_plan",
  "write_validation_receipt",
  "deploy_worker",
  "register_worker",
  "write_production_receipt"
]);

if (siteBundleTools.has(name)) {
  return await handleAfoSiteBundleCommand(name, args, env);
}
```

Also include `afoSiteBundleTools()` in `/tools/list` output when the entrypoint is patched.

## Safety constraints

This layer does not:

- run `wrangler deploy`
- create production routes
- add custom domains
- add account-scoped identifiers
- add protected runtime values
- set `deployment.confirmed` to `true`
- mutate Cloudflare runtime state

The only write operation is `write_validation_receipt`, which writes a dry-run receipt to GitHub after validation passes.
