#!/usr/bin/env python3
"""
Need4Space Static Server + Scoreboard API + Screenshot Receiver
Usage: python serve.py [port]
"""
import http.server
import json
import os
import sys
import urllib.parse
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from scoreboard import ScoreStore

PORT = 8765
if len(sys.argv) > 1:
    try:
        PORT = int(sys.argv[1])
    except ValueError:
        pass

MIME_TYPES = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".glb": "model/gltf-binary",
    ".gltf": "model/gltf+json",
    ".bin": "application/octet-stream",
    ".ogg": "audio/ogg",
    ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg",
}

class Need4SpaceServer(ThreadingHTTPServer):
    request_queue_size = 128

class Need4SpaceHandler(SimpleHTTPRequestHandler):
    score_store = ScoreStore()

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        if ext in MIME_TYPES:
            return MIME_TYPES[ext]
        return super().guess_type(path)

    def end_headers(self):
        # Force no-cache for instant hot updates and module changes
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/scoreboard":
            params = urllib.parse.parse_qs(parsed.query)
            circuit = params.get("map", ["space"])[0]
            difficulty = params.get("difficulty", ["normal"])[0]
            name = params.get("name", [None])[0]

            result = self.score_store.read(circuit, difficulty, name)
            response_body = json.dumps(result).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)
            return

        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        # Endpoint: POST /shot/<name>
        if parsed.path.startswith("/shot/"):
            name = parsed.path[len("/shot/"):].strip() or "test"
            name = "".join(c for c in name if c.isalnum() or c in ("-", "_"))
            length = int(self.headers.get("Content-Length", 0))
            if length > 25 * 1024 * 1024:  # 25 MB max
                self.send_response(413)
                self.end_headers()
                return
            body = self.rfile.read(length)
            os.makedirs(".local", exist_ok=True)
            shot_path = os.path.join(".local", f"shot_{name}.png")
            with open(shot_path, "wb") as f:
                f.write(body)
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"saved": shot_path}).encode("utf-8"))
            return

        # Endpoint: POST /api/scoreboard
        if parsed.path == "/api/scoreboard":
            length = int(self.headers.get("Content-Length", 0))
            if length > 4096:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Payload too large"}).encode("utf-8"))
                return

            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode("utf-8"))
            except Exception:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({"error": "Malformed JSON"}).encode("utf-8"))
                return

            result = self.score_store.submit(data)
            status = 200 if result.get("success") else 400
            response_body = json.dumps(result).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(response_body)))
            self.end_headers()
            self.wfile.write(response_body)
            return

        self.send_response(404)
        self.end_headers()

if __name__ == "__main__":
    server_address = ("", PORT)
    httpd = Need4SpaceServer(server_address, Need4SpaceHandler)
    print(f"Need4Space server running on http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server.")
        httpd.server_close()
