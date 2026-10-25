<?php
error_reporting(0);
ini_set('display_errors', 0);
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// =========================================================================
// 1. НАСТРОЙКИ ДОСТУПА ROSSKO API v2.1
// =========================================================================
define('ROSSKO_KEY1', '1cb16a83b91da1be7e815d9429680078');  
define('ROSSKO_KEY2', '8e1fdd5094a09cc0769e9aa34fa5bcf1');  

// Обязательные параметры для GetSearch (согласно обновлению 03.06.2020)
// Эти ID нужно получить разово через метод GetCheckoutDetails или GetSettlements
define('ROSSKO_ADDRESS_ID', '00000'); 
define('ROSSKO_DELIVERY_ID', '00000'); 

// =========================================================================
// 2. КЛАСС ДЛЯ РАБОТЫ С ROSSKO SOAP API
// =========================================================================
class RosskoAPI {
    private $key1;
    private $key2;
    private $wsdl_search = 'https://api.rossko.ru/service/v2.1/GetSearch?wsdl';

    public function __construct($key1, $key2) {
        $this->key1 = $key1;
        $this->key2 = $key2;
    }

    /**
     * Поиск детали по артикулу
     */
    public function searchByArticle($article) {
        try {
            $client = new SoapClient($this->wsdl_search, [
                'trace' => 1,
                'exceptions' => 1,
                'connection_timeout' => 10
            ]);

            $params = [
                'KEY1' => $this->key1,
                'KEY2' => $this->key2,
                'text' => $article,
                'delivery_id' => ROSSKO_DELIVERY_ID,
                'address_id'  => ROSSKO_ADDRESS_ID
            ];

            $result = $client->GetSearch($params);

            if (isset($result->SearchResult->success) && $result->SearchResult->success) {
                return $result->SearchResult->PartsList->Part ?? [];
            } else {
                return ['error' => true, 'message' => $result->SearchResult->message ?? 'Неизвестная ошибка API'];
            }
        } catch (SoapFault $e) {
            return ['error' => true, 'message' => 'Ошибка связи с Rossko: ' . $e->getMessage()];
        }
    }
}

// =========================================================================
// 3. ОБРАБОТКА ВХОДЯЩЕГО ЗАПРОСА ИЗ КАБИНЕТА
// =========================================================================
$action = $_GET['action'] ?? '';
$vin    = $_GET['vin'] ?? '';
$brand  = $_GET['brand'] ?? '';

if ($action !== 'get_battery') {
    echo json_encode(['status' => 'error', 'message' => 'Неверный метод запроса']);
    exit;
}

if (empty($vin)) {
    echo json_encode(['status' => 'error', 'message' => 'Не передан VIN автомобиля']);
    exit;
}

// -------------------------------------------------------------------------
// ШАГ 1: Маппинг VIN -> Артикулы АКБ
// (Здесь в будущем подключается TecDoc или локальная база STOCRM)
// Пока делаем симуляцию: для любого запроса ищем ходовые АКБ (например, 60Ah обратной полярности)
// -------------------------------------------------------------------------
$targetArticles = [
    '560408054', // VARTA Blue Dynamic (60 Ah)
    'SFB3',      // MUTLU (Пример)
    '0092S40050' // BOSCH S4 (60 Ah)
];

// Вспомогательные данные для красивого вывода в кабинете
$carSpecs = [
    'capacity' => '60-65 А·ч',
    'polarity' => 'Обратная [- +]',
    'cca'      => 'от 540 А'
];

// -------------------------------------------------------------------------
// ШАГ 2: Опрос API Rossko
// -------------------------------------------------------------------------
$rossko = new RosskoAPI(ROSSKO_KEY1, ROSSKO_KEY2);
$finalProducts = [];

foreach ($targetArticles as $article) {
    // В боевом режиме раскомментируйте вызов $rossko->searchByArticle($article);
    // Сейчас, чтобы код не упал из-за пустых ключей, формируем мок-ответ в формате Rossko
    
    /* 
    $apiResult = $rossko->searchByArticle($article);
    if (!isset($apiResult['error']) && !empty($apiResult)) {
        // Парсинг реального ответа (зависит от структуры PartsList->Part)
        // ...
    }
    */

    // Мок-данные, имитирующие успешный ответ распарсенного Rossko API
    if ($article === '560408054') {
        $finalProducts[] = [
            'brand'    => 'VARTA',
            'article'  => '560408054',
            'title'    => 'Blue Dynamic D59 (60 А·ч)',
            'price'    => 8200,
            'stock'    => 4,
            'delivery' => 'В наличии (Краснодар)',
            'params'   => [
                'Емкость'      => '60 А·ч',
                'Пусковой ток' => '540 А',
                'Полярность'   => 'Обратная'
            ]
        ];
    } elseif ($article === '0092S40050') {
        $finalProducts[] = [
            'brand'    => 'BOSCH',
            'article'  => '0092S40050',
            'title'    => 'S4 Silver (60 А·ч)',
            'price'    => 9150,
            'stock'    => 2,
            'delivery' => 'Завтра 14:00',
            'params'   => [
                'Емкость'      => '60 А·ч',
                'Пусковой ток' => '540 А',
                'Полярность'   => 'Обратная'
            ]
        ];
    }
}

// -------------------------------------------------------------------------
// ШАГ 3: Возврат ответа на фронтенд
// -------------------------------------------------------------------------
echo json_encode([
    'status'  => 'success',
    'car_vin' => $vin,
    'specs'   => $carSpecs,
    'items'   => $finalProducts
], JSON_UNESCAPED_UNICODE);
exit;