export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const HTML_TAG_REGEX = /<[^>]*>/g;
const SCRIPT_CONTENT_REGEX = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
const EVENT_HANDLER_REGEX = /\son\w+\s*=\s*("[^"]*"|'[^']*'|\S+)/gi;
const JAVASCRIPT_HREF_REGEX = /href\s*=\s*["']javascript:/gi;

export function sanitizeInput(input: string): string {
  let sanitized = input.replace(SCRIPT_CONTENT_REGEX, '');
  sanitized = sanitized.replace(HTML_TAG_REGEX, '');
  sanitized = sanitized.replace(EVENT_HANDLER_REGEX, '');
  sanitized = sanitized.replace(JAVASCRIPT_HREF_REGEX, '');
  return sanitized.trim();
}

export function validateImportData(data: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof data !== 'object' || data === null) {
    return { valid: false, errors: ['Data must be a non-null object'] };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.version !== 'string') {
    errors.push('Missing or invalid "version" field: expected string');
  }

  if (typeof obj.exportedAt !== 'string') {
    errors.push('Missing or invalid "exportedAt" field: expected ISO date string');
  } else if (isNaN(Date.parse(obj.exportedAt as string))) {
    errors.push('Invalid "exportedAt" field: not a valid date');
  }

  const requiredArrays: string[] = [
    'bloodAnalysis',
    'physicalActivity',
    'weightBMI',
    'sleep',
    'bloodPressure',
    'nutrition',
  ];

  for (const key of requiredArrays) {
    if (!Array.isArray(obj[key])) {
      errors.push(`Missing or invalid "${key}" field: expected array`);
    }
  }

  return { valid: errors.length === 0, errors };
}

export function generateChecksum(data: string): string {
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function encryptData(_data: string): string {
  throw new Error('Encryption not implemented yet');
}

export function decryptData(_data: string): string {
  throw new Error('Decryption not implemented yet');
}