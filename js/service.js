/* ============================================================
   СТРАНИЦА service.html — Калькулятор услуг (автономная)
   Не трогает guest.html / guest.js. Использует общий модуль
   js/tyre-calculator.js + данные tyre-prices.json.
   Связка: чекбоксы с data-category="Шиномонтаж" запускают
   шинный калькулятор; прочие услуги дают фиксированные цены.
   ============================================================ */

/* ---------- Синхронизация чекбоксов группы «Шиномонтаж»
   с внутренними контролами калькулятора (#tcOps, допы) ---------- */

function syncTyreCalcFromCheckboxes() {
    const box = document.getElementById('tyreCalcBox');
    if (!box) return;

    // Операции: чекбокс в списке <-> чекбокс калькулятора (двусторонняя синхронизация,
    // без dispatch — calcTyrePrice вызывается явно, чтобы не гонять рекурсивные change)
    document.querySelectorAll('#svcGroupTyre input[data-tc-op]').forEach(cb => {
        const target = box.querySelector(`.tc-op[value="${cb.dataset.tcOp}"]`);
        if (!target) return;
        if (target.checked !== cb.checked) {
            if (window.__tyreCalcSyncFromBox) {
                cb.checked = target.checked;   // источник истины — калькулятор
            } else {
                target.checked = cb.checked;   // источник истины — список услуг
            }
        }
    });

    // Допы: runflat / wash / nitrogen / utilization
    const extras = { runflat: 'tcRunflat', wash: 'tcWash', nitrogen: 'tcNitrogenFill', utilization: 'tcUtilization' };
    document.querySelectorAll('#svcGroupTyre input[data-tc-extra]').forEach(cb => {
        const id = extras[cb.dataset.tcExtra];
        const target = id ? box.querySelector('#' + id) : null;
        if (target && target.checked !== cb.checked) {
            if (window.__tyreCalcSyncFromBox) {
                cb.checked = target.checked;
            } else {
                target.checked = cb.checked;
            }
        }
    });
}

/* ---------- Итог страницы (независимый от guest.js updateSummary) ---------- */

function updateServiceSummary() {
    let time = 0, basePrice = 0;

    document.querySelectorAll('#serviceCalcForm .service-item input:checked').forEach(cb => {
        time += parseInt(cb.dataset.time || 0);
        // Цены шиномонтажа берём из калькулятора, а не из data-price (=0)
        if (cb.dataset.category !== 'Шиномонтаж') {
            basePrice += parseInt(cb.dataset.price || 0);
        }
    });

    const tc = window.__tyreCalcResult;
    const total = basePrice + (tc && tc.total > 0 ? tc.total : 0);

    const timeEl = document.getElementById('totalTime');
    const priceEl = document.getElementById('totalPrice');
    if (timeEl) timeEl.textContent = time + ' мин';
    if (priceEl) priceEl.textContent = 'от ' + total + ' ₽';

    return total;
}

/* ---------- Появление / исчезновение шинного калькулятора ---------- */

function refreshServiceTyreCalculator() {
    const need = document.querySelectorAll('#svcGroupTyre input[type="checkbox"]:checked').length > 0;
    let box = document.getElementById('tyreCalcBox');

    if (need) {
        loadTyrePrices().then(() => {
            const wasRendered = !!document.getElementById('tyreCalcBox');
            if (!wasRendered) {
                // при первом появлении включаем полный пакет, если в списке ничего не отмечено из операций
                const anyOp = document.querySelector('#svcGroupTyre input[data-tc-op]:checked');
                if (!anyOp) document.querySelectorAll('#svcGroupTyre input[data-tc-op]').forEach(cb => { cb.checked = true; });
            }
            window.__tyreCalcSyncFromBox = false;
            renderTyreCalculator();          // идемпотентен: не пересоздаёт блок
            calcTyrePrice();                 // перерисует select диаметров по типу авто + цены
            syncTyreCalcFromCheckboxes();    // список услуг -> калькулятор (источник: список)
            calcTyrePrice();                 // пересчёт с учётом синхронизированных операций
            updateServiceSummary();
        });
    } else if (box) {
        box.remove();
        window.__tyreCalcResult = null;
        updateServiceSummary();
    }
}

