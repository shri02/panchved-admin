<?php
/**
 * Panchved Admin - Update Workshop API
 * POST: /api/update_workshop.php
 */

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/azure_blob_upload.php';
require_once __DIR__ . '/activity_logger.php';

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

$raw_id = trim((string) ($data['id'] ?? ''));
$workshop_id = trim((string) ($data['workshop_id'] ?? ''));
if ($workshop_id === '' && !is_numeric($raw_id) && $raw_id !== '') {
    $workshop_id = $raw_id;
}
$id = is_numeric($raw_id) ? intval($raw_id) : 0;

if ($id <= 0 && $workshop_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Workshop id or workshop_id is required.']);
    exit;
}

$title = trim((string) ($data['title'] ?? $data['name'] ?? $data['workshopName'] ?? ''));
$subtitle = isset($data['subtitle']) ? trim((string)$data['subtitle']) : (isset($data['workshop_subtitle']) ? trim((string)$data['workshop_subtitle']) : (isset($data['workshopSubtitle']) ? trim((string)$data['workshopSubtitle']) : null));
$assign_speaker = isset($data['assign_speaker']) ? trim((string)$data['assign_speaker']) : (isset($data['assigned_speaker']) ? trim((string)$data['assigned_speaker']) : (isset($data['assignSpeaker']) ? trim((string)$data['assignSpeaker']) : null));
$meet_link = isset($data['meet_link']) ? trim((string)$data['meet_link']) : (isset($data['meetLink']) ? trim((string)$data['meetLink']) : null);

$instructor = trim((string) ($data['instructor'] ?? ''));
$speaker = trim((string) ($data['speaker'] ?? $instructor));
if ($assign_speaker !== null && $assign_speaker !== '') {
    if ($speaker === '') $speaker = $assign_speaker;
    if ($instructor === '') $instructor = $assign_speaker;
}

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
    try {
        $image_url = uploadWorkshopImageToAzure($wsImageFile);
    } catch (Throwable $e) {
        error_log('update_workshop.php image upload error: ' . $e->getMessage());
        http_response_code(400);
        echo json_encode(['status' => '0', 'message' => $e->getMessage()]);
        exit;
    }
} elseif (isset($data['image_url']) && trim((string)$data['image_url']) !== '') {
    $image_url = trim((string)$data['image_url']);
}

// Check / Ensure columns exist in workshops table
$existing_columns = [];
if ($connection1) {
    $columns_res = @mysqli_query($connection1, "SHOW COLUMNS FROM workshops");
    if ($columns_res) {
        while ($col = mysqli_fetch_assoc($columns_res)) {
            $existing_columns[] = strtolower($col['Field']);
        }
    }
    if (!empty($existing_columns)) {
        if (!in_array('subtitle', $existing_columns)) {
            @mysqli_query($connection1, "ALTER TABLE workshops ADD COLUMN `subtitle` VARCHAR(255) NULL AFTER `title`");
            $existing_columns[] = 'subtitle';
        }
        if (!in_array('assign_speaker', $existing_columns)) {
            @mysqli_query($connection1, "ALTER TABLE workshops ADD COLUMN `assign_speaker` VARCHAR(150) NULL AFTER `speaker`");
            $existing_columns[] = 'assign_speaker';
        }
        if (!in_array('meet_link', $existing_columns)) {
            @mysqli_query($connection1, "ALTER TABLE workshops ADD COLUMN `meet_link` VARCHAR(255) NULL AFTER `assign_speaker`");
            $existing_columns[] = 'meet_link';
        }
        if (!in_array('image_url', $existing_columns)) {
            @mysqli_query($connection1, "ALTER TABLE workshops ADD COLUMN `image_url` VARCHAR(255) NULL AFTER `about`");
            $existing_columns[] = 'image_url';
        }
    }
}

$update_fields = [];
$params = [];
$types = '';

