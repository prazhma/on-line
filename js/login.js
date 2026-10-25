/* ============================================================
   ПИН-АВТО — КЛИЕНТСКАЯ АВТОРИЗАЦИЯ B2C И B2B (JS/LOGIN.JS)
   ============================================================ */

let currentAuthRole = 'b2c';
let currentPhone = '';
let currentChannel = 'sms';
let timerInterval = null;

let b2bState = {
    inn: '',
    company: null
};

document.addEventListener('DOMContentLoaded', () => {
    initOtpInputs();
});

function switchAuthRole(role) {
    currentAuthRole = role;

    document.querySelectorAll('.auth-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.auth-tab-pane').forEach(p => p.classList.remove('active'));

    const tabBtn = document.getElementById(role === 'b2c' ? 'tabBtnB2C' : 'tabBtnB2B');
    const pane = document.getElementById(role === 'b2c' ? 'paneB2C' : 'paneB2B');

    if (tabBtn) tabBtn.classList.add('active');
    if (pane) pane.classList.add('active');

    hideMessage('phoneMsg');
    hideMessage('b2bMsg');
}

function goToStep(step) {
    document.getElementById('stepPhone').style.display = 'none';
    document.getElementById('stepChannel').style.display = 'none';
    document.getElementById('stepOtp').style.display = 'none';
    document.getElementById('stepRedirect').style.display = 'none';

    if (step === 'phone') {
        document.getElementById('stepPhone').style.display = 'block';
    } else if (step === 'channel') {
        document.getElementById('stepChannel').style.display = 'block';
    } else if (step === 'otp') {
        document.getElementById('stepOtp').style.display = 'block';
        resetOtpBoxes();
    } else if (step === 'redirect') {
        document.getElementById('stepRedirect').style.display = 'block';
    }
}

// ============================================================
// B2C ЛОГИКА (ВХОД ПО ТЕЛЕФОНУ)
// ============================================================
function handleIdentifierInput() {
    const input = document.getElementById('identifier');
    let v = input.value.replace(/\D/g, '');

    if (v.startsWith('7') || v.startsWith('8')) v = v.substring(1);
    v = v.substring(0, 10);

    let res = '+7';
    if (v.length > 0) res += ' (' + v.substring(0, 3);
    if (v.length >= 3) res += ') ' + v.substring(3, 6);
    if (v.length >= 6) res += '-' + v.substring(6, 8);
    if (v.length >= 8) res += '-' + v.substring(8, 10);

    input.value = res;
}

async function handlePhoneSubmit(e) {
    e.preventDefault();
    const phoneInput = document.getElementById('identifier');
    const digits = phoneInput.value.replace(/\D/g, '');

    if (digits.length !== 11) {
        showMessage('phoneMsg', 'Введите корректный номер мобильного телефона (10 цифр)');
        return;
    }

    currentPhone = phoneInput.value;
    const btn = document.getElementById('btnCheckPhone');
    btn.disabled = true;
    btn.textContent = 'Проверка номера...';
    hideMessage('phoneMsg');

    try {
        const res = await fetch('api/customer.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'check_client', phone: currentPhone })
        });
        const data = await res.json();

        if (data.status === 'success' && data.client) {
            document.getElementById('clientGreeting').textContent = `Здравствуйте, ${data.client.name.split(' ')[1] || data.client.name}!`;
            document.getElementById('channelSubtitle').textContent = 'Куда отправить проверочный код?';
            document.getElementById('channelSmsTitle').textContent = 'SMS-сообщение';
            document.getElementById('channelPhoneLabel').textContent = currentPhone;

            const emailCard = document.getElementById('channelEmailCard');
            const emailLabel = document.getElementById('channelEmailLabel');
            document.getElementById('channelEmailTitle').textContent = 'Электронная почта';

            if (data.client.email && data.client.masked_email) {
                emailLabel.textContent = data.client.masked_email;
                emailCard.classList.remove('disabled');
            } else {
                emailLabel.textContent = 'E-Mail не привязан к профилю';
                emailCard.classList.add('disabled');
            }

            selectChannel('sms');
            goToStep('channel');
        } else {
            showMessage('phoneMsg', data.message || 'Клиент с таким номером не найден в базе сети');
        }
    } catch (err) {
        showMessage('phoneMsg', 'Ошибка связи с сервером');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Продолжить';
    }
}

