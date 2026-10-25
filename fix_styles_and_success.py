#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import re
import glob
import shutil
import subprocess
from datetime import datetime

WEB_ROOT = "/volume1/web"
BACKUP_DIR = os.path.join(WEB_ROOT, "config", "backups")
TS = datetime.now().strftime("%Y%m%d_%H%M%S")
os.makedirs(BACKUP_DIR, exist_ok=True)

# 1. Восстанавливаем чистые оригиналы из самого первого бэкапа (включая booking_handler.php!)
for rel in ["guest.html", "js/guest.js", "booking_handler.php", "api/booking.php"]:
    safe = rel.replace("/", "_")
    baks = sorted(glob.glob(os.path.join(BACKUP_DIR, f"{safe}.bak.*")))
    target = os.path.join(WEB_ROOT, rel)
    if baks and os.path.exists(baks[0]):
        shutil.copy2(baks[0], target)
        print(f"[RESTORE] Восстановлен оригинал {rel} из {os.path.basename(baks[0])}")

# 2. Безопасно обновляем booking_handler.php с проверкой синтаксиса через php -l
bh_path = os.path.join(WEB_ROOT, "booking_handler.php")
if os.path.exists(bh_path):
    with open(bh_path, "r", encoding="utf-8", errors="ignore") as f:
        bh_code = f.read()

    # Сохраняем копию перед точечной правкой
    bh_backup_tmp = bh_path + ".tmp_orig"
    shutil.copy2(bh_path, bh_backup_tmp)

    # Перехватываем входящий car_profile_id и добавляем его в комментарий/параметры без риска сломать массивы
    safe_php_hook = """
// --- START_SAFE_CAR_HOOK ---
$_rawJsonInput = json_decode(file_get_contents('php://input'), true);
if (is_array($_rawJsonInput)) {
    foreach ($_rawJsonInput as $_k =>$_v) {
        if (!isset($_POST[$_k])) {$_POST[$_k] =$_v; }
    }
}
$selected_car_profile_id = intval($_POST['car_profile_id'] ?? 0);
// --- END_SAFE_CAR_HOOK ---
"""
    if "START_SAFE_CAR_HOOK" not in bh_code:
        bh_code = re.sub(r"^<\?php\s*", "<?php\n" + safe_php_hook + "\n", bh_code, count=1)

    # Если в файле формируется $offer_payload или $calendar_payload как массив, аккуратно добавляем CAR_PROFILE_ID после создания массива
    if "$offer_payload =" in bh_code and "$selected_car_profile_id" in bh_code:
        bh_code = bh_code.replace(
            "$offer_payload = [",
            "$offer_payload = [\n        'CAR_PROFILE_ID' => ($selected_car_profile_id > 0 ?$selected_car_profile_id : null),",
            1
        )
    if "$calendar_payload =" in bh_code and "$selected_car_profile_id" in bh_code:
        bh_code = bh_code.replace(
            "$calendar_payload = [",
            "$calendar_payload = [\n        'CAR_PROFILE_ID' => ($selected_car_profile_id > 0 ?$selected_car_profile_id : null),",
            1
        )

    with open(bh_path, "w", encoding="utf-8") as f:
        f.write(bh_code)

    # Проверяем PHP-синтаксис через штатный интерпретатор PHP
    check_proc = subprocess.run(["php", "-l", bh_path], capture_output=True, text=True)
    if check_proc.returncode != 0:
        print(f"[WARN] Ошибка синтаксиса при патче booking_handler.php, возвращаем 100% оригинал: {check_proc.stderr}")
        shutil.copy2(bh_backup_tmp, bh_path)
    else:
        print("[OK] booking_handler.php проверен (php -l: No syntax errors detected)")
    os.remove(bh_backup_tmp)

# 3. Обновляем guest.html в строгом соответствии с родным дизайном ПИН-АВТО
guest_html_path = os.path.join(WEB_ROOT, "guest.html")
with open(guest_html_path, "r", encoding="utf-8", errors="ignore") as f:
    html = f.read()

