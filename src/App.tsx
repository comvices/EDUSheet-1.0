import React, { useState } from 'react';
import {
  Assignment,
  Submission,
  NotificationItem,
  UserRole,
  FilterState,
  StudentProfile,
  TeacherProfile,
} from './types';
import {
  INITIAL_ASSIGNMENTS,
  INITIAL_SUBMISSIONS,
  INITIAL_NOTIFICATIONS,
  STUDENTS_ROSTER,
  TEACHERS_ROSTER,
  GRADE_LEVELS_LIST,
  SUBJECTS_LIST,
} from './data/mockData';
import {
  subscribeAssignments,
  subscribeSubmissions,
  subscribeStudents,
  subscribeTeachers,
  subscribeSettings,
  seedInitialDataIfEmpty,
  saveAssignmentToFirestore,
  deleteAssignmentFromFirestore,
  saveSubmissionToFirestore,
  saveStudentToFirestore,
  saveMultipleStudentsToFirestore,
  deleteStudentFromFirestore,
  saveTeacherToFirestore,
  deleteTeacherFromFirestore,
  saveSettingsToFirestore,
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
import { CheckCircle2, KeyRound } from 'lucide-react';

// Safe localStorage loader helper
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

export default function App() {
  // Roster & Dynamic Student User Management State (with LocalStorage persistence)
  const [studentsRoster, setStudentsRoster] = useState<StudentProfile[]>(() =>
    getInitialStorage('edusheet_students', STUDENTS_ROSTER)
  );

  // Dynamic Teacher Management State
  const [teachersRoster, setTeachersRoster] = useState<TeacherProfile[]>(() =>
    getInitialStorage('edusheet_teachers', TEACHERS_ROSTER)
  );

  // Authentication & Logged In User State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);
  const [currentStudentUser, setCurrentStudentUser] = useState<StudentProfile>(() =>
    getInitialStorage('edusheet_students', STUDENTS_ROSTER)[0] || STUDENTS_ROSTER[0]
  );
  const [currentTeacherUser, setCurrentTeacherUser] = useState<TeacherProfile>(() =>
    getInitialStorage('edusheet_teachers', TEACHERS_ROSTER)[0] || TEACHERS_ROSTER[0]
  );
  const [role, setRole] = useState<UserRole>('student');

  // Tab State
  const [activeTab, setActiveTab] = useState<string>('home');

  // Core Data State (with LocalStorage persistence)
  const [assignments, setAssignments] = useState<Assignment[]>(() =>
    getInitialStorage('edusheet_assignments', INITIAL_ASSIGNMENTS)
  );
  const [submissions, setSubmissions] = useState<Submission[]>(() =>
    getInitialStorage('edusheet_submissions', INITIAL_SUBMISSIONS)
  );
  const [notifications, setNotifications] = useState<NotificationItem[]>(() =>
    getInitialStorage('edusheet_notifs', INITIAL_NOTIFICATIONS)
  );

  // Dynamic Grade Levels & Subjects Management State
  const [gradeLevelsList, setGradeLevelsList] = useState<string[]>(() =>
    getInitialStorage('edusheet_grade_levels', GRADE_LEVELS_LIST)
  );
  const [subjectsList, setSubjectsList] = useState<string[]>(() =>
    getInitialStorage('edusheet_subjects', SUBJECTS_LIST)
  );

  // Auto-Save to LocalStorage on state change
  React.useEffect(() => {
    try {
      localStorage.setItem('edusheet_assignments', JSON.stringify(assignments));
    } catch (e) {}
  }, [assignments]);

  React.useEffect(() => {
    try {
      localStorage.setItem('edusheet_submissions', JSON.stringify(submissions));
    } catch (e) {}
  }, [submissions]);

  React.useEffect(() => {
    try {
      localStorage.setItem('edusheet_students', JSON.stringify(studentsRoster));
    } catch (e) {}
  }, [studentsRoster]);

  React.useEffect(() => {
    try {
      localStorage.setItem('edusheet_teachers', JSON.stringify(teachersRoster));
    } catch (e) {}
  }, [teachersRoster]);

  React.useEffect(() => {
    try {
      localStorage.setItem('edusheet_grade_levels', JSON.stringify(gradeLevelsList));
    } catch (e) {}
  }, [gradeLevelsList]);

  React.useEffect(() => {
    try {
      localStorage.setItem('edusheet_subjects', JSON.stringify(subjectsList));
    } catch (e) {}
  }, [subjectsList]);

  React.useEffect(() => {
    try {
      localStorage.setItem('edusheet_notifs', JSON.stringify(notifications));
    } catch (e) {}
  }, [notifications]);

  // Google Firebase Firestore Real-Time Sync & Auto-Seed
  React.useEffect(() => {
    // 1. Seed initial assignments, submissions, students, and teachers if Firestore collection is empty
    seedInitialDataIfEmpty(
      INITIAL_ASSIGNMENTS,
      INITIAL_SUBMISSIONS,
      STUDENTS_ROSTER,
      TEACHERS_ROSTER,
      GRADE_LEVELS_LIST,
      SUBJECTS_LIST
    );

    // 2. Attach real-time cloud snapshot listeners
    const unsubAssignments = subscribeAssignments((remoteAssignments) => {
      setAssignments(remoteAssignments || []);
    });

    const unsubSubmissions = subscribeSubmissions((remoteSubmissions) => {
      setSubmissions(remoteSubmissions || []);
    });

    const unsubStudents = subscribeStudents((remoteStudents) => {
      if (remoteStudents && remoteStudents.length > 0) {
        setStudentsRoster(remoteStudents);
      }
    });

    const unsubTeachers = subscribeTeachers((remoteTeachers) => {
      if (remoteTeachers && remoteTeachers.length > 0) {
        setTeachersRoster(remoteTeachers);
      }
    });

    const unsubSettings = subscribeSettings((remoteSettings) => {
      if (remoteSettings.gradeLevels && remoteSettings.gradeLevels.length > 0) {
        setGradeLevelsList(remoteSettings.gradeLevels);
      }
      if (remoteSettings.subjects && remoteSettings.subjects.length > 0) {
        setSubjectsList(remoteSettings.subjects);
      }
    });

    return () => {
      unsubAssignments();
      unsubSubmissions();
      unsubStudents();
      unsubSettings();
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
  const [selectedGradeInView, setSelectedGradeInView] = useState('ม.3');
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
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('grades');
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [isManageStudentsOpen, setIsManageStudentsOpen] = useState(false);
  const [isNotifDrawerOpen, setIsNotifDrawerOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(true);
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);
  const [infoModalTab, setInfoModalTab] = useState<InfoModalTab>('guide');

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

  // Login Success Handler
  const handleLoginSuccess = (user: StudentProfile | TeacherProfile, loginRole: UserRole) => {
    if (loginRole === 'student') {
      const student = user as StudentProfile;
      setCurrentStudentUser(student);
      setRole('student');
      setSelectedGradeInView(student.gradeLevel);
      showToast(`ยินดีต้อนรับ ด.ญ./ด.ช. ${student.name} (รหัส ${student.code}) เข้าสู่ระบบ 👋`);
    } else {
      const teacher = user as TeacherProfile;
      setCurrentTeacherUser(teacher);
      setRole('teacher');
      showToast(`ยินดีต้อนรับ ${teacher.name} เข้าสู่ระบบครูผู้สอน 📚`);
    }

    setIsLoggedIn(true);
    setIsLoginModalOpen(false);
  };

  // Logout Handler
  const handleLogOut = () => {
    setIsLoggedIn(false);
    setIsLoginModalOpen(true);
    showToast('ออกจากระบบเรียบร้อยแล้ว');
  };

  // Submission Handler from Student
  const handleSubmitWorksheet = (
    assignmentId: string,
    answers: Record<string, string>,
    files?: any[]
  ) => {
    const matchedAsg = assignments.find((a) => a.id === assignmentId);
    if (!matchedAsg) return;

    const existingSubIdx = submissions.findIndex(
      (s) => s.assignmentId === assignmentId && (s.studentId === currentStudentUser.id || s.studentCode === currentStudentUser.code)
    );

    const newSub: Submission = {
      id: existingSubIdx >= 0 ? submissions[existingSubIdx].id : `sub_${Date.now()}`,
      assignmentId,
      studentId: currentStudentUser.id,
      studentName: currentStudentUser.name,
      studentCode: currentStudentUser.code,
      gradeLevel: currentStudentUser.gradeLevel,
      submissionDate: new Date().toISOString(),
      answers,
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
    status: 'graded' | 'needs_revision'
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
    setAssignments(INITIAL_ASSIGNMENTS);
    setSubmissions(INITIAL_SUBMISSIONS);
    setStudentsRoster(STUDENTS_ROSTER);
    setGradeLevelsList(GRADE_LEVELS_LIST);
    setSubjectsList(SUBJECTS_LIST);
    setNotifications(INITIAL_NOTIFICATIONS);
    try {
      localStorage.removeItem('edusheet_assignments');
      localStorage.removeItem('edusheet_submissions');
      localStorage.removeItem('edusheet_students');
      localStorage.removeItem('edusheet_grade_levels');
      localStorage.removeItem('edusheet_subjects');
      localStorage.removeItem('edusheet_notifs');
    } catch (e) {}
    showToast('ล้างข้อมูลในฐานข้อมูลและรีเซ็ตข้อมูลเริ่มต้น (Factory Reset) เรียบร้อยแล้ว 🔄');
  };

  const handleResetKeepUsers = async () => {
    await resetDataKeepUsers();
    setAssignments([]);
    setSubmissions([]);
    setNotifications([]);
    setGradeLevelsList([]);
    setSubjectsList([]);
    
    // Refresh student/teacher lists (they've been updated in Firestore)
    // Note: The snapshots should trigger these automatically, but we can clear local storage
    localStorage.removeItem('edusheet_assignments');
    localStorage.removeItem('edusheet_submissions');
    localStorage.removeItem('edusheet_notifs');
    localStorage.removeItem('edusheet_grade_levels');
    localStorage.removeItem('edusheet_subjects');
    
    showToast('ล้างข้อมูลใบงานและตั้งค่าระบบเรียบร้อยแล้ว (เก็บข้อมูลผู้ใช้งานไว้) 🧹');
  };

  // Notifications read handler
  const handleMarkAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  // Grade-Level Isolation:
  // - Teachers see ALL assignments across all grade levels.
  // - Students ONLY see assignments created for their own grade level (currentStudentUser.gradeLevel) or 'ทั้งหมด'.
  const visibleAssignments = React.useMemo(() => {
    if (role === 'teacher') return assignments;
    const stdGrade = currentStudentUser?.gradeLevel;
    if (!stdGrade) return assignments;
    return assignments.filter(
      (asg) => asg.gradeLevel === stdGrade || asg.gradeLevel === 'ทั้งหมด'
    );
  }, [assignments, role, currentStudentUser?.gradeLevel]);

  // Filtered assignments logic for Home View
  const filteredHomeAssignments = visibleAssignments
    .filter((asg) => {
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
      const sub = submissions.find(
        (s) => s.assignmentId === asg.id && (role === 'teacher' || s.studentCode === currentStudentUser.code || s.studentId === currentStudentUser.id)
      );
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
      if (filters.dateSort === 'due_soon') {
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
        const s = submissions.find((sub) => sub.assignmentId === a.id && sub.studentCode === currentStudentUser.code);
        return !s || s.status === 'pending';
      }).length;

  const submittedCount = role === 'teacher'
    ? submissions.filter((s) => s.status === 'graded').length // Submissions already graded
    : submissions.filter((s) => s.studentCode === currentStudentUser.code && (s.status === 'submitted' || s.status === 'graded')).length;

  const dueSoonCount = visibleAssignments.filter((a) => {
    const s = submissions.find(
      (sub) => sub.assignmentId === a.id && (role === 'teacher' || sub.studentCode === currentStudentUser.code)
    );
    const diffHours = (new Date(a.dueDate).getTime() - Date.now()) / (1000 * 60 * 60);
    return diffHours > 0 && diffHours <= 24 && (!s || s.status === 'pending');
  }).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sarabun">
      {/* 3-Zone Header Contract */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        role={role}
        setRole={setRole}
        unreadNotifCount={notifications.filter((n) => !n.isRead).length}
        onOpenNotifs={() => setIsNotifDrawerOpen(true)}
        onOpenCreateWorksheet={() => {
          setEditingAssignment(null);
          setIsCreateWorksheetOpen(true);
        }}
        onOpenManageCategories={() => handleOpenSettings('grades')}
        onOpenManageStudents={() => handleOpenSettings('students')}
        onOpenSettings={handleOpenSettings}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onLogOut={handleLogOut}
        student={currentStudentUser}
        teacher={currentTeacherUser}
        isLoggedIn={isLoggedIn}
      />

      {/* Main Container (Responsive padding with mobile bottom nav safe-area) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 md:pb-10">
        {/* Toast Alert Banner */}
        {toastMessage && (
          <div className="fixed top-20 right-4 z-50 bg-slate-900 text-white dark:bg-indigo-600 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-indigo-400/30 animate-in fade-in slide-in-from-top-4 duration-300">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span className="text-xs font-semibold">{toastMessage}</span>
          </div>
        )}



        {/* Tab 1: Home Dashboard */}
        {activeTab === 'home' && (
          <div>
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
                setFilters((prev) => ({ ...prev, dateSort: 'due_soon', status: 'pending' }));
              }}
              onOpenCreateWorksheet={() => {
                setEditingAssignment(null);
                setIsCreateWorksheetOpen(true);
              }}
            />

            {/* Filter Bar */}
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

            {/* Assignments Grid */}
            <div className="mb-10">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold font-prompt text-slate-900 dark:text-white">
                  รายการใบงาน ({filteredHomeAssignments.length} รายการ)
                </h2>
              </div>

              {filteredHomeAssignments.length === 0 ? (
                <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-sm space-y-2">
                  <p>ไม่พบใบงานที่ตรงกับเงื่อนไขการค้นหาของคุณ</p>
                  {role === 'student' && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                      🔒 (แสดงเฉพาะใบงานสำหรับนักเรียนระดับชั้น {currentStudentUser.gradeLevel})
                    </p>
                  )}
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
                    className="text-xs text-indigo-600 dark:text-indigo-400 underline font-semibold"
                  >
                    ล้างคำค้นหาและตัวกรองทั้งหมด
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredHomeAssignments.map((asg) => {
                    const sub = submissions.find(
                      (s) =>
                        s.assignmentId === asg.id &&
                        (role === 'teacher' || s.studentCode === currentStudentUser.code || s.studentId === currentStudentUser.id)
                    );
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
          </div>
        )}

        {/* Tab 2: Grade Levels View */}
        {activeTab === 'grades' && (
          <GradeLevelView
            assignments={visibleAssignments}
            submissions={submissions}
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
          />
        )}

        {/* Tab 3: Subjects View */}
        {activeTab === 'subjects' && (
          <SubjectView
            assignments={visibleAssignments}
            submissions={submissions}
            role={role}
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
            subjects={subjectsList}
            onOpenSettings={handleOpenSettings}
          />
        )}

        {/* Tab 4: Submission Statuses View */}
        {activeTab === 'statuses' && (
          <StatusView
            assignments={visibleAssignments}
            submissions={submissions}
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
      </main>

      {/* Modals & Drawers */}
      {isLoginModalOpen && (
        <LoginModal
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setIsLoginModalOpen(false)}
          isDismissable={isLoggedIn}
          studentsList={studentsRoster}
          teachersList={teachersRoster}
        />
      )}

      {activeRosterModalAsg && (
        <SubmissionRosterModal
          assignment={activeRosterModalAsg}
          submissions={submissions}
          onClose={() => setActiveRosterModalAsg(null)}
          onSelectStudentSubmission={(sub) => {
            const asg = assignments.find((a) => a.id === sub.assignmentId) || activeRosterModalAsg;
            setActiveGradingModalAsg({ assignment: asg, submission: sub });
          }}
        />
      )}

      {activeSubmitModalAsg && (
        <WorksheetSubmissionModal
          assignment={activeSubmitModalAsg}
          submission={submissions.find(
            (s) => s.assignmentId === activeSubmitModalAsg.id && s.studentCode === currentStudentUser.code
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
          editingAssignment={editingAssignment}
          onClose={() => {
            setIsCreateWorksheetOpen(false);
            setEditingAssignment(null);
          }}
          onCreateAssignment={handleCreateAssignment}
          onUpdateAssignment={handleUpdateAssignment}
          gradeLevelsList={gradeLevelsList}
          subjectsList={subjectsList}
          currentTeacherName={currentTeacherUser.name}
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
        notifications={notifications}
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

      {/* Clean Footer with fully functional interactive links */}
      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 text-xs text-slate-500 dark:text-slate-400 mt-auto pb-20 md:pb-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-800 dark:text-slate-200 font-prompt">EduSheet TH</span>
            <span aria-hidden="true">·</span>
            <span>ระบบเก็บใบงานและตรวจการบ้านออนไลน์</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] flex-wrap justify-center">
            <button
              onClick={() => handleOpenInfoModal('guide')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors cursor-pointer"
            >
              คู่มือการใช้งาน
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => handleOpenInfoModal('security')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors cursor-pointer"
            >
              ความปลอดภัยข้อมูล
            </button>
            <span aria-hidden="true">·</span>
            <button
              onClick={() => handleOpenInfoModal('support')}
              className="hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors cursor-pointer"
            >
              ช่วยเหลือ & สนับสนุน
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
