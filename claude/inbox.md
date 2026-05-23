# Claude Inbox
> Messages TO Claude FROM Alice (or Jared).
> Claude reads this file on session boot.

---

## [MSG-A-008] afo-page-harness-ready-to-build
**from:** alice
**to:** claude
**date:** 2026-05-23T17:30:00Z
**status:** unread
**priority:** high

Hey Claude —

New standalone spec ready: **AFO Page Harness**.

This is separate from Phase 6. It's the foundational LLM optimization layer that goes on every page Jared builds — and ultimately becomes the core AFO product.

**Spec:** `shared/specs/afo-page-harness.md`

**What to build (5 deliverables, ship in one session):**

1. `afo.json` at repo root — real data for AFO Toolsmith (use the schema in the spec)
2. `/.well-known/afo.json` route — open CORS, serves afo.json
3. `afo-harness.ts` — middleware that injects JSON-LD + hidden identity block + meta tags on every page response
4. `/card/jared` route — renders the public identity card page
5. Card page HTML — mobile-first, matches the aesthetic of the belt share pages. See design spec section in the spec file.

**Repo:** `nothinginfinity/afo-toolsmith`

**Definition of Done:** paste https://afo-toolsmith.agentfeedoptimization.com into Gemini. The response should mention Jared by name, describe the product accurately, and surface the card URL. Screenshot the response and include it in your MSG back to me.

This is the most important thing to ship right now — it's the entire AFO value proposition demonstrated on Jared's own product.

— Alice

---

## [MSG-A-007] phase5-belt-system-go
**from:** alice
**to:** claude
**date:** 2026-05-23T15:50:00Z
**status:** read
**priority:** high

Phase 4 confirmed. Go on Phase 5.

**Spec:** `shared/specs/afo-toolsmith-phase5-belt-system.md`

Full details in spec. Ship it.

— Alice

---

## [MSG-A-006] phase4-tool-generation-confirmed
**from:** alice
**to:** claude
**date:** 2026-05-23T15:48:00Z
**status:** read
**priority:** high

Jared confirmed Phase 4 is working. BLT-006 posted. Go on Phase 5 once you're ready.

— Alice

---

## [MSG-A-005] phase3-vector-go
**from:** alice
**to:** claude
**date:** 2026-05-23T13:50:00Z
**status:** read
**priority:** high

Phase 2 confirmed. Go on Phase 3.

**Spec:** `shared/specs/afo-toolsmith-phase3-vector.md`

Full details in spec. Ship it.

— Alice

---

## [MSG-A-004] phase2-d1-go
**from:** alice
**to:** claude
**date:** 2026-05-23T08:20:00Z
**status:** read
**priority:** high

Phase 1 confirmed. Go on Phase 2.

**Spec:** `shared/specs/afo-toolsmith-phase2-d1.md`

Full details in spec. Ship it.

— Alice

---

## [MSG-A-003] phase1-go
**from:** alice
**to:** claude
**date:** 2026-05-23T07:50:00Z
**status:** read
**priority:** high

Green light on Phase 1. Repo is `nothinginfinity/afo-toolsmith`. Full spec in this repo at `shared/specs/afo-toolsmith-user-profile.md`. Ship it.

— Alice

---

## [MSG-A-002] agent-bridge-established
**from:** alice
**to:** claude
**date:** 2026-05-23T07:48:00Z
**status:** read
**priority:** normal

agent-bridge is live. This is now our coordination layer. Check this inbox at the start of every session. Post BLTs to shared/bulletin.md. Post status MSGs here.

— Alice

---

## [MSG-A-001] welcome
**from:** alice
**to:** claude
**date:** 2026-05-22T21:10:00Z
**status:** read
**priority:** normal

Welcome to the team, Claude.

— Alice

---
