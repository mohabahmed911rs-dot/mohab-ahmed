import type { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { verifySessionToken } from '../lib/security.ts';
import type { SessionPayload } from '../lib/security.ts';
import { getOrCreateUser } from '../db/users.ts';

export interface AuthRequest extends Request {
  user?: DecodedIdToken;
  session?: SessionPayload;
}

/**
 * Authenticates requests using either a signed MAKKAH WE session token
 * or a Firebase ID Token (for Google-authenticated administrators).
 */
export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;

  let token = '';
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split('Bearer ')[1].trim();
  } else if (queryToken) {
    token = queryToken.trim();
  }

  if (!token) {
    return res.status(401).json({ error: 'غير مصرح بالدخول: يرجى تسجيل الدخول أولاً.' });
  }

  // First check if it's our HMAC signed session token (Technician or Admin)
  const sessionPayload = verifySessionToken(token);
  if (sessionPayload) {
    req.session = sessionPayload;
    return next();
  }

  // Otherwise verify as a Firebase ID Token (Admin Google Sign-In)
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    const email = decodedToken.email || 'admin@makkahwe.com';
    const dbUser = await getOrCreateUser(decodedToken.uid, email);
    req.session = {
      role: 'admin',
      id: dbUser?.id || 1,
      code: 'ADMIN-GOOGLE',
      name: decodedToken.name || email.split('@')[0],
      email,
      exp: Date.now() + 3600_000,
    };
    return next();
  } catch (error) {
    console.error('Error verifying authentication token:', error);
    return res.status(401).json({ error: 'جلسة الدخول غير صالحة أو منتهية الصلاحية.' });
  }
};

/**
 * Enforces Administrator-only access (Role-Based Access Control).
 * Technicians are strictly blocked from accessing administrator routes.
 */
export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, () => {
    if (!req.session || req.session.role !== 'admin') {
      return res.status(403).json({
        error: 'غير مسموح: هذه الصلاحية مخصصة لمدير النظام فقط ولا يمكن للفنيين الوصول إليها.',
      });
    }
    next();
  });
};

/**
 * Enforces Technician-only access.
 */
export const requireTechnician = async (req: AuthRequest, res: Response, next: NextFunction) => {
  await requireAuth(req, res, () => {
    if (!req.session || req.session.role !== 'technician') {
      return res.status(403).json({
        error: 'غير مسموح: هذه الواجهة مخصصة لحسابات الفنيين المعتمدة.',
      });
    }
    next();
  });
};
