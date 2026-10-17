<?php
/**
 * Panchved Admin - Update Social Media Referral API
 * POST: /api/update_referral_social.php
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

$id = intval($data['id'] ?? 0);
if ($id <= 0) {
    echo json_encode([
        'status' => '0',
        'message' => 'Valid ID is required.'
    ]);
    exit;
}

$platform = trim((string) ($data['platform'] ?? ''));
$campaign_name = trim((string) ($data['campaign_name'] ?? $data['campaignName'] ?? ''));
$referral_code = strtoupper(trim((string) ($data['referral_code'] ?? $data['referralCode'] ?? '')));
$target_url = trim((string) ($data['target_url'] ?? $data['targetUrl'] ?? ''));
$notes = trim((string) ($data['notes'] ?? ''));
$status = trim((string) ($data['status'] ?? 'Active'));

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

$update_query = "
    UPDATE social_media_referrals 
    SET platform = ?, campaign_name = ?, target_url = ?, notes = ?, status = ?
    WHERE id = ?
";

$stmt = mysqli_prepare($connection1, $update_query);
if (!$stmt) {
    echo json_encode([
        'status' => '0',
        'message' => 'Database error: ' . mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_bind_param($stmt, "sssssi", $platform, $campaign_name, $target_url, $notes, $status, $id);

if (mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);
    echo json_encode([
        'status' => '1',
        'message' => 'Social media referral updated successfully.'
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to update social media referral: ' . $err
    ]);
}

mysqli_close($connection1);
?>
