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
import { Assignment, Submission, StudentProfile, TeacherProfile, LearningResource } from '../types';

const ASSIGNMENTS_COLLECTION = 'assignments';
const SUBMISSIONS_COLLECTION = 'submissions';
const STUDENTS_COLLECTION = 'students';
const TEACHERS_COLLECTION = 'teachers';
const SETTINGS_COLLECTION = 'settings';
const MAIN_SETTINGS_DOC = 'main_config';
const RESOURCES_COLLECTION = 'resources';

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
        if (list.length > 0) {
          onData(list);
        }
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
        if (list.length > 0) {
          onData(list);
        }
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

// 5. Subscribe to Settings (Grade levels & Subjects)
export function subscribeSettings(
  onData: (settings: { gradeLevels: string[]; subjects: string[] }) => void
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

// Seed Resources if empty
export async function seedResourcesIfEmpty(initialResources: LearningResource[]) {
  try {
    const snapshot = await getDocs(collection(db, RESOURCES_COLLECTION));
    if (snapshot.empty && initialResources.length > 0) {
      console.log('🌱 Seeding Firestore with initial learning resources...');
      const batch = writeBatch(db);
      for (const res of initialResources) {
        batch.set(doc(db, RESOURCES_COLLECTION, res.id), sanitizeForFirestore(res));
      }
      await batch.commit();
      console.log('✅ Learning resources seeded successfully!');
    }
  } catch (err) {
    console.warn('Note on Firestore resources seeding:', err);
  }
}

// 6. Seed Firestore with initial mock data if empty
export async function seedInitialDataIfEmpty(
  initialAssignments: Assignment[],
  initialSubmissions: Submission[],
  initialStudents: StudentProfile[],
  initialTeachers: TeacherProfile[],
  initialGrades: string[],
  initialSubjects: string[]
) {
  try {
    const asgSnapshot = await getDocs(collection(db, ASSIGNMENTS_COLLECTION));
    if (asgSnapshot.empty) {
      console.log('🌱 Seeding Firestore with initial assignments, submissions, students & teachers...');
      const batch = writeBatch(db);

      // Seed Assignments
      for (const asg of initialAssignments) {
        batch.set(doc(db, ASSIGNMENTS_COLLECTION, asg.id), asg);
      }

      // Seed Submissions
      for (const sub of initialSubmissions) {
        batch.set(doc(db, SUBMISSIONS_COLLECTION, sub.id), sub);
      }

      // Seed Students
      for (const std of initialStudents) {
        batch.set(doc(db, STUDENTS_COLLECTION, std.id), std);
      }

      // Seed Teachers
      for (const tch of initialTeachers) {
        batch.set(doc(db, TEACHERS_COLLECTION, tch.id), tch);
      }

      // Seed Settings
      batch.set(doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC), {
        id: MAIN_SETTINGS_DOC,
        gradeLevels: initialGrades,
        subjects: initialSubjects,
      });

      await batch.commit();
      console.log('✅ Seeding complete in Firestore!');
    }
  } catch (err) {
    console.warn('Note on Firestore seeding:', err);
  }
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
    await setDoc(doc(db, SETTINGS_COLLECTION, MAIN_SETTINGS_DOC), sanitizeForFirestore({
      id: MAIN_SETTINGS_DOC,
      gradeLevels,
      subjects,
    }));
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
  ];

  try {
    for (const colName of collections) {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
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
    // 1. Delete assignments, submissions, settings, resources
    const collectionsToDelete = [ASSIGNMENTS_COLLECTION, SUBMISSIONS_COLLECTION, SETTINGS_COLLECTION, RESOURCES_COLLECTION];
    for (const colName of collectionsToDelete) {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    }

    // 2. Update students and teachers: keep only id, name, password, code
    const usersCollections = [STUDENTS_COLLECTION, TEACHERS_COLLECTION];
    for (const colName of usersCollections) {
      const colRef = collection(db, colName);
      const snapshot = await getDocs(colRef);
      const batch = writeBatch(db);
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        batch.set(docSnap.ref, {
          id: data.id,
          name: data.name,
          password: data.password,
          code: data.code,
        });
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

