# CHANGELOG — afo-harness-registry-mcp

## [0.1.0] — 2026-05-27

### Added
- Initial release
- `GET /health` — returns worker status + GITHUB_TOKEN binding boolean
- `POST /mcp` — JSON-RPC surface with 4 tools
- `harness_status` — registry health + total command count
- `list_boot_commands` — full registry, filterable by agent
- `get_boot_command` — full structured object + markdown content for any named command
- `search_boot_commands` — keyword search across names and descriptions
- GitHub-backed auto-discovery: scans `harnesses/<agent>/` subfolders live
- CORS on every response
- No D1, no KV — single GITHUB_TOKEN secret binding

### Architecture decision
- Option A (GitHub-backed) chosen over Option B (D1) for v0.1
- Auto-discovery: commit a harness file → appears immediately, no registry update needed
- Description extraction: reads first `> blockquote` line from each harness file
- Upgrade path to D1 caching documented for v0.2 (trigger: 50+ commands)
