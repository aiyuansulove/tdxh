const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const serverless = require('serverless-http');
const supabase = require('../supabaseClient');

const app = express();
const JWT_SECRET = 'tdxh-trace-secret-2025';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

// Add this line to disable the warning
process.env.NODE_NO_WARNINGS = '1';

const fs = require('fs');
const uploadsDir = '/tmp/uploads';
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.random().toString(36).slice(2) + path.extname(file.originalname))
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use('/trace/uploads', express.static(uploadsDir));

function auth(req, res, next) {
  const token = req.cookies?.token || req.headers?.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未登录' });
  try { req.admin = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: '登录已过期' }); }
}

// Consumer
app.get('/trace', (req, res) => {
  res.render('index', { title: '天地鲟鳇 · 产品溯源', sn: '', result: null, error: null, nodes: null });
});

app.get('/trace/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'index.html'));
});

app.get('/trace/:sn', async (req, res) => {
  const sn = req.params.sn;
  if (sn === 'admin' || sn.startsWith('admin/')) return res.sendFile(path.join(__dirname, '..', 'public', 'admin', 'index.html'));
  if (sn === 'api') return res.redirect('/trace/admin');
  if (!sn || sn.length < 5) return res.render('index', { title: '天地鲟鳇 · 产品溯源', sn, result: null, error: '溯源码格式不正确', nodes: null });

  try {
    const { data: snData, error: snError } = await supabase.from('sn_codes')
      .select('*, products(name, category, spec, price, cover_image, description), batches(batch_no)')
      .eq('sn', sn).single();
    if (snError || !snData) return res.render('index', { title: '天地鲟鳇 · 产品溯源', sn, result: null, error: '未查询到该产品，谨防假冒', nodes: null });
    if (snData.status === 'revoked') return res.render('index', { title: '天地鲟鳇 · 产品溯源', sn, result: null, error: '该溯源码已被注销', nodes: null });

    const now = new Date().toISOString();
    await supabase.from('sn_codes').update({ query_count: (snData.query_count||0)+1, last_query_at: now, first_query_at: snData.first_query_at||now }).eq('id', snData.id);
    await supabase.from('query_logs').insert({ sn_id: snData.id, sn, ip: req.ip||'', user_agent: req.headers['user-agent']||'', query_result: 'valid' });

    const { data: nodes } = await supabase.from('trace_nodes')
      .select('*, trace_node_types!inner(name, icon), trace_media(*)')
      .eq('batch_id', snData.batch_id).order('sort_order').order('id');

    const result = { sn: snData.sn, product_name: snData.products?.name||'', spec: snData.products?.spec||'', price: snData.products?.price||'', product_desc: snData.products?.description||'', batch_no: snData.batches?.batch_no||'', query_count: (snData.query_count||0)+1, first_query_at: snData.first_query_at||now };
    const formattedNodes = (nodes||[]).map(n => ({ id: n.id, type_icon: n.trace_node_types?.icon||'', type_name: n.trace_node_types?.name||'', title: n.title, content: n.content, media: (n.trace_media||[]).map(m => ({ media_type: m.media_type, url: m.url, description: m.description||'' })) }));
    res.render('index', { title: '天地鲟鳇 · 产品溯源', sn, result, error: null, nodes: formattedNodes });
  } catch(e) { console.error(e); res.render('index', { title: '天地鲟鳇 · 产品溯源', sn, result: null, error: '系统错误', nodes: null }); }
});

// Admin Login
app.post('/trace/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  const { data: admins } = await supabase.from('admins').select('*').eq('username', username).eq('status', 1);
  if (!admins?.length || !bcrypt.compareSync(password, admins[0].password)) return res.status(401).json({ error: '用户名或密码错误' });
  const token = jwt.sign({ id: admins[0].id, username, role: admins[0].role }, JWT_SECRET, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7*24*60*60*1000 });
  res.json({ ok: true, token, admin: { username, nickname: admins[0].nickname, role: admins[0].role } });
});

app.get('/trace/api/admin/me', auth, (req, res) => res.json({ ok: true, admin: req.admin }));

// Products
app.get('/trace/api/products', auth, async (req, res) => { const { data } = await supabase.from('products').select('*').order('sort').order('id'); res.json(data||[]); });
app.post('/trace/api/products', auth, async (req, res) => { const { name, category, spec, price, description } = req.body; const { error } = await supabase.from('products').insert({ name, category: category||'', spec: spec||'', price: price||'', description: description||'' }); res.json(error ? {error: error.message} : {ok: true}); });
app.put('/trace/api/products/:id', auth, async (req, res) => { const { name, category, spec, price, description, status } = req.body; await supabase.from('products').update({ name, category: category||'', spec: spec||'', price: price||'', description: description||'', status: status??1, updated_at: new Date().toISOString() }).eq('id', req.params.id); res.json({ok: true}); });
app.delete('/trace/api/products/:id', auth, async (req, res) => { await supabase.from('products').delete().eq('id', req.params.id); res.json({ok: true}); });

