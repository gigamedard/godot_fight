const { execSync } = require('child_process');
const { APP_URL, launchBrowser, blockGodotResources, logPage, completeEntryFlow } = require('./e2e_helpers');

// Configuration
const POOL_ENTRY_FEE = '1';
const MAX_PLAYERS = '3';

(async () => {
    console.log("Restarting indexer container to ensure it's fresh...");
    try {
        execSync("docker compose restart indexer", { cwd: "../" });
        console.log("Indexer restarted. Waiting 5s for it to connect...");
        await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
        console.error("Failed to restart indexer", e.message);
    }

    console.log("Starting Puppeteer E2E Pool Test (nouveau flow d'entrée)...");

    const browser = await launchBrowser();

    // Helper to create a player page : bloque Godot, mocke le gameplay,
    // puis parcourt le nouveau flow d'entrée jusqu'au lobby Battle Royale.
    async function createPlayer(playerIndex) {
        const page = await browser.newPage();
        await blockGodotResources(page); // Le moteur 3D réel n'est pas nécessaire (mocks)
        logPage(page, `[P${playerIndex}]`);

        // Mock Godot gameplay (avant le chargement de la page : evaluateOnNewDocument)
        await page.evaluateOnNewDocument(() => {
            window.godotSpawnOpponent = function(id) {
                console.log("Mocking Godot: Opponent spawned! Submitting move...");
                // Submit move 1 (Rock)
                setTimeout(() => {
                    if (typeof window.submitMove === 'function') {
                        window.submitMove(1);
                    }
                }, 2000);
            };

            // Mock animation finish when opponent reveals
            window.godotPlayRevealAnimation = function(a, b, c) {
                console.log("Mocking Godot: Reveal Animation played! Triggering animationFinished...");
                setTimeout(() => {
                    if (typeof window.animationFinished === 'function') {
                        window.animationFinished();
                    }
                }, 1000);
            };

            // Allow animation finish to be called if godotReceiveOpponentMove was called
            window.godotReceiveOpponentMove = function() {
                 setTimeout(() => {
                    if (typeof window.animationFinished === 'function') {
                        window.animationFinished();
                    }
                }, 1000);
            };
        });

        await page.goto(`${APP_URL}/?player=${playerIndex}`, { waitUntil: 'domcontentloaded' });
        await new Promise(r => setTimeout(r, 1000));

        // NOUVEAU FLOW : splash → langue → connexion (compte Hardhat #playerIndex) → BATTLE → perso
        console.log(`[P${playerIndex}] Parcours du flow d'entrée...`);
        await completeEntryFlow(page, { mode: 'BATTLE', language: 'fr' });
        return page;
    }

    const p1 = await createPlayer(1);
    const p2 = await createPlayer(2);
    const p3 = await createPlayer(3);

    const p1Status = await p1.evaluate(() => window.AppState ? window.AppState.currentMatchId : null);
    const p2Status = await p2.evaluate(() => window.AppState ? window.AppState.currentMatchId : null);

    // Setup listener before creating pool
    let targetPoolId = null;
    p1.on('console', msg => {
        const txt = msg.text();
        if (txt.includes('Extracted poolId:')) {
            targetPoolId = parseInt(txt.split(':')[1].trim());
        }
        console.log(`[P1] ${txt}`);
    });

    console.log("[P1] Creating pool...");
    await p1.evaluate(() => {
        if (typeof openCreatePoolModal === 'function') openCreatePoolModal();
    });

    await p1.waitForSelector('#pool-entry-fee', { visible: true });
    await p1.evaluate(() => {
        document.getElementById('pool-max-players').value = 3;
        const privateCheck = document.getElementById('pool-is-private');
        if (privateCheck) privateCheck.checked = false;
        if (typeof confirmCreatePool === 'function') {
            confirmCreatePool();
        }
    });

    console.log("Waiting for pool creation...");
    for (let i = 0; i < 50; i++) {
        await new Promise(r => setTimeout(r, 1000));
        if (targetPoolId) break;
        // Fallback : interroger le backend (AppState est une const non exposée sur window)
        if (!targetPoolId) {
            try {
                const res = await fetch('http://localhost:8000/api/pools/user/0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
                const data = await res.json();
                if (data.active) targetPoolId = Number(data.pool_id);
            } catch (e) {}
        }
    }

    if (!targetPoolId) {
        console.log("Failed to extract poolId. Exiting.");
        process.exit(1);
    }
    console.log(`Pool created with ID: ${targetPoolId}`);

      // P2 joins
      console.log("[P2] Joining pool...");
      await p2.evaluate(async (id) => {
          if (!window.joinPool) throw new Error("joinPool not found");
          await window.joinPool(id);
      }, targetPoolId);
      console.log("Waiting for P2 to join...");
      await new Promise(r => setTimeout(r, 6000));

      console.log("[P3] Joining pool...");
      await p3.evaluate(async (id) => {
          if (!window.joinPool) throw new Error("joinPool not found");
          await window.joinPool(id);
      }, targetPoolId);
      console.log("Waiting for Matchmaking to trigger (PoolStarted)...");

    // Wait for 240 seconds to let the entire round play out
    let secondsLeft = 240;
    while(secondsLeft > 0) {
        process.stdout.write(`\rWaiting for match resolution... ${secondsLeft}s left`);
        await new Promise(r => setTimeout(r, 1000));

        try {
            // Wait for Godot to load (AppState.currentMatchId exists), then submit move
            await p1.evaluate(() => { if (typeof AppState !== 'undefined' && AppState.currentMatchId && window._mockMoveSubmitted !== AppState.currentMatchId.toString()) { if (typeof window.submitMove === 'function') { window.submitMove(1); window._mockMoveSubmitted = AppState.currentMatchId.toString(); } } });
            await p2.evaluate(() => { if (typeof AppState !== 'undefined' && AppState.currentMatchId && window._mockMoveSubmitted !== AppState.currentMatchId.toString()) { if (typeof window.submitMove === 'function') { window.submitMove(2); window._mockMoveSubmitted = AppState.currentMatchId.toString(); } } });
            await p3.evaluate(() => { if (typeof AppState !== 'undefined' && AppState.currentMatchId && window._mockMoveSubmitted !== AppState.currentMatchId.toString()) { if (typeof window.submitMove === 'function') { window.submitMove(3); window._mockMoveSubmitted = AppState.currentMatchId.toString(); } } });
        } catch (e) {}

        secondsLeft--;
    }
    console.log("\nTest finished. Check logs above to see if Match 1 resolved successfully.");

    await browser.close();
})();
