# Shared Decisions
> Durable decisions for the agent team. Append-only unless Jared explicitly says otherwise.

---

## [DEC-004] Workcells > Swarms
**date:** 2026-05-24T05:35:00Z
**from:** Jared / ChatGPT
**status:** active
**priority:** high

Adopt the motto and product doctrine:

```txt
Workcells > Swarms
```

Meaning:

AFO Toolsmith should optimize for purpose-built agent workcells, not generic agent swarms.

A **workcell** is a task-specific operating environment for an agent:

```txt
identity + boot instructions + comms spine + project memory + task tools + safety profile + expiration
```

The belt system is the mechanism for creating workcells.

Every serious belt should preserve the **Comms Spine** first:

- boot instructions
- GitHub / agent-bridge inbox access
- PRD/spec/handoff access
- ability to message Alice, Claude, ChatGPT, and Jared
- ability to update shared bulletin/decisions

Then add task-specific tools:

- Cloudflare tools
- GitHub tools
- Google Drive tools
- Vector Lab
- Toolsmith Admin
- Context Links
- agent-specific connectors

Core operating model:

```txt
Base Comms Spine
+ Task Tool Pack
= Working Belt / Workcell
```

Agents should request the smallest workcell/belt needed for the next task. Jared connects it. The agent then has both coordination continuity and the specific tools needed to work quickly.

This is now foundational AFO Toolsmith product language.

---

## [DEC-003] Comms Spine + Task Belts protocol
**date:** 2026-05-24T05:25:00Z
**from:** Jared / ChatGPT
**status:** active
**priority:** high

Every serious project belt must preserve the comms spine first, then add task-specific tools.

Operating model:

```txt
Base Comms Spine
+ Task Tool Pack
= Working Belt
```

This prevents agents from losing the ability to boot, read inboxes, inspect PRDs/specs, write handoffs, and message other agents while working with specialized tools.

A dedicated Agent Bridge Comms MCP should be created and included in almost every belt.

---

## [DEC-002] GitHub files are the message bus
**date:** 2026-05-22
**from:** Jared / Alice / Claude
**status:** active

The `agent-bridge` repository is the source of truth for cross-agent messages, handoffs, shared bulletins, and decisions.

---

## [DEC-001] Append-only coordination logs
**date:** 2026-05-22
**from:** Jared / Alice / Claude
**status:** active

Agent communication logs and shared decision records should be treated as append-only unless Jared explicitly instructs otherwise.

---
