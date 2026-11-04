<?php
/**
 * Panchved Admin - Get Single Patient Details API
 * GET: /api/get_patient.php?id=1 or ?patient_id=E001
 * Returns complete patient profile, activity timing, and consultation history
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Convert PHP warnings and notices to ErrorException so they don't corrupt JSON output
set_error_handler(function($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity)) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

try {
    require_once __DIR__ . '/db_connect.php';

    global $connection1;
    $connection1 = $GLOBALS['connection1'] ?? $connection1;

    if (!isset($connection1) || !$connection1) {
        throw new mysqli_sql_exception('Database connection unavailable.');
    }

    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    $id = intval($_GET['id'] ?? 0);
    $patient_id = trim((string) ($_GET['patient_id'] ?? ''));

    if ($id <= 0 && $patient_id === '') {
        http_response_code(400);
        echo json_encode([
            'status' => '0',
            'success' => false,
            'message' => 'Valid patient id or patient_id is required.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $patient = null;
    if ($id > 0) {
        $stmt = mysqli_prepare($connection1, "SELECT * FROM patients WHERE id = ? LIMIT 1");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 'i', $id);
            mysqli_stmt_execute($stmt);
            $res = mysqli_stmt_get_result($stmt);
            if ($res && $row = mysqli_fetch_assoc($res)) {
                $patient = $row;
            }
            mysqli_stmt_close($stmt);
        }
    } else {
        $stmt = mysqli_prepare($connection1, "SELECT * FROM patients WHERE patient_id = ? LIMIT 1");
        if ($stmt) {
            mysqli_stmt_bind_param($stmt, 's', $patient_id);
            mysqli_stmt_execute($stmt);
            $res = mysqli_stmt_get_result($stmt);
            if ($res && $row = mysqli_fetch_assoc($res)) {
                $patient = $row;
            }
            mysqli_stmt_close($stmt);
        }
    }

    if (!$patient) {
        http_response_code(404);
        echo json_encode([
            'status' => '0',
            'success' => false,
            'message' => 'Patient record not found.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $ptDbId = (int)$patient['id'];
    $ptCode = $patient['patient_id'] ?? ('P' . str_pad($ptDbId, 3, '0', STR_PAD_LEFT));
    $ptName = trim($patient['full_name'] ?? '');
    $ptPhone = trim($patient['phone_number'] ?? '');
    $ptEmail = trim($patient['email'] ?? '');

    // Auto compute age if empty
    if ((empty($patient['age']) || $patient['age'] == 0) && !empty($patient['dob'])) {
        $dob = new DateTime($patient['dob']);
        $now = new DateTime();
        $patient['age'] = $now->diff($dob)->y;
    }

    // Format dates
    $patient['created_at_formatted'] = !empty($patient['created_at']) ? date('d M Y', strtotime($patient['created_at'])) : '-';
    $patient['updated_at_formatted'] = !empty($patient['updated_at']) ? date('d M Y, h:i A', strtotime($patient['updated_at'])) : ($patient['created_at_formatted'] ?? '-');
    $patient['dob_formatted'] = !empty($patient['dob']) ? date('d M Y', strtotime($patient['dob'])) : '-';

    // Retrieve last login from login_logs if table exists
    $lastLoginTime = null;
    $chkLogs = @mysqli_query($connection1, "SHOW TABLES LIKE 'login_logs'");
    if ($chkLogs && mysqli_num_rows($chkLogs) > 0) {
        $lStmt = @mysqli_prepare($connection1, "SELECT login_time FROM `login_logs` WHERE user_type = 'Patient' AND (user_id = ? OR identifier = ? OR phone = ?) ORDER BY login_time DESC LIMIT 1");
        if ($lStmt) {
            mysqli_stmt_bind_param($lStmt, "iss", $ptDbId, $ptCode, $ptPhone);
            mysqli_stmt_execute($lStmt);
            $lRes = mysqli_stmt_get_result($lStmt);
            if ($lRes && $lRow = mysqli_fetch_assoc($lRes)) {
                $lastLoginTime = $lRow['login_time'];
            }
            mysqli_stmt_close($lStmt);
        }
    }
    if (!$lastLoginTime && !empty($patient['last_login'])) {
        $lastLoginTime = $patient['last_login'];
    }
    $patient['last_login'] = $lastLoginTime;
    $patient['last_login_formatted'] = $lastLoginTime ? date('d M Y, h:i A', strtotime($lastLoginTime)) : 'Never';

    // Resolve Prakruti Parikshan individual fields & human-readable labels
    $prakrutiLabelsMap = [
        'appetite' => [
            'irregular' => 'Irregular (Sometimes hungry, sometimes not)',
            'strong'    => 'Strong & Regular (Hungry on time)',
            'mild'      => 'Mild / Moderate (Can skip meals easily)'
        ],
        'sleep_type' => [
            'light'    => 'Light, Interrupted (Difficulty falling asleep)',
            'moderate' => 'Moderate (Wakes due to heat or thoughts)',
            'deep'     => 'Deep, Long (Difficulty waking up)'
        ],
        'skin_type' => [
            'dry_rough'      => 'Dry, Rough, Thin',
            'warm_sensitive' => 'Warm, Sensitive, Reddish / Prone to rashes',
            'soft_smooth'    => 'Soft, Smooth, Thick, Moist'
        ],
        'hair_type' => [
            'dry_frizzy'  => 'Dry, Rough, Frizzy',
            'fine_soft'   => 'Fine, Soft (Early greying / thinning)',
            'thick_dense' => 'Thick, Dense, Smooth & Oily'
        ],
        'bowel_movement' => [
            'irregular_constipation' => 'Irregular, Constipation (Hard / dry stool)',
            'regular_frequent'       => 'Regular, Frequent (Soft or loose stool, urgency)',
            'slow_heavy'             => 'Slow, Regular, Heavy or sticky'
        ],
        'stress_response' => [
            'worry_anxiety'       => 'Worry, Anxiety, Overthinking',
            'irritability_anger'  => 'Irritability, Anger, Impatience',
            'withdrawal_sluggish' => 'Withdrawal, Emotional Heaviness, Sluggishness'
        ],
        'body_temperature' => [
            'feels_cold'  => 'Cold Sensibility (Cold hands and feet)',
            'feels_hot'   => 'Heat Sensitivity (Dislikes heat, sweats easily)',
            'cool_stable' => 'Cool & Stable (Tolerates weather changes)'
        ],
        'physical_activity' => [
            'quick_irregular' => 'Quick, Irregular (Variety seeker, tires quickly)',
            'active_intense'  => 'Active, Intense, Competitive',
            'slow_steady'     => 'Slow, Steady (High stamina, calm pace)'
        ]
    ];

    $pData = [];
    if (!empty($patient['prakruti_data'])) {
        $decoded = json_decode($patient['prakruti_data'], true);
        if (is_array($decoded)) {
            $pData = $decoded;
        }
    }

    $rawAppetite   = $patient['appetite'] ?? ($pData['appetite'] ?? 'irregular');
    $rawSleep      = $patient['sleep_type'] ?? ($pData['sleep_type'] ?? 'moderate');
    $rawSkin       = $patient['skin_type'] ?? ($pData['skin_type'] ?? 'warm_sensitive');
    $rawHair       = $patient['hair_type'] ?? ($pData['hair_type'] ?? 'fine_soft');
    $rawBowel      = $patient['bowel_movement'] ?? ($pData['bowel_movement'] ?? 'regular_frequent');
    $rawStress     = $patient['stress_response'] ?? ($pData['stress_response'] ?? 'irritability_anger');
    $rawTemp       = $patient['body_temperature'] ?? ($pData['body_temperature'] ?? 'feels_hot');
    $rawActivity   = $patient['physical_activity'] ?? ($pData['physical_activity'] ?? 'active_intense');
    $rawProfile    = $patient['patient_profile'] ?? ($pData['profile_type'] ?? ($patient['prakruti'] ?? 'Vata-Pitta Prakruti'));

    $patient['prakruti'] = $rawProfile;
    $patient['prakruti_parikshan'] = [
        'profile_type'            => $rawProfile,
        'appetite'                => $rawAppetite,
        'appetite_label'          => $prakrutiLabelsMap['appetite'][$rawAppetite] ?? ucfirst(str_replace('_', ' ', $rawAppetite)),
        'sleep_type'              => $rawSleep,
        'sleep_type_label'        => $prakrutiLabelsMap['sleep_type'][$rawSleep] ?? ucfirst(str_replace('_', ' ', $rawSleep)),
        'skin_type'               => $rawSkin,
        'skin_type_label'         => $prakrutiLabelsMap['skin_type'][$rawSkin] ?? ucfirst(str_replace('_', ' ', $rawSkin)),
        'hair_type'               => $rawHair,
        'hair_type_label'         => $prakrutiLabelsMap['hair_type'][$rawHair] ?? ucfirst(str_replace('_', ' ', $rawHair)),
        'bowel_movement'          => $rawBowel,
        'bowel_movement_label'    => $prakrutiLabelsMap['bowel_movement'][$rawBowel] ?? ucfirst(str_replace('_', ' ', $rawBowel)),
        'stress_response'         => $rawStress,
        'stress_response_label'   => $prakrutiLabelsMap['stress_response'][$rawStress] ?? ucfirst(str_replace('_', ' ', $rawStress)),
        'body_temperature'        => $rawTemp,
        'body_temperature_label'  => $prakrutiLabelsMap['body_temperature'][$rawTemp] ?? ucfirst(str_replace('_', ' ', $rawTemp)),
        'physical_activity'       => $rawActivity,
        'physical_activity_label' => $prakrutiLabelsMap['physical_activity'][$rawActivity] ?? ucfirst(str_replace('_', ' ', $rawActivity))
    ];

    // Fetch consultations history from appointments table
    $appointments = [];
    $aStmt = @mysqli_prepare($connection1, "SELECT * FROM `appointments` WHERE `patient_id` = ? OR `patient_id` = ? OR `patient_name` = ? ORDER BY `appointment_date` DESC, `id` DESC");
    if ($aStmt) {
        mysqli_stmt_bind_param($aStmt, "iss", $ptDbId, $ptCode, $ptName);
        mysqli_stmt_execute($aStmt);
        $aRes = mysqli_stmt_get_result($aStmt);
        if ($aRes) {
            while ($aRow = mysqli_fetch_assoc($aRes)) {
                $formattedDate = !empty($aRow['appointment_date']) ? date('d M Y', strtotime($aRow['appointment_date'])) : '-';
                $rxRaw = trim((string)($aRow['prescription'] ?? ''));
                $hasRx = (!empty($rxRaw) && $rxRaw !== 'null' && $rxRaw !== '{}' && $rxRaw !== '[]');

                $appointments[] = [
                    'id' => (int)$aRow['id'],
                    'appointment_id' => $aRow['appointment_id'] ?: ('APT-' . str_pad($aRow['id'], 3, '0', STR_PAD_LEFT)),
                    'doctor_id' => $aRow['doctor_id'] ?? null,
                    'doctor_name' => $aRow['doctor_name'] ?: 'Doctor',
                    'appointment_date' => $aRow['appointment_date'] ?? '',
                    'date_formatted' => $formattedDate,
                    'appointment_time' => $aRow['appointment_time'] ?: '-',
                    'duration' => $aRow['duration'] ?: '45 mins',
                    'package_name' => $aRow['package_name'] ?: ($patient['package_name'] ?: 'Ayurvedic Programme'),
                    'agenda' => $aRow['agenda'] ?: ($aRow['complaint'] ?: 'Ayurvedic consultation'),
                    'complaint' => $aRow['complaint'] ?: ($aRow['agenda'] ?: 'Ayurvedic consultation'),
                    'service_type' => $aRow['service_type'] ?: 'Consultation',
                    'status' => ucfirst(strtolower($aRow['status'] ?: 'Scheduled')),
                    'meet_link' => $aRow['meet_link'] ?? '',
                    'has_prescription' => $hasRx
                ];
            }
        }
        mysqli_stmt_close($aStmt);
    }

    $patient['appointments'] = $appointments;
    $patient['total_appointments'] = count($appointments) > 0 ? count($appointments) : intval($patient['total_appointments'] ?? 0);

    echo json_encode([
        'status' => '1',
        'success' => true,
        'message' => 'Patient details fetched successfully.',
        'data' => $patient
    ], JSON_UNESCAPED_UNICODE);

} catch (mysqli_sql_exception $e) {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'success' => false,
        'message' => 'Database error: ' . $e->getMessage(),
        'error_type' => 'mysqli_sql_exception',
        'error_code' => $e->getCode(),
        'sqlstate' => $e->getSqlState(),
        'error_details' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
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
