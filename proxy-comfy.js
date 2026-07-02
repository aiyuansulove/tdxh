/**
 * 天地鲟鳇 · ComfyUI 代理服务器
 * 
 * 在后台 AI 生图和本地 ComfyUI 之间做桥梁
 * 
 * 启动: node proxy-comfy.js
 * 访问: http://localhost:3457
 * 
 * API:
 *   POST /generate  { prompt, negative, width, height, steps, cfg }
 *   GET  /health
 */

const http = require('http');
const https = require('https');

const PORT = 3457;
const COMFY_HOST = '127.0.0.1';
const COMFY_PORT = 8188;

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
          // 获取图片二进制
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

// ===== HTTP 代理服务器 =====

const server = http.createServer(async (req, res) => {
  // CORS 头 - 允许来自所有来源（admin 页面可能在 tdxh01.xyz 或本地）
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  // GET /health
  if (url.pathname === '/health' && req.method === 'GET') {
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

  // POST /generate
  if (url.pathname === '/generate' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const params = JSON.parse(body);

        // 解析尺寸
        let width = 1024, height = 768;
        if (params.size) {
          const parts = params.size.split('x');
          width = parseInt(parts[0]) || 1024;
          height = parseInt(parts[1]) || 768;
        }

        // 构建 workflow
        const workflow = buildWorkflow({
          prompt: params.prompt || params.text || '',
          negative: params.negative || '',
          width,
          height,
          steps: params.steps || 20,
          cfg: params.cfg || 7,
          seed: params.seed
        });

        // 提交到 ComfyUI
        const result = await comfyRequest('POST', '/prompt', JSON.stringify({ prompt: workflow }));

        if (!result.prompt_id) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'ComfyUI 提交失败', detail: result }));
          return;
        }

        // 等待生成
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

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n  🎨 天地鲟鳇 · ComfyUI 代理服务器`);
  console.log(`  ─────────────────────────────────`);
  console.log(`  ✅ 代理运行于 http://127.0.0.1:${PORT}`);
  console.log(`  🔗 ComfyUI     http://127.0.0.1:${COMFY_PORT}`);
  console.log(`  📍 POST /generate  — 文生图`);
  console.log(`  📍 GET  /health    — 健康检查`);
  console.log(`\n  管理员请修改 admin.js 中 AI 配置指向此代理\n`);
});
