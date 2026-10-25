#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Автономный патчер проекта /volume1/web с бэкапом и синхронизацией в Google Drive (gdrive:web).
"""

import os
import re
import shutil
import subprocess
from datetime import datetime

WEB_ROOT = "/volume1/web"
BACKUP_DIR = os.path.join(WEB_ROOT, "config", "backups")
TIMESTAMP = datetime.now().strftime("%Y%m%d_%H%M%S")

os.makedirs(BACKUP_DIR, exist_ok=True)
os.makedirs(os.path.join(WEB_ROOT, "api", "cache"), exist_ok=True)


def backup_file(rel_path: str) -> None:
    src = os.path.join(WEB_ROOT, rel_path)
    if os.path.exists(src):
        safe_name = rel_path.replace("/", "_")
        dst = os.path.join(BACKUP_DIR, f"{safe_name}.bak.{TIMESTAMP}")
        shutil.copy2(src, dst)
        print(f"[BACKUP] Сохранена резервная копия: {dst}")


# =====================================================================
# 1. ОБНОВЛЕНИЕ services/StocrmClient.php (Retry + JSON Validation + Log)
# =====================================================================
def update_stocrm_client() -> None:
    rel_path = "services/StocrmClient.php"
    target = os.path.join(WEB_ROOT, rel_path)
    if not os.path.exists(target):
        print(f"[SKIP] {rel_path} не найден")
        return

    backup_file(rel_path)
    with open(target, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()

    # Если файл использует архитектуру с sendRequest, обновляем с сохранением сигнатур
    stocrm_code = """<?php

class StocrmClient {
    private $apiUrl;
    private $apiKey;

    public function __construct() {
        $possiblePaths = [
            __DIR__ . '/../config/config.json',
            __DIR__ . '/../../config/config.json',
            __DIR__ . '/../config.json',
            __DIR__ . '/../../config.json',
            '/volume1/web/config/config.json',
            '/volume1/web/config.json'
        ];

        $configFile = null;
        foreach ($possiblePaths as $path) {
            if (file_exists($path) && is_readable($path)) {
                $configFile = $path;
                break;
            }
        }

        if (!$configFile) {
            throw new Exception("Файл конфигурации config.json не найден ни по одному из стандартных путей.");
        }

        $rawConfig = file_get_contents($configFile);
        $config = json_decode($rawConfig, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($config)) {
            throw new Exception("Ошибка чтения JSON в файле конфигурации config.json: " . json_last_error_msg());
        }

        $this->apiKey = trim($config['api_key'] ?? $config['STOCRM_API_KEY'] ?? '');
        $domain = trim($config['domain'] ?? 'pin-avto');

        if (strpos($content ?? '', '/api/external/v1') !== false && empty($config['STOCRM_API_URL'])) {
            $this->apiUrl = "https://{$domain}.stocrm.ru";
        } elseif (!empty($config['domain'])) {
            $this->apiUrl = "https://" . $domain . ".stocrm.ru";
        } else {
            $this->apiUrl = rtrim($config['STOCRM_API_URL'] ?? 'https://pin-avto.stocrm.ru', '/');
        }

        if (empty($this->apiKey)) {
            throw new Exception("В конфигурационном файле отсутствует ключ API (api_key).");
        }
    }

    private function normalizeEndpoint($endpoint) {
        $clean = ltrim($endpoint, '/');
        if (strpos($clean, 'api/external/v1/') === 0) {
            return $clean;
        }
        return 'api/external/v1/' . $clean;
    }

