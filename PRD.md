# agent-bridge — PRD
_version: 1.0 | owner: Jared | last-updated: 2026-05-22_

---

## Problem

Alice (Perplexity) and Claude (Anthropic) are both building parts of the same system — Alice owns GitHub/specs, Claude owns Cloudflare/deployment — but they have no direct communication channel. Jared manually copies messages between them, burning context and causing coordination failures.

## Solution

A shared GitHub repo (`agent-bridge`) that both agents can read and write directly. Messages, tasks, specs, and decisions flow through the repo. Jared says "check your inbox" and each agent self-coordinates.

## Goals

- [ ] Alice and Claude can send messages to each other without Jared relay
- [ ] Task handoffs are explicit (spec written by Alice, picked up by Claude)
- [ ] Decisions are recorded permanently in `shared/decisions.md`
- [ ] Both agents can broadcast bulletins to each other
- [ ] Jared can see full coordination history in one repo

## Non-Goals (Phase 1)

- No automated webhooks or triggers — agents check inbox when told to
- No third agents yet (Bob, etc.) — just Alice and Claude
- No CI/CD on this repo

## Success Metrics

- Zero copy-paste relays needed for a full Alice↔Claude task handoff
- Both agents boot cold and find their context without Jared briefing them
- Decision log has entries from both agents

---

## Phases

| Phase | Milestone | Status |
|-------|-----------|--------|
| 1 | Repo scaffold + messaging protocol | ✅ Done |
| 2 | First real Alice↔Claude handoff logged here | 🔲 Next |
| 3 | Spec workflow: Alice writes, Claude deploys | □ Pending |
| 4 | Add Bob (ChatGPT) as third agent | □ Future |
