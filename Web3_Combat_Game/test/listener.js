/**
 * Listener persistant — affiche tout ce qui arrive sur private-player.B
 * pendant 15s. À lancer en arrière-plan pendant un dispatch backend.
 */
const WebSocket = require('ws');

(async () => {
    const ws = new WebSocket('ws://localhost:8081/app/web3combat?protocol=7&client=js&version=8.4.0&flash=false');
    ws.on('message', async (d) => {
        const s = d.toString();
        if (s.includes('connection_established')) {
            const data = JSON.parse(JSON.parse(s).data);
            const authRes = await fetch('http://localhost:8000/api/broadcasting/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Wallet-Address': '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
                body: JSON.stringify({ socket_id: data.socket_id, channel_name: 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc' })
            });
            const authData = await authRes.json();
            ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: authData.auth, channel: 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc' } }));
            console.log('[listener] souscrit private-player.B');
        } else {
            console.log('[listener] REÇU:', s.slice(0, 250));
        }
    });
    ws.on('error', e => console.log('WS ERR:', e.message));
    setTimeout(() => { console.log('[listener] fin'); process.exit(0); }, 15000);
})();