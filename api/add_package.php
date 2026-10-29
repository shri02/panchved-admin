<?php
/**
 * Panchved Admin - Add Package API
 * POST: /api/add_package.php
 *
 * Accepts multipart/form-data:
 * - package_image: required JPG, PNG, or WebP file (max 5 MB)
 * - package fields: package_name, category, assigned_doctor_1,
 *   assigned_doctor_2, duration, price, descriptions, status, etc.
 *
 * The image is uploaded to Azure Blob Storage. Its URL is saved in packages.image_url.
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
    error_log('add_package.php: database connection $connection1 is unavailable.');
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Database connection is unavailable.']);
    exit;
}

mysqli_set_charset($connection1, 'utf8mb4');

/*
 * New frontend submits FormData, which PHP exposes through $_POST and $_FILES.
 * Keep JSON fallback for older clients that do not upload an image.
 */
$data = $_POST;
if (empty($data)) {
    $rawData = file_get_contents('php://input');
    if ($rawData !== false && trim($rawData) !== '') {
        $jsonData = json_decode($rawData, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($jsonData)) {
            $data = $jsonData;
        }
    }
}

$package_name = trim((string)($data['package_name'] ?? $data['name'] ?? $data['addPkgName'] ?? ''));
$category = trim((string)($data['category'] ?? $data['addPkgCategory'] ?? 'General'));

$assigned_doctor_1 = trim((string)(
    $data['assigned_doctor_1'] ??
    $data['assign_doctor_1'] ??
    $data['addPkgDoctor1'] ??
    ''
));
$assigned_doctor_2 = trim((string)(
    $data['assigned_doctor_2'] ??
    $data['assign_doctor_2'] ??
    $data['addPkgDoctor2'] ??
    $data['doctor_2'] ??
    ''
));

if ($assigned_doctor_1 === '') {
    $rawDoctor = trim((string)(
        $data['assigned_doctor'] ??
        $data['assign_doctor'] ??
        $data['addPkgDoctor'] ??
        $data['doctor'] ??
        ''
    ));

    if ($rawDoctor !== '') {
        if (strpos($rawDoctor, ',') !== false) {
            $parts = array_map('trim', explode(',', $rawDoctor, 2));
            $assigned_doctor_1 = $parts[0];
            if ($assigned_doctor_2 === '') {
                $assigned_doctor_2 = $parts[1] ?? '';
            }
        } else {
            $assigned_doctor_1 = $rawDoctor;
        }
    }
}

$duration = trim((string)($data['duration'] ?? $data['addPkgDuration'] ?? '1 Month'));
if ($duration === '') {
    $duration = '1 Month';
}

$priceRaw = trim((string)($data['price'] ?? $data['addPkgPrice'] ?? '0'));
if ($priceRaw === '' || !preg_match('/^\d+(?:\.\d{1,2})?$/', $priceRaw)) {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Enter a valid price, e.g. 1500 or 1500.00.']);
    exit;
}
$price = (float)$priceRaw;

$short_description = trim((string)($data['short_description'] ?? $data['addPkgShortDesc'] ?? ''));
$overview = trim((string)($data['overview'] ?? $data['addPkgOverview'] ?? ''));
$benefits = trim((string)($data['benefits'] ?? $data['addPkgBenefits'] ?? ''));
$included = trim((string)($data['included'] ?? $data['addPkgIncluded'] ?? ''));
$diet_hydration = trim((string)($data['diet_hydration'] ?? $data['addDietHydration'] ?? ''));
$yoga_physio = trim((string)($data['yoga_physio'] ?? $data['addYogaPhysio'] ?? ''));
$ayurveda_dinacharya = trim((string)($data['ayurveda_dinacharya'] ?? $data['addAyurvedaDinacharya'] ?? ''));
$daily_activity = trim((string)($data['daily_activity'] ?? $data['addDailyActivity'] ?? ''));
$patient_monitoring = trim((string)($data['patient_monitoring'] ?? $data['addPatientMonitoring'] ?? ''));
$followup_review = trim((string)($data['followup_review'] ?? $data['addFollowupReview'] ?? ''));
$status = ucfirst(strtolower(trim((string)($data['status'] ?? 'Active'))));

if ($package_name === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Package name is required.']);
    exit;
}

