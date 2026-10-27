const { chromium } = require('playwright');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto('http://localhost:8099/service.html');
    await page.waitForTimeout(1200);
    // калькулятор отрисован (шиномонтаж выбран по умолчанию)
    await page.screenshot({ path: 'shot_top.png', fullPage: false });
    // открыть доп. услуги
    await page.click('#svcAddBtnHolder .svc-add-btn');
    await page.waitForTimeout(400);
    await page.evaluate(() => document.getElementById('svcExtraBlock').scrollIntoView());
    await page.screenshot({ path: 'shot_extras.png' });
    // мобильная версия
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'shot_mobile.png', fullPage: false });
    // проверка выравнивания заголовков категорий (на разных строках)
    const desc = await page.$$eval('.svc-cat-desc', els => els.map(e => getComputedStyle(e).display + '/' + e.textContent.trim().slice(0,30)));
    console.log('cat-desc:', JSON.stringify(desc));
    const emoji = await page.evaluate(() => /🛞|🎯|⚙️|🔧/.test(document.body.innerText));
    console.log('emoji present:', emoji);
    const resetBtn = await page.isVisible('text=Сбросить всё') || await page.$('.svc-reset-btn');
    console.log('reset button:', !!resetBtn);
    await browser.close();
})();
