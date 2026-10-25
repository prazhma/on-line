/* ============================================================
   ПИН-АВТО — СКРИПТ ГОСТЕВОЙ ЗАПИСИ (JS/GUEST.JS)
   Финальная версия с полным сбросом подсказок и полей
   ============================================================ */

let globalConfig = null;
let allServices = [];
let isClientRegistered = false;
let foundClientId = null;
let clientCarsList = [];
let selectedCarProfileId = null;

const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const DEFAULT_CAR_BRANDS = [
    "Acura", "Alfa Romeo", "Aston Martin", "Audi", "BAIC", "Bentley", "BMW", "Bugatti", 
    "Buick", "BYD", "Cadillac", "Changan", "Chery", "Chevrolet", "Chrysler", "Citroen", 
    "Dacia", "Daewoo", "Datsun", "Dodge", "Dongfeng", "Exeed", "FAW", "Ferrari", "Fiat", 
    "Ford", "GAC", "GAZ", "Geely", "Genesis", "Great Wall", "Haval", "Holden", "Honda", 
    "Hongqi", "Hyundai", "Infiniti", "Jac", "Jaecoo", "Jaguar", "Jeep", "Jetour", "Kaiyi", 
    "Kia", "Lada", "Lamborghini", "Lancia", "Land Rover", "Lexus", "Lifan", "Li Auto", 
    "Livian", "Lotus", "Maserati", "Maybach", "Mazda", "Mercedes", "Mercury", "Mini", 
    "Mitsubishi", "Moskvich", "Nissan", "Omoda", "Opel", "Oting", "Pagani", "Peugeot", 
    "Pontiac", "Porsche", "RAM", "Ravon", "Renault", "Rolls-Royce", "Rover", "Saab", 
    "Scion", "Seat", "Skoda", "Solaris", "SsangYong", "Subaru", "Suzuki", "Tank", 
    "Toyota", "UAZ", "Vauxhall", "Volkswagen", "Volvo", "Vortex", "Voyah", "Zeekr", "Zotye"
];

const UNIVERSAL_BRAND_VALUE = "Другая марка (универсальный)";

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

document.addEventListener('DOMContentLoaded', () => {
    populateCarBrands();
    initBrandChangeListener();
    initPhoneInputFilters();
    initGuestBookingModule();
});

function populateCarBrands(customBrands = null) {
    const brandSelect = document.getElementById('carBrandSelect');
    if (!brandSelect) return;

    const currentSelected = brandSelect.value;
    const brandsList = (Array.isArray(customBrands) && customBrands.length > 0) 
        ? customBrands 
        : DEFAULT_CAR_BRANDS;

    const filteredBrands = brandsList.filter(b => 
        !b.toLowerCase().includes('другая') && 
        !b.toLowerCase().includes('универсальн') && 
        !b.toLowerCase().includes('нет в списке')
    );
    const sortedBrands = [...filteredBrands].sort((a, b) => a.localeCompare(b, 'ru', { sensitivity: 'base' }));

    let html = '<option value="">-- Выберите марку --</option>';
    const isTopSelected = (currentSelected === UNIVERSAL_BRAND_VALUE) ? 'selected' : '';
    html += `<option value="${UNIVERSAL_BRAND_VALUE}" ${isTopSelected}>⭐ Другая марка (универсальный ответ)</option>`;

    sortedBrands.forEach(brand => {
        const isSel = (brand.toLowerCase() === currentSelected.toLowerCase()) ? 'selected' : '';
        html += `<option value="${escapeHtml(brand)}" ${isSel}>${escapeHtml(brand)}</option>`;
    });

    html += `<option value="${UNIVERSAL_BRAND_VALUE}">Другая марка (нет в списке)</option>`;
    brandSelect.innerHTML = html;

    if (currentSelected === UNIVERSAL_BRAND_VALUE) {
        brandSelect.value = UNIVERSAL_BRAND_VALUE;
    }
}

function initBrandChangeListener() {
    const brandSelect = document.getElementById('carBrandSelect');
    const customBrandRow = document.getElementById('customBrandRow');
    if (!brandSelect || !customBrandRow) return;

    brandSelect.addEventListener('change', () => {
        if (brandSelect.value === UNIVERSAL_BRAND_VALUE) {
            customBrandRow.style.display = 'flex';
            const input = document.getElementById('customBrandInput');
            if (input) input.focus();
        } else {
            customBrandRow.style.display = 'none';
            const input = document.getElementById('customBrandInput');
            if (input) input.value = '';
        }
    });
}

