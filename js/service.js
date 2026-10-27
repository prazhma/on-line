/* ============================================================
   СТРАНИЦА service.html — Калькулятор услуг + реальная запись
   Автономная страница: не трогает guest.html / guest.js.
   Подключённые функции проекта:
   - get_branches.php      (филиалы + посты из config.json)
   - getslots_b2b.php      (реальные слоты STOCRM по дате/посту)
   - booking_handler.php   (создание сделки + брони в STOCRM)
   - js/tyre-calculator.js + tyre-prices.json (шинный калькулятор)
   ============================================================ */

let svcGlobalConfig = null;

const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---------- Появление / исчезновение шинного калькулятора
   (по выбору основной работы «Шиномонтаж») ---------- */

// Возврат кнопки «Добавить услуги» на исходное место при удалении калькулятора
function restoreSvcAddBtnHome() {
    const btn = document.getElementById('svcAddBtn');
    if (!btn || !window.__svcAddBtnHome) return;
    const holder = document.getElementById('svcAddBtnHolder');
    if (holder && holder.parentNode === window.__svcAddBtnHome) return; // уже дома
    if (holder) holder.remove();
    window.__svcAddBtnHome.prepend(btn);
}

function selectedSvcCategory() {
    const sel = document.getElementById('svcCategorySelect');
    return sel ? sel.value : 'tire';
}

/* Последовательная очередь для loadTyrePrices().then(...) — чтобы асинхронный
   догруз прайса не перекрывал синхронные действия пользователя (смена категории) */
let svcTyreChain = Promise.resolve();

function refreshServiceTyreCalculator() {
    const need = selectedSvcCategory() === 'tire';
    const box = document.getElementById('tyreCalcBox');

    if (need) {
        if (box) return; // уже отрисован — перерисовка не нужна
        svcTyreChain = svcTyreChain.then(() => loadTyrePrices()).then(() => {
            // актуальная категория на момент выполнения цепочки
            if (selectedSvcCategory() !== 'tire') return;
            if (document.getElementById('tyreCalcBox')) return;
            renderTyreCalculator();
            calcTyrePrice();
            updateServiceSummary();
            checkAndLoadSlots(); // длительность визита могла измениться -> обновить слоты
            // после расчёта — предложить добавить другие работы
            suggestExtraServices();
        }).catch(e => console.warn('Шинный калькулятор недоступен:', e));
    } else if (box) {
        box.remove();
        restoreSvcAddBtnHome();
        window.__tyreCalcResult = null;
        updateServiceSummary();
        checkAndLoadSlots();
    }
}

/* Предложение смежных услуг: подсвечиваем кнопку «Добавить услуги» */
function suggestExtraServices() {
    const btn = document.getElementById('svcAddBtn');
    if (!btn || !document.getElementById('svcExtraBlock').hidden) return;
    btn.classList.add('suggest');
    btn.textContent = 'Добавить сопутствующие услуги (развал, правка дисков, ремонт)';
}

/* ---------- Синхронизация выпадающего списка «Дополнительные работы»
   с табами скрытого блока svcExtraBlock ---------- */

const svcTabNames = ['align', 'rim', 'repair', 'other'];

function syncTabSelectGroup() {
    const grp = document.querySelector('.svc-tab-select-group');
    const block = document.getElementById('svcExtraBlock');
    if (!grp || !block) return;
    grp.hidden = block.hidden; // показываем только когда блок услуг раскрыт
}

function applyTabSelect(tabName) {
    if (!svcTabNames.includes(tabName)) return;
    switchSvcTab(tabName);
}

/* Авто-раскрытие блока при выборе нешиномонтажной категории (открываем нужный таб) */
function switchSvcTab(tabName) {
    const tabs = document.querySelectorAll('#svcTabs .svc-tab');
    if (!tabs.length) return;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.svc-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabName));
}