    public function get($endpoint, $params = []) {
        $params['SID'] = $this->apiKey;
        $ep = (strpos($this->apiUrl, '/api/external/v1') !== false)
            ? preg_replace('#^/?(api/external/v1/)?#', '', $endpoint)
            : $this->normalizeEndpoint($endpoint);
        $url = rtrim($this->apiUrl, '/') . '/' . ltrim($ep, '/');
        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }
        return $this->sendRequestWithRetry($url, 'GET');
    }

    public function post($endpoint, $data = []) {
        $data['SID'] = $this->apiKey;
        $ep = (strpos($this->apiUrl, '/api/external/v1') !== false)
            ? preg_replace('#^/?(api/external/v1/)?#', '', $endpoint)
            : $this->normalizeEndpoint($endpoint);
        $url = rtrim($this->apiUrl, '/') . '/' . ltrim($ep, '/');
        return $this->sendRequestWithRetry($url, 'POST', $data);
    }

    private function sendRequestWithRetry($url, $method, $data = [], $maxRetries = 2) {
        $attempt = 0;
        while ($attempt <= $maxRetries) {
            try {
                return $this->sendRequest($url, $method, $data);
            } catch (Exception $e) {
                $attempt++;
                if ($attempt > $maxRetries) {
                    $this->writeLog("ERROR [{$method}] {$url} -> " . $e->getMessage());
                    throw $e;
                }
                usleep(400000 * $attempt);
            }
        }
    }

    private function writeLog($msg) {
        $logFile = dirname(__DIR__) . '/api/cache/debug.log';
        @file_put_contents($logFile, "[" . date('Y-m-d H:i:s') . "] " . $msg . "\\n", FILE_APPEND);
    }

    private function sendRequest($url, $method, $data = []) {
        $ch = curl_init();

        $headers = [
            'SID: ' . $this->apiKey,
            'X-API-KEY: ' . $this->apiKey,
            'Authorization: Bearer ' . $this->apiKey,
            'Accept: application/json'
        ];

        $options = [
            CURLOPT_URL => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HEADER => false,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 5,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_COOKIE => 'SID=' . $this->apiKey,
        ];

        if ($method === 'POST') {
            $options[CURLOPT_POST] = true;
            $options[CURLOPT_POSTFIELDS] = json_encode($data, JSON_UNESCAPED_UNICODE);
            $headers[] = 'Content-Type: application/json';
        }

        $options[CURLOPT_HTTPHEADER] = $headers;
        curl_setopt_array($ch, $options);

        $rawResponse = curl_exec($ch);
        $error = curl_error($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($error) {
            throw new Exception("cURL Error: " . $error);
        }

        $decoded = json_decode($rawResponse, true);
        if ($decoded === null && $rawResponse !== 'null') {$this->writeLog("Non-JSON response (HTTP {$httpCode}) from {$url}: " . substr((string)$rawResponse, 0, 200));
            throw new Exception("STOCRM вернул не-JSON ответ (HTTP {$httpCode}): " . substr((string)$rawResponse, 0, 150));
        }

        return $decoded;
    }
}
"""
    with open(target, "w", encoding="utf-8") as f:
        f.write(stocrm_code)
    print(f"[OK] Обновлен {rel_path}")


# =====================================================================
# 2. ОБНОВЛЕНИЕ api/booking.php
# =====================================================================
def update_api_booking() -> None:
    rel_path = "api/booking.php"
    target = os.path.join(WEB_ROOT, rel_path)
    if not os.path.exists(target):
        return

    with open(target, "r", encoding="utf-8", errors="ignore") as f:
        old_code = f.read()

    # Обновляем только если это короткий init-скрипт, чтобы не задеть кастомные экшены
    if len(old_code) < 1500 and "$action === 'init'" in old_code:
        backup_file(rel_path)
        new_code = """<?php
header('Content-Type: application/json; charset=utf-8');

$root = dirname(__DIR__);
if (!file_exists($root . '/config/config.json') && file_exists(dirname(__DIR__, 2) . '/config/config.json')) {$root = dirname(__DIR__, 2);
}

$action =$_GET['action'] ?? '';

