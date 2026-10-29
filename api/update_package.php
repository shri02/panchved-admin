<?php
/**
 * Panchved Admin - Update Package API
 * POST: /api/update_package.php
 */

require_once __DIR__ . '/db_connect.php';
require_once __DIR__ . '/azure_blob_upload.php';

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

$id = intval($data['id'] ?? 0);
$package_id = trim((string) ($data['package_id'] ?? ''));

if ($id <= 0 && $package_id === '') {
    http_response_code(400);
    echo json_encode(['status' => '0', 'message' => 'Package id or package_id is required.']);
    exit;
}

$package_name = trim((string) ($data['package_name'] ?? $data['name'] ?? ''));
$category = trim((string) ($data['category'] ?? ''));
$assigned_doctor_1 = isset($data['assigned_doctor_1']) ? trim((string)$data['assigned_doctor_1']) : (isset($data['assign_doctor_1']) ? trim((string)$data['assign_doctor_1']) : (isset($data['editPkgDoctor1']) ? trim((string)$data['editPkgDoctor1']) : null));
$assigned_doctor_2 = isset($data['assigned_doctor_2']) ? trim((string)$data['assigned_doctor_2']) : (isset($data['assign_doctor_2']) ? trim((string)$data['assign_doctor_2']) : (isset($data['editPkgDoctor2']) ? trim((string)$data['editPkgDoctor2']) : null));

if ($assigned_doctor_1 === null && isset($data['assigned_doctor'])) {
    $raw_doc = trim((string)$data['assigned_doctor']);
    if ($raw_doc !== '') {
        if (strpos($raw_doc, ',') !== false) {
            $parts = array_map('trim', explode(',', $raw_doc, 2));
            $assigned_doctor_1 = $parts[0];
            if ($assigned_doctor_2 === null) {
                $assigned_doctor_2 = $parts[1] ?? '';
            }
        } else {
            $assigned_doctor_1 = $raw_doc;
        }
    }
}
if ($assigned_doctor_1 === null && isset($data['assign_doctor'])) {
    $raw_doc = trim((string)$data['assign_doctor']);
    if ($raw_doc !== '') {
        if (strpos($raw_doc, ',') !== false) {
            $parts = array_map('trim', explode(',', $raw_doc, 2));
            $assigned_doctor_1 = $parts[0];
            if ($assigned_doctor_2 === null) {
                $assigned_doctor_2 = $parts[1] ?? '';
            }
        } else {
            $assigned_doctor_1 = $raw_doc;
        }
    }
}
$duration = trim((string) ($data['duration'] ?? ''));
$price_raw = isset($data['price']) ? preg_replace('/[^\d.]/', '', (string) $data['price']) : null;
$short_description = trim((string) ($data['short_description'] ?? ''));
$overview = trim((string) ($data['overview'] ?? ''));
$benefits = trim((string) ($data['benefits'] ?? ''));
$included = trim((string) ($data['included'] ?? ''));
$diet_hydration = trim((string) ($data['diet_hydration'] ?? ''));
$yoga_physio = trim((string) ($data['yoga_physio'] ?? ''));
$ayurveda_dinacharya = trim((string) ($data['ayurveda_dinacharya'] ?? ''));
$daily_activity = trim((string) ($data['daily_activity'] ?? ''));
$patient_monitoring = trim((string) ($data['patient_monitoring'] ?? ''));
$followup_review = trim((string) ($data['followup_review'] ?? ''));
$status = trim((string) ($data['status'] ?? ''));

