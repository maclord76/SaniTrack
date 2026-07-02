/**
 * Serveur proxy pour l'API Atmo France
 * Remplace login.php pour le développement avec Vite
 * 
 * Utilisation : node proxy-server.js
 * Écoute sur http://localhost:3001
 * 
 * Routes :
 *   POST /api/pollen-proxy.php  -> login
 *   GET  /api/pollen-proxy.php?action=pollens&code_zone=XXXXX&date=YYYY-MM-DD -> données pollens
 */

import http from "http";
import https from "https";

const HOST = 'admindata.atmo-france.org';
const PORT = Number(process.env.PORT || 3001);
const ATMO_USER = process.env.ATMO_USER || '';
const ATMO_PASS = process.env.ATMO_PASS || '';

// Résolution DNS via Google DNS - type AAAA pour IPv6
async function resolveDNS(hostname) {
    return new Promise((resolve) => {
        https.get(`https://dns.google/resolve?name=${hostname}&type=AAAA`, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const dnsData = JSON.parse(data);
                    if (dnsData.Answer && dnsData.Answer[0] && dnsData.Answer[0].data) {
                        resolve(dnsData.Answer[0].data);
                    } else {
                        resolve(null);
                    }
                } catch {
                    resolve(null);
                }
            });
        }).on('error', () => resolve(null));
    });
}

// Fonction pour faire une requête HTTPS avec résolution DNS forcée
function apiRequest(url, method = 'GET', headers = [], postData = null, token = null, resolvedIp = null) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        
        const options = {
            hostname: resolvedIp || urlObj.hostname,
            port: 443,
            path: urlObj.pathname + urlObj.search,
            method: method,
            headers: {},
            rejectUnauthorized: false,
        };

        // Headers par défaut
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }

        // Ajouter les headers personnalisés
        headers.forEach(h => {
            const [key, ...rest] = h.split(':');
            if (key && rest.length > 0) {
                options.headers[key.trim()] = rest.join(':').trim();
            }
        });

        // Forcer le Host header
        options.headers['Host'] = urlObj.hostname;

        if (postData) {
            options.headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    response: data,
                    http_code: res.statusCode,
                    error: null,
                });
            });
        });

        req.on('error', (err) => {
            resolve({
                response: null,
                http_code: 0,
                error: err.message,
            });
        });

        req.setTimeout(15000, () => {
            req.destroy();
            resolve({
                response: null,
                http_code: 0,
                error: 'Timeout',
            });
        });

        if (postData) {
            req.write(postData);
        }
        req.end();
    });
}

// Parse le body JSON d'une requête
function parseBody(req) {
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                resolve({});
            }
        });
    });
}

// Envoie une réponse JSON
function sendJSON(res, statusCode, data) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, accept, Authorization',
    });
    res.end(JSON.stringify(data, null, 2));
}

// Route POST /api/pollen-proxy.php -> login
async function handleLogin(req, res) {
    const body = await parseBody(req);
    const username = body.username || '';
    const password = body.password || '';

    const url = `https://${HOST}/api/login`;
    const data = JSON.stringify({ username, password });

    const result = await apiRequest(url, 'POST', [
        'accept: */*',
        'Content-Type: application/json',
        'Content-Length: ' + Buffer.byteLength(data),
    ], data);

    if (result.error) {
        sendJSON(res, 200, {
            success: false,
            error: 'Erreur requête : ' + result.error,
        });
    } else {
        let responseData = null;
        try {
            responseData = JSON.parse(result.response);
        } catch {
            responseData = { raw: result.response };
        }
        sendJSON(res, 200, {
            success: true,
            http_code: result.http_code,
            api_response: responseData,
        });
    }
}

