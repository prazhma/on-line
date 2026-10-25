<?php
error_reporting(E_ALL);
ini_set('display_errors', 0);
date_default_timezone_set('Europe/Moscow');
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

// Безопасная функция извлечения строк
function getStrmVal($arr, $keys) {
    if (!is_array($arr)) return '';
    foreach ($keys as $k) {
        if (isset($arr[$k])) {
            if (is_scalar($arr[$k]) && trim((string)$arr[$k]) !== '') {
                return trim((string)$arr[$k]);
            } elseif (is_array($arr[$k]) && isset($arr[$k]['VALUE']) && is_scalar($arr[$k]['VALUE']) && trim((string)$arr[$k]['VALUE']) !== '') {
                return trim((string)$arr[$k]['VALUE']);
            }
        }
    }
    return '';
}

// Форматирование телефона из 7918... в +7 (918)...
function formatPhoneStocrm($phone) {
    $clean = preg_replace('/\D/', '', $phone);
    if (strlen($clean) === 11 && ($clean[0] === '7' || $clean[0] === '8')) {
        return '+7 (' . substr($clean, 1, 3) . ') ' . substr($clean, 4, 3) . '-' . substr($clean, 7, 2) . '-' . substr($clean, 9, 2);
    }
    return $phone;
}

try {
    require_once __DIR__ . '/../services/StocrmClient.php';

    $action = $_GET['action'] ?? 'get_branches';

    if ($action === 'get_branches') {
        $client = new StocrmClient();
        $config_paths = ['/volume1/web/config/config.json', __DIR__ . '/../config/config.json'];
        $config = [];
        foreach ($config_paths as $path) {
            if (file_exists($path)) {
                $config = json_decode(preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($path)), true) ?? [];
                break;
            }
        }
        $branches = $config['branches'] ?? [];
        if (empty($branches)) {
            $res = $client->post('api/external/v1/customer/get_filtered', []);
            $branches = $res['RESPONSE']['DATA'] ?? $res['RESPONSE'] ?? [];
        }
        echo json_encode(['status' => 'success', 'branches' => $branches, 'config' => $config], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $client = new StocrmClient();
    
    if ($action === 'events') {
        $customer_id = intval($_GET['customer_id'] ?? 0);
        $start_date  = $_GET['start'] ?? date('Y-m-d');
        $end_date    = $_GET['end'] ?? date('Y-m-d');

        $events = [];
        $current = strtotime($start_date);
        $end_ts = strtotime($end_date);

        while ($current <= $end_ts) {
            $day_timestamp = strtotime(date('Y-m-d', $current));
            
            $res = $client->post('api/external/v1/calendar/card/get', [
                "CUSTOMER_ID" => $customer_id,
                "DATE"        => $day_timestamp
            ]);
            $cards = $res['RESPONSE']['DATA'] ?? $res['RESPONSE'] ?? [];

            $offerIds = []; $contactIds = []; $carIds = []; $reservationCardIds = [];

            foreach ($cards as $card) {
                if (!is_array($card)) continue;
                if (getStrmVal($card, ['DEACTIVATE']) === 'Y') continue;
                
                $oId = intval(getStrmVal($card, ['OFFER_ID', 'DEAL_ID']));
                $cardId = getStrmVal($card, ['CARD_ID', 'ID']);
                
                if ($oId > 0) $offerIds[$oId] = $oId;
                else if ($cardId) $reservationCardIds[] = $cardId; 
                
                $cId = intval($card['CLIENT_PROFILE']['CONTACT_ID'] ?? getStrmVal($card, ['CONTACT_ID', 'CLIENT_ID']));
                $carId = intval($card['CAR_PROFILE']['ID'] ?? getStrmVal($card, ['CAR_PROFILE_ID', 'CAR_ID']));
                if ($cId > 0) $contactIds[$cId] = $cId;
                if ($carId > 0) $carIds[$carId] = $carId;
            }

            // Пакетная загрузка резервов
            $reservationsData = [];
            foreach ($reservationCardIds as $cid) {
                $r = $client->post('api/external/v1/calendar/post/get_filtered', ['FILTER' => ['CARD_ID' => $cid], 'LIMIT' => 1]);
                $item = $r['RESPONSE']['DATA'][0] ?? $r['RESPONSE'][0] ?? $r['DATA'][0] ?? $r[0] ?? null;
                if (!$item) {
                    $r = $client->post('api/external/v1/calendar/post/get_filtered', ['FILTER' => ['ID' => $cid], 'LIMIT' => 1]);
                    $item = $r['RESPONSE']['DATA'][0] ?? $r['RESPONSE'][0] ?? $r['DATA'][0] ?? $r[0] ?? null;
                }
                if ($item) $reservationsData[$cid] = $item;
            }

            // Пакетная загрузка сделок и справочников
            $offersData = []; $worksData = []; $contactsData = []; $carsData = [];
            
            if (!empty($offerIds)) {
                $oRes = $client->post('api/external/v1/offers/get_from_filter', ['FILTER' => ['ID' => array_values($offerIds)]]);
                foreach ($oRes['RESPONSE']['DATA'] ?? $oRes['RESPONSE'] ?? [] as $o) {
                    if (is_array($o)) {
                        $offersData[intval(getStrmVal($o, ['ID', 'OFFER_ID']))] = $o;
                        if ($cid = intval(getStrmVal($o, ['CONTACT_ID', 'CLIENT_ID']))) $contactIds[$cid] = $cid;
                        if ($carid = intval(getStrmVal($o, ['CAR_PROFILE_ID', 'CAR_ID']))) $carIds[$carid] = $carid;
                    }
                }
                $wRes = $client->post('api/external/v1/work/get_filtered', ['FILTER' => ['OFFER_ID' => array_values($offerIds)]]);
                foreach ($wRes['RESPONSE']['DATA'] ?? $wRes['RESPONSE'] ?? [] as $w) {
                    if (is_array($w)) {
                        $wid = intval(getStrmVal($w, ['OFFER_ID']));
                        if (!isset($worksData[$wid])) $worksData[$wid] = [];
                        $worksData[$wid][] = $w;
                    }
                }
            }
            if (!empty($contactIds)) {
                $cRes = $client->post('api/external/v1/contacts/get_from_filter', ['FILTER' => ['ID' => array_values($contactIds)]]);
                foreach ($cRes['RESPONSE']['DATA'] ?? $cRes['RESPONSE'] ?? [] as $c) {
                    if (is_array($c)) $contactsData[intval(getStrmVal($c, ['ID', 'CONTACT_ID']))] = $c;
                }
            }
            if (!empty($carIds)) {
                $carRes = $client->post('api/external/v1/car_profile/get_filtered', ['FILTER' => ['ID' => array_values($carIds)]]);
                foreach ($carRes['RESPONSE']['DATA'] ?? $carRes['RESPONSE'] ?? [] as $c) {
                    if (is_array($c)) $carsData[intval(getStrmVal($c, ['ID', 'CAR_PROFILE_ID']))] = $c;
                }
            }

            foreach ($cards as $card) {
                if (!is_array($card)) continue;
                if (getStrmVal($card, ['DEACTIVATE']) === 'Y') continue;
                
                $cardPostId = intval(getStrmVal($card, ['POST_ID']));
                $offerId    = intval(getStrmVal($card, ['OFFER_ID']));
                $cardId     = getStrmVal($card, ['CARD_ID', 'ID']) ?: uniqid();
                
                $offer   = $offersData[$offerId] ?? [];
                $resData = $reservationsData[$cardId] ?? [];
                
                // === РАСПАКОВКА JSON ИЗ COMMENT (ГЛАВНЫЙ ФИКС ДЛЯ РЕЗЕРВОВ) ===
                $cardComment = $card['COMMENT'] ?? null;
                $resComment = $resData['COMMENT'] ?? null;
                
                $jsonObj = [];
                if (is_array($cardComment)) $jsonObj = $cardComment;
                elseif (is_array($resComment)) $jsonObj = $resComment;
                elseif (is_string($cardComment) && strpos(trim($cardComment), '{') === 0) {
                    $dec = json_decode($cardComment, true);
                    if (is_array($dec)) $jsonObj = $dec;
                }
                
                $jsonFullName = trim((string)($jsonObj['fullName'] ?? ''));
                $jsonPhone    = trim((string)($jsonObj['phoneNumber'] ?? ''));
                $jsonBrand    = trim((string)($jsonObj['brandAuto'] ?? ''));
                $jsonText     = trim((string)($jsonObj['comment'] ?? ''));

                // --- СБОР ТЕКСТОВЫХ КОММЕНТАРИЕВ ---
                $commentsArr = [];
                if ($jsonText) $commentsArr[] = $jsonText;
                if (is_string($resComment) && strpos(trim($resComment), '{') !== 0) $commentsArr[] = $resComment;
                if (is_string($cardComment) && strpos(trim($cardComment), '{') !== 0) $commentsArr[] = $cardComment;
                if ($cText = getStrmVal($resData, ['OFFER_REASON', 'DESCRIPTION', 'REASON'])) $commentsArr[] = $cText;
                if ($cText = getStrmVal($card, ['OFFER_REASON', 'DESCRIPTION', 'REASON'])) $commentsArr[] = $cText;
                if ($cText = getStrmVal($offer, ['COMMENT', 'OFFER_REASON', 'DESCRIPTION'])) $commentsArr[] = $cText;
                if (!empty($card['OFFER_INFO']['OFFER_DATA']['COMMENT'])) $commentsArr[] = trim((string)$card['OFFER_INFO']['OFFER_DATA']['COMMENT']);
                if (!empty($card['OFFER_INFO']['OFFER_DATA']['REASON'])) $commentsArr[] = trim((string)$card['OFFER_INFO']['OFFER_DATA']['REASON']);

                $rawCommentStr = implode(" | ", array_unique(array_filter($commentsArr)));
                $cleanComment = trim(strip_tags(str_replace(['<br>', '<br/>', '<br />', "\n", "\r"], " ", $rawCommentStr)));

                // Цвет
                $cardColor = '#fef08a'; 
                if (!$offerId) $cardColor = '#e2e8f0'; 
                if (!empty($card['OFFER_INFO']['OFFER_DATA']['CARD_COLOR'])) $cardColor = $card['OFFER_INFO']['OFFER_DATA']['CARD_COLOR'];
                elseif (!empty($offer['CARD_COLOR'])) $cardColor = $offer['CARD_COLOR'];

                // --- КЛИЕНТ И ТЕЛЕФОН ---
                $cp = $card['CLIENT_PROFILE'] ?? [];
                $contactId = intval($cp['CONTACT_ID'] ?? getStrmVal($card, ['CONTACT_ID'])) ?: intval(getStrmVal($offer, ['CONTACT_ID']));
                $contact = $contactsData[$contactId] ?? [];
                
                // Приоритет: JSON из COMMENT -> Резерв -> Карточка -> Сделка -> Профиль
                $contactTitle = getStrmVal($resData, ['CONTACT_TITLE']) ?: getStrmVal($card, ['CONTACT_TITLE', 'CONTACT_NAME', 'CLIENT_NAME']) ?: getStrmVal($offer, ['CONTACT_NAME', 'CLIENT_NAME']);
                $clientName = $jsonFullName ?: $contactTitle;
                
                if (!$clientName) {
                    $fName = getStrmVal($contact, ['FIRST_NAME']) ?: getStrmVal($cp, ['FIRST_NAME']);
                    $lName = getStrmVal($contact, ['LAST_NAME']) ?: getStrmVal($cp, ['LAST_NAME']);
                    $title = getStrmVal($contact, ['FORMATTED_NAME', 'TITLE']) ?: getStrmVal($cp, ['TITLE']);
                    $clientName = ($fName || $lName) ? trim("$lName $fName") : $title;
                }
                
                $rawPhone = $jsonPhone ?: getStrmVal($resData, ['PHONE', 'CONTACT_PHONE', 'MAIN_PHONE']) ?: getStrmVal($contact, ['PHONE', 'MAIN_PHONE']) ?: getStrmVal($cp, ['PHONE', 'MAIN_PHONE']) ?: getStrmVal($card, ['CONTACT_PHONE', 'PHONE_TEXT', 'MAIN_PHONE']) ?: getStrmVal($offer, ['CONTACT_PHONE', 'MAIN_PHONE']);
                $clientPhone = formatPhoneStocrm($rawPhone);

                // --- АВТОМОБИЛЬ И НОМЕРА ---
                $carP = $card['CAR_PROFILE'] ?? [];
                $carId = intval($carP['ID'] ?? getStrmVal($card, ['CAR_PROFILE_ID'])) ?: intval(getStrmVal($offer, ['CAR_PROFILE_ID']));
                $carData = $carsData[$carId] ?? [];

                $carTitle = getStrmVal($resData, ['CAR_TITLE']) ?: getStrmVal($card, ['CAR_TITLE']);
                $carBrand = $jsonBrand ?: $carTitle ?: getStrmVal($carData, ['BRAND', 'CAR_BRAND', 'MARK_NAME']) ?: getStrmVal($carP, ['BRAND', 'CAR_BRAND', 'MARK_NAME']) ?: getStrmVal($offer, ['CAR_BRAND']) ?: getStrmVal($card, ['CAR_BRAND', 'CAR_TEXT', 'AUTO_TEXT']);
                $carModel = getStrmVal($carData, ['MODEL', 'CAR_MODEL']) ?: getStrmVal($carP, ['MODEL', 'CAR_MODEL']) ?: getStrmVal($offer, ['CAR_MODEL']) ?: getStrmVal($card, ['CAR_MODEL']);
                $carVin   = getStrmVal($carData, ['VIN', 'CAR_VIN']) ?: getStrmVal($carP, ['VIN', 'CAR_VIN']) ?: getStrmVal($offer, ['VIN', 'CAR_VIN']) ?: getStrmVal($card, ['VIN', 'CAR_VIN']);
                $carPlate = getStrmVal($resData, ['PLATE', 'CAR_PLATE', 'LICENSE_PLATE_NUMBER']) ?: getStrmVal($carData, ['PLATE', 'CAR_PLATE', 'LICENSE_PLATE_NUMBER']) ?: getStrmVal($carP, ['PLATE', 'CAR_PLATE', 'LICENSE_PLATE_NUMBER']) ?: getStrmVal($offer, ['PLATE', 'CAR_PLATE', 'LICENSE_PLATE_NUMBER']) ?: getStrmVal($card, ['CAR_PLATE', 'LICENSE_PLATE_NUMBER']);

                // --- РЕЗЕРВНЫЙ ПАРСИНГ ---
                if (!$clientName || $clientName === 'Гость' || $clientName === 'Не указан') {
                    if (preg_match('/(?:Клиент|Имя|Заказчик|ФИО)\s*[:\-]?\s*([^|\r\n,;]+)/iu', $cleanComment, $m)) $clientName = trim($m[1]);
                }
                if (!$clientPhone) {
                    if (preg_match('/(?:Телефон|Тел|Моб)\s*[:\-]?\s*([+\d\s\(\)-]{10,20})/iu', $cleanComment, $m)) {
                        $digits = preg_replace('/\D/', '', $m[1]);
                        if (strlen($digits) >= 10) $clientPhone = formatPhoneStocrm($digits);
                    } elseif (preg_match('/(?:^|\s)([+7|8][\d\s\(\)-]{9,15})(?:\s|$)/', $cleanComment, $m)) {
                        $clientPhone = formatPhoneStocrm($m[1]);
                    }
                }
                if (!$carBrand || mb_stripos($carBrand, 'без номера') !== false) {
                    if (preg_match('/(?:Авто|Автомобиль|Машина)\s*[:\-]?\s*([^|\r\n,;]+)/iu', $cleanComment, $m)) {
                        $parsedCar = trim($m[1]);
                        if (preg_match('/^(.*?)\s+([А-ЯA-Z]\d{3}[А-ЯA-Z]{2}\d{2,3})$/iu', $parsedCar, $carMatch)) {
                            $carBrand = trim($carMatch[1]); $carPlate = trim($carMatch[2]);
                        } else {
                            $carBrand = $parsedCar;
                        }
                    }
                }
                
                $carStr = trim(str_replace($carModel, '', $carBrand) . " " . $carModel) ?: $carBrand ?: 'Авто (Без номера)';
                if (!$clientName) $clientName = 'Гость';

                $statusName = $offerId ? (getStrmVal($offer, ['STATUS_NAME']) ?: getStrmVal($card, ['STATUS_NAME']) ?: 'Активна') : 'Резерв времени';
                
                // --- РАБОТЫ ---
                $worksRaw = $worksData[$offerId] ?? $card['OFFER_INFO']['WORKS'] ?? [];
                $normalizedWorks = [];
                $offerSum = 0;

                if (is_array($worksRaw)) {
                    foreach ($worksRaw as $w) {
                        if (is_array($w)) {
                            $wName = getStrmVal($w, ['TITLE', 'DOCUMENT_TITLE', 'NAME', 'WORK_NAME', 'Название']);
                            $wPrice = floatval(getStrmVal($w, ['PRICE', 'SUM', 'TOTAL']));
                            if ($wName) {
                                $normalizedWorks[] = ['NAME' => $wName, 'PRICE' => $wPrice];
                                $offerSum += $wPrice;
                            }
                        }
                    }
                }
                if (empty($offerSum)) $offerSum = floatval(getStrmVal($offer, ['SUM', 'TOTAL', 'PRICE']));

                if ($clientPhone) $cleanComment = str_replace(preg_replace('/\D/', '', $clientPhone), '', $cleanComment); 
                
                $events[] = [
                    'id'          => (string)$cardId,
                    'resourceId'  => (string)$cardPostId,
                    'title'       => $carStr,
                    'start'       => date('Y-m-d\TH:i:s', intval(getStrmVal($card, ['DATE_FROM']) ?: time())),
                    'end'         => date('Y-m-d\TH:i:s', intval(getStrmVal($card, ['DATE_TO']) ?: time())),
                    'extendedProps' => [
                        'offer_id'       => $offerId,
                        'client_name'    => $clientName,
                        'client_phone'   => $clientPhone,
                        'car_plate'      => $carPlate,
                        'car_vin'        => $carVin,
                        'status_name'    => $statusName,
                        'sum'            => $offerSum,
                        'full_works'     => $normalizedWorks,
                        'display_comment'=> trim(str_replace(" | ", "\n", $cleanComment)),
                        'card_color'     => $cardColor,
                        
                        'raw_card'       => json_encode($card, JSON_UNESCAPED_UNICODE),
                        'raw_res'        => json_encode($resData, JSON_UNESCAPED_UNICODE),
                        'raw_offer'      => json_encode($offer, JSON_UNESCAPED_UNICODE)
                    ]
                ];
            }
            $current = strtotime('+1 day', $current);
        }

        echo json_encode(['status' => 'success', 'events' => $events], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['status' => 'error', 'message' => 'Invalid action']);

} catch (Throwable $e) {
    echo json_encode(['status' => 'error', 'message' => 'PHP Exception: ' . $e->getMessage()], JSON_UNESCAPED_UNICODE);
}