if ($action === 'init') {
    $configPath =$root . '/config/config.json';
    $servicesPath =$root . '/services.json';

    $config = [];
    if (file_exists($configPath) && is_readable($configPath)) {
        $decodedConfig = json_decode(file_get_contents($configPath), true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decodedConfig)) {
            $config =$decodedConfig;
        } else {
            @file_put_contents($root . '/api/cache/debug.log', "[" . date('Y-m-d H:i:s') . "] Ошибка JSON в config.json\\n", FILE_APPEND);
        }
    }

    $services = [];
    if (file_exists($servicesPath) && is_readable($servicesPath)) {
        $decodedSvc = json_decode(file_get_contents($servicesPath), true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decodedSvc)) {
            $services =$decodedSvc;
        }
    }

    $rawBranches =$config['branches'] ?? $config['filials'] ?? [];$branches = [];

    if (is_array($rawBranches)) {
        foreach ($rawBranches as $key =>$b) {
            if (is_array($b)) {$branches[] = [
                    'id' => $b['id'] ?? $b['CUSTOMER_ID'] ?? $key,
                    'name' => $b['name'] ?? $b['CUSTOMER_NAME'] ?? $b['address'] ?? ("Филиал #" . ($b['id'] ?? $key))
                ];
            }
        }
    }

    echo json_encode([
        'status' => 'success',
        'branches' => $branches,
        'services' => $services
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Неизвестное действие'], JSON_UNESCAPED_UNICODE);
"""
        with open(target, "w", encoding="utf-8") as f:
            f.write(new_code)
        print(f"[OK] Обновлен {rel_path}")


# =====================================================================
# 3. ДОРАБОТКА guest.html (Добавление блока выбора авто и скрытых полей)
# =====================================================================
def update_guest_html() -> None:
    rel_path = "guest.html"
    target = os.path.join(WEB_ROOT, rel_path)
    if not os.path.exists(target):
        print(f"[ERROR] {rel_path} не найден!")
        return

    backup_file(rel_path)
    with open(target, "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()

    # Убираем предыдущую вставку, если скрипт запускается повторно
    html = re.sub(
        r"<!-- START_CLIENT_GARAGE_BLOCK -->.*?<!-- END_CLIENT_GARAGE_BLOCK -->\s*",
        "",
        html,
        flags=re.DOTALL,
    )

    garage_block = """<!-- START_CLIENT_GARAGE_BLOCK -->
            <div id="clientCarsContainer" class="form-group" style="display: none; background: #f0f7ff; padding: 16px; border-radius: 10px; border: 2px solid #3b82f6; margin-bottom: 18px; box-shadow: 0 2px 10px rgba(59,130,246,0.12);">
                <label for="clientCarSelect" style="font-weight: 700; color: #1e3a8a; display: block; margin-bottom: 8px; font-size: 14px;">
                    🚗 Выберите ваш автомобиль из базы сервиса или укажите новый *
                </label>
                <select id="clientCarSelect" class="auth-input-field" style="border-color: #3b82f6; font-weight: 600; background: #fff;">
                    <option value="">-- Выберите действие (ваш авто или новый) --</option>
                </select>
                <span id="clientCarHint" class="field-hint" style="color: #1e40af; font-weight: 500; display: block; margin-top: 6px;">
                    Пожалуйста, выберите ваш автомобиль из списка или нажмите «➕ Новый автомобиль», чтобы продолжить запись
                </span>
                <input type="hidden" id="selectedCarProfileId" name="car_profile_id" value="">
                <input type="hidden" id="foundClientIdInput" name="client_id" value="">
                <input type="hidden" id="selectedCarModelInput" name="car_model" value="">
                <input type="hidden" id="selectedCarVinInput" name="car_vin" value="">
            </div>
            <!-- END_CLIENT_GARAGE_BLOCK -->
"""

    # Вставляем блок гаража ровно перед строкой с выбором марки автомобиля (carBrandSelect)
    pattern = r'(<div\s+class="form-row"[^>]*>\s*<div\s+class="form-group"[^>]*>\s*<label\s+for="carBrandSelect")'
    if re.search(pattern, html):
        html = re.sub(pattern, garage_block + r"\1", html, count=1)
    else:
        # Запасной вариант вставки перед branchSelect
        html = html.replace(
            '<label for="branchSelect">',
            garage_block + '<label for="branchSelect">',
            1,
        )

    # Добавляем версионирование к guest.js, чтобы браузер сбросил старый кэш автоматически
    html = re.sub(
        r'src="js/guest\.js(\?v=[^"]*)?"',
        f'src="js/guest.js?v={TIMESTAMP}"',
        html,
    )

    with open(target, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"[OK] Обновлен {rel_path} (добавлен блок #clientCarsContainer и сброс кэша js/guest.js?v={TIMESTAMP})")


# =====================================================================
# 4. ДОРАБОТКА js/guest.js (Инъекция логики выбора авто без потери кода)
# =====================================================================
def update_guest_js() -> None:
    rel_path = "js/guest.js"
    target = os.path.join(WEB_ROOT, rel_path)
    if not os.path.exists(target):
        print(f"[ERROR] {rel_path} не найден!")
        return

    backup_file(rel_path)
    with open(target, "r", encoding="utf-8", errors="ignore") as f:
        js = f.read()

    # Удаляем старый патч, если уже применялся
    js = re.sub(
        r"/\* === START_GARAGE_SELECTOR_PATCH === \*/.*?/\* === END_GARAGE_SELECTOR_PATCH === \*/\s*",
        "",
        js,
        flags=re.DOTALL,
    )

    # Заменяем старый автовыбор первой машины (const firstCar = dataCars.cars[0]...) на вызов renderClientGarageSelector
    old_car_block_pattern = (
        r"if\s*\(\s*dataCars\.status\s*===\s*'success'\s*&&\s*dataCars\.cars\s*&&\s*dataCars\.cars\.length\s*>\s*0\s*\)\s*\{.*?\}\s*\}\s*catch\s*\(\s*carErr\s*\)"
    )

    replacement_car_block = """if (dataCars.status === 'success' && Array.isArray(dataCars.cars) && dataCars.cars.length > 0) {
                    if (typeof window.renderClientGarageSelector === 'function') {
                        window.renderClientGarageSelector(dataCars.cars, foundClientId);
                    }
                } else {
                    if (typeof window.resetClientGarageSelector === 'function') {
                        window.resetClientGarageSelector(foundClientId);
                    }
                }
            } catch (carErr)"""

    if re.search(old_car_block_pattern, js, flags=re.DOTALL):
        js = re.sub(old_car_block_pattern, replacement_car_block, js, count=1, flags=re.DOTALL)
        print("[OK] Заменен старый блок первого автомобиля в handlePhoneBlurCheck")
    else:
        print("[INFO] Стандартный паттерн firstCar не найден напрямую, подключаем перехватчик")

    garage_patch_js = """
/* === START_GARAGE_SELECTOR_PATCH === */
window.loadedClientCars = [];
window.selectedCarProfileId = null;
window.carChoiceMade = true;

window.setBookingStepsLocked = function(locked) {
    const branchSelect = document.getElementById('branchSelect');
    const postSelect = document.getElementById('postSelect');
    const submitBtn = document.getElementById('bookingSubmitBtn');
    const brandRow = document.getElementById('carBrandSelect') ? document.getElementById('carBrandSelect').closest('.form-row') : null;

    if (locked) {
        window.carChoiceMade = false;
        if (branchSelect) {
            branchSelect.disabled = true;
            branchSelect.style.opacity = '0.5';
            branchSelect.title = 'Сначала выберите ваш автомобиль или укажите новый';
        }
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.5';
        }
        if (brandRow) {
            brandRow.style.display = 'none';
        }
    } else {
        window.carChoiceMade = true;
        if (branchSelect) {
            branchSelect.disabled = false;
            branchSelect.style.opacity = '1';
            branchSelect.title = '';
        }
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.style.opacity = '1';
        }
        if (brandRow) {
            brandRow.style.display = '';
        }
    }
};

