<?php
/**
 * ПИН-АВТО — Веб-мастер создания первого администратора (admin/setup_user.php)
 *
 * Нужен, когда нет доступа к консоли сервера (PHP CLI). Откройте в браузере:
 *     https://ваш-домен/admin/setup_user.php
 * заполните форму — пользователь сохранится в admin/admin_users.json (bcrypt).
 *
 * МЕРЫБЕЗОПАСНОСТИ:
 *  - Если администраторы уже есть в admin_users.json — мастер блокируется (403),
 *    чтобы кто-то посторонний не создал себе доступ.
 *  - После успешного создания аккаунта УДАЛИТЕ этот файл с сервера.
 */

$usersFile = __DIR__ . '/admin_users.json';
$error  = '';
$done   = '';

// Уже есть пользователи? Мастер закрываем.
$existing = [];
if (is_file($usersFile)) {
    $decoded = json_decode((string)file_get_contents($usersFile), true);
    if (is_array($decoded)) $existing = $decoded;
}
$blocked = count($existing) > 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !$blocked) {
    $login    = trim((string)($_POST['login'] ?? ''));
    $password = (string)($_POST['password'] ?? '');
    $password2= (string)($_POST['password2'] ?? '');

    if ($login === '' || !preg_match('/^[a-zA-Z0-9_.@-]{3,32}$/', $login)) {
        $error = 'Логин: 3–32 символа, только латиница, цифры, _ . @ -';
    } elseif (strlen($password) < 8) {
        $error = 'Пароль должен быть не короче 8 символов.';
    } elseif ($password !== $password2) {
        $error = 'Пароли не совпадают.';
    } else {
        $existing[$login] = [
            'hash'       => password_hash($password, PASSWORD_DEFAULT),
            'updated_at' => date('Y-m-d H:i:s'),
        ];
        $ok = file_put_contents(
            $usersFile,
            json_encode($existing, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n",
            LOCK_EX
        );
        if ($ok === false) {
            $error = 'Не удалось записать admin_users.json — проверьте права на запись в каталог admin/.';
        } else {
            @chmod($usersFile, 0640);
            $done = 'Готово! Пользователь «' . htmlspecialchars($login, ENT_QUOTES) . '» создан.';
            $blocked = true; // после создания — блокируем повторный запуск
        }
    }
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>ПИН-АВТО — Создание администратора</title>
<link rel="stylesheet" href="../css/main.css">
<link rel="stylesheet" href="../css/pages.css">
</head>
<body class="auth-center">
<div class="login-wrapper">
  <div class="login-card-box">
    <div class="brand-header-row">
        <img src="../favicons/apple-touch-icon.png" alt="ПИН-АВТО" class="brand-logo-img">
        <span class="brand-title-text">ПИН-АВТО · Настройка админки</span>
    </div>
    <div class="dashed-divider bottom"></div>

    <h1 class="auth-title">Создание администратора</h1>
    <p class="auth-subtitle">Мастер одноразовой начальной настройки</p>

    <?php if ($blocked && $done): ?>
      <div class="message success"><?= $done ?></div>
      <p style="margin-top:12px;font-size:14px;">
        Теперь войдите: <a href="login.php">/admin/login.php</a><br>
        ⚠️ <b>Обязательно удалите файл setup_user.php с сервера.</b>
      </p>
    <?php elseif ($blocked): ?>
      <div class="message error">
        В admin_users.json уже есть учётные записи — мастер заблокирован.<br>
        Для добавления следующего администратора используйте
        <code>php admin/make_admin_hash.php &lt;логин&gt; "&lt;пароль&gt;"</code>
        или вручную отредактируйте файл.
      </div>
      <p style="margin-top:12px;font-size:14px;"><a href="login.php">Перейти ко входу →</a></p>
    <?php else: ?>
      <?php if ($error): ?><div class="message error"><?= htmlspecialchars($error, ENT_QUOTES) ?></div><?php endif; ?>
      <form method="post" autocomplete="off">
        <div class="form-group">
          <label class="form-label" for="login">Логин администратора</label>
          <input class="auth-input-field" id="login" name="login" type="text" required
                 pattern="[a-zA-Z0-9_.@\-]{3,32}" placeholder="например: admin">
        </div>
        <div class="form-group">
          <label class="form-label" for="password">Пароль (мин. 8 символов)</label>
          <input class="auth-input-field" id="password" name="password" type="password" required minlength="8">
        </div>
        <div class="form-group">
          <label class="form-label" for="password2">Повторите пароль</label>
          <input class="auth-input-field" id="password2" name="password2" type="password" required minlength="8">
        </div>
        <button class="submit-btn" type="submit">Создать администратора</button>
      </form>
    <?php endif; ?>
  </div>
</div>
</body>
</html>