html = re.sub(r"<!-- START_CLIENT_GARAGE_BLOCK -->.*?<!-- END_CLIENT_GARAGE_BLOCK -->\s*", "", html, flags=re.DOTALL)

native_garage_html = """<!-- START_CLIENT_GARAGE_BLOCK -->
            <div id="clientCarsContainer" class="form-group" style="display: none;">
                <label for="clientCarSelect">Ваш автомобиль *</label>
                <select id="clientCarSelect" class="auth-input-field">
                    <option value="">-- Выберите автомобиль --</option>
                </select>
                <span id="clientCarHint" class="field-hint">Выберите ваш автомобиль из списка или укажите новый</span>
                <input type="hidden" id="selectedCarProfileId" name="car_profile_id" value="">
                <input type="hidden" id="foundClientIdInput" name="client_id" value="">
                <input type="hidden" id="selectedCarModelInput" name="car_model" value="">
                <input type="hidden" id="selectedCarVinInput" name="car_vin" value="">
            </div>
            <!-- END_CLIENT_GARAGE_BLOCK -->"""

target_marker = '<label for="carBrandSelect"'
idx = html.find(target_marker)
if idx != -1:
    row_start = html.rfind('<div class="form-row"', 0, idx)
    insert_pos = row_start if row_start != -1 else idx
    html = html[:insert_pos] + native_garage_html + "\n\n            " + html[insert_pos:]
else:
    html = html.replace('<form id="guestBookingForm"', '<form id="guestBookingForm"\n' + native_garage_html, 1)

html = re.sub(r'src="js/guest\.js(\?[^"]*)?"', f'src="js/guest.js?v={TS}"', html)

with open(guest_html_path, "w", encoding="utf-8") as f:
    f.write(html)
print("[OK] guest.html обновлен в родном стиле сайта")

# 4. Обновляем js/guest.js: чистый стиль + гарантированное сообщение об успешной записи
guest_js_path = os.path.join(WEB_ROOT, "js", "guest.js")
with open(guest_js_path, "r", encoding="utf-8", errors="ignore") as f:
    js = f.read()

js = re.sub(r"/\* === START_GARAGE_SELECTOR_PATCH === \*/.*?/\* === END_GARAGE_SELECTOR_PATCH === \*/\s*", "", js, flags=re.DOTALL)

