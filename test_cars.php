<?php

header('Content-Type: text/plain; charset=utf-8');

require_once __DIR__ . '/services/StocrmClient.php';
require_once __DIR__ . '/services/OfferService.php';

$client = new StocrmClient();
$contactId = 33;

echo "=== 1. ПРОВЕРКА ОБНОВЛЕННОГО OfferService ===\n";
$offerService = new OfferService();
$deals = $offerService->getClientOffers($contactId);
echo "OfferService вернул сделок: " . count($deals) . "\n";
if (!empty($deals)) {
    echo "Первая сделка: #" . $deals[0]['id'] . " | " . $deals[0]['date'] . " | " . $deals[0]['branch'] . " | " . $deals[0]['sum'] . " руб.\n\n";
}

echo "=== 2. ТОЧЕЧНЫЙ ТЕСТ РОУТОВ АВТОМОБИЛЕЙ ===\n";

$candidateEndpoints = [
    // Контроллер car_profile (единственное число)
    '/api/external/v1/car_profile/get_from_filter',
    '/api/external/v1/car_profile/get_filtered',
    '/api/external/v1/car_profile/get',
    '/api/external/v1/car_profiles/get_filtered',
    // Контроллер car (единственное число)
    '/api/external/v1/car/get_from_filter',
    '/api/external/v1/car/get_filtered',
    '/api/external/v1/car/get',
    '/api/external/v1/cars/get_filtered',
    // Контроллер auto
    '/api/external/v1/auto/get_from_filter',
    '/api/external/v1/auto/get_filtered',
    '/api/external/v1/autos/get_from_filter',
    // Методы через модуль contacts
    '/api/external/v1/contacts/get_cars',
    '/api/external/v1/contact/get_cars',
    '/api/external/v1/contacts/get_info',
    '/api/external/v1/contact/get_info',
    '/api/external/v1/contact/get'
];

$found = 0;

foreach ($candidateEndpoints as $endpoint) {
    try {
        $res = $client->get($endpoint, [
            'CONTACT_ID' => $contactId,
            'FILTER' => [
                'CONTACT_ID' => $contactId
            ]
        ]);

        $code = $res['CODE'] ?? 200;
        if ($code !== 666) {
            echo "[НАЙДЕН!] {$endpoint} -> CODE: {$code} | Ответ: " . json_encode($res, JSON_UNESCAPED_UNICODE) . "\n";
            $found++;
        }
    } catch (Throwable $e) {
        if (strpos($e->getMessage(), '666') === false && strpos($e->getMessage(), 'Wrong URI') === false) {
            echo "[ОТВЕТ*] {$endpoint} -> " . $e->getMessage() . "\n";
            $found++;
        }
    }
}

echo "\n=== ТЕСТ ЗАВЕРШЕН: Найдено рабочих маршрутов: {$found} ===\n";