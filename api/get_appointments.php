<?php
/**
 * Panchved Admin - Get Appointments API
 * GET/POST: /api/get_appointments.php
 *
 * Parameters:
 * - search (string: patient_name, doctor_name, appointment_id)
 * - status (string)
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

// Aggregate Stats: Total, Today's, Completed
$stat_total = 0;
$stat_today = 0;
$stat_completed = 0;

if ($connection1) {
    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM appointments");
    if ($res && $row = mysqli_fetch_assoc($res)) { $stat_total = (int)$row['total']; }

    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM appointments WHERE appointment_date = CURDATE()");
    if ($res && $row = mysqli_fetch_assoc($res)) { $stat_today = (int)$row['total']; }

    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM appointments WHERE status = 'Completed'");
    if ($res && $row = mysqli_fetch_assoc($res)) { $stat_completed = (int)$row['total']; }
}

$where_clauses = [];
$params = [];
$types = '';

if ($search !== '') {
    $where_clauses[] = "(
        patient_name LIKE ? OR
        doctor_name LIKE ? OR
        appointment_id LIKE ? OR
        package_name LIKE ?
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
$count_sql = "SELECT COUNT(*) as total FROM appointments" . $where_sql;
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

// Fetch appointments
$data_sql = "
    SELECT 
        id,
        appointment_id,
        patient_id,
        patient_name,
        doctor_id,
        doctor_name,
        package_name,
        appointment_date,
        appointment_time,
        duration,
        service_type,
        agenda,
        prescription,
        status,
        created_at
    FROM appointments
    " . $where_sql . "
    ORDER BY id DESC
    LIMIT ?, ?
";

$stmt = mysqli_prepare($connection1, $data_sql);
$appointments = [];

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
            // Format nice display date (e.g. 2 Sep 2026)
            if (!empty($row['appointment_date']) && strtotime($row['appointment_date']) !== false) {
                $row['formatted_date'] = date('j M Y', strtotime($row['appointment_date']));
            } else {
                $row['formatted_date'] = '-';
            }
            $appointments[] = $row;
        }
    }
    mysqli_stmt_close($stmt);
}

echo json_encode([
    'status' => '1',
    'message' => 'Appointments fetched successfully.',
    'stats' => [
        'total_appointments' => $stat_total,
        'today_appointments' => $stat_today,
        'completed_appointments' => $stat_completed
    ],
    'total_records' => $total_records,
    'total_pages' => $total_pages,
    'current_page' => $page,
    'limit' => $limit,
    'data' => $appointments
]);
