/**
 * Debug dépôt : register direct depuis la page (provider MetaMask), timing tx.wait().
 * Usage : node test/debug-deposit.js
 */
const puppeteer = require('puppeteer');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
    const b = await puppeteer.launch({
        headless: 'shell',
        executablePath: 'C:\\Users\\GWX1223153\\.cache\\puppeteer\\chrome-headless-shell\\win64-149.0.7827.22\\chrome-headless-shell-win64\\chrome-headless-shell.exe',
        protocolTimeout: 180000,
        args: ['--no-sandbox']
    });
    const p = await b.newPage();
    await p.goto('http://localhost:8080/?player=1', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
    await p.evaluate(() => { document.querySelector('.lang-card').click(); });
    await sleep(500);
    await p.evaluate(() => document.querySelector('#screen-connect .btn-cyber').click());
    await sleep(1200);
    await p.evaluate(() => window.selectGameMode('DUEL'));
    await sleep(300);
    await p.evaluate(() => { document.getElementById('char-1').click(); });
    await sleep(200);
    await p.evaluate(() => window.confirmCharacterSelection());
    await sleep(5000);
    const res = await p.evaluate(async () => {
        const t0 = Date.now();
        try {
            const tx = await contract.register(ethers.parseEther('1'), { value: ethers.parseEther('1.025') });
            const rec = await tx.wait();
            return { ok: true, ms: Date.now() - t0, block: rec.blockNumber };
        } catch (e) { return { ok: false, err: String(e.shortMessage || e.message).slice(0, 120) }; }
    });
    process.stdout.write('register direct via page : ' + JSON.stringify(res) + '\n');
    await b.close();
})().catch(e => console.error('FAIL', e.message));