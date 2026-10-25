<?php
/**
 * ПИН-АВТО — Защита админ-панели (admin/admin_auth.php)
 *
 * Логин + хэш пароля хранятся в файле admin/admin_users.json.
 * Доступ выдаётся 1–3 пользователям. Пароли в файле НЕ хранятся в открытом
 * виде — только password_hash(). Для генерации хэша:
 *     php admin/make_admin_hash.php "Логин" "Пароль"
 *
 * Подключение guarded-скриптов:
 *     require __DIR__ . '/admin_auth.php';  // на входе сразу проверяется сессия
 * Страница входа: admin/login.php, выход: admin/logout.php.
 */

// --- Хранилище пользователей -------------------------------------------------
define('ADMIN_USERS_FILE', __DIR__ . '/admin_users.json');

function admin_users(): array
{
    if (!is_file(ADMIN_USERS_FILE)) {
        return [];
    }
    $data = json_decode((string)file_get_contents(ADMIN_USERS_FILE), true);
    return is_array($data) ? $data : [];
}

/**
 * Возвращает хэш пароля пользователя или null, если пользователя нет.
 * Поддерживается формат: { "login": {"hash": "..."} } и упрощённый
 * "login": "$2y$..." (строка-хэш).
 */
function admin_user_hash(string $login): ?string
{
    foreach (admin_users() as $k => $v) {
        if ((string)$k !== $login) continue;
        if (is_array($v) && isset($v['hash'])) return (string)$v['hash'];
        if (is_string($v)) return $v;
    }
    return null;
}

// --- Сессия ------------------------------------------------------------------
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/admin/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure'   => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    @session_start();
}

function admin_is_logged_in(): bool
{
    return !empty($_SESSION['admin_logged_in']) && $_SESSION['admin_logged_in'] === true;
}

/** Проверка учётных данных с rate-limit (5 попыток с одного IP за 10 минут). */
function admin_attempt_login(string $login, string $password): bool
{
    // Простейший rate-limit на основе файла-счётчика
    $rlFile = sys_get_temp_dir() . '/pin_admin_rl_' . md5($_SERVER['REMOTE_ADDR'] ?? 'unknown') . '.json';
    $now = time();
    $attempts = [];
    if (is_file($rlFile)) {
        $attempts = json_decode((string)file_get_contents($rlFile), true) ?: [];
    }
    $attempts = array_values(array_filter($attempts, fn($t) => $now - (int)$t < 600));
    if (count($attempts) >= 5) {
        return false; // слишком много попыток
    }

    $hash = admin_user_hash($login);
    $ok = $hash !== null && password_verify($password, $hash);

    if (!$ok) {
        $attempts[] = $now;
        @file_put_contents($rlFile, json_encode($attempts));
    } else {
        @unlink($rlFile);
        session_regenerate_id(true);
        $_SESSION['admin_logged_in'] = true;
        $_SESSION['admin_login']      = $login;
        $_SESSION['admin_login_time'] = $now;
    }
    return $ok;
}

/**
 * Главная точка входа guarded-скриптов. Если вызывается из HTTP без валидной
 * сессии — отдаёт 401 (для API) или редирект на страницу входа (для страниц).
 */
function admin_require_auth(): void
{
    if (admin_is_logged_in()) return;

    if (PHP_SAPI === 'cli') {
        // CLI-запуск считается доверенным (cron, update_worker через exec php)
        $_SESSION['admin_logged_in'] = true;
        return;
    }

    $script = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $wantsJson = in_array($script, ['branch_toggle.php', 'update_worker.php'], true)
        || (strpos($_SERVER['HTTP_ACCEPT'] ?? '', 'application/json') !== false);

    if ($wantsJson) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(['status' => 'error', 'message' => 'Требуется авторизация в админ-панели'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    header('Location: login.php', true, 302);
    exit;
}
