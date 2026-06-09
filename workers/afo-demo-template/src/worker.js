// ============================================================
// afo-demo-template  v1.0.0
// Blank multi-tenant demo worker.
// All content driven from D1 demo_content table by slug.
// SLUG is set per-deployment via [vars] in wrangler.toml.
// ============================================================

const VERSION = '1.0.0';
const WORKER  = 'afo-demo-template';

function esc(v) {
  return String(v ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function j(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status, headers: { 'content-type': 'application/json;charset=UTF-8', 'cache-control': 'no-store' }
  });
}
function h(body, status = 200) {
  return new Response(body, {
    status, headers: { 'content-type': 'text/html;charset=UTF-8', 'cache-control': 'no-store' }
  });
}
function now() { return new Date().toISOString(); }

async function dbFirst(env, sql, params = []) {
  return env.DEMO_DB.prepare(sql).bind(...params).first();
}
async function dbAll(env, sql, params = []) {
  const r = await env.DEMO_DB.prepare(sql).bind(...params).all();
  return r.results || [];
}
async function dbRun(env, sql, params = []) {
  return env.DEMO_DB.prepare(sql).bind(...params).run();
}

async function loadSection(env, slug, section, fallback = null) {
  const row = await dbFirst(env, 'SELECT data FROM demo_content WHERE slug=? AND section=?', [slug, section]);
  if (!row) return fallback;
  try { return JSON.parse(row.data); } catch { return row.data; }
}

async function loadAllContent(env, slug) {
  const rows = await dbAll(env, 'SELECT section, data FROM demo_content WHERE slug=?', [slug]);
  const content = {};
  for (const row of rows) {
    try { content[row.section] = JSON.parse(row.data); } catch { content[row.section] = row.data; }
  }
  return content;
}

function defaultContact() {
  return {
    company: 'Your Business Name', phone: '(555) 000-0000', address: 'City, State',
    email: '', hours: 'Mon-Fri 9am-5pm', website: '', tagline: 'A great place to do business.',
    primary_color: '#14110d', secondary_color: '#fff8ee', accent_color: '#b76532',
    hero_image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1800&q=75',
  };
}
function defaultServices() {
  return [
    { id: 's1', name: 'Service One',   desc: 'Description of your first service or offering.' },
    { id: 's2', name: 'Service Two',   desc: 'Description of your second service or offering.' },
    { id: 's3', name: 'Service Three', desc: 'Description of your third service or offering.' },
  ];
}
function defaultTestimonials() {
  return [
    { name: 'Happy Customer',  role: 'Client',       quote: 'Excellent service, highly recommend.' },
    { name: 'Satisfied Guest', role: 'Repeat Client', quote: 'Professional, reliable, and easy to work with.' },
  ];
}

