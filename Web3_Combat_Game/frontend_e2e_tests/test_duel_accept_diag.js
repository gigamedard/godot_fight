// ============================================================================
// TEST E2E DIAGNOSTIC — DÉFI → ACCEPTATION → LANCEMENT DU COMBAT
//
// Reproduit : P1 défie P2, P2 accepte. On trace si les événements clés arrivent
// réellement côté client :
//   - ChallengeSent reçu par P2 (modale affichée)
//   - PlayerStatusChanged in-game (notre fix ferme la modale)
//   - ChallengesCancelled (notre fix)
//   - MatchStarted reçu (executeMatchOnChain)
//   - launchGodot appelé (combat lancé)
//
// Exécution : node test_duel_accept_diag.js
// ============================================================================

const { APP_URL, launchBrowser, blockGodotResources, completeEntryFlow } = require('./e2e_helpers');

function waitFor(fn, timeoutMs, intervalMs = 500, label = 'condition') {
    const start = Date.now();
    return new Promise((resolve, reject) => {
        (async function check() {
            try { const v = await fn(); if (v) return resolve(v); } catch (e) {}
            if (Date.now() - start > timeoutMs) return reject(new Error(`Timeout: ${label}`));
            setTimeout(check, intervalMs);
        })();
    });
}

(async () => {
    console.log('=== DIAGNOSTIC DÉFI → ACCEPTATION → LANCEMENT ===');

    const browser = await launchBrowser();

    // --- Joueur 1 (challenger) ---
    const p1 = await browser.newPage();
    await blockGodotResources(p1);
    p1.on('console', m => { const t = m.text(); if (!/godot|Failed to load|favicon|wasm|pck/i.test(t)) console.log(`[P1] ${t}`); });
    await p1.goto(`${APP_URL}/?player=1`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));
    await completeEntryFlow(p1, { mode: 'DUEL', language: 'fr' });

    // --- Joueur 2 (target) ---
    const p2 = await browser.newPage();
    await blockGodotResources(p2);
    p2.on('console', m => { const t = m.text(); if (!/godot|Failed to load|favicon|wasm|pck/i.test(t)) console.log(`[P2] ${t}`); });
    await p2.goto(`${APP_URL}/?player=2`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 1000));
    await completeEntryFlow(p2, { mode: 'DUEL', language: 'fr' });

    // Installe des sondes dans les pages AVANT le défi
    await p1.evaluate(() => {
        window.__diag = { matchStarted: false, executeMatchOnChain: false, launchGodot: false, godotSpawn: false };
        // Patch executeMatchOnChain pour tracer
        const origExec = window.executeMatchOnChain;
        if (typeof origExec === 'function') {
            window.executeMatchOnChain = async (e) => {
                window.__diag.executeMatchOnChain = true;
                window.__diag.matchId = e && e.matchId;
                return origExec(e);
            };
        }
        const origLaunch = window.launchGodot;
        if (typeof origLaunch === 'function') {
            window.launchGodot = (targetId) => {
                window.__diag.launchGodot = true;
                window.__diag.targetId = targetId;
                return origLaunch(targetId);
            };
        }
    });
    await p2.evaluate(() => {
        window.__diag = { matchStarted: false, executeMatchOnChain: false, launchGodot: false, godotSpawn: false };
        const origExec = window.executeMatchOnChain;
        if (typeof origExec === 'function') {
            window.executeMatchOnChain = async (e) => {
                window.__diag.executeMatchOnChain = true;
                window.__diag.matchId = e && e.matchId;
                return origExec(e);
            };
        }
        const origLaunch = window.launchGodot;
        if (typeof origLaunch === 'function') {
            window.launchGodot = (targetId) => {
                window.__diag.launchGodot = true;
                window.__diag.targetId = targetId;
                return origLaunch(targetId);
            };
        }
    });

    const walletP1 = await p1.evaluate(() => AppState.walletAddress);
    const walletP2 = await p2.evaluate(() => AppState.walletAddress);
    console.log(`Wallets — P1: ${walletP1}`);
    console.log(`Wallets — P2: ${walletP2}`);

    // --- Synchronisation Reverb : attendre que le socket WS soit OPEN et que
    // le canal privé de CHAQUE joueur soit réellement abonné avant d'envoyer le
    // défi (sinon ChallengeSent/MatchStarted sont perdus — race condition). ---
    // --- Synchronisation Reverb : attendre que le presence-lobby de CHAQUE
    // joueur voie l'autre (preuve que la connexion WS + abonnement sont actifs),
    // puis un délai fixe pour laisser l'abonnement au canal privé s'établir.
    // Sans cela, un défi envoyé trop tôt est perdu (race condition). ---
    const waitSeenInLobby = async (page, otherWallet, label) => {
        await waitFor(() => page.evaluate((w) => {
            return Array.isArray(onlinePlayers) && onlinePlayers.some(u => String(u.id).toLowerCase() === String(w).toLowerCase());
        }, otherWallet), 20000, 500, `${label} visible dans le lobby`);
        console.log(`  ✅ ${label} voit l'autre joueur dans le lobby (connexion Reverb active)`);
        await new Promise(r => setTimeout(r, 2500)); // laisse l'abonnement au canal privé se compléter
    };
    await waitSeenInLobby(p1, walletP2, 'P1');
    await waitSeenInLobby(p2, walletP1, 'P2');

    // --- P1 envoie le défi ---
    console.log('\n[P1] Envoi du défi vers P2...');
    const chalResult = await p1.evaluate(async (targetWallet) => {
        try {
            await initiateChallenge(targetWallet, 1);
            return { ok: true };
        } catch (e) {
            return { ok: false, err: String(e && e.message || e) };
        }
    }, walletP2);
    console.log('  Résultat initiateChallenge:', chalResult);

    // --- Attendre que la modale de défi apparaisse chez P2 ---
    console.log('\n[P2] Attente de la modale de défi (ChallengeSent)...');
    await waitFor(() => p2.evaluate(() => {
        const modal = document.getElementById('challenge-modal');
        return modal && modal.style.display === 'flex';
    }), 15000, 500, 'modale défi chez P2');
    console.log('  ✅ Modale de défi affichée chez P2');

    // --- P2 accepte ---
    console.log('\n[P2] Acceptation du défi...');
    await p2.evaluate(() => {
        const btn = document.getElementById('btn-accept-challenge');
        if (btn) btn.click();
        else console.log('  BOUTON ACCEPTER INTROUVABLE');
    });

    // --- Attendre 6s et inspecter les sondes ---
    console.log('\n[Attente 7s pour laisser le flux se dérouler...]');
    await new Promise(r => setTimeout(r, 7000));

    const diagP1 = await p1.evaluate(() => ({ ...window.__diag, matchId: typeof AppState !== 'undefined' ? AppState.currentMatchId : null, screen: document.getElementById('ui-overlay') ? !document.getElementById('ui-overlay').classList.contains('hidden') ? 'UI visible' : 'UI cachée (combat)' : '?' }));
    const diagP2 = await p2.evaluate(() => ({ ...window.__diag, matchId: typeof AppState !== 'undefined' ? AppState.currentMatchId : null, screen: document.getElementById('ui-overlay') ? !document.getElementById('ui-overlay').classList.contains('hidden') ? 'UI visible' : 'UI cachée (combat)' : '?' }));

    console.log('\n=== DIAGNOSTIC P1 (challenger) ===');
    console.log(JSON.stringify(diagP1, null, 2));
    console.log('\n=== DIAGNOSTIC P2 (target) ===');
    console.log(JSON.stringify(diagP2, null, 2));

    // Vérifier l'état du fight en base
    try {
        const res = await fetch('http://localhost:8000/api/battle/status/' + (diagP1.matchId || diagP2.matchId));
        const data = await res.json();
        console.log('\n=== ÉTAT SERVEUR DU FIGHT ===');
        console.log(JSON.stringify(data, null, 2));
    } catch (e) { console.log('  (fight non trouvé ou erreur)', e.message); }

    await browser.close();
    console.log('\n=== DIAGNOSTIC TERMINÉ ===');
    process.exit(0);
})().catch(err => { console.error('ERREUR:', err); process.exit(2); });
