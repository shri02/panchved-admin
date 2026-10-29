<?php
/**
 * Panchved Admin - Get Activity / Audit Logs API
 * GET / POST: /api/get_activity_logs.php
 *
 * Parameters:
 * - search (string: description, user_name, entity_name, action, identifier)
 * - module (string: 'all', 'Consultation', 'Package', 'Workshop', 'Prescription', 'Diet', 'Patient', 'Doctor', 'Referral_Partner', 'Referral_Social', 'Profile', 'Billing', 'Auth')
 * - user_type (string: 'all', 'Admin', 'Doctor', 'Patient', 'System')
 * - date_filter (string: 'all', 'today', 'yesterday', 'last_7_days', 'last_30_days', 'custom')
 * - date_from (string: YYYY-MM-DD)
 * - date_to (string: YYYY-MM-DD)
 * - page (int, default 1)
 * - limit (int, default 15)
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

date_default_timezone_set('Asia/Kolkata');
if (isset($connection1) && $connection1) {
    @mysqli_query($connection1, "SET time_zone = '+05:30'");
}

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
$module = trim((string) ($_GET['module'] ?? $body_data['module'] ?? 'all'));
$user_type = trim((string) ($_GET['user_type'] ?? $body_data['user_type'] ?? 'all'));
$date_filter = trim((string) ($_GET['date_filter'] ?? $body_data['date_filter'] ?? 'all'));
$date_from = trim((string) ($_GET['date_from'] ?? $body_data['date_from'] ?? ''));
$date_to = trim((string) ($_GET['date_to'] ?? $body_data['date_to'] ?? ''));
$page = max(1, intval($_GET['page'] ?? $body_data['page'] ?? 1));
$limit = max(1, min(100, intval($_GET['limit'] ?? $body_data['limit'] ?? 15)));
$offset = ($page - 1) * $limit;

// Device parser helper
function parseDeviceFromUa($ua) {
    if (empty($ua)) return 'Web Client';
    $os = 'Windows';
    if (preg_match('/windows nt 10/i', $ua)) $os = 'Windows 10/11';
    elseif (preg_match('/windows nt 6\.3/i', $ua)) $os = 'Windows 8.1';
    elseif (preg_match('/windows/i', $ua)) $os = 'Windows';
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

// Relative time helper
function formatActivityTime($timestamp) {
    $time = strtotime($timestamp);
    if (!$time) return ['display' => 'N/A', 'relative' => 'N/A'];
    $now = time();
    $diff = $now - $time;

    $display = date('d M Y, h:i A', $time);
    $relative = 'Just now';

    if ($diff < 0) {
        $relative = 'Just now';
    } elseif ($diff < 60) {
        $relative = 'Just now';
    } elseif ($diff < 3600) {
        $mins = floor($diff / 60);
        $relative = $mins . ' min' . ($mins > 1 ? 's' : '') . ' ago';
    } elseif ($diff < 86400) {
        $hours = floor($diff / 3600);
        $relative = $hours . ' hr' . ($hours > 1 ? 's' : '') . ' ago';
    } elseif ($diff < 172800) {
        $relative = 'Yesterday at ' . date('h:i A', $time);
    } else {
        $relative = date('d M Y', $time);
    }

    return ['display' => $display, 'relative' => $relative];
}

// Module color badge helper
function getModuleBadgeInfo($mod) {
    $m = strtolower(trim((string)$mod));
    switch ($m) {
        case 'consultation':
            return ['badge_class' => 'badge-consultation', 'icon' => 'fa-stethoscope', 'color' => '#0284c7'];
        case 'package':
            return ['badge_class' => 'badge-package', 'icon' => 'fa-cube', 'color' => '#7c3aed'];
        case 'workshop':
            return ['badge_class' => 'badge-workshop', 'icon' => 'fa-chalkboard-teacher', 'color' => '#d97706'];
        case 'prescription':
            return ['badge_class' => 'badge-prescription', 'icon' => 'fa-prescription', 'color' => '#059669'];
        case 'diet':
            return ['badge_class' => 'badge-diet', 'icon' => 'fa-apple-alt', 'color' => '#16a34a'];
        case 'patient':
            return ['badge_class' => 'badge-patient', 'icon' => 'fa-user-injured', 'color' => '#2563eb'];
        case 'doctor':
            return ['badge_class' => 'badge-doctor', 'icon' => 'fa-user-md', 'color' => '#0d9488'];
        case 'referral_partner':
        case 'referral_social':
            return ['badge_class' => 'badge-referral', 'icon' => 'fa-handshake', 'color' => '#e11d48'];
        case 'billing':
            return ['badge_class' => 'badge-billing', 'icon' => 'fa-receipt', 'color' => '#475569'];
        case 'auth':
            return ['badge_class' => 'badge-auth', 'icon' => 'fa-key', 'color' => '#64748b'];
        case 'profile':
            return ['badge_class' => 'badge-profile', 'icon' => 'fa-id-badge', 'color' => '#4338ca'];
        default:
            return ['badge_class' => 'badge-default', 'icon' => 'fa-history', 'color' => '#6b7280'];
    }
}

if (!$connection1) {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'Database connection failed.',
        'data' => [],
        'total_records' => 0
    ]);
    exit;
}

// 1. Check if `activity_logs` table exists
$table_check_res = @mysqli_query($connection1, "SHOW TABLES LIKE 'activity_logs'");
$table_exists = ($table_check_res && mysqli_num_rows($table_check_res) > 0);

if (!$table_exists) {
    echo json_encode([
        'status' => '1',
        'table_exists' => false,
        'message' => 'The activity_logs table does not exist in the database.',
        'data' => [],
        'summary' => [
            'total_activities' => 0,
            'today_activities' => 0,
            'admin_activities_today' => 0,
            'doctor_activities_today' => 0,
            'patient_activities_today' => 0
        ],
        'total_records' => 0,
        'total_pages' => 0,
        'current_page' => $page,
        'limit' => $limit
    ]);
    exit;
}

// 2. Build Query Filters
$where_clauses = [];
$params = [];
$types = '';

// Filter: Module
if (!empty($module) && strtolower($module) !== 'all') {
    $where_clauses[] = "module = ?";
    $params[] = $module;
    $types .= 's';
}

// Filter: User Type
if (!empty($user_type) && strtolower($user_type) !== 'all') {
    $where_clauses[] = "user_type = ?";
    $params[] = ucfirst(strtolower($user_type));
    $types .= 's';
}

// Filter: Date
$today = date('Y-m-d');
if ($date_filter === 'today') {
    $where_clauses[] = "DATE(created_at) = ?";
    $params[] = $today;
    $types .= 's';
} elseif ($date_filter === 'yesterday') {
    $yesterday = date('Y-m-d', strtotime('-1 day'));
    $where_clauses[] = "DATE(created_at) = ?";
    $params[] = $yesterday;
    $types .= 's';
} elseif ($date_filter === 'last_7_days') {
    $start_7 = date('Y-m-d', strtotime('-6 days'));
    $where_clauses[] = "DATE(created_at) BETWEEN ? AND ?";
    $params[] = $start_7;
    $params[] = $today;
    $types .= 'ss';
} elseif ($date_filter === 'last_30_days') {
    $start_30 = date('Y-m-d', strtotime('-29 days'));
    $where_clauses[] = "DATE(created_at) BETWEEN ? AND ?";
    $params[] = $start_30;
    $params[] = $today;
    $types .= 'ss';
} elseif ($date_filter === 'custom' || (!empty($date_from) || !empty($date_to))) {
    if (!empty($date_from) && !empty($date_to)) {
        $where_clauses[] = "DATE(created_at) BETWEEN ? AND ?";
        $params[] = $date_from;
        $params[] = $date_to;
        $types .= 'ss';
    } elseif (!empty($date_from)) {
        $where_clauses[] = "DATE(created_at) >= ?";
        $params[] = $date_from;
        $types .= 's';
    } elseif (!empty($date_to)) {
        $where_clauses[] = "DATE(created_at) <= ?";
        $params[] = $date_to;
        $types .= 's';
    }
}

// Filter: Search Keyword
if ($search !== '') {
    $search_like = '%' . $search . '%';
    $where_clauses[] = "(description LIKE ? OR user_name LIKE ? OR entity_name LIKE ? OR action LIKE ? OR user_identifier LIKE ?)";
    $params[] = $search_like;
    $params[] = $search_like;
    $params[] = $search_like;
    $params[] = $search_like;
    $params[] = $search_like;
    $types .= 'sssss';
}

$where_sql = !empty($where_clauses) ? ' WHERE ' . implode(' AND ', $where_clauses) : '';

// 3. KPI Summary
$summary = [
    'total_activities' => 0,
    'today_activities' => 0,
    'admin_activities_today' => 0,
    'doctor_activities_today' => 0,
    'patient_activities_today' => 0
];

$summary_sql = "
    SELECT 
        COUNT(*) as total_activities,
        SUM(CASE WHEN DATE(created_at) = '{$today}' THEN 1 ELSE 0 END) as today_activities,
        SUM(CASE WHEN DATE(created_at) = '{$today}' AND user_type = 'Admin' THEN 1 ELSE 0 END) as admin_activities_today,
        SUM(CASE WHEN DATE(created_at) = '{$today}' AND user_type = 'Doctor' THEN 1 ELSE 0 END) as doctor_activities_today,
        SUM(CASE WHEN DATE(created_at) = '{$today}' AND user_type = 'Patient' THEN 1 ELSE 0 END) as patient_activities_today
    FROM activity_logs
";
$sum_res = @mysqli_query($connection1, $summary_sql);
if ($sum_res && $sum_row = mysqli_fetch_assoc($sum_res)) {
    $summary['total_activities'] = intval($sum_row['total_activities'] ?? 0);
    $summary['today_activities'] = intval($sum_row['today_activities'] ?? 0);
    $summary['admin_activities_today'] = intval($sum_row['admin_activities_today'] ?? 0);
    $summary['doctor_activities_today'] = intval($sum_row['doctor_activities_today'] ?? 0);
    $summary['patient_activities_today'] = intval($sum_row['patient_activities_today'] ?? 0);
}

// 4. Count Filtered Records
$count_sql = "SELECT COUNT(*) as cnt FROM activity_logs" . $where_sql;
$total_records = 0;

if (!empty($params)) {
    $count_stmt = mysqli_prepare($connection1, $count_sql);
    if ($count_stmt) {
        mysqli_stmt_bind_param($count_stmt, $types, ...$params);
        mysqli_stmt_execute($count_stmt);
        mysqli_stmt_bind_result($count_stmt, $cnt_val);
        if (mysqli_stmt_fetch($count_stmt)) {
            $total_records = intval($cnt_val);
        }
        mysqli_stmt_close($count_stmt);
    }
} else {
    $c_res = @mysqli_query($connection1, $count_sql);
    if ($c_res && $c_row = mysqli_fetch_assoc($c_res)) {
        $total_records = intval($c_row['cnt']);
    }
}

$total_pages = $total_records > 0 ? (int) ceil($total_records / $limit) : 0;

// 5. Fetch Records
$data_sql = "SELECT * FROM activity_logs" . $where_sql . " ORDER BY id DESC LIMIT ? OFFSET ?";
$params_page = $params;
$params_page[] = $limit;
$params_page[] = $offset;
$types_page = $types . 'ii';

$data = [];
$data_stmt = mysqli_prepare($connection1, $data_sql);
if ($data_stmt) {
    mysqli_stmt_bind_param($data_stmt, $types_page, ...$params_page);
    mysqli_stmt_execute($data_stmt);
    $result = mysqli_stmt_get_result($data_stmt);

    while ($row = mysqli_fetch_assoc($result)) {
        $timeInfo = formatActivityTime($row['created_at']);
        $badgeInfo = getModuleBadgeInfo($row['module']);
        $deviceInfo = parseDeviceFromUa($row['user_agent'] ?? '');

        // Decode details if valid JSON
        $details_parsed = null;
        if (!empty($row['details'])) {
            $d = json_decode($row['details'], true);
            $details_parsed = (json_last_error() === JSON_ERROR_NONE) ? $d : $row['details'];
        }

        $data[] = [
            'id' => intval($row['id']),
            'user_type' => $row['user_type'],
            'user_id' => intval($row['user_id']),
            'user_name' => $row['user_name'] ?: 'System',
            'user_identifier' => $row['user_identifier'],
            'module' => $row['module'],
            'action' => $row['action'],
            'entity_type' => $row['entity_type'],
            'entity_id' => intval($row['entity_id']),
            'entity_name' => $row['entity_name'],
            'description' => $row['description'],
            'details' => $details_parsed,
            'details_raw' => $row['details'],
            'ip_address' => $row['ip_address'],
            'user_agent' => $row['user_agent'],
            'device' => $deviceInfo,
            'created_at' => $row['created_at'],
            'time_display' => $timeInfo['display'],
            'time_relative' => $timeInfo['relative'],
            'badge_class' => $badgeInfo['badge_class'],
            'icon' => $badgeInfo['icon'],
            'color' => $badgeInfo['color']
        ];
    }
    mysqli_stmt_close($data_stmt);
}

echo json_encode([
    'status' => '1',
    'table_exists' => true,
    'message' => 'Activity logs fetched successfully.',
    'summary' => $summary,
    'data' => $data,
    'current_page' => $page,
    'total_pages' => $total_pages,
    'total_records' => $total_records,
    'limit' => $limit
]);
?>
