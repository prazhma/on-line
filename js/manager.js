/* ============================================================
   ПИН-АВТО — СКРИПТ АРМ МЕНЕДЖЕРА (JS/MANAGER.JS)
   Автоматическая подгрузка карточки клиента, автопарка и VIN
   ============================================================ */

let globalConfig = null;
let allServices = [];
let managerClientId = null;
let managerClientCars = [];

const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

document.addEventListener('DOMContentLoaded', () => {
    initPhoneFilter();
    initManagerBookingModule();
});

// 1. Поиск клиента и его автопарка при вводе телефона
function initPhoneFilter() {
    const phoneInput = document.getElementById('mgrPhone');
    if (!phoneInput) return;

    phoneInput.addEventListener('input', (e) => {
        let val = e.target.value.replace(/\D/g, '');
        if (!val) {
            e.target.value = '';
            return;
        }

        if (['7', '8', '9'].includes(val[0])) {
            if (val[0] === '9') val = '7' + val;
            let formatted = '+7 ';
            if (val.length > 1) formatted += '(' + val.substring(1, 4);
            if (val.length >= 5) formatted += ') ' + val.substring(4, 7);
            if (val.length >= 8) formatted += '-' + val.substring(7, 9);
            if (val.length >= 10) formatted += '-' + val.substring(9, 11);
            e.target.value = formatted;
        } else {
            e.target.value = '+' + val.substring(0, 15);
        }
    });

    phoneInput.addEventListener('blur', handleManagerPhoneBlur);
}

async function handleManagerPhoneBlur() {
    const phoneInput = document.getElementById('mgrPhone');
    const hintEl = document.getElementById('mgrPhoneHint');
    const typeHintEl = document.getElementById('mgrClientTypeHint');
    const nameInput = document.getElementById('mgrName');
    const carSelect = document.getElementById('mgrCarSelect');

    const phoneVal = phoneInput.value.trim();
    const cleanDigits = phoneVal.replace(/\D/g, '');

    if (cleanDigits.length < 11) {
        if (hintEl) {
            hintEl.textContent = 'Укажите 11 цифр номера телефона';
            hintEl.style.color = '#777777';
        }
        return;
    }

    if (hintEl) {
        hintEl.textContent = '🔍 Запрос в STOCRM... Поиск профиля и гаража...';
        hintEl.style.color = '#1e5799';
    }

    try {
        const res = await fetch('api/customer.php?action=check_client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: phoneVal })
        });
        const data = await res.json();

        if (data.status === 'success' && data.client) {
            managerClientId = data.client.id || data.client.CONTACT_ID;
            
            // Подстановка полного имени клиента
            if (nameInput && data.client.name) {
                nameInput.value = data.client.name;
            }

            if (hintEl) {
                hintEl.textContent = `✔ Клиент найден в CRM (ID: ${managerClientId})`;
                hintEl.style.color = '#15803d';
            }
            if (typeHintEl) {
                typeHintEl.textContent = `Постоянный клиент сети ПИН-АВТО`;
                typeHintEl.style.color = '#15803d';
            }

            // Загрузка автомобилей клиента из CRM
            await loadManagerClientCars(managerClientId);
        } else {
            managerClientId = null;
            managerClientCars = [];
            if (hintEl) {
                hintEl.textContent = 'ℹ️ Новый клиент (будет создан контакт в CRM)';
                hintEl.style.color = '#856404';
            }
            if (typeHintEl) {
                typeHintEl.textContent = 'Новый клиент';
                typeHintEl.style.color = '#856404';
            }

            if (carSelect) {
                carSelect.innerHTML = '<option value="manual">+ Ввести новый автомобиль вручную</option>';
                carSelect.disabled = false;
                handleManagerCarChange();
            }
        }
    } catch (err) {
        console.error('Ошибка поиска клиента менеджером:', err);
        if (hintEl) {
            hintEl.textContent = 'Ошибка соединения с CRM';
            hintEl.style.color = '#dc2626';
        }
    }
}

