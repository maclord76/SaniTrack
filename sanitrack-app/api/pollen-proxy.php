<?php
/**
 * Proxy PHP pour l'API Atmo France - Indices Pollen
 * 
 * Usage : 
 *   - Déposer ce fichier sur votre serveur PHP
 *   - Configurer les variables d'environnement serveur ATMO_USER et ATMO_PASS
 *   - Appeler depuis le frontend : /api/pollen-proxy.php?lat=48.8566&lon=2.3522
 */

// Nettoyer tout output parasite
if (ob_get_level()) ob_clean();
error_reporting(0);
ini_set('display_errors', 0);

// ===== CONFIGURATION =====
define('PROXY_VERSION', '2.3.1');
define('ATMO_API_HOST', 'admindata.atmo-france.org');
define('ATMO_API_BASE', 'https://' . ATMO_API_HOST);
define('CACHE_FILE', __DIR__ . '/token_cache.json');
define('DNS_CACHE_FILE', __DIR__ . '/dns_cache.json');

// =========================

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, accept, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

function envValue(string $name): string {
    $value = getenv($name);
    if ($value === false || $value === '') $value = $_ENV[$name] ?? '';
    if ($value === '') $value = $_SERVER[$name] ?? '';
    return is_string($value) ? $value : '';
}

function getServerAtmoCredentials(): array {
    return [
        'username' => envValue('ATMO_USER'),
        'password' => envValue('ATMO_PASS'),
    ];
}

/**
 * Résout le DNS avec fallback sur des serveurs DNS publics (DoH)
 * Utilise un cache pour éviter de résoudre à chaque requête
 */
