<?php
/**
 * ПИН-АВТО — Обработчик управления активностью филиалов (admin/branch_toggle.php)
 */

header('Content-Type: application/json; charset=utf-8');

$rootDir = dirname(__DIR__);
$configPath = $rootDir . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'config.json';
$rootConfigPath = $rootDir . DIRECTORY_SEPARATOR . 'config.json';

if (!file_exists($configPath) && file_exists($rootConfigPath)) {
    $configPath = $rootConfigPath;
}

if (!file_exists($configPath)) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Файл config.json не найден'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$rawJson = file_get_contents($configPath);
$configData = json_decode($rawJson, true);

if (!$configData || !isset($configData['branches'])) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Некорректная структура config.json'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$action = $_GET['action'] ?? ($_POST['action'] ?? 'list');

// 1. Получение списка филиалов со статусами
if ($action === 'list') {
    $branchesList = [];
    foreach ($configData['branches'] as $id => $branch) {
        $enabled = isset($branch['booking_enabled']) ? (bool)$branch['booking_enabled'] : true;
        $branchesList[] = [
            'id'          => (string)$id,
            'customer_id' => $branch['CUSTOMER_ID'] ?? $id,
            'name'        => $branch['CUSTOMER_NAME'] ?? "Филиал #{$id}",
            'address'     => $branch['ADDRESS'] ?? '',
            'city'        => $branch['CITY_NAME'] ?? '',
            'enabled'     => $enabled,
            'is_test'     => !empty($branch['IS_TEST'])
        ];
    }

    echo json_encode([
        'status'   => 'success',
        'branches' => $branchesList
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. Переключение активности филиала
if ($action === 'toggle') {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        echo json_encode(['status' => 'error', 'message' => 'Требуется POST-запрос'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $branchId = trim($_POST['branch_id'] ?? '');
    $enabled = filter_var($_POST['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);

    if ($branchId === '' || !isset($configData['branches'][$branchId])) {
        echo json_encode(['status' => 'error', 'message' => 'Филиал не найден в конфигурации'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Сохранение статуса
    $configData['branches'][$branchId]['booking_enabled'] = $enabled;

    // Автоматический бэкап перед записью
    $backupDir = $rootDir . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'backups';
    if (!is_dir($backupDir)) {
        @mkdir($backupDir, 0775, true);
    }
    @copy($configPath, $backupDir . DIRECTORY_SEPARATOR . 'config.json.bak.' . date('Ymd_His'));

    // Сохранение в config/config.json и в зеркало в корне
    $jsonOutput = json_encode($configData, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $saved = file_put_contents($configPath, $jsonOutput);

    if (file_exists($rootConfigPath)) {
        @file_put_contents($rootConfigPath, $jsonOutput);
    }

    if ($saved !== false) {
        echo json_encode([
            'status'    => 'success',
            'message'   => 'Статус филиала успешно обновлен',
            'branch_id' => $branchId,
            'enabled'   => $enabled
        ], JSON_UNESCAPED_UNICODE);
    } else {
        echo json_encode([
            'status'  => 'error',
            'message' => 'Не удалось сохранить изменения в config.json'
        ], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Неизвестное действие'], JSON_UNESCAPED_UNICODE);