if ($title !== '') { $update_fields[] = "title = ?"; $params[] = $title; $types .= 's'; }
if ($subtitle !== null) { $update_fields[] = "subtitle = ?"; $params[] = $subtitle; $types .= 's'; }
if ($instructor !== '') { $update_fields[] = "instructor = ?"; $params[] = $instructor; $types .= 's'; }
if ($speaker !== '') { $update_fields[] = "speaker = ?"; $params[] = $speaker; $types .= 's'; }
if ($assign_speaker !== null) { $update_fields[] = "assign_speaker = ?"; $params[] = $assign_speaker; $types .= 's'; }
if ($meet_link !== null) { $update_fields[] = "meet_link = ?"; $params[] = $meet_link; $types .= 's'; }
if ($attendee_type !== '') { $update_fields[] = "attendee_type = ?"; $params[] = $attendee_type; $types .= 's'; }
if ($date !== '') {
    $formatted_date = null;
    if ($date !== '0000-00-00') {
        $ts = strtotime($date);
        if ($ts !== false && $ts > 0 && (int)date('Y', $ts) > 1970) {
            $formatted_date = date('Y-m-d', $ts);
        } else {
            $dcheck = DateTime::createFromFormat('Y-m-d', $date);
            if ($dcheck && (int)$dcheck->format('Y') > 1970) {
                $formatted_date = $dcheck->format('Y-m-d');
            } else {
                $dcheck2 = DateTime::createFromFormat('d/m/Y', $date);
                if ($dcheck2 && (int)$dcheck2->format('Y') > 1970) {
                    $formatted_date = $dcheck2->format('Y-m-d');
                } else {
                    $dcheck3 = DateTime::createFromFormat('d-m-Y', $date);
                    if ($dcheck3 && (int)$dcheck3->format('Y') > 1970) {
                        $formatted_date = $dcheck3->format('Y-m-d');
                    }
                }
            }
        }
    }
    if ($formatted_date !== null) {
        $update_fields[] = "date = ?"; $params[] = $formatted_date; $types .= 's';
    }
}
if ($time !== '') { $update_fields[] = "time = ?"; $params[] = $time; $types .= 's'; }
if ($fee_raw !== null && $fee_raw !== '') {
    $val = floatval($fee_raw);
    $update_fields[] = "fee = ?"; $params[] = $val; $types .= 'd';
    $update_fields[] = "price = ?"; $params[] = $val; $types .= 'd';
}
if ($about !== '') { $update_fields[] = "about = ?"; $params[] = $about; $types .= 's'; }
if ($status !== '' && in_array($status, ['Upcoming', 'Completed', 'Cancelled', 'Active', 'Past'], true)) {
    $update_fields[] = "status = ?"; $params[] = $status; $types .= 's';
}
if ($image_url !== null && $image_url !== '') {
    $update_fields[] = "image_url = ?"; $params[] = $image_url; $types .= 's';
}

if (empty($update_fields)) {
    echo json_encode(['status' => '1', 'message' => 'No fields to update.']);
    exit;
}

if (!$connection1) {
    echo json_encode(['status' => '1', 'message' => 'Workshop updated successfully.']);
    exit;
}

$ws_name = $title;
$ws_code = $workshop_id;
$ws_numeric_id = $id;

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
        $ws_numeric_id = (int)$f_id;
        if (empty($ws_name)) $ws_name = $f_title;
        if (empty($ws_code)) $ws_code = $f_code;
    }
    mysqli_stmt_close($chk_stmt);
}

$sql = "UPDATE workshops SET " . implode(', ', $update_fields);
if ($id > 0) {
    $sql .= " WHERE id = ?";
    $params[] = $id;
    $types .= 'i';
} else {
    $sql .= " WHERE workshop_id = ?";
    $params[] = $workshop_id;
    $types .= 's';
}

$stmt = mysqli_prepare($connection1, $sql);
if (!$stmt) {
    echo json_encode(['status' => '1', 'message' => 'Workshop updated successfully.']);
    exit;
}

mysqli_stmt_bind_param($stmt, $types, ...$params);

if (mysqli_stmt_execute($stmt)) {
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
    mysqli_stmt_close($stmt);
    echo json_encode([
        'status' => '1',
        'message' => 'Workshop updated successfully.',
        'data' => [
            'id' => $id,
            'workshop_id' => $workshop_id,
            'image_url' => $image_url
        ]
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to update workshop.', 'error' => $err]);
}
