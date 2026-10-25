<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../services/CalendarService.php';

try {
    $clientId = (int)($_GET['client_id'] ?? $_POST['client_id'] ?? 0);

    if ($clientId <= 0) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Не указан ID клиента'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $calendarService = new CalendarService();
    $posts = $calendarService->getClientCalendarPosts($clientId);

    echo json_encode([
        'status' => 'success',
        'services' => $posts
    ], JSON_UNESCAPED_UNICODE);
    exit;

} catch (Throwable $e) {
    file_put_contents(
        __DIR__ . '/../stocrm_debug.log',
        date('Y-m-d H:i:s') . " - [API Services Error]: " . $e->getMessage() . "\n",
        FILE_APPEND
    );

    echo json_encode([
        'status' => 'error',
        'message' => 'Внутренняя ошибка сервера: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
    exit;
}