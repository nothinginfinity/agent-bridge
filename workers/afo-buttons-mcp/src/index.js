/**
 * afo-buttons-mcp v0.1.1
 * AFO UI Belt — Button System Generator + Auditor
 * Protocol: AFO Mobile MCP Protocol (hand-rolled JSON-RPC 2.0)
 * Routes: GET /, GET /health, GET /llms.txt, GET /tools/list, POST /mcp
 * No bindings. No npm. No build step.
 */

const VERSION = '0.1.1';
const WORKER_NAME = 'afo-buttons-mcp';
const WORKER_URL = 'https://afo-buttons-mcp.jaredtechfit.workers.dev';

// ─── Entry Point ───────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === 'OPTIONS') return corsResponse(204);

    // GET /
    if (method === 'GET' && url.pathname === '/') {
      return htmlResponse(rootPage());
    }

    // GET /health
    if (method === 'GET' && url.pathname === '/health') {
      return jsonResponse({ ok: true, worker: WORKER_NAME, version: VERSION });
    }

    // GET /llms.txt
    if (method === 'GET' && url.pathname === '/llms.txt') {
      return textResponse(llmsTxt());
    }

    // GET /tools/list  (HTTP convenience — mirrors tools/list JSON-RPC result)
    if (method === 'GET' && url.pathname === '/tools/list') {
      return jsonResponse({ tools: TOOLS_LIST });
    }

    // POST /mcp
    if (method === 'POST' && url.pathname === '/mcp') {
      return handleMcp(request);
    }

    return jsonResponse({ error: 'Not found' }, 404);
  }
};

// ─── Static Pages ──────────────────────────────────────────────────────────────

