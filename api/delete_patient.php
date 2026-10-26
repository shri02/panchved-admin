<?php
/**
 * Panchved Admin - Delete / Remove Patient API
 * POST/DELETE: /api/delete_patient.php
 */

require_once __DIR__ . '/db_connect.php';

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
$patient_id = trim((string) ($_GET['patient_id'] ?? $data['patient_id'] ?? ''));

if ($id <= 0 && $patient_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Patient id or patient_id is required.']);
    exit;
}

if ($connection1) {
    // 1. First retrieve the patient's phone_number and email so we can also remove their user account
    $phone_number = '';
    $email = '';
    if ($id > 0) {
        $findStmt = mysqli_prepare($connection1, "SELECT phone_number, email FROM patients WHERE id = ? LIMIT 1");
        if ($findStmt) {
            mysqli_stmt_bind_param($findStmt, 'i', $id);
            mysqli_stmt_execute($findStmt);
            mysqli_stmt_bind_result($findStmt, $found_phone, $found_email);
            if (mysqli_stmt_fetch($findStmt)) {
                $phone_number = trim((string)$found_phone);
                $email = trim((string)$found_email);
            }
            mysqli_stmt_close($findStmt);
        }
    } else {
        $findStmt = mysqli_prepare($connection1, "SELECT phone_number, email FROM patients WHERE patient_id = ? LIMIT 1");
        if ($findStmt) {
            mysqli_stmt_bind_param($findStmt, 's', $patient_id);
            mysqli_stmt_execute($findStmt);
            mysqli_stmt_bind_result($findStmt, $found_phone, $found_email);
            if (mysqli_stmt_fetch($findStmt)) {
                $phone_number = trim((string)$found_phone);
                $email = trim((string)$found_email);
            }
            mysqli_stmt_close($findStmt);
        }
    }

    // 2. Delete the record from `patients` table
    if ($id > 0) {
        $stmt = mysqli_prepare($connection1, "DELETE FROM patients WHERE id = ?");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 'i', $id);
            mysqli_stmt_execute($stmt);
            $affected = mysqli_stmt_affected_rows($stmt);
            mysqli_stmt_close($stmt);
        }
    } else {
        $stmt = mysqli_prepare($connection1, "DELETE FROM patients WHERE patient_id = ?");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 's', $patient_id);
            mysqli_stmt_execute($stmt);
            $affected = mysqli_stmt_affected_rows($stmt);
            mysqli_stmt_close($stmt);
        }
    }

    // 3. Also delete the patient's login account from `users` table
    if ($phone_number !== '' || $email !== '') {
        if ($phone_number !== '' && $email !== '') {
            $delUserStmt = mysqli_prepare($connection1, "DELETE FROM users WHERE role = 'Patient' AND (phone_number = ? OR email = ?)");
            if ($delUserStmt) {
                mysqli_stmt_bind_param($delUserStmt, 'ss', $phone_number, $email);
                mysqli_stmt_execute($delUserStmt);
                mysqli_stmt_close($delUserStmt);
            }
        } elseif ($phone_number !== '') {
            $delUserStmt = mysqli_prepare($connection1, "DELETE FROM users WHERE role = 'Patient' AND phone_number = ?");
            if ($delUserStmt) {
                mysqli_stmt_bind_param($delUserStmt, 's', $phone_number);
                mysqli_stmt_execute($delUserStmt);
                mysqli_stmt_close($delUserStmt);
            }
        } elseif ($email !== '') {
            $delUserStmt = mysqli_prepare($connection1, "DELETE FROM users WHERE role = 'Patient' AND email = ?");
            if ($delUserStmt) {
                mysqli_stmt_bind_param($delUserStmt, 's', $email);
                mysqli_stmt_execute($delUserStmt);
                mysqli_stmt_close($delUserStmt);
            }
        }
    }
}

echo json_encode([
    'status' => '1',
    'message' => 'Patient and user account deleted successfully.'
]);
