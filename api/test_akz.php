<?php
/**
 * ПИН-АВТО — Диагностика записей организации ООО "АКЗ" (api/test_akz.php)
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
$inn = '2312189806';

$url = "https://{$domain}.stocrm.ru/api/external/v1/contacts/get_from_filter?SID=" . urlencode($apiKey);

$payload = json_encode([
    'FILTER' => ['INN' => $inn],
    'LIMIT'  => 5,
    'SID'    => $apiKey
], JSON_UNESCAPED_UNICODE);

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $payload,
    CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_TIMEOUT        => 8
]);
$raw = curl_exec($ch);
curl_close($ch);

$decoded = json_decode($raw, true);
$data = $decoded['RESPONSE']['DATA'] ?? [];

$detailedRecords = [];
foreach ($data as $idx => $item) {
    $cId = intval($item['CONTACT_ID'] ?? $item['ID'] ?? 0);
    
    // Получаем расширенную информацию по каждому контакту через contact/get_info
    $infoUrl = "https://{$domain}.stocrm.ru/api/external/v1/contact/get_info?CONTACT_ID={$cId}&SID=" . urlencode($apiKey);
    $chInfo = curl_init($infoUrl);
    curl_setopt_array($chInfo, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPGET        => true,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_TIMEOUT        => 8
    ]);
    $rawInfo = curl_exec($chInfo);
    curl_close($chInfo);
    $decInfo = json_decode($rawInfo, true);

    $detailedRecords["record_{$idx}_ID_{$cId}"] = [
        'base_item'     => $item,
        'info_response' => $decInfo['RESPONSE'] ?? null
    ];
}

echo json_encode([
    'target_inn'     => $inn,
    'total_found'    => count($data),
    'records_detail' => $detailedRecords
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);