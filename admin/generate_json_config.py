import urllib.request
import json
import os

API_KEY = "10237_65c7b75c88422a33a75028efa12b2524"
DOMAIN = "pin-avto"

# Соответствие филиалов доскам STOCRM (BOARD_ID)
BOARD_MAPPING = {
    1: 2,    # СЦ №7 Динская
    3: 3,    # СЦ №13 Верхнебаканский
    5: 4,    # СЦ №2 Дзержинского
    7: 5,    # СЦ №4 Тургеневское
    9: 6,    # СЦ №5 Майкоп
    11: 7,   # СЦ №8 Ставропольская
    17: 8,   # СЦ №10 Российская
    19: 9,   # СЦ №11 Каневская
    21: 10,  # СЦ №12 Геленджик
    23: 11,  # СЦ №18 Карла Гусника
    25: 12,  # СЦ №19 Селезнева
    27: 13   # Центральный Офис (Тест)
}

def call_stocrm(method, payload=None):
    url = f"https://{DOMAIN}.stocrm.ru/api/external/v1/{method}"
    if payload is None:
        payload = {"SID": API_KEY}
    else:
        payload["SID"] = API_KEY
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read().decode('utf-8'))
    except Exception as e:
        return {"error": str(e)}

print("Загружаем данные подразделений и постов из STOCRM...")
cust_res = call_stocrm("customers/get_filtered", {"LIMIT": 100})
branches_data = cust_res.get("RESPONSE", {}).get("DATA", [])

config_data = {
    "api_key": API_KEY,
    "domain": DOMAIN,
    "source_id": 10049,
    
    # Системные параметры для PHP-сервисов личного кабинета и B2B
    "STOCRM_API_URL": f"https://{DOMAIN}.stocrm.ru",
    "STOCRM_API_KEY": API_KEY,

    # Конфигурация воронок сделок (Розница / B2B)
    "funnels": {
        "retail": {
            "NAME": "Онлайн-запись (Физлица)",
            "TYPE": "phys",
            "DEFAULT_STATUS_ID": 1,
            "OFFER_CREATOR": "Онлайн запись API",
            "TAGS": ["Онлайн-запись", "Розница"]
        },
        "b2b": {
            "NAME": "Корпоративные клиенты (B2B)",
            "TYPE": "legal",
            "DEFAULT_STATUS_ID": 1,
            "OFFER_CREATOR": "B2B Портал API",
            "TAGS": ["B2B", "Корпоративный", "Безнал"]
        }
    },

    # Реквизиты юрлица по умолчанию
    "default_requisites": {
        "CUSTOMER_LEGAL_ENTITY_ID": 3,
        "CUSTOMER_LEGAL_ENTITY_REQUISITE_ID": 3,
        "DEFAULT_CUSTOMER_REQUISITE_ID": 5
    },

    "branches": {}
}

for item in branches_data:
    if not isinstance(item, dict) or "CUSTOMER_ID" not in item:
        continue
    
    raw_id = item.get("CUSTOMER_ID")
    c_id = int(raw_id)
    c_id_str = str(c_id)
    branch_name = item.get("CUSTOMER_NAME", f"Филиал #{c_id}")
    
    # Определение привязки к доске воронки
    board_id = BOARD_MAPPING.get(c_id, 4)

    branch_entry = {
        "CUSTOMER_ID": c_id,
        "CUSTOMER_NAME": branch_name,
        "ADDRESS": item.get("ADDRESS", ""),
        "CITY_NAME": item.get("CITY_NAME", ""),
        "ACTIVE": item.get("ACTIVE", "Y"),
        "board_id": board_id,
        "board_id_retail": board_id,
        "board_id_b2b": board_id,
        "posts": {},
        "work_time": item.get("WORK_TIME", {})
    }

    # Исключение Центрального Офиса из рабочей аналитики
    if c_id == 27:
        branch_entry["IS_TEST"] = True
        branch_entry["EXCLUDE_FROM_STATS"] = True

    # Исключение 11 филиала из статистики закупок Ленты
    if c_id in (11, 19):
        branch_entry["EXCLUDE_FROM_PURCHASE_STATS"] = True

    config_data["branches"][c_id_str] = branch_entry

    # Запрашиваем актуальные посты для каждого филиала
    post_res = call_stocrm("calendar/post/get", {"CUSTOMER_ID": c_id})
    posts_response = post_res.get("RESPONSE", {})

    if isinstance(posts_response, dict):
        for p_key, p_info in posts_response.items():
            if isinstance(p_info, dict) and "POST_ID" in p_info:
                p_id = int(p_info.get("POST_ID"))
                p_id_str = str(p_id)
                config_data["branches"][c_id_str]["posts"][p_id_str] = {
                    "POST_ID": p_id,
                    "NAME": p_info.get("NAME", ""),
                    "POST_TYPE": p_info.get("POST_TYPE", "DEFAULT")
                }

# --------------------------------------------------------------------------
# Привязка путей к корню проекта (уровень выше текущей папки admin/)
# --------------------------------------------------------------------------
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))

if os.path.basename(CURRENT_DIR).lower() == 'admin':
    ROOT_DIR = os.path.dirname(CURRENT_DIR)
else:
    ROOT_DIR = CURRENT_DIR

CONFIG_DIR = os.path.join(ROOT_DIR, "config")
os.makedirs(CONFIG_DIR, exist_ok=True)

paths_to_save = [
    os.path.join(CONFIG_DIR, "config.json"),
    os.path.join(ROOT_DIR, "config.json")
]

for p in paths_to_save:
    try:
        with open(p, "w", encoding="utf-8") as f:
            json.dump(config_data, f, ensure_ascii=False, indent=2)
        print(f"Файл успешно сохранен: {p}")
    except Exception as e:
        print(f"Предупреждение при записи в {p}: {e}")

print(f"✅ Успешно! Собрано филиалов: {len(config_data['branches'])}.")
print("✅ Параметры воронок (B2B/Retail), графики work_time и board_id успешно сохранены в config/config.json!")