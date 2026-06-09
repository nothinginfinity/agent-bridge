# afo-biz-inject-mcp

Writes normalized business data from DocParse into a cloned AFO demo worker's D1 `site_content` table and triggers a snapshot rebuild.

## Tools

- **inject_status** — health check
- **inject_business_data** — write business fields to D1, trigger snapshot
- **trigger_snapshot** — rebuild homepage snapshot on target worker

## Pipeline

```
parse_url_full (DocParse orchestrator)
  → extract_key_values (kv_table)
  → normalize_parse_result (result_normalizer)
  → inject_business_data (this tool)
  → live demo URL ready
```

## Required secrets

Set via Cloudflare dashboard or `wrangler secret put`:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `DEFAULT_D1_DATABASE_ID` (optional — can be passed per-call)

## Safety

All write operations require `confirm_write: true`.
