<?php
/**
 * ПИН-АВТО — Авторизация B2B по ИНН (api/auth_b2b.php)
 * Прямая работа со связкой legal_entities + contacts STOCRM
 */

ini_set('display_errors', '0');
error_reporting(E_ALL);

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if (!function_exists('pin_b2b_log')) {
    function pin_b2b_log(string $action, array $data): void {
        $dir = __DIR__ . '/cache';
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        $entry = sprintf(
            "[%s] [B2B] [%s]\n%s\n%s\n",
            date('Y-m-d H:i:s'),
            $action,
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT),
            str_repeat('-', 60)
        );
        @file_put_contents($dir . '/debug.log', $entry, FILE_APPEND | LOCK_EX);
    }
}

// Конфигурация STOCRM
if (!function_exists('pin_b2b_get_cfg')) {
    function pin_b2b_get_cfg(): array {
        static $cfg = null;
        if ($cfg !== null) return $cfg;
        $domain = 'pin-avto';
        $apiKey = '';

        foreach ([
            __DIR__ . '/../config/config.json',
            dirname(__DIR__) . '/config/config.json',
            __DIR__ . '/config/config.json',
            __DIR__ . '/../config.json'
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
        $cfg = ['domain' => $domain, 'api_key' => $apiKey];
        return $cfg;
    }
}

// Конфигурация шлюзов (SMS / SMTP)
if (!function_exists('pin_b2b_get_gateways')) {
    function pin_b2b_get_gateways(): array {
        foreach ([
            __DIR__ . '/../config/gateways.json',
            dirname(__DIR__) . '/config/gateways.json',
            __DIR__ . '/config/gateways.json',
            __DIR__ . '/../gateways.json'
        ] as $file) {
            if (file_exists($file) && is_readable($file)) {
                $dec = json_decode(preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($file)), true);
                if (is_array($dec)) return $dec;
            }
        }
        return [];
    }
}

// Запрос к API STOCRM
if (!function_exists('pin_b2b_api_call')) {
    function pin_b2b_api_call(string $endpoint, array $payload = []): array {
        $cfg = pin_b2b_get_cfg();
        $domain = $cfg['domain'];
        $apiKey = $cfg['api_key'];
        $cleanEp = ltrim($endpoint, '/');
        $url = "https://{$domain}.stocrm.ru/api/external/v1/" . $cleanEp . "?SID=" . urlencode($apiKey);

        $payload['SID'] = $apiKey;
        $json = json_encode($payload, JSON_UNESCAPED_UNICODE);

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $json,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Content-Length: ' . strlen($json)],
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_TIMEOUT        => 8
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }
}

// Точный поиск организации и представителя
if (!function_exists('pin_b2b_resolve_company')) {
    function pin_b2b_resolve_company(string $inn): ?array {
        $cleanInn = preg_replace('/\D/', '', $inn);
        if (strlen($cleanInn) < 10) return null;

        // 1. Поиск организации в таблице legal_entities
        $res = pin_b2b_api_call('legal_entities/get_from_filter', [
            'FILTER' => ['INN' => $cleanInn],
            'LIMIT'  => 1
        ]);
        $entity = $res['RESPONSE']['DATA'][0] ?? null;

        if (!$entity) {
            $resSearch = pin_b2b_api_call('legal_entities/get_from_filter', [
                'FILTER' => ['SEARCH' => $cleanInn],
                'LIMIT'  => 1
            ]);
            $entity = $resSearch['RESPONSE']['DATA'][0] ?? null;
        }

        if (!$entity) return null;

        $legalEntityId = intval($entity['LEGAL_ENTITY_ID'] ?? $entity['ID'] ?? 0);
        $title = trim((string)($entity['LEGAL_ENTITY_TITLE'] ?? $entity['NAME'] ?? 'Организация'));

        // Извлечение корпоративного Email (из PROP_2 или базового поля)
        $companyEmail = '';
        if (!empty($entity['PROP_2'][0])) {
            $companyEmail = trim((string)$entity['PROP_2'][0]);
        } elseif (!empty($entity['EMAIL'])) {
            $companyEmail = trim((string)$entity['EMAIL']);
        }

        // Извлечение основного телефона компании (PROP_1)
        $companyPhone = '';
        if (!empty($entity['PROP_1'][0])) {
            $companyPhone = trim((string)$entity['PROP_1'][0]);
        } elseif (!empty($entity['PHONE'])) {
            $companyPhone = trim((string)$entity['PHONE']);
        }

        // 2. Поиск привязанного представителя (Шляха Б. В.)
        $repName = '';
        $repPhone = '';

        if ($legalEntityId > 0) {
            $repsResp = pin_b2b_api_call('contacts/get_from_filter', [
                'FILTER' => ['LEGAL_ENTITY_ID' => $legalEntityId],
                'LIMIT'  => 5
            ]);
            $reps = $repsResp['RESPONSE']['DATA'] ?? [];
            if (!empty($reps) && is_array($reps)) {
                $primaryRep = $reps[0];
                $repName = trim((string)($primaryRep['TITLE'] ?? ''));
                $repPhone = trim((string)($primaryRep['MAIN_PHONE'] ?? $primaryRep['PHONE'] ?? ''));
            }
        }

        // Целевой номер для отправки SMS: в приоритете мобильный представителя
        $targetPhone = !empty($repPhone) ? $repPhone : $companyPhone;

        return [
            'id'            => $legalEntityId,
            'inn'           => $cleanInn,
            'name'          => $title,
            'email'         => $companyEmail,
            'rep_name'      => $repName,
            'phone'         => $targetPhone,
            'company_phone' => $companyPhone
        ];
    }
}

if (!function_exists('pin_mask_phone')) {
    function pin_mask_phone(string $phone): string {
        $clean = preg_replace('/\D/', '', $phone);
        if (empty($clean)) return '';
        if (strlen($clean) === 10) $clean = '7' . $clean;
        return '+7 (' . substr($clean, 1, 3) . ') ***-**-' . substr($clean, -2);
    }
}

if (!function_exists('pin_mask_email')) {
    function pin_mask_email(string $email): string {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return '';
        $parts = explode('@', $email);
        $len = mb_strlen($parts[0]);
        $maskedUser = ($len <= 2) ? (mb_substr($parts[0], 0, 1) . '***') : (mb_substr($parts[0], 0, 2) . str_repeat('*', max(3, $len - 2)));
        return $maskedUser . '@' . $parts[1];
    }
}

try {
    $rawInput = file_get_contents('php://input');
    $input = json_decode($rawInput, true) ?: $_POST;
    $action = $_GET['action'] ?? $input['action'] ?? '';

    // =========================================================
    // 1. CHECK_INN
    // =========================================================
    if ($action === 'check_inn') {
        header('Content-Type: application/json; charset=utf-8');
        $inn = preg_replace('/\D/', '', (string)($input['inn'] ?? ''));

        if (empty($inn) || (strlen($inn) !== 10 && strlen($inn) !== 12)) {
            echo json_encode(['status' => 'error', 'message' => 'Укажите корректный ИНН (10 или 12 цифр)'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $company = pin_b2b_resolve_company($inn);
        pin_b2b_log('CHECK_INN_SUCCESS', ['inn' => $inn, 'resolved' => $company]);

        if (!$company) {
            echo json_encode(['status' => 'error', 'message' => 'Организация с таким ИНН не найдена в базе ПИН-АВТО.'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        echo json_encode([
            'status'  => 'success',
            'company' => [
                'id'           => $company['id'],
                'inn'          => $inn,
                'name'         => $company['name'],
                'rep_name'     => $company['rep_name'],
                'phone'        => $company['phone'],
                'masked_phone' => pin_mask_phone($company['phone']),
                'email'        => $company['email'],
                'masked_email' => pin_mask_email($company['email'])
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================
    // 2. SEND_CODE
    // =========================================================
    if ($action === 'send_code') {
        header('Content-Type: application/json; charset=utf-8');
        $inn     = preg_replace('/\D/', '', (string)($input['inn'] ?? ''));
        $channel = trim((string)($input['channel'] ?? 'sms'));

        $company = pin_b2b_resolve_company($inn);
        if (!$company) {
            echo json_encode(['status' => 'error', 'message' => 'Организация не найдена'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        $code = str_pad((string)random_int(1000, 9999), 4, '0', STR_PAD_LEFT);
        $cacheDir = __DIR__ . '/cache';
        if (!is_dir($cacheDir)) @mkdir($cacheDir, 0777, true);
        $otpFile = $cacheDir . '/otp_b2b_tokens.json';

        $storage = file_exists($otpFile) ? (json_decode(@file_get_contents($otpFile), true) ?: []) : [];
        $storage[$inn] = ['code' => $code, 'channel' => $channel, 'inn' => $inn, 'time' => time()];
        @file_put_contents($otpFile, json_encode($storage, JSON_UNESCAPED_UNICODE), LOCK_EX);

        pin_b2b_log('OTP_CODE_ISSUED', ['inn' => $inn, 'channel' => $channel, 'code' => $code]);

        $gateways = pin_b2b_get_gateways();

        if ($channel === 'sms' && !empty($company['phone'])) {
            $smsCfg = $gateways['sms'] ?? [];
            $apiKey = $smsCfg['api_key'] ?? '';
            $digits = preg_replace('/\D/', '', $company['phone']);
            if (strlen($digits) === 10) $digits = '7' . $digits;
            elseif (strlen($digits) === 11 && $digits[0] === '8') $digits = '7' . substr($digits, 1);

            $text = "Код подтверждения входа в B2B кабинет ПИН-АВТО: {$code}";
            $url  = "https://sms.ru/sms/send?api_id=" . urlencode($apiKey) . "&to=" . urlencode($digits) . "&msg=" . urlencode($text) . "&json=1";
            $ch = curl_init($url);
            curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_SSL_VERIFYPEER => false]);
            $res = curl_exec($ch);
            curl_close($ch);
            pin_b2b_log('SMS_RESULT', ['res' => json_decode($res, true) ?: $res]);
        } elseif ($channel === 'email' && !empty($company['email'])) {
            $smtpCfg = $gateways['smtp'] ?? [];
            $host = $smtpCfg['host'] ?? '';
            $port = intval($smtpCfg['port'] ?? 465);
            $user = $smtpCfg['username'] ?? '';
            $pass = $smtpCfg['password'] ?? '';
            $from = $smtpCfg['from_name'] ?? 'ПИН-АВТО B2B';

            $subject  = "{$code} — код для входа в B2B кабинет";
            $textBody = "Код подтверждения: {$code}";
            $htmlBody = "<p>Код подтверждения для входа в кабинет организации {$company['name']}: <b>{$code}</b></p>";

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
                    $w("RCPT TO: <{$company['email']}>"); $r();
                    $w("DATA"); $r();

                    $boundary = "----=_Part_" . md5(uniqid());
                    $h  = "From: =?UTF-8?B?" . base64_encode($from) . "?= <{$user}>\r\n";
                    $h .= "To: <{$company['email']}>\r\nSubject: =?UTF-8?B?" . base64_encode($subject) . "?=\r\n";
                    $h .= "MIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n\r\n";
                    $b  = "--{$boundary}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n{$textBody}\r\n\r\n";
                    $b .= "--{$boundary}\r\nContent-Type: text/html; charset=utf-8\r\n\r\n{$htmlBody}\r\n\r\n--{$boundary}--\r\n.";

                    $w($h . $b); $r();
                    $w("QUIT"); fclose($sock);
                    pin_b2b_log('EMAIL_SENT_SUCCESS', ['to' => $company['email']]);
                }
            }
        }

        echo json_encode(['status' => 'success', 'message' => 'Код отправлен', 'debug_code' => $code], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // =========================================================
    // 3. VERIFY_CODE
    // =========================================================
    if ($action === 'verify_code') {
        header('Content-Type: application/json; charset=utf-8');
        $inn  = preg_replace('/\D/', '', (string)($input['inn'] ?? ''));
        $code = trim((string)($input['code'] ?? ''));

        $otpFile = __DIR__ . '/cache/otp_b2b_tokens.json';
        $storage = file_exists($otpFile) ? (json_decode(@file_get_contents($otpFile), true) ?: []) : [];

        if (!isset($storage[$inn]) || strval($storage[$inn]['code']) !== strval($code)) {
            echo json_encode(['status' => 'error', 'message' => 'Неверный проверочный код'], JSON_UNESCAPED_UNICODE);
            exit;
        }

        unset($storage[$inn]);
        @file_put_contents($otpFile, json_encode($storage, JSON_UNESCAPED_UNICODE), LOCK_EX);

        $company = pin_b2b_resolve_company($inn);
        echo json_encode(['status' => 'success', 'company' => $company], JSON_UNESCAPED_UNICODE);
        exit;
    }

    echo json_encode(['status' => 'error', 'message' => 'Неизвестное действие'], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    pin_b2b_log('CRITICAL_ERROR', ['error' => $e->getMessage()]);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
}