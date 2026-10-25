<?php
/**
 * ПИН-АВТО — Универсальный шлюз DaData API (api/dadata.php)
 * Автозаполнение организаций по ИНН/ОГРН и банков по БИК
 */

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST' && $_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Недопустимый метод запроса'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$type = trim($_REQUEST['type'] ?? 'party'); // 'party' или 'bank'
$query = trim($_REQUEST['query'] ?? $_REQUEST['inn'] ?? $_REQUEST['bik'] ?? '');
$queryClean = preg_replace('/[^\d\/]/', '', $query);

if (empty($queryClean)) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Не передан поисковый запрос (ИНН, ОГРН или БИК)'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$apiKey = '531d8974b686e770a9954bbc53bcd64132e7ec2d';

// Выбор конечной точки DaData
if ($type === 'bank' || (strlen($queryClean) === 9 && !isset($_REQUEST['inn']))) {
    $url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/bank';
} else {
    $url = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/findById/party';
}

$payload = [
    'query' => $queryClean,
    'count' => 1
];

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'Accept: application/json',
    'Authorization: Token ' . $apiKey
]);
curl_setopt($ch, CURLOPT_TIMEOUT, 8);

$responseRaw = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    echo json_encode([
        'status'  => 'error',
        'message' => 'Ошибка cURL: ' . $curlError
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($httpCode !== 200) {
    echo json_encode([
        'status'  => 'error',
        'message' => "Сервис DaData вернул код {$httpCode}"
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$responseData = json_decode($responseRaw, true);
$suggestions = $responseData['suggestions'] ?? [];

if (empty($suggestions)) {
    echo json_encode([
        'status'  => 'not_found',
        'message' => 'Данные по указанному запросу не найдены'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$item = $suggestions[0];
$data = $item['data'] ?? [];

// -------------------------------------------------------------
// А. Обработка банковского запроса (БИК)
// -------------------------------------------------------------
if ($type === 'bank' || (strlen($queryClean) === 9 && !isset($_REQUEST['inn']))) {
    $bankName = $data['name']['payment'] ?? $data['name']['short'] ?? $item['value'] ?? '';
    $corrAccount = $data['correspondent_account'] ?? '';

    echo json_encode([
        'status'    => 'success',
        'type'      => 'bank',
        'bik'       => $data['bic'] ?? $queryClean,
        'bank_name' => $bankName,
        'ks'        => $corrAccount,
        'city'      => $data['address']['data']['city_with_type'] ?? ''
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// -------------------------------------------------------------
// Б. Обработка организации (ЕГРЮЛ / ЕГРИП)
// -------------------------------------------------------------
$directorName = '';
if (!empty($data['management']['name'])) {
    $directorName = $data['management']['name'];
    if (!empty($data['management']['post'])) {
        $directorName = $data['management']['post'] . ' ' . $directorName;
    }
} elseif (!empty($data['fio'])) {
    $directorName = trim(
        ($data['fio']['surname'] ?? '') . ' ' .
        ($data['fio']['name'] ?? '') . ' ' .
        ($data['fio']['patronymic'] ?? '')
    );
}

// Статус организации
$stateMap = [
    'ACTIVE'       => 'Действующая организация',
    'LIQUIDATING'  => 'В процессе ликвидации',
    'LIQUIDATED'   => 'Ликвидирована',
    'BANKRUPT'     => 'Банкротство',
    'REORGANIZING' => 'В процессе реорганизации'
];
$statusCode = $data['state']['status'] ?? 'ACTIVE';
$statusText = $stateMap[$statusCode] ?? $statusCode;

// Дата регистрации и ОГРН
$regDate = '';
if (!empty($data['state']['registration_date'])) {
    $regDate = date('d.m.Y', intval($data['state']['registration_date'] / 1000));
}
$ogrnDate = '';
if (!empty($data['ogrn_date'])) {
    $ogrnDate = date('d.m.Y', intval($data['ogrn_date'] / 1000));
}

// Телефоны и Email из ЕГРЮЛ
$phone = '';
if (!empty($data['phones']) && is_array($data['phones']) && !empty($data['phones'][0]['data']['source'])) {
    $phone = $data['phones'][0]['data']['source'];
}
$email = '';
if (!empty($data['emails']) && is_array($data['emails']) && !empty($data['emails'][0]['data']['source'])) {
    $email = $data['emails'][0]['data']['source'];
}

$result = [
    'status'            => 'success',
    'type'              => 'party',
    'org_type'          => $data['type'] ?? 'LEGAL',
    'name_full'         => $data['name']['full_with_opf'] ?? $item['value'] ?? '',
    'name_short'        => $data['name']['short_with_opf'] ?? $data['name']['short'] ?? $item['value'] ?? '',
    'inn'               => $data['inn'] ?? '',
    'kpp'               => $data['kpp'] ?? '',
    'ogrn'              => $data['ogrn'] ?? '',
    'ogrn_date'         => $ogrnDate,
    'director'          => $directorName,
    'legal_address'     => $data['address']['value'] ?? $data['address']['unrestricted_value'] ?? '',
    'postal_code'       => $data['address']['data']['postal_code'] ?? '',
    'okpo'              => $data['okpo'] ?? '',
    'okved'             => $data['okved'] ?? '',
    'state_status'      => $statusCode,
    'state_status_text' => $statusText,
    'registration_date' => $regDate,
    'phone'             => $phone,
    'email'             => $email
];

echo json_encode($result, JSON_UNESCAPED_UNICODE);