<?php
/**
 * ПИН-АВТО — Живой просмотр логов и инспектор методов API (api/debug_log.php)
 */

$logFile = __DIR__ . '/cache/debug.log';

if (isset($_GET['clear']) && $_GET['clear'] === '1') {
    if (file_exists($logFile)) @file_put_contents($logFile, '');
    header('Location: debug_log.php');
    exit;
}

$content = file_exists($logFile) ? file_get_contents($logFile) : '';

$csFile = __DIR__ . '/../services/CustomerService.php';
$csSource = file_exists($csFile) ? file_get_contents($csFile) : 'Файл services/CustomerService.php не найден';

$scFile = __DIR__ . '/../services/StocrmClient.php';
$scSource = file_exists($scFile) ? file_get_contents($scFile) : 'Файл services/StocrmClient.php не найден';
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <title>Диагностика STOCRM — Лог запросов</title>
    <style>
        body { font-family: Consolas, monospace; background: #0f172a; color: #e2e8f0; margin: 0; padding: 20px; font-size: 13px; }
        .header { display: flex; justify-content: space-between; align-items: center; background: #1e293b; padding: 12px 18px; border-radius: 8px; margin-bottom: 16px; }
        h1 { margin: 0; font-size: 16px; color: #38bdf8; }
        .btn { background: #2563eb; color: #fff; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; text-decoration: none; font-weight: bold; font-size: 12px; margin-left: 8px; }
        .btn-danger { background: #dc2626; }
        .tabs { display: flex; gap: 8px; margin-bottom: 12px; }
        .tab-btn { background: #334155; color: #cbd5e1; border: none; padding: 8px 14px; border-radius: 6px; cursor: pointer; font-weight: bold; }
        .tab-btn.active { background: #38bdf8; color: #0f172a; }
        .pane { display: none; }
        .pane.active { display: block; }
        pre { background: #1e293b; padding: 16px; border-radius: 8px; overflow-x: auto; white-space: pre-wrap; word-wrap: break-word; line-height: 1.45; border: 1px solid #334155; max-height: 75vh; }
        .empty { color: #94a3b8; padding: 30px; text-align: center; background: #1e293b; border-radius: 8px; }
    </style>
</head>
<body>

<div class="header">
    <h1>📋 Диагностика запросов и структуры STOCRM</h1>
    <div>
        <a href="debug_log.php" class="btn">🔄 Обновить</a>
        <a href="debug_log.php?clear=1" class="btn btn-danger" onclick="return confirm('Очистить лог?')">🗑 Очистить</a>
    </div>
</div>

<div class="tabs">
    <button class="tab-btn active" onclick="showTab('log', this)">Журнал запросов (debug.log)</button>
    <button class="tab-btn" onclick="showTab('cs', this)">services/CustomerService.php</button>
    <button class="tab-btn" onclick="showTab('sc', this)">services/StocrmClient.php</button>
</div>

<div id="pane-log" class="pane active">
    <?php if (empty(trim($content))): ?>
        <div class="empty">Лог пока пуст. Выполните запрос с формы авторизации.</div>
    <?php else: ?>
        <pre><?= htmlspecialchars($content) ?></pre>
    <?php endif; ?>
</div>

<div id="pane-cs" class="pane">
    <pre><?= htmlspecialchars($csSource) ?></pre>
</div>

<div id="pane-sc" class="pane">
    <pre><?= htmlspecialchars($scSource) ?></pre>
</div>

<script>
function showTab(id, btn) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('pane-' + id).classList.add('active');
}
</script>

</body>
</html>