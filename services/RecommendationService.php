<?php

require_once __DIR__ . '/StocrmClient.php';

class RecommendationService {
    private $client;

    public function __construct() {
        $this->client = new StocrmClient();
    }

    /**
     * Получение рекомендаций с предварительной загрузкой автомобилей клиента по вики STOCRM
     */
    public function getClientRecommendations($clientId) {
        $contactId = (int)$clientId;
        if ($contactId <= 0) {
            return [];
        }

        try {
            // Шаг 1. Получаем список автомобилей клиента через /api/external/v1/car_profile/get_filtered_profiles
            $carsRes = $this->client->post('/api/external/v1/car_profile/get_filtered_profiles', [
                'FILTER' => [
                    'CONTACT_ID' => $contactId
                ],
                'LIMIT' => 100
            ]);

            $carItems = $carsRes['RESPONSE']['DATA'] ?? $carsRes['DATA'] ?? $carsRes['RESPONSE'] ?? [];
            $carIds = [];
            $carsMap = [];

            if (is_array($carItems)) {
                foreach ($carItems as $car) {
                    $cId = (int)($car['CAR_PROFILE_ID'] ?? 0);
                    if ($cId > 0) {
                        $carIds[] = $cId;

                        $brand = $car['BRAND_NAME'] ?? '';
                        $model = $car['MODEL_NAME'] ?? '';
                        $plate = $car['LICENSE_PLATE'] ?? $car['LICENSE_PLATE_NUMBER'] ?? '';

                        $carDesc = trim("{$brand} {$model}");
                        if (empty($carDesc)) {
                            $carDesc = $car['TITLE'] ?? 'Автомобиль';
                        }
                        if (!empty($plate)) {
                            $carDesc .= " (Госномер: {$plate})";
                        }

                        $carsMap[$cId] = [
                            'title' => $carDesc,
                            'vin' => $car['VIN'] ?? ''
                        ];
                    }
                }
            }

            // Если у клиента нет автомобилей в профиле, возвращаем пустоту
            if (empty($carIds)) {
                return [];
            }

            // Шаг 2. Получаем список рекомендаций по полученным ID автомобилей
            $res = $this->client->post('/api/external/v1/recommendations/get_filtered', [
                'FILTER' => [
                    'CAR_PROFILE_ID' => $carIds
                ],
                'SORT' => [
                    'DATE_CREATE' => 'DESC'
                ],
                'PAGE' => 1,
                'LIMIT' => 100
            ]);

            $rawItems = $res['RESPONSE']['DATA'] ?? $res['DATA'] ?? $res['RESPONSE'] ?? [];
            $grouped = [];

            if (is_array($rawItems)) {
                foreach ($rawItems as $item) {
                    if (is_array($item)) {
                        $offerId = !empty($item['OFFER_ID']) ? (int)$item['OFFER_ID'] : 0;
                        $carProfileId = (int)($item['CAR_PROFILE_ID'] ?? 0);
                        
                        // Получаем данные автомобиля из нашей карты
                        $carInfo = $carsMap[$carProfileId] ?? ['title' => $item['CAR_TITLE'] ?? 'Автомобиль', 'vin' => ''];
                        $carTitle = $carInfo['title'];

                        $key = $offerId > 0 ? "offer_{$offerId}" : "car_{$carProfileId}";

                        if (!isset($grouped[$key])) {
                            $grouped[$key] = [
                                'offer_id' => $offerId > 0 ? $offerId : null,
                                'car_title' => $carTitle,
                                'mileage' => $item['OFFER_MILEAGE'] ?? 0,
                                'date_create' => $item['DATE_CREATE'] ?? '',
                                'items' => []
                            ];
                        }

                        $type = $item['TYPE'] ?? 'WORK';
                        $title = ($type === 'WORK') 
                            ? ($item['WORK_TITLE_SIMPLE'] ?? 'Рекомендация по работе') 
                            : ($item['REQUIRE_TITLE'] ?? 'Рекомендация по запчасти');

                        $grouped[$key]['items'][] = [
                            'id' => $item['RECOMMENDATION_ID'] ?? null,
                            'type' => $type,
                            'title' => $title,
                            'detail' => $item['REQUIRE_BRAND_AND_SKU'] ?? '',
                            'state' => $item['STATE'] ?? 'U',
                            'sum' => $item['SUM'] ?? '0.00',
                            'date_create' => $item['DATE_CREATE'] ?? ''
                        ];
                    }
                }
            }

            return array_values($grouped);
        } catch (Throwable $e) {
            file_put_contents(
                __DIR__ . '/../stocrm_debug.log',
                date('Y-m-d H:i:s') . " - [RecommendationService Error]: " . $e->getMessage() . "\n",
                FILE_APPEND
            );
            return [];
        }
    }
}