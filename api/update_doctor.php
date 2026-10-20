<?php

/**
 * Panchved Admin - Update Doctor API
 * POST: /api/update_doctor.php
 */

require_once __DIR__ . '/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
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

if (empty($data)) {
    echo json_encode([
        'status' => '0',
        'message' => 'Request body is empty or invalid JSON.'
    ]);
    exit;
}

$id = intval($data['id'] ?? 0);
$doctorid = trim((string) ($data['doctorid'] ?? $data['doctorId'] ?? ''));

if ($id <= 0 && $doctorid !== '') {
    $find_stmt = mysqli_prepare($connection1, "SELECT id FROM doctors WHERE doctorid = ? LIMIT 1");
    if ($find_stmt) {
        mysqli_stmt_bind_param($find_stmt, "s", $doctorid);
        mysqli_stmt_execute($find_stmt);
        mysqli_stmt_bind_result($find_stmt, $found_id);
        if (mysqli_stmt_fetch($find_stmt)) {
            $id = intval($found_id);
        }
        mysqli_stmt_close($find_stmt);
    }
}

if ($id <= 0) {
    echo json_encode([
        'status' => '0',
        'message' => 'Valid doctor ID is required for update.'
    ]);
    exit;
}

// Fetch existing doctor
$exist_stmt = mysqli_prepare($connection1, "SELECT * FROM doctors WHERE id = ? LIMIT 1");
mysqli_stmt_bind_param($exist_stmt, "i", $id);
mysqli_stmt_execute($exist_stmt);
$exist_res = mysqli_stmt_get_result($exist_stmt);
$existing_doctor = $exist_res ? mysqli_fetch_assoc($exist_res) : null;
mysqli_stmt_close($exist_stmt);

if (!$existing_doctor) {
    echo json_encode([
        'status' => '0',
        'message' => 'Doctor record not found.'
    ]);
    exit;
}

/* =========================================
   PARSE INPUT VALUES
========================================= */

$full_name = trim((string) ($data['full_name'] ?? $data['fullName'] ?? $existing_doctor['full_name']));
$dob_input = trim((string) ($data['date_of_birth'] ?? $data['dob'] ?? $existing_doctor['date_of_birth']));
$phone_number = trim((string) ($data['phone_number'] ?? $data['phone'] ?? $existing_doctor['phone_number']));
$gender = trim((string) ($data['gender'] ?? $existing_doctor['gender']));
$email = trim((string) ($data['email'] ?? $existing_doctor['email']));
$years_of_experience = $data['years_of_experience'] ?? $data['yoe'] ?? $existing_doctor['years_of_experience'];
$expertise = trim((string) ($data['expertise'] ?? $existing_doctor['expertise']));
$area = trim((string) ($data['area'] ?? $existing_doctor['area']));
$registration_number = trim((string) ($data['registration_number'] ?? $data['registrationNumber'] ?? $data['regNumber'] ?? $existing_doctor['registration_number']));
$hpr_registration_number = trim((string) ($data['hpr_registration_number'] ?? $data['hprNumber'] ?? $data['hprRegNumber'] ?? $existing_doctor['hpr_registration_number']));
$about = isset($data['about']) ? trim((string)$data['about']) : (string)($existing_doctor['about'] ?? '');
$referral_code = !empty($existing_doctor['referral_code']) ? $existing_doctor['referral_code'] : strtoupper(trim((string) ($data['referral_code'] ?? $data['referralCode'] ?? '')));
$start_time_input = trim((string) ($data['start_time'] ?? $data['startTime'] ?? ($existing_doctor['start_time'] ?? '09:00:00')));
$end_time_input = trim((string) ($data['end_time'] ?? $data['endTime'] ?? ($existing_doctor['end_time'] ?? '17:00:00')));
$status = trim((string) ($data['status'] ?? $existing_doctor['status']));

// Format Start Time and End Time
$start_time = !empty($existing_doctor['start_time']) ? $existing_doctor['start_time'] : '09:00:00';
if ($start_time_input !== '') {
    $st_time = strtotime($start_time_input);
    if ($st_time !== false) {
        $start_time = date('H:i:s', $st_time);
    }
}

$end_time = !empty($existing_doctor['end_time']) ? $existing_doctor['end_time'] : '17:00:00';
if ($end_time_input !== '') {
    $et_time = strtotime($end_time_input);
    if ($et_time !== false) {
        $end_time = date('H:i:s', $et_time);
    }
}

