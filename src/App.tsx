import React, { useState } from 'react';
import {
  Assignment,
  Submission,
  NotificationItem,
  UserRole,
  FilterState,
  StudentProfile,
  TeacherProfile,
  LearningResource,
  TeachingSchedule,
  AttendanceSession,
  PeriodConfig,
  SubjectClassroom,
  PastelThemeId,
} from './types';
import {
  DEFAULT_PERIOD_CONFIGS,
  INITIAL_ASSIGNMENTS,
  INITIAL_SUBMISSIONS,
} from './data/mockData';
import {
  subscribeAssignments,
  subscribeSubmissions,
  subscribeStudents,
  subscribeTeachers,
  subscribeSettings,
  saveAssignmentToFirestore,
  deleteAssignmentFromFirestore,
  saveSubmissionToFirestore,
  saveMultipleSubmissionsToFirestore,
  batchMigrateWorksheetsAndSubmissions,
  saveStudentToFirestore,
  saveMultipleStudentsToFirestore,
  deleteStudentFromFirestore,
  saveTeacherToFirestore,
  deleteTeacherFromFirestore,
  saveSettingsToFirestore,
  savePeriodConfigsToFirestore,
  saveGradebookVisibilityToFirestore,
  saveSchoolBrandingToFirestore,
  saveSystemThemeToFirestore,
  subscribeResources,
  saveResourceToFirestore,
  deleteResourceFromFirestore,
  subscribeTeachingSchedules,
  saveTeachingScheduleToFirestore,
  deleteTeachingScheduleFromFirestore,
  subscribeAttendanceSessions,
  saveAttendanceSessionToFirestore,
  deleteAttendanceSessionFromFirestore,
  subscribeSubjectClassrooms,
  saveSubjectClassroomToFirestore,
  saveMultipleSubjectClassroomsToFirestore,
  deleteSubjectClassroomFromFirestore,
  clearDatabase,
  resetDataKeepUsers,
} from './services/firebaseService';

// Components
import { Header } from './components/Header';
import { BannerHero } from './components/BannerHero';
import { FilterBar } from './components/FilterBar';
import { AssignmentCard } from './components/AssignmentCard';
import { WorksheetSubmissionModal } from './components/WorksheetSubmissionModal';
import { TeacherGradingModal } from './components/TeacherGradingModal';
import { CreateWorksheetModal } from './components/CreateWorksheetModal';
import { ManageCategoriesModal } from './components/ManageCategoriesModal';
import { ManageStudentsModal } from './components/ManageStudentsModal';
import { SettingsModal, SettingsTab } from './components/SettingsModal';
import { InfoModal, InfoModalTab } from './components/InfoModal';
import { AIHintModal } from './components/AIHintModal';
import { NotificationDrawer } from './components/NotificationDrawer';
import { LoginModal } from './components/LoginModal';
import { GradeLevelView } from './components/GradeLevelView';
import { SubjectView } from './components/SubjectView';
import { StatusView } from './components/StatusView';
import { SubmissionRosterModal } from './components/SubmissionRosterModal';
import { ResourcesView } from './components/ResourcesView';
import { CreateResourceModal } from './components/CreateResourceModal';
import { CreateClassroomModal } from './components/CreateClassroomModal';
import { AttendanceView } from './components/AttendanceView';
import { GradebookView } from './components/GradebookView';
import {
  SplitWorksheetsModal,
  buildGradeSplitMigrationPlan,
  GradeSplitMigrationPlan,
  extractBaseGrade,
} from './components/SplitWorksheetsModal';
import { CheckCircle2, KeyRound, AlertTriangle, FolderGit2, ShieldAlert } from 'lucide-react';
import { LogoutIcon } from './components/LogoutIcon';
import { AmbientThemeBackdrop } from './components/ThemeGraphics';
import {
  DEFAULT_PASTEL_THEME,
  applyPastelThemeToDom,
  getCachedActiveTheme,
  isAdminTeacherAccount,
  setCachedActiveTheme,
} from './utils/themes';
import { setApiSessionToken, clearApiSessionToken } from './utils/security';

const DEFAULT_GUEST_STUDENT: StudentProfile = {
  id: 'guest_student',
  code: '',
  name: 'ผู้เรียน',
  password: '',
  gradeLevel: '',
  avatar: '',
};

const DEFAULT_ADMIN_TEACHER: TeacherProfile = {
  id: 'tch_admin',
  code: 'ADMIN',
  name: 'ผู้ดูแลระบบ (Admin)',
  password: '',
  subject: 'ผู้ดูแลระบบ',
  avatar: '',
};

// Safe localStorage loader helper (only for category preferences)
const getInitialStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (err) {
    console.warn(`Could not load localStorage key "${key}":`, err);
  }
  return defaultValue;
};

const normalizeStudentCode = (code?: string): string => (code || '').trim().toUpperCase();

const SUBMISSION_STATUS_RANK: Record<Submission['status'], number> = {
  graded: 4,
  needs_revision: 3,
  submitted: 2,
  pending: 1,
  overdue: 0,
};

const matchesStudentSubmission = (
  sub: Submission,
  student: Pick<StudentProfile, 'id' | 'code'>
): boolean => {
  const normCode = normalizeStudentCode(student.code);
  const normId = (student.id || '').trim();
  const matchCode = Boolean(normCode) && normalizeStudentCode(sub.studentCode) === normCode;
  const matchId = Boolean(normId) && (sub.studentId || '').trim() === normId;
  return matchCode || matchId;
};

const pickBestSubmission = (candidates: Submission[]): Submission | undefined => {
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => {
    const rankDiff = (SUBMISSION_STATUS_RANK[b.status] ?? 0) - (SUBMISSION_STATUS_RANK[a.status] ?? 0);
    if (rankDiff !== 0) return rankDiff;
    const scoreDiff = (typeof b.score === 'number' ? 1 : 0) - (typeof a.score === 'number' ? 1 : 0);
    if (scoreDiff !== 0) return scoreDiff;
    const tsB = new Date(b.gradedAt || b.submissionDate).getTime() || 0;
    const tsA = new Date(a.gradedAt || a.submissionDate).getTime() || 0;
    return tsB - tsA;
  })[0];
};

