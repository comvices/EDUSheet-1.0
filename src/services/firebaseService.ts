import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import {
  Assignment,
  Submission,
  StudentProfile,
  TeacherProfile,
  LearningResource,
  TeachingSchedule,
  AttendanceSession,
  PeriodConfig,
} from '../types';

const ASSIGNMENTS_COLLECTION = 'assignments';
const SUBMISSIONS_COLLECTION = 'submissions';
const STUDENTS_COLLECTION = 'students';
const TEACHERS_COLLECTION = 'teachers';
const SETTINGS_COLLECTION = 'settings';
const MAIN_SETTINGS_DOC = 'main_config';
const RESOURCES_COLLECTION = 'resources';
const TEACHING_SCHEDULES_COLLECTION = 'teachingSchedules';
const ATTENDANCE_SESSIONS_COLLECTION = 'attendanceSessions';

// 1. Subscribe to Assignments in Real-Time
export function subscribeAssignments(onData: (assignments: Assignment[]) => void) {
  try {
    const colRef = collection(db, ASSIGNMENTS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: Assignment[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Assignment);
        });
        // Sort by creation or due date
        list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, ASSIGNMENTS_COLLECTION);
      }
    );
  } catch (err) {
    console.error('Error subscribing to assignments:', err);
    return () => {};
  }
}

// 2. Subscribe to Submissions in Real-Time
export function subscribeSubmissions(onData: (submissions: Submission[]) => void) {
  try {
    const colRef = collection(db, SUBMISSIONS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: Submission[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as Submission);
        });
        list.sort(
          (a, b) => new Date(b.submissionDate).getTime() - new Date(a.submissionDate).getTime()
        );
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, SUBMISSIONS_COLLECTION);
      }
    );
  } catch (err) {
    console.error('Error subscribing to submissions:', err);
    return () => {};
  }
}

// 3. Subscribe to Students Roster in Real-Time
export function subscribeStudents(onData: (students: StudentProfile[]) => void) {
  try {
    const colRef = collection(db, STUDENTS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: StudentProfile[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as StudentProfile);
        });
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, STUDENTS_COLLECTION);
      }
    );
  } catch (err) {
    console.error('Error subscribing to students:', err);
    return () => {};
  }
}

// 4. Subscribe to Teachers Roster in Real-Time
export function subscribeTeachers(onData: (teachers: TeacherProfile[]) => void) {
  try {
    const colRef = collection(db, TEACHERS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: TeacherProfile[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as TeacherProfile);
        });
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, TEACHERS_COLLECTION);
      }
    );
  } catch (err) {
    console.error('Error subscribing to teachers:', err);
    return () => {};
  }
}

