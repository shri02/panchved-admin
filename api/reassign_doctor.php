<?php
/**
 * Panchved Admin - Reassign Doctor to Appointment API
 * POST: /api/reassign_doctor.php
 *
 * Parameters:
 * - id (int) or appointment_id (string)
 * - doctor_name (string) or doctor_id (int)
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
$doctor_name = trim((string) ($data['doctor_name'] ?? $data['doctorName'] ?? $data['doctor'] ?? ''));
$doctor_id = intval($data['doctor_id'] ?? 0);

if ($id <= 0 && $appointment_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Appointment id or appointment_id is required.']);
    exit;
}

if ($doctor_name === '' && $doctor_id <= 0) {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'New doctor name or doctor_id is required.']);
    exit;
}

// If doctor_id is provided, lookup doctor name; or if doctor_name is provided, lookup doctor_id
if ($connection1) {
    if ($doctor_id > 0 && empty($doctor_name)) {
        $doc_res = mysqli_query($connection1, "SELECT full_name FROM doctors WHERE id = " . intval($doctor_id));
        if ($doc_res && $doc_row = mysqli_fetch_assoc($doc_res)) {
            $doctor_name = $doc_row['full_name'];
        }
    } else if (!empty($doctor_name) && $doctor_id <= 0) {
        $doc_stmt = mysqli_prepare($connection1, "SELECT id FROM doctors WHERE full_name = ? LIMIT 1");
        if ($doc_stmt) {
            mysqli_stmt_bind_param($doc_stmt, 's', $doctor_name);
            mysqli_stmt_execute($doc_stmt);
            $doc_res = mysqli_stmt_get_result($doc_stmt);
            if ($doc_res && $doc_row = mysqli_fetch_assoc($doc_res)) {
                $doctor_id = (int)$doc_row['id'];
            }
            mysqli_stmt_close($doc_stmt);
        }
    }
}

if ($doctor_name === '' && $doctor_id <= 0) {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Please provide a valid doctor to reassign.']);
    exit;
}

// Fetch current appointment info for audit logging
$app_code = $appointment_id;
$app_num_id = $id;
$prev_doctor = '';
$patient_name = '';

if ($connection1) {
    $chk_sql = $id > 0 ? "SELECT id, appointment_id, patient_name, doctor_name FROM appointments WHERE id = ? LIMIT 1" : "SELECT id, appointment_id, patient_name, doctor_name FROM appointments WHERE appointment_id = ? LIMIT 1";
    $chk_stmt = mysqli_prepare($connection1, $chk_sql);
    if ($chk_stmt) {
        if ($id > 0) {
            mysqli_stmt_bind_param($chk_stmt, 'i', $id);
        } else {
            mysqli_stmt_bind_param($chk_stmt, 's', $appointment_id);
        }
        mysqli_stmt_execute($chk_stmt);
        mysqli_stmt_bind_result($chk_stmt, $f_id, $f_code, $f_pname, $f_prev_doc);
        if (mysqli_stmt_fetch($chk_stmt)) {
            $app_num_id = (int)$f_id;
            if (empty($app_code)) $app_code = $f_code;
            $patient_name = (string)$f_pname;
            $prev_doctor = (string)$f_prev_doc;
        }
        mysqli_stmt_close($chk_stmt);
    }
}

$update_sql = "UPDATE appointments SET doctor_name = ?, doctor_id = ? WHERE " . ($id > 0 ? "id = ?" : "appointment_id = ?");
$stmt = mysqli_prepare($connection1, $update_sql);

if (!$stmt) {
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to prepare query: ' . mysqli_error($connection1)]);
    exit;
}

if ($id > 0) {
    mysqli_stmt_bind_param($stmt, 'sii', $doctor_name, $doctor_id, $id);
} else {
    mysqli_stmt_bind_param($stmt, 'sis', $doctor_name, $doctor_id, $appointment_id);
}

if (mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);

    // Audit log
    recordActivity(
        $connection1,
        'Consultation',
        'consultation.reassigned',
        "Reassigned consultation {$app_code} (Patient: {$patient_name}) from Dr. {$prev_doctor} to Dr. {$doctor_name}",
        'Consultation',
        $app_num_id,
        $app_code,
        [
            'appointment_id' => $app_code,
            'patient_name' => $patient_name,
            'previous_doctor' => $prev_doctor,
            'new_doctor' => $doctor_name,
            'doctor_id' => $doctor_id
        ]
    );

    echo json_encode([
        'status' => '1',
        'message' => 'Doctor reassigned successfully.',
        'data' => [
            'id' => $id,
            'appointment_id' => $app_code,
            'doctor_name' => $doctor_name,
            'doctor_id' => $doctor_id
        ]
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to reassign doctor.', 'error' => $err]);
}
?>