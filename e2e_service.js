const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1400 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:8099/service.html');
  await page.waitForTimeout(1500);

  let pass = 0, fail = 0;
  const t = async (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name); cond ? pass++ : fail++; };

  // 1. Калькулятор виден по умолчанию, без селекта категории
  t('калькулятор виден по умолчанию', await page.isVisible('#tyreCalcBox'));
  t('селект/карточки категорий удалены', (await page.locator('.svc-cat-card').count()) === 0 && (await page.locator('#svcCategorySelect').count()) === 0);
  t('калькулятор в слоте #svcTyreCalcSlot', await page.evaluate(() => !!document.querySelector('#svcTyreCalcSlot #tyreCalcBox')));

  // 2. Кнопка «Добавить услуги» ОДНА и находится ПОД калькулятором
  t('кнопка одна', (await page.locator('#svcAddBtn').count()) === 1);
  t('кнопка под калькулятором (внутри #tyreCalcBox)', await page.evaluate(() => !!document.querySelector('#tyreCalcBox #svcAddBtnHolder')));
  t('блок доп. работ сразу под кнопкой (в слоте)', await page.evaluate(() => {
      const slot = document.getElementById('svcTyreCalcSlot');
      return !!slot && slot.contains(document.getElementById('svcExtraBlock'));
  }));
  const order = await page.evaluate(() => {
      const slot = document.getElementById('svcTyreCalcSlot');
      return Array.from(slot.children).map(c => c.id || c.className);
  });
  t('порядок: калькулятор -> блок услуг: ' + JSON.stringify(order), order[0] === 'tyreCalcBox');

  // 3. Полный пакет 205/65 R15 x4 = 2500 ₽
  await page.selectOption('#tcVehicleType', 'passenger');
  await page.selectOption('#tcWidth', '205');
  await page.selectOption('#tcProfile', '65');
  await page.waitForTimeout(300);
  await page.selectOption('#tcDiameter', '15');
  await page.waitForTimeout(300);
  let totalTxt = (await page.textContent('#tcTotal')).trim();
  t('полный пакет 205/65 R15 x4 = 2500 (было: ' + totalTxt + ')', totalTxt.includes('2500'));

  // 4. RUN FLAT монтаж/демонтаж x2: 2500 - (115+115)*4 + (230+230)*4 = 2500+920=3420? нет: mount+demount 115*2=230 each-> *2 => + (115*2)*4*... проверим формулу
  await page.check('#tcRunflat');
  await page.waitForTimeout(300);
  totalTxt = (await page.textContent('#tcTotal')).trim();
  // perWheel без RF: 120+120+115+115+155=625 -> 2500. С RF: mount/demount x2 => 115->230 каждый => perWheel=855 -> 3420
  t('RUN FLAT x2: 3420 (было: ' + totalTxt + ')', totalTxt.includes('3420'));
  await page.uncheck('#tcRunflat');
  await page.waitForTimeout(200);

  // 5. Цены операций не выходят за пределы карточек (R16)
  await page.selectOption('#tcDiameter', '16');
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => {
      let bad = [];
      document.querySelectorAll('.tyre-calc-op').forEach(op => {
          const b = op.querySelector('b.tc-op-price');
          if (!b) return;
          const or = op.getBoundingClientRect(), br = b.getBoundingClientRect();
          if (br.right > or.right + 1 || br.left < or.left - 1) bad.push(b.textContent);
      });
      return bad;
  });
  t('цены операций внутри карточек R16 (' + JSON.stringify(overflow) + ')', overflow.length === 0);

  // 6. Итог страницы учитывает шиномонтаж (R16x4 полный пакет = 2760)
  totalTxt = (await page.textContent('#tcTotal')).trim();
  t('полный пакет R16 x4 = 2760 (' + totalTxt + ')', totalTxt.includes('2760'));
  let sumPrice = (await page.textContent('#totalPrice')).trim();
  t('итог страницы = от 2760 (' + sumPrice + ')', sumPrice.includes('2760'));

  // 7. Чекбокс доп. работы добавляется к итогу и в список работ
  await page.click('#svcAddBtn');
  await page.waitForTimeout(300);
  t('блок табов раскрыт', await page.isVisible('#svcExtraBlock'));
  await page.click('.svc-tab[data-tab="rim"]');
  await page.waitForTimeout(200);
  await page.check('.svc-tab-panel[data-panel="rim"] input[type="checkbox"]');
  await page.waitForTimeout(300);
  sumPrice = (await page.textContent('#totalPrice')).trim();
  t('итог с правкой диска 13-15: 2760+1000=3760 (' + sumPrice + ')', sumPrice.includes('3760'));

  // 8. Отправка: payload содержит comment с расчётом и обе работы
  await page.fill('#serviceName', 'Иван');
  await page.fill('#servicePhone', '+7 (999) 000-11-22');
  await page.waitForTimeout(900);
  await page.selectOption('#branchSelect', { index: 1 });
  await page.waitForTimeout(400);
  await page.click('#grid_v4 .card-v4');
  await page.waitForTimeout(600);
  const slotBtn = await page.$('#slotsContainer .slot-btn:not(.disabled)');
  if (slotBtn) await slotBtn.click();
  await page.waitForTimeout(200);

  const [request] = await Promise.all([
    page.waitForRequest(r => r.url().includes('booking_handler.php'), { timeout: 5000 }),
    page.click('#serviceSubmitBtn')
  ]);
  const body = request.postData() || '';
  t('comment с расчётом присутствует', body.includes('comment=') && decodeURIComponent(body).includes('Шиномонтаж 205/65 R16'));
  t('детализация операций в комментарии', decodeURIComponent(body).includes('Балансировка') && decodeURIComponent(body).includes('Монтаж'));
  t('доп. работа в services_json', decodeURIComponent(body).includes('Правка легкосплавного диска 13-15'));
  t('позиции шиномонтажа построчно в services_json', decodeURIComponent(body).includes('Снятие 205/65 R16'));
  const msgOk = await page.waitForSelector('.message.success.is-visible', { timeout: 5000 }).then(()=>true).catch(()=>false);
  t('заявка создана (сообщение успеха)', msgOk);

  // 9. Сброс возвращает всё в исходное состояние
  await page.click('#svcResetBtn');
  await page.waitForTimeout(800);
  t('после сброса: калькулятор на месте', await page.evaluate(() => !!document.querySelector('#svcTyreCalcSlot #tyreCalcBox #svcAddBtnHolder')));
  t('после сброса: табы свёрнуты', await page.evaluate(() => document.getElementById('svcExtraBlock').hidden));
  t('после сброса: чекбоксы сняты', (await page.locator('.service-item input:checked').count()) === 0);

  t('нет JS-ошибок (' + errors.slice(0,3).join(' ; ') + ')', errors.length === 0);

  await page.screenshot({ path: 'shot_service_top.png', clip: { x: 0, y: 0, width: 1280, height: 1400 } });
  console.log(`\nRESULT: ${pass} PASS / ${fail} FAIL`);
  await browser.close();
  process.exit(fail ? 1 : 0);
})();
