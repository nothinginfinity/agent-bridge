# Cloudflare SuperDev Deployment Checklist

This folder contains the build artifacts for three new MCP Workers:

- `cloudflare-auditor-mcp`
- `cloudflare-builder-mcp`
- `vector-lab-mcp`

## Source files

- `cloudflare-auditor-mcp/worker.js`
- `cloudflare-builder-mcp/worker.js`
- `vector-lab-mcp/worker.js`

## Toolsmith seed files

Apply to `afo-toolsmith-db`:

1. `tool-catalogue-seed.sql`
2. `generated-connectors-seed.sql`
3. `belts-seed.sql`

Then run Toolsmith catalogue embedding:

```txt
POST https://afo-toolsmith.agentfeedoptimization.com/admin/embed-catalogue
X-Admin-Token: <admin-token>
```

## Worker routes

Attach routes:

```txt
cloudflare-auditor-mcp.agentfeedoptimization.com/* -> cloudflare-auditor-mcp
cloudflare-builder-mcp.agentfeedoptimization.com/* -> cloudflare-builder-mcp
vector-lab-mcp.agentfeedoptimization.com/* -> vector-lab-mcp
```

## DNS records

Create proxied AAAA records to `100::` if missing:

```txt
cloudflare-auditor-mcp.agentfeedoptimization.com
cloudflare-builder-mcp.agentfeedoptimization.com
vector-lab-mcp.agentfeedoptimization.com
```

## Bindings

### cloudflare-auditor-mcp

Required:

- `CF_API_TOKEN` secret
- `ACCOUNT_ID` var
- `ZONE_ID` var

Permissions needed:

- Account Workers Scripts Read
- Zone Workers Routes Read
- Zone DNS Read
- Zone Zone Read

### cloudflare-builder-mcp

Required:

- `CF_API_TOKEN` secret
- `ACCOUNT_ID` var
- `ZONE_ID` var

Permissions needed:

- Account Workers Scripts Read
- Zone Workers Routes Read/Edit
- Zone Cache Purge

Notes:

- v0.1.0 intentionally does not accept secret plaintext.
- v0.1.0 intentionally does not deploy Worker source directly.
- Route creation/deletion and cache purge require `confirm: true`.

### vector-lab-mcp

Required:

- `AI` Workers AI binding
- `VECTORIZE` Vectorize binding

Optional:

- `DB` D1 binding
- `DEFAULT_VECTORIZE_INDEX` var

For AFO Toolsmith catalogue reindexing, bind:

- `DB` -> `afo-toolsmith-db`
- `VECTORIZE` -> target Vectorize index
- `DEFAULT_VECTORIZE_INDEX` -> target index name

## Smoke tests

Each Worker should pass:

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}
```

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

### Auditor

```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"afo_harness_validate","arguments":{"url":"https://afo-toolsmith.agentfeedoptimization.com"}}}
```

### Builder

```json
{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"binding_manifest_instruction","arguments":{"script_name":"afo-toolsmith"}}}
```

### Vector Lab

```json
{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"chunk_text","arguments":{"text":"AFO Toolsmith is a developer tool for generating MCP tools.","max_chars":80,"overlap":10}}}
```

```json
{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"embedding_generate","arguments":{"texts":["AFO Toolsmith builds MCP tools"],"return_vectors":false}}}
```

## Acceptance criteria

1. All three Workers respond to `/health`.
2. All three Workers respond to MCP `initialize` and `tools/list`.
3. Toolsmith catalogue includes the three new tools.
4. Toolsmith connectors include the three new connectors.
5. Toolsmith belts include the four starter belts.
6. Vector Lab can chunk and embed text.
7. Auditor can validate the live AFO Toolsmith harness.
8. Builder returns binding manifest instructions and blocks risky operations unless `confirm: true`.
