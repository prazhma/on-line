<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
date_default_timezone_set('Europe/Moscow');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Неверный метод запроса');
    }

    // Динамический поиск файлов
    function findProjectFile(string $relPath): ?string {
        $cleanPath = ltrim($relPath, '/\\');
        $dir = __DIR__;

        for ($i = 0; $i < 5; $i++) {
            $candidates = [
                $dir . '/' . $cleanPath,
                $dir . '/config/' . $cleanPath
            ];
            foreach ($candidates as $filePath) {
                if (file_exists($filePath) && is_readable($filePath)) {
                    return $filePath;
                }
            }
            $parent = dirname($dir);
            if ($parent === $dir) break;
            $dir = $parent;
        }

        if (!empty($_SERVER['DOCUMENT_ROOT'])) {
            $docRoot = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\');
            if (file_exists($docRoot . '/' . $cleanPath)) return $docRoot . '/' . $cleanPath;
            if (file_exists($docRoot . '/config/' . $cleanPath)) return $docRoot . '/config/' . $cleanPath;
        }

        return null;
    }

    $config_file = findProjectFile('config.json');
    if (!$config_file) {
        throw new Exception('Файл конфигурации не найден');
    }

    $config = json_decode(@file_get_contents($config_file), true);
    $api_key = $config['api_key'] ?? '';
    $domain  = $config['domain'] ?? 'pin-avto';

    if (empty($api_key)) {
        throw new Exception('Ключ API пуст');
    }

    $customer_id   = intval($_POST['customer_id'] ?? 0);
    $post_id       = intval($_POST['post_id'] ?? 0);
    $date          = trim((string)($_POST['date'] ?? ''));
    $time          = trim((string)($_POST['time'] ?? ''));
    $client_name   = trim((string)($_POST['name'] ?? ''));
    $client_phone  = trim((string)($_POST['phone'] ?? ''));
    $car_brand     = trim((string)($_POST['car_brand'] ?? ''));
    $car_plate     = trim((string)($_POST['car_plate'] ?? ''));
    $duration_mins = intval($_POST['duration'] ?? 60);

    // Принимаем выбранные услуги
    $services_json = $_POST['services_json'] ?? '[]';
    $services_array = json_decode($services_json, true);
    
    $works_payload_arr = [];
    $works_text_arr = [];
    $total_price = 0;

    if (is_array($services_array) && count($services_array) > 0) {
        foreach ($services_array as $svc) {
            $svc_name = mb_strlen($svc['name']) < 3 ? 'Услуга СТО: ' . $svc['name'] : $svc['name'];
            $svc_price = floatval($svc['price']);
            $svc_working_hours = round(intval($svc['duration']) / 60, 2);
            if ($svc_working_hours <= 0) $svc_working_hours = 1;
            
            $svc_price_of_hour = round($svc_price / $svc_working_hours, 2);

            $works_payload_arr[] = [
                "TYPE"          => "FREE_FORM",
                "DESCRIPTION"   => $svc_name,
                "WORKING_HOUR"  => $svc_working_hours,
                "PRICE_OF_HOUR" => $svc_price_of_hour
            ];

            $works_text_arr[] = $svc_name . ' (' . $svc_price . ' ₽)';
            $total_price += $svc_price;
        }
    } else {
        $works_payload_arr[] = [
            "TYPE"          => "FREE_FORM",
            "DESCRIPTION"   => "Обслуживание автомобиля",
            "WORKING_HOUR"  => 1,
            "PRICE_OF_HOUR" => 1000
        ];
        $works_text_arr[] = 'Обслуживание автомобиля';
        $total_price = 1000;
    }
    
    $client_work_full_text = implode(', ', $works_text_arr);

    if (!$customer_id || !$post_id || empty($date) || empty($time) || empty($client_phone)) {
        throw new Exception("Заполнены не все обязательные поля");
    }

    $branch = $config['branches'][$customer_id] ?? null;
    $post_title = $branch['posts'][$post_id]['NAME'] ?? 'Пост';
    $branch_name = $branch['CUSTOMER_NAME'] ?? 'Филиал';
    $board_id = intval($branch['board_id'] ?? 2);

    $car_info = "Авто: " . ($car_brand !== '' ? $car_brand : 'Не указана');
    if ($car_plate !== '') $car_info .= " (Гос. номер: {$car_plate})";

    function sendStoCrmRequest($url, $payload) {
        $ch = curl_init($url);
        $json_payload = json_encode($payload, JSON_UNESCAPED_UNICODE);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json_payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json', 'Content-Length: ' . strlen($json_payload)]);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        $result = curl_exec($ch);
        if ($result === false) {
            $error = curl_error($ch);
            curl_close($ch);
            return ['CODE' => 500, 'MESSAGE' => 'cURL Error: ' . $error];
        }
        curl_close($ch);
        return json_decode($result, true) ?? ['CODE' => 500, 'MESSAGE' => 'Неверный ответ от API', 'RAW' => $result];
    }

    $timestamp_start = strtotime("{$date} {$time}:00");
    $timestamp_end   = $timestamp_start + ($duration_mins * 60);
    $phone_digits    = preg_replace('/[^0-9]/', '', $client_phone);

    // Создание сделки с работами
    $offer_url = "https://{$domain}.stocrm.ru/api/external/v1/offer/new/with_contact";
    $offer_payload = [
        "SID"         => $api_key,
        "PHONE"       => $phone_digits,
        "CUSTOMER_ID" => $customer_id,
        "BOARD_ID"    => $board_id,
        "TITLE"       => $client_name . ($car_brand !== '' ? " ({$car_brand})" : ''),
        "COMMENT"     => "Онлайн-запись: {$branch_name} | Пост: {$post_title} | {$car_info} | Работы: {$client_work_full_text} | Итог: {$total_price} ₽",
        "WORKS"       => $works_payload_arr
    ];
    if (!empty($config['source_id'])) {
        $offer_payload["SOURCE_ID"] = intval($config['source_id']);
    }

    $offer_resp = sendStoCrmRequest($offer_url, $offer_payload);
    
    $offer_id = null;
    if (isset($offer_resp['RESPONSE'])) {
        if (!is_array($offer_resp['RESPONSE'])) {
            $offer_id = $offer_resp['RESPONSE'];
        } elseif (isset($offer_resp['RESPONSE']['OFFER_ID'])) {
            $offer_id = $offer_resp['RESPONSE']['OFFER_ID'];
        }
    }

    if (!$offer_id) {
        throw new Exception("Ошибка создания сделки: " . ($offer_resp['MESSAGE'] ?? json_encode($offer_resp, JSON_UNESCAPED_UNICODE)));
    }

    // Создание бронирования в календаре
    $calendar_url = "https://{$domain}.stocrm.ru/api/external/v1/calendar/card/new";
    $calendar_payload = [
        "SID"         => $api_key,
        "CUSTOMER_ID" => $customer_id,
        "POST_ID"     => $post_id,
        "DATE_FROM"   => $timestamp_start,
        "DATE_TO"     => $timestamp_end,
        "OFFER_ID"    => intval($offer_id),
        "COMMENT"     => "Онлайн-запись | Клиент: {$client_name} ({$client_phone}) | {$car_info} | Работы: {$client_work_full_text}"
    ];
    $calendar_resp = sendStoCrmRequest($calendar_url, $calendar_payload);
    
    if (isset($calendar_resp['CODE']) && $calendar_resp['CODE'] != 200 && $calendar_resp['CODE'] !== 0) {
        throw new Exception("Ошибка календаря: " . ($calendar_resp['MESSAGE'] ?? json_encode($calendar_resp, JSON_UNESCAPED_UNICODE)));
    }

    echo json_encode(['status' => 'success', 'message' => 'Успешно! Ваша заявка создана.', 'offer_id' => $offer_id]);

} catch (Throwable $e) {
    echo json_encode(['status' => 'error', 'message' => 'PHP Ошибка: ' . $e->getMessage()]);
}