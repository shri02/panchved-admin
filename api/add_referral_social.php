<?php
/**
 * Panchved Admin - Add Social Media Referral API
 * POST: /api/add_referral_social.php
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
$table_check = mysqli_query($connection1, "SHOW TABLES LIKE 'social_media_referrals'");
if (!$table_check || mysqli_num_rows($table_check) === 0) {
    echo json_encode([
        'status' => '0',
        'message' => 'Table social_media_referrals does not exist. Please execute the SQL migration script first.'
    ]);
    exit;
}

$platform = trim((string) ($data['platform'] ?? ''));
$campaign_name = trim((string) ($data['campaign_name'] ?? $data['campaignName'] ?? ''));
$referral_code = strtoupper(trim((string) ($data['referral_code'] ?? $data['referralCode'] ?? '')));
$target_url = trim((string) ($data['target_url'] ?? $data['targetUrl'] ?? ''));
$notes = trim((string) ($data['notes'] ?? ''));
$status = trim((string) ($data['status'] ?? 'Active'));

// Validation
if ($platform === '' || $campaign_name === '') {
    echo json_encode([
        'status' => '0',
        'message' => 'Platform and Campaign Name are required.'
    ]);
    exit;
}

$status = ucfirst(strtolower($status));
if ($status !== 'Active' && $status !== 'Inactive') {
    $status = 'Active';
}

// Helper: auto-generate unique social referral code
function generateSocialReferralCode($platform, $conn) {
    $clean_platform = strtoupper(preg_replace('/[^A-Za-z]/', '', $platform));
    $prefix = strlen($clean_platform) >= 2 ? substr($clean_platform, 0, 3) : 'SOC';
    $code_prefix = 'SOC-' . $prefix;

    for ($attempt = 0; $attempt < 15; $attempt++) {
        $random = strtoupper(substr(bin2hex(random_bytes(3)), 0, 4));
        $code = $code_prefix . '-' . $random;

        $check_stmt = mysqli_prepare($conn, "SELECT id FROM social_media_referrals WHERE referral_code = ? LIMIT 1");
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
    return 'SOC-' . strtoupper(substr(uniqid(), -6));
}

if ($referral_code === '') {
    $referral_code = generateSocialReferralCode($platform, $connection1);
} else {
    // Check if provided code already exists in social_media_referrals
    $chk_code_stmt = mysqli_prepare($connection1, "SELECT id FROM social_media_referrals WHERE referral_code = ? LIMIT 1");
    if ($chk_code_stmt) {
        mysqli_stmt_bind_param($chk_code_stmt, "s", $referral_code);
        mysqli_stmt_execute($chk_code_stmt);
        mysqli_stmt_store_result($chk_code_stmt);
        if (mysqli_stmt_num_rows($chk_code_stmt) > 0) {
            mysqli_stmt_close($chk_code_stmt);
            echo json_encode([
                'status' => '0',
                'message' => 'This referral code already exists in social media referrals. Please choose a different code or leave blank to auto-generate.'
            ]);
            exit;
        }
        mysqli_stmt_close($chk_code_stmt);
    }
}

// Insert
$insert_query = "
    INSERT INTO social_media_referrals (
        platform,
        campaign_name,
        referral_code,
        target_url,
        notes,
        status
    ) VALUES (?, ?, ?, ?, ?, ?)
";

$stmt = mysqli_prepare($connection1, $insert_query);
if (!$stmt) {
    echo json_encode([
        'status' => '0',
        'message' => 'Database error: ' . mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_bind_param($stmt, "ssssss", $platform, $campaign_name, $referral_code, $target_url, $notes, $status);

if (mysqli_stmt_execute($stmt)) {
    $new_id = mysqli_insert_id($connection1);
    $campaign_id = 'SOC' . str_pad((string)$new_id, 4, '0', STR_PAD_LEFT);

    require_once __DIR__ . '/activity_logger.php';
    recordActivity($connection1, [
        'module'      => 'Referral_Social',
        'action'      => 'referral_social.created',
        'entity_type' => 'social_media_referrals',
        'entity_id'   => $campaign_id,
        'entity_name' => $campaign_name,
        'description' => "Created {$platform} referral campaign '{$campaign_name}' ({$referral_code})",
        'new_values'  => [
            'id' => $new_id,
            'campaign_id' => $campaign_id,
            'platform' => $platform,
            'campaign_name' => $campaign_name,
            'referral_code' => $referral_code,
            'status' => $status
        ]
    ]);

    $up_cid = mysqli_prepare($connection1, "UPDATE social_media_referrals SET campaign_id = ? WHERE id = ?");
    if ($up_cid) {
        mysqli_stmt_bind_param($up_cid, "si", $campaign_id, $new_id);
        mysqli_stmt_execute($up_cid);
        mysqli_stmt_close($up_cid);
    }

    mysqli_stmt_close($stmt);

    echo json_encode([
        'status' => '1',
        'message' => 'Social media referral created successfully.',
        'data' => [
            'id' => $new_id,
            'campaign_id' => $campaign_id,
            'platform' => $platform,
            'campaign_name' => $campaign_name,
            'referral_code' => $referral_code,
            'target_url' => $target_url,
            'notes' => $notes,
            'status' => $status
        ]
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to create social media referral: ' . $err
    ]);
}

mysqli_close($connection1);
?>
