#!/usr/bin/env python3
"""
AppNeta Webhook Payload Customizer — Local Server

Usage:
    python serve.py              # starts on port 8080
    python serve.py 3000         # starts on port 3000

No dependencies required beyond Python 3 standard library.
"""
import http.server
import sys
import os
import webbrowser
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Permissive CSP so fetch() to external webhook URLs works
        self.send_header("Content-Security-Policy",
                         "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; "
                         "connect-src *; "
                         "font-src * data:; "
                         "img-src * data: blob:;")
        super().end_headers()

    def log_message(self, format, *args):
        # Cleaner log output
        msg = format % args
        sys.stderr.write(f"  {msg}\n")


def open_browser():
    webbrowser.open(f"http://localhost:{PORT}")


if __name__ == "__main__":
    server = http.server.HTTPServer(("0.0.0.0", PORT), Handler)
    print(f"""
╔══════════════════════════════════════════════════════╗
║  AppNeta Webhook Payload Customizer                  ║
║                                                      ║
║  Running at: http://localhost:{PORT:<5}                  ║
║                                                      ║
║  Press Ctrl+C to stop                                ║
╚══════════════════════════════════════════════════════╝
""")
    # Open browser after a short delay
    threading.Timer(0.5, open_browser).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
        server.server_close()
