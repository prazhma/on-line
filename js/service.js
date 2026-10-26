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
   (по выбору категории «Шиномонтаж» из блока #svcCategoryCards) ---------- */

function selectedSvcCategory() {
    const r = document.querySelector('input[name="svcCategory"]:checked');
    return r ? r.value : '';
}

function refreshServiceTyreCalculator() {
    const need = selectedSvcCategory() === 'tire';
    let box = document.getElementById('tyreCalcBox');

    if (need) {
        loadTyrePrices().then(() => {
            renderTyreCalculator();
            calcTyrePrice();
            updateServiceSummary();
            checkAndLoadSlots(); // длительность визита могла измениться -> обновить слоты
            // после расчёта — предложить добавить другие работы
            suggestExtraServices();
        });
    } else if (box) {
        box.remove();
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
    btn.textContent = '＋ Добавить сопутствующие услуги (развал, правка дисков, ремонт)';
}

/* Авто-раскрытие блока при выборе нешиномонтажной категории */
function applyCategoryToExtras(cat) {
    const block = document.getElementById('svcExtraBlock');
    const btn = document.getElementById('svcAddBtn');
    if (!block || !btn) return;
    const map = { align: 'Развал-схождение', rim: 'Правка дисков', repair: 'Ремонт' };
    if (map[cat]) {
        block.hidden = false;
        btn.classList.remove('suggest');
        btn.textContent = '－ Свернуть услуги';
        const title = [...block.querySelectorAll('.svc-category-title')].find(t => t.textContent.trim() === map[cat]);
        const target = title ? title.closest('.svc-category-block') : null;
        if (target && typeof target.scrollIntoView === 'function') {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
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
    const carBrand = document.getElementById('serviceCarBrand').value.trim();
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

    // Выбор категории работ: Шиномонтаж -> калькулятор; прочие -> авто-раскрытие блока услуг
    form.addEventListener('change', function (e) {
        if (!e.target.matches('input[name="svcCategory"]')) return;
        document.querySelectorAll('.svc-cat-card').forEach(c => c.classList.remove('checked'));
        e.target.closest('.svc-cat-card')?.classList.add('checked');
        refreshServiceTyreCalculator();
        applyCategoryToExtras(e.target.value);
    });

    // Кнопка «Добавить услуги» — раскрытие/сворачивание скрытого блока работ
    const svcAddBtn = document.getElementById('svcAddBtn');
    const svcExtraBlock = document.getElementById('svcExtraBlock');
    if (svcAddBtn && svcExtraBlock) {
        svcAddBtn.addEventListener('click', function () {
            svcExtraBlock.hidden = !svcExtraBlock.hidden;
            svcAddBtn.classList.remove('suggest');
            svcAddBtn.textContent = svcExtraBlock.hidden ? '＋ Добавить услуги' : '－ Свернуть услуги';
        });
    }

    // Отмеченные чекбоксы прочих работ -> пересчёт итога + слоты
    form.addEventListener('change', function (e) {
        const t = e.target;
        if (!t.matches('.service-item input[type="checkbox"]')) return;
        updateServiceSummary();
        checkAndLoadSlots();
    });

    // Маска телефона — как в guest.js
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
        });
    }

    updateServiceSummary();
});
