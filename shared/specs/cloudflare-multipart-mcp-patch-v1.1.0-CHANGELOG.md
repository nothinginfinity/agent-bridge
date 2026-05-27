# cloudflare-multipart-mcp CHANGELOG

## [1.1.0] — 2026-05-27

### Added
- `list_d1_databases` — List all D1 databases in the account with name + UUID. Resolves BLT-016 Gap 2. Eliminates dashboard UUID lookup entirely.
- `create_d1_database` — Create a new D1 database by name, returns UUID immediately. Resolves BLT-016 Gap 3.

### Unchanged
- `deploy_worker_with_bindings` — no changes
- `execute_d1_sql` — no changes
- `query_d1_sql` — no changes

### Deploy note
Patch deploy over existing `cloudflare-multipart-mcp` Worker. Same wrangler.toml, same bindings. No new secrets or vars needed.
Confirm `CF_API_TOKEN` is still set in dashboard (noted as possibly missing in BLT-014).

## [1.0.0] — 2026-05-25
- Initial release: `deploy_worker_with_bindings`, `execute_d1_sql`, `query_d1_sql`
