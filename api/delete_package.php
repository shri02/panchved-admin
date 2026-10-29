<?php
/**
 * Panchved Admin - Delete Package API
 * POST/DELETE: /api/delete_package.php
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
$package_id = trim((string) ($_GET['package_id'] ?? $data['package_id'] ?? ''));

if ($id <= 0 && $package_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Package id or package_id is required.']);
    exit;
}

$pkgName = '';

if ($connection1) {
    $lookupSql = ($id > 0) ? "SELECT package_id, package_name FROM packages WHERE id = ?" : "SELECT package_id, package_name FROM packages WHERE package_id = ?";
    if ($lStmt = mysqli_prepare($connection1, $lookupSql)) {
        if ($id > 0) { mysqli_stmt_bind_param($lStmt, 'i', $id); }
        else { mysqli_stmt_bind_param($lStmt, 's', $package_id); }
        mysqli_stmt_execute($lStmt);
        $lRes = mysqli_stmt_get_result($lStmt);
        if ($lRes && $lRow = mysqli_fetch_assoc($lRes)) {
            $pkgName = $lRow['package_name'];
            $package_id = $lRow['package_id'];
        }
        mysqli_stmt_close($lStmt);
    }

    if ($id > 0) {
        $stmt = mysqli_prepare($connection1, "DELETE FROM packages WHERE id = ?");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 'i', $id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
        }
    } else {
        $stmt = mysqli_prepare($connection1, "DELETE FROM packages WHERE package_id = ?");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 's', $package_id);
            mysqli_stmt_execute($stmt);
            mysqli_stmt_close($stmt);
        }
    }

    recordActivity($connection1, [
        'module'      => 'Package',
        'action'      => 'package.deleted',
        'entity_type' => 'packages',
        'entity_id'   => $package_id ?: (string)$id,
        'entity_name' => $pkgName,
        'description' => "Deleted package '{$pkgName}' (" . ($package_id ?: $id) . ")",
        'old_values'  => ['id' => $id, 'package_id' => $package_id, 'package_name' => $pkgName]
    ]);
}

echo json_encode([
    'status' => '1',
    'message' => 'Package deleted successfully.'
]);
?>
