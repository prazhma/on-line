/* ============================================================
   ПИН-АВТО — ЯДРО КАБИНЕТА, ПРОФИЛЬ, DADATA И СИНХРОНИЗАЦИЯ (JS/CABINET-CORE.JS)
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

// Обработчик полей E-Mail
function initEmptyEmailField(id, val) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const isValid = val && val !== 'нет данных' && val.trim() !== '';
    el.value = isValid ? val.trim() : 'нет данных';
    el.type = isValid ? 'email' : 'text';
    
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
        const cleanForInitials = clientName.replace(/\b(ООО|ИП|АО|ПАО|ЗАО|ОАО)\b/gi, '').trim();
        const parts = cleanForInitials.split(/\s+/);
        if (parts.length > 1) {
            avatarInitialsEl.textContent = (parts[0][0] + parts[1][0]).toUpperCase();
        } else {
            avatarInitialsEl.textContent = (cleanForInitials.substring(0, 2) || clientName.substring(0, 2)).toUpperCase();
        }
    }

    const welcomeTitleEl = document.getElementById('welcomeTitle');
    if (welcomeTitleEl) {
        welcomeTitleEl.textContent = `Добро пожаловать, ${clientName}!`;
    }

    // 2. Текущая дата
    const dateSubtitleEl = document.getElementById('currentDateSubtitle');
    if (dateSubtitleEl) {
        const options = { day: 'numeric', month: 'long', year: 'numeric' };
        const dateStr = new Date().toLocaleDateString('ru-RU', options);
        dateSubtitleEl.textContent = `Сегодня ${dateStr}. Что планируем сегодня?`;
    }

    // 3. Предзаполнение формы
    const isCompany = /\b(ООО|ИП|АО|ПАО|ЗАО|ОАО|МУП|ГУП|НКО|КФХ)\b/i.test(clientName.trim());

    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val || '';
    };

    if (isCompany) {
        setVal('jurCompanyName', clientName);
        setVal('jurShortName', clientName);
        setVal('jurCompanyPhone', clientPhone);
        setVal('jurContactPerson', '');
    } else {
        const initialNameParts = clientName.trim().split(/\s+/);
        setVal('settingsLastName', initialNameParts[0] || '');
        setVal('settingsFirstName', initialNameParts[1] || '');
        setVal('settingsMiddleName', initialNameParts.slice(2).join(' ') || '');
        setVal('settingsPhoneInput', clientPhone || '+7 (...) ...-..--');
        setVal('jurContactPerson', clientName);
        setVal('jurCompanyPhone', clientPhone);
    }
    
    const initEmail = client.email || client.EMAIL || '';
    initEmptyEmailField('settingsEmailInput', initEmail);
    initEmptyEmailField('jurCompanyEmail', initEmail);

    // 4. Баллы
    const cachedPoints = client.balance ?? client.points ?? client.POINTS ?? client.BALANCE ?? 
                         client.cashback ?? client.CASHBACK ?? client.bonus ?? client.BONUS ?? client.score ?? null;
    if (cachedPoints !== null && cachedPoints !== undefined) {
        updateLoyaltyDisplay(cachedPoints);
    }

    // 5. Поиск DaData при ручном вводе
    initDaDataPartyLookup();
    initDaDataBankLookup();

    // 6. Загрузка данных из CRM
    if (typeof loadGarageCars === 'function') loadGarageCars(clientId);
    if (typeof loadCustomerDeals === 'function') loadCustomerDeals(clientId);
    if (typeof loadServiceAppointments === 'function') loadServiceAppointments(clientId);
    if (typeof loadRecommendations === 'function') loadRecommendations(clientId);
    if (typeof initCabinetBookingModule === 'function') initCabinetBookingModule();
    
    loadLoyaltyBalance(clientId);
    loadTransactions(clientId);
    loadUserProfile(clientId);
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

    if (tabId === 'services' && typeof switchServicesSubTab === 'function') {
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

// ============================================================
// ЗАГРУЗКА ДАННЫХ ПРОФИЛЯ ИЗ STOCRM
// ============================================================
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
            const phys = p.phys || {};
            const jur = p.jur || {};

            const setField = (id, val) => {
                const el = document.getElementById(id);
                if (el) {
                    el.value = (val !== undefined && val !== null && val !== false && val !== 'false') ? val : '';
                }
            };

            const isOrg = /\b(ООО|ИП|АО|ПАО|ЗАО|ОАО|МУП|ГУП|НКО|КФХ)\b/i.test((jur.company_name || phys.title || clientName).trim());

            // 1. Физическое лицо
            setField('settingsLastName', phys.surname || '');
            setField('settingsFirstName', phys.first_name || '');
            setField('settingsMiddleName', phys.middle_name || '');
            setField('settingsGender', phys.gender || 'M');
            setField('settingsPhoneInput', phys.phone || clientPhone || '');
            setField('settingsBirthdayInput', phys.birthday || '');
            setField('settingsCityInput', phys.city || '');
            setField('settingsAddressInput', phys.address || '');
            setField('settingsSiteInput', phys.site || '');
            setField('settingsDiscountCardInput', phys.discount_card || '');
            setField('settingsSegmentInput', phys.segment || 'Сотрудники');

            // 2. Юридическое лицо (данные из CRM)
            setField('jurCompanyName', jur.company_name || (isOrg ? clientName : ''));
            setField('jurShortName', jur.short_name || (isOrg ? clientName : ''));
            setField('jurInn', jur.inn || '');
            setField('jurKpp', jur.kpp || '');
            setField('jurOgrn', jur.ogrn || '');
            setField('jurDirector', jur.director || '');
            setField('jurOkpo', jur.okpo || '');
            setField('jurOkved', jur.okved || '');
            setField('jurRegDate', jur.reg_date || '');
            
            // Если юрлицо — контактное лицо очищается от названия компании
            if (isOrg) {
                setField('jurContactPerson', jur.contact_person || '');
            } else {
                setField('jurContactPerson', jur.contact_person || phys.title || clientName);
            }

            setField('jurCompanyPhone', jur.company_phone || phys.phone || clientPhone || '');
            setField('jurBik', jur.bik || '');
            setField('jurBankName', jur.bank_name || '');
            setField('jurRs', jur.rs || '');
            setField('jurKs', jur.ks || '');
            setField('jurLegalAddress', jur.legal_address || '');
            setField('jurFactAddress', jur.fact_address || '');

            const physEmail = phys.email || '';
            initEmptyEmailField('settingsEmailInput', physEmail);

            const jurEmail = jur.company_email || phys.email || '';
            initEmptyEmailField('jurCompanyEmail', jurEmail);

            // Индикатор статуса организации (показывается только если ИНН найден)
            const statusAlert = document.getElementById('jurStatusAlert');
            if (statusAlert) {
                if (jur.inn && jur.state_status) {
                    statusAlert.style.display = 'block';
                    if (jur.state_status === 'ACTIVE') {
                        statusAlert.style.background = '#dcfce7';
                        statusAlert.style.color = '#15803d';
                        statusAlert.style.border = '1px solid #86efac';
                        statusAlert.textContent = `✔ ${jur.state_status_text || 'Действующая организация'} (ЕГРЮЛ)`;
                    } else {
                        statusAlert.style.background = '#fee2e2';
                        statusAlert.style.color = '#dc2626';
                        statusAlert.style.border = '1px solid #f87171';
                        statusAlert.textContent = `⚠ Внимание: ${jur.state_status_text}`;
                    }
                } else {
                    statusAlert.style.display = 'none';
                }
            }

            // Дозаполнение банка по БИК (если БИК есть в CRM, а названия нет)
            if (jur.bik && jur.bik.length === 9 && !jur.bank_name) {
                fetchBankDataByBik(jur.bik);
            }
        }
    } catch (e) {
        console.error('Ошибка загрузки профиля пользователя из STOCRM:', e);
    }
}

// ============================================================
// АВТОПОИСК ПО ИНН ПРИ РУЧНОМ ВВОДЕ (DADATA)
// ============================================================
function initDaDataPartyLookup() {
    const innInput = document.getElementById('jurInn');
    if (!innInput) return;

    let debounceTimer = null;

    innInput.addEventListener('input', function() {
        const val = this.value.replace(/\D/g, '');
        clearTimeout(debounceTimer);

        if (val.length === 10 || val.length === 12 || val.length === 13 || val.length === 15) {
            debounceTimer = setTimeout(() => {
                fetchPartyDataByInn(val);
            }, 400);
        }
    });

    innInput.addEventListener('blur', function() {
        const val = this.value.replace(/\D/g, '');
        if (val.length >= 10) {
            fetchPartyDataByInn(val);
        }
    });
}

let isPartyFetching = false;
async function fetchPartyDataByInn(query) {
    if (isPartyFetching || !query) return;
    isPartyFetching = true;

    const innInput = document.getElementById('jurInn');
    const prevPlaceholder = innInput ? innInput.placeholder : '';
    if (innInput) innInput.placeholder = 'Поиск в ЕГРЮЛ...';

    try {
        const formData = new FormData();
        formData.append('type', 'party');
        formData.append('query', query);

        const res = await fetch('api/dadata.php', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (data.status === 'success') {
            const setForce = (id, val) => {
                const el = document.getElementById(id);
                if (el && val) el.value = val;
            };

            setForce('jurCompanyName', data.name_full || data.name_short);
            setForce('jurShortName', data.name_short);
            setForce('jurInn', data.inn || '');
            setForce('jurKpp', data.kpp || '');
            setForce('jurOgrn', data.ogrn || '');
            setForce('jurDirector', data.director || '');
            setForce('jurOkpo', data.okpo || '');
            setForce('jurOkved', data.okved || '');
            setForce('jurRegDate', data.registration_date || '');
            setForce('jurLegalAddress', data.legal_address || '');

            const factEl = document.getElementById('jurFactAddress');
            if (factEl && factEl.value.trim() === '') {
                factEl.value = data.legal_address || '';
            }

            const statusAlert = document.getElementById('jurStatusAlert');
            if (statusAlert && data.state_status) {
                statusAlert.style.display = 'block';
                if (data.state_status === 'ACTIVE') {
                    statusAlert.style.background = '#dcfce7';
                    statusAlert.style.color = '#15803d';
                    statusAlert.style.border = '1px solid #86efac';
                    statusAlert.textContent = `✔ ${data.state_status_text} (ЕГРЮЛ)`;
                } else {
                    statusAlert.style.background = '#fee2e2';
                    statusAlert.style.color = '#dc2626';
                    statusAlert.style.border = '1px solid #f87171';
                    statusAlert.textContent = `⚠ Внимание: ${data.state_status_text}`;
                }
            }
        }
    } catch (e) {
        console.error('Ошибка DaData Party:', e);
    } finally {
        if (innInput) innInput.placeholder = prevPlaceholder || '10 или 12 цифр';
        isPartyFetching = false;
    }
}

// ============================================================
// АВТОПОИСК БАНКА ПО БИК (DADATA)
// ============================================================
function initDaDataBankLookup() {
    const bikInput = document.getElementById('jurBik');
    if (!bikInput) return;

    let bikTimer = null;

    bikInput.addEventListener('input', function() {
        const val = this.value.replace(/\D/g, '');
        clearTimeout(bikTimer);

        if (val.length === 9) {
            bikTimer = setTimeout(() => {
                fetchBankDataByBik(val);
            }, 300);
        }
    });

    bikInput.addEventListener('blur', function() {
        const val = this.value.replace(/\D/g, '');
        if (val.length === 9) {
            fetchBankDataByBik(val);
        }
    });
}

let isBankFetching = false;
async function fetchBankDataByBik(bik) {
    if (isBankFetching || !bik) return;
    isBankFetching = true;

    const bankNameInput = document.getElementById('jurBankName');
    const prevPlaceholder = bankNameInput ? bankNameInput.placeholder : '';
    if (bankNameInput) bankNameInput.placeholder = 'Поиск банка по БИК...';

    try {
        const formData = new FormData();
        formData.append('type', 'bank');
        formData.append('query', bik);

        const res = await fetch('api/dadata.php', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (data.status === 'success') {
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el && val) el.value = val;
            };

            setVal('jurBankName', data.bank_name);
            setVal('jurKs', data.ks);
        }
    } catch (e) {
        console.error('Ошибка DaData Bank:', e);
    } finally {
        if (bankNameInput) bankNameInput.placeholder = prevPlaceholder || 'Заполнится автоматически по БИК';
        isBankFetching = false;
    }
}

// ============================================================
// СОХРАНЕНИЕ ПРОФИЛЕЙ В STOCRM
// ============================================================
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
            document.getElementById('welcomeTitle').textContent = `Добро пожаловать, ${payload.first_name || newTitle}!`;

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
        okpo:           document.getElementById('jurOkpo') ? document.getElementById('jurOkpo').value.trim() : '',
        okved:          document.getElementById('jurOkved') ? document.getElementById('jurOkved').value.trim() : '',
        reg_date:       document.getElementById('jurRegDate') ? document.getElementById('jurRegDate').value.trim() : '',
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
// БАЛАНС И ИСТОРИЯ ОПЕРАЦИЙ
// ============================================================
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