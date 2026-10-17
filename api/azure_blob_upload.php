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

/**
 * Normalizes and validates an Azure Blob Storage container SAS URL.
 * Handles:
 *  - Full SAS URL: https://account.blob.core.windows.net/container?sv=...&sig=...
 *  - URL without https scheme: account.blob.core.windows.net/container?sv=...
 *  - Quoted string: "https://account.blob.core.windows.net/container?sv=..."
 *  - Decodes HTML entities: &amp; -> &
 *
 * Returns normalized URL string or null if not a valid Azure Blob container SAS URL.
 */
function normalizeAzureSasUrl(?string $url): ?string
{
    if ($url === null) {
        return null;
    }

    $clean = trim((string) $url, " \t\n\r\0\x0B\"'\\");
    if ($clean === '') {
        return null;
    }

    $clean = htmlspecialchars_decode($clean, ENT_QUOTES | ENT_HTML5);

    if (str_starts_with($clean, '//')) {
        $clean = 'https:' . $clean;
    } elseif (str_starts_with($clean, 'http://')) {
        $clean = 'https://' . substr($clean, 7);
    } elseif (!preg_match('#^[a-zA-Z][a-zA-Z0-9+\-.]*://#', $clean)) {
        if (stripos($clean, '.blob.core.windows.net') !== false) {
            $clean = 'https://' . ltrim($clean, '/');
        } else {
            return null;
        }
    }

    $parts = parse_url($clean);
    if (
        !$parts ||
        strtolower($parts['scheme'] ?? '') !== 'https' ||
        empty($parts['host']) ||
        empty($parts['path']) ||
        trim($parts['path'], '/') === '' ||
        empty($parts['query'])
    ) {
        return null;
    }

    return $clean;
}

