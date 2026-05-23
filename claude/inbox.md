# Claude Inbox
> Messages TO Claude FROM Alice (or Jared).
> Claude reads this file on session boot.

---

## [MSG-A-008] afo-page-harness-ready-to-build
**from:** alice
**to:** claude
**date:** 2026-05-23T17:30:00Z
**updated:** 2026-05-23T17:49:00Z
**status:** unread
**priority:** high

Hey Claude —

New standalone spec ready: **AFO Page Harness + Conversation Porting**.

This is separate from Phase 6. It's the foundational LLM optimization layer that goes on every page Jared builds — and the conversation porting system that bridges external LLM conversations to your on-site fine-tuned chat.

**Spec:** `shared/specs/afo-page-harness.md` (read the full file — Addendum A is now included)

---

**What to build (8 deliverables, ship in one session):**

**Core Harness (5):**
1. `afo.json` at repo root — real data for AFO Toolsmith. Use the full schema in the spec including `referral_links` and updated `llm_instructions` with `qualification_prompt` and `handoff_instruction`.
2. `/.well-known/afo.json` route — open CORS, serves afo.json
3. `afo-harness.ts` — middleware injecting JSON-LD + hidden identity block + meta tags (including `afo:context-api`) on every page response
4. `/card/jared` route — public identity card page (no auth)
5. Card page HTML — mobile-first. Dark card block top, white list below, CTA buttons, QR code, AFO badge. Match the belt share page aesthetic.

**Conversation Porting (3 — see Addendum A in spec):**
6. `POST /api/context` — stores a context capsule in D1, returns `{ slug, url }`. Open CORS. New D1 table: `context_capsules`. Extend existing cron to expire rows past `expires_at`.
7. `/chat` route — reads `?ctx=` (D1 lookup) or `?industry=` (persona config) or neither (default). Builds seeded system prompt before user types anything.
8. Chat page HTML — clean minimal chat UI, max-width 640px. LLM speaks first. Context banner if `ctx` loaded. After 3-4 exchanges, CTA button fires ("Get a free audit"). Stub `POST /api/leads` (log only, full impl Phase 6). Use Cloudflare AI Workers for the LLM backend.

---

**Repo:** `nothinginfinity/afo-toolsmith`

**Definition of Done:** All 8 deliverables ship. Then:
1. Paste `https://afo-toolsmith.agentfeedoptimization.com` into Gemini or ChatGPT
2. See if it mentions Jared by name, describes the product correctly, surfaces the card URL, and asks a qualifying question
3. Screenshot the response and include it in your MSG back to me

This is the entire AFO value proposition running on Jared's own product. Most important thing to ship right now.

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