async function loadManagerClientCars(cId) {
    const carSelect = document.getElementById('mgrCarSelect');
    if (!carSelect) return;

    carSelect.disabled = true;
    carSelect.innerHTML = '<option value="">⏳ Загрузка автомобилей из гаража CRM...</option>';

    try {
        const res = await fetch(`api/cars.php?client_id=${encodeURIComponent(cId)}`);
        const data = await res.json();

        if (data.status === 'success' && data.cars && data.cars.length > 0) {
            managerClientCars = data.cars;
            carSelect.innerHTML = '';

            data.cars.forEach((c, idx) => {
                const opt = document.createElement('option');
                const brand = c.brand || '';
                const model = c.model || '';
                const title = c.title || `${brand} ${model}`.trim() || 'Автомобиль';
                const plate = c.plate || 'без номера';
                const vin = c.vin || '';

                opt.value = c.id || idx;
                opt.textContent = `${title} [${plate}] ${vin ? `(VIN: ${vin})` : ''}`;
                opt.setAttribute('data-brand', brand || title);
                opt.setAttribute('data-plate', c.plate || '');
                opt.setAttribute('data-vin', vin);
                carSelect.appendChild(opt);
            });

            // Добавляем пункт для нового авто
            const manualOpt = document.createElement('option');
            manualOpt.value = 'manual';
            manualOpt.textContent = '+ Другой автомобиль (ввести вручную)';
            carSelect.appendChild(manualOpt);

            carSelect.disabled = false;
            handleManagerCarChange();
        } else {
            managerClientCars = [];
            carSelect.innerHTML = '<option value="manual">+ Автомобили в CRM не найдены (ввести вручную)</option>';
            carSelect.disabled = false;
            handleManagerCarChange();
        }
    } catch (e) {
        console.error('Ошибка загрузки авто:', e);
        carSelect.innerHTML = '<option value="manual">+ Ошибка загрузки гаража (ввести вручную)</option>';
        carSelect.disabled = false;
    }
}

function handleManagerCarChange() {
    const carSelect = document.getElementById('mgrCarSelect');
    const brandSelect = document.getElementById('mgrCarBrandSelect');
    const plateInput = document.getElementById('mgrCarPlate');
    const vinInput = document.getElementById('mgrCarVin');

    if (!carSelect) return;

    if (carSelect.value === 'manual' || !carSelect.value) {
        if (plateInput) plateInput.value = '';
        if (vinInput) vinInput.value = '';
        if (brandSelect) brandSelect.selectedIndex = 0;
        return;
    }

    const selectedOpt = carSelect.options[carSelect.selectedIndex];
    if (selectedOpt) {
        const brand = selectedOpt.getAttribute('data-brand') || '';
        const plate = selectedOpt.getAttribute('data-plate') || '';
        const vin = selectedOpt.getAttribute('data-vin') || '';

        if (plateInput) plateInput.value = plate;
        if (vinInput) vinInput.value = vin;

        // Автоматический выбор марки в селекторе
        if (brandSelect && brand) {
            const targetBrand = brand.toLowerCase().trim();
            for (let i = 0; i < brandSelect.options.length; i++) {
                const optVal = brandSelect.options[i].value.toLowerCase().trim();
                if (optVal && (optVal === targetBrand || targetBrand.includes(optVal))) {
                    brandSelect.selectedIndex = i;
                    break;
                }
            }
        }
    }
}