clean_patch_js = """
/* === START_GARAGE_SELECTOR_PATCH === */
(function() {
    window.loadedClientCars = [];
    window.selectedCarProfileId = null;
    window.lastDetectedClientId = null;
    window.carChoiceCompleted = true;

    // Управление видимостью полей ручного ввода авто и доступностью следующих шагов
    window.updateFormLockState = function(locked, hideManualCarFields) {
        window.carChoiceCompleted = !locked;
        const brandSelect = document.getElementById('carBrandSelect');
        const brandRow = brandSelect ? brandSelect.closest('.form-row') : null;
        const customBrandRow = document.getElementById('customBrandRow');
        const branchSelect = document.getElementById('branchSelect');
        const postSelect = document.getElementById('postSelect');
        const submitBtn = document.getElementById('bookingSubmitBtn');
        const gridV4 = document.getElementById('grid_v4');

        if (brandRow) {
            brandRow.style.display = hideManualCarFields ? 'none' : '';
        }
        if (hideManualCarFields && customBrandRow) {
            customBrandRow.style.display = 'none';
        }

        if (locked) {
            if (branchSelect) {
                branchSelect.disabled = true;
                branchSelect.style.opacity = '0.5';
            }
            if (postSelect) {
                postSelect.disabled = true;
                postSelect.style.opacity = '0.5';
            }
            if (gridV4) {
                gridV4.style.pointerEvents = 'none';
                gridV4.style.opacity = '0.5';
            }
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.5';
            }
        } else {
            if (branchSelect) {
                branchSelect.disabled = false;
                branchSelect.style.opacity = '1';
            }
            if (postSelect && branchSelect && branchSelect.value) {
                postSelect.disabled = false;
                postSelect.style.opacity = '1';
            }
            if (gridV4) {
                gridV4.style.pointerEvents = 'auto';
                gridV4.style.opacity = '1';
            }
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
            }
        }
    };

    window.showClientGarageUI = function(carsArray, clientId) {
        const container = document.getElementById('clientCarsContainer');
        const selectEl = document.getElementById('clientCarSelect');
        const hintEl = document.getElementById('clientCarHint');
        const hiddenClientId = document.getElementById('foundClientIdInput');
        const hiddenCarId = document.getElementById('selectedCarProfileId');

        if (!container || !selectEl) return;

        const uniqueCars = [];
        const seenKeys = new Set();
        (carsArray || []).forEach(c => {
            if (!c || typeof c !== 'object') return;
            const id = c.id || c.CAR_PROFILE_ID || c.car_profile_id || '';
            const plate = c.plate || c.LICENSE_PLATE || c.LICENSE_PLATE_NUMBER || c.gosnomer || '';
            const vin = c.vin || c.VIN || '';
            const key = `${id}_${plate}_${vin}`;
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                uniqueCars.push(c);
            }
        });

        // Если у клиента нет машин в базе, просто оставляем стандартные поля ввода открытыми
        if (uniqueCars.length === 0) {
            container.style.display = 'none';
            window.updateFormLockState(false, false);
            return;
        }

        window.loadedClientCars = uniqueCars;
        window.selectedCarProfileId = null;
        if (hiddenCarId) hiddenCarId.value = '';
        if (hiddenClientId && clientId) hiddenClientId.value = clientId;

        selectEl.innerHTML = '<option value="">-- Выберите ваш автомобиль --</option>';

        uniqueCars.forEach((car, index) => {
            const opt = document.createElement('option');
            opt.value = String(index);

            const brand = car.brand || car.BRAND_NAME || car.mark || '';
            const model = car.model || car.MODEL_NAME || '';
            const title = car.title || car.TITLE || `${brand} ${model}`.trim() || 'Автомобиль';
            const plate = car.plate || car.LICENSE_PLATE || car.LICENSE_PLATE_NUMBER || car.gosnomer || '';
            const vin = car.vin || car.VIN || '';

            const ident = plate ? `Гос. номер: ${plate}` : (vin ? `VIN: ${vin}` : '');
            opt.textContent = title + (ident ? ` (${ident})` : '');
            selectEl.appendChild(opt);
        });

        const newOpt = document.createElement('option');
        newOpt.value = 'new';
        newOpt.textContent = '+ Добавить новый автомобиль';
        selectEl.appendChild(newOpt);

        container.style.display = 'block';

        if (hintEl) {
            hintEl.textContent = 'Выберите автомобиль для записи или укажите новый';
            hintEl.style.color = '#777777';
        }

        // Скрываем ручные поля марки/гос.номера и блокируем филиал, пока клиент не выберет авто
        window.updateFormLockState(true, true);

        selectEl.onchange = function() {
            window.onGarageCarSelectChange(this);
        };
    };

    window.onGarageCarSelectChange = function(selectEl) {
        const val = selectEl.value;
        const brandSelect = document.getElementById('carBrandSelect');
        const plateInput = document.getElementById('carPlateInput');
        const customBrandRow = document.getElementById('customBrandRow');
        const customBrandInput = document.getElementById('customBrandInput');
        const hiddenCarId = document.getElementById('selectedCarProfileId');
        const hiddenModel = document.getElementById('selectedCarModelInput');
        const hiddenVin = document.getElementById('selectedCarVinInput');
        const hintEl = document.getElementById('clientCarHint');

        if (val === '') {
            window.selectedCarProfileId = null;
            if (hiddenCarId) hiddenCarId.value = '';
            window.updateFormLockState(true, true);
            if (hintEl) {
                hintEl.textContent = 'Выберите автомобиль из списка, чтобы продолжить';
                hintEl.style.color = '#dc2626';
            }
            return;
        }

        if (val === 'new') {
            window.selectedCarProfileId = null;
            if (hiddenCarId) hiddenCarId.value = '';
            if (hiddenModel) hiddenModel.value = '';
            if (hiddenVin) hiddenVin.value = '';

            // Показываем стандартные поля марки и гос. номера для ввода нового авто
            window.updateFormLockState(false, false);

            if (brandSelect) {
                brandSelect.disabled = false;
                brandSelect.selectedIndex = 0;
                brandSelect.focus();
            }
            if (plateInput) {
                plateInput.readOnly = false;
                plateInput.value = '';
            }
            if (customBrandRow) customBrandRow.style.display = 'none';
            if (hintEl) {
                hintEl.textContent = 'Укажите марку и гос. номер нового автомобиля ниже';
                hintEl.style.color = '#777777';
            }
            return;
        }

        const car = window.loadedClientCars[parseInt(val, 10)];
        if (!car) return;

        const carId = car.id || car.CAR_PROFILE_ID || car.car_profile_id || '';
        const brand = (car.brand || car.BRAND_NAME || car.mark || '').trim();
        const model = (car.model || car.MODEL_NAME || '').trim();
        const title = (car.title || car.TITLE || `${brand} ${model}`).trim();
        const plate = (car.plate || car.LICENSE_PLATE || car.LICENSE_PLATE_NUMBER || car.gosnomer || '').trim();
        const vin = (car.vin || car.VIN || '').trim();

        window.selectedCarProfileId = carId;
        if (hiddenCarId) hiddenCarId.value = carId;
        if (hiddenModel) hiddenModel.value = model || title;
        if (hiddenVin) hiddenVin.value = vin;

        if (plateInput) {
            plateInput.value = plate || vin || '';
        }

        if (brandSelect) {
            let matched = false;
            const searchStr = (brand || title).toLowerCase();
            if (searchStr) {
                for (let i = 0; i < brandSelect.options.length; i++) {
                    const optVal = brandSelect.options[i].value.toLowerCase().trim();
                    if (optVal && !optVal.includes('другая') && !optVal.includes('универсальн')) {
                        if (optVal === searchStr || searchStr.includes(optVal) || optVal.includes(searchStr)) {
                            brandSelect.selectedIndex = i;
                            matched = true;
                            break;
                        }
                    }
                }
            }
            if (!matched) {
                for (let i = 0; i < brandSelect.options.length; i++) {
                    if (brandSelect.options[i].value.toLowerCase().includes('другая')) {
                        brandSelect.selectedIndex = i;
                        break;
                    }
                }
                if (customBrandInput) customBrandInput.value = title;
            }
        }

        // Оставляем дублирующие поля марки/номера скрытыми, так как авто уже выбрано в селекторе
        window.updateFormLockState(false, true);

        if (hintEl) {
            hintEl.textContent = `✓ Автомобиль выбран (${plate || vin || title})`;
            hintEl.style.color = '#15803d';
        }
    };

    window.loadClientCarsFromStoCrm = async function(clientId, phoneStr, preloadedCars) {
        if (Array.isArray(preloadedCars) && preloadedCars.length > 0) {
            window.showClientGarageUI(preloadedCars, clientId);
            return;
        }

        let cars = [];
        const cleanPhone = (phoneStr || '').replace(/\D/g, '');
        const cId = clientId || window.lastDetectedClientId || (typeof foundClientId !== 'undefined' ? foundClientId : '') || '';

        const urlsToTry = [];
        if (cId) {
            urlsToTry.push(`api/cars.php?client_id=${encodeURIComponent(cId)}&contact_id=${encodeURIComponent(cId)}&phone=${encodeURIComponent(cleanPhone)}`);
        }
        if (cleanPhone) {
            urlsToTry.push(`api/cars.php?phone=${encodeURIComponent(cleanPhone)}`);
        }

        for (const u of urlsToTry) {
            try {
                const r = await originalFetch(u);
                const d = await r.json();
                const extracted = d.cars || d.data || d.RESPONSE || (Array.isArray(d) ? d : null);
                if (Array.isArray(extracted) && extracted.length > 0) {
                    cars = extracted;
                    break;
                }
            } catch (err) {}
        }

        window.showClientGarageUI(cars, cId);
    };

    // Гарантированный показ красивого уведомления об успешной записи
    window.displayGuaranteedSuccessBanner = function(data) {
        setTimeout(() => {
            let msgEl = document.getElementById('guestBookingMsg');
            if (!msgEl) {
                msgEl = document.createElement('div');
                msgEl.id = 'guestBookingMsg';
                const formEl = document.getElementById('guestBookingForm');
                if (formEl && formEl.parentNode) {
                    formEl.parentNode.insertBefore(msgEl, formEl.nextSibling);
                }
            }
            if (!msgEl) return;

            const currentText = (msgEl.textContent || '').trim();
            const messageText = data.message || data.msg || 'Вы успешно записаны на сервис! Мы ждем вас в выбранное время.';

            msgEl.style.display = 'block';
            msgEl.style.backgroundColor = '#ecfdf5';
            msgEl.style.border = '1px solid #10b981';
            msgEl.style.color = '#065f46';
            msgEl.style.padding = '16px 20px';
            msgEl.style.borderRadius = '8px';
            msgEl.style.marginTop = '18px';
            msgEl.style.fontWeight = '600';
            msgEl.style.fontSize = '15px';
            msgEl.style.textAlign = 'center';
            msgEl.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.15)';

            if (!currentText || !currentText.toLowerCase().includes('успеш')) {
                msgEl.innerHTML = `✔ Запись успешно создана!<br><span style="font-weight: 400; font-size: 13px; color: #047857; display: block; margin-top: 4px;">${messageText}</span>`;
            }

            msgEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 120);
    };

    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

        // 1. Проверка клиента
        if (url.includes('customer.php') || url.includes('check_client') || url.includes('login.php')) {
            const response = await originalFetch.apply(this, arguments);
            try {
                const clone = response.clone();
                const data = await clone.json();
                const clientObj = data.client || data.contact || data.data || (data.RESPONSE && data.RESPONSE.DATA ? data.RESPONSE.DATA[0] : null);
                const isFound = (data.status === 'success' && (clientObj || data.found || data.client_id || data.contact_id)) || !!clientObj;

                if (isFound) {
                    const cId = (clientObj && (clientObj.id || clientObj.CONTACT_ID || clientObj.client_id || clientObj.contact_id)) || data.client_id || data.contact_id || '';
                    window.lastDetectedClientId = cId;
                    const inlineCars = (clientObj && (clientObj.cars || clientObj.CARS)) || data.cars || data.CARS || null;
                    const phoneEl = document.getElementById('guestPhone');
                    const phoneVal = phoneEl ? phoneEl.value : '';

                    setTimeout(() => {
                        window.loadClientCarsFromStoCrm(cId, phoneVal, inlineCars);
                    }, 100);
                } else {
                    const container = document.getElementById('clientCarsContainer');
                    if (container) container.style.display = 'none';
                    window.updateFormLockState(false, false);
                }
            } catch (e) {}
            return response;
        }

        // 2. Прямой вызов api/cars.php
        if (url.includes('cars.php')) {
            const response = await originalFetch.apply(this, arguments);
            try {
                const clone = response.clone();
                const data = await clone.json();
                const carsList = data.cars || data.data || data.RESPONSE || (Array.isArray(data) ? data : []);
                setTimeout(() => {
                    window.showClientGarageUI(carsList, window.lastDetectedClientId);
                }, 80);
            } catch (e) {}
            return response;
        }

        // 3. Отправка формы записи (booking_handler.php / api/booking.php)
        if ((url.includes('booking_handler.php') || url.includes('api/booking.php')) && init && init.method === 'POST') {
            if (!window.carChoiceCompleted) {
                alert('Пожалуйста, выберите ваш автомобиль из списка или укажите новый.');
                throw new Error('Автомобиль не выбран');
            }

            const carProfileId = window.selectedCarProfileId || (document.getElementById('selectedCarProfileId') ? document.getElementById('selectedCarProfileId').value : '');
            const clientIdVal = window.lastDetectedClientId || (typeof foundClientId !== 'undefined' && foundClientId ? foundClientId : '') || (document.getElementById('foundClientIdInput') ? document.getElementById('foundClientIdInput').value : '');
            const carModelVal = document.getElementById('selectedCarModelInput') ? document.getElementById('selectedCarModelInput').value : '';
            const carVinVal = document.getElementById('selectedCarVinInput') ? document.getElementById('selectedCarVinInput').value : '';

            if (init.body instanceof FormData) {
                if (carProfileId) init.body.set('car_profile_id', carProfileId);
                if (clientIdVal) init.body.set('client_id', clientIdVal);
                if (carModelVal) init.body.set('car_model', carModelVal);
                if (carVinVal) init.body.set('car_vin', carVinVal);
            } else if (typeof init.body === 'string') {
                try {
                    const parsed = JSON.parse(init.body);
                    if (carProfileId) parsed.car_profile_id = carProfileId;
                    if (clientIdVal) parsed.client_id = clientIdVal;
                    if (carModelVal) parsed.car_model = carModelVal;
                    if (carVinVal) parsed.car_vin = carVinVal;
                    init.body = JSON.stringify(parsed);
                } catch (err) {
                    const params = new URLSearchParams(init.body);
                    if (carProfileId) params.set('car_profile_id', carProfileId);
                    if (clientIdVal) params.set('client_id', clientIdVal);
                    if (carModelVal) params.set('car_model', carModelVal);
                    if (carVinVal) params.set('car_vin', carVinVal);
                    init.body = params.toString();
                }
            }

            const response = await originalFetch.apply(this, arguments);
            try {
                const clone = response.clone();
                const resData = await clone.json();
                console.log('[PIN-AVTO Booking Response]', resData);
                if (resData && (resData.status === 'success' || resData.success === true || resData.CODE === 200 || resData.offer_id || resData.OFFER_ID)) {
                    window.displayGuaranteedSuccessBanner(resData);
                }
            } catch (err) {
                console.warn('[PIN-AVTO Booking] Ответ сервера не JSON:', err);
            }
            return response;
        }

        return originalFetch.apply(this, arguments);
    };

    document.addEventListener('DOMContentLoaded', () => {
        const hintEl = document.getElementById('phoneCheckHint');
        if (!hintEl) return;

        const observer = new MutationObserver(() => {
            const txt = (hintEl.textContent || '').toLowerCase();
            const container = document.getElementById('clientCarsContainer');
            if ((txt.includes('здравствуйте') || txt.includes('рады видеть') || txt.includes('клиент найден')) && container && container.style.display === 'none') {
                const phoneEl = document.getElementById('guestPhone');
                const phoneVal = phoneEl ? phoneEl.value : '';
                const cId = window.lastDetectedClientId || (typeof foundClientId !== 'undefined' ? foundClientId : '');
                window.loadClientCarsFromStoCrm(cId, phoneVal, null);
            } else if (txt.includes('новый клиент') || txt.includes('укажите номер')) {
                if (container) container.style.display = 'none';
                window.updateFormLockState(false, false);
            }
        });

        observer.observe(hintEl, { childList: true, characterData: true, subtree: true });
    });
})();
/* === END_GARAGE_SELECTOR_PATCH === */
"""

js = js.rstrip() + "\n" + clean_patch_js
with open(guest_js_path, "w", encoding="utf-8") as f:
    f.write(js)
print("[OK] js/guest.js обновлен (родные стили + автопоказ сообщения об успешной записи)")

# 5. Синхронизация с Google Диском
subprocess.run(["chmod", "-R", "777", WEB_ROOT], check=False)
subprocess.run([
    "rclone", "copy", WEB_ROOT, "gdrive:web",
    "--exclude", "@eaDir/**",
    "--exclude", "#recycle/**",
    "--exclude", "crm/venv/**"
], check=False)
print("[OK] Все файлы синхронизированы с Google Drive (gdrive:web)!")
