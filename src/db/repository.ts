import { count, eq, inArray } from 'drizzle-orm';
import { db } from './index.ts';
import {
  appSettings,
  assignments,
  attendanceSessions,
  resources,
  students,
  subjectClassrooms,
  submissions,
  teachers,
  teachingSchedules,
} from './schema.ts';
import type {
  Assignment,
  AttendanceSession,
  DayOfWeek,
  LearningResource,
  PastelThemeId,
  PeriodConfig,
  ResourceType,
  StudentProfile,
  SubjectClassroom,
  Submission,
  SubmissionStatus,
  TeacherProfile,
  TeachingSchedule,
  UserRole,
  WorksheetGroup,
} from '../types/index.ts';

const MAIN_SETTINGS_ID = 'main_config';
const OWNER_TEACHER_EMAIL = 'phratchayawit.sri@gmail.com';
const VALID_THEMES = new Set<PastelThemeId>([
  'sky',
  'mint',
  'lavender',
  'rose',
  'peach',
  'turquoise',
]);

export interface AppSettingsPayload {
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

export interface FullDatasetPayload {
  students: StudentProfile[];
  teachers: TeacherProfile[];
  settings: AppSettingsPayload;
  assignments: Assignment[];
  submissions: Submission[];
  resources: LearningResource[];
  teachingSchedules: TeachingSchedule[];
  attendanceSessions: AttendanceSession[];
  subjectClassrooms: SubjectClassroom[];
}

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

export interface AuthenticatedSession {
  role: UserRole;
  userId: string;
  code: string;
  uid?: string;
  email?: string;
}

function normCode(val: unknown): string {
  return String(val ?? '').trim().toUpperCase();
}

function constantTimeStringEqual(a: unknown, b: unknown): boolean {
  const strA = String(a ?? '');
  const strB = String(b ?? '');
  const maxLen = Math.max(strA.length, strB.length);
  let mismatch = strA.length ^ strB.length;
  for (let i = 0; i < maxLen; i++) {
    const cA = i < strA.length ? strA.charCodeAt(i) : 0;
    const cB = i < strB.length ? strB.charCodeAt(i) : 0;
    mismatch |= cA ^ cB;
  }
  return mismatch === 0;
}

function toSafeTheme(val: unknown): PastelThemeId | undefined {
  return typeof val === 'string' && VALID_THEMES.has(val as PastelThemeId)
    ? (val as PastelThemeId)
    : undefined;
}

function mapStudentRow(row: typeof students.$inferSelect, stripPassword = false): StudentProfile {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    password: stripPassword ? '' : row.password,
    gradeLevel: row.gradeLevel,
    avatar: row.avatar || '',
    ...(row.email ? { email: row.email } : {}),
  };
}

function mapTeacherRow(row: typeof teachers.$inferSelect, stripPassword = false): TeacherProfile {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    password: stripPassword ? '' : row.password,
    subject: row.subject,
    avatar: row.avatar || '',
    ...(row.email ? { email: row.email } : {}),
    ...(toSafeTheme(row.themeColor) ? { themeColor: toSafeTheme(row.themeColor) } : {}),
  };
}

function mapSettingsRow(row?: typeof appSettings.$inferSelect | null): AppSettingsPayload {
  if (!row) {
    return {
      gradeLevels: [],
      subjects: [],
      studentGradebookEnabled: true,
      gradebookDisabledRooms: [],
      schoolCoverUrl: '',
      schoolName: '',
      schoolSubtitle: '',
    };
  }
  return {
    gradeLevels: Array.isArray(row.gradeLevels) ? row.gradeLevels : [],
    subjects: Array.isArray(row.subjects) ? row.subjects : [],
    ...(Array.isArray(row.periodConfigs) && row.periodConfigs.length > 0
      ? { periodConfigs: row.periodConfigs }
      : {}),
    studentGradebookEnabled:
      typeof row.studentGradebookEnabled === 'boolean' ? row.studentGradebookEnabled : true,
    gradebookDisabledRooms: Array.isArray(row.gradebookDisabledRooms)
      ? row.gradebookDisabledRooms
      : [],
    schoolCoverUrl: row.schoolCoverUrl || '',
    schoolName: row.schoolName || '',
    schoolSubtitle: row.schoolSubtitle || '',
    ...(toSafeTheme(row.themeColor) ? { themeColor: toSafeTheme(row.themeColor) } : {}),
  };
}

function mapAssignmentRow(
  row: typeof assignments.$inferSelect,
  stripAnswerKeys = false
): Assignment {
  const rawQuestions = Array.isArray(row.questions) ? row.questions : [];
  const safeQuestions = stripAnswerKeys
    ? rawQuestions.map((q) => {
        const { answerKey: _omitted, ...rest } = q;
        return rest;
      })
    : rawQuestions;

  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    gradeLevel: row.gradeLevel,
    category: row.category as Assignment['category'],
    description: row.description || '',
    instructions: row.instructions || '',
    ...(Array.isArray(row.sections) ? { sections: row.sections } : {}),
    questions: safeQuestions,
    totalPoints: Number(row.totalPoints) || 0,
    dueDate: row.dueDate,
    createdDate: row.createdDate,
    teacherName: row.teacherName,
    ...(row.attachmentUrl ? { attachmentUrl: row.attachmentUrl } : {}),
    ...(Array.isArray(row.assignedStudentCodes)
      ? { assignedStudentCodes: row.assignedStudentCodes }
      : {}),
    isPublished: row.isPublished,
    workMode: row.workMode === 'group' ? 'group' : 'individual',
    ...(row.groupSettings ? { groupSettings: row.groupSettings } : {}),
    ...(Array.isArray(row.groups) ? { groups: row.groups } : {}),
  };
}