// 2. Инициализация филиалов, постов и каталога работ
async function initManagerBookingModule() {
    buildWeekTab(0);

    const branchSelect = document.getElementById('mgrBranchSelect');
    const brandSelect = document.getElementById('mgrCarBrandSelect');

    branchSelect.innerHTML = '<option value="">-- Загрузка филиалов... --</option>';

    try {
        const res = await fetch('get_branches.php');
        const data = await res.json();

        const branchKeys = data.branches ? Object.keys(data.branches) : [];
        if (data.status !== 'success' || branchKeys.length === 0) {
            branchSelect.innerHTML = '<option value="">Филиалы не найдены</option>';
            return;
        }

        globalConfig = data.config || { branches: data.branches };
        allServices = data.services || [];
        const brands = data.brands || [];

        brandSelect.innerHTML = '<option value="">-- Выберите марку --</option>';
        brands.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b;
            opt.textContent = b;
            brandSelect.appendChild(opt);
        });

        branchSelect.innerHTML = '<option value="">-- Выберите филиал --</option>';
        for (let id of branchKeys) {
            let branch = data.branches[id];
            let opt = document.createElement('option');
            let cId = branch.CUSTOMER_ID || branch.id || id;
            let cName = branch.CUSTOMER_NAME || branch.name || `Филиал #${cId}`;
            let cAddr = branch.ADDRESS || branch.address || '';

            opt.value = cId;
            opt.setAttribute('data-name', cName);
            opt.textContent = cName + (cAddr ? ' (' + cAddr + ')' : '');
            branchSelect.appendChild(opt);
        }

        branchSelect.addEventListener('change', function() {
            let branchId = this.value;
            let postSelect = document.getElementById('mgrPostSelect');

            postSelect.innerHTML = '<option value="">-- Выберите пост --</option>';
            document.getElementById('servicesWrapper').style.display = 'none';
            document.getElementById('summaryBox').style.display = 'none';
            document.getElementById('workloadBox').style.display = 'none';
            document.getElementById('slotsContainer').innerHTML = '<div class="slots-empty-notice" style="grid-column: 1 / -1;">📌 Выберите филиал, дату и пост обслуживания</div>';
            document.getElementById('mgrSelectedTime').value = '';

            if (!globalConfig || !branchId || !globalConfig.branches[branchId]) {
                postSelect.disabled = true;
                return;
            }

            let posts = globalConfig.branches[branchId].posts || {};
            let postIds = Object.keys(posts);
            if (postIds.length === 0) {
                postSelect.disabled = true;
                return;
            }

            for (let pId of postIds) {
                let opt = document.createElement('option');
                opt.value = posts[pId].POST_ID || pId;
                opt.textContent = posts[pId].NAME || `Пост #${pId}`;
                postSelect.appendChild(opt);
            }
            postSelect.disabled = false;

            if (postIds.length === 1) {
                postSelect.value = posts[postIds[0]].POST_ID || postIds[0];
                renderTabsAndServices(getBranchCode(this.options[this.selectedIndex].getAttribute('data-name')));
                checkAndLoadSlots();
            }
        });

        document.getElementById('mgrPostSelect').addEventListener('change', function() {
            let bSelect = document.getElementById('mgrBranchSelect');
            renderTabsAndServices(getBranchCode(bSelect.options[bSelect.selectedIndex].getAttribute('data-name')));
            checkAndLoadSlots();
        });

    } catch (e) {
        console.error('Ошибка инициализации модуля менеджера:', e);
        branchSelect.innerHTML = '<option value="">Ошибка загрузки конфигурации</option>';
    }
}

// 3. Календарь выбора дат
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
            document.getElementById('mgrDateSelect').value = dateStr;
        }
    }
}

function selectDate(dateStr, element) {
    document.querySelectorAll('#grid_v4 .card-v4').forEach(el => el.classList.remove('selected'));
    element.classList.add('selected');
    document.getElementById('mgrDateSelect').value = dateStr;
    
    let postId = document.getElementById('mgrPostSelect').value;
    if (postId) checkAndLoadSlots();
}

window.switchWeekTab = function(idx) {
    document.getElementById('btnWeekCurrent').classList.toggle('active', idx === 0);
    document.getElementById('btnWeekNext').classList.toggle('active', idx === 1);
    buildWeekTab(idx);
    let firstCard = document.querySelector('#grid_v4 .card-v4');
    if (firstCard) firstCard.click();
};

function getBranchCode(branchName) {
    if (!branchName) return 'ОП10';
    let match = branchName.match(/№\s*(\d+)/i) || branchName.match(/\b(\d+)\b/);
    if (match) {
        let num = match[1];
        let supported = ['2', '4', '5', '7', '8', '10', '11', '12', '13', '18', '19'];
        if (supported.includes(num)) return 'ОП' + num;
    }
    return 'ОП10';
}

