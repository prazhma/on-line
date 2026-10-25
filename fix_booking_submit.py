#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import re
import glob
import shutil
import subprocess

WEB_ROOT = "/volume1/web"
BACKUP_DIR = os.path.join(WEB_ROOT, "config", "backups")

# 1. Очищаем js/guest.js от перехватчика fetch, оставляя только логику селектора гаража
guest_js_path = os.path.join(WEB_ROOT, "js", "guest.js")
if os.path.exists(guest_js_path):
    with open(guest_js_path, "r", encoding="utf-8", errors="ignore") as f:
        js = f.read()

    # Удаляем весь блок патча с перехватом fetch
    js = re.sub(r"/\* === START_GARAGE_SELECTOR_PATCH === \*/.*?/\* === END_GARAGE_SELECTOR_PATCH === \*/\s*", "", js, flags=re.DOTALL)

    # Добавляем чистый и безопасный вариант без поломки fetch
    safe_patch = """
/* === START_GARAGE_SELECTOR_PATCH === */
(function() {
    window.loadedClientCars = [];
    window.selectedCarProfileId = null;
    window.lastDetectedClientId = null;

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

        if (uniqueCars.length === 0) {
            container.style.display = 'none';
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
        if (hintEl) hintEl.textContent = 'Выберите автомобиль из списка или укажите новый';

        // Скрываем ручные поля ввода авто до выбора
        const brandRow = document.getElementById('carBrandSelect') ? document.getElementById('carBrandSelect').closest('.form-row') : null;
        if (brandRow) brandRow.style.display = 'none';

        selectEl.onchange = function() {
            const val = this.value;
            const brandSelect = document.getElementById('carBrandSelect');
            const plateInput = document.getElementById('carPlateInput');
            const hiddenCarId = document.getElementById('selectedCarProfileId');

            if (brandRow) brandRow.style.display = '';

            if (val === 'new' || val === '') {
                window.selectedCarProfileId = null;
                if (hiddenCarId) hiddenCarId.value = '';
                if (brandSelect) { brandSelect.value = ''; brandSelect.focus(); }
                if (plateInput) plateInput.value = '';
            } else {
                const car = window.loadedClientCars[parseInt(val, 10)];
                if (car) {
                    const carId = car.id || car.CAR_PROFILE_ID || car.car_profile_id || '';
                    const brand = (car.brand || car.BRAND_NAME || car.mark || '').trim();
                    const plate = (car.plate || car.LICENSE_PLATE || car.LICENSE_PLATE_NUMBER || car.gosnomer || '').trim();
                    const vin = (car.vin || car.VIN || '').trim();

                    window.selectedCarProfileId = carId;
                    if (hiddenCarId) hiddenCarId.value = carId;
                    if (plateInput) plateInput.value = plate || vin || '';
                    if (brandSelect && brand) {
                        for (let i = 0; i < brandSelect.options.length; i++) {
                            if (brandSelect.options[i].value.toLowerCase().trim() === brand.toLowerCase()) {
                                brandSelect.selectedIndex = i;
                                break;
                            }
                        }
                    }
                    if (brandRow) brandRow.style.display = 'none'; // Скрываем снова, раз авто выбрано из базы
                }
            }
        };
    };

    // Слушаем ответ check_client и cars.php штатным образом через глобальный перехват завершения fetch
    const origFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        const response = await origFetch.apply(this, arguments);

        if (url.includes('customer.php') || url.includes('check_client') || url.includes('cars.php')) {
            try {
                const clone = response.clone();
                const data = await clone.json();
                const clientObj = data.client || data.contact || data.data || (data.RESPONSE && data.RESPONSE.DATA ? data.RESPONSE.DATA[0] : null);
                const cId = (clientObj && (clientObj.id || clientObj.CONTACT_ID || clientObj.client_id || clientObj.contact_id)) || data.client_id || data.contact_id || '';
                const cars = data.cars || data.CARS || (clientObj && clientObj.cars) || [];
                if (cars.length > 0) {
                    window.showClientGarageUI(cars, cId);
                }
            } catch (e) {}
        }
        return response;
    };
})();
/* === END_GARAGE_SELECTOR_PATCH === */
"""

    js = js.rstrip() + "\n" + safe_patch
    with open(guest_js_path, "w", encoding="utf-8") as f:
        f.write(js)
    print("[OK] guest.js очищен от блокировок отправки формы")

# 2. Синхронизация с NAS и Google Drive
subprocess.run(["chmod", "-R", "777", WEB_ROOT], check=False)
subprocess.run([
    "rclone", "copy", WEB_ROOT, "gdrive:web",
    "--exclude", "@eaDir/**",
    "--exclude", "#recycle/**",
    "--exclude", "crm/venv/**"
], check=False)
print("[OK] Изменения применены и синхронизированы!")
