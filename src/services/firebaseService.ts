import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  getDocs,
  getDocsFromCache,
  getDocsFromServer,
  getDocFromCache,
  getDocFromServer,
  query,
  where,
  writeBatch,
  type Query,
} from 'firebase/firestore';
import {
  clearQuotaStatus,
  db,
  handleFirestoreError,
  isQuotaExceededError,
  OperationType,
} from '../lib/firebase';
import {
  Assignment,
  Submission,
  StudentProfile,
  TeacherProfile,
  LearningResource,
  TeachingSchedule,
  AttendanceSession,
  PeriodConfig,
  SubjectClassroom,
  PastelThemeId,
} from '../types';
import { isValidPastelTheme } from '../utils/themes';

const ASSIGNMENTS_COLLECTION = 'assignments';
const SUBMISSIONS_COLLECTION = 'submissions';
const STUDENTS_COLLECTION = 'students';
const TEACHERS_COLLECTION = 'teachers';
const SETTINGS_COLLECTION = 'settings';
const MAIN_SETTINGS_DOC = 'main_config';
const RESOURCES_COLLECTION = 'resources';
const TEACHING_SCHEDULES_COLLECTION = 'teachingSchedules';
const ATTENDANCE_SESSIONS_COLLECTION = 'attendanceSessions';
const SUBJECT_CLASSROOMS_COLLECTION = 'subjectClassrooms';

const SYNC_TS_PREFIX = 'edusheet_sync_ts_';

export const CACHE_TTL = {
  STUDENTS: 30 * 60 * 1000, // 30 minutes
  TEACHERS: 30 * 60 * 1000, // 30 minutes
  SETTINGS: 15 * 60 * 1000, // 15 minutes
  RESOURCES: 20 * 60 * 1000, // 20 minutes
  SCHEDULES: 20 * 60 * 1000, // 20 minutes
  ATTENDANCE: 15 * 60 * 1000, // 15 minutes
  CLASSROOMS: 20 * 60 * 1000, // 20 minutes
  ASSIGNMENTS: 5 * 60 * 1000, // 5 minutes
  SUBMISSIONS: 3 * 60 * 1000, // 3 minutes
} as const;

interface SyncMeta {
  ts: number;
  count: number;
}

function getSyncStorageKey(key: string): string {
  return `${SYNC_TS_PREFIX}${key}`;
}

function readSyncMeta(key: string): SyncMeta | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const raw = window.localStorage.getItem(getSyncStorageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.ts === 'number' && typeof parsed?.count === 'number') {
      return { ts: parsed.ts, count: parsed.count };
    }
    return null;
  } catch {
    return null;
  }
}

function writeSyncMeta(key: string, count: number): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(
      getSyncStorageKey(key),
      JSON.stringify({ ts: Date.now(), count })
    );
  } catch {
    // Ignore localStorage quota/private-mode failures
  }
}

function touchSyncMeta(key: string, minCountIfExists = 0): void {
  const existing = readSyncMeta(key);
  if (!existing) return;
  writeSyncMeta(key, Math.max(minCountIfExists, existing.count));
}

export function isCollectionSyncFresh(syncKey: string, maxAgeMs: number): boolean {
  const meta = readSyncMeta(syncKey);
  if (!meta) return false;
  return Date.now() - meta.ts < maxAgeMs;
}

export function clearAllSyncTimestamps(): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(SYNC_TS_PREFIX)) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Ignore storage failures
  }
}

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

