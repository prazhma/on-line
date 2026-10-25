<?php
header('Content-Type: application/json; charset=utf-8');

$cfg = json_decode(file_get_contents(__DIR__ . '/../config/config.json'), true);
$domain = $cfg['domain'] ?? 'pin-avto';
$apiKey = $cfg['api_key'] ?? '';
$testInn = '2312189806';

// Кандидаты эндпоинтов из документации STOCRM
$endpoints = [
    'customer/get_filtered',
    'customer/get_from_filter',
    'counterparty/get_filtered',
    'counterparties/get_from_filter',
    'contact/get_filtered',
    'contacts/get_from_filter',
    'jur_person/get_filtered',
    'company/get_filtered'
];

$results = [];

foreach ($endpoints as $ep) {
    $url = "https://{$domain}.stocrm.ru/api/external/v1/{$ep}?SID=" . urlencode($apiKey);
    
    // Тест 1: с фильтром SEARCH
    $ch = curl_init($url);
    $payload = json_encode(['FILTER' => ['SEARCH' => $testInn], 'LIMIT' => 1, 'SID' => $apiKey]);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 4,
        CURLOPT_SSL_VERIFYPEER => false
    ]);
    $res = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $dec = json_decode($res, true);
    $results[$ep] = [
        'http_code' => $code,
        'response_code' => $dec['CODE'] ?? null,
        'message' => $dec['MESSAGE'] ?? ($dec['RESPONSE'] ?? 'OK'),
        'has_data' => !empty($dec['RESPONSE']['DATA'])
    ];
}

echo json_encode($results, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);