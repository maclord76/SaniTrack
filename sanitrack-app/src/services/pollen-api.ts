/**
 * Service d'API Pollen via le proxy PHP local (login.php)
 * 
 * Tous les appels à l'API Atmo France passent par le fichier login.php
 * qui gère la résolution DNS, l'authentification et la récupération
 * des données polliniques au format GeoJSON (3 jours : J, J+1, J+2).
 */

// URL du proxy PHP local (pollen-proxy.php)
// URL du proxy PHP local (pollen-proxy.php).
// Construite relativement à l'emplacement courant du document afin de tenir
// compte d'un éventuel sous-dossier de déploiement (ex: /sanitrack/).
// - En dev (Vite) : http://localhost:5173/api/pollen-proxy.php (proxy Vite -> :3001)
// - En prod       : https://maclord.fr/sanitrack/api/pollen-proxy.php
function proxyBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    return new URL('api/pollen-proxy.php', window.location.href).toString();
  }
  return '/api/pollen-proxy.php';
}

export interface PollenTaxon {
  taxon: string;
  name: string;
  level: number;
  category: string;
  code_key?: string;
  concentration_key?: string;
  concentration?: number | null;
  concentration_unit?: string;
}

export interface PollenZone {
  code_zone: string;
  lib_zone: string;
  date: string;
  type_zone?: string;
  date_ech?: string | null;
  date_dif?: string | null;
  date_maj?: string | null;
  source?: string | null;
  aasqa?: string | null;
  code_qual?: number | null;
  lib_qual?: string | null;
  coul_qual?: string | null;
  alerte?: boolean | null;
  pollen_resp?: string | null;
}

export interface PollenDayData {
  pollen: PollenTaxon[];
  zone: PollenZone | null;
}

export interface PollenResponse {
  success: boolean;
  features_count?: number;
  available_dates?: string[];
  today: PollenDayData;
  tomorrow: PollenDayData;
  afterTomorrow?: PollenDayData;
  error?: string;
}

// Types pour le format GeoJSON brut (3 jours)
export interface PollenFeatureProperties {
  code_zone?: string;
  lib_zone?: string;
  nom_commune?: string;
  commune?: string;
  type_zone?: string;
  source?: string;
  aasqa?: string;
  date_maj?: string;
  date_ech?: string;
  date_dif?: string;
  date_diff?: string;
  date?: string;
  code_qual?: number;
  lib_qual?: string;
  coul_qual?: string;
  alerte?: boolean;
  pollen_resp?: string;
  code_ambr?: number;
  conc_ambr?: number;
  code_arm?: number;
  conc_arm?: number;
  code_aul?: number;
  conc_aul?: number;
  code_boul?: number;
  conc_boul?: number;
  code_gram?: number;
  conc_gram?: number;
  code_oliv?: number;
  conc_oliv?: number;
  [key: string]: unknown;
}

export interface PollenFeature {
  type?: string;
  geometry?: {
    type?: string;
    coordinates?: number[];
  };
  properties: PollenFeatureProperties;
}

export interface PollenGeoJSONResponse {
  type?: string;
  name?: string;
  features: PollenFeature[];
}

export interface PollenRawResponse {
  success: boolean;
  features_count?: number;
  api_response?: PollenGeoJSONResponse;
  error?: string;
}

/**
 * Récupère les données pollen pour des coordonnées géographiques
 * via le proxy PHP local (login.php).
 * 
 * Note : login.php utilise un code_zone (code INSEE), pas des coordonnées.
 * Cette fonction n'est pas supportée directement par login.php.
 */
export async function fetchPollenData(
  _lat: number,
  _lon: number,
  _login: string,
  _password: string
): Promise<PollenResponse> {
  throw new Error('fetchPollenData par coordonnées non supporté. Utilisez fetchPollenRawData avec un code INSEE.');
}

/**
 * Récupère les données pollen pour un code postal
 * via le proxy PHP local (login.php).
 * 
 * Note : login.php utilise un code_zone (code INSEE), pas un code postal.
 * Cette fonction n'est pas supportée directement par login.php.
 */
