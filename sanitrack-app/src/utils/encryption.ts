const ENCRYPTED_EXPORT_TYPE = 'sanitrack_encrypted_export';
const ENCRYPTION_VERSION = 1;
const KEY_ITERATIONS = 210000;

export interface EncryptedExportPayload {
  type: typeof ENCRYPTED_EXPORT_TYPE;
  version: typeof ENCRYPTION_VERSION;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA-256';
  iterations: typeof KEY_ITERATIONS;
  salt: string;
  iv: string;
  ciphertext: string;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function deriveKey(keyword: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(keyword),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations: KEY_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function isEncryptedExportPayload(data: unknown): data is EncryptedExportPayload {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as EncryptedExportPayload).type === ENCRYPTED_EXPORT_TYPE &&
    (data as EncryptedExportPayload).version === ENCRYPTION_VERSION
  );
}

export async function encryptJsonPayload(data: unknown, keyword: string): Promise<EncryptedExportPayload> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    throw new Error('Mot clé requis pour chiffrer les données.');
  }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(normalizedKeyword, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, plaintext);

  return {
    type: ENCRYPTED_EXPORT_TYPE,
    version: ENCRYPTION_VERSION,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA-256',
    iterations: KEY_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptJsonPayload(payload: EncryptedExportPayload, keyword: string): Promise<unknown> {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    throw new Error('Mot clé requis pour déchiffrer les données.');
  }

  try {
    const salt = base64ToBytes(payload.salt);
    const iv = base64ToBytes(payload.iv);
    const ciphertext = base64ToBytes(payload.ciphertext);
    const key = await deriveKey(normalizedKeyword, salt);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext),
    );
    return JSON.parse(new TextDecoder().decode(decrypted));
  } catch {
    throw new Error('Mot clé invalide ou fichier chiffré corrompu.');
  }
}