function getAzureBlobSasUrl(string $type = 'packages'): string
{
    $readEnv = function (string $key): string {
        return trim((string) (getenv($key) ?: ($_ENV[$key] ?? ($_SERVER[$key] ?? ''))));
    };

    $isWorkshop = (strtolower($type) === 'workshop' || strtolower($type) === 'workshops');

    if ($isWorkshop) {
        // Priority 1: Check known dedicated workshop SAS URL environment variable names
        $workshopUrlKeys = [
            'AZURE_BLOB_CONTAINER_WORKSHOP_SAS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_SAS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOP_IMAGES_SAS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_IMAGES_SAS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOP_IMAGE_SAS_URL',
        ];

        foreach ($workshopUrlKeys as $key) {
            $val = $readEnv($key);
            $normalized = normalizeAzureSasUrl($val);
            if ($normalized !== null) {
                return $normalized;
            }
        }

        // Priority 2: Check any env var starting with AZURE_BLOB_CONTAINER_WORKSH that is a valid SAS URL
        foreach ([$_SERVER, $_ENV] as $source) {
            if (is_array($source)) {
                foreach ($source as $k => $v) {
                    if (is_string($k) && stripos($k, 'AZURE_BLOB_CONTAINER_WORKSH') === 0 && is_string($v)) {
                        $normalized = normalizeAzureSasUrl($v);
                        if ($normalized !== null) {
                            return $normalized;
                        }
                    }
                }
            }
        }

        // Priority 3: Check if workshop URL and SAS token were provided in separate variables
        $urlCandidateKeys = [
            'AZURE_BLOB_CONTAINER_WORKSHOP_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOP_IMAGE_URL',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_IMAGE_URL',
        ];
        $sasCandidateKeys = [
            'AZURE_BLOB_CONTAINER_WORKSHOP_SAS',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_SAS',
            'AZURE_BLOB_CONTAINER_WORKSHOP_SAS_TOKEN',
            'AZURE_BLOB_CONTAINER_WORKSHOPS_SAS_TOKEN',
            'AZURE_BLOB_SAS_TOKEN',
        ];

        $workshopBaseUrl = '';
        foreach ($urlCandidateKeys as $uk) {
            $val = $readEnv($uk);
            if ($val !== '') {
                $workshopBaseUrl = $val;
                break;
            }
        }

        $workshopSasToken = '';
        foreach ($sasCandidateKeys as $sk) {
            $val = $readEnv($sk);
            if ($val !== '') {
                $workshopSasToken = $val;
                break;
            }
        }

        if ($workshopBaseUrl !== '' && $workshopSasToken !== '') {
            $combined = rtrim($workshopBaseUrl, '/') . '?' . ltrim($workshopSasToken, '?');
            $normalized = normalizeAzureSasUrl($combined);
            if ($normalized !== null) {
                return $normalized;
            }
        }
    }

    // Priority 4 (or Priority 1 for packages): Check standard Azure Blob SAS URL keys
    $packageKeys = [
        'AZURE_BLOB_CONTAINER_SAS_URL',
        'AZURE_BLOB_CONTAINER_PACKAGE_SAS_URL',
        'AZURE_BLOB_CONTAINER_PACKAGES_SAS_URL',
        'AZURE_BLOB_SAS_URL',
    ];

    foreach ($packageKeys as $key) {
        $val = $readEnv($key);
        $normalized = normalizeAzureSasUrl($val);
        if ($normalized !== null) {
            return $normalized;
        }
    }

    // Diagnostic fallback: inspect configured values to throw a helpful error message
    $allCheckedKeys = $isWorkshop
        ? array_merge(
            $workshopUrlKeys ?? [],
            $packageKeys,
            ['AZURE_BLOB_CONTAINER_WORKSHOPS', 'AZURE_BLOB_CONTAINER_WORKSHOP', 'AZURE_BLOB_CONTAINER_WORKSHOP_IMAGES']
        )
        : $packageKeys;

    foreach ($allCheckedKeys as $key) {
        $raw = $readEnv($key);
        if ($raw !== '') {
            $rawClean = trim($raw, " \t\n\r\0\x0B\"'\\");
            if (!str_contains($rawClean, '?') && (str_starts_with($rawClean, 'http') || stripos($rawClean, '.blob.core.windows.net') !== false)) {
                throw new RuntimeException("Azure SAS URL in \${$key} is missing the SAS token query (?sp=...&sig=...). Please generate a SAS URL with Create/Write permissions in Azure.");
            }
            if (str_starts_with($rawClean, '?') || str_starts_with($rawClean, 'sp=') || str_starts_with($rawClean, 'sv=')) {
                throw new RuntimeException("Azure setting \${$key} contains only a SAS token, not the full container URL. Expected: https://<account>.blob.core.windows.net/<container>?<sas_token>");
            }
            if (stripos($rawClean, '.blob.core.windows.net') === false) {
                throw new RuntimeException("Azure setting \${$key} contains container name ('{$rawClean}') instead of a full SAS URL. Expected: https://<account>.blob.core.windows.net/<container>?<sas_token>");
            }
            throw new RuntimeException("Azure SAS URL in \${$key} is invalid. Expected format: https://<account>.blob.core.windows.net/<container>?<sas_token>");
        }
    }

    throw new RuntimeException("Azure Blob Storage for {$type} is not configured on the server. Please set AZURE_BLOB_CONTAINER_WORKSHOP_SAS_URL or AZURE_BLOB_CONTAINER_SAS_URL in the Azure Web App configuration.");
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

    $normalizedSasUrl = normalizeAzureSasUrl($containerSasUrl);
    if ($normalizedSasUrl === null) {
        throw new RuntimeException("Azure container SAS URL configuration is invalid. Expected format: https://<account>.blob.core.windows.net/<container>?<sas_token>");
    }

    $containerSasUrl = $normalizedSasUrl;
    $parts = parse_url($containerSasUrl);
    if (
        !$parts ||
        strtolower($parts['scheme'] ?? '') !== 'https' ||
        empty($parts['host']) ||
        empty($parts['path']) ||
        empty($parts['query'])
    ) {
        throw new RuntimeException('Azure container SAS URL configuration is invalid. Expected format: https://<account>.blob.core.windows.net/<container>?<sas_token>');
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