// ============================================================
// B2B ЛОГИКА (ВХОД ПО ИНН)
// ============================================================
function handleB2bInnInput() {
    const input = document.getElementById('b2bInn');
    input.value = input.value.replace(/\D/g, '');
    hideMessage('b2bMsg');
}

async function handleB2bSubmit(e) {
    e.preventDefault();
    const inn = document.getElementById('b2bInn').value.trim();
    const btn = document.getElementById('btnCheckB2b');
    hideMessage('b2bMsg');

    if (inn.length !== 10 && inn.length !== 12) {
        showMessage('b2bMsg', 'ИНН организации должен содержать 10 цифр, ИП — 12 цифр');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Поиск организации в STOCRM...';

    try {
        const checkRes = await fetch('api/auth_b2b.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'check_inn', inn: inn })
        });
        const checkData = await checkRes.json();

        if (!checkData || checkData.status !== 'success' || !checkData.company) {
            showMessage('b2bMsg', checkData.message || 'Организация с таким ИНН не найдена в базе ПИН-АВТО');
            return;
        }

        b2bState.inn = inn;
        b2bState.company = checkData.company;

        // Шапка экрана выбора канала: точное название организации
        document.getElementById('clientGreeting').textContent = checkData.company.name;
        document.getElementById('channelSubtitle').textContent = 'Выберите способ получения кода для организации:';

        // Карточка SMS представителю
        const smsCard = document.getElementById('channelSmsCard');
        const repText = checkData.company.rep_name ? ` (представитель ${checkData.company.rep_name})` : '';
        document.getElementById('channelSmsTitle').textContent = 'SMS представителю' + repText;

        if (checkData.company.phone) {
            document.getElementById('channelPhoneLabel').textContent = checkData.company.masked_phone;
            smsCard.classList.remove('disabled');
        } else {
            document.getElementById('channelPhoneLabel').textContent = 'Номер не привязан';
            smsCard.classList.add('disabled');
        }

        // Карточка Email организации
        const emailCard = document.getElementById('channelEmailCard');
        document.getElementById('channelEmailTitle').textContent = 'Корпоративный E-Mail';
        if (checkData.company.email) {
            document.getElementById('channelEmailLabel').textContent = checkData.company.masked_email;
            emailCard.classList.remove('disabled');
        } else {
            document.getElementById('channelEmailLabel').textContent = 'E-Mail не привязан в CRM';
            emailCard.classList.add('disabled');
        }

        if (checkData.company.phone) {
            selectChannel('sms');
        } else if (checkData.company.email) {
            selectChannel('email');
        }

        goToStep('channel');
    } catch (err) {
        showMessage('b2bMsg', 'Ошибка связи с сервером');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Продолжить';
    }
}

// ============================================================
// ВЫБОР КАНАЛА И ОТПРАВКА OTP
// ============================================================
function selectChannel(ch) {
    const card = document.getElementById(ch === 'sms' ? 'channelSmsCard' : 'channelEmailCard');
    if (card && card.classList.contains('disabled')) return;

    currentChannel = ch;
    document.querySelectorAll('.channel-card').forEach(c => c.classList.remove('active'));
    if (card) card.classList.add('active');
}

async function sendSelectedCode() {
    const btn = document.getElementById('btnSendCode');
    btn.disabled = true;
    btn.textContent = 'Отправка кода...';
    hideMessage('channelMsg');

    try {
        let url = '';
        let payload = {};

        if (currentAuthRole === 'b2b') {
            url = 'api/auth_b2b.php';
            payload = {
                action: 'send_code',
                inn: b2bState.inn,
                channel: currentChannel
            };
        } else {
            url = 'api/customer.php';
            payload = {
                action: 'send_code',
                phone: currentPhone,
                channel: currentChannel
            };
        }

        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
            if (currentAuthRole === 'b2b') {
                document.getElementById('otpNotice').textContent = currentChannel === 'sms'
                    ? `Код отправлен по SMS представителю (${b2bState.company.masked_phone})`
                    : `Код отправлен на корпоративную почту (${b2bState.company.masked_email})`;
            } else {
                document.getElementById('otpNotice').textContent = currentChannel === 'sms' 
                    ? `Код отправлен по SMS на номер ${currentPhone}` 
                    : 'Код отправлен на ваш адрес электронной почты';
            }

            goToStep('otp');
            startResendTimer();

            if (data.debug_code) {
                openTestModal(data.debug_code);
            }
        } else {
            showMessage('channelMsg', data.message || 'Не удалось отправить проверочный код');
        }
    } catch (err) {
        showMessage('channelMsg', 'Ошибка связи с сервером');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Отправить проверочный код';
    }
}

