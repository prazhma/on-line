<?php
/**
 * ПИН-АВТО — Редактор каталога работ (admin/services_editor.php)
 *
 * JSON-API, доступен ТОЛЬКО авторизованному админу (admin_require_auth).
 * Действия:
 *   GET  ?action=list                          — весь каталог services.json + список кодов ОП
 *   POST action=add                            — добавить работу {name, category, duration}
 *   POST action=update                         — изменить работу {id, name?, category?, duration?}
 *   POST action=delete                         — удалить работу {id}
 *   POST action=set_price                      — цена для работы по коду подразделения {id, code, value}
 *     (value === "" или null — удалить цену => работа скрыта в этом филиале)
 *   POST action=copy_prices                    — скопировать цены с одного кода на другой {from_code, to_code}
 *   POST action=rename_category                — переименовать категорию во всех работах {from, to}
 *   POST action=add_category                   — создать пустую категорию {name} (добавляется через первую работу)
 *
 * Все изменения пишутся в services.json (основной файл в корне проекта),
 * перед записью создаётся бэкап в config/backups/.
 */

require __DIR__ . '/admin_auth.php';
admin_require_auth();

header('Content-Type: application/json; charset=utf-8');

$rootDir = dirname(__DIR__);

/** Совместимость с хостингами без mbstring (эмуляция через iconv) */
if (!function_exists('mb_strlen')) {
    function mb_strlen(string $s, ?string $enc = null): int { return strlen($s); }
}
if (!function_exists('mb_substr')) {
    function mb_substr(string $s, int $start, ?int $len = null, ?string $enc = null): string { return substr($s, $start, $len ?? PHP_INT_MAX); }
}

