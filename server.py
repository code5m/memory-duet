import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).parent
PORT = int(os.getenv("MEMORY_DUET_PORT", "8765"))


class Handler(BaseHTTPRequestHandler):
    def _json(self, status, payload):
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path == "/api/config":
            self._json(200, {"image_provider_configured": bool(os.getenv("RIRIXIN_API_KEY"))})
            return
        if self.path in ("/", "/index.html"):
            data = (ROOT / "index.html").read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return
        self.send_error(404)

    def do_POST(self):
        if self.path != "/api/generate-image":
            self.send_error(404)
            return
        key = os.getenv("RIRIXIN_API_KEY")
        endpoint = os.getenv("RIRIXIN_IMAGE_ENDPOINT")
        if not key or not endpoint:
            self._json(503, {"ok": False, "error": "日日新服务尚未配置，请设置 RIRIXIN_API_KEY 和 RIRIXIN_IMAGE_ENDPOINT"})
            return
        length = int(self.headers.get("Content-Length", "0"))
        payload = json.loads(self.rfile.read(length))
        request = Request(endpoint, data=json.dumps(payload).encode(), method="POST")
        request.add_header("Authorization", f"Bearer {key}")
        request.add_header("Content-Type", "application/json")
        try:
            with urlopen(request, timeout=90) as response:
                body = response.read()
            self._json(200, {"ok": True, "provider_response": json.loads(body)})
        except Exception as exc:
            self._json(502, {"ok": False, "error": f"日日新调用失败：{exc.__class__.__name__}"})


if __name__ == "__main__":
    print(f"Memory Duet local prototype: http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
