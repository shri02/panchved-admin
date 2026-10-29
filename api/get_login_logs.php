<?php
/**
 * Panchved Admin - Get Login Logs API
 * GET / POST: /api/get_login_logs.php
 *
 * Parameters:
 * - search (string: name, identifier, phone, email, ip)
 * - user_type (string: 'all', 'Doctor', 'Patient', 'Admin')
 * - date_filter (string: 'all', 'today', 'yesterday', 'last_7_days', 'last_30_days', 'custom')
 * - date_from (string: YYYY-MM-DD)
 * - date_to (string: YYYY-MM-DD)
 * - page (int, default 1)
 * - limit (int, default 10)
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

require_once __DIR__ . '/db_connect.php';

// Accept both GET and JSON POST payload
$raw_input = file_get_contents('php://input');
$body_data = [];
if ($raw_input !== false && trim($raw_input) !== '') {
    $decoded = json_decode($raw_input, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $body_data = $decoded;
    }
}

$search = trim((string) ($_GET['search'] ?? $body_data['search'] ?? ''));
$user_type = trim((string) ($_GET['user_type'] ?? $body_data['user_type'] ?? 'all'));
$date_filter = trim((string) ($_GET['date_filter'] ?? $body_data['date_filter'] ?? 'all'));
$date_from = trim((string) ($_GET['date_from'] ?? $body_data['date_from'] ?? ''));
$date_to = trim((string) ($_GET['date_to'] ?? $body_data['date_to'] ?? ''));
$page = max(1, intval($_GET['page'] ?? $body_data['page'] ?? 1));
$limit = max(1, min(100, intval($_GET['limit'] ?? $body_data['limit'] ?? 10)));
$offset = ($page - 1) * $limit;

// Helper: parse human-friendly device & browser from User-Agent
function parseUserAgentDevice($ua) {
    if (empty($ua)) return 'Web Client';
    $os = 'Unknown OS';
    if (preg_match('/windows nt 10/i', $ua)) $os = 'Windows 10/11';
    elseif (preg_match('/windows nt 6\.3/i', $ua)) $os = 'Windows 8.1';
    elseif (preg_match('/windows nt/i', $ua)) $os = 'Windows';
    elseif (preg_match('/iphone/i', $ua)) $os = 'iPhone (iOS)';
    elseif (preg_match('/ipad/i', $ua)) $os = 'iPad (iPadOS)';
    elseif (preg_match('/android/i', $ua)) $os = 'Android';
    elseif (preg_match('/macintosh|mac os x/i', $ua)) $os = 'macOS';
    elseif (preg_match('/linux/i', $ua)) $os = 'Linux';

    $browser = 'Browser';
    if (preg_match('/edg/i', $ua)) $browser = 'Edge';
    elseif (preg_match('/chrome|crios/i', $ua)) $browser = 'Chrome';
    elseif (preg_match('/firefox|fxios/i', $ua)) $browser = 'Firefox';
    elseif (preg_match('/safari/i', $ua) && !preg_match('/chrome|crios/i', $ua)) $browser = 'Safari';
    elseif (preg_match('/opera|opr/i', $ua)) $browser = 'Opera';

    return "{$browser} • {$os}";
}

// Helper: format relative time
function formatRelativeTime($timestamp) {
    $time = strtotime($timestamp);
    if (!$time) return 'N/A';
    $now = time();
    $diff = $now - $time;

    if ($diff < 0) {
        return date('d M Y, h:i A', $time);
    }
    if ($diff < 60) {
        return 'Just now';
    }
    if ($diff < 3600) {
        $mins = floor($diff / 60);
        return $mins . ' min' . ($mins > 1 ? 's' : '') . ' ago';
    }
    if ($diff < 86400) {
        $hours = floor($diff / 3600);
        return $hours . ' hr' . ($hours > 1 ? 's' : '') . ' ago';
    }
    if ($diff < 172800) {
        return 'Yesterday at ' . date('h:i A', $time);
    }
    return date('d M Y, h:i A', $time);
}

// 1. Check if `login_logs` table exists
$tableExists = false;
if ($connection1) {
    $checkRes = @mysqli_query($connection1, "SHOW TABLES LIKE 'login_logs'");
    if ($checkRes && mysqli_num_rows($checkRes) > 0) {
        $tableExists = true;
    }
}

if (!$tableExists) {
    echo json_encode([
        'status' => '1',
        'table_exists' => false,
        'message' => 'The `login_logs` table has not yet been created in the database. Please execute the provided `login_logs_schema.sql` script.',
        'summary' => [
            'total_logins' => 0,
            'today_logins' => 0,
            'doctor_logins_today' => 0,
            'patient_logins_today' => 0
        ],
        'current_page' => 1,
        'limit' => $limit,
        'total_records' => 0,
        'total_pages' => 1,
        'data' => []
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// 2. Fetch live KPI Summary Cards
$summary = [
    'total_logins' => 0,
    'today_logins' => 0,
    'doctor_logins_today' => 0,
    'patient_logins_today' => 0
];

$sumRes = @mysqli_query($connection1, "
    SELECT 
        COUNT(*) AS total_logins,
        SUM(CASE WHEN DATE(login_time) = CURDATE() THEN 1 ELSE 0 END) AS today_logins,
        SUM(CASE WHEN user_type = 'Doctor' AND DATE(login_time) = CURDATE() THEN 1 ELSE 0 END) AS doctor_logins_today,
        SUM(CASE WHEN user_type = 'Patient' AND DATE(login_time) = CURDATE() THEN 1 ELSE 0 END) AS patient_logins_today
    FROM `login_logs`
");
if ($sumRes && $row = mysqli_fetch_assoc($sumRes)) {
    $summary['total_logins'] = intval($row['total_logins'] ?? 0);
    $summary['today_logins'] = intval($row['today_logins'] ?? 0);
    $summary['doctor_logins_today'] = intval($row['doctor_logins_today'] ?? 0);
    $summary['patient_logins_today'] = intval($row['patient_logins_today'] ?? 0);
}

// 3. Build WHERE clauses for list query
$where_clauses = [];
$params = [];
$types = '';

if ($user_type !== '' && strtolower($user_type) !== 'all') {
    $where_clauses[] = "user_type = ?";
    $params[] = ucfirst(strtolower($user_type));
    $types .= 's';
}

if ($search !== '') {
    $where_clauses[] = "(
        name LIKE ? OR
        identifier LIKE ? OR
        phone LIKE ? OR
        email LIKE ? OR
        ip_address LIKE ?
    )";
    $search_param = '%' . $search . '%';
    for ($i = 0; $i < 5; $i++) {
        $params[] = $search_param;
        $types .= 's';
    }
}

// Date filters
if ($date_filter === 'today') {
    $where_clauses[] = "DATE(login_time) = CURDATE()";
} elseif ($date_filter === 'yesterday') {
    $where_clauses[] = "DATE(login_time) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)";
} elseif ($date_filter === 'last_7_days') {
    $where_clauses[] = "login_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)";
} elseif ($date_filter === 'last_30_days') {
    $where_clauses[] = "login_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)";
} elseif ($date_filter === 'custom' || (!empty($date_from) || !empty($date_to))) {
    if (!empty($date_from)) {
        $where_clauses[] = "DATE(login_time) >= ?";
        $params[] = $date_from;
        $types .= 's';
    }
    if (!empty($date_to)) {
        $where_clauses[] = "DATE(login_time) <= ?";
        $params[] = $date_to;
        $types .= 's';
    }
}

$where_sql = '';
if (!empty($where_clauses)) {
    $where_sql = ' WHERE ' . implode(' AND ', $where_clauses);
}

// 4. Count total matching records
$count_sql = "SELECT COUNT(*) AS total FROM `login_logs`" . $where_sql;
$count_stmt = mysqli_prepare($connection1, $count_sql);
$total_records = 0;

if ($count_stmt) {
    if (!empty($params)) {
        mysqli_stmt_bind_param($count_stmt, $types, ...$params);
    }
    mysqli_stmt_execute($count_stmt);
    $count_res = mysqli_stmt_get_result($count_stmt);
    if ($count_res && $cRow = mysqli_fetch_assoc($count_res)) {
        $total_records = intval($cRow['total'] ?? 0);
    }
    mysqli_stmt_close($count_stmt);
}

$total_pages = $total_records > 0 ? (int)ceil($total_records / $limit) : 1;

// 5. Fetch records
$data_sql = "
    SELECT 
        id,
        user_type,
        user_id,
        identifier,
        name,
        phone,
        email,
        ip_address,
        user_agent,
        status,
        login_time,
        created_at
    FROM `login_logs`
    " . $where_sql . "
    ORDER BY login_time DESC, id DESC
    LIMIT ?, ?
";

$data_stmt = mysqli_prepare($connection1, $data_sql);
$logs = [];

if ($data_stmt) {
    $data_params = $params;
    $data_types = $types . 'ii';
    $data_params[] = $offset;
    $data_params[] = $limit;

    mysqli_stmt_bind_param($data_stmt, $data_types, ...$data_params);
    mysqli_stmt_execute($data_stmt);
    $data_res = mysqli_stmt_get_result($data_stmt);

    if ($data_res) {
        while ($row = mysqli_fetch_assoc($data_res)) {
            $raw_time = $row['login_time'];
            $timestamp = strtotime($raw_time);

            $row['id'] = (int)$row['id'];
            $row['user_id'] = !empty($row['user_id']) ? (int)$row['user_id'] : null;
            $row['formatted_date'] = $timestamp ? date('d M Y', $timestamp) : '-';
            $row['formatted_time'] = $timestamp ? date('h:i A', $timestamp) : '-';
            $row['time_ago'] = formatRelativeTime($raw_time);
            $row['device_info'] = parseUserAgentDevice($row['user_agent'] ?? '');

            $logs[] = $row;
        }
    }
    mysqli_stmt_close($data_stmt);
}

echo json_encode([
    'status' => '1',
    'table_exists' => true,
    'message' => 'Login logs fetched successfully.',
    'summary' => $summary,
    'current_page' => $page,
    'limit' => $limit,
    'total_records' => $total_records,
    'total_pages' => $total_pages,
    'data' => $logs
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>
