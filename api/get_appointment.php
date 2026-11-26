<?php
/**
 * Panchved Admin - Get Single Appointment Details API
 * GET: /api/get_appointment.php?id=1 or ?appointment_id=ABC-001
 */

require_once __DIR__ . '/database.php';

$id = intval($_GET['id'] ?? 0);
$appointment_id = trim((string) ($_GET['appointment_id'] ?? ''));

if ($id <= 0 && $appointment_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Appointment id or appointment_id is required.']);
    exit;
}

$appointment = null;

if ($connection1) {
    if ($id > 0) {
        $stmt = mysqli_prepare($connection1, "SELECT * FROM appointments WHERE id = ? LIMIT 1");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 'i', $id);
            mysqli_stmt_execute($stmt);
            $res = mysqli_stmt_get_result($stmt);
            if ($res && $row = mysqli_fetch_assoc($res)) {
                $appointment = $row;
            }
            mysqli_stmt_close($stmt);
        }
    } else {
        $stmt = mysqli_prepare($connection1, "SELECT * FROM appointments WHERE appointment_id = ? LIMIT 1");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 's', $appointment_id);
            mysqli_stmt_execute($stmt);
            $res = mysqli_stmt_get_result($stmt);
            if ($res && $row = mysqli_fetch_assoc($res)) {
                $appointment = $row;
            }
            mysqli_stmt_close($stmt);
        }
    }
}

if (!$appointment) {
    http_response_code(404);
    echo json_encode(['status' => '0', 'message' => 'Appointment not found.']);
    exit;
}

if (!empty($appointment['appointment_date'])) {
    $appointment['formatted_date'] = date('j M Y', strtotime($appointment['appointment_date']));
}

echo json_encode([
    'status' => '1',
    'message' => 'Appointment details fetched successfully.',
    'data' => $appointment
]);
