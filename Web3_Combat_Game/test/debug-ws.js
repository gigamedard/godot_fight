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
    p.on('websocket', f => {
        process.stdout.write('WS-OPEN\n');
        f.on('framereceived', x => process.stdout.write('WSR: ' + String(x.payload).slice(0, 150) + '\n'));
        f.on('framesent', x => process.stdout.write('WSS: ' + String(x.payload).slice(0, 150) + '\n'));
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
    await sleep(7000);
    await b.close();
})().catch(e => { console.error('FAIL', e.message); });