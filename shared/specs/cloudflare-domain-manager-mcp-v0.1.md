# cloudflare-domain-manager-mcp — v0.1 Spec

> **One sentence:** This MCP exists to manage Cloudflare Worker custom domains and D1 database lifecycle without dashboard visits.

**Worker name:** `cloudflare-domain-manager-mcp`  
**Domain:** `cloudflare-domain-manager.agentfeedoptimization.com`  
**Version:** 0.1.0  
**Author:** Alice (spec) — Claude (deploy)  
**Origin:** BLT-016 — Claude identified 5 tooling gaps during 6+ Worker deployments on 2026-05-26  

---

## Problem

From BLT-016 (Claude's own gap report):

| Gap | Pain | Current workaround |
|-----|------|--------------------|
| No `add_custom_domain_to_worker` | 4-step manual flow → 522 errors | Dashboard visit + DNS delete + retry |
| No `list_d1_databases` | Can't look up D1 UUIDs | Dashboard visit every time |
| No `create_d1_database` | Can't create new D1s | Dashboard visit every time |
| No `list_worker_custom_domains` | Can't check what's attached | Infer from health checks |
| Worker route vs Custom Domain confusion | Zone-level routes cause 522 | Manually use Custom Domain API |

**Note:** `list_d1_databases` and `create_d1_database` are also being patched into `cloudflare-multipart-mcp` v1.1.0. This MCP focuses on the domain lifecycle tools (Gaps 1, 4, 5) and adds the D1 tools as convenience duplicates.

---

## Architecture

Standalone AFO-pattern Cloudflare Worker. No D1, no KV, no state. All operations are live Cloudflare API calls.

```
GET  /health   → binding presence booleans, version
POST /mcp      → JSON-RPC: initialize | notifications/initialized | tools/list | tools/call
OPTIONS *      → 204 CORS preflight
* else         → 404
```

**Bindings:**

| Binding | Type | Purpose |
|---------|------|---------|
| `CF_API_TOKEN` | secret | Cloudflare API token with Workers + DNS + D1 permissions |
| `CF_ACCOUNT_ID` | var | Cloudflare account ID |

**Required API token permissions:**
- `Workers Scripts:Edit`
- `Workers Custom Domains:Edit`
- `DNS:Edit` (for the zone)
- `D1:Edit`

---

## Tools — v0.1

### 1. `domain_manager_status`
Health + tool inventory. Always first.

```json
{
  "name": "domain_manager_status",
  "inputSchema": { "type": "object", "properties": {}, "required": [] }
}
```

Response:
```json
{
  "name": "cloudflare-domain-manager-mcp",
  "version": "0.1.0",
  "bindings": { "cf_api_token": true, "cf_account_id": true },
  "tools": ["domain_manager_status", "add_custom_domain", "remove_custom_domain", "list_custom_domains", "list_all_worker_domains", "check_domain_health", "list_d1_databases", "create_d1_database"]
}
```

---

### 2. `add_custom_domain`
Attach a custom domain to a Worker using the correct Cloudflare Custom Domain API (`PUT /accounts/{id}/workers/domains`). Never uses zone-level Worker routes.

```json
{
  "name": "add_custom_domain",
  "description": "Attach a custom hostname to a Cloudflare Worker using the Custom Domain API. Handles DNS automatically. Never use zone-level Worker routes.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "script_name": { "type": "string", "description": "Worker script name, e.g. afo-harness-registry-mcp" },
      "hostname": { "type": "string", "description": "Full hostname, e.g. harness-registry.agentfeedoptimization.com" },
      "zone_id": { "type": "string", "description": "Cloudflare zone ID for the domain" }
    },
    "required": ["script_name", "hostname", "zone_id"]
  }
}
```

CF API call: `PUT /accounts/{account_id}/workers/domains`  
Body: `{ "hostname": "...", "service": "script_name", "environment": "production", "zone_id": "..." }`

Returns: `{ success, hostname, script_name, id, message }`

---

### 3. `remove_custom_domain`
Detach a custom domain from a Worker.

```json
{
  "name": "remove_custom_domain",
  "inputSchema": {
    "type": "object",
    "properties": {
      "domain_id": { "type": "string", "description": "Custom domain record ID (from list_custom_domains or add_custom_domain response)" }
    },
    "required": ["domain_id"]
  }
}
```

CF API call: `DELETE /accounts/{account_id}/workers/domains/{domain_id}`

---

### 4. `list_custom_domains`
List all custom domains attached to a specific Worker.

```json
{
  "name": "list_custom_domains",
  "inputSchema": {
    "type": "object",
    "properties": {
      "script_name": { "type": "string", "description": "Worker script name to check" }
    },
    "required": ["script_name"]
  }
}
```

CF API call: `GET /accounts/{account_id}/workers/domains?service={script_name}`  
Returns: `{ script_name, count, domains: [{ id, hostname, zone_id, created_on }] }`

---

### 5. `list_all_worker_domains`
Full account domain map — all custom domains across all Workers.

```json
{
  "name": "list_all_worker_domains",
  "inputSchema": { "type": "object", "properties": {}, "required": [] }
}
```

CF API call: `GET /accounts/{account_id}/workers/domains`  
Returns: grouped by `script_name` with all attached hostnames.

---

### 6. `check_domain_health`
HTTP health check + DNS status for a hostname.

```json
{
  "name": "check_domain_health",
  "inputSchema": {
    "type": "object",
    "properties": {
      "hostname": { "type": "string", "description": "Full hostname to check, e.g. harness-registry.agentfeedoptimization.com" },
      "path": { "type": "string", "description": "Path to GET, defaults to /health" }
    },
    "required": ["hostname"]
  }
}
```

Does: `GET https://{hostname}{path}` with 5s timeout.  
Returns: `{ hostname, status_code, ok, latency_ms, body_preview, error? }`

---

### 7. `list_d1_databases`
List all D1 databases with name + UUID. Duplicate of multipart-mcp v1.1.0 for convenience.

```json
{
  "name": "list_d1_databases",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name_filter": { "type": "string", "description": "Optional name prefix filter" }
    },
    "required": []
  }
}
```

---

### 8. `create_d1_database`
Create a new D1 database by name, returns UUID immediately.

```json
{
  "name": "create_d1_database",
  "inputSchema": {
    "type": "object",
    "properties": {
      "name": { "type": "string", "description": "Database name, e.g. afo-index-core-db" }
    },
    "required": ["name"]
  }
}
```

---

## Health Response Shape

```json
{
  "status": "ok",
  "name": "cloudflare-domain-manager-mcp",
  "version": "0.1.0",
  "bindings": {
    "cf_api_token": true,
    "cf_account_id": true
  }
}
```

No secrets, no token values, binding presence booleans only.

---

## Doctrine Encoded (from BLT-016)

> **Always use Custom Domain API (`PUT /accounts/{id}/workers/domains`), never zone-level Worker routes (`POST /zones/{id}/workers/routes`) for primary domain assignment.**

This MCP enforces that doctrine by only exposing the Custom Domain API path. There is no `create_worker_route` tool in this MCP.

---

## Smoke Test

See: `cloudflare-domain-manager-mcp-smoke-test.json`

---

## v0.2 Additions (future)

- `list_workers` — list all deployed Workers in account
- `get_worker_metadata` — script name, size, last deployed, routes, domains
- `rollback_worker_domain` — restore previous domain assignment from history
- `audit_domain_routing` — check all workers for route vs Custom Domain mismatches