function parseSettingsPayload(data?: Record<string, any> | null): AppSettingsPayload {
  if (!data) {
    return {
      gradeLevels: [],
      subjects: [],
      studentGradebookEnabled: true,
      gradebookDisabledRooms: [],
      schoolCoverUrl: '',
      schoolName: '',
      schoolSubtitle: '',
      themeColor: undefined,
    };
  }
  return {
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
    themeColor: isValidPastelTheme(data.themeColor) ? data.themeColor : undefined,
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

const sortTeachingSchedules = (list: TeachingSchedule[]) =>
  [...list].sort((a, b) => {
    const dDiff = (DAY_ORDER[a.dayOfWeek] || 9) - (DAY_ORDER[b.dayOfWeek] || 9);
    if (dDiff !== 0) return dDiff;
    return a.period - b.period;
  });

const sortAttendanceSessions = (list: AttendanceSession[]) =>
  [...list].sort((a, b) => {
    const dateCompare = b.date.localeCompare(a.date);
    if (dateCompare !== 0) return dateCompare;
    return a.period - b.period;
  });

const sortSubjectClassrooms = (list: SubjectClassroom[]) =>
  [...list].sort(
    (a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime()
  );

async function hydrateCollectionFromCache<T>(
  colName: string,
  sortItems: (list: T[]) => T[],
  onData: (list: T[]) => void
): Promise<void> {
  try {
    const cachedSnap = await getDocsFromCache(collection(db, colName));
    if (!cachedSnap.empty) {
      const list: T[] = [];
      cachedSnap.forEach((docSnap) => {
        list.push(docSnap.data() as T);
      });
      onData(sortItems(list));
    }
  } catch {
    // Cache may be empty on first visit
  }
}

export interface CacheFirstLoadOptions<T> {
  forceServer?: boolean;
  onEmit?: (data: T) => void;
}

async function fetchCollectionCacheFirst<T>(params: {
  colName: string;
  syncKey?: string;
  ttlMs: number;
  sortItems: (list: T[]) => T[];
  forceServer?: boolean;
  onEmit?: (list: T[]) => void;
}): Promise<T[]> {
  const { colName, syncKey = colName, ttlMs, sortItems, forceServer = false, onEmit } = params;
  const colRef = collection(db, colName);

  let cachedList: T[] = [];
  let hasCachedDocs = false;

  try {
    const cachedSnap = await getDocsFromCache(colRef);
    if (!cachedSnap.empty) {
      hasCachedDocs = true;
      const raw: T[] = [];
      cachedSnap.forEach((docSnap) => {
        raw.push(docSnap.data() as T);
      });
      cachedList = sortItems(raw);
      onEmit?.(cachedList);
    }
  } catch {
    // Local cache miss
  }

  const meta = readSyncMeta(syncKey);
  const isFresh = Boolean(meta && Date.now() - meta.ts < ttlMs);

  if (!forceServer && isFresh) {
    if (hasCachedDocs) {
      return cachedList;
    }
    if (meta && meta.count === 0) {
      onEmit?.([]);
      return [];
    }
  }

  try {
    const serverSnap = await getDocsFromServer(colRef);
    clearQuotaStatus();
    const raw: T[] = [];
    serverSnap.forEach((docSnap) => {
      raw.push(docSnap.data() as T);
    });
    const sorted = sortItems(raw);
    writeSyncMeta(syncKey, sorted.length);
    onEmit?.(sorted);
    return sorted;
  } catch (error) {
    const msg = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
    if (isQuotaExceededError(error)) {
      handleFirestoreError(error, OperationType.LIST, colName);
      return cachedList;
    }
    if (msg.includes('offline') || msg.includes('unavailable') || msg.includes('failed to get')) {
      console.warn(`⚠️ Firestore offline while loading ${colName}, serving cached data.`);
      return cachedList;
    }
    handleFirestoreError(error, OperationType.LIST, colName);
    return cachedList;
  }
}

export function loadAssignmentsCacheFirst(options?: CacheFirstLoadOptions<Assignment[]>) {
  return fetchCollectionCacheFirst<Assignment>({
    colName: ASSIGNMENTS_COLLECTION,
    ttlMs: CACHE_TTL.ASSIGNMENTS,
    sortItems: sortAssignments,
    forceServer: options?.forceServer,
    onEmit: options?.onEmit,
  });
}

export function loadSubmissionsCacheFirst(options?: CacheFirstLoadOptions<Submission[]>) {
  return fetchCollectionCacheFirst<Submission>({
    colName: SUBMISSIONS_COLLECTION,
    ttlMs: CACHE_TTL.SUBMISSIONS,
    sortItems: sortSubmissions,
    forceServer: options?.forceServer,
    onEmit: options?.onEmit,
  });
}

function buildStudentCodeVariants(studentCode: string): string[] {
  const raw = (studentCode || '').trim();
  if (!raw) return [];
  const upper = raw.toUpperCase();
  const lower = raw.toLowerCase();
  const withoutPrefix = upper.startsWith('ST-') ? upper.slice(3) : '';
  return Array.from(
    new Set([raw, upper, lower, withoutPrefix].filter(Boolean))
  ).slice(0, 10);
}

async function runMergedQueriesFromCache(queries: Query[]): Promise<Submission[]> {
  const map = new Map<string, Submission>();
  for (const q of queries) {
    try {
      const snap = await getDocsFromCache(q);
      snap.forEach((docSnap) => {
        const sub = docSnap.data() as Submission;
        if (sub?.id) map.set(sub.id, sub);
      });
    } catch {
      // Cache miss on this query
    }
  }
  return sortSubmissions(Array.from(map.values()));
}

async function runMergedQueriesFromServer(queries: Query[]): Promise<Submission[]> {
  const snaps = await Promise.all(queries.map((q) => getDocsFromServer(q)));
  const map = new Map<string, Submission>();
  for (const snap of snaps) {
    snap.forEach((docSnap) => {
      const sub = docSnap.data() as Submission;
      if (sub?.id) map.set(sub.id, sub);
    });
  }
  return sortSubmissions(Array.from(map.values()));
}

// Student-scoped submission loader: reads ONLY this student's own submissions or group submissions (avoids reading entire school)
export async function loadStudentSubmissionsCacheFirst(
  studentCode: string,
  options?: CacheFirstLoadOptions<Submission[]>
): Promise<Submission[]> {
  const variants = buildStudentCodeVariants(studentCode);
  if (variants.length === 0) {
    options?.onEmit?.([]);
    return [];
  }

  const syncKey = `submissions_std_${variants[0].toUpperCase()}`;
  const colRef = collection(db, SUBMISSIONS_COLLECTION);
  const queries: Query[] = [
    query(colRef, where('studentCode', 'in', variants)),
    query(colRef, where('groupMemberCodes', 'array-contains-any', variants)),
  ];

  const cachedList = await runMergedQueriesFromCache(queries);
  if (cachedList.length > 0) {
    options?.onEmit?.(cachedList);
  }

  const meta = readSyncMeta(syncKey);
  const isFresh = Boolean(meta && Date.now() - meta.ts < CACHE_TTL.SUBMISSIONS);
  if (!options?.forceServer && isFresh && (cachedList.length > 0 || meta?.count === 0)) {
    if (cachedList.length === 0) options?.onEmit?.([]);
    return cachedList;
  }

  try {
    const serverList = await runMergedQueriesFromServer(queries);
    clearQuotaStatus();
    writeSyncMeta(syncKey, serverList.length);
    options?.onEmit?.(serverList);
    return serverList;
  } catch (error) {
    const msg = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
    if (isQuotaExceededError(error)) {
      handleFirestoreError(error, OperationType.LIST, `${SUBMISSIONS_COLLECTION}?student=${variants[0]}`);
      return cachedList;
    }
    if (msg.includes('offline') || msg.includes('unavailable') || msg.includes('failed to get')) {
      console.warn('⚠️ Firestore offline while loading student submissions, serving cached data.');
      return cachedList;
    }
    handleFirestoreError(error, OperationType.LIST, `${SUBMISSIONS_COLLECTION}?student=${variants[0]}`);
    return cachedList;
  }
}

export function loadStudentsCacheFirst(options?: CacheFirstLoadOptions<StudentProfile[]>) {
  return fetchCollectionCacheFirst<StudentProfile>({
    colName: STUDENTS_COLLECTION,
    ttlMs: CACHE_TTL.STUDENTS,
    sortItems: (list) => list,
    forceServer: options?.forceServer,
    onEmit: options?.onEmit,
  });
}

export function loadTeachersCacheFirst(options?: CacheFirstLoadOptions<TeacherProfile[]>) {
  return fetchCollectionCacheFirst<TeacherProfile>({
    colName: TEACHERS_COLLECTION,
    ttlMs: CACHE_TTL.TEACHERS,
    sortItems: (list) => list,
    forceServer: options?.forceServer,
    onEmit: options?.onEmit,
  });
}

export async function loadSettingsCacheFirst(
  options?: CacheFirstLoadOptions<AppSettingsPayload>
): Promise<AppSettingsPayload> {
  const docRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC);
  const syncKey = SETTINGS_COLLECTION;

  let cachedPayload: AppSettingsPayload | null = null;
  try {
    const cachedDoc = await getDocFromCache(docRef);
    if (cachedDoc.exists()) {
      cachedPayload = parseSettingsPayload(cachedDoc.data());
      options?.onEmit?.(cachedPayload);
    }
  } catch {
    // Local cache miss
  }

  const meta = readSyncMeta(syncKey);
  const isFresh = Boolean(meta && Date.now() - meta.ts < CACHE_TTL.SETTINGS);
  if (!options?.forceServer && isFresh && (cachedPayload !== null || meta?.count === 0)) {
    const resolved = cachedPayload || parseSettingsPayload(null);
    if (cachedPayload === null) options?.onEmit?.(resolved);
    return resolved;
  }

  try {
    const serverDoc = await getDocFromServer(docRef);
    clearQuotaStatus();
    const payload = parseSettingsPayload(serverDoc.exists() ? serverDoc.data() : null);
    writeSyncMeta(syncKey, serverDoc.exists() ? 1 : 0);
    options?.onEmit?.(payload);
    return payload;
  } catch (error) {
    const msg = (error instanceof Error ? error.message : String(error || '')).toLowerCase();
    if (isQuotaExceededError(error)) {
      handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC}`);
      return cachedPayload || parseSettingsPayload(null);
    }
    if (msg.includes('offline') || msg.includes('unavailable') || msg.includes('failed to get')) {
      return cachedPayload || parseSettingsPayload(null);
    }
    handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC}`);
    return cachedPayload || parseSettingsPayload(null);
  }
}

export function loadResourcesCacheFirst(options?: CacheFirstLoadOptions<LearningResource[]>) {
  return fetchCollectionCacheFirst<LearningResource>({
    colName: RESOURCES_COLLECTION,
    ttlMs: CACHE_TTL.RESOURCES,
    sortItems: sortResources,
    forceServer: options?.forceServer,
    onEmit: options?.onEmit,
  });
}

export function loadTeachingSchedulesCacheFirst(
  options?: CacheFirstLoadOptions<TeachingSchedule[]>
) {
  return fetchCollectionCacheFirst<TeachingSchedule>({
    colName: TEACHING_SCHEDULES_COLLECTION,
    ttlMs: CACHE_TTL.SCHEDULES,
    sortItems: sortTeachingSchedules,
    forceServer: options?.forceServer,
    onEmit: options?.onEmit,
  });
}

export function loadAttendanceSessionsCacheFirst(
  options?: CacheFirstLoadOptions<AttendanceSession[]>
) {
  return fetchCollectionCacheFirst<AttendanceSession>({
    colName: ATTENDANCE_SESSIONS_COLLECTION,
    ttlMs: CACHE_TTL.ATTENDANCE,
    sortItems: sortAttendanceSessions,
    forceServer: options?.forceServer,
    onEmit: options?.onEmit,
  });
}

export function loadSubjectClassroomsCacheFirst(
  options?: CacheFirstLoadOptions<SubjectClassroom[]>
) {
  return fetchCollectionCacheFirst<SubjectClassroom>({
    colName: SUBJECT_CLASSROOMS_COLLECTION,
    ttlMs: CACHE_TTL.CLASSROOMS,
    sortItems: sortSubjectClassrooms,
    forceServer: options?.forceServer,
    onEmit: options?.onEmit,
  });
}

// Scoped Real-Time Listener for a single active assignment (used ONLY while student opens group worksheet modal)
export function subscribeSingleAssignment(
  assignmentId: string,
  onData: (assignment: Assignment | null) => void
): () => void {
  if (!assignmentId) return () => {};
  try {
    const docRef = doc(db, ASSIGNMENTS_COLLECTION, assignmentId);
    return onSnapshot(
      docRef,
      (docSnap) => {
        onData(docSnap.exists() ? (docSnap.data() as Assignment) : null);
      },
      async (error) => {
        handleFirestoreError(error, OperationType.GET, `${ASSIGNMENTS_COLLECTION}/${assignmentId}`);
        if (isQuotaExceededError(error)) {
          try {
            const cachedDoc = await getDocFromCache(docRef);
            if (cachedDoc.exists()) {
              onData(cachedDoc.data() as Assignment);
            }
          } catch {
            // No cached doc
          }
        }
      }
    );
  } catch (err) {
    console.error('Error subscribing to single assignment:', err);
    return () => {};
  }
}

// Scoped Real-Time Listener for a single collaborative group's submissions (reads only 1-6 docs while modal is open)
export function subscribeGroupSubmissions(
  assignmentId: string,
  groupId: string,
  onData: (submissions: Submission[]) => void
): () => void {
  if (!assignmentId || !groupId) return () => {};
  try {
    const q = query(collection(db, SUBMISSIONS_COLLECTION), where('groupId', '==', groupId));
    return onSnapshot(
      q,
      (snapshot) => {
        const list: Submission[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as Submission;
          if (data.assignmentId === assignmentId) {
            list.push(data);
          }
        });
        onData(sortSubmissions(list));
      },
      async (error) => {
        handleFirestoreError(error, OperationType.LIST, `${SUBMISSIONS_COLLECTION}?groupId=${groupId}`);
        if (isQuotaExceededError(error)) {
          try {
            const cachedSnap = await getDocsFromCache(q);
            const list: Submission[] = [];
            cachedSnap.forEach((docSnap) => {
              const data = docSnap.data() as Submission;
              if (data.assignmentId === assignmentId) {
                list.push(data);
              }
            });
            if (list.length > 0) onData(sortSubmissions(list));
          } catch {
            // No cached group submissions
          }
        }
      }
    );
  } catch (err) {
    console.error('Error subscribing to group submissions:', err);
    return () => {};
  }
}

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
        onData(sortAssignments(list));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, ASSIGNMENTS_COLLECTION);
        if (isQuotaExceededError(error)) {
          hydrateCollectionFromCache<Assignment>(ASSIGNMENTS_COLLECTION, sortAssignments, onData);
        }
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
        onData(sortSubmissions(list));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, SUBMISSIONS_COLLECTION);
        if (isQuotaExceededError(error)) {
          hydrateCollectionFromCache<Submission>(SUBMISSIONS_COLLECTION, sortSubmissions, onData);
        }
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
        if (isQuotaExceededError(error)) {
          hydrateCollectionFromCache<StudentProfile>(STUDENTS_COLLECTION, (l) => l, onData);
        }
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
        if (isQuotaExceededError(error)) {
          hydrateCollectionFromCache<TeacherProfile>(TEACHERS_COLLECTION, (l) => l, onData);
        }
      }
    );
  } catch (err) {
    console.error('Error subscribing to teachers:', err);
    return () => {};
  }
}