// Route GET /api/pollen-proxy.php?action=pollens&code_zone=XXXXX&date=YYYY-MM-DD
async function handlePollens(req, res, urlObj) {
    const codeZone = urlObj.searchParams.get('code_zone') || '';
    const date = urlObj.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const format = urlObj.searchParams.get('format') || 'geojson';

    if (!ATMO_USER || !ATMO_PASS) {
        sendJSON(res, 200, {
            success: false,
            step: 'login',
            error: 'Variables d environnement ATMO_USER et ATMO_PASS requises.',
        });
        return;
    }

    // Résoudre DNS
    const ip = await resolveDNS(HOST);

    // Login pour obtenir le token
    const loginUrl = `https://${HOST}/api/login`;
    const loginData = JSON.stringify({
        username: ATMO_USER,
        password: ATMO_PASS,
    });

    const loginResult = await apiRequest(loginUrl, 'POST', [
        'accept: */*',
        'Content-Type: application/json',
        'Content-Length: ' + Buffer.byteLength(loginData),
    ], loginData, null, ip);

    if (loginResult.error) {
        sendJSON(res, 200, {
            success: false,
            step: 'login',
            error: 'Erreur login : ' + loginResult.error,
        });
        return;
    }

    let loginResponse;
    try {
        loginResponse = JSON.parse(loginResult.response);
    } catch {
        sendJSON(res, 200, {
            success: false,
            step: 'login',
            error: 'Réponse login invalide',
            response: loginResult.response,
        });
        return;
    }

    const token = loginResponse.token || null;
    if (!token) {
        sendJSON(res, 200, {
            success: false,
            step: 'login',
            error: 'Token non reçu',
            response: loginResponse,
        });
        return;
    }

    // Calculer J, J+1, J+2
    const baseDate = new Date(date + 'T00:00:00');
    const dates = [
        date,
        new Date(baseDate.getTime() + 86400000).toISOString().split('T')[0],
        new Date(baseDate.getTime() + 2 * 86400000).toISOString().split('T')[0],
    ];

    // Requête avec date=J+2 et date_historique=J
    let pollenUrl = `https://${HOST}/api/v2/data/indices/pollens`;
    const params = [];
    if (codeZone) params.push('code_zone=' + encodeURIComponent(codeZone));
    params.push('date=' + encodeURIComponent(dates[2])); // J+2
    params.push('date_historique=' + encodeURIComponent(dates[0])); // J
    params.push('format=' + encodeURIComponent(format));
    params.push('with_geom=false');
    pollenUrl += '?' + params.join('&');

    const pollenResult = await apiRequest(pollenUrl, 'GET', [
        'accept: */*',
    ], null, token, ip);

    if (pollenResult.error) {
        sendJSON(res, 200, {
            success: false,
            step: 'pollens',
            error: 'Erreur pollens : ' + pollenResult.error,
        });
        return;
    }

    let pollenData;
    try {
        pollenData = JSON.parse(pollenResult.response);
    } catch {
        sendJSON(res, 200, {
            success: false,
            step: 'pollens',
            error: 'Réponse pollens invalide',
            response: pollenResult.response,
        });
        return;
    }

    let allFeatures = [];
    if (pollenData && pollenData.features) {
        allFeatures = pollenData.features.filter((feature) => {
            const d = ((feature.properties && (feature.properties.date_ech || feature.properties.date)) || '').substring(0, 10);
            return !d || dates.includes(d);
        }).sort((a, b) => {
            const da = ((a.properties && (a.properties.date_ech || a.properties.date)) || '').substring(0, 10);
            const db = ((b.properties && (b.properties.date_ech || b.properties.date)) || '').substring(0, 10);
            return da.localeCompare(db);
        });
    }

    if (allFeatures.length === 0) {
        sendJSON(res, 200, {
            success: false,
            step: 'pollens',
            error: 'Aucune donnée reçue pour les 3 jours',
        });
        return;
    }

    const mergedResponse = {
        type: 'FeatureCollection',
        name: 'national_data.national_ind_pol',
        features: allFeatures,
    };

    sendJSON(res, 200, {
        success: true,
        http_code: pollenResult.http_code,
        api_response: mergedResponse,
    });
}

