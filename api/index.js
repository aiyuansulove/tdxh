const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const supabase = createClient('https://jsbymonfkasdhnfvkrrx.supabase.co', 'sb_publishable_nJ_aHTgcE53yM01NxmPLcw_wRzSYzGx');
const JWT_SECRET = 'tdxh-trace-secret-2025';

function auth(token) {
  if (!token) return null;
  try { return jwt.verify(token.replace('Bearer ', ''), JWT_SECRET); }
  catch { return null; }
}

function json(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(body) });
  res.end(body);
}

function html(res, content, status = 200) {
  res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(content);
}

function parseBody(req) {
  return new Promise(resolve => {
    if (req.method === 'GET') return resolve({});
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

// Simple HTML for trace result
function traceResultHTML(data, error) {
  const brandCSS = `body{font-family:'Noto Serif SC','PingFang SC',serif;background:#0a0a0c;color:#d4cfc4;max-width:800px;margin:0 auto;padding:24px;line-height:1.8}.gold{color:#C9A96E}.num{font-size:1.3rem;color:#e4ce9a}.card{border:1px solid rgba(201,169,110,.12);border-radius:2px;padding:24px;margin-bottom:24px;background:#16161c}.status{text-align:center;padding:24px;border:1px solid rgba(46,204,113,.15);background:rgba(46,204,113,.03)}.sn{font-family:monospace;color:#C9A96E}.tl{border-left:1px solid rgba(201,169,110,.2);padding-left:24px}.tl-item{margin-bottom:20px}.tl-dot{color:#C9A96E}.tl-title{color:#f0eadb}`;
  const head = `<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>天地鲟鳇 · 产品溯源</title><style>${brandCSS}</style>`;

  if (error) return `<!DOCTYPE html><html><head>${head}</head><body><h2 style="color:#e74c3c">${error}</h2><p style="color:#8a8578">请确认溯源码正确</p></body></html>`;

  return `<!DOCTYPE html><html><head>${head}</head><body>
    <h1 style="color:#f0eadb;font-weight:300;text-align:center">天地鲟鳇 · 产品溯源</h1>
    <div class="status"><div class="sn">${data.sn}</div><div style="color:#2ecc71;font-size:1.1rem">✅ 正品验证通过</div><div style="color:#5a5550;font-size:.8rem">查询 ${data.query_count} 次</div></div>
    <div class="card"><h3 style="color:#f0eadb">${data.product_name||''}</h3><div class="gold">${data.spec||''}</div></div>
    ${data.nodes ? `<div style="text-align:center;color:#C9A96E;margin-bottom:16px">溯源时间线</div><div class="tl">${data.nodes.map(n => `<div class="tl-item"><div class="tl-dot">${n.icon||''}</div><div class="tl-title">${n.title||n.type||''}</div><div style="color:#8a8578;font-size:.85rem">${n.content||''}</div></div>`).join('')}</div>` : ''}
    <div style="text-align:center;padding:32px 0;border-top:1px solid rgba(201,169,110,.08);margin-top:32px"><a href="https://tdxh01.xyz" style="color:#C9A96E;text-decoration:none;font-size:.8rem">天地鲟鳇 官方网站</a></div>
  </body></html>`;
}

module.exports = async (req, res) => {
  const url = req.url || '';
  const method = req.method;
  const pathname = url.split('?')[0];

  try {
    // Admin page
    if (pathname === '/trace/admin' && method === 'GET') {
      try {
        const p = path.join(__dirname, 'admin.html');
        const c = fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8');
        return html(res, c);
      } catch { return html(res, '<h1>Admin page not found</h1>'); }
    }

    // Consumer trace page (input form)
    if (pathname === '/trace' && method === 'GET') {
      return html(res, `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>天地鲟鳇 · 产品溯源</title><style>body{font-family:'Noto Serif SC','PingFang SC',serif;background:#0a0a0c;color:#d4cfc4;max-width:480px;margin:0 auto;padding:40px 24px;text-align:center}.logo{width:60px;height:60px;border-radius:50%;border:2px solid #8b6f3a;margin-bottom:16px}h1{color:#f0eadb;font-weight:300;font-size:1.3rem}.sub{color:#C9A96E;font-size:.7rem;margin-bottom:32px}.box{display:flex;gap:10px}.box input{flex:1;padding:13px 18px;background:#16161c;border:1px solid rgba(201,169,110,.12);border-radius:2px;color:#f0eadb;font-family:inherit;font-size:.9rem;outline:none}.box input:focus{border-color:#C9A96E}.box button{padding:13px 30px;background:transparent;color:#C9A96E;border:1px solid #C9A96E;border-radius:2px;cursor:pointer;font-size:.8rem;font-family:inherit;text-transform:uppercase}.box button:hover{background:#C9A96E;color:#0a0a0c}.footer{margin-top:48px;border-top:1px solid rgba(201,169,110,.08);padding:24px;font-size:.7rem;color:#5a5550}</style></head><body>
      <img class="logo" src="/images/logo1.png" alt="天地鲟鳇">
      <h1>天地鲟鳇 · 产品溯源</h1>
      <p class="sub">正品查询唯一网址</p>
      <form method="GET" action="/trace" onsubmit="var s=this.querySelector('input').value.trim();if(s){this.action='/trace/'+encodeURIComponent(s);return true;}return false;" style="margin-top:32px">
        <div class="box"><input type="text" name="sn" placeholder="输入产品溯源码" required><button type="submit">查 询</button></div>
      </form>
      <div class="footer">&copy; 2025 天地鲟鳇</div>
    </body></html>`);
    }

    // SN code query
    const snMatch = pathname.match(/^\/trace\/([^/]+)$/);
    if (snMatch && method === 'GET') {
      const sn = snMatch[1];
      if (sn === 'admin') {
        try {
          const p = path.join(__dirname, 'admin.html');
          return html(res, fs.readFileSync(path.join(__dirname, 'admin.html'), 'utf8'));
        } catch { return html(res, '<h1>Admin</h1>'); }
      }

      const { data } = await supabase.from('sn_codes')
        .select('*, products(name,spec,price,description), batches(batch_no)')
        .eq('sn', sn).single();

      if (!data) return html(res, traceResultHTML(null, '未查询到该产品，谨防假冒'));

      const now = new Date().toISOString();
      await supabase.from('sn_codes').update({ query_count: (data.query_count||0)+1, last_query_at: now, first_query_at: data.first_query_at||now }).eq('id', data.id);
      await supabase.from('query_logs').insert({ sn_id: data.id, sn, query_result: 'valid' });

      const { data: nodes } = await supabase.from('trace_nodes')
        .select('*, trace_node_types!inner(name, icon), trace_media(*)')
        .eq('batch_id', data.batch_id).order('sort_order').order('id');

      const result = {
        sn: data.sn, query_count: (data.query_count||0)+1,
        product_name: data.products?.name||'', spec: data.products?.spec||'', price: data.products?.price||'',
        nodes: (nodes||[]).map(n => ({ icon: n.trace_node_types?.icon||'', title: n.title||n.trace_node_types?.name||'', content: n.content }))
      };
      return html(res, traceResultHTML(result, null));
    }

    // ==================== API Routes ====================

    // Debug
    if (pathname === '/trace/api/debug/login') {
      const body = await parseBody(req);
      const { data } = await supabase.from('admins').select('*').eq('username', body.username);
      if (!data?.length) return json(res, { error: '用户不存在', received_username: body.username });
      const stored = data[0].password || '';
      const match = bcrypt.compareSync(body.password || '', stored);
      return json(res, { exists: true, password_match: match, stored_prefix: stored.slice(0, 10) });
    }

    // Login
    if (pathname === '/trace/api/admin/login' && method === 'POST') {
      const body = await parseBody(req);
      const { data: admins } = await supabase.from('admins').select('*').eq('username', body.username).eq('status', 1);
      if (!admins?.length || !bcrypt.compareSync(body.password, admins[0].password))
        return json(res, { error: '用户名或密码错误' }, 401);
      const token = jwt.sign({ id: admins[0].id, username: body.username, role: admins[0].role }, JWT_SECRET, { expiresIn: '7d' });
      return json(res, { ok: true, token, admin: { username: body.username, nickname: admins[0].nickname, role: admins[0].role } });
    }

    // Auth check
    if (pathname === '/trace/api/admin/me' && method === 'GET') {
      const user = auth(req.headers.authorization);
      if (!user) return json(res, { error: '未登录' }, 401);
      return json(res, { ok: true, admin: user });
    }

    // Stats
    if (pathname === '/trace/api/stats' && method === 'GET') {
      const user = auth(req.headers.authorization);
      if (!user) return json(res, { error: '未登录' }, 401);
      const [sn, q, tq, p, b] = await Promise.all([
        supabase.from('sn_codes').select('*', {count:'exact', head:true}),
        supabase.from('query_logs').select('*', {count:'exact', head:true}),
        supabase.from('query_logs').select('*', {count:'exact', head:true}).gte('created_at', new Date(Date.now()-86400000).toISOString()),
        supabase.from('products').select('*', {count:'exact', head:true}),
        supabase.from('batches').select('*', {count:'exact', head:true})
      ]);
      return json(res, { totalSN: sn.count||0, totalQuery: q.count||0, todayQuery: tq.count||0, totalProducts: p.count||0, totalBatches: b.count||0 });
    }

    // Generic CRUD helper
    const apiMatch = pathname.match(/^\/trace\/api\/([\w-]+)(?:\/(\d+))?(?:\/([\w-]+))?(?:\/(\d+))?$/);
    if (apiMatch) {
      const user = auth(req.headers.authorization);
      if (!user && apiMatch[1] !== 'admin') return json(res, { error: '未登录' }, 401);

      const resource = apiMatch[1]; // products, batches, nodes, sncodes, node-types
      const id = apiMatch[2] || null;
      const action = apiMatch[3] || null; // status, media, generate

      switch (resource) {
        case 'products': {
          if (method === 'GET') { const { data } = await supabase.from('products').select('*').order('sort').order('id'); return json(res, data||[]); }
          if (method === 'POST') { const b = await parseBody(req); await supabase.from('products').insert(b); return json(res, {ok:true}); }
          if (method === 'PUT' && id) { const b = await parseBody(req); await supabase.from('products').update({...b, updated_at: new Date().toISOString()}).eq('id', id); return json(res, {ok:true}); }
          if (method === 'DELETE' && id) { await supabase.from('products').delete().eq('id', id); return json(res, {ok:true}); }
          break;
        }
        case 'batches': {
          if (method === 'GET') { const { data } = await supabase.from('batches').select('*, products(name)').order('id', {ascending:false}); return json(res, (data||[]).map(b=>({...b, product_name: b.products?.name||''}))); }
          if (method === 'POST') { const b = await parseBody(req); await supabase.from('batches').insert(b); return json(res, {ok:true}); }
          if (method === 'PUT' && id) { const b = await parseBody(req); await supabase.from('batches').update({...b, updated_at: new Date().toISOString()}).eq('id', id); return json(res, {ok:true}); }
          if (method === 'DELETE' && id) { await supabase.from('batches').delete().eq('id', id); return json(res, {ok:true}); }
          break;
        }
        case 'nodes': {
          if (action === 'media' && id) {
            const b = await parseBody(req);
            await supabase.from('trace_media').delete().eq('trace_node_id', id);
            if (b.media?.length) await supabase.from('trace_media').insert(b.media.map(m=>({...m, trace_node_id: parseInt(id)})));
            return json(res, {ok:true, count: b.media?.length||0});
          }
          if (id && method === 'GET') { const { data } = await supabase.from('trace_nodes').select('*, trace_node_types!inner(name, icon), trace_media(*)').eq('batch_id', id).order('sort_order').order('id'); return json(res, (data||[]).map(n=>({...n, type_name: n.trace_node_types?.name||'', type_icon: n.trace_node_types?.icon||'', media: n.trace_media||[]}))); }
          if (method === 'POST') { const b = await parseBody(req); const { data, error } = await supabase.from('trace_nodes').insert(b).select(); if (error) return json(res, {error: error.message}, 500); return json(res, {ok:true, id: data?.[0]?.id}); }
          if (method === 'PUT' && id) { const b = await parseBody(req); await supabase.from('trace_nodes').update({...b, updated_at: new Date().toISOString()}).eq('id', id); return json(res, {ok:true}); }
          if (method === 'DELETE' && id) { await supabase.from('trace_nodes').delete().eq('id', id); return json(res, {ok:true}); }
          break;
        }
        case 'node-types': {
          if (method === 'GET') { const { data } = await supabase.from('trace_node_types').select('*').order('sort_order'); return json(res, data||[]); }
          break;
        }
        case 'sncodes': {
          if (action === 'generate' && method === 'POST') {
            const b = await parseBody(req);
            const num = Math.min(b.count||10, 1000);
            const prefix='TDXH'; const year=String(new Date().getFullYear()).slice(2);
            const created = [];
            for(let i=0;i<num;i++) {
              const sn = prefix+year+String(b.product_id).padStart(2,'0')+String(Date.now()%100000+i).padStart(5,'0')+String(Math.floor(Math.random()*9999)).padStart(4,'0');
              const { error } = await supabase.from('sn_codes').insert({sn, product_id: b.product_id, batch_id: b.batch_id});
              if (!error) created.push(sn);
            }
            return json(res, {ok:true, count: created.length, sncodes: created});
          }
          if (method === 'GET') { const { data } = await supabase.from('sn_codes').select('*, products(name), batches(batch_no)').order('id', {ascending:false}).limit(200); return json(res, (data||[]).map(s=>({...s, product_name: s.products?.name||'', batch_no: s.batches?.batch_no||''}))); }
          if (action === 'status' && id && method === 'PUT') { const b = await parseBody(req); await supabase.from('sn_codes').update({status: b.status}).eq('id', id); return json(res, {ok:true}); }
          break;
        }
        case 'upload': {
          const b = await parseBody(req);
          if (!b.filename || !b.data) return json(res, {error: '缺少文件'}, 400);
          const ext = path.extname(b.filename).toLowerCase();
          if (!['.jpg','.jpeg','.png','.gif','.webp','.mp4','.mov'].includes(ext)) return json(res, {error: '不支持格式'}, 400);
          try {
            const buf = Buffer.from(b.data, 'base64');
            const fn = Date.now()+'-'+Math.random().toString(36).slice(2)+ext;
            require('fs').writeFileSync('/tmp/'+fn, buf);
            return json(res, {ok:true, url:'/trace/uploads/'+fn, filename:fn, size:buf.length});
          } catch(e) { return json(res, {error: '写入失败'}, 500); }
        }
      }
    }

    // Serve uploaded files
    if (pathname.startsWith('/trace/uploads/')) {
      const fn = pathname.replace('/trace/uploads/', '');
      if (fn && !fn.includes('..')) {
        const fp = '/tmp/' + fn;
        if (fs.existsSync(fp)) {
          const ext = path.extname(fn).toLowerCase();
          const mime = {'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.mp4':'video/mp4','.mov':'video/quicktime'}[ext]||'application/octet-stream';
          const content = fs.readFileSync(fp);
          res.writeHead(200,{'Content-Type':mime,'Content-Length':content.length,'Cache-Control':'public,max-age=3600'});
          return res.end(content);
        }
      }
    }
        json(res, { error: 'Not found' }, 404);
  } catch(e) {
    console.error(e);
    json(res, { error: e.message || 'Server error' }, 500);
  }
};
