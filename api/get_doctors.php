<?php

/**
 * Panchved Admin - Get Doctors List API
 * GET/POST: /api/get_doctors.php
 *
 * Parameters (query string or JSON body):
 * - search (string)
 * - status (string: 'Active', 'Inactive', or 'all')
 * - expertise (string)
 * - page (int, default 1)
 * - limit (int, default 5)
 */

require_once __DIR__ . '/db_connect.php';

// Accept both GET and POST requests
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
$expertise = trim((string) ($_GET['expertise'] ?? $body_data['expertise'] ?? ''));
$page = max(1, intval($_GET['page'] ?? $body_data['page'] ?? 1));
$limit = max(1, intval($_GET['limit'] ?? $body_data['limit'] ?? 5));
$offset = ($page - 1) * $limit;

/* =========================================
   BUILD WHERE CLAUSE
========================================= */

$where_clauses = [];
$params = [];
$types = '';

if ($search !== '') {
    $where_clauses[] = "(
        full_name LIKE ? OR
        doctorid LIKE ? OR
        phone_number LIKE ? OR
        email LIKE ? OR
        expertise LIKE ? OR
        area LIKE ? OR
        registration_number LIKE ?
    )";
    $search_param = '%' . $search . '%';
    for ($i = 0; $i < 7; $i++) {
        $params[] = $search_param;
        $types .= 's';
    }
}

if ($status !== '' && strtolower($status) !== 'all') {
    if (strpos($status, ',') !== false) {
        $statuses = array_map('trim', explode(',', $status));
        $placeholders = implode(',', array_fill(0, count($statuses), '?'));
        $where_clauses[] = "status IN ($placeholders)";
        foreach ($statuses as $st) {
            $params[] = $st;
            $types .= 's';
        }
    } else {
        $where_clauses[] = "status = ?";
        $params[] = $status;
        $types .= 's';
    }
}

if ($expertise !== '' && strtolower($expertise) !== 'all') {
    if (strpos($expertise, ',') !== false) {
        $expertises = array_map('trim', explode(',', $expertise));
        $placeholders = implode(',', array_fill(0, count($expertises), '?'));
        $where_clauses[] = "expertise IN ($placeholders)";
        foreach ($expertises as $exp) {
            $params[] = $exp;
            $types .= 's';
        }
    } else {
        $where_clauses[] = "expertise LIKE ?";
        $params[] = '%' . $expertise . '%';
        $types .= 's';
    }
}

$where_sql = '';
if (!empty($where_clauses)) {
    $where_sql = ' WHERE ' . implode(' AND ', $where_clauses);
}

/* =========================================
   COUNT TOTAL RECORDS
========================================= */

$count_sql = "SELECT COUNT(*) as total FROM doctors" . $where_sql;
$count_stmt = mysqli_prepare($connection1, $count_sql);

if (!$count_stmt) {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to prepare count query.',
        'error' => mysqli_error($connection1)
    ]);
    exit;
}

if (!empty($params)) {
    mysqli_stmt_bind_param($count_stmt, $types, ...$params);
}

mysqli_stmt_execute($count_stmt);
$count_result = mysqli_stmt_get_result($count_stmt);
$total_records = 0;

if ($count_result && $row = mysqli_fetch_assoc($count_result)) {
    $total_records = intval($row['total']);
} else {
    // Fallback if get_result is unavailable
    mysqli_stmt_store_result($count_stmt);
    mysqli_stmt_bind_result($count_stmt, $total_count_val);
    if (mysqli_stmt_fetch($count_stmt)) {
        $total_records = intval($total_count_val);
    }
}
mysqli_stmt_close($count_stmt);

$total_pages = $total_records > 0 ? (int) ceil($total_records / $limit) : 1;

/* =========================================
   FETCH DOCTOR RECORDS
========================================= */

$data_sql = "
    SELECT 
        id,
        doctorid,
        full_name,
        date_of_birth,
        phone_number,
        gender,
        email,
        years_of_experience,
        expertise,
        area,
        registration_number,
        hpr_registration_number,
        start_time,
        end_time,
        status,
        created_at
    FROM doctors
    " . $where_sql . "
    ORDER BY id DESC
    LIMIT ?, ?
";

// If about column exists, include it
$has_about_col = false;
$about_chk = @mysqli_query($connection1, "SHOW COLUMNS FROM doctors LIKE 'about'");
if ($about_chk && mysqli_num_rows($about_chk) > 0) {
    $has_about_col = true;
    $data_sql = "
        SELECT 
            id,
            doctorid,
            full_name,
            date_of_birth,
            phone_number,
            gender,
            email,
            years_of_experience,
            expertise,
            area,
            registration_number,
            hpr_registration_number,
            about,
            start_time,
            end_time,
            status,
            created_at
        FROM doctors
        " . $where_sql . "
        ORDER BY id DESC
        LIMIT ?, ?
    ";
}

$data_stmt = mysqli_prepare($connection1, $data_sql);

if (!$data_stmt) {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to prepare data query.',
        'error' => mysqli_error($connection1)
    ]);
    exit;
}

$data_params = $params;
$data_types = $types . 'ii';
$data_params[] = $offset;
$data_params[] = $limit;

mysqli_stmt_bind_param($data_stmt, $data_types, ...$data_params);
mysqli_stmt_execute($data_stmt);

$doctors = [];
$data_result = mysqli_stmt_get_result($data_stmt);

// Check if login_logs table exists for retrieving login timings
$hasLoginLogs = false;
$chkLogs = @mysqli_query($connection1, "SHOW TABLES LIKE 'login_logs'");
if ($chkLogs && mysqli_num_rows($chkLogs) > 0) {
    $hasLoginLogs = true;
}

