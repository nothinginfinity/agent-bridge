# Handoff to Alice: MCP-Native Agent Bootstrapping

**id:** MSG-C-A-MCP-BOOTSTRAP-20260527  
**from:** ChatGPT  
**to:** Alice  
**priority:** high  
**project:** mcp-native-agent-bootstrapping / versioned-agent-harness / Toolsmith  
**date:** 2026-05-27

## Request

Jared wants us to roadmap and build the next layer ASAP: an MCP-native boot/memory/tool gateway.

The live `afo-harness-registry-mcp` proves the first part:

```txt
model -> MCP -> harness registry -> boot file -> working identity
```

The next layer should become:

```txt
model -> MCP gateway -> boot + memory + tools + project state
```

## Proposed new MCP

Working name:

```txt
afo-agent-boot-gateway-mcp
```

Purpose:

```txt
Given an agent, project, and mode, compose the startup context needed to boot the agent into the correct role with the right instructions, memory, tools, permissions, and first action.
```

## Requested Alice output

Please draft the v0.1 spec and source package for `afo-agent-boot-gateway-mcp`.

Use the AFO MCP Builder pattern:

```txt
GET /health
POST /mcp
JSON-RPC initialize/tools/list/tools/call
CORS
inputSchema for every tool
boot_gateway_status as first tool
no secret exposure
```

## Suggested v0.1 tools

```txt
boot_gateway_status
list_boot_modes
boot_agent
load_project_context
load_recent_handoffs
load_tool_belt
compose_startup_context
```

## Suggested startup context packet

```json
{
  "agent": "chatgpt",
  "mode": "toolsmith-builder",
  "project": "automatic-application-builder",
  "boot_command": "boot-toolsmith",
  "boot_content": "...markdown...",
  "project_context": {},
  "recent_handoffs": [],
  "available_tools": [],
  "tool_belts": [],
  "permissions": [],
  "recommended_first_action": "...",
  "loaded_at": "ISO_DATE"
}
```

## Boot mode taxonomy to define

Please propose an initial taxonomy such as:

```txt
toolsmith-builder
cloudflare-deploy
mcp-builder
roadmap
spec-authoring
handoff
validation
debug
d1-ops
research
social-builder
```

Each mode should map to:

```txt
agent
boot_command
project context sources
tool belt references
permission profile
recommended first action
```

## Integrations to design

v0.1 should start with simple/read-only integrations:

```txt
afo-harness-registry-mcp        -> boot files
agent-bridge GitHub files       -> bulletins/handoffs/decisions
Toolsmith registry, if available -> tool belt metadata
GitHub specs/repos              -> artifact references
```

v0.2 can add:

```txt
D1 project memory
Vectorize semantic memory
build job awareness
Toolsmith tool/belt registration integration
per-user/private memory controls
```

## Critical design questions

Please address in the spec:

1. Does the gateway call the harness registry MCP live, or duplicate GitHub reads?
2. What is the exact startup context packet schema?
3. How do we prevent secret/private data from being included by default?
4. How do we map user phrases like “boot into Toolsmith mode” to boot commands?
5. How do we let agents know which tools are available without overloading context?
6. What is the fallback when one source is unavailable?
7. How should the gateway expose public vs private context modes?

## Acceptance criteria

```txt
[ ] boot_gateway_status returns ok
[ ] list_boot_modes returns mode mappings
[ ] boot_agent returns boot content from harness registry
[ ] boot_agent includes relevant recent handoffs/bulletins
[ ] boot_agent includes available tool/belt references
[ ] no secrets exposed
[ ] output is compact enough for model startup use
[ ] generated package includes spec, src/index.ts, wrangler.toml, schema, smoke tests, changelog
```

## Why this matters

This turns MCP into the agent runtime layer:

```txt
MCP tools are not just actions.
They are bootloaders, memory gateways, instruction registries, and capability routers.
```

Jared wants this roadmapped and built quickly.

Please draft the spec/source package and commit to `nothinginfinity/agent-bridge/shared/specs/` for Claude/ChatGPT review.
