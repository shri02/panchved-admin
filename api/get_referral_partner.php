<?php
/**
 * Panchved Admin - Get Single Referral Partner API
 * GET/POST: /api/get_referral_partner.php
 *
 * Parameters:
 * - id (int) or referral_code (string) or partner_id (string)
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
$referral_code = trim((string) ($_GET['referral_code'] ?? $body_data['referral_code'] ?? ''));
$partner_id = trim((string) ($_GET['partner_id'] ?? $body_data['partner_id'] ?? ''));

if ($id <= 0 && $referral_code === '' && $partner_id === '') {
    echo json_encode([
        'status' => '0',
        'message' => 'Partner ID, ID, or Referral Code is required.'
    ]);
    exit;
}

// Check table
$table_check = mysqli_query($connection1, "SHOW TABLES LIKE 'referral_partners'");
if (!$table_check || mysqli_num_rows($table_check) === 0) {
    echo json_encode([
        'status' => '0',
        'message' => 'Referral partners table does not exist.'
    ]);
    exit;
}

if ($id > 0) {
    $stmt = mysqli_prepare($connection1, "SELECT * FROM referral_partners WHERE id = ? LIMIT 1");
    mysqli_stmt_bind_param($stmt, "i", $id);
} elseif ($referral_code !== '') {
    $stmt = mysqli_prepare($connection1, "SELECT * FROM referral_partners WHERE referral_code = ? LIMIT 1");
    mysqli_stmt_bind_param($stmt, "s", $referral_code);
} else {
    $stmt = mysqli_prepare($connection1, "SELECT * FROM referral_partners WHERE partner_id = ? LIMIT 1");
    mysqli_stmt_bind_param($stmt, "s", $partner_id);
}

if (!$stmt) {
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to prepare query: ' . mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_execute($stmt);
$res = mysqli_stmt_get_result($stmt);
$partner = $res ? mysqli_fetch_assoc($res) : null;
mysqli_stmt_close($stmt);

if (!$partner) {
    echo json_encode([
        'status' => '0',
        'message' => 'Referral partner not found.'
    ]);
    exit;
}

$partner['id'] = intval($partner['id']);
if (empty($partner['partner_id'])) {
    $partner['partner_id'] = 'REF' . str_pad((string)$partner['id'], 4, '0', STR_PAD_LEFT);
}

// Fetch referred patients if column exists
$referred_patients = [];
$pat_col_check = mysqli_query($connection1, "SHOW COLUMNS FROM patients LIKE 'referral_code'");
if ($pat_col_check && mysqli_num_rows($pat_col_check) > 0 && !empty($partner['referral_code'])) {
    $pat_stmt = mysqli_prepare($connection1, "
        SELECT id, patient_id, full_name, phone_number, email, package_name, status, created_at 
        FROM patients 
        WHERE referral_code = ? 
        ORDER BY id DESC
    ");
    if ($pat_stmt) {
        mysqli_stmt_bind_param($pat_stmt, "s", $partner['referral_code']);
        mysqli_stmt_execute($pat_stmt);
        $pat_res = mysqli_stmt_get_result($pat_stmt);
        if ($pat_res) {
            while ($pat_row = mysqli_fetch_assoc($pat_res)) {
                $referred_patients[] = $pat_row;
            }
        }
        mysqli_stmt_close($pat_stmt);
    }
}

$partner['referred_count'] = count($referred_patients);
$partner['referred_patients'] = $referred_patients;

echo json_encode([
    'status' => '1',
    'message' => 'Partner retrieved successfully.',
    'data' => $partner
]);
?>
