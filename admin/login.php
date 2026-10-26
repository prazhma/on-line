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
    <link rel="stylesheet" href="../css/pages.css">
    <style>
        /* Только мелкие дополнения к единому стилю — все базовые
           элементы (карточка, поля, кнопки, фон) берутся из main.css/pages.css */
        .admin-login-hint {
            text-align: left;
            margin-top: 14px;
            padding: 10px 12px;
            border-radius: 8px;
            background: rgba(240, 180, 60, .15);
            border: 1px solid rgba(200, 140, 30, .45);
            color: #7a5710;
            font-size: 12.5px;
            line-height: 1.5;
            font-family: var(--font-main);
        }
        .admin-login-hint code {
            font-family: var(--font-mono);
            font-size: 11.5px;
            background: rgba(255,255,255,.6);
            padding: 1px 5px;
            border-radius: 4px;
        }
    </style>
</head>
<body class="auth-center">
<div class="login-wrapper">
    <div class="login-card-box">
        <div class="brand-header-row">
            <img src="../favicons/apple-touch-icon.png" alt="ПИН-АВТО" class="brand-logo-img">
            <span class="brand-title-text">ПИН-АВТО · Админ-панель</span>
        </div>
        <div class="dashed-divider bottom"></div>

        <h1 class="auth-title">Вход для администраторов</h1>
        <p class="auth-subtitle">Доступ только для авторизованных сотрудников</p>

        <?php if (!$okUsers): ?>
            <div class="admin-login-hint">
                Учётные записи не найдены.<br>
                Создайте файл <code>admin/admin_users.json</code> и сгенерируйте хэш:<br>
                <code>php admin/make_admin_hash.php login "пароль"</code>
            </div>
        <?php endif; ?>

        <form method="post" autocomplete="off">
            <div class="form-group" style="text-align: left;">
                <label for="login">Логин</label>
                <input id="login" name="login" type="text" required autofocus maxlength="64"
                       autocomplete="username" class="auth-input-field">
            </div>
            <div class="form-group" style="text-align: left;">
                <label for="password">Пароль</label>
                <input id="password" name="password" type="password" required maxlength="128"
                       autocomplete="current-password" class="auth-input-field">
            </div>
            <button type="submit" class="submit-btn">Войти</button>
        </form>

        <?php if ($error !== ''): ?>
            <div class="message error is-visible" style="margin-top: 14px;"><?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></div>
        <?php endif; ?>
    </div>
</div>
</body>
</html>
