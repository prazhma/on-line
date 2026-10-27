const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    let ok = 0, fail = 0;
    const check = (name, cond) => { if (cond) { ok++; console.log('PASS:', name); } else { fail++; console.log('FAIL:', name); } };

    // Захват payload заявки из mock-сервера
    let lastBooking = null;
    page.on('request', r => { if (r.url().includes('booking_handler.php')) lastBooking = r.postData(); });

    await page.goto('http://localhost:8099/service.html');
    await page.waitForTimeout(600);

    // ==== 1. Загрузка данных после ввода телефона (эталон guest.html) ====
    await page.click('#servicePhone');
    await page.type('#servicePhone', '9990001234', { delay: 10 });
    await page.waitForTimeout(1500); // дебаунс 400 + запросы
    const carsVisible = await page.isVisible('#svcClientCarsContainer');
    check('1. Гараж клиента показан после ввода телефона', carsVisible);
    const nameVal = await page.inputValue('#serviceName');
    check('1. Имя подтянуто из STOCRM (часть ФИО)', nameVal === 'Иван');
    const carOpts = await page.$$eval('#svcClientCarSelect option', os => os.map(o => o.textContent));
    check('1. Список авто клиента загружен', carOpts.some(t => t.includes('Kia Rio')) && carOpts.some(t => t.includes('Toyota RAV4')));
    check('1. Ручной ввод марки скрыт при найденном клиенте', !(await page.isVisible('#svcCarManualWrap')));
    const plateVal = await page.inputValue('#svcClientCarPlate');
    check('1. Гос.номер подставлен из гаража', plateVal === 'А123ВС 93');
    const hintTxt = await page.textContent('#phoneCheckHint');
    check('1. Hint приветствия постоянного клиента', hintTxt.includes('Здравствуйте'));
    // выбор «другой автомобиль» -> ручной ввод появляется
    await page.selectOption('#svcClientCarSelect', 'new');
    await page.waitForTimeout(200);
    check('1. «Другой автомобиль» показывает ручной ввод', await page.isVisible('#svcCarManualWrap'));
    await page.selectOption('#svcClientCarSelect', '1');
    await page.waitForTimeout(200);
    check('1. Возврат к гаражу скрывает ручной ввод', !(await page.isVisible('#svcCarManualWrap')));

    // ==== 2. Шиномонтаж основной + кнопка «Добавить услуги» -> табы ====
    const catVal = await page.inputValue('#svcCategorySelect');
    check('2. Шиномонтаж выбран по умолчанию', catVal === 'tire');
    await page.waitForTimeout(800); // калькулятор отрисован
    check('2. Калькулятор виден', await page.isVisible('#tyreCalcBox'));
    check('2. Блок прочих услуг скрыт изначально', await page.$eval('#svcExtraBlock', el => el.hidden));
    check('5. Кнопка «Добавить услуги» есть под калькулятором', await page.isVisible('#svcAddBtnHolder .svc-add-btn'));
    const btnCount = await page.$$eval('.svc-add-btn', els => els.length);
    check('2. Кнопка «Добавить услуги» в единственном экземпляре', btnCount === 1);
    await page.click('#svcAddBtnHolder .svc-add-btn');
    await page.waitForTimeout(300);
    check('2. Табы открылись по кнопке из-под калькулятора', !(await page.$eval('#svcExtraBlock', el => el.hidden)));
    const tabsCount = await page.$$eval('#svcTabs .svc-tab', ts => ts.length);
    check('2. Выведены табы с работами (4 таба)', tabsCount === 4);
    check('2. Список доп. работ появился вместе с блоком', await page.isVisible('#svcTabSelect'));
    // переключение таба через выпадающий список
    await page.selectOption('#svcTabSelect', 'rim');
    await page.waitForTimeout(200);
    const rimActive = await page.$eval('.svc-tab-panel[data-panel="rim"]', el => el.classList.contains('active'));
    const alignHidden = !(await page.isVisible('.svc-tab-panel[data-panel="align"]'));
    check('2. Переключение табов списком работает', rimActive && alignHidden);

    // ==== 3/4. Каскад размеров и сброс чекбоксов в «По выбору» ====
    const wVal = await page.inputValue('#tcWidth');
    const pVal = await page.inputValue('#tcProfile');
    const dVal = await page.inputValue('#tcDiameter');
    check('3. Дефолтный размер 205/55 -> только R16', wVal === '205' && pVal === '55' && dVal === '16');
    const profOpts = await page.$$eval('#tcProfile option', os => os.map(o => o.value));
    check('3. Профили ограничены матрицей (для 205: 45..75)', JSON.stringify(profOpts) === JSON.stringify(['45','50','55','60','65','70','75']));
    await page.selectOption('#tcWidth', '185');
    await page.waitForTimeout(200);
    const profOpts185 = await page.$$eval('#tcProfile option', os => os.map(o => o.value));
    check('3. Для 185 профили 50..80 по справочнику', JSON.stringify(profOpts185) === JSON.stringify(['50','55','60','65','70','75','80']));
    await page.selectOption('#tcProfile', '65');
    await page.waitForTimeout(200);
    const diamOpts = await page.$$eval('#tcDiameter option', os => os.map(o => o.value));
    // матрица для 185/65: [13,14,15]; легковые по прайсу: 13-17 -> пересечение 13,14,15
    check('3. Для 185/65 радиусы R13,R14,R15 (легковые)', JSON.stringify(diamOpts) === JSON.stringify(['13','14','15']));

    // п.4: «по выбору» сбрасывает чекбоксы
    const opsBefore = await page.$$eval('.tc-op', cs => cs.filter(c => c.checked).length);
    check('4. В полном пакете все 5 операций включены', opsBefore === 5);
    await page.click('#tcPacketCustom');
    await page.waitForTimeout(200);
    const opsAfter = await page.$$eval('.tc-op', cs => cs.filter(c => c.checked).length);
    check('4. «По выбору» сбрасывает чекбоксы операций', opsAfter === 0);
    const totalAfterReset = await page.textContent('#tcTotal');
    check('4. Итого обнулилось после сброса', totalAfterReset.trim() === '0 ₽');
    // включить только монтаж: 185/65 R13 passenger (выбран первый радиус из каскада) -> монтаж 105 x4 = 420
    await page.click('.tc-op[value="mount"]');
    const totalOneOp = await page.textContent('#tcTotal');
    check('4. Расчёт по одной операции (монтаж 185/65 R13 x4 = 420)', totalOneOp.trim() === '420 ₽');
    // обратно в полный пакет — всё включено
    await page.click('#tcPacketFull');
    const opsFull = await page.$$eval('.tc-op', cs => cs.filter(c => c.checked).length);
    check('4. Полный пакет возвращает все операции', opsFull === 5);

    // ==== добавление услуги из табов -> итог ====
    await page.selectOption('#svcTabSelect', 'align');
    await page.waitForTimeout(300);
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
    await page.fill('#serviceName', 'Иван');
    await page.click('#serviceSubmitBtn');
    await page.waitForTimeout(1000);
    const msgText = await page.textContent('#serviceCalcMsg');
    check('Заявка создана (booking_handler)', msgText.includes('Заявка создана'));
    check('В payload есть comment с расчётом', !!lastBooking && /comment/.test(lastBooking) && /Шиномонтаж/.test(lastBooking));
    // Парсим multipart корректно (в FormData value идёт после \r\n\r\n)
    const getPart = (name) => {
        if (!lastBooking) return null;
        const m = lastBooking.match(new RegExp('name="' + name + '"\\r\\n\\r\\n([^\\r]*)'));
        return m ? m[1] : null;
    };
    check('Для найденного клиента is_guest=0', getPart('is_guest') === '0');
    check('Для найденного клиента client_id передан', !!getPart('client_id'));
    check('car_profile_id из гаража передан', !!getPart('car_profile_id'));

    const realErrors = errors.filter(e => !e.includes('favicon'));
    check('Нет JS-ошибок на странице', realErrors.length === 0);
    if (realErrors.length) console.log(realErrors);

    console.log(`\nRESULT: ${ok} passed, ${fail} failed`);
    await browser.close();
    process.exit(fail ? 1 : 0);
})();
