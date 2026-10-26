<?php
/**
 * ПИН-АВТО — Обработчик выполнения служебных скриптов (admin/update_worker.php)
 */

require __DIR__ . '/admin_auth.php';
admin_require_auth();

header('Content-Type: application/json; charset=utf-8');

// Белый список скриптов
$allowedScripts = [
    'sync_schedules'       => 'sync_schedules.php'
];

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Разрешены только POST-запросы'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$scriptKey = trim($_POST['script'] ?? '');

if (!isset($allowedScripts[$scriptKey])) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Указанный скрипт не найден в разрешенном списке'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$scriptFile = $allowedScripts[$scriptKey];
$scriptPath = __DIR__ . DIRECTORY_SEPARATOR . $scriptFile;

if (!file_exists($scriptPath)) {
    echo json_encode([
        'status'  => 'error',
        'message' => "Файл не найден по пути: {$scriptPath}"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 1. Корень проекта (/volume1/web/)
$rootDir = dirname(__DIR__);

// 2. Гарантируем наличие папки config в корне проекта
$configDir = $rootDir . DIRECTORY_SEPARATOR . 'config';
if (!is_dir($configDir)) {
    @mkdir($configDir, 0775, true);
}

// 3. Переключаем рабочую директорию в КОРЕНЬ проекта
// Теперь относительные пути "config/config.json" пишутся в /volume1/web/config/
chdir($rootDir);

$extension = pathinfo($scriptPath, PATHINFO_EXTENSION);
$escapedPath = escapeshellarg($scriptPath);

if ($extension === 'py') {
    $command = "python3 {$escapedPath} 2>&1";
} elseif ($extension === 'php') {
    $command = "php {$escapedPath} 2>&1";
} else {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Неподдерживаемый тип исполняемого файла'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Запуск команды и сбор вывода
$output = [];
$returnVar = 0;
exec($command, $output, $returnVar);

$outputText = implode("\n", $output);

if ($returnVar === 0) {
    echo json_encode([
        'status'  => 'success',
        'output'  => $outputText,
        'message' => 'Скрипт успешно выполнен'
    ], JSON_UNESCAPED_UNICODE);
} else {
    echo json_encode([
        'status'  => 'error',
        'output'  => $outputText,
        'message' => "Скрипт завершился с кодом ошибки {$returnVar}"
    ], JSON_UNESCAPED_UNICODE);
}