/* ============================================================
   ПИН-АВТО — СКРИПТ ПАНЕЛИ УПРАВЛЕНИЯ (ADMIN/JS/ADMIN.JS)
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
    loadBranchesList();
});

/**
 * Загрузка списка подразделений и отрисовка переключателей
 */
async function loadBranchesList() {
    const loadingEl = document.getElementById('branchesLoading');
    const tableWrap = document.getElementById('branchesTableWrap');
    const tbody = document.getElementById('branchesTableBody');

    if (!tbody) return;

    try {
        const res = await fetch('branch_toggle.php?action=list');
        const data = await res.json();

        if (data.status === 'success' && Array.isArray(data.branches)) {
            let html = '';

            data.branches.forEach(b => {
                const isChecked = b.enabled ? 'checked' : '';
                const badgeClass = b.enabled ? 'status-badge success' : 'status-badge';
                const badgeText = b.enabled ? 'Активен' : 'Отключен';
                const testTag = b.is_test ? '<span class="branch-test-badge">ТЕСТ</span>' : '';

                html += `
                    <tr id="branch_row_${b.id}">
                        <td><strong>${b.customer_id}</strong></td>
                        <td>
                            <div class="branch-name-title">${escapeHtml(b.name)} ${testTag}</div>
                            <div class="branch-address-sub">${escapeHtml(b.address || b.city || 'Адрес не указан')}</div>
                        </td>
                        <td style="text-align: center;">
                            <span id="badge_${b.id}" class="${badgeClass}">${badgeText}</span>
                        </td>
                        <td style="text-align: center;">
                            <label class="switch">
                                <input type="checkbox" ${isChecked} onchange="toggleBranchStatus('${b.id}', this.checked)">
                                <span class="slider"></span>
                            </label>
                        </td>
                    </tr>
                `;
            });

            tbody.innerHTML = html;
            if (loadingEl) loadingEl.style.display = 'none';
            if (tableWrap) tableWrap.style.display = 'block';
        } else {
            if (loadingEl) loadingEl.textContent = 'Ошибка загрузки филиалов: ' + (data.message || 'Некорректный ответ');
        }
    } catch (err) {
        console.error('Ошибка загрузки филиалов:', err);
        if (loadingEl) loadingEl.textContent = 'Ошибка связи с сервером при загрузке филиалов';
    }
}

/**
 * Переключение активности филиала
 * @param {string} branchId Идентификатор филиала
 * @param {boolean} isEnabled Состояние чекбокса
 */
async function toggleBranchStatus(branchId, isEnabled) {
    const badge = document.getElementById(`badge_${branchId}`);
    if (badge) {
        badge.className = 'status-badge warning';
        badge.textContent = 'Сохранение...';
    }

    try {
        const formData = new FormData();
        formData.append('action', 'toggle');
        formData.append('branch_id', branchId);
        formData.append('enabled', isEnabled ? '1' : '0');

        const res = await fetch('branch_toggle.php?action=toggle', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (data.status === 'success') {
            if (badge) {
                badge.className = isEnabled ? 'status-badge success' : 'status-badge';
                badge.textContent = isEnabled ? 'Активен' : 'Отключен';
            }
        } else {
            alert('Ошибка изменения статуса: ' + (data.message || 'Не удалось сохранить'));
            loadBranchesList(); // Откатываем вид к фактическому
        }
    } catch (err) {
        console.error('Ошибка toggleBranchStatus:', err);
        alert('Ошибка связи с сервером при обновлении статуса филиала');
        loadBranchesList();
    }
}

/**
 * Безопасное экранирование спецсимволов HTML
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Закрытие окна логов
 */
function closeLogBox() {
    const logBox = document.getElementById('logContainer');
    if (logBox) {
        logBox.style.display = 'none';
    }
}

/**
 * Запуск фонового скрипта через update_worker.php
 */
async function runScript(scriptName) {
    const logBox = document.getElementById('logContainer');
    const logContent = document.getElementById('logContent');
    const buttons = document.querySelectorAll('.admin-card button');

    if (!logBox || !logContent) return;

    logBox.style.display = 'block';
    const ext = scriptName === 'sync_schedules' ? '.php' : '.py';
    logContent.textContent = `⏳ Бэкап файлов (если требуется)...\n⏳ Запуск задачи ${scriptName}${ext}...\n`;

    buttons.forEach(b => b.disabled = true);

    try {
        const formData = new FormData();
        formData.append('script', scriptName);

        const res = await fetch('update_worker.php', {
            method: 'POST',
            body: formData
        });

        const result = await res.json();

        if (result.status === 'success') {
            logContent.textContent += `✅ Выполнение завершено успешно.\n\n${result.output || ''}\n`;
        } else {
            logContent.textContent += `❌ Ошибка: ${result.message || 'Скрипт вернул статус ошибки'}\n`;
            if (result.output) {
                logContent.textContent += `\nВывод консоли:\n${result.output}\n`;
            }
        }
    } catch (err) {
        logContent.textContent += `❌ Критическая ошибка связи с сервером: ${err.message}\n`;
    } finally {
        buttons.forEach(b => b.disabled = false);
        logContent.scrollTop = logContent.scrollHeight;
    }
}