function initPhoneInputFilters() {
    const phoneInput = document.getElementById('guestPhone');
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
            if (val.length > 1) {
                formatted += '(' + val.substring(1, 4);
            }
            if (val.length >= 5) {
                formatted += ') ' + val.substring(4, 7);
            }
            if (val.length >= 8) {
                formatted += '-' + val.substring(7, 9);
            }
            if (val.length >= 10) {
                formatted += '-' + val.substring(9, 11);
            }
            e.target.value = formatted;
        } else {
            e.target.value = '+' + val.substring(0, 15);
        }

        if (val.length === 11) {
            handlePhoneBlurCheck();
        }
    });

    phoneInput.addEventListener('blur', handlePhoneBlurCheck);
}

async function handlePhoneBlurCheck() {
    const phoneInput = document.getElementById('guestPhone');
    const hintEl = document.getElementById('phoneCheckHint');
    const nameInput = document.getElementById('guestName');
    const carsContainer = document.getElementById('clientCarsContainer');
    const carSelect = document.getElementById('clientCarSelect');

    const phoneVal = phoneInput.value.trim();
    const cleanDigits = phoneVal.replace(/\D/g, '');

    if (cleanDigits.length < 11) {
        if (hintEl) {
            hintEl.textContent = 'Укажите номер телефона';
            hintEl.style.color = '#777777';
        }
        if (carsContainer) carsContainer.style.display = 'none';
        return;
    }

    if (hintEl) {
        hintEl.textContent = '🔍 Проверка номера телефона...';
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
            isClientRegistered = true;
            foundClientId = data.client.id || data.client.CONTACT_ID;

            if (nameInput && data.client.name) {
                const parts = data.client.name.trim().split(/\s+/);
                const firstName = parts[1] || parts[0];
                if (!nameInput.value.trim()) {
                    nameInput.value = firstName;
                }
                if (hintEl) {
                    hintEl.textContent = `✔ Здравствуйте, ${firstName}! Рады видеть вас снова.`;
                    hintEl.style.color = '#15803d';
                }
            } else if (hintEl) {
                hintEl.textContent = '✔ Номер подтвержден (постоянный клиент)';
                hintEl.style.color = '#15803d';
            }

            try {
                const resCars = await fetch(`api/cars.php?client_id=${encodeURIComponent(foundClientId)}`);
                const dataCars = await resCars.json();

                if (dataCars.status === 'success' && dataCars.cars && dataCars.cars.length > 0) {
                    clientCarsList = dataCars.cars;
                    if (carSelect) {
                        carSelect.innerHTML = '<option value="">-- Выберите ваш автомобиль --</option>';
                        clientCarsList.forEach((car, index) => {
                            const opt = document.createElement('option');
                            opt.value = index;
                            opt.textContent = `${car.brand || 'Марка'} ${car.model || ''} (${car.plate || car.vin || 'Без номера'})`;
                            carSelect.appendChild(opt);
                        });
                        const newOpt = document.createElement('option');
                        newOpt.value = 'new';
                        newOpt.textContent = '➕ Указать другой / новый автомобиль';
                        carSelect.appendChild(newOpt);

                        if (carsContainer) carsContainer.style.display = 'block';
                        carSelect.value = "0";
                        onClientCarSelected(carSelect);
                    }
                } else {
                    if (carsContainer) carsContainer.style.display = 'none';
                }
            } catch (carErr) {
                console.warn('Ошибка получения автомобилей клиента:', carErr);
                if (carsContainer) carsContainer.style.display = 'none';
            }

        } else {
            isClientRegistered = false;
            foundClientId = null;
            if (carsContainer) carsContainer.style.display = 'none';
            if (hintEl) {
                hintEl.textContent = 'ℹ️ Новый клиент (продолжайте заполнение формы)';
                hintEl.style.color = '#856404';
            }
        }
    } catch (e) {
        console.error('Ошибка запроса check_client:', e);
        isClientRegistered = false;
        foundClientId = null;
        if (carsContainer) carsContainer.style.display = 'none';
        if (hintEl) {
            hintEl.textContent = 'Укажите номер телефона';
            hintEl.style.color = '#777777';
        }
    }
}

function onClientCarSelected(selectObj) {
    const val = selectObj.value;
    const carBrandSelect = document.getElementById('carBrandSelect');
    const carPlateInput = document.getElementById('carPlateInput');
    const hiddenCarId = document.getElementById('selectedCarProfileId');
    
    if (val === 'new' || val === '') {
        selectedCarProfileId = null;
        if (hiddenCarId) hiddenCarId.value = '';
        if (carBrandSelect) carBrandSelect.value = '';
        if (carPlateInput) carPlateInput.value = '';
    } else {
        const car = clientCarsList[parseInt(val, 10)];
        if (car) {
            selectedCarProfileId = car.id || car.CAR_PROFILE_ID;
            if (hiddenCarId) hiddenCarId.value = selectedCarProfileId;
            if (carPlateInput) carPlateInput.value = car.plate || car.vin || '';
            if (carBrandSelect && car.brand) {
                const targetBrand = car.brand.toLowerCase().trim();
                for (let i = 0; i < carBrandSelect.options.length; i++) {
                    const optVal = carBrandSelect.options[i].value.toLowerCase().trim();
                    if (optVal && (optVal === targetBrand || targetBrand.includes(optVal))) {
                        carBrandSelect.selectedIndex = i;
                        break;
                    }
                }
            }
        }
    }
}

