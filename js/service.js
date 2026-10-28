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

/* ---------- Шинный калькулятор — основная работа, показывается по умолчанию.
   Блок #tyreCalcBox вставляется в слот #svcTyreCalcSlot (под заголовком «Выбор работ»),
   кнопка «Добавить услуги» и табы прочих работ — сразу под калькулятором. ---------- */

// Возврат блока «Добавить услуги» на исходное место (используется при сбросе)
function restoreSvcAddBtnHome() {
    const btn = document.getElementById('svcAddBtn');
    if (!btn || !window.__svcAddBtnHome) return;
    const holder = document.getElementById('svcAddBtnHolder');
    if (holder && holder.parentNode === window.__svcAddBtnHome) return; // уже дома
    if (holder) holder.remove();
    window.__svcAddBtnHome.prepend(btn);
}

function refreshServiceTyreCalculator() {
    loadTyrePrices().then(() => {
        // ВАЖНО: calcTyrePrice() здесь НЕ вызываем — по ТЗ расчёта по умолчанию нет.
        // Состояние калькулятора определяет applySliderState() внутри
        // renderTyreCalculator(): слайдер выключен -> блок скрыт, итог пустой;
        // слайдер включён -> идёт расчёт.
        renderTyreCalculator();
        updateServiceSummary();
        checkAndLoadSlots(); // длительность визита могла измениться -> обновить слоты
        // после расчёта — предложить добавить другие работы
        suggestExtraServices();
    });
}

/* Предложение смежных услуг: подсвечиваем кнопку «Добавить услуги» */
function suggestExtraServices() {
    const btn = document.getElementById('svcAddBtn');
    if (!btn || !document.getElementById('svcExtraBlock').hidden) return;
    btn.classList.add('suggest');
    btn.textContent = '＋ Добавить сопутствующие услуги (развал, правка дисков, ремонт)';
}

/* Авто-раскрытие нужного таба при выборе нешиномонтажной категории */
function switchSvcTab(tabName) {
    const tabs = document.querySelectorAll('#svcTabs .svc-tab');
    if (!tabs.length) return;
    tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
    document.querySelectorAll('.svc-tab-panel').forEach(p => p.classList.toggle('active', p.dataset.panel === tabName));
}

/* ---------- Определение телефона и поиск клиента в STOCRM
   (api/customer.php action=check_client, как в гостевой форме) ---------- */

let svcClientId = null;
let svcClientLookupTimer = null;

