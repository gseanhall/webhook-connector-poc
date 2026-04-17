#!/usr/bin/env python3
"""
AppNeta Webhook Payload Customizer — Local Server

Usage:
    GEMINI_API_KEY=your-key python serve.py          # starts on port 8080
    GEMINI_API_KEY=your-key python serve.py 3000     # starts on port 3000

No dependencies required beyond Python 3 standard library.
"""
import http.server
import sys
import os
import json
import webbrowser
import threading
import ssl
import urllib.request
import urllib.error

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")
GEMINI_URL = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent"

# macOS Python often ships without usable root certs — skip verification for this local POC
SSL_CTX = ssl._create_unverified_context()


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        self.send_header("Content-Security-Policy",
                         "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; "
                         "connect-src *; "
                         "font-src * data:; "
                         "img-src * data: blob:;")
        super().end_headers()

    def log_message(self, format, *args):
        msg = format % args
        sys.stderr.write(f"  {msg}\n")

    def do_POST(self):
        if self.path == "/api/generate":
            self._handle_generate()
        else:
            self.send_error(404, "Not Found")

    def _handle_generate(self):
        if not GEMINI_API_KEY:
            self._send_json(500, {"error": "GEMINI_API_KEY environment variable is not set. Start the server with: GEMINI_API_KEY=your-key python serve.py"})
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length)) if length else {}
        except (json.JSONDecodeError, ValueError):
            self._send_json(400, {"error": "Invalid JSON in request body"})
            return

        system_prompt = body.get("system", "")
        user_message = body.get("userMessage", "")
        if not user_message:
            self._send_json(400, {"error": "Missing 'userMessage' in request body"})
            return

        gemini_body = {
            "system_instruction": {"parts": [{"text": system_prompt}]},
            "contents": [{"parts": [{"text": user_message}]}],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 8192,
            },
        }

        req = urllib.request.Request(
            f"{GEMINI_URL}?key={GEMINI_API_KEY}",
            data=json.dumps(gemini_body).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        try:
            with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as resp:
                gemini_data = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            error_body = e.read().decode("utf-8", errors="replace")
            try:
                err_json = json.loads(error_body)
                msg = err_json.get("error", {}).get("message", error_body)
            except json.JSONDecodeError:
                msg = error_body
            self._send_json(e.code, {"error": f"Gemini API error ({e.code}): {msg}"})
            return
        except urllib.error.URLError as e:
            self._send_json(502, {"error": f"Failed to reach Gemini API: {e.reason}"})
            return
        except Exception as e:
            self._send_json(500, {"error": f"Unexpected error: {str(e)}"})
            return

        try:
            candidates = gemini_data.get("candidates", [])
            if not candidates:
                block_reason = gemini_data.get("promptFeedback", {}).get("blockReason", "unknown")
                self._send_json(400, {"error": f"Gemini blocked the request: {block_reason}"})
                return
            parts = candidates[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts)
            if not text:
                self._send_json(500, {"error": "Empty response from Gemini"})
                return
            self._send_json(200, {"text": text})
        except (KeyError, IndexError, TypeError) as e:
            self._send_json(500, {"error": f"Failed to parse Gemini response: {str(e)}"})

    def _send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def open_browser():
    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    key_status = "SET" if GEMINI_API_KEY else "NOT SET — AI features will not work"
    server = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"""
╔══════════════════════════════════════════════════════╗
║  AppNeta Webhook Payload Customizer                  ║
║                                                      ║
║  Running at: http://localhost:{PORT:<5}                  ║
║  Gemini Model: {GEMINI_MODEL:<37}║
║  API Key: {key_status:<42}║
║                                                      ║
║  Press Ctrl+C to stop                                ║
╚══════════════════════════════════════════════════════╝
""")
    threading.Timer(0.5, open_browser).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()