function renderPage(contact, services, testimonials, slug) {
  const co   = contact.company      || 'Your Business';
  const ph   = contact.phone        || '';
  const addr = contact.address      || '';
  const hrs  = contact.hours        || '';
  const tag  = contact.tagline      || '';
  const hero = (contact.hero_image  || 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1800&q=75').replace(/"/g, '');
  const pc   = contact.primary_color   || '#14110d';
  const sc   = contact.secondary_color || '#fff8ee';
  const ac   = contact.accent_color    || '#b76532';
  const phUrl = ph ? 'tel:' + ph.replace(/\D/g,'').replace(/^(\d{10})$/,'+1$1') : '#';

  const serviceCards = (Array.isArray(services) ? services : []).map(s =>
    '<article class="card"><div class="card-body"><h3>' + esc(s.name||s.title||'') + '</h3><p>' + esc(s.desc||s.description||'') + '</p></div></article>'
  ).join('');

  const testimonialCards = (Array.isArray(testimonials) ? testimonials : []).map(t =>
    '<figure class="quote"><blockquote>' + esc(t.quote||t.text||'') + '</blockquote><figcaption>' + esc(t.name||'') + (t.role ? ' &middot; ' + esc(t.role) : '') + '</figcaption></figure>'
  ).join('');

  const css = ':root{--ink:' + pc + ';--paper:' + sc + ';--accent:' + ac + ';--muted:#74685f;--card:#fffdf8;--line:rgba(20,17,13,.12);--shadow:0 8px 40px rgba(0,0,0,.10)}' +
    '*{box-sizing:border-box;margin:0;padding:0}body{font-family:Inter,sans-serif;background:var(--paper);color:var(--ink);line-height:1.6}a{color:inherit;text-decoration:none}' +
    '.nav{position:sticky;top:0;z-index:10;background:rgba(255,248,238,.9);backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}' +
    '.nav-inner{max-width:1100px;margin:auto;padding:.9rem 1.5rem;display:flex;justify-content:space-between;align-items:center}' +
    '.brand{font-weight:900;font-size:1.1rem;letter-spacing:-.03em}.nav-phone{font-weight:700;color:var(--accent);font-size:.9rem}' +
    '.hero{min-height:500px;display:grid;align-items:end;padding:80px 0 50px;background:linear-gradient(90deg,rgba(0,0,0,.72),rgba(0,0,0,.2)),url("' + hero + '") center/cover;border-radius:0 0 40px 40px;color:#fff}' +
    '.hero-inner{max-width:1100px;margin:auto;padding:0 1.5rem}' +
    '.eyebrow{text-transform:uppercase;letter-spacing:.16em;font-size:.72rem;font-weight:700;color:#e8a87c;margin-bottom:.5rem}' +
    '.hero h1{font-size:clamp(2.4rem,6vw,5.5rem);line-height:.92;letter-spacing:-.06em;margin-bottom:1rem;font-weight:900}' +
    '.hero p{font-size:1.05rem;opacity:.88;max-width:520px;margin-bottom:1.5rem}' +
    '.actions{display:flex;gap:.75rem;flex-wrap:wrap}' +
    '.btn{border-radius:999px;padding:.75rem 1.4rem;font-weight:700;font-size:.9rem;border:1px solid rgba(255,255,255,.3);color:#fff;background:rgba(255,255,255,.12)}' +
    '.btn.primary{background:#fff;color:var(--ink);border-color:#fff}' +
    '.section{max-width:1100px;margin:auto;padding:3rem 1.5rem}' +
    '.section-head{margin-bottom:1.75rem}.section-head .eyebrow{color:var(--accent)}' +
    '.section-head h2{font-size:clamp(1.8rem,3.5vw,3rem);font-weight:900;letter-spacing:-.05em;line-height:1}' +
    '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:1.25rem}' +
    '.card{border:1px solid var(--line);border-radius:24px;background:var(--card);box-shadow:var(--shadow);overflow:hidden}' +
    '.card-body{padding:1.25rem}.card h3{font-size:1.1rem;font-weight:700;letter-spacing:-.02em;margin-bottom:.5rem}.card p{color:var(--muted);font-size:.92rem}' +
    '.quotes{display:flex;gap:1rem;overflow-x:auto;scroll-snap-type:x mandatory;padding-bottom:.5rem}' +
    '.quote{min-width:260px;scroll-snap-align:start;border:1px solid var(--line);border-radius:20px;padding:1.25rem;background:var(--card);flex-shrink:0}' +
    '.quote blockquote{font-size:.95rem;margin-bottom:.75rem;font-style:italic}.quote figcaption{font-size:.8rem;font-weight:700;color:var(--muted)}' +
    '.info-panel{display:grid;grid-template-columns:1fr 1fr;gap:1.25rem}' +
    '.panel{border:1px solid var(--line);border-radius:24px;padding:1.5rem;background:var(--card);box-shadow:var(--shadow)}' +
    '.panel h3{font-size:1rem;font-weight:700;margin-bottom:.75rem}.panel p{color:var(--muted);font-size:.92rem;line-height:1.7}' +
    '.form-wrap{max-width:560px}.form-wrap input,.form-wrap textarea{width:100%;padding:.75rem 1rem;border:1px solid var(--line);border-radius:12px;font-family:inherit;font-size:.95rem;background:var(--card);color:var(--ink);margin-bottom:.75rem}' +
    '.form-wrap textarea{height:110px;resize:vertical}.btn-submit{background:var(--ink);color:var(--paper);border:none;border-radius:999px;padding:.8rem 1.8rem;font-weight:700;font-size:.95rem;cursor:pointer;width:100%}' +
    '#form-msg{margin-top:.75rem;font-size:.9rem;color:var(--accent)}' +
    '.sticky-cta{position:fixed;z-index:40;left:1rem;right:1rem;bottom:1rem;display:flex;justify-content:center}' +
    '.sticky-cta a{width:min(480px,100%);text-align:center;border-radius:999px;padding:.9rem 1.5rem;background:var(--ink);color:var(--paper);font-weight:700;font-size:.95rem;box-shadow:0 16px 50px rgba(0,0,0,.28)}' +
    'footer{text-align:center;padding:2rem 1rem 6rem;color:var(--muted);font-size:.82rem}' +
    '@media(max-width:768px){.grid,.info-panel{grid-template-columns:1fr}.hero h1{font-size:2.4rem}}';

  return '<!DOCTYPE html><html lang="en"><head>' +
    '<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>' + esc(co) + '</title><meta name="description" content="' + esc(tag) + '">' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;900&display=swap" rel="stylesheet">' +
    '<style>' + css + '</style></head><body>' +

    '<nav class="nav"><div class="nav-inner"><a class="brand" href="/">' + esc(co) + '</a>' +
    (ph ? '<a class="nav-phone" href="' + esc(phUrl) + '">' + esc(ph) + '</a>' : '') + '</div></nav>' +

    '<section class="hero"><div class="hero-inner">' +
    '<p class="eyebrow">Welcome</p><h1>' + esc(co) + '</h1><p>' + esc(tag) + '</p>' +
    '<div class="actions"><a class="btn primary" href="#contact">Get in Touch</a>' +
    (ph ? '<a class="btn" href="' + esc(phUrl) + '">Call Now</a>' : '') +
    '</div></div></section>' +

    '<div class="section"><div class="section-head"><p class="eyebrow">What We Offer</p><h2>Services &amp; Offerings</h2></div>' +
    '<div class="grid">' + serviceCards + '</div></div>' +

    (testimonialCards ? '<div class="section"><div class="section-head"><p class="eyebrow">What People Say</p><h2>Reviews</h2></div><div class="quotes">' + testimonialCards + '</div></div>' : '') +

    '<div class="section"><div class="info-panel">' +
    '<div class="panel"><h3>Hours</h3><p>' + esc(hrs || 'Contact us for hours') + '</p></div>' +
    '<div class="panel"><h3>Location</h3><p>' + esc(addr || 'Contact us for location') + '</p></div>' +
    '</div></div>' +

    '<div class="section" id="contact"><div class="section-head"><p class="eyebrow">Reach Out</p><h2>Contact Us</h2></div>' +
    '<div class="form-wrap">' +
    '<input id="f-name" type="text" placeholder="Your Name">' +
    '<input id="f-email" type="email" placeholder="Email Address">' +
    '<input id="f-phone" type="tel" placeholder="Phone Number">' +
    '<textarea id="f-msg" placeholder="How can we help?"></textarea>' +
    '<button class="btn-submit" onclick="submitLead()">Send Message</button>' +
    '<p id="form-msg"></p></div></div>' +

    '<footer>' + esc(co) + (addr ? ' &nbsp;&bull;&nbsp; ' + esc(addr) : '') + (ph ? ' &nbsp;&bull;&nbsp; ' + esc(ph) : '') + '</footer>' +
    '<div class="sticky-cta"><a href="#contact">Contact ' + esc(co) + '</a></div>' +

    '<script>async function submitLead(){' +
    'var msg=document.getElementById("form-msg");' +
    'var body={name:document.getElementById("f-name").value,email:document.getElementById("f-email").value,phone:document.getElementById("f-phone").value,message:document.getElementById("f-msg").value};' +
    'if(!body.name&&!body.email){msg.textContent="Please enter your name and email.";return;}' +
    'msg.textContent="Sending...";' +
    'try{var r=await fetch("/api/lead",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(body)});' +
    'var d=await r.json();msg.textContent=d.ok?"Thanks! We will be in touch soon.":"Error: "+(d.error||"unknown");}' +
    'catch(e){msg.textContent="Error: "+e.message;}}</script>' +
    '</body></html>';
}

async function handleHome(env, slug) {
  const snap = await dbFirst(env, 'SELECT html FROM demo_snapshots WHERE slug=?', [slug]);
  if (snap?.html) return h(snap.html);
  const contact      = await loadSection(env, slug, 'contact',      defaultContact());
  const services     = await loadSection(env, slug, 'services',     defaultServices());
  const testimonials = await loadSection(env, slug, 'testimonials', defaultTestimonials());
  return h(renderPage(contact, services, testimonials, slug));
}

async function handlePublish(env, slug) {
  const contact      = await loadSection(env, slug, 'contact',      defaultContact());
  const services     = await loadSection(env, slug, 'services',     defaultServices());
  const testimonials = await loadSection(env, slug, 'testimonials', defaultTestimonials());
  const html = renderPage(contact, services, testimonials, slug);
  await dbRun(env,
    'INSERT INTO demo_snapshots (slug,html,published_at) VALUES (?,?,?) ON CONFLICT(slug) DO UPDATE SET html=excluded.html,published_at=excluded.published_at',
    [slug, html, now()]
  );
  return j({ ok: true, slug, message: 'Demo published!', size: html.length, published_at: now() });
}

async function handleLead(request, env, slug) {
  const body = await request.json().catch(() => ({}));
  await dbRun(env,
    'INSERT INTO demo_leads (slug,name,email,phone,message,created_at) VALUES (?,?,?,?,?,?)',
    [slug, body.name||'', body.email||'', body.phone||'', body.message||'', now()]
  );
  return j({ ok: true, slug });
}

async function handleStatus(env, slug) {
  const tenant  = await dbFirst(env, 'SELECT * FROM tenants WHERE slug=?', [slug]);
  const contact = await loadSection(env, slug, 'contact', null);
  const snap    = await dbFirst(env, 'SELECT published_at FROM demo_snapshots WHERE slug=?', [slug]);
  const leads   = await dbFirst(env, 'SELECT COUNT(*) as c FROM demo_leads WHERE slug=?', [slug]);
  return j({ ok: true, worker: WORKER, version: VERSION, slug, tenant: tenant?.name||null, vertical: tenant?.vertical||'generic', has_contact: !!contact, has_snapshot: !!snap, snapshot_at: snap?.published_at||null, leads: leads?.c||0 });
}

async function handleContent(env, slug) {
  const content = await loadAllContent(env, slug);
  return j({ ok: true, slug, sections: Object.keys(content), content });
}

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const path   = url.pathname.replace(/\/+$/, '') || '/';
    const method = request.method;
    const slug   = env.DEMO_SLUG || 'default';

    if (method === 'OPTIONS') return new Response(null, { headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } });
    if (method === 'GET'  && path === '/')            return handleHome(env, slug);
    if (method === 'POST' && path === '/api/publish') return handlePublish(env, slug);
    if (method === 'POST' && path === '/api/lead')    return handleLead(request, env, slug);
    if (method === 'GET'  && path === '/api/status')  return handleStatus(env, slug);
    if (method === 'GET'  && path === '/api/content') return handleContent(env, slug);
    return j({ ok: false, error: 'not_found', path }, 404);
  }
};
