<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../services/RecommendationService.php';

try {
    $clientId = (int)($_GET['client_id'] ?? $_POST['client_id'] ?? 0);

    if ($clientId <= 0) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Не указан ID клиента'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $service = new RecommendationService();
    $recommendations = $service->getClientRecommendations($clientId);

    echo json_encode([
        'status' => 'success',
        'recommendations' => $recommendations
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    file_put_contents(
        __DIR__ . '/../stocrm_debug.log',
        date('Y-m-d H:i:s') . " - [API Recommendations Error]: " . $e->getMessage() . "\n",
        FILE_APPEND
    );

    echo json_encode([
        'status' => 'error',
        'message' => 'Внутренняя ошибка сервера: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}