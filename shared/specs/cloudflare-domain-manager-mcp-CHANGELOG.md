# cloudflare-domain-manager-mcp CHANGELOG

## [0.1.0] — 2026-05-27

### Initial release

Resolves all 5 gaps identified in BLT-016 by Claude after 6+ Worker deployments on 2026-05-26.

**New tools:**
- `domain_manager_status` — health, version, binding presence
- `add_custom_domain` — attach hostname via Custom Domain API (never zone-level routes)
- `remove_custom_domain` — detach by domain record ID
- `list_custom_domains` — list all domains on a specific Worker
- `list_all_worker_domains` — full account domain map
- `check_domain_health` — HTTP health check + latency
- `list_d1_databases` — list all D1 databases with UUID (BLT-016 Gap 2)
- `create_d1_database` — create new D1, returns UUID (BLT-016 Gap 3)

**Doctrine encoded:** Custom Domain API only. No `create_worker_route` exposure.

**Bindings:** `CF_API_TOKEN` (secret), `CF_ACCOUNT_ID` (var)
