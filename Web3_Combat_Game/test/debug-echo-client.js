/**
 * Debug Echo client : traçe les frames WebSocket + console REVERB.
 * Usage : node test/debug-echo-client.js
 */
const puppeteer = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
    const browser = await puppeteer.launch({
        headless: 'shell',
        executablePath: 'C:\\Users\\GWX1223153\\.cache\\puppeteer\\chrome-headless-shell\\win64-149.0.7827.22\\chrome-headless-shell-win64\\chrome-headless-shell.exe',
        protocolTimeout: 120000,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    page.on('console', m => {
        const t = m.text();
        if (/REVERB|privat|error|403|echo/i.test(t)) console.log('CONSOLE:', t.slice(0, 180));
    });
    page.on('websocket', frame => {
        frame.on('framereceived', f => {
            const p = String(f.payload || '');
            if (!p.includes('"pong"')) console.log('WS recv:', p.slice(0, 180));
        });
        frame.on('framesent', f => {
            const p = String(f.payload || '');
            if (!p.includes('"pusher:ping"') && !p.includes('pong')) console.log('WS sent:', p.slice(0, 160));
        });
    });
    await page.goto('http://localhost:8080/?player=2', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await sleep(3500);
    await page.evaluate(() => { document.querySelector('.lang-card').click(); });
    await sleep(600);
    await page.evaluate(() => document.querySelector('#screen-connect .btn-cyber').click());
    await sleep(1500);
    await page.evaluate(() => window.selectGameMode('DUEL'));
    await sleep(400);
    await page.evaluate(() => { const c = document.getElementById('char-1'); if (c) c.click(); });
    await sleep(300);
    await page.evaluate(() => window.confirmCharacterSelection());
    await sleep(8000);
    await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });