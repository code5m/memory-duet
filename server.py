"""Memory Duet responsive preview server."""
import json
import mimetypes
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlsplit
from urllib.request import Request, urlopen

ROOT = (Path(__file__).parent / "web").resolve()
PORT = int(os.getenv("MEMORY_DUET_PORT", "8765"))


class Handler(BaseHTTPRequestHandler):
    def headers(self, status, data, mime):
        self.send_response(status)
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.end_headers()
        self.wfile.write(data)

    def api(self, status, obj):
        self.headers(status, json.dumps(obj, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8")

    def do_GET(self):
        path = unquote(urlsplit(self.path).path)
        if path == "/api/config":
            self.api(200, {"image_provider_configured": bool(os.getenv("RIRIXIN_API_KEY") and os.getenv("RIRIXIN_IMAGE_ENDPOINT"))})
            return
        if "\x00" in path or "\\" in path:
            self.send_error(400)
            return
        target = (ROOT / path.lstrip("/") if path != "/" else ROOT / "index.html").resolve()
        if not target.is_relative_to(ROOT) or not target.is_file():
            self.send_error(404)
            return
        mime = mimetypes.guess_type(target.name)[0] or "application/octet-stream"
        if target.suffix == ".js":
            mime = "application/javascript"
        self.headers(200, target.read_bytes(), mime + ("; charset=utf-8" if target.suffix in {".html", ".css", ".js", ".json", ".webmanifest"} else ""))

    def do_POST(self):
        if urlsplit(self.path).path != "/api/generate-image":
            self.send_error(404)
            return
        key = os.getenv("RIRIXIN_API_KEY")
        endpoint = os.getenv("RIRIXIN_IMAGE_ENDPOINT")
        if not key or not endpoint:
            self.api(503, {"ok": False, "error": "日日新服务未配置"})
            return
        endpoint_url = urlsplit(endpoint)
        if endpoint_url.scheme != "https" or not endpoint_url.hostname or endpoint_url.username:
            self.api(503, {"ok": False, "error": "图片服务地址必须是可信 HTTPS 地址"})
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size <= 0 or size > 300000:
                self.api(413, {"ok": False, "error": "请求大小不合法"})
                return
            payload = json.loads(self.rfile.read(size))
            if not isinstance(payload, dict):
                raise ValueError("JSON object required")
            request = Request(endpoint, data=json.dumps(payload).encode(), headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"}, method="POST")
            with urlopen(request, timeout=90) as response:
                result = response.read(300001)
            if len(result) > 300000:
                raise ValueError("upstream oversized")
            self.api(200, {"ok": True, "provider_response": json.loads(result)})
        except Exception as error:
            self.api(502, {"ok": False, "error": "图片服务调用失败：" + error.__class__.__name__})


if __name__ == "__main__":
    print(f"Memory Duet: http://127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
