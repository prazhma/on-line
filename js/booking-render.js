/**
 * Функция парсинга и генерации разметки карточки записи на сервис
 * Поддерживает как структурированный объект, так и составную строку STOCRM.
 * @param {Object} item Объект данных записи из API/базы
 * @returns {string} HTML-строка для вставки в DOM
 */
function createBookingCardHTML(item) {
  // 1. Извлечение базовых полей с защитой от undefined
  const id = item.id || item.number || '—';
  const post = item.post ? `Пост №${item.post}` : (item.post_name || '№1');
  const carFull = item.car_full || item.car_model || item.vehicle || 'Автомобиль клиента';
  const dateTime = item.datetime || `${item.date || ''} ${item.time || ''}`.trim() || 'Дата и время не указаны';
  const status = item.status || 'Активна';

  // 2. Разбор составной строки комментария (STOCRM-формат: "Причина | Клиент | Авто | Работы")
  let commentRaw = item.comment || item.description || '';
  let channel = 'Онлайн-запись';
  let client = 'Клиент сервиса';
  let carPlate = '—';
  let services = [];
  let calculatedTotal = 0;

  if (commentRaw) {
    // Извлечение причины / канала
    const reasonMatch = commentRaw.match(/(?:Причина\s*\/\s*Комментарий|Причина):\s*([^|]+)/i);
    if (reasonMatch) channel = reasonMatch[1].trim();

    // Извлечение клиента
    const clientMatch = commentRaw.match(/Клиент:\s*([^|]+)/i);
    if (clientMatch) client = clientMatch[1].trim();

    // Извлечение авто и госномера
    const carMatch = commentRaw.match(/Авто:\s*([^|]+)/i);
    if (carMatch) carPlate = carMatch[1].trim();

    // Извлечение списка работ: "Замена масла в ДВС (1000 ₽), Замена фильтра (360 ₽)"
    const worksMatch = commentRaw.match(/Работы:\s*([^|]+)/i);
    if (worksMatch) {
      const worksListStr = worksMatch[1].trim();
      const workTokens = worksListStr.split(/,(?![^(]*\))/); // разделение по запятой вне скобок

      workTokens.forEach(token => {
        const trimmed = token.trim();
        if (!trimmed) return;

        // Поиск цены в скобках: (1000 ₽) или (1000 руб)
        const priceMatch = trimmed.match(/\(([\d\s]+)\s*(?:₽\vert{}руб\.?)\)/i);
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

  // Если работы переданы в объекте отдельным массивом
  if (Array.isArray(item.services) && item.services.length > 0) {
    services = item.services;
    calculatedTotal = services.reduce((sum, s) => sum + (parseFloat(s.price) || 0), 0);
  }

  // 3. Формирование класса статуса
  let statusClass = 'booking-status-active';
  const statusLower = status.toLowerCase();
  if (statusLower.includes('выполн') || statusLower.includes('закрыт')) {
    statusClass = 'booking-status-done';
  } else if (statusLower.includes('отмен') || statusLower.includes('отказ')) {
    statusClass = 'booking-status-cancelled';
  }

  // 4. Формирование строк списка работ
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
        <span class="booking-service-name">Комплексное обслуживание / осмотр</span>
        <span class="booking-service-price">—</span>
      </div>
    `;
  }

  // Форматирование итоговой суммы
  const totalDisplay = calculatedTotal > 0 ? formatCurrency(calculatedTotal) : (item.total ? formatCurrency(item.total) : 'По расчету');

  // 5. Итоговый HTML-шаблон
  return `
    <div class="booking-card" data-booking-id="${escapeHtml(id)}">
      <!-- Шапка карточки -->
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

      <!-- Сетка с деталями визита -->
      <div class="booking-grid">
        <!-- 1. Дата и время -->
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

        <!-- 2. Автомобиль и номер -->
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

        <!-- 3. Клиент -->
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

        <!-- 4. Источник заявки -->
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

      <!-- Блок выбранных услуг -->
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

/**
 * Вспомогательная функция экранирования HTML
 */
function escapeHtml(string) {
  if (!string) return '';
  return String(string)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Вспомогательная функция форматирования цен
 */
function formatCurrency(amount) {
  const num = parseFloat(amount) || 0;
  return new Intl.NumberFormat('ru-RU').format(num) + ' ₽';
}