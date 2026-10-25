<?php
header('Content-Type: text/html; charset=utf-8');

require_once __DIR__ . '/services/StocrmClient.php';

$inn = trim((string)($_GET['inn'] ?? '7814148471')); // По умолчанию тестовый ИНН
$cleanInn = preg_replace('/\D/', '', $inn);

echo "<h2>Диагностика поиска по ИНН: {$cleanInn}</h2>";
echo "<form method='GET'><input type='text' name='inn' value='{$cleanInn}'><button type='submit'>Проверить ИНН</button></form><hr>";

try {
    $client = new StocrmClient();

    $tests = [
        '1. contractor/list (FILTER -> INN)' => [
            'endpoint' => '/api/external/v1/contractor/list',
            'payload'  => ['FILTER' => ['INN' => $cleanInn]]
        ],
        '2. contractor/list (FILTER -> QUERY)' => [
            'endpoint' => '/api/external/v1/contractor/list',
            'payload'  => ['FILTER' => ['QUERY' => $cleanInn]]
        ],
        '3. contacts/get_from_filter (FILTER -> QUERY)' => [
            'endpoint' => '/api/external/v1/contacts/get_from_filter',
            'payload'  => ['FILTER' => ['QUERY' => $cleanInn]]
        ],
        '4. contacts/get_from_filter (FILTER -> SEARCH)' => [
            'endpoint' => '/api/external/v1/contacts/get_from_filter',
            'payload'  => ['FILTER' => ['SEARCH' => $cleanInn]]
        ],
        '5. contractors/get_filtered (FILTER -> INN)' => [
            'endpoint' => '/api/external/v1/contractors/get_filtered',
            'payload'  => ['FILTER' => ['INN' => $cleanInn]]
        ]
    ];

    foreach ($tests as $name => $cfg) {
        echo "<h3>{$name}</h3>";
        try {
            $res = $client->post($cfg['endpoint'], $cfg['payload']);
            $count = 0;
            if (isset($res['RESPONSE']['DATA'])) {
                $count = count($res['RESPONSE']['DATA']);
            } elseif (isset($res['RESPONSE']) && is_array($res['RESPONSE'])) {
                $count = count($res['RESPONSE']);
            }

            echo "<div><b>Результат:</b> найдено записей: <b>{$count}</b></div>";
            echo "<pre style='background:#f4f4f4; padding:10px; border-radius:5px; max-height:200px; overflow:auto;'>" 
                . htmlspecialchars(json_encode($res, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT)) 
                . "</pre>";
        } catch (Throwable $e) {
            echo "<div style='color:red;'>Ошибка вызова: " . htmlspecialchars($e->getMessage()) . "</div>";
        }
        echo "<hr>";
    }

} catch (Throwable $e) {
    echo "<h3 style='color:red;'>Критическая ошибка инициализации StocrmClient: " . htmlspecialchars($e->getMessage()) . "</h3>";
}