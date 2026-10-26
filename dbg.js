const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext()).newPage();
  await page.goto('http://localhost:8099/service.html');
  await page.waitForTimeout(1500);
  await page.selectOption('#svcCategorySelect', 'align');
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const block = document.getElementById('svcExtraBlock');
    const panel = document.querySelector('.svc-tab-panel[data-panel="align"]');
    const cb = panel.querySelector('input[type=checkbox]');
    const cs = getComputedStyle(block), ps = getComputedStyle(panel), cbs = getComputedStyle(cb);
    return {
      hiddenAttr: block.hidden,
      blockDisplay: cs.display, blockVisibility: cs.visibility, blockOpacity: cs.opacity,
      panelDisplay: ps.display,
      cbDisplay: cbs.display, cbSize: cb.getBoundingClientRect(),
      labelHTML: panel.querySelector('.service-item').outerHTML.slice(0,200)
    };
  });
  console.log(JSON.stringify(info, null, 1));
  await browser.close();
})();
