<?php
/**
 * Panchved Admin - Get Single Workshop Details API
 * GET: /api/get_workshop.php?id=1 or ?workshop_id=WS-001
 */

require_once __DIR__ . '/database.php';

$raw_id = trim((string) ($_GET['id'] ?? ''));
$workshop_id = trim((string) ($_GET['workshop_id'] ?? ''));

if ($workshop_id === '' && !is_numeric($raw_id) && $raw_id !== '') {
    $workshop_id = $raw_id;
}
$id = is_numeric($raw_id) ? intval($raw_id) : 0;

if ($id <= 0 && $workshop_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Workshop id or workshop_id is required.']);
    exit;
}

$workshop = null;

if ($connection1) {
    if ($id > 0) {
        $stmt = mysqli_prepare($connection1, "SELECT * FROM workshops WHERE id = ? LIMIT 1");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 'i', $id);
            mysqli_stmt_execute($stmt);
            $res = mysqli_stmt_get_result($stmt);
            if ($res && $row = mysqli_fetch_assoc($res)) {
                $workshop = $row;
            }
            mysqli_stmt_close($stmt);
        }
    }
    if (!$workshop && $workshop_id !== '') {
        $stmt = mysqli_prepare($connection1, "SELECT * FROM workshops WHERE workshop_id = ? LIMIT 1");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 's', $workshop_id);
            mysqli_stmt_execute($stmt);
            $res = mysqli_stmt_get_result($stmt);
            if ($res && $row = mysqli_fetch_assoc($res)) {
                $workshop = $row;
            }
            mysqli_stmt_close($stmt);
        }
    }
}

if (!$workshop) {
    http_response_code(404);
    echo json_encode(['status' => '0', 'message' => 'Workshop not found.']);
    exit;
}

$date_raw = trim((string)($workshop['date'] ?? ''));
$valid_date = '';

if ($date_raw !== '' && $date_raw !== '0000-00-00' && strpos($date_raw, '0000-00-00') !== 0) {
    $ts = strtotime($date_raw);
    if ($ts !== false && $ts > 0 && (int)date('Y', $ts) > 1970) {
        $valid_date = date('Y-m-d', $ts);
    } else {
        $dcheck = DateTime::createFromFormat('Y-m-d', $date_raw);
        if ($dcheck && (int)$dcheck->format('Y') > 1970) {
            $valid_date = $dcheck->format('Y-m-d');
        } else {
            $dcheck2 = DateTime::createFromFormat('d/m/Y', $date_raw);
            if ($dcheck2 && (int)$dcheck2->format('Y') > 1970) {
                $valid_date = $dcheck2->format('Y-m-d');
            }
        }
    }
} elseif (!empty($workshop['created_at']) && strpos($workshop['created_at'], '0000-00-00') !== 0) {
    $ts = strtotime($workshop['created_at']);
    if ($ts !== false && $ts > 0 && (int)date('Y', $ts) > 1970) {
        $valid_date = date('Y-m-d', $ts);
    }
}

if ($valid_date !== '') {
    $workshop['date'] = $valid_date;
    $workshop['formatted_date'] = date('j M Y', strtotime($valid_date));
    $workshop['form_date'] = $valid_date;
} else {
    $workshop['formatted_date'] = $date_raw;
    $workshop['form_date'] = $date_raw;
}

if (!isset($workshop['subtitle']) || $workshop['subtitle'] === null) {
    $workshop['subtitle'] = '';
}
if (!isset($workshop['workshop_subtitle']) || $workshop['workshop_subtitle'] === null) {
    $workshop['workshop_subtitle'] = $workshop['subtitle'];
}
if (empty($workshop['assign_speaker'])) {
    $workshop['assign_speaker'] = $workshop['speaker'] ?? ($workshop['instructor'] ?? '');
}
if (!isset($workshop['meet_link']) || $workshop['meet_link'] === null) {
    $workshop['meet_link'] = '';
}

if (empty($workshop['attendee_type'])) {
    $workshop['attendee_type'] = 'Doctor';
}
$workshop['attendee'] = $workshop['attendee_type'];
$is_both = (strcasecmp($workshop['attendee_type'], 'Both') === 0 || strcasecmp($workshop['attendee_type'], 'All') === 0);
$workshop['is_visible_to_doctor'] = ($is_both || stripos($workshop['attendee_type'], 'Doctor') !== false);
$workshop['is_visible_to_patient'] = ($is_both || stripos($workshop['attendee_type'], 'Patient') !== false);
$workshop['audience'] = $workshop['attendee_type'];

if (!isset($workshop['registrations']) || $workshop['registrations'] === null) {
    $workshop['registrations'] = $workshop['enrolled'] ?? 0;
}
if (!isset($workshop['fee']) || $workshop['fee'] === null) {
    $workshop['fee'] = $workshop['price'] ?? 0;
}

echo json_encode([
    'status' => '1',
    'message' => 'Workshop details fetched successfully.',
    'data' => $workshop
]);