function applyCategoryToExtras(cat) {
    const block = document.getElementById('svcExtraBlock');
    const btn = document.getElementById('svcAddBtn');
    if (!block || !btn) return;
    const map = { align: 'align', rim: 'rim', repair: 'repair' };
    if (map[cat]) {
        // если калькулятор открыт и кнопка перемещена под него — возвращаем её на место
        restoreSvcAddBtnHome();
        block.hidden = false;
        btn.classList.remove('suggest');
        btn.textContent = 'Свернуть услуги';
        switchSvcTab(map[cat]);
        syncTabSelectGroup();
        const tabSel = document.getElementById('svcTabSelect');
        if (tabSel) tabSel.value = map[cat];
        block.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else if (cat === 'tire') {
        // возврат к шиномонтажу: сворачиваем блок доп. работ, оставляем одну кнопку
        block.hidden = true;
        btn.classList.remove('suggest');
        btn.textContent = 'Добавить услуги';
        syncTabSelectGroup();
    }
}

/* ---------- Проверка номера и поиск клиента в STOCRM
   Поведение строго по эталону guest.html/guest.js:
   hint «Укажите номер телефона» -> «Проверка...» -> «Здравствуйте, Имя!» /
   «Новый клиент»; блок авто из гаража (clientCarsContainer); ручной ввод
   марки/номера показывается только для нового клиента или «другого авто». ---------- */

let svcClientId = null;
let svcIsClientRegistered = false;
let svcClientCarsList = [];
let svcClientLookupTimer = null;
let svcLastLookupPhone = ''; // защита от повторного поиска при каждом blur

function svcHint(text, color) {
    const el = document.getElementById('phoneCheckHint');
    if (!el) return;
    el.textContent = text;
    el.style.color = color;
}

function svcShowManualCar(show) {
    const wrap = document.getElementById('svcCarManualWrap');
    if (wrap) wrap.style.display = show ? '' : 'none';
}

async function svcLookupClient(phone) {
    const carsContainer = document.getElementById('svcClientCarsContainer');
    const carSelect = document.getElementById('svcClientCarSelect');
    const nameInput = document.getElementById('serviceName');

    const digits = phone.replace(/\D/g, '');
    if (digits.length < 11) {
        svcHint('Укажите номер телефона', '#777777');
        return;
    }
    // Повторный поиск того же номера не нужен (blur + 11 цифр могут совпасть)
    if (digits === svcLastLookupPhone && (svcIsClientRegistered || svcClientId === 0)) return;
    svcLastLookupPhone = digits;

    svcClientId = null;
    svcIsClientRegistered = false;
    svcClientCarsList = [];
    if (carsContainer) carsContainer.style.display = 'none';
    svcShowManualCar(false);

    svcHint('Проверка номера телефона...', '#1e5799');

    try {
        const res = await fetch('api/customer.php?action=check_client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();

        if (data.status === 'success' && data.client) {
            svcIsClientRegistered = true;
            svcClientId = data.client.id || data.client.CONTACT_ID;

            // Имя подставляем так же, как в guest.js (часть ФИО)
            if (nameInput && data.client.name) {
                const parts = data.client.name.trim().split(/\s+/);
                const firstName = parts[1] || parts[0];
                if (!nameInput.value.trim()) nameInput.value = firstName;
                svcHint('Здравствуйте, ' + firstName + '! Рады видеть вас снова.', '#15803d');
            } else {
                svcHint('Номер подтвержден (постоянный клиент)', '#15803d');
            }

            // Гараж клиента (api/cars.php) — выбор авто, как в guest.html
            try {
                const resCars = await fetch(`api/cars.php?client_id=${encodeURIComponent(svcClientId)}`);
                const dataCars = await resCars.json();

                if (dataCars.status === 'success' && dataCars.cars && dataCars.cars.length > 0) {
                    svcClientCarsList = dataCars.cars;
                    if (carSelect) {
                        carSelect.innerHTML = '<option value="">-- Выберите ваш автомобиль --</option>';
                        svcClientCarsList.forEach((car, index) => {
                            const opt = document.createElement('option');
                            opt.value = index;
                            opt.textContent = `${car.brand || 'Марка'} ${car.model || ''} (${car.plate && car.plate !== '—' ? car.plate : (car.vin && car.vin !== '—' ? car.vin : 'Без номера')})`;
                            carSelect.appendChild(opt);
                        });
                        const newOpt = document.createElement('option');
                        newOpt.value = 'new';
                        newOpt.textContent = 'Указать другой / новый автомобиль';
                        carSelect.appendChild(newOpt);

                        if (carsContainer) carsContainer.style.display = '';
                        carSelect.value = '0';
                        svcOnClientCarSelected(carSelect);
                    }
                } else {
                    if (carsContainer) carsContainer.style.display = 'none';
                    // клиент есть, машин нет — даём ввести марку вручную
                    svcShowManualCar(true);
                }
            } catch (carErr) {
                console.warn('Ошибка получения автомобилей клиента:', carErr);
                if (carsContainer) carsContainer.style.display = 'none';
                svcShowManualCar(true);
            }

        } else {
            svcClientId = null;
            svcIsClientRegistered = false;
            if (carsContainer) carsContainer.style.display = 'none';
            svcHint('Новый клиент (продолжайте заполнение формы)', '#856404');
            svcShowManualCar(true);
        }
    } catch (e) {
        console.error('Ошибка запроса check_client:', e);
        svcClientId = null;
        svcIsClientRegistered = false;
        svcLastLookupPhone = ''; // при ошибке разрешаем повторный поиск
        if (carsContainer) carsContainer.style.display = 'none';
        svcHint('Укажите номер телефона', '#777777');
        svcShowManualCar(true);
    }
}

// Выбор автомобиля из гаража — аналог onClientCarSelected из guest.js
function svcOnClientCarSelected(selectObj) {
    const val = selectObj.value;
    const plateInput = document.getElementById('svcClientCarPlate');
    const hiddenCarId = document.getElementById('svcSelectedCarProfileId');

    if (val === 'new' || val === '') {
        if (hiddenCarId) hiddenCarId.value = '';
        if (plateInput) plateInput.value = '';
        svcShowManualCar(true); // выбран «другой автомобиль» -> ручной ввод
    } else {
        const car = svcClientCarsList[parseInt(val, 10)];
        if (car) {
            if (hiddenCarId) hiddenCarId.value = car.id || car.CAR_PROFILE_ID || '';
            if (plateInput) plateInput.value = (car.plate && car.plate !== '—') ? car.plate : (car.vin !== '—' ? car.vin : '');
            svcShowManualCar(false);
        }
    }
}

/* Итоговые марка/номер для payload (формат guest.js):
   brand = "Марка Модель" из гаража либо ручной ввод; plate = гос.номер/VIN */
function svcGetCarInfo() {
    const carsContainer = document.getElementById('svcClientCarsContainer');
    const carSel = document.getElementById('svcClientCarSelect');
    const plateEl = document.getElementById('svcClientCarPlate');
    const manualBrand = document.getElementById('serviceCarBrandManual');
    const manualPlate = document.getElementById('serviceCarPlateManual');

    let brand = '', plate = '';

    if (carsContainer && carsContainer.style.display !== 'none' && carSel && carSel.value !== '' && carSel.value !== 'new') {
        const car = svcClientCarsList[parseInt(carSel.value, 10)];
        if (car) {
            brand = ((car.brand || '') + ' ' + (car.model || '')).trim() || car.title || '';
            plate = plateEl ? plateEl.value.trim() : '';
        }
    } else if (manualBrand && manualBrand.offsetParent !== null) {
        brand = manualBrand.value.trim();
        plate = manualPlate ? manualPlate.value.trim() : '';
    }
    return { brand, plate };
}

/* ---------- Итог страницы ---------- */

function updateServiceSummary() {
    let time = 0, basePrice = 0;

    document.querySelectorAll('#serviceCalcForm .service-item input:checked').forEach(cb => {
        time += parseInt(cb.dataset.time || 0);
        basePrice += parseInt(cb.dataset.price || 0);
    });

    const tc = window.__tyreCalcResult;
    const total = basePrice + (tc && tc.total > 0 ? tc.total : 0);

    const timeEl = document.getElementById('totalTime');
    const priceEl = document.getElementById('totalPrice');
    if (timeEl) timeEl.textContent = time + ' мин';
    if (priceEl) priceEl.textContent = 'от ' + total + ' ₽';

    return { time, total };
}

/* ---------- Колбэк tyre-calculator.js ---------- */

window.updateSummary = function () {
    const s = updateServiceSummary();
    return s.time || 60;
};

/* ================= ФИЛИАЛЫ / ПОСТЫ (get_branches.php) ================= */

async function initServiceBookingModule() {
    buildWeekTab(0);
    const branchSelect = document.getElementById('branchSelect');
    if (!branchSelect) return;

    try {
        const res = await fetch('get_branches.php');
        const data = await res.json();
        const branchKeys = data.branches ? Object.keys(data.branches) : [];

        if (data.status !== 'success' || branchKeys.length === 0) {
            branchSelect.innerHTML = '<option value="">Филиалы не найдены в конфигурации</option>';
            return;
        }

        svcGlobalConfig = data.config || { branches: data.branches };

        branchSelect.innerHTML = '<option value="">-- Выберите филиал --</option>';
        for (let id of branchKeys) {
            let branch = data.branches[id];
            let opt = document.createElement('option');
            let cId = branch.CUSTOMER_ID || branch.id || id;
            let cName = branch.CUSTOMER_NAME || branch.name || ('Филиал #' + cId);
            let cAddr = branch.ADDRESS || branch.address || '';
            opt.value = cId;
            opt.setAttribute('data-name', cName);
            opt.textContent = cName + (cAddr ? ' (' + cAddr + ')' : '');
            branchSelect.appendChild(opt);
        }

        branchSelect.addEventListener('change', function () {
            let branchId = this.value;
            let postSelect = document.getElementById('postSelect');
            postSelect.innerHTML = '<option value="">-- Выберите пост --</option>';
            document.getElementById('selectedTime').value = '';

            if (!svcGlobalConfig || !branchId || !svcGlobalConfig.branches[branchId]) {
                postSelect.disabled = true;
                resetSlotsNotice();
                return;
            }

            let posts = svcGlobalConfig.branches[branchId].posts || {};
            let postIds = Object.keys(posts);
            if (postIds.length === 0) {
                postSelect.disabled = true;
                resetSlotsNotice();
                return;
            }

            for (let pId of postIds) {
                let opt = document.createElement('option');
                opt.value = posts[pId].POST_ID || pId;
                opt.textContent = posts[pId].NAME || ('Пост #' + pId);
                postSelect.appendChild(opt);
            }
            postSelect.disabled = false;
            if (postIds.length === 1) {
                postSelect.value = posts[postIds[0]].POST_ID || postIds[0];
            }
            checkAndLoadSlots();
        });

        document.getElementById('postSelect').addEventListener('change', checkAndLoadSlots);

    } catch (e) {
        console.error('Ошибка загрузки филиалов:', e);
        branchSelect.innerHTML = '<option value="">Ошибка загрузки филиалов</option>';
    }
}

function resetSlotsNotice() {
    const c = document.getElementById('slotsContainer');
    if (c) c.innerHTML = '<div class="slots-empty-notice" style="grid-column: 1 / -1;">Выберите филиал, дату и пост обслуживания</div>';
}

/* ================= ДАТЫ (недели, как в guest.js) ================= */

function buildWeekTab(weekIndex) {
    let g4 = document.getElementById('grid_v4');
    if (!g4) return;
    g4.innerHTML = '';
    let today = new Date();
    let startIdx = weekIndex === 0 ? 0 : 7;

    for (let i = 0; i < 7; i++) {
        let d = new Date(today);
        d.setDate(today.getDate() + startIdx + i);
        let dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        let label = (startIdx === 0 && i === 0) ? 'Сегодня' : daysOfWeek[d.getDay()];

        let c4 = document.createElement('div');
        c4.className = 'card-v4' + (i === 0 && weekIndex === 0 ? ' selected' : '');
        c4.setAttribute('data-date', dateStr);
        c4.innerHTML = `<div class="name">${label}</div><div class="date">${d.getDate()} ${months[d.getMonth()]}</div>`;
        c4.onclick = () => selectDate(dateStr, c4);
        g4.appendChild(c4);

        if (i === 0 && weekIndex === 0) {
            const dateInp = document.getElementById('dateSelect');
            if (dateInp) dateInp.value = dateStr;
        }
    }
}

function selectDate(dateStr, element) {
    document.querySelectorAll('#grid_v4 .card-v4').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    const dateInp = document.getElementById('dateSelect');
    if (dateInp) dateInp.value = dateStr;
    document.getElementById('selectedTime').value = '';
    checkAndLoadSlots();
}

window.switchWeekTab = function (idx) {
    document.getElementById('btnWeekCurrent').classList.toggle('active', idx === 0);
    document.getElementById('btnWeekNext').classList.toggle('active', idx === 1);
    buildWeekTab(idx);
    let firstCard = document.querySelector('#grid_v4 .card-v4');
    if (firstCard) firstCard.click();
};

/* ================= СЛОТЫ (getslots_b2b.php) ================= */

async function checkAndLoadSlots() {
    let container = document.getElementById('slotsContainer');
    let branchId = document.getElementById('branchSelect').value;
    let postId = document.getElementById('postSelect').value;
    let date = document.getElementById('dateSelect').value;

    if (!branchId || !postId || !date || !container) return;

    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #666; font-weight: bold; padding: 10px;">Загрузка свободных окон...</div>';

    const summary = updateServiceSummary();
    const duration = Math.max(summary.time, 30); // минимум 30 мин

    try {
        let res = await fetch(`getslots_b2b.php?customer_id=${branchId}&post_id=${postId}&date=${date}&duration=${duration}`);
        let data = await res.json();

        if (data.status === 'success') {
            container.innerHTML = '';
            if (!data.slots || data.slots.length === 0) {
                container.innerHTML = '<span style="color: #dc2626; grid-column: 1 / -1; font-weight: bold; text-align: center; padding: 10px;">Нет свободного времени на выбранную дату</span>';
                return;
            }
            data.slots.forEach(slot => {
                let btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'slot-btn' + (slot.available ? '' : ' disabled');
                btn.textContent = slot.time;
                btn.disabled = !slot.available;
                if (slot.available) {
                    btn.onclick = () => {
                        document.querySelectorAll('#slotsContainer .slot-btn').forEach(b => b.classList.remove('selected'));
                        btn.classList.add('selected');
                        document.getElementById('selectedTime').value = slot.time;
                    };
                }
                container.appendChild(btn);
            });
        } else {
            container.innerHTML = `<span style="color: #dc2626; grid-column: 1 / -1; font-weight: bold; text-align: center; padding: 10px;">${data.message || 'Ошибка расчета слотов'}</span>`;
        }
    } catch (e) {
        console.error('Ошибка слотов:', e);
        container.innerHTML = '<span style="color: #dc2626; grid-column: 1 / -1; font-weight: bold; text-align: center; padding: 10px;">Ошибка связи со STOCRM</span>';
    }
}

/* ================= ОТПРАВКА ЗАЯВКИ (booking_handler.php) ================= */

window.handleServiceCalcSubmit = async function (e) {
    e.preventDefault();

    const name = document.getElementById('serviceName').value.trim();
    const phone = document.getElementById('servicePhone').value.trim();
    const carInfo = svcGetCarInfo(); // марка/номер — по логике guest.js (гараж или ручной ввод)
    const branchId = document.getElementById('branchSelect').value;
    const postId = document.getElementById('postSelect').value;
    const date = document.getElementById('dateSelect').value;
    const time = document.getElementById('selectedTime').value;
    const msg = document.getElementById('serviceCalcMsg');
    msg.classList.add('is-visible');

    // --- Собираем услуги ---
    const services = [];
    document.querySelectorAll('#serviceCalcForm .service-item input:checked').forEach(cb => {
        services.push({
            name: cb.value,
            category: cb.dataset.category,
            price: parseInt(cb.dataset.price || 0),
            duration: parseInt(cb.dataset.time || 0)
        });
    });

    const tc = window.__tyreCalcResult;
    if (tc && tc.total > 0) {
        const st = tc.state;
        services.push({
            name: `Шиномонтаж ${st.width}/${st.profile} R${st.diameter}, ${st.quantity} кол.`,
            category: 'Шиномонтаж',
            price: tc.total,
            duration: Math.max(services.reduce((s, x) => s + (x.duration || 0), 0), 30),
            details: tc.details
        });
    }

    if (services.length === 0) {
        msg.className = 'message error is-visible';
        msg.textContent = 'Выберите хотя бы одну услугу.';
        return false;
    }

    if (!branchId || !postId || !date || !time) {
        msg.className = 'message error is-visible';
        msg.textContent = 'Выберите филиал, дату и свободное время визита.';
        return false;
    }

    const summary = updateServiceSummary();
    const durationMins = Math.max(summary.time, 30);

    // payload для booking_handler.php (формат идентичен guest.js)
    const worksArr = services.map(s => ({ name: s.name, price: s.price, duration: s.duration || 30 }));

    // ===== Результат шинного калькулятора — в комментарий к сделке =====
    // Формируем строку "Шиномонтаж <размер>, <кол-во> кол.: <детализация> = <итого> ₽"
    let calcComment = '';
    if (tc && tc.total > 0) {
        const stC = tc.state;
        const sizeStr = stC.width ? `${stC.width}/${stC.profile} R${stC.diameter}` : `R${stC.diameter}`;
        const vtNames = { passenger: 'легковые', passenger_low: 'легковые LP', crossover: 'кроссовер/внедорожник', light_truck: 'грузик/микроавтобус' };
        const parts = (tc.details || []).map(x => `${x.name} ${x.pricePerWheel}×${stC.quantity}=${x.total}`).join(', ');
        calcComment = `Шиномонтаж ${sizeStr}, ${stC.quantity} кол. (${vtNames[stC.vtKey] || stC.vtKey}${stC.runflat ? ', RUN FLAT' : ''}): ${parts} = ${tc.total} ₽`;
    }

    const formData = new FormData();
    formData.append('customer_id', branchId);
    formData.append('post_id', postId);
    formData.append('date', date);
    formData.append('time', time);
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('car_brand', carInfo.brand);
    formData.append('car_plate', carInfo.plate || '');
    formData.append('duration', durationMins);
    formData.append('services_json', JSON.stringify(worksArr));
    formData.append('comment', calcComment); // расчёт калькулятора -> в COMMENT сделки (см. booking_handler.php)

    // Как в guest.js: для найденного клиента — client_id и car_profile_id, is_guest=0
    if (svcClientId) {
        formData.append('client_id', svcClientId);
    }
    const hiddenCarId = document.getElementById('svcSelectedCarProfileId');
    if (hiddenCarId && hiddenCarId.value) {
        formData.append('car_profile_id', hiddenCarId.value);
    }
    formData.append('is_guest', svcIsClientRegistered ? '0' : '1');

    const submitBtn = document.getElementById('serviceSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка заявки в STOCRM...';

    try {
        let res = await fetch('booking_handler.php', { method: 'POST', body: formData });
        let result = await res.json();

        if (result.status === 'success') {
            msg.className = 'message success is-visible';
            msg.innerHTML = `✔ Заявка создана! Клиент <b>${escapeHtml(name)}</b>, ждём вас <b>${escapeHtml(date)} в ${escapeHtml(time)}</b>.<br>Менеджер свяжется для подтверждения по номеру ${escapeHtml(phone)}.`;
            submitBtn.style.display = 'none';

            setTimeout(() => {
                document.getElementById('serviceCalcForm').reset();
                msg.className = 'message';
                msg.style.display = 'none';
                submitBtn.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Создать заявку на запись';
                buildWeekTab(0);
                updateServiceSummary();
            }, 8000);
        } else {
            msg.className = 'message error is-visible';
            msg.textContent = 'Ошибка: ' + (result.message || 'Не удалось создать запись');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Создать заявку на запись';
        }
    } catch (err) {
        console.error('Ошибка записи:', err);
        msg.className = 'message error is-visible';
        msg.textContent = 'Ошибка отправки данных: ' + err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Создать заявку на запись';
    }

    return false;
};

/* ================= ИНИЦИАЛИЗАЦИЯ ================= */

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('serviceCalcForm');
    if (!form) return;

    initServiceBookingModule();

    // Шиномонтаж — основная работа по умолчанию: сразу показываем калькулятор
    refreshServiceTyreCalculator();

    // Выбор основной работы: Шиномонтаж -> калькулятор; прочие -> авто-раскрытие блока услуг
    const svcCategorySelect = document.getElementById('svcCategorySelect');
    if (svcCategorySelect) {
        svcCategorySelect.addEventListener('change', function () {
            refreshServiceTyreCalculator();
            applyCategoryToExtras(this.value);
        });
    }

    // Выпадающий список «Дополнительные работы» — переключает табы блока
    const svcTabSelect = document.getElementById('svcTabSelect');
    if (svcTabSelect) {
        svcTabSelect.addEventListener('change', function () { applyTabSelect(this.value); });
    }

    // Кнопка «Добавить услуги» — раскрытие/сворачивание скрытого блока работ.
    // Экземпляр кнопки ОДИН: когда калькулятор открыт, кнопка физически
    // перемещена под калькулятор (см. tyre-calculator.js) — обработчик на ней сохраняется.
    const svcAddBtn = document.getElementById('svcAddBtn');
    const svcExtraBlock = document.getElementById('svcExtraBlock');

    function toggleExtras() {
        if (!svcAddBtn || !svcExtraBlock) return;
        svcExtraBlock.hidden = !svcExtraBlock.hidden;
        svcAddBtn.classList.remove('suggest');
        svcAddBtn.textContent = svcExtraBlock.hidden ? 'Добавить услуги' : 'Свернуть услуги';
        syncTabSelectGroup(); // показываем/прячем список «Дополнительные работы»
        if (!svcExtraBlock.hidden && svcAddBtn.closest('#tyreCalcBox')) {
            // находимся под калькулятором — скроллим к раскрытым табам
            svcExtraBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    if (svcAddBtn) svcAddBtn.addEventListener('click', toggleExtras);

    // Табы прочих услуг (кнопки-табы и выпадающий список синхронны)
    const svcTabs = document.getElementById('svcTabs');
    if (svcTabs) {
        svcTabs.addEventListener('click', function (e) {
            const t = e.target.closest('.svc-tab');
            if (!t) return;
            switchSvcTab(t.dataset.tab);
            const tabSel = document.getElementById('svcTabSelect');
            if (tabSel) tabSel.value = t.dataset.tab;
        });
    }

    // Отмеченные чекбоксы прочих работ -> пересчёт итога + слоты
    form.addEventListener('change', function (e) {
        const t = e.target;
        if (!t.matches('.service-item input[type="checkbox"]')) return;
        updateServiceSummary();
        checkAndLoadSlots();
    });

    // Маска телефона — как в guest.js + автопроверка клиента после полного номера
    const phoneEl = document.getElementById('servicePhone');
    if (phoneEl) {
        phoneEl.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '');
            if (!v) { this.value = ''; return; }
            if (['7', '8', '9'].includes(v[0])) {
                if (v[0] === '9') v = '7' + v;
                let out = '+7 ';
                if (v.length > 1) out += '(' + v.substring(1, 4);
                if (v.length >= 5) out += ') ' + v.substring(4, 7);
                if (v.length >= 8) out += '-' + v.substring(7, 9);
                if (v.length >= 10) out += '-' + v.substring(9, 11);
                this.value = out;
            } else {
                this.value = '+' + v.substring(0, 15);
            }

            clearTimeout(svcClientLookupTimer);
            if (this.value.replace(/\D/g, '').length === 11) {
                // как guest.js: handlePhoneBlurCheck() по достижении 11 цифр
                svcClientLookupTimer = setTimeout(() => svcLookupClient(this.value), 400);
            } else {
                svcHint('Укажите номер телефона', '#777777');
                const carsContainer = document.getElementById('svcClientCarsContainer');
                if (carsContainer) carsContainer.style.display = 'none';
                svcShowManualCar(false);
                svcClientId = null;
                svcIsClientRegistered = false;
                svcLastLookupPhone = ''; // номер меняется — поиск нужно будет выполнить заново
            }
        });
        phoneEl.addEventListener('blur', function () {
            if (this.value.replace(/\D/g, '').length === 11) svcLookupClient(this.value);
        });
    }

    // Выбор авто из гаража клиента
    const svcCarSel = document.getElementById('svcClientCarSelect');
    if (svcCarSel) {
        svcCarSel.addEventListener('change', function () { svcOnClientCarSelected(this); });
    }

    // ===== Кнопка «Сбросить всё» =====
    const resetBtn = document.getElementById('svcResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            form.reset(); // снимает чекбоксы услуг, возвращает имя/телефон/марку

            // Категория по умолчанию — Шиномонтаж (основная работа)
            const catSel = document.getElementById('svcCategorySelect');
            if (catSel) catSel.value = 'tire';

            // Удаляем калькулятор и возвращаем кнопку «Добавить услуги» на место
            const box = document.getElementById('tyreCalcBox');
            if (box) box.remove();
            restoreSvcAddBtnHome();
            window.__tyreCalcResult = null;
            window.__tcPacketFull = true;

            // Сворачиваем блок прочих услуг, сбрасываем табы на первый
            const extraBlock = document.getElementById('svcExtraBlock');
            const addBtn = document.getElementById('svcAddBtn');
            if (extraBlock) extraBlock.hidden = true;
            if (addBtn) { addBtn.classList.remove('suggest'); addBtn.textContent = 'Добавить услуги'; }
            switchSvcTab('align');
            const tabSelReset = document.getElementById('svcTabSelect');
            if (tabSelReset) tabSelReset.value = 'align';
            syncTabSelectGroup();

            // Скрываем гараж клиента/ручной ввод, сбрасываем состояние поиска
            const carsContainer = document.getElementById('svcClientCarsContainer');
            if (carsContainer) carsContainer.style.display = 'none';
            svcShowManualCar(false);
            const carSelReset = document.getElementById('svcClientCarSelect');
            if (carSelReset) carSelReset.innerHTML = '';
            const plateReset = document.getElementById('svcClientCarPlate');
            if (plateReset) plateReset.value = '';
            const hidCarReset = document.getElementById('svcSelectedCarProfileId');
            if (hidCarReset) hidCarReset.value = '';
            svcClientId = null;
            svcIsClientRegistered = false;
            svcClientCarsList = [];
            svcLastLookupPhone = '';
            svcHint('Укажите номер телефона', '#777777');

            // Сброс выбора даты/времени -> текущая неделя, слоты чистим
            buildWeekTab(0);
            document.getElementById('selectedTime').value = '';
            resetSlotsNotice();

            // Сообщение об ошибке/успехе прячем, кнопку отправки возвращаем
            const msg = document.getElementById('serviceCalcMsg');
            if (msg) { msg.className = 'message'; msg.style.display = ''; msg.textContent = ''; }
            const submitBtn = document.getElementById('serviceSubmitBtn');
            if (submitBtn) { submitBtn.style.display = ''; submitBtn.disabled = false; submitBtn.textContent = 'Создать заявку на запись'; }

            updateServiceSummary();
        });
    }

    updateServiceSummary();
});
