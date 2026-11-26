<?php
/**
 * Panchved Admin - Get Workshops List API
 * GET/POST: /api/get_workshops.php
 *
 * Parameters:
 * - search (string)
 * - status (string: 'Upcoming', 'Completed', 'Past', 'Active', 'all')
 * - page (int, default 1)
 * - limit (int, default 5)
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

$search = trim((string) ($_GET['search'] ?? $body_data['search'] ?? ''));
$status = trim((string) ($_GET['status'] ?? $body_data['status'] ?? ''));
$attendee = trim((string) ($_GET['attendee'] ?? $_GET['attendee_type'] ?? $_GET['audience'] ?? $body_data['attendee'] ?? $body_data['attendee_type'] ?? $body_data['audience'] ?? ''));
$role = trim((string) ($_GET['role'] ?? $_GET['portal'] ?? $_GET['user_type'] ?? $body_data['role'] ?? $body_data['portal'] ?? $body_data['user_type'] ?? ''));
if ($attendee === '' && $role !== '') {
    if (strcasecmp($role, 'doctor') === 0 || strcasecmp($role, 'doctor_portal') === 0 || stripos($role, 'doc') !== false) {
        $attendee = 'Doctor';
    } elseif (strcasecmp($role, 'patient') === 0 || strcasecmp($role, 'patient_portal') === 0 || stripos($role, 'pat') !== false) {
        $attendee = 'Patient';
    } elseif (strcasecmp($role, 'both') === 0 || strcasecmp($role, 'all') === 0) {
        $attendee = 'Both';
    }
}
$page = max(1, intval($_GET['page'] ?? $body_data['page'] ?? 1));
$limit = max(1, intval($_GET['limit'] ?? $body_data['limit'] ?? 5));
$offset = ($page - 1) * $limit;

// Stats: Total, Upcoming, Past
$stat_total = 0;
$stat_upcoming = 0;
$stat_past = 0;

if ($connection1) {
    $stat_filter = '';
    if ($attendee !== '' && strtolower($attendee) !== 'all') {
        if (strcasecmp($attendee, 'both') === 0) {
            $stat_filter = " WHERE (attendee_type = 'Both' OR attendee_type = 'All')";
        } elseif (strcasecmp($attendee, 'doctor') === 0 || stripos($attendee, 'doc') !== false) {
            $stat_filter = " WHERE (attendee_type = 'Doctor' OR attendee_type = 'Both' OR attendee_type = 'All' OR attendee_type LIKE '%Doctor%')";
        } elseif (strcasecmp($attendee, 'patient') === 0 || stripos($attendee, 'pat') !== false) {
            $stat_filter = " WHERE (attendee_type = 'Patient' OR attendee_type = 'Both' OR attendee_type = 'All' OR attendee_type LIKE '%Patient%')";
        }
    }

    // 1. Total Workshops
    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM workshops" . ($stat_filter ? $stat_filter : ''));
    if ($res && $row = mysqli_fetch_assoc($res)) {
        $stat_total = (int)$row['total'];
    }

    // 2. Upcoming Workshops
    $upcoming_clause = "status = 'Upcoming' OR (status NOT IN ('Completed', 'Past', 'Cancelled') AND date >= CURDATE())";
    $upcoming_where = $stat_filter ? ($stat_filter . " AND (" . $upcoming_clause . ")") : (" WHERE " . $upcoming_clause);
    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM workshops" . $upcoming_where);
    if ($res && $row = mysqli_fetch_assoc($res)) {
        $stat_upcoming = (int)$row['total'];
    }

    // 3. Past / Completed Workshops
    $past_clause = "status IN ('Completed', 'Past') OR (status NOT IN ('Upcoming') AND date < CURDATE())";
    $past_where = $stat_filter ? ($stat_filter . " AND (" . $past_clause . ")") : (" WHERE " . $past_clause);
    $res = @mysqli_query($connection1, "SELECT COUNT(*) as total FROM workshops" . $past_where);
    if ($res && $row = mysqli_fetch_assoc($res)) {
        $stat_past = (int)$row['total'];
    }
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
        }
        if (!in_array('assign_speaker', $existing_columns)) {
            @mysqli_query($connection1, "ALTER TABLE workshops ADD COLUMN `assign_speaker` VARCHAR(150) NULL AFTER `speaker`");
        }
        if (!in_array('meet_link', $existing_columns)) {
            @mysqli_query($connection1, "ALTER TABLE workshops ADD COLUMN `meet_link` VARCHAR(255) NULL AFTER `assign_speaker`");
        }
    }
}

$where_clauses = [];
$params = [];
$types = '';

if ($search !== '') {
    $where_clauses[] = "(
        title LIKE ? OR
        workshop_id LIKE ? OR
        instructor LIKE ? OR
        speaker LIKE ? OR
        assign_speaker LIKE ? OR
        subtitle LIKE ? OR
        attendee_type LIKE ?
    )";
    $search_param = '%' . $search . '%';
    for ($i = 0; $i < 7; $i++) {
        $params[] = $search_param;
        $types .= 's';
    }
}

if ($status !== '' && strtolower($status) !== 'all') {
    if (strpos($status, ',') !== false) {
        $statuses = array_map('trim', explode(',', $status));
        $placeholders = implode(',', array_fill(0, count($statuses), '?'));
        $where_clauses[] = "status IN ($placeholders)";
        foreach ($statuses as $st) {
            $params[] = $st;
            $types .= 's';
        }
    } else {
        $where_clauses[] = "status = ?";
        $params[] = $status;
        $types .= 's';
    }
}

if ($attendee !== '' && strtolower($attendee) !== 'all') {
    if (strcasecmp($attendee, 'both') === 0) {
        $where_clauses[] = "(attendee_type = 'Both' OR attendee_type = 'All')";
    } elseif (strcasecmp($attendee, 'doctor') === 0) {
        $where_clauses[] = "(attendee_type = 'Doctor' OR attendee_type = 'Both' OR attendee_type = 'All' OR attendee_type LIKE '%Doctor%')";
    } elseif (strcasecmp($attendee, 'patient') === 0) {
        $where_clauses[] = "(attendee_type = 'Patient' OR attendee_type = 'Both' OR attendee_type = 'All' OR attendee_type LIKE '%Patient%')";
    } else {
        $where_clauses[] = "(attendee_type = ? OR attendee_type = 'Both' OR attendee_type = 'All' OR attendee_type LIKE ?)";
        $params[] = $attendee;
        $params[] = '%' . $attendee . '%';
        $types .= 'ss';
    }
}

$where_sql = '';
if (!empty($where_clauses)) {
    $where_sql = ' WHERE ' . implode(' AND ', $where_clauses);
}

// Count filtered
$count_sql = "SELECT COUNT(*) as total FROM workshops" . $where_sql;
$count_stmt = mysqli_prepare($connection1, $count_sql);
$total_records = 0;

if ($count_stmt) {
    if (!empty($params)) {
        mysqli_stmt_bind_param($count_stmt, $types, ...$params);
    }
    mysqli_stmt_execute($count_stmt);
    $count_result = mysqli_stmt_get_result($count_stmt);
    if ($count_result && $row = mysqli_fetch_assoc($count_result)) {
        $total_records = intval($row['total']);
    }
    mysqli_stmt_close($count_stmt);
}

$total_pages = $total_records > 0 ? (int) ceil($total_records / $limit) : 1;

// Fetch workshops
$data_sql = "
    SELECT 
        id,
        workshop_id,
        title,
        subtitle,
        instructor,
        speaker,
        assign_speaker,
        meet_link,
        attendee_type,
        date,
        time,
        location,
        capacity,
        enrolled,
        registrations,
        price,
        fee,
        about,
        image_url,
        status,
        created_at
    FROM workshops
    " . $where_sql . "
    ORDER BY id DESC
    LIMIT ?, ?
";

$stmt = mysqli_prepare($connection1, $data_sql);
$workshops = [];

if ($stmt) {
    $fetch_params = $params;
    $fetch_params[] = $offset;
    $fetch_params[] = $limit;
    $fetch_types = $types . 'ii';

    mysqli_stmt_bind_param($stmt, $fetch_types, ...$fetch_params);
    mysqli_stmt_execute($stmt);
    $result = mysqli_stmt_get_result($stmt);

    if ($result) {
        while ($row = mysqli_fetch_assoc($result)) {
            $date_raw = trim((string)($row['date'] ?? ''));
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
            } elseif (!empty($row['created_at']) && strpos($row['created_at'], '0000-00-00') !== 0) {
                $ts = strtotime($row['created_at']);
                if ($ts !== false && $ts > 0 && (int)date('Y', $ts) > 1970) {
                    $valid_date = date('Y-m-d', $ts);
                }
            }

            if ($valid_date !== '') {
                $row['date'] = $valid_date;
                $row['formatted_date'] = date('j M Y', strtotime($valid_date));
                $row['form_date'] = $valid_date;
            } else {
                $row['formatted_date'] = $date_raw;
                $row['form_date'] = $date_raw;
            }
            
            if (!isset($row['subtitle']) || $row['subtitle'] === null) {
                $row['subtitle'] = '';
            }
            if (!isset($row['workshop_subtitle']) || $row['workshop_subtitle'] === null) {
                $row['workshop_subtitle'] = $row['subtitle'];
            }
            if (empty($row['assign_speaker'])) {
                $row['assign_speaker'] = $row['speaker'] ?? ($row['instructor'] ?? '');
            }
            if (!isset($row['meet_link']) || $row['meet_link'] === null) {
                $row['meet_link'] = '';
            }

            if (empty($row['attendee_type'])) {
                $row['attendee_type'] = 'Doctor';
            }
            $row['attendee'] = $row['attendee_type'];
            $is_both = (strcasecmp($row['attendee_type'], 'Both') === 0 || strcasecmp($row['attendee_type'], 'All') === 0);
            $row['is_visible_to_doctor'] = ($is_both || stripos($row['attendee_type'], 'Doctor') !== false);
            $row['is_visible_to_patient'] = ($is_both || stripos($row['attendee_type'], 'Patient') !== false);
            $row['audience'] = $row['attendee_type'];

            if (!isset($row['registrations']) || $row['registrations'] === null) {
                $row['registrations'] = $row['enrolled'] ?? 0;
            }
            if (!isset($row['fee']) || $row['fee'] === null) {
                $row['fee'] = $row['price'] ?? 0;
            }
            $workshops[] = $row;
        }
    }
    mysqli_stmt_close($stmt);
}

echo json_encode([
    'status' => '1',
    'message' => 'Workshops fetched successfully.',
    'stats' => [
        'total_workshops' => $stat_total,
        'upcoming_workshops' => $stat_upcoming,
        'past_workshops' => $stat_past
    ],
    'total_records' => $total_records,
    'total_pages' => $total_pages,
    'current_page' => $page,
    'limit' => $limit,
    'data' => $workshops
]);

