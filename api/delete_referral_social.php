<?php
/**
 * Panchved Admin - Delete Social Media Referral API
 * POST: /api/delete_referral_social.php
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

require_once __DIR__ . '/activity_logger.php';
$cName = '';
$cPlatform = '';
$cLookup = @mysqli_query($connection1, "SELECT campaign_name, platform, campaign_id FROM social_media_referrals WHERE id = $id");
if ($cLookup && $cRow = mysqli_fetch_assoc($cLookup)) {
    $cName = $cRow['campaign_name'];
    $cPlatform = $cRow['platform'];
}

$stmt = mysqli_prepare($connection1, "DELETE FROM social_media_referrals WHERE id = ?");
if (!$stmt) {
    echo json_encode([
        'status' => '0',
        'message' => 'Database error: ' . mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_bind_param($stmt, "i", $id);

if (mysqli_stmt_execute($stmt)) {
    mysqli_stmt_close($stmt);

    recordActivity($connection1, [
        'module'      => 'Referral_Social',
        'action'      => 'referral_social.deleted',
        'entity_type' => 'social_media_referrals',
        'entity_id'   => (string)$id,
        'entity_name' => $cName,
        'description' => "Deleted {$cPlatform} referral campaign '{$cName}' (ID #$id)",
        'old_values'  => ['id' => $id, 'platform' => $cPlatform, 'campaign_name' => $cName]
    ]);
    echo json_encode([
        'status' => '1',
        'message' => 'Social media referral deleted successfully.'
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to delete social media referral: ' . $err
    ]);
}

mysqli_close($connection1);
?>
