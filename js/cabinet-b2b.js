/* ============================================================
   ПИН-АВТО — БАЗОВЫЙ КАРКАС B2B КАБИНЕТА (JS/CABINET-B2B.JS)
   Шаг 1: Авторизация, инициализация сайдбара и переключение вкладок
   ============================================================ */

// 1. Проверка авторизации
const clientStr = localStorage.getItem('pin_b2b_client') || localStorage.getItem('pin_client');
if (!clientStr) {
    window.location.href = 'login.html';
}

let client = {};
try {
    client = JSON.parse(clientStr || '{}');
} catch (e) {
    client = {};
}

// Базовые параметры сессии
const clientName = client.rep_name || client.name || client.title || 'Клиент';
const companyTitle = client.name || client.title || 'Организация';
const clientId = client.id || client.LEGAL_ENTITY_ID || client.CUSTOMER_ID || client.CONTACT_ID || 0;
const clientInn = client.inn || client.INN || '';

document.addEventListener('DOMContentLoaded', () => {
    console.log('B2B Cabinet initialized for:', companyTitle, 'ID:', clientId);

    // Инициализация имени в сайдбаре
    const sidebarNameEl = document.getElementById('sidebarUserName');
    if (sidebarNameEl) sidebarNameEl.textContent = clientName;

    // Инициализация аватара (инициалы)
    const avatarInitialsEl = document.getElementById('userAvatarInitials');
    if (avatarInitialsEl) {
        const parts = clientName.split(/\s+/).filter(Boolean);
        let initials = 'ПА';
        if (parts.length >= 2) {
            initials = (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts[0]) {
            initials = parts[0].substring(0, 2).toUpperCase();
        }
        avatarInitialsEl.textContent = initials;
    }

    // Приветствие на главной
    const welcomeTitleEl = document.getElementById('welcomeTitle');
    if (welcomeTitleEl) {
        welcomeTitleEl.textContent = `Добро пожаловать, ${companyTitle}!`;
    }

    // Текущая дата
    const dateSubtitleEl = document.getElementById('currentDateSubtitle');
    if (dateSubtitleEl) {
        const dateStr = new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
        dateSubtitleEl.textContent = `Сегодня ${dateStr}. Корпоративный кабинет.`;
    }
});

// Выход из кабинета
function logoutB2B() {
    localStorage.removeItem('pin_b2b_client');
    localStorage.removeItem('pin_client');
    window.location.href = 'login.html';
}

// Переключение вкладок интерфейса
function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));

    const targetNav = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (targetNav) targetNav.classList.add('active');

    const targetPane = document.getElementById(`tab-${tabId}`);
    if (targetPane) targetPane.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}