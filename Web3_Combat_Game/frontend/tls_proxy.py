"""
Démarrage HTTPS unifié — génération du certificat auto-signé partagé puis :
  1. front https://0.0.0.0:8443 (serve.py : pages du jeu)
  2. RPC https://0.0.0.0:8444 (tls_proxy.py : relay vers blockchain:8545)

Le SAN inclut les IP de test connues ; régénérer le conteneur (down/up) met
à jour le SAN si les IP changent.
"""
import http.server
import os
import socketserver
import ssl
import subprocess

# Les certificats sont cherchés dans /srv/www/certs (= ./frontend/certs monté
# ro). Si un vrai certificat y est placé (ex: tailscale cert — Let's Encrypt
# pour <machine>.ts.net, accepté nativement par MetaMask iOS), il est utilisé
# tel quel ; sinon un auto-signé est généré (fallback dev local).
CERT_DIR = "/srv/www/certs"
CERT_FILE = os.path.join(CERT_DIR, "cert.pem")
KEY_FILE = os.path.join(CERT_DIR, "key.pem")
UPSTREAM_RPC = "http://blockchain:8545"
UPSTREAM_API = "http://api:8000"  # l'API Laravel interne du réseau docker
UPSTREAM_REVERB = ("web3_combat_api", 8081)  # WebSocket Reverb (wss → ws) — container_name
RPC_TLS_PORT = 8444
WS_TLS_PORT = 8445


def generate_self_signed_cert():
    os.makedirs(CERT_DIR, exist_ok=True)
    if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
        return
    try:
        # SAN générique : localhost + sous-réseau privé courant (192.168.x / 10.x
        # ne peuvent pas être tous listés — le navigateur demandera une
        # confirmation d'exception, acceptable en dev local).
        subprocess.run([
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", KEY_FILE, "-out", CERT_FILE,
            "-days", "3650",
            "-subj", "/CN=web3combat-local",
        ], check=True, capture_output=True)
        print("[tls] certificat auto-signé généré (CN=web3combat-local)", flush=True)
    except Exception as e:
        print(f"[tls_proxy] génération certificat échouée : {e}", flush=True)


class RpcProxyHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    # Headers hop-by-hop à ne JAMAIS retransmettre à l'upstream.
    # (accept-encoding exclu : urllib ne décompresse pas — on demande l'identité)
    HOP_BY_HOP = {
        "host", "connection", "content-length", "transfer-encoding",
        "keep-alive", "upgrade", "accept-encoding", "proxy-authorization",
    }

    def _cors_headers(self, preflight: bool):
        # Echo de l'Origin (évite le mode credentials interdit avec '*')
        origin = self.headers.get("Origin")
        self.send_header("Access-Control-Allow-Origin", origin or "*")
        self.send_header("Vary", "Origin")
        if preflight:
            # Echo EXPLICITE des headers demandés par le preflight
            # (x-player-name, authorization, etc.) — '*' ne suffit pas si le
            # navigateur est strict, et le echo couvre tous les cas.
            requested = self.headers.get("Access-Control-Request-Headers")
            self.send_header("Access-Control-Allow-Headers", requested or "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
            self.send_header("Access-Control-Max-Age", "600")

    def _relay(self):
        import urllib.request
        import urllib.error
        length = int(self.headers.get("Content-Length", 0) or 0)
        body = self.rfile.read(length) if length else None
        # Routage : /rpc-proxy/* → nœud Hardhat ; /api-proxy/* → API Laravel.
        # Le front https appelle tout par le même origin (pas de mixed content).
        path = self.path
        if path.startswith("/api-proxy"):
            upstream_url = UPSTREAM_API + path[len("/api-proxy"):]
        else:
            # /rpc-proxy/* ou / : nœud RPC
            path = path[len("/rpc-proxy"):] if path.startswith("/rpc-proxy") else path
            upstream_url = UPSTREAM_RPC + (path or "/")
        req = urllib.request.Request(upstream_url, data=body, method=self.command)
        # Transmission de TOUS les headers utiles (x-player-name, authorization,
        # content-type… sauf hop-by-hop) — l'API Laravel a besoin des headers
        # custom du front (lobby, auth broadcasting).
        for h, v in self.headers.items():
            if h.lower() not in self.HOP_BY_HOP:
                req.add_header(h, v)
        try:
            with urllib.request.urlopen(req, timeout=30) as upstream:
                payload = upstream.read()
                self.send_response(upstream.status)
                self.send_header("Content-Type", upstream.headers.get("Content-Type", "application/json"))
                self._cors_headers(preflight=False)
                self.send_header("Connection", "close")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as e:
            payload = e.read()
            self.send_response(e.code)
            self.send_header("Content-Type", e.headers.get("Content-Type", "application/json") if e.headers else "application/json")
            self._cors_headers(preflight=False)
            self.send_header("Connection", "close")
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as e:
            msg = ('{"jsonrpc":"2.0","error":{"code":-32000,"message":"proxy error: %s"}}' % str(e)).encode()
            self.send_response(502)
            self.send_header("Content-Type", "application/json")
            self._cors_headers(preflight=False)
            self.send_header("Content-Length", str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def do_POST(self):
        self._relay()

    def do_GET(self):
        self._relay()

    def do_OPTIONS(self):
        # Préflight CORS : réponse LOCALE au proxy (l'upstream ne voit jamais
        # les OPTIONS). Echo de l'Origin + des headers demandés — indispensable
        # pour les headers custom du front (x-player-name…).
        self.send_response(204)
        self._cors_headers(preflight=True)
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, fmt, *args):
        pass  # silencieux (polling RPC très verbeux)


class ThreadedServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def start_rpc_tls():
    generate_self_signed_cert()
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    ctx.load_cert_chain(CERT_FILE, KEY_FILE)
    server = ThreadedServer(("0.0.0.0", RPC_TLS_PORT), RpcProxyHandler)
    server.socket = ctx.wrap_socket(server.socket, server_side=True)
    print(f"[tls_proxy] https://0.0.0.0:{RPC_TLS_PORT} → {UPSTREAM_RPC} | /api-proxy → {UPSTREAM_API}", flush=True)
    import threading
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()

    # WebSocket wss://8445 → ws reverb:8081 (relais TCP brut après handshake TLS)
    def ws_relay():
        import socket
        def handle(client):
            upstream = None
            try:
                upstream = socket.create_connection(UPSTREAM_REVERB, timeout=10)
                # Relais bidirectionnel bloquant : 1 thread par direction.
                def pipe(src, dst):
                    try:
                        while True:
                            data = src.recv(65536)
                            if not data:
                                break
                            dst.sendall(data)
                    except Exception:
                        pass
                    finally:
                        try: src.close()
                        except Exception: pass
                        try: dst.close()
                        except Exception: pass
                import threading
                t1 = threading.Thread(target=pipe, args=(client, upstream), daemon=True)
                t2 = threading.Thread(target=pipe, args=(upstream, client), daemon=True)
                t1.start(); t2.start()
                t1.join(); t2.join()
            except Exception:
                pass
            finally:
                try: client.close()
                except Exception: pass
                if upstream:
                    try: upstream.close()
                    except Exception: pass

        # Serveur TCP raw : handshake TLS DANS le thread du client (le wrap
        # socket-level sur TCPServer.accept() pose des soucis de handshake
        # bloquant avec les clients Node/undici — on fait le TLS à la main).
        ctx_client = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx_client.load_cert_chain(CERT_FILE, KEY_FILE)
        print(f"[tls_proxy] wss://0.0.0.0:{WS_TLS_PORT} → ws://{UPSTREAM_REVERB[0]}:{UPSTREAM_REVERB[1]}", flush=True)
        server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server_sock.bind(("0.0.0.0", WS_TLS_PORT))
        server_sock.listen(50)
        while True:
            client, addr = server_sock.accept()
            print(f"[wss] connexion de {addr}", flush=True)
            try:
                client = ctx_client.wrap_socket(client, server_side=True)
                print(f"[wss] handshake TLS OK {addr}", flush=True)
            except Exception as e:
                print(f"[wss] handshake TLS FAIL {addr}: {e}", flush=True)
                try: client.close()
                except Exception: pass
                continue
            t2 = threading.Thread(target=handle, args=(client,), daemon=True)
            t2.start()

    ws_thread = threading.Thread(target=ws_relay, daemon=True)
    ws_thread.start()