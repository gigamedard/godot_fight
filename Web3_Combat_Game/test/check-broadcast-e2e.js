/**
 * Test broadcast end-to-end : listener WS + dispatch event backend.
 * 1. Listener ws sur presence-lobby + private-player.B (auth dynamique)
 * 2. Dispatch ChallengeSent via un processus docker exec séparé
 * 3. Vérifier la réception
 */
const WebSocket = require('ws');

(async () => {
    const ws = new WebSocket('ws://localhost:8081/app/web3combat?protocol=7&client=js&version=8.4.0&flash=false');
    let gotEvent = false;

    ws.on('message', async (d) => {
        const s = d.toString();
        if (s.includes('connection_established')) {
            const data = JSON.parse(JSON.parse(s).data);
            const socketId = data.socket_id;
            console.log('[WS] socket_id:', socketId);
            const authRes = await fetch('http://localhost:8000/api/broadcasting/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Wallet-Address': '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
                body: JSON.stringify({ socket_id: socketId, channel_name: 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc' })
            });
            console.log('[AUTH] HTTP', authRes.status);
            const authData = await authRes.json();
            if (!authData.auth) { console.log('[AUTH] signature manquante !', JSON.stringify(authData).slice(0,150)); process.exit(1); }
            ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: authData.auth, channel: 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc' } }));
            console.log('[WS] souscrit — dispatch de l\'event dans 1s...');
            setTimeout(() => {
                const { execSync } = require('child_process');
                try {
                    const out = require('child_process').execSync(
                        'docker exec web3_combat_api php /tmp/dispatch-test.php',
                        { timeout: 20000 }
                    );
                    console.log('[dispatch]', out.toString().trim());
                } catch (e) { console.log('[DISPATCH ERR]', e.message.slice(0, 150)); }
            }, 1000);
        } else if (s.includes('challenge') || s.includes('ChallengeSent')) {
            gotEvent = true;
            console.log('🎉 EVENT ChallengeSent REÇU PAR LE LISTENER :', s.slice(0, 220));
        } else if (!s.includes('pong')) {
            console.log('[WS] MSG:', s.slice(0, 140));
        }
    });

    ws.on('error', e => { console.log('WS ERR:', e.message); process.exit(1); });

    setTimeout(() => {
        console.log(gotEvent ? '✅ BROADCAST OK — event reçu' : '❌ Event NON reçu en 10s');
        process.exit(gotEvent ? 0 : 1);
    }, 9000);
})();