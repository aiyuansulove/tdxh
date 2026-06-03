#!/usr/bin/env python3
"""
天地鲟鳇 · 本地保存服务
运行: python save-server.py
  POST /save          保存 JSON 到 data/homepage/ 和 static/data/homepage/
  POST /upload-image  保存图片到 static/images/
"""

import json, os, sys, base64, re
from http.server import HTTPServer, BaseHTTPRequestHandler

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA_HOMEPAGE = os.path.join(ROOT, 'data', 'homepage')
STATIC_HOMEPAGE = os.path.join(ROOT, 'static', 'data', 'homepage')
STATIC_IMAGES = os.path.join(ROOT, 'static', 'images')

class SaveHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        length = int(self.headers.get('Content-Length', 0))
        raw = self.rfile.read(length)
        path = self.path.rstrip('/')
        try:
            if path == '/upload-image':
                self._handle_upload_image(raw)
            elif path == '/save':
                self._handle_save(raw)
            else:
                self._send(404, {'error': '未知路径: ' + path})
        except Exception as e:
            self._send(500, {'error': str(e)})

    def _handle_save(self, raw):
        text = raw.decode('utf-8')
        body = json.loads(text)
        filename = body.get('file', '')
        content = body.get('content', '')
        if not filename or not content:
            self._send(400, {'error': '缺少 file 或 content'})
            return
        wrote = []
        for d in [DATA_HOMEPAGE, STATIC_HOMEPAGE]:
            os.makedirs(d, exist_ok=True)
            p = os.path.join(d, filename)
            with open(p, 'w', encoding='utf-8') as f:
                f.write(content)
                f.flush()
                os.fsync(f.fileno())
            wrote.append(p)
        self._send(200, {'ok': True, 'wrote': wrote})

    def _handle_upload_image(self, raw):
        text = raw.decode('utf-8')
        body = json.loads(text)
        filename = body.get('filename', '')
        base64_data = body.get('data', '')
        if not filename or not base64_data:
            self._send(400, {'error': '缺少 filename 或 data'})
            return
        # sanitize filename
        filename = re.sub(r'[^\w\.\-]', '_', filename)
        os.makedirs(STATIC_IMAGES, exist_ok=True)
        filepath = os.path.join(STATIC_IMAGES, filename)
        try:
            img_bytes = base64.b64decode(base64_data)
        except Exception:
            self._send(400, {'error': 'base64 数据无效'})
            return
        with open(filepath, 'wb') as f:
            f.write(img_bytes)
            f.flush()
            os.fsync(f.fileno())
        self._send(200, {'ok': True, 'path': filepath, 'url': '/images/' + filename})

    def _send(self, code, data):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def log_message(self, fmt, *args):
        if args[0] != '200':
            super().log_message(fmt, *args)

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 1320
    server = HTTPServer(('127.0.0.1', port), SaveHandler)
    print(f'[save-server] http://127.0.0.1:{port}')
    print(f'  保存 JSON → data/homepage/ + static/data/homepage/')
    print(f'  上传图片 → static/images/')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\n已停止')
        server.server_close()
