# Cloudflare SuperDev MCP Build

This directory contains deploy-ready source plans for the Cloudflare SuperDev MCP belt.

Workers:

1. `cloudflare-auditor-mcp` — read-only Cloudflare inspection.
2. `cloudflare-builder-mcp` — controlled build/deploy operations.
3. `vector-lab-mcp` — Cloudflare Vectorize + Workers AI + D1 semantic database tools.

Primary specs and patches:

- `shared/specs/vector-lab-mcp.md`
- `shared/patches/cloudflare-superdev-toolsmith-index.patch.md`

Implementation note: the Workers follow the existing AFO mobile MCP pattern: `POST /mcp`, JSON-RPC, `initialize`, `tools/list`, and `tools/call`.
