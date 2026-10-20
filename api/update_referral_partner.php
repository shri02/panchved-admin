<?php
/**
 * Panchved Admin - Update Referral Partner API
 * POST: /api/update_referral_partner.php
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
if ($id <= 0) {
    echo json_encode([
        'status' => '0',
        'message' => 'Valid partner ID is required.'
    ]);
    exit;
}

// Check existing partner
$exist_stmt = mysqli_prepare($connection1, "SELECT * FROM referral_partners WHERE id = ? LIMIT 1");
mysqli_stmt_bind_param($exist_stmt, "i", $id);
mysqli_stmt_execute($exist_stmt);
$exist_res = mysqli_stmt_get_result($exist_stmt);
$existing_partner = $exist_res ? mysqli_fetch_assoc($exist_res) : null;
mysqli_stmt_close($exist_stmt);

if (!$existing_partner) {
    echo json_encode([
        'status' => '0',
        'message' => 'Referral partner not found.'
    ]);
    exit;
}

$name = trim((string) ($data['name'] ?? $existing_partner['name']));
$phone_number = trim((string) ($data['phone_number'] ?? $data['phone'] ?? $existing_partner['phone_number']));
$email = strtolower(trim((string) ($data['email'] ?? $existing_partner['email'])));
$referral_code = strtoupper(trim((string) ($data['referral_code'] ?? $data['referralCode'] ?? $existing_partner['referral_code'])));
$status = trim((string) ($data['status'] ?? $existing_partner['status']));

if ($name === '' || $phone_number === '' || $email === '' || $referral_code === '') {
    echo json_encode([
        'status' => '0',
        'message' => 'Name, phone number, email, and referral code cannot be empty.'
    ]);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode([
        'status' => '0',
        'message' => 'Please enter a valid email address.'
    ]);
    exit;
}

$phone_clean = preg_replace('/[^0-9]/', '', $phone_number);
if (strlen($phone_clean) < 10) {
    echo json_encode([
        'status' => '0',
        'message' => 'Phone number must be at least 10 digits.'
    ]);
    exit;
}
$phone_number = $phone_clean;

$status = ucfirst(strtolower($status));
if ($status !== 'Active' && $status !== 'Inactive') {
    $status = 'Active';
}

// Check duplicate email for another partner
$chk_email_stmt = mysqli_prepare($connection1, "SELECT id FROM referral_partners WHERE email = ? AND id != ? LIMIT 1");
if ($chk_email_stmt) {
    mysqli_stmt_bind_param($chk_email_stmt, "si", $email, $id);
    mysqli_stmt_execute($chk_email_stmt);
    mysqli_stmt_store_result($chk_email_stmt);
    if (mysqli_stmt_num_rows($chk_email_stmt) > 0) {
        mysqli_stmt_close($chk_email_stmt);
        echo json_encode([
            'status' => '0',
            'message' => 'Another referral partner already has this email address.'
        ]);
        exit;
    }
    mysqli_stmt_close($chk_email_stmt);
}

// Check duplicate phone for another partner
$chk_phone_stmt = mysqli_prepare($connection1, "SELECT id FROM referral_partners WHERE phone_number = ? AND id != ? LIMIT 1");
if ($chk_phone_stmt) {
    mysqli_stmt_bind_param($chk_phone_stmt, "si", $phone_number, $id);
    mysqli_stmt_execute($chk_phone_stmt);
    mysqli_stmt_store_result($chk_phone_stmt);
    if (mysqli_stmt_num_rows($chk_phone_stmt) > 0) {
        mysqli_stmt_close($chk_phone_stmt);
        echo json_encode([
            'status' => '0',
            'message' => 'Another referral partner already has this phone number.'
        ]);
        exit;
    }
    mysqli_stmt_close($chk_phone_stmt);
}

// Referral code is permanent and immutable once created
$referral_code = $existing_partner['referral_code'];

$update_sql = "
    UPDATE referral_partners SET
        name = ?,
        phone_number = ?,
        email = ?,
        status = ?
    WHERE id = ?
";

$up_stmt = mysqli_prepare($connection1, $update_sql);
if (!$up_stmt) {
    echo json_encode([
        'status' => '0',
        'message' => 'Database error: ' . mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_bind_param($up_stmt, "ssssi", $name, $phone_number, $email, $status, $id);

if (mysqli_stmt_execute($up_stmt)) {
    mysqli_stmt_close($up_stmt);
    echo json_encode([
        'status' => '1',
        'message' => 'Referral Partner Updated Successfully.',
        'data' => [
            'id' => $id,
            'partner_id' => $existing_partner['partner_id'] ?: ('REF' . str_pad((string)$id, 4, '0', STR_PAD_LEFT)),
            'name' => $name,
            'phone_number' => $phone_number,
            'email' => $email,
            'referral_code' => $referral_code,
            'status' => $status
        ]
    ]);
} else {
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to update referral partner: ' . mysqli_stmt_error($up_stmt)
    ]);
    mysqli_stmt_close($up_stmt);
}

mysqli_close($connection1);
?>
