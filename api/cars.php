<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../services/CarService.php';

try {
    $contactId = $_GET['client_id'] ?? $_POST['client_id'] ?? null;

    if (empty($contactId)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Не передан ID контакта',
            'cars' => []
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $carService = new CarService();
    $cars = $carService->getClientCars($contactId);

    echo json_encode([
        'status' => 'success',
        'cars' => $cars
    ], JSON_UNESCAPED_UNICODE);
    exit;
} catch (Throwable $e) {
    file_put_contents(__DIR__ . '/../stocrm_debug.log', date('Y-m-d H:i:s') . " - [API Cars Error]: " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
        'cars' => []
    ], JSON_UNESCAPED_UNICODE);
}