# AFO MCP Builder Doctrine

This is a standing instruction for Claude, Alice, ChatGPT, and any other agent working with Jared on AFO infrastructure.

Full long-form guide:

```txt
nothinginfinity/repo-copilot
docs/afo-mcp-builder-space-instructions.md
```

## Core doctrine

All capable agents should understand the AFO MCP build pattern and should be able to create MCP source artifacts even if they cannot deploy them directly.

Default build path:

```txt
idea / product need
→ narrow MCP spec
→ standalone Cloudflare Worker MCP
→ health endpoint
→ MCP JSON-RPC surface
→ GitHub source materialization
→ Cloudflare deployment by a tool-capable agent
→ smoke test
→ Message OS handoff / bulletin
```

## Required MCP shape

Every AFO Worker MCP should expose:

```txt
GET /health
POST /mcp
```

Every `/mcp` endpoint must support:

```txt
initialize
notifications/initialized
tools/list
tools/call
```

Every MCP should include:

```txt
status tool
CORS
JSON-RPC response shape
inputSchema on every tool
binding presence booleans in health
no secret exposure
```

## Build small tools

Prefer small standalone Workers over giant systems.

Examples:

```txt
afo-d1-admin-mcp
afo-gitzip-push-mcp
afo-parse-to-repo-mcp
afo-repo-composer-mcp
afo-signup-router-mcp
afo-docparse-result-normalizer-mcp
```

If a tool has too many jobs, split it and compose later with Toolsmith Gateway or a router MCP.

## Agent capability tiers

### Tool-capable agents

If the agent has Cloudflare/GitZip/GitHub tools, it may:

```txt
write Worker source
deploy Worker with Cf-multipart
create D1 DB with AFO D1 Admin
materialize source/docs/tests with GitZip
smoke test the MCP
send Message OS handoff
```

### GitHub-only agents

If the agent cannot deploy Cloudflare Workers, it should still build useful artifacts:

```txt
spec.md
README.md
src/index.ts
wrangler.toml
MCP_SCHEMA.json
smoke-test.json
CHANGELOG.md
```

Then commit those files to GitHub and hand off to ChatGPT/Claude/Jared for Cloudflare deploy.

### Research/chat-only agents

If the agent cannot write to GitHub, it should produce:

```txt
MCP spec
Worker source file
binding list
health/MCP URLs to use
smoke test plan
handoff notes
```

## Standard Worker MCP skeleton requirements

Use the AFO skeleton pattern from the full guide.

Minimum constants:

```js
const NAME = 'afo-example-mcp';
const VERSION = '0.1.0';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
};
```

Required helper shapes:

```txt
R()
ok()
txt()
er()
call()
mcp()
export default fetch()
```

## Standard deployment path

```txt
1. Define smallest useful v0.
2. Build standalone Worker MCP.
3. Deploy with Cf-multipart if available.
4. Ask Jared to add custom domain/secrets if needed.
5. Connect MCP to ChatGPT/Claude.
6. Run status tool.
7. Run one safe smoke test.
8. Patch small.
9. Materialize source/docs/tests with GitZip.
10. Send handoff/bulletin through Message OS.
```

## Core AFO infrastructure tools

```txt
Cf-multipart
- deploy_worker_with_bindings
- update_worker_bindings_multipart
- get_worker_source
- execute_d1_sql
- query_d1_sql
- list_d1_tables

AFO D1 Admin
- create_d1_database
- list_d1_databases
- get_d1_database
- delete_d1_database

AFO GitZip Push
- gitzip_status
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

Message OS v08
- check_bridge_inbox
- triage_inbox
- reply_or_route
```

## Security rules

1. Never expose secrets.
2. Health endpoints show only binding presence.
3. Destructive tools require explicit confirmation flags.
4. Validate paths and reject path traversal.
5. Keep admin MCPs separate from public web MCPs.
6. Keep GitHub batch sizes bounded.
7. Prefer routers for public flows.

## Handoff rule

After any meaningful MCP build, tell the other agents:

```txt
what was built
worker name
health URL
MCP URL
tools exposed
bindings/secrets needed
smoke test result
next recommended step
```
