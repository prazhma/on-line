/* ============================================================
   ШИННЫЙ КАЛЬКУЛЯТОР — ПИН-АВТО
   Данные: tyre-prices.json (прайс от 01.10.2026)
   Интеграция с guest.html: калькулятор появляется при выборе
   услуг категории «Шиномонтаж» и добавляет агрегированную
   позицию в общий итог формы.
   ============================================================ */

let TYRE_PRICES = null;

const TYRE_WIDTHS = ['155','165','175','185','195','205','215','225','235','245','255','265','275','285','295','305','315'];
const TYRE_PROFILES = ['30','35','40','45','50','55','60','65','70','75','80'];

// Профиль <=50% => низкопрофильная шина (для легковых применяется тариф passenger_low)
function isLowProfile(profile) {
    const p = parseInt(profile);
    return !isNaN(p) && p <= 50;
}

async function loadTyrePrices() {
    if (TYRE_PRICES) return TYRE_PRICES;
    try {
        const res = await fetch('tyre-prices.json');
        TYRE_PRICES = await res.json();
    } catch (e) {
        console.error('Не удалось загрузить tyre-prices.json', e);
        TYRE_PRICES = null;
    }
    return TYRE_PRICES;
}

/* ---------- РЕНДЕР БЛОКА КАЛЬКУЛЯТОРА ---------- */

