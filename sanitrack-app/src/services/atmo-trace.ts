/**
 * Service de trace de connexion Atmo France
 * 
 * Permet de diagnostiquer les problèmes de connexion avec le serveur Atmo France
 * en effectuant une série de tests et en retournant un rapport détaillé.
 */

const PROXY_BASE = 'https://maclord.fr/sanitrack/api/pollen-proxy.php';
const ATMO_API_BASE = 'https://admindata.atmo-france.org/api';
const ATMO_HOST = 'admindata.atmo-france.org';

export interface TraceStep {
  label: string;
  status: 'success' | 'error' | 'warning' | 'info';
  detail: string;
  duration?: number;
}

export interface TraceReport {
  timestamp: string;
  steps: TraceStep[];
  summary: {
    total: number;
    success: number;
    error: number;
    warning: number;
  };
}

/**
 * Mesure le temps d'exécution d'une fonction
 */
async function timedStep<T>(label: string, fn: () => Promise<T>, onResult: (step: TraceStep) => void): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = Math.round(performance.now() - start);
    onResult({
      label,
      status: 'success',
      detail: `OK (${duration}ms)`,
      duration,
    });
    return result;
  } catch (err) {
    const duration = Math.round(performance.now() - start);
    const message = err instanceof Error ? err.message : String(err);
    onResult({
      label,
      status: 'error',
      detail: `Échec (${duration}ms) : ${message}`,
      duration,
    });
    throw err;
  }
}

/**
 * Résout un nom d'hôte via l'API DNS-over-HTTPS de Cloudflare
 */