function resolveAtmoDNS(): string {
    $host = ATMO_API_HOST;
    $dnsCacheFile = DNS_CACHE_FILE;
    
    // Vérifier le cache DNS
    if (file_exists($dnsCacheFile)) {
        $cache = json_decode(file_get_contents($dnsCacheFile), true);
        if ($cache && isset($cache['ip'], $cache['expires_at']) && $cache['expires_at'] > time()) {
            return $cache['ip'];
        }
    }
    
    // Essayer dns_get_record d'abord (utilise le résolveur système)
    $records = @dns_get_record($host, DNS_A);
    if ($records && isset($records[0]['ip'])) {
        $ip = $records[0]['ip'];
        file_put_contents($dnsCacheFile, json_encode([
            'ip' => $ip,
            'expires_at' => time() + 3600,
        ]));
        return $ip;
    }
    
    // Fallback: utiliser un résolveur DNS public via HTTP (DoH - DNS over HTTPS)
    $dohProviders = [
        'https://cloudflare-dns.com/dns-query?name=' . $host . '&type=A',
        'https://dns.google/resolve?name=' . $host . '&type=A',
    ];
    
    foreach ($dohProviders as $dohUrl) {
        if (function_exists('curl_version')) {
            $ch = curl_init($dohUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 5,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_HTTPHEADER => ['Accept: application/dns-json'],
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            
            if ($httpCode === 200 && $response) {
                $data = json_decode($response, true);
                if ($data && isset($data['Answer'])) {
                    foreach ($data['Answer'] as $answer) {
                        if ($answer['type'] === 1) { // Type A = IPv4
                            $ip = $answer['data'];
                            file_put_contents($dnsCacheFile, json_encode([
                                'ip' => $ip,
                                'expires_at' => time() + 3600,
                            ]));
                            return $ip;
                        }
                    }
                }
            }
        }
    }
    
    // Dernier fallback: IP connue (à mettre à jour si elle change)
    $knownIps = ['89.234.131.176'];
    foreach ($knownIps as $ip) {
        $socket = @fsockopen($ip, 443, $errno, $errstr, 2);
        if ($socket) {
            fclose($socket);
            file_put_contents($dnsCacheFile, json_encode([
                'ip' => $ip,
                'expires_at' => time() + 1800,
            ]));
            return $ip;
        }
    }
    
    throw new Exception('Impossible de résoudre le DNS pour ' . $host . ' (tous les résolveurs ont échoué)');
}

/**
 * Effectue une requête HTTP avec résolution DNS personnalisée
 * Utilise l'IP directement et ajoute l'en-tête Host pour le virtual hosting
 */
function httpRequest(string $method, string $path, array $data = null, array $headers = []): array {
    $host = ATMO_API_HOST;
    
    $defaultHeaders = [];
    if ($data !== null) {
        $jsonData = json_encode($data);
        $defaultHeaders[] = 'Content-Type: application/json';
        $defaultHeaders[] = 'Content-Length: ' . strlen($jsonData);
    }
    $allHeaders = array_merge($defaultHeaders, $headers);
    
    // Essayer curl d'abord
    if (function_exists('curl_version')) {
        $curlUrl = 'https://' . $host . $path;
        $ch = curl_init($curlUrl);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => $allHeaders,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_USERAGENT => 'Sanitrack-Proxy/' . PROXY_VERSION,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_MAXREDIRS => 3,
        ]);
        if ($data !== null) {
            curl_setopt($ch, CURLOPT_POSTFIELDS, $jsonData);
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);
        $curlErrno = curl_errno($ch);
        curl_close($ch);
        
        if ($curlErrno === 0) {
            return ['response' => $response, 'http_code' => $httpCode, 'method' => 'curl'];
        }
        
        $curlErrorMsg = $curlError;
    }
    
    // Fallback: file_get_contents
    if (ini_get('allow_url_fopen')) {
        $fgcUrl = 'https://' . $host . $path;
        $context = stream_context_create([
            'http' => [
                'method' => $method,
                'header' => implode("\r\n", $allHeaders),
                'content' => $data !== null ? $jsonData : null,
                'timeout' => 20,
                'ignore_errors' => true,
                'user_agent' => 'Sanitrack-Proxy/' . PROXY_VERSION,
            ],
            'ssl' => [
                'verify_peer' => true,
                'verify_peer_name' => true,
            ],
        ]);
        
        $response = @file_get_contents($fgcUrl, false, $context);
        $httpCode = 0;
        if (isset($http_response_header)) {
            foreach ($http_response_header as $header) {
                if (preg_match('/^HTTP\/\d\.\d (\d+)/', $header, $matches)) {
                    $httpCode = (int)$matches[1];
                    break;
                }
            }
        }
        
        if ($response !== false) {
            return ['response' => $response, 'http_code' => $httpCode, 'method' => 'file_get_contents'];
        }
        
        $error = error_get_last();
        throw new Exception('Erreur réseau vers l\'API Atmo France (curl + file_get_contents): ' . ($curlErrorMsg ?? $error['message'] ?? 'inconnue'));
    }
    
    throw new Exception('Erreur réseau vers l\'API Atmo France (curl errno ' . $curlErrno . '): ' . ($curlErrorMsg ?? 'inconnue') . ' - file_get_contents désactivé');
}

/**
 * Recupere un token JWT (cache, sans token de secours). Leve une exception claire en cas d echec.
 */
