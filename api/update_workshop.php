<?php
/**
 * Panchved Admin - Update Workshop API
 * POST: /api/update_workshop.php
 */

// Ensure JSON header is sent immediately
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Fast return on preflight OPTIONS request
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit(0);
}

// Convert PHP warnings and notices to ErrorException so they don't corrupt JSON output
set_error_handler(function($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        echo json_encode([
            'status' => '0',
            'success' => false,
            'message' => 'Only POST method is allowed.',
            'error_type' => 'invalid_method',
            'error_code' => 405,
            'sqlstate' => '42000',
            'error_details' => 'Request method must be POST.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    require_once __DIR__ . '/database.php';
    @require_once __DIR__ . '/azure_blob_upload.php';
    @require_once __DIR__ . '/activity_logger.php';

    global $connection1;
    $connection1 = $GLOBALS['connection1'] ?? $connection1;

    if (!isset($connection1) || !($connection1 instanceof mysqli)) {
        throw new mysqli_sql_exception('Database connection unavailable: ' . ($lastDbError ?? 'Unable to connect to database server.'));
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    // Read input from php://input (JSON) or $_POST (FormData)
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

    // Resolve workshop ID
    $raw_id = trim((string) ($data['id'] ?? ''));
    $workshop_id = trim((string) ($data['workshop_id'] ?? ''));
    if ($workshop_id === '' && !is_numeric($raw_id) && $raw_id !== '') {
        $workshop_id = $raw_id;
    }
    $id = is_numeric($raw_id) ? intval($raw_id) : 0;

    if ($id <= 0 && $workshop_id === '') {
        echo json_encode([
            'status' => '0',
            'success' => false,
            'message' => 'Workshop id or workshop_id is required.',
            'error_type' => 'validation_error',
            'error_code' => 400,
            'sqlstate' => '22000',
            'error_details' => 'Neither numeric id nor string workshop_id was provided in request payload.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Find the existing workshop row in database
    $targetRow = null;
    if ($id > 0) {
        $chk_stmt = mysqli_prepare($connection1, "SELECT `id`, `title`, `workshop_id` FROM `workshops` WHERE `id` = ? LIMIT 1");
        if ($chk_stmt) {
            mysqli_stmt_bind_param($chk_stmt, 'i', $id);
            mysqli_stmt_execute($chk_stmt);
            $res = mysqli_stmt_get_result($chk_stmt);
            if ($res && ($row = mysqli_fetch_assoc($res))) {
                $targetRow = $row;
            }
            mysqli_stmt_close($chk_stmt);
        }
    }
    if (!$targetRow && $workshop_id !== '') {
        $chk_stmt = mysqli_prepare($connection1, "SELECT `id`, `title`, `workshop_id` FROM `workshops` WHERE `workshop_id` = ? LIMIT 1");
        if ($chk_stmt) {
            mysqli_stmt_bind_param($chk_stmt, 's', $workshop_id);
            mysqli_stmt_execute($chk_stmt);
            $res = mysqli_stmt_get_result($chk_stmt);
            if ($res && ($row = mysqli_fetch_assoc($res))) {
                $targetRow = $row;
            }
            mysqli_stmt_close($chk_stmt);
        }
    }

    if (!$targetRow) {
        echo json_encode([
            'status' => '0',
            'success' => false,
            'message' => 'Workshop not found.',
            'error_type' => 'not_found',
            'error_code' => 404,
            'sqlstate' => '02000',
            'error_details' => 'No workshop found matching id=' . $id . ' or workshop_id="' . $workshop_id . '".'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $ws_numeric_id = (int) $targetRow['id'];
    $ws_code = $targetRow['workshop_id'] ?? $workshop_id;
    $ws_name = $targetRow['title'] ?? '';

    // Extract fields from payload
    $title = trim((string) ($data['title'] ?? $data['name'] ?? $data['workshopName'] ?? ''));
    if ($title !== '') {
        $ws_name = $title;
    }

    $subtitle = isset($data['subtitle']) ? trim((string)$data['subtitle']) : (isset($data['workshop_subtitle']) ? trim((string)$data['workshop_subtitle']) : (isset($data['workshopSubtitle']) ? trim((string)$data['workshopSubtitle']) : null));
    $assign_speaker = isset($data['assign_speaker']) ? trim((string)$data['assign_speaker']) : (isset($data['assigned_speaker']) ? trim((string)$data['assigned_speaker']) : (isset($data['assignSpeaker']) ? trim((string)$data['assignSpeaker']) : null));
    $meet_link = isset($data['meet_link']) ? trim((string)$data['meet_link']) : (isset($data['meetLink']) ? trim((string)$data['meetLink']) : null);

    $instructor = trim((string) ($data['instructor'] ?? ''));
    $speaker = trim((string) ($data['speaker'] ?? ''));
    if ($assign_speaker !== null && $assign_speaker !== '') {
        if ($speaker === '') $speaker = $assign_speaker;
        if ($instructor === '') $instructor = $assign_speaker;
    }
    if ($instructor === '' && $speaker !== '') {
        $instructor = $speaker;
    }

    $speaker_role = isset($data['speaker_role']) ? trim((string)$data['speaker_role']) : null;
    $speaker_bio = isset($data['speaker_bio']) ? trim((string)$data['speaker_bio']) : null;

    $attendee_type = trim((string) ($data['attendee_type'] ?? $data['attendee'] ?? ''));
    if (strcasecmp($attendee_type, 'patient') === 0) {
        $attendee_type = 'Patient';
    } elseif (strcasecmp($attendee_type, 'doctor') === 0) {
        $attendee_type = 'Doctor';
    } elseif (strcasecmp($attendee_type, 'both') === 0 || strcasecmp($attendee_type, 'all') === 0) {
        $attendee_type = 'Both';
    }

    $date = trim((string) ($data['date'] ?? ''));
    $time = trim((string) ($data['time'] ?? ''));
    $location = isset($data['location']) ? trim((string)$data['location']) : null;
    $capacity = isset($data['capacity']) && is_numeric($data['capacity']) ? intval($data['capacity']) : null;

    $fee_raw = isset($data['fee']) ? preg_replace('/[^\d.]/', '', (string) $data['fee']) : (isset($data['price']) ? preg_replace('/[^\d.]/', '', (string) $data['price']) : null);
    $about = trim((string) ($data['about'] ?? ''));
    $status = trim((string) ($data['status'] ?? ''));

    // Handle Workshop Image Upload to Azure Blob Storage if provided
    $image_url = null;
    $wsImageFile = $_FILES['workshop-images']
        ?? $_FILES['workshop_image']
        ?? $_FILES['workshop_images']
        ?? $_FILES['workshop-image']
        ?? $_FILES['image']
        ?? null;

    if ($wsImageFile && ($wsImageFile['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
        if (function_exists('uploadWorkshopImageToAzure')) {
            $image_url = uploadWorkshopImageToAzure($wsImageFile);
        }
    } elseif (isset($data['image_url']) && trim((string)$data['image_url']) !== '') {
        $image_url = trim((string)$data['image_url']);
    }

    // Build UPDATE query dynamically
    $update_fields = [];
    $params = [];
    $types = '';

    if ($title !== '') {
        $update_fields[] = "`title` = ?";
        $params[] = $title;
        $types .= 's';
    }
    if ($subtitle !== null) {
        $update_fields[] = "`subtitle` = ?";
        $params[] = $subtitle;
        $types .= 's';
    }
    if ($instructor !== '') {
        $update_fields[] = "`instructor` = ?";
        $params[] = $instructor;
        $types .= 's';
    }
    if ($speaker !== '') {
        $update_fields[] = "`speaker` = ?";
        $params[] = $speaker;
        $types .= 's';
    }
    if ($assign_speaker !== null) {
        $update_fields[] = "`assign_speaker` = ?";
        $params[] = $assign_speaker;
        $types .= 's';
    }
    if ($speaker_role !== null && $speaker_role !== '') {
        $update_fields[] = "`speaker_role` = ?";
        $params[] = $speaker_role;
        $types .= 's';
    }
    if ($speaker_bio !== null && $speaker_bio !== '') {
        $update_fields[] = "`speaker_bio` = ?";
        $params[] = $speaker_bio;
        $types .= 's';
    }
    if ($meet_link !== null) {
        $update_fields[] = "`meet_link` = ?";
        $params[] = $meet_link;
        $types .= 's';
    }
    if ($location !== null && $location !== '') {
        $update_fields[] = "`location` = ?";
        $params[] = $location;
        $types .= 's';
    }
    if ($capacity !== null && $capacity >= 0) {
        $update_fields[] = "`capacity` = ?";
        $params[] = $capacity;
        $types .= 'i';
    }
    if ($attendee_type !== '') {
        $update_fields[] = "`attendee_type` = ?";
        $params[] = $attendee_type;
        $types .= 's';
    }

    // Parse and normalize date
    if ($date !== '' && $date !== '0000-00-00') {
        $formatted_date = null;
        $formats = ['Y-m-d', 'd-m-Y', 'd/m/Y', 'Y/m/d', 'm/d/Y', 'd.m.Y'];
        foreach ($formats as $fmt) {
            $d = DateTime::createFromFormat($fmt, $date);
            if ($d && (int)$d->format('Y') > 1970) {
                $formatted_date = $d->format('Y-m-d');
                break;
            }
        }
        if (!$formatted_date) {
            $ts = strtotime($date);
            if ($ts !== false && $ts > 0 && (int)date('Y', $ts) > 1970) {
                $formatted_date = date('Y-m-d', $ts);
            }
        }
        if ($formatted_date !== null) {
            $update_fields[] = "`date` = ?";
            $params[] = $formatted_date;
            $types .= 's';
        }
    }

    if ($time !== '') {
        $update_fields[] = "`time` = ?";
        $params[] = $time;
        $types .= 's';
    }

    // Both `fee` and `price` exist in the table schema
    if ($fee_raw !== null && $fee_raw !== '') {
        $val = floatval($fee_raw);
        $update_fields[] = "`fee` = ?";
        $params[] = $val;
        $types .= 'd';

        $update_fields[] = "`price` = ?";
        $params[] = $val;
        $types .= 'd';
    }

    if ($about !== '') {
        $update_fields[] = "`about` = ?";
        $params[] = $about;
        $types .= 's';
    }

    // Status enum normalization
    if ($status !== '') {
        $allowed_statuses = ['Upcoming', 'Completed', 'Cancelled', 'Active', 'Past'];
        $normalized_status = null;
        foreach ($allowed_statuses as $st) {
            if (strcasecmp($st, $status) === 0) {
                $normalized_status = $st;
                break;
            }
        }
        if ($normalized_status !== null) {
            $update_fields[] = "`status` = ?";
            $params[] = $normalized_status;
            $types .= 's';
        }
    }

    if ($image_url !== null && $image_url !== '') {
        $update_fields[] = "`image_url` = ?";
        $params[] = $image_url;
        $types .= 's';
    }

    if (empty($update_fields)) {
        echo json_encode([
            'status' => '1',
            'success' => true,
            'message' => 'No fields to update.',
            'data' => [
                'id' => $ws_numeric_id,
                'workshop_id' => $ws_code
            ]
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    // Update by primary key ID
    $sql = "UPDATE `workshops` SET " . implode(', ', $update_fields) . " WHERE `id` = ?";
    $params[] = $ws_numeric_id;
    $types .= 'i';

    $stmt = mysqli_prepare($connection1, $sql);
    if (!$stmt) {
        throw new mysqli_sql_exception(mysqli_error($connection1) ?: 'Failed to prepare workshop update statement.');
    }

    mysqli_stmt_bind_param($stmt, $types, ...$params);

    $executed = mysqli_stmt_execute($stmt);
    if (!$executed) {
        $errMsg = mysqli_stmt_error($stmt) ?: 'Failed to execute workshop update statement.';
        mysqli_stmt_close($stmt);
        throw new mysqli_sql_exception($errMsg);
    }
    mysqli_stmt_close($stmt);

    if (function_exists('recordActivity')) {
        try {
            recordActivity(
                $connection1,
                'Workshop',
                'workshop.updated',
                "Updated workshop: {$ws_name}",
                'Workshop',
                $ws_numeric_id,
                $ws_name,
                array_filter([
                    'workshop_id' => $ws_code,
                    'title' => $title ?: null,
                    'status' => $status ?: null,
                    'speaker' => $assign_speaker ?: null,
                    'date' => $formatted_date ?? ($date ?: null),
                    'time' => $time ?: null,
                    'fee' => $fee_raw !== null && $fee_raw !== '' ? floatval($fee_raw) : null
                ])
            );
        } catch (Throwable $e) {
            // activity logging should not fail the update response
        }
    }

    echo json_encode([
        'status' => '1',
        'success' => true,
        'message' => 'Workshop updated successfully.',
        'data' => [
            'id' => $ws_numeric_id,
            'workshop_id' => $ws_code,
            'image_url' => $image_url
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (mysqli_sql_exception $e) {
    // Note: Never call http_response_code(500) so IIS/Azure does not intercept into a 404 HTML page
    echo json_encode([
        'status' => '0',
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage(),
        'error_type' => 'mysqli_sql_exception',
        'error_code' => $e->getCode(),
        'sqlstate' => method_exists($e, 'getSqlState') ? $e->getSqlState() : 'HY000',
        'error_details' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    // Note: Never call http_response_code(500) so IIS/Azure does not intercept into a 404 HTML page
    echo json_encode([
        'status' => '0',
        'success' => false,
        'message' => 'Server error: ' . $e->getMessage(),
        'error_type' => get_class($e),
        'error_code' => $e->getCode(),
        'sqlstate' => 'HY000',
        'error_details' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
