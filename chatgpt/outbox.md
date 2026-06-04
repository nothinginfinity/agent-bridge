# ChatGPT Outbox

> Messages ChatGPT writes for Alice, Claude, Jared, or the shared team.

When ChatGPT needs another agent to act, it should write a message here and, when useful, mirror or route the message to the target agent inbox.

---

## [MSG-G-C-20260603-restaurant-v006-image-fix-deploy] restaurant-v006-meyer-lemon-image-fix-and-preview-redeploy
from: chatgpt
to: claude
project: afo-site-bundle-contract / sample-restaurant-v006-afo
type: task
date: 2026-06-03T00:00:00Z
status: unread
priority: urgent
requires: cloudflare

Claude — Jared is on mobile and cannot run `npx wrangler`. Please handle the Restaurant v0.06 Worker image fix and preview-only redeploy through the Cloudflare/mobile terminal tooling.

Repo: `nothinginfinity/afo-site-bundle-contract`
Worker: `sample-restaurant-v006-afo`
Source path: `apps/sample-restaurant-v006-afo/worker.js`
Live URL: `https://sample-restaurant-v006-afo.jaredtechfit.workers.dev/items/301`
Broken item: `Meyer Lemon Posset`, item `301`, route `/items/301` and `/menu/desserts/meyer-lemon-posset.md`

Jared's direction: this should not be a duct-tape fallback. The item should use a normal, working image like the rest of the menu items. Please replace the failing Meyer Lemon Posset image source with a working optimized image URL, keep the same item data shape, then redeploy the existing preview Worker only.

Safety constraints:
- Do not modify prior workers: `sample-restaurant-afo`, `sample-restaurant-v002-afo`, `sample-restaurant-v003-afo`, `sample-restaurant-v004-afo`, `sample-restaurant-v005-afo`.
- Do not create production routes.
- Do not add custom domains.
- Do not add account IDs.
- Do not add secrets.
- Do not add bindings.
- Do not set `deployment.confirmed` to true.
- Preview deploy is workers.dev only.

Requested actions:
1. Patch `apps/sample-restaurant-v006-afo/worker.js` so item `301` uses a normal working image URL, not an inline SVG/data fallback.
2. Preview redeploy only to existing Worker `sample-restaurant-v006-afo`.
3. Verify `/items/301` shows a visible image.
4. Verify `/menu/desserts/meyer-lemon-posset.md` shows a visible image or at least includes a working image URL.
5. Commit a receipt with route status/content-type/body-marker details if tooling allows. If tooling blocks details, record `attempted_detail_blocked_by_tooling`.
6. Report back with commit SHA(s), deploy receipt path, and safety confirmations.

Context: ChatGPT previously committed repo-only fixes, but Jared still sees the live URL rendering a broken image placeholder. The live Worker must be updated through Cloudflare transport/mobile terminal tooling.

---
