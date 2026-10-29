<?php
/**
 * Panchved Admin - Update Patient API
 * POST: /api/update_patient.php
 */

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/activity_logger.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => '0', 'message' => 'Only POST method is allowed.']);
    exit;
}

$raw_data = file_get_contents('php://input');
$data = [];
if ($raw_data !== false && trim($raw_data) !== '') {
    $jsonData = json_decode($raw_data, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($jsonData)) {
        $data = $jsonData;
    }
}
if (empty($data) && !empty($_POST)) {
    $data = $_POST;
}

$id = intval($data['id'] ?? 0);
$patient_id = trim((string) ($data['patient_id'] ?? ''));

if ($id <= 0 && $patient_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Patient id or patient_id is required.']);
    exit;
}

$full_name = trim((string) ($data['full_name'] ?? $data['name'] ?? ''));
$phone_number = trim((string) ($data['phone_number'] ?? $data['phone'] ?? ''));
$email = trim((string) ($data['email'] ?? ''));
$gender = ucfirst(strtolower(trim((string) ($data['gender'] ?? 'Male'))));
$age = intval($data['age'] ?? 0);
$package_name = trim((string) ($data['package_name'] ?? $data['package'] ?? ''));
$total_appointments = isset($data['total_appointments']) ? intval($data['total_appointments']) : null;
$status = ucfirst(strtolower(trim((string) ($data['status'] ?? ''))));

$update_fields = [];
$params = [];
$types = '';

if ($full_name !== '') { $update_fields[] = "full_name = ?"; $params[] = $full_name; $types .= 's'; }
if ($phone_number !== '') { $update_fields[] = "phone_number = ?"; $params[] = $phone_number; $types .= 's'; }
if ($email !== '') { $update_fields[] = "email = ?"; $params[] = $email; $types .= 's'; }
if ($gender !== '') { $update_fields[] = "gender = ?"; $params[] = $gender; $types .= 's'; }
if ($age > 0) { $update_fields[] = "age = ?"; $params[] = $age; $types .= 'i'; }
if ($package_name !== '') { $update_fields[] = "package_name = ?"; $params[] = $package_name; $types .= 's'; }
if ($total_appointments !== null) { $update_fields[] = "total_appointments = ?"; $params[] = $total_appointments; $types .= 'i'; }
if ($status !== '' && in_array($status, ['Ongoing', 'Completed', 'Active', 'Inactive'], true)) {
    $update_fields[] = "status = ?"; $params[] = $status; $types .= 's';
}

if (empty($update_fields)) {
    echo json_encode(['status' => '1', 'message' => 'No changes to update.']);
    exit;
}

// Fetch current details for audit logging
$existing_name = $full_name;
$existing_code = $patient_id;
$p_id_numeric = $id;

$chk_sql = $id > 0 ? "SELECT id, full_name, patient_id FROM patients WHERE id = ? LIMIT 1" : "SELECT id, full_name, patient_id FROM patients WHERE patient_id = ? LIMIT 1";
$chk_stmt = mysqli_prepare($connection1, $chk_sql);
if ($chk_stmt) {
    if ($id > 0) {
        mysqli_stmt_bind_param($chk_stmt, 'i', $id);
    } else {
        mysqli_stmt_bind_param($chk_stmt, 's', $patient_id);
    }
    mysqli_stmt_execute($chk_stmt);
    mysqli_stmt_bind_result($chk_stmt, $f_id, $f_name, $f_code);
    if (mysqli_stmt_fetch($chk_stmt)) {
        $p_id_numeric = (int)$f_id;
        if (empty($existing_name)) $existing_name = $f_name;
        if (empty($existing_code)) $existing_code = $f_code;
    }
    mysqli_stmt_close($chk_stmt);
}

$sql = "UPDATE patients SET " . implode(', ', $update_fields);
if ($id > 0) {
    $sql .= " WHERE id = ?";
    $params[] = $id;
    $types .= 'i';
} else {
    $sql .= " WHERE patient_id = ?";
    $params[] = $patient_id;
    $types .= 's';
}

$stmt = mysqli_prepare($connection1, $sql);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to prepare statement: ' . mysqli_error($connection1)]);
    exit;
}

mysqli_stmt_bind_param($stmt, $types, ...$params);

if (mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);

    // Audit log
    $display_name = $existing_name ?: ($existing_code ?: "Patient #{$p_id_numeric}");
    recordActivity(
        $connection1,
        'Patient',
        'patient.updated',
        "Updated patient {$display_name}",
        'Patient',
        $p_id_numeric,
        $display_name,
        array_filter([
            'patient_id' => $existing_code,
            'full_name' => $full_name ?: null,
            'phone_number' => $phone_number ?: null,
            'email' => $email ?: null,
            'package_name' => $package_name ?: null,
            'status' => $status ?: null
        ])
    );

    echo json_encode(['status' => '1', 'message' => 'Patient updated successfully.']);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to update patient.', 'error' => $err]);
}
?>