/* ---------- Переопределение колбэков tyre-calculator.js -------
   На этой странице нет гостевой формы, поэтому вместо updateSummary
   и отправки payload используем локальные функции. -------------- */

window.updateSummary = function () {
    updateServiceSummary();
    return 60; // длительность для этой страницы не используется в слотах
};

/* ---------- Отправка заявки (локально, без бэкенда guest.php) ---
   Заявка сохраняется в localStorage как "service_request" и
   показывается сообщение с саммари. При привязке к проекту здесь
   будет fetch на нужный API. ------------------------------------ */

window.handleServiceCalcSubmit = function (e) {
    e.preventDefault();

    const name = document.getElementById('serviceName').value.trim();
    const phone = document.getElementById('servicePhone').value.trim();
    const msg = document.getElementById('serviceCalcMsg');
    msg.classList.add('is-visible');

    const services = [];
    document.querySelectorAll('#serviceCalcForm .service-item input:checked').forEach(cb => {
        services.push({
            name: cb.value,
            category: cb.dataset.category,
            price: parseInt(cb.dataset.price || 0)
        });
    });

    const tc = window.__tyreCalcResult;
    if (tc && tc.total > 0) {
        const st = tc.state;
        services.push({
            name: `Шиномонтаж ${st.width}/${st.profile} R${st.diameter}, ${st.quantity} кол.`,
            category: 'Шиномонтаж',
            price: tc.total,
            details: tc.details
        });
    }

    if (services.length === 0) {
        msg.className = 'message error';
        msg.textContent = 'Выберите хотя бы одну услугу.';
        return false;
    }

    const request = {
        created_at: new Date().toISOString(),
        name, phone,
        services,
        total: updateServiceSummary()
    };

    try {
        const prev = JSON.parse(localStorage.getItem('service_requests') || '[]');
        prev.push(request);
        localStorage.setItem('service_requests', JSON.stringify(prev));
    } catch (err) { /* localStorage может быть недоступен */ }

    const list = request.services.map(s => `• ${s.name} — ${s.price} ₽`).join('<br>');
    msg.className = 'message success';
    msg.innerHTML = `Спасибо, ${name || 'клиент'}! Ваша заявка сформирована:<br>${list}<br><b>Итого: от ${request.total} ₽</b><br><br>Менеджер свяжется с вами по номеру ${phone} для подтверждения времени визита.`;

    return false;
};

/* ---------- Инициализация ---------- */

document.addEventListener('DOMContentLoaded', function () {
    const form = document.getElementById('serviceCalcForm');
    if (!form) return;

    // Делегированный слушатель: изменения внутри шинного калькулятора
    // зеркалятся на чекбоксы списка услуг и пересчитывают итог страницы.
    // Работаем через setTimeout(0): к этому моменту внутренний слушатель
    // калькулятора уже выполнил calcTyrePrice — синхронизируем список по
    // финальному состоянию и обновляем сводку страницы.
    form.addEventListener('change', function (e) {
        const box = document.getElementById('tyreCalcBox');
        if (!box || !box.contains(e.target)) return;
        setTimeout(function () {
            window.__tyreCalcSyncFromBox = true;
            syncTyreCalcFromCheckboxes();
            window.__tyreCalcSyncFromBox = false;
            updateServiceSummary();
        }, 0);
    });

    form.addEventListener('change', function (e) {
        const t = e.target;
        if (!t.matches('.service-item input[type="checkbox"]')) return;

        if (t.dataset.category === 'Шиномонтаж') {
            refreshServiceTyreCalculator();
        } else {
            updateServiceSummary();
        }
    });

    // Маска телефона — как в guest.js (упрощённая)
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
