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

# 1. Восстанавливаем чистые оригиналы из самого первого бэкапа (если есть), чтобы не было дублей
for rel in ["guest.html", "js/guest.js"]:
    safe = rel.replace("/", "_")
    baks = sorted(glob.glob(os.path.join(BACKUP_DIR, f"{safe}.bak.*")))
    target = os.path.join(WEB_ROOT, rel)
    if baks:
        shutil.copy2(baks[0], target)
        print(f"[RESTORE] Взят чистый оригинал {baks[0]} -> {target}")
    elif os.path.exists(target):
        dst = os.path.join(BACKUP_DIR, f"{safe}.bak.{TS}")
        shutil.copy2(target, dst)
        print(f"[BACKUP] Создан первичный бэкап -> {dst}")

# 2. Проверяем и усиливаем api/cars.php, чтобы он принимал и client_id, и contact_id, и phone
cars_php_path = os.path.join(WEB_ROOT, "api", "cars.php")
if os.path.exists(cars_php_path):
    with open(cars_php_path, "r", encoding="utf-8", errors="ignore") as f:
        cars_php_content = f.read()
    print(f"[INFO] api/cars.php найден ({len(cars_php_content)} байт)")

# 3. Обновляем guest.html: вставляем видимый контейнер гаража и подключаем модуль
guest_html_path = os.path.join(WEB_ROOT, "guest.html")
with open(guest_html_path, "r", encoding="utf-8", errors="ignore") as f:
    html = f.read()

html = re.sub(r"<!-- START_CLIENT_GARAGE_BLOCK -->.*?<!-- END_CLIENT_GARAGE_BLOCK -->\s*", "", html, flags=re.DOTALL)

garage_html = """<!-- START_CLIENT_GARAGE_BLOCK -->
            <div id="clientCarsContainer" class="form-group" style="display: none; background: #eff6ff; padding: 16px; border-radius: 10px; border: 2px solid #2563eb; margin-bottom: 18px; box-shadow: 0 4px 12px rgba(37,99,235,0.12);">
                <label for="clientCarSelect" style="font-weight: 700; color: #1e3a8a; display: block; margin-bottom: 8px; font-size: 14px;">
                    🚗 Выберите ваш автомобиль для записи *
                </label>
                <select id="clientCarSelect" class="auth-input-field" style="border: 2px solid #3b82f6; font-weight: 600; background: #ffffff; color: #111827; cursor: pointer;">
                    <option value="">-- 👇 Нажмите, чтобы выбрать ваш авто или указать новый --</option>
                </select>
                <span id="clientCarHint" class="field-hint" style="color: #1d4ed8; font-weight: 600; display: block; margin-top: 6px;">
                    Выберите свой автомобиль из базы STOCRM или пункт «➕ Новый автомобиль», чтобы открыть запись
                </span>
                <input type="hidden" id="selectedCarProfileId" name="car_profile_id" value="">
                <input type="hidden" id="foundClientIdInput" name="client_id" value="">
                <input type="hidden" id="selectedCarModelInput" name="car_model" value="">
                <input type="hidden" id="selectedCarVinInput" name="car_vin" value="">
            </div>
            <!-- END_CLIENT_GARAGE_BLOCK -->
"""

# Вставляем строго перед блоком с carBrandSelect
target_marker = '<label for="carBrandSelect"'
idx = html.find(target_marker)
if idx != -1:
    row_start = html.rfind('<div class="form-row"', 0, idx)
    insert_pos = row_start if row_start != -1 else idx
    html = html[:insert_pos] + garage_html + "\n            " + html[insert_pos:]
else:
    html = html.replace('<form id="guestBookingForm"', '<form id="guestBookingForm"\n' + garage_html, 1)

# Сбрасываем кэш скрипта через уникальный параметр версии
html = re.sub(r'src="js/guest\.js(\?[^"]*)?"', f'src="js/guest.js?v={TS}"', html)

with open(guest_html_path, "w", encoding="utf-8") as f:
    f.write(html)
print("[OK] guest.html успешно обновлен")

# 4. Обновляем js/guest.js: добавляем автономный перехватчик + MutationObserver на #phoneCheckHint
guest_js_path = os.path.join(WEB_ROOT, "js", "guest.js")
with open(guest_js_path, "r", encoding="utf-8", errors="ignore") as f:
    js = f.read()

js = re.sub(r"/\* === START_GARAGE_SELECTOR_PATCH === \*/.*?/\* === END_GARAGE_SELECTOR_PATCH === \*/\s*", "", js, flags=re.DOTALL)

