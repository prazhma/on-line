/* ============================================================
   ПИН-АВТО — ЗАКАЗ-НАРЯДЫ И РЕКОМЕНДАЦИИ (JS/CABINET-ORDERS.JS)
   ============================================================ */

let globalDeals = [];
let currentFilteredDeals = [];
let currentOrdersPage = 1;
const ordersPerPage = 10;
let currentOrderStatusFilter = 'all';

/**
 * Валидатор сделок: фильтрует архивные, удаленные и мусорные статусы.
 * Разрешены к показу клиенту:
 * - «Успешно реализовано»
 * - «В работе»
 * - «Необходимо перезвонить»
 * - «Неразобранное»
 */
function isAllowedDeal(deal) {
    if (!deal) return false;

    // 1. Проверка системных флагов архивации STOCRM во всех возможных регистрах
    const archiveFlags = [
        deal.is_archive,
        deal.IS_ARCHIVE,
        deal.archive,
        deal.ARCHIVE,
        deal.is_archived,
        deal.IS_ARCHIVED
    ];

    for (let flag of archiveFlags) {
        if (flag === 1 || flag === '1' || flag === true || flag === 'Y' || flag === 'y') {
            return false;
        }
    }

    // 2. Проверка флагов удаления
    if (deal.is_deleted === 1 || deal.is_deleted === true || deal.deleted === 1 || deal.deleted === true) {
        return false;
    }

    const st = (deal.status || '').trim().toLowerCase();

    // 3. Если в названии стадии явно присутствует слово «архив»
    if (st.includes('архив')) {
        return false;
    }

    // 4. Белый список разрешенных статусов для отображения в кабинете клиента
    const allowedStatuses = [
        'успешно реализовано',
        'в работе',
        'необходимо перезвонить',
        'неразобранное'
    ];

    return allowedStatuses.some(allowed => st === allowed || st.includes(allowed));
}

// Загрузка сделок клиента
async function loadCustomerDeals(cId) {
    try {
        const resOffers = await fetch(`api/offers.php?client_id=${encodeURIComponent(cId)}`);
        const dataOffers = await resOffers.json();
        
        if (dataOffers.status === 'success' && Array.isArray(dataOffers.deals)) {
            // Применяем строгий фильтр
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
            if (st.includes('перезвонить') || st.includes('неразобран')) {
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
        if (st.includes('перезвонить') || st.includes('неразобран')) {
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

// Загрузка рекомендаций мастера
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

                html += `</tbody></table></div>`;
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