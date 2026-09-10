/**
 * Diagnostic : le backend push vers Reverb 127.0.0.1:8081 → mais Reverb tourne
 * dans le MÊME conteneur ? Vérifions qui héberge Reverb (port 8081) et si le
 * broadcast event atteint bien Reverb. Le pusher retourne OK (2xx) pour
 * Broadcast::event mais l'event ChallengeSent ne passe pas par ShouldBroadcastNow
 * en CLI ? Testons avec ShouldBroadcastNow + vérif listener :
 */
const WebSocket = require('ws');

(async () => {
    const ws = new WebSocket('ws://localhost:8081/app/web3combat?protocol=7&client=js&version=8.4.0&flash=false');
    let subscribed = false;
    let gotEvent = false;

    ws.on('message', async (d) => {
        const s = d.toString();
        if (s.includes('connection_established') && !subscribed) {
            const data = JSON.parse(JSON.parse(s).data);
            const socketId = data.socket_id;
            const authRes = await fetch('http://localhost:8000/api/broadcasting/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Wallet-Address': '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' },
                body: JSON.stringify({ socket_id: socketId, channel_name: 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc' })
            });
            const authData = await authRes.json();
            ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: authData.auth, channel: 'private-player.0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc' } }));
            subscribed = true;
            console.log('[WS] souscrit (private) + dispatch dans 1s');
            setTimeout(() => {
                try {
                    const out = require('child_process').execSync(
                        'docker exec web3_combat_api php /tmp/dispatch-test2.php',
                        { timeout: 20000 }
                    );
                    console.log('[dispatch]', out.toString().trim());
                } catch (e) { console.log('[DISPATCH ERR]', (e.stdout||'').toString().slice(0,200), e.message.slice(0,100)); }
            }, 1200);
        } else if (s.includes('subscription_succeeded')) {
            console.log('[WS] subscription_succeeded ✓');
        } else if (s.includes('challenge') || s.includes('ChallengeSent') || s.includes('Test')) {
            gotEvent = true;
            console.log('🎉 EVENT REÇU :', s.slice(0, 250));
        } else if (!s.includes('pong')) {
            console.log('[WS]', s.slice(0, 120));
        }
    });

    ws.on('error', e => { console.log('WS ERR:', e.message); process.exit(1); });
    setTimeout(() => {
        console.log(gotEvent ? '✅ event reçu' : '❌ event non reçu');
        process.exit(gotEvent ? 0 : 1);
    }, 11000);
})();