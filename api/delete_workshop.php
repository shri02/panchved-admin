<?php
/**
 * Panchved Admin - Delete Workshop API
 * POST/DELETE: /api/delete_workshop.php
 */

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/activity_logger.php';

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

$id = intval($_GET['id'] ?? $data['id'] ?? 0);
$workshop_id = trim((string) ($_GET['workshop_id'] ?? $data['workshop_id'] ?? ''));

if ($id <= 0 && $workshop_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Workshop id or workshop_id is required.']);
    exit;
}

$ws_name = '';
$ws_code = $workshop_id;
$ws_num_id = $id;

if ($connection1) {
    $chk_sql = $id > 0 ? "SELECT id, title, workshop_id FROM workshops WHERE id = ? LIMIT 1" : "SELECT id, title, workshop_id FROM workshops WHERE workshop_id = ? LIMIT 1";
    $chk_stmt = mysqli_prepare($connection1, $chk_sql);
    if ($chk_stmt) {
        if ($id > 0) {
            mysqli_stmt_bind_param($chk_stmt, 'i', $id);
        } else {
            mysqli_stmt_bind_param($chk_stmt, 's', $workshop_id);
        }
        mysqli_stmt_execute($chk_stmt);
        mysqli_stmt_bind_result($chk_stmt, $f_id, $f_title, $f_code);
        if (mysqli_stmt_fetch($chk_stmt)) {
            $ws_num_id = (int)$f_id;
            $ws_name = (string)$f_title;
            $ws_code = (string)$f_code;
        }
        mysqli_stmt_close($chk_stmt);
    }

    if ($id > 0) {
        $stmt = mysqli_prepare($connection1, "DELETE FROM workshops WHERE id = ?");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 'i', $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
        }
    } else {
        $stmt = mysqli_prepare($connection1, "DELETE FROM workshops WHERE workshop_id = ?");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 's', $workshop_id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
        }
    }

    $display_title = $ws_name ?: ($ws_code ?: "Workshop #{$ws_num_id}");
    recordActivity(
        $connection1,
        'Workshop',
        'workshop.deleted',
        "Deleted workshop: {$display_title}",
        'Workshop',
        $ws_num_id,
        $display_title,
        [
            'workshop_id' => $ws_code
        ]
    );
}

echo json_encode([
    'status' => '1',
    'message' => 'Workshop deleted successfully.'
]);
?>