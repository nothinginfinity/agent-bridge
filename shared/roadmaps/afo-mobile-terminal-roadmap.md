# AFO Mobile Terminal Roadmap

## Current milestone

The first working mobile-terminal slice is live.

`afo-mobile-deploy-mcp` can be opened from an iPhone and used to:

1. validate a Worker folder in GitHub,
2. preview a Cloudflare deployment,
3. deploy a Worker from GitHub to Cloudflare,
4. run smoke tests,
5. write a deployment receipt back to GitHub.

This proves the architecture:

```text
iPhone
→ ChatGPT / Claude / Alice
→ MCP command surface
→ GitHub source-of-truth
→ Cloudflare runtime
→ smoke tests
→ deployment receipts
```

## North star

Replace a meaningful subset of local terminal workflows with agent-callable MCP command surfaces that work from an iPhone.

The goal is not to reproduce every shell command. The goal is to turn high-value commands into safe, inspectable, repeatable MCP tools.

Examples:

```text
git read/write/commit
wrangler deploy
curl smoke tests
Cloudflare inventory
bindings management
route checks
UI audits
rollback
handoff notes
```

## Phase 1 — Stabilize the deploy loop

Status: mostly working.

### Standard Worker route contract

Every AFO Worker should expose:

```text
GET /
GET /health
GET /llms.txt
GET /tools/list
POST /mcp
GET /ui-contract.json or /contracts/ui-contract.json
```

### Deployment receipt contract

Every successful deploy should write a receipt under:

```text
shared/deployments/{script_name}/{timestamp}.json
```

Receipt should include:

```text
repo
branch
worker_path
script_name
commit_sha if available
bundle_hash
deployed_at
urls
smoke_tests
cloudflare status/errors
agent/operator
```

### Immediate hardening tasks

- Fix `validate_worker_folder` so `wrangler.raw_present` is accurate even in validate mode.
- Add support for `/ui-contract.json` as a smoke-test route.
- Improve smoke-test output readability on mobile.
- Add clear deploy confirmation before write actions.
- Add a copyable receipt link in the UI.

## Phase 2 — Build the registry belt

Create or extend a tool registry that records every live Worker/MCP.

Registry fields:

```text
tool_id
name
worker_name
repo
branch
worker_path
primary_url
health_url
mcp_url
llms_url
tools_list_url
latest_receipt_path
last_deployed_at
last_smoke_status
owner_agent
risk_profile
```

New tools:

```text
register_deployed_worker
update_worker_status
list_registered_workers
find_worker_by_capability
mark_worker_degraded
```

## Phase 3 — Add rollback

Make receipts useful for recovery.

Required tools:

```text
list_recent_deploys
get_deploy_receipt
rollback_to_receipt
rollback_to_previous_green
compare_receipts
```

Rollback should:

1. identify previous green receipt,
2. read the corresponding GitHub ref/branch/path,
3. redeploy that version,
4. run smoke tests,
5. write rollback receipt.

## Phase 4 — Add Cloudflare inventory

Create or connect a Cloudflare Inventory MCP.

It should list:

```text
Workers
routes
custom domains
D1 databases
R2 buckets
KV namespaces
service bindings
environment variables/secrets metadata only, never values
health status
```

Useful questions it should answer:

```text
Which Workers are live?
Which Workers are missing /health?
Which Workers are deployed but not registered?
Which Workers have failed smoke tests?
Which Workers have D1/R2/KV bindings?
```

## Phase 5 — Add patch + redeploy workflow

This is where the mobile terminal becomes a remote development loop.

Agent command:

```text
Patch afo-buttons-mcp so /llms.txt follows the AFO standard, commit it, deploy it, run smoke tests, and write a receipt.
```

Workflow:

```text
read GitHub file
patch file
commit to GitHub
validate Worker folder
preview deploy
deploy
smoke test
write receipt
write handoff
update registry
```

Required tools:

```text
read_github_file
patch_github_file
commit_github_file
validate_patch
run_deploy_pipeline
write_handoff
```

## Phase 6 — Create AFO Mobile Terminal / Command Center

Build a top-level Worker UI that calls the belts instead of replacing them.

Suggested name:

```text
afo-mobile-terminal-mcp
```

or:

```text
afo-command-center-mcp
```

Command groups:

### Deploy Belt

```text
validate_worker_folder
preview_worker_from_github
deploy_worker_from_github
run_worker_smoke_test
write_deploy_receipt
rollback_worker
```

### Git Belt

```text
read_file
write_file
commit_file
list_repo
create_branch
compare_commits
```

### Cloudflare Belt

```text
list_workers
read_live_worker
manage_bindings
list_routes
list_d1
list_r2
list_kv
```

### UI Belt

```text
generate_buttons
generate_tables
generate_forms
compose_ui
audit_ui
repair_ui
```

### Test Belt

```text
health_check
mcp_tools_list_check
endpoint_check
ui_contract_check
smoke_test_report
```

### Registry Belt

```text
register_tool
update_inventory
list_tool_urls
recommend_tool
create_handoff
```

## Phase 7 — Safety and governance

Add safety rails before expanding write capabilities.

Required practices:

- Preview before deploy.
- Confirmation before write actions.
- Receipts for every deploy and rollback.
- Never expose secret values in UI or receipts.
- Separate read tools from write tools.
- Add risk profiles to registry entries.
- Require explicit target repo/path/script_name.
- Add dry-run mode to all destructive tools.

## Practical next build

The next best build is not another isolated app. It is the command-center layer that organizes the existing apps.

Build:

```text
afo-mobile-terminal-mcp
```

MVP routes:

```text
GET /
GET /health
GET /llms.txt
GET /tools/list
POST /mcp
```

MVP UI cards:

```text
Deploy Worker
Smoke Test Worker
List Recent Deploys
Register Worker
Open Tool URLs
Write Handoff
```

MVP integrations:

```text
afo-mobile-deploy-mcp
AFO Tool Index / registry
Message OS / handoff inbox
Cloudflare infra gateway if available
GitHub MCP
```

## Definition of done for next milestone

AFO Mobile Terminal v0.1 is done when an iPhone user can:

1. select a Worker from registry or type repo/path/script,
2. validate it,
3. preview deployment,
4. deploy it,
5. see smoke results,
6. register/update tool metadata,
7. write a handoff note,
8. open the live URLs,
9. see the deployment receipt path.
