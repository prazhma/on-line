<?php
// Ищем конфиг
$config_paths = ['/volume1/web/config/config.json', '/volume1/web/config.json', __DIR__ . '/config/config.json', __DIR__ . '/config.json'];
$config_file = '';
foreach ($config_paths as $path) {
    if (file_exists($path) && is_readable($path)) { $config_file = $path; break; }
}
if (!$config_file) die("Конфиг не найден\n");

$config = json_decode(file_get_contents($config_file), true);
$url = "https://{$config['domain']}.stocrm.ru/api/external/v1/customers/get_filtered";
$payload = json_encode(["SID" => $config['api_key'], "LIMIT" => 100]);

$cmd = "curl -s -k -X POST " . escapeshellarg($url) . " -H 'Content-Type: application/json' -d " . escapeshellarg($payload) . " 2>&1";
$response = shell_exec($cmd);

$schedules = [];
if ($response) {
    $data = json_decode($response, true);
    if (isset($data['RESPONSE']['DATA'])) {
        foreach ($data['RESPONSE']['DATA'] as $branch) {
            if (isset($branch['WORK_TIME'])) {
                $schedules[$branch['CUSTOMER_ID']] = $branch['WORK_TIME'];
            }
        }
        $file_path = '/volume1/web/schedules.json';
        file_put_contents($file_path, json_encode($schedules, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        chmod($file_path, 0666);
        echo "✅ Расписания успешно обновлены и сохранены в schedules.json!\n";
    } else {
        echo "❌ Ошибка: STOCRM не вернул данные DATA.\n";
    }
} else {
    echo "❌ Ошибка curl-запроса.\n";
}
