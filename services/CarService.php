<?php

require_once __DIR__ . '/StocrmClient.php';

class CarService {
    private $client;

    public function __construct() {
        $this->client = new StocrmClient();
    }

    /**
     * Получение списка автомобилей контакта через подтвержденный эндпоинт STOCRM
     */
    public function getClientCars($contactId) {
        $endpoint = '/api/external/v1/contact/get_cars';

        $params = [
            'CONTACT_ID' => (int)$contactId
        ];

        try {
            $response = $this->client->get($endpoint, $params);

            if (!isset($response['RESPONSE']) || !is_array($response['RESPONSE'])) {
                return [];
            }

            $cars = [];
            foreach ($response['RESPONSE'] as $item) {
                if (!is_array($item)) {
                    continue;
                }

                $brand = $item['BRAND_NAME'] ?? '';
                $model = $item['MODEL_NAME'] ?? '';
                $title = $item['TITLE'] ?? trim("{$brand} {$model}");
                $plate = $item['LICENSE_PLATE'] ?? ($item['LICENSE_PLATE_DIVIDED'] ?? '—');
                $vin = $item['VIN'] ?? '—';
                $year = $item['YEAR'] ?? '—';
                $mileage = !empty($item['MILEAGE']) ? number_format((float)$item['MILEAGE'], 0, '.', ' ') . ' км' : '—';

                $cars[] = [
                    'id' => $item['CAR_PROFILE_ID'] ?? null,
                    'title' => $title,
                    'brand' => $brand,
                    'model' => $model,
                    'plate' => $plate,
                    'vin' => $vin,
                    'year' => $year,
                    'mileage' => $mileage
                ];
            }

            return $cars;
        } catch (Throwable $e) {
            file_put_contents(__DIR__ . '/../stocrm_debug.log', date('Y-m-d H:i:s') . " - [CarService Error]: " . $e->getMessage() . "\n", FILE_APPEND);
            return [];
        }
    }
}