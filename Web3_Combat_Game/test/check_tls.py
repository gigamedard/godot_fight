import socket, ssl, sys
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
s = ctx.wrap_socket(socket.create_connection(('localhost', 8445), timeout=5), server_hostname='localhost')
print('TLS OK')
key = 'dGhlIHNhbXBsZSBub25jZQ=='
req = 'GET /app/web3combat?protocol=7&client=js&version=8.4.0&flash=false HTTP/1.1\r\nHost: x\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ' + key + '\r\nSec-WebSocket-Version: 13\r\n\r\n'
s.sendall(req.encode())
print('requête envoyée, lecture réponse...')
s.settimeout(6)
try:
    data = s.recv(300)
    print('réponse:', data.decode(errors='replace').split('\r\n')[0])
except Exception as e:
    print('ERREUR recv:', type(e).__name__, e)