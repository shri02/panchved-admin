<?php
/**
 * Panchved Admin - Delete Appointment API
 * POST/DELETE: /api/delete_appointment.php
 */

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/activity_logger.php';

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

$id = intval($_GET['id'] ?? $data['id'] ?? 0);
$appointment_id = trim((string) ($_GET['appointment_id'] ?? $data['appointment_id'] ?? ''));

if ($id <= 0 && $appointment_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Appointment id or appointment_id is required.']);
    exit;
}

$app_num_id = $id;
$app_code = $appointment_id;
$p_name = '';
$d_name = '';

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
        mysqli_stmt_bind_result($chk_stmt, $f_id, $f_code, $f_pname, $f_dname);
        if (mysqli_stmt_fetch($chk_stmt)) {
            $app_num_id = (int)$f_id;
            $app_code = (string)$f_code;
            $p_name = (string)$f_pname;
            $d_name = (string)$f_dname;
        }
        mysqli_stmt_close($chk_stmt);
    }

    if ($id > 0) {
        $stmt = mysqli_prepare($connection1, "DELETE FROM appointments WHERE id = ?");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 'i', $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
        }
    } else {
        $stmt = mysqli_prepare($connection1, "DELETE FROM appointments WHERE appointment_id = ?");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 's', $appointment_id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
        }
    }

    recordActivity(
        $connection1,
        'Consultation',
        'consultation.deleted',
        "Deleted consultation {$app_code} (Patient: {$p_name}, Doctor: {$d_name})",
        'Consultation',
        $app_num_id,
        $app_code,
        [
            'appointment_id' => $app_code,
            'patient_name' => $p_name,
            'doctor_name' => $d_name
        ]
    );
}

echo json_encode([
    'status' => '1',
    'message' => 'Appointment deleted successfully.'
]);
?>