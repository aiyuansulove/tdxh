/**
 * 天地鲟鳇 · 后台管理 v3
 * 纯 GitHub API 驱动，保存→GitHub→Vercel→自动部署
 * 
 * 修复记录:
 * v3 - 修复数组内图片上传无效、预览不更新、索引错位
 * v2 - 修复文章保存按钮BUG、去掉relURL
 * v1 - 初始版本
 */

const CFG = { owner:'aiyuansulove', repo:'tdxh', branch:'master', api:'https://api.github.com' };
let TOKEN = localStorage.getItem('github_token') || '';

const SECTIONS = [
  { id:'hero',           label:'🎯 Hero主视觉',       file:'data/homepage/hero.json', group:'首页内容' },
  { id:'brand_story',    label:'📖 品牌故事',          file:'data/homepage/brand_story.json', group:'首页内容' },
  { id:'products',       label:'🛒 产品展示',          file:'data/homepage/products.json', group:'首页内容' },
  { id:'craft',          label:'🔨 匠心工艺',          file:'data/homepage/craft.json', group:'首页内容' },
  { id:'origin',         label:'🌍 产地溯源',          file:'data/homepage/origin.json', group:'首页内容' },
  { id:'culture',        label:'🏛️ 鲟鱼文化',         file:'data/homepage/culture.json', group:'首页内容' },
  { id:'team',           label:'👥 匠人团队',          file:'data/homepage/team.json', group:'首页内容' },
  { id:'brand_ip',       label:'✨ 品牌印记',          file:'data/homepage/brand_ip.json', group:'首页内容' },
  { id:'responsibility', label:'🤝 社会责任',          file:'data/homepage/responsibility.json', group:'首页内容' },
  { id:'contact',        label:'📞 联系我们',          file:'data/homepage/contact.json', group:'首页内容' },
  { id:'news',           label:'📰 新闻动态',          file:'content/news', group:'文章管理', isFolder:true },
  { id:'about',          label:'📋 关于我们',          file:'content/about.md', group:'文章管理' },
];

const SCHEMA = {
  hero: { fields: [
    { k:'logo', label:'Logo 图片', t:'image' }, { k:'title', label:'主标题', t:'text' },
    { k:'subtitle', label:'副标题', t:'text' }, { k:'badge', label:'徽章文字', t:'text' },
    { k:'slogans', label:'标语（可增删）', t:'array', item:'标语', fields:[
      { k:'key', label:'关键字', t:'text' }, { k:'value', label:'说明', t:'text' } ]},
  ]},
  brand_story: { fields: [
    { k:'title', label:'板块标题', t:'text' }, { k:'subtitle', label:'副标题（英文）', t:'text' },
    { k:'timeline', label:'时间线条目', t:'array', item:'时代', fields:[
      { k:'image', label:'图片', t:'image' }, { k:'era', label:'时代范围', t:'text' },
      { k:'eraName', label:'时代名称', t:'text' }, { k:'text', label:'详细描述', t:'textarea' } ]},
  ]},
  products: { fields: [
    { k:'title', label:'板块标题', t:'text' }, { k:'subtitle', label:'副标题（英文）', t:'text' },
    { k:'products', label:'产品列表', t:'array', item:'产品', fields:[
      { k:'image', label:'产品图片', t:'image' }, { k:'name', label:'产品名称', t:'text' },
      { k:'spec', label:'规格', t:'text' }, { k:'desc', label:'产品描述', t:'textarea' },
      { k:'price', label:'价格', t:'text' } ]},
  ]},
  craft: { fields: [
    { k:'title', label:'板块标题', t:'text' }, { k:'subtitle', label:'副标题（英文）', t:'text' },
    { k:'steps', label:'工艺步骤', t:'array', item:'步骤', fields:[
      { k:'icon', label:'图标（Emoji）', t:'text' }, { k:'num', label:'序号', t:'text' },
      { k:'title', label:'步骤名称', t:'text' }, { k:'desc', label:'步骤描述', t:'textarea' } ]},
  ]},
  origin: { fields: [
    { k:'title', label:'板块标题', t:'text' }, { k:'subtitle', label:'副标题（英文）', t:'text' },
    { k:'image', label:'配图', t:'image' }, { k:'caption', label:'图片说明', t:'text' },
    { k:'paragraphs', label:'文字段落', t:'strArr', item:'段落' },
    { k:'stats', label:'统计数据', t:'array', item:'数据', fields:[
      { k:'num', label:'数值', t:'text' }, { k:'label', label:'标签', t:'text' },
      { k:'sublabel', label:'子标签', t:'text' } ]},
  ]},
  culture: { fields: [
    { k:'title', label:'板块标题', t:'text' }, { k:'subtitle', label:'副标题（英文）', t:'text' },
    { k:'cards', label:'文化卡片', t:'array', item:'卡片', fields:[
      { k:'image', label:'图片', t:'image' }, { k:'title', label:'卡片标题', t:'text' },
      { k:'desc', label:'卡片描述', t:'textarea' } ]},
  ]},
  team: { fields: [
    { k:'title', label:'板块标题', t:'text' }, { k:'subtitle', label:'副标题（英文）', t:'text' },
    { k:'members', label:'团队成员', t:'array', item:'成员', fields:[
      { k:'photo', label:'头像', t:'image' }, { k:'name', label:'姓名', t:'text' },
      { k:'title', label:'职称', t:'text' }, { k:'exp', label:'经历', t:'text' },
      { k:'bio', label:'简介', t:'textarea' } ]},
  ]},
  brand_ip: { fields: [
    { k:'title', label:'板块标题', t:'text' }, { k:'subtitle', label:'副标题（英文）', t:'text' },
    { k:'logo', label:'品牌 Logo', t:'image' },
  ]},
  responsibility: { fields: [
    { k:'title', label:'板块标题', t:'text' }, { k:'subtitle', label:'副标题（英文）', t:'text' },
    { k:'cards', label:'责任卡片', t:'array', item:'卡片', fields:[
      { k:'icon', label:'图标（Emoji）', t:'text' }, { k:'title', label:'卡片标题', t:'text' },
      { k:'desc', label:'描述文字', t:'textarea' } ]},
  ]},
  contact: { fields: [
    { k:'title', label:'板块标题', t:'text' }, { k:'subtitle', label:'副标题（英文）', t:'text' },
    { k:'ctaText', label:'品牌名/大号文字', t:'text' }, { k:'buttonText', label:'按钮文字', t:'text' },
    { k:'buttonLink', label:'按钮链接', t:'text' },
  ]},
};

