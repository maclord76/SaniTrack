/**
 * Service d'authentification Atmo France
 * 
 * Gère l'obtention et le stockage du token JWT Atmo France
 * pour les appels API directs (autres verbes que GET).
 * 
 * Appelle directement l'API Atmo France (POST /api/login) pour obtenir un token JWT.
 * Si l'appel direct échoue (CORS), utilise le proxy PHP comme fallback.
 */

const ATMO_API_BASE = 'https://admindata.atmo-france.org/api';
const PROXY_BASE = 'https://maclord.fr/sanitrack/api/pollen-proxy.php';
const TOKEN_STORAGE_KEY = 'atmo_token';
const TOKEN_EXPIRY_KEY = 'atmo_token_expires';

export interface AtmoTokenResponse {
  success: boolean;
  token?: string;
  expires_at?: number;
  error?: string;
}

/**
 * Appelle directement l'API Atmo France pour obtenir un token JWT
 */
async function loginDirect(login: string, password: string): Promise<AtmoTokenResponse> {
  const response = await fetch(`${ATMO_API_BASE}/login`, {
    method: 'POST',
    headers: {
      'accept': '*/*',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      username: login,
      password: password,
    }),
    signal: AbortSignal.timeout(10000),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || data.message || `HTTP ${response.status}`);
  }

  // L'API Atmo retourne directement le token dans la réponse
  // Format attendu : { token: "eyJ...", expires_at: 1234567890 }
  return {
    success: true,
    token: data.token,
    expires_at: data.expires_at,
  };
}

/**
 * Appelle le proxy PHP pour obtenir un token JWT (fallback si CORS bloque l'appel direct)
 */
async function loginViaProxy(login: string, password: string): Promise<AtmoTokenResponse> {
  const url = `${PROXY_BASE}?action=login&login=${encodeURIComponent(login)}&password=${encodeURIComponent(password)}`;
  
  const response = await fetch(url, {
    signal: AbortSignal.timeout(15000),
  });
  const data: AtmoTokenResponse = await response.json();

  if (!response.ok || !data.success || !data.token) {
    throw new Error(data.error || 'Erreur d\'authentification Atmo France via proxy');
  }

  return data;
}

/**
 * Récupère un token JWT Atmo France
 * - Vérifie d'abord le cache localStorage
 * - Si expiré ou absent, appelle d'abord l'API Atmo France directement
 * - Si l'appel direct échoue (CORS), utilise le proxy PHP comme fallback
 */
export async function getAtmoToken(login: string, password: string): Promise<string> {
  // Vérifier le cache localStorage
  const cachedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const cachedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  
  if (cachedToken && cachedExpiry) {
    const expiry = parseInt(cachedExpiry, 10);
    // Garder une marge de sécurité de 5 minutes
    if (expiry > Date.now() + 5 * 60 * 1000) {
      return cachedToken;
    }
  }

  let data: AtmoTokenResponse;

  // Essayer d'abord l'appel direct à l'API Atmo France
  try {
    data = await loginDirect(login, password);
    console.log('Token JWT obtenu directement depuis l\'API Atmo France');
  } catch (directErr) {
    // Si l'appel direct échoue (CORS ou autre), essayer via le proxy PHP
    console.warn('Appel direct à l\'API Atmo France échoué, utilisation du proxy PHP:', directErr);
    try {
      data = await loginViaProxy(login, password);
      console.log('Token JWT obtenu via le proxy PHP');
    } catch (proxyErr) {
      throw new Error(
        `Authentification Atmo France impossible (direct et proxy). ` +
        `Direct: ${(directErr as Error).message}. ` +
        `Proxy: ${(proxyErr as Error).message}`
      );
    }
  }

  // Stocker dans localStorage
  localStorage.setItem(TOKEN_STORAGE_KEY, data.token!);
  if (data.expires_at) {
    localStorage.setItem(TOKEN_EXPIRY_KEY, String(data.expires_at * 1000));
  }

  return data.token!;
}

/**
 * Efface le token JWT stocké
 */
export function clearAtmoToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Vérifie si un token valide est présent
 */
export function hasValidToken(): boolean {
  const cachedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  const cachedExpiry = localStorage.getItem(TOKEN_EXPIRY_KEY);
  
  if (!cachedToken || !cachedExpiry) return false;
  
  const expiry = parseInt(cachedExpiry, 10);
  return expiry > Date.now() + 5 * 60 * 1000;
}