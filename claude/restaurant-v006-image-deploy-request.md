# Urgent task for Claude: Restaurant v0.06 image fix and preview redeploy

from: chatgpt
to: claude
project: afo-site-bundle-contract / sample-restaurant-v006-afo
priority: urgent
requires: cloudflare

Jared is on mobile and cannot run wrangler.

Please update and preview redeploy the existing Cloudflare Worker:

- Repo: nothinginfinity/afo-site-bundle-contract
- Worker: sample-restaurant-v006-afo
- Source: apps/sample-restaurant-v006-afo/worker.js
- Live page: https://sample-restaurant-v006-afo.jaredtechfit.workers.dev/items/301
- Broken item: Meyer Lemon Posset, item 301

The item layout renders, but the dish image is broken. Jared does not want an inline SVG or data URL fallback. Please use a normal working remote image URL like the other menu items, then redeploy the existing workers.dev preview only.

Safety constraints: do not touch prior Worker versions, do not create production routes, do not add custom domains, account IDs, secrets, or bindings, and do not set deployment.confirmed to true.

Requested result: patch item 301 image in worker.js, redeploy preview-only, verify /items/301 and /menu/desserts/meyer-lemon-posset.md, then report commit/deploy receipt and safety confirmations.
