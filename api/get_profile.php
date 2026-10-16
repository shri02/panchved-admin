<?php
/**
 * Panchved Admin - Get User Profile API
 * GET: /api/get_profile.php
 */

require_once __DIR__ . '/db_connect.php';

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

// 1. Identify user from Session or Authorization Bearer token or Query
$user_session = $_SESSION['ocayur_user'] ?? $_SESSION['panchved_user'] ?? null;
$headers = getallheaders();
$auth_header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
$bearer_token = '';
if (preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
    $bearer_token = $matches[1];
}

$user_id = null;
if ($user_session && !empty($user_session['id'])) {
    $user_id = intval($user_session['id']);
} elseif ($bearer_token) {
    $parts = explode('.', $bearer_token);
    if (!empty($parts[0])) {
        $decoded = json_decode(base64_decode($parts[0]), true);
        if (is_array($decoded) && !empty($decoded['user_id'])) {
            $user_id = intval($decoded['user_id']);
        }
    }
}

// Query parameter fallback if specified
if (isset($_GET['id']) && intval($_GET['id']) > 0) {
    $user_id = intval($_GET['id']);
}

// Default to 1 (Admin) if still not set
if (!$user_id) {
    $user_id = 1;
}

$user = null;

// 2. Query user from database
if ($connection1) {
    $query = "SELECT id, username, full_name, email, phone_number, role, avatar_url, status, last_login, created_at FROM users WHERE id = ? LIMIT 1";
    $stmt = mysqli_prepare($connection1, $query);
    if ($stmt) {
        mysqli_stmt_bind_param($stmt, 'i', $user_id);
        mysqli_stmt_execute($stmt);
        $result = mysqli_stmt_get_result($stmt);
        if ($result && $row = mysqli_fetch_assoc($result)) {
            $user = $row;
        }
        mysqli_stmt_close($stmt);
    }
if ($user) {
    $roleLower = strtolower(trim((string)($user['role'] ?? '')));
    if (!in_array($roleLower, ['admin', 'super admin', 'administrator'], true)) {
        http_response_code(403);
        echo json_encode([
            'status' => '0',
            'message' => 'Access denied. Admin credentials required.'
        ]);
        exit;
    }
}
if (!$user) {
    if ($user_session) {
        $user = [
            'id' => $user_session['id'] ?? 1,
            'username' => $user_session['username'] ?? 'admin',
            'full_name' => $user_session['full_name'] ?? 'Admin',
            'email' => $user_session['email'] ?? 'admin@ocayur.com',
            'phone_number' => $user_session['phone_number'] ?? '9876543210',
            'role' => $user_session['role'] ?? 'Admin',
            'avatar_url' => $user_session['avatar_url'] ?? null,
            'status' => $user_session['status'] ?? 'Active',
            'last_login' => date('Y-m-d H:i:s'),
            'created_at' => date('Y-m-d H:i:s')
        ];
    } else {
        $user = [
            'id' => 1,
            'username' => 'admin',
            'full_name' => 'Admin',
            'email' => 'admin@ocayur.com',
            'phone_number' => '9876543210',
            'role' => 'Admin',
            'avatar_url' => null,
            'status' => 'Active',
            'last_login' => date('Y-m-d H:i:s'),
            'created_at' => date('Y-m-d H:i:s')
        ];
    }
}

echo json_encode([
    'status' => '1',
    'message' => 'Profile retrieved successfully.',
    'data' => $user
]);
