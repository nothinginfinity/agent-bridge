const VERSION = '0.1.0';
const WORKER_NAME = 'message-os-mcp';

const TOOLS = [
  {
    name: 'deployment_status',
    description: 'Return Message OS worker status, binding presence, and tool count.',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'send_human_message',
    description: 'Store a structured message in the live hub.',
    inputSchema: {
      type: 'object',
      properties: {
        from_user: { type: 'string' },
        to_user: { type: 'string' },
        from_agent: { type: 'string', default: 'chatgpt' },
        to_agent: { type: 'string', default: 'chatgpt' },
        subject: { type: 'string' },
        body: { type: 'string' },
        summary: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
        project: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } }
      },
      required: ['from_user', 'to_user', 'subject', 'body']
    }
  },
  {
    name: 'check_human_inbox',
    description: 'Check for unread messages for a user.',
    inputSchema: {
      type: 'object',
      properties: {
        to_user: { type: 'string' },
        priority_min: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], default: 'low' },
        limit: { type: 'number', default: 10 }
      },
      required: ['to_user']
    }
  },
  {
    name: 'propose_notification_frame',
    description: 'Create a structured UI-frame record for a notification/message.',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string' },
        title: { type: 'string' },
        summary: { type: 'string' },
        preview: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
        actions: { type: 'array', items: { type: 'object' } }
      },
      required: ['title', 'summary']
    }
  },
  {
    name: 'record_frame_choice',
    description: 'Record a selected action from a UI frame.',
    inputSchema: {
      type: 'object',
      properties: {
        frame_id: { type: 'string' },
        choice_id: { type: 'string' },
        choice_label: { type: 'string' },
        next_tool: { type: 'string' }
      },
      required: ['frame_id', 'choice_id']
    }
  },
  {
    name: 'read_human_message',
    description: 'Read a full stored message by ID after user approval.',
    inputSchema: {
      type: 'object',
      properties: { message_id: { type: 'string' } },
      required: ['message_id']
    }
  },
  {
    name: 'mark_human_message_seen',
    description: 'Mark a message as seen, handled, ignored, or deferred.',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string' },
        status: { type: 'string', enum: ['seen', 'handled', 'ignored', 'deferred'], default: 'seen' }
      },
      required: ['message_id']
    }
  },
  {
    name: 'archive_message_to_drivemind',
    description: 'Create a DriveMind-compatible markdown/json archive bundle for a message.',
    inputSchema: {
      type: 'object',
      properties: {
        message_id: { type: 'string' },
        project: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        vectorize: { type: 'boolean', default: false }
      },
      required: ['message_id']
    }
  },
  {
    name: 'list_recent_messages',
    description: 'List recent messages by user/project/status.',
    inputSchema: {
      type: 'object',
      properties: {
        to_user: { type: 'string' },
        project: { type: 'string' },
        status: { type: 'string' },
        limit: { type: 'number', default: 20 }
      },
      required: []
    }
  }
];

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

function rpc(id, result) {
  return json({ jsonrpc: '2.0', id, result });
}

function toolResult(id, result) {
  return json({
    jsonrpc: '2.0',
    id,
    result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
  });
}

function rpcErr(id, code, message) {
  return json({ jsonrpc: '2.0', id, error: { code, message } });
}

function now() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function id(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
}

function requireDB(env) {
  if (!env.DB) throw new Error('Missing DB binding');
}

function priorityRank(priority) {
  return { low: 1, normal: 2, high: 3, urgent: 4 }[priority || 'low'] || 1;
}

function defaultActions() {
  return [
    { id: 'open', label: 'Open full message', next_tool: 'read_human_message', risk: 'low' },
    { id: 'preview', label: 'Show preview', next_tool: 'read_human_message', risk: 'low' },
    { id: 'reply', label: 'Reply', next_tool: 'send_human_message', risk: 'medium' },
    { id: 'later', label: 'Save for later', next_tool: 'mark_human_message_seen', risk: 'low' },
    { id: 'archive', label: 'Archive to DriveMind', next_tool: 'archive_message_to_drivemind', risk: 'medium' },
    { id: 'ignore', label: 'Ignore', next_tool: 'mark_human_message_seen', risk: 'low' }
  ];
}

function truncate(text, max = 280) {
  const s = String(text || '');
  return s.length <= max ? s : s.slice(0, max) + '…';
}