function seFail(string $msg): void
{
    echo json_encode(['status' => 'error', 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

/** Найти основной services.json (тот же порядок поиска, что в get_branches.php) */
function seFindPath(): string
{
    global $rootDir;
    foreach ([
        $rootDir . '/services.json',
        $rootDir . '/config/services.json',
        $rootDir . '/admin/config/services.json',
    ] as $p) {
        if (is_file($p) && filesize($p) > 0) return $p;
    }
    return '';
}

function seLoad(): array
{
    $p = seFindPath();
    if ($p === '') seFail('Файл services.json не найден');
    $raw = preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($p));
    $data = json_decode($raw, true);
    if (!is_array($data)) seFail('Некорректный JSON в services.json');
    // Поддержка оборачивающего ключа "services"
    if (isset($data['services']) && is_array($data['services'])) {
        seFail('Неподдерживаемая структура: объект с ключом "services" (ожидается массив работ)');
    }
    return $data;
}

/** Запись: бэкап → основной файл → синхронизация зеркал */
function seSave(array $items): bool
{
    global $rootDir;
    $mainPath = seFindPath();
    if ($mainPath === '') $mainPath = $rootDir . '/services.json';

    $backupDir = $rootDir . '/config/backups';
    if (!is_dir($backupDir)) @mkdir($backupDir, 0775, true);
    if (is_file($mainPath)) {
        @copy($mainPath, $backupDir . '/services.json.bak.' . date('Ymd_His'));
        $baks = glob($backupDir . '/services.json.bak.*');
        if (is_array($baks) && count($baks) > 50) {
            usort($baks, fn($a, $b) => filemtime($a) <=> filemtime($b));
            foreach (array_slice($baks, 0, count($baks) - 50) as $old) @unlink($old);
        }
    }

    $json = json_encode(array_values($items), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $ok = (file_put_contents($mainPath, $json, LOCK_EX) !== false);
    if (!$ok) return false;

    // Синхронизируем зеркала, если они существуют отдельными файлами
    foreach ([
        $rootDir . '/config/services.json',
        $rootDir . '/admin/config/services.json',
    ] as $mirror) {
        if (is_file($mirror) && realpath($mirror) !== realpath($mainPath)) {
            @file_put_contents($mirror, $json, LOCK_EX);
        }
    }
    return true;
}

/** Список известных кодов подразделений «ОПN» из ценников + config.json (CUSTOMER_NAME вида «СЦ №7 …») */
function seBranchCodes(array $items): array
{
    global $rootDir;
    $codes = [];
    foreach ($items as $s) {
        foreach ((array)($s['prices'] ?? []) as $code => $_) {
            if (preg_match('/^ОП\d+$/u', (string)$code)) $codes[(string)$code] = true;
        }
    }
    $cfgPath = $rootDir . '/config/config.json';
    if (is_file($cfgPath)) {
        $cfg = json_decode(preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($cfgPath)), true);
        foreach (($cfg['branches'] ?? []) as $b) {
            $name = $b['CUSTOMER_NAME'] ?? '';
            if (preg_match('/№\s*(\d+)/u', $name, $m)) {
                $codes['ОП' . $m[1]] = true;
            }
        }
    }
    $keys = array_keys($codes);
    usort($keys, fn($a, $b) => intval(preg_replace('/\D/', '', $a)) <=> intval(preg_replace('/\D/', '', $b)));
    return $keys;
}

function seCodeLabel(string $code, array $branchNames): string
{
    $num = preg_replace('/\D/', '', $code);
    return isset($branchNames[$num]) ? $code . ' — ' . $branchNames[$num] : $code;
}

function seBranchNamesByNum(): array
{
    global $rootDir;
    $out = [];
    $cfgPath = $rootDir . '/config/config.json';
    if (is_file($cfgPath)) {
        $cfg = json_decode(preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($cfgPath)), true);
        foreach (($cfg['branches'] ?? []) as $b) {
            $name = $b['CUSTOMER_NAME'] ?? '';
            if (preg_match('/№\s*(\d+)/u', $name, $m)) $out[$m[1]] = $name;
        }
    }
    return $out;
}

function seNormalizeDuration($v): int
{
    $n = intval(trim((string)$v));
    if ($n < 1 || $n > 2880) seFail('Длительность должна быть от 1 до 2880 минут');
    return $n;
}

function seNormalizePrice($v): string
{
    $s = trim((string)$v);
    if ($s === '' || $s === 'null') return '';
    if (mb_strlen($s) > 40) seFail('Слишком длинное значение цены (макс. 40 символов)');
    // Разрешаем «от 1000», «1000», «1000-1500», «бесплатно» и т.п.; запрещаем управляющие символы
    if (preg_match('/[\x00-\x1F<>]/u', $s)) seFail('Цена содержит недопустимые символы');
    return $s;
}

function seFindIndex(array $items, string $id): int
{
    foreach ($items as $i => $s) {
        if ((string)($s['id'] ?? '') === $id) return $i;
    }
    seFail('Работа не найдена (id=' . $id . ')');
}

$items = seLoad();
$isPost = ($_SERVER['REQUEST_METHOD'] === 'POST');
$action = $isPost ? trim($_POST['action'] ?? '') : trim($_GET['action'] ?? '');

// ---------- GET: список ----------
if ($action === 'list') {
    $branchNames = seBranchNamesByNum();
    $categories = [];
    foreach ($items as $s) {
        $c = $s['category'] ?? 'Без категории';
        if (!isset($categories[$c])) $categories[$c] = 0;
        $categories[$c]++;
    }
    echo json_encode([
        'status'     => 'success',
        'services'   => array_values($items),
        'codes'      => array_map(fn($c) => ['code' => $c, 'label' => seCodeLabel($c, $branchNames)], seBranchCodes($items)),
        'categories' => $categories,
        'total'      => count($items),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!$isPost) seFail('Разрешены только POST-запросы для изменений');

switch ($action) {

    case 'add': {
        $name = trim($_POST['name'] ?? '');
        $cat  = trim($_POST['category'] ?? '');
        if ($name === '' || mb_strlen($name) > 200) seFail('Название работы: от 1 до 200 символов');
        if ($cat === '' || mb_strlen($cat) > 80) seFail('Категория: от 1 до 80 символов');
        $duration = seNormalizeDuration($_POST['duration'] ?? 60);
        $maxId = 0;
        foreach ($items as $s) {
            if (preg_match('/^srv_(\d+)$/u', (string)($s['id'] ?? ''), $m)) $maxId = max($maxId, intval($m[1]));
        }
        $items[] = [
            'id'       => 'srv_' . ($maxId + 1),
            'category' => $cat,
            'name'     => $name,
            'prices'   => new stdClass(),
            'duration' => $duration,
        ];
        if (!seSave($items)) seFail('Не удалось сохранить services.json');
        echo json_encode(['status' => 'success', 'message' => 'Работа добавлена (без цен — укажите цены по подразделениям)', 'id' => 'srv_' . ($maxId + 1)], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'update': {
        $id = trim($_POST['id'] ?? '');
        $idx = seFindIndex($items, $id);
        if (isset($_POST['name'])) {
            $name = trim($_POST['name']);
            if ($name === '' || mb_strlen($name) > 200) seFail('Название работы: от 1 до 200 символов');
            $items[$idx]['name'] = $name;
        }
        if (isset($_POST['category'])) {
            $cat = trim($_POST['category']);
            if ($cat === '' || mb_strlen($cat) > 80) seFail('Категория: от 1 до 80 символов');
            $items[$idx]['category'] = $cat;
        }
        if (isset($_POST['duration'])) {
            $items[$idx]['duration'] = seNormalizeDuration($_POST['duration']);
        }
        if (!seSave($items)) seFail('Не удалось сохранить services.json');
        echo json_encode(['status' => 'success', 'message' => 'Работа обновлена'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'delete': {
        $id = trim($_POST['id'] ?? '');
        $idx = seFindIndex($items, $id);
        $name = $items[$idx]['name'] ?? '';
        array_splice($items, $idx, 1);
        if (!seSave($items)) seFail('Не удалось сохранить services.json');
        echo json_encode(['status' => 'success', 'message' => 'Работа удалена: ' . $name], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'set_price': {
        $id = trim($_POST['id'] ?? '');
        $code = trim($_POST['code'] ?? '');
        if (!preg_match('/^ОП\d{1,3}$/u', $code)) seFail('Код подразделения должен быть вида «ОП7»');
        $idx = seFindIndex($items, $id);
        $value = seNormalizePrice($_POST['value'] ?? '');
        if (!isset($items[$idx]['prices']) || !is_array($items[$idx]['prices'])) {
            $items[$idx]['prices'] = [];
        }
        if ($value === '') {
            unset($items[$idx]['prices'][$code]);
            $items[$idx]['prices'] = (object)$items[$idx]['prices'];
            $msg = 'Цена «' . $code . '» удалена — работа скрыта в этом филиале';
        } else {
            $items[$idx]['prices'] = (array)$items[$idx]['prices'];
            $items[$idx]['prices'][$code] = $value;
            $items[$idx]['prices'] = (object)$items[$idx]['prices'];
            $msg = 'Цена «' . $code . '» сохранена';
        }
        if (!seSave($items)) seFail('Не удалось сохранить services.json');
        echo json_encode(['status' => 'success', 'message' => $msg], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'copy_prices': {
        $from = trim($_POST['from_code'] ?? '');
        $to = trim($_POST['to_code'] ?? '');
        if (!preg_match('/^ОП\d{1,3}$/u', $from) || !preg_match('/^ОП\d{1,3}$/u', $to)) seFail('Некорректные коды подразделений');
        if ($from === $to) seFail('Код источника совпадает с кодом получателя');
        $changed = 0;
        foreach ($items as $i => $s) {
            $prices = (array)($s['prices'] ?? []);
            if (array_key_exists($from, $prices)) {
                $prices[$to] = $prices[$from];
                $items[$i]['prices'] = (object)$prices;
                $changed++;
            } elseif (array_key_exists($to, $prices)) {
                unset($prices[$to]);
                $items[$i]['prices'] = (object)$prices;
            }
        }
        if (!seSave($items)) seFail('Не удалось сохранить services.json');
        echo json_encode(['status' => 'success', 'message' => "Цены скопированы {$from} → {$to} (обновлено работ: {$changed})"], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'rename_category': {
        $from = trim($_POST['from'] ?? '');
        $to = trim($_POST['to'] ?? '');
        if ($from === '' || $to === '' || mb_strlen($to) > 80) seFail('Укажите корректные названия категорий (до 80 символов)');
        $changed = 0;
        foreach ($items as $i => $s) {
            if (($s['category'] ?? '') === $from) {
                $items[$i]['category'] = $to;
                $changed++;
            }
        }
        if ($changed === 0) seFail('Работ в категории «' . $from . '» не найдено');
        if (!seSave($items)) seFail('Не удалось сохранить services.json');
        echo json_encode(['status' => 'success', 'message' => "Категория переименована, обновлено работ: {$changed}"], JSON_UNESCAPED_UNICODE);
        exit;
    }

    default:
        seFail('Неизвестное действие: ' . htmlspecialchars($action, ENT_QUOTES));
}
