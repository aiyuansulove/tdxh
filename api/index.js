const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://jsbymonfkasdhnfvkrrx.supabase.co', 'sb_publishable_nJ_aHTgcE53yM01NxmPLcw_wRzSYzGx');

module.exports = async (req, res) => {
  const url = req.url || '';
  const method = req.method || 'GET';
  const path = url.split('?')[0];
  
  res.setHeader('Content-Type', 'application/json');
  
  if (path === '/trace') {
    return res.status(200).json({ status: 'ok', message: 'Trace backend running' });
  }
  
  if (path === '/trace/admin') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    const fs = require('fs');
    const adminPath = require('path').join(__dirname, '..', 'public', 'admin', 'index.html');
    try {
      const html = fs.readFileSync(adminPath, 'utf8');
      return res.status(200).send(html);
    } catch(e) {
      return res.status(200).send('<h1>天地鲟鳇 · 溯源管理</h1><p>Admin page not found</p>');
    }
  }
  
  // SN code query
  const snMatch = path.match(/^\/trace\/([^/]+)$/);
  if (snMatch) {
    const sn = snMatch[1];
    if (sn === 'admin') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      const fs = require('fs');
      const adminPath = require('path').join(__dirname, '..', 'public', 'admin', 'index.html');
      try { return res.status(200).send(fs.readFileSync(adminPath, 'utf8')); } catch(e) {}
    }
    
    try {
      const { data } = await supabase.from('sn_codes').select('*, products(name,spec,price,description), batches(batch_no)').eq('sn', sn).single();
      if (!data) return res.status(200).json({ error: '未查询到该产品' });
      return res.status(200).json({ valid: data.status !== 'revoked', sn: data.sn, product: data.products });
    } catch(e) {
      return res.status(200).json({ error: e.message });
    }
  }
  
  // API routes
  if (path.startsWith('/trace/api/')) {
    const apiPath = path.replace('/trace/api', '');
    
    // Login
    if (apiPath === '/admin/login' && method === 'POST') {
      try {
        const body = await parseBody(req);
        const { username, password } = JSON.parse(body);
        const { data: admins } = await supabase.from('admins').select('*').eq('username', username).eq('status', 1);
        if (!admins?.length) return res.status(401).json({ error: '用户名或密码错误' });
        const bcrypt = require('bcryptjs');
        if (!bcrypt.compareSync(password, admins[0].password)) return res.status(401).json({ error: '用户名或密码错误' });
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ id: admins[0].id, username, role: admins[0].role }, 'tdxh-trace-secret-2025', { expiresIn: '7d' });
        return res.json({ ok: true, token, admin: { username, nickname: admins[0].nickname, role: admins[0].role } });
      } catch(e) { return res.status(500).json({ error: e.message }); }
    }
    
    // Stats
    if (apiPath === '/stats' && method === 'GET') {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) return res.status(401).json({ error: '未登录' });
      try {
        const jwt = require('jsonwebtoken');
        jwt.verify(token, 'tdxh-trace-secret-2025');
        const [sn, q, tq, p, b] = await Promise.all([
          supabase.from('sn_codes').select('*', {count:'exact', head:true}),
          supabase.from('query_logs').select('*', {count:'exact', head:true}),
          supabase.from('query_logs').select('*', {count:'exact', head:true}).gte('created_at', new Date(Date.now()-86400000).toISOString()),
          supabase.from('products').select('*', {count:'exact', head:true}),
          supabase.from('batches').select('*', {count:'exact', head:true})
        ]);
        return res.json({ totalSN: sn.count||0, totalQuery: q.count||0, todayQuery: tq.count||0, totalProducts: p.count||0, totalBatches: b.count||0 });
      } catch(e) { return res.status(401).json({ error: '登录已过期' }); }
    }
    
    return res.status(404).json({ error: 'API not found' });
  }
  
  res.status(404).json({ error: 'Not found' });
};

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
  });
}
