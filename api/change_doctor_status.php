<?php

/**
 * Panchved Admin - Change Doctor Status API
 * POST: /api/change_doctor_status.php
 *
 * Parameters (JSON or POST):
 * - id (int) or doctorid (string)
 * - status (string: 'Active' | 'Inactive')
 */

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/activity_logger.php';

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
$status = ucfirst(strtolower(trim((string) ($data['status'] ?? ''))));

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
        'message' => 'Valid doctor ID is required.'
    ]);
    exit;
}

if (!in_array($status, ['Active', 'Inactive'], true)) {
    http_response_code(422);
    echo json_encode([
        'status' => '0',
        'message' => 'Invalid status. Allowed values are Active or Inactive.'
    ]);
    exit;
}

// Fetch doctor details for logging
$doc_name = '';
$doc_code = $doctorid;
$doc_q = mysqli_prepare($connection1, "SELECT name, doctorid FROM doctors WHERE id = ? LIMIT 1");
if ($doc_q) {
    mysqli_stmt_bind_param($doc_q, "i", $id);
    mysqli_stmt_execute($doc_q);
    mysqli_stmt_bind_result($doc_q, $f_name, $f_code);
    if (mysqli_stmt_fetch($doc_q)) {
        $doc_name = $f_name;
        $doc_code = $f_code;
    }
    mysqli_stmt_close($doc_q);
}

$update_stmt = mysqli_prepare($connection1, "UPDATE doctors SET status = ? WHERE id = ?");
if (!$update_stmt) {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'SQL prepare failed.',
        'error' => mysqli_error($connection1)
    ]);
    exit;
}

mysqli_stmt_bind_param($update_stmt, "si", $status, $id);

if (mysqli_stmt_execute($update_stmt)) {
    mysqli_stmt_close($update_stmt);

    // Audit log
    $display_name = $doc_name ?: ($doc_code ?: "Doctor #{$id}");
    recordActivity(
        $connection1,
        'Doctor',
        'doctor.status_changed',
        "Changed status of {$display_name} to {$status}",
        'Doctor',
        $id,
        $display_name,
        [
            'doctor_id' => $doc_code,
            'new_status' => $status
        ]
    );

    mysqli_close($connection1);

    http_response_code(200);
    echo json_encode([
        'status' => '1',
        'message' => 'Doctor status updated successfully.',
        'id' => $id,
        'new_status' => $status
    ]);
} else {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'Failed to update doctor status.',
        'error' => mysqli_stmt_error($update_stmt)
    ]);
    mysqli_stmt_close($update_stmt);
    mysqli_close($connection1);
}
?>