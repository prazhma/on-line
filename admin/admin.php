<?php
require __DIR__ . '/admin_auth.php';
admin_require_auth();
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Панель управления скриптами | ПИН-АВТО</title>
    
    <link rel="icon" type="image/x-icon" href="../favicons/favicon.ico">
    <link rel="icon" type="image/png" sizes="16x16" href="../favicons/favicon-16x16.png">
    <link rel="icon" type="image/png" sizes="32x32" href="../favicons/favicon-32x32.png">
    <link rel="apple-touch-icon" sizes="180x180" href="../favicons/apple-touch-icon.png">
    
    <link rel="stylesheet" href="../css/main.css">
    <link rel="stylesheet" href="admin.css">

    <script src="js/admin.js" defer></script>
    <script src="js/services.js" defer></script>
</head>
<body>

<div class="admin-wrapper">
    <div class="booking-container">
        <h2>Панель управления ПИН-АВТО</h2>

        <div class="summary-box">
            <span>🛡️ Система автоматического бэкапа файлов перед изменениями активна</span>
            <span>Версия: Production</span>
            <span style="margin-left:auto;">👤 <?= htmlspecialchars($_SESSION['admin_login'] ?? '', ENT_QUOTES, 'UTF-8') ?></span>
            <a href="logout.php" style="color:#ff9d9d;">Выйти</a>
        </div>

        <!-- Раздел управления филиалами -->
        <div class="cabinet-section-title">
            <span>🏢 Управление филиалами (Онлайн-запись)</span>
        </div>
        
        <div class="admin-branches-box">
            <div id="branchesLoading" class="empty-info-box">Загрузка филиалов из config.json...</div>
            
            <div id="branchesTableWrap" class="table-wrap" style="display: none;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">ID</th>
                            <th>Филиал / Адрес</th>
                            <th style="width: 140px; text-align: center;">Статус</th>
                            <th style="width: 120px; text-align: center;">Вкл / Выкл</th>
                        </tr>
                    </thead>
                    <tbody id="branchesTableBody"></tbody>
                </table>
            </div>
        </div>

        <!-- Редактор подразделений: посты, графики, время работы -->
        <div class="cabinet-section-title">
            <span>🔧 Редактор подразделения (посты и график работы)</span>
        </div>

        <div class="branch-editor-box" id="branchEditorBox">
            <div class="branch-editor-toolbar">
                <label class="branch-editor-label" for="editorBranchSelect">Подразделение:</label>
                <select id="editorBranchSelect" class="auth-input-field branch-editor-select">
                    <option value="">-- Загрузка... --</option>
                </select>
                <button type="button" class="week-btn" id="editorReloadBtn" onclick="loadBranchEditor()">Обновить</button>
            </div>
            <div id="editorMessage" class="message" style="display:none;"></div>
            <div id="editorContent"><div class="empty-info-box">Выберите подразделение для редактирования.</div></div>
        </div>

        <!-- Редактор каталога работ: названия, категории, цены по филиалам, время выполнения -->
        <div class="cabinet-section-title">
            <span>🛠 Каталог работ (services.json): стоимость и время выполнения</span>
        </div>

        <div class="branch-editor-box" id="servicesEditorBox">
            <div id="servicesEditorToolbar" class="svc-toolbar"></div>
            <div id="svcMessage" class="message" style="display:none;"></div>
            <div id="servicesEditorContent"><div class="empty-info-box">Загрузка каталога...</div></div>
        </div>

        <!-- Раздел синхронизации -->
        <div class="cabinet-section-title">
            <span>🚀 Синхронизация данных CRM</span>
        </div>
        
        <div class="admin-cards-grid">
            <div class="admin-card">
                <div>
                    <h4>sync_schedules.php</h4>
                    <p>Синхронизировать актуальные графики работы филиалов в <code>schedules.json</code> для модуля расчета онлайн-записи.</p>
                </div>
                <button type="button" class="week-btn" onclick="runScript('sync_schedules')">Обновить schedules.json</button>
            </div>
        </div>

        <!-- Консоль логов -->
        <div id="logContainer" class="admin-log-box">
            <div class="admin-log-header">
                <span>Лог выполнения задачи:</span>
                <span class="admin-log-close" onclick="closeLogBox()">[скрыть]</span>
            </div>
            <div id="logContent">Ожидание запуска задачи...</div>
        </div>
    </div>
</div>

</body>
</html>