export async function fetchPollenDataByCodeZone(
  _codeZone: string,
  _login: string,
  _password: string
): Promise<PollenResponse> {
  throw new Error('fetchPollenDataByCodeZone non supporté. Utilisez fetchPollenRawData avec un code INSEE.');
}

/**
 * Récupère les données pollen brutes au format GeoJSON (3 jours : J, J+1, J+2)
 * en appelant directement login.php avec l'action 'pollens'.
 * 
 * login.php gère :
 * 1. L'authentification automatique (username/password hardcodés dans login.php)
 * 2. La récupération des données sur 3 jours (J, J+1, J+2)
 * 3. Le format GeoJSON complet avec tous les champs (code_qual, conc_*, alerte, etc.)
 */
export async function fetchPollenRawData(
  codeZone: string,
  _login: string,
  _password: string,
  date?: string
): Promise<PollenRawResponse> {
  const params = new URLSearchParams({
    action: 'pollens',
    code_zone: codeZone,
  });

  if (date) {
    params.set('date', date);
  }

  const url = `${proxyBaseUrl()}?${params.toString()}`;

  const response = await fetch(url, {
    signal: AbortSignal.timeout(60000),
  });

  if (!response.ok) {
    const text = await response.text();
    let errorMsg = `Erreur HTTP ${response.status}`;
    try {
      const data = JSON.parse(text);
      if (data?.error) {
        errorMsg = data.error;
      }
    } catch {
      // Utiliser le message d'erreur HTTP par défaut
    }
    throw new Error(errorMsg);
  }

  const data = await response.json();

  if (!data?.success) {
    throw new Error(data?.error || 'Réponse invalide du proxy');
  }

  // login.php retourne déjà le format GeoJSON complet dans api_response
  // avec les features pour J, J+1, J+2
  return {
    success: true,
    features_count: data.api_response?.features?.length || 0,
    api_response: data.api_response,
  };
}

/**
 * Vérifie que le proxy est accessible
 */
export async function pingProxy(): Promise<boolean> {
  try {
    const response = await fetch(proxyBaseUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'test', password: 'test' }),
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();
    return data?.success === true || data?.http_code !== undefined;
  } catch {
    return false;
  }
}

/**
 * Vide les caches du proxy (token et DNS)
 * Note : login.php n'a pas de cache explicite, cette fonction est un no-op.
 */
export async function clearProxyCache(): Promise<boolean> {
  return true;
}

export interface LoginAtmoResponse {
  url: string;
  http_status: number;
  http_status_text: string;
  content_type: string | null;
  content_length: string | null;
  response: {
    success?: boolean;
    token?: string;
    error?: string;
    [key: string]: unknown;
  };
}

/**
 * Appelle l'action login du proxy PHP local (login.php)
 * 
 * login.php attend une requête POST avec un body JSON contenant
 * username et password.
 */
export async function loginAtmo(login: string, password: string): Promise<LoginAtmoResponse> {
  const url = proxyBaseUrl();

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'accept': '*/*',
    },
    body: JSON.stringify({ username: login, password }),
    signal: AbortSignal.timeout(30000),
  });

  const text = await response.text();
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    data = { raw_response: text };
  }

  return {
    url,
    http_status: response.status,
    http_status_text: response.statusText,
    content_type: response.headers.get('content-type'),
    content_length: response.headers.get('content-length'),
    response: data,
  };
}
// =============================================================================
//  Échelle officielle Atmo France (notice Atmo Data 1er avril 2025)
//  Utile côté front car la "category" renvoyée par le proxy n'est pas fiable.
// =============================================================================

export interface PollenCategoryInfo {
  label: string;
  color: string;
}

export function getPollenCategoryInfo(level: number): PollenCategoryInfo {
  switch (level) {
    case 0:
      return { label: 'Indisponible', color: '#DDDDDD' };
    case 1:
      return { label: 'Très faible', color: '#50F0E6' };
    case 2:
      return { label: 'Faible', color: '#50CCAA' };
    case 3:
      return { label: 'Modéré', color: '#F0E641' };
    case 4:
      return { label: 'Élevé', color: '#FF5050' };
    case 5:
      return { label: 'Très élevé', color: '#960032' };
    case 6:
      return { label: 'Extrêmement élevé', color: '#872181' };
    default:
      return { label: 'Indisponible', color: '#DDDDDD' };
  }
}

