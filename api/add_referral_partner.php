<?php
/**
 * Panchved Admin - Add Referral Partner API
 * POST: /api/add_referral_partner.php
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

// Table check
$table_check = mysqli_query($connection1, "SHOW TABLES LIKE 'referral_partners'");
if (!$table_check || mysqli_num_rows($table_check) === 0) {
    echo json_encode([
        'status' => '0',
        'message' => 'Table referral_partners does not exist. Please run the database setup script first.'
    ]);
    exit;
}

$name = trim((string) ($data['name'] ?? $data['fullName'] ?? ''));
$phone_number = trim((string) ($data['phone_number'] ?? $data['phone'] ?? ''));
$email = strtolower(trim((string) ($data['email'] ?? '')));
$referral_code = strtoupper(trim((string) ($data['referral_code'] ?? $data['referralCode'] ?? '')));
$status = trim((string) ($data['status'] ?? 'Active'));

// Validation
if ($name === '' || $phone_number === '' || $email === '') {
    echo json_encode([
        'status' => '0',
        'message' => 'Name, phone number, and email are required.'
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

// Sanitize phone (numbers only)
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

// Check duplicate email
$chk_email_stmt = mysqli_prepare($connection1, "SELECT id FROM referral_partners WHERE email = ? LIMIT 1");
if ($chk_email_stmt) {
    mysqli_stmt_bind_param($chk_email_stmt, "s", $email);
    mysqli_stmt_execute($chk_email_stmt);
    mysqli_stmt_store_result($chk_email_stmt);
    if (mysqli_stmt_num_rows($chk_email_stmt) > 0) {
        mysqli_stmt_close($chk_email_stmt);
        echo json_encode([
            'status' => '0',
            'message' => 'A referral partner with this email already exists.'
        ]);
        exit;
    }
    mysqli_stmt_close($chk_email_stmt);
}

// Check duplicate phone
$chk_phone_stmt = mysqli_prepare($connection1, "SELECT id FROM referral_partners WHERE phone_number = ? LIMIT 1");
if ($chk_phone_stmt) {
    mysqli_stmt_bind_param($chk_phone_stmt, "s", $phone_number);
    mysqli_stmt_execute($chk_phone_stmt);
    mysqli_stmt_store_result($chk_phone_stmt);
    if (mysqli_stmt_num_rows($chk_phone_stmt) > 0) {
        mysqli_stmt_close($chk_phone_stmt);
        echo json_encode([
            'status' => '0',
            'message' => 'A referral partner with this phone number already exists.'
        ]);
        exit;
    }
    mysqli_stmt_close($chk_phone_stmt);
}

// Auto-generate unique referral code if empty or check uniqueness if specified
function generateReferralCode($name, $conn) {
    $namePrefix = strtoupper(preg_replace('/[^A-Za-z]/', '', $name));
    if (strlen($namePrefix) < 3) {
        $prefix = 'REF';
    } else {
        $prefix = substr($namePrefix, 0, 3);
    }
    
    for ($attempt = 0; $attempt < 10; $attempt++) {
        $random = strtoupper(substr(bin2hex(random_bytes(3)), 0, 4));
        $code = $prefix . '-' . $random;

        $check_stmt = mysqli_prepare($conn, "SELECT id FROM referral_partners WHERE referral_code = ? LIMIT 1");
        if ($check_stmt) {
            mysqli_stmt_bind_param($check_stmt, "s", $code);
            mysqli_stmt_execute($check_stmt);
            mysqli_stmt_store_result($check_stmt);
            $exists = mysqli_stmt_num_rows($check_stmt) > 0;
            mysqli_stmt_close($check_stmt);
            if (!$exists) {
                return $code;
            }
        }
    }
    // Fallback timestamp code
    return 'REF-' . strtoupper(substr(uniqid(), -6));
}

if ($referral_code === '') {
    $referral_code = generateReferralCode($name, $connection1);
} else {
    // Check if provided code already exists
    $chk_code_stmt = mysqli_prepare($connection1, "SELECT id FROM referral_partners WHERE referral_code = ? LIMIT 1");
    if ($chk_code_stmt) {
        mysqli_stmt_bind_param($chk_code_stmt, "s", $referral_code);
        mysqli_stmt_execute($chk_code_stmt);
        mysqli_stmt_store_result($chk_code_stmt);
        if (mysqli_stmt_num_rows($chk_code_stmt) > 0) {
            mysqli_stmt_close($chk_code_stmt);
            echo json_encode([
                'status' => '0',
                'message' => 'This referral code already exists. Please choose a different code or leave blank to auto-generate.'
            ]);
            exit;
        }
        mysqli_stmt_close($chk_code_stmt);
    }
}

// Insert referral partner
$insert_query = "
    INSERT INTO referral_partners (
        name,
        phone_number,
        email,
        referral_code,
        status
    ) VALUES (?, ?, ?, ?, ?)
";

$stmt = mysqli_prepare($connection1, $insert_query);
if (!$stmt) {
    echo json_encode([
        'status' => '0',
        'message' => 'Database error: ' . mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_bind_param($stmt, "sssss", $name, $phone_number, $email, $referral_code, $status);

if (mysqli_stmt_execute($stmt)) {
    $partner_id_num = mysqli_insert_id($connection1);
    $partner_id = 'REF' . str_pad((string)$partner_id_num, 4, '0', STR_PAD_LEFT);

    // Update partner_id
    $up_pid = mysqli_prepare($connection1, "UPDATE referral_partners SET partner_id = ? WHERE id = ?");
    if ($up_pid) {
        mysqli_stmt_bind_param($up_pid, "si", $partner_id, $partner_id_num);
        mysqli_stmt_execute($up_pid);
        mysqli_stmt_close($up_pid);
    }

    mysqli_stmt_close($stmt);

    echo json_encode([
        'status' => '1',
        'message' => 'Referral Partner Added Successfully.',
        'data' => [
            'id' => $partner_id_num,
            'partner_id' => $partner_id,
            'name' => $name,
            'phone_number' => $phone_number,
            'email' => $email,
            'referral_code' => $referral_code,
            'status' => $status,
            'referred_count' => 0
        ]
    ]);
} else {
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to add referral partner: ' . mysqli_stmt_error($stmt)
    ]);
    mysqli_stmt_close($stmt);
}

mysqli_close($connection1);
?>
