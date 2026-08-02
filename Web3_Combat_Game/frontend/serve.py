import http.server
import mimetypes
import os
import socketserver

WEB_ROOT = "/srv/www"
PORT = 8080

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/html", ".html")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


class ThreadedServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True


if __name__ == "__main__":
    os.chdir(WEB_ROOT)
    with ThreadedServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
        print(f"Serving {WEB_ROOT} on http://0.0.0.0:{PORT}")
        httpd.serve_forever()
