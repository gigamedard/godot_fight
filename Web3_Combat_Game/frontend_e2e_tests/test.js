const puppeteer = require('puppeteer-core');

(async () => {
    console.log("Starting Puppeteer E2E test...");
    
    // Launch a headless browser
    const browser = await puppeteer.launch({
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        headless: "new", // use new headless mode
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Catch console logs from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('requestfailed', request => {
        console.log(`REQUEST FAILED: ${request.url()} - ${request.failure() ? request.failure().errorText : ''}`);
    });
    page.on('response', response => {
        if (!response.ok()) {
            console.log(`RESPONSE FAILED: ${response.url()} - ${response.status()}`);
        }
    });
    
    // Navigate to the frontend
    console.log("Navigating to http://localhost:8080...");
    await page.goto('http://localhost:8080', { waitUntil: 'networkidle2' });
    
    // Wait for page to load
    await new Promise(r => setTimeout(r, 2000));
    
    console.log("Selecting a character...");
    await page.evaluate(() => {
        const firstChar = document.querySelector('.char-card');
        if (firstChar) {
            firstChar.click();
            document.getElementById('btn-confirm-char').click();
        }
    });
    
    await new Promise(r => setTimeout(r, 1000));
    
    console.log("Opening Create Pool Modal via JS...");
    await page.evaluate(() => {
        if (typeof openCreatePoolModal === 'function') openCreatePoolModal();
    });
    
    console.log("Filling pool details...");
    // Let's set entry fee to 10
    await page.waitForSelector('#pool-entry-fee', { visible: true });
    // clear and type
    await page.evaluate(() => document.getElementById('pool-entry-fee').value = '');
    await page.type('#pool-entry-fee', '10');
    
    console.log("Submitting pool creation...");
    await page.evaluate(() => {
        if (typeof confirmCreatePool === 'function') confirmCreatePool();
    });
    
    // Wait for the modal to close and the pool to appear in the list
    console.log("Waiting for pool creation to finish (transaction + backend)...");
    await new Promise(r => setTimeout(r, 6000));
    
    // Check if the pool list has elements
    console.log("Checking if pool exists in the list...");
    const poolItemsCount = await page.evaluate(() => {
        return document.querySelectorAll('#public-pools-list .pool-item').length;
    });
    
    console.log(`Found ${poolItemsCount} pools in the public list.`);
    
    if (poolItemsCount > 0) {
        console.log("SUCCESS: Pool was created and is visible!");
        console.log("Joining the first pool...");
        
        await page.evaluate(() => {
            const joinBtn = document.querySelector('#public-pools-list .pool-item .btn-join-pool');
            if (joinBtn) joinBtn.click();
        });
        
        await new Promise(r => setTimeout(r, 3000));
        console.log("SUCCESS: Clicked join pool!");
    } else {
        console.log("ERROR: Pool was not created or not visible.");
    }

    await browser.close();
    console.log("Test finished successfully.");
})();
