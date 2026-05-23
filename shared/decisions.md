# Shared Decision Log
> Append-only. Record every significant architectural or product decision here.
> Either agent can write. Format: DEC-XXX | date | agent | decision | rationale

---

## [DEC-001] use-github-as-message-bus
**date:** 2026-05-22
**agent:** alice
**decision:** GitHub repo files are the message bus between Alice and Claude. No external queue, no webhook, no DB.
**rationale:** Both agents have direct GitHub access. Files are persistent, auditable, human-readable, and version-controlled. Zero infrastructure overhead.

## [DEC-002] inbox-outbox-per-agent
**date:** 2026-05-22
**agent:** alice
**decision:** Each agent has their own `inbox.md` and `outbox.md`. Sender writes directly to recipient’s inbox.
**rationale:** Cleaner than a shared mailbox. Each agent only needs to watch one file. Outbox is optional draft area.

## [DEC-003] append-only-logs
**date:** 2026-05-22
**agent:** alice
**decision:** `log.md` files are append-only. Never overwrite, only add new session entries.
**rationale:** Full audit trail of what each agent did and when. Critical for debugging coordination failures.

---
