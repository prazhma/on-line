#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import re
import subprocess

WEB_ROOT = "/volume1/web"
js_path = os.path.join(WEB_ROOT, "js", "guest.js")

if os.path.exists(js_path):
    with open(js_path, "r", encoding="utf-8", errors="ignore") as f:
        code = f.read()

    # Удаляем старые патчи
    code = re.sub(r"/\* === START_GARAGE_SELECTOR_PATCH === \*/.*?/\* === END_GARAGE_SELECTOR_PATCH === \*/\s*", "", code, flags=re.DOTALL)

    target_snippet = """    // 2. Ищем автомобили клиента в гараже STOCRM
    try { 
        const resCars = await fetch(`api/cars.php?client_id=${encodeURIComponent(foundClientId)}`); 
        const dataCars = await resCars.json(); 
        
        if (dataCars.status === 'success' && dataCars.cars && dataCars.cars.length > 0) { 
            const firstCar = dataCars.cars[0]; 
            
            if (carPlateInput) { 
                carPlateInput.value = firstCar.plate || firstCar.vin || ''; 
                carPlateInput.classList.add('field-autofilled'); 
                setTimeout(() => carPlateInput.classList.remove('field-autofilled'), 2000); 
            } 
            
            if (carBrandSelect && firstCar.brand) { 
                const targetBrand = firstCar.brand.toLowerCase().trim(); 
                for (let i = 0; i < carBrandSelect.options.length; i++) { 
                    const optVal = carBrandSelect.options[i].value.toLowerCase().trim(); 
                    if (optVal && (optVal === targetBrand || targetBrand.includes(optVal))) { 
                        carBrandSelect.selectedIndex = i; 
                        break; 
                    } 
                } 
            } 
        } 
    } catch (carErr) { 
        console.warn('Ошибка получения авто клиента:', carErr); 
    }"""

    replacement_snippet = """/* === START_GARAGE_SELECTOR_PATCH === */
    try {
        const resCars = await fetch(`api/cars.php?client_id=${encodeURIComponent(foundClientId)}`);
        const dataCars = await resCars.json();
        
        let garageBox = document.getElementById('clientGarageBox');
        if (!garageBox) {
            garageBox = document.createElement('div');
            garageBox.id = 'clientGarageBox';
            garageBox.className = 'form-group';
            garageBox.style.cssText = 'background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; margin-bottom: 15px;';
            garageBox.innerHTML = `
                <label for="clientGarageSelect" style="font-weight: bold; color: #1e5799; display: block; margin-bottom: 6px;">🚗 Автомобиль из базы сервиса *</label>
                <select id="clientGarageSelect" class="auth-input-field" onchange="window.selectClientGarageCar(this)">
                    <option value="">-- Выберите автомобиль из списка --</option>
                    <option value="new">➕ Указать другой / новый автомобиль</option>
                </select>
                <span class="field-hint" style="display: block; margin-top: 5px; color: #15803d;">Найдены автомобили клиента в CRM</span>
                <input type="hidden" id="hiddenCarProfileId" name="car_profile_id" value="">
            `;
            const brandGroup = carBrandSelect.closest('.form-group');
            brandGroup.parentNode.insertBefore(garageBox, brandGroup);
        }

        window._clientFetchedCars = dataCars.cars || [];
        const garageSelect = document.getElementById('clientGarageSelect');
        garageSelect.innerHTML = '<option value="">-- Выберите автомобиль из списка --</option>';

        window._clientFetchedCars.forEach((c, idx) => {
            const opt = document.createElement('option');
            opt.value = idx;
            const bName = c.brand || c.BRAND_NAME || '';
            const mName = c.model || c.MODEL_NAME || '';
            const pNum = c.plate || c.LICENSE_PLATE || c.vin || 'Без номера';
            opt.textContent = `${bName} ${mName} (${pNum})`.trim();
            garageSelect.appendChild(opt);
        });

        const newOpt = document.createElement('option');
        newOpt.value = 'new';
        newOpt.textContent = '➕ Указать другой / новый автомобиль';
        garageSelect.appendChild(newOpt);

        garageBox.style.display = 'block';

        // Автовыбор первой машины
        garageSelect.value = "0";
        window.selectClientGarageCar(garageSelect);

    } catch (carErr) {
        console.warn('Ошибка получения авто клиента:', carErr);
    }
    /* === END_GARAGE_SELECTOR_PATCH === */"""

    if target_snippet in code:
        code = code.replace(target_snippet, replacement_snippet)
        print("[OK] Блок подгрузки авто успешно заменен в guest.js!")
    else:
        print("[INFO] Точный фрагмент не найден, добавляем логику в конец файла")
        code += "\n" + replacement_snippet

    helper_func = """
window.selectClientGarageCar = function(selectEl) {
    const val = selectEl.value;
    const brandSelect = document.getElementById('carBrandSelect');
    const plateInput = document.getElementById('carPlateInput');
    const hiddenCarId = document.getElementById('hiddenCarProfileId');

    if (val === 'new' || val === '') {
        if (hiddenCarId) hiddenCarId.value = '';
        if (brandSelect) brandSelect.value = '';
        if (plateInput) plateInput.value = '';
    } else {
        const car = window._clientFetchedCars[parseInt(val, 10)];
        if (car) {
            const cId = car.id || car.CAR_PROFILE_ID || '';
            if (hiddenCarId) hiddenCarId.value = cId;
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
"""
    code += "\n" + helper_func

    with open(js_path, "w", encoding="utf-8") as f:
        f.write(code)
    print("[OK] guest.js успешно перезаписан без ошибок!")

# Синхронизация с gdrive:web
subprocess.run(["chmod", "-R", "777", WEB_ROOT], check=False)
subprocess.run(["rclone", "copy", WEB_ROOT, "gdrive:web", "--exclude", "@eaDir/**", "--exclude", "#recycle/**"], check=False)
print("[OK] Синхронизация с Google Диском завершена!")
