<?php
/**
 * Upload endpoint for Sanitrack integration.
 *
 * Usage:  POST /sanitrack/api/upload.php
 * Body:   JSON (export data, max 1 MB)
 * Return: { "uuid": "..." }
 */

define('DATA_DIR', dirname(__DIR__) . '/data');
define('MAX_SIZE', 1024 * 1024);
define('MAX_FILE_AGE', 7 * 24 * 60 * 60);
define('UUID_FILE_PATTERN', '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/i');

function jsonResponse(int $status, array $data): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function generateUuid(): string {
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function getUuidFromRequest(): ?string {
    if ($_SERVER['REQUEST_METHOD'] === 'GET' || $_SERVER['REQUEST_METHOD'] === 'DELETE') {
        return $_GET['uuid'] ?? null;
    }
    return null;
}

function resolveFilePath(string $uuid): ?string {
    $path = DATA_DIR . '/' . $uuid . '.json';
    return file_exists($path) ? $path : null;
}

function cleanupExpiredUuidFiles(): void {
    if (!is_dir(DATA_DIR)) {
        return;
    }

    $threshold = time() - MAX_FILE_AGE;
    $files = @scandir(DATA_DIR);
    if ($files === false) {
        return;
    }

    foreach ($files as $file) {
        if (!preg_match(UUID_FILE_PATTERN, $file)) {
            continue;
        }

        $path = DATA_DIR . '/' . $file;
        if (is_file($path) && filemtime($path) !== false && filemtime($path) < $threshold) {
            @unlink($path);
        }
    }
}

header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

cleanupExpiredUuidFiles();

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $uuid = getUuidFromRequest();
    if (!$uuid) {
        jsonResponse(400, ['error' => 'Missing uuid query parameter']);
    }

    $filePath = resolveFilePath($uuid);
    if (!$filePath) {
        jsonResponse(404, ['error' => 'Fichier introuvable']);
    }

    $content = @file_get_contents($filePath);
    if ($content === false) {
        jsonResponse(500, ['error' => "Impossible de lire le fichier"]);
    }

    $decoded = json_decode($content, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        jsonResponse(500, ['error' => 'Fichier corrompu']);
    }

    error_log("[Sanitrack] Retrieved uuid=$uuid");
    jsonResponse(200, $decoded);
}

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $uuid = getUuidFromRequest();
    if (!$uuid) {
        jsonResponse(400, ['error' => 'Missing uuid query parameter']);
    }

    $filePath = resolveFilePath($uuid);
    if (!$filePath) {
        jsonResponse(404, ['error' => 'Fichier introuvable']);
    }

    if (!@unlink($filePath)) {
        jsonResponse(500, ['error' => "Impossible de supprimer le fichier"]);
    }

    error_log("[Sanitrack] Deleted uuid=$uuid");
    jsonResponse(200, ['status' => 'deleted', 'uuid' => $uuid]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(405, ['error' => 'Method not allowed']);
}

$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (stripos($contentType, 'application/json') === false) {
    jsonResponse(400, ['error' => 'Content-Type must be application/json']);
}

$body = file_get_contents('php://input');
if ($body === false || $body === '') {
    jsonResponse(400, ['error' => 'Empty request body']);
}
if (strlen($body) > MAX_SIZE) {
    jsonResponse(413, ['error' => 'Payload too large (max 1 Mo)']);
}

$data = json_decode($body, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    jsonResponse(400, ['error' => 'Invalid JSON: ' . json_last_error_msg()]);
}

if (!is_dir(DATA_DIR)) {
    @mkdir(DATA_DIR, 0775, true);
}

$currentPerms = is_dir(DATA_DIR) ? fileperms(DATA_DIR) & 0777 : 0;

if (is_dir(DATA_DIR) && !is_writable(DATA_DIR)) {
    @chmod(DATA_DIR, 0775);
    $currentPerms = is_dir(DATA_DIR) ? fileperms(DATA_DIR) & 0777 : 0;
}

if (!is_dir(DATA_DIR) || !is_writable(DATA_DIR)) {
    $user = function_exists('posix_getpwuid') ? posix_getpwuid(posix_geteuid())['name'] ?? '?' : '?';
    $perms = is_dir(DATA_DIR) ? substr(sprintf('%o', fileperms(DATA_DIR)), -4) : '0';
    jsonResponse(500, [
        'error' => "Le dossier data/ n'est pas accessible en écriture par PHP (permissions actuelles : $perms)",
        'detail' => "Veuillez exécuter sur le serveur : sudo chown -R $user:$user " . DATA_DIR . " && sudo chmod -R u+rwX,go-rwX " . DATA_DIR . " (utilisateur PHP : $user)",
    ]);
}

$uuid = generateUuid();
$filePath = DATA_DIR . '/' . $uuid . '.json';

$written = @file_put_contents($filePath, $body, LOCK_EX);
if ($written === false) {
    $error = error_get_last();
    jsonResponse(500, [
        'error' => "Impossible d'écrire le fichier",
        'detail' => $error['message'] ?? 'Erreur inconnue',
    ]);
}

error_log("[Sanitrack] Saved uuid=$uuid size=" . strlen($body));
jsonResponse(200, ['uuid' => $uuid]);
