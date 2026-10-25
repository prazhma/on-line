<?php

require_once __DIR__ . '/StocrmClient.php';

class CalendarService {
    private $client;

    public function __construct() {
        $this->client = new StocrmClient();
    }

    /**
     * Получение списка записей календаря (постов) для контакта по вики STOCRM:
     * /api/external/v1/calendar/post/get_filtered
     */
    public function getClientCalendarPosts($clientId) {
        $contactId = (int)$clientId;
        if ($contactId <= 0) {
            return [];
        }

        try {
            $res = $this->client->post('/api/external/v1/calendar/post/get_filtered', [
                'FILTER' => [
                    'CONTACT_ID' => $contactId
                ],
                'SORT' => [
                    'DATE_CREATE' => 'DESC'
                ],
                'PAGE' => 1,
                'LIMIT' => 100
            ]);

            $rawItems = $res['RESPONSE']['DATA'] ?? $res['DATA'] ?? $res['RESPONSE'] ?? [];
            $posts = [];

            if (is_array($rawItems)) {
                foreach ($rawItems as $item) {
                    if (is_array($item)) {
                        $dateFromTs = $item['DATE_FROM_FRONTEND_TIMESTAMP'] ?? 0;
                        $dateToTs = $item['DATE_TO_FRONTEND_TIMESTAMP'] ?? 0;

                        $dateStr = $dateFromTs ? date('d.m.Y H:i', $dateFromTs) : '—';
                        $timeTo = $dateToTs ? date('H:i', $dateToTs) : '';
                        if ($timeTo) {
                            $dateStr .= ' — ' . $timeTo;
                        }

                        $posts[] = [
                            'id' => $item['CARD_ID'] ?? null,
                            'post_name' => $item['POST_NAME'] ?? 'Пост сервиса',
                            'branch_id' => $item['CUSTOMER_ID'] ?? '',
                            'car_title' => $item['CAR_TITLE'] ?? 'Автомобиль',
                            'comment' => $item['COMMENT'] ?? '',
                            'offer_reason' => $item['OFFER_REASON'] ?? '',
                            'date_formatted' => $dateStr,
                            'timestamp' => $dateFromTs
                        ];
                    }
                }
            }
            return $posts;
        } catch (Throwable $e) {
            file_put_contents(
                __DIR__ . '/../stocrm_debug.log',
                date('Y-m-d H:i:s') . " - [CalendarService Error]: " . $e->getMessage() . "\n",
                FILE_APPEND
            );
            return [];
        }
    }
}