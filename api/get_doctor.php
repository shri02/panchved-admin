<?php

/**
 * Panchved Admin - Get Single Doctor API
 * GET/POST: /api/get_doctor.php
 *
 * Parameters:
 * - id (int) or doctorid (string)
 */

require_once __DIR__ . '/db_connect.php';

$raw_input = file_get_contents('php://input');
$body_data = [];
if ($raw_input !== false && trim($raw_input) !== '') {
    $decoded = json_decode($raw_input, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $body_data = $decoded;
    }
}

$id = intval($_GET['id'] ?? $body_data['id'] ?? 0);
$doctorid = trim((string) ($_GET['doctorid'] ?? $body_data['doctorid'] ?? ''));

if ($id <= 0 && $doctorid === '') {
    http_response_code(400);
    echo json_encode([
        'status' => '0',
        'message' => 'Doctor ID or Doctor Code is required.'
    ]);
    exit;
}

if ($id > 0) {
    $stmt = mysqli_prepare($connection1, "SELECT * FROM doctors WHERE id = ? LIMIT 1");
    mysqli_stmt_bind_param($stmt, "i", $id);
} else {
    $stmt = mysqli_prepare($connection1, "SELECT * FROM doctors WHERE doctorid = ? LIMIT 1");
    mysqli_stmt_bind_param($stmt, "s", $doctorid);
}

if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'SQL prepare failed.',
        'error' => mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_execute($stmt);
$result = mysqli_stmt_get_result($stmt);
$doctor = null;

if ($result && $row = mysqli_fetch_assoc($result)) {
    $doctor = $row;
    if (empty($doctor['start_time'])) {
        $doctor['start_time'] = '09:00:00';
    }
    if (empty($doctor['end_time'])) {
        $doctor['end_time'] = '17:00:00';
    }
} else {
    mysqli_stmt_store_result($stmt);
    if (mysqli_stmt_num_rows($stmt) > 0) {
        $meta = mysqli_stmt_result_metadata($stmt);
        $fields = [];
        $row_data = [];
        if ($meta) {
            while ($field = mysqli_fetch_field($meta)) {
                $fields[] = $field->name;
                $row_data[$field->name] = null;
            }
            $params = [];
            foreach ($fields as $fieldName) {
                $params[] = &$row_data[$fieldName];
            }
            call_user_func_array('mysqli_stmt_bind_result', array_merge([$stmt], $params));
            if (mysqli_stmt_fetch($stmt)) {
                $doctor = [];
                foreach ($row_data as $k => $v) {
                    $doctor[$k] = $v;
                }
            }
        }
        if (!$doctor) {
            mysqli_stmt_bind_result(
                $stmt,
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
                $d_created_at,
                $d_updated_at
            );
            if (mysqli_stmt_fetch($stmt)) {
                $doctor = [
                    'id' => (int) $d_id,
                    'doctorid' => $d_doctorid ?: ('DOC' . str_pad((string)$d_id, 6, '0', STR_PAD_LEFT)),
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
                    'created_at' => $d_created_at,
                    'updated_at' => $d_updated_at
                ];
            }
        }
    }
}
mysqli_stmt_close($stmt);

if (!$doctor) {
    http_response_code(404);
    echo json_encode([
        'status' => '0',
        'message' => 'Doctor not found.'
    ]);
    exit;
}

if (empty($doctor['doctorid'])) {
    $doctor['doctorid'] = 'DOC' . str_pad((string)$doctor['id'], 6, '0', STR_PAD_LEFT);
}

// Fetch appointment count if table exists
$doctor_id_val = (int)$doctor['id'];
$total_appointments = 0;
$apt_check = @mysqli_query($connection1, "SELECT COUNT(*) as count FROM appointments WHERE doctor_id = $doctor_id_val");
if ($apt_check && $apt_row = mysqli_fetch_assoc($apt_check)) {
    $total_appointments = (int) $apt_row['count'];
}
$doctor['total_appointments'] = $total_appointments;
$doctor['referral_code'] = $doctor['referral_code'] ?? '';

http_response_code(200);
echo json_encode([
    'status' => '1',
    'message' => 'Doctor retrieved successfully.',
    'data' => $doctor
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
?>
