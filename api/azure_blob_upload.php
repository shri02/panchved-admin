<?php
/**
 * Upload an image (Package, Workshop, etc.) to Azure Blob Storage.
 *
 * Required environment variable:
 * AZURE_BLOB_CONTAINER_SAS_URL
 *
 * Value format:
 * https://ACCOUNT.blob.core.windows.net/CONTAINER?SAS_TOKEN
 *
 * The SAS token must allow blob creation/write. Keep it secret and server-side.
 */

function uploadBlobImageToAzure(array $file, string $folder = 'packages', string $itemTypeLabel = 'image'): string
{
    if (!isset($file['error']) || is_array($file['error'])) {
        throw new RuntimeException("Invalid {$itemTypeLabel} upload.");
    }

    if ($file['error'] !== UPLOAD_ERR_OK) {
        $messages = [
            UPLOAD_ERR_INI_SIZE   => "The uploaded {$itemTypeLabel} exceeds the server upload limit.",
            UPLOAD_ERR_FORM_SIZE  => "The uploaded {$itemTypeLabel} is too large.",
            UPLOAD_ERR_PARTIAL    => "The {$itemTypeLabel} upload was incomplete. Please try again.",
            UPLOAD_ERR_NO_FILE    => "Please select a {$itemTypeLabel}.",
            UPLOAD_ERR_NO_TMP_DIR => 'The server is missing a temporary upload directory.',
            UPLOAD_ERR_CANT_WRITE => "The server could not save the uploaded {$itemTypeLabel}.",
            UPLOAD_ERR_EXTENSION  => "The {$itemTypeLabel} upload was blocked by a server extension.",
        ];
        throw new RuntimeException($messages[$file['error']] ?? "{$itemTypeLabel} upload failed.");
    }

    if (empty($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
        throw new RuntimeException('Invalid uploaded file.');
    }

    $maxBytes = 5 * 1024 * 1024; // 5 MB
    if (($file['size'] ?? 0) <= 0 || $file['size'] > $maxBytes) {
        throw new RuntimeException('Image must be smaller than or equal to 5 MB.');
    }

    if (!class_exists('finfo')) {
        throw new RuntimeException('The PHP fileinfo extension is required.');
    }

    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $mime = $finfo->file($file['tmp_name']);

    $allowedTypes = [
        'image/jpeg' => 'jpg',
        'image/png'  => 'png',
        'image/webp' => 'webp',
    ];

    if (!isset($allowedTypes[$mime])) {
        throw new RuntimeException('Only JPG, PNG, and WebP images are allowed.');
    }

    if (!function_exists('curl_init')) {
        throw new RuntimeException('The PHP cURL extension is required.');
    }

    $containerSasUrl = trim((string) (
        getenv('AZURE_BLOB_CONTAINER_SAS_URL') ?:
        ($_ENV['AZURE_BLOB_CONTAINER_SAS_URL'] ??
        ($_SERVER['AZURE_BLOB_CONTAINER_SAS_URL'] ?? ''))
    ));
    if ($containerSasUrl === '') {
        throw new RuntimeException('Azure Blob Storage is not configured on the server.');
    }

    $parts = parse_url($containerSasUrl);
    if (
        !$parts ||
        strtolower($parts['scheme'] ?? '') !== 'https' ||
        empty($parts['host']) ||
        empty($parts['path']) ||
        empty($parts['query'])
    ) {
        throw new RuntimeException('Azure container SAS URL configuration is invalid.');
    }

    // Remove any trailing slash from the container path, preserve SAS query.
    $basePath = rtrim($parts['path'], '/');
    $cleanFolder = trim(trim($folder), '/');
    if ($cleanFolder === '') {
        $cleanFolder = 'uploads';
    }
    $blobName = $cleanFolder . '/' . bin2hex(random_bytes(16)) . '.' . $allowedTypes[$mime];

    // Azure URL path segments must be URL-encoded; keep slashes between segments.
    $encodedBlobName = implode('/', array_map('rawurlencode', explode('/', $blobName)));
    $blobUrl = $parts['scheme'] . '://' . $parts['host'] . $basePath . '/' . $encodedBlobName;
    $uploadUrl = $blobUrl . '?' . $parts['query'];

    $stream = fopen($file['tmp_name'], 'rb');
    if ($stream === false) {
        throw new RuntimeException("Unable to read the uploaded {$itemTypeLabel}.");
    }

    $ch = curl_init($uploadUrl);
    curl_setopt_array($ch, [
        CURLOPT_PUT => true,
        CURLOPT_INFILE => $stream,
        CURLOPT_INFILESIZE => (int) $file['size'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT => 90,
        CURLOPT_HTTPHEADER => [
            'x-ms-blob-type: BlockBlob',
            'x-ms-version: 2023-11-03',
            'Content-Type: ' . $mime,
            'Content-Length: ' . (int) $file['size'],
        ],
    ]);

    $responseBody = curl_exec($ch);
    $curlError = curl_error($ch);
    $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    fclose($stream);

    if ($responseBody === false || $httpCode !== 201) {
        error_log("Azure {$itemTypeLabel} upload failed. HTTP=" . $httpCode . '; cURL=' . $curlError . '; response=' . substr((string) $responseBody, 0, 1000));
        if ($httpCode === 403) {
            throw new RuntimeException('Azure rejected the upload. Check the SAS permissions and expiry.');
        }
        throw new RuntimeException("Unable to upload the {$itemTypeLabel} to Azure Blob Storage.");
    }

    // Store a stable URL without SAS credentials. This requires the blob/container
    // to be publicly readable or served through an authenticated image endpoint.
    return $blobUrl;
}

function uploadPackageImageToAzure(array $file): string
{
    return uploadBlobImageToAzure($file, 'packages', 'package image');
}

function uploadWorkshopImageToAzure(array $file): string
{
    return uploadBlobImageToAzure($file, 'workshops', 'workshop image');
}

