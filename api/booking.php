<?php
header('Content-Type: application/json; charset=utf-8');

$root = dirname(__DIR__, 2); // Переход в /volume1/web
$action = $_GET['action'] ?? '';

if ($action === 'init') {
    $configPath = $root . '/config/config.json';
    $servicesPath = $root . '/services.json';

    $config = file_exists($configPath) ? json_decode(file_get_contents($configPath), true) : [];
    $services = file_exists($servicesPath) ? json_decode(file_get_contents($servicesPath), true) : [];

    $rawBranches = $config['branches'] ?? $config['filials'] ?? [];
    $branches = [];

    if (is_array($rawBranches)) {
        foreach ($rawBranches as $key => $b) {
            if (is_array($b)) {
                $branches[] = [
                    'id' => $b['id'] ?? $key,
                    'name' => $b['name'] ?? $b['address'] ?? ("Филиал #" . ($b['id'] ?? $key))
                ];
            }
        }
    }

    echo json_encode([
        'status' => 'success',
        'branches' => $branches,
        'services' => $services
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Неизвестное действие']);