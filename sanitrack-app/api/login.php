<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, accept, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$host = 'admindata.atmo-france.org';

function envValue(string $name): string {
    $value = getenv($name);
    if ($value === false || $value === '') $value = $_ENV[$name] ?? '';
    if ($value === '') $value = $_SERVER[$name] ?? '';
    return is_string($value) ? $value : '';
}

// Résolution DNS via Google DNS - type AAAA pour IPv6
$dnsResult = @file_get_contents('https://dns.google/resolve?name=' . $host . '&type=AAAA');
$ip = null;

if ($dnsResult !== false) {
    $dnsData = json_decode($dnsResult, true);
    if (isset($dnsData['Answer'][0]['data'])) {
        $ip = $dnsData['Answer'][0]['data'];
    }
}

// Fallback IPv6
if (!$ip) {
    $ip = '2a00:5881:9040:103:c::176';
}

// Fonction pour faire une requête cURL avec résolution DNS forcée
function apiRequest($url, $method = 'GET', $headers = [], $postData = null, $token = null) {
    global $host, $ip;
    
    $ch = curl_init($url);
    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_VERBOSE => true,
        CURLOPT_RESOLVE => [$host . ':443:[' . $ip . ']']
    ];

    if ($method === 'POST') {
        $options[CURLOPT_POST] = true;
        if ($postData) {
            $options[CURLOPT_POSTFIELDS] = $postData;
        }
    }

    if ($token) {
        $headers[] = 'Authorization: Bearer ' . $token;
    }

    if (!empty($headers)) {
        $options[CURLOPT_HTTPHEADER] = $headers;
    }

    curl_setopt_array($ch, $options);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    $errorNo = curl_errno($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);

    return [
        'response' => $response,
        'http_code' => $httpCode,
        'error' => $error,
        'error_no' => $errorNo,
        'info' => $info
    ];
}

// Route: POST /login.php -> login
if ($_SERVER['REQUEST_METHOD'] === 'POST' && !isset($_GET['action'])) {
    $input = json_decode(file_get_contents('php://input'), true);
    $username = $input['username'] ?? '';
    $password = $input['password'] ?? '';

    $url = 'https://' . $host . '/api/login';
    $data = json_encode(['username' => $username, 'password' => $password]);

    $result = apiRequest($url, 'POST', [
        'accept: */*',
        'Content-Type: application/json',
        'Content-Length: ' . strlen($data)
    ], $data);

    if ($result['error']) {
        echo json_encode([
            'success' => false,
            'error' => 'Erreur cURL : ' . $result['error'],
            'error_no' => $result['error_no']
        ], JSON_PRETTY_PRINT);
    } else {
        $responseData = json_decode($result['response'], true);
        echo json_encode([
            'success' => true,
            'http_code' => $result['http_code'],
            'api_response' => $responseData
        ], JSON_PRETTY_PRINT);
    }
    exit;
}

// Route: GET /login.php?action=pollens&code_zone=XXXXX&date=YYYY-MM-DD
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action']) && $_GET['action'] === 'pollens') {
    // D'abord, login pour obtenir le token
    $loginUrl = 'https://' . $host . '/api/login';
    $atmoUser = envValue('ATMO_USER');
    $atmoPass = envValue('ATMO_PASS');
    if ($atmoUser === '' || $atmoPass === '') {
        echo json_encode([
            'success' => false,
            'step' => 'login',
            'error' => 'Variables d environnement serveur ATMO_USER et ATMO_PASS requises.'
        ], JSON_PRETTY_PRINT);
        exit;
    }
    $loginData = json_encode([
        'username' => $atmoUser,
        'password' => $atmoPass
    ]);

    $loginResult = apiRequest($loginUrl, 'POST', [
        'accept: */*',
        'Content-Type: application/json',
        'Content-Length: ' . strlen($loginData)
    ], $loginData);

    if ($loginResult['error']) {
        echo json_encode([
            'success' => false,
            'step' => 'login',
            'error' => 'Erreur login : ' . $loginResult['error']
        ], JSON_PRETTY_PRINT);
        exit;
    }

    $loginResponse = json_decode($loginResult['response'], true);
    $token = $loginResponse['token'] ?? null;

    if (!$token) {
        echo json_encode([
            'success' => false,
            'step' => 'login',
            'error' => 'Token non reçu',
            'response' => $loginResponse
        ], JSON_PRETTY_PRINT);
        exit;
    }

    // Construire la requête pollens
    $codeZone = $_GET['code_zone'] ?? '';
    $date = $_GET['date'] ?? date('Y-m-d');
    $format = $_GET['format'] ?? 'geojson';

    // Calculer J, J+1, J+2 à partir de la date de base
    $baseDate = new DateTime($date);
    $dates = [
        $baseDate->format('Y-m-d'),
        (new DateTime($date))->modify('+1 day')->format('Y-m-d'),
        (new DateTime($date))->modify('+2 day')->format('Y-m-d')
    ];

    $allFeatures = [];
    $lastHttpCode = 0;

    // Requête avec date=J+2 et date_historique=J pour récupérer les 3 jours
    $pollenUrl = 'https://' . $host . '/api/v2/data/indices/pollens';
    $params = [];
    if ($codeZone) $params[] = 'code_zone=' . urlencode($codeZone);
    $params[] = 'date=' . urlencode($dates[2]); // J+2
    $params[] = 'date_historique=' . urlencode($dates[0]); // J
    $params[] = 'format=' . urlencode($format);
    $params[] = 'with_geom=false';
    $pollenUrl .= '?' . implode('&', $params);

    $pollenResult = apiRequest($pollenUrl, 'GET', [
        'accept: */*'
    ], null, $token);

    if ($pollenResult['error']) {
        echo json_encode([
            'success' => false,
            'step' => 'pollens',
            'error' => 'Erreur pollens : ' . $pollenResult['error']
        ], JSON_PRETTY_PRINT);
        exit;
    }

    $lastHttpCode = $pollenResult['http_code'];
    $pollenData = json_decode($pollenResult['response'], true);

    if ($pollenData && isset($pollenData['features'])) {
        // Prendre les 3 premiers features (J, J+1, J+2)
        $allFeatures = array_slice($pollenData['features'], 0, 3);
        // Forcer date_ech pour chaque jour
        foreach ($allFeatures as $i => $feature) {
            $feature['properties']['date_ech'] = $dates[$i] ?? $dates[0];
            $allFeatures[$i] = $feature;
        }
    }

    if (empty($allFeatures)) {
        echo json_encode([
            'success' => false,
            'step' => 'pollens',
            'error' => 'Aucune donnée reçue pour les 3 jours'
        ], JSON_PRETTY_PRINT);
        exit;
    }

    $mergedResponse = [
        'type' => 'FeatureCollection',
        'name' => 'national_data.national_ind_pol',
        'features' => $allFeatures
    ];

    echo json_encode([
        'success' => true,
        'http_code' => $lastHttpCode,
        'api_response' => $mergedResponse
    ], JSON_PRETTY_PRINT);
    exit;
}

// Route par défaut
echo json_encode([
    'error' => 'Utilisez POST pour login ou GET ?action=pollens&code_zone=CODE_INSEE&date=YYYY-MM-DD pour les pollens'
], JSON_PRETTY_PRINT);
