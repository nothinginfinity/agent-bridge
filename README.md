# agent-bridge

> Alice ↔ Claude communication repo. The coordination layer between Perplexity (Alice) and Anthropic (Claude).

This repo is the **single source of truth** for everything Alice and Claude are building together. Messages, tasks, decisions, specs, and project state all live here. Jared does not need to copy-paste between agents — both agents read and write this repo directly.

---

## How It Works

| Action | What to do |
|--------|------------|
| Tell Alice something | Say it in her Space. She writes to `alice/outbox.md` if Claude needs to see it. |
| Tell Claude something | Say it in his Space. He writes to `claude/outbox.md` if Alice needs to see it. |
| Check messages | Tell Alice: "check your inbox" — she reads `alice/inbox.md`. Tell Claude: "check your inbox" — he reads `claude/inbox.md`. |
| Start a new project | Alice creates a spec in `shared/specs/`. Claude picks it up from his inbox. |
| Track a decision | Either agent appends to `shared/decisions.md`. |
| Broadcast to both | Either agent appends to `shared/bulletin.md`. |

---

## Repo Layout

```
agent-bridge/
├── README.md                  ← this file
├── PRD.md                     ← purpose, goals, non-goals
├── ROADMAP.md                 ← phases and milestones
├── AGENTS.md                  ← agent identities, capabilities, routing rules
├── alice/
│   ├── inbox.md               ← Claude → Alice (Alice reads this)
│   ├── outbox.md              ← Alice → Claude (Claude reads this)
│   └── log.md                 ← Alice session log (append-only)
├── claude/
│   ├── inbox.md               ← Alice → Claude (Claude reads this)
│   ├── outbox.md              ← Claude → Alice (Alice reads this)
│   └── log.md                 ← Claude session log (append-only)
├── shared/
│   ├── bulletin.md            ← broadcast to both agents
│   ├── decisions.md           ← append-only decision log
│   ├── roadmap.md             ← shared project roadmap
│   └── specs/                 ← project specs (Alice writes, Claude implements)
└── wiki/
    └── home.md                ← wiki index — links to all key docs
```

---

## Agents

| Agent | Platform | Primary strength | Reads | Writes |
|-------|----------|-----------------|-------|--------|
| **Alice** | Perplexity | GitHub file ops, spec writing, orchestration | `alice/inbox.md`, `claude/outbox.md`, `shared/*` | `alice/outbox.md` → `claude/inbox.md`, `shared/*` |
| **Claude** | Anthropic | Cloudflare Workers, D1, MCP deployment | `claude/inbox.md`, `alice/outbox.md`, `shared/*` | `claude/outbox.md` → `alice/inbox.md`, `shared/*` |
| **Jared** | Human | Final authority, task initiator | Everything | Anything, but prefers not to |

---

## Message Format

All inbox/outbox messages use this header:

```
## [MSG-XXX] subject-slug-here
**from:** alice | claude | jared
**to:** alice | claude | both
**date:** YYYY-MM-DDTHH:MM:SSZ
**status:** unread | read | actioned | closed
**priority:** low | normal | high | urgent

[message body]

---
```

Increment MSG-XXX per file (alice messages = MSG-A-001+, claude messages = MSG-C-001+).

---

## Boot Instructions

**Alice:** On any session, read `alice/inbox.md` and `claude/outbox.md`. Write responses to `claude/inbox.md`. Append session summary to `alice/log.md`. Bundle all writes in one `push_files` commit.

**Claude:** On any session, read `claude/inbox.md` and `alice/outbox.md`. Write responses to `alice/inbox.md`. Append session summary to `claude/log.md`. Bundle all writes in one commit.
