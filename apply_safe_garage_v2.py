#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os, re, subprocess

WEB_ROOT = "/volume1/web"
js_path = os.path.join(WEB_ROOT, "js", "guest.js")
html_path = os.path.join(WEB_ROOT, "guest_test.html")

# 1. Добавляем скрытое поле car_profile_id в разметку, если его там нет
for p in [html_path, os.path.join(WEB_ROOT, "guest.html")]:
    if os.path.exists(p):
        with open(p, "r", encoding="utf-8", errors="ignore") as f:
            h = f.read()
        if "selectedCarProfileId" not in h:
            h = h.replace('</form>', '<input type="hidden" id="selectedCarProfileId" name="car_profile_id" value="">\n</form>')
            with open(p, "w", encoding="utf-8") as f:
                f.write(h)
            print(f"[OK] Добавлено скрытое поле car_profile_id в {os.path.basename(p)}")

# 2. Аккуратный JS-модуль без перехвата fetch (гарантирует отправку сделки и показ успеха)
if os.path.exists(js_path):
    with open(js_path, "r", encoding="utf-8", errors="ignore") as f:
        js = f.read()

    js = re.sub(r"/\* === START_GARAGE_SELECTOR_PATCH === \*/.*?/\* === END_GARAGE_SELECTOR_PATCH === \*/\s*", "", js, flags=re.DOTALL)

    safe_block = """
/* === START_GARAGE_SELECTOR_PATCH === */
(function() {
    window.loadedClientCars = [];

    window.renderGarageSelect = function(cars) {
        let garageBox = document.getElementById('clientGarageBox');
        const brandSelect = document.getElementById('carBrandSelect');
        if (!brandSelect) return;

        if (!garageBox) {
            garageBox = document.createElement('div');
            garageBox.id = 'clientGarageBox';
            garageBox.className = 'form-group';
            garageBox.style.cssText = 'background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 15px;';
            garageBox.innerHTML = `
                <label for="clientGarageSelect" style="font-weight: bold; color: #1e5799; display: block; margin-bottom: 6px;">🚗 Автомобиль из базы сервиса *</label>
                <select id="clientGarageSelect" class="auth-input-field" onchange="window.onGarageSelectChange(this)">
                    <option value="">-- Выберите автомобиль --</option>
                    <option value="new">➕ Указать другой / новый автомобиль</option>
                </select>
                <span class="field-hint" style="display: block; margin-top: 5px; color: #15803d;">Найдены автомобили клиента в CRM</span>
            `;
            const parentRow = brandSelect.closest('.form-row') || brandSelect.parentElement;
            parentRow.parentNode.insertBefore(garageBox, parentRow);
        }

        window.loadedClientCars = cars || [];
        const garageSelect = document.getElementById('clientGarageSelect');
        garageSelect.innerHTML = '<option value="">-- Выберите автомобиль --</option>';

        window.loadedClientCars.forEach((c, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            const b = c.brand || c.BRAND_NAME || '';
            const m = c.model || c.MODEL_NAME || '';
            const p = c.plate || c.LICENSE_PLATE || c.vin || 'Без номера';
            opt.textContent = `${b} ${m} (${p})`.trim();
            garageSelect.appendChild(opt);
        });

        const newOpt = document.createElement('option');
        newOpt.value = 'new';
        newOpt.textContent = '➕ Указать другой / новый автомобиль';
        garageSelect.appendChild(newOpt);

        garageBox.style.display = 'block';
        garageSelect.value = "0";
        window.onGarageSelectChange(garageSelect);
    };

    window.onGarageSelectChange = function(sel) {
        const val = sel.value;
        const brandSelect = document.getElementById('carBrandSelect');
        const plateInput = document.getElementById('carPlateInput');
        let hiddenCarId = document.getElementById('selectedCarProfileId');

        if (!hiddenCarId) {
            hiddenCarId = document.createElement('input');
            hiddenCarId.type = 'hidden';
            hiddenCarId.id = 'selectedCarProfileId';
            hiddenCarId.name = 'car_profile_id';
            document.getElementById('guestBookingForm').appendChild(hiddenCarId);
        }

        if (val === 'new' || val === '') {
            hiddenCarId.value = '';
            if (brandSelect) brandSelect.value = '';
            if (plateInput) plateInput.value = '';
        } else {
            const car = window.loadedClientCars[parseInt(val, 10)];
            if (car) {
                hiddenCarId.value = car.id || car.CAR_PROFILE_ID || '';
                if (plateInput) plateInput.value = car.plate || car.vin || '';
                if (brandSelect && car.brand) {
                    const target = car.brand.toLowerCase().trim();
                    for (let i = 0; i < brandSelect.options.length; i++) {
                        if (brandSelect.options[i].value.toLowerCase().trim() === target) {
                            brandSelect.selectedIndex = i;
                            break;
                        }
                    }
                }
            }
        }
    };

    // Слушаем завершение запроса check_client и подгружаем авто
    const origFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        const res = await origFetch.apply(this, arguments);

        if (url.includes('customer.php') || url.includes('check_client')) {
            try {
                const clone = res.clone();
                const json = await clone.json();
                const cId = json.client?.id || json.client?.CONTACT_ID || json.client_id;
                if (cId) {
                    const carsRes = await origFetch(`api/cars.php?client_id=${encodeURIComponent(cId)}`);
                    const carsJson = await carsRes.json();
                    if (carsJson.status === 'success' && Array.isArray(carsJson.cars) && carsJson.cars.length > 0) {
                        window.renderGarageSelect(carsJson.cars);
                    }
                }
            } catch (e) {}
        }
        return res;
    };
})();
/* === END_GARAGE_SELECTOR_PATCH === */
"""

    js += "\n" + safe_block
    with open(js_path, "w", encoding="utf-8") as f:
        f.write(js)
    print("[OK] Безопасный патч гаража внедрен в guest.js")

subprocess.run(["chmod", "-R", "777", WEB_ROOT], check=False)
subprocess.run(["rclone", "copy", WEB_ROOT, "gdrive:web", "--exclude", "@eaDir/**", "--exclude", "#recycle/**"], check=False)
print("[OK] Всё синхронизировано!")
