/**
 * Debug Echo client v2 — toutes frames WS brutes.
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
    page.on('websocket', frame => {
        frame.on('framereceived', f => console.log('WSR:', String(f.payload).slice(0, 220)));
        frame.on('framesent', f => console.log('WSS:', String(f.payload).slice(0, 220)));
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
    await sleep(7000);
    await browser.close();
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });