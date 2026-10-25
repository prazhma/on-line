<?php
/**
 * ПИН-АВТО — Авторизация B2C (api/customer.php)
 */

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if (!function_exists('pin_write_log')) {
    function pin_write_log(string $channel, string $action, array $data): void {
        $dir = __DIR__ . '/cache';
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        $entry = sprintf(
            "[%s] [%s] [%s]\n%s\n%s\n",
            date('Y-m-d H:i:s'),
            strtoupper($channel),
            $action,
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
            str_repeat('-', 60)
        );
        @file_put_contents($dir . '/debug.log', $entry, FILE_APPEND | LOCK_EX);
    }
}

// Подключение сервисов
foreach ([
    __DIR__ . '/../services/CustomerService.php',
    __DIR__ . '/services/CustomerService.php',
    dirname(__DIR__) . '/services/CustomerService.php'
] as $sc) {
    if (file_exists($sc)) { require_once $sc; break; }
}

foreach ([
    __DIR__ . '/../services/StocrmClient.php',
    __DIR__ . '/services/StocrmClient.php',
    dirname(__DIR__) . '/services/StocrmClient.php'
] as $st) {
    if (file_exists($st)) { require_once $st; break; }
}

foreach ([
    __DIR__ . '/../services/MailTemplateService.php',
    __DIR__ . '/services/MailTemplateService.php',
    dirname(__DIR__) . '/services/MailTemplateService.php'
] as $mt) {
    if (file_exists($mt)) { require_once $mt; break; }
}

if (!function_exists('pin_get_stocrm_cfg')) {
    function pin_get_stocrm_cfg(): array {
        static $cfg = null;
        if ($cfg !== null) return $cfg;
        $domain = '';
        $apiKey = '';

        if (class_exists('StocrmClient')) {
            try {
                $client = new StocrmClient();
                $ref = new ReflectionClass($client);
                foreach ($ref->getProperties() as $prop) {
                    $prop->setAccessible(true);
                    $n = strtolower($prop->getName());
                    $v = $prop->getValue($client);
                    if (is_string($v) && !empty($v)) {
                        if (strpos($n, 'key') !== false || strpos($n, 'sid') !== false) $apiKey = $v;
                        if (strpos($n, 'domain') !== false) $domain = $v;
                    }
                }
            } catch (Throwable $e) {}
        }

        if (empty($apiKey)) {
            foreach ([
                __DIR__ . '/../config/config.json',
                dirname(__DIR__) . '/config/config.json',
                __DIR__ . '/config/config.json',
                __DIR__ . '/../config.json',
                __DIR__ . '/config.json'
            ] as $file) {
                if (file_exists($file) && is_readable($file)) {
                    $dec = json_decode(preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($file)), true);
                    if (is_array($dec)) {
                        $apiKey = $dec['api_key'] ?? $dec['apiKey'] ?? $dec['SID'] ?? '';
                        $domain = $dec['domain'] ?? $domain;
                        if (!empty($apiKey)) break;
                    }
                }
            }
        }
        if (empty($domain)) $domain = 'pin-avto';
        $cfg = ['domain' => $domain, 'api_key' => $apiKey];
        return $cfg;
    }
}

if (!function_exists('pin_get_gw_cfg')) {
    function pin_get_gw_cfg(): array {
        foreach ([
            __DIR__ . '/../config/gateways.json',
            dirname(__DIR__) . '/config/gateways.json',
            __DIR__ . '/config/gateways.json',
            __DIR__ . '/../gateways.json',
            __DIR__ . '/gateways.json'
        ] as $file) {
            if (file_exists($file) && is_readable($file)) {
                $dec = json_decode(preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($file)), true);
                if (is_array($dec)) return $dec;
            }
        }
        return [];
    }
}

if (!function_exists('pin_call_stocrm')) {
    function pin_call_stocrm(string $endpoint, array $payload = [], string $method = 'POST'): array {
        $cfg = pin_get_stocrm_cfg();
        $domain = $cfg['domain'];
        $apiKey = $cfg['api_key'];
        $cleanEp = ltrim($endpoint, '/');
        $url = "https://{$domain}.stocrm.ru/api/external/v1/" . $cleanEp;

        if (strtoupper($method) === 'GET') {
            $payload['SID'] = $apiKey;
            $ch = curl_init($url . '?' . http_build_query($payload));
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPGET        => true,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => 0,
                CURLOPT_TIMEOUT        => 8
            ]);
            $raw = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
        } else {
            $payload['SID'] = $apiKey;
            $json = json_encode($payload, JSON_UNESCAPED_UNICODE);
            $ch = curl_init($url . "?SID=" . urlencode($apiKey));
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST           => true,
                CURLOPT_POSTFIELDS     => $json,
                CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Content-Length: ' . strlen($json)],
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => 0,
                CURLOPT_TIMEOUT        => 8
            ]);
            $raw = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
        }

        $decoded = json_decode($raw, true);
        pin_write_log('B2C', 'STOCRM_API_CALL', [
            'endpoint'  => $cleanEp,
            'method'    => $method,
            'http_code' => $code,
            'raw'       => mb_substr((string)$raw, 0, 400)
        ]);
        return is_array($decoded) ? $decoded : [];
    }
}

// Гарантированное извлечение Email из любой глубины ответа
if (!function_exists('pin_extract_email_recursive')) {
    function pin_extract_email_recursive($data): string {
        if (empty($data)) return '';
        $raw = json_encode($data, JSON_UNESCAPED_UNICODE);
        if (preg_match_all('/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/', $raw, $matches)) {
            foreach ($matches[0] as $em) {
                $clean = strtolower(trim($em));
                if (!str_contains($clean, 'stocrm.ru') && !str_contains($clean, 'example.com')) {
                    return $clean;
                }
            }
        }
        return '';
    }
}

if (!function_exists('pin_mask_email')) {
    function pin_mask_email(string $email): string {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return '';
        $parts = explode('@', $email);
        $user = $parts[0];
        $domain = $parts[1];
        $len = mb_strlen($user);
        $maskedUser = ($len <= 2) ? (mb_substr($user, 0, 1) . '***') : (mb_substr($user, 0, 2) . str_repeat('*', max(3, $len - 2)));
        return $maskedUser . '@' . $domain;
    }
}

try {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?: $_POST;
    $action = $_GET['action'] ?? $input['action'] ?? '';

    // =========================================================
    // CHECK_CLIENT (ВХОД ПО ТЕЛЕФОНУ)
    // =========================================================
    if ($action === 'check_client') {
        header('Content-Type: application/json; charset=utf-8');
        $phone = trim((string)($input['phone'] ?? ''));
        $cleanPhone = preg_replace('/\D/', '', $phone);

        pin_write_log('B2C', 'CHECK_CLIENT_START', ['phone' => $phone, 'clean_phone' => $cleanPhone]);

        $customerService = class_exists('CustomerService') ? new CustomerService() : null;
        $client = null;

        if ($customerService) {
            $client = $customerService->findClient($phone, 'phys');
            if (!$client && strlen($cleanPhone) === 11) {
                $client = $customerService->findClient($cleanPhone, 'phys');
            }
        }

        // Если CustomerService не нашел, запрашиваем contacts/get_from_filter
        if (!$client) {
            $cFilter = pin_call_stocrm('contacts/get_from_filter', ['FILTER' => ['SEARCH' => substr($cleanPhone, -10)], 'LIMIT' => 1], 'POST');
            $client = $cFilter['RESPONSE']['DATA'][0] ?? null;
        }

        if (!$client) {
            pin_write_log('B2C', 'CHECK_CLIENT_FAIL', ['phone' => $phone]);
            echo json_encode(['status' => 'error', 'message' => 'Клиент с таким номером не найден в базе ПИН-АВТО.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $clientId = intval($client['id'] ?? $client['CONTACT_ID'] ?? 0);
        $title = trim((string)($client['name'] ?? $client['title'] ?? $client['FORMATTED_NAME'] ?? 'Клиент'));

        // Запрос свойств контакта для извлечения почты
        $infoResp = pin_call_stocrm('contact/get_info', ['CONTACT_ID' => $clientId], 'GET');
        $email = pin_extract_email_recursive($infoResp);

        // Резервный поиск почты в объекте клиента и его сделках
        if (empty($email)) $email = pin_extract_email_recursive($client);
        if (empty($email)) {
            $offers = pin_call_stocrm('offers/get_from_filter', ['FILTER' => ['CONTACT_ID' => $clientId], 'LIMIT' => 2], 'POST');
            $email = pin_extract_email_recursive($offers);
        }

        pin_write_log('B2C', 'CHECK_CLIENT_SUCCESS', [
            'client_id' => $clientId,
            'name'      => $title,
            'email'     => $email
        ]);

        echo json_encode([
            'status' => 'success',
            'client' => [
                'id'           => $clientId,
                'name'         => $title,
                'phone'        => $phone,
                'email'        => $email,
                'masked_email' => pin_mask_email($email)
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================
    // SEND_CODE
    // =========================================================
    if ($action === 'send_code') {
        header('Content-Type: application/json; charset=utf-8');
        $phone   = trim((string)($input['phone'] ?? ''));
        $channel = trim((string)($input['channel'] ?? 'sms'));

        $cleanKey = preg_replace('/\D/', '', $phone);
        $cacheDir = __DIR__ . '/cache';
        if (!is_dir($cacheDir)) @mkdir($cacheDir, 0777, true);
        $otpFile = $cacheDir . '/otp_tokens.json';

        $code = str_pad((string)random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
        $storage = file_exists($otpFile) ? (json_decode(@file_get_contents($otpFile), true) ?: []) : [];
        $storage[$cleanKey] = ['code' => $code, 'channel' => $channel, 'phone' => $phone, 'time' => time()];
        @file_put_contents($otpFile, json_encode($storage, JSON_UNESCAPED_UNICODE), LOCK_EX);

        pin_write_log('B2C', 'OTP_CODE_ISSUED', ['phone' => $phone, 'channel' => $channel, 'code' => $code]);

        $gateways = pin_get_gw_cfg();

        if ($channel === 'sms') {
            $smsCfg = $gateways['sms'] ?? [];
            $apiKey = $smsCfg['api_key'] ?? '';
            $digits = preg_replace('/\D/', '', $phone);
            if (strlen($digits) === 10) $digits = '7' . $digits;
            elseif (strlen($digits) === 11 && $digits[0] === '8') $digits = '7' . substr($digits, 1);

            $text = "Код подтверждения входа в кабинет ПИН-АВТО: {$code}";
            $url  = "https://sms.ru/sms/send?api_id=" . urlencode($apiKey) . "&to=" . urlencode($digits) . "&msg=" . urlencode($text) . "&json=1";
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_SSL_VERIFYPEER => false]);
            $res = curl_exec($ch);
            curl_close($ch);
            pin_write_log('B2C', 'SMS_RESULT', ['res' => json_decode($res, true) ?: $res]);
        } elseif ($channel === 'email') {
            $customerService = class_exists('CustomerService') ? new CustomerService() : null;
            $cl = $customerService ? $customerService->findClient($phone, 'phys') : null;
            $cId = intval($cl['id'] ?? 0);
            $info = pin_call_stocrm('contact/get_info', ['CONTACT_ID' => $cId], 'GET');
            $targetEmail = pin_extract_email_recursive($info) ?: pin_extract_email_recursive($cl);

            if (!empty($targetEmail)) {
                $smtpCfg = $gateways['smtp'] ?? [];
                $host = $smtpCfg['host'] ?? '';
                $port = intval($smtpCfg['port'] ?? 465);
                $user = $smtpCfg['username'] ?? '';
                $pass = $smtpCfg['password'] ?? '';
                $from = $smtpCfg['from_name'] ?? 'ПИН-АВТО';

                $subject  = "{$code} — проверочный код ПИН-АВТО";
                $textBody = "Код для входа: {$code}";
                $htmlBody = "<p>Код для входа: <b>{$code}</b></p>";

                if (!empty($host) && !empty($user) && !empty($pass)) {
                    $sock = @stream_socket_client("ssl://{$host}:{$port}", $errno, $errstr, 8);
                    if ($sock) {
                        $r = function() use ($sock) { $d = ''; while ($l = fgets($sock, 515)) { $d .= $l; if (substr($l, 3, 1) === ' ') break; } return $d; };
                        $w = function($c) use ($sock) { fputs($sock, $c . "\r\n"); };
                        $r(); $w("EHLO " . gethostname()); $r();
                        $w("AUTH LOGIN"); $r();
                        $w(base64_encode($user)); $r();
                        $w(base64_encode($pass)); $r();
                        $w("MAIL FROM: <{$user}>"); $r();
                        $w("RCPT TO: <{$targetEmail}>"); $r();
                        $w("DATA"); $r();

                        $boundary = "----=_Part_" . md5(uniqid());
                        $h  = "From: =?UTF-8?B?" . base64_encode($from) . "?= <{$user}>\r\n";
                        $h .= "To: <{$targetEmail}>\r\nSubject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
                        $h .= "MIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n\r\n";
                        $b  = "--{$boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{$textBody}\r\n\r\n";
                        $b .= "--{$boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n{$htmlBody}\r\n\r\n--{$boundary}--\r\n.";

                        $w($h . $b); $r();
                        $w("QUIT"); fclose($sock);
                        pin_write_log('B2C', 'EMAIL_SUCCESS', ['to' => $targetEmail]);
                    }
                }
            }
        }

        echo json_encode(['status' => 'success', 'message' => 'Код отправлен', 'debug_code' => $code], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================
    // VERIFY_CODE
    // =========================================================
    if ($action === 'verify_code') {
        header('Content-Type: application/json; charset=utf-8');
        $phone = trim((string)($input['phone'] ?? ''));
        $code  = trim((string)($input['code'] ?? ''));
        $cleanKey = preg_replace('/\D/', '', $phone);

        $otpFile = __DIR__ . '/cache/otp_tokens.json';
        $storage = file_exists($otpFile) ? (json_decode(@file_get_contents($otpFile), true) ?: []) : [];

        if (!isset($storage[$cleanKey]) || strval($storage[$cleanKey]['code']) !== strval($code)) {
            echo json_encode(['status' => 'error', 'message' => 'Неверный проверочный код'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        unset($storage[$cleanKey]);
        @file_put_contents($otpFile, json_encode($storage, JSON_UNESCAPED_UNICODE), LOCK_EX);

        $customerService = class_exists('CustomerService') ? new CustomerService() : null;
        $client = $customerService ? $customerService->findClient($phone, 'phys') : null;
        echo json_encode(['status' => 'success', 'client' => $client], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================
    // BALANCE & TRANSACTIONS & GET_PROFILE
    // =========================================================
    if ($action === 'balance') {
        header('Content-Type: application/json; charset=utf-8');
        $clientId = trim((string)($input['client_id'] ?? $_GET['client_id'] ?? ''));
        $cs = class_exists('CustomerService') ? new CustomerService() : null;
        $points = $cs ? $cs->getClientBalance($clientId) : 0;
        echo json_encode(['status' => 'success', 'points' => $points, 'balance' => $points], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'transactions') {
        header('Content-Type: application/json; charset=utf-8');
        $clientId = trim((string)($input['client_id'] ?? $_GET['client_id'] ?? ''));
        $cs = class_exists('CustomerService') ? new CustomerService() : null;
        $tx = $cs ? $cs->getCashbackTransactions($clientId) : [];
        echo json_encode(['status' => 'success', 'transactions' => $tx], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'get_profile') {
        header('Content-Type: application/json; charset=utf-8');
        $clientId = intval($input['client_id'] ?? $_GET['client_id'] ?? 0);
        $phone    = trim((string)($input['phone'] ?? $_GET['phone'] ?? ''));
        $info = pin_call_stocrm('contact/get_info', ['CONTACT_ID' => $clientId], 'GET');
        $flat = $info['RESPONSE']['STRUCTURIZED']['FLAT'] ?? [];

        $profile = [
            'id'            => $clientId,
            'surname'       => $flat['SURNAME']['VALUE'] ?? '',
            'first_name'    => $flat['FIRSTNAME']['VALUE'] ?? '',
            'middle_name'   => $flat['MIDDLENAME']['VALUE'] ?? '',
            'title'         => $flat['TITLE']['VALUE'] ?? '',
            'phone'         => $phone,
            'email'         => pin_extract_email_recursive($info),
            'birthday'      => $flat['DOB']['VALUE'] ?: '',
            'city'          => $flat['CITY']['VALUE'] ?? '',
            'address'       => $flat['ADDRESS']['VALUE'] ?? '',
            'discount_card' => $flat['CARD']['VALUE'] ?? '',
            'segment'       => 'Сотрудники'
        ];

        echo json_encode(['status' => 'success', 'profile' => ['phys' => $profile]], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['status' => 'error', 'message' => 'Неизвестное действие'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    pin_write_log('B2C', 'CRITICAL_ERROR', ['error' => $e->getMessage()]);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}