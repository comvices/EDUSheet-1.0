import {
  Assignment,
  AttendanceSession,
  LearningResource,
  PeriodConfig,
  PastelThemeId,
  StudentProfile,
  SubjectClassroom,
  Submission,
  TeacherProfile,
  UserRole,
  TeachingSchedule,
} from '../types';
import { getAuthHeaders, getApiSessionToken } from '../utils/security';

export interface ClassroomRelayStatus {
  available: boolean;
  counts: {
    students: number;
    teachers: number;
    assignments: number;
    submissions: number;
    classrooms: number;
    resources: number;
    attendanceSessions: number;
  };
  updatedAt: string | null;
}

export interface ClassroomRelaySeedPayload {
  replaceAll?: boolean;
  students?: StudentProfile[];
  teachers?: TeacherProfile[];
  settings?: {
    gradeLevels?: string[];
    subjects?: string[];
    periodConfigs?: PeriodConfig[];
    studentGradebookEnabled?: boolean;
    gradebookDisabledRooms?: string[];
    schoolCoverUrl?: string;
    schoolName?: string;
    schoolSubtitle?: string;
    themeColor?: PastelThemeId;
  };
  assignments?: Assignment[];
  submissions?: Submission[];
  resources?: LearningResource[];
  teachingSchedules?: TeachingSchedule[];
  attendanceSessions?: AttendanceSession[];
  subjectClassrooms?: SubjectClassroom[];
}

export interface ClassroomRelayDataResponse {
  success: boolean;
  available: boolean;
  updatedAt: string | null;
  data: {
    students: StudentProfile[];
    teachers: TeacherProfile[];
    settings: ClassroomRelaySeedPayload['settings'];
    assignments: Assignment[];
    submissions: Submission[];
    resources: LearningResource[];
    teachingSchedules: TeachingSchedule[];
    attendanceSessions: AttendanceSession[];
    subjectClassrooms: SubjectClassroom[];
  };
}

export async function getClassroomRelayStatus(): Promise<ClassroomRelayStatus | null> {
  try {
    const res = await fetch('/api/classroom-mirror/status');
    if (!res.ok) return null;
    return (await res.json()) as ClassroomRelayStatus;
  } catch {
    return null;
  }
}

export type RelayLoginResult =
  | {
      ok: true;
      role: UserRole;
      user: StudentProfile | TeacherProfile;
      token: string;
      isDefaultAdminFallback?: boolean;
    }
  | {
      ok: false;
      reason: 'INVALID_PASSWORD' | 'USER_NOT_FOUND' | 'MIRROR_EMPTY' | 'NETWORK_ERROR';
    };

export async function loginViaClassroomRelay(
  role: UserRole,
  code: string,
  password: string
): Promise<RelayLoginResult> {
  try {
    const res = await fetch('/api/classroom-mirror/login', {
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
    if (data?.error === 'INVALID_PASSWORD') {
      return { ok: false, reason: 'INVALID_PASSWORD' };
    }
    if (data?.error === 'MIRROR_EMPTY') {
      return { ok: false, reason: 'MIRROR_EMPTY' };
    }
    return { ok: false, reason: 'USER_NOT_FOUND' };
  } catch {
    return { ok: false, reason: 'NETWORK_ERROR' };
  }
}

export async function seedClassroomRelay(
  payload: ClassroomRelaySeedPayload
): Promise<ClassroomRelayStatus['counts'] | null> {
  if (!getApiSessionToken()) return null;
  try {
    const res = await fetch('/api/classroom-mirror/seed', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.counts || null;
  } catch {
    return null;
  }
}

export async function fetchClassroomRelayData(): Promise<ClassroomRelayDataResponse | null> {
  if (!getApiSessionToken()) return null;
  try {
    const res = await fetch('/api/classroom-mirror/data', {
      method: 'GET',
      headers: getAuthHeaders(),
    });
    if (!res.ok) return null;
    return (await res.json()) as ClassroomRelayDataResponse;
  } catch {
    return null;
  }
}

export async function pushClassroomRelayMutation(
  op: string,
  payload?: unknown
): Promise<boolean> {
  if (!getApiSessionToken()) return false;
  try {
    const res = await fetch('/api/classroom-mirror/mutate', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ op, payload }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