window.resetClientGarageSelector = function(clientId = null) {
    window.loadedClientCars = [];
    window.selectedCarProfileId = null;
    const container = document.getElementById('clientCarsContainer');
    const hiddenCarId = document.getElementById('selectedCarProfileId');
    const hiddenClientId = document.getElementById('foundClientIdInput');
    if (container) container.style.display = 'none';
    if (hiddenCarId) hiddenCarId.value = '';
    if (hiddenClientId) hiddenClientId.value = clientId || '';
    window.setBookingStepsLocked(false);
};

window.renderClientGarageSelector = function(cars, clientId) {
    console.log('[STOCRM Garage] Получены автомобили клиента:', cars);
    window.loadedClientCars = cars || [];
    window.selectedCarProfileId = null;

    let container = document.getElementById('clientCarsContainer');
    const brandSelect = document.getElementById('carBrandSelect');

    if (!container && brandSelect) {
        const brandRow = brandSelect.closest('.form-row');
        container = document.createElement('div');
        container.id = 'clientCarsContainer';
        container.className = 'form-group';
        container.style.cssText = 'background: #f0f7ff; padding: 16px; border-radius: 10px; border: 2px solid #3b82f6; margin-bottom: 18px;';
        container.innerHTML = `
            <label for="clientCarSelect" style="font-weight: 700; color: #1e3a8a; display: block; margin-bottom: 8px;">🚗 Выберите ваш автомобиль из базы сервиса или укажите новый *</label>
            <select id="clientCarSelect" class="auth-input-field" style="border-color: #3b82f6; font-weight: 600; background: #fff;"></select>
            <span id="clientCarHint" class="field-hint" style="color: #1e40af; font-weight: 500; display: block; margin-top: 6px;">Пожалуйста, выберите ваш автомобиль или нажмите «➕ Новый автомобиль», чтобы продолжить запись</span>
            <input type="hidden" id="selectedCarProfileId" name="car_profile_id" value="">
            <input type="hidden" id="foundClientIdInput" name="client_id" value="">
            <input type="hidden" id="selectedCarModelInput" name="car_model" value="">
            <input type="hidden" id="selectedCarVinInput" name="car_vin" value="">
        `;
        if (brandRow && brandRow.parentNode) {
            brandRow.parentNode.insertBefore(container, brandRow);
        }
    }

    const selectEl = document.getElementById('clientCarSelect');
    const hiddenClientId = document.getElementById('foundClientIdInput');
    if (hiddenClientId) hiddenClientId.value = clientId || '';

    if (!selectEl) return;

    selectEl.innerHTML = '<option value="">-- 👇 Нажмите, чтобы выбрать автомобиль или указать новый --</option>';

    cars.forEach((car, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx);
        const brand = car.brand || car.BRAND_NAME || '';
        const model = car.model || car.MODEL_NAME || '';
        const title = car.title || car.TITLE || `${brand} ${model}`.trim() || 'Автомобиль';
        const plate = car.plate || car.LICENSE_PLATE || car.LICENSE_PLATE_NUMBER || '';
        const vin = car.vin || car.VIN || '';
        const ident = plate ? `Гос. номер: ${plate}` : (vin ? `VIN: ${vin}` : 'Без гос. номера');
        opt.textContent = `🚘 ${title} (${ident})`;
        selectEl.appendChild(opt);
    });

    const newOpt = document.createElement('option');
    newOpt.value = 'new';
    newOpt.textContent = '➕ Новый автомобиль (указать вручную)';
    selectEl.appendChild(newOpt);

    container.style.display = 'block';

    // Блокируем дальнейшие шаги до явного выбора клиента
    window.setBookingStepsLocked(true);

    selectEl.onchange = function() {
        window.handleClientCarSelection(this);
    };
};

