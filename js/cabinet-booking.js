/* ============================================================
   ПИН-АВТО — МОДУЛЬ ОНЛАЙН-ЗАПИСИ НА СЕРВИС (JS/CABINET-BOOKING.JS)
   ============================================================ */

let globalConfig = null;
let allServices = [];
let isBookingModuleInitialized = false;
const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function switchServicesSubTab(subTab) {
    const btnList = document.getElementById('btnSubtabList');
    const btnNew = document.getElementById('btnSubtabNew');
    const viewList = document.getElementById('subtabServicesList');
    const viewNew = document.getElementById('subtabServicesNew');

    if (subTab === 'list') {
        if (btnList) btnList.classList.add('active');
        if (btnNew) btnNew.classList.remove('active');
        if (viewList) viewList.style.display = 'block';
        if (viewNew) viewNew.style.display = 'none';
    } else {
        if (btnNew) btnNew.classList.add('active');
        if (btnList) btnList.classList.remove('active');
        if (viewList) viewList.style.display = 'none';
        if (viewNew) viewNew.style.display = 'block';
        initCabinetBookingModule();
    }
}

function startNewBooking(preselectedCarId = null) {
    if (typeof switchTab === 'function') switchTab('services');
    switchServicesSubTab('new');
    if (preselectedCarId) {
        setTimeout(() => {
            const select = document.getElementById('bookingCarGarageSelect');
            if (select) {
                select.value = preselectedCarId;
                handleGarageCarChange();
            }
        }, 100);
    }
}

function populateGarageSelect(cars) {
    const select = document.getElementById('bookingCarGarageSelect');
    if (!select) return;
    select.innerHTML = '';

    if (cars && cars.length > 0) {
        cars.forEach((c, idx) => {
            const title = c.title || `${c.brand || ''} ${c.model || ''}`.trim() || 'Автомобиль';
            const opt = document.createElement('option');
            opt.value = c.id || idx;
            opt.textContent = `${title} [${c.plate || 'без госномера'}]`;
            opt.setAttribute('data-brand', c.brand || title);
            opt.setAttribute('data-plate', c.plate || '');
            select.appendChild(opt);
        });
    }

    const manualOpt = document.createElement('option');
    manualOpt.value = 'manual';
    manualOpt.textContent = '+ Другой автомобиль (указать вручную)';
    select.appendChild(manualOpt);

    handleGarageCarChange();
}

function handleGarageCarChange() {
    const select = document.getElementById('bookingCarGarageSelect');
    const manualRow = document.getElementById('manualCarFieldsRow');
    const carBrand = document.getElementById('carBrand');
    const carPlate = document.getElementById('carPlate');

    if (select && select.value === 'manual') {
        if (manualRow) manualRow.style.display = 'grid';
        if (carBrand) carBrand.required = true;
        if (carPlate) carPlate.value = '';
    } else {
        if (manualRow) manualRow.style.display = 'none';
        if (carBrand) carBrand.required = false;
        if (select) {
            const opt = select.options[select.selectedIndex];
            if (opt) {
                if (carBrand) carBrand.value = opt.getAttribute('data-brand') || '';
                if (carPlate) carPlate.value = opt.getAttribute('data-plate') || '';
            }
        }
    }
}