async function svcLookupClient(phone) {
    const digits = phone.replace(/\D/g, '');
    const infoBox = document.getElementById('svcClientInfo');
    const manualWrap = document.getElementById('svcCarManualWrap');
    const manualInput = document.getElementById('serviceCarBrandManual');
    svcClientId = null;
    if (infoBox) infoBox.hidden = true;
    // Ручной ввод марки показываем только если клиент НЕ найден
    if (manualWrap) manualWrap.classList.remove('is-hidden');
    if (manualWrap) manualWrap.hidden = false;
    if (manualInput) manualInput.value = '';
    if (digits.length !== 11) return;

    try {
        const res = await fetch('api/customer.php?action=check_client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        const data = await res.json();
        if (data.status !== 'success' || !data.client) return;

        svcClientId = data.client.id || null;

        // Подставляем имя, если пользователь ещё ничего не ввёл
        const nameEl = document.getElementById('serviceName');
        if (nameEl && !nameEl.value.trim() && data.client.name) nameEl.value = data.client.name;

        // Список автомобилей клиента
        let cars = [];
        if (svcClientId) {
            try {
                const cres = await fetch(`api/cars.php?client_id=${svcClientId}`);
                const cdata = await cres.json();
                if (cdata.status === 'success') cars = cdata.cars || [];
            } catch (e) { /* авто не критично */ }
        }

        const carSel = document.getElementById('serviceCarBrand');
        if (carSel) {
            carSel.innerHTML = '<option value="">— Другой автомобиль —</option>' +
                cars.map(c => `<option value="${escapeHtml(c.title)}">${escapeHtml(c.title)}${c.plate && c.plate !== '—' ? ' (' + escapeHtml(c.plate) + ')' : ''}</option>`).join('');
            if (cars.length === 1) carSel.value = cars[0].title;
        }
        const clientNameEl = document.getElementById('svcClientName');
        if (clientNameEl) clientNameEl.textContent = data.client.name ? '· ' + data.client.name : '';
        if (infoBox) infoBox.hidden = false;
        // Клиент найден — поле «Марка авто (необязательно)» СКРЫВАЕМ (выбор авто идёт из карточки клиента)
        if (manualWrap) manualWrap.classList.add('is-hidden');
    } catch (e) {
        console.warn('Поиск клиента недоступен:', e);
    }
}

function getSelectedCarBrand() {
    const infoBox = document.getElementById('svcClientInfo');
    const sel = document.getElementById('serviceCarBrand');
    if (infoBox && !infoBox.hidden && sel && sel.value) return sel.value.trim();
    const manual = document.getElementById('serviceCarBrandManual');
    return manual ? manual.value.trim() : '';
}

/* ---------- Итог страницы ---------- */

// Длительность шиномонтажа по прейскуранту: ~5 мин на операцию на колесо
function svcTyreDuration(tc) {
    if (!tc || !tc.total) return 0;
    const ops = (tc.details || []).length; // учтённые операции (включая допы калькулятора)
    const baseOps = Math.min(ops, 5);
    return Math.max(baseOps * 5 * (tc.quantity || 1), 30);
}

function updateServiceSummary() {
    let time = 0, basePrice = 0;

    document.querySelectorAll('#serviceCalcForm .service-item input:checked').forEach(cb => {
        time += parseInt(cb.dataset.time || 0);
        basePrice += parseInt(cb.dataset.price || 0);
    });

    const tc = window.__tyreCalcResult;
    const total = basePrice + (tc && tc.total > 0 ? tc.total : 0);
    time += tc && tc.total > 0 ? svcTyreDuration(tc) : 0;

    const timeEl = document.getElementById('totalTime');
    const priceEl = document.getElementById('totalPrice');
    if (timeEl) timeEl.textContent = time + ' мин';
    if (priceEl) priceEl.textContent = 'от ' + total + ' ₽';

    renderCalcExtrasList();

    return { time, total };
}

/* ---------- Отмеченные доп. работы — отдельным списком ПОД разбивкой
   калькулятора (в сам «Итого шиномонтаж» они не входят) ---------- */

function renderCalcExtrasList() {
    const list = document.getElementById('tcExtrasList');
    if (!list) return;
    const checked = Array.from(document.querySelectorAll('#serviceCalcForm .service-item input:checked'));
    if (!checked.length) {
        list.hidden = true;
        list.innerHTML = '';
        return;
    }
    let extrasSum = 0;
    list.innerHTML = '<div class="tc-bd-extras-title">Добавленные услуги:</div>' +
        checked.map(cb => {
            const p = parseInt(cb.dataset.price || 0);
            extrasSum += p;
            return `<div class="tc-bd-row tc-bd-extra"><span>${cb.value}</span><span><b>${p} ₽</b></span></div>`;
        }).join('') +
        `<div class="tc-bd-row tc-bd-extra-sum"><span>Итого доп. работы:</span><span><b>${extrasSum} ₽</b></span></div>`;
    list.hidden = false;
}
window.renderCalcExtrasList = renderCalcExtrasList;

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
    if (c) c.innerHTML = '<div class="slots-empty-notice" style="grid-column: 1 / -1;">📌 Выберите филиал, дату и пост обслуживания</div>';
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
    const carBrand = getSelectedCarBrand();
    const branchId = document.getElementById('branchSelect').value;
    const postId = document.getElementById('postSelect').value;
    const date = document.getElementById('dateSelect').value;
    const time = document.getElementById('selectedTime').value;
    const msg = document.getElementById('serviceCalcMsg');
    msg.classList.add('is-visible');

    // --- Собираем услуги: отмеченные пользователем доп. работы + шиномонтаж из калькулятора ---
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
        // Позиции шиномонтажа: снятие/установка/монтаж/демонтаж/балансировка — построчно,
        // как в прейскуранте; допы калькулятора (мойка/азот/утилизация) и RUN FLAT учтены в деталях
        const tireItems = (tc.details || []).map(x => ({
            name: x.name + ` ${st.width}/${st.profile} R${st.diameter}`,
            category: 'Шиномонтаж',
            price: x.total,
            duration: 5 * (st.quantity || 1)
        }));
        services.push(...tireItems);
        // Агрегированная позиция для слота/итогов
        services.push({
            name: `Шиномонтаж ${st.width}/${st.profile} R${st.diameter}, ${st.quantity} кол.${st.runflat ? ', RUN FLAT' : ''}`,
            category: 'Шиномонтаж',
            price: 0, // уже посчитан построчно выше
            duration: svcTyreDuration(tc),
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
    // Отмеченные доп. работы и общий итог — тоже в комментарий
    const extrasForComment = services.filter(s => s.category !== 'Шиномонтаж');
    if (extrasForComment.length) {
        const exParts = extrasForComment.map(s => `${s.name} ${s.price} ₽`).join(', ');
        calcComment += (calcComment ? ' | Доп. работы: ' : 'Доп. работы: ') + exParts;
    }
    if (calcComment) calcComment += ` | Общий итог: ${summary.total} ₽`;

    const formData = new FormData();
    formData.append('customer_id', branchId);
    formData.append('post_id', postId);
    formData.append('date', date);
    formData.append('time', time);
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('car_brand', carBrand);
    formData.append('car_plate', '');
    formData.append('duration', durationMins);
    formData.append('services_json', JSON.stringify(worksArr));
    formData.append('comment', calcComment); // расчёт калькулятора -> в COMMENT сделки (см. booking_handler.php)
    formData.append('is_guest', '1');

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

    // Шиномонтаж — основная работа по умолчанию: сразу показываем калькулятор,
    // кнопка «Добавить услуги» и табы прочих работ размещаются под ним
    refreshServiceTyreCalculator();

    // Кнопка «Добавить услуги» — раскрытие/сворачивание скрытого блока работ.
    // Экземпляр кнопки ОДИН: когда калькулятор открыт, кнопка физически
    // перемещена под калькулятор (см. tyre-calculator.js) — обработчик на ней сохраняется.
    const svcAddBtn = document.getElementById('svcAddBtn');
    const svcExtraBlock = document.getElementById('svcExtraBlock');

    function toggleExtras() {
        if (!svcAddBtn || !svcExtraBlock) return;
        svcExtraBlock.hidden = !svcExtraBlock.hidden;
        svcAddBtn.classList.remove('suggest');
        svcAddBtn.textContent = svcExtraBlock.hidden ? '＋ Добавить услуги' : '－ Свернуть услуги';
        if (!svcExtraBlock.hidden && svcAddBtn.closest('#tyreCalcBox')) {
            // находимся под калькулятором — скроллим к раскрытым табам
            svcExtraBlock.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    if (svcAddBtn) svcAddBtn.addEventListener('click', toggleExtras);

    // Табы прочих услуг
    const svcTabs = document.getElementById('svcTabs');
    if (svcTabs) {
        svcTabs.addEventListener('click', function (e) {
            const t = e.target.closest('.svc-tab');
            if (t) switchSvcTab(t.dataset.tab);
        });
    }

    // Отмеченные чекбоксы прочих работ -> пересчёт итога + слоты
    form.addEventListener('change', function (e) {
        const t = e.target;
        if (!t.matches('.service-item input[type="checkbox"]')) return;
        updateServiceSummary();
        checkAndLoadSlots();
    });

    // Маска телефона — как в guest.js + автопоиск клиента после полного номера
    const phoneEl = document.getElementById('servicePhone');
    if (phoneEl) {
        phoneEl.addEventListener('input', function () {
            let v = this.value.replace(/\D/g, '');
            if (v.startsWith('8')) v = '7' + v.slice(1);
            if (v && !v.startsWith('7')) v = '7' + v;
            let out = '';
            if (v.length) out = '+7';
            if (v.length > 1) out += ' (' + v.slice(1, 4);
            if (v.length >= 4) out += ') ' + v.slice(4, 7);
            if (v.length >= 7) out += '-' + v.slice(7, 9);
            if (v.length >= 9) out += '-' + v.slice(9, 11);
            this.value = out;

            // Дебаунс: когда набраны все 11 цифр — подтягиваем данные клиента и его авто
            clearTimeout(svcClientLookupTimer);
            if (out.replace(/\D/g, '').length === 11) {
                svcClientLookupTimer = setTimeout(() => svcLookupClient(out), 500);
            } else {
                const infoBox = document.getElementById('svcClientInfo');
                const manualWrap = document.getElementById('svcCarManualWrap');
                if (infoBox) infoBox.hidden = true;
                if (manualWrap) manualWrap.hidden = false;
                svcClientId = null;
            }
        });
    }

    // ===== Кнопка «Сбросить всё» =====
    const resetBtn = document.getElementById('svcResetBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', function () {
            form.reset(); // снимает чекбоксы услуг, возвращает имя/телефон/марку

            // Шиномонтаж — основная работа: калькулятор всегда на месте,
            // просто перерисовываем его заново (сброс пакетов/размеров внутри)
            const box = document.getElementById('tyreCalcBox');
            if (box) box.remove();
            window.__tyreCalcResult = null;
            window.__tcPacketFull = true;
            refreshServiceTyreCalculator();

            // Сворачиваем блок прочих услуг, сбрасываем табы на первый
            const extraBlock = document.getElementById('svcExtraBlock');
            const addBtn = document.getElementById('svcAddBtn');
            if (extraBlock) extraBlock.hidden = true;
            if (addBtn) { addBtn.classList.remove('suggest'); addBtn.textContent = '＋ Добавить услуги'; }
            switchSvcTab('align');

            // Скрываем данные найденного клиента, возвращаем ручной ввод марки
            const infoBox = document.getElementById('svcClientInfo');
            const manualWrap = document.getElementById('svcCarManualWrap');
            if (infoBox) infoBox.hidden = true;
            if (manualWrap) { manualWrap.hidden = false; manualWrap.classList.remove('is-hidden'); }
            svcClientId = null;

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
