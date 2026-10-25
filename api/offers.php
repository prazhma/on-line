<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../services/OfferService.php';

try {
    $contactId = $_GET['client_id'] ?? $_POST['client_id'] ?? null;

    if (empty($contactId)) {
        echo json_encode([
            'status' => 'error',
            'message' => 'Не передан ID контакта',
            'deals' => []
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $offerService = new OfferService();
    $deals = $offerService->getClientOffers($contactId);

    echo json_encode([
        'status' => 'success',
        'deals' => $deals
    ], JSON_UNESCAPED_UNICODE);
    exit;
} catch (Throwable $e) {
    file_put_contents(__DIR__ . '/../stocrm_debug.log', date('Y-m-d H:i:s') . " - [API Offers Error]: " . $e->getMessage() . "\n", FILE_APPEND);
    echo json_encode([
        'status' => 'error',
        'message' => $e->getMessage(),
        'deals' => []
    ], JSON_UNESCAPED_UNICODE);
}