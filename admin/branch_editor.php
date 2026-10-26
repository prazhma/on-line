<?php
/**
 * ПИН-АВТО — Редактор подразделений, постов и графиков (admin/branch_editor.php)
 *
 * JSON-API, доступен ТОЛЬКО авторизованному админу (admin_require_auth).
 * Действия:
 *   GET  ?action=get&branch_id=N        — карточка филиала (посты + графики)
 *   POST action=save_info               — название / адрес
 *   POST action=post_toggle             — вкл/выкл поста (is_active)
 *   POST action=post_rename             — переименовать пост
 *   POST action=post_add                — добавить пост (POST_ID из STOCRM или авто)
 *   POST action=post_delete             — удалить пост из локальной конфигурации
 *   POST action=save_worktime           — время работы филиала по дням + выходной день
 *   POST action=save_post_worktime      — индивидуальное расписание поста по дням
 *   POST action=copy_schedule_from      — копировать расписание с другого поста/филиала
 *   POST action=set_dayoff              — быстрый тумблер «выходной день» для филиала
 *
 * Все изменения пишутся в config/config.json (зеркало в корне сохраняется,
 * admin/config.json синхронизируется), перед записью создаётся бэкап.
 */

require __DIR__ . '/admin_auth.php';
admin_require_auth();

header('Content-Type: application/json; charset=utf-8');

$rootDir = dirname(__DIR__);

/** Найти основной конфиг (первичный источник истины — config/config.json) */
function beFindConfig(): string
{
    global $rootDir;
    foreach ([
        $rootDir . '/config/config.json',
        $rootDir . '/config.json',
        $rootDir . '/admin/config.json',
    ] as $p) {
        if (is_file($p) && filesize($p) > 0) return $p;
    }
    return '';
}

