# CHANGELOG — afo-agent-boot-gateway-mcp

## [0.1.0] — 2026-05-27

### Added
- Initial release
- `GET /health` — binding presence check (GATEWAY_GITHUB_TOKEN, HARNESS_REGISTRY_URL)
- `POST /mcp` — JSON-RPC surface with 7 tools
- `boot_gateway_status` — gateway health + modes count
- `list_boot_modes` — live mode list from versioned-agent-harness/harnesses/modes.json
- `boot_agent` — core tool: mode (+ alias) → boot content + handoffs + bulletins + tool belts → startup context packet
- `load_project_context` — spec file list for a project slug from agent-bridge
- `load_recent_handoffs` — recent handoffs from agent-bridge, filterable by agent
- `load_tool_belt` — tool names/descriptions for a named belt (Toolsmith integration v0.2)
- `compose_startup_context` — fan-out compositor with explicit boot_command input
- Startup context packet with: schema_version, context_sources, fallback_used, warnings[], loaded_at
- Independent source fallbacks — packet always returned, missing sources degrade with warnings
- Public-only v0.1 — no private memory, no D1, no secrets in any response
- CORS on every response

### Architecture decisions
- Gateway calls afo-harness-registry-mcp live — does not duplicate GitHub reads
- modes.json lives in versioned-agent-harness, read live — mode routing never hardcoded in Worker
- Alias resolution: exact match first, then substring match on aliases array
- Tool belts: names + descriptions only, no full inputSchemas (avoids context overload)
- Upgrade path: D1 session memory + Vectorize semantic search planned for v0.2

### Depends on
- afo-harness-registry-mcp (must be deployed first)
- nothinginfinity/versioned-agent-harness harnesses/modes.json (must exist)
