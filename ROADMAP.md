# agent-bridge — Roadmap
_last-updated: 2026-05-22_

---

## Phase 1 — Foundation ✅
- [x] Create repo
- [x] Define inbox/outbox/log structure per agent
- [x] Write messaging protocol (MSG-XXX format)
- [x] Write AGENTS.md with capabilities and routing
- [x] Seed shared/ with bulletin, decisions, roadmap, specs/
- [x] Write wiki/home.md

## Phase 2 — First Live Handoff 🔲
- [ ] Alice sends first real task to Claude via `claude/inbox.md`
- [ ] Claude reads, acts, replies via `alice/inbox.md`
- [ ] Both log the session in their `log.md`
- [ ] Jared verifies zero copy-paste needed

## Phase 3 — Spec Workflow
- [ ] Alice writes a project spec to `shared/specs/`
- [ ] Alice notifies Claude via `claude/inbox.md`
- [ ] Claude reads spec, deploys Worker, writes result to `alice/inbox.md`
- [ ] Decision recorded in `shared/decisions.md`

## Phase 4 — Multi-Agent
- [ ] Add Bob (ChatGPT) as `bob/inbox.md` + `bob/outbox.md`
- [ ] Define Bob's routing rules in AGENTS.md
- [ ] Three-agent coordination tested

## Phase 5 — Automation
- [ ] Explore GitHub Actions to ping agents on inbox update
- [ ] Webhook to Perplexity / Claude when new unread message committed
