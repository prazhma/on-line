<?php

class MailTemplateService
{
    /**
     * Формирует тему письма с кодом для мгновенного отображения в уведомлениях
     */
    public static function getOtpSubject(string $code): string
    {
        return "{$code} — ваш проверочный код для входа в ПИН-АВТО";
    }

    /**
     * Возвращает текстовую версию письма (для почтовых клиентов без поддержки HTML)
     */
    public static function getOtpText(string $code): string
    {
        return "Ваш проверочный код для входа в личный кабинет ПИН-АВТО: {$code}\n\n"
             . "Код действителен в течение 5 минут.\n"
             . "Если вы не запрашивали данный код, проигнорируйте это сообщение.\n\n"
             . "Сеть шинных центров и автосервисов «ПИН-АВТО»\nhttps://pin-avto.ru";
    }

    /**
     * Генерирует адаптивное кроссплатформенное HTML-письмо
     */
    public static function renderOtpHtml(string $code): string
    {
        $ip = $_SERVER['HTTP_X_REAL_IP'] 
           ?? $_SERVER['HTTP_X_FORWARDED_FOR'] 
           ?? $_SERVER['REMOTE_ADDR'] 
           ?? '127.0.0.1';
        $ip = trim(explode(',', $ip)[0]);
        $dateTime = date('d.m.Y H:i:s');

        return <<<HTML
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Код подтверждения входа</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #222222;">
  
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f4f5f7; padding: 30px 10px;">
    <tr>
      <td align="center">
        
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 18px rgba(0, 0, 0, 0.05); border: 1px solid #e5e7eb;">
          
          <!-- Шапка -->
          <tr>
            <td style="padding: 24px 30px; background-color: #ffffff; border-bottom: 2px solid #e30613;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 800; letter-spacing: 0.5px; color: #222222;">
                      <span style="color: #e30613;">ПИН</span>-АВТО
                    </span>
                  </td>
                  <td align="right" style="font-size: 12px; color: #888888;">
                    Личный кабинет
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Тело письма -->
          <tr>
            <td style="padding: 32px 30px 24px 30px;">
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 700; color: #111827;">Вход в личный кабинет</h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.5; color: #4b5563;">
                Здравствуйте! Вы запросили одноразовый пароль для авторизации в онлайн-сервисе сети шинных центров и автосервисов «ПИН-АВТО».
              </p>

              <!-- Блок кода -->
              <div style="background-color: #fff8f8; border: 1.5px dashed #e30613; border-radius: 10px; padding: 18px; text-align: center; margin: 24px 0;">
                <div style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; color: #e30613; margin-bottom: 6px;">
                  Одноразовый проверочный код
                </div>
                <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #111827; padding-left: 10px;">
                  {$code}
                </div>
                <div style="font-size: 12px; color: #6b7280; margin-top: 8px;">
                  ⏱ Код действителен <b>5 минут</b>
                </div>
              </div>

              <!-- Блок безопасности -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f9fafb; border-radius: 8px; padding: 14px 16px; margin-bottom: 22px;">
                <tr>
                  <td style="font-size: 12px; line-height: 1.5; color: #6b7280;">
                    🔒 <b>Безопасность:</b> Не сообщайте этот код никому, включая сотрудников автосервиса. Если вы не запрашивали код, проигнорируйте письмо — доступ к вашему профилю защищен.
                  </td>
                </tr>
              </table>

              <!-- Служебная информация -->
              <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.4;">
                Время запроса: {$dateTime} (МСК)<br>
                IP-адрес инициатора: {$ip}
              </p>
            </td>
          </tr>

          <!-- Подвал -->
          <tr>
            <td style="background-color: #fafafa; border-top: 1px solid #f0f0f0; padding: 20px 30px; text-align: center;">
              <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 600; color: #4b5563;">
                Сеть шинных центров и автосервисов «ПИН-АВТО»
              </p>
              <p style="margin: 0 0 10px 0; font-size: 12px; color: #9ca3af;">
                <a href="https://pin-avto.ru" target="_blank" style="color: #e30613; text-decoration: none; font-weight: 600;">pin-avto.ru</a> • Техобслуживание, шиномонтаж и автотовары
              </p>
              <p style="margin: 0; font-size: 11px; color: #b0b5be;">
                Это системное уведомление. Пожалуйста, не отвечайте на данное письмо.
              </p>
            </td>
          </tr>

        </table>
        
      </td>
    </tr>
  </table>

</body>
</html>
HTML;
    }
}