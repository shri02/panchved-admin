<?php
/**
 * Panchved Admin - Get Single Package Details API
 * GET/POST: /api/get_package.php?id=1 or ?package_id=PKG-001
 */

require_once __DIR__ . '/database.php';

$raw_input = file_get_contents('php://input');
$body_data = [];
if ($raw_input !== false && trim($raw_input) !== '') {
    $decoded = json_decode($raw_input, true);
    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
        $body_data = $decoded;
    }
}

$id = intval($_GET['id'] ?? $_POST['id'] ?? $body_data['id'] ?? 0);
$package_id = trim((string) ($_GET['package_id'] ?? $_POST['package_id'] ?? $body_data['package_id'] ?? ''));

if ($id <= 0 && $package_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Package id or package_id is required.']);
    exit;
}

$package = null;

if ($connection1) {
    if ($id > 0) {
        $stmt = mysqli_prepare($connection1, "SELECT * FROM packages WHERE id = ? LIMIT 1");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 'i', $id);
            mysqli_stmt_execute($stmt);
            $res = mysqli_stmt_get_result($stmt);
            if ($res && $row = mysqli_fetch_assoc($res)) {
                $package = $row;
            }
            mysqli_stmt_close($stmt);
        }
    } else {
        $stmt = mysqli_prepare($connection1, "SELECT * FROM packages WHERE package_id = ? LIMIT 1");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 's', $package_id);
            mysqli_stmt_execute($stmt);
            $res = mysqli_stmt_get_result($stmt);
            if ($res && $row = mysqli_fetch_assoc($res)) {
                $package = $row;
            }
            mysqli_stmt_close($stmt);
        }
    }
}

if (!$package) {
    http_response_code(404);
    echo json_encode(['status' => '0', 'message' => 'Package not found in database.']);
    exit;
}

$doc1 = trim((string)($package['assigned_doctor_one'] ?? $package['assigned_doctor_1'] ?? $package['assigned_doctor'] ?? $package['assign_doctor'] ?? ''));
$doc2 = trim((string)($package['assign_doctor_two'] ?? $package['assigned_doctor_two'] ?? $package['assigned_doctor_2'] ?? $package['assign_doctor_2'] ?? ''));

if ($doc2 === '' && strpos($doc1, ',') !== false) {
    $parts = array_map('trim', explode(',', $doc1, 2));
    $doc1 = $parts[0];
    $doc2 = $parts[1] ?? '';
}

$package['assigned_doctor'] = $doc1;
$package['assigned_doctor_1'] = $doc1;
$package['assigned_doctor_2'] = $doc2;
$package['assign_doctor'] = $doc1;
$package['assign_doctor_1'] = $doc1;
$package['assign_doctor_2'] = $doc2;

$combined_doc = $doc1;
if ($doc2 !== '') {
    $combined_doc = $doc1 !== '' ? ($doc1 . ', ' . $doc2) : $doc2;
}
$package['combined_doctor'] = $combined_doc ?: '-';

echo json_encode([
    'status' => '1',
    'message' => 'Package details fetched successfully from SQL database.',
    'data' => $package
]);
