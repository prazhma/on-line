/* ============================================================
   ПИН-АВТО — КЛИЕНТСКИЙ СКРИПТ КАБИНЕТА (JS/CABINET.JS)
   ============================================================ */

const clientStr = localStorage.getItem('pin_client');
if (!clientStr) {
    window.location.href = 'login.html';
}

let client = {};
try {
    client = JSON.parse(clientStr || '{}');
} catch (e) {
    client = {};
}

const clientName = client.title || client.name || 'Клиент';
const clientId = client.id || client.CONTACT_ID || client.CUSTOMER_ID || client.client_id || 0;
const clientPhone = client.phone || client.PHONE || '';

// Обработчик полей E-Mail для предотвращения ошибок HTML5-валидации
function initEmptyEmailField(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    
    el.value = val ? val : 'нет данных';
    el.type = val ? 'email' : 'text';
    
    if (!el.dataset.initialized) {
        el.addEventListener('focus', function() {
            if (this.value === 'нет данных') {
                this.value = '';
            }
            this.type = 'email';
        });
        el.addEventListener('blur', function() {
            if (this.value.trim() === '') {
                this.type = 'text';
                this.value = 'нет данных';
            }
        });
        el.dataset.initialized = "true";
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // 1. Инициализация имени и аватара в сайдбаре
    const sidebarNameEl = document.getElementById('sidebarUserName');
    if (sidebarNameEl) sidebarNameEl.textContent = clientName;

    const avatarInitialsEl = document.getElementById('userAvatarInitials');
    if (avatarInitialsEl) {
        avatarInitialsEl.textContent = clientName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    const welcomeTitleEl = document.getElementById('welcomeTitle');
    if (welcomeTitleEl) {
        welcomeTitleEl.textContent = `Добро пожаловать, ${clientName.split(' ')[1] || clientName}!`;
    }

    // 2. Текущая дата
    const dateSubtitleEl = document.getElementById('currentDateSubtitle');
    if (dateSubtitleEl) {
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const dateStr = new Date().toLocaleDateString('ru-RU', options);
        dateSubtitleEl.textContent = `Сегодня ${dateStr}. Что планируем сегодня?`;
    }

    // 3. Предзаполнение полей формы из кэша
    const initialNameParts = clientName.trim().split(/\s+/);
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null && val !== false && val !== 'false') {
            el.value = val;
        }
    };

    setVal('settingsLastName', initialNameParts[0] || '');
    setVal('settingsFirstName', initialNameParts[1] || '');
    setVal('settingsMiddleName', initialNameParts.slice(2).join(' ') || '');
    setVal('settingsPhoneInput', clientPhone || '+7 (...) ...-..--');
    setVal('jurContactPerson', clientName);
    setVal('jurCompanyPhone', clientPhone);
    
    const initEmail = client.email || client.EMAIL || '';
    initEmptyEmailField('settingsEmailInput', initEmail);
    initEmptyEmailField('jurCompanyEmail', initEmail);

    // 4. Отображение кэшированных баллов
    const cachedPoints = client.balance ?? client.points ?? client.POINTS ?? client.BALANCE ?? 
                         client.cashback ?? client.CASHBACK ?? client.bonus ?? client.BONUS ?? client.score ?? null;
    if (cachedPoints !== null && cachedPoints !== undefined) {
        updateLoyaltyDisplay(cachedPoints);
    }

    // 5. Загрузка данных через API STOCRM
    loadCabinetData(clientId);
    loadLoyaltyBalance(clientId);
    loadTransactions(clientId);
    loadServiceAppointments(clientId);
    loadRecommendations(clientId);
    loadUserProfile(clientId);
    initCabinetBookingModule();
});

function updateLoyaltyDisplay(val) {
    if (val === undefined || val === null || val === '') return;
    const num = parseFloat(val);
    const displayVal = isNaN(num) ? val : num;
    
    const mainEl = document.getElementById('mainLoyaltyPoints');
    if (mainEl) mainEl.textContent = `${displayVal} баллов`;
    
    const pageEl = document.getElementById('loyaltyPagePoints');
    if (pageEl) pageEl.textContent = `${displayVal} баллов`;
}

function logout() {
    localStorage.removeItem('pin_client');
    window.location.href = 'login.html';
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

    const targetNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (targetNav) targetNav.classList.add('active');

    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) targetPane.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === 'services') {
        switchServicesSubTab('new');
    }
}

function switchSettingsPill(type, btn) {
    document.querySelectorAll('#profileTypePills .pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) {
        btn.classList.add('active');
    } else {
        const targetBtn = document.getElementById(type === 'phys' ? 'pillBtnPhys' : 'pillBtnJur');
        if (targetBtn) targetBtn.classList.add('active');
    }

    const panelPhys = document.getElementById('panelPhys');
    const panelJur = document.getElementById('panelJur');

    if (type === 'phys') {
        if (panelPhys) panelPhys.classList.add('active');
        if (panelJur) panelJur.classList.remove('active');
    } else if (type === 'jur') {
        if (panelJur) panelJur.classList.add('active');
        if (panelPhys) panelPhys.classList.remove('active');
    }
}

function switchSettingsTabStyled(type) {
    const targetBtn = document.getElementById(type === 'phys' ? 'pillBtnPhys' : 'pillBtnJur');
    switchSettingsPill(type, targetBtn);
}

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
    switchTab('services');
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

