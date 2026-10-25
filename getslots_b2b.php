<?php
error_reporting(0);
ini_set('display_errors', 0);
date_default_timezone_set('Europe/Moscow');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Жестко проверяем пути к конфигу (с учетом структуры Synology NAS)
$config_paths = [
    '/volume1/web/config/config.json',
    '/volume1/web/config.json',
    __DIR__ . '/config/config.json',
    __DIR__ . '/config.json',
    dirname(__DIR__) . '/config/config.json'
];
$config_file = '';
foreach ($config_paths as $path) {
    if (file_exists($path) && is_readable($path)) {
        $config_file = $path;
        break;
    }
}

if (!$config_file) {
    echo json_encode(['status' => 'error', 'message' => 'Файл конфигурации не найден']);
    exit;
}

$raw = file_get_contents($config_file);
$raw = preg_replace('/^\xEF\xBB\xBF/', '', $raw);
$config = json_decode($raw, true);

$api_key = $config['api_key'] ?? '';
$domain  = $config['domain'] ?? 'pin-avto';

if (empty($api_key)) {
    echo json_encode(['status' => 'error', 'message' => 'Ключ API пуст']);
    exit;
}

$customer_id   = intval($_GET['customer_id'] ?? 0);
$post_id       = intval($_GET['post_id'] ?? 0);
$date          = $_GET['date'] ?? date('Y-m-d');
$duration_mins = intval($_GET['duration'] ?? 60);

if (!$customer_id || !$post_id || empty($date)) {
    echo json_encode(['status' => 'error', 'message' => 'Missing parameters']);
    exit;
}

// =========================================================================
// 1. ЧИТАЕМ ГРАФИК ИЗ CONFIG.JSON (С УЧЕТОМ ВЫХОДНЫХ)
// =========================================================================
$start_minutes = 540; // Дефолт 09:00
$end_minutes   = 1200; // Дефолт 20:00
$is_day_off    = false;

$branches = $config['branches'] ?? [];
if (isset($branches[$customer_id])) {
    $branchData = $branches[$customer_id];
    $workTimeConfig = $branchData['work_time'] ?? [];
    
    // День недели в формате PHP от 1 (понедельник) до 7 (воскресенье)
    $day_of_week = date('N', strtotime($date));
    
    if (!isset($workTimeConfig[$day_of_week])) {
        $is_day_off = true;
    } else {
        $start_minutes = intval($workTimeConfig[$day_of_week]['START']);
        $end_minutes   = intval($workTimeConfig[$day_of_week]['END']);
        
        // Если время работы с 0 до 0 — считаем выходным днем
        if ($start_minutes === 0 && $end_minutes === 0) {
            $is_day_off = true;
        }
    }
} else {
    // Резервный поиск через schedules.json, если филиал отсутствует в config.json
    $schedules_paths = ['/volume1/web/schedules.json', __DIR__ . '/schedules.json', dirname(__DIR__) . '/schedules.json'];
    foreach ($schedules_paths as $s_path) {
        if (file_exists($s_path)) {
            $schedules = json_decode(file_get_contents($s_path), true);
            if (isset($schedules[$customer_id])) {
                $day_of_week = date('N', strtotime($date));
                if (!isset($schedules[$customer_id][$day_of_week])) {
                    $is_day_off = true;
                } else {
                    $start_minutes = intval($schedules[$customer_id][$day_of_week]['START']);
                    $end_minutes   = intval($schedules[$customer_id][$day_of_week]['END']);
                    if ($start_minutes === 0 && $end_minutes === 0) $is_day_off = true;
                }
            }
            break;
        }
    }
}

// Если сегодня выходной, моментально возвращаем пустой массив слотов
if ($is_day_off) {
    echo json_encode(['status' => 'success', 'slots' => []], JSON_UNESCAPED_UNICODE);
    exit;
}

// =========================================================================
// 2. ПОЛУЧАЕМ ЗАНЯТЫЕ СЛОТЫ ЧЕРЕЗ NATIVE CURL
// =========================================================================
$url = "https://{$domain}.stocrm.ru/api/external/v1/calendar/card/get";
$payload = [
    "SID"         => $api_key,
    "CUSTOMER_ID" => $customer_id,
    "DATE"        => strtotime($date)
];

$json_payload = json_encode($payload, JSON_UNESCAPED_UNICODE);
$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $json_payload,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Content-Length: ' . strlen($json_payload)],
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => 0,
    CURLOPT_TIMEOUT        => 8
]);
$response = curl_exec($ch);
curl_close($ch);

$booked_intervals = [];
if ($response) {
    $data = json_decode($response, true);
    if (isset($data['RESPONSE']) && is_array($data['RESPONSE'])) {
        foreach ($data['RESPONSE'] as $card) {
            if (is_array($card) && intval($card['POST_ID'] ?? 0) === $post_id && ($card['DEACTIVATE'] ?? 'N') === 'N') {
                $booked_intervals[] = [
                    'start' => intval($card['DATE_FROM']),
                    'end'   => intval($card['DATE_TO'])
                ];
            }
        }
    }
}

// =========================================================================
// 3. ФОРМИРУЕМ СЛОТЫ ПО ВРЕМЕНИ
// =========================================================================
$current_ts = strtotime("{$date} 00:00:00") + ($start_minutes * 60);
$end_ts     = strtotime("{$date} 00:00:00") + ($end_minutes * 60);

$slots = [];
$step_seconds = 30 * 60; // Шаг в 30 минут

while ($current_ts + ($duration_mins * 60) <= $end_ts) {
    $slot_start = $current_ts;
    $slot_end   = $slot_start + ($duration_mins * 60);
    
    $is_available = true;
    
    if ($slot_start < time()) {
        $is_available = false;
    } else {
        foreach ($booked_intervals as $b) {
            if (max($slot_start, $b['start']) < min($slot_end, $b['end'])) {
                $is_available = false;
                break;
            }
        }
    }
    
    $slots[] = ['time' => date("H:i", $slot_start), 'available' => $is_available];
    $current_ts += $step_seconds;
}

echo json_encode(['status' => 'success', 'slots' => $slots], JSON_UNESCAPED_UNICODE);
exit;