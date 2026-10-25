<?php
/**
 * ПИН-АВТО — Диагностика связей юрлица ID 755 (api/check_legal_entity.php)
 */

header('Content-Type: application/json; charset=utf-8');

$cfgCandidates = [
    __DIR__ . '/../config/config.json',
    dirname(__DIR__) . '/config/config.json',
    __DIR__ . '/config/config.json',
    __DIR__ . '/../config.json'
];
$cfg = [];
foreach ($cfgCandidates as $f) {
    if (file_exists($f)) {
        $cfg = json_decode(preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($f)), true) ?: [];
        break;
    }
}

$domain = $cfg['domain'] ?? 'pin-avto';
$apiKey = $cfg['api_key'] ?? '';
$legalEntityId = 755;
$inn = '2312189806';

function call_api($ep, $payload, $method = 'POST') {
    global $domain, $apiKey;
    $url = "https://{$domain}.stocrm.ru/api/external/v1/" . ltrim($ep, '/');
    if (strtoupper($method) === 'GET') {
        $payload['SID'] = $apiKey;
        $url .= '?' . http_build_query($payload);
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPGET => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT => 6
        ]);
    } else {
        $payload['SID'] = $apiKey;
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
        $ch = curl_init($url . "?SID=" . urlencode($apiKey));
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $json,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Content-Length: ' . strlen($json)],
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT => 6
        ]);
    }
    $raw = curl_exec($ch);
    curl_close($ch);
    return json_decode($raw, true);
}

$report = [];

// 1. Полная запись legal_entities/get_from_filter (все поля без усечения)
$report['1_legal_entities_full'] = call_api('legal_entities/get_from_filter', ['FILTER' => ['INN' => $inn], 'LIMIT' => 1]);

// 2. Метод детальной информации legal_entity/get
$report['2_legal_entity_get'] = call_api('legal_entity/get', ['LEGAL_ENTITY_ID' => $legalEntityId], 'GET');

// 3. Поиск контактов/представителей, привязанных к юрлицу
$report['3_contacts_by_legal_entity'] = call_api('contacts/get_from_filter', ['FILTER' => ['LEGAL_ENTITY_ID' => $legalEntityId], 'LIMIT' => 5]);

// 4. Прямой поиск представителя Шляха для выявления ключа привязки к юрлицу
$report['4_search_representative'] = call_api('contacts/get_from_filter', ['FILTER' => ['SEARCH' => 'Шляха'], 'LIMIT' => 1]);

echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);