function rootPage() {
  const toolRows = TOOLS_LIST.map(t =>
    `<tr><td><code>${t.name}</code></td><td>${t.description}</td></tr>`
  ).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${WORKER_NAME} v${VERSION}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; color: #1a1a1a; }
    h1 { font-size: 1.4rem; margin-bottom: 0.25rem; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; border-radius: 4px; padding: 2px 8px; font-size: 0.75rem; font-family: monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th { text-align: left; border-bottom: 2px solid #e0e0e0; padding: 6px 8px; font-size: 0.8rem; color: #555; }
    td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; font-size: 0.875rem; }
    td code { background: #f5f5f5; border-radius: 3px; padding: 1px 5px; }
    .routes { margin-top: 1.5rem; }
    .routes li { margin: 0.3rem 0; font-family: monospace; font-size: 0.875rem; }
  </style>
</head>
<body>
  <h1>${WORKER_NAME} <span class="badge">v${VERSION}</span></h1>
  <p>AFO UI Belt — Button system generator, auditor, and repair tool.</p>

  <div class="routes">
    <strong>Routes</strong>
    <ul>
      <li>GET  /</li>
      <li>GET  /health</li>
      <li>GET  /llms.txt</li>
      <li>GET  /tools/list</li>
      <li>POST /mcp  (JSON-RPC 2.0)</li>
    </ul>
  </div>

  <strong>Tools</strong>
  <table>
    <thead><tr><th>Name</th><th>Description</th></tr></thead>
    <tbody>${toolRows}</tbody>
  </table>
</body>
</html>`;
}

function llmsTxt() {
  const toolLines = TOOLS_LIST.map(t => `- ${t.name}: ${t.description}`).join('\n');
  return `# ${WORKER_NAME} v${VERSION}

> AFO UI Belt — Button system generator, auditor, and repair tool.
> Protocol: JSON-RPC 2.0 via POST /mcp
> Base URL: ${WORKER_URL}

## Routes

- GET  /           Human-readable index page
- GET  /health     Liveness check → { ok, worker, version }
- GET  /llms.txt   This file
- GET  /tools/list Tools array (JSON)
- POST /mcp        JSON-RPC 2.0 endpoint

## Tools

${toolLines}

## Usage

POST ${WORKER_URL}/mcp
Content-Type: application/json

{ "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {} }
`;
}

// ─── MCP Handler ───────────────────────────────────────────────────────────────

async function handleMcp(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, 'Parse error');
  }

  const { jsonrpc, id, method, params } = body;

  if (jsonrpc !== '2.0') return rpcError(id, -32600, 'Invalid Request');

  switch (method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: WORKER_NAME, version: VERSION },
        capabilities: { tools: {} }
      });

    case 'ping':
      return rpcResult(id, {});

    case 'tools/list':
      return rpcResult(id, { tools: TOOLS_LIST });

    case 'tools/call': {
      const toolName = params?.name;
      const args = params?.arguments ?? {};
      return handleToolCall(id, toolName, args);
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ─── Tools List ────────────────────────────────────────────────────────────────

const TOOLS_LIST = [
  {
    name: 'generate_button',
    description: 'Generate a single contract-bound button HTML + JS snippet.',
    inputSchema: {
      type: 'object',
      properties: {
        spec: { type: 'object', description: 'ButtonSpec object' }
      },
      required: ['spec']
    }
  },
  {
    name: 'generate_button_group',
    description: 'Generate a toolbar from multiple button specs.',
    inputSchema: {
      type: 'object',
      properties: {
        specs: { type: 'array', description: 'Array of ButtonSpec objects' },
        layout: { type: 'string', enum: ['row', 'column'], description: 'Layout direction' },
        label: { type: 'string', description: 'Optional group label' }
      },
      required: ['specs']
    }
  },
  {
    name: 'generate_copy_button',
    description: 'Generate a clipboard copy button with ✓ success feedback.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        label: { type: 'string' },
        copy_value: { type: 'string', description: 'Static string or {variable} token' },
        success_label: { type: 'string', description: 'Label shown after copy. Default: Copied!' },
        reset_ms: { type: 'number', description: 'Ms before label resets. Default: 2000' }
      },
      required: ['id', 'label', 'copy_value']
    }
  },
  {
    name: 'generate_admin_button',
    description: 'Generate an admin-gated button hidden until admin_passcode is resolved.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        label: { type: 'string' },
        variant: { type: 'string', enum: ['danger', 'primary', 'secondary', 'ghost'] },
        action: { type: 'string', enum: ['fetch', 'navigate', 'toggle', 'noop'] },
        endpoint: { type: 'string' },
        method: { type: 'string', enum: ['GET', 'POST', 'DELETE'] },
        confirm: { type: 'boolean' },
        success_target: { type: 'string' },
        error_target: { type: 'string' }
      },
      required: ['id', 'label']
    }
  },
  {
    name: 'audit_buttons',
    description: 'Audit all declared buttons against a UI contract. Returns pass/fail per button + repair plan.',
    inputSchema: {
      type: 'object',
      properties: {
        page_source: { type: 'string', description: 'Full HTML source of the Worker page' },
        contract: {
          type: 'object',
          description: 'UI contract with buttons array',
          properties: {
            buttons: { type: 'array', description: 'Array of ButtonSpec objects' }
          },
          required: ['buttons']
        }
      },
      required: ['page_source', 'contract']
    }
  },
  {
    name: 'repair_button',
    description: 'Return a corrected HTML + JS snippet for a button that failed audit.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        original_spec: { type: 'object', description: 'The original ButtonSpec' },
        issues: { type: 'array', items: { type: 'string' }, description: 'Issue keys from audit_buttons' },
        page_source: { type: 'string', description: 'Optional: full page HTML for context' }
      },
      required: ['id', 'original_spec', 'issues']
    }
  }
];

// ─── Tool Dispatch ─────────────────────────────────────────────────────────────

function handleToolCall(id, name, args) {
  try {
    switch (name) {
      case 'generate_button':       return toolResult(id, generateButton(args.spec));
      case 'generate_button_group': return toolResult(id, generateButtonGroup(args.specs, args.layout, args.label));
      case 'generate_copy_button':  return toolResult(id, generateCopyButton(args));
      case 'generate_admin_button': return toolResult(id, generateAdminButton(args));
      case 'audit_buttons':         return toolResult(id, auditButtons(args.page_source, args.contract));
      case 'repair_button':         return toolResult(id, repairButton(args));
      default: return rpcError(id, -32601, `Unknown tool: ${name}`);
    }
  } catch (err) {
    return rpcError(id, -32603, `Tool error: ${err.message}`);
  }
}

// ─── Tool: generate_button ─────────────────────────────────────────────────────

function generateButton(spec) {
  if (!spec?.id) throw new Error('spec.id is required');
  if (!spec?.label) throw new Error('spec.label is required');
  if (!spec?.variant) throw new Error('spec.variant is required');
  if (!spec?.action) throw new Error('spec.action is required');

  const html = buildButtonHTML(spec);
  const js = buildButtonJS(spec);

  return {
    id: spec.id,
    html,
    js,
    contract_entry: normalizeSpec(spec),
    requires_vars: spec.requires ?? []
  };
}

// ─── Tool: generate_button_group ───────────────────────────────────────────────

function generateButtonGroup(specs, layout = 'row', label = null) {
  if (!Array.isArray(specs) || specs.length === 0) throw new Error('specs must be a non-empty array');

  const buttons = specs.map(s => generateButton(s));
  const allRequires = [...new Set(buttons.flatMap(b => b.requires_vars))];

  const labelHTML = label ? `<span class="btn-group-label">${escapeHtml(label)}</span>` : '';
  const buttonsHTML = buttons.map(b => b.html).join('\n  ');
  const layoutClass = layout === 'column' ? 'btn-group btn-group--column' : 'btn-group btn-group--row';

  const html = `<div class="${layoutClass}" role="group"${label ? ` aria-label="${escapeAttr(label)}"` : ''}>
  ${labelHTML}
  ${buttonsHTML}
</div>`;

  const js = buttons.map(b => b.js).join('\n\n');

  return {
    html,
    js,
    contract_entries: buttons.map(b => b.contract_entry),
    requires_vars: allRequires
  };
}

// ─── Tool: generate_copy_button ────────────────────────────────────────────────

function generateCopyButton({ id, label, copy_value, success_label = 'Copied!', reset_ms = 2000 }) {
  if (!id) throw new Error('id is required');
  if (!label) throw new Error('label is required');
  if (!copy_value) throw new Error('copy_value is required');

  const spec = {
    id,
    label,
    variant: 'copy',
    action: 'copy',
    copy_value,
    requires: []
  };

  const html = `<button
  data-btn-id="${escapeAttr(id)}"
  data-action="copy"
  data-copy-value="${escapeAttr(copy_value)}"
  data-success-label="${escapeAttr(success_label)}"
  data-reset-ms="${Number(reset_ms)}"
  class="btn btn-copy"
  type="button"
  aria-label="${escapeAttr(label)}"
>
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
  ${escapeHtml(label)}
</button>`;

  const js = `(function() {
  const btn = document.querySelector('[data-btn-id="${id}"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const rawValue = btn.dataset.copyValue || '';
    const value = rawValue.replace(/\\{(\\w+)\\}/g, (_, k) => window.__afoState?.[k] ?? '');
    try {
      await navigator.clipboard.writeText(value);
      const original = btn.innerHTML;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg> ' + (btn.dataset.successLabel || 'Copied!');
      btn.disabled = true;
      setTimeout(() => { btn.innerHTML = original; btn.disabled = false; }, Number(btn.dataset.resetMs) || 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  });
})();`;

  return { id, html, js, contract_entry: normalizeSpec(spec), requires_vars: [] };
}

// ─── Tool: generate_admin_button ───────────────────────────────────────────────

function generateAdminButton(args) {
  const spec = {
    id: args.id,
    label: args.label,
    variant: args.variant ?? 'danger',
    action: args.action ?? 'fetch',
    endpoint: args.endpoint,
    method: args.method ?? 'POST',
    confirm: args.confirm ?? true,
    admin_only: true,
    requires: ['admin_passcode'],
    loading_label: args.loading_label ?? 'Working\u2026',
    success_target: args.success_target,
    error_target: args.error_target
  };

  const base = generateButton(spec);

  const html = `<div data-admin-gate="${escapeAttr(args.id)}" hidden>
  ${base.html}
</div>
<script>
(function() {
  document.addEventListener('afo:passcode-resolved', function() {
    const gate = document.querySelector('[data-admin-gate="${args.id}"]');
    if (gate) gate.removeAttribute('hidden');
  });
})();
<\/script>`;

  return {
    id: spec.id,
    html,
    js: base.js,
    contract_entry: base.contract_entry,
    requires_vars: ['admin_passcode'],
    diff_notes: [
      'Button wrapped in data-admin-gate div, hidden by default.',
      'Listens for afo:passcode-resolved event to reveal the button.',
      'Dispatch this event from your passcode form handler after auth succeeds.'
    ]
  };
}

// ─── Tool: audit_buttons ───────────────────────────────────────────────────────

function auditButtons(pageSource, contract) {
  if (typeof pageSource !== 'string') throw new Error('page_source must be a string');
  if (!Array.isArray(contract?.buttons)) throw new Error('contract.buttons must be an array');

  const checks = contract.buttons.map(spec => auditOneButton(spec, pageSource));
  const failed = checks.filter(c => !c.pass);
  const passed = checks.filter(c => c.pass);

  const repair_plan = failed.map(c => ({
    id: c.id,
    issues: c.issues,
    action: 'call repair_button',
    note: buildRepairNote(c.issues)
  }));

  return {
    pass: failed.length === 0,
    total: checks.length,
    passed: passed.length,
    failed: failed.length,
    checks,
    repair_plan
  };
}

function auditOneButton(spec, src) {
  const id = spec.id;
  const isFetch = spec.action === 'fetch';
  const isDanger = spec.variant === 'danger';
  const isAdmin = spec.admin_only === true;
  const requires = spec.requires ?? [];

  const issues = [];

  const exists = src.includes(`data-btn-id="${id}"`);
  if (!exists) issues.push('missing_element');

  const hasHandler = src.includes(`data-btn-id="${id}"`) &&
    (src.includes(`[data-btn-id="${id}"]`) || src.includes(`data-btn-id=\\"${id}\\"`));
  if (!hasHandler && exists) issues.push('missing_handler');

  const hasLoading = !isFetch || src.includes(`data-btn-id="${id}"`) && src.includes('data-loading-label');
  if (!hasLoading && isFetch) issues.push('missing_loading_state');

  const hasRequiresGuard = requires.length === 0 ||
    requires.every(v => src.includes(`__afoState?.${v}`) || src.includes(`__afoState['${v}']`) || src.includes(`__afoState["${v}"]`));
  if (!hasRequiresGuard) issues.push('missing_requires_guard');

  const successTarget = spec.success_target;
  const hasSuccessTarget = !successTarget || src.includes(`getElementById('${successTarget}')`) || src.includes(`getElementById("${successTarget}"`);
  if (!hasSuccessTarget) issues.push('missing_success_target');

  const errorTarget = spec.error_target;
  const hasErrorTarget = !errorTarget || src.includes(`getElementById('${errorTarget}')`) || src.includes(`getElementById("${errorTarget}"`);
  if (!hasErrorTarget && isFetch) issues.push('missing_error_target');

  const dangerHasConfirm = !isDanger || src.includes('confirm(');
  if (!dangerHasConfirm) issues.push('danger_missing_confirm');

  const adminHasGuard = !isAdmin || src.includes('afo:passcode-resolved') || src.includes('data-admin-gate');
  if (!adminHasGuard) issues.push('missing_admin_guard');

  const successTargetExists = !successTarget || src.includes(`id="${successTarget}"`) || src.includes(`id='${successTarget}'`);
  if (!successTargetExists) issues.push('success_target_element_missing');

  const errorTargetExists = !errorTarget || src.includes(`id="${errorTarget}"`) || src.includes(`id='${errorTarget}'`);
  if (!errorTargetExists && isFetch) issues.push('error_target_element_missing');

  return {
    id, exists, has_handler: hasHandler, has_loading: hasLoading,
    has_requires_guard: hasRequiresGuard, has_success_target: hasSuccessTarget,
    has_error_target: hasErrorTarget, danger_has_confirm: dangerHasConfirm,
    admin_has_guard: adminHasGuard,
    target_exists: successTargetExists && errorTargetExists,
    issues, pass: issues.length === 0
  };
}

function buildRepairNote(issues) {
  const notes = {
    missing_element: 'Button element with data-btn-id not found. Re-generate with generate_button.',
    missing_handler: 'No JS event listener found for this button. Regenerate or add handler manually.',
    missing_loading_state: 'Add data-loading-label attribute to button element.',
    missing_requires_guard: 'Requires vars not guarded in JS handler. Handler may fire without required state.',
    missing_success_target: 'success_target DOM id not referenced in handler JS.',
    missing_error_target: 'error_target DOM id not referenced in handler JS. Fetch errors will be silent.',
    danger_missing_confirm: 'Danger variant button has no confirm() guard. Destructive action is unguarded.',
    missing_admin_guard: 'admin_only button has no afo:passcode-resolved gate. Button may be visible to all.',
    success_target_element_missing: 'success_target DOM element id not found in page source. Create that element.',
    error_target_element_missing: 'error_target DOM element id not found in page source. Create that element.'
  };
  return issues.map(i => notes[i] ?? i).join(' | ');
}

// ─── Tool: repair_button ───────────────────────────────────────────────────────

function repairButton({ id, original_spec, issues, page_source }) {
  if (!id) throw new Error('id is required');
  if (!original_spec) throw new Error('original_spec is required');
  if (!Array.isArray(issues)) throw new Error('issues must be an array');

  const repairedSpec = Object.assign({}, original_spec, { id });
  const diff_notes = [];

  if (issues.includes('missing_loading_state')) {
    repairedSpec.loading_label = repairedSpec.loading_label || 'Loading\u2026';
    diff_notes.push('Added data-loading-label attribute.');
  }
  if (issues.includes('missing_error_target')) {
    const inferredTarget = `${id}Status`;
    repairedSpec.error_target = repairedSpec.error_target || inferredTarget;
    diff_notes.push(`Added error_target: "${repairedSpec.error_target}". Create <span id="${repairedSpec.error_target}"></span> in the page if missing.`);
  }
  if (issues.includes('missing_success_target')) {
    const inferredTarget = `${id}Out`;
    repairedSpec.success_target = repairedSpec.success_target || inferredTarget;
    diff_notes.push(`Added success_target: "${repairedSpec.success_target}". Create <div id="${repairedSpec.success_target}"></div> in the page if missing.`);
  }
  if (issues.includes('danger_missing_confirm')) {
    repairedSpec.confirm = true;
    diff_notes.push('Set confirm: true. Handler now calls confirm() before firing.');
  }
  if (issues.includes('missing_requires_guard')) {
    diff_notes.push('Handler now guards on all requires vars via window.__afoState before firing.');
  }
  if (issues.includes('missing_admin_guard')) {
    repairedSpec.admin_only = true;
    diff_notes.push('Wrapped button in data-admin-gate div. Hidden until afo:passcode-resolved fires.');
  }
  if (issues.includes('missing_element') || issues.includes('missing_handler')) {
    diff_notes.push('Full button regenerated from spec.');
  }

  if (issues.includes('missing_admin_guard')) {
    const adminResult = generateAdminButton(repairedSpec);
    return { id, html: adminResult.html, js: adminResult.js, diff_notes };
  }

  const result = generateButton(repairedSpec);
  return { id, html: result.html, js: result.js, diff_notes };
}

// ─── HTML / JS Builders ────────────────────────────────────────────────────────

function buildButtonHTML(spec) {
  const cls = `btn btn-${spec.variant}`;
  const attrs = [
    `data-btn-id="${escapeAttr(spec.id)}"`,
    `data-action="${escapeAttr(spec.action)}"`
  ];

  if (spec.action === 'fetch' && spec.endpoint) {
    attrs.push(`data-endpoint="${escapeAttr(spec.endpoint)}"`);
    attrs.push(`data-loading-label="${escapeAttr(spec.loading_label ?? 'Loading\u2026')}"`);
  }
  if (spec.action === 'copy' && spec.copy_value) {
    attrs.push(`data-copy-value="${escapeAttr(spec.copy_value)}"`);
  }

  const hasRequires = Array.isArray(spec.requires) && spec.requires.length > 0;
  if (hasRequires) attrs.push('disabled');
  if (spec.admin_only) attrs.push('hidden');

  return `<button\n  ${attrs.join('\n  ')}\n  class="${cls}"\n  type="button"\n  aria-label="${escapeAttr(spec.label)}"\n>\n  ${escapeHtml(spec.label)}\n</button>`;
}

function buildButtonJS(spec) {
  const requires = spec.requires ?? [];
  const guards = requires.map(v => `const ${v} = window.__afoState?.${v};`).join('\n    ');
  const guardCheck = requires.length > 0
    ? `if (!${requires.join(' || !')}) return;\n    `
    : '';

  switch (spec.action) {
    case 'fetch':    return buildFetchHandler(spec, guards, guardCheck);
    case 'copy':     return buildCopyHandler(spec);
    case 'navigate': return buildNavigateHandler(spec);
    case 'toggle':   return buildToggleHandler(spec);
    case 'submit':   return buildSubmitHandler(spec, guards, guardCheck);
    case 'noop':     return `// Button "${spec.id}" action: noop — no handler generated.`;
    default:         return `// Unknown action type: ${spec.action}`;
  }
}

function buildFetchHandler(spec, guards, guardCheck) {
  const { id, endpoint, method = 'GET', loading_label = 'Loading\u2026',
          success_target, error_target, confirm: needsConfirm } = spec;

  const confirmStr = needsConfirm ? `    if (!confirm('Are you sure?')) return;\n` : '';
  const endpointJS = endpoint
    ? endpoint.replace(/:(\w+)/g, (_, p) => `\${window.__afoState?.${p} ?? ''}`)
    : '';

  const successWrite = success_target
    ? `      const target = document.getElementById('${success_target}');\n      if (target) target.textContent = text;`
    : '      // no success_target declared';

  const errorWrite = error_target
    ? `      const errTarget = document.getElementById('${error_target}');\n      if (errTarget) errTarget.textContent = 'Error: ' + err.message;`
    : '      console.error(err);';

  return `(function() {
  const btn = document.querySelector('[data-btn-id="${id}"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    ${guards}
    ${guardCheck}${confirmStr}    const originalLabel = btn.textContent.trim();
    btn.disabled = true;
    btn.textContent = '${loading_label}';
    try {
      const res = await fetch(\`${endpointJS}\`, { method: '${method}', headers: { 'X-Admin-Passcode': window.__afoState?.admin_passcode ?? '' } });
      const text = await res.text();
${successWrite}
    } catch (err) {
${errorWrite}
    } finally {
      btn.disabled = false;
      btn.textContent = originalLabel;
    }
  });
})();`;
}

function buildCopyHandler(spec) {
  const { id, copy_value = '', success_target } = spec;
  const successWrite = success_target
    ? `    const t = document.getElementById('${success_target}'); if (t) t.textContent = 'Copied!';`
    : '';
  return `(function() {
  const btn = document.querySelector('[data-btn-id="${id}"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const raw = '${copy_value}'.replace(/\\{(\\w+)\\}/g, (_, k) => window.__afoState?.[k] ?? '');
    try {
      await navigator.clipboard.writeText(raw);
      ${successWrite}
      const orig = btn.textContent.trim();
      btn.textContent = 'Copied!';
      setTimeout(() => { btn.textContent = orig; }, 2000);
    } catch (e) { console.error('Copy failed', e); }
  });
})();`;
}

function buildNavigateHandler(spec) {
  const { id, endpoint = '#' } = spec;
  return `(function() {
  const btn = document.querySelector('[data-btn-id="${id}"]');
  if (!btn) return;
  btn.addEventListener('click', () => { window.location.href = '${endpoint}'; });
})();`;
}

function buildToggleHandler(spec) {
  const { id, success_target } = spec;
  if (!success_target) return `// toggle button "${id}" requires success_target`;
  return `(function() {
  const btn = document.querySelector('[data-btn-id="${id}"]');
  const target = document.getElementById('${success_target}');
  if (!btn || !target) return;
  btn.addEventListener('click', () => {
    target.hidden = !target.hidden;
    btn.setAttribute('aria-expanded', String(!target.hidden));
  });
})();`;
}

function buildSubmitHandler(spec, guards, guardCheck) {
  const { id, endpoint, method = 'POST', loading_label = 'Submitting\u2026',
          success_target, error_target } = spec;

  const successWrite = success_target
    ? `    document.getElementById('${success_target}')?.textContent = 'Submitted.';`
    : '';
  const errorWrite = error_target
    ? `    document.getElementById('${error_target}')?.textContent = 'Error: ' + err.message;`
    : '    console.error(err);';
  const endpointJS = endpoint
    ? endpoint.replace(/:(\w+)/g, (_, p) => `\${window.__afoState?.${p} ?? ''}`)
    : '/';

  return `(function() {
  const btn = document.querySelector('[data-btn-id="${id}"]');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    ${guards}
    ${guardCheck}    btn.disabled = true;
    btn.textContent = '${loading_label}';
    try {
      const formEl = btn.closest('form');
      const body = formEl ? new FormData(formEl) : null;
      const res = await fetch(\`${endpointJS}\`, { method: '${method}', body });
      const text = await res.text();
      ${successWrite}
    } catch (err) {
      ${errorWrite}
    } finally { btn.disabled = false; }
  });
})();`;
}

// ─── Spec Normalizer ───────────────────────────────────────────────────────────

function normalizeSpec(spec) {
  return {
    id: spec.id,
    label: spec.label,
    variant: spec.variant ?? 'secondary',
    action: spec.action ?? 'noop',
    endpoint: spec.endpoint ?? null,
    method: spec.method ?? 'GET',
    requires: spec.requires ?? [],
    loading_label: spec.loading_label ?? 'Loading\u2026',
    success_target: spec.success_target ?? null,
    error_target: spec.error_target ?? null,
    confirm: spec.confirm ?? false,
    admin_only: spec.admin_only ?? false,
    copy_value: spec.copy_value ?? null
  };
}

// ─── Response Helpers ──────────────────────────────────────────────────────────

function rpcResult(id, result) {
  return jsonResponse({ jsonrpc: '2.0', id, result });
}

function toolResult(id, data) {
  return rpcResult(id, {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }]
  });
}

function rpcError(id, code, message) {
  return jsonResponse({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

function htmlResponse(html, status = 200) {
  return new Response(html, {
    status,
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

function corsResponse(status) {
  return new Response(null, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

// ─── HTML Utilities ────────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
