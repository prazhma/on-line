<?php
/**
 * ПИН-АВТО — Автоматический поиск эндпоинта Юр. Лиц в STOCRM (api/scan_jur_endpoints.php)
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
$inn = '2312189806'; // ИНН ООО "АКЗ"

// Список возможных контроллеров сущности "Юр. лицо / Контрагент" в STOCRM API
$entities = [
    'contractors',
    'contractor',
    'organizations',
    'organization',
    'legal_entities',
    'legal_entity',
    'legal_persons',
    'legal_person',
    'counterparty',
    'counterparties',
    'counteragents',
    'counteragent',
    'companies',
    'company',
    'clients',
    'client',
    'jur',
    'jurs',
    'jur_persons',
    'firms',
    'firm',
    'enterprises'
];

$actions = [
    'get_from_filter',
    'get_filtered',
    'get_all'
];

$success = [];
$tested = 0;

foreach ($entities as $ent) {
    foreach ($actions as $act) {
        $tested++;
        $endpoint = "{$ent}/{$act}";
        $url = "https://{$domain}.stocrm.ru/api/external/v1/{$endpoint}?SID=" . urlencode($apiKey);

        $payload = json_encode([
            'FILTER' => ['SEARCH' => $inn],
            'LIMIT'  => 1,
            'SID'    => $apiKey
        ], JSON_UNESCAPED_UNICODE);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payload,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT        => 3
        ]);
        $raw = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        $dec = json_decode($raw, true);

        // Если метод существует (не 666 Wrong URI)
        if (isset($dec['CODE']) && $dec['CODE'] !== 666) {
            $success[$endpoint] = [
                'http_code'     => $code,
                'response_code' => $dec['CODE'],
                'message'       => $dec['MESSAGE'] ?? null,
                'has_data'      => !empty($dec['RESPONSE']['DATA']) || !empty($dec['RESPONSE']),
                'raw_preview'   => mb_substr((string)$raw, 0, 300)
            ];
        }
    }
}

echo json_encode([
    'target_inn'     => $inn,
    'total_tested'   => $tested,
    'valid_methods'  => $success
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);