async function initCabinetBookingModule() {
    if (isBookingModuleInitialized) return;

    buildWeekTab(0);

    const branchSelect = document.getElementById('branchSelect');
    if (!branchSelect) return;
    branchSelect.innerHTML = '<option value="">-- Загрузка филиалов... --</option>';

    try {
        const res = await fetch('get_branches.php');
        const data = await res.json();

        const branchKeys = data.branches ? Object.keys(data.branches) : [];
        if (data.status !== 'success' || branchKeys.length === 0) {
            branchSelect.innerHTML = '<option value="">Филиалы временно недоступны</option>';
            return;
        }

        globalConfig = data.config || { branches: data.branches };
        allServices = data.services || [];
        
        const defaultBrands = [
            "Acura", "Alfa Romeo", "Aston Martin", "Audi", "Bentley", "BMW", "Bugatti", 
            "Buick", "Cadillac", "Chery", "Chevrolet", "Chrysler", "Citroen", "Dacia", 
            "Daewoo", "Dodge", "Ferrari", "Fiat", "Ford", "GAZ", "Holden", "Honda", 
            "Hyundai", "Infiniti", "Jaguar", "Jeep", "Kia", "Lada", "Lamborghini", 
            "Lancia", "Land Rover", "Lexus", "Lotus", "Maserati", "Maybach", "Mazda", 
            "Mercedes", "Mercury", "Mini", "Mitsubishi", "Nissan", "Opel", "Pagani", 
            "Peugeot", "Pontiac", "Porsche", "Renault", "Rolls-Royce", "Rover", "Saab", 
            "Scion", "Seat", "Skoda", "SsangYong", "Subaru", "Suzuki", "Toyota", 
            "Vauxhall", "Volkswagen", "Volvo"
        ];
        const brands = (data.brands && data.brands.length > 0) ? data.brands : defaultBrands;

        const brandSelect = document.getElementById('carBrand');
        if (brandSelect) {
            brandSelect.innerHTML = '<option value="">-- Выберите марку авто --</option>';
            brands.forEach(b => {
                const opt = document.createElement('option');
                opt.value = b;
                opt.textContent = b;
                brandSelect.appendChild(opt);
            });
        }

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

            postSelect.value = posts[postIds[0]].POST_ID || postIds[0];
            const branchName = this.options[this.selectedIndex].getAttribute('data-name') || '';
            renderTabsAndServices(getBranchCode(branchName));
            checkAndLoadSlots();
        });

        const postSel = document.getElementById('postSelect');
        if (postSel) {
            postSel.addEventListener('change', function() {
                let bSelect = document.getElementById('branchSelect');
                const branchName = bSelect.options[bSelect.selectedIndex].getAttribute('data-name') || '';
                renderTabsAndServices(getBranchCode(branchName));
                checkAndLoadSlots();
            });
        }

        isBookingModuleInitialized = true;
    } catch (e) {
        console.error('Ошибка инициализации записи:', e);
        branchSelect.innerHTML = '<option value="">Ошибка загрузки филиалов</option>';
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
    document.getElementById('dateSelect').value = dateStr;
    let postId = document.getElementById('postSelect').value;
    if (postId) checkAndLoadSlots();
}

function switchWeekTab(idx) {
    document.getElementById('btnWeekCurrent').classList.toggle('active', idx === 0);
    document.getElementById('btnWeekNext').classList.toggle('active', idx === 1);
    buildWeekTab(idx);
    let firstCard = document.querySelector('#grid_v4 .card-v4');
    if (firstCard) firstCard.click();
}

function getBranchCode(branchName) {
    if (!branchName) return 'ОП10';
    let match = branchName.match(/№\s*(\d+)/i) || branchName.match(/\b(\d+)\b/);
    if (match) {
        return 'ОП' + match[1];
    }
    return 'ОП10';
}

function extractServicePrice(prices, branchCode) {
    if (!prices || typeof prices !== 'object') return null;

    if (prices[branchCode] !== undefined && prices[branchCode] !== null) {
        return prices[branchCode];
    }

    const withSpace = branchCode.replace(/(\D+)(\d+)/, '$1 $2');
    if (prices[withSpace] !== undefined && prices[withSpace] !== null) {
        return prices[withSpace];
    }

    const onlyNum = branchCode.replace(/\D/g, '');
    if (onlyNum && prices[onlyNum] !== undefined && prices[onlyNum] !== null) {
        return prices[onlyNum];
    }

    const cleanTarget = branchCode.replace(/\s+/g, '').toLowerCase();
    for (let key in prices) {
        if (key.replace(/\s+/g, '').toLowerCase() === cleanTarget) {
            return prices[key];
        }
    }

    return null;
}