function mapSubmissionRow(row: typeof submissions.$inferSelect): Submission {
  return {
    id: row.id,
    assignmentId: row.assignmentId,
    studentId: row.studentId,
    studentName: row.studentName,
    studentCode: row.studentCode,
    gradeLevel: row.gradeLevel,
    submissionDate: row.submissionDate,
    answers: row.answers || {},
    ...(row.answerImages ? { answerImages: row.answerImages } : {}),
    ...(Array.isArray(row.files) ? { files: row.files } : {}),
    status: row.status as SubmissionStatus,
    ...(typeof row.score === 'number' ? { score: row.score } : {}),
    maxScore: Number(row.maxScore) || 0,
    ...(row.teacherComment ? { teacherComment: row.teacherComment } : {}),
    ...(row.gradedAt ? { gradedAt: row.gradedAt } : {}),
    ...(typeof row.aiGraded === 'boolean' ? { aiGraded: row.aiGraded } : {}),
    ...(row.groupId ? { groupId: row.groupId } : {}),
    ...(row.groupName ? { groupName: row.groupName } : {}),
    ...(Array.isArray(row.groupMemberCodes) ? { groupMemberCodes: row.groupMemberCodes } : {}),
    ...(row.lastEditedByName ? { lastEditedByName: row.lastEditedByName } : {}),
    ...(row.lastEditedByCode ? { lastEditedByCode: row.lastEditedByCode } : {}),
  };
}

function mapResourceRow(row: typeof resources.$inferSelect): LearningResource {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    subject: row.subject,
    gradeLevel: row.gradeLevel,
    type: row.type as ResourceType,
    url: row.url,
    createdDate: row.createdDate,
    teacherName: row.teacherName,
    ...(row.fileSize ? { fileSize: row.fileSize } : {}),
    ...(row.thumbnailUrl ? { thumbnailUrl: row.thumbnailUrl } : {}),
  };
}

function mapScheduleRow(row: typeof teachingSchedules.$inferSelect): TeachingSchedule {
  return {
    id: row.id,
    teacherId: row.teacherId,
    teacherCode: row.teacherCode,
    teacherName: row.teacherName,
    dayOfWeek: row.dayOfWeek as DayOfWeek,
    period: row.period,
    ...(typeof row.endPeriod === 'number' ? { endPeriod: row.endPeriod } : {}),
    startTime: row.startTime,
    endTime: row.endTime,
    subject: row.subject,
    gradeLevel: row.gradeLevel,
    ...(row.classroom ? { classroom: row.classroom } : {}),
    ...(row.note ? { note: row.note } : {}),
  };
}

function mapAttendanceRow(row: typeof attendanceSessions.$inferSelect): AttendanceSession {
  return {
    id: row.id,
    ...(row.scheduleId ? { scheduleId: row.scheduleId } : {}),
    date: row.date,
    dayOfWeek: row.dayOfWeek as DayOfWeek,
    period: row.period,
    ...(typeof row.endPeriod === 'number' ? { endPeriod: row.endPeriod } : {}),
    ...(row.startTime ? { startTime: row.startTime } : {}),
    ...(row.endTime ? { endTime: row.endTime } : {}),
    subject: row.subject,
    gradeLevel: row.gradeLevel,
    teacherId: row.teacherId,
    teacherCode: row.teacherCode,
    teacherName: row.teacherName,
    ...(row.topicTaught ? { topicTaught: row.topicTaught } : {}),
    records: Array.isArray(row.records) ? row.records : [],
    updatedAt: row.updatedAt,
  };
}

function mapClassroomRow(row: typeof subjectClassrooms.$inferSelect): SubjectClassroom {
  return {
    id: row.id,
    courseCode: row.courseCode,
    title: row.title,
    subject: row.subject,
    gradeLevel: row.gradeLevel,
    description: row.description || '',
    ...(row.objectives ? { objectives: row.objectives } : {}),
    teacherName: row.teacherName,
    ...(row.coverUrl ? { coverUrl: row.coverUrl } : {}),
    units: Array.isArray(row.units) ? row.units : [],
    isPublished: row.isPublished,
    createdDate: row.createdDate,
    ...(row.updatedDate ? { updatedDate: row.updatedDate } : {}),
  };
}

const sortAssignments = (list: Assignment[]) =>
  [...list].sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

