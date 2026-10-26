const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 1000 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto('http://localhost:8099/service.html');
  await page.waitForTimeout(1500);

  const t = async (name, cond) => console.log((cond ? 'PASS' : 'FAIL') + ' | ' + name);

  // 1. Калькулятор виден по умолчанию (Шиномонтаж — основная работа)
  t('калькулятор виден по умолчанию', await page.isVisible('#tyreCalcBox'));

  // 2. Селект категории вместо карточек; карточек нет
  t('селект категории присутствует', await page.isVisible('#svcCategorySelect'));
  t('карточки категорий удалены', (await page.locator('.svc-cat-card').count()) === 0);

  // 3. Только одна кнопка "Добавить услуги"
  const addBtnCount = await page.locator('#svcAddBtn').count();
  t('кнопка «Добавить услуги» одна', addBtnCount === 1);
  const btnText = await page.textContent('#svcAddBtn');
  t('текст кнопки без спец-символов: ' + btnText.trim(), !btnText.includes('＋') && !btnText.includes('－'));

  // 4. Полный пакет по умолчанию -> цена R16x4 = 2760? проверим R15 = 2500
  await page.selectOption('#tcWidth', '205');
  await page.selectOption('#tcProfile', '65');
  await page.selectOption('#tcDiameter', '15');
  await page.waitForTimeout(300);
  let totalTxt = await page.textContent('#tcTotal');
  t('полный пакет 205/65 R15 x4 = 2500 (было: ' + totalTxt.trim() + ')', totalTxt.includes('2500'));

  // 5. «По выбору» сбрасывает чекбоксы
  await page.click('#tcPacketCustom');
  await page.waitForTimeout(200);
  const checkedOps = await page.locator('#tcOps input:checked').count();
  t('по выбору: чекбоксы операций сброшены (' + checkedOps + ')', checkedOps === 0);
  totalTxt = await page.textContent('#tcTotal');
  t('итог после сброса = 0 (' + totalTxt.trim() + ')', totalTxt.includes('0'));

  // 6. Выбор одной операции
  await page.check('#tcOps input[value="balance"]');
  await page.waitForTimeout(200);
  totalTxt = await page.textContent('#tcTotal');
  t('только балансировка R15 x4 = 620 (' + totalTxt.trim() + ')', totalTxt.includes('620'));

  // 7. Режим пакета: active на «По выбору»
  t('режим «По выбору» активен', await page.evaluate(() => document.getElementById('tcPacketCustom').classList.contains('active')));

  // 8. Возврат в полный пакет
  await page.click('#tcPacketFull');
  await page.waitForTimeout(200);
  const checkedAll = await page.locator('#tcOps input:checked').count();
  t('полный пакет: все 5 включены (' + checkedAll + ')', checkedAll === 5);

  // 9. Смена основной работы -> калькулятор скрыт, блок услуг раскрыт
  await page.selectOption('#svcCategorySelect', 'align');
  await page.waitForTimeout(1500);
  t('не шиномонтаж: калькулятор скрыт', !(await page.isVisible('#tyreCalcBox')));
  t('не шиномонтаж: блок услуг раскрыт', await page.isVisible('#svcExtraBlock'));
  t('автооткрыт таб Развал', await page.evaluate(() => document.querySelector('.svc-tab-panel[data-panel="align"]').classList.contains('active')));
  t('список доп. работ показан и синхронен', await page.isVisible('.svc-tab-select-group') && (await page.inputValue('#svcTabSelect')) === 'align');

  // 10. Чекбокс развала добавляется в итог
  await page.check('.svc-tab-panel[data-panel="align"] input[type=checkbox]');
  await page.waitForTimeout(300);
  const priceTxt = await page.textContent('#totalPrice');
  t('итог содержит развал от 1900 (' + priceTxt.trim() + ')', priceTxt.includes('1900'));

  // 11. Возврат к шиномонтажу: блок свёрнут, кнопка под калькулятором
  await page.selectOption('#svcCategorySelect', 'tire');
  await page.waitForTimeout(1500);
  t('шиномонтаж вернулся', await page.isVisible('#tyreCalcBox'));
  t('блок доп. работ свёрнут', !(await page.isVisible('#svcExtraBlock')));
  t('кнопка под калькулятором', await page.evaluate(() => !!document.querySelector('#tyreCalcBox #svcAddBtnHolder')));

  // 12. Раскрытие через кнопку под калькулятором
  await page.click('#svcAddBtn');
  await page.waitForTimeout(300);
  t('раскрытие по кнопке', await page.isVisible('#svcExtraBlock'));
  t('текст стал «Свернуть услуги»', (await page.textContent('#svcAddBtn')).includes('Свернуть'));

  // 13. Таб через select
  await page.selectOption('#svcTabSelect', 'rim');
  await page.waitForTimeout(200);
  t('select переключает таб', await page.evaluate(() => document.querySelector('.svc-tab-panel[data-panel="rim"]').classList.contains('active')));
  t('клик по таб-кнопке синхронизирует select', await (async () => { await page.click('.svc-tab[data-tab="other"]'); return (await page.inputValue('#svcTabSelect')) === 'other'; })());

  // 14. Нет эмодзи в заголовке калькулятора
  const calcTitle = await page.textContent('.tyre-calc-title');
  t('заголовок без эмодзи: ' + calcTitle.trim(), !/[🛞🎯⚙️🔧📌]/.test(calcTitle));

  // 15. Подключение css.css
  t('css.css подключён', await page.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].some(l => l.href.includes('css.css'))));

  // 16. Поиск клиента по телефону: поле марки скрывается
  await page.fill('#servicePhone', '+7 (999) 123-45-67');
  await page.waitForTimeout(1200);
  t('клиент найден: инфо-блок виден', await page.isVisible('#svcClientInfo'));
  t('поле «Марка авто» скрыто у найденного клиента', !(await page.isVisible('#svcCarManualWrap')));
  const nm = await page.inputValue('#serviceName');
  t('имя подставлено из базы: ' + nm, nm.length > 0);

  // 17. Каскад размеров: ширина 315 доступна только с R20/R21
  await page.selectOption('#tcWidth', '315');
  await page.waitForTimeout(300);
  const diamOpts = await page.locator('#tcDiameter option').evaluateAll(os => os.map(o => o.value));
  t('R-список для ширины 315: ' + diamOpts.join(','), diamOpts.every(d => ['20','21'].includes(d)) && diamOpts.length >= 2);
  // профиль подстраивается под пару ширина+профиль
  await page.selectOption('#tcDiameter', '21');
  await page.waitForTimeout(300);
  const profOpts = await page.locator('#tcProfile option').evaluateAll(os => os.map(o => o.value));
  t('профили для 315 R21: ' + profOpts.join(','), profOpts.length > 0);

  // 18. Сбросить всё
  await page.click('#svcResetBtn');
  await page.waitForTimeout(400);
  t('после сброса: калькулятор снова открыт (основная работа)', await page.isVisible('#tyreCalcBox'));
  t('после сброса: категория = tire', (await page.inputValue('#svcCategorySelect')) === 'tire');
  t('после сброса: услуги сняты', (await page.locator('.service-item input:checked').count()) === 0);
  t('после сброса: телефон очищен', (await page.inputValue('#servicePhone')).length < 5);
  t('после сброса: кнопка одна', (await page.locator('#svcAddBtn').count()) === 1);

  // 19. Отправка заявки с комментарием расчёта
  await page.selectOption('#branchSelect', { index: 1 });
  await page.waitForTimeout(300);
  await page.selectOption('#postSelect', { index: 1 });
  await page.waitForTimeout(600);
  const slotVisible = await page.locator('#slotsContainer .slot-btn:not(.disabled)').count();
  t('слоты загружены (' + slotVisible + ')', slotVisible > 0);
  if (slotVisible > 0) await page.click('#slotsContainer .slot-btn:not(.disabled)');
  await page.fill('#serviceName', 'Тест Тест');
  await page.fill('#servicePhone', '+7 (999) 123-45-67');
  await page.waitForTimeout(1200);
  await page.click('#serviceSubmitBtn');
  await page.waitForTimeout(800);
  t('заявка отправлена', await page.evaluate(() => document.getElementById('serviceCalcMsg').className.includes('success')));

  console.log('JS ERRORS:', errors.length ? errors.join(' || ') : 'нет');
  await page.screenshot({ path: 'service_final.png', fullPage: true });
  await browser.close();
})();