function renderTabsAndServices(postCode) {
    let wrapper = document.getElementById('servicesWrapper');
    let tabsContainer = document.getElementById('tabsContainer');
    let contentsContainer = document.getElementById('tabContentsContainer');
    if (!tabsContainer || !contentsContainer) return;

    tabsContainer.innerHTML = '';
    contentsContainer.innerHTML = '';

    let availableServices = allServices.filter(s => {
        let price = extractServicePrice(s.prices, postCode);
        return price !== undefined && price !== null && String(price).trim() !== '' && String(price).toLowerCase() !== 'nan';
    });

    if (availableServices.length === 0) {
        if (wrapper) wrapper.style.display = 'block';
        contentsContainer.innerHTML = '<span style="color: #dc2626; padding: 10px; font-weight: 700;">Для данного поста нет доступных услуг.</span>';
        return;
    }

    let categories = {};
    availableServices.forEach(s => {
        let cat = s.category || 'Общие работы';
        if (!categories[cat]) categories[cat] = [];
        categories[cat].push(s);
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
            let currentPrice = extractServicePrice(s.prices, postCode);
            let item = document.createElement('label');
            item.className = 'service-item';

            let leftDiv = document.createElement('div');
            leftDiv.className = 'service-left';
            let cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.value = s.name;
            cb.setAttribute('data-price', currentPrice);
            cb.setAttribute('data-time', s.duration || 60);

            leftDiv.appendChild(cb);
            let nameSpan = document.createElement('span');
            nameSpan.textContent = s.name;
            leftDiv.appendChild(nameSpan);

            let rightDiv = document.createElement('div');
            rightDiv.className = 'service-right';
            rightDiv.innerHTML = `<span class="service-price">${currentPrice} ₽</span><span>⏱ ${s.duration || 60} мин</span>`;

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

    container.innerHTML = '<div class="empty-info-box">Загрузка свободных окон...</div>';
    try {
        let res = await fetch(`getslots_b2b.php?customer_id=${branchId}&post_id=${postId}&date=${date}&duration=${updateSummary()}`);
        let data = await res.json();

        if (data.status === 'success') {
            container.innerHTML = '';
            updateWorkloadIndicator(data.slots);

            if (!data.slots || data.slots.length === 0) {
                container.innerHTML = '<span style="color: var(--color-red); grid-column: 1 / -1; font-weight: 700;">Нет свободного времени на выбранную дату</span>';
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
            container.innerHTML = `<span style="color: var(--color-red); grid-column: 1 / -1; font-weight: 700;">${data.message || 'Ошибка расчета слотов'}</span>`;
        }
    } catch (e) {
        console.error('Ошибка слотов:', e);
        container.innerHTML = '<span style="color: var(--color-red); grid-column: 1 / -1; font-weight: 700;">Ошибка связи со STOCRM</span>';
    }
}

async function handleCabinetBookingSubmit(e) {
    e.preventDefault();

    let branchId = document.getElementById('branchSelect').value;
    let postId = document.getElementById('postSelect').value;
    let date = document.getElementById('dateSelect').value;
    let time = document.getElementById('selectedTime').value;

    if (!branchId || !postId) {
        alert('Пожалуйста, выберите филиал и пост обслуживания');
        return;
    }
    if (!time) {
        alert('Пожалуйста, выберите удобное время визита');
        return;
    }

    let carGarageSelect = document.getElementById('bookingCarGarageSelect');
    let carBrandVal = '';
    let carPlateVal = '';

    if (carGarageSelect && carGarageSelect.value === 'manual') {
        carBrandVal = document.getElementById('carBrand').value;
        carPlateVal = document.getElementById('carPlate').value.trim();
    } else if (carGarageSelect) {
        let opt = carGarageSelect.options[carGarageSelect.selectedIndex];
        if (opt) {
            carBrandVal = opt.getAttribute('data-brand') || '';
            carPlateVal = opt.getAttribute('data-plate') || '';
        }
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
    formData.append('name', clientName);
    formData.append('phone', clientPhone);
    formData.append('car_brand', carBrandVal);
    formData.append('car_plate', carPlateVal);
    formData.append('duration', updateSummary());
    formData.append('services_json', JSON.stringify(selectedWorksArr));

    let submitBtn = document.getElementById('bookingSubmitBtn');
    let msgDiv = document.getElementById('cabinetBookingMsg');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка заявки в STOCRM...';
    msgDiv.className = 'message';
    msgDiv.textContent = 'Создание сделки и бронирование слота...';
    msgDiv.style.display = 'block';

    try {
        let res = await fetch('booking_handler.php', {
            method: 'POST',
            body: formData
        });
        let result = await res.json();

        if (result.status === 'success') {
            msgDiv.className = 'message success is-visible';
            msgDiv.textContent = 'Вы успешно записаны на сервис! Сделка оформлена в STOCRM.';
            submitBtn.textContent = 'Заявка отправлена ✔';

            setTimeout(() => {
                if (typeof loadServiceAppointments === 'function') {
                    loadServiceAppointments(clientId);
                }
                switchServicesSubTab('list');
                msgDiv.style.display = 'none';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Подтвердить запись';
            }, 2500);
        } else {
            msgDiv.className = 'message error is-visible';
            msgDiv.textContent = 'Ошибка: ' + (result.message || 'Не удалось создать запись');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Подтвердить запись';
        }
    } catch (err) {
        console.error('Ошибка записи:', err);
        msgDiv.className = 'message error is-visible';
        msgDiv.textContent = 'Ошибка отправки данных: ' + err.message;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Подтвердить запись';
    }
}