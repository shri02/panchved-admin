<?php
/**
 * Panchved Admin - Add Workshop API
 * POST: /api/add_workshop.php
 *
 * Accepts multipart/form-data:
 * - workshop_image: required JPG, PNG, or WebP file (max 5 MB)
 * - workshop fields: title, subtitle, date, time, attendee_type, fee,
 *   about, assign_speaker, speaker, meet_link, status, etc.
 *
 * The image is uploaded to Azure Blob Storage. Its URL is saved in workshops.image_url.
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/azure_blob_upload.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    header('Allow: POST');
    echo json_encode(['status' => '0', 'message' => 'Only POST method is allowed.']);
    exit;
}

if (!isset($connection1) || !($connection1 instanceof mysqli)) {
    error_log('add_workshop.php: database connection $connection1 is unavailable.');
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Database connection is unavailable.']);
    exit;
}

mysqli_set_charset($connection1, 'utf8mb4');

/*
 * FormData submits through $_POST and $_FILES.
 * Keep JSON fallback for clients that do not upload an image.
 */
$data = $_POST;
if (empty($data)) {
    $raw_data = file_get_contents('php://input');
    if ($raw_data !== false && trim($raw_data) !== '') {
        $jsonData = json_decode($raw_data, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($jsonData)) {
            $data = $jsonData;
        }
    }
}

$title = trim((string) ($data['title'] ?? $data['name'] ?? $data['workshopName'] ?? ''));
$subtitle = trim((string) ($data['subtitle'] ?? $data['workshop_subtitle'] ?? $data['workshopSubtitle'] ?? ''));
$assign_speaker = trim((string) ($data['assign_speaker'] ?? $data['assigned_speaker'] ?? $data['assignSpeaker'] ?? ''));
$meet_link = trim((string) ($data['meet_link'] ?? $data['meetLink'] ?? ''));

$instructor = trim((string) ($data['instructor'] ?? ($assign_speaker !== '' ? $assign_speaker : ($data['speaker'] ?? ''))));
$speaker = trim((string) ($data['speaker'] ?? ($assign_speaker !== '' ? $assign_speaker : $instructor)));
if ($assign_speaker === '') {
    $assign_speaker = $speaker ?: $instructor;
}

$attendee_type = trim((string) ($data['attendee_type'] ?? $data['attendee'] ?? 'Doctor'));
if (strcasecmp($attendee_type, 'patient') === 0) {
    $attendee_type = 'Patient';
} elseif (strcasecmp($attendee_type, 'doctor') === 0) {
    $attendee_type = 'Doctor';
} elseif (strcasecmp($attendee_type, 'both') === 0 || strcasecmp($attendee_type, 'all') === 0) {
    $attendee_type = 'Both';
}
$raw_date = trim((string) ($data['date'] ?? ''));
$date = date('Y-m-d');
if ($raw_date !== '' && $raw_date !== '0000-00-00') {
    $dcheck = DateTime::createFromFormat('Y-m-d', $raw_date);
    if ($dcheck && $dcheck->format('Y-m-d') === $raw_date) {
        $date = $raw_date;
    } else {
        $dcheck2 = DateTime::createFromFormat('d/m/Y', $raw_date);
        if (!$dcheck2) {
            $dcheck2 = DateTime::createFromFormat('d-m-Y', $raw_date);
        }
        if ($dcheck2) {
            $date = $dcheck2->format('Y-m-d');
        } else {
            $ts = strtotime($raw_date);
            if ($ts && $ts > 0) {
                $date = date('Y-m-d', $ts);
            }
        }
    }
}
$time = trim((string) ($data['time'] ?? '8:00 AM'));
$capacity = intval($data['capacity'] ?? 50);
$registrations = intval($data['registrations'] ?? $data['enrolled'] ?? 0);
$fee_raw = preg_replace('/[^\d.]/', '', (string) ($data['fee'] ?? $data['price'] ?? '0'));
$fee = floatval($fee_raw);
$about = trim((string) ($data['about'] ?? ''));
$location = trim((string) ($data['location'] ?? 'Ocayur Center Hall A'));
$status = ucfirst(strtolower(trim((string) ($data['status'] ?? 'Upcoming'))));

if ($title === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Workshop title/name is required.']);
    exit;
}

if (!in_array($status, ['Upcoming', 'Completed', 'Cancelled', 'Active', 'Past'], true)) {
    $status = 'Upcoming';
}

/* Image upload to Azure Blob Storage */
$imageFile = $_FILES['workshop_image'] ?? $_FILES['image'] ?? $_FILES['package_image'] ?? null;
if (!$imageFile || ($imageFile['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Please select a workshop image.']);
    exit;
}

try {
    $image_url = uploadWorkshopImageToAzure($imageFile);
} catch (Throwable $e) {
    error_log('add_workshop.php image upload error: ' . $e->getMessage());
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => $e->getMessage()]);
    exit;
}

