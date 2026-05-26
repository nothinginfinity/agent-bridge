# afo-docparse-geometry-mcp — Spec v0.1

_author: Claude · date: 2026-05-26 · status: draft_

---

## 1. Purpose

Wrap `nothinginfinity/post-ocr-geometry-engine` as a Cloudflare Worker MCP.

This becomes the **true OCR structured-output layer** in the DocParse stack — replacing the rough text pass in `afo-docparse-native-mcp` for all image and scanned PDF inputs where spatial geometry matters.

---

## 2. Position in the DocParse Stack

```
Image / Scanned PDF / Screenshot
        ↓
  OCR Provider (Tesseract TSV or PaddleOCR JSON)
        ↓
  afo-docparse-geometry-mcp   ← THIS WORKER
  · fromTesseractTSV()
  · fromPaddleOCR()
  · buildDocument() with table + code inference
        ↓
  afo-docparse-kv-table-mcp  (enrichment pass)
        ↓
  DocParse Schema             (validated output)
        ↓
  Tool Notes / Phone Studio   (storage + search)
```

---

## 3. Protocol

AFO Mobile MCP Protocol — POST /mcp, GET /health, hand-rolled JSON-RPC 2.0.
Custom domain: `afo-docparse-geometry-mcp.agentfeedoptimization.com`

---

## 4. Tools (7)

| Tool | Input | Output | Use case |
|---|---|---|---|
| `deployment_status` | — | health | health check |
| `parse_tesseract_tsv` | TSV string | blocks + markdown | screenshot / scanned PDF |
| `parse_paddle_ocr` | PaddleOCR JSON | blocks + markdown | PaddleOCR provider |
| `parse_text_lines` | string[] | blocks + markdown | digital PDF / plain text |
| `detect_tables` | TSV string | table blocks only | focused table extraction |
| `score_blocks` | block[] | scored blocks | external scoring pass |
| `blocks_to_markdown` | block[] | markdown string | emit without re-parsing |

---

## 5. Block Types (from engine)

```typescript
type StructuredBlockType =
  | "heading" | "paragraph" | "list" | "list_item"
  | "table" | "code" | "quote" | "caption"
  | "image" | "section_break" | "unknown";

interface StructuredBlock {
  id: string;
  type: StructuredBlockType;
  bbox: { left, top, width, height };
  page: number;
  text?: string;
  level?: number;        // heading level
  items?: StructuredBlock[];
  rows?: string[][];     // table rows
  confidence: number;    // 0.0–1.0
  ambiguity?: { level: "low"|"medium"|"high", reasons: string[] };
  flags?: string[];
}
```

---

## 6. parse_tesseract_tsv — Full Contract

**Input:**
```json
{
  "tsv": "level\tpage_num\t...\n5\t1\t...",
  "page_width": 1200,
  "page_height": 1600,
  "confidence_threshold": 60,
  "enable_table_inference": true,
  "enable_code_inference": true,
  "paragraph": {
    "max_vertical_gap_px": 18,
    "left_edge_tolerance_px": 16
  }
}
```

**Output:**
```json
{
  "ok": true,
  "provider": "tesseract",
  "page_count": 1,
  "block_count": 12,
  "markdown": "# Main Heading\n\nFirst paragraph...",
  "text": "Main Heading\n\nFirst paragraph...",
  "blocks": [...StructuredBlock array...],
  "needs_review": false,
  "overall_confidence": 0.92,
  "debug": {
    "warnings": ["Detected 1 table block(s) on page 1."],
    "ambiguous_blocks": [],
    "low_confidence_blocks": []
  }
}
```

---

## 7. Confidence & Escalation

| Signal | Threshold | Action |
|---|---|---|
| Block confidence | < 0.7 | Add to `low_confidence_blocks` |
| Ambiguity level | `high` | Add to `ambiguous_blocks` |
| Overall doc confidence | < 0.75 | Set `needs_review: true` |

Feeds `afo-docparse-bench-mcp` for quality evaluation and Phone Studio's `ocr_confidence` metadata.

---

## 8. Implementation Strategy

**Bundle at build time — not at runtime.**

The geometry engine is TypeScript compiled to JS. Cloudflare Workers can't run npm at runtime, but can run pre-bundled JS.

```bash
# In post-ocr-geometry-engine
npm install && npm run build
# dist/index.js → copy as engine.js alongside worker.js
```

Worker structure:
```
worker.js     ← MCP handler (AFO protocol, hand-rolled JSON-RPC)
engine.js     ← pre-bundled post-ocr-geometry-engine dist output
```

No Wrangler, no npm at deploy time, no D1 needed (stateless). Deploy via `cloudflare-multipart-mcp:deploy_worker_with_bindings`.

---

## 9. Deployment Checklist

- [ ] `npm run build` in `post-ocr-geometry-engine` → get `dist/index.js`
- [ ] Write `worker.js` (AFO MCP protocol)
- [ ] Deploy via cloudflare-multipart-mcp (no D1 binding needed)
- [ ] Add custom domain
- [ ] Health check + smoke test
- [ ] Integration test with `fixtures/tesseract/mixed-page.tsv`
- [ ] Register in Toolsmith catalogue
- [ ] Commit `CLOUDFLARE_WORKER.md` to geometry engine repo

---

## 10. Phase 4 Alignment

Completes the geometry engine's planned Phase 4:
- ✅ InfinityPaste adapter → `parse_tesseract_tsv` / `parse_paddle_ocr` tools
- ✅ Browser worker wrapper → Cloudflare Worker wrapping the bundled engine
- ✅ Confidence-based escalation hooks → `needs_review`, `low_confidence_blocks`, `ambiguous_blocks`

---

_spec: Claude · 2026-05-26_
