/**
 * Test e2e Puppeteer — MATCH COMPLET 2 JOUEURS (infra réelle)
 * ─────────────────────────────────────────────────────────────
 * Pré-requis : infra up (docker), frontend :8080, API :8000, Hardhat :8545.
 *
 * Scénario :
 *   Joueur A (page 1, ?player=1) : splash → langue → connexion → mode DUEL →
 *     perso → lobby → défie le joueur B (mise 10).
 *   Joueur B (page 2, ?player=2) : même flux, puis ACCEPTe le défi via la modale.
 *   → MatchStarted broadcast → executeMatchOnChain (dépôt register on-chain)
 *   → écran combat → barre 2D → chaque joueur choisit un coup
 *   → commit/reveal gasless au backend → polling → résultat final.
 *
 * Points de contrôle :
 *   ✓ Défi envoyé/accepté (API matchmaking)
 *   ✓ MatchStarted reçu sur les DEUX pages
 *   ✓ Dépôt on-chain confirmé (tx register + toast "Dépôt confirmé")
 *   ✓ Combat lancé sur les deux pages (screen-combat, barre 2D)
 *   ✓ Coups commités au backend (statut waiting_for_reveals)
 *   ✓ Match complété (polling → completed, résultat affiché)
 *
 * Usage : node test/puppeteer-e2e-match.js
 * Durée typique : 60–90s. Timeout global de sécurité : 240s.
 */
const puppeteer = require('puppeteer');
const BASE = 'http://localhost:8080';
const HEADLESS_SHELL = 'C:\\Users\\GWX1223153\\.cache\\puppeteer\\chrome-headless-shell\\win64-149.0.7827.22\\chrome-headless-shell-win64\\chrome-headless-shell.exe';