async function sendHumanMessage(env, args) {
  requireDB(env);
  const messageId = id('hm');
  const ts = now();
  const tags = JSON.stringify(args.tags || []);
  await env.DB.prepare(`
    INSERT INTO messages
    (id, source, from_user, to_user, from_agent, to_agent, subject, body, summary, priority, project, tags_json, status, visibility, created_at, updated_at, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    messageId,
    'human_message_hub',
    args.from_user,
    args.to_user,
    args.from_agent || 'chatgpt',
    args.to_agent || 'chatgpt',
    args.subject,
    args.body,
    args.summary || truncate(args.body, 220),
    args.priority || 'normal',
    args.project || null,
    tags,
    'unread',
    'private',
    ts,
    ts,
    JSON.stringify(args.metadata || {})
  ).run();

  const notifId = id('notif');
  await env.DB.prepare(`
    INSERT INTO notifications
    (id, source, source_event_id, message_id, category, event_type, priority, title, summary, preview, actor, project, status, actions_json, created_at, updated_at, metadata_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    notifId,
    'human_message_hub',
    messageId,
    messageId,
    'message',
    'message_received',
    args.priority || 'normal',
    args.subject,
    args.summary || truncate(args.body, 220),
    truncate(args.body, 360),
    args.from_user,
    args.project || null,
    'unread',
    JSON.stringify(defaultActions()),
    ts,
    ts,
    JSON.stringify({ to_user: args.to_user })
  ).run();

  return { message_id: messageId, notification_id: notifId, status: 'stored' };
}

async function checkHumanInbox(env, args) {
  requireDB(env);
  const limit = Math.min(Number(args.limit || 10), 50);
  const rows = await env.DB.prepare(`
    SELECT n.id AS notification_id, n.message_id, n.priority, n.title, n.summary, n.preview, n.actor, n.project, n.created_at
    FROM notifications n
    JOIN messages m ON m.id = n.message_id
    WHERE m.to_user = ? AND n.status = 'unread'
    ORDER BY n.created_at DESC
    LIMIT ?
  `).bind(args.to_user, limit).all();
  const minRank = priorityRank(args.priority_min || 'low');
  const items = (rows.results || []).filter(r => priorityRank(r.priority) >= minRank);
  return { has_new: items.length > 0, count: items.length, items };
}

async function proposeNotificationFrame(env, args) {
  requireDB(env);
  const frameId = id('frame');
  const ts = now();
  const actions = args.actions && args.actions.length ? args.actions : defaultActions();
  const payload = {
    frame_id: frameId,
    frame_type: 'notification_triage',
    title: args.title,
    summary: args.summary,
    priority: args.priority || 'normal',
    preview: args.preview || '',
    actions,
    approval_meaning: 'Allow records this frame so Jared can choose the next action.'
  };
  await env.DB.prepare(`
    INSERT INTO ui_frames
    (id, frame_type, title, summary, notification_id, message_id, status, next_tool, payload_json, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    frameId,
    'notification_triage',
    args.title,
    args.summary,
    args.notification_id || null,
    args.message_id || null,
    'proposed',
    null,
    JSON.stringify(payload),
    ts,
    ts
  ).run();
  return payload;
}

async function recordFrameChoice(env, args) {
  requireDB(env);
  const ts = now();
  await env.DB.prepare(`
    UPDATE ui_frames
    SET selected_choice_id = ?, selected_choice_label = ?, next_tool = ?, status = 'selected', updated_at = ?
    WHERE id = ?
  `).bind(args.choice_id, args.choice_label || null, args.next_tool || null, ts, args.frame_id).run();
  return { frame_id: args.frame_id, choice_id: args.choice_id, next_tool: args.next_tool || null, status: 'recorded' };
}

async function readHumanMessage(env, args) {
  requireDB(env);
  const row = await env.DB.prepare(`SELECT * FROM messages WHERE id = ?`).bind(args.message_id).first();
  if (!row) throw new Error('Message not found');
  return { message: row };
}

async function markHumanMessageSeen(env, args) {
  requireDB(env);
  const ts = now();
  await env.DB.prepare(`UPDATE messages SET status = ?, updated_at = ? WHERE id = ?`).bind(args.status || 'seen', ts, args.message_id).run();
  await env.DB.prepare(`UPDATE notifications SET status = ?, updated_at = ? WHERE message_id = ?`).bind(args.status || 'seen', ts, args.message_id).run();
  return { message_id: args.message_id, status: args.status || 'seen' };
}

async function archiveMessageToDriveMind(env, args) {
  requireDB(env);
  const row = await env.DB.prepare(`SELECT * FROM messages WHERE id = ?`).bind(args.message_id).first();
  if (!row) throw new Error('Message not found');
  const exportId = id('archive');
  const ts = now();
  const archive = {
    id: row.id,
    source: row.source,
    from_user: row.from_user,
    to_user: row.to_user,
    subject: row.subject,
    body: row.body,
    summary: row.summary,
    priority: row.priority,
    project: args.project || row.project,
    tags: args.tags || JSON.parse(row.tags_json || '[]'),
    received_at: row.created_at,
    archived_at: ts,
    visibility: row.visibility,
    vectorized: Boolean(args.vectorize),
    metadata: JSON.parse(row.metadata_json || '{}')
  };
  const markdown = `# ${row.subject || row.id}\n\nfrom: ${row.from_user || ''}\nto: ${row.to_user || ''}\nproject: ${args.project || row.project || ''}\npriority: ${row.priority}\nreceived: ${row.created_at}\narchived: ${ts}\n\n## Summary\n\n${row.summary || ''}\n\n## Message\n\n${row.body}\n`;
  const bundle = { json: archive, markdown };
  await env.DB.prepare(`
    INSERT INTO archive_exports
    (id, message_id, archive_target, export_format, status, bundle_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(exportId, row.id, 'drivemind', 'markdown_json', 'created', JSON.stringify(bundle), ts).run();
  return { archive_id: exportId, message_id: row.id, status: 'export_created', bundle };
}

async function listRecentMessages(env, args) {
  requireDB(env);
  const limit = Math.min(Number(args.limit || 20), 100);
  let sql = `SELECT id, from_user, to_user, subject, summary, priority, project, status, created_at FROM messages WHERE 1=1`;
  const params = [];
  if (args.to_user) { sql += ` AND to_user = ?`; params.push(args.to_user); }
  if (args.project) { sql += ` AND project = ?`; params.push(args.project); }
  if (args.status) { sql += ` AND status = ?`; params.push(args.status); }
  sql += ` ORDER BY created_at DESC LIMIT ?`; params.push(limit);
  const rows = await env.DB.prepare(sql).bind(...params).all();
  return { messages: rows.results || [], count: (rows.results || []).length };
}

async function handleTool(name, args, env) {
  args = args || {};
  switch (name) {
    case 'deployment_status':
      return {
        worker: WORKER_NAME,
        version: VERSION,
        bindings: { DB: Boolean(env.DB), GITHUB_TOKEN: Boolean(env.GITHUB_TOKEN), VECTORIZE: Boolean(env.VECTORIZE) },
        tools: TOOLS.length
      };
    case 'send_human_message': return await sendHumanMessage(env, args);
    case 'check_human_inbox': return await checkHumanInbox(env, args);
    case 'propose_notification_frame': return await proposeNotificationFrame(env, args);
    case 'record_frame_choice': return await recordFrameChoice(env, args);
    case 'read_human_message': return await readHumanMessage(env, args);
    case 'mark_human_message_seen': return await markHumanMessageSeen(env, args);
    case 'archive_message_to_drivemind': return await archiveMessageToDriveMind(env, args);
    case 'list_recent_messages': return await listRecentMessages(env, args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204 });

    if (url.pathname === '/health') {
      return json({ status: 'ok', worker: WORKER_NAME, version: VERSION, bindings: { DB: Boolean(env.DB) }, tools: TOOLS.length });
    }

    if (url.pathname !== '/mcp' || request.method !== 'POST') {
      return new Response('not found', { status: 404 });
    }

    let body;
    try { body = await request.json(); } catch { return rpcErr(null, -32700, 'Parse error'); }
    const { id, method, params } = body;

    if (method === 'initialize') {
      return rpc(id, { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: WORKER_NAME, version: VERSION } });
    }
    if (method === 'notifications/initialized') return new Response(null, { status: 204 });
    if (method === 'ping') return rpc(id, {});
    if (method === 'tools/list') return rpc(id, { tools: TOOLS });

    if (method === 'tools/call') {
      try {
        const result = await handleTool(params?.name, params?.arguments || {}, env);
        return toolResult(id, result);
      } catch (err) {
        return rpcErr(id, -32603, `Tool error: ${err.message}`);
      }
    }

    return rpcErr(id, -32601, `Method not found: ${method}`);
  }
};
