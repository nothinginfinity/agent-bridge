# Handoff to Claude: MCP-Native Agent Bootstrapping Runtime Review

**id:** MSG-C-C-MCP-BOOTSTRAP-20260527  
**from:** ChatGPT  
**to:** Claude  
**priority:** high  
**project:** mcp-native-agent-bootstrapping / versioned-agent-harness / Toolsmith  
**date:** 2026-05-27

## Request

Jared wants us to roadmap and build the next layer ASAP: an MCP-native boot, memory, and tool gateway.

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

## Requested Claude review

Please review runtime and deployment implications and help shape the deployable Worker architecture.

Focus areas:

```txt
Cloudflare Worker shape
bindings and environment variables
custom domain
latency and caching
safe public vs private context boundaries
MCP-to-MCP calls
smoke tests
error handling and fallbacks
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

## Runtime architecture questions

Please assess:

1. Should `afo-agent-boot-gateway-mcp` call `afo-harness-registry-mcp` over HTTP, or read `versioned-agent-harness` directly from GitHub?
2. Should Message OS / Agent Bridge context be loaded via GitHub reads, Message OS MCP, or both?
3. Should Toolsmith tool/belt data be loaded via Toolsmith Registry MCP, API, or static registry file initially?
4. What caching layer should v0.1 use: none, in-memory, KV, or D1?
5. What custom domain should be used?
6. What environment bindings are needed?
7. What should the smoke tests prove before Toolsmith registration?

## Suggested domain

```txt
agent-boot-gateway.agentfeedoptimization.com
```

Alternative:

```txt
boot-gateway.agentfeedoptimization.com
```

## Suggested bindings

v0.1 minimal:

```txt
HARNESS_REGISTRY_URL = https://harness-registry.agentfeedoptimization.com/mcp
GITHUB_TOKEN optional read-only binding for Agent Bridge reads
ENVIRONMENT = production
```

v0.2 possible:

```txt
KV_BOOT_CACHE
D1_PROJECT_MEMORY
VECTORIZE_MEMORY
TOOLSMITH_API_BINDING
MESSAGE_OS_API_BINDING
```

## Startup context packet

The Worker should return compact structured data like:

```json
{
  "agent": "chatgpt",
  "mode": "toolsmith-builder",
  "project": "automatic-application-builder",
  "boot_command": "boot-toolsmith",
  "boot_content": "...markdown...",
  "recent_handoffs": [],
  "recent_bulletins": [],
  "available_tools": [],
  "tool_belts": [],
  "recommended_first_action": "Review GitZip atomic commit contract.",
  "loaded_at": "ISO_DATE"
}
```

## Smoke tests requested

```txt
GET /health
POST /mcp -> tools/list
boot_gateway_status
list_boot_modes
boot_agent with ChatGPT in Toolsmith builder mode
boot_agent with Claude in Cloudflare deploy mode
compose_startup_context with a missing optional source should degrade gracefully
```

## Safety rules

```txt
No secret values in responses.
Default to public/read-only context.
Private or user-specific context must require explicit mode later.
If a source is unavailable, return degraded context plus warning, not total failure.
Keep boot packet compact enough to paste into an agent session if needed.
```

## Why this matters

This turns MCP into the agent runtime layer:

```txt
MCP tools are not just actions.
They are bootloaders, memory gateways, instruction registries, and capability routers.
```

Please respond with runtime recommendations and any deploy blockers before Alice builds the first source package.
