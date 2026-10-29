<?php
/**
 * Panchved Admin - Add / Book Appointment API
 * POST: /api/add_appointment.php
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

$patient_name = trim((string) ($data['patient_name'] ?? $data['patientName'] ?? ''));
$doctor_name = trim((string) ($data['doctor_name'] ?? $data['doctorName'] ?? ''));
$package_name = trim((string) ($data['package_name'] ?? $data['package'] ?? 'Stress Management'));
$appointment_date = trim((string) ($data['appointment_date'] ?? $data['date'] ?? date('Y-m-d')));
$appointment_time = trim((string) ($data['appointment_time'] ?? $data['time'] ?? '8:00 AM'));
$duration = trim((string) ($data['duration'] ?? '45 min'));
$agenda = trim((string) ($data['agenda'] ?? ''));
$prescription = trim((string) ($data['prescription'] ?? ''));
$status = ucfirst(strtolower(trim((string) ($data['status'] ?? 'Scheduled'))));
$patient_id = intval($data['patient_id'] ?? 0);
$doctor_id = intval($data['doctor_id'] ?? 0);

if ($patient_name === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Patient name is required.']);
    exit;
}

// Generate Appointment Code (e.g. ABC-001)
$new_code = 'ABC-001';
if ($connection1) {
    $max_res = mysqli_query($connection1, "SELECT MAX(id) as max_id FROM appointments");
    if ($max_res && $max_row = mysqli_fetch_assoc($max_res)) {
        $next_id = intval($max_row['max_id']) + 1;
        $new_code = 'ABC-' . str_pad((string) $next_id, 3, '0', STR_PAD_LEFT);
    }
}

$sql = "
    INSERT INTO appointments 
    (appointment_id, patient_id, patient_name, doctor_id, doctor_name, package_name, appointment_date, appointment_time, duration, agenda, prescription, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
";

$stmt = mysqli_prepare($connection1, $sql);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to prepare query: ' . mysqli_error($connection1)]);
    exit;
}

mysqli_stmt_bind_param(
    $stmt,
    'sisissssssss',
    $new_code,
    $patient_id,
    $patient_name,
    $doctor_id,
    $doctor_name,
    $package_name,
    $appointment_date,
    $appointment_time,
    $duration,
    $agenda,
    $prescription,
    $status
);

if (mysqli_stmt_execute($stmt)) {
    $insert_id = mysqli_insert_id($connection1);
    mysqli_stmt_close($stmt);

    // Audit log
    recordActivity(
        $connection1,
        'Consultation',
        'consultation.booked',
        "Scheduled appointment {$new_code} for {$patient_name} with Dr. {$doctor_name} on {$appointment_date} at {$appointment_time}",
        'Consultation',
        $insert_id,
        $new_code,
        [
            'appointment_id' => $new_code,
            'patient_id' => $patient_id,
            'patient_name' => $patient_name,
            'doctor_id' => $doctor_id,
            'doctor_name' => $doctor_name,
            'package_name' => $package_name,
            'appointment_date' => $appointment_date,
            'appointment_time' => $appointment_time,
            'status' => $status
        ]
    );

    echo json_encode([
        'status' => '1',
        'message' => 'Appointment scheduled successfully.',
        'data' => [
            'id' => $insert_id,
            'appointment_id' => $new_code,
            'patient_name' => $patient_name,
            'doctor_name' => $doctor_name,
            'package_name' => $package_name,
            'appointment_date' => $appointment_date,
            'appointment_time' => $appointment_time,
            'status' => $status
        ]
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to schedule appointment.', 'error' => $err]);
}
?>