function renderTyreCalculator() {
    let box = document.getElementById('tyreCalcBox');
    if (box) return; // уже отрисован

    box = document.createElement('div');
    box.id = 'tyreCalcBox';
    box.className = 'tyre-calc-box';
    box.innerHTML = `
        <div class="tyre-calc-header">
            <span class="tyre-calc-title">🛞 Калькулятор шиномонтажа</span>
            <span class="tyre-calc-subtitle">Прайс шинных центров ПИН-АВТО от 01.10.2026</span>
        </div>

        <div class="tyre-calc-grid">
            <div class="tyre-calc-field">
                <label>Тип автомобиля</label>
                <select id="tcVehicleType" class="auth-input-field">
                    <option value="passenger">Легковые автомобили</option>
                    <option value="passenger_low">Легковые (низкий профиль 50% и ниже)</option>
                    <option value="crossover">Кроссоверы / Внедорожники</option>
                    <option value="light_truck">Легкие грузовики, микроавтобусы</option>
                </select>
            </div>
            <div class="tyre-calc-field">
                <label>Ширина шины</label>
                <select id="tcWidth" class="auth-input-field"></select>
            </div>
            <div class="tyre-calc-field">
                <label>Профиль шины</label>
                <select id="tcProfile" class="auth-input-field"></select>
            </div>
            <div class="tyre-calc-field">
                <label>Диаметр колеса</label>
                <select id="tcDiameter" class="auth-input-field"></select>
            </div>
            <div class="tyre-calc-field">
                <label>Количество колёс</label>
                <select id="tcQuantity" class="auth-input-field">
                    <option value="1">1 колесо</option>
                    <option value="2">2 колеса</option>
                    <option value="3">3 колеса</option>
                    <option value="4" selected>4 колеса</option>
                </select>
            </div>
        </div>

        <div class="tyre-calc-size-preview">
            Размер колеса: <b id="tcSizeLabel">—</b>
            <span class="tc-lowprofile-badge" id="tcLowProfileBadge" hidden>низкопрофильная (тариф LP)</span>
        </div>

        <div class="tyre-calc-section-title">Услуги (полный пакет / по выбору):</div>
        <div class="tc-packet-toggle">
            <button type="button" class="tc-packet-btn active" id="tcPacketFull">Полный пакет</button>
            <button type="button" class="tc-packet-btn" id="tcPacketCustom">По выбору</button>
        </div>
        <div class="tyre-calc-ops" id="tcOps"></div>

        <div class="tyre-calc-extra">
            <label class="tyre-calc-check">
                <input type="checkbox" id="tcRunflat">
                <span>RUN FLAT (монтаж/демонтаж +100%)</span>
            </label>
            <label class="tyre-calc-check">
                <input type="checkbox" id="tcWash">
                <span>Мойка колёс</span>
            </label>
            <label class="tyre-calc-check">
                <input type="checkbox" id="tcNitrogenFill">
                <span>Накачка азотом (полная)</span>
            </label>
            <label class="tyre-calc-check">
                <input type="checkbox" id="tcUtilization">
                <span>Утилизация старых шин</span>
            </label>
        </div>

        <div class="tyre-calc-result">
            <div class="tyre-calc-breakdown" id="tcBreakdown"></div>
            <div class="tyre-calc-total-row">
                <span>Итого шиномонтаж:</span>
                <span class="tyre-calc-total" id="tcTotal">0 ₽</span>
            </div>
            <div class="tyre-calc-per-wheel" id="tcPerWheel"></div>
        </div>

        <div class="tyre-calc-notes">Стоимость указана без учета расходных материалов.</div>
    `;

    const summaryBox = document.getElementById('summaryBox');
    if (summaryBox && summaryBox.parentNode) {
        summaryBox.parentNode.insertBefore(box, summaryBox);
    } else {
        const form = document.getElementById('guestBookingForm');
        if (form) form.appendChild(box);
    }

    // Селекты ширины/профиля
    const wSel = document.getElementById('tcWidth');
    const pSel = document.getElementById('tcProfile');
    wSel.innerHTML = TYRE_WIDTHS.map(w => `<option value="${w}" ${w === '205' ? 'selected' : ''}>${w}</option>`).join('');
    pSel.innerHTML = TYRE_PROFILES.map(p => `<option value="${p}" ${p === '55' ? 'selected' : ''}>${p}</option>`).join('');

    // Чекбоксы операций
    const opsWrap = document.getElementById('tcOps');
    const opNames = { remove: 'Снятие', install: 'Установка', mount: 'Монтаж', unmount: 'Демонтаж', balance: 'Балансировка' };
    opsWrap.innerHTML = Object.keys(opNames).map(k => `
        <label class="tyre-calc-op">
            <input type="checkbox" class="tc-op" value="${k}" checked>
            <span>${opNames[k]}</span>
            <b class="tc-op-price" data-op="${k}"></b>
        </label>
    `).join('');

    // Слушатели
    box.querySelectorAll('select, input').forEach(el => {
        el.addEventListener('change', () => {
            // Автоподбор типа авто по профилю: если легковые + низкий профиль -> passenger_low
            syncVehicleTypeByProfile();
            calcTyrePrice();
            updateSummary();
        });
    });

    // Переключатель «Полный пакет / По выбору» (как packetType std/prm на shinservice)
    const packetFullBtn = document.getElementById('tcPacketFull');
    const packetCustomBtn = document.getElementById('tcPacketCustom');
    function setPacketMode(full) {
        window.__tcPacketFull = full;
        packetFullBtn.classList.toggle('active', full);
        packetCustomBtn.classList.toggle('active', !full);
        if (full) {
            // полный пакет: все 5 обязательных операций включены
            box.querySelectorAll('.tc-op').forEach(cb => { cb.checked = true; });
        }
        calcTyrePrice();
        updateSummary();
    }
    packetFullBtn.addEventListener('click', () => setPacketMode(true));
    packetCustomBtn.addEventListener('click', () => setPacketMode(false));

    // Если пользователь вручную снимает/ставит операцию — режим переключается на «По выбору»
    box.querySelectorAll('.tc-op').forEach(cb => {
        cb.addEventListener('change', () => {
            const allChecked = Array.from(box.querySelectorAll('.tc-op')).every(x => x.checked);
            if (!allChecked && window.__tcPacketFull) setPacketModeSilent(false);
            if (allChecked && !window.__tcPacketFull) setPacketModeSilent(true);
        });
    });
    function setPacketModeSilent(full) {
        window.__tcPacketFull = full;
        packetFullBtn.classList.toggle('active', full);
        packetCustomBtn.classList.toggle('active', !full);
    }

    syncVehicleTypeByProfile();
    calcTyrePrice();
}

function syncVehicleTypeByProfile() {
    const vt = document.getElementById('tcVehicleType');
    const profile = document.getElementById('tcProfile').value;
    if (!vt || !profile) return;
    if (vt.value === 'passenger' && isLowProfile(profile)) {
        vt.value = 'passenger_low';
    } else if (vt.value === 'passenger_low' && !isLowProfile(profile)) {
        vt.value = 'passenger';
    }
}