function getToken(string $username, string $password): string {
    $cacheFile = CACHE_FILE;
    if (file_exists($cacheFile)) {
        $cache = json_decode(file_get_contents($cacheFile), true);
        if ($cache && isset($cache['token'], $cache['expires_at']) && $cache['expires_at'] > time()) return $cache['token'];
    }
    if ($username === '' || $password === '') throw new Exception('Identifiants Atmo France manquants : login ou mot de passe vide.');
    $result = httpRequest('POST', '/api/login', ['username' => $username, 'password' => $password]);
    $response = $result['response']; $httpCode = $result['http_code'];
    $hint = '';
    if (strlen($password) < 8) {
        $hint = ' indice: le mdp recu ne fait que ' . strlen($password) . ' caractere(s); s il contient "#","@","*" encodez-le dans l URL (%23, %40, %2A) ou envoyez la requete en POST (corps JSON).';
    }
    if ($httpCode !== 200) throw new Exception('Echec authentification Atmo France (HTTP ' . $httpCode . '). Verifiez login/mot de passe.' . $hint . ' login="' . $username . '", len mdp=' . strlen($password) . '. Reponse: ' . mb_substr((string)$response, 0, 200));
    $data = json_decode($response, true);
    if (!$data || !isset($data['token'])) throw new Exception('Auth acceptee (200) mais aucun token.' . $hint . ' Reponse: ' . mb_substr((string)$response, 0, 300));
    $token = $data['token'];
    file_put_contents($cacheFile, json_encode(['token' => $token, 'expires_at' => time() + 23*60*60]));
    return $token;
}
function fetchPollenData(string $token, ?string $codeZone = null, ?string $date = null): array {
    $baseDate = new DateTime($date ?: date('Y-m-d'));
    $endDate = (clone $baseDate)->modify('+2 day')->format('Y-m-d');

    $params = http_build_query(array_filter([
        'format' => 'geojson',
        'code_zone' => $codeZone,
        'date' => $endDate,
        'date_historique' => $baseDate->format('Y-m-d'),
        'with_geom' => 'false',
    ]));
    
    $result = httpRequest('GET', '/api/v2/data/indices/pollens?' . $params, null, [
        'Authorization: Bearer ' . $token,
        'Accept: application/json',
    ]);
    
    $response = $result['response'];
    $httpCode = $result['http_code'];
    
    if ($httpCode !== 200) {
        throw new Exception('Erreur API Atmo France: HTTP ' . $httpCode);
    }
    
    $data = json_decode($response, true);
    if (!$data) {
        throw new Exception('Réponse API invalide');
    }
    
    return $data;
}

/**
 * Calcule la distance entre deux points (formule haversine simplifiée)
 */
function distance(float $lat1, float $lon1, float $lat2, float $lon2): float {
    return sqrt(pow($lat2 - $lat1, 2) + pow($lon2 - $lon1, 2));
}

/**
 * Mapping des taxons Atmo France vers les clés internes
 */
const TAXON_MAPPING = [
    'code_ambr' => ['key' => 'ragweed_pollen', 'name' => 'Ambroisie (Ambrosia)', 'concentration_key' => 'conc_ambr'],
    'code_arm' => ['key' => 'mugwort_pollen', 'name' => 'Armoise (Artemisia)', 'concentration_key' => 'conc_arm'],
    'code_aul' => ['key' => 'alder_pollen', 'name' => 'Aulne (Alnus)', 'concentration_key' => 'conc_aul'],
    'code_boul' => ['key' => 'birch_pollen', 'name' => 'Bouleau (Betula)', 'concentration_key' => 'conc_boul'],
    'code_gram' => ['key' => 'grass_pollen', 'name' => 'Graminées (Poaceae)', 'concentration_key' => 'conc_gram'],
    'code_oliv' => ['key' => 'olive_pollen', 'name' => 'Olivier (Olea)', 'concentration_key' => 'conc_oliv'],
];

/**
 * Catégorise un niveau d'indice pollen
 */
function getCategory(int $level): string {
    switch ($level) {
        case 1: return 'Très faible';
        case 2: return 'Faible';
        case 3: return 'Modéré';
        case 4: return 'Élevé';
        case 5: return 'Très élevé';
        case 6: return 'Extrêmement élevé';
        case 0:
        default: return 'Indisponible';
    }
}

function normalizeAtmoDate(?string $date): string {
    return $date ? substr($date, 0, 10) : '';
}

function extractZoneData(array $props): array {
    return [
        'code_zone' => $props['code_zone'] ?? '',
        'lib_zone' => $props['lib_zone'] ?? '',
        'type_zone' => $props['type_zone'] ?? '',
        'date' => $props['date_ech'] ?? $props['date'] ?? '',
        'date_ech' => $props['date_ech'] ?? null,
        'date_dif' => $props['date_dif'] ?? $props['date_diff'] ?? null,
        'date_maj' => $props['date_maj'] ?? null,
        'source' => $props['source'] ?? null,
        'aasqa' => $props['aasqa'] ?? null,
        'code_qual' => isset($props['code_qual']) ? intval($props['code_qual']) : null,
        'lib_qual' => $props['lib_qual'] ?? null,
        'coul_qual' => $props['coul_qual'] ?? null,
        'alerte' => isset($props['alerte']) ? (bool)$props['alerte'] : null,
        'pollen_resp' => $props['pollen_resp'] ?? null,
    ];
}

