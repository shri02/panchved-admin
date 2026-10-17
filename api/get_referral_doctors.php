<?php
/**
 * Panchved Admin - Get Doctors Referral List API
 * GET/POST: /api/get_referral_doctors.php
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

// Check if doctors table exists
$table_check = mysqli_query($connection1, "SHOW TABLES LIKE 'doctors'");
if (!$table_check || mysqli_num_rows($table_check) === 0) {
    echo json_encode([
        'status' => '1',
        'message' => 'Table doctors does not exist yet.',
        'data' => [],
        'pagination' => [
            'page' => $page,
            'limit' => $limit,
            'total_records' => 0,
            'total_pages' => 0,
            'showing_start' => 0,
            'showing_end' => 0
        ]
    ]);
    exit;
}

// Check if patients table has referral_code column
$pat_col_check = mysqli_query($connection1, "SHOW COLUMNS FROM patients LIKE 'referral_code'");
$has_pat_referral_col = ($pat_col_check && mysqli_num_rows($pat_col_check) > 0);

// Check if doctors table has referral_code column
$doc_col_check = mysqli_query($connection1, "SHOW COLUMNS FROM doctors LIKE 'referral_code'");
$has_doc_referral_col = ($doc_col_check && mysqli_num_rows($doc_col_check) > 0);

$where_clauses = [];
$params = [];
$types = '';

if ($search !== '') {
    $where_clauses[] = "(
        d.full_name LIKE ? OR
        d.doctorid LIKE ? OR
        d.phone_number LIKE ? OR
        d.email LIKE ? OR
        d.expertise LIKE ? OR
        " . ($has_doc_referral_col ? "d.referral_code LIKE ?" : "1=0") . "
    )";
    $search_param = '%' . $search . '%';
    $search_count = $has_doc_referral_col ? 6 : 5;
    for ($i = 0; $i < $search_count; $i++) {
        $params[] = $search_param;
        $types .= 's';
    }
}

if ($status !== '' && strtolower($status) !== 'all') {
    $where_clauses[] = "d.status = ?";
    $params[] = ucfirst(strtolower($status));
    $types .= 's';
}

$where_sql = '';
if (!empty($where_clauses)) {
    $where_sql = ' WHERE ' . implode(' AND ', $where_clauses);
}

// Count total
$count_sql = "SELECT COUNT(*) as total FROM doctors d" . $where_sql;
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

if ($has_pat_referral_col && $has_doc_referral_col) {
    $data_sql = "
        SELECT 
            d.id,
            d.doctorid,
            d.full_name,
            d.phone_number,
            d.email,
            d.expertise,
            d.area,
            d.referral_code,
            d.status,
            d.created_at,
            COUNT(p.id) AS referred_count
        FROM doctors d
        LEFT JOIN patients p ON (p.referral_code = d.referral_code AND d.referral_code IS NOT NULL AND d.referral_code != '')
        {$where_sql}
        GROUP BY d.id
        ORDER BY d.id DESC
        LIMIT ? OFFSET ?
    ";
} else {
    $ref_field = $has_doc_referral_col ? "d.referral_code" : "'' AS referral_code";
    $data_sql = "
        SELECT 
            d.id,
            d.doctorid,
            d.full_name,
            d.phone_number,
            d.email,
            d.expertise,
            d.area,
            {$ref_field},
            d.status,
            d.created_at,
            0 AS referred_count
        FROM doctors d
        {$where_sql}
        ORDER BY d.id DESC
        LIMIT ? OFFSET ?
    ";
}

$list_params = $params;
$list_types = $types . 'ii';
$list_params[] = $limit;
$list_params[] = $offset;

$stmt = mysqli_prepare($connection1, $data_sql);
$doctors = [];

if ($stmt) {
    mysqli_stmt_bind_param($stmt, $list_types, ...$list_params);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $row['id'] = intval($row['id']);
            $row['referred_count'] = intval($row['referred_count'] ?? 0);
            $row['referral_code'] = $row['referral_code'] ?? '';
            if (empty($row['doctorid'])) {
                $row['doctorid'] = 'DOC' . str_pad((string)$row['id'], 6, '0', STR_PAD_LEFT);
            }
            $doctors[] = $row;
        }
    }
    mysqli_stmt_close($stmt);
}

$showing_start = $total_records > 0 ? ($offset + 1) : 0;
$showing_end = min($offset + count($doctors), $total_records);

echo json_encode([
    'status' => '1',
    'message' => 'Doctor referrals retrieved successfully.',
    'data' => $doctors,
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