const sortSubmissions = (list: Submission[]) =>
  [...list].sort(
    (a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
  );

const sortResources = (list: LearningResource[]) =>
  [...list].sort(
    (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
  );

const DAY_ORDER: Record<string, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
};

const sortSchedules = (list: TeachingSchedule[]) =>
  [...list].sort((a, b) => {
    const dDiff = (DAY_ORDER[a.dayOfWeek] || 9) - (DAY_ORDER[b.dayOfWeek] || 9);
    if (dDiff !== 0) return dDiff;
    return a.period - b.period;
  });

const sortAttendance = (list: AttendanceSession[]) =>
  [...list].sort((a, b) => {
    const cmp = b.date.localeCompare(a.date);
    if (cmp !== 0) return cmp;
    return a.period - b.period;
  });

const sortClassrooms = (list: SubjectClassroom[]) =>
  [...list].sort(
    (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
  );

export async function getPublicSchoolConfig(): Promise<PublicSchoolConfig> {
  try {
    const [
      settingsRows,
      studentsCountRows,
      teachersCountRows,
      assignmentsCountRows,
      submissionsCountRows,
      classroomsCountRows,
      resourcesCountRows,
      attendanceCountRows,
    ] = await Promise.all([
      db.select().from(appSettings).where(eq(appSettings.id, MAIN_SETTINGS_ID)).limit(1),
      db.select({ value: count() }).from(students),
      db.select({ value: count() }).from(teachers),
      db.select({ value: count() }).from(assignments),
      db.select({ value: count() }).from(submissions),
      db.select({ value: count() }).from(subjectClassrooms),
      db.select({ value: count() }).from(resources),
      db.select({ value: count() }).from(attendanceSessions),
    ]);

    const s = mapSettingsRow(settingsRows[0]);
    const counts: DatabaseCounts = {
      students: Number(studentsCountRows[0]?.value ?? 0),
      teachers: Number(teachersCountRows[0]?.value ?? 0),
      assignments: Number(assignmentsCountRows[0]?.value ?? 0),
      submissions: Number(submissionsCountRows[0]?.value ?? 0),
      classrooms: Number(classroomsCountRows[0]?.value ?? 0),
      resources: Number(resourcesCountRows[0]?.value ?? 0),
      attendanceSessions: Number(attendanceCountRows[0]?.value ?? 0),
    };

    const hasData =
      counts.students > 0 ||
      counts.teachers > 0 ||
      counts.assignments > 0 ||
      counts.classrooms > 0 ||
      counts.resources > 0;

    return {
      schoolCoverUrl: s.schoolCoverUrl || '',
      schoolName: s.schoolName || '',
      schoolSubtitle: s.schoolSubtitle || '',
      themeColor: s.themeColor,
      hasData,
      counts,
    };
  } catch (error) {
    console.error('Database query failed in getPublicSchoolConfig:', error);
    throw new Error('Failed to load school configuration.', { cause: error });
  }
}

export type CredentialLoginResult =
  | {
      ok: true;
      role: UserRole;
      user: StudentProfile | TeacherProfile;
      isDefaultAdminFallback?: boolean;
    }
  | {
      ok: false;
      reason: 'INVALID_PASSWORD' | 'USER_NOT_FOUND' | 'DB_EMPTY';
    };

function matchesPasswordSafely(storedPassword: unknown, rawPassword: string): boolean {
  const stored = String(storedPassword ?? '');
  const input = String(rawPassword ?? '');
  if (constantTimeStringEqual(stored, input)) return true;
  const trimmedInput = input.trim();
  const trimmedStored = stored.trim();
  if (trimmedInput && (trimmedInput !== input || trimmedStored !== stored)) {
    return constantTimeStringEqual(trimmedStored, trimmedInput);
  }
  return false;
}

export async function verifyLoginCredentials(
  requestedRole: UserRole,
  rawCode: string,
  rawPassword: string
): Promise<CredentialLoginResult> {
  try {
    const cleanCode = String(rawCode ?? '').trim();
    const inputUpper = cleanCode.toUpperCase();
    const inputNoSt = inputUpper.replace(/^ST[-\s]*/, '');
    const inputNoTch = inputUpper.replace(/^TCH[-\s]*/, '');

    const [allStudents, allTeachers] = await Promise.all([
      db.select().from(students),
      db.select().from(teachers),
    ]);

    const matchingStudents = allStudents.filter((s) => {
      const sCode = normCode(s.code);
      const sNoSt = sCode.replace(/^ST[-\s]*/, '');
      return (
        sCode === inputUpper ||
        (Boolean(inputNoSt) && sNoSt === inputNoSt)
      );
    });

    const matchedStudent = matchingStudents.find((s) =>
      matchesPasswordSafely(s.password, rawPassword)
    );

    const matchingTeachers = allTeachers.filter((t) => {
      const tCode = normCode(t.code);
      const tName = String(t.name || '').trim().toLowerCase();
      const cleanTCode = tCode.replace(/^TCH[-\s]*/, '');
      if (tCode === inputUpper) return true;
      if (inputNoTch && tCode.startsWith('TCH-') && cleanTCode === inputNoTch) return true;
      if (inputNoTch && inputUpper.startsWith('TCH-') && cleanTCode === inputNoTch) return true;
      if (tName && tName === cleanCode.toLowerCase()) return true;
      return false;
    });

    const matchedTeacher = matchingTeachers.find((t) =>
      matchesPasswordSafely(t.password, rawPassword)
    );

    const hasExplicitAdmin = allTeachers.some((t) => normCode(t.code) === 'ADMIN');
    const matchesDefaultAdminFallback =
      inputUpper === 'ADMIN' &&
      !hasExplicitAdmin &&
      matchesPasswordSafely('admin123', rawPassword);

    if (requestedRole === 'student' && inputUpper !== 'ADMIN') {
      if (matchedStudent) {
        return {
          ok: true,
          role: 'student',
          user: mapStudentRow(matchedStudent, true),
        };
      }
      if (matchingStudents.length > 0) {
        return { ok: false, reason: 'INVALID_PASSWORD' };
      }
      // Smart fallback: if a teacher/admin forgot to switch tabs and entered valid teacher credentials
      if (matchedTeacher) {
        return {
          ok: true,
          role: 'teacher',
          user: mapTeacherRow(matchedTeacher, true),
        };
      }
      if (allStudents.length === 0 && allTeachers.length === 0) {
        return { ok: false, reason: 'DB_EMPTY' };
      }
      return { ok: false, reason: 'USER_NOT_FOUND' };
    }

    // Teacher or Admin login
    if (matchedTeacher) {
      return {
        ok: true,
        role: 'teacher',
        user: mapTeacherRow(matchedTeacher, true),
      };
    }

    if (matchesDefaultAdminFallback) {
      return {
        ok: true,
        role: 'teacher',
        isDefaultAdminFallback: true,
        user: {
          id: 'tch_admin',
          code: 'ADMIN',
          name: 'ผู้ดูแลระบบ (Admin)',
          password: '',
          subject: 'ผู้ดูแลระบบ',
          avatar: '',
        },
      };
    }

    if (matchingTeachers.length > 0 || (inputUpper === 'ADMIN' && !hasExplicitAdmin)) {
      return { ok: false, reason: 'INVALID_PASSWORD' };
    }

    // Smart fallback: if a student accidentally clicked the teacher tab and entered valid student credentials
    if (matchedStudent) {
      return {
        ok: true,
        role: 'student',
        user: mapStudentRow(matchedStudent, true),
      };
    }

    if (allTeachers.length === 0 && allStudents.length === 0) {
      return { ok: false, reason: 'DB_EMPTY' };
    }
    return { ok: false, reason: 'USER_NOT_FOUND' };
  } catch (error) {
    console.error('Database query failed in verifyLoginCredentials:', error);
    throw new Error('Failed to verify login credentials.', { cause: error });
  }
}

export async function getUserBySession(session: AuthenticatedSession): Promise<{
  role: UserRole;
  user: StudentProfile | TeacherProfile;
  isDefaultAdminFallback?: boolean;
} | null> {
  try {
    const cleanId = String(session.userId || '').trim();
    const cleanCode = normCode(session.code || '');

    if (session.role === 'teacher') {
      const allTeachers = await db.select().from(teachers);
      const matched =
        allTeachers.find((t) => cleanId && t.id === cleanId) ||
        allTeachers.find((t) => cleanCode && normCode(t.code) === cleanCode);
      if (matched) {
        return {
          role: 'teacher',
          user: mapTeacherRow(matched, true),
        };
      }
      const hasExplicitAdmin = allTeachers.some((t) => normCode(t.code) === 'ADMIN');
      if (!hasExplicitAdmin && cleanId === 'tch_admin' && cleanCode === 'ADMIN') {
        return {
          role: 'teacher',
          isDefaultAdminFallback: true,
          user: {
            id: 'tch_admin',
            code: 'ADMIN',
            name: 'ผู้ดูแลระบบ (Admin)',
            password: '',
            subject: 'ผู้ดูแลระบบ',
            avatar: '',
          },
        };
      }
      return null;
    }

    const allStudents = await db.select().from(students);
    const stripStudentPrefix = (v: string) => normCode(v).replace(/^ST[-\s]*/, '');
    const strippedSessionCode = stripStudentPrefix(cleanCode);
    const matchedStudent =
      allStudents.find((s) => cleanId && s.id === cleanId) ||
      allStudents.find(
        (s) =>
          cleanCode &&
          (normCode(s.code) === cleanCode ||
            (strippedSessionCode.length > 0 &&
              stripStudentPrefix(s.code) === strippedSessionCode))
      );

    if (matchedStudent) {
      return {
        role: 'student',
        user: mapStudentRow(matchedStudent, true),
      };
    }

    return null;
  } catch (error) {
    console.error('Database query failed in getUserBySession:', error);
    return null;
  }
}

export async function findAccountByGoogleEmail(
  email: string,
  displayName?: string
): Promise<{
  role: UserRole;
  user: StudentProfile | TeacherProfile;
  linkedCode: string;
} | null> {
  try {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return null;

    const allTeachers = await db.select().from(teachers);
    const matchedTeacher = allTeachers.find(
      (t) => t.email && t.email.trim().toLowerCase() === cleanEmail
    );
    if (matchedTeacher) {
      return {
        role: 'teacher',
        user: mapTeacherRow(matchedTeacher, true),
        linkedCode: matchedTeacher.code,
      };
    }

    if (cleanEmail === OWNER_TEACHER_EMAIL) {
      const explicitAdmin = allTeachers.find((t) => normCode(t.code) === 'ADMIN');
      if (explicitAdmin) {
        return {
          role: 'teacher',
          user: { ...mapTeacherRow(explicitAdmin, true), email: cleanEmail },
          linkedCode: explicitAdmin.code,
        };
      }
      return {
        role: 'teacher',
        user: {
          id: 'tch_admin',
          code: 'ADMIN',
          name: displayName?.trim() || 'ผู้ดูแลระบบ (Admin)',
          password: '',
          subject: 'ผู้ดูแลระบบ',
          avatar: '',
          email: cleanEmail,
        },
        linkedCode: 'ADMIN',
      };
    }

    const allStudents = await db.select().from(students);
    const matchedStudent = allStudents.find(
      (s) => s.email && s.email.trim().toLowerCase() === cleanEmail
    );
    if (matchedStudent) {
      return {
        role: 'student',
        user: mapStudentRow(matchedStudent, true),
        linkedCode: matchedStudent.code,
      };
    }

    return null;
  } catch (error) {
    console.error('Database query failed in findAccountByGoogleEmail:', error);
    throw new Error('Failed to match Google account.', { cause: error });
  }
}

export async function getTeacherDataset(): Promise<FullDatasetPayload> {
  try {
    const [
      settingsRows,
      studentRows,
      teacherRows,
      assignmentRows,
      submissionRows,
      resourceRows,
      scheduleRows,
      attendanceRows,
      classroomRows,
    ] = await Promise.all([
      db.select().from(appSettings).where(eq(appSettings.id, MAIN_SETTINGS_ID)).limit(1),
      db.select().from(students),
      db.select().from(teachers),
      db.select().from(assignments),
      db.select().from(submissions),
      db.select().from(resources),
      db.select().from(teachingSchedules),
      db.select().from(attendanceSessions),
      db.select().from(subjectClassrooms),
    ]);

    return {
      students: studentRows.map((r) => mapStudentRow(r, false)),
      teachers: teacherRows.map((r) => mapTeacherRow(r, false)),
      settings: mapSettingsRow(settingsRows[0]),
      assignments: sortAssignments(assignmentRows.map((r) => mapAssignmentRow(r, false))),
      submissions: sortSubmissions(submissionRows.map(mapSubmissionRow)),
      resources: sortResources(resourceRows.map(mapResourceRow)),
      teachingSchedules: sortSchedules(scheduleRows.map(mapScheduleRow)),
      attendanceSessions: sortAttendance(attendanceRows.map(mapAttendanceRow)),
      subjectClassrooms: sortClassrooms(classroomRows.map(mapClassroomRow)),
    };
  } catch (error) {
    console.error('Database query failed in getTeacherDataset:', error);
    throw new Error('Failed to load teacher dataset.', { cause: error });
  }
}

export async function getStudentDataset(
  studentCode: string,
  studentId: string
): Promise<FullDatasetPayload> {
  try {
    const [
      settingsRows,
      studentRows,
      teacherRows,
      assignmentRows,
      submissionRows,
      resourceRows,
      scheduleRows,
      attendanceRows,
      classroomRows,
    ] = await Promise.all([
      db.select().from(appSettings).where(eq(appSettings.id, MAIN_SETTINGS_ID)).limit(1),
      db.select().from(students),
      db.select().from(teachers),
      db.select().from(assignments),
      db.select().from(submissions),
      db.select().from(resources),
      db.select().from(teachingSchedules),
      db.select().from(attendanceSessions),
      db.select().from(subjectClassrooms),
    ]);

    const normStdCode = normCode(studentCode);
    const normStdId = String(studentId || '').trim();

    // Never leak answerKeys or unpublished drafts to students
    const publishedAssignments = sortAssignments(
      assignmentRows
        .filter((a) => a.isPublished !== false)
        .map((r) => mapAssignmentRow(r, true))
    );

    const studentGroupIds = new Set<string>();
    for (const asg of publishedAssignments) {
      if (asg.workMode === 'group' && Array.isArray(asg.groups)) {
        for (const grp of asg.groups) {
          if (
            Array.isArray(grp.memberCodes) &&
            grp.memberCodes.some((c) => normCode(c) === normStdCode)
          ) {
            if (grp.id) studentGroupIds.add(String(grp.id));
          }
        }
      }
    }

    const scopedSubmissions = sortSubmissions(
      submissionRows
        .filter((sub) => {
          if (normStdCode && normCode(sub.studentCode) === normStdCode) return true;
          if (normStdId && String(sub.studentId || '').trim() === normStdId) return true;
          if (
            normStdCode &&
            Array.isArray(sub.groupMemberCodes) &&
            sub.groupMemberCodes.some((c) => normCode(c) === normStdCode)
          ) {
            return true;
          }
          if (sub.groupId && studentGroupIds.has(String(sub.groupId))) return true;
          return false;
        })
        .map(mapSubmissionRow)
    );

    return {
      // Never leak student/teacher passwords to students
      students: studentRows.map((r) => mapStudentRow(r, true)),
      teachers: teacherRows.map((r) => mapTeacherRow(r, true)),
      settings: mapSettingsRow(settingsRows[0]),
      assignments: publishedAssignments,
      submissions: scopedSubmissions,
      resources: sortResources(resourceRows.map(mapResourceRow)),
      teachingSchedules: sortSchedules(scheduleRows.map(mapScheduleRow)),
      attendanceSessions: sortAttendance(attendanceRows.map(mapAttendanceRow)),
      subjectClassrooms: sortClassrooms(
        classroomRows.filter((c) => c.isPublished !== false).map(mapClassroomRow)
      ),
    };
  } catch (error) {
    console.error('Database query failed in getStudentDataset:', error);
    throw new Error('Failed to load student dataset.', { cause: error });
  }
}

function toSubmissionInsert(sub: Submission) {
  return {
    id: String(sub.id),
    assignmentId: String(sub.assignmentId || ''),
    studentId: String(sub.studentId || ''),
    studentName: String(sub.studentName || ''),
    studentCode: String(sub.studentCode || ''),
    gradeLevel: String(sub.gradeLevel || ''),
    submissionDate: String(sub.submissionDate || new Date().toISOString()),
    answers: sub.answers && typeof sub.answers === 'object' ? sub.answers : {},
    answerImages: sub.answerImages ?? null,
    files: Array.isArray(sub.files) ? sub.files : null,
    status: String(sub.status || 'pending'),
    score: typeof sub.score === 'number' ? sub.score : null,
    maxScore: Number(sub.maxScore) || 0,
    teacherComment: sub.teacherComment ?? null,
    gradedAt: sub.gradedAt ?? null,
    aiGraded: typeof sub.aiGraded === 'boolean' ? sub.aiGraded : null,
    groupId: sub.groupId ?? null,
    groupName: sub.groupName ?? null,
    groupMemberCodes: Array.isArray(sub.groupMemberCodes) ? sub.groupMemberCodes : null,
    lastEditedByName: sub.lastEditedByName ?? null,
    lastEditedByCode: sub.lastEditedByCode ?? null,
    updatedAt: new Date(),
  };
}

function toAssignmentInsert(asg: Assignment) {
  return {
    id: String(asg.id),
    title: String(asg.title || ''),
    subject: String(asg.subject || ''),
    gradeLevel: String(asg.gradeLevel || ''),
    category: String(asg.category || 'แบบฝึกหัด'),
    description: String(asg.description || ''),
    instructions: String(asg.instructions || ''),
    sections: Array.isArray(asg.sections) ? asg.sections : null,
    questions: Array.isArray(asg.questions) ? asg.questions : [],
    totalPoints: Number(asg.totalPoints) || 0,
    dueDate: String(asg.dueDate || ''),
    createdDate: String(asg.createdDate || new Date().toISOString()),
    teacherName: String(asg.teacherName || ''),
    attachmentUrl: asg.attachmentUrl ?? null,
    assignedStudentCodes: Array.isArray(asg.assignedStudentCodes)
      ? asg.assignedStudentCodes
      : null,
    isPublished: asg.isPublished !== false,
    workMode: asg.workMode === 'group' ? 'group' : 'individual',
    groupSettings: asg.groupSettings ?? null,
    groups: Array.isArray(asg.groups) ? asg.groups : null,
    updatedAt: new Date(),
  };
}

function toStudentInsert(s: StudentProfile) {
  return {
    id: String(s.id),
    code: String(s.code || ''),
    name: String(s.name || ''),
    password: String(s.password ?? ''),
    gradeLevel: String(s.gradeLevel || ''),
    avatar: String(s.avatar || ''),
    email: s.email ? String(s.email).trim() : null,
  };
}

function toTeacherInsert(t: TeacherProfile) {
  return {
    id: String(t.id),
    code: String(t.code || ''),
    name: String(t.name || ''),
    password: String(t.password ?? ''),
    subject: String(t.subject || ''),
    avatar: String(t.avatar || ''),
    email: t.email ? String(t.email).trim() : null,
    themeColor: toSafeTheme(t.themeColor) ?? null,
  };
}

function toResourceInsert(r: LearningResource) {
  return {
    id: String(r.id),
    title: String(r.title || ''),
    description: String(r.description || ''),
    subject: String(r.subject || ''),
    gradeLevel: String(r.gradeLevel || ''),
    type: String(r.type || 'link'),
    url: String(r.url || ''),
    createdDate: String(r.createdDate || new Date().toISOString()),
    teacherName: String(r.teacherName || ''),
    fileSize: r.fileSize ?? null,
    thumbnailUrl: r.thumbnailUrl ?? null,
    updatedAt: new Date(),
  };
}

function toScheduleInsert(s: TeachingSchedule) {
  return {
    id: String(s.id),
    teacherId: String(s.teacherId || ''),
    teacherCode: String(s.teacherCode || ''),
    teacherName: String(s.teacherName || ''),
    dayOfWeek: String(s.dayOfWeek || 'monday'),
    period: Number(s.period) || 1,
    endPeriod: typeof s.endPeriod === 'number' ? s.endPeriod : null,
    startTime: String(s.startTime || ''),
    endTime: String(s.endTime || ''),
    subject: String(s.subject || ''),
    gradeLevel: String(s.gradeLevel || ''),
    classroom: s.classroom ?? null,
    note: s.note ?? null,
    updatedAt: new Date(),
  };
}

function toAttendanceInsert(a: AttendanceSession) {
  return {
    id: String(a.id),
    scheduleId: a.scheduleId ?? null,
    date: String(a.date || ''),
    dayOfWeek: String(a.dayOfWeek || 'monday'),
    period: Number(a.period) || 1,
    endPeriod: typeof a.endPeriod === 'number' ? a.endPeriod : null,
    startTime: a.startTime ?? null,
    endTime: a.endTime ?? null,
    subject: String(a.subject || ''),
    gradeLevel: String(a.gradeLevel || ''),
    teacherId: String(a.teacherId || ''),
    teacherCode: String(a.teacherCode || ''),
    teacherName: String(a.teacherName || ''),
    topicTaught: a.topicTaught ?? null,
    records: Array.isArray(a.records) ? a.records : [],
    updatedAt: String(a.updatedAt || new Date().toISOString()),
  };
}

function toClassroomInsert(c: SubjectClassroom) {
  return {
    id: String(c.id),
    courseCode: String(c.courseCode || ''),
    title: String(c.title || ''),
    subject: String(c.subject || ''),
    gradeLevel: String(c.gradeLevel || ''),
    description: String(c.description || ''),
    objectives: c.objectives ?? null,
    teacherName: String(c.teacherName || ''),
    coverUrl: c.coverUrl ?? null,
    units: Array.isArray(c.units) ? c.units : [],
    isPublished: c.isPublished !== false,
    createdDate: String(c.createdDate || new Date().toISOString()),
    updatedDate: c.updatedDate ?? null,
  };
}

async function upsertSubmissionsSmartTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db,
  incoming: Submission[]
) {
  const valid = incoming.filter((s) => s && s.id);
  if (valid.length === 0) return;

  const ids = Array.from(new Set(valid.map((s) => String(s.id))));
  const existingRows: Array<typeof submissions.$inferSelect> = [];
  const CHUNK = 200;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunkIds = ids.slice(i, i + CHUNK);
    const found = await tx
      .select()
      .from(submissions)
      .where(inArray(submissions.id, chunkIds));
    existingRows.push(...found);
  }
  const existingMap = new Map(existingRows.map((r) => [r.id, r]));

  const toUpsert: Submission[] = [];
  for (const sub of valid) {
    const prev = existingMap.get(String(sub.id));
    if (!prev) {
      toUpsert.push(sub);
      continue;
    }
    const prevTs = Math.max(
      Date.parse(prev.gradedAt || '') || 0,
      Date.parse(prev.submissionDate || '') || 0
    );
    const nextTs = Math.max(
      Date.parse(sub.gradedAt || '') || 0,
      Date.parse(sub.submissionDate || '') || 0
    );
    if (nextTs >= prevTs) {
      toUpsert.push(sub);
    }
  }

  for (let i = 0; i < toUpsert.length; i += CHUNK) {
    const chunk = toUpsert.slice(i, i + CHUNK);
    for (const sub of chunk) {
      const values = toSubmissionInsert(sub);
      await tx
        .insert(submissions)
        .values(values)
        .onConflictDoUpdate({
          target: submissions.id,
          set: values,
        });
    }
  }
}