/* ---------- РАСЦЁНКА И РАСЧЁТ ---------- */

function diameterBucket(d) {
    return d >= 17 ? '17plus' : String(d);
}

function washPrice(vtKey, d) {
    if (!TYRE_PRICES) return 0;
    const prices = TYRE_PRICES.wash.prices;
    if (vtKey === 'crossover') return prices['4x4'] || 180;
    const b = diameterBucket(d);
    return prices[b] !== undefined ? prices[b] : (prices['17plus'] || 110);
}

function nitrogenFillPrice(vtKey, d) {
    const prices = TYRE_PRICES.nitrogen.fillPerWheel;
    if (vtKey === 'crossover') return prices['4x4'] || 270;
    const b = diameterBucket(d);
    return prices[b] !== undefined ? prices[b] : (prices['17plus'] || 270);
}

function getTyreSelectionState() {
    const vtKey = document.getElementById('tcVehicleType')?.value || 'passenger';
    const width = document.getElementById('tcWidth')?.value || '';
    const profile = document.getElementById('tcProfile')?.value || '';
    const diameter = parseInt(document.getElementById('tcDiameter')?.value || '15');
    const quantity = parseInt(document.getElementById('tcQuantity')?.value || '4');
    const runflat = document.getElementById('tcRunflat')?.checked || false;
    const wash = document.getElementById('tcWash')?.checked || false;
    const nitrogen = document.getElementById('tcNitrogenFill')?.checked || false;
    const utilization = document.getElementById('tcUtilization')?.checked || false;
    const ops = Array.from(document.querySelectorAll('.tc-op:checked')).map(cb => cb.value);
    return { vtKey, width, profile, diameter, quantity, runflat, wash, nitrogen, utilization, ops };
}

function calcTyrePrice() {
    const box = document.getElementById('tyreCalcBox');
    if (!box || !TYRE_PRICES) return 0;

    const st = getTyreSelectionState();
    const vt = TYRE_PRICES.wheelServices.vehicleTypes[st.vtKey];
    if (!vt) return 0;

    // Диаметы зависят от типа авто — перерисуем select диаметра при смене типа
    const dSel = document.getElementById('tcDiameter');
    const wanted = vt.diameters.join(',');
    if (dSel.dataset.diams !== wanted) {
        dSel.dataset.diams = wanted;
        dSel.innerHTML = vt.diameters.map(d => `<option value="${d}" ${d === 15 ? 'selected' : ''}>R${d}</option>`).join('');
    }
    if (!vt.diameters.includes(st.diameter)) {
        st.diameter = vt.diameters.includes(15) ? 15 : vt.diameters[Math.floor(vt.diameters.length / 2)];
        dSel.value = String(st.diameter);
    }

    const d = String(st.diameter);
    const details = [];
    let perWheel = 0;

    const opNames = TYRE_PRICES.wheelServices.operationNames;
    st.ops.forEach(op => {
        let price = vt.prices[op][d] || 0;
        if ((op === 'mount' || op === 'unmount') && st.runflat) price *= 2; // RUN FLAT +100% на монтаж/демонтаж
        perWheel += price;
        details.push({ name: opNames[op], pricePerWheel: price, total: price * st.quantity });
    });

    if (st.wash) {
        const p = washPrice(st.vtKey, st.diameter);
        perWheel += p;
        details.push({ name: 'Мойка колёс', pricePerWheel: p, total: p * st.quantity });
    }
    if (st.nitrogen) {
        const p = nitrogenFillPrice(st.vtKey, st.diameter);
        perWheel += p;
        details.push({ name: 'Накачка азотом', pricePerWheel: p, total: p * st.quantity });
    }
    if (st.utilization) {
        const p = vt.utilization[d] || 130;
        perWheel += p;
        details.push({ name: 'Утилизация шины', pricePerWheel: p, total: p * st.quantity });
    }

    const total = perWheel * st.quantity;

    // Цены операций в чекбоксах
    document.querySelectorAll('.tc-op-price').forEach(el => {
        const op = el.dataset.op;
        let price = vt.prices[op][d] || 0;
        if ((op === 'mount' || op === 'unmount') && st.runflat) price *= 2;
        el.textContent = price + ' ₽/кол.';
    });

    // Разбивка
    const bd = document.getElementById('tcBreakdown');
    bd.innerHTML = details.map(x =>
        `<div class="tc-bd-row"><span>${x.name} × ${st.quantity}</span><span>${x.pricePerWheel} ₽ × ${st.quantity} = <b>${x.total} ₽</b></span></div>`
    ).join('') || '<div class="tc-bd-row"><span>Выберите хотя бы одну операцию</span><span></span></div>';

    document.getElementById('tcTotal').textContent = total + ' ₽';
    document.getElementById('tcPerWheel').textContent = total > 0 ? `(${perWheel} ₽ за 1 колесо)` : '';

    // Превью размера колеса + бейдж низкопрофильной шины
    const sizeLabel = document.getElementById('tcSizeLabel');
    if (sizeLabel) {
        sizeLabel.textContent = st.width && st.profile ? `${st.width}/${st.profile} R${st.diameter}` : `R${st.diameter}`;
    }
    const lpBadge = document.getElementById('tcLowProfileBadge');
    if (lpBadge) lpBadge.hidden = !(isLowProfile(st.profile) && (st.vtKey === 'passenger_low' || st.vtKey === 'crossover' || st.vtKey === 'light_truck'));

    window.__tyreCalcResult = { total, perWheel, quantity: st.quantity, details, state: st };
    return total;
}

