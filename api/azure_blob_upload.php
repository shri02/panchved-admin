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

function getAzureBlobSasUrl(string $type = 'packages'): string
{
    if (strtolower($type) === 'workshop' || strtolower($type) === 'workshops') {
        // Priority 1: Check known workshop SAS URL environment variable names
        $workshopKeys = [
            'AZURE_BLOB_CONTAINER_WORKSHOP_SAS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_SAS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOP_IMAGES_SAS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_IMAGES_SAS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOP_IMAGE_SAS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_IMAGES',
            'AZURE_BLOB_CONTAINER_WORKSHOP_IMAGES',
            'AZURE_BLOB_CONTAINER_WORKSHOPS',
            'AZURE_BLOB_CONTAINER_WORKSHOP',
            'AZURE_BLOB_CONTAINER_WORKSHOP_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOP_SAS',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_SAS',
        ];

        foreach ($workshopKeys as $key) {
            $val = trim((string) (getenv($key) ?: ($_ENV[$key] ?? ($_SERVER[$key] ?? ''))));
            if ($val !== '') {
                return $val;
            }
        }

        // Priority 2: Look for any environment variable starting with AZURE_BLOB_CONTAINER_WORKSH
        foreach ([$_SERVER, $_ENV] as $source) {
            if (is_array($source)) {
                foreach ($source as $k => $v) {
                    if (is_string($k) && stripos($k, 'AZURE_BLOB_CONTAINER_WORKSH') === 0 && is_string($v) && trim($v) !== '') {
                        return trim($v);
                    }
                }
            }
        }
    }

    // Default package SAS URL (first URL in Azure App settings)
    $packageKeys = [
        'AZURE_BLOB_CONTAINER_SAS_URL',
        'AZURE_BLOB_CONTAINER_PACKAGE_SAS_URL',
        'AZURE_BLOB_CONTAINER_PACKAGES_SAS_URL',
    ];

    foreach ($packageKeys as $key) {
        $val = trim((string) (getenv($key) ?: ($_ENV[$key] ?? ($_SERVER[$key] ?? ''))));
        if ($val !== '') {
            return $val;
        }
    }

    return trim((string) (getenv('AZURE_BLOB_CONTAINER_SAS_URL') ?: ($_ENV['AZURE_BLOB_CONTAINER_SAS_URL'] ?? ($_SERVER['AZURE_BLOB_CONTAINER_SAS_URL'] ?? ''))));
}

function uploadBlobImageToAzure(array $file, string $folder = 'packages', string $itemTypeLabel = 'image', ?string $containerSasUrl = null): string
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

    if ($containerSasUrl === null || trim($containerSasUrl) === '') {
        $containerSasUrl = getAzureBlobSasUrl($folder);
    }

    $containerSasUrl = trim((string) $containerSasUrl);
    if ($containerSasUrl === '') {
        throw new RuntimeException("Azure Blob Storage for {$itemTypeLabel}s is not configured on the server.");
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
    $randomName = bin2hex(random_bytes(16)) . '.' . $allowedTypes[$mime];

    // For packages, keep backward-compatible path ('packages/<random>.<ext>')
    if ($cleanFolder === 'packages') {
        $blobName = 'packages/' . $randomName;
    } else {
        // If container path in SAS URL already contains the folder/workshop name (e.g. /workshop-images or /workshops),
        // place directly in container to avoid redundant nesting; otherwise prepend folder.
        if (stripos($basePath, 'workshop') !== false || stripos($basePath, $cleanFolder) !== false) {
            $blobName = $randomName;
        } else {
            $blobName = ($cleanFolder !== '' ? $cleanFolder : 'uploads') . '/' . $randomName;
        }
    }

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

    // Store a stable URL without SAS credentials.
    return $blobUrl;
}

function uploadPackageImageToAzure(array $file): string
{
    return uploadBlobImageToAzure($file, 'packages', 'package image', getAzureBlobSasUrl('packages'));
}

function uploadWorkshopImageToAzure(array $file): string
{
    return uploadBlobImageToAzure($file, 'workshops', 'workshop image', getAzureBlobSasUrl('workshops'));
}