async function upsertSettingsTx(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0] | typeof db,
  partial: Partial<AppSettingsPayload>,
  replaceAll = false
) {
  const existingRows = await tx
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, MAIN_SETTINGS_ID))
    .limit(1);
  const current = replaceAll ? mapSettingsRow(null) : mapSettingsRow(existingRows[0]);

  const next: AppSettingsPayload = {
    gradeLevels: Array.isArray(partial.gradeLevels)
      ? partial.gradeLevels.filter((g) => g && g !== 'ทั้งหมด')
      : current.gradeLevels,
    subjects: Array.isArray(partial.subjects)
      ? partial.subjects.filter((s) => s && s !== 'ทั้งหมด')
      : current.subjects,
    periodConfigs: Array.isArray(partial.periodConfigs)
      ? partial.periodConfigs
      : current.periodConfigs,
    studentGradebookEnabled:
      typeof partial.studentGradebookEnabled === 'boolean'
        ? partial.studentGradebookEnabled
        : current.studentGradebookEnabled ?? true,
    gradebookDisabledRooms: Array.isArray(partial.gradebookDisabledRooms)
      ? partial.gradebookDisabledRooms
      : current.gradebookDisabledRooms ?? [],
    schoolCoverUrl:
      typeof partial.schoolCoverUrl === 'string'
        ? partial.schoolCoverUrl
        : current.schoolCoverUrl ?? '',
    schoolName:
      typeof partial.schoolName === 'string' ? partial.schoolName : current.schoolName ?? '',
    schoolSubtitle:
      typeof partial.schoolSubtitle === 'string'
        ? partial.schoolSubtitle
        : current.schoolSubtitle ?? '',
    themeColor: toSafeTheme(partial.themeColor) ?? current.themeColor,
  };

  const rowValues = {
    id: MAIN_SETTINGS_ID,
    gradeLevels: next.gradeLevels,
    subjects: next.subjects,
    periodConfigs: next.periodConfigs ?? null,
    studentGradebookEnabled: next.studentGradebookEnabled ?? true,
    gradebookDisabledRooms: next.gradebookDisabledRooms ?? [],
    schoolCoverUrl: next.schoolCoverUrl ?? '',
    schoolName: next.schoolName ?? '',
    schoolSubtitle: next.schoolSubtitle ?? '',
    themeColor: next.themeColor ?? null,
    updatedAt: new Date(),
  };

  await tx
    .insert(appSettings)
    .values(rowValues)
    .onConflictDoUpdate({
      target: appSettings.id,
      set: rowValues,
    });
}

