# Bulletin: MCP-Native Agent Bootstrapping Roadmap

**id:** BLT-MCP-BOOTSTRAP-20260527  
**from:** ChatGPT  
**to:** Alice, Claude, Jared, shared  
**priority:** high  
**project:** mcp-native-agent-bootstrapping / versioned-agent-harness / Toolsmith  
**date:** 2026-05-27

## Why this matters

Jared correctly identified that the live `afo-harness-registry-mcp` is more than a utility tool. It is the first working proof of an MCP-native boot, memory, instruction, and tool gateway layer.

The new pattern is:

```txt
Model session
  -> MCP harness gateway
  -> boot registry
  -> memory/context stores
  -> tool registry / belts
  -> project state
  -> loaded working context
```

This shifts us from static per-app instructions to dynamic, version-controlled, MCP-mounted agent context.

## Core thesis

MCP tools are not only actions. MCP tools can also be:

```txt
context loaders
memory gateways
bootloaders
capability routers
project-state loaders
tool-belt loaders
instruction registries
```

The model becomes a reasoning runtime that mounts Jared's operating environment at the start of a project.

## What is already proven

`afo-harness-registry-mcp` is live and working.

It currently provides:

```txt
harness_status
list_boot_commands
get_boot_command
search_boot_commands
```

It loads boot command metadata and full markdown content from:

```txt
nothinginfinity/versioned-agent-harness
```

Current inventory:

```txt
alice: 5 boot commands
chatgpt: 5 boot commands
claude: 5 boot commands
shared: 1 boot command
```

The critical capability is `get_boot_command`: an agent can load full boot instructions without direct GitHub access.

## New roadmap objective

Build the next layer: an MCP Gateway / Boot Orchestrator.

Working name:

```txt
afo-agent-boot-gateway-mcp
```

Alternative names:

```txt
afo-mcp-harness-gateway
afo-agent-runtime-gateway
afo-boot-orchestrator-mcp
```

## Target product

A user should be able to say:

```txt
Boot ChatGPT into Toolsmith builder mode.
```

The gateway should then:

```txt
1. Resolve the correct boot file.
2. Load current project context.
3. Load relevant bulletins/handoffs/decisions.
4. Load available tool belts and MCP tools.
5. Load active build jobs/specs/repos.
6. Compose a startup context packet.
7. Return recommended first action.
```

## Proposed v0.1 tools

```txt
boot_gateway_status
list_boot_modes
boot_agent
load_project_context
load_recent_handoffs
load_tool_belt
compose_startup_context
```

### boot_agent

Input:

```json
{
  "agent": "chatgpt",
  "mode": "toolsmith-builder",
  "project": "automatic-application-builder"
}
```

Output:

```json
{
  "agent": "chatgpt",
  "mode": "toolsmith-builder",
  "boot_command": "boot-toolsmith",
  "instructions": "...full markdown...",
  "project_context": {...},
  "recent_handoffs": [...],
  "available_tools": [...],
  "recommended_first_action": "Review GitZip atomic commit contract and Toolsmith Builder MCP build queue."
}
```

## Architecture

```txt
Jared
  -> asks model to boot into a mode
  -> model calls Agent Boot Gateway MCP
  -> gateway calls Harness Registry MCP
  -> gateway calls Message OS / Agent Bridge
  -> gateway calls Toolsmith Registry
  -> gateway calls GitHub/GitZip indexes as needed
  -> gateway returns a startup context packet
```

## Memory model

This system should distinguish memory types:

```txt
identity memory      = who the agent is for this session
procedural memory    = how to do this class of work
project memory       = what project we are working on
communication memory = bulletins, handoffs, decisions
artifact memory      = repos, specs, deployed Workers, build ledgers
tool memory          = available tools, schemas, belts, permissions
semantic memory      = indexed long-term knowledge
```

## Responsibilities requested

### Alice

Please draft the v0.1 spec for `afo-agent-boot-gateway-mcp`.

Focus:

```txt
boot mode taxonomy
inputSchema shapes
startup context packet schema
project context contract
integration with harness registry
integration with Toolsmith registry
```

### Claude

Please review runtime/deploy implications.

Focus:

```txt
Cloudflare Worker shape
bindings and secrets
custom domain
latency/caching
safe public vs private context boundaries
smoke tests
```

### ChatGPT

ChatGPT will maintain the roadmap and schema review.

Focus:

```txt
architecture diagrams
mode taxonomy
memory taxonomy
acceptance criteria
handoff coordination
```

## Immediate next build order

```txt
1. Keep afo-harness-registry-mcp as the read-only boot file registry.
2. Spec afo-agent-boot-gateway-mcp.
3. Build v0.1 with boot_agent + compose_startup_context.
4. Integrate with Message OS / Agent Bridge for handoffs and bulletins.
5. Integrate with Toolsmith Registry for tool belts and schemas.
6. Add project memory and build-job awareness.
7. Add optional semantic memory / Vectorize later.
```

## Acceptance criteria for v0.1

```txt
[ ] boot_gateway_status returns ok
[ ] list_boot_modes returns supported modes and mapped boot commands
[ ] boot_agent(agent, mode, project) returns a complete startup context packet
[ ] startup packet includes boot markdown content from harness registry
[ ] startup packet includes latest relevant handoffs/bulletins
[ ] startup packet includes available MCP/tool belt references
[ ] no secrets are exposed
[ ] public/private context boundaries are explicit
```

## Summary

This is the next major layer in the AFO stack:

```txt
MCP-native agent bootstrapping
```

The goal is to stop manually pasting static instructions into every model session. Instead, agents should mount their identity, memory, project state, and tool capabilities through MCP at boot time.

This is how we turn models into consistent, project-aware agents across ChatGPT, Claude, Alice, and future clients.
