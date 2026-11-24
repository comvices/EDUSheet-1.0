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
    const res = await fetch('/api/db/public-config', {
      cache: 'no-store',
      credentials: 'include',
    });
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
      reason:
        | 'INVALID_PASSWORD'
        | 'USER_NOT_FOUND'
        | 'DB_EMPTY'
        | 'RATE_LIMITED'
        | 'SERVER_ERROR'
        | 'NETWORK_ERROR';
      message?: string;
    };

export type SessionRestoreResult =
  | {
      authenticated: true;
      role: UserRole;
      user: StudentProfile | TeacherProfile;
      token: string;
      isDefaultAdminFallback?: boolean;
    }
  | {
      authenticated: false;
    };

export async function restoreDbSession(): Promise<SessionRestoreResult> {
  try {
    const res = await fetch('/api/db/session', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    if (!res.ok) return { authenticated: false };
    const data = await res.json().catch(() => null);
    if (data?.authenticated && data?.user && data?.token && (data.role === 'teacher' || data.role === 'student')) {
      return {
        authenticated: true,
        role: data.role,
        user: data.user,
        token: data.token,
        isDefaultAdminFallback: Boolean(data.isDefaultAdminFallback),
      };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

export async function logoutFromServer(): Promise<void> {
  try {
    await fetch('/api/db/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
    });
  } catch {
    // Ignore network errors during logout cleanup
  }
}

export async function loginWithCredentials(
  role: UserRole,
  code: string,
  password: string
): Promise<DbLoginResult> {
  try {
    const res = await fetch('/api/db/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      },
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
    if (res.status === 429 || data?.error === 'RATE_LIMITED') {
      return { ok: false, reason: 'RATE_LIMITED', message: data?.message };
    }
    if (res.status >= 500) {
      return { ok: false, reason: 'SERVER_ERROR', message: data?.error || data?.message };
    }
    if (data?.error === 'INVALID_PASSWORD') return { ok: false, reason: 'INVALID_PASSWORD' };
    if (data?.error === 'DB_EMPTY') return { ok: false, reason: 'DB_EMPTY' };
    return { ok: false, reason: 'USER_NOT_FOUND' };
  } catch {
    return { ok: false, reason: 'NETWORK_ERROR' };
  }
}

export async function fetchDatabaseBootstrap(): Promise<DatabaseBootstrapPayload | null> {
  if (!getApiSessionToken()) return null;
  try {
    const res = await fetch('/api/db/bootstrap', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'include',
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
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!getApiSessionToken()) {
    return { ok: false, status: 401, error: 'เซสชันหมดอายุหรือยังไม่ได้เข้าสู่ระบบ' };
  }
  try {
    const res = await fetch('/api/db/mutate', {
      method: 'POST',
      credentials: 'include',
      headers: getAuthHeaders(),
      body: JSON.stringify({ op, payload }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        status: res.status,
        error: data?.message || data?.error || 'ไม่สามารถบันทึกข้อมูลลง PostgreSQL ได้',
      };
    }
    return { ok: true, status: res.status };
  } catch {
    return { ok: false, error: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ PostgreSQL ได้' };
  }
}

export async function importDatasetToPostgres(
  payload: Partial<DatabaseBootstrapPayload> & { replaceAll?: boolean }
): Promise<{ ok: boolean; counts?: DatabaseCounts; error?: string }> {
  if (!getApiSessionToken()) return { ok: false, error: 'ยังไม่ได้เข้าสู่ระบบ' };
  try {
    const res = await fetch('/api/db/import', {
      method: 'POST',
      credentials: 'include',
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