export async function importFullDataset(
  payload: Partial<FullDatasetPayload>,
  replaceAll = false
): Promise<DatabaseCounts> {
  try {
    await db.transaction(async (tx) => {
      if (replaceAll) {
        if (Array.isArray(payload.students)) await tx.delete(students);
        if (Array.isArray(payload.teachers)) await tx.delete(teachers);
        if (Array.isArray(payload.assignments)) await tx.delete(assignments);
        if (Array.isArray(payload.submissions)) await tx.delete(submissions);
        if (Array.isArray(payload.resources)) await tx.delete(resources);
        if (Array.isArray(payload.teachingSchedules)) await tx.delete(teachingSchedules);
        if (Array.isArray(payload.attendanceSessions)) await tx.delete(attendanceSessions);
        if (Array.isArray(payload.subjectClassrooms)) await tx.delete(subjectClassrooms);
      }

      if (payload.settings && typeof payload.settings === 'object') {
        await upsertSettingsTx(tx, payload.settings, replaceAll);
      }

      if (Array.isArray(payload.students)) {
        for (const s of payload.students) {
          if (!s?.id) continue;
          const values = toStudentInsert(s);
          await tx
            .insert(students)
            .values(values)
            .onConflictDoUpdate({ target: students.id, set: values });
        }
      }

      if (Array.isArray(payload.teachers)) {
        for (const t of payload.teachers) {
          if (!t?.id) continue;
          const values = toTeacherInsert(t);
          await tx
            .insert(teachers)
            .values(values)
            .onConflictDoUpdate({ target: teachers.id, set: values });
        }
      }

      if (Array.isArray(payload.assignments)) {
        for (const a of payload.assignments) {
          if (!a?.id) continue;
          const values = toAssignmentInsert(a);
          await tx
            .insert(assignments)
            .values(values)
            .onConflictDoUpdate({ target: assignments.id, set: values });
        }
      }

      if (Array.isArray(payload.submissions)) {
        await upsertSubmissionsSmartTx(tx, payload.submissions);
      }

      if (Array.isArray(payload.resources)) {
        for (const r of payload.resources) {
          if (!r?.id) continue;
          const values = toResourceInsert(r);
          await tx
            .insert(resources)
            .values(values)
            .onConflictDoUpdate({ target: resources.id, set: values });
        }
      }

      if (Array.isArray(payload.teachingSchedules)) {
        for (const s of payload.teachingSchedules) {
          if (!s?.id) continue;
          const values = toScheduleInsert(s);
          await tx
            .insert(teachingSchedules)
            .values(values)
            .onConflictDoUpdate({ target: teachingSchedules.id, set: values });
        }
      }

      if (Array.isArray(payload.attendanceSessions)) {
        for (const a of payload.attendanceSessions) {
          if (!a?.id) continue;
          const values = toAttendanceInsert(a);
          await tx
            .insert(attendanceSessions)
            .values(values)
            .onConflictDoUpdate({ target: attendanceSessions.id, set: values });
        }
      }

      if (Array.isArray(payload.subjectClassrooms)) {
        for (const c of payload.subjectClassrooms) {
          if (!c?.id) continue;
          const values = toClassroomInsert(c);
          await tx
            .insert(subjectClassrooms)
            .values(values)
            .onConflictDoUpdate({ target: subjectClassrooms.id, set: values });
        }
      }
    });

    const summary = await getPublicSchoolConfig();
    return summary.counts;
  } catch (error) {
    console.error('Database query failed in importFullDataset:', error);
    throw new Error('Failed to import dataset into PostgreSQL.', { cause: error });
  }
}

