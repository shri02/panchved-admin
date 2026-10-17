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

// Fetch referred doctors if column exists
$referred_doctors = [];
$doc_col_check = mysqli_query($connection1, "SHOW COLUMNS FROM doctors LIKE 'referral_code'");
if ($doc_col_check && mysqli_num_rows($doc_col_check) > 0 && !empty($partner['referral_code'])) {
    $doc_stmt = mysqli_prepare($connection1, "
        SELECT id, doctorid, full_name, phone_number, email, expertise, area, status, created_at 
        FROM doctors 
        WHERE referral_code = ? 
        ORDER BY id DESC
    ");
    if ($doc_stmt) {
        mysqli_stmt_bind_param($doc_stmt, "s", $partner['referral_code']);
        mysqli_stmt_execute($doc_stmt);
        $doc_res = mysqli_stmt_get_result($doc_stmt);
        if ($doc_res) {
            while ($doc_row = mysqli_fetch_assoc($doc_res)) {
                $referred_doctors[] = $doc_row;
            }
        }
        mysqli_stmt_close($doc_stmt);
    }
}

$partner['referred_count'] = count($referred_doctors);
$partner['referred_doctors'] = $referred_doctors;

echo json_encode([
    'status' => '1',
    'message' => 'Partner retrieved successfully.',
    'data' => $partner
]);
?>
