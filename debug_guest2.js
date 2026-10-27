const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    let lastBooking = null;
    page.on('request', r => { if (r.url().includes('booking_handler.php')) lastBooking = r.postData(); });
    await page.goto('http://localhost:8099/service.html');
    await page.waitForTimeout(600);
    await page.click('#servicePhone');
    await page.type('#servicePhone', '9990001234', { delay: 10 });
    await page.waitForTimeout(1500);
    await page.selectOption('#branchSelect', { index: 1 });
    await page.waitForTimeout(400);
    await page.selectOption('#postSelect', { index: 1 }).catch(()=>{});
    await page.waitForTimeout(600);
    const slotBtns = await page.$$('#slotsContainer .slot-btn:not(.disabled)');
    await slotBtns[0].click();
    await page.click('#serviceSubmitBtn');
    await page.waitForTimeout(1200);
    // парсим multipart корректно
    const parts = lastBooking.split(/------WebKitFormBoundary[\w]+/);
    for (const p of parts) {
        const m = p.match(/name="([^"]+)"\r\n\r\n([\s\S]*?)\r?\n?$/);
        if (m && ['is_guest','client_id','car_profile_id','phone'].includes(m[1])) console.log(m[1], '=', JSON.stringify(m[2]));
    }
    await browser.close();
})();