async function initGuestBookingModule() {
    buildWeekTab(0);
    const branchSelect = document.getElementById('branchSelect');
    
    if (branchSelect) {
        branchSelect.innerHTML = '<option value="">-- Загрузка филиалов... --</option>';
    }

    try {
        const res = await fetch('get_branches.php');
        const data = await res.json();

        const branchKeys = data.branches ? Object.keys(data.branches) : [];
        if (data.status !== 'success' || branchKeys.length === 0) {
            if (branchSelect) branchSelect.innerHTML = '<option value="">Филиалы не найдены в конфигурации</option>';
            return;
        }

        globalConfig = data.config || { branches: data.branches };
        allServices = data.services || [];

        if (data.brands && Array.isArray(data.brands) && data.brands.length > 0) {
            populateCarBrands(data.brands);
        }

        if (branchSelect) {
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
                let postSelect = document.getElementById('postSelect');

                postSelect.innerHTML = '<option value="">-- Выберите пост --</option>';
                document.getElementById('servicesWrapper').style.display = 'none';
                document.getElementById('summaryBox').style.display = 'none';
                document.getElementById('workloadBox').style.display = 'none';
                document.getElementById('slotsContainer').innerHTML = '<div class="slots-empty-notice" style="grid-column: 1 / -1;">📌 Выберите филиал, дату и пост обслуживания</div>';
                document.getElementById('selectedTime').value = '';

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
        }

        const postSelectEl = document.getElementById('postSelect');
        if (postSelectEl) {
            postSelectEl.addEventListener('change', function() {
                let bSelect = document.getElementById('branchSelect');
                renderTabsAndServices(getBranchCode(bSelect.options[bSelect.selectedIndex].getAttribute('data-name')));
                checkAndLoadSlots();
            });
        }

    } catch (e) {
        console.error('Ошибка инициализации гостевой записи:', e);
        if (branchSelect) branchSelect.innerHTML = '<option value="">Ошибка загрузки филиалов</option>';
    }
}

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
    
    let postId = document.getElementById('postSelect').value;
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

