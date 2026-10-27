const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto('http://localhost:8099/service.html');
    await page.waitForTimeout(1000);
    await page.click('#svcAddBtnHolder .svc-add-btn').catch(()=>{});
    await page.waitForTimeout(300);
    const styles = await page.evaluate(() => {
        const get = (sel) => { const el = document.querySelector(sel); if (!el) return sel + ': NOT FOUND';
            const c = getComputedStyle(el); return sel + ': color=' + c.color + ' bg=' + c.backgroundColor + ' border=' + c.borderColor + ' radius=' + c.borderRadius; };
        return [get('.svc-tab'), get('.svc-tab.active'), get('.svc-add-btn'), get('.service-item'), get('.auth-input-field'), get('.svc-step-title')].join('\n');
    });
    console.log(styles);
    await browser.close();
})();