/* ---------- ИНТЕГРАЦИЯ С ГОСТЕВОЙ ФОРМОЙ ---------- */

function isTyreCategorySelected() {
    // Любая отмеченная услуга с категорией Шиномонтаж?
    return document.querySelectorAll('#tabContentsContainer .service-item input:checked[data-category="Шиномонтаж"]').length > 0;
}

function refreshTyreCalculatorVisibility() {
    const need = isTyreCategorySelected();
    let box = document.getElementById('tyreCalcBox');
    if (need) {
        loadTyrePrices().then(() => {
            renderTyreCalculator();
            calcTyrePrice();
            updateSummary();
        });
    } else if (box) {
        box.remove();
        window.__tyreCalcResult = null;
        updateSummary();
    }
}

// Переопределяем updateSummary из guest.js — добавляем итог калькулятора
(function () {
    const origUpdateSummary = window.updateSummary;
    window.updateSummary = function () {
        const time = typeof origUpdateSummary === 'function' ? origUpdateSummary() : 60;
        const tc = window.__tyreCalcResult;
        const priceEl = document.getElementById('totalPrice');
        if (tc && tc.total > 0 && priceEl) {
            const baseStr = priceEl.textContent.replace(/[^\d]/g, '');
            const base = parseInt(baseStr) || 0;
            priceEl.textContent = 'от ' + (base + tc.total) + ' ₽';
        }
        return time;
    };
})();

// Добавляем позицию шиномонтажа в payload при отправке формы.
// guest.js объявляет submit как window.handleGuestBookingSubmit (присваивание),
// поэтому патчинг делаем с небольшой задержкой после загрузки страницы.
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
        const origSubmit = window.handleGuestBookingSubmit;
        if (typeof origSubmit !== 'function') return;
        window.handleGuestBookingSubmit = async function (event) {
            const tc = window.__tyreCalcResult;
            let holder = null;
            if (tc && tc.total > 0) {
                const st = tc.state;
                const sizeStr = st.width ? `${st.width}/${st.profile} R${st.diameter}` : `R${st.diameter}`;
                const fakeCb = document.createElement('input');
                fakeCb.type = 'checkbox';
                fakeCb.checked = true;
                fakeCb.value = `Шиномонтаж ${sizeStr}, ${st.quantity} кол.`;
                fakeCb.setAttribute('data-price', String(tc.total));
                fakeCb.setAttribute('data-time', String(20 * st.quantity));
                fakeCb.setAttribute('data-category', 'Шиномонтаж');
                holder = document.createElement('div');
                holder.style.display = 'none';
                holder.appendChild(fakeCb);
                document.body.appendChild(holder);
            }
            try {
                return await origSubmit.call(this, event);
            } finally {
                if (holder) holder.remove();
            }
        };
    }, 0);
});
