<?php
/**
 * Panchved Admin - Get Packages List API
 * GET/POST: /api/get_packages.php
 *
 * Parameters:
 * - search (string)
 * - status (string: 'Active', 'Inactive', 'all')
 * - page (int, default 1)
 * - limit (int, default 5)
 */

require_once __DIR__ . '/database.php';

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
$limit = max(1, intval($_GET['limit'] ?? $body_data['limit'] ?? 5));
$offset = ($page - 1) * $limit;

// Stats: Total, Active, Total Enrollments
$stat_total = 0;
$stat_active = 0;
$stat_enrollments = 0;

if ($connection1) {
    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM packages");
    if ($res && $row = mysqli_fetch_assoc($res)) { $stat_total = (int)$row['total']; }

    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM packages WHERE status = 'Active'");
    if ($res && $row = mysqli_fetch_assoc($res)) { $stat_active = (int)$row['total']; }

    $res = @mysqli_query($connection1, "SELECT SUM(enrollments) as total FROM packages");
    if ($res && $row = mysqli_fetch_assoc($res)) { $stat_enrollments = (int)$row['total']; }
} else {
    $stat_total = 0;
    $stat_active = 0;
    $stat_enrollments = 0;
}

// Check existing columns
$has_assigned_doctor = false;
$has_assign_doctor = false;
$has_assigned_doctor_one = false;
$has_assigned_doctor_1 = false;
$has_assigned_doctor_2 = false;
$has_assign_doctor_2 = false;
$has_assign_doctor_two = false;
$has_assigned_doctor_two = false;
if ($connection1) {
    $col_res = @mysqli_query($connection1, "SHOW COLUMNS FROM packages");
    if ($col_res) {
        while ($c = mysqli_fetch_assoc($col_res)) {
            if ($c['Field'] === 'assigned_doctor') $has_assigned_doctor = true;
            if ($c['Field'] === 'assign_doctor') $has_assign_doctor = true;
            if ($c['Field'] === 'assigned_doctor_one') $has_assigned_doctor_one = true;
            if ($c['Field'] === 'assigned_doctor_1') $has_assigned_doctor_1 = true;
            if ($c['Field'] === 'assigned_doctor_2') $has_assigned_doctor_2 = true;
            if ($c['Field'] === 'assign_doctor_2') $has_assign_doctor_2 = true;
            if ($c['Field'] === 'assign_doctor_two') $has_assign_doctor_two = true;
            if ($c['Field'] === 'assigned_doctor_two') $has_assigned_doctor_two = true;
        }
    }
}
if ($has_assigned_doctor_one) {
    $doc_field_sql = "assigned_doctor_one as assigned_doctor,";
} elseif ($has_assigned_doctor_1) {
    $doc_field_sql = "assigned_doctor_1 as assigned_doctor,";
} elseif ($has_assign_doctor) {
    $doc_field_sql = "assign_doctor as assigned_doctor,";
} elseif ($has_assigned_doctor) {
    $doc_field_sql = "assigned_doctor,";
} else {
    $doc_field_sql = "NULL as assigned_doctor,";
}

if ($has_assign_doctor_two) {
    $doc_field_sql .= " assign_doctor_two as assigned_doctor_2,";
} elseif ($has_assigned_doctor_two) {
    $doc_field_sql .= " assigned_doctor_two as assigned_doctor_2,";
} elseif ($has_assigned_doctor_2) {
    $doc_field_sql .= " assigned_doctor_2,";
} elseif ($has_assign_doctor_2) {
    $doc_field_sql .= " assign_doctor_2 as assigned_doctor_2,";
} else {
    $doc_field_sql .= " NULL as assigned_doctor_2,";
}

$where_clauses = [];
$params = [];
$types = '';

if ($search !== '') {
    $where_clauses[] = "(
        package_name LIKE ? OR
        package_id LIKE ? OR
        category LIKE ? OR
        short_description LIKE ?
    )";
    $search_param = '%' . $search . '%';
    for ($i = 0; $i < 4; $i++) {
        $params[] = $search_param;
        $types .= 's';
    }
}

if ($status !== '' && strtolower($status) !== 'all') {
    $where_clauses[] = "status = ?";
    $params[] = $status;
    $types .= 's';
}

$where_sql = '';
if (!empty($where_clauses)) {
    $where_sql = ' WHERE ' . implode(' AND ', $where_clauses);
}

// Count filtered
$count_sql = "SELECT COUNT(*) as total FROM packages" . $where_sql;
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

// Fetch packages
$data_sql = "
    SELECT 
        id,
        package_id,
        package_name,
        category,
        {$doc_field_sql}
        duration,
        price,
        enrollments,
        protocol_status,
        image_url,
        short_description,
        overview,
        benefits,
        included,
        diet_hydration,
        yoga_physio,
        ayurveda_dinacharya,
        daily_activity,
        patient_monitoring,
        followup_review,
        status,
        created_at
    FROM packages
    " . $where_sql . "
    ORDER BY id DESC
    LIMIT ?, ?
";

$stmt = mysqli_prepare($connection1, $data_sql);
$packages = [];

if ($stmt) {
    $fetch_params = $params;
    $fetch_params[] = $offset;
    $fetch_params[] = $limit;
    $fetch_types = $types . 'ii';

    mysqli_stmt_bind_param($stmt, $fetch_types, ...$fetch_params);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $doc1 = trim((string)($row['assigned_doctor'] ?? $row['assign_doctor'] ?? ''));
            $doc2 = trim((string)($row['assigned_doctor_2'] ?? ''));

            if ($doc2 === '' && strpos($doc1, ',') !== false) {
                $parts = array_map('trim', explode(',', $doc1, 2));
                $doc1 = $parts[0];
                $doc2 = $parts[1] ?? '';
            }

            $row['assigned_doctor'] = $doc1;
            $row['assigned_doctor_1'] = $doc1;
            $row['assigned_doctor_2'] = $doc2;
            $row['assign_doctor'] = $doc1;
            $row['assign_doctor_1'] = $doc1;
            $row['assign_doctor_2'] = $doc2;

            $combined_doc = $doc1;
            if ($doc2 !== '') {
                $combined_doc = $doc1 !== '' ? ($doc1 . ', ' . $doc2) : $doc2;
            }
            $row['combined_doctor'] = $combined_doc ?: '-';
            $packages[] = $row;
        }
    }
    mysqli_stmt_close($stmt);
}

// Fallback mock records if database is empty - REMOVED (Dynamic DB data only)

echo json_encode([
    'status' => '1',
    'message' => 'Packages fetched successfully.',
    'stats' => [
        'total_packages' => $stat_total,
        'active_packages' => $stat_active,
        'total_enrollment' => $stat_enrollments
    ],
    'total_records' => $total_records,
    'total_pages' => $total_pages,
    'current_page' => $page,
    'limit' => $limit,
    'data' => $packages
]);
