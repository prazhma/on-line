<?php

class StocrmClient {
    private $apiUrl;
    private $apiKey;

    public function __construct() {
        $possiblePaths = [
            __DIR__ . '/../config/config.json',
            __DIR__ . '/../../config/config.json',
            __DIR__ . '/../config.json',
            __DIR__ . '/../../config.json',
            '/volume1/web/config/config.json',
            '/volume1/web/config.json'
        ];

        $configFile = null;
        foreach ($possiblePaths as $path) {
            if (file_exists($path) && is_readable($path)) {
                $configFile = $path;
                break;
            }
        }

        if (!$configFile) {
            throw new Exception("Файл конфигурации config.json не найден ни по одному из стандартных путей.");
        }
        
        $config = json_decode(file_get_contents($configFile), true);
        
        $this->apiKey = trim($config['api_key'] ?? $config['STOCRM_API_KEY'] ?? '');
        
        if (!empty($config['domain'])) {
            $this->apiUrl = "https://" . trim($config['domain']) . ".stocrm.ru";
        } else {
            $this->apiUrl = rtrim($config['STOCRM_API_URL'] ?? 'https://pin-avto.stocrm.ru', '/');
        }

        if (empty($this->apiKey)) {
            throw new Exception("В конфигурационном файле отсутствует ключ API (api_key).");
        }
    }

    public function get($endpoint, $params = []) {
        $params['SID'] = $this->apiKey;
        $url = $this->apiUrl . '/' . ltrim($endpoint, '/');
        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }
        return $this->sendRequest($url, 'GET');
    }

    public function post($endpoint, $data = []) {
        $data['SID'] = $this->apiKey;
        $url = $this->apiUrl . '/' . ltrim($endpoint, '/');
        return $this->sendRequest($url, 'POST', $data);
    }

    private function sendRequest($url, $method, $data = []) {
        $ch = curl_init();

        $headers = [
            'SID: ' . $this->apiKey,
            'X-API-KEY: ' . $this->apiKey,
            'Authorization: Bearer ' . $this->apiKey,
            'Accept: application/json'
        ];

        $options = [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => false,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_COOKIE => 'SID=' . $this->apiKey,
        ];

        if ($method === 'POST') {
            $options[CURLOPT_POST] = true;
            $options[CURLOPT_POSTFIELDS] = json_encode($data, JSON_UNESCAPED_UNICODE);
            $headers[] = 'Content-Type: application/json';
        }

        $options[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($ch, $options);

        $rawResponse = curl_exec($ch);
        $error = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($error) {
            throw new Exception("cURL Error: " . $error);
        }

        $decoded = json_decode($rawResponse, true);
        if ($decoded === null && $rawResponse !== 'null') {
            throw new Exception("STOCRM вернул не-JSON ответ (HTTP {$httpCode}): " . substr((string)$rawResponse, 0, 150));
        }

        return $decoded;
    }
}