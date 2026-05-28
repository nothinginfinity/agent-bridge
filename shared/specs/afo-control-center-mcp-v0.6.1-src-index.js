// afo-control-center-mcp v0.6.1
// Patch: queue dedupe + resolution, MCP tool additions, dashboard Needs Attention, resolve-fixed

const VERSION = "0.6.1";

// ─── Target ID normalizer ─────────────────────────────────────────────────────
const ALIAS_MAP = {
  "agent-action-root": "afo-agent-action-page-mcp",
  "control-center-root": "afo-control-center-mcp",
  "toolsmith-ui": "afo-toolsmith",
};

function normalizeTargetId(row) {
  const id = row.id || "";
  const title = row.title || "";
  if (id.startsWith("worker-")) {
    const stripped = id.slice("worker-".length);
    if (ALIAS_MAP[stripped]) return ALIAS_MAP[stripped];
    return stripped;
  }
  if (title && title.startsWith("afo-")) return title;
  if (ALIAS_MAP[id]) return ALIAS_MAP[id];
  return row.target_id || id;
}

// ─── Queue upsert helper ──────────────────────────────────────────────────────
async function upsertQueueIssue(db, { item_type, target_id, issue, severity, recommendation, source }) {
  const id = `${item_type}-${target_id}-${issue}`;
  const now = new Date().toISOString();

  try {
    await db.prepare(`
      INSERT INTO control_registration_queue
        (id, item_type, target_id, issue, severity, status, recommendation, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
      ON CONFLICT(target_id, issue, status) DO UPDATE SET
        severity = excluded.severity,
        recommendation = excluded.recommendation,
        source = excluded.source,
        updated_at = excluded.updated_at
    `).bind(id, item_type, target_id, issue, severity, recommendation, source, now, now).run();
    return id;
  } catch (e) {
    await db.prepare(`
      INSERT INTO control_registration_queue
        (id, item_type, target_id, issue, severity, status, recommendation, source, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        severity = excluded.severity,
        recommendation = excluded.recommendation,
        source = excluded.source,
        updated_at = excluded.updated_at,
        status = CASE WHEN control_registration_queue.status = 'open' THEN 'open' ELSE control_registration_queue.status END
    `).bind(id, item_type, target_id, issue, severity, recommendation, source, now, now).run();
    return id;
  }
}

// ─── Resolve stale issues helper ─────────────────────────────────────────────
async function resolveMissingIssues(db, source, activeIssueKeys) {
  const now = new Date().toISOString();
  const { results: openRows } = await db.prepare(`
    SELECT id, item_type, target_id, issue FROM control_registration_queue
    WHERE source = ? AND status = 'open'
  `).bind(source).all();

  let resolvedCount = 0;
  for (const row of openRows) {
    const key = `${row.item_type}:${row.target_id}:${row.issue}`;
    if (!activeIssueKeys.has(key)) {
      await db.prepare(`
        UPDATE control_registration_queue
        SET status = 'resolved',
            resolved_at = ?,
            resolved_reason = 'audit_no_longer_detects_issue',
            updated_at = ?
        WHERE id = ?
      `).bind(now, now, row.id).run();
      resolvedCount++;
    }
  }
  return resolvedCount;
}

// ─── Audit: workers ───────────────────────────────────────────────────────────
async function runAuditWorkers(db) {
  const { results: workers } = await db.prepare(`
    SELECT * FROM control_worker_enrichment ORDER BY worker_id
  `).all();

  const activeIssueKeys = new Set();
  const issues = [];
  let upsertedCount = 0;

  for (const w of workers) {
    const tid = w.worker_id;
    const checks = [
      { condition: !w.custom_domain, issue: "missing_custom_domain", severity: "normal", recommendation: "Add a custom domain mapping for this Worker" },
      { condition: !w.health_url, issue: "missing_health_url", severity: "normal", recommendation: "Set health_url in control_worker_enrichment" },
      { condition: !w.repo_url, issue: "missing_repo_url", severity: "low", recommendation: "Link to the GitHub repo for this Worker" },
      { condition: !w.smoke_status, issue: "missing_smoke_status", severity: "normal", recommendation: "Run /sync/worker-health to populate smoke status" },
      { condition: w.smoke_status === "fail", issue: "smoke_status_fail", severity: "high", recommendation: "Worker health check is failing — inspect the Worker logs" },
      {
        condition: w.has_d1_binding == null || w.has_d1_binding === 0,
        issue: !w.has_d1_binding && w.has_d1_binding !== 0 ? "missing_d1_binding_unknown" : "no_d1_binding",
        severity: "low",
        recommendation: w.has_d1_binding == null ? "D1 binding status unknown — run /sync/workers to refresh" : "Worker has no D1 binding — expected for stateless tools",
      },
    ];
    for (const check of checks) {
      if (check.condition) {
        const key = `worker:${tid}:${check.issue}`;
        activeIssueKeys.add(key);
        issues.push({ target_id: tid, issue: check.issue, severity: check.severity });
        await upsertQueueIssue(db, { item_type: "worker", target_id: tid, issue: check.issue, severity: check.severity, recommendation: check.recommendation, source: "audit/workers" });
        upsertedCount++;
      }
    }
  }
  const resolvedCount = await resolveMissingIssues(db, "audit/workers", activeIssueKeys);
  return { ok: true, issues_count: issues.length, upserted_count: upsertedCount, resolved_count: resolvedCount, issues };
}

// ─── Audit: tools ─────────────────────────────────────────────────────────────
async function runAuditTools(db) {
  const { results: workers } = await db.prepare(`SELECT * FROM control_worker_enrichment ORDER BY worker_id`).all();
  const activeIssueKeys = new Set();
  const issues = [];
  let upsertedCount = 0;

  for (const w of workers) {
    const tid = w.worker_id;
    const checks = [
      { condition: !w.mcp_url, issue: "missing_mcp_url", severity: "normal", recommendation: "Set mcp_url in control_worker_enrichment" },
      { condition: w.mcp_status === "fail" || w.mcp_status === "error", issue: "mcp_status_fail", severity: "high", recommendation: "MCP endpoint is failing — check /mcp route and bindings" },
      { condition: !w.toolsmith_registered, issue: "not_toolsmith_registered", severity: "low", recommendation: "Register this Worker's tools in AFO Toolsmith catalogue" },
      { condition: w.mcp_url && !w.mcp_status, issue: "mcp_status_unknown", severity: "normal", recommendation: "Run /sync/worker-health to populate MCP status" },
    ];
    for (const check of checks) {
      if (check.condition) {
        const key = `tool:${tid}:${check.issue}`;
        activeIssueKeys.add(key);
        issues.push({ target_id: tid, issue: check.issue, severity: check.severity });
        await upsertQueueIssue(db, { item_type: "tool", target_id: tid, issue: check.issue, severity: check.severity, recommendation: check.recommendation, source: "audit/tools" });
        upsertedCount++;
      }
    }
  }
  const resolvedCount = await resolveMissingIssues(db, "audit/tools", activeIssueKeys);
  return { ok: true, issues_count: issues.length, upserted_count: upsertedCount, resolved_count: resolvedCount, issues };
}

// See full source at: shared/specs/afo-control-center-mcp-v0.6.1-src-index.js
// Dashboard, MCP tools, sync, and fetch handler are in the deployed Worker.
