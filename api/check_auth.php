<?php
/**
 * Panchved Admin - Check Auth API
 * GET: /api/check_auth.php
 */

require_once __DIR__ . '/db_connect.php';

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

$headers = getallheaders();
$auth_header = $headers['Authorization'] ?? $headers['authorization'] ?? '';
$bearer_token = '';
if (preg_match('/Bearer\s(\S+)/', $auth_header, $matches)) {
    $bearer_token = $matches[1];
}

$user = $_SESSION['ocayur_user'] ?? $_SESSION['panchved_user'] ?? null;

if (!$user && $bearer_token) {
    $parts = explode('.', $bearer_token);
    if (!empty($parts[0])) {
        $decoded = json_decode(base64_decode($parts[0]), true);
        if (is_array($decoded) && !empty($decoded['user_id'])) {
            $user = $decoded;
        }
    }
}

$roleLower = strtolower(trim((string)($user['role'] ?? '')));
if ($user && in_array($roleLower, ['admin', 'super admin', 'administrator'], true)) {
    echo json_encode([
        'status' => '1',
        'authenticated' => true,
        'user' => [
            'id' => $user['id'] ?? 1,
            'username' => $user['username'] ?? 'admin',
            'full_name' => $user['full_name'] ?? 'Admin',
            'email' => $user['email'] ?? 'admin@ocayur.com',
            'role' => $user['role'] ?? 'Admin'
        ]
    ]);
} else {
    echo json_encode([
        'status' => '0',
        'authenticated' => false,
        'message' => 'No active admin session.'
    ]);
}