// Batches
app.get('/trace/api/batches', auth, async (req, res) => { const { data } = await supabase.from('batches').select('*, products(name)').order('id', { ascending: false }); res.json((data||[]).map(b => ({...b, product_name: b.products?.name||''}))); });
app.post('/trace/api/batches', auth, async (req, res) => { const { product_id, batch_no, quantity, fry_source, fry_date, harvest_date, process_date } = req.body; const { error } = await supabase.from('batches').insert({ product_id, batch_no, quantity: quantity||0, fry_source: fry_source||'', fry_date: fry_date||'', harvest_date: harvest_date||'', process_date: process_date||'' }); res.json(error ? {error: error.message} : {ok: true}); });
app.put('/trace/api/batches/:id', auth, async (req, res) => { const d = req.body; await supabase.from('batches').update({ product_id: d.product_id, batch_no: d.batch_no, quantity: d.quantity||0, fry_source: d.fry_source||'', fry_date: d.fry_date||'', harvest_date: d.harvest_date||'', process_date: d.process_date||'', status: d.status??0, updated_at: new Date().toISOString() }).eq('id', req.params.id); res.json({ok: true}); });
app.delete('/trace/api/batches/:id', auth, async (req, res) => { await supabase.from('batches').delete().eq('id', req.params.id); res.json({ok: true}); });

// Trace Nodes
app.get('/trace/api/nodes/:batchId', auth, async (req, res) => { const { data } = await supabase.from('trace_nodes').select('*, trace_node_types!inner(name, icon), trace_media(*)').eq('batch_id', req.params.batchId).order('sort_order').order('id'); res.json((data||[]).map(n => ({...n, type_name: n.trace_node_types?.name||'', type_icon: n.trace_node_types?.icon||'', trace_node_types: undefined, media: n.trace_media||[], trace_media: undefined}))); });
app.post('/trace/api/nodes', auth, async (req, res) => { const { batch_id, node_code, title, content, sort_order } = req.body; const { data, error } = await supabase.from('trace_nodes').insert({ batch_id, node_code, title: title||'', content: content||'', sort_order: sort_order||0 }).select(); if (error) return res.status(500).json({error: error.message}); res.json({ok: true, id: data[0]?.id}); });
app.put('/trace/api/nodes/:id', auth, async (req, res) => { const { title, content, sort_order } = req.body; await supabase.from('trace_nodes').update({ title: title||'', content: content||'', sort_order: sort_order||0, updated_at: new Date().toISOString() }).eq('id', req.params.id); res.json({ok: true}); });
app.delete('/trace/api/nodes/:id', auth, async (req, res) => { await supabase.from('trace_nodes').delete().eq('id', req.params.id); res.json({ok: true}); });
app.post('/trace/api/nodes/:id/media', auth, async (req, res) => { const { media } = req.body; if (!media?.length) return res.json({ok: true, count: 0}); await supabase.from('trace_media').delete().eq('trace_node_id', req.params.id); const inserts = media.map(m => ({ trace_node_id: parseInt(req.params.id), media_type: m.media_type||'image', url: m.url, description: m.description||'', sort_order: m.sort_order||0 })); await supabase.from('trace_media').insert(inserts); res.json({ok: true, count: inserts.length}); });

// Node Types
app.get('/trace/api/node-types', auth, async (req, res) => { const { data } = await supabase.from('trace_node_types').select('*').order('sort_order'); res.json(data||[]); });

// SN Codes
app.get('/trace/api/sncodes', auth, async (req, res) => { const { data } = await supabase.from('sn_codes').select('*, products(name), batches(batch_no)').order('id', { ascending: false }).limit(200); res.json((data||[]).map(s => ({...s, product_name: s.products?.name||'', batch_no: s.batches?.batch_no||''}))); });
app.post('/trace/api/sncodes/generate', auth, async (req, res) => { const { product_id, batch_id, count } = req.body; const num = Math.min(count||10, 1000); const prefix = 'TDXH'; const year = String(new Date().getFullYear()).slice(2); const prodCode = String(product_id).padStart(2,'0'); const created = []; for (let i=0; i<num; i++) { const sn = `${prefix}${year}${prodCode}${String(Date.now()%100000+i).padStart(5,'0')}${String(Math.floor(Math.random()*9999)).padStart(4,'0')}`; const { error } = await supabase.from('sn_codes').insert({ sn, product_id, batch_id }); if (!error) created.push(sn); } res.json({ok: true, count: created.length, sncodes: created}); });
app.put('/trace/api/sncodes/:id/status', auth, async (req, res) => { await supabase.from('sn_codes').update({ status: req.body.status }).eq('id', req.params.id); res.json({ok: true}); });

// Upload
app.post('/trace/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择文件' });
  res.json({ ok: true, url: '/trace/uploads/' + req.file.filename, filename: req.file.filename, size: req.file.size });
});

// Stats
app.get('/trace/api/stats', auth, async (req, res) => {
  const [sn, q, tq, p, b] = await Promise.all([
    supabase.from('sn_codes').select('*', { count: 'exact', head: true }),
    supabase.from('query_logs').select('*', { count: 'exact', head: true }),
    supabase.from('query_logs').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now()-86400000).toISOString()),
    supabase.from('products').select('*', { count: 'exact', head: true }),
    supabase.from('batches').select('*', { count: 'exact', head: true })
  ]);
  res.json({ totalSN: sn.count||0, totalQuery: q.count||0, todayQuery: tq.count||0, totalProducts: p.count||0, totalBatches: b.count||0 });
});

exports.handler = serverless(app);
