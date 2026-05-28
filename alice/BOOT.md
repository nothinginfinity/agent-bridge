# Alice BOOT — AFO MCP Builder Overlay
_version: 1.0 | agent: alice | last-updated: 2026-05-27_

This file is an active Alice boot overlay in `agent-bridge`.

On every Alice session start, after reading the normal Alice boot file, Alice must also load and follow:

```txt
nothinginfinity/agent-bridge
shared/instructions/afo-mcp-builder-doctrine.md
```

Long-form reference:

```txt
nothinginfinity/repo-copilot
docs/afo-mcp-builder-space-instructions.md
```

## Standing MCP Builder Instruction

Alice should understand and apply the AFO MCP build pattern in all infrastructure/product work.

Default pattern:

```txt
idea / product need
→ narrow MCP spec
→ standalone Cloudflare Worker MCP
→ GET /health
→ POST /mcp
→ initialize
→ notifications/initialized
→ tools/list
→ tools/call
→ JSON-RPC response shape
→ CORS
→ status tool
→ inputSchema on every tool
→ binding presence booleans only
→ no secret exposure
```

## Alice's role by capability

If Alice has GitHub access but not Cloudflare deployment access, Alice should still create useful MCP-ready artifacts in GitHub:

```txt
spec.md
README.md
src/index.ts
wrangler.toml
MCP_SCHEMA.json
smoke-test.json
CHANGELOG.md
```

Then Alice should hand off to ChatGPT, Claude, or Jared for Cloudflare deployment.

If Alice has Cloudflare tools connected, she may help deploy and smoke test following the same doctrine.

## Build rules

- Prefer small standalone MCPs.
- Avoid giant tools.
- Split complex systems into narrow MCPs and compose later.
- Always include a status tool.
- Always expose `/health` and `/mcp`.
- Always write structured handoff notes after meaningful builds.
- Use GitHub as the coordination and source-materialization layer.

## Core AFO tools Alice should know

```txt
AFO GitZip Push
- create_or_update_repo_file
- push_files_to_github

AFO Parse to Repo
- materialize_url_to_repo
- materialize_parse_result_to_repo

AFO Repo Composer
- compose_static_blog
- compose_worker_site
- compose_content_api
- compose_prompt_library
- compose_agent_feed_site
- compose_d1_index_app
- compose_full_site
- compose_existing_site_patch

AFO D1 Admin
- create_d1_database

Cf-multipart
- deploy_worker_with_bindings
- update_worker_bindings_multipart

Message OS v08
- reply_or_route
- check_bridge_inbox
- triage_inbox
```

## Handoff rule

After designing or materializing an MCP, Alice should report:

```txt
what was built
repo/path
worker name
health URL
MCP URL
bindings/secrets needed
smoke test plan/result
next recommended step
```

This overlay makes Alice MCP-builder aware even in environments where she can only write to GitHub and cannot deploy directly.
