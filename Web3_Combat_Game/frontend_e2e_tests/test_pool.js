const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');

// Configuration
const APP_URL = 'http://localhost:8080';
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

    console.log("Starting Puppeteer E2E Pool Test...");
    
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-features=IsolateOrigins,site-per-process']
    });
    
    // Helper to create a player page
    async function createPlayer(playerIndex) {
        const page = await browser.newPage();
        
        await page.setRequestInterception(true);
        page.on('request', request => {
            if (request.url().endsWith('godot.js') || request.url().endsWith('godot.wasm')) {
                request.abort();
            } else {
                request.continue();
            }
        });
        
        page.on('console', msg => {
            console.log(`[P${playerIndex}] ${msg.text()}`);
        });
        
        await page.goto(`http://localhost:8080/?player=${playerIndex}`, { waitUntil: 'domcontentloaded' });
        
        // Mock Godot gameplay
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
        
        await new Promise(r => setTimeout(r, 1000));
        
        // Select character
        console.log(`[P${playerIndex}] Selecting character...`);
        await page.evaluate(() => {
            const firstChar = document.querySelector('.char-card');
            if (firstChar) {
                firstChar.click();
                document.getElementById('btn-confirm-char').click();
            }
        });
        
        await new Promise(r => setTimeout(r, 1000));
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
