<?php
/**
 * Panchved Admin - Get Social Media Referrals List API
 * GET/POST: /api/get_referral_social.php
 *
 * Parameters:
 * - search (string)
 * - status (string: 'Active', 'Inactive', or 'all')
 * - page (int, default 1)
 * - limit (int, default 10)
 */

require_once __DIR__ . '/db_connect.php';

$raw_input = file_get_contents('php://input');
$body_data = [];
if ($raw_input !== false && trim($raw_input) !== '') {
    $decoded = json_decode($raw_input, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $body_data = $decoded;
    }
}

$search = trim((string) ($_GET['search'] ?? $body_data['search'] ?? ''));
$status = trim((string) ($_GET['status'] ?? $body_data['status'] ?? ''));
$page = max(1, intval($_GET['page'] ?? $body_data['page'] ?? 1));
$limit = max(1, intval($_GET['limit'] ?? $body_data['limit'] ?? 10));
$offset = ($page - 1) * $limit;

// Check if social_media_referrals table exists
$table_check = mysqli_query($connection1, "SHOW TABLES LIKE 'social_media_referrals'");
if (!$table_check || mysqli_num_rows($table_check) === 0) {
    echo json_encode([
        'status' => '1',
        'message' => 'Table social_media_referrals does not exist yet. Please execute the SQL migration script.',
        'data' => [],
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total_records' => 0,
            'total_pages' => 0,
            'showing_start' => 0,
            'showing_end' => 0
        ],
        'requires_schema' => true
    ]);
    exit;
}

// Check if patients table has referral_code column
$pat_col_check = mysqli_query($connection1, "SHOW COLUMNS FROM patients LIKE 'referral_code'");
$has_pat_referral_col = ($pat_col_check && mysqli_num_rows($pat_col_check) > 0);

$where_clauses = [];
$params = [];
$types = '';

if ($search !== '') {
    $where_clauses[] = "(
        sm.platform LIKE ? OR
        sm.campaign_name LIKE ? OR
        sm.referral_code LIKE ? OR
        sm.target_url LIKE ? OR
        sm.notes LIKE ?
    )";
    $search_param = '%' . $search . '%';
    for ($i = 0; $i < 5; $i++) {
        $params[] = $search_param;
        $types .= 's';
    }
}

if ($status !== '' && strtolower($status) !== 'all') {
    $where_clauses[] = "sm.status = ?";
    $params[] = ucfirst(strtolower($status));
    $types .= 's';
}

$where_sql = '';
if (!empty($where_clauses)) {
    $where_sql = ' WHERE ' . implode(' AND ', $where_clauses);
}

// Count total
$count_sql = "SELECT COUNT(*) as total FROM social_media_referrals sm" . $where_sql;
$total_records = 0;

if (!empty($params)) {
    $cnt_stmt = mysqli_prepare($connection1, $count_sql);
    if ($cnt_stmt) {
        mysqli_stmt_bind_param($cnt_stmt, $types, ...$params);
        mysqli_stmt_execute($cnt_stmt);
        mysqli_stmt_bind_result($cnt_stmt, $cnt_res);
        if (mysqli_stmt_fetch($cnt_stmt)) {
            $total_records = intval($cnt_res);
        }
        mysqli_stmt_close($cnt_stmt);
    }
} else {
    $cnt_res = mysqli_query($connection1, $count_sql);
    if ($cnt_res && $c_row = mysqli_fetch_assoc($cnt_res)) {
        $total_records = intval($c_row['total']);
    }
}

$total_pages = $total_records > 0 ? (int) ceil($total_records / $limit) : 1;

if ($has_pat_referral_col) {
    $data_sql = "
        SELECT 
            sm.id,
            sm.campaign_id,
            sm.platform,
            sm.campaign_name,
            sm.referral_code,
            sm.target_url,
            sm.notes,
            sm.status,
            sm.created_at,
            COUNT(p.id) AS referred_count
        FROM social_media_referrals sm
        LEFT JOIN patients p ON (p.referral_code = sm.referral_code AND sm.referral_code IS NOT NULL AND sm.referral_code != '')
        {$where_sql}
        GROUP BY sm.id
        ORDER BY sm.id DESC
        LIMIT ? OFFSET ?
    ";
} else {
    $data_sql = "
        SELECT 
            sm.id,
            sm.campaign_id,
            sm.platform,
            sm.campaign_name,
            sm.referral_code,
            sm.target_url,
            sm.notes,
            sm.status,
            sm.created_at,
            0 AS referred_count
        FROM social_media_referrals sm
        {$where_sql}
        ORDER BY sm.id DESC
        LIMIT ? OFFSET ?
    ";
}

$list_params = $params;
$list_types = $types . 'ii';
$list_params[] = $limit;
$list_params[] = $offset;

$stmt = mysqli_prepare($connection1, $data_sql);
$referrals = [];

if ($stmt) {
    mysqli_stmt_bind_param($stmt, $list_types, ...$list_params);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $row['id'] = intval($row['id']);
            $row['referred_count'] = intval($row['referred_count'] ?? 0);
            if (empty($row['campaign_id'])) {
                $row['campaign_id'] = 'SOC' . str_pad((string)$row['id'], 4, '0', STR_PAD_LEFT);
            }
            $referrals[] = $row;
        }
    }
    mysqli_stmt_close($stmt);
}

$showing_start = $total_records > 0 ? ($offset + 1) : 0;
$showing_end = min($offset + count($referrals), $total_records);

echo json_encode([
    'status' => '1',
    'message' => 'Social media referrals retrieved successfully.',
    'data' => $referrals,
    'pagination' => [
        'page' => $page,
        'limit' => $limit,
        'total_records' => $total_records,
        'total_pages' => $total_pages,
        'showing_start' => $showing_start,
        'showing_end' => $showing_end
    ]
]);
?>
