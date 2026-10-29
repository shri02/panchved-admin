<?php
/**
 * Panchved Admin - Change Package Status API
 * POST: /api/change_package_status.php
 *
 * Parameters:
 * - id (int) or package_id (string)
 * - status (string: 'Active', 'Inactive', or toggle)
 */

require_once __DIR__ . '/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => '0', 'message' => 'Only POST method is allowed.']);
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
$package_id = trim((string) ($data['package_id'] ?? ''));
$status = trim((string) ($data['status'] ?? ''));

if ($id <= 0 && $package_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Package id or package_id is required.']);
    exit;
}

// If no explicit status provided, toggle from existing status
if ($status === '' || strtolower($status) === 'toggle') {
    $curr_query = $id > 0 ? "SELECT status FROM packages WHERE id = $id" : "SELECT status FROM packages WHERE package_id = '" . mysqli_real_escape_string($connection1, $package_id) . "'";
    $curr_res = @mysqli_query($connection1, $curr_query);
    if ($curr_res && $curr_row = mysqli_fetch_assoc($curr_res)) {
        $status = strtolower($curr_row['status']) === 'active' ? 'Inactive' : 'Active';
    } else {
        $status = 'Active';
    }
} else {
    $status = ucfirst(strtolower($status));
    if (!in_array($status, ['Active', 'Inactive'], true)) {
        $status = 'Active';
    }
}

$update_sql = "UPDATE packages SET status = ? WHERE " . ($id > 0 ? "id = ?" : "package_id = ?");
$stmt = mysqli_prepare($connection1, $update_sql);

if (!$stmt) {
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to prepare query: ' . mysqli_error($connection1)]);
    exit;
}

if ($id > 0) {
    mysqli_stmt_bind_param($stmt, 'si', $status, $id);
} else {
    mysqli_stmt_bind_param($stmt, 'ss', $status, $package_id);
}

if (mysqli_stmt_execute($stmt)) {
    require_once __DIR__ . '/activity_logger.php';
    recordActivity($connection1, [
        'module'      => 'Package',
        'action'      => 'package.status_changed',
        'entity_type' => 'packages',
        'entity_id'   => $package_id ?: (string)$id,
        'description' => "Changed package " . ($package_id ?: "ID #$id") . " status to '{$status}'",
        'new_values'  => ['status' => $status]
    ]);
    mysqli_stmt_close($stmt);
    echo json_encode([
        'status' => '1',
        'message' => 'Package status updated successfully.',
        'new_status' => $status
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to update status.', 'error' => $err]);
}
