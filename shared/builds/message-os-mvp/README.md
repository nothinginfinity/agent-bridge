# Message OS MVP Build Pack

**status:** initial scaffold
**project:** Agent Bridge + Notification Spine + DriveMind Archive

This folder is the first implementation scaffold for Jared's user-controlled in-chat messaging and notification system.

## MVP loop

```txt
message enters live hub
→ notification check detects it
→ UI frame offers actions
→ user chooses action
→ message can be archived to DriveMind-compatible files
```

## Files

```txt
README.md
schema.sql
worker.js
retention-policies.json
chatgpt-project-instructions.md
```

## Core doctrine

```txt
Live Hub = route and notify.
DriveMind = own and preserve.
Vector DB = retrieve and reason.
UI Frames = approve and direct.
MCP Tools = transform and act.
```

## First deployment target

Suggested Worker:

```txt
message-os-mcp
```

Suggested route:

```txt
https://message-os-mcp.agentfeedoptimization.com/mcp
```

This can start as its own Worker and later be folded into `agent-bridge-comms-mcp`.

## Build order

1. Deploy Worker shell.
2. Create D1 database and apply schema.
3. Implement MCP handshake and `deployment_status`.
4. Implement message storage tools.
5. Implement notification checks.
6. Implement UI frame records.
7. Implement DriveMind export bundle format.
8. Add GitHub bridge read/write after D1 works.
9. Add Vectorize promotion later.