/**
 * Renvoie l'URL du pictogramme SVG Atmo (1 à 6) correspondant au niveau.
 * Construit relativement au base-path de l'app (ex: /sanitrack/ en prod)
 * pour fonctionner quel que soit le sous-dossier de déploiement.
 */
export function getPollenIndiceImage(level: number): string {
  const n = Math.max(1, Math.min(6, level));
  const base = import.meta.env.BASE_URL || '/';
  return `${base}images/pollens/indice_interpollen_${n}.svg`;
}

/**
 * Indice pollen global d'une journée : niveau le plus dégradé (max) des taxons.
 * Retourne 0 si aucun taxon n'est disponible.
 */
export function getOverallPollenLevel(pollens: PollenTaxon[]): number {
  if (!pollens.length) return 0;
  return pollens.reduce((max, p) => (p.level > max ? p.level : max), 0);
}

/**
 * Récupère les indices pollen (aujourd'hui + demain) pour un code INSEE.
 *
 * Utilise la route GET ?action=fetch-pollen du proxy. Les paramètres sont
 * construits avec URLSearchParams ce qui encode automatiquement les caractères
 * spéciaux du mot de passe (# -> %23, @ -> %40, * -> %2A).
 */
export async function fetchPollenIndices(
  login: string,
  password: string,
  codeZone: string,
  date?: string,
): Promise<PollenResponse> {
  if (!login || !password) {
    throw new Error('Identifiants Atmo France manquants (login ou mot de passe).');
  }
  if (!codeZone) {
    throw new Error('Code INSEE de la commune manquant.');
  }

  const params = new URLSearchParams({
    action: 'fetch-pollen',
    login,
    password,
    code_zone: codeZone,
  });
  if (date) {
    params.set('date', date);
  }

  const url = `${proxyBaseUrl()}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(60000),
    });
  } catch (err) {
    throw new Error(
      'Impossible de joindre le proxy pollen (réseau). ' +
      'En dev, lancez le serveur proxy : "node proxy-server.js". ' +
      'Détail : ' + (err as Error).message,
    );
  }

  // On lit toujours le corps en texte pour détecter le HTML (page d'erreur,
  // SPA fallback, 404 serveur…) avant d'essayer de parser du JSON.
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  // Réponse HTML = le proxy n'est pas joignable / mal configuré
  const looksHtml =
    contentType.includes('text/html') ||
    text.trimStart().startsWith('<!DOCTYPE') ||
    text.trimStart().startsWith('<html') ||
    text.trimStart().startsWith('<?xml');

  if (!response.ok || looksHtml) {
    if (looksHtml) {
      throw new Error(
        response.status === 404
          ? 'Proxy pollen introuvable (HTTP 404). En dev, démarrer "node proxy-server.js" ; en prod, vérifier que pollen-proxy.php est bien déployé et exécuté par PHP.'
          : "Le proxy pollen a renvoye une page HTML au lieu de JSON (HTTP " + response.status + "). URL appelee : " + url + ". En dev lancez node proxy-server.js ; en prod, verifiez que api/pollen-proxy.php est servi depuis le meme dossier que lapp et que PHP est actif."
      );
    }
    // Réponse non-HTML mais en erreur : tenter d'extraire un message JSON
    let errorMsg = `Erreur HTTP ${response.status}`;
    try {
      const data = JSON.parse(text);
      if (data?.error) errorMsg = data.error;
    } catch {
      // message HTTP par défaut
    }
    throw new Error(errorMsg);
  }

  // Réponse OK : parser le JSON
  let data: PollenResponse;
  try {
    data = JSON.parse(text) as PollenResponse;
  } catch {
    throw new Error(
      'Réponse du proxy pollen illisible (JSON invalide). Contenu reçu : ' +
      text.substring(0, 200),
    );
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Réponse invalide du proxy pollen.');
  }

  return data;
}
