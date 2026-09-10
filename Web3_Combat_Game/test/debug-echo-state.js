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
    p.on('console', m => {
        const t = m.text();
        if (/REVERB|Défi|challenge|Match|erreur|error/i.test(t)) process.stdout.write('C: ' + t.slice(0, 180) + '\n');
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
    await sleep(6000);

    // État Echo : canaux souscrits
    const echoState = await p.evaluate(() => {
        if (!window.echoInstance) return { echo: false };
        const connector = window.echoInstance.connector;
        const channels = connector && connector.channels ? Object.keys(connector.channels) : [];
        // presence channel info
        let presenceInfo = null;
        try {
            const ch = connector.channels['presence-lobby'];
            presenceInfo = ch ? { subscribed: ch.subscribed } : 'absent';
        } catch (e) { presenceInfo = 'err ' + e.message; }
        return { echo: true, channels, presenceInfo, wallet: localStorage.getItem('web3combat_wallet') };
    });
    process.stdout.write('ECHO STATE: ' + JSON.stringify(echoState) + '\n');

    // Le canal privé est-il souscrit ? Testons l'abonnement manuel + un dispatch API
    await p.evaluate(() => {
        window.__challengeReceived = false;
        // réécouter ChallengeSent à notre manière pour le test
        window.echoInstance.private('private-player.' + localStorage.getItem('web3combat_wallet').toLowerCase())
            .listen('ChallengeSent', (e) => { window.__challengeReceived = e; process.stdout && console.log('TEST-LISTENER: ChallengeSent reçu'); });
    });
    process.stdout.write('Listener test posé. Dispatch API...\n');

    // dispatch d'un défi vers B via l'API
    const dispatch = await fetch('http://localhost:8000/api/matchmaking/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({
            challenger_id: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
            target_id: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
            bet_amount: '5',
            challenger_char: 1
        })
    });
    process.stdout.write('dispatch challenge → HTTP ' + dispatch.status + '\n');
    await sleep(5000);

    const received = await p.evaluate(() => window.__challengeReceived);
    process.stdout.write('ChallengeSent reçu dans la page : ' + received + '\n');
    await b.close();
})().catch(e => { console.error('FAIL', e.message); });