// 4. Каталог услуг и чекбоксы
function renderTabsAndServices(postCode) {
    let wrapper = document.getElementById('servicesWrapper');
    let tabsContainer = document.getElementById('tabsContainer');
    let contentsContainer = document.getElementById('tabContentsContainer');
    tabsContainer.innerHTML = '';
    contentsContainer.innerHTML = '';

    let availableServices = allServices.filter(s => {
        let price = s.prices ? s.prices[postCode] : null;
        return price !== undefined && price !== null && String(price).trim() !== '' && String(price).toLowerCase() !== 'nan';
    });

    if (availableServices.length === 0) {
        wrapper.style.display = 'block';
        contentsContainer.innerHTML = '<span style="color: #dc2626; padding: 10px; font-weight: bold;">Для данного поста нет доступных услуг.</span>';
        return;
    }

    let categories = {};
    availableServices.forEach(s => {
        if (!categories[s.category]) categories[s.category] = [];
        categories[s.category].push(s);
    });

    let first = true;
    for (let catName in categories) {
        let catId = 'cat_' + btoa(unescape(encodeURIComponent(catName))).replace(/[^a-zA-Z0-9]/g, '');
        let tabBtn = document.createElement('button');
        tabBtn.type = 'button';
        tabBtn.className = 'tab-btn' + (first ? ' active' : '');
        tabBtn.textContent = catName + ' (' + categories[catName].length + ')';
        tabBtn.onclick = function() {
            document.querySelectorAll('#tabsContainer .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#tabContentsContainer .tab-content').forEach(c => c.classList.remove('active'));
            this.classList.add('active');
            document.getElementById(catId).classList.add('active');
        };
        tabsContainer.appendChild(tabBtn);

        let tabContent = document.createElement('div');
        tabContent.id = catId;
        tabContent.className = 'tab-content' + (first ? ' active' : '');

        categories[catName].forEach(s => {
            let item = document.createElement('label');
            item.className = 'service-item';

            let leftDiv = document.createElement('div');
            leftDiv.className = 'service-left';
            let cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = s.name;
            cb.setAttribute('data-price', s.prices[postCode]);
            cb.setAttribute('data-time', s.duration);

            leftDiv.appendChild(cb);
            let nameSpan = document.createElement('span');
            nameSpan.textContent = s.name;
            leftDiv.appendChild(nameSpan);

            let rightDiv = document.createElement('div');
            rightDiv.className = 'service-right';
            rightDiv.innerHTML = `<span class="service-price">${s.prices[postCode]} ₽</span><span>⏱ ${s.duration} мин</span>`;

            item.appendChild(leftDiv);
            item.appendChild(rightDiv);
            tabContent.appendChild(item);
        });
        contentsContainer.appendChild(tabContent);
        first = false;
    }
    wrapper.style.display = 'block';

    document.querySelectorAll('#tabContentsContainer input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function() {
            updateSummary();
            document.getElementById('mgrSelectedTime').value = '';
            checkAndLoadSlots();
        });
    });
}

function updateSummary() {
    let totalTime = 0;
    let minPrice = 0;
    let checked = document.querySelectorAll('#tabContentsContainer input:checked');

    checked.forEach(cb => {
        totalTime += parseInt(cb.getAttribute('data-time')) || 60;
        let pStr = cb.getAttribute('data-price').replace(/[^0-9]/g, '');
        if (pStr) minPrice += parseInt(pStr);
    });

    let summaryBox = document.getElementById('summaryBox');
    if (checked.length > 0) {
        summaryBox.style.display = 'flex';
        document.getElementById('totalTime').textContent = totalTime + ' мин';
        document.getElementById('totalPrice').textContent = 'от ' + minPrice + ' ₽';
    } else {
        summaryBox.style.display = 'none';
    }
    return totalTime === 0 ? 60 : totalTime;
}

function updateWorkloadIndicator(slots) {
    let box = document.getElementById('workloadBox');
    if (!slots || slots.length === 0) {
        box.style.display = 'none';
        return;
    }
    let totalSlots = slots.length;
    let availableSlots = slots.filter(s => s.available).length;
    let percent = Math.round(((totalSlots - availableSlots) / totalSlots) * 100);

    document.getElementById('workloadFill').style.width = percent + '%';
    document.getElementById('workloadPercent').textContent = percent + '% занято';
    box.style.display = 'block';
}

