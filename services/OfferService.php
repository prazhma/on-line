<?php

require_once __DIR__ . '/StocrmClient.php';

class OfferService {
    private $client;

    public function __construct() {
        $this->client = new StocrmClient();
    }

    /**
     * Получение сделок клиента по CONTACT_ID через подтвержденный эндпоинт STOCRM
     * с фильтрацией архивных сделок (ARCHIVE === 'Y')
     */
    public function getClientOffers($contactId) {
        $endpoint = '/api/external/v1/offers/get_from_filter';
        
        $params = [
            'FILTER' => [
                'CONTACT_ID' => (int)$contactId
            ],
            'LIMIT' => 9999
        ];

        try {
            $response = $this->client->get($endpoint, $params);

            if (!isset($response['RESPONSE']['DATA']) || !is_array($response['RESPONSE']['DATA'])) {
                return [];
            }

            // Белый список рабочих статусов для клиента
            $allowedStatuses = [
                'неразобранное',
                'в работе',
                'необходимо перезвонить',
                'успешно реализовано'
            ];

            $deals = [];
            foreach ($response['RESPONSE']['DATA'] as $offer) {
                if (!is_array($offer)) {
                    continue;
                }

                // 1. Точная проверка архива: в STOCRM архив это строго ARCHIVE === 'Y'
                $archiveVal = $offer['ARCHIVE'] ?? $offer['IS_ARCHIVE'] ?? $offer['OFFER_IS_ARCHIVE'] ?? 'N';
                if ($archiveVal === 'Y' || $archiveVal === 'y' || $archiveVal === 1 || $archiveVal === '1' || $archiveVal === true) {
                    continue; // Пропускаем архивные сделки
                }

                // 2. Исключение удаленных сделок из корзины
                $deletedVal = $offer['IS_DELETED'] ?? $offer['OFFER_IS_DELETED'] ?? 'N';
                if ($deletedVal === 'Y' || $deletedVal === 'y' || $deletedVal === 1 || $deletedVal === '1' || $deletedVal === true) {
                    continue;
                }

                // 3. Фильтрация по белому списку статусов
                $statusName = trim((string)($offer['STATUS_NAME'] ?? $offer['OFFER_STATUS_NAME'] ?? ''));
                $statusLower = mb_strtolower($statusName, 'UTF-8');

                $isAllowedStatus = false;
                foreach ($allowedStatuses as $allowed) {
                    if ($statusLower === $allowed || mb_strpos($statusLower, $allowed) !== false) {
                        $isAllowedStatus = true;
                        break;
                    }
                }

                if (!$isAllowedStatus) {
                    continue;
                }

                // Форматирование даты создания
                $dateFormatted = '—';
                if (!empty($offer['OFFER_DATE_CREATE_FRONTEND_TIMESTAMP'])) {
                    $dateFormatted = date('d.m.Y H:i', (int)$offer['OFFER_DATE_CREATE_FRONTEND_TIMESTAMP']);
                } elseif (!empty($offer['DATE_CREATE'])) {
                    $dateFormatted = date('d.m.Y H:i', strtotime($offer['DATE_CREATE']));
                }

                // Определение названия автомобиля в сделке
                $carName = '—';
                if (!empty($offer['CAR_TITLE'])) {
                    $carName = $offer['CAR_TITLE'];
                } elseif (!empty($offer['CAR_MARK_NAME']) || !empty($offer['CAR_MODEL_NAME'])) {
                    $carName = trim(($offer['CAR_MARK_NAME'] ?? '') . ' ' . ($offer['CAR_MODEL_NAME'] ?? ''));
                } elseif (!empty($offer['CAR_NUMBER_FLAT'])) {
                    $carName = $offer['CAR_NUMBER_FLAT'];
                }

                $deals[] = [
                    'id' => (int)($offer['OFFER_ID'] ?? 0),
                    'date' => $dateFormatted,
                    'status' => $statusName ?: 'В обработке',
                    'branch' => !empty($offer['BOARD_NAME']) ? $offer['BOARD_NAME'] : (!empty($offer['OFFER_CUSTOMER_NAME']) ? $offer['OFFER_CUSTOMER_NAME'] : 'ПИН-АВТО'),
                    'car_name' => $carName,
                    'sum' => number_format((float)($offer['OFFER_SUM'] ?? 0), 2, '.', ' '),
                    'payment_status' => $offer['PAYMENT_STATUS'] ?? 'Нет оплаты',
                    'is_archive' => 0
                ];
            }

            // Сортировка: сначала самые свежие сделки
            usort($deals, function ($a, $b) {
                return $b['id'] - $a['id'];
            });

            return $deals;
        } catch (Throwable $e) {
            file_put_contents(__DIR__ . '/../stocrm_debug.log', date('Y-m-d H:i:s') . " - [OfferService Error]: " . $e->getMessage() . "\n", FILE_APPEND);
            return [];
        }
    }
}