function extractTaxonData(array $props): array {
    $pollens = [];

    foreach (TAXON_MAPPING as $atmoKey => $mapping) {
        if (array_key_exists($atmoKey, $props) && $props[$atmoKey] !== null) {
            $level = intval($props[$atmoKey]);
            $concentrationKey = $mapping['concentration_key'];
            $pollens[] = [
                'taxon' => $mapping['key'],
                'name' => $mapping['name'],
                'level' => $level,
                'category' => getCategory($level),
                'code_key' => $atmoKey,
                'concentration_key' => $concentrationKey,
                'concentration' => array_key_exists($concentrationKey, $props) && $props[$concentrationKey] !== null
                    ? floatval($props[$concentrationKey])
                    : null,
                'concentration_unit' => 'grains/m3',
            ];
        }
    }

    return $pollens;
}

// ===== POINT D'ENTRÉE =====
    /**
     * Extrait les données pollen d'une liste de features pour une date d'échéance donnée
     */
    function extractPollenDataFromFeatures(array $features, string $targetDate, ?float $lat, ?float $lon): array {
        $result = [
            'pollen' => [],
            'zone' => null,
        ];
        
        if (empty($features)) {
            return $result;
        }
        
        // Filtrer les features par date d'échéance
        $matchingFeatures = [];
        foreach ($features as $feature) {
            $props = $feature['properties'] ?? [];
            $dateEch = $props['date_ech'] ?? $props['date'] ?? '';
            $dateEchNormalized = normalizeAtmoDate($dateEch);
            if ($dateEchNormalized === $targetDate) {
                $matchingFeatures[] = $feature;
            }
        }
        
        if (empty($matchingFeatures)) {
            return $result;
        }
        
        // Si on a des coordonnées, trouver la feature la plus proche
        if ($lat !== null && $lon !== null) {
            $closestFeature = null;
            $minDistance = PHP_FLOAT_MAX;
            
            foreach ($matchingFeatures as $feature) {
                if (isset($feature['geometry']['coordinates'])) {
                    $coords = $feature['geometry']['coordinates'];
                    $dist = distance($lat, $lon, $coords[1], $coords[0]);
                    if ($dist < $minDistance) {
                        $minDistance = $dist;
                        $closestFeature = $feature;
                    }
                }
            }
            
            $feature = $closestFeature ?? $matchingFeatures[0];
            $props = $feature['properties'];
            $result['zone'] = extractZoneData($props);
            $result['pollen'] = extractTaxonData($props);
        } else {
            $feature = $matchingFeatures[0];
            $props = $feature['properties'];
            $result['zone'] = extractZoneData($props);
            $result['pollen'] = extractTaxonData($props);
        }
        
        return $result;
    }

    function extractPollenDays(array $features, ?string $fallbackDate, ?float $lat, ?float $lon): array {
        $availableDates = [];
        foreach ($features as $feature) {
            $dateEch = $feature['properties']['date_ech'] ?? $feature['properties']['date'] ?? '';
            $dateEchNormalized = normalizeAtmoDate($dateEch);
            if ($dateEchNormalized && !in_array($dateEchNormalized, $availableDates, true)) {
                $availableDates[] = $dateEchNormalized;
            }
        }
        sort($availableDates);

        $todayDate = $availableDates[0] ?? $fallbackDate ?? date('Y-m-d');
        $tomorrowDate = $availableDates[1] ?? null;
        $afterTomorrowDate = $availableDates[2] ?? null;

        return [
            'today' => extractPollenDataFromFeatures($features, $todayDate, $lat, $lon),
            'tomorrow' => $tomorrowDate
                ? extractPollenDataFromFeatures($features, $tomorrowDate, $lat, $lon)
                : ['pollen' => [], 'zone' => null],
            'afterTomorrow' => $afterTomorrowDate
                ? extractPollenDataFromFeatures($features, $afterTomorrowDate, $lat, $lon)
                : ['pollen' => [], 'zone' => null],
            'available_dates' => array_slice($availableDates, 0, 3),
        ];
    }

