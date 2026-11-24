import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase';
import { getAuthHeaders, getApiSessionToken } from '../utils/security';
import type {
  Assignment,
  AttendanceSession,
  LearningResource,
  PastelThemeId,
  PeriodConfig,
  StudentProfile,
  SubjectClassroom,
  Submission,
  TeacherProfile,
  TeachingSchedule,
  UserRole,
} from '../types';

export interface DatabaseCounts {
  students: number;
  teachers: number;
  assignments: number;
  submissions: number;
  classrooms: number;
  resources: number;
  attendanceSessions: number;
}

export interface PublicSchoolConfig {
  schoolCoverUrl: string;
  schoolName: string;
  schoolSubtitle: string;
  themeColor?: PastelThemeId;
  hasData: boolean;
  counts: DatabaseCounts;
}

export interface DatabaseSettingsPayload {
  gradeLevels: string[];
  subjects: string[];
  periodConfigs?: PeriodConfig[];
  studentGradebookEnabled?: boolean;
  gradebookDisabledRooms?: string[];
  schoolCoverUrl?: string;
  schoolName?: string;
  schoolSubtitle?: string;
  themeColor?: PastelThemeId;
}

export interface DatabaseBootstrapPayload {
  students: StudentProfile[];
  teachers: TeacherProfile[];
  settings: DatabaseSettingsPayload;
  assignments: Assignment[];
  submissions: Submission[];
  resources: LearningResource[];
  teachingSchedules: TeachingSchedule[];
  attendanceSessions: AttendanceSession[];
  subjectClassrooms: SubjectClassroom[];
}

export async function fetchPublicSchoolConfig(): Promise<PublicSchoolConfig | null> {
  try {
    const res = await fetch('/api/db/public-config');
    if (!res.ok) return null;
    const json = await res.json();
    if (!json?.success) return null;
    return {
      schoolCoverUrl: json.schoolCoverUrl || '',
      schoolName: json.schoolName || '',
      schoolSubtitle: json.schoolSubtitle || '',
      themeColor: json.themeColor,
      hasData: Boolean(json.hasData),
      counts: json.counts || {
        students: 0,
        teachers: 0,
        assignments: 0,
        submissions: 0,
        classrooms: 0,
        resources: 0,
        attendanceSessions: 0,
      },
    };
  } catch {
    return null;
  }
}

export type DbLoginResult =
  | {
      ok: true;
      role: UserRole;
      user: StudentProfile | TeacherProfile;
      token: string;
      isDefaultAdminFallback?: boolean;
    }
  | {
      ok: false;
      reason: 'INVALID_PASSWORD' | 'USER_NOT_FOUND' | 'DB_EMPTY' | 'NETWORK_ERROR';
    };

export async function loginWithCredentials(
  role: UserRole,
  code: string,
  password: string
): Promise<DbLoginResult> {
  try {
    const res = await fetch('/api/db/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role, code, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.user && data?.token) {
      return {
        ok: true,
        role: data.role,
        user: data.user,
        token: data.token,
        isDefaultAdminFallback: Boolean(data.isDefaultAdminFallback),
      };
    }
    if (data?.error === 'INVALID_PASSWORD') return { ok: false, reason: 'INVALID_PASSWORD' };
    if (data?.error === 'DB_EMPTY') return { ok: false, reason: 'DB_EMPTY' };
    return { ok: false, reason: 'USER_NOT_FOUND' };
  } catch {
    return { ok: false, reason: 'NETWORK_ERROR' };
  }
}

export type GoogleSignInResult =
  | {
      ok: true;
      role: UserRole;
      user: StudentProfile | TeacherProfile;
      token: string;
    }
  | {
      ok: false;
      cancelled?: boolean;
      message: string;
    };

export async function loginWithGooglePopup(): Promise<GoogleSignInResult> {
  try {
    const credential = await signInWithPopup(auth, googleAuthProvider);
    const idToken = await credential.user.getIdToken();
    const res = await fetch('/api/db/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.success && data?.user && data?.token) {
      return {
        ok: true,
        role: data.role,
        user: data.user,
        token: data.token,
      };
    }
    await signOut(auth).catch(() => {});
    return {
      ok: false,
      message:
        data?.message ||
        'อีเมล Google นี้ยังไม่ได้ลงทะเบียนในระบบ กรุณาติดต่อผู้ดูแลระบบหรือเข้าสู่ระบบด้วยรหัสประจำตัว',
    };
  } catch (err: unknown) {
    const code = (err as { code?: string } | null)?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return { ok: false, cancelled: true, message: '' };
    }
    return {
      ok: false,
      message: 'ไม่สามารถเข้าสู่ระบบด้วย Google ได้ในขณะนี้ กรุณาลองใหม่หรือใช้รหัสประจำตัว',
    };
  }
}

export async function signOutGoogleIfActive(): Promise<void> {
  try {
    if (auth.currentUser) {
      await signOut(auth);
    }
  } catch {
    // Ignore sign-out errors
  }
}

export async function fetchDatabaseBootstrap(): Promise<DatabaseBootstrapPayload | null> {
  if (!getApiSessionToken()) return null;
  try {
    const res = await fetch('/api/db/bootstrap', {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.success && json?.data ? (json.data as DatabaseBootstrapPayload) : null;
  } catch {
    return null;
  }
}

export async function mutateDatabaseApi(
  op: string,
  payload?: unknown
): Promise<{ ok: boolean; error?: string }> {
  if (!getApiSessionToken()) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
  try {
    const res = await fetch('/api/db/mutate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ op, payload }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return { ok: false, error: data?.error || 'ไม่สามารถบันทึกข้อมูลได้' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ฐานข้อมูลได้' };
  }
}

export async function importDatasetToPostgres(
  payload: Partial<DatabaseBootstrapPayload> & { replaceAll?: boolean }
): Promise<{ ok: boolean; counts?: DatabaseCounts; error?: string }> {
  if (!getApiSessionToken()) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
  try {
    const res = await fetch('/api/db/import', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) {
      return { ok: false, error: data?.error || 'ไม่สามารถนำเข้าข้อมูลเข้า PostgreSQL ได้' };
    }
    return { ok: true, counts: data.counts };
  } catch {
    return { ok: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์เพื่อย้ายข้อมูลได้' };
  }
}

export async function migrateRelayMirrorToPostgres(): Promise<{
  ok: boolean;
  imported: boolean;
  counts?: DatabaseCounts;
}> {
  if (!getApiSessionToken()) return { ok: false, imported: false };
  try {
    const res = await fetch('/api/db/migrate-relay', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.success) return { ok: false, imported: false };
    return {
      ok: true,
      imported: Boolean(data.imported),
      counts: data.counts,
    };
  } catch {
    return { ok: false, imported: false };
  }
}