// 5. Subscribe to Settings (Grade levels, Subjects & Period configs)
export function subscribeSettings(
  onData: (settings: {
    gradeLevels: string[];
    subjects: string[];
    periodConfigs?: PeriodConfig[];
    studentGradebookEnabled?: boolean;
    gradebookDisabledRooms?: string[];
    schoolCoverUrl?: string;
    schoolName?: string;
    schoolSubtitle?: string;
  }) => void
) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          onData({
            gradeLevels: data.gradeLevels || [],
            subjects: data.subjects || [],
            periodConfigs: Array.isArray(data.periodConfigs) ? data.periodConfigs : undefined,
            studentGradebookEnabled:
              typeof data.studentGradebookEnabled === 'boolean' ? data.studentGradebookEnabled : true,
            gradebookDisabledRooms: Array.isArray(data.gradebookDisabledRooms)
              ? data.gradebookDisabledRooms
              : [],
            schoolCoverUrl: typeof data.schoolCoverUrl === 'string' ? data.schoolCoverUrl : '',
            schoolName: typeof data.schoolName === 'string' ? data.schoolName : '',
            schoolSubtitle: typeof data.schoolSubtitle === 'string' ? data.schoolSubtitle : '',
          });
        } else {
          onData({
            gradeLevels: [],
            subjects: [],
            studentGradebookEnabled: true,
            gradebookDisabledRooms: [],
            schoolCoverUrl: '',
            schoolName: '',
            schoolSubtitle: '',
          });
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC}`);
      }
    );
  } catch (err) {
    console.error('Error subscribing to settings:', err);
    return () => {};
  }
}

// Subscribe to Learning Resources in Real-Time
export function subscribeResources(onData: (resources: LearningResource[]) => void) {
  try {
    const colRef = collection(db, RESOURCES_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: LearningResource[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as LearningResource);
        });
        list.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, RESOURCES_COLLECTION);
      }
    );
  } catch (err) {
    console.error('Error subscribing to resources:', err);
    return () => {};
  }
}

// Helper to strip undefined values so Firestore setDoc does not throw errors
function sanitizeForFirestore<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

// 7. Write Operations
export async function saveAssignmentToFirestore(asg: Assignment): Promise<void> {
  const path = `${ASSIGNMENTS_COLLECTION}/${asg.id}`;
  try {
    await setDoc(doc(db, ASSIGNMENTS_COLLECTION, asg.id), sanitizeForFirestore(asg));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAssignmentFromFirestore(asgId: string): Promise<void> {
  const path = `${ASSIGNMENTS_COLLECTION}/${asgId}`;
  try {
    await deleteDoc(doc(db, ASSIGNMENTS_COLLECTION, asgId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSubmissionToFirestore(sub: Submission): Promise<void> {
  const path = `${SUBMISSIONS_COLLECTION}/${sub.id}`;
  try {
    await setDoc(doc(db, SUBMISSIONS_COLLECTION, sub.id), sanitizeForFirestore(sub));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveMultipleSubmissionsToFirestore(
  submissionsList: Submission[]
): Promise<void> {
  if (submissionsList.length === 0) return;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < submissionsList.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = submissionsList.slice(i, i + CHUNK_SIZE);
      for (const sub of chunk) {
        batch.set(doc(db, SUBMISSIONS_COLLECTION, sub.id), sanitizeForFirestore(sub));
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, SUBMISSIONS_COLLECTION);
  }
}

export async function batchMigrateWorksheetsAndSubmissions(params: {
  upsertAssignments: Assignment[];
  deleteAssignmentIds: string[];
  upsertSubmissions: Submission[];
}): Promise<void> {
  const { upsertAssignments, deleteAssignmentIds, upsertSubmissions } = params;
  type Op =
    | { kind: 'setAsg'; data: Assignment }
    | { kind: 'delAsg'; id: string }
    | { kind: 'setSub'; data: Submission };

  const ops: Op[] = [
    ...upsertAssignments.map((data) => ({ kind: 'setAsg' as const, data })),
    ...deleteAssignmentIds.map((id) => ({ kind: 'delAsg' as const, id })),
    ...upsertSubmissions.map((data) => ({ kind: 'setSub' as const, data })),
  ];

  if (ops.length === 0) return;

  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = ops.slice(i, i + CHUNK_SIZE);
      for (const op of chunk) {
        if (op.kind === 'setAsg') {
          batch.set(
            doc(db, ASSIGNMENTS_COLLECTION, op.data.id),
            sanitizeForFirestore(op.data)
          );
        } else if (op.kind === 'delAsg') {
          batch.delete(doc(db, ASSIGNMENTS_COLLECTION, op.id));
        } else {
          batch.set(
            doc(db, SUBMISSIONS_COLLECTION, op.data.id),
            sanitizeForFirestore(op.data)
          );
        }
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ASSIGNMENTS_COLLECTION}_migration`);
  }
}