export default function App() {
  // Roster & Dynamic Student User Management State (loaded exclusively from Firestore, never auto-seeded)
  const [studentsRoster, setStudentsRoster] = useState<StudentProfile[]>([]);

  // Dynamic Teacher Management State (loaded exclusively from Firestore, never auto-seeded)
  const [teachersRoster, setTeachersRoster] = useState<TeacherProfile[]>([]);

  // Authentication & Logged In User State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentStudentUser, setCurrentStudentUser] = useState<StudentProfile>(DEFAULT_GUEST_STUDENT);
  const [currentTeacherUser, setCurrentTeacherUser] = useState<TeacherProfile>(DEFAULT_ADMIN_TEACHER);
  const [role, setRole] = useState<UserRole>('student');
  const [showDefaultAdminWarning, setShowDefaultAdminWarning] = useState<boolean>(false);
  const [activeTheme, setActiveTheme] = useState<PastelThemeId>(() => {
    const cached = getCachedActiveTheme();
    applyPastelThemeToDom(cached);
    return cached;
  });

  const isAdminUser =
    isLoggedIn &&
    role === 'teacher' &&
    isAdminTeacherAccount(currentTeacherUser);

  React.useEffect(() => {
    applyPastelThemeToDom(activeTheme);
  }, [activeTheme]);

  // Tab State
  const [activeTab, setActiveTab] = useState<string>('home');
  const [isStudentInsideClassroom, setIsStudentInsideClassroom] = useState<boolean>(false);

  // Core Data State (loaded exclusively from Firestore)
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Dynamic Grade Levels & Subjects Management State (loaded strictly from Firestore, never seeded with mock grades/subjects)
  const [gradeLevelsList, setGradeLevelsList] = useState<string[]>(['ทั้งหมด']);
  const [subjectsList, setSubjectsList] = useState<string[]>(['ทั้งหมด']);
  const [periodConfigs, setPeriodConfigs] = useState<PeriodConfig[]>(() =>
    getInitialStorage('edusheet_period_configs', DEFAULT_PERIOD_CONFIGS)
  );
  const [studentGradebookEnabled, setStudentGradebookEnabled] = useState<boolean>(true);
  const [gradebookDisabledRooms, setGradebookDisabledRooms] = useState<string[]>([]);
  const [schoolCoverUrl, setSchoolCoverUrl] = useState<string>('');
  const [schoolName, setSchoolName] = useState<string>('');
  const [schoolSubtitle, setSchoolSubtitle] = useState<string>('');
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [subjectClassrooms, setSubjectClassrooms] = useState<SubjectClassroom[]>([]);
  const [teachingSchedules, setTeachingSchedules] = useState<TeachingSchedule[]>([]);
  const [attendanceSessions, setAttendanceSessions] = useState<AttendanceSession[]>([]);

  // Clear stale pre-seeded mock cache keys on mount
  React.useEffect(() => {
    try {
      localStorage.removeItem('edusheet_assignments');
      localStorage.removeItem('edusheet_submissions');
      localStorage.removeItem('edusheet_students');
      localStorage.removeItem('edusheet_teachers');
      localStorage.removeItem('edusheet_notifs');
      localStorage.removeItem('edusheet_resources');
      localStorage.removeItem('edusheet_schedules');
      localStorage.removeItem('edusheet_attendance');
      localStorage.removeItem('edusheet_subjects');
      localStorage.removeItem('edusheet_grade_levels');
    } catch (e) {}
  }, []);

  React.useEffect(() => {
    try {
      localStorage.setItem('edusheet_period_configs', JSON.stringify(periodConfigs));
    } catch (e) {}
  }, [periodConfigs]);

  // Google Firebase Firestore Real-Time Sync (Strictly read-only on startup; never auto-creates mock items)
  React.useEffect(() => {
    const unsubAssignments = subscribeAssignments((remoteAssignments) => {
      setAssignments(remoteAssignments || []);
    });

    const unsubSubmissions = subscribeSubmissions((remoteSubmissions) => {
      setSubmissions(remoteSubmissions || []);
    });

    const unsubStudents = subscribeStudents((remoteStudents) => {
      setStudentsRoster(remoteStudents || []);
    });

    const unsubTeachers = subscribeTeachers((remoteTeachers) => {
      setTeachersRoster(remoteTeachers || []);
    });

    const unsubSettings = subscribeSettings((remoteSettings) => {
      const cleanedGrades = (remoteSettings.gradeLevels || []).filter((g) => g && g !== 'ทั้งหมด');
      setGradeLevelsList(['ทั้งหมด', ...cleanedGrades]);

      const cleanedSubjects = (remoteSettings.subjects || []).filter((s) => s && s !== 'ทั้งหมด');
      setSubjectsList(['ทั้งหมด', ...cleanedSubjects]);

      if (remoteSettings.periodConfigs && remoteSettings.periodConfigs.length > 0) {
        setPeriodConfigs(remoteSettings.periodConfigs);
      }
      if (typeof remoteSettings.studentGradebookEnabled === 'boolean') {
        setStudentGradebookEnabled(remoteSettings.studentGradebookEnabled);
      }
      if (Array.isArray(remoteSettings.gradebookDisabledRooms)) {
        setGradebookDisabledRooms(remoteSettings.gradebookDisabledRooms);
      }
      if (typeof remoteSettings.schoolCoverUrl === 'string') {
        setSchoolCoverUrl(remoteSettings.schoolCoverUrl);
      }
      if (typeof remoteSettings.schoolName === 'string') {
        setSchoolName(remoteSettings.schoolName);
      }
      if (typeof remoteSettings.schoolSubtitle === 'string') {
        setSchoolSubtitle(remoteSettings.schoolSubtitle);
      }
      if (remoteSettings.themeColor) {
        setActiveTheme(remoteSettings.themeColor);
        applyPastelThemeToDom(remoteSettings.themeColor);
        setCachedActiveTheme(remoteSettings.themeColor);
      }
    });

    const unsubResources = subscribeResources((remoteResources) => {
      setResources(remoteResources || []);
    });

    const unsubSchedules = subscribeTeachingSchedules((remoteSchedules) => {
      setTeachingSchedules(remoteSchedules || []);
    });

    const unsubAttendance = subscribeAttendanceSessions((remoteSessions) => {
      setAttendanceSessions(remoteSessions || []);
    });

    const unsubSubjectClassrooms = subscribeSubjectClassrooms((remoteClassrooms) => {
      setSubjectClassrooms(remoteClassrooms || []);
    });

    return () => {
      unsubAssignments();
      unsubSubmissions();
      unsubStudents();
      unsubTeachers();
      unsubSettings();
      unsubResources();
      unsubSchedules();
      unsubAttendance();
      unsubSubjectClassrooms();
    };
  }, []);

  // Filter State for Home View
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    subject: 'ทั้งหมด',
    gradeLevel: 'ทั้งหมด',
    status: 'all',
    category: 'ทั้งหมด',
    dateSort: 'due_soon',
  });

  // Specialized View Tab States
  const [selectedGradeInView, setSelectedGradeInView] = useState('ทั้งหมด');
  const [selectedSubjectInView, setSelectedSubjectInView] = useState('ทั้งหมด');
  const [selectedStatusInView, setSelectedStatusInView] = useState('all');

  // Modal States
  const [activeSubmitModalAsg, setActiveSubmitModalAsg] = useState<Assignment | null>(null);
  const [activeGradingModalAsg, setActiveGradingModalAsg] = useState<{
    assignment: Assignment;
    submission?: Submission;
  } | null>(null);
  const [activeRosterModalAsg, setActiveRosterModalAsg] = useState<Assignment | null>(null);
  const [activeHintModalAsg, setActiveHintModalAsg] = useState<{
    assignment: Assignment;
    questionText?: string;
  } | null>(null);
  const [isCreateWorksheetOpen, setIsCreateWorksheetOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [createWorksheetDefaults, setCreateWorksheetDefaults] = useState<{
    subject?: string;
    gradeLevel?: string;
  } | null>(null);
  const [isCreateResourceOpen, setIsCreateResourceOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<LearningResource | null>(null);
  const [isCreateClassroomOpen, setIsCreateClassroomOpen] = useState(false);
  const [editingClassroom, setEditingClassroom] = useState<SubjectClassroom | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('grades');
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isManageStudentsOpen, setIsManageStudentsOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(true);
  const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [infoModalTab, setInfoModalTab] = useState<InfoModalTab>('guide');
  const [splitModalState, setSplitModalState] = useState<{
    isOpen: boolean;
    baseGrade?: string;
    focusAssignmentId?: string;
  }>({ isOpen: false });

  const handleOpenSettings = (tab: SettingsTab = 'grades') => {
    setSettingsInitialTab(tab);
    setIsSettingsModalOpen(true);
  };

  const handleOpenInfoModal = (tab: InfoModalTab) => {
    setInfoModalTab(tab);
    setIsInfoModalOpen(true);
  };

  // Toast Notification Message
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleChangeTheme = React.useCallback(
    (nextTheme: PastelThemeId) => {
      if (!isAdminUser) return;
      setActiveTheme(nextTheme);
      applyPastelThemeToDom(nextTheme);
      setCachedActiveTheme(nextTheme);
      saveSystemThemeToFirestore(nextTheme);
    },
    [isAdminUser]
  );

  // Login Success Handler
  const handleLoginSuccess = async (
    user: StudentProfile | TeacherProfile,
    loginRole: UserRole,
    meta?: { isDefaultAdminFallback?: boolean }
  ) => {
    if (loginRole === 'student') {
      const student = user as StudentProfile;
      setCurrentStudentUser({ ...student, password: '' });
      setRole('student');
      setSelectedGradeInView(student.gradeLevel);
      setShowDefaultAdminWarning(false);
      showToast(`ยินดีต้อนรับ ด.ญ./ด.ช. ${student.name} (รหัส ${student.code}) เข้าสู่ระบบ 👋`);
    } else {
      const teacher = user as TeacherProfile;
      setCurrentTeacherUser({ ...teacher, password: '' });
      setRole('teacher');
      setShowDefaultAdminWarning(Boolean(meta?.isDefaultAdminFallback));
      showToast(`ยินดีต้อนรับ ${teacher.name} เข้าสู่ระบบครูผู้สอน 📚`);
    }

    setIsLoggedIn(true);
    setIsLoginModalOpen(false);
    setActiveTab('home');
    setIsStudentInsideClassroom(false);
    setSelectedSubjectInView('ทั้งหมด');

    // Request short-lived HMAC signed Bearer token for /api/ai/* protection
    try {
      const res = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: loginRole,
          userId: user.id,
          code: user.code,
        }),
      });
      const data = await res.json();
      if (res.ok && data?.token) {
        setApiSessionToken(data.token);
      }
    } catch (err) {
      console.warn('Could not obtain signed API session token:', err);
    }
  };

  // Logout Handler - opens confirm dialog first
  const handleRequestLogOut = () => {
    setIsLogoutConfirmOpen(true);
  };

  const handleConfirmLogOut = () => {
    clearApiSessionToken();
    setShowDefaultAdminWarning(false);
    setIsLogoutConfirmOpen(false);
    setIsLoggedIn(false);
    setIsLoginModalOpen(true);
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  };

  // Submission Handler from Student
  const handleSubmitWorksheet = (
    assignmentId: string,
    answers: Record<string, string>,
    files?: any[],
    answerImages?: Record<string, string>
  ) => {
    const matchedAsg = assignments.find((a) => a.id === assignmentId);
    if (!matchedAsg) return;

    const bestExisting = pickBestSubmission(
      submissions.filter(
        (s) => s.assignmentId === assignmentId && matchesStudentSubmission(s, currentStudentUser)
      )
    );
    const existingSubIdx = bestExisting
      ? submissions.findIndex((s) => s.id === bestExisting.id)
      : -1;

    const cleanCode = (currentStudentUser.code || currentStudentUser.id || 'UNKNOWN').trim().slice(0, 64);
    const cleanGrade = (currentStudentUser.gradeLevel || matchedAsg.gradeLevel || 'ทั่วไป').trim().slice(0, 50);

    const newSub: Submission = {
      id: existingSubIdx >= 0 ? submissions[existingSubIdx].id : `sub_${Date.now()}`,
      assignmentId,
      studentId: currentStudentUser.id,
      studentName: currentStudentUser.name,
      studentCode: cleanCode,
      gradeLevel: cleanGrade,
      submissionDate: new Date().toISOString(),
      answers,
      answerImages: answerImages || {},
      files,
      status: 'submitted',
      maxScore: matchedAsg.totalPoints,
    };

    if (existingSubIdx >= 0) {
      const updated = [...submissions];
      updated[existingSubIdx] = newSub;
      setSubmissions(updated);
    } else {
      setSubmissions([newSub, ...submissions]);
    }

    // Persist to Cloud Firestore
    saveSubmissionToFirestore(newSub);

    // Add Notification
    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: '📥 ส่งใบงานเรียบร้อยแล้ว',
      message: `${currentStudentUser.name} ส่งใบงาน "${matchedAsg.title}" สำเร็จ`,
      date: 'เมื่อครู่นี้',
      type: 'new_assignment',
      isRead: false,
      assignmentId,
    };
    setNotifications([newNotif, ...notifications]);

    showToast(`ส่งใบงาน "${matchedAsg.title}" บนระบบเรียบร้อยแล้ว! 🎉`);
  };

  // Teacher Grade Save Handler
  const handleSaveGrade = (
    submissionId: string,
    score: number,
    comment: string,
    status: 'graded' | 'needs_revision',
    aiGraded?: boolean
  ) => {
    const targetSub = submissions.find((s) => s.id === submissionId);
    const targetAsg = assignments.find((a) => a.id === targetSub?.assignmentId);

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
              ...s,
              score,
              teacherComment: comment,
              status,
              gradedAt: new Date().toISOString(),
              ...(aiGraded !== undefined ? { aiGraded } : {}),
            }
          : s
      )
    );

    // Persist updated grade to Cloud Firestore
    if (targetSub) {
      const updatedSub: Submission = {
        ...targetSub,
        score,
        teacherComment: comment,
        status,
        gradedAt: new Date().toISOString(),
        ...(aiGraded !== undefined ? { aiGraded } : {}),
      };
      saveSubmissionToFirestore(updatedSub);
    }

    if (targetAsg) {
      const newNotif: NotificationItem = {
        id: `notif_${Date.now()}`,
        title: status === 'graded' ? '📝 ครูตรวจใบงานของคุณแล้ว' : '✏️ ใบงานต้องแก้ไขเพิ่มเติม',
        message:
          status === 'graded'
            ? `ใบงาน "${targetAsg.title}" ได้รับคะแนน ${score}/${targetAsg.totalPoints} คะแนน`
            : `ครูขอให้ปรับปรุงเพิ่มเติมในใบงาน "${targetAsg.title}"`,
        date: 'เมื่อครู่นี้',
        type: status === 'graded' ? 'graded' : 'revision',
        isRead: false,
        assignmentId: targetAsg.id,
      };
      setNotifications([newNotif, ...notifications]);
    }

    showToast(status === 'graded' ? 'บันทึกผลการตรวจเรียบร้อยแล้ว!' : 'แจ้งให้นักเรียนแก้ไขเรียบร้อยแล้ว!');
  };

  // Batch Teacher Grade Save Handler (for Multi-Student AI Grading)
  const handleBatchSaveGrades = (
    updates: Array<{
      submissionId: string;
      score: number;
      comment: string;
      status: 'graded' | 'needs_revision';
      aiGraded?: boolean;
    }>
  ) => {
    if (updates.length === 0) return;
    const nowIso = new Date().toISOString();
    const updateMap = new Map(updates.map((u) => [u.submissionId, u]));
    const updatedForFirestore: Submission[] = [];

    setSubmissions((prev) =>
      prev.map((s) => {
        const u = updateMap.get(s.id);
        if (!u) return s;
        const nextSub: Submission = {
          ...s,
          score: u.score,
          teacherComment: u.comment,
          status: u.status,
          gradedAt: nowIso,
          ...(u.aiGraded !== undefined ? { aiGraded: u.aiGraded } : {}),
        };
        updatedForFirestore.push(nextSub);
        return nextSub;
      })
    );

    if (updatedForFirestore.length > 0) {
      saveMultipleSubmissionsToFirestore(updatedForFirestore);
    }

    const firstAsg = assignments.find((a) => a.id === updatedForFirestore[0]?.assignmentId);
    if (firstAsg) {
      const newNotif: NotificationItem = {
        id: `notif_${Date.now()}`,
        title: `✨ บันทึกการตรวจด้วย AI จำนวน ${updates.length} คน`,
        message: `ใบงาน "${firstAsg.title}" บันทึกผลการตรวจพร้อมกันเรียบร้อยแล้ว`,
        date: 'เมื่อครู่นี้',
        type: 'graded',
        isRead: false,
        assignmentId: firstAsg.id,
      };
      setNotifications((prev) => [newNotif, ...prev]);
    }

    showToast(`บันทึกผลการตรวจพร้อมกัน ${updates.length} คนเรียบร้อยแล้ว! ✨`);
  };

  // Direct Gradebook Cell Upsert (creates or updates Submission in Firestore)
  const handleUpsertGradebookScore = (
    assignment: Assignment,
    student: StudentProfile,
    existingSubmission: Submission | undefined,
    score: number,
    comment: string,
    status: 'graded' | 'needs_revision'
  ) => {
    const nowIso = new Date().toISOString();
    const cleanComment = (comment || '').trim().slice(0, 3000);
    const cleanCode = (student.code || student.id || 'UNKNOWN').trim().slice(0, 64);
    const cleanGrade = (student.gradeLevel || assignment.gradeLevel || 'ทั่วไป').trim().slice(0, 50);
    const resolvedExisting =
      existingSubmission ||
      pickBestSubmission(
        submissions.filter(
          (s) => s.assignmentId === assignment.id && matchesStudentSubmission(s, student)
        )
      );

    let savedSubmission: Submission;

    if (resolvedExisting) {
      savedSubmission = {
        ...resolvedExisting,
        studentCode: resolvedExisting.studentCode?.trim() || cleanCode,
        gradeLevel: resolvedExisting.gradeLevel?.trim() || cleanGrade,
        score,
        teacherComment: cleanComment,
        status,
        gradedAt: nowIso,
      };
      setSubmissions((prev) =>
        prev.map((s) => (s.id === resolvedExisting.id ? savedSubmission : s))
      );
    } else {
      const safeAsgPart = (assignment.id || 'asg').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 48);
      const safeStdPart = (student.code || student.id || 'std').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32);
      const safeDocId = `sub_${safeAsgPart}_${safeStdPart}_${Date.now()}`.slice(0, 128);

      savedSubmission = {
        id: safeDocId,
        assignmentId: assignment.id,
        studentId: student.id || `std_${safeStdPart}`,
        studentName: (student.name || cleanCode).trim().slice(0, 200),
        studentCode: cleanCode,
        gradeLevel: cleanGrade,
        submissionDate: nowIso,
        answers: {},
        status,
        score,
        maxScore: assignment.totalPoints,
        teacherComment: cleanComment,
        gradedAt: nowIso,
      };
      setSubmissions((prev) => [savedSubmission, ...prev]);
    }

    saveSubmissionToFirestore(savedSubmission);

    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: status === 'graded' ? '📝 อัปเดตคะแนนในสมุดเก็บคะแนน' : '✏️ ใบงานต้องแก้ไขเพิ่มเติม',
      message: `ใบงาน "${assignment.title}" (${student.name}) ได้รับคะแนน ${score}/${assignment.totalPoints} คะแนน`,
      date: 'เมื่อครู่นี้',
      type: status === 'graded' ? 'graded' : 'revision',
      isRead: false,
      assignmentId: assignment.id,
    };
    setNotifications((prev) => [newNotif, ...prev]);
    showToast(`บันทึกคะแนนของ "${student.name}" (${score}/${assignment.totalPoints}) ลงสมุดคะแนนแล้ว ✅`);
  };

  // Create Assignment Handler
  const handleCreateAssignment = (newAsg: Assignment) => {
    setAssignments([newAsg, ...assignments]);
    saveAssignmentToFirestore(newAsg);

    const newNotif: NotificationItem = {
      id: `notif_${Date.now()}`,
      title: '📌 ประกาศใบงานใหม่',
      message: `ครูเพิ่มใบงานใหม่ วิชา${newAsg.subject} เรื่อง "${newAsg.title}"`,
      date: 'เมื่อครู่นี้',
      type: 'new_assignment',
      isRead: false,
      assignmentId: newAsg.id,
    };
    setNotifications([newNotif, ...notifications]);
    showToast(`สร้างและเผยแพร่ใบงาน "${newAsg.title}" เรียบร้อยแล้ว! ✨`);
  };

  // Update Assignment Handler for Teachers
  const handleUpdateAssignment = (updatedAsg: Assignment) => {
    setAssignments((prev) => prev.map((a) => (a.id === updatedAsg.id ? updatedAsg : a)));
    saveAssignmentToFirestore(updatedAsg);
    showToast(`แก้ไขและอัปเดตใบงาน "${updatedAsg.title}" เรียบร้อยแล้ว! ✏️`);
  };

  // Delete Assignment Handler for Teachers
  const handleDeleteAssignment = (assignmentId: string) => {
    const targetAsg = assignments.find((a) => a.id === assignmentId);
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    setSubmissions((prev) => prev.filter((s) => s.assignmentId !== assignmentId));
    deleteAssignmentFromFirestore(assignmentId);
    showToast(`ลบใบงาน "${targetAsg?.title || ''}" ออกจากระบบเรียบร้อยแล้ว 🗑️`);
  };

  // Batch Migrate / Split Worksheets & Submissions by Student Configured Classroom
  const handleExecuteSplitMigration = async (plan: GradeSplitMigrationPlan) => {
    if (plan.items.length === 0) return;

    const upsertAsgMap = new Map(plan.upsertAssignments.map((a) => [a.id, a]));
    const deleteAsgSet = new Set(plan.deleteAssignmentIds);
    const upsertSubMap = new Map(plan.upsertSubmissions.map((s) => [s.id, s]));

    setAssignments((prev) => {
      const updated = prev
        .filter((a) => !deleteAsgSet.has(a.id))
        .map((a) => upsertAsgMap.get(a.id) || a);
      const existingIds = new Set(updated.map((a) => a.id));
      const newlyCreated = plan.upsertAssignments.filter((a) => !existingIds.has(a.id));
      return [...newlyCreated, ...updated];
    });

    setSubmissions((prev) =>
      prev.map((s) => upsertSubMap.get(s.id) || s)
    );

    await batchMigrateWorksheetsAndSubmissions({
      upsertAssignments: plan.upsertAssignments,
      deleteAssignmentIds: plan.deleteAssignmentIds,
      upsertSubmissions: plan.upsertSubmissions,
    });

    showToast(
      `โยกใบงานชั้น ${plan.baseGrade} แยกตามห้องเรียบร้อยแล้ว (${plan.items.length} เรื่อง · จัดเรียงงานส่ง ${plan.upsertSubmissions.length} รายการ) ✅`
    );
  };

  // Learning Resources Handlers
  const handleSaveResource = (res: LearningResource) => {
    const existingIdx = resources.findIndex((r) => r.id === res.id);
    if (existingIdx >= 0) {
      const updated = [...resources];
      updated[existingIdx] = res;
      setResources(updated);
      showToast(`อัปเดตสื่อการเรียนรู้ "${res.title}" เรียบร้อยแล้ว! 📚`);
    } else {
      setResources([res, ...resources]);
      showToast(`เพิ่มสื่อการเรียนรู้ใหม่ "${res.title}" เรียบร้อยแล้ว! ✨`);
    }
    saveResourceToFirestore(res);
  };

  const handleDeleteResource = (resId: string) => {
    const target = resources.find((r) => r.id === resId);
    setResources((prev) => prev.filter((r) => r.id !== resId));
    deleteResourceFromFirestore(resId);
    showToast(`ลบสื่อการเรียนรู้ "${target?.title || ''}" เรียบร้อยแล้ว 🗑️`);
  };

  // Subject Classrooms Handlers
  const handleSaveSubjectClassroom = (cls: SubjectClassroom) => {
    const exists = subjectClassrooms.some((c) => c.id === cls.id);
    if (exists) {
      setSubjectClassrooms((prev) => prev.map((c) => (c.id === cls.id ? cls : c)));
      showToast(`อัปเดตห้องเรียน "${cls.courseCode} ${cls.title}" เรียบร้อยแล้ว 🏫`);
    } else {
      setSubjectClassrooms((prev) => [cls, ...prev]);
      showToast(`สร้างห้องเรียนรายวิชา "${cls.courseCode} ${cls.title}" เรียบร้อยแล้ว ✨`);
    }
    saveSubjectClassroomToFirestore(cls);
  };

  const handleDeleteSubjectClassroom = (classroomId: string) => {
    const target = subjectClassrooms.find((c) => c.id === classroomId);
    setSubjectClassrooms((prev) => prev.filter((c) => c.id !== classroomId));
    deleteSubjectClassroomFromFirestore(classroomId);
    showToast(`ลบห้องเรียน "${target ? `${target.courseCode} ${target.title}` : ''}" เรียบร้อยแล้ว 🗑️`);
  };

  const handleSaveBatchSubjectClassrooms = async (classroomsList: SubjectClassroom[]) => {
    if (classroomsList.length === 0) return;
    setSubjectClassrooms((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const newItems = classroomsList.filter((c) => !existingIds.has(c.id));
      return [...newItems, ...prev];
    });
    await saveMultipleSubjectClassroomsToFirestore(classroomsList);
    showToast(`บันทึกห้องเรียนรายวิชาทั้งหมด ${classroomsList.length} วิชาลงระบบเรียบร้อยแล้ว! 🏫`);
  };

  // Teaching Schedule & Attendance Handlers
  const handleSaveSchedule = (schedule: TeachingSchedule) => {
    const exists = teachingSchedules.some((s) => s.id === schedule.id);
    if (exists) {
      setTeachingSchedules((prev) =>
        prev.map((s) => (s.id === schedule.id ? schedule : s))
      );
      showToast(`อัปเดตคาบสอนวิชา ${schedule.subject} (${schedule.gradeLevel}) เรียบร้อยแล้ว 📅`);
    } else {
      setTeachingSchedules((prev) => [...prev, schedule]);
      showToast(`เพิ่มคาบสอนวิชา ${schedule.subject} (${schedule.gradeLevel}) ลงตารางสอนแล้ว ✨`);
    }
    saveTeachingScheduleToFirestore(schedule);
  };

  const handleDeleteSchedule = (scheduleId: string) => {
    const target = teachingSchedules.find((s) => s.id === scheduleId);
    setTeachingSchedules((prev) => prev.filter((s) => s.id !== scheduleId));
    deleteTeachingScheduleFromFirestore(scheduleId);
    showToast(`ลบคาบสอน "${target?.subject || ''}" ออกจากตารางสอนแล้ว 🗑️`);
  };

  const handleSaveAttendanceSession = (session: AttendanceSession) => {
    const exists = attendanceSessions.some((s) => s.id === session.id);
    if (exists) {
      setAttendanceSessions((prev) =>
        prev.map((s) => (s.id === session.id ? session : s))
      );
      showToast(`อัปเดตผลการเช็คชื่อวิชา ${session.subject} (${session.gradeLevel}) เรียบร้อยแล้ว ✅`);
    } else {
      setAttendanceSessions((prev) => [session, ...prev]);
      showToast(`บันทึกการเช็คชื่อวิชา ${session.subject} (${session.gradeLevel}) เรียบร้อยแล้ว 🎉`);
    }
    saveAttendanceSessionToFirestore(session);
  };

  const handleDeleteAttendanceSession = (sessionId: string) => {
    setAttendanceSessions((prev) => prev.filter((s) => s.id !== sessionId));
    deleteAttendanceSessionFromFirestore(sessionId);
    showToast('ลบบันทึกการเช็คชื่อเรียบร้อยแล้ว 🗑️');
  };

  const handleSavePeriodConfigs = (nextConfigs: PeriodConfig[]) => {
    setPeriodConfigs(nextConfigs);
    savePeriodConfigsToFirestore(nextConfigs);
    showToast('บันทึกการตั้งค่าคาบเรียนและคาบพักเที่ยงเรียบร้อยแล้ว ⏰');
  };

  const handleSaveGradebookVisibility = (nextEnabled: boolean, nextDisabledRooms: string[]) => {
    setStudentGradebookEnabled(nextEnabled);
    setGradebookDisabledRooms(nextDisabledRooms);
    saveGradebookVisibilityToFirestore(nextEnabled, nextDisabledRooms);
    showToast(
      nextEnabled
        ? 'อัปเดตสถานะ: เปิดสมุดคะแนนให้นักเรียนเข้าดูได้แล้ว 🔓'
        : 'อัปเดตสถานะ: ปิดสมุดคะแนนของนักเรียนชั่วคราวแล้ว 🔒'
    );
  };

  // Category & Grade Level Management Handlers
  const handleAddGradeLevel = (newGrade: string) => {
    if (!gradeLevelsList.includes(newGrade)) {
      const nextGrades = [...gradeLevelsList, newGrade];
      setGradeLevelsList(nextGrades);
      saveSettingsToFirestore(nextGrades, subjectsList);
      showToast(`เพิ่มระดับชั้น "${newGrade}" สำเร็จ! 🎓`);
    }
  };

  const handleRemoveGradeLevel = (gradeToRemove: string) => {
    const nextGrades = gradeLevelsList.filter((g) => g !== gradeToRemove);
    setGradeLevelsList(nextGrades);
    saveSettingsToFirestore(nextGrades, subjectsList);
    showToast(`ลบระดับชั้น "${gradeToRemove}" เรียบร้อยแล้ว`);
  };

  const handleAddSubject = (newSubject: string) => {
    if (!subjectsList.includes(newSubject)) {
      const nextSubjects = [...subjectsList, newSubject];
      setSubjectsList(nextSubjects);
      saveSettingsToFirestore(gradeLevelsList, nextSubjects);
      showToast(`เพิ่มรายวิชา "${newSubject}" สำเร็จ! 📚`);
    }
  };

  const handleRemoveSubject = (subjectToRemove: string) => {
    const nextSubjects = subjectsList.filter((s) => s !== subjectToRemove);
    setSubjectsList(nextSubjects);
    saveSettingsToFirestore(gradeLevelsList, nextSubjects);
    showToast(`ลบรายวิชา "${subjectToRemove}" เรียบร้อยแล้ว`);
  };

  // Student Management Handlers
  const handleAddStudent = (newStd: StudentProfile) => {
    setStudentsRoster((prev) => [newStd, ...prev]);
    saveStudentToFirestore(newStd);
    showToast(`เพิ่มบัญชีนักเรียน "${newStd.name}" (${newStd.code}) เรียบร้อยแล้ว! 👨‍🎓`);
  };

  const handleImportStudents = (importedList: StudentProfile[]) => {
    if (importedList.length === 0) return;

    setStudentsRoster((prev) => {
      const rosterMap = new Map<string, StudentProfile>();
      // Preserve existing order / data
      for (const std of prev) {
        rosterMap.set(std.code.toUpperCase(), std);
      }
      // Insert or update from importedList
      for (const item of importedList) {
        const key = item.code.toUpperCase();
        const existing = rosterMap.get(key);
        if (existing) {
          rosterMap.set(key, {
            ...existing,
            ...item,
            id: existing.id,
          });
        } else {
          rosterMap.set(key, item);
        }
      }
      return Array.from(rosterMap.values());
    });

    saveMultipleStudentsToFirestore(importedList);
    showToast(`นำเข้าและอัปเดตผู้ใช้นักเรียนจาก Excel เรียบร้อยแล้ว ${importedList.length} รายการ! 📊`);
  };

  const handleUpdateStudent = (updatedStd: StudentProfile) => {
    setStudentsRoster((prev) => prev.map((s) => (s.id === updatedStd.id ? updatedStd : s)));
    saveStudentToFirestore(updatedStd);
    showToast(`อัปเดตข้อมูลนักเรียน "${updatedStd.name}" เรียบร้อยแล้ว`);
  };

  const handleDeleteStudent = (studentId: string) => {
    const target = studentsRoster.find((s) => s.id === studentId);
    setStudentsRoster((prev) => prev.filter((s) => s.id !== studentId));
    deleteStudentFromFirestore(studentId);
    showToast(`ลบบัญชีนักเรียน "${target?.name || ''}" เรียบร้อยแล้ว`);
  };

  // Teacher CRUD Handlers
  const handleAddTeacher = (newTch: TeacherProfile) => {
    setTeachersRoster((prev) => [newTch, ...prev]);
    saveTeacherToFirestore(newTch);
    showToast(`เพิ่มบัญชีครูผู้สอน "${newTch.name}" เรียบร้อยแล้ว 👨‍🏫`);
  };

  const handleUpdateTeacher = (updatedTch: TeacherProfile) => {
    setTeachersRoster((prev) => prev.map((t) => (t.id === updatedTch.id ? updatedTch : t)));
    if (currentTeacherUser.id === updatedTch.id) {
      setCurrentTeacherUser(updatedTch);
    }
    saveTeacherToFirestore(updatedTch);
    showToast(`อัปเดตข้อมูลครูผู้สอน "${updatedTch.name}" เรียบร้อยแล้ว`);
  };

  const handleSaveSchoolBranding = (branding: {
    schoolCoverUrl: string;
    schoolName: string;
    schoolSubtitle: string;
  }) => {
    setSchoolCoverUrl(branding.schoolCoverUrl);
    setSchoolName(branding.schoolName);
    setSchoolSubtitle(branding.schoolSubtitle);
    saveSchoolBrandingToFirestore(branding);
    showToast('บันทึกรูปภาพโรงเรียนหน้าปกเรียบร้อยแล้ว');
  };

  const handleDeleteTeacher = (teacherId: string) => {
    const target = teachersRoster.find((t) => t.id === teacherId);
    setTeachersRoster((prev) => prev.filter((t) => t.id !== teacherId));
    deleteTeacherFromFirestore(teacherId);
    showToast(`ลบบัญชีครูผู้สอน "${target?.name || ''}" เรียบร้อยแล้ว`);
  };

  // Full Database Backup Import & Reset Handlers
  const handleImportFullBackup = (data: {
    assignments?: Assignment[];
    submissions?: Submission[];
    students?: StudentProfile[];
    gradeLevels?: string[];
    subjects?: string[];
  }) => {
    if (data.assignments && data.assignments.length > 0) {
      setAssignments(data.assignments);
    }
    if (data.submissions && data.submissions.length > 0) {
      setSubmissions(data.submissions);
    }
    if (data.students && data.students.length > 0) {
      setStudentsRoster(data.students);
    }
    if (data.gradeLevels && data.gradeLevels.length > 0) {
      setGradeLevelsList(data.gradeLevels);
    }
    if (data.subjects && data.subjects.length > 0) {
      setSubjectsList(data.subjects);
    }
    showToast('กู้คืนข้อมูลสำรองของโรงเรียนเรียบร้อยแล้ว! 📦');
  };

  const handleResetFactoryData = async () => {
    await clearDatabase();
    setAssignments([]);
    setSubmissions([]);
    setStudentsRoster([]);
    setTeachersRoster([]);
    setResources([]);
    setSubjectClassrooms([]);
    setTeachingSchedules([]);
    setAttendanceSessions([]);
    setGradeLevelsList(['ทั้งหมด']);
    setSubjectsList(['ทั้งหมด']);
    setPeriodConfigs(DEFAULT_PERIOD_CONFIGS);
    setStudentGradebookEnabled(true);
    setGradebookDisabledRooms([]);
    setActiveTheme(DEFAULT_PASTEL_THEME);
    applyPastelThemeToDom(DEFAULT_PASTEL_THEME);
    setCachedActiveTheme(DEFAULT_PASTEL_THEME);
    setNotifications([]);
    try {
      localStorage.removeItem('edusheet_grade_levels');
      localStorage.removeItem('edusheet_subjects');
      localStorage.removeItem('edusheet_period_configs');
    } catch (e) {}
    showToast('ล้างข้อมูลทั้งหมดในฐานข้อมูลเรียบร้อยแล้ว 🔄');
  };

  const handleResetKeepUsers = async () => {
    await resetDataKeepUsers();
    setAssignments([]);
    setSubmissions([]);
    setResources([]);
    setSubjectClassrooms([]);
    setTeachingSchedules([]);
    setAttendanceSessions([]);
    setNotifications([]);
    setGradeLevelsList(['ทั้งหมด']);
    setSubjectsList(['ทั้งหมด']);
    setPeriodConfigs(DEFAULT_PERIOD_CONFIGS);
    setStudentGradebookEnabled(true);
    setGradebookDisabledRooms([]);
    setActiveTheme(DEFAULT_PASTEL_THEME);
    applyPastelThemeToDom(DEFAULT_PASTEL_THEME);
    setCachedActiveTheme(DEFAULT_PASTEL_THEME);
    try {
      localStorage.removeItem('edusheet_grade_levels');
      localStorage.removeItem('edusheet_subjects');
      localStorage.removeItem('edusheet_period_configs');
    } catch (e) {}
    showToast('ล้างข้อมูลใบงาน สื่อ และตั้งค่าระบบเรียบร้อยแล้ว (เก็บข้อมูลผู้ใช้งานไว้) 🧹');
  };

  const handleRestoreAllWorksheets = async () => {
    setAssignments(INITIAL_ASSIGNMENTS);
    setSubmissions(INITIAL_SUBMISSIONS);
    for (const asg of INITIAL_ASSIGNMENTS) {
      await saveAssignmentToFirestore(asg);
    }
    await saveMultipleSubmissionsToFirestore(INITIAL_SUBMISSIONS);
    showToast('กู้คืนใบงานและข้อมูลทั้งหมดของโรงเรียนเรียบร้อยแล้ว! 📦✨');
  };

  // Notifications read handler
  const handleMarkAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Strict Assignment Visibility Isolation:
  // - Teachers see ALL assignments across all grade levels.
  // - Unauthenticated sessions see NO student worksheets.
  // - Students ONLY see published assignments assigned specifically to their student code (if targeted)
  //   or assigned to their grade/room.
  const visibleAssignments = React.useMemo(() => {
    if (role === 'teacher') return assignments;
    if (!isLoggedIn) return [];

    const stdGrade = (currentStudentUser?.gradeLevel || '').trim();
    const stdCode = normalizeStudentCode(currentStudentUser?.code);
    if (!stdGrade) return [];

    // e.g. If stdGrade is "ม.1/1", baseGrade is "ม.1"
    const baseGrade = stdGrade.includes('/') ? stdGrade.split('/')[0].trim() : stdGrade;

    return assignments.filter((asg) => {
      // 1. Unpublished / draft worksheets are hidden from students
      if (asg.isPublished === false) return false;

      // 2. If teacher specified individual student codes, enforce strict per-student match
      if (asg.assignedStudentCodes && asg.assignedStudentCodes.length > 0) {
        return Boolean(
          stdCode && asg.assignedStudentCodes.some((c) => normalizeStudentCode(c) === stdCode)
        );
      }

      // 3. Class/Room level assignment matching
      const asgGrade = (asg.gradeLevel || '').trim();
      if (asgGrade === stdGrade) return true;
      if (asgGrade === 'ทั้งหมด') return true;
      if (asgGrade === `${baseGrade} (ทุกห้อง)`) return true;
      if (!asgGrade.includes('/') && asgGrade === baseGrade) return true;
      return false;
    });
  }, [assignments, role, isLoggedIn, currentStudentUser?.gradeLevel, currentStudentUser?.code]);

  // Strict Submission Isolation for students (only their own submissions)
  const visibleSubmissions = React.useMemo(() => {
    if (role === 'teacher') return submissions;
    if (!isLoggedIn) return [];
    return submissions.filter((s) => matchesStudentSubmission(s, currentStudentUser));
  }, [submissions, role, isLoggedIn, currentStudentUser?.code, currentStudentUser?.id]);

  // Strict Notification Isolation for students (only for worksheets assigned to them)
  const visibleNotifications = React.useMemo(() => {
    if (role === 'teacher') return notifications;
    if (!isLoggedIn) return [];
    const allowedIds = new Set(visibleAssignments.map((a) => a.id));
    return notifications.filter(
      (n) => !n.assignmentId || allowedIds.has(n.assignmentId)
    );
  }, [notifications, role, isLoggedIn, visibleAssignments]);

  // Helper: check if a student grade/room matches a target gradeLevel string
  const studentMatchesGradeTarget = React.useCallback((studentGrade: string | undefined, targetGrade: string | undefined) => {
    const cleanStudent = (studentGrade || '').trim();
    if (!cleanStudent) return false;
    const cleanTarget = (targetGrade || '').trim();
    if (!cleanTarget || cleanTarget === 'ทั้งหมด') return true;
    if (cleanStudent === cleanTarget) return true;
    const baseStudent = cleanStudent.includes('/') ? cleanStudent.split('/')[0].trim() : cleanStudent;
    const normalizedTarget = cleanTarget.replace(/\s*\(ทุกห้อง\)$/, '').trim();
    if (normalizedTarget === baseStudent) return true;
    if (!cleanTarget.includes('/') && cleanTarget === baseStudent) return true;
    return false;
  }, []);

  // Strict Teaching Schedule Isolation for students (only schedules for their room/grade)
  const visibleTeachingSchedules = React.useMemo(() => {
    if (role === 'teacher') return teachingSchedules;
    if (!isLoggedIn) return [];
    const stdGrade = currentStudentUser?.gradeLevel;
    if (!stdGrade) return [];
    return teachingSchedules.filter((sch) => studentMatchesGradeTarget(stdGrade, sch.gradeLevel));
  }, [teachingSchedules, role, isLoggedIn, currentStudentUser?.gradeLevel, studentMatchesGradeTarget]);

  // Subjects that the currently logged-in student ACTUALLY studies
  // Derived strictly from: visible assignments, matching timetable schedules, matching attendance sessions,
  // room-matched published classrooms, and room-matched learning resources.
  const studentEnrolledSubjects = React.useMemo(() => {
    const enrolled = new Set<string>();
    if (role !== 'student' || !isLoggedIn) return enrolled;

    const stdGrade = currentStudentUser?.gradeLevel;
    const stdCode = currentStudentUser?.code;
    if (!stdGrade) return enrolled;

    const visibleAsgIds = new Set(visibleAssignments.map((a) => a.id));

    visibleAssignments.forEach((a) => {
      if (a.subject?.trim()) enrolled.add(a.subject.trim());
    });

    visibleTeachingSchedules.forEach((sch) => {
      if (sch.subject?.trim()) enrolled.add(sch.subject.trim());
    });

    attendanceSessions.forEach((ses) => {
      const matchGrade = ses.gradeLevel !== 'ทั้งหมด' && studentMatchesGradeTarget(stdGrade, ses.gradeLevel);
      const normStdCode = normalizeStudentCode(stdCode);
      const matchRecord = Boolean(
        normStdCode && ses.records?.some((r) => normalizeStudentCode(r.studentCode) === normStdCode)
      );
      if ((matchGrade || matchRecord) && ses.subject?.trim()) {
        enrolled.add(ses.subject.trim());
      }
    });

    resources.forEach((res) => {
      if (res.gradeLevel && res.gradeLevel !== 'ทั้งหมด' && studentMatchesGradeTarget(stdGrade, res.gradeLevel)) {
        if (res.subject?.trim()) enrolled.add(res.subject.trim());
      }
    });

    subjectClassrooms.forEach((cls) => {
      if (cls.isPublished === false || !cls.subject?.trim()) return;
      if (cls.gradeLevel && cls.gradeLevel !== 'ทั้งหมด') {
        if (studentMatchesGradeTarget(stdGrade, cls.gradeLevel)) {
          enrolled.add(cls.subject.trim());
        }
        return;
      }
      // If saved classroom targets 'ทั้งหมด', include only if it links at least one visible assignment/resource
      // or was explicitly customized (not an empty auto starter placeholder)
      const linkedAsgIds = (cls.units || []).flatMap((u) => u.linkedAssignmentIds || []);
      if (linkedAsgIds.length > 0) {
        if (linkedAsgIds.some((id) => visibleAsgIds.has(id))) {
          enrolled.add(cls.subject.trim());
        }
        return;
      }
      const isEmptyAutoPlaceholder =
        cls.units?.length === 1 &&
        (cls.units[0].id.startsWith('unit_auto_starter_') || cls.units[0].id.startsWith('unit_w22103_')) &&
        !cls.units[0].mediaUrl &&
        (cls.units[0].linkedResourceIds?.length || 0) === 0;
      if (!isEmptyAutoPlaceholder) {
        enrolled.add(cls.subject.trim());
      }
    });

    return enrolled;
  }, [
    role,
    isLoggedIn,
    currentStudentUser?.gradeLevel,
    currentStudentUser?.code,
    visibleAssignments,
    visibleTeachingSchedules,
    attendanceSessions,
    resources,
    subjectClassrooms,
    studentMatchesGradeTarget,
  ]);

  // Strict Subject List Isolation: students ONLY see subjects they actually study
  const visibleSubjectsList = React.useMemo(() => {
    if (role === 'teacher') return subjectsList;
    if (!isLoggedIn) return ['ทั้งหมด'];
    const ordered = subjectsList.filter((s) => s !== 'ทั้งหมด' && studentEnrolledSubjects.has(s));
    const extras = Array.from(studentEnrolledSubjects).filter(
      (s) => s !== 'ทั้งหมด' && !subjectsList.includes(s)
    );
    return ['ทั้งหมด', ...ordered, ...extras];
  }, [role, isLoggedIn, subjectsList, studentEnrolledSubjects]);

  // Reset selected subject filter or removed student tabs if student switches accounts
  React.useEffect(() => {
    if (role === 'student') {
      if (selectedSubjectInView !== 'ทั้งหมด' && !visibleSubjectsList.includes(selectedSubjectInView)) {
        setSelectedSubjectInView('ทั้งหมด');
      }
      if (activeTab === 'grades' || activeTab === 'subjects') {
        setActiveTab('home');
      }
    }
    if (activeTab !== 'home') {
      setIsStudentInsideClassroom(false);
    }
  }, [role, activeTab, selectedSubjectInView, visibleSubjectsList]);

  // Strict Resource Isolation for students: matching room/grade AND enrolled subject
  const visibleResources = React.useMemo(() => {
    if (role === 'teacher') return resources;
    if (!isLoggedIn) return [];
    const stdGrade = currentStudentUser?.gradeLevel;
    if (!stdGrade) return [];
    return resources.filter((res) => {
      if (!studentMatchesGradeTarget(stdGrade, res.gradeLevel)) return false;
      if (res.gradeLevel === 'ทั้งหมด' && studentEnrolledSubjects.size > 0) {
        return studentEnrolledSubjects.has(res.subject);
      }
      return true;
    });
  }, [resources, role, isLoggedIn, currentStudentUser?.gradeLevel, studentMatchesGradeTarget, studentEnrolledSubjects]);

  // Strict Subject Classrooms Isolation for students
  const visibleSubjectClassrooms = React.useMemo(() => {
    if (role === 'teacher') return subjectClassrooms;
    if (!isLoggedIn) return [];
    const stdGrade = currentStudentUser?.gradeLevel;
    if (!stdGrade) return [];
    return subjectClassrooms.filter(
      (cls) =>
        cls.isPublished !== false &&
        studentMatchesGradeTarget(stdGrade, cls.gradeLevel) &&
        studentEnrolledSubjects.has(cls.subject)
    );
  }, [subjectClassrooms, role, isLoggedIn, currentStudentUser?.gradeLevel, studentMatchesGradeTarget, studentEnrolledSubjects]);

  // Filtered assignments logic for Home View
  const filteredHomeAssignments = visibleAssignments
    .filter((asg) => {
      // Students do not use manual search/filter bars because teachers pre-configure assignments per class
      if (role === 'student') return true;

      // Search text
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchTitle = asg.title.toLowerCase().includes(query);
        const matchSubject = asg.subject.toLowerCase().includes(query);
        const matchTeacher = asg.teacherName.toLowerCase().includes(query);
        const matchDesc = asg.description.toLowerCase().includes(query);
        if (!matchTitle && !matchSubject && !matchTeacher && !matchDesc) return false;
      }

      // Subject
      if (filters.subject !== 'ทั้งหมด' && asg.subject !== filters.subject) return false;

      // Grade Level
      if (filters.gradeLevel !== 'ทั้งหมด' && asg.gradeLevel !== filters.gradeLevel) return false;

      // Category
      if (filters.category !== 'ทั้งหมด' && asg.category !== filters.category) return false;

      // Status
      const sub = submissions.find((s) => s.assignmentId === asg.id);
      const now = new Date();
      const isOverdue = new Date(asg.dueDate).getTime() < now.getTime() && (!sub || sub.status === 'pending');

      if (filters.status === 'pending') return (!sub || sub.status === 'pending') && !isOverdue;
      if (filters.status === 'submitted') return sub?.status === 'submitted';
      if (filters.status === 'needs_revision') return sub?.status === 'needs_revision';
      if (filters.status === 'graded') return sub?.status === 'graded';
      if (filters.status === 'overdue') return isOverdue;

      return true;
    })
    .sort((a, b) => {
      if (role === 'student' || filters.dateSort === 'due_soon') {
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      if (filters.dateSort === 'newest') {
        return new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime();
      }
      if (filters.dateSort === 'points') {
        return b.totalPoints - a.totalPoints;
      }
      return 0;
    });

  // Calculate overview counts for Banner Stats
  const totalCount = visibleAssignments.length;

  const pendingCount = role === 'teacher' 
    ? submissions.filter((s) => s.status === 'submitted').length // Submissions needing grading
    : visibleAssignments.filter((a) => {
        const s = visibleSubmissions.find((sub) => sub.assignmentId === a.id);
        return !s || s.status === 'pending';
      }).length;

  const submittedCount = role === 'teacher'
    ? submissions.filter((s) => s.status === 'graded').length // Submissions already graded
    : visibleAssignments.filter((a) => {
        const s = visibleSubmissions.find((sub) => sub.assignmentId === a.id);
        return s && (s.status === 'submitted' || s.status === 'graded');
      }).length;

  const dueSoonCount = visibleAssignments.filter((a) => {
    const s = visibleSubmissions.find((sub) => sub.assignmentId === a.id);
    const diffHours = (new Date(a.dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 24 && (!s || s.status === 'pending');
  }).length;

  const isGradebookVisibleToCurrentUser =
    role === 'teacher' ||
    (isLoggedIn &&
      studentGradebookEnabled &&
      Boolean(currentStudentUser.gradeLevel?.trim()) &&
      !gradebookDisabledRooms.some((disabledRoom) =>
        studentMatchesGradeTarget(currentStudentUser.gradeLevel, disabledRoom)
      ));

  const m6MigrationPlan = React.useMemo(() => {
    if (role !== 'teacher') return null;
    return buildGradeSplitMigrationPlan({
      baseGrade: 'ม.6',
      assignments,
      submissions,
      studentsRoster,
      gradeLevelsList,
    });
  }, [role, assignments, submissions, studentsRoster, gradeLevelsList]);

  React.useEffect(() => {
    if (role === 'student' && !isGradebookVisibleToCurrentUser && activeTab === 'gradebook') {
      setActiveTab('home');
    }
  }, [role, isGradebookVisibleToCurrentUser, activeTab]);

  return (
    <div className="relative min-h-screen bg-school-canvas text-slate-900 dark:text-slate-100 flex flex-col font-sarabun">
      <AmbientThemeBackdrop />

      {/* 3-Zone Header Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={role}
        setRole={setRole}
        unreadNotifCount={visibleNotifications.filter((n) => !n.isRead).length}
        onOpenNotifs={() => setIsNotifDrawerOpen(true)}
        onOpenManageCategories={() => handleOpenSettings('grades')}
        onOpenManageStudents={() => handleOpenSettings('students')}
        onOpenSettings={handleOpenSettings}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogOut={handleRequestLogOut}
        student={currentStudentUser}
        teacher={currentTeacherUser}
        isLoggedIn={isLoggedIn}
        showGradebookTab={isGradebookVisibleToCurrentUser}
        isAdmin={isAdminUser}
      />

      {/* Main Container (Responsive padding with mobile bottom nav safe-area) */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-10">


        {/* Tab 1: Home Dashboard */}
        {activeTab === 'home' && (
          <div>
            {!(role === 'student' && isStudentInsideClassroom) && (
              <BannerHero
                role={role}
                student={currentStudentUser}
                teacher={currentTeacherUser}
                totalCount={totalCount}
                pendingCount={pendingCount}
                submittedCount={submittedCount}
                dueSoonCount={dueSoonCount}
                searchTerm={filters.search}
                setSearchTerm={(term) => setFilters((prev) => ({ ...prev, search: term }))}
                onQuickFilterDueSoon={() => {
                  if (role === 'student') {
                    setSelectedStatusInView('pending');
                    setActiveTab('statuses');
                  } else {
                    setFilters((prev) => ({ ...prev, dateSort: 'due_soon', status: 'pending' }));
                  }
                }}
                onOpenCreateWorksheet={() => {
                  setEditingAssignment(null);
                  setCreateWorksheetDefaults(null);
                  setIsCreateWorksheetOpen(true);
                }}
              />
            )}

            {role === 'student' ? (
              <SubjectView
                assignments={visibleAssignments}
                submissions={visibleSubmissions}
                classrooms={visibleSubjectClassrooms}
                resources={visibleResources}
                students={studentsRoster.filter((s) =>
                  studentMatchesGradeTarget(currentStudentUser.gradeLevel, s.gradeLevel)
                )}
                role={role}
                currentStudentCode={currentStudentUser.code}
                studentGradeLevel={currentStudentUser.gradeLevel}
                selectedSubject={selectedSubjectInView}
                setSelectedSubject={setSelectedSubjectInView}
                onOpenSubmitModal={(a) => setActiveSubmitModalAsg(a)}
                onOpenGradingModal={(a, s) => setActiveGradingModalAsg({ assignment: a, submission: s })}
                onOpenHintModal={(a) => setActiveHintModalAsg({ assignment: a })}
                onOpenRosterModal={(a) => setActiveRosterModalAsg(a)}
                subjects={visibleSubjectsList}
                teachingSchedules={visibleTeachingSchedules}
                teachersRoster={teachersRoster}
                currentTeacherName={currentTeacherUser.name}
                onActiveClassroomChange={setIsStudentInsideClassroom}
                onRestoreWorksheets={handleRestoreAllWorksheets}
              />
            ) : (
              <>
                {/* Filter Bar (Teacher Only) */}
                <FilterBar
                  filters={filters}
                  setFilters={setFilters}
                  onResetFilters={() =>
                    setFilters({
                      search: '',
                      subject: 'ทั้งหมด',
                      gradeLevel: 'ทั้งหมด',
                      status: 'all',
                      category: 'ทั้งหมด',
                      dateSort: 'due_soon',
                    })
                  }
                  resultCount={filteredHomeAssignments.length}
                  gradeLevels={gradeLevelsList}
                  subjects={subjectsList}
                  role={role}
                  studentGradeLevel={currentStudentUser.gradeLevel}
                  onOpenManageCategories={() => handleOpenSettings('grades')}
                  onOpenSettings={handleOpenSettings}
                />

                {/* Security Warning Banner when using default fallback Admin credentials */}
                {showDefaultAdminWarning && (
                  <div className="mb-5 p-4 bg-amber-50/90 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                        <ShieldAlert className="w-5 h-5" />
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-amber-950 dark:text-amber-100">
                          คำแนะนำความปลอดภัย: คุณกำลังเข้าใช้งานด้วยบัญชีผู้ดูแลระบบเริ่มต้น
                        </p>
                        <p className="text-amber-800 dark:text-amber-300 mt-0.5">
                          แนะนำให้เพิ่มบัญชีครูรหัส <span className="font-mono font-bold">ADMIN</span> พร้อมตั้งรหัสผ่านใหม่ที่ปลอดภัยในเมนูตั้งค่า เพื่อปิดการใช้รหัสผ่านเริ่มต้น
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenSettings('teachers')}
                        className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-colors"
                      >
                        ตั้งค่ารหัส Admin ใหม่
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDefaultAdminWarning(false)}
                        className="px-3 py-2 text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        ปิดแจ้งเตือน
                      </button>
                    </div>
                  </div>
                )}

                {/* Actionable Prompt when ม.6 Worksheets need splitting by student room */}
                {m6MigrationPlan && m6MigrationPlan.items.length > 0 && (
                  <div className="mb-5 p-4 bg-emerald-50/85 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/70 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                        <FolderGit2 className="w-5 h-5" />
                      </div>
                      <div className="text-xs">
                        <p className="font-bold text-emerald-950 dark:text-emerald-100">
                          พบใบงานระดับชั้น ม.6 จำนวน {m6MigrationPlan.items.length} เรื่อง ที่ยังไม่ได้แยกตามห้องของนักเรียน
                        </p>
                        <p className="text-emerald-700 dark:text-emerald-300 mt-0.5">
                          สามารถโยกไปเก็บเป็นใบงานแยกตามห้อง ({m6MigrationPlan.availableTargetRooms.join(', ')}) พร้อมย้ายรายการส่งงานของนักเรียนให้ตรงห้องอัตโนมัติ
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSplitModalState({ isOpen: true, baseGrade: 'ม.6' })}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
                    >
                      โยกใบงาน ม.6 แยกตามห้อง
                    </button>
                  </div>
                )}

                {/* Assignments Grid */}
                <div className="mb-10">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold font-prompt text-slate-900 dark:text-white">
                      รายการใบงาน ({filteredHomeAssignments.length} รายการ)
                    </h2>
                  </div>

                  {filteredHomeAssignments.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-[var(--theme-surface-dark)] rounded-2xl border border-slate-200/80 dark:border-emerald-950/70 text-slate-400 text-sm space-y-2 theme-transition">
                      <p>ไม่พบใบงานที่ตรงกับเงื่อนไขการค้นหาของคุณ</p>
                      <button
                        onClick={() =>
                          setFilters({
                            search: '',
                            subject: 'ทั้งหมด',
                            gradeLevel: 'ทั้งหมด',
                            status: 'all',
                            category: 'ทั้งหมด',
                            dateSort: 'due_soon',
                          })
                        }
                        className="text-xs text-emerald-700 dark:text-emerald-400 underline font-semibold cursor-pointer"
                      >
                        ล้างคำค้นหาและตัวกรองทั้งหมด
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredHomeAssignments.map((asg) => {
                        const sub = submissions.find((s) => s.assignmentId === asg.id);
                        const subCount = submissions.filter((s) => s.assignmentId === asg.id).length;

                        return (
                          <AssignmentCard
                            key={asg.id}
                            assignment={asg}
                            submission={sub}
                            submissionCount={subCount}
                            role={role}
                            onOpenSubmitModal={(a) => setActiveSubmitModalAsg(a)}
                            onOpenGradingModal={(a, s) => setActiveGradingModalAsg({ assignment: a, submission: s })}
                            onOpenHintModal={(a) => setActiveHintModalAsg({ assignment: a })}
                            onOpenRosterModal={(a) => setActiveRosterModalAsg(a)}
                            onDeleteAssignment={handleDeleteAssignment}
                            onEditAssignment={(a) => {
                              setEditingAssignment(a);
                              setIsCreateWorksheetOpen(true);
                            }}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 2: Grade Levels View */}
        {activeTab === 'grades' && (
          <GradeLevelView
            assignments={visibleAssignments}
            submissions={visibleSubmissions}
            role={role}
            studentGradeLevel={currentStudentUser.gradeLevel}
            selectedGrade={selectedGradeInView}
            setSelectedGrade={setSelectedGradeInView}
            onOpenSubmitModal={(a) => setActiveSubmitModalAsg(a)}
            onOpenGradingModal={(a, s) => setActiveGradingModalAsg({ assignment: a, submission: s })}
            onOpenHintModal={(a) => setActiveHintModalAsg({ assignment: a })}
            onOpenRosterModal={(a) => setActiveRosterModalAsg(a)}
            onDeleteAssignment={handleDeleteAssignment}
            onEditAssignment={(a) => {
              setEditingAssignment(a);
              setIsCreateWorksheetOpen(true);
            }}
            gradeLevels={gradeLevelsList}
            onOpenSettings={handleOpenSettings}
            onOpenSplitWorksheetsModal={(base) =>
              setSplitModalState({
                isOpen: true,
                baseGrade: base ? extractBaseGrade(base) || 'ม.6' : 'ม.6',
              })
            }
            splitEligibleCount={m6MigrationPlan?.items.length || 0}
          />
        )}

        {/* Tab 3: Subjects View */}
        {activeTab === 'subjects' && (
          <SubjectView
            assignments={visibleAssignments}
            submissions={visibleSubmissions}
            classrooms={visibleSubjectClassrooms}
            resources={visibleResources}
            students={
              role === 'student'
                ? studentsRoster.filter((s) =>
                    studentMatchesGradeTarget(currentStudentUser.gradeLevel, s.gradeLevel)
                  )
                : studentsRoster
            }
            role={role}
            currentStudentCode={currentStudentUser.code}
            studentGradeLevel={currentStudentUser.gradeLevel}
            selectedSubject={selectedSubjectInView}
            setSelectedSubject={setSelectedSubjectInView}
            onOpenSubmitModal={(a) => setActiveSubmitModalAsg(a)}
            onOpenGradingModal={(a, s) => setActiveGradingModalAsg({ assignment: a, submission: s })}
            onOpenHintModal={(a) => setActiveHintModalAsg({ assignment: a })}
            onOpenRosterModal={(a) => setActiveRosterModalAsg(a)}
            onDeleteAssignment={handleDeleteAssignment}
            onEditAssignment={(a) => {
              setEditingAssignment(a);
              setIsCreateWorksheetOpen(true);
            }}
            subjects={visibleSubjectsList}
            teachingSchedules={visibleTeachingSchedules}
            teachersRoster={teachersRoster}
            currentTeacherName={currentTeacherUser.name}
            onOpenSettings={handleOpenSettings}
            onOpenCreateClassroom={() => {
              setEditingClassroom(null);
              setIsCreateClassroomOpen(true);
            }}
            onEditClassroom={(cls) => {
              setEditingClassroom(cls);
              setIsCreateClassroomOpen(true);
            }}
            onDeleteClassroom={handleDeleteSubjectClassroom}
            onSaveClassroom={handleSaveSubjectClassroom}
            onSaveBatchClassrooms={handleSaveBatchSubjectClassrooms}
            onOpenCreateWorksheet={
              role === 'teacher'
                ? (defaults) => {
                    setEditingAssignment(null);
                    setCreateWorksheetDefaults(defaults || null);
                    setIsCreateWorksheetOpen(true);
                  }
                : undefined
            }
          />
        )}

        {/* Tab 4: Submission Statuses View */}
        {activeTab === 'statuses' && (
          <StatusView
            assignments={visibleAssignments}
            submissions={visibleSubmissions}
            role={role}
            selectedStatus={selectedStatusInView}
            setSelectedStatus={setSelectedStatusInView}
            onOpenSubmitModal={(a) => setActiveSubmitModalAsg(a)}
            onOpenGradingModal={(a, s) => setActiveGradingModalAsg({ assignment: a, submission: s })}
            onOpenHintModal={(a) => setActiveHintModalAsg({ assignment: a })}
            onOpenRosterModal={(a) => setActiveRosterModalAsg(a)}
            onDeleteAssignment={handleDeleteAssignment}
            onEditAssignment={(a) => {
              setEditingAssignment(a);
              setIsCreateWorksheetOpen(true);
            }}
          />
        )}

        {/* Tab 5: Dedicated Learning Resources Hub */}
        {activeTab === 'resources' && (
          <ResourcesView
            resources={visibleResources}
            role={role}
            studentGradeLevel={currentStudentUser.gradeLevel}
            subjectsList={visibleSubjectsList}
            gradeLevelsList={gradeLevelsList}
            onOpenCreateResource={() => {
              setEditingResource(null);
              setIsCreateResourceOpen(true);
            }}
            onEditResource={(res) => {
              setEditingResource(res);
              setIsCreateResourceOpen(true);
            }}
            onDeleteResource={handleDeleteResource}
          />
        )}

        {/* Tab 6: Classroom Attendance & Teaching Schedule Hub */}
        {activeTab === 'attendance' && (
          <AttendanceView
            role={role}
            currentStudent={currentStudentUser}
            currentTeacher={currentTeacherUser}
            studentsRoster={studentsRoster}
            teachersRoster={teachersRoster}
            subjectsList={visibleSubjectsList}
            gradeLevelsList={gradeLevelsList}
            schedules={visibleTeachingSchedules}
            attendanceSessions={attendanceSessions}
            periodConfigs={periodConfigs}
            onSavePeriodConfigs={handleSavePeriodConfigs}
            onSaveSchedule={handleSaveSchedule}
            onDeleteSchedule={handleDeleteSchedule}
            onSaveAttendanceSession={handleSaveAttendanceSession}
            onDeleteAttendanceSession={handleDeleteAttendanceSession}
            onOpenSettings={role === 'teacher' ? handleOpenSettings : undefined}
          />
        )}

        {/* Tab 7: Per-Room Gradebook / Scorebook */}
        {activeTab === 'gradebook' && (
          isGradebookVisibleToCurrentUser ? (
            <GradebookView
              role={role}
              currentStudent={currentStudentUser}
              studentsRoster={studentsRoster}
              assignments={visibleAssignments}
              submissions={visibleSubmissions}
              gradeLevelsList={gradeLevelsList}
              subjectsList={visibleSubjectsList}
              studentGradebookEnabled={studentGradebookEnabled}
              gradebookDisabledRooms={gradebookDisabledRooms}
              onUpdateGradebookVisibility={handleSaveGradebookVisibility}
              onOpenGradingModal={(a, s) => setActiveGradingModalAsg({ assignment: a, submission: s })}
              onOpenSubmitModal={(a) => setActiveSubmitModalAsg(a)}
              onOpenRosterModal={(a) => setActiveRosterModalAsg(a)}
              onUpsertCellScore={handleUpsertGradebookScore}
              onOpenSettings={role === 'teacher' ? handleOpenSettings : undefined}
            />
          ) : (
            <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl p-10 text-center space-y-3 theme-transition">
              <p className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                สมุดเก็บคะแนนถูกปิดการเข้าชมชั่วคราว
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ครูผู้สอนได้ปิดการแสดงผลสมุดคะแนนสำหรับนักเรียนในขณะนี้
              </p>
            </div>
          )
        )}
      </main>

      {/* Modals & Drawers */}
      {/* Logout Confirmation Modal */}
      {isLogoutConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-rose-500/25 ring-4 ring-rose-50 dark:ring-rose-950/50">
              <LogoutIcon className="w-7 h-7" />
            </div>

            <div>
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                ยืนยันการออกจากระบบ?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                คุณกำลังจะออกจากบัญชี <strong>{role === 'student' ? currentStudentUser.name : currentTeacherUser.name}</strong> ต้องการดำเนินการต่อหรือไม่?
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsLogoutConfirmOpen(false)}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmLogOut}
                className="group flex-1 py-2.5 px-4 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white rounded-xl text-xs font-bold shadow-md shadow-rose-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              >
                <LogoutIcon className="w-4 h-4" />
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoginModalOpen && (
        <LoginModal
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setIsLoginModalOpen(false)}
          isDismissable={isLoggedIn}
          studentsList={studentsRoster}
          teachersList={teachersRoster}
          schoolCoverUrl={schoolCoverUrl}
          schoolName={schoolName}
          schoolSubtitle={schoolSubtitle}
        />
      )}

      {activeRosterModalAsg && (
        <SubmissionRosterModal
          assignment={activeRosterModalAsg}
          submissions={submissions}
          students={studentsRoster}
          onClose={() => setActiveRosterModalAsg(null)}
          onSelectStudentSubmission={(sub) => {
            const asg = assignments.find((a) => a.id === sub.assignmentId) || activeRosterModalAsg;
            setActiveGradingModalAsg({ assignment: asg, submission: sub });
          }}
          onBatchSaveGrades={handleBatchSaveGrades}
          onOpenSplitThisWorksheet={(asg) =>
            setSplitModalState({
              isOpen: true,
              baseGrade: extractBaseGrade(asg.gradeLevel) || 'ม.6',
              focusAssignmentId: asg.id,
            })
          }
        />
      )}

      {splitModalState.isOpen && (
        <SplitWorksheetsModal
          isOpen={splitModalState.isOpen}
          initialBaseGrade={splitModalState.baseGrade}
          focusAssignmentId={splitModalState.focusAssignmentId}
          assignments={assignments}
          submissions={submissions}
          studentsRoster={studentsRoster}
          gradeLevelsList={gradeLevelsList}
          onClose={() => setSplitModalState({ isOpen: false })}
          onExecuteMigration={handleExecuteSplitMigration}
        />
      )}

      {activeSubmitModalAsg && (
        <WorksheetSubmissionModal
          key={`${activeSubmitModalAsg.id}_${currentStudentUser.code}`}
          assignment={activeSubmitModalAsg}
          submission={pickBestSubmission(
            submissions.filter(
              (s) =>
                s.assignmentId === activeSubmitModalAsg.id &&
                matchesStudentSubmission(s, currentStudentUser)
            )
          )}
          onClose={() => setActiveSubmitModalAsg(null)}
          onSubmitWorksheet={handleSubmitWorksheet}
          onOpenHintModal={(a, qText) => {
            setActiveHintModalAsg({ assignment: a, questionText: qText });
          }}
        />
      )}

      {activeGradingModalAsg && (
        <TeacherGradingModal
          assignment={activeGradingModalAsg.assignment}
          submission={
            activeGradingModalAsg.submission ||
            submissions.find((s) => s.assignmentId === activeGradingModalAsg.assignment.id)
          }
          onClose={() => setActiveGradingModalAsg(null)}
          onSaveGrade={handleSaveGrade}
        />
      )}

      {activeHintModalAsg && (
        <AIHintModal
          assignment={activeHintModalAsg.assignment}
          initialQuestionText={activeHintModalAsg.questionText}
          onClose={() => setActiveHintModalAsg(null)}
        />
      )}

      {isCreateWorksheetOpen && (
        <CreateWorksheetModal
          key={
            editingAssignment?.id ||
            `new_${createWorksheetDefaults?.subject || ''}_${createWorksheetDefaults?.gradeLevel || ''}`
          }
          editingAssignment={editingAssignment}
          initialSubject={createWorksheetDefaults?.subject}
          initialGradeLevel={createWorksheetDefaults?.gradeLevel}
          onClose={() => {
            setIsCreateWorksheetOpen(false);
            setEditingAssignment(null);
            setCreateWorksheetDefaults(null);
          }}
          onCreateAssignment={handleCreateAssignment}
          onUpdateAssignment={handleUpdateAssignment}
          gradeLevelsList={gradeLevelsList}
          subjectsList={subjectsList}
          currentTeacherName={currentTeacherUser.name}
          studentsList={studentsRoster}
        />
      )}

      {isCreateResourceOpen && (
        <CreateResourceModal
          editingResource={editingResource}
          onClose={() => {
            setIsCreateResourceOpen(false);
            setEditingResource(null);
          }}
          onSaveResource={handleSaveResource}
          gradeLevelsList={gradeLevelsList}
          subjectsList={subjectsList}
          currentTeacherName={currentTeacherUser.name}
        />
      )}

      {isCreateClassroomOpen && (
        <CreateClassroomModal
          editingClassroom={editingClassroom}
          subjectsList={subjectsList}
          gradeLevelsList={gradeLevelsList}
          assignments={assignments}
          resources={resources}
          currentTeacherName={currentTeacherUser.name}
          onClose={() => {
            setIsCreateClassroomOpen(false);
            setEditingClassroom(null);
          }}
          onSaveClassroom={handleSaveSubjectClassroom}
        />
      )}

      {isSettingsModalOpen && (
        <SettingsModal
          initialTab={settingsInitialTab}
          gradeLevels={gradeLevelsList}
          subjects={subjectsList}
          students={studentsRoster}
          teachers={teachersRoster}
          assignments={assignments}
          schoolCoverUrl={schoolCoverUrl}
          schoolName={schoolName}
          schoolSubtitle={schoolSubtitle}
          onSaveSchoolBranding={handleSaveSchoolBranding}
          onClose={() => setIsSettingsModalOpen(false)}
          onAddGradeLevel={handleAddGradeLevel}
          onRemoveGradeLevel={handleRemoveGradeLevel}
          onAddSubject={handleAddSubject}
          onRemoveSubject={handleRemoveSubject}
          onAddStudent={handleAddStudent}
          onImportStudents={handleImportStudents}
          onUpdateStudent={handleUpdateStudent}
          onDeleteStudent={handleDeleteStudent}
          onAddTeacher={handleAddTeacher}
          onUpdateTeacher={handleUpdateTeacher}
          onDeleteTeacher={handleDeleteTeacher}
          onResetSystem={handleResetFactoryData}
          onResetKeepUsers={handleResetKeepUsers}
          activeTheme={activeTheme}
          onChangeTheme={handleChangeTheme}
          isAdmin={isAdminUser}
        />
      )}

      {isManageCategoriesOpen && (
        <ManageCategoriesModal
          gradeLevels={gradeLevelsList}
          subjects={subjectsList}
          onClose={() => setIsManageCategoriesOpen(false)}
          onAddGradeLevel={handleAddGradeLevel}
          onRemoveGradeLevel={handleRemoveGradeLevel}
          onAddSubject={handleAddSubject}
          onRemoveSubject={handleRemoveSubject}
        />
      )}

      {isManageStudentsOpen && (
        <ManageStudentsModal
          students={studentsRoster}
          gradeLevels={gradeLevelsList}
          onClose={() => setIsManageStudentsOpen(false)}
          onAddStudent={handleAddStudent}
          onImportStudents={handleImportStudents}
          onUpdateStudent={handleUpdateStudent}
          onDeleteStudent={handleDeleteStudent}
        />
      )}

      <NotificationDrawer
        notifications={visibleNotifications}
        assignments={visibleAssignments}
        isOpen={isNotifDrawerOpen}
        onClose={() => setIsNotifDrawerOpen(false)}
        onMarkAllRead={handleMarkAllNotifsRead}
        onSelectAssignment={(asgId) => {
          const matched = assignments.find((a) => a.id === asgId);
          if (matched) {
            if (role === 'student') {
              setActiveSubmitModalAsg(matched);
            } else {
              setActiveGradingModalAsg({ assignment: matched });
            }
          }
        }}
      />

      {isInfoModalOpen && (
        <InfoModal
          initialTab={infoModalTab}
          onClose={() => setIsInfoModalOpen(false)}
          onOpenSettings={role === 'teacher' ? () => handleOpenSettings('grades') : undefined}
        />
      )}

      {/* Global Save & Action Confirmation Toast Banner (Above all modals) */}
      {toastMessage && (
        <div className="fixed top-5 right-4 left-4 sm:left-auto sm:max-w-md z-[120] bg-slate-900/95 dark:bg-emerald-950/95 text-white px-4 py-3.5 rounded-2xl shadow-2xl flex items-center gap-3 border border-emerald-400/40 backdrop-blur-md animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
              ยืนยันการบันทึกสำเร็จ
            </p>
            <p className="text-xs font-semibold text-white break-words">{toastMessage}</p>
          </div>
        </div>
      )}

      {/* Clean Footer with fully functional interactive links */}
      <footer className="relative z-10 bg-white/90 dark:bg-[var(--theme-surface-dark-elevated)]/92 backdrop-blur-md border-t border-emerald-100/80 dark:border-emerald-950/70 py-6 text-xs text-slate-500 dark:text-slate-400 mt-auto pb-20 md:pb-6 theme-transition">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-center gap-1.5 sm:gap-2.5 text-center sm:text-left">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-200 font-prompt">EduSheet TH</span>
              <span aria-hidden="true">·</span>
              <span>ระบบเก็บใบงานและตรวจการบ้านออนไลน์</span>
            </div>
            <span className="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">|</span>
            <span className="text-[11px] text-slate-600 dark:text-slate-300">
              ผู้พัฒนาระบบ:{' '}
              <span className="font-semibold text-emerald-700 dark:text-emerald-400 font-prompt">
                นายปราชญ์ชยาวิช ศรีก่อเกื้อ
              </span>
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] flex-wrap justify-center">
            <button
              onClick={() => handleOpenInfoModal('guide')}
              className="hover:text-emerald-700 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer"
            >
              คู่มือการใช้งาน
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => handleOpenInfoModal('security')}
              className="hover:text-emerald-700 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer"
            >
              ความปลอดภัยข้อมูล
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => handleOpenInfoModal('support')}
              className="hover:text-emerald-700 dark:hover:text-emerald-400 font-medium transition-colors cursor-pointer"
            >
              ช่วยเหลือ & สนับสนุน
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
