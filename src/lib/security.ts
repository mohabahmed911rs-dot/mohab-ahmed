import { scryptSync, randomBytes, timingSafeEqual, createHmac } from 'node:crypto';

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SQL_PASSWORD ||
  'makkah-we-ftth-production-hmac-key-2026-secure';

export interface SessionPayload {
  role: 'admin' | 'technician';
  id: number;
  code: string; // technicianCode or admin username
  name: string;
  email: string;
  exp: number;
}

/**
 * Hashes a password securely using Node's built-in scrypt KDF with a 16-byte random salt.
 * Never stores plain text passwords.
 */
export function hashPassword(plainPassword: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(plainPassword, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

/**
 * Verifies a password against a stored scrypt hash using constant-time comparison.
 */
export function verifyPassword(plainPassword: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const [, salt, keyHex] = parts;
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const derivedBuffer = scryptSync(plainPassword, salt, 64);
    if (keyBuffer.length !== derivedBuffer.length) {
      return false;
    }
    return timingSafeEqual(keyBuffer, derivedBuffer);
  } catch {
    return false;
  }
}

/**
 * Creates a signed HMAC-SHA256 session token valid for 365 days.
 */
export function createSessionToken(payload: Omit<SessionPayload, 'exp'>): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Date.now() + 365 * 24 * 60 * 60 * 1000,
  };
  const base64Payload = Buffer.from(JSON.stringify(fullPayload), 'utf-8').toString('base64url');
  const signature = createHmac('sha256', SESSION_SECRET).update(base64Payload).digest('base64url');
  return `${base64Payload}.${signature}`;
}

/**
 * Verifies a signed HMAC-SHA256 session token and checks expiration.
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [base64Payload, signature] = parts;
    const expectedSig = createHmac('sha256', SESSION_SECRET).update(base64Payload).digest('base64url');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(base64Payload, 'base64url').toString('utf-8')) as SessionPayload;
    if (!decoded.exp || decoded.exp < Date.now()) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}