if (!in_array($status, ['Active', 'Inactive'], true)) {
    $status = 'Active';
}

/* Image is required for new packages. */
if (!isset($_FILES['package_image']) || ($_FILES['package_image']['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Please select a package image.']);
    exit;
}

try {
    $image_url = uploadPackageImageToAzure($_FILES['package_image']);
} catch (Throwable $e) {
    error_log('add_package.php image upload error: ' . $e->getMessage());
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => $e->getMessage()]);
    exit;
}

/*
 * Detect the doctor column names already present in the packages table.
 * This keeps compatibility with the column names used by the existing database.
 */
$existingCols = [];
$colRes = mysqli_query($connection1, 'SHOW COLUMNS FROM packages');
if (!$colRes) {
    error_log('add_package.php could not inspect packages columns: ' . mysqli_error($connection1));
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Unable to inspect packages table.']);
    exit;
}
while ($colRow = mysqli_fetch_assoc($colRes)) {
    $existingCols[] = $colRow['Field'];
}
mysqli_free_result($colRes);

/* Add the expected doctor columns if neither legacy nor current names exist. */
if (!in_array('assigned_doctor', $existingCols, true) && !in_array('assign_doctor', $existingCols, true)
    && !in_array('assigned_doctor_one', $existingCols, true) && !in_array('assigned_doctor_1', $existingCols, true)) {
    if (!mysqli_query($connection1, "ALTER TABLE packages ADD COLUMN `assigned_doctor` VARCHAR(150) NULL DEFAULT NULL AFTER `category`")) {
        error_log('Could not add assigned_doctor column: ' . mysqli_error($connection1));
    } else {
        $existingCols[] = 'assigned_doctor';
    }
}
if (!in_array('assigned_doctor_2', $existingCols, true)
    && !in_array('assign_doctor_2', $existingCols, true)
    && !in_array('assign_doctor_two', $existingCols, true)
    && !in_array('assigned_doctor_two', $existingCols, true)) {
    if (!mysqli_query($connection1, "ALTER TABLE packages ADD COLUMN `assigned_doctor_2` VARCHAR(150) NULL DEFAULT NULL AFTER `assigned_doctor`")) {
        error_log('Could not add assigned_doctor_2 column: ' . mysqli_error($connection1));
    } else {
        $existingCols[] = 'assigned_doctor_2';
    }
}

$docCol1 = in_array('assigned_doctor_one', $existingCols, true) ? 'assigned_doctor_one'
    : (in_array('assigned_doctor_1', $existingCols, true) ? 'assigned_doctor_1'
    : (in_array('assigned_doctor', $existingCols, true) ? 'assigned_doctor'
    : (in_array('assign_doctor', $existingCols, true) ? 'assign_doctor' : 'assigned_doctor')));

$docCol2 = in_array('assign_doctor_two', $existingCols, true) ? 'assign_doctor_two'
    : (in_array('assigned_doctor_two', $existingCols, true) ? 'assigned_doctor_two'
    : (in_array('assigned_doctor_2', $existingCols, true) ? 'assigned_doctor_2'
    : (in_array('assign_doctor_2', $existingCols, true) ? 'assign_doctor_2' : null)));

$doc2Val = $assigned_doctor_2 !== '' ? $assigned_doctor_2 : null;

/* Generate package code from the next database ID. */
$new_pkg_code = 'PKG-001';
$maxRes = mysqli_query($connection1, 'SELECT MAX(id) AS max_id FROM packages');
if ($maxRes && ($maxRow = mysqli_fetch_assoc($maxRes))) {
    $nextId = max(1, (int)$maxRow['max_id'] + 1);
    $new_pkg_code = 'PKG-' . str_pad((string)$nextId, 3, '0', STR_PAD_LEFT);
    mysqli_free_result($maxRes);
}

$dupStmt = mysqli_prepare($connection1, 'SELECT id FROM packages WHERE package_id = ? LIMIT 1');
if ($dupStmt) {
    mysqli_stmt_bind_param($dupStmt, 's', $new_pkg_code);
    mysqli_stmt_execute($dupStmt);
    mysqli_stmt_store_result($dupStmt);
    if (mysqli_stmt_num_rows($dupStmt) > 0) {
        $new_pkg_code = 'PKG-' . str_pad((string)(time() % 10000), 4, '0', STR_PAD_LEFT);
    }
    mysqli_stmt_close($dupStmt);
}

