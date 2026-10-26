const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    let ok = 0, fail = 0;
    const check = (name, cond) => { if (cond) { ok++; console.log('PASS:', name); } else { fail++; console.log('FAIL:', name); } };

    await page.goto('http://localhost:8099/service.html');
    await page.waitForTimeout(600);

    // ==== 1. Загрузка данных после ввода телефона ====
    await page.fill('#serviceName', '');
    await page.click('#servicePhone');
    await page.type('#servicePhone', '9991234567', { delay: 10 });
    await page.waitForTimeout(1200); // дебаунс 500 + запросы
    const clientVisible = await page.isVisible('#svcClientInfo');
    check('1. Карточка клиента показана после ввода телефона', clientVisible);
    const nameVal = await page.inputValue('#serviceName');
    check('1. Имя подтянуто из STOCRM', nameVal === 'Иван Петров');
    const carOpts = await page.$$eval('#serviceCarBrand option', os => os.map(o => o.value));
    check('1. Список авто клиента загружен', carOpts.includes('Kia Rio') && carOpts.includes('Toyota RAV4'));
    const manualHidden = !(await page.isVisible('#serviceCarBrandManual'));
    check('1. Ручной ввод марки скрыт при найденном клиенте', manualHidden);

    // ==== 2. Шиномонтаж основной + кнопка «Добавить услуги» -> табы ====
    const tireChecked = await page.isChecked('input[name="svcCategory"][value="tire"]');
    check('2. Шиномонтаж выбран по умолчанию', tireChecked);
    await page.waitForTimeout(800); // калькулятор отрисован
    check('2. Калькулятор виден', await page.isVisible('#tyreCalcBox'));
    const extraHiddenInitially = await page.$eval('#svcExtraBlock', el => el.hidden);
    check('2. Блок прочих услуг скрыт изначально', extraHiddenInitially);
    // клик по кнопке ПОД калькулятором (п.5)
    check('5. Кнопка «Добавить услуги» есть под калькулятором', await page.isVisible('#svcAddBtnCalc'));
    await page.click('#svcAddBtnCalc');
    await page.waitForTimeout(300);
    check('2. Табы открылись по кнопке из-под калькулятора', !(await page.$eval('#svcExtraBlock', el => el.hidden)));
    const tabsCount = await page.$$eval('#svcTabs .svc-tab', ts => ts.length);
    check('2. Выведены табы с работами (4 таба)', tabsCount === 4);
    // переключение таба
    await page.click('.svc-tab[data-tab="rim"]');
    const rimActive = await page.$eval('.svc-tab-panel[data-panel="rim"]', el => el.classList.contains('active'));
    const alignHidden = !(await page.isVisible('.svc-tab-panel[data-panel="align"]'));
    check('2. Переключение табов работает', rimActive && alignHidden);

    // ==== 3/4. Каскад размеров и сброс чекбоксов в «По выбору» ====
    const wVal = await page.inputValue('#tcWidth');
    const pVal = await page.inputValue('#tcProfile');
    const dVal = await page.inputValue('#tcDiameter');
    check('3. Дефолтный размер 205/55 -> только R16', wVal === '205' && pVal === '55' && dVal === '16');
    const profOpts = await page.$$eval('#tcProfile option', os => os.map(o => o.value));
    check('3. Профили ограничены матрицей (для 205: 40..65)', JSON.stringify(profOpts) === JSON.stringify(['40','45','50','55','60','65']));
    // смена ширины на 185 -> профили меняются, радиус валиден
    await page.selectOption('#tcWidth', '185');
    await page.waitForTimeout(200);
    const profOpts185 = await page.$$eval('#tcProfile option', os => os.map(o => o.value));
    check('3. Для 185 профили 60/65/70', JSON.stringify(profOpts185) === JSON.stringify(['60','65','70']));
    await page.selectOption('#tcProfile', '65');
    const diamOpts = await page.$$eval('#tcDiameter option', os => os.map(o => o.value));
    check('3. Для 185/65 радиусы R14,R15', JSON.stringify(diamOpts) === JSON.stringify(['14','15']));

    // п.4: «по выбору» сбрасывает чекбоксы
    const opsBefore = await page.$$eval('.tc-op', cs => cs.filter(c => c.checked).length);
    check('4. В полном пакете все 5 операций включены', opsBefore === 5);
    await page.click('#tcPacketCustom');
    await page.waitForTimeout(200);
    const opsAfter = await page.$$eval('.tc-op', cs => cs.filter(c => c.checked).length);
    check('4. «По выбору» сбрасывает чекбоксы операций', opsAfter === 0);
    const totalAfterReset = await page.textContent('#tcTotal');
    check('4. Итого обнулилось после сброса', totalAfterReset.trim() === '0 ₽');
    // включить только монтаж: 185/65 R15 passenger? профиль 65 -> passenger
    await page.click('.tc-op[value="mount"]');
    const totalOneOp = await page.textContent('#tcTotal');
    check('4. Расчёт по одной операции (монтаж R15 x4 = 460)', totalOneOp.trim() === '460 ₽');
    // обратно в полный пакет — всё включено
    await page.click('#tcPacketFull');
    const opsFull = await page.$$eval('.tc-op', cs => cs.filter(c => c.checked).length);
    check('4. Полный пакет возвращает все операции', opsFull === 5);

    // ==== добавление услуги из табов -> итог ====
    await page.check('.svc-tab-panel[data-panel="align"] input[value="Развал-схождение передняя ось"]');
    await page.waitForTimeout(400);
    const summary = await page.textContent('#totalPrice');
    const tcTotal = await page.evaluate(() => window.__tyreCalcResult.total);
    check('Итог = шиномонтаж + развал', summary.includes(String(1900 + tcTotal)));

    // ==== слоты и отправка ====
    await page.selectOption('#branchSelect', { index: 1 });
    await page.waitForTimeout(400);
    await page.selectOption('#postSelect', { index: 1 }).catch(()=>{});
    await page.waitForTimeout(600);
    const slotBtns = await page.$$('#slotsContainer .slot-btn:not(.disabled)');
    check('Слоты загрузились', slotBtns.length > 0);
    await slotBtns[0].click();
    await page.click('#serviceSubmitBtn');
    await page.waitForTimeout(800);
    const msgText = await page.textContent('#serviceCalcMsg');
    check('Заявка создана (booking_handler)', msgText.includes('Заявка создана'));

    const realErrors = errors.filter(e => !e.includes('favicon'));
    check('Нет JS-ошибок на странице', realErrors.length === 0);
    if (realErrors.length) console.log(realErrors);

    console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail ? 1 : 0);
})();