export async function saveStudentToFirestore(student: StudentProfile): Promise<void> {
  const path = `${STUDENTS_COLLECTION}/${student.id}`;
  try {
    await setDoc(doc(db, STUDENTS_COLLECTION, student.id), sanitizeForFirestore(student));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveMultipleStudentsToFirestore(students: StudentProfile[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const std of students) {
      batch.set(doc(db, STUDENTS_COLLECTION, std.id), sanitizeForFirestore(std));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, STUDENTS_COLLECTION);
  }
}

export async function deleteStudentFromFirestore(studentId: string): Promise<void> {
  const path = `${STUDENTS_COLLECTION}/${studentId}`;
  try {
    await deleteDoc(doc(db, STUDENTS_COLLECTION, studentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTeacherToFirestore(teacher: TeacherProfile): Promise<void> {
  const path = `${TEACHERS_COLLECTION}/${teacher.id}`;
  try {
    await setDoc(doc(db, TEACHERS_COLLECTION, teacher.id), sanitizeForFirestore(teacher));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTeacherFromFirestore(teacherId: string): Promise<void> {
  const path = `${TEACHERS_COLLECTION}/${teacherId}`;
  try {
    await deleteDoc(doc(db, TEACHERS_COLLECTION, teacherId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSettingsToFirestore(
  gradeLevels: string[],
  subjects: string[]
): Promise<void> {
  const path = `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC}`;
  try {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC),
      sanitizeForFirestore({
        id: MAIN_SETTINGS_DOC,
        gradeLevels,
        subjects,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function savePeriodConfigsToFirestore(
  periodConfigs: PeriodConfig[]
): Promise<void> {
  const path = `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC}`;
  try {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC),
      sanitizeForFirestore({
        id: MAIN_SETTINGS_DOC,
        periodConfigs,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveGradebookVisibilityToFirestore(
  studentGradebookEnabled: boolean,
  gradebookDisabledRooms: string[]
): Promise<void> {
  const path = `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC}`;
  try {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC),
      sanitizeForFirestore({
        id: MAIN_SETTINGS_DOC,
        studentGradebookEnabled,
        gradebookDisabledRooms,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveSchoolBrandingToFirestore(branding: {
  schoolCoverUrl: string;
  schoolName: string;
  schoolSubtitle: string;
}): Promise<void> {
  const path = `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC}`;
  try {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC),
      sanitizeForFirestore({
        id: MAIN_SETTINGS_DOC,
        schoolCoverUrl: branding.schoolCoverUrl,
        schoolName: branding.schoolName,
        schoolSubtitle: branding.schoolSubtitle,
      }),
      { merge: true }
    );
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function clearDatabase(): Promise<void> {
  const collections = [
    ASSIGNMENTS_COLLECTION,
    SUBMISSIONS_COLLECTION,
    STUDENTS_COLLECTION,
    TEACHERS_COLLECTION,
    RESOURCES_COLLECTION,
    TEACHING_SCHEDULES_COLLECTION,
    ATTENDANCE_SESSIONS_COLLECTION,
    SETTINGS_COLLECTION,
  ];

  try {
    for (const colName of collections) {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) continue;
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error clearing database:', error);
    handleFirestoreError(error, OperationType.WRITE, 'all_collections');
  }
}

export async function resetDataKeepUsers(): Promise<void> {
  try {
    // 1. Delete assignments, submissions, settings, resources, schedules, attendance
    const collectionsToDelete = [
      ASSIGNMENTS_COLLECTION,
      SUBMISSIONS_COLLECTION,
      SETTINGS_COLLECTION,
      RESOURCES_COLLECTION,
      TEACHING_SCHEDULES_COLLECTION,
      ATTENDANCE_SESSIONS_COLLECTION,
    ];
    for (const colName of collectionsToDelete) {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      if (snapshot.empty) continue;
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }

    // 2. Preserve required profile fields for students and teachers per firestore.rules
    const studentSnap = await getDocs(collection(db, STUDENTS_COLLECTION));
    if (!studentSnap.empty) {
      const batch = writeBatch(db);
      studentSnap.forEach((docSnap) => {
        const data = docSnap.data();
        batch.set(
          docSnap.ref,
          sanitizeForFirestore({
            id: data.id || docSnap.id,
            code: data.code || '',
            name: data.name || '',
            password: data.password || '123456',
            gradeLevel: data.gradeLevel || 'ม.1/1',
            avatar: data.avatar || '',
          })
        );
      });
      await batch.commit();
    }

    const teacherSnap = await getDocs(collection(db, TEACHERS_COLLECTION));
    if (!teacherSnap.empty) {
      const batch = writeBatch(db);
      teacherSnap.forEach((docSnap) => {
        const data = docSnap.data();
        batch.set(
          docSnap.ref,
          sanitizeForFirestore({
            id: data.id || docSnap.id,
            code: data.code || '',
            name: data.name || '',
            password: data.password || 'admin123',
            subject: data.subject || 'ทั่วไป',
            avatar: data.avatar || '',
          })
        );
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Error resetting database while keeping users:', error);
    handleFirestoreError(error, OperationType.WRITE, 'reset_data_keep_users');
  }
}

export async function saveResourceToFirestore(res: LearningResource): Promise<void> {
  const path = `${RESOURCES_COLLECTION}/${res.id}`;
  try {
    await setDoc(doc(db, RESOURCES_COLLECTION, res.id), sanitizeForFirestore(res));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteResourceFromFirestore(resId: string): Promise<void> {
  const path = `${RESOURCES_COLLECTION}/${resId}`;
  try {
    await deleteDoc(doc(db, RESOURCES_COLLECTION, resId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Subscribe to Teaching Schedules in Real-Time
export function subscribeTeachingSchedules(onData: (schedules: TeachingSchedule[]) => void) {
  try {
    const colRef = collection(db, TEACHING_SCHEDULES_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: TeachingSchedule[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as TeachingSchedule);
        });
        const dayOrder: Record<string, number> = {
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
        };
        list.sort((a, b) => {
          const dDiff = (dayOrder[a.dayOfWeek] || 9) - (dayOrder[b.dayOfWeek] || 9);
          if (dDiff !== 0) return dDiff;
          return a.period - b.period;
        });
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, TEACHING_SCHEDULES_COLLECTION);
      }
    );
  } catch (err) {
    console.error('Error subscribing to teaching schedules:', err);
    return () => {};
  }
}

// Teaching schedules are managed explicitly by teachers/admins without auto-seeding

export async function saveTeachingScheduleToFirestore(schedule: TeachingSchedule): Promise<void> {
  const path = `${TEACHING_SCHEDULES_COLLECTION}/${schedule.id}`;
  try {
    await setDoc(doc(db, TEACHING_SCHEDULES_COLLECTION, schedule.id), sanitizeForFirestore(schedule));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTeachingScheduleFromFirestore(scheduleId: string): Promise<void> {
  const path = `${TEACHING_SCHEDULES_COLLECTION}/${scheduleId}`;
  try {
    await deleteDoc(doc(db, TEACHING_SCHEDULES_COLLECTION, scheduleId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Subscribe to Classroom Attendance Sessions in Real-Time
export function subscribeAttendanceSessions(onData: (sessions: AttendanceSession[]) => void) {
  try {
    const colRef = collection(db, ATTENDANCE_SESSIONS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: AttendanceSession[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AttendanceSession);
        });
        list.sort((a, b) => {
          const dateCompare = b.date.localeCompare(a.date);
          if (dateCompare !== 0) return dateCompare;
          return a.period - b.period;
        });
        onData(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, ATTENDANCE_SESSIONS_COLLECTION);
      }
    );
  } catch (err) {
    console.error('Error subscribing to attendance sessions:', err);
    return () => {};
  }
}

export async function saveAttendanceSessionToFirestore(session: AttendanceSession): Promise<void> {
  const path = `${ATTENDANCE_SESSIONS_COLLECTION}/${session.id}`;
  try {
    await setDoc(doc(db, ATTENDANCE_SESSIONS_COLLECTION, session.id), sanitizeForFirestore(session));
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAttendanceSessionFromFirestore(sessionId: string): Promise<void> {
  const path = `${ATTENDANCE_SESSIONS_COLLECTION}/${sessionId}`;
  try {
    await deleteDoc(doc(db, ATTENDANCE_SESSIONS_COLLECTION, sessionId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