if ($docCol2 !== null) {
    $sql = "
        INSERT INTO packages
        (package_id, package_name, category, `{$docCol1}`, `{$docCol2}`, duration, price,
         enrollments, protocol_status, image_url, short_description, overview, benefits, included,
         diet_hydration, yoga_physio, ayurveda_dinacharya, daily_activity, patient_monitoring,
         followup_review, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0, 'Added', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";
    $stmt = mysqli_prepare($connection1, $sql);
    if ($stmt) {
        mysqli_stmt_bind_param(
            $stmt,
            'ssssssdssssssssssss',
            $new_pkg_code,
            $package_name,
            $category,
            $assigned_doctor_1,
            $doc2Val,
            $duration,
            $price,
            $image_url,
            $short_description,
            $overview,
            $benefits,
            $included,
            $diet_hydration,
            $yoga_physio,
            $ayurveda_dinacharya,
            $daily_activity,
            $patient_monitoring,
            $followup_review,
            $status
        );
    }
} else {
    $combinedDoc = $assigned_doctor_2 !== ''
        ? ($assigned_doctor_1 . ', ' . $assigned_doctor_2)
        : $assigned_doctor_1;

    $sql = "
        INSERT INTO packages
        (package_id, package_name, category, `{$docCol1}`, duration, price, enrollments,
         protocol_status, image_url, short_description, overview, benefits, included,
         diet_hydration, yoga_physio, ayurveda_dinacharya, daily_activity, patient_monitoring,
         followup_review, status)
        VALUES (?, ?, ?, ?, ?, ?, 0, 'Added', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ";
    $stmt = mysqli_prepare($connection1, $sql);
    if ($stmt) {
        mysqli_stmt_bind_param(
            $stmt,
            'sssssdssssssssssss',
            $new_pkg_code,
            $package_name,
            $category,
            $combinedDoc,
            $duration,
            $price,
            $image_url,
            $short_description,
            $overview,
            $benefits,
            $included,
            $diet_hydration,
            $yoga_physio,
            $ayurveda_dinacharya,
            $daily_activity,
            $patient_monitoring,
            $followup_review,
            $status
        );
    }
}

if (!$stmt) {
    error_log('add_package.php prepare failed: ' . mysqli_error($connection1));
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to prepare package insert query.']);
    exit;
}

if (mysqli_stmt_execute($stmt)) {
    $insert_id = mysqli_insert_id($connection1);

    require_once __DIR__ . '/activity_logger.php';
    recordActivity($connection1, [
        'module'      => 'Package',
        'action'      => 'package.created',
        'entity_type' => 'packages',
        'entity_id'   => $new_pkg_code,
        'entity_name' => $package_name,
        'description' => "Created package '{$package_name}' ({$new_pkg_code}) priced at ₹" . number_format($price, 2),
        'new_values'  => [
            'id' => $insert_id,
            'package_id' => $new_pkg_code,
            'package_name' => $package_name,
            'category' => $category,
            'duration' => $duration,
            'price' => $price,
            'status' => $status
        ]
    ]);
    mysqli_stmt_close($stmt);

    $combined_doctor = ($assigned_doctor_2 !== '')
        ? ($assigned_doctor_1 . ', ' . $assigned_doctor_2)
        : $assigned_doctor_1;

    echo json_encode([
        'status' => '1',
        'message' => 'Package added successfully.',
        'data' => [
            'id' => $insert_id,
            'package_id' => $new_pkg_code,
            'package_name' => $package_name,
            'category' => $category,
            'assigned_doctor' => $assigned_doctor_1,
            'assigned_doctor_2' => $assigned_doctor_2,
            'assigned_doctor_1' => $assigned_doctor_1,
            'assign_doctor' => $assigned_doctor_1,
            'assign_doctor_1' => $assigned_doctor_1,
            'assign_doctor_2' => $assigned_doctor_2,
            'combined_doctor' => $combined_doctor,
            'duration' => $duration,
            'price' => $price,
            'image_url' => $image_url,
            'status' => $status
        ]
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    error_log('add_package.php insert failed: ' . $err);
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to add package.']);
}
?>
