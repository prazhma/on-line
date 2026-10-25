<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../services/StocrmClient.php';

try {
    $offerId = (int)($_GET['offer_id'] ?? $_POST['offer_id'] ?? 0);

    if ($offerId <= 0) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Не указан ID сделки (OFFER_ID)'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $client = new StocrmClient();

    // Запрос списка работ по сделке строго по вики STOCRM: /api/external/v1/work/get_filtered
    $res = $client->post('/api/external/v1/work/get_filtered', [
        'FILTER' => [
            'OFFER_ID' => $offerId
        ],
        'SORT' => [
            'DATE_CREATE' => 'ASC'
        ],
        'PAGE' => 1,
        'LIMIT' => 100
    ]);

    $items = [];
    $rawItems = $res['RESPONSE']['DATA'] ?? $res['DATA'] ?? $res['RESPONSE'] ?? [];

    if (is_array($rawItems)) {
        foreach ($rawItems as $work) {
            if (is_array($work)) {
                $items[] = [
                    'id' => $work['WORK_ID'] ?? null,
                    'title' => $work['TITLE'] ?? $work['DOCUMENT_TITLE'] ?? $work['WORK_TYPE_TITLE'] ?? 'Работа',
                    'type' => $work['WORK_TYPE_TITLE'] ?? 'Работа',
                    'qty' => $work['WORKING_HOUR'] ?? 1,
                    'price' => $work['PRICE_OF_HOUR'] ?? 0,
                    'sum' => $work['SUM'] ?? 0,
                    'status' => $work['OFFER_STATUS_NAME'] ?? '',
                    'performer' => $work['PERFORMER'] ?? ''
                ];
            }
        }
    }

    echo json_encode([
        'status' => 'success',
        'items' => $items
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    file_put_contents(
        __DIR__ . '/../stocrm_debug.log',
        date('Y-m-d H:i:s') . " - [API Works Error]: " . $e->getMessage() . "\n",
        FILE_APPEND
    );

    echo json_encode([
        'status' => 'error',
        'message' => 'Внутренняя ошибка сервера: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}