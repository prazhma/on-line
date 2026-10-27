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
    console.log('hint:', await page.textContent('#phoneCheckHint'));
    // ничего не меняем в гараже, сразу выбираем филиал/пост/слот и отправляем
    await page.selectOption('#branchSelect', { index: 1 });
    await page.waitForTimeout(400);
    await page.selectOption('#postSelect', { index: 1 }).catch(()=>{});
    await page.waitForTimeout(600);
    const slotBtns = await page.$$('#slotsContainer .slot-btn:not(.disabled)');
    await slotBtns[0].click();
    await page.click('#serviceSubmitBtn');
    await page.waitForTimeout(1200);
    console.log('msg:', (await page.textContent('#serviceCalcMsg')).slice(0,120));
    if (lastBooking) {
        const m = lastBooking.match(/name="is_guest"\r?\n([^\r\n]*)/);
        console.log('is_guest value:', m && m[1]);
        const cid = lastBooking.match(/name="client_id"\r?\n([^\r\n]*)/);
        console.log('client_id value:', cid && cid[1]);
    }
    await browser.close();
})();