if ($data_result) {
    while ($doc = mysqli_fetch_assoc($data_result)) {
        if (empty($doc['doctorid'])) {
            $doc['doctorid'] = 'DOC' . str_pad((string)$doc['id'], 6, '0', STR_PAD_LEFT);
        }
        $doc['id'] = (int) $doc['id'];
        $doc['years_of_experience'] = (int) $doc['years_of_experience'];
        $doc['start_time'] = !empty($doc['start_time']) ? $doc['start_time'] : '09:00:00';
        $doc['end_time'] = !empty($doc['end_time']) ? $doc['end_time'] : '17:00:00';
        $doc['about'] = $doc['about'] ?? '';
        $doc['referral_code'] = $doc['referral_code'] ?? '';

        // Retrieve last login timing
        $lastLoginTime = null;
        if ($hasLoginLogs) {
            $lStmt = @mysqli_prepare($connection1, "SELECT login_time FROM `login_logs` WHERE user_type = 'Doctor' AND (user_id = ? OR identifier = ? OR phone = ?) ORDER BY login_time DESC LIMIT 1");
            if ($lStmt) {
                mysqli_stmt_bind_param($lStmt, "iss", $doc['id'], $doc['doctorid'], $doc['phone_number']);
                mysqli_stmt_execute($lStmt);
                $lRes = mysqli_stmt_get_result($lStmt);
                if ($lRes && $lRow = mysqli_fetch_assoc($lRes)) {
                    $lastLoginTime = $lRow['login_time'];
                }
                mysqli_stmt_close($lStmt);
            }
        }
        if (!$lastLoginTime && !empty($doc['last_login'])) {
            $lastLoginTime = $doc['last_login'];
        }
        $doc['last_login'] = $lastLoginTime;
        $doc['last_login_formatted'] = $lastLoginTime ? date('d M Y, h:i A', strtotime($lastLoginTime)) : 'Never';
        $doctors[] = $doc;
    }
} else {
    // Fallback using store_result / bind_result
    mysqli_stmt_store_result($data_stmt);
    mysqli_stmt_bind_result(
        $data_stmt,
        $d_id,
        $d_doctorid,
        $d_full_name,
        $d_date_of_birth,
        $d_phone_number,
        $d_gender,
        $d_email,
        $d_years_of_experience,
        $d_expertise,
        $d_area,
        $d_registration_number,
        $d_hpr_registration_number,
        $d_start_time,
        $d_end_time,
        $d_status,
        $d_created_at
    );

    while (mysqli_stmt_fetch($data_stmt)) {
        $doctorid_val = $d_doctorid ?: ('DOC' . str_pad((string)$d_id, 6, '0', STR_PAD_LEFT));
        $doctors[] = [
            'id' => (int) $d_id,
            'doctorid' => $doctorid_val,
            'full_name' => $d_full_name,
            'date_of_birth' => $d_date_of_birth,
            'phone_number' => $d_phone_number,
            'gender' => $d_gender,
            'email' => $d_email,
            'years_of_experience' => (int) $d_years_of_experience,
            'expertise' => $d_expertise,
            'area' => $d_area,
            'registration_number' => $d_registration_number,
            'hpr_registration_number' => $d_hpr_registration_number,
            'start_time' => $d_start_time ?: '09:00:00',
            'end_time' => $d_end_time ?: '17:00:00',
            'status' => $d_status,
            'created_at' => $d_created_at
        ];
    }
}

mysqli_stmt_close($data_stmt);

/* =========================================
   DYNAMIC FILTER OPTIONS
========================================= */
$available_statuses = [];
if ($connection1) {
    $st_res = @mysqli_query($connection1, "
        SELECT DISTINCT status FROM doctors WHERE status IS NOT NULL AND TRIM(status) != ''
        ORDER BY status ASC
    ");
    if ($st_res) {
        while ($sRow = mysqli_fetch_assoc($st_res)) {
            if (!empty($sRow['status'])) {
                $available_statuses[] = $sRow['status'];
            }
        }
    }
}
if (empty($available_statuses)) {
    $available_statuses = ['Active', 'Inactive'];
}

$available_expertises = [];
if ($connection1) {
    $exp_res = @mysqli_query($connection1, "
        SELECT DISTINCT expertise FROM doctors WHERE expertise IS NOT NULL AND TRIM(expertise) != ''
        ORDER BY expertise ASC
    ");
    if ($exp_res) {
        $raw_expertises = [];
        while ($eRow = mysqli_fetch_assoc($exp_res)) {
            $raw_val = trim($eRow['expertise'] ?? '');
            if ($raw_val !== '') {
                $parts = explode(',', $raw_val);
                foreach ($parts as $p) {
                    $p = trim($p);
                    if ($p !== '' && !in_array($p, $raw_expertises, true)) {
                        $raw_expertises[] = $p;
                    }
                }
            }
        }
        sort($raw_expertises, SORT_NATURAL | SORT_FLAG_CASE);
        $available_expertises = array_values($raw_expertises);
    }
}


/* =========================================
   OUTPUT JSON RESPONSE
========================================= */

http_response_code(200);
echo json_encode([
    'status' => '1',
    'message' => 'Doctors fetched successfully.',
    'current_page' => $page,
    'limit' => $limit,
    'total_records' => $total_records,
    'total_pages' => $total_pages,
    'data' => $doctors,
    'filter_options' => [
        'statuses' => $available_statuses,
        'expertises' => $available_expertises
    ]
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>