export async function mutateDatabase(
  session: AuthenticatedSession,
  op: string,
  payload: any
): Promise<{ status: number; error?: string }> {
  try {
    if (session.role === 'student') {
      const cleanStudentCode = normCode(session.code);
      if (op === 'upsertSubmissions' && Array.isArray(payload)) {
        const safeSubs = (payload as Submission[]).filter((sub) => {
          if (!sub?.id) return false;
          const ownsDirectly = normCode(sub.studentCode) === cleanStudentCode;
          const inGroup =
            Array.isArray(sub.groupMemberCodes) &&
            sub.groupMemberCodes.some((c) => normCode(c) === cleanStudentCode);
          return ownsDirectly || inGroup;
        });
        await upsertSubmissionsSmartTx(db, safeSubs);
        return { status: 200 };
      }

      if (
        op === 'updateAssignmentGroups' &&
        payload?.assignmentId &&
        Array.isArray(payload?.groups)
      ) {
        const existingRows = await db
          .select()
          .from(assignments)
          .where(eq(assignments.id, String(payload.assignmentId)))
          .limit(1);
        const existing = existingRows[0];
        if (!existing || existing.workMode !== 'group') {
          return { status: 403, error: 'ใบงานนี้ไม่ได้เปิดโหมดงานกลุ่ม' };
        }
        await db
          .update(assignments)
          .set({
            groups: payload.groups as WorksheetGroup[],
            updatedAt: new Date(),
          })
          .where(eq(assignments.id, String(payload.assignmentId)));
        return { status: 200 };
      }

      return { status: 403, error: 'นักเรียนไม่มีสิทธิ์แก้ไขข้อมูลส่วนนี้' };
    }

    // Teacher / Admin full mutations
    switch (op) {
      case 'upsertAssignment': {
        if (!payload?.id) break;
        const values = toAssignmentInsert(payload as Assignment);
        await db
          .insert(assignments)
          .values(values)
          .onConflictDoUpdate({ target: assignments.id, set: values });
        break;
      }
      case 'updateAssignmentGroups': {
        if (payload?.assignmentId && Array.isArray(payload?.groups)) {
          await db
            .update(assignments)
            .set({
              groups: payload.groups as WorksheetGroup[],
              updatedAt: new Date(),
            })
            .where(eq(assignments.id, String(payload.assignmentId)));
        }
        break;
      }
      case 'deleteAssignment': {
        if (!payload?.id) break;
        const asgId = String(payload.id);
        await db.transaction(async (tx) => {
          await tx.delete(assignments).where(eq(assignments.id, asgId));
          await tx.delete(submissions).where(eq(submissions.assignmentId, asgId));
        });
        break;
      }
      case 'upsertSubmissions': {
        if (Array.isArray(payload)) {
          await upsertSubmissionsSmartTx(db, payload as Submission[]);
        }
        break;
      }
      case 'batchMigrate': {
        await db.transaction(async (tx) => {
          if (Array.isArray(payload?.deleteAssignmentIds) && payload.deleteAssignmentIds.length > 0) {
            const delIds = payload.deleteAssignmentIds.map((id: unknown) => String(id));
            await tx.delete(assignments).where(inArray(assignments.id, delIds));
          }
          if (Array.isArray(payload?.upsertAssignments)) {
            for (const asg of payload.upsertAssignments as Assignment[]) {
              if (!asg?.id) continue;
              const values = toAssignmentInsert(asg);
              await tx
                .insert(assignments)
                .values(values)
                .onConflictDoUpdate({ target: assignments.id, set: values });
            }
          }
          if (Array.isArray(payload?.upsertSubmissions)) {
            await upsertSubmissionsSmartTx(tx, payload.upsertSubmissions as Submission[]);
          }
        });
        break;
      }
      case 'upsertStudent': {
        if (!payload?.id) break;
        const incoming = payload as StudentProfile;
        const cleanPass = String(incoming.password ?? '').trim();
        const insertValues = {
          ...toStudentInsert(incoming),
          password: cleanPass || '123456',
        };
        const updateSet = cleanPass
          ? insertValues
          : {
              code: insertValues.code,
              name: insertValues.name,
              gradeLevel: insertValues.gradeLevel,
              avatar: insertValues.avatar,
              email: insertValues.email,
            };
        await db
          .insert(students)
          .values(insertValues)
          .onConflictDoUpdate({ target: students.id, set: updateSet });
        break;
      }
      case 'upsertStudentsBatch': {
        if (Array.isArray(payload)) {
          await db.transaction(async (tx) => {
            for (const s of payload as StudentProfile[]) {
              if (!s?.id) continue;
              const cleanPass = String(s.password ?? '').trim();
              const insertValues = {
                ...toStudentInsert(s),
                password: cleanPass || '123456',
              };
              const updateSet = cleanPass
                ? insertValues
                : {
                    code: insertValues.code,
                    name: insertValues.name,
                    gradeLevel: insertValues.gradeLevel,
                    avatar: insertValues.avatar,
                    email: insertValues.email,
                  };
              await tx
                .insert(students)
                .values(insertValues)
                .onConflictDoUpdate({ target: students.id, set: updateSet });
            }
          });
        }
        break;
      }
      case 'deleteStudent': {
        if (payload?.id) {
          await db.delete(students).where(eq(students.id, String(payload.id)));
        }
        break;
      }
      case 'upsertTeacher': {
        if (!payload?.id) break;
        const incoming = payload as TeacherProfile;
        const cleanPass = String(incoming.password ?? '').trim();
        const insertValues = toTeacherInsert(incoming);
        const updateSet = cleanPass
          ? insertValues
          : {
              code: insertValues.code,
              name: insertValues.name,
              subject: insertValues.subject,
              avatar: insertValues.avatar,
              email: insertValues.email,
              themeColor: insertValues.themeColor,
            };
        await db
          .insert(teachers)
          .values(insertValues)
          .onConflictDoUpdate({ target: teachers.id, set: updateSet });
        break;
      }
      case 'deleteTeacher': {
        if (payload?.id) {
          await db.delete(teachers).where(eq(teachers.id, String(payload.id)));
        }
        break;
      }
      case 'updateSettings': {
        if (payload && typeof payload === 'object') {
          await upsertSettingsTx(db, payload as Partial<AppSettingsPayload>, false);
        }
        break;
      }
      case 'upsertResource': {
        if (!payload?.id) break;
        const values = toResourceInsert(payload as LearningResource);
        await db
          .insert(resources)
          .values(values)
          .onConflictDoUpdate({ target: resources.id, set: values });
        break;
      }
      case 'deleteResource': {
        if (payload?.id) {
          await db.delete(resources).where(eq(resources.id, String(payload.id)));
        }
        break;
      }
      case 'upsertSchedule': {
        if (!payload?.id) break;
        const values = toScheduleInsert(payload as TeachingSchedule);
        await db
          .insert(teachingSchedules)
          .values(values)
          .onConflictDoUpdate({ target: teachingSchedules.id, set: values });
        break;
      }
      case 'deleteSchedule': {
        if (payload?.id) {
          await db.delete(teachingSchedules).where(eq(teachingSchedules.id, String(payload.id)));
        }
        break;
      }
      case 'upsertAttendance': {
        if (!payload?.id) break;
        const values = toAttendanceInsert(payload as AttendanceSession);
        await db
          .insert(attendanceSessions)
          .values(values)
          .onConflictDoUpdate({ target: attendanceSessions.id, set: values });
        break;
      }
      case 'deleteAttendance': {
        if (payload?.id) {
          await db.delete(attendanceSessions).where(eq(attendanceSessions.id, String(payload.id)));
        }
        break;
      }
      case 'upsertClassroom': {
        if (!payload?.id) break;
        const values = toClassroomInsert(payload as SubjectClassroom);
        await db
          .insert(subjectClassrooms)
          .values(values)
          .onConflictDoUpdate({ target: subjectClassrooms.id, set: values });
        break;
      }
      case 'upsertClassroomsBatch': {
        if (Array.isArray(payload)) {
          await db.transaction(async (tx) => {
            for (const c of payload as SubjectClassroom[]) {
              if (!c?.id) continue;
              const values = toClassroomInsert(c);
              await tx
                .insert(subjectClassrooms)
                .values(values)
                .onConflictDoUpdate({ target: subjectClassrooms.id, set: values });
            }
          });
        }
        break;
      }
      case 'deleteClassroom': {
        if (payload?.id) {
          await db.delete(subjectClassrooms).where(eq(subjectClassrooms.id, String(payload.id)));
        }
        break;
      }
      case 'clearAll': {
        await db.transaction(async (tx) => {
          await tx.delete(submissions);
          await tx.delete(assignments);
          await tx.delete(resources);
          await tx.delete(teachingSchedules);
          await tx.delete(attendanceSessions);
          await tx.delete(subjectClassrooms);
          await tx.delete(students);
          await tx.delete(teachers);
          await tx.delete(appSettings);
        });
        break;
      }
      case 'resetKeepUsers': {
        await db.transaction(async (tx) => {
          await tx.delete(submissions);
          await tx.delete(assignments);
          await tx.delete(resources);
          await tx.delete(teachingSchedules);
          await tx.delete(attendanceSessions);
          await tx.delete(subjectClassrooms);
          await tx.delete(appSettings);
        });
        break;
      }
      default:
        return { status: 400, error: `ไม่รู้จักคำสั่ง ${op}` };
    }

    return { status: 200 };
  } catch (error) {
    console.error(`Database query failed in mutateDatabase (${op}):`, error);
    throw new Error('Failed to apply database mutation.', { cause: error });
  }
}