// 5. Subscribe to Settings (Grade levels, Subjects & Period configs)
export function subscribeSettings(onData: (settings: AppSettingsPayload) => void) {
  try {
    const docRef = doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC);
    return onSnapshot(
      docRef,
      (docSnap) => {
        onData(parseSettingsPayload(docSnap.exists() ? docSnap.data() : null));
      },
      async (error) => {
        handleFirestoreError(error, OperationType.GET, `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC}`);
        if (isQuotaExceededError(error)) {
          try {
            const cachedDoc = await getDocFromCache(docRef);
            if (cachedDoc.exists()) {
              onData(parseSettingsPayload(cachedDoc.data()));
            }
          } catch {
            // No cached settings doc available
          }
        }
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
        onData(sortResources(list));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, RESOURCES_COLLECTION);
        if (isQuotaExceededError(error)) {
          hydrateCollectionFromCache<LearningResource>(RESOURCES_COLLECTION, sortResources, onData);
        }
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
    touchSyncMeta(ASSIGNMENTS_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAssignmentFromFirestore(asgId: string): Promise<void> {
  const path = `${ASSIGNMENTS_COLLECTION}/${asgId}`;
  try {
    await deleteDoc(doc(db, ASSIGNMENTS_COLLECTION, asgId));
    touchSyncMeta(ASSIGNMENTS_COLLECTION, 0);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveSubmissionToFirestore(sub: Submission): Promise<void> {
  const path = `${SUBMISSIONS_COLLECTION}/${sub.id}`;
  try {
    await setDoc(doc(db, SUBMISSIONS_COLLECTION, sub.id), sanitizeForFirestore(sub));
    touchSyncMeta(SUBMISSIONS_COLLECTION, 1);
    if (sub.studentCode) {
      touchSyncMeta(`submissions_std_${sub.studentCode.trim().toUpperCase()}`, 1);
    }
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
    touchSyncMeta(SUBMISSIONS_COLLECTION, 1);
    submissionsList.forEach((s) => {
      if (s.studentCode) {
        touchSyncMeta(`submissions_std_${s.studentCode.trim().toUpperCase()}`, 1);
      }
    });
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
    touchSyncMeta(ASSIGNMENTS_COLLECTION, 1);
    touchSyncMeta(SUBMISSIONS_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${ASSIGNMENTS_COLLECTION}_migration`);
  }
}

export async function saveStudentToFirestore(student: StudentProfile): Promise<void> {
  const path = `${STUDENTS_COLLECTION}/${student.id}`;
  try {
    await setDoc(doc(db, STUDENTS_COLLECTION, student.id), sanitizeForFirestore(student));
    touchSyncMeta(STUDENTS_COLLECTION, 1);
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
    touchSyncMeta(STUDENTS_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, STUDENTS_COLLECTION);
  }
}

export async function deleteStudentFromFirestore(studentId: string): Promise<void> {
  const path = `${STUDENTS_COLLECTION}/${studentId}`;
  try {
    await deleteDoc(doc(db, STUDENTS_COLLECTION, studentId));
    touchSyncMeta(STUDENTS_COLLECTION, 0);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function saveTeacherToFirestore(teacher: TeacherProfile): Promise<void> {
  const path = `${TEACHERS_COLLECTION}/${teacher.id}`;
  try {
    await setDoc(doc(db, TEACHERS_COLLECTION, teacher.id), sanitizeForFirestore(teacher));
    touchSyncMeta(TEACHERS_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateTeacherThemeInFirestore(
  teacherId: string,
  themeColor: PastelThemeId
): Promise<void> {
  const path = `${TEACHERS_COLLECTION}/${teacherId}`;
  try {
    await setDoc(
      doc(db, TEACHERS_COLLECTION, teacherId),
      sanitizeForFirestore({ themeColor }),
      { merge: true }
    );
    touchSyncMeta(TEACHERS_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTeacherFromFirestore(teacherId: string): Promise<void> {
  const path = `${TEACHERS_COLLECTION}/${teacherId}`;
  try {
    await deleteDoc(doc(db, TEACHERS_COLLECTION, teacherId));
    touchSyncMeta(TEACHERS_COLLECTION, 0);
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
    touchSyncMeta(SETTINGS_COLLECTION, 1);
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
    touchSyncMeta(SETTINGS_COLLECTION, 1);
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
    touchSyncMeta(SETTINGS_COLLECTION, 1);
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
    touchSyncMeta(SETTINGS_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveSystemThemeToFirestore(
  themeColor: PastelThemeId
): Promise<void> {
  const path = `${SETTINGS_COLLECTION}/${MAIN_SETTINGS_DOC}`;
  try {
    await setDoc(
      doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC),
      sanitizeForFirestore({
        id: MAIN_SETTINGS_DOC,
        themeColor,
      }),
      { merge: true }
    );
    touchSyncMeta(SETTINGS_COLLECTION, 1);
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
    SUBJECT_CLASSROOMS_COLLECTION,
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
    clearAllSyncTimestamps();
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
      SUBJECT_CLASSROOMS_COLLECTION,
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
            ...(data.themeColor ? { themeColor: data.themeColor } : {}),
          })
        );
      });
      await batch.commit();
    }
    clearAllSyncTimestamps();
  } catch (error) {
    console.error('Error resetting database while keeping users:', error);
    handleFirestoreError(error, OperationType.WRITE, 'reset_data_keep_users');
  }
}

export async function saveResourceToFirestore(res: LearningResource): Promise<void> {
  const path = `${RESOURCES_COLLECTION}/${res.id}`;
  try {
    await setDoc(doc(db, RESOURCES_COLLECTION, res.id), sanitizeForFirestore(res));
    touchSyncMeta(RESOURCES_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteResourceFromFirestore(resId: string): Promise<void> {
  const path = `${RESOURCES_COLLECTION}/${resId}`;
  try {
    await deleteDoc(doc(db, RESOURCES_COLLECTION, resId));
    touchSyncMeta(RESOURCES_COLLECTION, 0);
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
        onData(sortTeachingSchedules(list));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, TEACHING_SCHEDULES_COLLECTION);
        if (isQuotaExceededError(error)) {
          hydrateCollectionFromCache<TeachingSchedule>(
            TEACHING_SCHEDULES_COLLECTION,
            sortTeachingSchedules,
            onData
          );
        }
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
    touchSyncMeta(TEACHING_SCHEDULES_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteTeachingScheduleFromFirestore(scheduleId: string): Promise<void> {
  const path = `${TEACHING_SCHEDULES_COLLECTION}/${scheduleId}`;
  try {
    await deleteDoc(doc(db, TEACHING_SCHEDULES_COLLECTION, scheduleId));
    touchSyncMeta(TEACHING_SCHEDULES_COLLECTION, 0);
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
        onData(sortAttendanceSessions(list));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, ATTENDANCE_SESSIONS_COLLECTION);
        if (isQuotaExceededError(error)) {
          hydrateCollectionFromCache<AttendanceSession>(
            ATTENDANCE_SESSIONS_COLLECTION,
            sortAttendanceSessions,
            onData
          );
        }
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
    touchSyncMeta(ATTENDANCE_SESSIONS_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteAttendanceSessionFromFirestore(sessionId: string): Promise<void> {
  const path = `${ATTENDANCE_SESSIONS_COLLECTION}/${sessionId}`;
  try {
    await deleteDoc(doc(db, ATTENDANCE_SESSIONS_COLLECTION, sessionId));
    touchSyncMeta(ATTENDANCE_SESSIONS_COLLECTION, 0);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// Subscribe to Subject Classrooms in Real-Time
export function subscribeSubjectClassrooms(onData: (classrooms: SubjectClassroom[]) => void) {
  try {
    const colRef = collection(db, SUBJECT_CLASSROOMS_COLLECTION);
    return onSnapshot(
      colRef,
      (snapshot) => {
        const list: SubjectClassroom[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as SubjectClassroom);
        });
        onData(sortSubjectClassrooms(list));
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, SUBJECT_CLASSROOMS_COLLECTION);
        if (isQuotaExceededError(error)) {
          hydrateCollectionFromCache<SubjectClassroom>(
            SUBJECT_CLASSROOMS_COLLECTION,
            sortSubjectClassrooms,
            onData
          );
        }
      }
    );
  } catch (err) {
    console.error('Error subscribing to subject classrooms:', err);
    return () => {};
  }
}

export async function saveSubjectClassroomToFirestore(classroom: SubjectClassroom): Promise<void> {
  const path = `${SUBJECT_CLASSROOMS_COLLECTION}/${classroom.id}`;
  try {
    await setDoc(doc(db, SUBJECT_CLASSROOMS_COLLECTION, classroom.id), sanitizeForFirestore(classroom));
    touchSyncMeta(SUBJECT_CLASSROOMS_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function saveMultipleSubjectClassroomsToFirestore(
  classroomsList: SubjectClassroom[]
): Promise<void> {
  if (classroomsList.length === 0) return;
  try {
    const CHUNK_SIZE = 400;
    for (let i = 0; i < classroomsList.length; i += CHUNK_SIZE) {
      const batch = writeBatch(db);
      const chunk = classroomsList.slice(i, i + CHUNK_SIZE);
      chunk.forEach((cls) => {
        const ref = doc(db, SUBJECT_CLASSROOMS_COLLECTION, cls.id);
        batch.set(ref, sanitizeForFirestore(cls));
      });
      await batch.commit();
    }
    touchSyncMeta(SUBJECT_CLASSROOMS_COLLECTION, 1);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${SUBJECT_CLASSROOMS_COLLECTION}/batch`);
  }
}

export async function deleteSubjectClassroomFromFirestore(classroomId: string): Promise<void> {
  const path = `${SUBJECT_CLASSROOMS_COLLECTION}/${classroomId}`;
  try {
    await deleteDoc(doc(db, SUBJECT_CLASSROOMS_COLLECTION, classroomId));
    touchSyncMeta(SUBJECT_CLASSROOMS_COLLECTION, 0);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}
