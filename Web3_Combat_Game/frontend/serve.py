import http.server
import mimetypes
import os
import socketserver
import ssl

WEB_ROOT = "/srv/www"
PORT = 8080
TLS_PORT = 8443

mimetypes.add_type("application/wasm", ".wasm")
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/html", ".html")


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_ROOT, **kwargs)

    def end_headers(self):
        # Politique de cache différenciée (P1) : le HTML ne doit jamais être
        # mis en cache, les gros assets immuables (Godot) DOIVENT l'être — sinon
        # jeu.pck (107 Mo) + jeu.wasm (38 Mo) sont retéléchargés à chaque visite.
        path = self.path.split('?', 1)[0].lower()
        if path.endswith('.html') or path.endswith('/') or path == '':
            self.send_header("Cache-Control", "no-cache")
        elif path.endswith('.wasm') or path.endswith('.pck'):
            # Revalidation (304 si inchangé, re-téléchargement si modifié) : permet
            # de mettre à jour jeu.pck/wasm sans garder un cache éternel périmé.
            self.send_header("Cache-Control", "no-cache")
        else:
            # js/css/images/fonts : 1 jour (les js/css portent un cache-buster ?v=).
            self.send_header("Cache-Control", "public, max-age=86400")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()


class ThreadedServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


CERT_DIR = "/app/certs"
CERT_FILE = os.path.join(CERT_DIR, "cert.pem")
KEY_FILE = os.path.join(CERT_DIR, "key.pem")


def main():
    os.chdir(WEB_ROOT)

    # HTTPS + proxy RPC + wss : générer le certificat partagé, lancer le proxy
    # TLS (RPC 8444 + wss 8445) DANS ce process (un seul PID, pas de job
    # background qui meurt avec le shell du CMD).
    # Optionnel : derrière un reverse proxy (Caddy) le TLS est déjà terminé en
    # amont. Si le montage est en lecture seule (pas de certs), on continue en
    # HTTP simple plutôt que de crasher en boucle.
    try:
        from tls_proxy import generate_self_signed_cert, start_rpc_tls, CERT_FILE, KEY_FILE
        generate_self_signed_cert()
        start_rpc_tls()
    except Exception as e:
        print(f"[serve] proxy TLS/RPC désactivé ({e}) — HTTP simple uniquement", flush=True)

    # HTTP sur 8080 (toujours actif — utile PC localhost)
    with ThreadedServer(("0.0.0.0", PORT), NoCacheHandler) as httpd:
        print(f"Serving {WEB_ROOT} on http://0.0.0.0:{PORT}", flush=True)

        # HTTPS sur 8443 : MetaMask Mobile exige https pour les RPC non-localhost ;
        # une page servie en https doit aussi consommer des RPC https (mixed content
        # interdit). Le certificat est généré ci-dessus (CN=web3combat-local).
        if os.path.exists(CERT_FILE) and os.path.exists(KEY_FILE):
            try:
                ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
                ctx.load_cert_chain(CERT_FILE, KEY_FILE)
                https_server = ThreadedServer(("0.0.0.0", TLS_PORT), NoCacheHandler)
                https_server.socket = ctx.wrap_socket(https_server.socket, server_side=True)
                print(f"Serving {WEB_ROOT} on https://0.0.0.0:{TLS_PORT}", flush=True)
                import threading
                t = threading.Thread(target=https_server.serve_forever, daemon=True)
                t.start()
            except Exception as e:
                print(f"[serve] HTTPS désactivé : {e}", flush=True)
        else:
            print("[serve] certificat absent : HTTPS désactivé", flush=True)

        httpd.serve_forever()


if __name__ == "__main__":
    main()