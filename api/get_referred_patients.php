<?php
/**
 * Panchved Admin - Get Patients Referred by Code API
 * GET/POST: /api/get_referred_patients.php
 *
 * Parameters:
 * - referral_code (string, required)
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

$referral_code = trim((string) ($_GET['referral_code'] ?? $body_data['referral_code'] ?? ''));

if ($referral_code === '') {
    echo json_encode([
        'status' => '0',
        'message' => 'referral_code is required.',
        'data' => []
    ]);
    exit;
}

// Check if patients table has referral_code column
$pat_col_check = mysqli_query($connection1, "SHOW COLUMNS FROM patients LIKE 'referral_code'");
if (!$pat_col_check || mysqli_num_rows($pat_col_check) === 0) {
    echo json_encode([
        'status' => '1',
        'message' => 'No patients referred yet.',
        'referral_code' => $referral_code,
        'data' => [],
        'total' => 0
    ]);
    exit;
}

$stmt = mysqli_prepare($connection1, "
    SELECT id, patient_id, full_name, phone_number, email, gender, age, package_name, status, created_at
    FROM patients
    WHERE referral_code = ?
    ORDER BY id DESC
");

$patients = [];
if ($stmt) {
    mysqli_stmt_bind_param($stmt, "s", $referral_code);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);
    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $row['id'] = intval($row['id']);
            if (empty($row['patient_id'])) {
                $row['patient_id'] = 'PAT' . str_pad((string)$row['id'], 4, '0', STR_PAD_LEFT);
            }
            $patients[] = $row;
        }
    }
    mysqli_stmt_close($stmt);
}

echo json_encode([
    'status' => '1',
    'message' => 'Referred patients retrieved successfully.',
    'referral_code' => $referral_code,
    'total' => count($patients),
    'data' => $patients
]);

mysqli_close($connection1);
?>