async function checkAndLoadSlots() {
    let container = document.getElementById('slotsContainer');
    let branchId = document.getElementById('mgrBranchSelect').value;
    let postId = document.getElementById('mgrPostSelect').value;
    let date = document.getElementById('mgrDateSelect').value;

    if (!branchId || !postId || !date) return;

    container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #666666; font-weight: bold; padding: 10px;">Загрузка свободных окон...</div>';
    
    try {
        let res = await fetch(`getslots_b2b.php?customer_id=${branchId}&post_id=${postId}&date=${date}&duration=${updateSummary()}`);
        let data = await res.json();

        if (data.status === 'success') {
            container.innerHTML = '';
            updateWorkloadIndicator(data.slots);

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
                        document.getElementById('mgrSelectedTime').value = slot.time;
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

// 5. Отправка записи оператором
window.handleManagerBookingSubmit = async function(e) {
    e.preventDefault();

    let name = document.getElementById('mgrName').value.trim();
    let phone = document.getElementById('mgrPhone').value.trim();
    let branchId = document.getElementById('mgrBranchSelect').value;
    let postId = document.getElementById('mgrPostSelect').value;
    let date = document.getElementById('mgrDateSelect').value;
    let time = document.getElementById('mgrSelectedTime').value;
    let carBrand = document.getElementById('mgrCarBrandSelect').value;
    let carPlate = document.getElementById('mgrCarPlate').value.trim();
    let carVin = document.getElementById('mgrCarVin').value.trim();
    let comment = document.getElementById('mgrComment').value.trim();

    if (!branchId || !postId || !time) {
        alert('Пожалуйста, выберите филиал, пост и время визита');
        return;
    }

    let selectedWorksArr = [];
    document.querySelectorAll('#tabContentsContainer input:checked').forEach(cb => {
        if (cb.value && cb.value.trim() !== '') {
            let priceStr = cb.getAttribute('data-price').replace(/[^0-9]/g, '');
            selectedWorksArr.push({
                name: cb.value.trim(),
                price: priceStr ? parseInt(priceStr) : 0,
                duration: parseInt(cb.getAttribute('data-time')) || 60
            });
        }
    });

    let formData = new FormData();
    formData.append('customer_id', branchId);
    formData.append('post_id', postId);
    formData.append('date', date);
    formData.append('time', time);
    formData.append('name', name);
    formData.append('phone', phone);
    formData.append('car_brand', carBrand);
    formData.append('car_plate', carPlate);
    formData.append('car_vin', carVin);
    formData.append('comment', comment || 'Запись через оператора');
    formData.append('duration', updateSummary());
    formData.append('services_json', JSON.stringify(selectedWorksArr));
    
    if (managerClientId) {
        formData.append('client_id', managerClientId);
    }
    formData.append('is_guest', '0'); // Оформлено сотрудником

    let submitBtn = document.getElementById('mgrSubmitBtn');
    let msgDiv = document.getElementById('mgrBookingMsg');

    submitBtn.disabled = true;
    submitBtn.textContent = 'Создание сделки в STOCRM...';
    msgDiv.className = 'message';
    msgDiv.style.display = 'none';

    try {
        let res = await fetch('booking_handler.php', {
            method: 'POST',
            body: formData
        });
        let result = await res.json();

        if (result.status === 'success') {
            msgDiv.className = 'message success is-visible';
            msgDiv.innerHTML = `✔ <b>Сделка успешно создана в STOCRM!</b><br>Клиент: <b>${name}</b> | Авто: <b>${carBrand} (${carPlate})</b> | Время: <b>${date} ${time}</b>`;
            submitBtn.textContent = 'Сделка оформлена ✔';

            setTimeout(() => {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Записать клиента в STOCRM';
            }, 3000);
        } else {
            msgDiv.className = 'message error is-visible';
            msgDiv.textContent = 'Ошибка STOCRM: ' + (result.message || 'Не удалось создать сделку');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Записать клиента в STOCRM';
        }
    } catch (err) {
        console.error('Ошибка записи:', err);
        msgDiv.className = 'message error is-visible';
        msgDiv.textContent = 'Ошибка отправки: ' + err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Записать клиента в STOCRM';
    }
};