async function resolveDNS(hostname: string): Promise<string> {
  const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${hostname}&type=A`, {
    headers: { 'Accept': 'application/dns-json' },
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`DNS HTTP ${res.status}`);
  const data = await res.json();
  if (!data.Answer || data.Answer.length === 0) {
    throw new Error(`Aucune adresse IP trouvée pour ${hostname}`);
  }
  return data.Answer.map((a: { data: string }) => a.data).join(', ');
}

/**
 * Exécute une trace complète de connexion au serveur Atmo France
 */
export async function runAtmoTrace(login: string, password: string): Promise<TraceReport> {
  const steps: TraceStep[] = [];
  const timestamp = new Date().toISOString();

  const addStep = (step: TraceStep) => steps.push(step);

  // 1. Vérifier la connexion internet de base
  await timedStep('Connexion Internet', async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch('https://8.8.8.8', {
        mode: 'no-cors',
        signal: controller.signal,
      });
      addStep({
        label: 'Ping DNS Google (8.8.8.8)',
        status: 'success',
        detail: 'Accessible',
      });
    } finally {
      clearTimeout(timeout);
    }
  }, addStep).catch(() => {
    addStep({
      label: 'Ping DNS Google (8.8.8.8)',
      status: 'error',
      detail: 'Inaccessible',
    });
  });

  // 2. Résolution DNS du serveur Atmo via DNS-over-HTTPS Cloudflare
  await timedStep('Résolution DNS Atmo France', async () => {
    const ips = await resolveDNS(ATMO_HOST);
    addStep({
      label: `DNS ${ATMO_HOST}`,
      status: 'success',
      detail: `Résolu : ${ips}`,
    });
  }, addStep).catch((err) => {
    addStep({
      label: `DNS ${ATMO_HOST}`,
      status: 'error',
      detail: `Échec : ${err instanceof Error ? err.message : String(err)}`,
    });
  });

  // 3. Test de connexion directe au serveur Atmo (sans auth)
  await timedStep('Connexion au serveur Atmo France', async () => {
    const res = await fetch(`https://${ATMO_HOST}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' }),
      signal: AbortSignal.timeout(10000),
    });
    if (res.status === 401 || res.status === 400) {
      addStep({
        label: `Serveur ${ATMO_HOST} joignable`,
        status: 'success',
        detail: `Réponse reçue (HTTP ${res.status})`,
      });
    } else {
      addStep({
        label: `Serveur ${ATMO_HOST} joignable`,
        status: 'info',
        detail: `Réponse inattendue (HTTP ${res.status})`,
      });
    }
  }, addStep).catch((err) => {
    addStep({
      label: `Serveur ${ATMO_HOST} joignable`,
      status: 'error',
      detail: `Impossible de joindre le serveur : ${err instanceof Error ? err.message : String(err)}`,
    });
  });

  // 3b. Test de connexion via un proxy CORS (pour vérifier si le serveur répond depuis une autre IP)
  await timedStep('Test via proxy CORS externe', async () => {
    const corsProxy = 'https://api.allorigins.win/raw?url=';
    const testUrl = `https://${ATMO_HOST}/api/login`;
    const res = await fetch(corsProxy + encodeURIComponent(testUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: '' }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 401 || res.status === 400) {
      addStep({
        label: 'Serveur Atmo via proxy CORS',
        status: 'success',
        detail: `Accessible depuis une IP externe (HTTP ${res.status})`,
      });
    } else {
      addStep({
        label: 'Serveur Atmo via proxy CORS',
        status: 'info',
        detail: `Réponse inattendue (HTTP ${res.status})`,
      });
    }
  }, addStep).catch((err) => {
    addStep({
      label: 'Serveur Atmo via proxy CORS',
      status: 'error',
      detail: `Inaccessible depuis l'extérieur : ${err instanceof Error ? err.message : String(err)}`,
    });
  });

  // 4. Test de connexion au proxy PHP (via action login sans identifiants)
  await timedStep('Connexion au proxy PHP', async () => {
    const res = await fetch(PROXY_BASE, {
      signal: AbortSignal.timeout(10000),
    });
    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = null; }
    if (!res.ok) {
      if (res.status === 500 && data?.error) {
        addStep({
          label: 'Proxy PHP accessible',
          status: 'success',
          detail: `Proxy joignable (HTTP ${res.status})`,
        });
        addStep({
          label: 'Message du proxy',
          status: 'info',
          detail: data.error,
        });
        return;
      }
      throw new Error(`HTTP ${res.status}`);
    }
    addStep({
      label: 'Proxy PHP accessible',
      status: 'success',
      detail: `OK (HTTP ${res.status})`,
    });
  }, addStep).catch((err) => {
    addStep({
      label: 'Proxy PHP accessible',
      status: 'error',
      detail: `Échec : ${err instanceof Error ? err.message : String(err)}`,
    });
  });

  // Afficher les identifiants utilisés (masqués partiellement)
  const maskedLogin = login ? login.substring(0, 3) + '***' : 'non défini';
  const maskedPassword = password ? '***' : 'non défini';
  addStep({
    label: 'Identifiants Atmo France utilisés',
    status: 'info',
    detail: `Login: "${maskedLogin}" (${login ? login.length : 0} car.), Mot de passe: ${maskedPassword} (${password ? password.length : 0} car.)`,
  });

  // 5. Test d'authentification Atmo France directe (POST /api/login)
  if (login && password) {
    await timedStep('Authentification Atmo France (directe)', async () => {
      const res = await fetch(`${ATMO_API_BASE}/login`, {
        method: 'POST',
        headers: {
          'accept': '*/*',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: login, password }),
        signal: AbortSignal.timeout(10000),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || `HTTP ${res.status}`);
      }

      if (!data.token) {
        throw new Error('Token non reçu dans la réponse');
      }

      addStep({
        label: 'Token JWT reçu (direct)',
        status: 'success',
        detail: `Token valide, expire le ${data.expires_at ? new Date(data.expires_at * 1000).toLocaleString('fr-FR') : 'inconnu'}`,
      });
    }, addStep).catch((err) => {
      addStep({
        label: 'Authentification Atmo France (directe)',
        status: 'error',
        detail: `Échec : ${err instanceof Error ? err.message : String(err)}`,
      });
    });
  } else {
    addStep({
      label: 'Authentification Atmo France (directe)',
      status: 'warning',
      detail: 'Non testé (identifiants non configurés)',
    });
  }

  // 5b. Test d'authentification Atmo France via le proxy (fallback)
  if (login && password) {
    await timedStep('Authentification Atmo France (via proxy)', async () => {
      const url = `${PROXY_BASE}?action=login&login=${encodeURIComponent(login)}&password=${encodeURIComponent(password)}`;
      addStep({
        label: 'URL appelée (proxy)',
        status: 'info',
        detail: url.replace(encodeURIComponent(password), '***'),
      });
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }

      if (!res.ok) {
        const errorMsg = data?.error || `HTTP ${res.status}`;
        if (res.status === 0 || text === '') {
          throw new Error(`Erreur réseau / proxy inaccessible (HTTP ${res.status})`);
        }
        throw new Error(errorMsg);
      }

      if (!data?.success || !data?.token) {
        throw new Error(data?.error || 'Token non reçu');
      }

      addStep({
        label: 'Token JWT reçu (proxy)',
        status: 'success',
        detail: `Token valide, expire le ${data.expires_at ? new Date(data.expires_at * 1000).toLocaleString('fr-FR') : 'inconnu'}`,
      });
    }, addStep).catch(() => {});
  } else {
    addStep({
      label: 'Authentification Atmo France (via proxy)',
      status: 'warning',
      detail: 'Non testé (identifiants non configurés)',
    });
  }

  // 6. Test d'appel API avec le token (si on en a un)
  const tokenStep = steps.find(s => s.label === 'Token JWT reçu (direct)' || s.label === 'Token JWT reçu (proxy)');
  if (tokenStep?.status === 'success') {
    await timedStep('Appel API données pollen (test)', async () => {
      const url = `${PROXY_BASE}?action=test-api&lat=48.8566&lon=2.3522&login=${encodeURIComponent(login)}&password=${encodeURIComponent(password)}`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(15000),
      });
      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = null; }

      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      if (!data?.success) {
        throw new Error(data?.error || 'Réponse API invalide');
      }

      addStep({
        label: 'Données API',
        status: 'info',
        detail: `${data.features_count || 0} zones trouvées`,
      });
    }, addStep).catch(() => {});
  }

  // Calculer le résumé
  const summary = {
    total: steps.length,
    success: steps.filter(s => s.status === 'success').length,
    error: steps.filter(s => s.status === 'error').length,
    warning: steps.filter(s => s.status === 'warning').length,
  };

  return { timestamp, steps, summary };
}