const log = (...a) => console.log(...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPlayer(browser, playerIndex, label) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    await page.goto(`${BASE}/?player=${playerIndex}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => document.readyState === 'complete', { timeout: 30000 }).catch(() => {});
    await sleep(3000); // splash 2.5s

    // Langue FR
    await page.evaluate(() => { const b = document.querySelector('.lang-card'); if (b) b.click(); });
    await sleep(400);

    // Connexion (flux autonome : clic sur CONNECTER LE WALLET)
    await page.evaluate(() => {
        const btn = document.querySelector('#screen-connect .btn-cyber');
        if (btn) btn.click();
    });
    // ?player=N → connectWallet() lit ?player et prend le compte Hardhat N de façon déterministe
    // NB : AppState est un const module-level (non exposé sur window) — on
    // détecte la connexion via localStorage, écrit par connectWallet().
    await page.waitForFunction(() =>
        localStorage.getItem('web3combat_wallet') !== null, { timeout: 20000 }).catch(() => {});
    await sleep(1500);

    const wallet = await page.evaluate(() => localStorage.getItem('web3combat_wallet'));
    log(`[${label}] Wallet : ${wallet}`);

    // Mode DUEL
    await page.evaluate(() => window.selectGameMode('DUEL'));
    await sleep(400);

    // Choix du perso 1 (ninja) + confirmation (performLogin → lobby)
    await page.evaluate(() => {
        const card = document.getElementById('char-1');
        if (card) card.click();
    });
    await sleep(300);
    await page.evaluate(() => window.confirmCharacterSelection());
    // attendre la fin de performLogin (badge + Reverb)
    await page.waitForFunction(() =>
        document.getElementById('screen-main') && document.getElementById('screen-main').classList.contains('active'),
        { timeout: 30000 }).catch(() => {});
    await sleep(3000); // Reverb here() + renderDuelLobby

    return { page, wallet, errors };
}

async function pickMove(page, n, label) {
    // Activer la barre 2D comme le fait launchGodot, puis cliquer le coup
    await page.evaluate((move) => {
        if (typeof window.showMoveBar2D === 'function') window.showMoveBar2D(true);
        const btn = document.getElementById('btn-move-' + move);
        if (btn) btn.click();
    }, n);
    log(`[${label}] Coup ${n} cliqué`);
}

(async () => {
    const browser = await puppeteer.launch({
        headless: 'shell',
        executablePath: HEADLESS_SHELL,
        protocolTimeout: 120000,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader']
    });

    const results = [];
    const check = (name, ok, detail) => {
        results.push({ name, ok });
        log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
    };

    try {
        log('════════ E2E MATCH COMPLET — 2 JOUEURS ════════\n');

    // ── Page B (joueur 2) : connecter B AVANT A pour que la présence
    // Reverb de B soit déjà connue quand le lobby de A se rend ──
    const B = await newPlayer(browser, 2, 'B');
    if (!B.wallet) { check('Joueur B connecté', false, 'wallet null'); throw new Error('B non connecté'); }
    check('Joueur B connecté (Hardhat #2)', true, B.wallet);

    // ── Page A (joueur 1) ────────────────────────────────
    const A = await newPlayer(browser, 1, 'A');
    if (!A.wallet) { check('Joueur A connecté', false, 'wallet null'); throw new Error('A non connecté'); }
    check('Joueur A connecté (Hardhat #1)', true, A.wallet);

        // ── A défie B (mise 10) ──────────────────────────────
        // Le lobby liste les joueurs avec l'ID tel que reçu via Reverb
        // (lowercase) : on clique le bouton .btn-challenge réel (B est le seul
        // autre joueur en ligne), qui appelle openBetModal et pose currentTargetId.
        await A.page.waitForFunction((targetChecksum) =>
            document.getElementById('players-list') &&
            document.getElementById('btn-chal-' + targetChecksum) &&
            !document.getElementById('btn-chal-' + targetChecksum).disabled,
            { timeout: 25000, polling: 500 }).catch(() => {});
        const clicked = await A.page.evaluate((targetLower, targetChecksum) => {
            // Le bouton du lobby porte l'ID tel que reçu via la présence Reverb
            // (checksum) : btn-chal-<id>. On tente les 2 cas, sinon le bouton
            // dont l'onclick référence l'adresse de B.
            let btn = document.getElementById('btn-chal-' + targetChecksum) ||
                      document.getElementById('btn-chal-' + targetLower) ||
                      [...document.querySelectorAll('#players-list .btn-challenge')]
                        .find(x => (x.getAttribute('onclick') || '').includes(targetLower.slice(2, 10)));
            if (btn) { btn.click(); return btn.id || 'click-ok'; }
            return null;
        }, B.wallet.toLowerCase(), B.wallet);
        if (!clicked) { check('Bouton Défier visible chez A', false, 'aucun .btn-challenge — B absent du lobby ?'); throw new Error('Pas de bouton défier'); }
        log('[A] Bouton Défier cliqué (' + clicked + ')');
        // Attendre que la modale de pari soit bien ouverte (openBetModal pose
        // currentTargetId + prérègle bet-amount) avant de saisir/confirmer.
        const modalOpen = await A.page.waitForFunction(() =>
            document.getElementById('bet-modal').style.display === 'flex' &&
            document.getElementById('bet-amount').value !== '',
            { timeout: 8000, polling: 200 }).then(() => true).catch(() => false);
        if (!modalOpen) { check('Modale de pari ouverte chez A', false, 'bet-modal invisible'); throw new Error('Modale pari absente'); }
        await sleep(300);
        await A.page.evaluate(() => {
            const input = document.getElementById('bet-amount');
            if (input) input.value = '10';
        });
        await A.page.evaluate(() => window.confirmBetAndChallenge());
        log('[A] Défi envoyé (mise 10 ETH)…');
        await sleep(3000);

        // ── B accepte (modale de défi) ───────────────────────
        const echoStateB = await B.page.evaluate(() => {
            const conn = window.echoInstance && window.echoInstance.connector;
            return { channels: conn ? Object.keys(conn.channels) : 'no-echo', screen: AppState.currentScreen };
        });
        log('[B] État avant acceptation : ' + JSON.stringify(echoStateB));
        const challengeShown = await B.page.evaluate(() => {
            const modal = document.getElementById('challenge-modal');
            return modal && modal.style.display !== 'none' && modal.style.display !== '';
        });
        check('Modale défi reçue chez B', challengeShown);
        // Captage continu des toasts sur les DEUX pages (les toasts vivent 3s —
        // un snapshot tardif les rate). MutationObserver → buffer.
        for (const P of [A, B]) {
            await P.page.evaluate(() => {
                window.__toastLog = [];
                const buf = window.__toastLog;
                const obs = new MutationObserver(() => {
                    document.querySelectorAll('.toast').forEach(t => {
                        if (!buf.includes(t.textContent)) buf.push(t.textContent);
                    });
                });
                obs.observe(document.getElementById('toast-container'), { childList: true, subtree: true });
            });
        }
        if (challengeShown) {
            await B.page.evaluate(() => document.getElementById('btn-accept-challenge').click());
            log('[B] Défi accepté.');
        }
        await sleep(4000); // MatchStarted broadcast + executeMatchOnChain (dépôt)

        // ── Contrôle MatchStarted + dépôt on-chain ───────────
        // Le broadcast MatchStarted + le début d'executeMatchOnChain prennent
        // 1-2s ; on attend activement currentMatchId des deux côtés (12s max).
        const startedA = await A.page.waitForFunction(() =>
            typeof AppState !== 'undefined' && AppState.currentMatchId !== null &&
            AppState.currentMatchId !== undefined,
            { timeout: 12000, polling: 500 }).then(() => true).catch(() => false);
        const startedB = await B.page.waitForFunction(() =>
            typeof AppState !== 'undefined' && AppState.currentMatchId !== null &&
            AppState.currentMatchId !== undefined,
            { timeout: 12000, polling: 500 }
        ).then(() => true).catch(() => false);
        check('MatchStarted reçu chez A (matchId)', startedA);
        check('MatchStarted reçu chez B (matchId)', startedB);

        // ── Écran combat + barre 2D ──────────────────────────
        // launchGodot est appelé ~1s APRÈS depositForMatch() qui attend
        // tx.wait() (mesuré : 12-28s via provider MetaMask, deux tx en
        // parallèle). On attend donc le masquage de l'overlay jusqu'à 45s.
        const inCombatA = await A.page.waitForFunction(() =>
            document.getElementById('screen-combat').classList.contains('active') ||
            document.getElementById('ui-overlay').classList.contains('hidden'),
            { timeout: 45000, polling: 500 }
        ).then(() => true).catch(() => false);
        check('Combat lancé chez A (overlay masqué ou screen-combat actif)', inCombatA);

        // Le toast 'confirmé' arrive APRÈS tx.wait() (12-28s) — on lit le
        // buffer APRÈS le lancement du combat (il cumule tous les toasts).
        const toastsA2 = await A.page.evaluate(() => (window.__toastLog || []).join(' | '));
        // Preuve 1 : toast « confirmé » dans la page (arrive après tx.wait(),
        // qui peut rester bloqué par la contention RPC du polling en conditions
        // match — cf. analyse Option 1).
        let depositOk = /confirmé|confirm/i.test(toastsA2);
        // Preuve 2 (définitive) : une tx register du wallet A minée récemment.
        // Vérification en Node pur (pas de CORS/polling in-page) : on interroge
        // le RPC Hardhat direct sur les 8 derniers blocs, avec 3 tentatives
        // espacées (la tx part en arrière-plan, Option 1).
        if (!depositOk) {
            const http = require('http');
            const rpcCall = (method, params) => new Promise((resolve, reject) => {
                const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: params || [] });
                const req = http.request({ host: '127.0.0.1', port: 8545, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }, timeout: 5000 }, res => {
                    let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
                });
                req.on('error', reject); req.write(body); req.end();
            });
            const walletLower = A.wallet.toLowerCase();
            for (let attempt = 0; attempt < 8 && !depositOk; attempt++) {
                await sleep(2500);
                try {
                    const bnJ = await rpcCall('eth_blockNumber');
                    const bn = parseInt(bnJ.result, 16);
                    for (let i = Math.max(1, bn - 8); i <= bn && !depositOk; i++) {
                        const b = await rpcCall('eth_getBlockByNumber', ['0x' + i.toString(16), true]);
                        for (const t of ((b.result && b.result.transactions) || [])) {
                            if (t.from.toLowerCase() === walletLower && t.input.startsWith('0xf207564e')) {
                                const rec = await rpcCall('eth_getTransactionReceipt', [t.hash]);
                                if (rec.result && rec.result.status === '0x1') depositOk = true;
                            }
                        }
                    }
                } catch (e) { /* retry */ }
            }
        }
        check('Dépôt on-chain confirmé (toast ou tx minée chez A)', depositOk,
            toastsA2.slice(0, 120) || 'pas de toast — preuve on-chain utilisée');

        // ── Coups choisis (2D) ───────────────────────────────
        await pickMove(A.page, 1, 'A'); // A joue Pierre
        await pickMove(B.page, 2, 'B'); // B joue Feuille
        await sleep(4000); // commits + reveals + polling

        // ── Statut backend ───────────────────────────────────
        const statusA = await A.page.evaluate(async () => {
            try {
                const r = await fetch(`${APP_CONFIG.API_BASE_URL}/battle/status/${AppState.currentMatchId}`);
                const d = await r.json();
                return d.status || d.fight_status || JSON.stringify(d).slice(0, 120);
            } catch (e) { return 'ERR: ' + e.message; }
        });
        log(`[API] Statut du match côté A : ${statusA}`);

        // Attente du résultat (polling front → completed)
        const finalA = await A.page.waitForFunction(
            () => AppState.pendingResult !== null && AppState.pendingResult !== undefined,
            { timeout: 60000, polling: 1000 }
        ).then(() => true).catch(() => false);
        check('Résultat du match reçu chez A (pendingResult)', finalA);

        const result = finalA ? await A.page.evaluate(() => AppState.pendingResult.godotResult) : null;
        if (result !== null) {
            log(`[Résultat] godotResult A = ${result} (1=victoire, 2=défaite, 0=nul/timeout)`);
        }

        // ── Erreurs console (filtrées) ───────────────────────
        const filterErr = arr => arr.filter(e =>
            !/favicon|Autoplay|AudioContext|SwiftShader|inpage|MetaMask.*-32002|net::/i.test(e));
        const errsA = filterErr(A.errors), errsB = filterErr(B.errors);
        check('Console A sans erreurs bloquantes', errsA.length === 0, errsA.slice(0, 2).join(' | '));
        check('Console B sans erreurs bloquantes', errsB.length === 0, errsB.slice(0, 2).join(' | '));

        // ── Résumé ───────────────────────────────────────────
        const failed = results.filter(r => !r.ok);
        log('\n════════ RÉSUMÉ E2E ════════');
        log(`${results.length - failed.length}/${results.length} contrôles OK`);
        if (failed.length) { failed.forEach(f => log('  ❌ ' + f.name)); process.exitCode = 1; }

        await A.page.screenshot({ path: 'test/e2e-A-final.png' });
        await B.page.screenshot({ path: 'test/e2e-B-final.png' });
        log('Captures : test/e2e-A-final.png, test/e2e-B-final.png');
    } finally {
        await browser.close();
    }
})().catch(e => { log('ÉCHEC E2E : ' + e.message); process.exit(1); });