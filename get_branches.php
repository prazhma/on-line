<?php
/**
 * ПИН-АВТО — Отдача списка активных филиалов и каталога услуг (get_branches.php)
 */

// Отключаем вывод предупреждений в браузер, чтобы не ломать JSON
ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

// 1. Поиск config.json по всем возможным расположениям
$configPaths = [
    __DIR__ . '/config/config.json',
    __DIR__ . '/config.json',
    __DIR__ . '/admin/config/config.json',
    __DIR__ . '/admin/config.json'
];

$configPath = null;
foreach ($configPaths as $path) {
    if (file_exists($path) && filesize($path) > 0) {
        $configPath = $path;
        break;
    }
}

if (!$configPath) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Файл config.json не найден'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$rawJson = @file_get_contents($configPath);
$config = @json_decode($rawJson, true);

if (!is_array($config) || !isset($config['branches']) || !is_array($config['branches'])) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Некорректная структура config.json: ' . json_last_error_msg()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// 2. Мягкая фильтрация филиалов (активны, если явно не отключены в админке)
$activeBranches = [];
foreach ($config['branches'] as $id => $branch) {
    // Проверка тумблера из админ-панели (по умолчанию true)
    $isBookingEnabled = true;
    if (isset($branch['booking_enabled'])) {
        $val = $branch['booking_enabled'];
        if ($val === false || $val === 0 || $val === '0' || $val === 'false') {
            $isBookingEnabled = false;
        }
    }

    // Исключаем только если в STOCRM филиал явно деактивирован
    $isStocrmActive = true;
    if (isset($branch['ACTIVE'])) {
        $act = $branch['ACTIVE'];
        if ($act === 'N' || $act === 'n' || $act === false || $act === 0 || $act === '0') {
            $isStocrmActive = false;
        }
    }

    if ($isBookingEnabled && $isStocrmActive) {
        $activeBranches[(string)$id] = $branch;
    }
}

// Защита: если все филиалы отфильтровались, отдаем исходный список
if (empty($activeBranches)) {
    foreach ($config['branches'] as $id => $branch) {
        $activeBranches[(string)$id] = $branch;
    }
}

// 3. Поиск services.json (в папке config/ или в корне)
$services = [];
$servicesPaths = [
    __DIR__ . '/config/services.json',
    __DIR__ . '/services.json',
    __DIR__ . '/admin/config/services.json'
];

foreach ($servicesPaths as $sPath) {
    if (file_exists($sPath) && filesize($sPath) > 0) {
        $sRaw = @file_get_contents($sPath);
        $sData = @json_decode($sRaw, true);
        if (is_array($sData)) {
            $services = (isset($sData['services']) && is_array($sData['services'])) ? $sData['services'] : $sData;
            break;
        }
    }
}

// Гарантируем, что branches в JSON всегда является объектом {}
$branchesObject = (object)$activeBranches;
$config['branches'] = $branchesObject;

echo json_encode([
    'status'   => 'success',
    'branches' => $branchesObject,
    'config'   => $config,
    'services' => $services,
    'brands'   => $config['brands'] ?? []
], JSON_UNESCAPED_UNICODE);