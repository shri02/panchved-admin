<?php
/**
 * Panchved Admin - Update Appointment API
 * POST: /api/update_appointment.php
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
$appointment_id = trim((string) ($data['appointment_id'] ?? ''));

if ($id <= 0 && $appointment_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Appointment id or appointment_id is required.']);
    exit;
}

$patient_name = trim((string) ($data['patient_name'] ?? ''));
$doctor_name = trim((string) ($data['doctor_name'] ?? ''));
$package_name = trim((string) ($data['package_name'] ?? ''));
$appointment_date = trim((string) ($data['appointment_date'] ?? ''));
$appointment_time = trim((string) ($data['appointment_time'] ?? ''));
$duration = trim((string) ($data['duration'] ?? ''));
$agenda = trim((string) ($data['agenda'] ?? ''));
$prescription = trim((string) ($data['prescription'] ?? ''));
$status = trim((string) ($data['status'] ?? ''));

$update_fields = [];
$params = [];
$types = '';

if ($patient_name !== '') { $update_fields[] = "patient_name = ?"; $params[] = $patient_name; $types .= 's'; }
if ($doctor_name !== '') { $update_fields[] = "doctor_name = ?"; $params[] = $doctor_name; $types .= 's'; }
if ($package_name !== '') { $update_fields[] = "package_name = ?"; $params[] = $package_name; $types .= 's'; }
if ($appointment_date !== '') { $update_fields[] = "appointment_date = ?"; $params[] = $appointment_date; $types .= 's'; }
if ($appointment_time !== '') { $update_fields[] = "appointment_time = ?"; $params[] = $appointment_time; $types .= 's'; }
if ($duration !== '') { $update_fields[] = "duration = ?"; $params[] = $duration; $types .= 's'; }
if ($agenda !== '') { $update_fields[] = "agenda = ?"; $params[] = $agenda; $types .= 's'; }
if ($prescription !== '') { $update_fields[] = "prescription = ?"; $params[] = $prescription; $types .= 's'; }
if ($status !== '') { $update_fields[] = "status = ?"; $params[] = $status; $types .= 's'; }

if (empty($update_fields)) {
    echo json_encode(['status' => '1', 'message' => 'No fields to update.']);
    exit;
}

// Fetch appointment info for audit logging
$app_code = $appointment_id;
$app_num_id = $id;
$p_name = $patient_name;
$d_name = $doctor_name;

$chk_sql = $id > 0 ? "SELECT id, appointment_id, patient_name, doctor_name, appointment_date, appointment_time, status FROM appointments WHERE id = ? LIMIT 1" : "SELECT id, appointment_id, patient_name, doctor_name, appointment_date, appointment_time, status FROM appointments WHERE appointment_id = ? LIMIT 1";
$chk_stmt = mysqli_prepare($connection1, $chk_sql);
if ($chk_stmt) {
    if ($id > 0) {
        mysqli_stmt_bind_param($chk_stmt, 'i', $id);
    } else {
        mysqli_stmt_bind_param($chk_stmt, 's', $appointment_id);
    }
    mysqli_stmt_execute($chk_stmt);
    mysqli_stmt_bind_result($chk_stmt, $f_id, $f_code, $f_pname, $f_dname, $f_date, $f_time, $f_status);
    if (mysqli_stmt_fetch($chk_stmt)) {
        $app_num_id = (int)$f_id;
        if (empty($app_code)) $app_code = $f_code;
        if (empty($p_name)) $p_name = $f_pname;
        if (empty($d_name)) $d_name = $f_dname;
    }
    mysqli_stmt_close($chk_stmt);
}

$sql = "UPDATE appointments SET " . implode(', ', $update_fields);
if ($id > 0) {
    $sql .= " WHERE id = ?";
    $params[] = $id;
    $types .= 'i';
} else {
    $sql .= " WHERE appointment_id = ?";
    $params[] = $appointment_id;
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

    $action_name = ($appointment_date !== '' || $appointment_time !== '') ? 'consultation.rescheduled' : ($status !== '' ? 'consultation.status_changed' : 'consultation.updated');
    $desc = "Updated consultation {$app_code} (Patient: {$p_name}, Doctor: {$d_name})";
    if ($appointment_date !== '' || $appointment_time !== '') {
        $desc = "Rescheduled consultation {$app_code} to {$appointment_date} {$appointment_time}";
    } elseif ($status !== '') {
        $desc = "Updated consultation {$app_code} status to {$status}";
    }

    recordActivity(
        $connection1,
        'Consultation',
        $action_name,
        $desc,
        'Consultation',
        $app_num_id,
        $app_code,
        array_filter([
            'appointment_id' => $app_code,
            'patient_name' => $patient_name ?: null,
            'doctor_name' => $doctor_name ?: null,
            'appointment_date' => $appointment_date ?: null,
            'appointment_time' => $appointment_time ?: null,
            'status' => $status ?: null
        ])
    );

    echo json_encode(['status' => '1', 'message' => 'Appointment updated successfully.']);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to update appointment.', 'error' => $err]);
}
?>