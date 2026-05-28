# afo-control-center-mcp v0.7.0 CHANGELOG

Deployed: 2026-05-28T14:19:35Z

## New: Repair Action Plan Engine

Every open queue item now produces a structured repair plan via `buildActionPlan(queueRow, enrichment)`.

### Issue type → action mapping

| Issue | Action Type | Confidence | Auto-Apply |
|---|---|---|---|
| missing_health_url | set_health_url | high (custom_domain known) / medium | high only |
| missing_mcp_url | set_mcp_url | high / medium | high only |
| missing_smoke_status | trigger_health_sync | high | no |
| smoke_status_fail | diagnose_failing_health | medium | no |
| missing_custom_domain | setup_custom_domain | low | no |
| missing_repo_url | register_repo_url | low | no |
| not_toolsmith_registered | register_toolsmith | medium | no |
| no_d1_binding | add_d1_binding | low | no |
| mcp_status_fail | diagnose_mcp_failure | medium | no |

Auto-apply only fires when `confidence=high` AND `requires_confirmation=false`.
Everything else returns the plan for human review.

## New HTTP Endpoints

- `GET /registration/queue/actions` — list all open items with action summaries; supports ?issue, ?severity, ?target_id, ?limit
- `GET /registration/queue/action-plan?id=...` — full plan for one queue item
- `POST /registration/queue/apply-action` — apply action; auto-applies high-confidence URL inferences, others need `confirmed=true`

## New MCP Tools (v0.7)

- `list_queue_actions` — filterable action summary list
- `get_queue_action_plan` — full plan by queue_id
- `apply_queue_action` — apply or preview repair
- `generate_toolsmith_registration_payload` — ready-to-submit Toolsmith connector payload
- `infer_worker_metadata` — derives health_url, mcp_url, proposed_custom_domain from worker_id + enrichment

## Dashboard Updates

- Needs Attention: table now sorted by severity (high first), shows action badge + Plan link per row
- New panel: **Repair Actions — Issue Breakdown** with horizontal bar chart and filter links
- All action buttons link to filtered /registration/queue/actions views

## Preserved from v0.6.1

All existing endpoints, MCP tools, bindings, D1 schema, and dedupe logic preserved.
