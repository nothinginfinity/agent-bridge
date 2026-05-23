# Agent Harness — Update Checklist

**maintained_by:** alice  
**version:** 1.0  
**last_updated:** 2026-05-23  
**applies_to:** claude, alice, all future agents  

> A harness is the version-controlled instruction set that boots an AI agent into the right identity, context, and workflow. Think of it as firmware. Like firmware, it must be updated when the system changes.

---

## What is a Harness?

A harness is the complete set of instructions an agent needs to operate correctly in a given workspace. It is:
- **Version-controlled** — every change is a commit, every version is tagged
- **Agent-specific** — each agent (Claude, Alice, future agents) has their own harness file
- **Layered** — shared context lives in `shared/`, agent-specific context in `{agent}/BOOT.md`
- **Loadable** — designed to be pasted into a new chat or fetched via a URL link

---

## The 10 Harness Modules

Every agent harness must cover all 10 modules. When updating, check each module.

### Module 1 — Identity
> Does the agent know who it is in this workspace?

- [ ] Agent name and model
- [ ] Role in this workspace (builder / speccer / strategist / researcher)
- [ ] Who it reports to / works with
- [ ] What it does NOT do (boundaries)
- [ ] Operator name and handle

### Module 2 — Boot Sequence
> Does the agent know exactly what to do at the start of every session?

- [ ] Ordered boot steps (read BOOT → inbox → bulletin → roadmap)
- [ ] Which files to check first
- [ ] How to signal a successful boot
- [ ] What to report to the operator on boot

### Module 3 — Communication Protocol
> Does the agent know where messages are, how to read them, and how to write back?

- [ ] Repo and branch for coordination layer
- [ ] File map: inbox / outbox / log / bulletin / shared
- [ ] MSG format and numbering convention
- [ ] BLT format and numbering convention
- [ ] Read-before-write rule (SHA fetch before PUT)
- [ ] How to mark messages read
- [ ] How to reach other agents

### Module 4 — Active Project
> Does the agent know the current primary project?

- [ ] Project repo and branch
- [ ] Live URL
- [ ] Deploy command
- [ ] Database / binding names
- [ ] Auth tokens / secret names (not values)
- [ ] Current phase / sprint
- [ ] What has shipped (done list)
- [ ] What is in progress

### Module 5 — Tools
> Does the agent know what tools it has and what each one does?

- [ ] Full list of connected MCP tools
- [ ] What each tool is used for in this workspace
- [ ] Which tool is the primary / most important
- [ ] What to do if a tool is missing or disconnected

### Module 6 — Build / Work Protocol
> Does the agent know its step-by-step process for doing its core job?

- [ ] End-to-end process from receiving a task to marking it complete
- [ ] Definition of done (what must be true before calling something finished)
- [ ] How to handle errors or blockers
- [ ] How to escalate to the operator

### Module 7 — Operator Context
> Does the agent know enough about the operator to make good decisions?

- [ ] Operator name, handle, GitHub username
- [ ] Operator's stack / platform preferences
- [ ] Operator's working style (speed, mobile-first, no over-engineering, etc.)
- [ ] Operator's domain and org
- [ ] Other agents in the operator's ecosystem

### Module 8 — Other Projects
> Does the agent know where to find context on projects beyond the current one?

- [ ] List of known repos
- [ ] Where to find specs for new projects
- [ ] How to get a new project's boot context (ask Alice / check ROADMAP)

### Module 9 — Harness Version History
> Is the harness versioned so we know what changed and when?

- [ ] Semantic version number (major.minor)
- [ ] Date of last update
- [ ] Changelog entry for each version
- [ ] Who is responsible for maintaining this harness
- [ ] Trigger conditions for next update (see below)

### Module 10 — Context Links
> Can the harness be delivered as a URL rather than pasted text?

- [ ] Harness stored at a stable, fetchable URL (raw GitHub or Context Links MCP slug)
- [ ] URL tested — agent can fetch and parse it
- [ ] Boot instruction paste format: `"Read [URL] and boot up."`
- [ ] Version tag in URL so old versions are archived, not overwritten

---

## Update Triggers

A harness update is required when ANY of the following happen:

| Trigger | Module(s) affected |
|---|---|
| New phase ships | 4 (active project), 9 (version history) |
| New MCP tool connected or disconnected | 5 (tools) |
| New project added | 4 or 8 (projects) |
| Agent bridge file structure changes | 3 (communication) |
| New agent added to the ecosystem | 3, 7 |
| Operator preferences change | 7 |
| Boot sequence changes | 2 |
| Deploy command or secret name changes | 4, 5 |
| Harness URL changes | 10 |
| Auth token rotated (name change only — never put values in harness) | 4 |

---

## Update Protocol

When a harness update is triggered:

```
1. Alice identifies which modules need updating
2. Alice edits {agent}/BOOT.md — bump minor version (e.g. 1.2 → 1.3)
3. Alice adds changelog entry to Module 9 (version history)
4. Alice pushes to agent-bridge main
5. Alice posts BLT to shared/bulletin.md: "Harness v1.3 live — modules updated: 4, 9"
6. Alice sends MSG to agent's inbox: "Harness updated to v1.3. Read BOOT.md."
7. Agent reads updated BOOT.md on next boot
8. Agent confirms: "Booted on harness v1.3"
```

**Major version bump (e.g. 1.x → 2.0):** when the agent's role, primary project, or communication protocol fundamentally changes.

---

## Harness Registry

All harnesses across the platform:

| Agent | File | Current Version | Last Updated |
|---|---|---|---|
| Claude | `claude/BOOT.md` | v1.2 | 2026-05-23 |
| Alice | `alice/BOOT.md` | — | pending |

> Alice's BOOT.md is future work — Alice boots via Perplexity Space instructions. When FP-1 (Instruction Factory) ships, Alice's harness will be a Context Link URL.

---

## Future: Automated Harness Checks

This is manual today. The automation roadmap:

| Phase | What it does | When |
|---|---|---|
| Manual (now) | Alice updates BOOT.md on trigger | Today |
| Semi-auto | AFO Toolsmith auto-diffs harness on phase ship, flags stale modules | Phase 6 |
| Full auto | Cron job checks all 10 modules against current system state, opens a harness PR if stale | FP-1 |
| Agent-native | Agent self-checks harness on boot, flags discrepancies to Alice | FP-2 |

---

## Harness Design Principles

1. **Paste-able:** the entire harness should fit in a single chat message if needed
2. **Fetchable:** should always be available at a stable URL
3. **Layered:** shared context in shared files; agent-specific in agent BOOT.md
4. **Minimal:** no info the agent doesn't need. Every line earns its place.
5. **Current:** a stale harness is worse than no harness — it creates confident wrong behavior
6. **Versioned:** every change is a commit. Roll back is always possible.
7. **Self-describing:** the harness should explain itself — what it is, how to use it

---

*"Updating a harness is a software release. Treat it like one."*
