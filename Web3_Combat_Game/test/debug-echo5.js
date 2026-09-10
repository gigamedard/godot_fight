/**
 * Debug Echo v5 : interception côté page via monkey-patch WebSocket.
 * On injecte un hook AVANT le chargement d'Echo pour capturer toutes les frames.
 */
const puppeteer = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
    const b = await puppeteer.launch({
        headless: 'shell',
        executablePath: 'C:\\Users\\GWX1223153\\.cache\\puppeteer\\chrome-headless-shell\\win64-149.0.7827.22\\chrome-headless-shell-win64\\chrome-headless-shell.exe',
        protocolTimeout: 120000,
        args: ['--no-sandbox']
    });
    const p = await b.newPage();
    await p.evaluateOnNewDocument(() => {
        window.__wsFrames = [];
        const OrigWS = window.WebSocket;
        window.WebSocket = function (url, protocols) {
            const ws = protocols ? new OrigWS(url, protocols) : new OrigWS(url);
            if (url && url.includes('8081')) {
                const origSend = ws.send.bind(ws);
                ws.send = (d) => { window.__wsFrames.push('SENT ' + String(d).slice(0, 250)); return origSend(d); };
                ws.addEventListener('message', (ev) => {
                    window.__wsFrames.push('RECV ' + String(ev.data).slice(0, 250));
                });
            }
            return ws;
        };
        window.WebSocket.prototype = OrigWS.prototype;
        Object.defineProperties(window.WebSocket, {
            OPEN: { value: OrigWS.OPEN }, CLOSED: { value: OrigWS.CLOSED },
            CONNECTING: { value: OrigWS.CONNECTING }, CLOSING: { value: OrigWS.CLOSED }
        });
    });
    await p.goto('http://localhost:8080/?player=2', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3500);
    await p.evaluate(() => { document.querySelector('.lang-card').click(); });
    await sleep(600);
    await p.evaluate(() => document.querySelector('#screen-connect .btn-cyber').click());
    await sleep(1500);
    await p.evaluate(() => window.selectGameMode('DUEL'));
    await sleep(400);
    await p.evaluate(() => { const c = document.getElementById('char-1'); if (c) c.click(); });
    await sleep(300);
    await p.evaluate(() => window.confirmCharacterSelection());
    await sleep(5000);
    await fetch('http://localhost:8000/api/matchmaking/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
            challenger_id: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            target_id: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
            bet_amount: '5',
            challenger_char: 1
        })
    });
    await sleep(6000);
    const frames = await p.evaluate(() => window.__wsFrames);
    process.stdout.write('--- FRAMES WS (page) ---\n');
    frames.forEach(f => process.stdout.write(f + '\n'));
    await b.close();
})().catch(e => { console.error('FAIL', e.message); });