<?php
/**
 * Panchved Admin - Delete Workshop API
 * POST/DELETE: /api/delete_workshop.php
 */

header('Content-Type: application/json; charset=UTF-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
header('Pragma: no-cache');

set_error_handler(function ($severity, $message, $file, $line) {
    if (!(error_reporting() & $severity) || ($severity & (E_DEPRECATED | E_USER_DEPRECATED))) {
        return false;
    }
    throw new ErrorException($message, 0, $severity, $file, $line);
});

try {
    require_once __DIR__ . '/database.php';
    require_once __DIR__ . '/activity_logger.php';

    if (!isset($connection1) || !($connection1 instanceof mysqli)) {
        echo json_encode([
            'status'        => '0',
            'success'       => false,
            'message'       => 'Database connection is unavailable.',
            'error_type'    => 'ConnectionError',
            'error_code'    => 500,
            'sqlstate'      => null,
            'error_details' => 'Database connection $connection1 is unavailable.'
        ], JSON_UNESCAPED_UNICODE);
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

    $id = intval($_GET['id'] ?? $data['id'] ?? 0);
    $workshop_id = trim((string) ($_GET['workshop_id'] ?? $data['workshop_id'] ?? ''));

    if ($id <= 0 && $workshop_id === '') {
        http_response_code(400);
        echo json_encode([
            'status'        => '0',
            'success'       => false,
            'message'       => 'Workshop id or workshop_id is required.'
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $ws_name = '';
    $ws_code = $workshop_id;
    $ws_num_id = $id;

    $chk_sql = $id > 0
        ? "SELECT id, title, workshop_id FROM workshops WHERE id = ? LIMIT 1"
        : "SELECT id, title, workshop_id FROM workshops WHERE workshop_id = ? LIMIT 1";
    $chk_stmt = mysqli_prepare($connection1, $chk_sql);
    if (!$chk_stmt) {
        $err = mysqli_error($connection1);
        echo json_encode([
            'status'        => '0',
            'success'       => false,
            'message'       => 'Database prepare error: ' . $err,
            'error_type'    => 'mysqli_prepare_error',
            'error_code'    => mysqli_errno($connection1),
            'sqlstate'      => mysqli_sqlstate($connection1),
            'error_details' => $err
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($id > 0) {
        mysqli_stmt_bind_param($chk_stmt, 'i', $id);
    } else {
        mysqli_stmt_bind_param($chk_stmt, 's', $workshop_id);
    }
    mysqli_stmt_execute($chk_stmt);
    mysqli_stmt_bind_result($chk_stmt, $f_id, $f_title, $f_code);
    if (mysqli_stmt_fetch($chk_stmt)) {
        $ws_num_id = (int)$f_id;
        $ws_name = (string)$f_title;
        $ws_code = (string)$f_code;
    }
    mysqli_stmt_close($chk_stmt);

    $delSql = $id > 0
        ? "DELETE FROM workshops WHERE id = ?"
        : "DELETE FROM workshops WHERE workshop_id = ?";
    $stmt = mysqli_prepare($connection1, $delSql);
    if (!$stmt) {
        $err = mysqli_error($connection1);
        echo json_encode([
            'status'        => '0',
            'success'       => false,
            'message'       => 'Failed to prepare delete query: ' . $err,
            'error_type'    => 'mysqli_prepare_error',
            'error_code'    => mysqli_errno($connection1),
            'sqlstate'      => mysqli_sqlstate($connection1),
            'error_details' => $err
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($id > 0) {
        mysqli_stmt_bind_param($stmt, 'i', $id);
    } else {
        mysqli_stmt_bind_param($stmt, 's', $workshop_id);
    }

    if (!mysqli_stmt_execute($stmt)) {
        $err = mysqli_stmt_error($stmt);
        $errno = mysqli_stmt_errno($stmt);
        $sqlstate = mysqli_stmt_sqlstate($stmt);
        mysqli_stmt_close($stmt);
        echo json_encode([
            'status'        => '0',
            'success'       => false,
            'message'       => 'Failed to delete workshop: ' . ($err ?: 'Unknown database error'),
            'error_type'    => 'mysqli_stmt_error',
            'error_code'    => $errno,
            'sqlstate'      => $sqlstate,
            'error_details' => $err
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    mysqli_stmt_close($stmt);

    $display_title = $ws_name ?: ($ws_code ?: "Workshop #{$ws_num_id}");
    try {
        recordActivity($connection1, [
            'module'      => 'Workshop',
            'action'      => 'workshop.deleted',
            'entity_type' => 'Workshop',
            'entity_id'   => $ws_num_id,
            'entity_name' => $display_title,
            'description' => "Deleted workshop: {$display_title}",
            'metadata'    => [
                'workshop_id' => $ws_code
            ]
        ]);
    } catch (Throwable $logEx) {
        error_log('delete_workshop.php activity log notice: ' . $logEx->getMessage());
    }

    echo json_encode([
        'status'  => '1',
        'success' => true,
        'message' => 'Workshop deleted successfully.'
    ], JSON_UNESCAPED_UNICODE);
} catch (mysqli_sql_exception $e) {
    echo json_encode([
        'status'        => '0',
        'success'       => false,
        'message'       => 'Database error: ' . $e->getMessage(),
        'error_type'    => 'mysqli_sql_exception',
        'error_code'    => $e->getCode(),
        'sqlstate'      => method_exists($e, 'getSqlState') ? $e->getSqlState() : null,
        'error_details' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode([
        'status'        => '0',
        'success'       => false,
        'message'       => 'Server error: ' . $e->getMessage(),
        'error_type'    => get_class($e),
        'error_code'    => $e->getCode(),
        'sqlstate'      => null,
        'error_details' => $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
}
?>