// Загрузка полного профиля из STOCRM
async function loadUserProfile(cId) {
    const idToFetch = cId || clientId;
    try {
        let url = `api/customer.php?action=get_profile&client_id=${encodeURIComponent(idToFetch)}`;
        if (clientPhone) {
            url += `&phone=${encodeURIComponent(clientPhone)}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'success' && data.profile) {
            const p = data.profile;
            const phys = p.phys || p;
            const jur = p.jur || p;

            const setField = (id, val) => {
                const el = document.getElementById(id);
                if (el && val !== undefined && val !== null && val !== false && val !== 'false') {
                    el.value = val;
                }
            };

            setField('settingsLastName', phys.surname || p.surname || '');
            setField('settingsFirstName', phys.first_name || p.first_name || '');
            setField('settingsMiddleName', phys.middle_name || p.middle_name || '');
            setField('settingsGender', phys.gender || p.gender || 'M');
            setField('settingsPhoneInput', phys.phone || p.phone || clientPhone || '');
            setField('settingsBirthdayInput', phys.birthday || p.birthday || '');
            setField('settingsCityInput', phys.city || p.city || '');
            setField('settingsAddressInput', phys.address || p.address || '');
            setField('settingsSiteInput', phys.site || p.site || '');
            setField('settingsDiscountCardInput', phys.discount_card || p.discount_card || '');
            setField('settingsSegmentInput', phys.segment || p.segment || 'Сотрудники');

            setField('jurCompanyName', jur.company_name || p.company_name || '');
            setField('jurShortName', jur.short_name || p.short_name || '');
            setField('jurInn', jur.inn || p.inn || '');
            setField('jurKpp', jur.kpp || p.kpp || '');
            setField('jurOgrn', jur.ogrn || p.ogrn || '');
            setField('jurDirector', jur.director || p.director || '');
            setField('jurContactPerson', jur.contact_person || p.contact_person || phys.title || p.title || '');
            setField('jurCompanyPhone', jur.company_phone || p.company_phone || phys.phone || p.phone || clientPhone || '');
            setField('jurBik', jur.bik || p.bik || '');
            setField('jurBankName', jur.bank_name || p.bank_name || '');
            setField('jurRs', jur.rs || p.rs || '');
            setField('jurKs', jur.ks || p.ks || '');
            setField('jurLegalAddress', jur.legal_address || p.legal_address || '');
            setField('jurFactAddress', jur.fact_address || p.fact_address || '');

            const physEmail = phys.email || p.email || '';
            initEmptyEmailField('settingsEmailInput', physEmail);

            const jurEmail = jur.company_email || p.company_email || phys.email || p.email || '';
            initEmptyEmailField('jurCompanyEmail', jurEmail);

            if (physEmail) {
                const localData = JSON.parse(localStorage.getItem('pin_client') || '{}');
                localData.email = physEmail;
                localStorage.setItem('pin_client', JSON.stringify(localData));
            }

            const displayTitle = phys.title || p.title || `${phys.surname || ''} ${phys.first_name || ''}`.trim();
            if (displayTitle) {
                const sidebarNameEl = document.getElementById('sidebarUserName');
                if (sidebarNameEl) sidebarNameEl.textContent = displayTitle;

                const avatarInitialsEl = document.getElementById('userAvatarInitials');
                if (avatarInitialsEl) {
                    const parts = displayTitle.trim().split(/\s+/);
                    avatarInitialsEl.textContent = parts.map(n => n[0]).join('').substring(0, 2).toUpperCase();
                }

                const welcomeTitleEl = document.getElementById('welcomeTitle');
                if (welcomeTitleEl) {
                    const parts = displayTitle.trim().split(/\s+/);
                    welcomeTitleEl.textContent = `Добро пожаловать, ${parts[1] || parts[0]}!`;
                }
            }
        }
    } catch (e) {
        console.error('Ошибка загрузки профиля пользователя из STOCRM:', e);
    }
}

// Сохранение физлица
async function handlePhysProfileSave(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSavePhys');
    const msg = document.getElementById('physSaveMsg');

    btn.disabled = true;
    btn.textContent = 'Сохранение в STOCRM...';
    msg.className = 'message';
    msg.style.display = 'none';

    let emailVal = document.getElementById('settingsEmailInput').value.trim();
    if (emailVal === 'нет данных') emailVal = '';

    const payload = {
        client_id:    clientId,
        profile_type: 'phys',
        surname:      document.getElementById('settingsLastName').value.trim(),
        first_name:   document.getElementById('settingsFirstName').value.trim(),
        middle_name:  document.getElementById('settingsMiddleName').value.trim(),
        gender:       document.getElementById('settingsGender').value,
        email:        emailVal,
        birthday:     document.getElementById('settingsBirthdayInput').value,
        city:         document.getElementById('settingsCityInput').value.trim(),
        address:      document.getElementById('settingsAddressInput').value.trim(),
        site:         document.getElementById('settingsSiteInput').value.trim()
    };

    try {
        const res = await fetch('api/customer.php?action=update_profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
            msg.className = 'message success is-visible';
            msg.textContent = '✔ Данные физического лица успешно обновлены!';
            msg.style.display = 'block';

            const newTitle = data.title || `${payload.surname} ${payload.first_name} ${payload.middle_name}`.trim();
            document.getElementById('sidebarUserName').textContent = newTitle;
            const parts = newTitle.split(/\s+/);
            document.getElementById('userAvatarInitials').textContent = parts.map(n => n[0]).join('').substring(0, 2).toUpperCase();
            document.getElementById('welcomeTitle').textContent = `Добро пожаловать, ${payload.first_name || newTitle}!`;

            const localData = JSON.parse(localStorage.getItem('pin_client') || '{}');
            localData.title = newTitle;
            localData.name = newTitle;
            if (payload.email) localData.email = payload.email;
            localStorage.setItem('pin_client', JSON.stringify(localData));

            setTimeout(() => {
                msg.classList.remove('is-visible');
                msg.style.display = 'none';
            }, 4000);
        } else {
            msg.className = 'message error is-visible';
            msg.textContent = data.message || 'Ошибка сохранения в STOCRM';
            msg.style.display = 'block';
        }
    } catch (err) {
        msg.className = 'message error is-visible';
        msg.textContent = 'Ошибка связи с сервером';
        msg.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Сохранить данные физлица';
    }
}

// Сохранение юрлица
async function handleJurProfileSave(event) {
    event.preventDefault();
    const btn = document.getElementById('btnSaveJur');
    const msg = document.getElementById('jurSaveMsg');

    btn.disabled = true;
    btn.textContent = 'Сохранение в STOCRM...';
    msg.className = 'message';
    msg.style.display = 'none';

    let jurEmailVal = document.getElementById('jurCompanyEmail').value.trim();
    if (jurEmailVal === 'нет данных') jurEmailVal = '';

    const payload = {
        client_id:      clientId,
        profile_type:   'jur',
        company_name:   document.getElementById('jurCompanyName').value.trim(),
        short_name:     document.getElementById('jurShortName').value.trim(),
        inn:            document.getElementById('jurInn').value.trim(),
        kpp:            document.getElementById('jurKpp').value.trim(),
        ogrn:           document.getElementById('jurOgrn').value.trim(),
        director:       document.getElementById('jurDirector').value.trim(),
        contact_person: document.getElementById('jurContactPerson').value.trim(),
        company_phone:  document.getElementById('jurCompanyPhone').value.trim(),
        company_email:  jurEmailVal,
        bik:            document.getElementById('jurBik').value.trim(),
        bank_name:      document.getElementById('jurBankName').value.trim(),
        rs:             document.getElementById('jurRs').value.trim(),
        ks:             document.getElementById('jurKs').value.trim(),
        legal_address:  document.getElementById('jurLegalAddress').value.trim(),
        fact_address:   document.getElementById('jurFactAddress').value.trim()
    };

    try {
        const res = await fetch('api/customer.php?action=update_profile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
            msg.className = 'message success is-visible';
            msg.textContent = '✔ Реквизиты юрлица успешно сохранены в STOCRM!';
            msg.style.display = 'block';

            setTimeout(() => {
                msg.classList.remove('is-visible');
                msg.style.display = 'none';
            }, 4000);
        } else {
            msg.className = 'message error is-visible';
            msg.textContent = data.message || 'Ошибка сохранения в STOCRM';
            msg.style.display = 'block';
        }
    } catch (err) {
        msg.className = 'message error is-visible';
        msg.textContent = 'Ошибка связи с сервером';
        msg.style.display = 'block';
    } finally {
        btn.disabled = false;
        btn.textContent = 'Сохранить реквизиты юрлица';
    }
}

// ============================================================
// ФИЛЬТРАЦИЯ СДЕЛОК / ЗАКАЗ-НАРЯДОВ (БЕЛЫЙ СПИСОК СТАТУСОВ)
// ============================================================

let globalDeals = [];
let currentFilteredDeals = [];
let currentOrdersPage = 1;
const ordersPerPage = 10;
let currentOrderStatusFilter = 'all';
let clientCarsList = [];

/**
 * Валидатор сделок: скрывает архивные, мусорные и неразобранные сделки.
 * Разрешены только: "Успешно реализовано", "В работе", "Необходимо перезвонить"
 */
function isAllowedDeal(deal) {
    if (!deal) return false;

    // 1. Фильтрация архива и удаленных сделок по флагам CRM
    if (deal.is_archive === 1 || deal.is_archive === true || deal.is_archive === '1' || deal.is_archive === 'Y' ||
        deal.is_archived === 1 || deal.is_archived === true || deal.is_archived === '1' || deal.is_archived === 'Y' ||
        deal.archive === 1 || deal.archive === true || deal.archive === '1' || deal.archive === 'Y' ||
        deal.is_deleted === 1 || deal.is_deleted === true || deal.deleted === 1 || deal.deleted === true) {
        return false;
    }

    const st = (deal.status || '').trim().toLowerCase();

    // Если в статусе явно фигурирует архив
    if (st.includes('архив')) {
        return false;
    }

    // 2. Белый список разрешенных статусов для отображения клиенту
    const allowedStatuses = [
        'успешно реализовано',
        'в работе',
        'необходимо перезвонить'
    ];

    return allowedStatuses.some(allowed => st === allowed || st.includes(allowed));
}

async function loadCabinetData(cId) {
    try {
        const resCars = await fetch(`api/cars.php?client_id=${encodeURIComponent(cId)}`);
        const dataCars = await resCars.json();
        if (dataCars.status === 'success' && dataCars.cars && dataCars.cars.length > 0) {
            clientCarsList = dataCars.cars;
            const badge = document.getElementById('garageBadge');
            if (badge) badge.textContent = dataCars.cars.length;
            renderGarage(dataCars.cars);
            populateGarageSelect(dataCars.cars);
            initCatalogSelectors(dataCars.cars);
        } else {
            clientCarsList = [];
            const mainGar = document.getElementById('mainGarageContainer');
            if (mainGar) mainGar.innerHTML = '<div class="empty-info-box">Автомобили не найдены</div>';
            const fullGar = document.getElementById('fullGarageContainer');
            if (fullGar) fullGar.innerHTML = '<div class="empty-info-box">В вашем гараже пока нет автомобилей</div>';
            populateGarageSelect([]);
            initCatalogSelectors([]);
        }
    } catch (e) {
        console.error('Cars load error:', e);
    }

    try {
        const resOffers = await fetch(`api/offers.php?client_id=${encodeURIComponent(cId)}`);
        const dataOffers = await resOffers.json();
        if (dataOffers.status === 'success' && Array.isArray(dataOffers.deals)) {
            // Применяем фильтр белого списка и архива
            globalDeals = dataOffers.deals.filter(isAllowedDeal);
            currentFilteredDeals = globalDeals;
            updateOrderStatusPills(globalDeals);
            renderOrders(globalDeals);
        } else {
            const mainPrev = document.getElementById('mainOrdersPreview');
            if (mainPrev) mainPrev.innerHTML = '<div class="empty-info-box">У вас нет активных заказов</div>';
            const ordCont = document.getElementById('ordersListContainer');
            if (ordCont) ordCont.innerHTML = '<div class="empty-info-box">История сделок и нарядов пуста.</div>';
        }
    } catch (e) {
        console.error('Offers load error:', e);
    }
}

function updateOrderStatusPills(deals) {
    // В фильтр попадают только те статусы, которые прошли белый список
    const statuses = [...new Set(deals.map(d => d.status).filter(Boolean))];
    const pillsContainer = document.getElementById('orderStatusPills');
    if (!pillsContainer) return;

    let html = `<button class="pill-btn active" onclick="filterOrders('all', this)">Все</button>`;
    statuses.forEach(status => {
        html += `<button class="pill-btn" onclick="filterOrders('${escapeHtml(status)}', this)">${escapeHtml(status)}</button>`;
    });
    pillsContainer.innerHTML = html;
}

function filterOrders(status, btn) {
    document.querySelectorAll('#orderStatusPills .pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    currentOrderStatusFilter = status;
    currentOrdersPage = 1;

    if (status === 'all') {
        currentFilteredDeals = globalDeals;
    } else {
        currentFilteredDeals = globalDeals.filter(d => d.status === status);
    }
    renderOrdersList(currentFilteredDeals, currentOrdersPage);
}

function renderOrders(deals) {
    renderOrdersList(deals, currentOrdersPage);
    const previewContainer = document.getElementById('mainOrdersPreview');
    if (previewContainer) {
        let previewHtml = '';
        deals.slice(0, 2).forEach((deal) => {
            let badgeMod = 'success';
            const st = (deal.status || '').toLowerCase();
            if (st.includes('перезвонить')) {
                badgeMod = 'warning';
            }

            previewHtml += `
                <div class="dashboard-card mb-20" style="cursor: pointer; padding: 16px;" onclick="switchTab('orders')">
                    <div class="card-header-flex" style="margin: 0;">
                        <div>
                            <b>Заказ/Наряд #${deal.id}</b> от ${deal.date}
                            <div style="font-size: 13px; color: #64748b; margin-top: 3px;">Центр: ${deal.branch || 'ПИН-АВТО'} | Авто: <b>${deal.car_name || 'Не указан'}</b></div>
                        </div>
                        <div style="text-align: right;">
                            <div class="deal-sum">${deal.sum} ₽</div>
                            <span class="status-badge ${badgeMod}">${deal.status}</span>
                        </div>
                    </div>
                </div>
            `;
        });
        previewContainer.innerHTML = previewHtml || '<div class="empty-info-box">У вас нет активных заказов</div>';
    }
}

function renderOrdersList(dealsToDisplay, page) {
    const container = document.getElementById('ordersListContainer');
    const paginationContainer = document.getElementById('ordersPaginationContainer');
    if (!container) return;

    currentOrdersPage = page;
    const totalPages = Math.ceil(dealsToDisplay.length / ordersPerPage) || 1;
    if (currentOrdersPage > totalPages) currentOrdersPage = totalPages;
    if (currentOrdersPage < 1) currentOrdersPage = 1;

    const startIndex = (currentOrdersPage - 1) * ordersPerPage;
    const pageDeals = dealsToDisplay.slice(startIndex, startIndex + ordersPerPage);

    let html = '';
    pageDeals.forEach((deal, index) => {
        let badgeMod = 'success';
        const st = (deal.status || '').toLowerCase();
        if (st.includes('перезвонить')) {
            badgeMod = 'warning';
        }

        const uniqueIdx = startIndex + index;
        const orderKey = `order_${uniqueIdx}`;
        html += `
            <div class="dashboard-card mb-20">
                <div class="card-header-flex" onclick="toggleDealWorks(${deal.id}, '${orderKey}')" style="cursor: pointer;">
                    <div>
                        <b>Заказ/Наряд #${deal.id}</b> от ${deal.date}
                        <div style="font-size: 13px; color: #64748b; margin-top: 3px;">Центр: ${deal.branch || 'ПИН-АВТО'} | Авто: <b>${deal.car_name || 'Не указан'}</b></div>
                    </div>
                    <div style="text-align: right;">
                        <div class="deal-sum">${deal.sum} ₽</div>
                        <span class="status-badge ${badgeMod}">${deal.status}</span>
                    </div>
                </div>
                <div id="dealWorks_${orderKey}" style="display: none; margin-top: 15px; border-top: 1px dashed #cbd5e1; padding-top: 12px;">
                    <div id="dealWorksContent_${orderKey}" style="color: #64748b; font-size: 13px;">Загрузка состава работ из CRM...</div>
                </div>
            </div>
        `;
    });

    container.innerHTML = html || '<div class="empty-info-box">Заказы по данному статусу отсутствуют</div>';

    if (paginationContainer) {
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }

        let pagHtml = '';
        pagHtml += `<button class="week-btn" style="width: auto; padding: 6px 14px; ${currentOrdersPage === 1 ? 'opacity: 0.5; pointer-events: none;' : ''}" onclick="changeOrdersPage(${currentOrdersPage - 1})">‹ Назад</button>`;

        let startPage = Math.max(1, currentOrdersPage - 4);
        let endPage = Math.min(totalPages, startPage + 9);
        if (endPage - startPage < 9) startPage = Math.max(1, endPage - 9);

        for (let i = startPage; i <= endPage; i++) {
            const isActive = i === currentOrdersPage;
            pagHtml += `<button class="week-btn ${isActive ? 'active' : ''}" style="width: auto; padding: 6px 14px;" onclick="changeOrdersPage(${i})">${i}</button>`;
        }

        pagHtml += `<button class="week-btn" style="width: auto; padding: 6px 14px;" onclick="changeOrdersPage(${currentOrdersPage + 1})">Вперед ›</button>`;
        paginationContainer.innerHTML = pagHtml;
    }
}

function changeOrdersPage(page) {
    renderOrdersList(currentFilteredDeals, page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

const loadedWorksCache = {};
async function toggleDealWorks(offerId, uniqueKey) {
    const pane = document.getElementById(`dealWorks_${uniqueKey}`);
    if (!pane) return;

    const isHidden = pane.style.display === 'none';
    pane.style.display = isHidden ? 'block' : 'none';

    if (isHidden && !loadedWorksCache[offerId]) {
        const contentContainer = document.getElementById(`dealWorksContent_${uniqueKey}`);
        try {
            const res = await fetch(`api/works.php?offer_id=${encodeURIComponent(offerId)}`);
            const data = await res.json();

            if (data.status === 'success' && data.items && data.items.length > 0) {
                let tableHtml = '<p style="margin: 0 0 8px 0; font-weight: 700; color: #1e293b;">Состав работ по заказ-наряду:</p>';
                tableHtml += '<table class="data-table"><thead><tr><th>Наименование работы</th><th>Нормо-час / Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>';
                
                data.items.forEach(work => {
                    tableHtml += `
                        <tr>
                            <td>${work.title}</td>
                            <td>${work.qty}</td>
                            <td>${work.price} ₽</td>
                            <td><b>${work.sum} ₽</b></td>
                        </tr>`;
                });
                tableHtml += '</tbody></table>';
                contentContainer.innerHTML = tableHtml;
                loadedWorksCache[offerId] = tableHtml;
            } else {
                contentContainer.innerHTML = '<div class="empty-info-box">По данному заказ-наряду работы не найдены в системе.</div>';
                loadedWorksCache[offerId] = contentContainer.innerHTML;
            }
        } catch (err) {
            console.error('Error loading works:', err);
            contentContainer.innerHTML = '<div class="message error is-visible">Ошибка загрузки списка работ из CRM.</div>';
        }
    }
}

function initCatalogSelectors(cars) {
    const defaultCarId = cars.length > 0 ? (cars[0].id || 0) : null;
    ['tires', 'wheels', 'battery'].forEach(tabId => {
        buildCatalogCarSelector(tabId, cars, defaultCarId);
    });
}

function buildCatalogCarSelector(tabId, cars, selectedCarId) {
    const container = document.getElementById(`${tabId}CarSelector`);
    if (!container) return;

    if (!cars || cars.length === 0) {
        container.innerHTML = `<div class="empty-info-box">У вас нет добавленных автомобилей. Перейдите во вкладку "Мой гараж".</div>`;
        return;
    }

    let html = '<div class="catalog-cars-row">';
    let activeId = selectedCarId !== null ? selectedCarId : (cars[0].id || 0);

    cars.forEach((c, idx) => {
        const cId = c.id || idx;
        const isActive = String(cId) === String(activeId);
        const plate = c.plate || 'Нет номера';
        const brandModel = `${c.brand || ''} ${c.model || ''}`.trim() || 'Автомобиль';
        const vin = c.vin || 'VIN не указан';
        const logoUrl = getCarLogoUrl(c);

        html += `
            <div class="catalog-car-btn ${isActive ? 'active' : ''}" onclick="selectCatalogCar('${tabId}', '${cId}')">
                <div class="cc-info-left">
                    <div class="cc-plate">${plate}</div>
                    <div class="cc-name">${brandModel}</div>
                    <div class="cc-vin">VIN: ${vin}</div>
                </div>
                <div class="cc-logo-right">
                    ${logoUrl ? `<img src="${logoUrl}" alt="${c.brand || ''}" onerror="this.style.display='none';">` : ''}
                </div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

window.selectCatalogCar = function(tabId, carId) {
    if (carId === null || carId === undefined || carId === '') return;
    buildCatalogCarSelector(tabId, clientCarsList, carId);
    
    const car = clientCarsList.find((c, idx) => String(c.id || idx) === String(carId));
    if (car && tabId === 'battery') {
        loadBatteryCatalog(car.vin, car.brand);
    }
};

window.openCatalogForCar = function(tabId, carId, carName, carVin) {
    if (typeof switchTab === 'function') switchTab(tabId);
    if (clientCarsList && clientCarsList.length > 0) {
        window.selectCatalogCar(tabId, carId);
    }
};

async function loadBatteryCatalog(vin, brand) {
    const grid = document.getElementById('batteryProductGrid');
    const specsBox = document.getElementById('batterySpecsBox');
    const filters = document.getElementById('batteryFilters');

    if (!grid) return;

    if (!vin || vin.trim() === '') {
        grid.innerHTML = '<div class="empty-info-box" style="grid-column: 1 / -1;">Для данного автомобиля не указан VIN. Подбор по API невозможен.</div>';
        if (specsBox) specsBox.style.display = 'none';
        if (filters) filters.style.display = 'none';
        return;
    }

    grid.innerHTML = '<div class="empty-info-box" style="grid-column: 1 / -1;">⏳ Запрос к API Rossko. Подбираем аккумуляторы по VIN...</div>';
    if (specsBox) specsBox.style.display = 'none';
    if (filters) filters.style.display = 'none';

    try {
        const res = await fetch(`api/rossko.php?action=get_battery&vin=${encodeURIComponent(vin)}&brand=${encodeURIComponent(brand || '')}`);
        const data = await res.json();

        if (data.status === 'success') {
            if (data.specs && specsBox) {
                specsBox.innerHTML = `Требуемые характеристики: Емкость <strong>${data.specs.capacity}</strong>, Полярность <strong>${data.specs.polarity}</strong>, Ток холодной прокрутки <strong>${data.specs.cca}</strong>.`;
                specsBox.style.display = 'block';
            }

            if (data.items && data.items.length > 0) {
                if (filters) filters.style.display = 'flex';
                let html = '';
                
                data.items.forEach(item => {
                    html += `
                        <div class="product-card">
                            <div class="product-img-wrap product-img-placeholder">
                                <svg viewBox="0 0 24 24" fill="none" stroke="#cccccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <rect x="2" y="7" width="18" height="13" rx="2" ry="2"></rect>
                                    <line x1="6" y1="3" x2="6" y2="7"></line>
                                    <line x1="16" y1="3" x2="16" y2="7"></line>
                                    <line x1="10" y1="11" x2="14" y2="11"></line>
                                    <line x1="12" y1="9" x2="12" y2="13"></line>
                                </svg>
                            </div>
                            <div class="product-brand">${item.brand}</div>
                            <h4 class="product-title">${item.title}</h4>
                            <div class="product-params">
                                <ul>
                                    <li><span>Емкость:</span> <strong>${item.params['Емкость'] || '—'}</strong></li>
                                    <li><span>Пусковой ток:</span> <strong>${item.params['Пусковой ток'] || '—'}</strong></li>
                                    <li><span>Полярность:</span> <strong>${item.params['Полярность'] || '—'}</strong></li>
                                </ul>
                            </div>
                            <div class="product-bottom">
                                <div class="product-price-row">
                                    <div class="product-price">${item.price} ₽</div>
                                    <div class="product-stock">✔ ${item.delivery}</div>
                                </div>
                                <button type="button" class="submit-btn btn-small" onclick="alert('Выбран товар: ${item.brand} ${item.article}\\n(Функционал корзины в разработке)')">Заказать АКБ</button>
                            </div>
                        </div>
                    `;
                });
                grid.innerHTML = html;
            } else {
                grid.innerHTML = '<div class="empty-info-box" style="grid-column: 1 / -1;">По вашему VIN не найдено подходящих аккумуляторов в наличии.</div>';
            }
        } else {
            grid.innerHTML = `<div class="message error is-visible" style="grid-column: 1 / -1;">Ошибка API: ${data.message}</div>`;
        }
    } catch (err) {
        console.error(err);
        grid.innerHTML = '<div class="message error is-visible" style="grid-column: 1 / -1;">Ошибка связи с сервером подбора.</div>';
    }
}

async function loadLoyaltyBalance(cId) {
    try {
        const response = await fetch(`api/customer.php?action=balance&client_id=${encodeURIComponent(cId)}`);
        const data = await response.json();

        if (data.status === 'success') {
            const val = data.balance ?? data.points ?? data.cashback ?? data.score ?? data.bonus ?? data.value ??
                        data.data?.balance ?? data.data?.points ?? data.data?.cashback ?? data.data?.score ??
                        (typeof data.data === 'number' || (typeof data.data === 'string' && data.data !== '') ? data.data : undefined);

            if (val !== undefined && val !== null) {
                updateLoyaltyDisplay(val);
                client.balance = val;
                client.points = val;
                localStorage.setItem('pin_client', JSON.stringify(client));
            }
        }
    } catch (err) {
        console.error('Ошибка получения баланса баллов из CRM:', err);
    }
}

async function loadTransactions(cId) {
    const container = document.getElementById('transactionsContainer');
    if (!container) return;

    try {
        const response = await fetch(`api/customer.php?action=transactions&client_id=${encodeURIComponent(cId)}`);
        const data = await response.json();

        const txBalance = data.balance ?? data.points ?? data.cashback ?? data.total_balance ?? data.total ?? 
                          data.data?.balance ?? data.data?.points;
        if (txBalance !== undefined && txBalance !== null) {
            updateLoyaltyDisplay(txBalance);
        }

        if (data.status === 'success' && data.transactions && data.transactions.length > 0) {
            const firstTx = data.transactions[0];
            const txAfter = firstTx.balance_after ?? firstTx.balance ?? firstTx.current_balance;
            if (txAfter !== undefined && txAfter !== null) {
                updateLoyaltyDisplay(txAfter);
            }

            let html = `
            <div class="table-wrap">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Дата</th>
                            <th>Операция</th>
                            <th>Причина / Сделка</th>
                            <th>Баллы</th>
                        </tr>
                    </thead>
                    <tbody>`;

            data.transactions.forEach(tx => {
                const isIn = (tx.direction || 'IN').toUpperCase() === 'IN';
                const sign = isIn ? '+' : '-';
                const badgeClass = isIn ? 'success' : 'warning';
                const dirText = isIn ? 'Поступление' : 'Списание';

                html += `
                    <tr>
                        <td>#${tx.id}</td>
                        <td>${tx.date_create}</td>
                        <td><span class="status-badge ${badgeClass}">${dirText}</span></td>
                        <td>${tx.reason} ${tx.offer_id ? `(Сделка #${tx.offer_id})` : ''}</td>
                        <td><strong style="color: ${isIn ? '#15803d' : '#b45309'};">${sign}${tx.value} баллов</strong></td>
                    </tr>`;
            });

            html += `</tbody></table></div>`;
            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="empty-info-box">История операций с кэшбэком пуста</div>';
        }
    } catch (e) {
        console.error('Transactions load error:', e);
        container.innerHTML = '<div class="empty-info-box">История операций временно недоступна</div>';
    }
}

// Записи на сервис
let globalServiceAppointments = [];

function formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return new Intl.NumberFormat('ru-RU').format(num) + ' ₽';
}

function escapeHtml(string) {
    if (!string) return '';
    return String(string)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function createBookingCardHTML(item) {
    const id = item.id || item.number || '—';
    const post = item.post_name ? item.post_name : (item.post ? `Пост №${item.post}` : '№1');
    const carFull = item.car_title || item.car_full || item.car_model || item.vehicle || 'Автомобиль клиента';
    const dateTime = item.date_formatted || item.datetime || `${item.date || ''} ${item.time || ''}`.trim() || 'Дата и время не указаны';
    const status = item.status || 'Активна';

    let commentRaw = item.offer_reason || item.comment || item.description || '';
    let channel = 'Онлайн-запись';
    let client = 'Клиент сервиса';
    let carPlate = '—';
    let services = [];
    let calculatedTotal = 0;

    if (commentRaw) {
        const reasonMatch = commentRaw.match(/(?:Причина\s*\/\s*Комментарий|Причина):\s*([^|]+)/i);
        if (reasonMatch) channel = reasonMatch[1].trim();

        const clientMatch = commentRaw.match(/Клиент:\s*([^|]+)/i);
        if (clientMatch) client = clientMatch[1].trim();

        const carMatch = commentRaw.match(/Авто:\s*([^|]+)/i);
        if (carMatch) carPlate = carMatch[1].trim();

        const worksMatch = commentRaw.match(/Работы:\s*([^|]+)/i);
        if (worksMatch) {
            const worksListStr = worksMatch[1].trim();
            const workTokens = worksListStr.split(/,(?![^(]*\))/);

            workTokens.forEach(token => {
                const trimmed = token.trim();
                if (!trimmed) return;

                const priceMatch = trimmed.match(/\(([\d\s]+)\s*(?:₽|руб\.?)\)/i);
                if (priceMatch) {
                    const rawPrice = priceMatch[1].replace(/\s+/g, '');
                    const priceNum = parseInt(rawPrice, 10) || 0;
                    const name = trimmed.replace(/\([^)]*\)/, '').trim();
                    services.push({ name: name, price: priceNum });
                    calculatedTotal += priceNum;
                } else {
                    services.push({ name: trimmed, price: null });
                }
            });
        }
    }

    if (Array.isArray(item.services) && item.services.length > 0) {
        services = item.services;
        calculatedTotal = services.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
    }

    let statusClass = 'booking-status-active';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('выполн') || statusLower.includes('заверш') || statusLower.includes('закрыт')) {
        statusClass = 'booking-status-done';
    } else if (statusLower.includes('отмен') || statusLower.includes('отказ') || statusLower.includes('мусор')) {
        statusClass = 'booking-status-cancelled';
    }

    let servicesRowsHTML = '';
    if (services.length > 0) {
        servicesRowsHTML = services.map(s => `
            <div class="booking-service-row">
                <span class="booking-service-name">${escapeHtml(s.name)}</span>
                <span class="booking-service-price">${s.price !== null ? formatCurrency(s.price) : 'По согласованию'}</span>
            </div>
        `).join('');
    } else {
        servicesRowsHTML = `
            <div class="booking-service-row">
                <span class="booking-service-name">Комплексное обслуживание / сервисный осмотр</span>
                <span class="booking-service-price">—</span>
            </div>
        `;
    }

    const totalDisplay = calculatedTotal > 0 
        ? formatCurrency(calculatedTotal) 
        : (item.total ? formatCurrency(item.total) : 'По расчету');

    return `
        <div class="booking-card" data-booking-id="${escapeHtml(id)}">
            <div class="booking-card-header">
                <div class="booking-card-title-wrap">
                    <div class="booking-card-title">
                        <span>Запись #${escapeHtml(id)}</span>
                        <span class="booking-card-post">• ${escapeHtml(post)}</span>
                    </div>
                    <div class="booking-card-subtitle">${escapeHtml(carFull)}</div>
                </div>
                <span class="booking-status-badge ${statusClass}">${escapeHtml(status)}</span>
            </div>

            <div class="booking-grid">
                <div class="booking-grid-item">
                    <svg class="booking-grid-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <div class="booking-grid-content">
                        <div class="booking-grid-label">Дата и время</div>
                        <div class="booking-grid-val">${escapeHtml(dateTime)}</div>
                    </div>
                </div>

                <div class="booking-grid-item">
                    <svg class="booking-grid-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2"></rect>
                        <path d="M16 3H8l-3 4h14l-3-4z"></path>
                        <circle cx="7.5" cy="14.5" r="1.5"></circle>
                        <circle cx="16.5" cy="14.5" r="1.5"></circle>
                    </svg>
                    <div class="booking-grid-content">
                        <div class="booking-grid-label">Автомобиль и госномер</div>
                        <div class="booking-grid-val">${escapeHtml(carPlate)}</div>
                    </div>
                </div>

                <div class="booking-grid-item">
                    <svg class="booking-grid-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <div class="booking-grid-content">
                        <div class="booking-grid-label">Клиент</div>
                        <div class="booking-grid-val">${escapeHtml(client)}</div>
                    </div>
                </div>

                <div class="booking-grid-item">
                    <svg class="booking-grid-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                    </svg>
                    <div class="booking-grid-content">
                        <div class="booking-grid-label">Источник записи</div>
                        <div class="booking-grid-val">${escapeHtml(channel)}</div>
                    </div>
                </div>
            </div>

            <div class="booking-services-block">
                <div class="booking-services-header">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                    </svg>
                    <span>Выбранные работы (${services.length})</span>
                </div>

                ${servicesRowsHTML}

                <div class="booking-services-total">
                    <span>Предварительная сумма:</span>
                    <span class="booking-services-total-val">${totalDisplay}</span>
                </div>
            </div>
        </div>
    `;
}

async function loadServiceAppointments(cId) {
    const container = document.getElementById('servicesListContainer');
    const previewContainer = document.getElementById('mainServicesPreview');

    try {
        const response = await fetch(`api/services.php?client_id=${encodeURIComponent(cId)}`);
        const data = await response.json();

        if (data.status === 'success' && data.services && data.services.length > 0) {
            globalServiceAppointments = data.services;

            if (previewContainer) {
                const activeBookings = globalServiceAppointments.filter(item => {
                    const st = (item.status || 'Активна').toLowerCase();
                    return !st.includes('отмен') && !st.includes('отказ') && !st.includes('выполн') && !st.includes('заверш');
                });
                const previewItems = activeBookings.length > 0 ? activeBookings.slice(0, 2) : globalServiceAppointments.slice(0, 2);
                previewContainer.innerHTML = previewItems.map(item => createBookingCardHTML(item)).join('');
            }

            const activePill = document.querySelector('#subtabServicesList .pill-btn.active');
            filterServices('all', activePill);
        } else {
            globalServiceAppointments = [];
            if (container) container.innerHTML = '<div class="empty-info-box">У вас нет активных записей на сервис</div>';
            if (previewContainer) previewContainer.innerHTML = '<div class="empty-info-box">У вас нет активных записей на сервис</div>';
        }
    } catch (e) {
        console.error('Services appointments load error:', e);
        if (container) container.innerHTML = '<div class="message error is-visible">Ошибка загрузки записей на сервис.</div>';
        if (previewContainer) previewContainer.innerHTML = '<div class="message error is-visible">Ошибка загрузки записей.</div>';
    }
}

function filterServices(type, btn) {
    document.querySelectorAll('#subtabServicesList .pill-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');

    const container = document.getElementById('servicesListContainer');
    if (!container) return;

    if (!globalServiceAppointments || globalServiceAppointments.length === 0) {
        container.innerHTML = '<div class="empty-info-box">У вас нет записей на сервис</div>';
        return;
    }

    let filtered = globalServiceAppointments;
    if (type === 'active') {
        filtered = globalServiceAppointments.filter(item => {
            const st = (item.status || 'Активна').toLowerCase();
            return !st.includes('выполн') && !st.includes('заверш') && !st.includes('закрыт') && !st.includes('отмен') && !st.includes('отказ');
        });
    } else if (type === 'completed') {
        filtered = globalServiceAppointments.filter(item => {
            const st = (item.status || '').toLowerCase();
            return st.includes('выполн') || st.includes('заверш') || st.includes('закрыт');
        });
    } else if (type === 'cancelled') {
        filtered = globalServiceAppointments.filter(item => {
            const st = (item.status || '').toLowerCase();
            return st.includes('отмен') || st.includes('отказ') || st.includes('мусор');
        });
    }

    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-info-box">Записей по данному фильтру не найдено</div>';
    } else {
        container.innerHTML = filtered.map(item => createBookingCardHTML(item)).join('');
    }
}

async function loadRecommendations(cId) {
    const container = document.getElementById('recommendationsContainer');
    if (!container) return;

    try {
        const response = await fetch(`api/recommendations.php?client_id=${encodeURIComponent(cId)}`);
        const data = await response.json();

        if (data.status === 'success' && data.recommendations && data.recommendations.length > 0) {
            let html = '';

            data.recommendations.forEach(group => {
                const titleText = group.offer_id ? `Заказ-наряд / Сделка #${group.offer_id}` : 'Общие рекомендации';
                const mileageText = group.mileage ? ` | Пробег: ${group.mileage} км` : '';

                html += `
                    <div class="dashboard-card mb-20">
                        <div class="card-header-flex" style="border-bottom: 1px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px;">
                            <div>
                                <b>${titleText}</b>
                                <div style="font-size: 13px; color: #64748b; margin-top: 3px;">Автомобиль: <b>${group.car_title || '—'}</b>${mileageText}</div>
                            </div>
                            <span class="status-badge warning">Рекомендации</span>
                        </div>
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>Тип</th>
                                    <th>Наименование</th>
                                    <th>Сумма</th>
                                </tr>
                            </thead>
                            <tbody>`;

                group.items.forEach(rec => {
                    const isWork = rec.type === 'WORK';
                    const typeText = isWork ? '🛠 Работа' : '📦 Запчасть';
                    const badgeMod = isWork ? 'success' : 'warning';

                    html += `
                        <tr>
                            <td><span class="status-badge ${badgeMod}">${typeText}</span></td>
                            <td><b>${rec.title}</b>${rec.detail ? `<br><small style="color: #64748b;">Артикул/Бренд: ${rec.detail}</small>` : ''}</td>
                            <td><b>${rec.sum} ₽</b></td>
                        </tr>`;
                });

                html += `
                            </tbody>
                        </table>
                    </div>`;
            });

            container.innerHTML = html;
        } else {
            container.innerHTML = '<div class="empty-info-box">На данный момент у вас нет рекомендаций мастера</div>';
        }
    } catch (e) {
        console.error('Recommendations load error:', e);
        container.innerHTML = '<div class="message error is-visible">Ошибка загрузки рекомендаций из CRM.</div>';
    }
}

function getCarLogoUrl(car) {
    if (!car) return null;
    let raw = (car.brand || car.title || '').trim();
    if (!raw) return null;

    let brand = raw.split(/[\s_-]+/)[0].toLowerCase();
    let full = raw.toLowerCase().trim();

    const brandMap = {
        'acura': 'Acura.png', 'audi': 'Audi.png', 'bmw': 'BMW.png', 'chery': 'Chery.png',
        'chevrolet': 'Chevrolet.png', 'citroen': 'Citroen.png', 'daewoo': 'Daewoo.png',
        'ford': 'Ford.png', 'gaz': 'GAZ.png', 'honda': 'Honda.png', 'hyundai': 'Hyundai.png',
        'infiniti': 'Infiniti.png', 'kia': 'Kia.png', 'lada': 'Lada.png', 'lexus': 'Lexus.png',
        'mazda': 'Mazda.png', 'mercedes': 'Mercedes.png', 'mitsubishi': 'Mitsubishi.png',
        'nissan': 'Nissan.png', 'opel': 'Opel.png', 'peugeot': 'Peugeot.png', 'porsche': 'Porshe.png',
        'renault': 'Renault.png', 'skoda': 'Skoda.png', 'subaru': 'Subaru.png', 'suzuki': 'Suzuki.png',
        'toyota': 'Toyota.png', 'volkswagen': 'Volkswagen.png', 'volvo': 'Volvo.png'
    };

    let matchedFile = brandMap[full.replace(/[\s-]+/g, '_')] || brandMap[brand];
    if (!matchedFile) {
        let cap = brand.charAt(0).toUpperCase() + brand.slice(1);
        matchedFile = `${cap}.png`;
    }
    return `img/cars/${matchedFile}`;
}

function renderGarage(cars) {
    const mainContainer = document.getElementById('mainGarageContainer');
    const fullContainer = document.getElementById('fullGarageContainer');
    const car = cars[0];

    if (mainContainer && car) {
        const carTitle = car.title || `${car.brand || ''} ${car.model || ''}`.trim() || 'Автомобиль';
        const safeCarTitle = carTitle.replace(/'/g, "&apos;");
        const mainLogoUrl = getCarLogoUrl(car);
        
        mainContainer.innerHTML = `
            <div style="display: flex; gap: 15px; align-items: center;">
                <div style="width: 80px; height: 60px; background: #f0f0f0; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 26px; border: 1px solid #ddd; padding: 4px; box-sizing: border-box; overflow: hidden;">
                    ${mainLogoUrl ? `
                        <img src="${mainLogoUrl}" alt="${carTitle}" style="max-width: 70px; max-height: 50px; object-fit: contain;" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';">
                        <svg style="display: none;" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18M5 10l1.5-4.5h11L19 10M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9"></path><circle cx="7" cy="15" r="1.5"></circle><circle cx="17" cy="15" r="1.5"></circle></svg>
                    ` : `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10h18M5 10l1.5-4.5h11L19 10M4 10v9a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-9"></path><circle cx="7" cy="15" r="1.5"></circle><circle cx="17" cy="15" r="1.5"></circle></svg>`}
                </div>
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 15px; color: var(--color-text-main);">${carTitle}</h4>
                    <p style="margin: 0 0 8px 0; font-size: 13px; color: var(--color-text-muted);">${car.year ? `${car.year} г.в.` : ''}</p>
                </div>
            </div>
            <div class="car-action-row" style="margin-top: 12px;">
                <button type="button" class="week-btn" style="padding: 6px 12px; font-size: 12.5px; flex: unset; display: inline-flex; align-items: center; gap: 6px;" onclick="startNewBooking('${car.id || ''}')">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>
                    Записаться
                </button>
                <button type="button" class="car-action-btn" style="padding: 6px 10px; font-size: 12.5px;" onclick="openCatalogForCar('tires', '${car.id || ''}', '${safeCarTitle}', '${car.vin || ''}')">Шины</button>
                <button type="button" class="car-action-btn" style="padding: 6px 10px; font-size: 12.5px;" onclick="openCatalogForCar('wheels', '${car.id || ''}', '${safeCarTitle}', '${car.vin || ''}')">Диски</button>
                <button type="button" class="car-action-btn" style="padding: 6px 10px; font-size: 12.5px;" onclick="openCatalogForCar('battery', '${car.id || ''}', '${safeCarTitle}', '${car.vin || ''}')">АКБ</button>
            </div>
        `;
    }

    if (fullContainer && cars.length > 0) {
        let fullHtml = '';
        cars.forEach(c => {
            const title = c.title || `${c.brand || ''} ${c.model || ''}`.trim() || 'Автомобиль';
            const safeTitle = title.replace(/'/g, "&apos;");
            const logoUrl = getCarLogoUrl(c);

            fullHtml += `
                <div class="dashboard-card mb-20">
                    <div style="display: flex; gap: 20px; align-items: flex-start; flex-wrap: wrap;">
                        <div style="width: 140px; height: 95px; background: #f0f0f0; border-radius: 10px; display: flex; align-items: center; justify-content: center; border: 1px solid #ddd; padding: 6px; box-sizing: border-box; overflow: hidden;">
                            ${logoUrl ? `<img src="${logoUrl}" alt="${title}" style="max-width: 120px; max-height: 80px; object-fit: contain;">` : ''}
                        </div>
                        <div style="flex: 1;">
                            <h3 style="margin-top: 0; margin-bottom: 4px;">${title}</h3>
                            <p style="margin: 0 0 12px 0; font-size: 13px; color: var(--color-text-muted);">${c.year ? `Год выпуска: ${c.year}` : ''}</p>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; font-size: 13.5px; margin-bottom: 14px;">
                                <div>Госномер: <b>${c.plate || '—'}</b></div>
                                <div>VIN: <span class="vin-box">${c.vin || '—'}</span></div>
                                <div>Пробег: <b>${c.mileage || '—'}</b></div>
                            </div>
                            <div class="car-action-row">
                                <button type="button" class="week-btn" style="max-width: max-content; padding: 7px 14px; flex: unset; display: inline-flex; align-items: center; gap: 6px;" onclick="startNewBooking('${c.id || ''}')">Записаться на сервис</button>
                                <button type="button" class="car-action-btn" onclick="openCatalogForCar('tires', '${c.id || ''}', '${safeTitle}', '${c.vin || ''}')">Шины</button>
                                <button type="button" class="car-action-btn" onclick="openCatalogForCar('wheels', '${c.id || ''}', '${safeTitle}', '${c.vin || ''}')">Диски</button>
                                <button type="button" class="car-action-btn" onclick="openCatalogForCar('battery', '${c.id || ''}', '${safeTitle}', '${c.vin || ''}')">АКБ</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        fullContainer.innerHTML = fullHtml;
    }
}

// ============================================================
// МОДУЛЬ ОНЛАЙН-ЗАПИСИ (ФИЛИАЛЫ, СЛОТЫ, ПОСТЫ И УСЛУГИ)
// ============================================================

let globalConfig = null;
let allServices = [];
let isBookingModuleInitialized = false;
const daysOfWeek = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

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

            // Выбираем первый пост и подгружаем услуги
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

/**
 * Универсальное извлечение цены услуги по коду филиала
 * Поддерживает форматы: "ОП2", "ОП 2", "2", без учета регистра и пробелов
 */
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
                loadServiceAppointments(clientId);
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