<?php
/**
 * Единый переключатель режима выдачи OTP-кодов для B2C и B2B.
 *
 * Режимы (файл api/cache/otp_mode.txt):
 *   show  — SMS/Email-отправка ПРИОСТАНОВЛЕНА, код возвращается в ответе API
 *           (фронт показывает его в модальном окне). Для разработки/тестов.
 *   send  — штатный режим: код отправляется по SMS или Email, клиенту не отдаётся.
 *
 * Как включить нормальную отправку (любым способом):
 *   1) php api/otp_mode.php send
 *   2) удалить файл api/cache/otp_mode.txt (по умолчанию включён режим send)
 *   3) записать в файл строку "send"
 */

if (!function_exists('otp_get_mode')) {
    function otp_get_mode(): string {
        $file = __DIR__ . '/cache/otp_mode.txt';
        if (!is_file($file)) return 'send'; // безопасное значение по умолчанию
        $mode = strtolower(trim((string)@file_get_contents($file)));
        return $mode === 'show' ? 'show' : 'send';
    }
}

// CLI: смена режима — php api/otp_mode.php show|send
if (PHP_SAPI === 'cli' && isset($argv[1])) {
    $want = strtolower(trim($argv[1]));
    if (!in_array($want, ['show', 'send'], true)) {
        fwrite(STDERR, "Использование: php otp_mode.php [show|send]\n");
        exit(1);
    }
    $dir = __DIR__ . '/cache';
    if (!is_dir($dir)) @mkdir($dir, 0777, true);
    if ($want === 'show') {
        @file_put_contents($dir . '/otp_mode.txt', 'show');
    } else {
        @unlink($dir . '/otp_mode.txt');
    }
    echo "Режим OTP: {$want}\n";
    exit(0);
}
