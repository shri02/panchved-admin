<?php

/*
|--------------------------------------------------------------------------
| DATABASE CONFIGURATION & SHARED API HEADERS
|--------------------------------------------------------------------------
*/

if (!headers_sent()) {
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
}

if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    if (!headers_sent()) {
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])) {
            header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        }
        if (isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])) {
            header("Access-Control-Allow-Headers: {$_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']}");
        }
        http_response_code(200);
    }
    exit(0);
}

// Database server IP address or hostname
$dbHost = getenv('DB_HOST') ?: ($_ENV['DB_HOST'] ?? ($_SERVER['DB_HOST'] ?? "162.214.80.27"));

// Database name
$dbName = getenv('DB_NAME') ?: ($_ENV['DB_NAME'] ?? ($_SERVER['DB_NAME'] ?? "jewrzsmy_panchved"));

// Database username
$dbUser = getenv('DB_USER') ?: ($_ENV['DB_USER'] ?? ($_SERVER['DB_USER'] ?? "jewrzsmy_panchveduser"));

// Database password
$dbPass = (getenv('DB_PASS') !== false && getenv('DB_PASS') !== '')
    ? getenv('DB_PASS')
    : ($_ENV['DB_PASS'] ?? ($_SERVER['DB_PASS'] ?? '$hr1dhar@321'));

$connection1 = null;
$lastDbError = '';
$lastDbErrno = 0;

try {
    mysqli_report(MYSQLI_REPORT_OFF);
    $connection1 = mysqli_init();
    if ($connection1) {
        // Enable SSL if connecting to Azure or DB_SSL flag is set
        if (getenv('DB_SSL') === 'true' || strpos($dbHost, 'azure.com') !== false) {
            mysqli_ssl_set($connection1, NULL, NULL, NULL, NULL, NULL);
            $connected = @mysqli_real_connect($connection1, $dbHost, $dbUser, $dbPass, $dbName, 3306, NULL, MYSQLI_CLIENT_SSL);
        } else {
            $connected = @mysqli_real_connect($connection1, $dbHost, $dbUser, $dbPass, $dbName);
        }

        if (!$connected) {
            $lastDbError = mysqli_connect_error() ?: mysqli_error($connection1);
            $lastDbErrno = mysqli_connect_errno() ?: mysqli_errno($connection1);
            $connection1 = null;
        }
    } else {
        $lastDbError = 'mysqli_init() failed.';
    }
} catch (Throwable $e) {
    $lastDbError = $e->getMessage();
    $lastDbErrno = (int)$e->getCode();
    $connection1 = null;
}

if (!$connection1 || mysqli_connect_errno()) {
    $errMsg = $lastDbError ?: (mysqli_connect_error() ?: 'Unable to connect to database.');
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=UTF-8');
    }
    echo json_encode([
        'status'        => '0',
        'success'       => false,
        'message'       => 'Database connection failed: ' . $errMsg,
        'error_type'    => 'mysqli_connection_error',
        'error_code'    => $lastDbErrno ?: (mysqli_connect_errno() ?: 2002),
        'sqlstate'      => 'HY000',
        'error_details' => $errMsg
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

mysqli_set_charset($connection1, "utf8mb4");
date_default_timezone_set('Asia/Kolkata');
@mysqli_query($connection1, "SET time_zone = '+05:30'");
$GLOBALS['connection1'] = $connection1;
?>
