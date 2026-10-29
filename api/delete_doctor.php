<?php

/**
 * Panchved Admin - Delete Doctor API
 * POST: /api/delete_doctor.php
 *
 * Parameters:
 * - id (int) or doctorid (string)
 */

require_once __DIR__ . '/db_connect.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
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
$doctorid = trim((string) ($data['doctorid'] ?? $data['doctorId'] ?? ''));

if ($id <= 0 && $doctorid !== '') {
    $find_stmt = mysqli_prepare($connection1, "SELECT id FROM doctors WHERE doctorid = ? LIMIT 1");
    if ($find_stmt) {
        mysqli_stmt_bind_param($find_stmt, "s", $doctorid);
        mysqli_stmt_execute($find_stmt);
        mysqli_stmt_bind_result($find_stmt, $found_id);
        if (mysqli_stmt_fetch($find_stmt)) {
            $id = intval($found_id);
        }
        mysqli_stmt_close($find_stmt);
    }
}

if ($id <= 0) {
    http_response_code(400);
    echo json_encode([
        'status' => '0',
        'message' => 'Valid doctor ID is required for deletion.'
    ]);
    exit;
}

// Delete doctor record
require_once __DIR__ . '/activity_logger.php';
$docName = '';
$docCode = '';
$dLookup = @mysqli_query($connection1, "SELECT full_name, doctorid FROM doctors WHERE id = $id");
if ($dLookup && $dRow = mysqli_fetch_assoc($dLookup)) {
    $docName = $dRow['full_name'];
    $docCode = $dRow['doctorid'] ?: ('DOC' . str_pad((string)$id, 6, '0', STR_PAD_LEFT));
}

$delete_stmt = mysqli_prepare($connection1, "DELETE FROM doctors WHERE id = ?");
if (!$delete_stmt) {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'SQL prepare failed.',
        'error' => mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_bind_param($delete_stmt, "i", $id);

if (mysqli_stmt_execute($delete_stmt)) {
    $affected = mysqli_stmt_affected_rows($delete_stmt);
    mysqli_stmt_close($delete_stmt);
    mysqli_close($connection1);

    if ($affected > 0) {
        recordActivity($connection1, [
            'module'      => 'Doctor',
            'action'      => 'doctor.deleted',
            'entity_type' => 'doctors',
            'entity_id'   => $docCode ?: (string)$id,
            'entity_name' => $docName,
            'description' => "Deleted doctor '{$docName}' (" . ($docCode ?: $id) . ")",
            'old_values'  => ['id' => $id, 'doctorid' => $docCode, 'name' => $docName]
        ]);
        http_response_code(200);
        echo json_encode([
            'status' => '1',
            'message' => 'Doctor deleted successfully.',
            'id' => $id
        ]);
    } else {
        http_response_code(404);
        echo json_encode([
            'status' => '0',
            'message' => 'Doctor not found or already deleted.'
        ]);
    }
} else {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to delete doctor.',
        'error' => mysqli_stmt_error($delete_stmt)
    ]);
    mysqli_stmt_close($delete_stmt);
    mysqli_close($connection1);
}
?>