// Check and auto-create table / columns if needed
$existing_columns = [];
$columns_res = @mysqli_query($connection1, "SHOW COLUMNS FROM workshops");
if ($columns_res) {
    while ($col = mysqli_fetch_assoc($columns_res)) {
        $existing_columns[] = strtolower($col['Field']);
    }
    mysqli_free_result($columns_res);
}
if (!empty($existing_columns)) {
    if (!in_array('subtitle', $existing_columns, true)) {
        if (@mysqli_query($connection1, "ALTER TABLE workshops ADD COLUMN `subtitle` VARCHAR(255) NULL AFTER `title`")) {
            $existing_columns[] = 'subtitle';
        }
    }
    if (!in_array('assign_speaker', $existing_columns, true)) {
        if (@mysqli_query($connection1, "ALTER TABLE workshops ADD COLUMN `assign_speaker` VARCHAR(150) NULL AFTER `speaker`")) {
            $existing_columns[] = 'assign_speaker';
        }
    }
    if (!in_array('meet_link', $existing_columns, true)) {
        if (@mysqli_query($connection1, "ALTER TABLE workshops ADD COLUMN `meet_link` VARCHAR(255) NULL AFTER `assign_speaker`")) {
            $existing_columns[] = 'meet_link';
        }
    }
    if (!in_array('image_url', $existing_columns, true)) {
        if (@mysqli_query($connection1, "ALTER TABLE workshops ADD COLUMN `image_url` VARCHAR(255) DEFAULT 'assets/package-thumb.jpg' AFTER `about`")) {
            $existing_columns[] = 'image_url';
        }
    }
}

// Generate Workshop ID (e.g. WS-001)
$new_ws_code = 'WS-001';
$max_res = mysqli_query($connection1, "SELECT MAX(id) as max_id FROM workshops");
if ($max_res && ($max_row = mysqli_fetch_assoc($max_res))) {
    $next_id = max(1, intval($max_row['max_id']) + 1);
    $new_ws_code = 'WS-' . str_pad((string) $next_id, 3, '0', STR_PAD_LEFT);
    mysqli_free_result($max_res);
}

// Check duplicate ID
$dupStmt = mysqli_prepare($connection1, 'SELECT id FROM workshops WHERE workshop_id = ? LIMIT 1');
if ($dupStmt) {
    mysqli_stmt_bind_param($dupStmt, 's', $new_ws_code);
    mysqli_stmt_execute($dupStmt);
    mysqli_stmt_store_result($dupStmt);
    if (mysqli_stmt_num_rows($dupStmt) > 0) {
        $new_ws_code = 'WS-' . str_pad((string) (time() % 10000), 4, '0', STR_PAD_LEFT);
    }
    mysqli_stmt_close($dupStmt);
}

// Build dynamic INSERT query based on existing/added columns
$insert_cols = ['workshop_id', 'title', 'instructor', 'speaker', 'attendee_type', 'date', 'time', 'location', 'capacity', 'enrolled', 'registrations', 'price', 'fee', 'about', 'image_url', 'status'];
$insert_vals = [$new_ws_code, $title, $instructor, $speaker, $attendee_type, $date, $time, $location, $capacity, $registrations, $registrations, $fee, $fee, $about, $image_url, $status];
$types = 'ssssssssiiiddsss';

if (!empty($existing_columns)) {
    if (in_array('subtitle', $existing_columns, true)) {
        $insert_cols[] = 'subtitle';
        $insert_vals[] = $subtitle;
        $types .= 's';
    }
    if (in_array('assign_speaker', $existing_columns, true)) {
        $insert_cols[] = 'assign_speaker';
        $insert_vals[] = $assign_speaker;
        $types .= 's';
    }
    if (in_array('meet_link', $existing_columns, true)) {
        $insert_cols[] = 'meet_link';
        $insert_vals[] = $meet_link;
        $types .= 's';
    }
} else {
    $insert_cols[] = 'subtitle';
    $insert_vals[] = $subtitle;
    $types .= 's';

    $insert_cols[] = 'assign_speaker';
    $insert_vals[] = $assign_speaker;
    $types .= 's';

    $insert_cols[] = 'meet_link';
    $insert_vals[] = $meet_link;
    $types .= 's';
}

$placeholders = implode(', ', array_fill(0, count($insert_cols), '?'));
$sql = "INSERT INTO workshops (" . implode(', ', array_map(function($c) { return "`$c`"; }, $insert_cols)) . ") VALUES ($placeholders)";

$stmt = mysqli_prepare($connection1, $sql);
if (!$stmt) {
    error_log('add_workshop.php prepare failed: ' . mysqli_error($connection1));
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to prepare workshop insert query.']);
    exit;
}

mysqli_stmt_bind_param($stmt, $types, ...$insert_vals);

if (mysqli_stmt_execute($stmt)) {
    $insert_id = mysqli_insert_id($connection1);
    mysqli_stmt_close($stmt);

    echo json_encode([
        'status' => '1',
        'message' => 'Workshop created successfully.',
        'data' => [
            'id' => $insert_id,
            'workshop_id' => $new_ws_code,
            'title' => $title,
            'subtitle' => $subtitle,
            'assign_speaker' => $assign_speaker,
            'meet_link' => $meet_link,
            'date' => $date,
            'time' => $time,
            'attendee_type' => $attendee_type,
            'attendee' => $attendee_type,
            'audience' => $attendee_type,
            'is_visible_to_doctor' => (strcasecmp($attendee_type, 'Doctor') === 0 || strcasecmp($attendee_type, 'Both') === 0 || strcasecmp($attendee_type, 'All') === 0),
            'is_visible_to_patient' => (strcasecmp($attendee_type, 'Patient') === 0 || strcasecmp($attendee_type, 'Both') === 0 || strcasecmp($attendee_type, 'All') === 0),
            'registrations' => $registrations,
            'fee' => $fee,
            'image_url' => $image_url,
            'status' => $status
        ]
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    error_log('add_workshop.php insert failed: ' . $err);
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to create workshop.']);
}

