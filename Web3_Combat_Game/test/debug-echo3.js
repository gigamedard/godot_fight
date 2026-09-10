/**
 * Debug Echo v3 : le canal privé Echo est 'private-private-player.<CHECKSUM>'
 * → le front souscrit au canal "private-" + wallet CHECKSUM, alors que le
 * backend publie maintenant sur player.<lowercase>. On teste :
 * 1) le nom de canal utilisé par le front (AppState.walletAddress = checksum)
 * 2) un dispatch avec listener sur ce canal exact côté Node
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
    p.on('console', m => { const t = m.text(); if (/REVERB|Défi|challenge|privat/i.test(t)) process.stdout.write('C: ' + t.slice(0, 160) + '\n'); });
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
    await sleep(6000);

    // Souscrire EXACTEMENT au canal lowercase (ce que le backend publie)
    const result = await p.evaluate(() => {
        return new Promise((resolve) => {
            const wallet = localStorage.getItem('web3combat_wallet').toLowerCase();
            window.__evt = null;
            window.echoInstance.private('private-player.' + wallet)
                .listen('ChallengeSent', (e) => {
                    window.__evt = { got: true, e: e ? { challengerId: e.challengerId, betAmount: e.betAmount } : null };
                    resolve(window.__evt);
                });
            setTimeout(() => resolve({ got: false, timeout: true, wallet }), 8000);
        });
    });
    process.stdout.write('listener posé sur ' + result.wallet + '\n');

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
    process.stdout.write('dispatch envoyé\n');
    await sleep(9000);
    process.stdout.write('Résultat : ' + JSON.stringify(await p.evaluate(() => window.__evt)) + '\n');
    await b.close();
})().catch(e => { console.error('FAIL', e.message); });