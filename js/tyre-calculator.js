/* ============================================================
   ШИННЫЙ КАЛЬКУЛЯТОР — ПИН-АВТО
   Данные: tyre-prices.json (прайс от 01.10.2026)
   Интеграция с guest.html: калькулятор появляется при выборе
   услуг категории «Шиномонтаж» и добавляет агрегированную
   позицию в общий итог формы.
   ============================================================ */

let TYRE_PRICES = null;

const TYRE_WIDTHS = ['145','155','165','175','185','195','205','215','225','235','245','255','265','275','285','295','305','315'];
const TYRE_PROFILES = ['25','30','35','40','45','50','55','60','65','70','75','80'];

/* Полная таблица типоразмеров шин R12-R24 (справочник каталогов производителей,
   281 типоразмер / 131 пара ширина-профиль). Источник истины — tyre-prices.json -> sizeMatrix.rows;
   здесь — резервная копия на случай недоступности JSON. */
const DEFAULT_SIZE_ROWS = [["130","80",[12]],["135","70",[12,13]],["135","80",[12,13]],["145","70",[12,13,14]],["145","80",[12,13,14]],["155","65",[12,13,14]],["155","70",[12,13,14]],["155","75",[12,13]],["155","80",[12,13,14]],["165","60",[12,13,14]],["165","65",[12,13,14]],["165","70",[12,13,14]],["125","80",[13]],["145","65",[13,14]],["155","55",[13,14]],["155","60",[13,14,15]],["160","70",[13]],["165","55",[13,14]],["165","75",[13]],["165","80",[13,14]],["170","70",[13]],["175","60",[13,14]],["175","65",[13,14,15]],["175","70",[13,14]],["175","75",[13,14]],["175","80",[13,14]],["185","55",[13,14,15]],["185","60",[13,14,15]],["185","65",[13,14,15]],["185","70",[13,14]],["185","75",[13,14,16]],["185","80",[13,14]],["195","60",[13,14,15,16]],["195","70",[13,14]],["205","60",[13,15,16]],["205","70",[13,14,15]],["165","50",[14]],["170","65",[14]],["170","80",[14]],["175","50",[14]],["175","55",[14]],["185","50",[14]],["195","65",[14,15]],["195","80",[14]],["195","50",[15,16]],["195","55",[15,16]],["205","65",[15,16]],["205","75",[15]],["215","65",[15,16,17]],["215","70",[15,16]],["215","75",[15]],["225","70",[15,16]],["225","75",[15,16]],["235","75",[15]],["255","70",[15]],["265","70",[15,16,17]],["195","45",[16]],["205","45",[16]],["205","50",[16,17]],["205","55",[16,17]],["215","55",[16,17,18]],["215","60",[16,17]],["225","55",[16,17,18,19]],["225","60",[16,17,18]],["235","60",[16,17,18]],["235","70",[16]],["245","70",[16,17]],["245","75",[16]],["265","75",[16]],["215","45",[17]],["215","50",[17]],["225","45",[17,18,19]],["225","50",[17,18]],["225","65",[17]],["235","45",[17,18,19,20,21]],["235","50",[17,18,19,20,21]],["235","55",[17,18,19,20]],["235","65",[17,18]],["245","45",[17,18,19,20]],["245","65",[17]],["255","65",[17]],["265","65",[17,18]],["285","70",[17]],["225","40",[18,19]],["235","40",[18,19]],["245","40",[18,19,20,21]],["245","50",[18,19,20]],["245","60",[18]],["255","35",[18,19,20,21,22]],["255","40",[18,19,20,21,22]],["255","55",[18,19,20]],["255","60",[18]],["265","60",[18]],["275","40",[18,19,20,21,22]],["285","60",[18]],["235","35",[19]],["245","35",[19,20,21]],["245","55",[19]],["255","45",[19,20,21]],["255","50",[19,20]],["265","50",[19,20]],["265","55",[19]],["275","35",[19,20,21,22,23]],["275","55",[19,20]],["285","45",[19,20,21,22]],["265","45",[20,21]],["275","45",[20,21,22]],["275","50",[20,21,22]],["275","60",[20]],["285","50",[20]],["305","40",[20,22,23]],["315","35",[20,21,22,24]],["265","35",[21,22]],["265","40",[21,22]],["275","30",[21]],["285","35",[21,22,23]],["285","40",[21,22,23,24]],["295","35",[21,23,24]],["295","40",[21,22]],["315","30",[21,23]],["315","40",[21]],["325","30",[21,23]],["255","30",[22]],["265","30",[22]],["285","30",[22]],["295","25",[22]],["295","30",[22,23]],["305","45",[22]],["325","40",[22]],["325","35",[23]],["305","35",[24]]];

/* ---------- КАСКАД РАЗМЕРОВ ПО МАТРИЦЕ СООТВЕТСТВИЙ (sizeMatrix) ----------
   Ширина -> Профиль -> Радиус (R). Как на shinservice: в списках только
   реально существующие типоразмеры. Если матрицы нет — fallback на стандартную. */

function getSizeRows() {
    if (TYRE_PRICES && TYRE_PRICES.sizeMatrix && TYRE_PRICES.sizeMatrix.rows) return TYRE_PRICES.sizeMatrix.rows;
    return DEFAULT_SIZE_ROWS;
}

function widthsFromMatrix(rows) {
    const set = new Set(rows.map(r => r[0]));
    return Array.from(set).sort((a, b) => a - b);
}

function profilesForWidth(rows, width) {
    const set = new Set(rows.filter(r => r[0] === width).map(r => r[1]));
    return Array.from(set).sort((a, b) => a - b);
}

function diametersForSize(rows, width, profile) {
    const row = rows.find(r => r[0] === width && r[1] === profile);
    return row ? row[2].slice().sort((a, b) => a - b) : [];
}