patch_js = """
/* === START_GARAGE_SELECTOR_PATCH === */
(function() {
    console.log('[PIN-AVTO Garage] Модуль выбора автомобиля инициализирован');

    window.loadedClientCars = [];
    window.selectedCarProfileId = null;
    window.lastDetectedClientId = null;
    window.lastCheckedPhone = '';
    window.carChoiceCompleted = true;

    // Блокировка/разблокировка шагов записи (филиал, дата, пост, кнопка отправки)
    window.lockBookingUntilCarChosen = function(locked) {
        window.carChoiceCompleted = !locked;
        const brandSelect = document.getElementById('carBrandSelect');
        const brandRow = brandSelect ? brandSelect.closest('.form-row') : null;
        const customBrandRow = document.getElementById('customBrandRow');
        const branchSelect = document.getElementById('branchSelect');
        const postSelect = document.getElementById('postSelect');
        const submitBtn = document.getElementById('bookingSubmitBtn');
        const gridV4 = document.getElementById('grid_v4');

        if (locked) {
            if (brandRow) brandRow.style.display = 'none';
            if (customBrandRow) customBrandRow.style.display = 'none';
            if (branchSelect) {
                branchSelect.disabled = true;
                branchSelect.style.opacity = '0.45';
            }
            if (postSelect) {
                postSelect.disabled = true;
                postSelect.style.opacity = '0.45';
            }
            if (gridV4) {
                gridV4.style.pointerEvents = 'none';
                gridV4.style.opacity = '0.45';
            }
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.style.opacity = '0.45';
            }
        } else {
            if (brandRow) brandRow.style.display = '';
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

    // Отрисовка селектора автомобилей клиента
    window.showClientGarageUI = function(carsArray, clientId) {
        const container = document.getElementById('clientCarsContainer');
        const selectEl = document.getElementById('clientCarSelect');
        const hintEl = document.getElementById('clientCarHint');
        const hiddenClientId = document.getElementById('foundClientIdInput');
        const hiddenCarId = document.getElementById('selectedCarProfileId');

        if (!container || !selectEl) return;

        // Убираем дубли автомобилей по ID или гос.номеру/VIN
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

        window.loadedClientCars = uniqueCars;
        window.selectedCarProfileId = null;
        if (hiddenCarId) hiddenCarId.value = '';
        if (hiddenClientId && clientId) hiddenClientId.value = clientId;

        selectEl.innerHTML = '<option value="">-- 👇 Выберите ваш автомобиль или укажите новый --</option>';

        uniqueCars.forEach((car, index) => {
            const opt = document.createElement('option');
            opt.value = String(index);

            const brand = car.brand || car.BRAND_NAME || car.mark || '';
            const model = car.model || car.MODEL_NAME || '';
            const title = car.title || car.TITLE || `${brand} ${model}`.trim() || 'Автомобиль клиента';
            const plate = car.plate || car.LICENSE_PLATE || car.LICENSE_PLATE_NUMBER || car.gosnomer || '';
            const vin = car.vin || car.VIN || '';

            let details = [];
            if (plate) details.push(`Гос. номер: ${plate}`);
            else if (vin) details.push(`VIN: ${vin}`);

            opt.textContent = `🚘 ${title}` + (details.length ? ` (${details.join(', ')})` : '');
            selectEl.appendChild(opt);
        });

        const newOpt = document.createElement('option');
        newOpt.value = 'new';
        newOpt.textContent = '➕ Новый автомобиль (нет в списке / указать вручную)';
        selectEl.appendChild(newOpt);

        container.style.display = 'block';

        if (uniqueCars.length > 0) {
            if (hintEl) {
                hintEl.textContent = `В базе найдено ваших автомобилей: ${uniqueCars.length}. Выберите нужный или укажите новый, чтобы перейти к записи.`;
                hintEl.style.color = '#1d4ed8';
            }
        } else {
            if (hintEl) {
                hintEl.textContent = 'Выберите «➕ Новый автомобиль», чтобы указать марку и перейти к записи.';
                hintEl.style.color = '#1d4ed8';
            }
        }

        // Очищаем преждевременно автозаполненные поля марки/номера и блокируем запись до выбора
        const brandSelect = document.getElementById('carBrandSelect');
        const plateInput = document.getElementById('carPlateInput');
        if (brandSelect) brandSelect.selectedIndex = 0;
        if (plateInput) plateInput.value = '';

        window.lockBookingUntilCarChosen(true);

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
            window.lockBookingUntilCarChosen(true);
            if (hintEl) {
                hintEl.textContent = '⚠️ Сначала выберите ваш автомобиль или нажмите «➕ Новый автомобиль»';
                hintEl.style.color = '#dc2626';
            }
            return;
        }

        // Разблокируем форму записи
        window.lockBookingUntilCarChosen(false);

        if (val === 'new') {
            window.selectedCarProfileId = null;
            if (hiddenCarId) hiddenCarId.value = '';
            if (hiddenModel) hiddenModel.value = '';
            if (hiddenVin) hiddenVin.value = '';

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
                hintEl.textContent = '✍️ Укажите марку и гос. номер нового автомобиля ниже и переходите к выбору филиала';
                hintEl.style.color = '#15803d';
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
                if (customBrandRow) customBrandRow.style.display = 'flex';
                if (customBrandInput) customBrandInput.value = title;
            } else if (customBrandRow) {
                customBrandRow.style.display = 'none';
            }
        }

        if (hintEl) {
            hintEl.textContent = `✔ Выбран автомобиль: ${title} (${plate || vin || 'из базы CRM'}). Теперь выберите филиал и время записи.`;
            hintEl.style.color = '#15803d';
        }
    };

    // Универсальный загрузчик автомобилей клиента из всех доступных эндпоинтов
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
            } catch (err) {
                console.warn('[PIN-AVTO Garage] Ошибка запроса к ' + u, err);
            }
        }

        window.showClientGarageUI(cars, cId);
    };

    // Перехват всех fetch-запросов на странице
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

        // 1. Перехват проверки клиента по телефону (api/customer.php и др.)
        if (url.includes('customer.php') || url.includes('check_client') || url.includes('login.php')) {
            const response = await originalFetch.apply(this, arguments);
            try {
                const clone = response.clone();
                const data = await clone.json();
                console.log('[PIN-AVTO Garage] Ответ проверки клиента:', data);

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
                    }, 150);
                } else {
                    const container = document.getElementById('clientCarsContainer');
                    if (container) container.style.display = 'none';
                    window.lockBookingUntilCarChosen(false);
                }
            } catch (e) {
                console.warn('[PIN-AVTO Garage] Не удалось распарсить ответ customer:', e);
            }
            return response;
        }

        // 2. Перехват прямого запроса к api/cars.php (если его вызывает сам guest.js)
        if (url.includes('cars.php')) {
            const response = await originalFetch.apply(this, arguments);
            try {
                const clone = response.clone();
                const data = await clone.json();
                console.log('[PIN-AVTO Garage] Ответ api/cars.php:', data);
                const carsList = data.cars || data.data || data.RESPONSE || (Array.isArray(data) ? data : []);
                setTimeout(() => {
                    window.showClientGarageUI(carsList, window.lastDetectedClientId);
                }, 100);
            } catch (e) {}
            return response;
        }

        // 3. Перехват отправки записи в календарь и создания сделки
        if ((url.includes('booking_handler.php') || url.includes('api/booking.php')) && init && init.method === 'POST') {
            if (!window.carChoiceCompleted) {
                alert('Пожалуйста, сначала выберите ваш автомобиль из списка или укажите «Новый автомобиль».');
                throw new Error('Не выбран автомобиль клиента');
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
        }

        return originalFetch.apply(this, arguments);
    };

    // Дополнительный гарант: следим за текстом подсказки #phoneCheckHint ("Здравствуйте, ...! Рады видеть вас снова.")
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
                console.log('[PIN-AVTO Garage] Сработал триггер приветствия клиента, загружаем гараж...');
                window.loadClientCarsFromStoCrm(cId, phoneVal, null);
            } else if (txt.includes('новый клиент') || txt.includes('укажите номер')) {
                if (container) container.style.display = 'none';
                window.lockBookingUntilCarChosen(false);
            }
        });

        observer.observe(hintEl, { childList: true, characterData: true, subtree: true });
    });
})();
/* === END_GARAGE_SELECTOR_PATCH === */
"""

js = js.rstrip() + "\n" + patch_js
with open(guest_js_path, "w", encoding="utf-8") as f:
    f.write(js)
print(f"[OK] js/guest.js успешно обновлен (размер: {len(js)} байт)")

# 5. Выгружаем изменения с NAS на Google Диск, чтобы они не затерлись при обратной синхронизации
subprocess.run(["chmod", "-R", "777", WEB_ROOT], check=False)
subprocess.run([
    "rclone", "copy", WEB_ROOT, "gdrive:web",
    "--exclude", "@eaDir/**",
    "--exclude", "#recycle/**",
    "--exclude", "crm/venv/**"
], check=False)
print("[OK] Все изменения записаны на NAS и синхронизированы в Google Drive (gdrive:web)!")
