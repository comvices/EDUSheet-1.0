import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getOrCreateUser } from '../db/users.ts';
import {
  findAccountByGoogleEmail,
  type AuthenticatedSession,
} from '../db/repository.ts';
import type { UserRole } from '../types/index.ts';

// Deterministic fallback from server-side DB secrets prevents multi-instance / restart 401s when SESSION_SECRET is unset
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  (process.env.SQL_PASSWORD
    ? crypto
        .createHash('sha256')
        .update(`edusheet-session:${process.env.SQL_HOST || ''}:${process.env.SQL_DB_NAME || ''}:${process.env.SQL_PASSWORD}`)
        .digest('hex')
    : crypto.randomBytes(32).toString('hex'));

export interface SessionTokenPayload extends AuthenticatedSession {
  exp: number;
}

export function signSessionToken(payload: SessionTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
    const sigBuf = Buffer.from(sig, 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }
    const decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionTokenPayload;
    if (!decoded || typeof decoded.exp !== 'number' || Date.now() > decoded.exp) {
      return null;
    }
    if (decoded.role !== 'teacher' && decoded.role !== 'student') {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export async function authenticateGoogleIdToken(idToken: string) {
  const decoded = await adminAuth.verifyIdToken(idToken);
  const email = (decoded.email || '').trim();
  const matched = await findAccountByGoogleEmail(email, decoded.name);
  if (!matched) {
    return {
      ok: false as const,
      status: 403,
      message:
        'อีเมล Google นี้ยังไม่ได้ลงทะเบียนในระบบครูหรือนักเรียน กรุณาติดต่อผู้ดูแลระบบเพื่อผูกอีเมล หรือเข้าสู่ระบบด้วยรหัสประจำตัว',
    };
  }

  await getOrCreateUser(decoded.uid, email, matched.role, matched.linkedCode);

  const token = signSessionToken({
    role: matched.role,
    userId: String(matched.user.id).slice(0, 128),
    code: String(matched.linkedCode || matched.user.code || '').slice(0, 64),
    uid: decoded.uid,
    email,
    exp: Date.now() + 12 * 60 * 60 * 1000,
  });

  return {
    ok: true as const,
    role: matched.role,
    user: matched.user,
    token,
    session: {
      role: matched.role,
      userId: String(matched.user.id),
      code: matched.linkedCode || matched.user.code,
      uid: decoded.uid,
      email,
    },
  };
}

export const EDUSHEET_SESSION_COOKIE = 'edusheet_session';

export function parseSessionCookie(req: Request): string {
  const raw = req.headers.cookie || '';
  if (!raw) return '';
  for (const part of raw.split(';')) {
    const eqIdx = part.indexOf('=');
    if (eqIdx <= 0) continue;
    const name = part.slice(0, eqIdx).trim();
    if (name === EDUSHEET_SESSION_COOKIE) {
      try {
        return decodeURIComponent(part.slice(eqIdx + 1).trim());
      } catch {
        return '';
      }
    }
  }
  return '';
}

function isHttpsRequest(req: Request): boolean {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const origin = String(req.headers.origin || '').toLowerCase();
  const referer = String(req.headers.referer || '').toLowerCase();
  return (
    req.secure ||
    forwardedProto === 'https' ||
    origin.startsWith('https://') ||
    referer.startsWith('https://')
  );
}

/**
 * Sets an HttpOnly browser-session cookie (no Max-Age / Expires):
 * - Survives page refreshes automatically
 * - Automatically cleared by the browser when the browser is closed
 * - Explicitly cleared by POST /api/db/logout
 */
export function setSessionCookie(req: Request, res: Response, token: string): void {
  const secureAttrs = isHttpsRequest(req)
    ? 'Secure; SameSite=None; Partitioned'
    : 'SameSite=Lax';
  res.setHeader(
    'Set-Cookie',
    `${EDUSHEET_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; ${secureAttrs}`
  );
}

export function clearSessionCookie(req: Request, res: Response): void {
  const secureAttrs = isHttpsRequest(req)
    ? 'Secure; SameSite=None; Partitioned'
    : 'SameSite=Lax';
  res.setHeader(
    'Set-Cookie',
    `${EDUSHEET_SESSION_COOKIE}=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; ${secureAttrs}`
  );
}

export function hasValidOriginOrCsrfHeader(req: Request): boolean {
  const xRequestedWith = String(req.headers['x-requested-with'] || '');
  if (xRequestedWith === 'XMLHttpRequest') return true;

  const origin = String(req.headers.origin || '').trim();
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host.toLowerCase();
    const forwardedHost = String(req.headers['x-forwarded-host'] || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    const host = String(req.headers.host || '')
      .split(',')[0]
      .trim()
      .toLowerCase();
    return Boolean(originHost) && (originHost === forwardedHost || originHost === host);
  } catch {
    return false;
  }
}

export function requireAuth(allowedRoles: UserRole[] = ['teacher', 'student']) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization || '';
    const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const cookieToken = !bearerToken ? parseSessionCookie(req) : '';
    const token = bearerToken || cookieToken;

    if (!token) {
      return res.status(401).json({
        error: 'ไม่ได้รับอนุญาต',
        message: 'เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
      });
    }

    // If authenticating solely via cookie on a state-changing method, verify Origin or custom header
    if (!bearerToken && cookieToken && req.method !== 'GET' && req.method !== 'HEAD') {
      if (!hasValidOriginOrCsrfHeader(req)) {
        return res.status(403).json({
          error: 'ไม่ได้รับอนุญาต',
          message: 'คำขอไม่ผ่านการตรวจสอบแหล่งที่มา (Origin verification failed)',
        });
      }
    }

    const hmacSession = verifySessionToken(token);
    if (hmacSession) {
      if (!allowedRoles.includes(hmacSession.role)) {
        return res.status(403).json({
          error: 'ไม่มีสิทธิ์เข้าถึง',
          message: 'เฉพาะครูผู้สอนเท่านั้นที่สามารถใช้งานฟีเจอร์นี้ได้',
        });
      }
      (req as any).apiSession = hmacSession;
      return next();
    }

    try {
      const googleResult = await authenticateGoogleIdToken(token);
      if (!googleResult.ok) {
        return res.status(googleResult.status).json({
          error: 'ไม่มีสิทธิ์เข้าถึง',
          message: googleResult.message,
        });
      }

      if (!allowedRoles.includes(googleResult.role)) {
        return res.status(403).json({
          error: 'ไม่มีสิทธิ์เข้าถึง',
          message: 'เฉพาะครูผู้สอนเท่านั้นที่สามารถใช้งานฟีเจอร์นี้ได้',
        });
      }

      (req as any).apiSession = googleResult.session;
      return next();
    } catch {
      return res.status(401).json({
        error: 'ไม่ได้รับอนุญาต',
        message: 'เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
      });
    }
  };
}