function fillSelect(sel, values, prefer) {
    sel.innerHTML = values.map(v => `<option value="${v}" ${String(v) === String(prefer) ? 'selected' : ''}>${sel.id === 'tcDiameter' ? 'R' + v : v}</option>`).join('');
}

/* Перерисовка каскада при смене ширины/профиля; сохраняет валидный выбор.
   Радиус дополнительно ограничивается тарифной таблицей выбранного типа авто. */
function renderSizeCascades(initial) {
    const wSel = document.getElementById('tcWidth');
    const pSel = document.getElementById('tcProfile');
    const dSel = document.getElementById('tcDiameter');
    if (!wSel || !pSel || !dSel) return;

    const rows = getSizeRows();

    // Радиусы, доступные для выбранного типа авто (по прайсу)
    let vtAllowed = null;
    if (TYRE_PRICES && TYRE_PRICES.wheelServices) {
        const vtKey = document.getElementById('tcVehicleType')?.value || 'passenger';
        const vt = TYRE_PRICES.wheelServices.vehicleTypes[vtKey];
        if (vt && vt.diameters) vtAllowed = vt.diameters.map(Number);
    }

    const widths = widthsFromMatrix(rows);
    const prevW = wSel.value;
    fillSelect(wSel, widths, initial ? '205' : (widths.includes(prevW) ? prevW : widths[0]));

    const profiles = profilesForWidth(rows, wSel.value);
    const prevP = pSel.value;
    fillSelect(pSel, profiles, (!initial && profiles.includes(prevP)) ? prevP : (profiles.includes('55') ? '55' : profiles[Math.floor(profiles.length / 2)]));

    let diams = diametersForSize(rows, wSel.value, pSel.value).map(Number);
    if (vtAllowed) {
        const filtered = diams.filter(x => vtAllowed.includes(x));
        // если у типа авто нет ни одного радиуса из матрицы — показываем радиусы типа авто
        diams = filtered.length ? filtered : vtAllowed;
    }
    if (diams.length) {
        const prevD = dSel.value;
        fillSelect(dSel, diams, (!initial && diams.includes(Number(prevD))) ? Number(prevD) : diams[0]);
    }
}

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
            <span class="tyre-calc-title">Калькулятор шиномонтажа</span>
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

    // Кнопка «Добавить услуги» — ПЕРЕМЕЩАЕМ существующую (дубликат не создаём),
    // ставим её ПОД калькулятор (по ТЗ). При удалении блока возвращаем на место.
    const svcAddBtn = document.getElementById('svcAddBtn');
    if (svcAddBtn) {
        window.__svcAddBtnHome = svcAddBtn.parentNode; // .svc-extra-wrap в разметке
        box.querySelectorAll('.tyre-calc-notes')[0].insertAdjacentElement('beforebegin', (() => {
            const holder = document.createElement('div');
            holder.className = 'svc-add-under-calc';
            holder.id = 'svcAddBtnHolder';
            holder.appendChild(svcAddBtn); // переносим единственный экземпляр кнопки
            return holder;
        })());
    }

    // Селекты ширины/профиля/радиуса — по матрице соответствий (sizeMatrix)
    renderSizeCascades(true);

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
            // Каскад размеров: смена ширины/профиля перерисовывает последующие списки
            if (el.id === 'tcWidth' || el.id === 'tcProfile') {
                renderSizeCascades(false);
            }
            // Смена типа авто -> радиусы ограничиваем тарифной таблицей этого типа
            if (el.id === 'tcVehicleType') {
                calcTyrePrice();      // пересобирает #tcDiameter по допустимым радиусам
                renderSizeCascades(false);
            }
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
        } else {
            // «По выбору» — это НЕ комплекс: сбрасываем все чекбоксы операций и допы
            box.querySelectorAll('.tc-op').forEach(cb => { cb.checked = false; });
            ['tcRunflat', 'tcWash', 'tcNitrogenFill', 'tcUtilization'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.checked = false;
            });
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

    // Радиусы: берём из справочника типоразмеров (матрица соответствий),
    // ограничивая диапазоном диаметров тарифной таблицы выбранного типа авто.
    // При смене типа авто перерисовываем select диаметра, оставляя только валидные радиусы.
    const dSel = document.getElementById('tcDiameter');
    const rows = getSizeRows();
    let allowed;
    if (rows) {
        const matrixDiams = diametersForSize(rows, st.width, st.profile).map(Number);
        // радиусы шире тарифной сетки типа авто всё равно показываем — для них
        // применится ближайшая доступная колонка тарифа (fallback ниже)
        allowed = matrixDiams.slice().sort((a, b) => a - b);
        if (!allowed.length) allowed = matrixDiams.slice().sort((a, b) => a - b);
        if (!allowed.length) allowed = vt.diameters.map(Number); // размера нет в матрице — fallback на тариф
    } else {
        allowed = vt.diameters.map(Number);
    }
    const wanted = allowed.join(',');
    if (dSel.dataset.diams !== wanted) {
        dSel.dataset.diams = wanted;
        fillSelect(dSel, allowed, allowed.includes(Number(st.diameter)) ? st.diameter : allowed[0]);
    }
    if (!allowed.includes(Number(st.diameter))) {
        st.diameter = Number(dSel.value) || allowed[0];
    }

    // Если радиуса нет в тарифе выбранного типа авто (например, легковые R18+ с
    // высоким профилем) — берём ближайший доступный больший диаметр того же типа.
    if (!vt.prices.remove[String(st.diameter)]) {
        const avail = Object.keys(vt.prices.remove).map(Number).sort((a, b) => a - b);
        st.diameter = avail.find(x => x >= st.diameter) || avail[avail.length - 1];
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
