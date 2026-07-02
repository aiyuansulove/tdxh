/**
 * 天地鲟鳇 · 本地后台 + ComfyUI 代理服务器
 * 
 * 提供两合一功能：
 *   1. 本地 CMS 后台（同源，AI 生图可用）
 *   2. ComfyUI 文生图代理
 * 
 * 启动: node proxy-comfy.js
 * 访问后台: http://localhost:3457/admin/
 * 
 * API:
 *   POST /api/generate  { prompt, size }
 *   GET  /api/health
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3457;
const COMFY_HOST = '127.0.0.1';
const COMFY_PORT = 8188;

// 静态文件根目录
const ADMIN_DIR = path.join(__dirname, 'public', 'admin');
const IMAGES_DIR = path.join(__dirname, 'public', 'images');
const STATIC_DIR = path.join(__dirname, 'static');

// ===== MIME 类型 =====
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

// ===== ComfyUI API 调用 =====

function comfyRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: COMFY_HOST,
      port: COMFY_PORT,
      path,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (body) opts.headers['Content-Length'] = Buffer.byteLength(body);
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve(data); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function comfyGetBinary(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://${COMFY_HOST}:${COMFY_PORT}${path}`, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

// ===== 构建 txt2img workflow =====

function buildWorkflow({ prompt, negative, width, height, steps, cfg, seed }) {
  return {
    '3': {
      class_type: 'KSampler',
      inputs: {
        seed: seed ?? Math.floor(Math.random() * 1000000000),
        steps: steps ?? 20,
        cfg: cfg ?? 7,
        sampler_name: 'euler',
        scheduler: 'normal',
        denoise: 1,
        model: ['4', 0],
        positive: ['6', 0],
        negative: ['7', 0],
        latent_image: ['5', 0]
      }
    },
    '4': {
      class_type: 'CheckpointLoaderSimple',
      inputs: {
        ckpt_name: 'majicMIX realistic 麦橘写实_v7.safetensors'
      }
    },
    '5': {
      class_type: 'EmptyLatentImage',
      inputs: {
        width: width ?? 1024,
        height: height ?? 768,
        batch_size: 1
      }
    },
    '6': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: prompt,
        clip: ['4', 1]
      }
    },
    '7': {
      class_type: 'CLIPTextEncode',
      inputs: {
        text: negative || 'text, watermark, signature, blurry, low quality, distorted, ugly, bad anatomy',
        clip: ['4', 1]
      }
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: {
        samples: ['3', 0],
        vae: ['4', 2]
      }
    },
    '9': {
      class_type: 'SaveImage',
      inputs: {
        filename_prefix: 'tdxh_ai',
        images: ['8', 0]
      }
    }
  };
}

// ===== 轮询等待生成完成 =====

async function waitForCompletion(promptId, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const history = await comfyRequest('GET', `/history/${promptId}`);
      if (history[promptId]) {
        const output = history[promptId].outputs;
        const images = output?.['9']?.images;
        if (images && images.length > 0) {
          const img = images[0];
          const imgData = await comfyGetBinary(`/view?filename=${img.filename}&subfolder=${img.subfolder}&type=${img.type}`);
          return {
            filename: img.filename,
            data: imgData.toString('base64'),
            mime: 'image/png',
            size: imgData.length
          };
        }
      }
    } catch (e) {
      // 还没完成，继续轮询
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('生成超时');
}

// ===== 服务静态文件 =====

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found: ' + filePath);
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(data);
  });
}

function serveAdminPage(res) {
  const adminHtml = path.join(ADMIN_DIR, 'index.html');
  serveFile(res, adminHtml);
}

// ===== 主服务器 =====

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // ============ API 路由 ============

  // GET /api/health
  if (pathname === '/api/health' && req.method === 'GET') {
    try {
      const stats = await comfyRequest('GET', '/system_stats');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        comfyui_version: stats.system?.comfyui_version,
        device: stats.devices?.[0]?.name,
        vram_total: stats.devices?.[0]?.vram_total,
        vram_free: stats.devices?.[0]?.vram_free
      }));
    } catch (e) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: 'ComfyUI 不可用: ' + e.message }));
    }
    return;
  }

  // POST /api/generate
  if (pathname === '/api/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body);
        let width = 1024, height = 768;
        if (params.size) {
          const parts = params.size.split('x');
          width = parseInt(parts[0]) || 1024;
          height = parseInt(parts[1]) || 768;
        }

        const workflow = buildWorkflow({
          prompt: params.prompt || params.text || '',
          negative: params.negative || '',
          width, height,
          steps: params.steps || 20,
          cfg: params.cfg || 7,
          seed: params.seed
        });

        const result = await comfyRequest('POST', '/prompt', JSON.stringify({ prompt: workflow }));

        if (!result.prompt_id) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ComfyUI 提交失败', detail: result }));
          return;
        }

        const image = await waitForCompletion(result.prompt_id);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true,
          prompt_id: result.prompt_id,
          image: {
            b64: image.data,
            mime: image.mime,
            filename: image.filename,
            size: image.size
          },
          url: `http://${COMFY_HOST}:${COMFY_PORT}/view?filename=${image.filename}&type=output`
        }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // ============ 静态文件路由 ============

  // /admin/ → 后台管理页面
  if (pathname === '/admin/' || pathname === '/admin') {
    serveAdminPage(res);
    return;
  }

  // /admin/* → admin 静态文件
  if (pathname.startsWith('/admin/')) {
    const relPath = pathname.slice('/admin/'.length);
    // 优先从 public/admin/ 找
    let filePath = path.join(ADMIN_DIR, relPath);
    if (fs.existsSync(filePath)) {
      serveFile(res, filePath);
      return;
    }
    // 再从 static/admin/ 找
    filePath = path.join(STATIC_DIR, 'admin', relPath);
    if (fs.existsSync(filePath)) {
      serveFile(res, filePath);
      return;
    }
    // 没找到就返回 admin 首页（SPA 兼容）
    serveAdminPage(res);
    return;
  }

  // /images/* → 图片
  if (pathname.startsWith('/images/')) {
    const relPath = pathname.slice('/images/'.length);
    let filePath = path.join(IMAGES_DIR, relPath);
    if (fs.existsSync(filePath)) {
      serveFile(res, filePath);
      return;
    }
    // 也试试 static/images/
    filePath = path.join(STATIC_DIR, 'images', relPath);
    if (fs.existsSync(filePath)) {
      serveFile(res, filePath);
      return;
    }
    // 也试试根目录的图片
    filePath = path.join(__dirname, relPath);
    if (fs.existsSync(filePath)) {
      serveFile(res, filePath);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 图片未找到');
    return;
  }

  // 根路径 → 重定向到 /admin/
  if (pathname === '/') {
    res.writeHead(302, { 'Location': '/admin/' });
    res.end();
    return;
  }

  // 其他路径 → 404
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('404 未找到');
});

// ===== 启动 =====

server.listen(PORT, '127.0.0.1', () => {
  console.log(`
  ╔══════════════════════════════════════╗
  ║   天地鲟鳇 · 本地后台 + AI 生图      ║
  ╚══════════════════════════════════════╝

  🔗 后台管理:  http://127.0.0.1:${PORT}/admin/
  🤖 AI 生图:  内置（同源，无需额外配置）
  ⚡ ComfyUI:   http://127.0.0.1:${COMFY_PORT}

  提示：登录后台需要 GitHub Token
  `);
});
