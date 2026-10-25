<?php
/**
 * ПИН-АВТО — Утилита генерации хэша пароля администратора (CLI)
 *
 * Использование:
 *   php admin/make_admin_hash.php <логин> "<пароль>"
 *
 * Результат добавляется/обновляется в admin/admin_users.json автоматически.
 * Максимум 3 учётные записи (по требованию «доступ 1–3 пользователям»).
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Утилита доступна только из командной строки.\n");
}

$login = $argv[1] ?? '';
$password = $argv[2] ?? '';

if ($login === '' || $password === '') {
    exit("Использование: php admin/make_admin_hash.php <логин> \"<пароль>\"\n");
}

$file = __DIR__ . '/admin_users.json';
$users = [];
if (is_file($file)) {
    $users = json_decode((string)file_get_contents($file), true);
    if (!is_array($users)) $users = [];
}

// Ограничение: не более 3 пользователей
if (!isset($users[$login]) && count($users) >= 3) {
    exit("В хранилище уже 3 администратора (максимум). Сначала удалите лишнего из admin_users.json.\n");
}

if (strlen($password) < 8) {
    exit("Пароль слишком короткий (минимум 8 символов).\n");
}

$users[$login] = [
    'hash'       => password_hash($password, PASSWORD_DEFAULT),
    'updated_at' => date('Y-m-d H:i:s'),
];

$written = file_put_contents(
    $file,
    json_encode($users, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n",
    LOCK_EX
);

if ($written === false) {
    exit("Не удалось записать {$file}. Проверьте права на каталог admin/.\n");
}

@chmod($file, 0640);
echo "Готово: пользователь \"{$login}\" сохранён в admin/admin_users.json\n";
