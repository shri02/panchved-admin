<?php
/**
 * Panchved Admin - Shared Database Connector
 * Safe inclusion of database.php with automated localhost / credential fallback.
 */

// =========================================
// CORS HEADERS (Cross-Origin Resource Sharing)
// =========================================
header('Content-Type: application/json; charset=UTF-8');

if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');
} else {
    header('Access-Control-Allow-Origin: *');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Accept, Origin');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

// Fast return on preflight OPTIONS request
if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
        header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
    }
    if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
        header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
    }
    http_response_code(200);
    exit(0);
}

$connection1 = null;
$lastDbError = '';

mysqli_report(MYSQLI_REPORT_OFF);

// 1. Try loading database.php
try {
    @include_once __DIR__ . '/database.php';
    if (isset($connection1) && ($connection1 instanceof mysqli) && !mysqli_connect_errno() && @$connection1->ping()) {
        // Connection from database.php is valid
    } else {
        $connection1 = null;
    }
} catch (Throwable $e) {
    $lastDbError = $e->getMessage();
    $connection1 = null;
}

// 2. If host IP or connection failed, attempt fallback to localhost with credentials
if (!$connection1 || !($connection1 instanceof mysqli)) {
    $candidateHosts = array_unique(array_filter([
        '162.214.80.27',
        'localhost',
        '127.0.0.1',
        $dbHost ?? null,
        '162.214.80.27'
    ]));

    $candidateUsers = array_unique(array_filter([
        $dbUser ?? null,
        'jcwrzsmy_panchveduser',
        'jewrzsmy_panchveduser'
    ]));

    $candidateDbs = array_unique(array_filter([
        $dbName ?? null,
        'jcwrzsmy_panchved',
        'jewrzsmy_panchved'
    ]));

    $candidatePass = $dbPass ?? '$hr1dhar@321';

    foreach ($candidateHosts as $h) {
        foreach ($candidateUsers as $u) {
            foreach ($candidateDbs as $d) {
                try {
                    $conn = @mysqli_connect($h, $u, $candidatePass, $d);
                    if ($conn && !mysqli_connect_errno()) {
                        $connection1 = $conn;
                        break 3;
                    } else {
                        $lastDbError = mysqli_connect_error() ?: $lastDbError;
                    }
                } catch (Throwable $e) {
                    $lastDbError = $e->getMessage();
                }
            }
        }
    }
}

if (!$connection1 || !($connection1 instanceof mysqli)) {
    http_response_code(500);
    echo json_encode([
        'status' => '0',
        'message' => 'Database connection failed.',
        'error' => !empty($lastDbError) ? $lastDbError : 'Unable to connect to database server.'
    ]);
    exit;
}

@mysqli_set_charset($connection1, 'utf8mb4');
date_default_timezone_set('Asia/Kolkata');
@mysqli_query($connection1, "SET time_zone = '+05:30'");
$GLOBALS['connection1'] = $connection1;
?>
