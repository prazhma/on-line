<?php
/**
 * ПИН-АВТО — Страница входа в админ-панель (admin/login.php)
 */
require __DIR__ . '/admin_auth.php';

if (admin_is_logged_in()) {
    header('Location: admin.php', true, 302);
    exit;
}

$error = '';
$okUsers = count(admin_users()) > 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $login    = trim($_POST['login'] ?? '');
    $password = (string)($_POST['password'] ?? '');
    if ($login !== '' && $password !== '' && admin_attempt_login($login, $password)) {
        header('Location: admin.php', true, 302);
        exit;
    }
    $error = 'Неверный логин или пароль (или превышено число попыток). Попробуйте позже.';
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Вход в админ-панель | ПИН-АВТО</title>
    <link rel="icon" type="image/x-icon" href="../favicons/favicon.ico">
    <link rel="stylesheet" href="../css/main.css">
    <style>
        body { background: #0f1620; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
        .admin-login-card { width: 340px; padding: 28px; border-radius: 14px; background: #1a2332; box-shadow: 0 10px 30px rgba(0,0,0,.45); color: #e8edf4; font-family: system-ui, sans-serif; }
        .admin-login-card h1 { font-size: 19px; margin: 0 0 4px; }
        .admin-login-card p.sub { font-size: 12.5px; color: #8fa0b5; margin: 0 0 18px; }
        .admin-login-card label { display: block; font-size: 12.5px; color: #8fa0b5; margin: 10px 0 4px; }
        .admin-login-card input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 8px; border: 1px solid #2c3a4f; background: #101826; color: #e8edf4; font-size: 14px; }
        .admin-login-card input:focus { outline: none; border-color: #4d7fff; }
        .admin-login-card button { width: 100%; margin-top: 18px; padding: 11px; border: none; border-radius: 8px; background: #4d7fff; color: #fff; font-size: 14.5px; font-weight: 600; cursor: pointer; }
        .admin-login-card button:hover { background: #3c6ae6; }
        .admin-login-error { margin-top: 14px; padding: 10px 12px; border-radius: 8px; background: rgba(224, 82, 82, .14); border: 1px solid rgba(224, 82, 82, .4); color: #ff9d9d; font-size: 12.5px; }
        .admin-login-warn { margin-top: 14px; padding: 10px 12px; border-radius: 8px; background: rgba(240, 180, 60, .12); border: 1px solid rgba(240, 180, 60, .35); color: #ffd98a; font-size: 12px; line-height: 1.45; }
    </style>
</head>
<body>
<form class="admin-login-card" method="post" autocomplete="off">
    <h1>🛡️ Панель управления ПИН-АВТО</h1>
    <p class="sub">Доступ только для авторизованных администраторов</p>

    <?php if (!$okUsers): ?>
        <div class="admin-login-warn">
            Учётные записи не найдены.<br>
            Создайте файл <code>admin/admin_users.json</code> и сгенерируйте хэш:<br>
            <code>php admin/make_admin_hash.php login "пароль"</code>
        </div>
    <?php endif; ?>

    <label for="login">Логин</label>
    <input id="login" name="login" type="text" required autofocus maxlength="64" autocomplete="username">

    <label for="password">Пароль</label>
    <input id="password" name="password" type="password" required maxlength="128" autocomplete="current-password">

    <button type="submit">Войти</button>

    <?php if ($error !== ''): ?>
        <div class="admin-login-error"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
    <?php endif; ?>
</form>
</body>
</html>