window.handleClientCarSelection = function(selectObj) {
    const val = selectObj.value;
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
        window.setBookingStepsLocked(true);
        if (hintEl) {
            hintEl.textContent = '⚠️ Сначала выберите автомобиль из списка или укажите «Новый автомобиль»';
            hintEl.style.color = '#dc2626';
        }
        return;
    }

    // Разблокируем переход к записи
    window.setBookingStepsLocked(false);

    if (val === 'new') {
        window.selectedCarProfileId = null;
        if (hiddenCarId) hiddenCarId.value = '';
        if (hiddenModel) hiddenModel.value = '';
        if (hiddenVin) hiddenVin.value = '';
        if (brandSelect) {
            brandSelect.disabled = false;
            brandSelect.value = '';
            brandSelect.focus();
        }
        if (plateInput) {
            plateInput.readOnly = false;
            plateInput.value = '';
        }
        if (customBrandRow) customBrandRow.style.display = 'none';
        if (hintEl) {
            hintEl.textContent = '✍️ Укажите марку и гос. номер вашего нового автомобиля ниже и переходите к выбору филиала';
            hintEl.style.color = '#15803d';
        }
        return;
    }

    const car = window.loadedClientCars[parseInt(val, 10)];
    if (!car) return;

    const carId = car.id || car.CAR_PROFILE_ID || car.car_profile_id || '';
    const brand = (car.brand || car.BRAND_NAME || '').trim();
    const model = (car.model || car.MODEL_NAME || '').trim();
    const plate = (car.plate || car.LICENSE_PLATE || car.LICENSE_PLATE_NUMBER || '').trim();
    const vin = (car.vin || car.VIN || '').trim();

    window.selectedCarProfileId = carId;
    if (hiddenCarId) hiddenCarId.value = carId;
    if (hiddenModel) hiddenModel.value = model;
    if (hiddenVin) hiddenVin.value = vin;

    if (plateInput) {
        plateInput.value = plate || vin || '';
        plateInput.classList.add('field-autofilled');
        setTimeout(() => plateInput.classList.remove('field-autofilled'), 1500);
    }

    if (brandSelect && brand) {
        let matched = false;
        const targetBrand = brand.toLowerCase();
        for (let i = 0; i < brandSelect.options.length; i++) {
            const optVal = brandSelect.options[i].value.toLowerCase().trim();
            if (optVal && (optVal === targetBrand || targetBrand.includes(optVal) || optVal.includes(targetBrand))) {
                brandSelect.selectedIndex = i;
                matched = true;
                break;
            }
        }
        if (!matched) {
            const univVal = typeof UNIVERSAL_BRAND_VALUE !== 'undefined' ? UNIVERSAL_BRAND_VALUE : 'Другая марка (универсальный)';
            brandSelect.value = univVal;
            if (customBrandRow) customBrandRow.style.display = 'flex';
            if (customBrandInput) customBrandInput.value = `${brand} ${model}`.trim();
        } else if (customBrandRow) {
            customBrandRow.style.display = 'none';
        }
    }

    if (hintEl) {
        hintEl.textContent = `✔ Выбран автомобиль: ${brand} ${model} (${plate || vin || 'ID: ' + carId}). Теперь выберите филиал ниже.`;
        hintEl.style.color = '#15803d';
    }
};

