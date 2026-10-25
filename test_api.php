<?php

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/services/StocrmClient.php';

$client = new StocrmClient();
$contactId = 33;

echo "=== 1. ПРОВЕРКА СДЕЛОК ДЛЯ CONTACT_ID: {$contactId} ===\n";

try {
    $offerRes = $client->get('/api/external/v1/offers/get_from_filter', [
        'FILTER' => [
            'CONTACT_ID' => $contactId
        ]
    ]);
    echo "Ответ по сделкам:\n" . json_encode($offerRes, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n\n";
} catch (Throwable $e) {
    echo "Ошибка по сделкам: " . $e->getMessage() . "\n\n";
}

echo "=== 2. СКАНИРОВАНИЕ РОУТОВ ДЛЯ АВТОМОБИЛЕЙ ===\n";

$carModules = [
    'auto',
    'autos',
    'vehicle',
    'vehicles',
    'transport',
    'car',
    'cars',
    'contact_car',
    'contact_cars',
    'customer_car',
    'customer_cars',
    'client_car',
    'client_cars'
];

$carActions = [
    'get_from_filter',
    'get_filtered',
    'get_all',
    'all',
    'list',
    'get_list',
    'get',
    'search',
    'find'
];

$extraEndpoints = [
    '/api/external/v1/contacts/get_cars',
    '/api/external/v1/contact/get_cars',
    '/api/external/v1/contacts/cars',
    '/api/external/v1/contact/cars',
    '/api/external/v1/contacts/get_info',
    '/api/external/v1/contact/get_info'
];

$foundCars = 0;

foreach ($carModules as $mod) {
    foreach ($carActions as $act) {
        $endpoint = "/api/external/v1/{$mod}/{$act}";
        try {
            $res = $client->get($endpoint, [
                'FILTER' => [
                    'CONTACT_ID' => $contactId
                ]
            ]);
            $code = $res['CODE'] ?? 200;
            if ($code !== 666) {
                echo "[FOUND!] {$endpoint} -> CODE: {$code} | Ответ: " . json_encode($res, JSON_UNESCAPED_UNICODE) . "\n";
                $foundCars++;
            }
        } catch (Throwable $e) {
            if (strpos($e->getMessage(), '666') === false && strpos($e->getMessage(), 'Wrong URI') === false) {
                echo "[FOUND!*] {$endpoint} -> " . $e->getMessage() . "\n";
                $foundCars++;
            }
        }
    }
}

foreach ($extraEndpoints as $endpoint) {
    try {
        $res = $client->get($endpoint, [
            'CONTACT_ID' => $contactId,
            'FILTER' => [
                'CONTACT_ID' => $contactId
            ]
        ]);
        $code = $res['CODE'] ?? 200;
        if ($code !== 666) {
            echo "[FOUND! EXTRA] {$endpoint} -> CODE: {$code} | Ответ: " . json_encode($res, JSON_UNESCAPED_UNICODE) . "\n";
            $foundCars++;
        }
    } catch (Throwable $e) {
        if (strpos($e->getMessage(), '666') === false && strpos($e->getMessage(), 'Wrong URI') === false) {
            echo "[FOUND! EXTRA*] {$endpoint} -> " . $e->getMessage() . "\n";
            $foundCars++;
        }
    }
}

echo "\n=== ТЕСТ ЗАВЕРШЕН: Найдено маршрутов авто: {$foundCars} ===\n";