function renderTabsAndServices(postCode) {
    let wrapper = document.getElementById('servicesWrapper');
    let tabsContainer = document.getElementById('tabsContainer');
    let contentsContainer = document.getElementById('tabContentsContainer');
    if (!tabsContainer || !contentsContainer) return;
    tabsContainer.innerHTML = '';
    contentsContainer.innerHTML = '';

    let availableServices = allServices.filter(s => {
        let price = s.prices ? s.prices[postCode] : null;
        return price !== undefined && price !== null && String(price).trim() !== '' && String(price).toLowerCase() !== 'nan';
    });

    if (availableServices.length === 0) {
        if (wrapper) wrapper.style.display = 'block';
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
    if (wrapper) wrapper.style.display = 'block';

    document.querySelectorAll('#tabContentsContainer input[type="checkbox"]').forEach(cb => {
        cb.addEventListener('change', function() {
            let checkedCount = document.querySelectorAll('#tabContentsContainer input:checked').length;
            if (checkedCount > 4) {
                this.checked = false;
                alert('Можно выбрать не более 4 услуг одновременно');
                updateSummary();
                return;
            }
            updateSummary();
            document.getElementById('selectedTime').value = '';
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
        if (summaryBox) summaryBox.style.display = 'flex';
        const tTimeEl = document.getElementById('totalTime');
        const tPriceEl = document.getElementById('totalPrice');
        if (tTimeEl) tTimeEl.textContent = totalTime + ' мин';
        if (tPriceEl) tPriceEl.textContent = 'от ' + minPrice + ' ₽';
    } else {
        if (summaryBox) summaryBox.style.display = 'none';
    }
    return totalTime === 0 ? 60 : totalTime;
}

function updateWorkloadIndicator(slots) {
    let box = document.getElementById('workloadBox');
    if (!slots || slots.length === 0) {
        if (box) box.style.display = 'none';
        return;
    }
    let totalSlots = slots.length;
    let availableSlots = slots.filter(s => s.available).length;
    let percent = Math.round(((totalSlots - availableSlots) / totalSlots) * 100);

    const fillEl = document.getElementById('workloadFill');
    const percentEl = document.getElementById('workloadPercent');
    if (fillEl) fillEl.style.width = percent + '%';
    if (percentEl) percentEl.textContent = percent + '% занято';
    if (box) box.style.display = 'block';
}

async function checkAndLoadSlots() {
    let container = document.getElementById('slotsContainer');
    let branchId = document.getElementById('branchSelect').value;
    let postId = document.getElementById('postSelect').value;
    let date = document.getElementById('dateSelect').value;

    if (!branchId || !postId || !date || !container) return;

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

window.handleGuestBookingSubmit = async function(e) {
    e.preventDefault();

    let name = document.getElementById('guestName').value.trim();
    let phone = document.getElementById('guestPhone').value.trim();
    let branchId = document.getElementById('branchSelect').value;
    let postId = document.getElementById('postSelect').value;
    let date = document.getElementById('dateSelect').value;
    let time = document.getElementById('selectedTime').value;
    let carBrand = document.getElementById('carBrandSelect').value;
    let carPlate = document.getElementById('carPlateInput').value.trim();

    const customBrandInput = document.getElementById('customBrandInput');
    if (carBrand === UNIVERSAL_BRAND_VALUE) {
        if (customBrandInput && customBrandInput.value.trim()) {
            carBrand = customBrandInput.value.trim();
        } else {
            carBrand = 'Другая марка (универсальный)';
        }
    }

    if (!branchId || !postId || !time) {
        alert('Пожалуйста, выберите филиал, пост и доступное время визита');
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
    formData.append('car_plate', carPlate || '');
    formData.append('duration', updateSummary());
    formData.append('services_json', JSON.stringify(selectedWorksArr));
    
    if (foundClientId) {
        formData.append('client_id', foundClientId);
    }
    
    let hiddenCarId = document.getElementById('selectedCarProfileId');
    if (hiddenCarId && hiddenCarId.value) {
        formData.append('car_profile_id', hiddenCarId.value);
    }

    formData.append('is_guest', isClientRegistered ? '0' : '1');

    let submitBtn = document.getElementById('bookingSubmitBtn');
    let msgDiv = document.getElementById('guestBookingMsg');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка заявки в STOCRM...';
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
            
            if (isClientRegistered) {
                msgDiv.innerHTML = `
                    <div class="guest-notice-box success-notice" style="background: #ecfdf5; border: 1px solid #10b981; color: #065f46; padding: 15px; border-radius: 8px; font-weight: bold; text-align: center;">
                        <b style="font-size: 15px;">✔ Запись успешно создана!</b><br><br>
                        Рады видеть вас снова, <b>${escapeHtml(name)}</b>! Ваша бронь подтверждена в расписании филиала. Ждем вас к назначенному времени.
                    </div>
                `;
            } else {
                msgDiv.innerHTML = `
                    <div class="guest-notice-box" style="background: #f0fdf4; border: 1px solid #22c55e; color: #166534; padding: 15px; border-radius: 8px; font-weight: bold; text-align: center;">
                        <b style="font-size: 15px;">✔ Запись создана!</b><br><br>
                        Для подтверждения записи дождитесь звонка нашего менеджера.
                    </div>
                `;
            }
            msgDiv.style.display = 'block';
            msgDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
            submitBtn.style.display = 'none';

            // Автоматическая очистка формы, подсказок и сброс данных клиента через 5 секунд
            setTimeout(() => {
                const formEl = document.getElementById('guestBookingForm');
                if (formEl) formEl.reset();
                
                const carsContainer = document.getElementById('clientCarsContainer');
                if (carsContainer) carsContainer.style.display = 'none';

                // Сбрасываем текст и стиль подсказки телефона
                const hintEl = document.getElementById('phoneCheckHint');
                if (hintEl) {
                    hintEl.textContent = 'Укажите номер телефона';
                    hintEl.style.color = '#777777';
                }

                // Сбрасываем служебные переменные клиента
                isClientRegistered = false;
                foundClientId = null;
                clientCarsList = [];
                selectedCarProfileId = null;
                
                msgDiv.style.display = 'none';
                msgDiv.innerHTML = '';
                
                submitBtn.style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Создать заявку на запись';
                
                buildWeekTab(0);
            }, 5000);

        } else {
            msgDiv.className = 'message error is-visible';
            msgDiv.textContent = 'Ошибка: ' + (result.message || 'Не удалось создать запись');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Создать заявку на запись';
        }
    } catch (err) {
        console.error('Ошибка записи:', err);
        msgDiv.className = 'message error is-visible';
        msgDiv.textContent = 'Ошибка отправки данных: ' + err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Создать заявку на запись';
    }
};