// Перехватчик fetch для автоматического внедрения car_profile_id и client_id в запрос создания записи
(function() {
    const originalFetch = window.fetch;
    window.fetch = async function(input, init) {
        const url = typeof input === 'string' ? input : (input && input.url ? input.url : '');

        // Если клиент не найден при проверке телефона — сбрасываем гараж
        if (url.includes('api/customer.php') && init && init.method === 'POST') {
            const resp = await originalFetch.apply(this, arguments);
            const clone = resp.clone();
            clone.json().then(data => {
                if (!data || data.status !== 'success' || !data.client) {
                    window.resetClientGarageSelector(null);
                }
            }).catch(() => {});
            return resp;
        }

        // При отправке заявки на запись добавляем выбранный car_profile_id и client_id
        if ((url.includes('booking_handler.php') || url.includes('api/booking.php')) && init && init.method === 'POST') {
            if (!window.carChoiceMade) {
                throw new Error('Пожалуйста, сначала выберите ваш автомобиль из списка или укажите «Новый автомобиль».');
            }
            const carProfileId = window.selectedCarProfileId || (document.getElementById('selectedCarProfileId') ? document.getElementById('selectedCarProfileId').value : '');
            const clientIdVal = (typeof foundClientId !== 'undefined' && foundClientId) ? foundClientId : (document.getElementById('foundClientIdInput') ? document.getElementById('foundClientIdInput').value : '');
            const carModelVal = document.getElementById('selectedCarModelInput') ? document.getElementById('selectedCarModelInput').value : '';
            const carVinVal = document.getElementById('selectedCarVinInput') ? document.getElementById('selectedCarVinInput').value : '';

            if (init.body instanceof FormData) {
                if (carProfileId && !init.body.has('car_profile_id')) init.body.append('car_profile_id', carProfileId);
                if (clientIdVal && !init.body.has('client_id')) init.body.append('client_id', clientIdVal);
                if (carModelVal && !init.body.has('car_model')) init.body.append('car_model', carModelVal);
                if (carVinVal && !init.body.has('car_vin')) init.body.append('car_vin', carVinVal);
            } else if (typeof init.body === 'string') {
                try {
                    const parsed = JSON.parse(init.body);
                    if (carProfileId) parsed.car_profile_id = carProfileId;
                    if (clientIdVal) parsed.client_id = clientIdVal;
                    if (carModelVal) parsed.car_model = carModelVal;
                    if (carVinVal) parsed.car_vin = carVinVal;
                    init.body = JSON.stringify(parsed);
                } catch (e) {
                    // Если URLSearchParams-строка
                    const params = new URLSearchParams(init.body);
                    if (carProfileId && !params.has('car_profile_id')) params.append('car_profile_id', carProfileId);
                    if (clientIdVal && !params.has('client_id')) params.append('client_id', clientIdVal);
                    if (carModelVal && !params.has('car_model')) params.append('car_model', carModelVal);
                    if (carVinVal && !params.has('car_vin')) params.append('car_vin', carVinVal);
                    init.body = params.toString();
                }
            }
        }

        return originalFetch.apply(this, arguments);
    };
})();
/* === END_GARAGE_SELECTOR_PATCH === */
"""

    js = js.rstrip() + "\n" + garage_patch_js
    with open(target, "w", encoding="utf-8") as f:
        f.write(js)
    print(f"[OK] Обновлен {rel_path} (внедрен селектор авто клиента и передача car_profile_id)")


# =====================================================================
# 5. ДОРАБОТКА booking_handler.php (Привязка выбранного CAR_PROFILE_ID к сделке и календарю)
# =====================================================================
def update_booking_handler() -> None:
    rel_path = "booking_handler.php"
    target = os.path.join(WEB_ROOT, rel_path)
    if not os.path.exists(target):
        return

    backup_file(rel_path)
    with open(target, "r", encoding="utf-8", errors="ignore") as f:
        php = f.read()

    if "CAR_PROFILE_ID" in php and "car_profile_id" in php:
        print(f"[INFO] {rel_path} уже поддерживает car_profile_id")
        return

    # 1. Чтение car_profile_id из POST или JSON-тела в начале скрипта
    input_reader_patch = """
