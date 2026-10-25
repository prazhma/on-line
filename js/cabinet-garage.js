/* ============================================================
   ПИН-АВТО — МОДУЛЬ ГАРАЖА И КАТАЛОГА ТОВАРОВ (JS/CABINET-GARAGE.JS)
   ============================================================ */

let clientCarsList = [];

// Определение и нормализация логотипа марки авто
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

// Загрузка автомобилей клиента из CRM
async function loadGarageCars(cId) {
    try {
        const resCars = await fetch(`api/cars.php?client_id=${encodeURIComponent(cId)}`);
        const dataCars = await resCars.json();
        if (dataCars.status === 'success' && dataCars.cars && dataCars.cars.length > 0) {
            clientCarsList = dataCars.cars;
            const badge = document.getElementById('garageBadge');
            if (badge) badge.textContent = dataCars.cars.length;
            renderGarage(dataCars.cars);
            if (typeof populateGarageSelect === 'function') {
                populateGarageSelect(dataCars.cars);
            }
            initCatalogSelectors(dataCars.cars);
        } else {
            clientCarsList = [];
            const mainGar = document.getElementById('mainGarageContainer');
            if (mainGar) mainGar.innerHTML = '<div class="empty-info-box">Автомобили не найдены</div>';
            const fullGar = document.getElementById('fullGarageContainer');
            if (fullGar) fullGar.innerHTML = '<div class="empty-info-box">В вашем гараже пока нет автомобилей</div>';
            if (typeof populateGarageSelect === 'function') {
                populateGarageSelect([]);
            }
            initCatalogSelectors([]);
        }
    } catch (e) {
        console.error('Cars load error:', e);
    }
}

// Генерация карточек гаража на Главной и во вкладке "Мой гараж"
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

// Плитки выбора авто для подбора товаров
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

// Подбор аккумуляторов через API Rossko по VIN
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