try {
    // Récupérer les paramètres
    $lat = isset($_GET['lat']) ? floatval($_GET['lat']) : null;
    $lon = isset($_GET['lon']) ? floatval($_GET['lon']) : null;
    $codeZone = isset($_GET['code_zone']) ? $_GET['code_zone'] : null;
    $date = isset($_GET['date']) ? $_GET['date'] : null;
    $login = isset($_GET['login']) ? $_GET['login'] : '';
    $password = isset($_GET['password']) ? $_GET['password'] : '';
    $action = isset($_GET['action']) ? $_GET['action'] : '';
    
    // ===== ROUTE POST : LOGIN + option POLLens (identifiants en JSON, pas d encodage d URL) =====
    // Corps JSON: {"username":"...","password":"...","pollens":true,"code_zone":"76540","date":"2026-06-27"}
    // Avantage: #, @, * du mot de passe sont autorises dans le JSON.
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && $action === '') {
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $username = $input['username'] ?? $input['login'] ?? '';
        $password = $input['password'] ?? '';
        $wantPollens = !empty($input['pollens']);
        $codeZonePOST = $input['code_zone'] ?? '';
        $datePOST = $input['date'] ?? date('Y-m-d');
        $result = httpRequest('POST', '/api/login', ['username' => $username, 'password' => $password]);
        $responseData = json_decode($result['response'], true);
        $token = $responseData['token'] ?? null;
        if ($token === null || $result['http_code'] !== 200) {
            echo json_encode(['success' => false, 'step' => 'login', 'http_code' => $result['http_code'],
                'error' => 'Echec login Atmo (HTTP ' . $result['http_code'] . '). login="' . $username . '", len mdp recue=' . strlen($password) . '. Reponse: ' . mb_substr((string)$result['response'], 0, 200)],
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            exit;
        }
        file_put_contents(CACHE_FILE, json_encode(['token' => $token, 'expires_at' => time() + 23*60*60]));
        if (!$wantPollens) {
            echo json_encode(['success' => true, 'http_code' => $result['http_code'], 'token' => $token, 'api_response' => $responseData], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            exit;
        }
        try {
            $data = fetchPollenData($token, $codeZonePOST, $datePOST);
            echo json_encode(['success' => true, 'code_zone' => $codeZonePOST, 'date' => $datePOST, 'features_count' => count($data['features'] ?? []), 'api_response' => $data], JSON_UNESCAPED_UNICODE);
        } catch (Exception $e) {
            echo json_encode(['success' => false, 'step' => 'pollens', 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        }
        exit;
    }
    // ===== ROUTE GET : action=pollens (comme login.php) =====
    if ($action === 'pollens') {
        $credentials = getServerAtmoCredentials();
        $username = $credentials['username'];
        $password = $credentials['password'];
        if ($username === '' || $password === '') {
            throw new Exception('Variables d environnement serveur ATMO_USER et ATMO_PASS requises.');
        }

        $loginResult = httpRequest('POST', '/api/login', [
            'username' => $username,
            'password' => $password,
        ]);

        if ($loginResult['error'] ?? false) {
            echo json_encode([
                'success' => false,
                'step' => 'login',
                'error' => 'Erreur login : ' . $loginResult['error'],
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
                'response' => $loginResponse,
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
            (clone $baseDate)->modify('+1 day')->format('Y-m-d'),
            (clone $baseDate)->modify('+2 day')->format('Y-m-d'),
        ];

        $allFeatures = [];
        $lastHttpCode = 0;

        // Requête avec date=J+2 et date_historique=J pour récupérer les 3 jours
        $pollenUrl = ATMO_API_BASE . '/api/v2/data/indices/pollens';
        $params = [];
        if ($codeZone) $params[] = 'code_zone=' . urlencode($codeZone);
        $params[] = 'date=' . urlencode($dates[2]); // J+2
        $params[] = 'date_historique=' . urlencode($dates[0]); // J
        $params[] = 'format=' . urlencode($format);
        $params[] = 'with_geom=false';
        $pollenUrl .= '?' . implode('&', $params);

        $pollenResult = httpRequest('GET', '/api/v2/data/indices/pollens?' . implode('&', $params), null, [
            'Authorization: Bearer ' . $token,
            'Accept: application/json',
        ]);

        if ($pollenResult['error'] ?? false) {
            echo json_encode([
                'success' => false,
                'step' => 'pollens',
                'error' => 'Erreur pollens : ' . $pollenResult['error'],
            ], JSON_PRETTY_PRINT);
            exit;
        }

        $lastHttpCode = $pollenResult['http_code'];
        $pollenData = json_decode($pollenResult['response'], true);

        if ($pollenData && isset($pollenData['features'])) {
            foreach ($pollenData['features'] as $feature) {
                $props = $feature['properties'] ?? [];
                $dateEch = normalizeAtmoDate($props['date_ech'] ?? $props['date'] ?? '');
                if ($dateEch === '' || in_array($dateEch, $dates, true)) {
                    $allFeatures[] = $feature;
                }
            }

            usort($allFeatures, function ($a, $b) {
                $dateA = normalizeAtmoDate(($a['properties'] ?? [])['date_ech'] ?? ($a['properties'] ?? [])['date'] ?? '');
                $dateB = normalizeAtmoDate(($b['properties'] ?? [])['date_ech'] ?? ($b['properties'] ?? [])['date'] ?? '');
                return strcmp($dateA, $dateB);
            });
        }

        if (empty($allFeatures)) {
            echo json_encode([
                'success' => false,
                'step' => 'pollens',
                'error' => 'Aucune donnée reçue pour les 3 jours',
            ], JSON_PRETTY_PRINT);
            exit;
        }

        $mergedResponse = [
            'type' => 'FeatureCollection',
            'name' => 'national_data.national_ind_pol',
            'features' => $allFeatures,
        ];

        echo json_encode([
            'success' => true,
            'http_code' => $lastHttpCode,
            'api_response' => $mergedResponse,
        ], JSON_PRETTY_PRINT);
        exit;
    }
    
    // Action clear-cache : supprimer le cache DNS et de token
    if ($action === 'clear-cache') {
        @unlink(CACHE_FILE);
        @unlink(DNS_CACHE_FILE);
        echo json_encode([
            'success' => true,
            'message' => 'Caches du proxy supprimés avec succès (token et DNS)',
        ]);
        exit;
    }

    // Action ping : tester la connexion au proxy
    if ($action === 'ping') {
        echo json_encode([
            'success' => true,
            'proxy_version' => PROXY_VERSION,
            'php_version' => phpversion(),
            'server_time' => time(),
            'curl_enabled' => function_exists('curl_version') ? curl_version()['version'] : false,
        ]);
        exit;
    }
    
    // Action dns-check : tester la résolution DNS personnalisée
    if ($action === 'dns-check') {
        try {
            $ip = resolveAtmoDNS();
            echo json_encode([
                'success' => true,
                'host' => ATMO_API_HOST,
                'ip' => $ip,
                'method' => 'dns_personnalisé',
            ]);
        } catch (Exception $e) {
            echo json_encode([
                'success' => false,
                'host' => ATMO_API_HOST,
                'error' => $e->getMessage(),
            ]);
        }
        exit;
    }
    
    // Action test-curl : reproduire exactement la commande curl fournie par l'utilisateur
    if ($action === 'test-curl') {
        $host = ATMO_API_HOST;
        $url = ATMO_API_BASE . '/api/login';
        $postData = json_encode(['username' => $login, 'password' => $password]);
        
        $results = [];
        
        // 1. Test DNS personnalisé
        try {
            $dnsStart = microtime(true);
            $ip = resolveAtmoDNS();
            $dnsTime = round((microtime(true) - $dnsStart) * 1000);
            $results['dns_personnalise'] = [
                'host' => $host,
                'ip' => $ip,
                'time_ms' => $dnsTime,
            ];
        } catch (Exception $e) {
            $results['dns_personnalise'] = [
                'host' => $host,
                'error' => $e->getMessage(),
            ];
        }
        
        // 2. Test DNS système
        $dnsSysStart = microtime(true);
        $sysIp = gethostbyname($host);
        $dnsSysTime = round((microtime(true) - $dnsSysStart) * 1000);
        $results['dns_systeme'] = [
            'host' => $host,
            'ip' => ($sysIp === $host) ? null : $sysIp,
            'time_ms' => $dnsSysTime,
        ];
        
        // 3. Test curl avec résolution DNS personnalisée (via IP + Host header)
        if (function_exists('curl_version')) {
            $ip = $results['dns_personnalise']['ip'] ?? $results['dns_systeme']['ip'] ?? null;
            if ($ip) {
                $curlUrl = 'https://' . $host . '/api/login';
                $ch = curl_init($curlUrl);
                curl_setopt_array($ch, [
                    CURLOPT_POST => true,
                    CURLOPT_HTTPHEADER => [
                        'accept: */*',
                        'Content-Type: application/json',
                    ],
                    CURLOPT_POSTFIELDS => $postData,
                    CURLOPT_RETURNTRANSFER => true,
                    CURLOPT_TIMEOUT => 20,
                    CURLOPT_CONNECTTIMEOUT => 10,
                    CURLOPT_SSL_VERIFYPEER => true,
                    CURLOPT_SSL_VERIFYHOST => 2,
                    CURLOPT_RESOLVE => ["{$host}:443:{$ip}"],
                    CURLOPT_VERBOSE => true,
                ]);
                $verbose = fopen('php://temp', 'w+');
                curl_setopt($ch, CURLOPT_STDERR, $verbose);
                
                $curlStart = microtime(true);
                $response = curl_exec($ch);
                $curlTime = round((microtime(true) - $curlStart) * 1000);
                $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
                $curlError = curl_error($ch);
                $curlErrno = curl_errno($ch);
                $contentType = curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
                $totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
                $namelookupTime = curl_getinfo($ch, CURLINFO_NAMELOOKUP_TIME);
                $connectTime = curl_getinfo($ch, CURLINFO_CONNECT_TIME);
                $pretransferTime = curl_getinfo($ch, CURLINFO_PRETRANSFER_TIME);
                $starttransferTime = curl_getinfo($ch, CURLINFO_STARTTRANSFER_TIME);
                $redirectCount = curl_getinfo($ch, CURLINFO_REDIRECT_COUNT);
                $primaryIp = curl_getinfo($ch, CURLINFO_PRIMARY_IP);
                $primaryPort = curl_getinfo($ch, CURLINFO_PRIMARY_PORT);
                $localIp = curl_getinfo($ch, CURLINFO_LOCAL_IP);
                $localPort = curl_getinfo($ch, CURLINFO_LOCAL_PORT);
                
                rewind($verbose);
                $verboseLog = stream_get_contents($verbose);
                fclose($verbose);
                curl_close($ch);
                
                $results['curl_personnalise'] = [
                    'url' => $curlUrl,
                    'version' => curl_version()['version'],
                    'ssl_version' => curl_version()['ssl_version'],
                    'http_code' => $httpCode,
                    'total_time_s' => round($totalTime, 3),
                    'namelookup_time_s' => round($namelookupTime, 3),
                    'connect_time_s' => round($connectTime, 3),
                    'pretransfer_time_s' => round($pretransferTime, 3),
                    'starttransfer_time_s' => round($starttransferTime, 3),
                    'primary_ip' => $primaryIp,
                    'primary_port' => $primaryPort,
                    'local_ip' => $localIp,
                    'local_port' => $localPort,
                    'redirect_count' => $redirectCount,
                    'content_type' => $contentType,
                    'curl_error' => $curlError ?: null,
                    'curl_errno' => $curlErrno,
                    'response_preview' => mb_substr($response, 0, 500),
                ];
                
                // Extraire les infos SSL de la verbose log
                $verboseLines = explode("\n", $verboseLog);
                $sslInfo = [];
                foreach ($verboseLines as $line) {
                    $trimmed = trim($line);
                    if (stripos($trimmed, 'SSL') !== false || stripos($trimmed, 'TLS') !== false || stripos($trimmed, 'certificate') !== false) {
                        $sslInfo[] = $trimmed;
                    }
                }
                $results['curl_personnalise']['verbose_ssl_info'] = !empty($sslInfo) ? $sslInfo : null;
            } else {
                $results['curl_personnalise'] = ['error' => 'Impossible de résoudre le DNS'];
            }
        } else {
            $results['curl_personnalise'] = ['error' => 'curl n\'est pas disponible sur ce serveur'];
        }
        
        echo json_encode([
            'success' => true,
            'url' => $url,
            'username' => $login,
            'password_length' => strlen($password),
            'results' => $results,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    if ($login === '' || $password === '') {
        $credentials = getServerAtmoCredentials();
        $login = $credentials['username'];
        $password = $credentials['password'];
    }

    // Les identifiants serveur sont obligatoires: aucun token JWT de secours n'est embarqué.
    if (empty($login) || empty($password)) {
        throw new Exception(
            'Identifiants Atmo France requis. Configurez ATMO_USER et ATMO_PASS sur le serveur '
            . 'ou envoyez la requete en POST (corps JSON: username/password).'
        );
    }
    $token = null; // Sera obtenu via getToken() plus bas
    // Action spéciale : retourner uniquement le token JWT
    if ($action === 'login') {
        $token = getToken($login, $password);
        $cacheFile = CACHE_FILE;
        $expiresAt = time() + 23 * 60 * 60;
        if (file_exists($cacheFile)) {
            $cache = json_decode(file_get_contents($cacheFile), true);
            if ($cache && isset($cache['expires_at'])) {
                $expiresAt = $cache['expires_at'];
            }
        }
        echo json_encode([
            'success' => true,
            'token' => $token,
            'expires_at' => $expiresAt,
        ]);
        exit;
    }
    
    // Action test-api : tester un appel API complet (pour la trace)
    if ($action === 'test-api') {
        if (!isset($token)) {
            $token = getToken($login, $password);
        }
        $data = fetchPollenData($token, $codeZone, $date);
        echo json_encode([
            'success' => true,
            'features_count' => count($data['features'] ?? []),
        ]);
        exit;
    }
    
    // Action fetch-pollen : récupérer les données pollen (peut utiliser le token de secours)
    if ($action === 'fetch-pollen') {
        if (!isset($token)) {
            $token = getToken($login, $password);
        }
        $data = fetchPollenData($token, $codeZone, $date);
        $days = extractPollenDays($data['features'] ?? [], $date, $lat, $lon);
        
        echo json_encode([
            'success' => true,
            'features_count' => count($data['features'] ?? []),
            'available_dates' => $days['available_dates'],
            'today' => $days['today'],
            'tomorrow' => $days['tomorrow'],
            'afterTomorrow' => $days['afterTomorrow'],
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        exit;
    }
    
    // Obtenir le token si pas déjà défini
    if (!isset($token)) {
        $token = getToken($login, $password);
    }
    
    // Récupérer les données pollen
    $data = fetchPollenData($token, $codeZone, $date);
    
    
    $days = extractPollenDays($data['features'] ?? [], $date, $lat, $lon);
    
    $result = [
        'success' => true,
        'features_count' => count($data['features'] ?? []),
        'available_dates' => $days['available_dates'],
        'today' => $days['today'],
        'tomorrow' => $days['tomorrow'],
        'afterTomorrow' => $days['afterTomorrow'],
    ];
    
    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