// Handle Package Image Upload to Azure Blob Storage if provided
$image_url = null;
if (isset($_FILES['package_image']) && ($_FILES['package_image']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE) {
    try {
        $image_url = uploadPackageImageToAzure($_FILES['package_image']);
    } catch (Throwable $e) {
        error_log('update_package.php image upload error: ' . $e->getMessage());
        http_response_code(400);
        echo json_encode(['status' => '0', 'message' => $e->getMessage()]);
        exit;
    }
} elseif (isset($data['image_url']) && trim((string)$data['image_url']) !== '') {
    $image_url = trim((string)$data['image_url']);
}

// Ensure assigned_doctor and assigned_doctor_2 columns exist
if ($connection1 && ($assigned_doctor_1 !== null || $assigned_doctor_2 !== null || $image_url !== null)) {
    $col_res = @mysqli_query($connection1, "SHOW COLUMNS FROM packages");
    $existing_cols = [];
    if ($col_res) {
        while ($col_row = mysqli_fetch_assoc($col_res)) {
            $existing_cols[] = $col_row['Field'];
        }
    }
    if ($image_url !== null && !in_array('image_url', $existing_cols, true)) {
        @mysqli_query($connection1, "ALTER TABLE packages ADD COLUMN `image_url` VARCHAR(255) NULL AFTER `category`");
        $existing_cols[] = 'image_url';
    }
    if (!in_array('assigned_doctor', $existing_cols) && !in_array('assign_doctor', $existing_cols)) {
        @mysqli_query($connection1, "ALTER TABLE packages ADD COLUMN `assigned_doctor` VARCHAR(150) NULL DEFAULT NULL AFTER `category`");
        $existing_cols[] = 'assigned_doctor';
    }
    if (!in_array('assigned_doctor_2', $existing_cols) && !in_array('assign_doctor_2', $existing_cols)) {
        @mysqli_query($connection1, "ALTER TABLE packages ADD COLUMN `assigned_doctor_2` VARCHAR(150) NULL DEFAULT NULL AFTER `assigned_doctor`");
        $existing_cols[] = 'assigned_doctor_2';
    }
}

// Check which column names exist
$has_assign_doctor = false;
$has_assigned_doctor = false;
$has_assigned_doctor_one = false;
$has_assigned_doctor_1 = false;
$has_assign_doctor_2 = false;
$has_assigned_doctor_2 = false;
$has_assign_doctor_two = false;
$has_assigned_doctor_two = false;
if ($connection1) {
    $col_res2 = @mysqli_query($connection1, "SHOW COLUMNS FROM packages");
    if ($col_res2) {
        while ($c = mysqli_fetch_assoc($col_res2)) {
            if ($c['Field'] === 'assigned_doctor') $has_assigned_doctor = true;
            if ($c['Field'] === 'assign_doctor') $has_assign_doctor = true;
            if ($c['Field'] === 'assigned_doctor_one') $has_assigned_doctor_one = true;
            if ($c['Field'] === 'assigned_doctor_1') $has_assigned_doctor_1 = true;
            if ($c['Field'] === 'assigned_doctor_2') $has_assigned_doctor_2 = true;
            if ($c['Field'] === 'assign_doctor_2') $has_assign_doctor_2 = true;
            if ($c['Field'] === 'assign_doctor_two') $has_assign_doctor_two = true;
            if ($c['Field'] === 'assigned_doctor_two') $has_assigned_doctor_two = true;
        }
    }
}
$doc_col1 = $has_assigned_doctor_one ? 'assigned_doctor_one' : ($has_assigned_doctor_1 ? 'assigned_doctor_1' : ($has_assigned_doctor ? 'assigned_doctor' : ($has_assign_doctor ? 'assign_doctor' : 'assigned_doctor')));
$doc_col2 = $has_assign_doctor_two ? 'assign_doctor_two' : ($has_assigned_doctor_two ? 'assigned_doctor_two' : ($has_assigned_doctor_2 ? 'assigned_doctor_2' : ($has_assign_doctor_2 ? 'assign_doctor_2' : 'assigned_doctor_2')));

$has_any_doc1 = $has_assigned_doctor || $has_assign_doctor || $has_assigned_doctor_one || $has_assigned_doctor_1;
$has_any_doc2 = $has_assigned_doctor_2 || $has_assign_doctor_2 || $has_assign_doctor_two || $has_assigned_doctor_two;

$update_fields = [];
$params = [];
$types = '';

if ($package_name !== '') { $update_fields[] = "package_name = ?"; $params[] = $package_name; $types .= 's'; }
if ($category !== '') { $update_fields[] = "category = ?"; $params[] = $category; $types .= 's'; }
if ($assigned_doctor_1 !== null && $has_any_doc1) {
    if (!$has_any_doc2 && $assigned_doctor_2 !== null) {
        $combined = ($assigned_doctor_2 !== '') ? ($assigned_doctor_1 . ', ' . $assigned_doctor_2) : $assigned_doctor_1;
        $update_fields[] = "`{$doc_col1}` = ?"; $params[] = $combined; $types .= 's';
    } else {
        $update_fields[] = "`{$doc_col1}` = ?"; $params[] = $assigned_doctor_1; $types .= 's';
    }
}
if ($assigned_doctor_2 !== null && $has_any_doc2) {
    $doc2_val = ($assigned_doctor_2 !== '') ? $assigned_doctor_2 : null;
    $update_fields[] = "`{$doc_col2}` = ?"; $params[] = $doc2_val; $types .= 's';
}
if ($duration !== '') { $update_fields[] = "duration = ?"; $params[] = $duration; $types .= 's'; }
if ($price_raw !== null && $price_raw !== '') { $update_fields[] = "price = ?"; $params[] = floatval($price_raw); $types .= 'd'; }
if ($short_description !== '') { $update_fields[] = "short_description = ?"; $params[] = $short_description; $types .= 's'; }
if ($overview !== '') { $update_fields[] = "overview = ?"; $params[] = $overview; $types .= 's'; }
if ($benefits !== '') { $update_fields[] = "benefits = ?"; $params[] = $benefits; $types .= 's'; }
if ($included !== '') { $update_fields[] = "included = ?"; $params[] = $included; $types .= 's'; }
if ($diet_hydration !== '') { $update_fields[] = "diet_hydration = ?"; $params[] = $diet_hydration; $types .= 's'; }
if ($yoga_physio !== '') { $update_fields[] = "yoga_physio = ?"; $params[] = $yoga_physio; $types .= 's'; }
if ($ayurveda_dinacharya !== '') { $update_fields[] = "ayurveda_dinacharya = ?"; $params[] = $ayurveda_dinacharya; $types .= 's'; }
if ($daily_activity !== '') { $update_fields[] = "daily_activity = ?"; $params[] = $daily_activity; $types .= 's'; }
if ($patient_monitoring !== '') { $update_fields[] = "patient_monitoring = ?"; $params[] = $patient_monitoring; $types .= 's'; }
if ($followup_review !== '') { $update_fields[] = "followup_review = ?"; $params[] = $followup_review; $types .= 's'; }
if ($status !== '' && in_array($status, ['Active', 'Inactive'], true)) {
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
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Database connection failed.']);
    exit;
}

$sql = "UPDATE packages SET " . implode(', ', $update_fields);
if ($id > 0) {
    $sql .= " WHERE id = ?";
    $params[] = $id;
    $types .= 'i';
} else {
    $sql .= " WHERE package_id = ?";
    $params[] = $package_id;
    $types .= 's';
}

$stmt = mysqli_prepare($connection1, $sql);
if (!$stmt) {
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to prepare statement: ' . mysqli_error($connection1)]);
    exit;
}

mysqli_stmt_bind_param($stmt, $types, ...$params);

if (mysqli_stmt_execute($stmt)) {
    require_once __DIR__ . '/activity_logger.php';
    recordActivity($connection1, [
        'module'      => 'Package',
        'action'      => 'package.updated',
        'entity_type' => 'packages',
        'entity_id'   => $package_id,
        'entity_name' => $package_name ?? $package_id,
        'description' => "Updated package '{$package_name}' ({$package_id})",
        'metadata'    => ['package_id' => $package_id, 'package_name' => $package_name]
    ]);
    mysqli_stmt_close($stmt);
    $combined_doctor = ($assigned_doctor_2 !== null && $assigned_doctor_2 !== '') ? ($assigned_doctor_1 . ', ' . $assigned_doctor_2) : ($assigned_doctor_1 ?? '');
    echo json_encode([
        'status' => '1',
        'message' => 'Package updated successfully.',
        'data' => [
            'id' => $id,
            'package_id' => $package_id,
            'assigned_doctor' => $assigned_doctor_1,
            'assigned_doctor_2' => $assigned_doctor_2,
            'assigned_doctor_1' => $assigned_doctor_1,
            'assign_doctor' => $assigned_doctor_1,
            'assign_doctor_1' => $assigned_doctor_1,
            'assign_doctor_2' => $assigned_doctor_2,
            'combined_doctor' => $combined_doctor,
            'image_url' => $image_url
        ]
    ]);
} else {
    $err = mysqli_stmt_error($stmt);
    mysqli_stmt_close($stmt);
    http_response_code(500);
    echo json_encode(['status' => '0', 'message' => 'Failed to update package.', 'error' => $err]);
}
?>