const TAXON_MAPPING = {
    code_ambr: { key: 'ragweed_pollen', name: 'Ambroisie (Ambrosia)', concentrationKey: 'conc_ambr' },
    code_arm:  { key: 'mugwort_pollen', name: 'Armoise (Artemisia)', concentrationKey: 'conc_arm' },
    code_aul:  { key: 'alder_pollen',   name: 'Aulne (Alnus)', concentrationKey: 'conc_aul' },
    code_boul: { key: 'birch_pollen',   name: 'Bouleau (Betula)', concentrationKey: 'conc_boul' },
    code_gram: { key: 'grass_pollen',   name: 'Graminées (Poaceae)', concentrationKey: 'conc_gram' },
    code_oliv: { key: 'olive_pollen',   name: 'Olivier (Olea)', concentrationKey: 'conc_oliv' },
};
const CATEGORY_LABELS = { 0:'Indisponible', 1:'Très faible', 2:'Faible', 3:'Modéré', 4:'Élevé', 5:'Très élevé', 6:'Extrêmement élevé' };
function getCategoryLabel(level) { return CATEGORY_LABELS[level] || 'Indisponible'; }

function extractDayData(features, targetDate, lat, lon) {
    const result = { pollen: [], zone: null };
    const dateStr = (targetDate || '').substring(0, 10);
    const matching = features.filter((f) => {
        const d = (f.properties.date_ech || f.properties.date || '').substring(0, 10);
        return d === dateStr;
    });
    if (matching.length === 0) return result;
    let feature = matching[0];
    if (lat != null && lon != null) {
        let best = null, bestDist = Infinity;
        for (const f of matching) {
            const c = f.geometry && f.geometry.coordinates;
            if (c) {
                const d = Math.abs(lat - c[1]) + Math.abs(lon - c[0]);
                if (d < bestDist) { bestDist = d; best = f; }
            }
        }
        if (best) feature = best;
    }
    const p = feature.properties;
    result.zone = {
        code_zone: p.code_zone || '',
        lib_zone: p.lib_zone || '',
        type_zone: p.type_zone || '',
        date: p.date_ech || p.date || '',
        date_ech: p.date_ech || null,
        date_dif: p.date_dif || p.date_diff || null,
        date_maj: p.date_maj || null,
        source: p.source || null,
        aasqa: p.aasqa || null,
        code_qual: p.code_qual != null ? parseInt(p.code_qual, 10) : null,
        lib_qual: p.lib_qual || null,
        coul_qual: p.coul_qual || null,
        alerte: p.alerte != null ? Boolean(p.alerte) : null,
        pollen_resp: p.pollen_resp || null,
    };
    for (const [atmoKey, mapping] of Object.entries(TAXON_MAPPING)) {
        if (p[atmoKey] != null) {
            const level = parseInt(p[atmoKey], 10) || 0;
            result.pollen.push({
                taxon: mapping.key,
                name: mapping.name,
                level,
                category: getCategoryLabel(level),
                code_key: atmoKey,
                concentration_key: mapping.concentrationKey,
                concentration: p[mapping.concentrationKey] != null ? Number(p[mapping.concentrationKey]) : null,
                concentration_unit: 'grains/m3',
            });
        }
    }
    return result;
}