// ============================================================
// OTP ВВОД И ВЕРИФИКАЦИЯ
// ============================================================
function initOtpInputs() {
    const boxes = [1, 2, 3, 4].map(i => document.getElementById(`otp_${i}`));

    boxes.forEach((box, idx) => {
        if (!box) return;

        box.addEventListener('input', () => {
            const val = box.value.replace(/\D/g, '');
            box.value = val ? val[0] : '';

            if (box.value && idx < 3) {
                boxes[idx + 1].focus();
            }

            const code = boxes.map(b => b.value).join('');
            if (code.length === 4) {
                verifyOtpCode(code);
            }
        });

        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && idx > 0) {
                boxes[idx - 1].focus();
            }
        });

        box.addEventListener('paste', (e) => {
            e.preventDefault();
            const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
            if (pasteData.length >= 4) {
                for (let i = 0; i < 4; i++) {
                    boxes[i].value = pasteData[i];
                }
                verifyOtpCode(pasteData.substring(0, 4));
            }
        });
    });
}

function resetOtpBoxes() {
    [1, 2, 3, 4].forEach(i => {
        const el = document.getElementById(`otp_${i}`);
        if (el) el.value = '';
    });
    hideMessage('otpMsg');
    setTimeout(() => {
        const first = document.getElementById('otp_1');
        if (first) first.focus();
    }, 100);
}

async function verifyOtpCode(code) {
    hideMessage('otpMsg');

    try {
        if (currentAuthRole === 'b2b') {
            const res = await fetch('api/auth_b2b.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify_code', inn: b2bState.inn, code: code })
            });
            const data = await res.json();

            if (data.status === 'success' && data.company) {
                localStorage.setItem('pin_b2b_client', JSON.stringify(data.company));
                document.getElementById('redirectText').textContent = 'Загружаем корпоративный B2B кабинет...';
                goToStep('redirect');
                setTimeout(() => {
                    window.location.href = 'cabinet-b2b.html';
                }, 1000);
            } else {
                showMessage('otpMsg', data.message || 'Неверный проверочный код');
                resetOtpBoxes();
            }
        } else {
            const res = await fetch('api/customer.php', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify_code', phone: currentPhone, code: code })
            });
            const data = await res.json();

            if (data.status === 'success' && data.client) {
                localStorage.setItem('pin_client', JSON.stringify(data.client));
                document.getElementById('redirectText').textContent = 'Загружаем личный кабинет...';
                goToStep('redirect');
                setTimeout(() => {
                    window.location.href = 'cabinet.html';
                }, 1000);
            } else {
                showMessage('otpMsg', data.message || 'Неверный проверочный код');
                resetOtpBoxes();
            }
        }
    } catch (err) {
        showMessage('otpMsg', 'Ошибка проверки кода');
        resetOtpBoxes();
    }
}

function startResendTimer() {
    clearInterval(timerInterval);
    let secondsLeft = 30;

    const noticeEl = document.getElementById('resendNotice');
    const secEl = document.getElementById('resendSec');
    const btnResend = document.getElementById('btnResend');

    noticeEl.style.display = 'inline';
    btnResend.style.display = 'none';
    secEl.textContent = secondsLeft;

    timerInterval = setInterval(() => {
        secondsLeft--;
        secEl.textContent = secondsLeft;

        if (secondsLeft <= 0) {
            clearInterval(timerInterval);
            noticeEl.style.display = 'none';
            btnResend.style.display = 'inline';
        }
    }, 1000);
}

function resendOtp() {
    sendSelectedCode();
}

function openTestModal(code) {
    document.getElementById('testCodeDisplay').textContent = code;
    document.getElementById('testCodeModal').classList.add('is-open');
}

function closeTestModal() {
    document.getElementById('testCodeModal').classList.remove('is-open');
    const firstBox = document.getElementById('otp_1');
    if (firstBox) firstBox.focus();
}

function showMessage(id, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text;
    el.classList.add('is-visible');
}

function hideMessage(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('is-visible');
    el.textContent = '';
}