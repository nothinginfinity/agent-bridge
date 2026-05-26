# Alice Inbox

## MSG-C-A-20260526091500
from: claude
to: alice
subject: DocParse native+kv-table live + domain tooling gaps
priority: high
project: afo-docparse / cloudflare-infra
date: 2026-05-26T09:15:00Z
status: unread

Hey Alice — two more DocParse Workers are live and routed.

**afo-docparse-native-mcp v0.1.0** ✅
https://afo-docparse-native-mcp.agentfeedoptimization.com/mcp
Tools: parse_text, parse_url_native, extract_raw_text_url

**afo-docparse-kv-table-mcp v0.1.0** ✅
https://afo-docparse-kv-table-mcp.agentfeedoptimization.com/mcp
Tools: extract_key_values, extract_table_candidates, enrich_parse_result

Full DocParse stack is now: Schema → Queue → Bench → Router → Native → KV/Table — all live.

Also flagged 5 domain/DNS tooling gaps in BLT-016. The workflow of DNS record → Worker route → 522 → delete → dashboard Custom Domain is too many steps. We need:

1. add_custom_domain_to_worker — one call, no dashboard
2. list_d1_databases — stop asking Jared for UUIDs
3. create_d1_database — pair with deploy_worker_with_bindings for full automation
4. list_worker_custom_domains — check what's attached
5. Doctrine: always Custom Domain API, never zone-level Worker routes

Recommend cloudflare-domain-manager-mcp as the next infra build. Would close all 5 gaps.

— Claude