function beFail(string $msg): void
{
    echo json_encode(['status' => 'error', 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

function beMinToHm(int $m): string
{
    $m = max(0, min(1439, $m));
    return sprintf('%02d:%02d', intdiv($m, 60), $m % 60);
}

/** "HH:MM" | "HH.MM" | минуты → [ok, minutes] */
function beHmToMin($v): array
{
    $s = trim((string)$v);
    if ($s === '') return [false, 0];
    if (ctype_digit($s)) { // уже минуты (обратная совместимость со старыми данными)
        $m = intval($s);
        return ($m >= 0 && $m <= 1439) ? [true, $m] : [false, 0];
    }
    if (!preg_match('/^(\d{1,2})[:.](\d{2})$/', $s, $m)) return [false, 0];
    $h = intval($m[1]); $mi = intval($m[2]);
    if ($h > 23 || $mi > 59) return [false, 0];
    return [true, $h * 60 + $mi];
}

/**
 * Нормализация блока расписания (филиал или пост):
 * принимает {"1":{"START":..,"END":..},...} в минутах или "HH:MM",
 * поддерживает day_off / off_days. Возвращает чистую структуру в минутах.
 */
function beNormalizeSchedule($raw): array
{
    $out = [];
    if (!is_array($raw)) return $out;
    $days = ['1','2','3','4','5','6','7'];
    // Формат day-flags: {"1":{"WORK":"Y","START_TIME":"09:00"...}} — пропускаем, не используем
    foreach ($days as $d) {
        if (!isset($raw[$d]) || !is_array($raw[$d])) continue;
        $dayRaw = $raw[$d];
        $start = beHmToMin($dayRaw['START'] ?? '');
        $end   = beHmToMin($dayRaw['END'] ?? '');
        if (!$start[0] || !$end[0]) continue;
        $out[$d] = ['START' => $start[1], 'END' => $end[1]];
    }
    if (!empty($raw['day_off'])) {
        $out['day_off'] = true;
    }
    if (isset($raw['off_days']) && is_array($raw['off_days'])) {
        $od = array_values(array_unique(array_filter(array_map('intval', $raw['off_days']), fn($v) => $v >= 1 && $v <= 7)));
        if ($od) $out['off_days'] = $od;
    }
    return $out;
}

/** Запись конфига: бэкап → основной файл → зеркало в корне → копия в admin/ */
function beSaveConfig(array $config): bool
{
    global $rootDir;
    $mainPath = $rootDir . '/config/config.json';
    if (!is_dir(dirname($mainPath))) @mkdir(dirname($mainPath), 0775, true);

    $backupDir = $rootDir . '/config/backups';
    if (!is_dir($backupDir)) @mkdir($backupDir, 0775, true);
    if (is_file($mainPath)) {
        @copy($mainPath, $backupDir . '/config.json.bak.' . date('Ymd_His'));
        // Не храним больше 50 бэкапов
        $baks = glob($backupDir . '/config.json.bak.*');
        if (is_array($baks) && count($baks) > 50) {
            usort($baks, fn($a, $b) => filemtime($a) <=> filemtime($b));
            foreach (array_slice($baks, 0, count($baks) - 50) as $old) @unlink($old);
        }
    }

    $json = json_encode($config, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    $saved = (file_put_contents($mainPath, $json, LOCK_EX) !== false);

    // Зеркало в корне (для legacy-потребителей)
    if (is_file($rootDir . '/config.json')) {
        @file_put_contents($rootDir . '/config.json', $json, LOCK_EX);
    }
    // Синхронизируем копию админки, если она существует отдельным файлом
    if (is_file($rootDir . '/admin/config.json') && realpath($rootDir . '/admin/config.json') !== realpath($mainPath)) {
        @file_put_contents($rootDir . '/admin/config.json', $json, LOCK_EX);
    }
    return $saved;
}

$configPath = beFindConfig();
if ($configPath === '') beFail('Файл config.json не найден');

$config = json_decode(preg_replace('/^\xEF\xBB\xBF/', '', file_get_contents($configPath)), true);
if (!is_array($config) || !isset($config['branches']) || !is_array($config['branches'])) {
    beFail('Некорректная структура config.json');
}

$isPost = ($_SERVER['REQUEST_METHOD'] === 'POST');
$action = $isPost ? trim($_POST['action'] ?? '') : trim($_GET['action'] ?? '');
$branchIdRaw = $isPost ? trim($_POST['branch_id'] ?? '') : trim($_GET['branch_id'] ?? '');

// ---------- GET: карточка филиала ----------
if ($action === 'get') {
    if ($branchIdRaw === '' || !isset($config['branches'][$branchIdRaw])) {
        beFail('Филиал не найден в конфигурации');
    }
    $b = $config['branches'][$branchIdRaw];

    $posts = [];
    foreach (($b['posts'] ?? []) as $pid => $post) {
        if (!is_array($post)) continue;
        $wt = beNormalizeSchedule($post['work_time'] ?? null);
        $inherit = empty($post['schedule_mode']) || $post['schedule_mode'] === 'inherit';
        $posts[] = [
            'id'          => (string)($post['POST_ID'] ?? $pid),
            'key'         => (string)$pid,
            'name'        => $post['NAME'] ?? ('Пост #' . $pid),
            'type'        => $post['POST_TYPE'] ?? 'DEFAULT',
            'active'      => !(isset($post['is_active']) && in_array($post['is_active'], [false, 0, '0', 'false', 'N', 'n'], true)),
            'has_own_wt'  => !$inherit,
            'work_time'   => $wt,
        ];
    }

    $branchesList = [];
    foreach ($config['branches'] as $id => $bb) {
        $branchesList[] = ['id' => (string)$id, 'name' => $bb['CUSTOMER_NAME'] ?? ('Филиал #' . $id)];
    }

    echo json_encode([
        'status'  => 'success',
        'branch'  => [
            'id'      => (string)$branchIdRaw,
            'name'    => $b['CUSTOMER_NAME'] ?? '',
            'address' => $b['ADDRESS'] ?? '',
            'city'    => $b['CITY_NAME'] ?? '',
            'active'  => $b['ACTIVE'] ?? 'Y',
            'booking_enabled' => !isset($b['booking_enabled']) ? true : (bool)$b['booking_enabled'],
            'work_time' => beNormalizeSchedule($b['work_time'] ?? null),
        ],
        'posts'        => $posts,
        'all_branches' => $branchesList,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ---------- Дальше только POST ----------
if (!$isPost) beFail('Разрешены только POST-запросы для изменений');
if (!isset($config['branches'][$branchIdRaw])) beFail('Филиал не найден в конфигурации');

switch ($action) {

    case 'save_info': {
        $name = trim($_POST['name'] ?? '');
        $addr = trim($_POST['address'] ?? '');
        if ($name === '' || mb_strlen($name) > 120) beFail('Название филиала должно быть от 1 до 120 символов');
        if (mb_strlen($addr) > 250) beFail('Адрес слишком длинный (макс. 250 символов)');
        $config['branches'][$branchIdRaw]['CUSTOMER_NAME'] = $name;
        $config['branches'][$branchIdRaw]['ADDRESS'] = $addr;
        if (!beSaveConfig($config)) beFail('Не удалось сохранить config.json');
        echo json_encode(['status' => 'success', 'message' => 'Данные филиала обновлены'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'post_toggle': {
        $postId = trim($_POST['post_id'] ?? '');
        if ($postId === '' || !isset($config['branches'][$branchIdRaw]['posts'][$postId])) {
            beFail('Пост не найден');
        }
        $enabled = filter_var($_POST['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
        $config['branches'][$branchIdRaw]['posts'][$postId]['is_active'] = $enabled;
        if (!beSaveConfig($config)) beFail('Не удалось сохранить изменения');
        echo json_encode(['status' => 'success', 'message' => $enabled ? 'Пост включён' : 'Пост выключен (скрыт из записи)'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'post_rename': {
        $postId = trim($_POST['post_id'] ?? '');
        $name = trim($_POST['name'] ?? '');
        if ($postId === '' || !isset($config['branches'][$branchIdRaw]['posts'][$postId])) beFail('Пост не найден');
        if ($name === '' || mb_strlen($name) > 120) beFail('Название поста должно быть от 1 до 120 символов');
        $config['branches'][$branchIdRaw]['posts'][$postId]['NAME'] = $name;
        if (!beSaveConfig($config)) beFail('Не удалось сохранить изменения');
        echo json_encode(['status' => 'success', 'message' => 'Название поста обновлено'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'post_add': {
        $postId = trim($_POST['post_id'] ?? '');
        $name = trim($_POST['name'] ?? '');
        if ($name === '' || mb_strlen($name) > 120) beFail('Укажите название поста (до 120 символов)');
        $posts =& $config['branches'][$branchIdRaw]['posts'];
        if (!is_array($posts)) $posts = [];
        if ($postId === '') {
            $postId = (string)(max(array_map('intval', array_keys($posts) ?: [0])) + 1);
        }
        if (!preg_match('/^\d{1,9}$/', $postId)) beFail('ID поста должен быть числом (ID поста сервиса STOCRM)');
        if (isset($posts[$postId])) beFail('Пост #' . $postId . ' уже существует в этом филиале');
        $posts[$postId] = [
            'POST_ID'   => intval($postId),
            'NAME'      => $name,
            'POST_TYPE' => 'DEFAULT',
            'is_active' => true,
        ];
        unset($posts);
        if (!beSaveConfig($config)) beFail('Не удалось сохранить изменения');
        echo json_encode(['status' => 'success', 'message' => 'Пост добавлен (по умолчанию наследует график филиала)', 'post_id' => $postId], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'post_delete': {
        $postId = trim($_POST['post_id'] ?? '');
        if ($postId === '' || !isset($config['branches'][$branchIdRaw]['posts'][$postId])) beFail('Пост не найден');
        unset($config['branches'][$branchIdRaw]['posts'][$postId]);
        if (!beSaveConfig($config)) beFail('Не удалось сохранить изменения');
        echo json_encode(['status' => 'success', 'message' => 'Пост удалён из локальной конфигурации (в STOCRM не тронут)'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'set_dayoff': {
        $day = intval($_POST['day'] ?? 0);
        $off = filter_var($_POST['off'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($day < 1 || $day > 7) beFail('Некорректный день недели');
        $wt = beNormalizeSchedule($config['branches'][$branchIdRaw]['work_time'] ?? null);
        $od = $wt['off_days'] ?? [];
        if ($off) { if (!in_array($day, $od, true)) $od[] = $day; }
        else { $od = array_values(array_filter($od, fn($d) => $d !== $day)); }
        sort($od);
        if ($od) $wt['off_days'] = $od; else unset($wt['off_days']);
        $config['branches'][$branchIdRaw]['work_time'] = $wt;
        if (!beSaveConfig($config)) beFail('Не удалось сохранить изменения');
        echo json_encode(['status' => 'success', 'message' => $off ? 'День сделан выходным' : 'Рабочий день восстановлен'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'save_worktime': {
        $wt = [];
        for ($d = 1; $d <= 7; $d++) {
            $s = beHmToMin($_POST["wt_{$d}_start"] ?? '');
            $e = beHmToMin($_POST["wt_{$d}_end"] ?? '');
            if (!$s[0] && !$e[0]) continue; // день не задан
            if (!$s[0] || !$e[0]) beFail('День ' . $d . ': укажите время в формате ЧЧ:ММ');
            if ($e[1] <= $s[1]) beFail('День ' . $d . ': окончание должно быть позже начала');
            $wt[(string)$d] = ['START' => $s[1], 'END' => $e[1]];
        }
        $offDays = array_values(array_unique(array_filter(array_map('intval', (array)($_POST['off_days'] ?? [])), fn($v) => $v >= 1 && $v <= 7)));
        if ($offDays) {
            sort($offDays);
            $wt['off_days'] = $offDays;
        }
        if (count($wt) === 0) beFail('Не задано ни одного рабочего дня');
        $config['branches'][$branchIdRaw]['work_time'] = $wt;
        if (!beSaveConfig($config)) beFail('Не удалось сохранить изменения');
        echo json_encode(['status' => 'success', 'message' => 'График работы филиала сохранён'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'save_post_worktime': {
        $postId = trim($_POST['post_id'] ?? '');
        if ($postId === '' || !isset($config['branches'][$branchIdRaw]['posts'][$postId])) beFail('Пост не найден');
        $mode = ($_POST['mode'] ?? 'inherit') === 'own' ? 'own' : 'inherit';
        $post =& $config['branches'][$branchIdRaw]['posts'][$postId];
        if ($mode === 'inherit') {
            $post['schedule_mode'] = 'inherit';
            unset($post['work_time']);
        } else {
            $wt = [];
            for ($d = 1; $d <= 7; $d++) {
                $s = beHmToMin($_POST["wt_{$d}_start"] ?? '');
                $e = beHmToMin($_POST["wt_{$d}_end"] ?? '');
                if (!$s[0] && !$e[0]) continue;
                if (!$s[0] || !$e[0]) beFail('День ' . $d . ': укажите время в формате ЧЧ:ММ');
                if ($e[1] <= $s[1]) beFail('День ' . $d . ': окончание должно быть позже начала');
                $wt[(string)$d] = ['START' => $s[1], 'END' => $e[1]];
            }
            $offDays = array_values(array_unique(array_filter(array_map('intval', (array)($_POST['off_days'] ?? [])), fn($v) => $v >= 1 && $v <= 7)));
            if ($offDays) { sort($offDays); $wt['off_days'] = $offDays; }
            if (count($wt) === 0) beFail('Для собственного расписания укажите хотя бы один рабочий день');
            $post['schedule_mode'] = 'own';
            $post['work_time'] = $wt;
        }
        unset($post);
        if (!beSaveConfig($config)) beFail('Не удалось сохранить изменения');
        echo json_encode(['status' => 'success', 'message' => $mode === 'own' ? 'Индивидуальное расписание поста сохранено' : 'Пост снова наследует график филиала'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    case 'copy_schedule_from': {
        $postId = trim($_POST['post_id'] ?? '');
        $sourceBranch = trim($_POST['source_branch'] ?? '');
        $sourcePost = trim($_POST['source_post'] ?? '');
        if ($postId === '' || !isset($config['branches'][$branchIdRaw]['posts'][$postId])) beFail('Целевой пост не найден');
        if ($sourceBranch === '' || !isset($config['branches'][$sourceBranch])) beFail('Филиал-источник не найден');

        if ($sourcePost !== '') {
            if (!isset($config['branches'][$sourceBranch]['posts'][$sourcePost])) beFail('Пост-источник не найден');
            $src = beNormalizeSchedule($config['branches'][$sourceBranch]['posts'][$sourcePost]['work_time'] ?? null);
            if (empty($src)) beFail('У поста-источника нет собственного расписания — копировать нечего');
            $config['branches'][$branchIdRaw]['posts'][$postId]['schedule_mode'] = 'own';
            $config['branches'][$branchIdRaw]['posts'][$postId]['work_time'] = $src;
            $msg = 'Расписание скопировано с поста #' . $sourcePost;
        } else {
            $src = beNormalizeSchedule($config['branches'][$sourceBranch]['work_time'] ?? null);
            if (empty($src)) beFail('У филиала-источника нет графика');
            $config['branches'][$branchIdRaw]['posts'][$postId]['schedule_mode'] = 'inherit';
            unset($config['branches'][$branchIdRaw]['posts'][$postId]['work_time']);
            $msg = 'Пост переведён на график филиала «' . ($config['branches'][$sourceBranch]['CUSTOMER_NAME'] ?? $sourceBranch) . '» (наследование)';
        }
        if (!beSaveConfig($config)) beFail('Не удалось сохранить изменения');
        echo json_encode(['status' => 'success', 'message' => $msg], JSON_UNESCAPED_UNICODE);
        exit;
    }

    default:
        beFail('Неизвестное действие: ' . htmlspecialchars($action, ENT_QUOTES));
}
