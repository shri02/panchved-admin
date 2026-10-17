<?php
/**
 * Panchved Admin - Delete Referral Partner API
 * POST: /api/delete_referral_partner.php
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

$id = intval($data['id'] ?? $_GET['id'] ?? 0);
if ($id <= 0) {
    echo json_encode([
        'status' => '0',
        'message' => 'Valid partner ID is required.'
    ]);
    exit;
}

// Table check
$table_check = mysqli_query($connection1, "SHOW TABLES LIKE 'referral_partners'");
if (!$table_check || mysqli_num_rows($table_check) === 0) {
    echo json_encode([
        'status' => '0',
        'message' => 'Referral partners table does not exist.'
    ]);
    exit;
}

$stmt = mysqli_prepare($connection1, "DELETE FROM referral_partners WHERE id = ?");
if (!$stmt) {
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to prepare delete statement: ' . mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_bind_param($stmt, "i", $id);

if (mysqli_stmt_execute($stmt)) {
    $affected = mysqli_stmt_affected_rows($stmt);
    mysqli_stmt_close($stmt);

    if ($affected > 0) {
        echo json_encode([
            'status' => '1',
            'message' => 'Referral partner deleted successfully.'
        ]);
    } else {
        echo json_encode([
            'status' => '0',
            'message' => 'Referral partner not found or already deleted.'
        ]);
    }
} else {
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to delete referral partner: ' . mysqli_stmt_error($stmt)
    ]);
    mysqli_stmt_close($stmt);
}

mysqli_close($connection1);
?>
