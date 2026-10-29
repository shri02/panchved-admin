<?php
/**
 * Panchved Admin - Add Patient API
 * POST: /api/add_patient.php
 */

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/activity_logger.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode([
        'status' => '0',
        'message' => 'Only POST method is allowed.'
    ]);
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

$full_name = trim((string) ($data['full_name'] ?? $data['name'] ?? ''));
$phone_number = trim((string) ($data['phone_number'] ?? $data['phone'] ?? ''));
$email = trim((string) ($data['email'] ?? ''));
$gender = ucfirst(strtolower(trim((string) ($data['gender'] ?? 'Male'))));
$age = intval($data['age'] ?? 0);
$dob = trim((string) ($data['dob'] ?? ''));
$package_name = trim((string) ($data['package_name'] ?? $data['package'] ?? 'Stress Management'));
$total_appointments = intval($data['total_appointments'] ?? 0);
$status = ucfirst(strtolower(trim((string) ($data['status'] ?? 'Ongoing'))));
$blood_group = trim((string) ($data['blood_group'] ?? ''));
$emergency_contact = trim((string) ($data['emergency_contact'] ?? ''));
$address = trim((string) ($data['address'] ?? ''));

if ($full_name === '' || $phone_number === '') {
    http_response_code(400);
    echo json_encode([
        'status' => '0',
        'message' => 'Patient full name and phone number are required.'
    ]);
    exit;
}

if (!in_array($status, ['Ongoing', 'Completed', 'Active', 'Inactive'], true)) {
    $status = 'Ongoing';
}

if (!in_array($gender, ['Male', 'Female', 'Other'], true)) {
    $gender = 'Male';
}

// Generate new Patient ID (e.g. E001 or PAT000001)
$new_patient_code = 'E001';
if ($connection1) {
    $max_res = mysqli_query($connection1, "SELECT MAX(id) as max_id FROM patients");
    if ($max_res && $max_row = mysqli_fetch_assoc($max_res)) {
        $next_id = intval($max_row['max_id']) + 1;
        $new_patient_code = 'E' . str_pad((string) $next_id, 3, '0', STR_PAD_LEFT);
    }
}

$insert_sql = "
    INSERT INTO patients 
    (patient_id, full_name, dob, age, phone_number, gender, email, blood_group, emergency_contact, address, package_name, total_appointments, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
";

$stmt = mysqli_prepare($connection1, $insert_sql);
if (!$stmt) {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to prepare query: ' . mysqli_error($connection1)
    ]);
    exit;
}

$dob_val = !empty($dob) ? $dob : null;
mysqli_stmt_bind_param(
    $stmt,
    'sssisssssssis',
    $new_patient_code,
    $full_name,
    $dob_val,
    $age,
    $phone_number,
    $gender,
    $email,
    $blood_group,
    $emergency_contact,
    $address,
    $package_name,
    $total_appointments,
    $status
);

if (mysqli_stmt_execute($stmt)) {
    $insert_id = mysqli_insert_id($connection1);
    mysqli_stmt_close($stmt);

    // Audit log
    recordActivity(
        $connection1,
        'Patient',
        'patient.created',
        "Registered new patient {$full_name} ({$new_patient_code})",
        'Patient',
        $insert_id,
        $full_name,
        [
            'patient_id' => $new_patient_code,
            'phone_number' => $phone_number,
            'email' => $email,
            'gender' => $gender,
            'age' => $age,
            'package_name' => $package_name,
            'status' => $status
        ]
    );

    echo json_encode([
        'status' => '1',
        'message' => 'Patient registered successfully.',
        'data' => [
            'id' => $insert_id,
            'patient_id' => $new_patient_code,
            'full_name' => $full_name,
            'phone_number' => $phone_number,
            'email' => $email,
            'age' => $age,
            'gender' => $gender,
            'package_name' => $package_name,
            'total_appointments' => $total_appointments,
            'status' => $status
        ]
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to add patient.',
        'error' => $err
    ]);
}
?>