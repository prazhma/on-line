<?php
/**
 * ПИН-АВТО — Базовый каркас B2B API (api/b2b.php)
 * Шаг 1: Инициализация, конфиг и базовый роутинг
 */

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

header('Content-Type: application/json; charset=utf-8');

// Безопасная загрузка конфигурации STOCRM
function pin_get_cfg(): array {
    static $cfg = null;
    if ($cfg !== null) return $cfg;
    
    $domain = 'pin-avto';
    $apiKey = '';

    foreach ([
        __DIR__ . '/../config/config.json',
        dirname(__DIR__) . '/config/config.json',
        __DIR__ . '/config/config.json',
        __DIR__ . '/../config.json'
    ] as $file) {
        if (file_exists($file) && is_readable($file)) {
            $dec = json_decode(preg_path_fix = preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($file)), true);
            if (is_array($dec)) {
                $apiKey = $dec['api_key'] ?? $dec['apiKey'] ?? $dec['SID'] ?? '';
                $domain = $dec['domain'] ?? $domain;
                if (!empty($apiKey)) break;
            }
        }
    }
    return ['domain' => $domain, 'api_key' => $apiKey];
}

// Универсальный запрос к STOCRM
function pin_b2b_call(string $endpoint, array $payload = [], string $method = 'POST'): array {
    $cfg = pin_get_cfg();
    if (empty($cfg['api_key'])) {
        return ['status' => 'error', 'message' => 'API key not found'];
    }

    $cleanEp = ltrim($endpoint, '/');
    $url = "https://{$cfg['domain']}.stocrm.ru/api/external/v1/" . $cleanEp . "?SID=" . urlencode($cfg['api_key']);
    $payload['SID'] = $cfg['api_key'];

    $ch = curl_init();
    if (strtoupper($method) === 'GET') {
        curl_setopt($ch, CURLOPT_URL, $url . '&' . http_build_query($payload));
        curl_setopt($ch, CURLOPT_HTTPGET, true);
    } else {
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Content-Length: ' . strlen($json)]);
    }

    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);

    $raw = curl_exec($ch);
    curl_close($ch);

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : ['raw' => $raw];
}

try {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?: $_POST;
    $action = $_GET['action'] ?? $input['action'] ?? '';
    
    if (empty($action)) {
        echo json_encode(['status' => 'error', 'message' => 'No action specified']);
        exit;
    }

    // Проверка связи на Шаге 1
    echo json_encode([
        'status'  => 'success',
        'step'    => 1,
        'action'  => $action,
        'message' => 'Каркас api/b2b.php готов к расширению'
    ], JSON_UNESCAPED_UNICODE);

} catch (Throwable $e) {
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}