let state = { editing:'', sha:null, data:null, changed:false };
let imgCallback = null, articleState = null;

// ===== GitHub API =====
const api = {
  headers(){ return { Authorization:'token '+TOKEN, Accept:'application/vnd.github.v3+json' }; },
  async req(m, p, b){
    const r = await fetch(CFG.api+p, { method:m, headers:this.headers(), body:b?JSON.stringify(b):null });
    if(!r.ok){ const e=await r.json().catch(()=>({message:r.statusText})); throw new Error(e.message); }
    return r.status===204?null:r.json();
  },
  async get(path){
    const d = await this.req('GET', `/repos/${CFG.owner}/${CFG.repo}/contents/${path}?ref=${CFG.branch}`);
    const c = decodeURIComponent(escape(atob(d.content.replace(/\n/g,''))));
    return { sha:d.sha, content:c };
  },
  async put(path, content, msg, sha){
    return this.req('PUT', `/repos/${CFG.owner}/${CFG.repo}/contents/${path}`, {
      message:msg, content:btoa(unescape(encodeURIComponent(content))), sha, branch:CFG.branch
    });
  },
  async create(path, content, msg){
    return this.req('PUT', `/repos/${CFG.owner}/${CFG.repo}/contents/${path}`, {
      message:msg, content:btoa(unescape(encodeURIComponent(content))), branch:CFG.branch
    });
  },
  async list(path){
    const d = await this.req('GET', `/repos/${CFG.owner}/${CFG.repo}/contents/${path}?ref=${CFG.branch}`);
    return d.map(i=>({name:i.name,path:i.path,type:i.type,sha:i.sha}));
  },
  async verify(){ const d=await this.req('GET','/user'); return d.login; },
  async upload(file){
    return new Promise((rs,rj)=>{
      if(!['image/jpeg','image/png','image/gif','image/webp'].includes(file.type)){ rj(new Error('仅支持 JPG/PNG/GIF/WebP')); return; }
      if(file.size>5*1024*1024){ rj(new Error('图片不能超过 5MB')); return; }
      const r=new FileReader();
      r.onload=async e=>{
        const b64=e.target.result.split(',')[1], ext=file.name.split('.').pop().toLowerCase();
        const fn=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6)+'.'+ext;
        const r2=await fetch(`${CFG.api}/repos/${CFG.owner}/${CFG.repo}/contents/static/images/${fn}`, {
          method:'PUT', headers:{ Authorization:'token '+TOKEN, 'Accept':'application/vnd.github.v3+json' },
          body:JSON.stringify({ message:'上传图片: '+fn, content:b64, branch:CFG.branch })
        });
        if(!r2.ok){ const e=await r2.json().catch(()=>({message:r2.statusText})); rj(new Error(e.message)); return; }
        rs('/images/'+fn);
      };
      r.onerror=()=>rj(new Error('读取文件失败'));
      r.readAsDataURL(file);
    });
  }
};

