import urllib.request
import json

API_KEY = "10237_65c7b75c88422a33a75028efa12b2524"
DOMAIN = "pin-avto"

url = f"https://{DOMAIN}.stocrm.ru/api/external/v1/calendar/post/get"
payload = {"SID": API_KEY}
data = json.dumps(payload).encode('utf-8')

req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})

try:
    with urllib.request.urlopen(req) as response:
        result = json.loads(response.read().decode('utf-8'))
        print(json.dumps(result, indent=2, ensure_ascii=False))
except Exception as e:
    print(f"Ошибка: {e}")