// Route GET ?action=fetch-pollen&login=..&password=..&code_zone=..&date=..
// Utilise les identifiants passés en paramètres et renvoie les indices J, J+1 et J+2.
async function handleFetchPollen(req, res, urlObj) {
    const login = urlObj.searchParams.get('login') || '';
    const password = urlObj.searchParams.get('password') || '';
    const codeZone = urlObj.searchParams.get('code_zone') || '';
    const date = urlObj.searchParams.get('date') || new Date().toISOString().split('T')[0];
    const lat = urlObj.searchParams.get('lat') ? parseFloat(urlObj.searchParams.get('lat')) : null;
    const lon = urlObj.searchParams.get('lon') ? parseFloat(urlObj.searchParams.get('lon')) : null;

    if (!login || !password) { sendJSON(res, 200, { success: false, error: 'Identifiants Atmo France manquants.' }); return; }
    if (!codeZone) { sendJSON(res, 200, { success: false, error: 'Code INSEE de la commune manquant.' }); return; }

    const ip = await resolveDNS(HOST);
    const loginUrl = `https://${HOST}/api/login`;
    const loginData = JSON.stringify({ username: login, password });
    const loginResult = await apiRequest(loginUrl, 'POST', ['accept: */*', 'Content-Type: application/json', 'Content-Length: ' + Buffer.byteLength(loginData)], loginData, null, ip);
    if (loginResult.error) { sendJSON(res, 200, { success: false, error: 'Erreur réseau login : ' + loginResult.error }); return; }
    let loginResp = null; try { loginResp = JSON.parse(loginResult.response); } catch { loginResp = {}; }
    const token = loginResp.token || null;
    if (!token || loginResult.http_code !== 200) {
        sendJSON(res, 200, { success: false, error: 'Echec login Atmo (HTTP ' + loginResult.http_code + '). login="' + login + '", len mdp=' + (password ? password.length : 0) + '. Reponse: ' + (loginResult.response || '').substring(0, 200) });
        return;
    }

    const baseDate = new Date(date + 'T00:00:00');
    const endDate = new Date(baseDate.getTime() + 2 * 86400000).toISOString().split('T')[0];
    const pollenParams = new URLSearchParams({
        format: 'geojson',
        code_zone: codeZone,
        date: endDate,
        date_historique: date,
        with_geom: 'false',
    });
    const pollenUrl = `https://${HOST}/api/v2/data/indices/pollens?${pollenParams.toString()}`;
    const pollenResult = await apiRequest(pollenUrl, 'GET', ['accept: */*'], null, token, ip);
    if (pollenResult.error) { sendJSON(res, 200, { success: false, error: 'Erreur réseau pollens : ' + pollenResult.error }); return; }
    if (pollenResult.http_code !== 200) { sendJSON(res, 200, { success: false, error: 'Erreur API Atmo France: HTTP ' + pollenResult.http_code }); return; }
    let pollenData = null; try { pollenData = JSON.parse(pollenResult.response); } catch { sendJSON(res, 200, { success: false, error: 'Réponse pollens invalide (JSON).' }); return; }

    const features = (pollenData && pollenData.features) || [];
    const dates = [];
    for (const f of features) { const d = (f.properties.date_ech || f.properties.date || '').substring(0, 10); if (d && !dates.includes(d)) dates.push(d); }
    dates.sort();
    const todayDate = dates[0] || date;
    const tomorrowDate = dates[1] || null;
    const afterTomorrowDate = dates[2] || null;
    const today = extractDayData(features, todayDate, lat, lon);
    const tomorrow = tomorrowDate ? extractDayData(features, tomorrowDate, lat, lon) : { pollen: [], zone: null };
    const afterTomorrow = afterTomorrowDate ? extractDayData(features, afterTomorrowDate, lat, lon) : { pollen: [], zone: null };
    sendJSON(res, 200, {
        success: true,
        features_count: features.length,
        available_dates: dates.slice(0, 3),
        today,
        tomorrow,
        afterTomorrow,
    });
}
// Serveur HTTP
const server = http.createServer(async (req, res) => {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, accept, Authorization');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    const urlObj = new URL(req.url, `http://localhost:${PORT}`);

    // Route: POST /api/pollen-proxy.php -> login
    if (req.method === 'POST' && urlObj.pathname === '/api/pollen-proxy.php') {
        await handleLogin(req, res);
        return;
    }

    // Route: GET /api/pollen-proxy.php?action=pollens&code_zone=XXXXX&date=YYYY-MM-DD
    if (req.method === 'GET' && urlObj.pathname === '/api/pollen-proxy.php' && urlObj.searchParams.get('action') === 'pollens') {
        await handlePollens(req, res, urlObj);
        return;
    }
// Route: GET ?action=fetch-pollen&login=..&password=..&code_zone=..&date=..
    if (req.method === 'GET' && urlObj.pathname === '/api/pollen-proxy.php' && urlObj.searchParams.get('action') === 'fetch-pollen') {
        await handleFetchPollen(req, res, urlObj);
        return;
    }

    // Route par défaut
    sendJSON(res, 200, {
        error: 'Utilisez POST pour login, GET ?action=pollens ou ?action=fetch-pollen (login/password/code_zone/date).',
    });
});

server.listen(PORT, () => {
    console.log(`✅ Proxy Atmo démarré sur http://localhost:${PORT}`);
    console.log(`   POST /api/pollen-proxy.php  -> login`);
    console.log(`   GET  /api/pollen-proxy.php?action=pollens&code_zone=XXXXX&date=YYYY-MM-DD -> pollens`);
});