// ===== Helpers =====
const $ = id => document.getElementById(id);
function esc(s){ const d=document.createElement('div'); d.textContent=s; return d.innerHTML; }
function toast(msg, type='info', t=3500){
  const el=$('toast'); el.textContent=msg; el.className='toast '+type+' show';
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'), t);
}

// ===== 侧边栏 =====
function renderSidebar(){
  const nav=document.getElementById('sidebarNav');
  const groups={};
  SECTIONS.forEach(s=>{ if(!groups[s.group]) groups[s.group]=[]; groups[s.group].push(s); });
  let html='';
  Object.entries(groups).forEach(([g,items])=>{
    html+=`<div class="nav-group"><div class="nav-group-title">${g}</div>`;
    items.forEach(s=>{ html+=`<button class="nav-item" data-id="${s.id}" data-file="${s.file}" ${s.isFolder?'data-folder="1"':''}>${s.label}</button>`; });
    html+=`</div>`;
  });
  nav.innerHTML=html;
  nav.querySelectorAll('.nav-item').forEach(btn=>{
    btn.addEventListener('click',()=>{
      nav.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const id=btn.dataset.id, file=btn.dataset.file;
      if(id==='news') openNewsManager();
      else if(id==='about') openArticleEditor(file);
      else openSectionEditor(id, file);
    });
  });
}

// ===== 板块编辑器 =====
async function openSectionEditor(id, file){
  try {
    const schema=SCHEMA[id];
    if(!schema){ toast('未知板块','error'); return; }
    showEditor(id, file);
    const f = await api.get(file);
    const data = JSON.parse(f.content);
    state.sha = f.sha; state.data = data; state.changed = false;
    renderForm(id, data);
  } catch(e){
    toast('❌ 加载失败：' + e.message, 'error');
    console.error(e);
  }
}

// ===== 文章编辑器 =====
async function openArticleEditor(file){
  try {
    showEditor('article', file);
    const f = await api.get(file);
    const parsed = parseFM(f.content);
    articleState = { sha:f.sha, path:file, parsed };
    const form = document.getElementById('sectionForm');
    form.innerHTML = `
      <div class="form-group"><label class="form-label">标题</label><input type="text" id="artTitle" class="form-input" value="${esc(parsed.title)}"></div>
      <div class="form-group"><label class="form-label">日期</label><input type="date" id="artDate" class="form-input" value="${parsed.date}"></div>
      <div class="form-group"><label class="form-label">内容（HTML / Markdown）</label>
        <textarea id="artBody" class="form-textarea" rows="18" style="font-family:monospace;font-size:.9em;line-height:1.7">${esc(parsed.body)}</textarea>
        <div class="form-hint">支持 HTML 格式</div></div>`;
    state.changed=false;
    $('commitMsg').value = '更新 ' + file.split('/').pop();
    $('editorSaveBtn').onclick = saveArticle;
  } catch(e){ toast('❌ 加载失败：'+e.message, 'error'); }
}