// Auto-migration check: ensure start_time and end_time columns exist
if ($connection1) {
    $columns_res = @mysqli_query($connection1, "SHOW COLUMNS FROM doctors");
    $existing_columns = [];
    if ($columns_res) {
        while ($col = mysqli_fetch_assoc($columns_res)) {
            $existing_columns[] = strtolower($col['Field']);
        }
    }
    if (!empty($existing_columns)) {
        if (!in_array('start_time', $existing_columns)) {
            @mysqli_query($connection1, "ALTER TABLE doctors ADD COLUMN `start_time` TIME NULL DEFAULT '09:00:00' AFTER `hpr_registration_number`");
        }
        if (!in_array('end_time', $existing_columns)) {
            @mysqli_query($connection1, "ALTER TABLE doctors ADD COLUMN `end_time` TIME NULL DEFAULT '17:00:00' AFTER `start_time`");
        }
    }
}

/* =========================================
   VALIDATIONS
========================================= */

if ($full_name === '' || $phone_number === '' || $email === '' || $expertise === '' || $registration_number === '') {
    echo json_encode([
        'status' => '0',
        'message' => 'Required fields cannot be empty.'
    ]);
    exit;
}

$gender = ucfirst(strtolower($gender));
if (!in_array($gender, ['Male', 'Female', 'Other'], true)) {
    $gender = $existing_doctor['gender'];
}

$status = ucfirst(strtolower($status));
if (!in_array($status, ['Active', 'Inactive'], true)) {
    $status = $existing_doctor['status'];
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode([
        'status' => '0',
        'message' => 'Invalid email address.'
    ]);
    exit;
}

// Format Date of Birth
$formatted_dob = $existing_doctor['date_of_birth'];
$dcheck = DateTime::createFromFormat('Y-m-d', $dob_input);
if ($dcheck && $dcheck->format('Y-m-d') === $dob_input) {
    $formatted_dob = $dob_input;
} else {
    $dcheck2 = DateTime::createFromFormat('d/m/Y', $dob_input);
    if (!$dcheck2) {
        $dcheck2 = DateTime::createFromFormat('d-m-Y', $dob_input);
    }
    if ($dcheck2) {
        $formatted_dob = $dcheck2->format('Y-m-d');
    }
}

if ($formatted_dob) {
    $dob_dt = new DateTime($formatted_dob);
    $today_dt = new DateTime('today');
    if ($dob_dt >= $today_dt) {
        echo json_encode([
            'status' => '0',
            'message' => 'Date of birth must be a past date.'
        ]);
        exit;
    }
    $age_interval = $today_dt->diff($dob_dt);
    if ($age_interval->y < 18) {
        echo json_encode([
            'status' => '0',
            'message' => 'Doctor must be at least 18 years old.'
        ]);
        exit;
    }
}

$years_of_experience = max(0, intval($years_of_experience));

/* =========================================
   DUPLICATE CHECKS (Excluding Current Doctor)
========================================= */

// Check Email
$chk_email = mysqli_prepare($connection1, "SELECT id FROM doctors WHERE email = ? AND id != ? LIMIT 1");
if ($chk_email) {
    mysqli_stmt_bind_param($chk_email, "si", $email, $id);
    mysqli_stmt_execute($chk_email);
    mysqli_stmt_store_result($chk_email);
    if (mysqli_stmt_num_rows($chk_email) > 0) {
        mysqli_stmt_close($chk_email);
        echo json_encode([
            'status' => '0',
            'message' => 'Another doctor with this email already exists.'
        ]);
        exit;
    }
    mysqli_stmt_close($chk_email);
}

// Check Phone
$chk_phone = mysqli_prepare($connection1, "SELECT id FROM doctors WHERE phone_number = ? AND id != ? LIMIT 1");
if ($chk_phone) {
    mysqli_stmt_bind_param($chk_phone, "si", $phone_number, $id);
    mysqli_stmt_execute($chk_phone);
    mysqli_stmt_store_result($chk_phone);
    if (mysqli_stmt_num_rows($chk_phone) > 0) {
        mysqli_stmt_close($chk_phone);
        echo json_encode([
            'status' => '0',
            'message' => 'Another doctor with this phone number already exists.'
        ]);
        exit;
    }
    mysqli_stmt_close($chk_phone);
}

