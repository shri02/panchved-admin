<?php
/**
 * Panchved Admin - Get Patients List API
 * GET/POST: /api/get_patients.php
 *
 * Parameters:
 * - search (string: name, id, phone, email)
 * - package (string)
 * - status (string: 'Ongoing', 'Completed', 'Active', 'Inactive', 'all')
 * - page (int, default 1)
 * - limit (int, default 5)
 */

require_once __DIR__ . '/db_connect.php';
global $connection1;
$connection1 = $GLOBALS['connection1'] ?? $connection1;

$raw_input = file_get_contents('php://input');
$body_data = [];
if ($raw_input !== false && trim($raw_input) !== '') {
    $decoded = json_decode($raw_input, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $body_data = $decoded;
    }
}

$search = trim((string) ($_GET['search'] ?? $body_data['search'] ?? ''));
$package = trim((string) ($_GET['package'] ?? $body_data['package'] ?? ''));
$status = trim((string) ($_GET['status'] ?? $body_data['status'] ?? ''));
$page = max(1, intval($_GET['page'] ?? $body_data['page'] ?? 1));
$limit = max(1, intval($_GET['limit'] ?? $body_data['limit'] ?? 5));
$offset = ($page - 1) * $limit;

$where_clauses = [];
$params = [];
$types = '';

if ($search !== '') {
    $where_clauses[] = "(
        full_name LIKE ? OR
        patient_id LIKE ? OR
        phone_number LIKE ? OR
        email LIKE ? OR
        package_name LIKE ?
    )";
    $search_param = '%' . $search . '%';
    for ($i = 0; $i < 5; $i++) {
        $params[] = $search_param;
        $types .= 's';
    }
}

if ($package !== '' && strtolower($package) !== 'all') {
    if (strpos($package, ',') !== false) {
        $packages = array_map('trim', explode(',', $package));
        $placeholders = implode(',', array_fill(0, count($packages), '?'));
        $where_clauses[] = "package_name IN ($placeholders)";
        foreach ($packages as $pkg) {
            $params[] = $pkg;
            $types .= 's';
        }
    } else {
        $where_clauses[] = "package_name LIKE ?";
        $params[] = '%' . $package . '%';
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

$where_sql = '';
if (!empty($where_clauses)) {
    $where_sql = ' WHERE ' . implode(' AND ', $where_clauses);
}

// Count total records
$count_sql = "SELECT COUNT(*) as total FROM patients" . $where_sql;
$count_stmt = mysqli_prepare($connection1, $count_sql);
$total_records = 0;

if ($count_stmt) {
    if (!empty($params)) {
        mysqli_stmt_bind_param($count_stmt, $types, ...$params);
    }
    mysqli_stmt_execute($count_stmt);
    $count_result = mysqli_stmt_get_result($count_stmt);
    if ($count_result && $row = mysqli_fetch_assoc($count_result)) {
        $total_records = intval($row['total']);
    }
    mysqli_stmt_close($count_stmt);
}

$total_pages = $total_records > 0 ? (int) ceil($total_records / $limit) : 1;

// Fetch patient records
$data_sql = "
    SELECT 
        id,
        patient_id,
        full_name,
        dob,
        age,
        phone_number,
        gender,
        email,
        blood_group,
        emergency_contact,
        address,
        package_name,
        total_appointments,
        status,
        created_at
    FROM patients
    " . $where_sql . "
    ORDER BY id DESC
    LIMIT ?, ?
";

$stmt = mysqli_prepare($connection1, $data_sql);
$patients = [];

if ($stmt) {
    $fetch_params = $params;
    $fetch_params[] = $offset;
    $fetch_params[] = $limit;
    $fetch_types = $types . 'ii';

    mysqli_stmt_bind_param($stmt, $fetch_types, ...$fetch_params);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    // Check if login_logs table exists for retrieving login timings
    $hasLoginLogs = false;
    $chkLogs = @mysqli_query($connection1, "SHOW TABLES LIKE 'login_logs'");
    if ($chkLogs && mysqli_num_rows($chkLogs) > 0) {
        $hasLoginLogs = true;
    }

    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            // Auto compute age if dob is set and age is 0
            if ((empty($row['age']) || $row['age'] == 0) && !empty($row['dob'])) {
                $dob = new DateTime($row['dob']);
                $now = new DateTime();
                $row['age'] = $now->diff($dob)->y;
            }
            // Retrieve last login timing
            $lastLoginTime = null;
            if ($hasLoginLogs) {
                $lStmt = @mysqli_prepare($connection1, "SELECT login_time FROM `login_logs` WHERE user_type = 'Patient' AND (user_id = ? OR identifier = ? OR phone = ?) ORDER BY login_time DESC LIMIT 1");
                if ($lStmt) {
                    mysqli_stmt_bind_param($lStmt, "iss", $row['id'], $row['patient_id'], $row['phone_number']);
                    mysqli_stmt_execute($lStmt);
                    $lRes = mysqli_stmt_get_result($lStmt);
                    if ($lRes && $lRow = mysqli_fetch_assoc($lRes)) {
                        $lastLoginTime = $lRow['login_time'];
                    }
                    mysqli_stmt_close($lStmt);
                }
            }
            if (!$lastLoginTime && !empty($row['last_login'])) {
                $lastLoginTime = $row['last_login'];
            }
            $row['last_login'] = $lastLoginTime;
            $row['last_login_formatted'] = $lastLoginTime ? date('d M Y, h:i A', strtotime($lastLoginTime)) : 'Never';

            $patients[] = $row;
        }
    }
    mysqli_stmt_close($stmt);
}

// Fetch dynamic distinct filter options from database
$available_packages = [];
if ($connection1) {
    $pkg_res = @mysqli_query($connection1, "
        SELECT DISTINCT package_name FROM patients WHERE package_name IS NOT NULL AND TRIM(package_name) != ''
        UNION
        SELECT DISTINCT package_name FROM packages WHERE package_name IS NOT NULL AND TRIM(package_name) != ''
        ORDER BY package_name ASC
    ");
    if ($pkg_res) {
        while ($pRow = mysqli_fetch_assoc($pkg_res)) {
            if (!empty($pRow['package_name'])) {
                $available_packages[] = $pRow['package_name'];
            }
        }
    }
}

$available_statuses = [];
if ($connection1) {
    $st_res = @mysqli_query($connection1, "
        SELECT DISTINCT status FROM patients WHERE status IS NOT NULL AND TRIM(status) != ''
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
    $available_statuses = ['Ongoing', 'Completed'];
}

echo json_encode([
    'status' => '1',
    'message' => 'Patients fetched successfully.',
    'total_records' => $total_records,
    'total_pages' => $total_pages,
    'current_page' => $page,
    'limit' => $limit,
    'data' => $patients,
    'filter_options' => [
        'packages' => $available_packages,
        'statuses' => $available_statuses
    ]
]);