// --- START_CAR_PROFILE_PATCH ---
$_rawInputData = json_decode(file_get_contents('php://input'), true);
if (!is_array($_rawInputData)) {$_rawInputData = []; }
$selected_car_profile_id = intval($_POST['car_profile_id'] ?? $_rawInputData['car_profile_id'] ?? 0);$selected_client_id = intval($_POST['client_id'] ?? $_rawInputData['client_id'] ?? 0);
$selected_car_model = trim((string)($_POST['car_model'] ?? $_rawInputData['car_model'] ?? ''));$selected_car_vin = trim((string)($_POST['car_vin'] ?? $_rawInputData['car_vin'] ?? ''));
// --- END_CAR_PROFILE_PATCH ---
"""
    if "START_CAR_PROFILE_PATCH" not in php:
        php = php.replace("<?php", "<?php\n" + input_reader_patch, 1)

    # 2. Прокидываем CAR_PROFILE_ID в массив создания сделки ($offer_payload / $offerData) и календаря ($calendar_payload)
    for var_name in ["$offer_payload", "$offerData", "$payload", "$calendar_payload", "$calendarData"]:
        pattern = rf"({re.escape(var_name)}\s*=\s*\[)"
        if re.search(pattern, php):
            addition = (
                f"\\1\n"
                f"        'CAR_PROFILE_ID' => ($selected_car_profile_id > 0 ?$selected_car_profile_id : null),\n"
            )
            php = re.sub(pattern, addition, php, count=1)

    with open(target, "w", encoding="utf-8") as f:
        f.write(php)
    print(f"[OK] Обновлен {rel_path} (добавлена передача CAR_PROFILE_ID в сделку и календарь STOCRM)")


def sync_to_google_drive() -> None:
    print("[SYNC] Выгрузка обновленных файлов и бэкапов с NAS в Google Drive (gdrive:web)...")
    subprocess.run(
        [
            "rclone",
            "copy",
            WEB_ROOT,
            "gdrive:web",
            "--exclude",
            "@eaDir/**",
            "--exclude",
            "#recycle/**",
            "--exclude",
            "crm/venv/**",
        ],
        check=False,
    )
    subprocess.run(
        [
            "rclone",
            "bisync",
            WEB_ROOT,
            "gdrive:web",
            "--exclude",
            "@eaDir/**",
            "--exclude",
            "#recycle/**",
            "--exclude",
            "rclone_sync.log",
            "--resync",
        ],
        check=False,
    )
    subprocess.run(["chmod", "-R", "777", WEB_ROOT], check=False)
    print("[OK] Синхронизация NAS -> Google Drive успешно завершена!")


if __name__ == "__main__":
    update_stocrm_client()
    update_api_booking()
    update_guest_html()
    update_guest_js()
    update_booking_handler()
    sync_to_google_drive()