// Check Registration
$chk_reg = mysqli_prepare($connection1, "SELECT id FROM doctors WHERE registration_number = ? AND id != ? LIMIT 1");
if ($chk_reg) {
    mysqli_stmt_bind_param($chk_reg, "si", $registration_number, $id);
    mysqli_stmt_execute($chk_reg);
    mysqli_stmt_store_result($chk_reg);
    if (mysqli_stmt_num_rows($chk_reg) > 0) {
        mysqli_stmt_close($chk_reg);
        echo json_encode([
            'status' => '0',
            'message' => 'Another doctor with this registration number already exists.'
        ]);
        exit;
    }
    mysqli_stmt_close($chk_reg);
}

if ($hpr_registration_number === '') {
    $hpr_registration_number = null;
}

/* =========================================
   EXECUTE UPDATE
========================================= */

// Check if referral_code and about columns exist
$has_ref_col = false;
$ref_col_res = @mysqli_query($connection1, "SHOW COLUMNS FROM doctors LIKE 'referral_code'");
if ($ref_col_res && mysqli_num_rows($ref_col_res) > 0) {
    $has_ref_col = true;
}

$has_about_col = false;
$about_col_res = @mysqli_query($connection1, "SHOW COLUMNS FROM doctors LIKE 'about'");
if ($about_col_res && mysqli_num_rows($about_col_res) > 0) {
    $has_about_col = true;
}

$set_clauses = [
    'full_name = ?',
    'date_of_birth = ?',
    'phone_number = ?',
    'gender = ?',
    'email = ?',
    'years_of_experience = ?',
    'expertise = ?',
    'area = ?',
    'registration_number = ?',
    'hpr_registration_number = ?'
];
$types = "sssssissss";
$bind_values = [$full_name, $formatted_dob, $phone_number, $gender, $email, $years_of_experience, $expertise, $area, $registration_number, $hpr_registration_number];

if ($has_about_col) {
    $set_clauses[] = 'about = ?';
    $types .= 's';
    $bind_values[] = ($about !== '') ? $about : null;
}

if ($has_ref_col) {
    $set_clauses[] = 'referral_code = ?';
    $types .= 's';
    $ref_val = ($referral_code !== '') ? $referral_code : null;
    $bind_values[] = $ref_val;
}

$set_clauses[] = 'start_time = ?';
$types .= 's';
$bind_values[] = $start_time;

$set_clauses[] = 'end_time = ?';
$types .= 's';
$bind_values[] = $end_time;

$set_clauses[] = 'status = ?';
$types .= 's';
$bind_values[] = $status;

$types .= 'i';
$bind_values[] = $id;

$update_sql = "UPDATE doctors SET " . implode(', ', $set_clauses) . " WHERE id = ?";

$up_stmt = mysqli_prepare($connection1, $update_sql);
if (!$up_stmt) {
    echo json_encode([
        'status' => '0',
        'message' => 'SQL prepare failed.',
        'error' => mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_bind_param($up_stmt, $types, ...$bind_values);

if (mysqli_stmt_execute($up_stmt)) {
    mysqli_stmt_close($up_stmt);

    echo json_encode([
        'status' => '1',
        'message' => 'Doctor Updated Successfully.',
        'id' => $id,
        'data' => [
            'id' => $id,
            'doctorid' => $existing_doctor['doctorid'] ?: ('DOC' . str_pad((string)$id, 6, '0', STR_PAD_LEFT)),
            'full_name' => $full_name,
            'date_of_birth' => $formatted_dob,
            'phone_number' => $phone_number,
            'gender' => $gender,
            'email' => $email,
            'years_of_experience' => $years_of_experience,
            'expertise' => $expertise,
            'area' => $area,
            'registration_number' => $registration_number,
            'hpr_registration_number' => $hpr_registration_number,
            'about' => $about,
            'referral_code' => $referral_code,
            'start_time' => $start_time,
            'end_time' => $end_time,
            'status' => $status
        ]
    ]);
} else {
    echo json_encode([
        'status' => '0',
        'message' => 'Doctor update failed.',
        'error' => mysqli_stmt_error($up_stmt)
    ]);
    mysqli_stmt_close($up_stmt);
}
?>