async function saveArticle(){
  if(!articleState) return;
  const title = $('artTitle').value.trim() || '无标题';
  const date = $('artDate').value || new Date().toISOString().split('T')[0];
  const body = $('artBody').value || '';
  const fm = {...articleState.parsed.frontMatter, title, date};
  const content = '---\n' + Object.entries(fm).map(([k,v])=>{
    const q = v.includes(':')||v.includes('#')||/\s/.test(v);
    return `${k}: ${q?'"'+v+'"':v}`;
  }).join('\n') + '\n---\n\n' + body.trim() + '\n';
  const msg = $('commitMsg').value.trim() || '更新 '+articleState.path.split('/').pop();
  const btn=$('editorSaveBtn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span> 保存中...';
  try {
    const r = await api.put(articleState.path, content, msg, articleState.sha);
    articleState.sha = r.content.sha; state.changed=false;
    toast('✅ 保存成功！Vercel 正在自动构建，1-3 分钟后网站更新', 'success');
  } catch(e){ toast('❌ 保存失败：'+e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='💾 保存'; }
}

// ===== 新闻列表 =====
async function openNewsManager(){
  try {
    showEditor('news', 'content/news/');
    $('editorSaveBtn').style.display='none'; $('commitMsg').style.display='none';
    const files = await api.list('content/news');
    const mdFiles = files.filter(f=>f.name.endsWith('.md')&&f.name!=='index.md');
    const form=$('sectionForm');
    if(mdFiles.length===0){ form.innerHTML='<p class="loading-text">暂无新闻文章</p>'; return; }
    const items = await Promise.all(mdFiles.sort((a,b)=>a.name.localeCompare(b.name)).map(async f=>{
      try{ const d=await api.get(f.path); const p=parseFM(d.content); return {path:f.path, title:p.title||f.name, date:p.date||''}; }
      catch{ return {path:f.path, title:f.name, date:''}; }
    }));
    form.innerHTML = `
      <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
        <span style="color:var(--text2);font-size:.9em">共 ${items.length} 篇</span>
        <button id="createNewsBtn" class="btn btn-primary btn-sm" style="margin-left:auto">+ 新建文章</button></div>
      ${items.map(item=>`
        <div class="form-array-item" style="cursor:pointer" onclick="openArticleEditor('${item.path}')">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div><strong>${esc(item.title)}</strong><br><span style="font-size:.78em;color:var(--text3)">${item.path}${item.date?' · '+item.date:''}</span></div>
            <span style="color:var(--gold);font-size:.8em">✏️ 编辑</span></div></div>`).join('')}`;
    $('createNewsBtn').addEventListener('click', createNewsArticle);
  } catch(e){ toast('❌ 加载失败：'+e.message,'error'); }
}

async function createNewsArticle(){
  const title = prompt('请输入新闻标题：');
  if(!title||!title.trim()) return;
  const slug = title.trim().replace(/[^\w\u4e00-\u9fff\s-]/g,'').replace(/\s+/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'').toLowerCase()||'article-'+Date.now().toString(36);
  const safe = /^[\u4e00-\u9fff-]+$/.test(slug)?'article-'+Date.now().toString(36):slug;
  const date=new Date().toISOString().split('T')[0];
  const path='content/news/'+safe+'.md';
  const content=`---\ntitle: "${title.trim()}"\ndate: ${date}\n---\n\n<p>在此输入文章内容...</p>\n`;
  try {
    await api.create(path, content, '新建文章: '+title.trim());
    toast('✅ 文章已创建！','success');
    openNewsManager();
    setTimeout(()=>openArticleEditor(path), 500);
  } catch(e){ toast('❌ 创建失败：'+e.message,'error'); }
}

// ===== Front Matter =====
function parseFM(raw){
  const r={frontMatter:{},body:raw,title:'',date:''};
  const m=raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n{0,2}([\s\S]*)$/);
  if(!m) return r;
  r.body=m[2].trim();
  m[1].split('\n').forEach(line=>{
    const kv=line.match(/^(\w+):\s*(.+)$/);
    if(kv){
      let v=kv[2].trim();
      if((v.startsWith('"')&&v.endsWith('"'))||(v.startsWith("'")&&v.endsWith("'"))) v=v.slice(1,-1);
      r.frontMatter[kv[1]]=v;
      if(kv[1]==='title') r.title=v;
      if(kv[1]==='date') r.date=v.split('T')[0];
    }
  });
  return r;
}

// ===== 编辑器面板 =====
function showEditor(id, file){
  $('welcomeScreen').style.display='none';
  $('editorPanel').style.display='flex';
  $('editorTitle').textContent = SECTIONS.find(s=>s.id===id)?.label||'编辑';
  $('editorPath').textContent = file;
  $('editorSaveBtn').style.display='';
  $('commitMsg').style.display='';
  $('commitMsg').value = '';
  $('editorSaveBtn').onclick = saveSection;
  const form = document.getElementById('sectionForm');
  if(form) form.innerHTML = '<p class="loading-text"><span class="spinner"></span> 加载中...</p>';
  state.editing=id; state.changed=false;
}

// ===== 更新图片预览 =====
function updateImagePreview(input) {
  if (!input) return;
  const group = input.closest('.form-group');
  if (!group) return;
  const preview = group.querySelector('.form-image-preview');
  if (!preview) {
    // 如果没有预览元素（上传前），创建一个
    const path = input.value;
    if (!path) return;
    const div = document.createElement('div');
    div.className = 'form-image-preview';
    div.innerHTML = `<img src="${esc(path)}" onerror="this.style.display='none'"><span class="form-image-path">${esc(path)}</span>`;
    group.appendChild(div);
  } else {
    preview.querySelector('img').src = input.value;
    preview.querySelector('.form-image-path').textContent = input.value;
    preview.querySelector('img').style.display = '';
  }
}

// ===== 表单渲染 =====
function renderForm(id, data){
  const schema=SCHEMA[id]; const form=$('sectionForm');
  if(!schema||!form) return;
  let html=''; schema.fields.forEach(f=>{ html+=renderField(f,data); });
  form.innerHTML=html;
  $('commitMsg').value = '更新首页: '+(SECTIONS.find(s=>s.id===id)?.label||id);
  
  // 绑定添加/删除按钮
  form.querySelectorAll('.array-add-btn').forEach(btn=>{ btn.onclick=e=>{addArrayItem(id,btn.dataset.key);}; });
  form.querySelectorAll('.array-del-btn').forEach(btn=>{ btn.onclick=e=>{removeArrayItem(id,btn.dataset.key,parseInt(btn.dataset.idx));}; });
  
  // 🔥 绑定图片上传按钮（修复 v3：统一处理所有场景）
  form.querySelectorAll('.img-upload-btn').forEach(btn=>{
    btn.onclick=e=>{
      const key=btn.dataset.key;   // 字段名
      const idx=btn.dataset.idx;   // 数组索引（如果有）
      // 保存当前按钮对应的输入框引用
      let targetInput;
      if (idx !== undefined) {
        // 数组内的图片字段
        targetInput = document.querySelector(`input[data-key="${key}"][data-idx="${idx}"]`);
      } else {
        // 顶级图片字段
        targetInput = document.querySelector(`input[data-key="${key}"]:not([data-idx])`);
      }
      imgCallback = url => {
        if (targetInput) {
          targetInput.value = url;
          updateImagePreview(targetInput);
        }
        state.changed = true;
      };
      $('imageFileInput').click();
    };
  });
  
  form.querySelectorAll('input,textarea').forEach(el=>{ el.oninput=()=>{state.changed=true;}; });
}

function renderField(f,data,isArr,idx,parentKey){
  const val=data?data[f.k]:(f.t==='array'?[]:f.t==='strArr'?[]:'');
  const di=isArr?`data-idx="${idx}"`:'';
  if(f.t==='text') return `<div class="form-group"><label class="form-label">${f.label}</label><input type="text" class="form-input" data-key="${f.k}" ${di} value="${esc(val||'')}"></div>`;
  if(f.t==='textarea') return `<div class="form-group"><label class="form-label">${f.label}</label><textarea class="form-textarea" rows="3" data-key="${f.k}" ${di}>${esc(val||'')}</textarea></div>`;
  if(f.t==='image') return `<div class="form-group"><label class="form-label">${f.label}</label>
    <div class="form-image-row"><input type="text" class="form-input" data-key="${f.k}" ${di} value="${esc(val||'')}" placeholder="图片路径或URL">
    <button class="btn btn-outline btn-sm img-upload-btn" data-key="${f.k}" ${di}>上传</button></div>
    ${val?`<div class="form-image-preview"><img src="${esc(val)}" onerror="this.style.display='none'"><span class="form-image-path">${esc(val)}</span></div>`:''}</div>`;
  if(f.t==='strArr'){
    const arr=Array.isArray(val)?val:[];
    return `<div class="form-group"><label class="form-label">${f.label}</label><div class="form-array" id="sa-${f.k}">
      ${arr.map((v,i)=>`<div class="form-array-item"><div class="form-array-item-header"><span class="form-array-item-idx">#${i+1}</span>
      <button class="form-array-del array-del-btn" data-key="${f.k}" data-idx="${i}">✕ 删除</button></div>
      <div class="form-group"><textarea class="form-textarea" rows="2" data-key="${f.k}" data-idx="${i}">${esc(v)}</textarea></div></div>`).join('')}
      <button class="form-array-add array-add-btn" data-key="${f.k}">+ 添加${f.item||'项目'}</button></div></div>`;
  }
  if(f.t==='array'){
    const arr=Array.isArray(val)?val:[];
    return `<div class="form-group"><label class="form-label">${f.label}</label><div class="form-array" id="arr-${f.k}">
      ${arr.map((item,i)=>
        `<div class="form-array-item"><div class="form-array-item-header"><span class="form-array-item-idx">#${i+1} ${f.item||''}</span>
        <button class="form-array-del array-del-btn" data-key="${f.k}" data-idx="${i}">✕ 删除</button></div>
        ${f.fields.map(sf=>renderField(sf,item,true,i)).join('')}</div>`
      ).join('')}
      <button class="form-array-add array-add-btn" data-key="${f.k}">+ 添加${f.item||'项目'}</button></div></div>`;
  }
  return '';
}

// ===== 数组操作 =====
function addArrayItem(sectionId,key){
  const field=SCHEMA[sectionId].fields.find(f=>f.k===key); if(!field) return;
  if(field.t==='strArr'){
    const div=$('sa-'+key); if(!div) return;
    const n=div.querySelectorAll('.form-array-item').length;
    const d=document.createElement('div'); d.className='form-array-item';
    d.innerHTML=`<div class="form-array-item-header"><span class="form-array-item-idx">#${n+1}</span><button class="form-array-del array-del-btn" data-key="${key}" data-idx="${n}">✕ 删除</button></div><div class="form-group"><textarea class="form-textarea" rows="2" data-key="${key}" data-idx="${n}"></textarea></div>`;
    div.insertBefore(d, div.querySelector('.form-array-add'));
    d.querySelector('.array-del-btn').onclick=()=>{removeArrayItem(sectionId,key,n);}; d.querySelector('textarea').oninput=()=>{state.changed=true;};
    state.changed=true; return;
  }
  const div=$('arr-'+key); if(!div) return;
  const n=div.querySelectorAll('.form-array-item').length;
  const empty={}; field.fields.forEach(sf=>{empty[sf.k]='';});
  const d=document.createElement('div'); d.className='form-array-item';
  d.innerHTML=`<div class="form-array-item-header"><span class="form-array-item-idx">#${n+1} ${field.item||''}</span><button class="form-array-del array-del-btn" data-key="${key}" data-idx="${n}">✕ 删除</button></div>${field.fields.map(sf=>renderField(sf,empty,true,n)).join('')}`;
  div.insertBefore(d, div.querySelector('.form-array-add'));
  d.querySelector('.array-del-btn').onclick=()=>{removeArrayItem(sectionId,key,n);};
  
  // 🔥 v3 修复：为新增项绑定图片上传，用闭包保存正确索引
  d.querySelectorAll('.img-upload-btn').forEach(btn=>{
    btn.onclick=e=>{
      const sk=btn.dataset.key;
      const si=parseInt(d.dataset.index || d.querySelector('[data-idx]')?.dataset?.idx || n);
      const inp = d.querySelector(`input[data-key="${sk}"]`);
      imgCallback=url=>{
        if(inp){ inp.value=url; updateImagePreview(inp); }
        state.changed=true;
      };
      $('imageFileInput').click();
    };
  });
  
  d.querySelectorAll('input,textarea').forEach(el=>{el.oninput=()=>{state.changed=true;};});
  state.changed=true;
}

function removeArrayItem(sectionId,key,idx){
  const field=SCHEMA[sectionId].fields.find(f=>f.k===key); if(!field) return;
  const container=$((field.t==='strArr'?'sa-':'arr-')+key); if(!container) return;
  const items=container.querySelectorAll('.form-array-item');
  if(items[idx]){items[idx].remove();state.changed=true;}
}

function collectData(sectionId){
  const schema=SCHEMA[sectionId]; if(!schema) return null;
  const r={};
  schema.fields.forEach(f=>{
    if(f.t==='array'){ const arr=[]; const div=$('arr-'+f.k); if(div) div.querySelectorAll('.form-array-item').forEach((item,i)=>{const o={};f.fields.forEach(sf=>{const inp=item.querySelector(`[data-key="${sf.k}"][data-idx="${i}"]`);o[sf.k]=inp?inp.value:'';});arr.push(o);}); r[f.k]=arr; }
    else if(f.t==='strArr'){ const arr=[]; const div=$('sa-'+f.k); if(div) div.querySelectorAll('.form-array-item').forEach((item,i)=>{const inp=item.querySelector(`[data-key="${f.k}"][data-idx="${i}"]`);if(inp)arr.push(inp.value);}); r[f.k]=arr; }
    else { const inp=document.querySelector(`[data-key="${f.k}"]:not([data-idx])`); r[f.k]=inp?inp.value:''; }
  });
  return r;
}

// ===== 保存 =====
async function saveSection(){
  const id=state.editing;
  if(!id){ toast('⚠️ 没有打开的文件','error'); return; }
  const section=SECTIONS.find(s=>s.id===id);
  if(!section) return;
  const data=collectData(id);
  if(!data) return;
  const json = JSON.stringify(data, null, 2) + '\n';
  const msg = $('commitMsg').value.trim() || '更新首页: '+(section.label||id);
  const btn=$('editorSaveBtn'); btn.disabled=true; btn.innerHTML='<span class="spinner"></span> 保存中...';
  try {
    if (state.sha) {
      await api.put(section.file, json, msg, state.sha);
    } else {
      const r = await api.create(section.file, json, msg);
      state.sha = r.content.sha;
    }
    state.changed=false;
    toast('✅ 保存成功！Vercel 正在自动构建，1-3 分钟后网站自动更新', 'success');
  } catch(e){ toast('❌ 保存失败：'+e.message,'error'); }
  finally { btn.disabled=false; btn.innerHTML='💾 保存'; }
}

// ===== 认证 =====
async function handleLogin(){
  const token=$('tokenInput').value.trim();
  if(!token){ $('loginError').textContent='请输入 GitHub Personal Access Token'; return; }
  const btn=$('loginBtn'); btn.disabled=true; btn.textContent='验证中...';
  $('loginError').textContent=''; const old=TOKEN; TOKEN=token;
  try {
    const user=await api.verify();
    localStorage.setItem('github_token', token);
    $('loginScreen').style.display='none'; $('app').style.display='flex';
    renderSidebar(); $('sidebarStatus').textContent='已连接 · '+user;
    toast('欢迎回来，'+user+'！','success');
  } catch(e){
    TOKEN=old||'';
    $('loginError').textContent='验证失败：'+e.message+'。请检查令牌是否正确且具有 repo 权限。';
  } finally { btn.disabled=false; btn.textContent='进入后台'; }
}

function handleLogout(){
  if(!confirm('确定要退出吗？')) return;
  TOKEN=''; localStorage.removeItem('github_token');
  $('app').style.display='none'; $('loginScreen').style.display='flex';
  $('tokenInput').value=''; $('loginError').textContent='';
  $('sidebarStatus').textContent='未连接';
}

// ===== 初始化 =====
function init(){
  $('loginBtn').addEventListener('click', handleLogin);
  $('tokenInput').addEventListener('keydown', e=>{ if(e.key==='Enter') handleLogin(); });
  $('logoutBtn').addEventListener('click', handleLogout);
  $('imageFileInput').addEventListener('change', e=>{
    if(e.target.files&&e.target.files[0]){
      const cb=imgCallback; imgCallback=null;
      if(cb) api.upload(e.target.files[0]).then(url=>{cb(url);toast('✅ 图片上传成功！','success');}).catch(e=>{toast('❌ '+e.message,'error');});
    }
  });
  document.addEventListener('keydown', e=>{
    if((e.ctrlKey||e.metaKey)&&e.key==='s'){ const p=$('editorPanel'); if(p&&p.style.display!=='none'){ e.preventDefault(); saveSection(); } }
  });
  if(TOKEN){
    (async()=>{
      try{ const user=await api.verify(); $('loginScreen').style.display='none'; $('app').style.display='flex'; renderSidebar(); $('sidebarStatus').textContent='已连接 · '+user; toast('自动登录成功','success'); }
      catch{ localStorage.removeItem('github_token'); TOKEN=''; }
    })();
  }
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();
