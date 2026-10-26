const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

    // мок бэкенда
    await page.route('**/get_branches.php*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({
        status: 'success',
        branches: { '668': { CUSTOMER_ID: '668', CUSTOMER_NAME: 'СЦ №7 Динская', ADDRESS: 'ул. Динская', posts: { p1: { POST_ID: '13', NAME: 'Пост 1' }, p2: { POST_ID: '71', NAME: 'Пост 2' } } } },
        config: { branches: { '668': { posts: { p1: { POST_ID: '13', NAME: 'Пост 1' }, p2: { POST_ID: '71', NAME: 'Пост 2' } } } } }
    })}));
    await page.route('**/getslots_b2b.php*', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({
        status: 'success', slots: [ { time: '09:00', available: true }, { time: '10:00', available: false }, { time: '11:00', available: true } ]
    })}));
    let lastBooking = null;
    await page.route('**/booking_handler.php', async r => {
        lastBooking = r.postData();
        await r.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'success' }) });
    });

    await page.goto('http://localhost:8099/service.html');
    await page.waitForTimeout(400);

    const results = [];
    const check = (name, cond) => results.push((cond ? 'PASS' : 'FAIL') + ' — ' + name);

    // 1. Топология: сначала контакты
    const order = await page.evaluate(() => {
        const f = document.getElementById('serviceCalcForm');
        return [...f.querySelectorAll('.svc-step-title')].map(x => x.textContent.trim());
    });
    check('Порядок секций: Ваши данные -> Филиал и пост -> Выбор работ', JSON.stringify(order) === '["Ваши данные","Филиал и пост","Выбор работ"]');

    // 2. Список работ скрыт под кнопкой
    check('Блок работ скрыт (hidden)', await page.locator('#svcExtraBlock').getAttribute('hidden') !== null);
    check('Кнопка "Добавить услуги" видима', await page.locator('#svcAddBtn').isVisible());

    // 3. Категории: до выбора нет калькулятора
    check('Калькулятор отсутствует до выбора категории', await page.locator('#tyreCalcBox').count() === 0);

    // 4. Выбираем Шиномонтаж -> калькулятор появился
    await page.click('.svc-cat-card:has(input[value="tire"])');
    await page.waitForTimeout(500);
    check('Калькулятор появился после выбора «Шиномонтаж»', await page.locator('#tyreCalcBox').count() === 1);
    check('Карточка категории подсвечена (.checked)', await page.locator('.svc-cat-card.checked').count() === 1);

    // 5. Кнопки режима пакета
    check('Есть кнопки Полный пакет / По выбору', await page.locator('#tcPacketFull').isVisible() && await page.locator('#tcPacketCustom').isVisible());
    check('По умолчанию активен «Полный пакет»', await page.locator('#tcPacketFull.active').count() === 1);
    check('Все 5 операций включены (полный пакет)', await page.locator('.tc-op:checked').count() === 5);

    // 6. Расчёт полный пакет легковые R15 x4 = 2500
    await page.selectOption('#tcVehicleType', 'passenger');
    await page.selectOption('#tcWidth', '205');
    await page.selectOption('#tcProfile', '55');
    await page.selectOption('#tcDiameter', '15');
    await page.selectOption('#tcQuantity', '4');
    await page.waitForTimeout(300);
    check('Полный пакет легк. R15x4 = 2500 ₽', (await page.locator('#tcTotal').textContent()).trim() === '2500 ₽');
    check('Превью размера 205/55 R15', (await page.locator('#tcSizeLabel').textContent()).trim() === '205/55 R15');
    check('Итог страницы = от 2500 ₽', (await page.locator('#totalPrice').textContent()).includes('2500'));

    // 7. «По выбору»: снять балансировку -> 2500-155*4=1880, режим сменился автоматически
    await page.click('#tcPacketCustom');
    await page.waitForTimeout(200);
    check('Режим «По выбору» активен', await page.locator('#tcPacketCustom.active').count() === 1);
    await page.uncheck('.tc-op[value="balance"]');
    await page.waitForTimeout(200);
    check('Без балансировки R15x4 = 1880 ₽', (await page.locator('#tcTotal').textContent()).trim() === '1880 ₽');
    // вернуть полный пакет кнопкой
    await page.click('#tcPacketFull');
    await page.waitForTimeout(200);
    check('«Полный пакет» возвращает все операции и 2500 ₽', await page.locator('.tc-op:checked').count() === 5 && (await page.locator('#tcTotal').textContent()).trim() === '2500 ₽');

    // 8. RUN FLAT монтаж+демонтаж x2: 2500 + (115+115)*4 = 3420
    await page.check('#tcRunflat');
    await page.waitForTimeout(200);
    check('RUN FLAT R15x4 = 3420 ₽', (await page.locator('#tcTotal').textContent()).trim() === '3420 ₽');
    await page.uncheck('#tcRunflat');

    // 9. Низкопрофильная: профиль 50 -> тариф LP R17x4 = 3200 + бейдж
    await page.selectOption('#tcProfile', '50');
    await page.selectOption('#tcDiameter', '17');
    await page.waitForTimeout(200);
    check('Профиль 50 -> автопереключение на низкий профиль', (await page.inputValue('#tcVehicleType')) === 'passenger_low');
    check('LP R17x4 = 3200 ₽', (await page.locator('#tcTotal').textContent()).trim() === '3200 ₽');
    check('Бейдж низкопрофильной виден', await page.locator('#tcLowProfileBadge:not([hidden])').count() === 1);

    // 10. Предложение смежных услуг после расчёта
    check('Кнопка подсвечена как предложение (+класс suggest)', await page.locator('#svcAddBtn.suggest').count() === 1);
    await page.click('#svcAddBtn');
    await page.waitForTimeout(200);
    check('По клику блок работ раскрыт', await page.locator('#svcExtraBlock').isHidden() === false);

    // 11. Добавить стороннюю работу: ремонт жгутом 350 -> итог 3200+350=3550
    await page.check('input[value="Ремонт шины жгутом/грибком"]');
    await page.waitForTimeout(200);
    check('Итог с доп. работой = от 3550 ₽', (await page.locator('#totalPrice').textContent()).includes('3550'));

    // 12. Смена категории на Развал -> калькулятор скрыт, автоскролл блока
    await page.click('.svc-cat-card:has(input[value="align"])');
    await page.waitForTimeout(400);
    check('При категории «Развал» калькулятор скрыт', await page.locator('#tyreCalcBox').count() === 0);
    check('Блок работ раскрыт автоматически', await page.locator('#svcExtraBlock').isHidden() === false);

    // 13. Запись: филиалы/посты/слоты через мок API
    await page.selectOption('#branchSelect', '668');
    await page.waitForTimeout(300);
    check('Посты загружены (2)', await page.locator('#postSelect option').count() === 3); // + placeholder
    await page.selectOption('#postSelect', '13');
    await page.waitForTimeout(400);
    check('Слоты отрисованы (3)', await page.locator('#slotsContainer .slot-btn').count() === 3);
    check('Недоступный слот задизейблен', await page.locator('#slotsContainer .slot-btn.disabled').count() === 1);
    await page.click('#slotsContainer .slot-btn:not(.disabled)');
    check('Время выбрано', (await page.inputValue('#selectedTime')).length > 0);

    // 14. Отправка заявки
    await page.fill('#serviceName', 'Тест');
    await page.fill('#servicePhone', '9181234567');
    check('Маска телефона применена', (await page.inputValue('#servicePhone')).startsWith('+7 (918)'));
    // выбрать снова шину чтобы был расчёт
    await page.click('.svc-cat-card:has(input[value="tire"])');
    await page.waitForTimeout(400);
    await page.click('#serviceSubmitBtn');
    await page.waitForTimeout(600);
    check('Сообщение об успехе показано', await page.locator('#serviceCalcMsg.success').count() === 1);
    check('booking_handler получил payload с customer_id/post_id/services_json',
        !!lastBooking && lastBooking.includes('customer_id') && lastBooking.includes('post_id') && lastBooking.includes('%D0%A8%D0%B8%D0%BD%D0%BE%D0%BC%D0%BE%D0%BD%D1%82%D0%B0%D0%B6') );
    check('JS-ошибок на странице нет (' + errors.join('; ') + ')', errors.length === 0);

    console.log(results.join('\n'));
    const failed = results.filter(r => r.startsWith('FAIL')).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    await browser.close();
    process.exit(failed ? 1 : 0);
})();
