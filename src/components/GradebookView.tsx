import React, { useMemo, useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  FileSpreadsheet,
  Search,
  Download,
  Printer,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  Clock,
  AlertCircle,
  Edit3,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  X,
  Check,
  Users,
  Award,
  ListOrdered,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Assignment, StudentProfile, Submission, UserRole } from '../types';
import { SaveConfirmModal, SaveConfirmDetail } from './SaveConfirmModal';
import { CardCornerOrnament } from './ThemeGraphics';

interface GradebookViewProps {
  role: UserRole;
  currentStudent: StudentProfile;
  studentsRoster: StudentProfile[];
  assignments: Assignment[];
  submissions: Submission[];
  gradeLevelsList: string[];
  subjectsList: string[];
  studentGradebookEnabled?: boolean;
  gradebookDisabledRooms?: string[];
  onUpdateGradebookVisibility?: (enabled: boolean, disabledRooms: string[]) => void;
  onOpenGradingModal: (assignment: Assignment, submission?: Submission) => void;
  onOpenSubmitModal: (assignment: Assignment) => void;
  onOpenRosterModal: (assignment: Assignment) => void;
  onUpsertCellScore: (
    assignment: Assignment,
    student: StudentProfile,
    existingSubmission: Submission | undefined,
    score: number,
    comment: string,
    status: 'graded' | 'needs_revision'
  ) => void;
  onOpenSettings?: (tab?: 'grades' | 'subjects' | 'students' | 'teachers') => void;
}

interface EditingCellState {
  assignment: Assignment;
  student: StudentProfile;
  submission?: Submission;
  scoreInput: string;
  commentInput: string;
  status: 'graded' | 'needs_revision';
}

const calculateThaiGrade = (percent: number): string => {
  if (percent >= 80) return '4';
  if (percent >= 75) return '3.5';
  if (percent >= 70) return '3';
  if (percent >= 65) return '2.5';
  if (percent >= 60) return '2';
  if (percent >= 55) return '1.5';
  if (percent >= 50) return '1';
  return '0';
};

const normalizeCode = (code?: string): string => (code || '').trim().toUpperCase();

const normalizeRoom = (room?: string): string => (room || '').trim();

const extractBaseRoom = (room: string): string =>
  normalizeRoom(room)
    .replace(/\s*\(ทุกห้อง\)$/, '')
    .trim()
    .split('/')[0]
    .trim();

const isWholeGradeRoom = (room: string): boolean => {
  const norm = normalizeRoom(room);
  return Boolean(norm) && (norm.endsWith('(ทุกห้อง)') || !norm.includes('/'));
};

const matchesSelectedRoom = (studentGrade: string | undefined, selectedRoom: string): boolean => {
  const g = normalizeRoom(studentGrade);
  const r = normalizeRoom(selectedRoom);
  if (!g || !r) return false;
  if (g === r) return true;
  if (isWholeGradeRoom(r)) {
    const baseR = extractBaseRoom(r);
    return g === baseR || g.startsWith(`${baseR}/`) || g === `${baseR} (ทุกห้อง)`;
  }
  return false;
};

const matchesRoomAssignment = (asgGrade: string | undefined, room: string): boolean => {
  const a = normalizeRoom(asgGrade);
  const r = normalizeRoom(room);
  if (!a || !r) return false;
  if (a === r || a === 'ทั้งหมด') return true;
  const baseA = extractBaseRoom(a);
  const baseR = extractBaseRoom(r);
  if (isWholeGradeRoom(a) && baseA === baseR) return true;
  if (isWholeGradeRoom(r) && baseR === baseA) return true;
  return false;
};

const SUBMISSION_STATUS_RANK: Record<Submission['status'], number> = {
  graded: 4,
  needs_revision: 3,
  submitted: 2,
  pending: 1,
  overdue: 0,
};

const getSubmissionTimestamp = (sub: Submission): number => {
  const raw = sub.gradedAt || sub.submissionDate;
  const ts = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(ts) ? 0 : ts;
};

const shouldPreferSubmission = (candidate: Submission, existing?: Submission): boolean => {
  if (!existing) return true;
  const candRank = SUBMISSION_STATUS_RANK[candidate.status] ?? 0;
  const existRank = SUBMISSION_STATUS_RANK[existing.status] ?? 0;
  if (candRank !== existRank) return candRank > existRank;

  const candHasScore = typeof candidate.score === 'number' ? 1 : 0;
  const existHasScore = typeof existing.score === 'number' ? 1 : 0;
  if (candHasScore !== existHasScore) return candHasScore > existHasScore;

  return getSubmissionTimestamp(candidate) >= getSubmissionTimestamp(existing);
};

export const GradebookView: React.FC<GradebookViewProps> = ({
  role,
  currentStudent,
  studentsRoster,
  assignments,
  submissions,
  gradeLevelsList,
  subjectsList,
  studentGradebookEnabled = true,
  gradebookDisabledRooms = [],
  onUpdateGradebookVisibility,
  onOpenGradingModal,
  onOpenSubmitModal,
  onOpenRosterModal,
  onUpsertCellScore,
  onOpenSettings,
}) => {
  // Strictly build room list ONLY from user-created gradeLevelsList (or student's own room)
  const availableRooms = useMemo(() => {
    if (role === 'student') {
      const ownRoom = normalizeRoom(currentStudent.gradeLevel);
      return ownRoom ? [ownRoom] : [];
    }
    const roomSet = new Set<string>();
    gradeLevelsList.forEach((g) => {
      const norm = normalizeRoom(g);
      if (norm && norm !== 'ทั้งหมด') {
        roomSet.add(norm);
      }
    });
    return Array.from(roomSet).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
  }, [gradeLevelsList, role, currentStudent.gradeLevel]);

  const [selectedRoom, setSelectedRoom] = useState<string>(() => {
    const ownRoom = normalizeRoom(currentStudent.gradeLevel);
    if (role === 'student' && ownRoom) {
      return ownRoom;
    }
    return availableRooms[0] || '';
  });

  useEffect(() => {
    const ownRoom = normalizeRoom(currentStudent.gradeLevel);
    if (role === 'student') {
      setSelectedRoom(ownRoom);
    } else if (!selectedRoom && availableRooms.length > 0) {
      setSelectedRoom(availableRooms[0]);
    } else if (selectedRoom && availableRooms.length > 0 && !availableRooms.includes(selectedRoom)) {
      setSelectedRoom(availableRooms[0]);
    }
  }, [role, currentStudent.gradeLevel, availableRooms, selectedRoom]);

  const [selectedSubject, setSelectedSubject] = useState<string>('ทั้งหมด');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showTopicIndex, setShowTopicIndex] = useState<boolean>(true);
  const [editingCell, setEditingCell] = useState<EditingCellState | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<{
    cell: EditingCellState;
    numericScore: number;
    details: SaveConfirmDetail[];
  } | null>(null);
  const [pendingVisibilityChange, setPendingVisibilityChange] = useState<{
    title: string;
    description: string;
    details: SaveConfirmDetail[];
    confirmLabel: string;
    variant: 'emerald' | 'amber';
    nextEnabled: boolean;
    nextDisabledRooms: string[];
  } | null>(null);

  const isRoomInDisabledList = (room: string): boolean => {
    const normRoom = normalizeRoom(room);
    if (!normRoom) return false;
    return gradebookDisabledRooms.some(
      (disabled) => normalizeRoom(disabled) === normRoom || matchesSelectedRoom(normRoom, disabled)
    );
  };

  const isSelectedRoomDisabledForStudents =
    !studentGradebookEnabled || (selectedRoom ? isRoomInDisabledList(selectedRoom) : false);

  // Available subjects present in settings or assignments for this room
  const subjectOptions = useMemo(() => {
    const set = new Set<string>(['ทั้งหมด']);
    subjectsList.forEach((s) => {
      const trimmed = (s || '').trim();
      if (trimmed) set.add(trimmed);
    });
    assignments.forEach((a) => {
      const trimmed = (a.subject || '').trim();
      if (trimmed) set.add(trimmed);
    });
    return Array.from(set);
  }, [subjectsList, assignments]);

  // Reset selectedSubject when switching students/roles if previous subject is no longer available
  useEffect(() => {
    if (selectedSubject !== 'ทั้งหมด' && !subjectOptions.includes(selectedSubject)) {
      setSelectedSubject('ทั้งหมด');
    }
  }, [selectedSubject, subjectOptions]);

  // Students belonging to selectedRoom (strictly isolated if student role)
  const roomStudents = useMemo(() => {
    if (role === 'student') {
      return currentStudent.code?.trim() || currentStudent.id ? [currentStudent] : [];
    }
    if (!selectedRoom) return [];

    // Track all roster students globally so transferred students never appear as ghost rows in old rooms
    const globalRosterCodes = new Set<string>();
    const globalRosterIds = new Set<string>();
    studentsRoster.forEach((s) => {
      const normCode = normalizeCode(s.code);
      if (normCode) globalRosterCodes.add(normCode);
      if (s.id?.trim()) globalRosterIds.add(s.id.trim());
    });

    const baseStudents = studentsRoster.filter((s) => matchesSelectedRoom(s.gradeLevel, selectedRoom));

    // Also include ad-hoc students who have submissions in this room AND are not already in roster
    const seenCodes = new Set(baseStudents.map((s) => normalizeCode(s.code)).filter(Boolean));
    const seenIds = new Set(baseStudents.map((s) => s.id?.trim()).filter(Boolean));
    const extraFromSubs: StudentProfile[] = [];
    submissions.forEach((sub) => {
      if (!matchesSelectedRoom(sub.gradeLevel, selectedRoom)) return;
      const normSubCode = normalizeCode(sub.studentCode);
      const subId = (sub.studentId || '').trim();
      if (!normSubCode && !subId) return;

      // Skip if this student exists in global roster (belongs to their current roster room)
      if ((normSubCode && globalRosterCodes.has(normSubCode)) || (subId && globalRosterIds.has(subId))) {
        return;
      }
      if ((normSubCode && seenCodes.has(normSubCode)) || (subId && seenIds.has(subId))) {
        return;
      }

      if (normSubCode) seenCodes.add(normSubCode);
      if (subId) seenIds.add(subId);
      extraFromSubs.push({
        id: subId || `std_${normSubCode}`,
        code: (sub.studentCode || '').trim(),
        name: (sub.studentName || sub.studentCode || 'นักเรียน').trim(),
        password: '',
        gradeLevel: normalizeRoom(sub.gradeLevel),
        avatar: '',
      });
    });

    const combined = [...baseStudents, ...extraFromSubs].sort((a, b) =>
      (a.code || a.name).localeCompare(b.code || b.name, 'th', { numeric: true })
    );

    if (!searchTerm.trim()) return combined;
    const q = searchTerm.trim().toLowerCase();
    return combined.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q)
    );
  }, [role, currentStudent, studentsRoster, selectedRoom, submissions, searchTerm]);

  // Check if worksheet applies to specific student (for individual targeted assignments)
  const isWorksheetTargetedToStudent = (asg: Assignment, studentCode: string): boolean => {
    if (!asg.assignedStudentCodes || asg.assignedStudentCodes.length === 0) return true;
    const normStudent = normalizeCode(studentCode);
    if (!normStudent) return false;
    return asg.assignedStudentCodes.some((c) => normalizeCode(c) === normStudent);
  };

  // Worksheets assigned to the selected room (and optional subject), numbered 1..N chronologically
  const roomWorksheets = useMemo(() => {
    const roomCodes = new Set(roomStudents.map((s) => normalizeCode(s.code)).filter(Boolean));
    const normSubject = selectedSubject.trim();
    return assignments
      .filter((asg) => {
        if (normSubject !== 'ทั้งหมด' && (asg.subject || '').trim() !== normSubject) {
          return false;
        }
        if (role === 'student' && !isWorksheetTargetedToStudent(asg, currentStudent.code)) {
          return false;
        }
        if (matchesRoomAssignment(asg.gradeLevel, selectedRoom)) {
          return true;
        }
        // Or individually assigned to at least one student in this room
        if (asg.assignedStudentCodes && asg.assignedStudentCodes.length > 0) {
          return asg.assignedStudentCodes.some((c) => roomCodes.has(normalizeCode(c)));
        }
        return false;
      })
      .sort((a, b) => {
        const createdDiff = new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
        if (!Number.isNaN(createdDiff) && createdDiff !== 0) return createdDiff;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [assignments, selectedRoom, selectedSubject, roomStudents, role, currentStudent.code]);

  // Quick lookup: `${assignmentId}__${normalizedCode}` and `${assignmentId}__ID_${studentId}` -> Submission
  const submissionLookup = useMemo(() => {
    const map = new Map<string, Submission>();
    submissions.forEach((sub) => {
      const normCode = normalizeCode(sub.studentCode);
      if (normCode) {
        const codeKey = `${sub.assignmentId}__${normCode}`;
        if (shouldPreferSubmission(sub, map.get(codeKey))) {
          map.set(codeKey, sub);
        }
      }
      const normId = (sub.studentId || '').trim();
      if (normId) {
        const idKey = `${sub.assignmentId}__ID_${normId}`;
        if (shouldPreferSubmission(sub, map.get(idKey))) {
          map.set(idKey, sub);
        }
      }
    });
    return map;
  }, [submissions]);

  const getCellSubmission = (assignmentId: string, student: StudentProfile): Submission | undefined => {
    const normCode = normalizeCode(student.code);
    const normId = (student.id || '').trim();
    const codeSub = normCode ? submissionLookup.get(`${assignmentId}__${normCode}`) : undefined;
    const idSub = normId ? submissionLookup.get(`${assignmentId}__ID_${normId}`) : undefined;
    if (codeSub && idSub) {
      return shouldPreferSubmission(codeSub, idSub) ? codeSub : idSub;
    }
    return codeSub || idSub;
  };

  // Compute row-level totals & room-level KPI metrics
  const computedRows = useMemo(() => {
    return roomStudents.map((student) => {
      let earnedSum = 0;
      let maxSum = 0;
      let submittedOrGradedCount = 0;
      let applicableCount = 0;
      let gradedCount = 0;

      const cells = roomWorksheets.map((asg) => {
        const isApplicable = isWorksheetTargetedToStudent(asg, student.code);
        const sub = getCellSubmission(asg.id, student);
        if (isApplicable) {
          applicableCount += 1;
          maxSum += asg.totalPoints || 0;
          if (sub && (sub.status === 'submitted' || sub.status === 'graded' || sub.status === 'needs_revision')) {
            submittedOrGradedCount += 1;
          }
          if (sub && typeof sub.score === 'number' && (sub.status === 'graded' || sub.status === 'needs_revision')) {
            earnedSum += sub.score;
          }
          if (sub && sub.status === 'graded') {
            gradedCount += 1;
          }
        }
        return {
          assignment: asg,
          submission: sub,
          isApplicable,
        };
      });

      const percent = maxSum > 0 ? (earnedSum / maxSum) * 100 : 0;
      const grade = maxSum > 0 ? calculateThaiGrade(percent) : '-';

      return {
        student,
        cells,
        earnedSum,
        maxSum,
        submittedOrGradedCount,
        applicableCount,
        gradedCount,
        percent,
        grade,
      };
    });
  }, [roomStudents, roomWorksheets, submissionLookup]);

  // Column stats (average score & completion per worksheet)
  const columnStats = useMemo(() => {
    return roomWorksheets.map((asg, index) => {
      let totalScore = 0;
      let gradedItems = 0;
      let submittedItems = 0;
      let targetStudents = 0;

      roomStudents.forEach((student) => {
        if (!isWorksheetTargetedToStudent(asg, student.code)) return;
        targetStudents += 1;
        const sub = getCellSubmission(asg.id, student);
        if (sub && (sub.status === 'submitted' || sub.status === 'graded' || sub.status === 'needs_revision')) {
          submittedItems += 1;
        }
        if (sub && sub.status === 'graded' && typeof sub.score === 'number') {
          totalScore += sub.score;
          gradedItems += 1;
        }
      });

      return {
        worksheetNumber: index + 1,
        assignment: asg,
        targetStudents,
        submittedItems,
        gradedItems,
        avgScore: gradedItems > 0 ? totalScore / gradedItems : null,
      };
    });
  }, [roomWorksheets, roomStudents, submissionLookup]);

  // Room KPI summary
  const roomKpis = useMemo(() => {
    const totalStudents = computedRows.length;
    const studentRow = role === 'student' ? computedRows[0] : undefined;

    const totalWorksheets =
      role === 'student' && studentRow ? studentRow.applicableCount : roomWorksheets.length;

    const rowsWithMax = computedRows.filter((r) => r.maxSum > 0);
    const rawTotalPossible =
      role === 'student' && studentRow
        ? studentRow.maxSum
        : rowsWithMax.length > 0
        ? rowsWithMax.reduce((acc, r) => acc + r.maxSum, 0) / rowsWithMax.length
        : roomWorksheets.reduce((acc, a) => acc + (a.totalPoints || 0), 0);
    const totalPossiblePerStudent = Number.isInteger(rawTotalPossible)
      ? rawTotalPossible
      : Number(rawTotalPossible.toFixed(1));

    const avgPercent =
      role === 'student' && studentRow
        ? studentRow.percent
        : rowsWithMax.length > 0
        ? rowsWithMax.reduce((acc, r) => acc + r.percent, 0) / rowsWithMax.length
        : 0;
    const avgPoints =
      role === 'student' && studentRow
        ? studentRow.earnedSum
        : totalStudents > 0
        ? computedRows.reduce((acc, r) => acc + r.earnedSum, 0) / totalStudents
        : 0;

    let totalGradedCells = 0;
    let totalSubmittedWaiting = 0;
    let totalRevisionCells = 0;
    computedRows.forEach((r) => {
      r.cells.forEach((c) => {
        if (!c.isApplicable || !c.submission) return;
        if (c.submission.status === 'graded') totalGradedCells += 1;
        else if (c.submission.status === 'submitted') totalSubmittedWaiting += 1;
        else if (c.submission.status === 'needs_revision') totalRevisionCells += 1;
      });
    });

    return {
      totalStudents,
      totalWorksheets,
      totalPossiblePerStudent,
      avgPercent,
      avgPoints,
      totalGradedCells,
      totalSubmittedWaiting,
      totalRevisionCells,
    };
  }, [computedRows, roomWorksheets, role]);

  const handleOpenInlineEditor = (
    asg: Assignment,
    student: StudentProfile,
    sub: Submission | undefined
  ) => {
    setEditingCell({
      assignment: asg,
      student,
      submission: sub,
      scoreInput: sub && typeof sub.score === 'number' ? String(sub.score) : '',
      commentInput: sub?.teacherComment || '',
      status: sub?.status === 'needs_revision' ? 'needs_revision' : 'graded',
    });
  };

  const handleRequestSaveInlineScore = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell) return;
    const parsed = Number(editingCell.scoreInput);
    const clampedScore = Number.isNaN(parsed)
      ? 0
      : Math.max(0, Math.min(editingCell.assignment.totalPoints, parsed));
    const wsIndex = roomWorksheets.findIndex((w) => w.id === editingCell.assignment.id);
    const wsLabel = wsIndex >= 0 ? `ใบงานที่ ${wsIndex + 1}: ${editingCell.assignment.title}` : editingCell.assignment.title;

    setPendingConfirm({
      cell: editingCell,
      numericScore: clampedScore,
      details: [
        { label: 'ห้องเรียน', value: selectedRoom || '-' },
        { label: 'นักเรียน', value: `${editingCell.student.code} · ${editingCell.student.name}` },
        { label: 'ใบงาน', value: wsLabel },
        {
          label: 'คะแนนที่จะบันทึก',
          value: `${clampedScore} / ${editingCell.assignment.totalPoints} คะแนน`,
        },
        {
          label: 'สถานะ',
          value: editingCell.status === 'graded' ? 'ตรวจแล้ว (เก็บคะแนน)' : 'ส่งกลับให้นักเรียนแก้ไข',
        },
      ],
    });
  };

  const handleConfirmSaveInlineScore = () => {
    if (!pendingConfirm) return;
    const { cell, numericScore } = pendingConfirm;
    onUpsertCellScore(
      cell.assignment,
      cell.student,
      cell.submission,
      numericScore,
      cell.commentInput.trim(),
      cell.status
    );
    setPendingConfirm(null);
    setEditingCell(null);
  };

  const handleExportExcel = () => {
    if (computedRows.length === 0) return;

    const exportData = computedRows.map((row, rIdx) => {
      const record: Record<string, string | number> = {
        'ที่': rIdx + 1,
        'เลขประจำตัว': row.student.code,
        'ชื่อ-นามสกุล': row.student.name,
        'ห้องเรียน': row.student.gradeLevel || selectedRoom,
      };

      row.cells.forEach((cell, cIdx) => {
        const colTitle = `ใบงานที่ ${cIdx + 1}: ${cell.assignment.title} (เต็ม ${cell.assignment.totalPoints})`;
        if (!cell.isApplicable) {
          record[colTitle] = 'ไม่ได้มอบหมาย';
        } else if (cell.submission && typeof cell.submission.score === 'number' && cell.submission.status === 'graded') {
          record[colTitle] = cell.submission.score;
        } else if (cell.submission?.status === 'submitted') {
          record[colTitle] = 'รอตรวจ';
        } else if (cell.submission?.status === 'needs_revision') {
          record[colTitle] = typeof cell.submission.score === 'number' ? `${cell.submission.score} (แก้ไข)` : 'รอแก้ไข';
        } else {
          record[colTitle] = '-';
        }
      });

      record['ส่งงานแล้ว'] = `${row.submittedOrGradedCount}/${row.applicableCount}`;
      record['คะแนนรวม'] = row.earnedSum;
      record['คะแนนเต็มรวม'] = row.maxSum;
      record['ร้อยละ (%)'] = Number(row.percent.toFixed(1));
      record['เกรดเบื้องต้น'] = row.grade;

      return record;
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    const safeRoom = (selectedRoom || 'room').replace(/[/\\?*[\]]/g, '-');
    const safeSubject = selectedSubject === 'ทั้งหมด' ? 'ทุกวิชา' : selectedSubject.replace(/[/\\?*[\]]/g, '-');
    XLSX.utils.book_append_sheet(workbook, worksheet, `คะแนน_${safeRoom}`.slice(0, 31));
    XLSX.writeFile(workbook, `สมุดเก็บคะแนน_${safeRoom}_${safeSubject}.xlsx`);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200 print:space-y-4">
      {/* Top Header Bar */}
      <div className="relative overflow-hidden bg-white dark:bg-[var(--theme-surface-dark)] border border-emerald-200/75 dark:border-emerald-950/70 rounded-2xl p-5 sm:p-6 shadow-xs theme-transition">
        <CardCornerOrnament className="absolute -top-3 -right-3 w-28 h-28 opacity-65" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-700 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-xs">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold font-prompt text-slate-900 dark:text-white tracking-tight">
                {role === 'student' ? 'สมุดบันทึกคะแนนของฉัน' : 'สมุดเก็บคะแนนรายห้องเรียน'}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {role === 'student'
                  ? `รวบรวมคะแนนจากทุกใบงานในห้อง ${selectedRoom || '-'} เรียงตามลำดับใบงานที่และหัวข้อเรื่อง`
                  : 'ดึงคะแนนจากใบงานทุกเรื่องของแต่ละห้องมาจัดเก็บอัตโนมัติ พร้อมเลขที่ใบงานและหัวข้อเรื่องชัดเจน'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            {role === 'teacher' && (
              <>
                {onUpdateGradebookVisibility && (
                  <button
                    type="button"
                    onClick={() => {
                      const nextEnabled = !studentGradebookEnabled;
                      setPendingVisibilityChange({
                        title: nextEnabled
                          ? 'ยืนยันการเปิดสมุดคะแนนของนักเรียน?'
                          : 'ยืนยันการปิดสมุดคะแนนของนักเรียน?',
                        description: nextEnabled
                          ? 'นักเรียนจะสามารถมองเห็นเมนู "สมุดคะแนน" และดูคะแนนใบงานของตนเองได้ (ยกเว้นห้องที่ถูกปิดเฉพาะห้อง)'
                          : 'นักเรียนทุกคนจะไม่สามารถมองเห็นเมนู "สมุดคะแนน" จนกว่าครูจะเปิดใช้งานอีกครั้ง',
                        details: [
                          {
                            label: 'สถานะเดิม',
                            value: studentGradebookEnabled ? 'เปิดให้นักเรียนดู' : 'ปิดไม่ให้นักเรียนดู',
                          },
                          {
                            label: 'สถานะใหม่',
                            value: nextEnabled ? 'เปิดให้นักเรียนดู' : 'ปิดไม่ให้นักเรียนดู',
                          },
                        ],
                        confirmLabel: nextEnabled ? 'ยืนยันเปิดสมุดคะแนน' : 'ยืนยันปิดสมุดคะแนน',
                        variant: nextEnabled ? 'emerald' : 'amber',
                        nextEnabled,
                        nextDisabledRooms: gradebookDisabledRooms,
                      });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      studentGradebookEnabled
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-950/60'
                        : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-950/60'
                    }`}
                  >
                    {studentGradebookEnabled ? (
                      <>
                        <Unlock className="w-4 h-4" />
                        <span>สมุดคะแนนนักเรียน: เปิดอยู่</span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-4 h-4" />
                        <span>สมุดคะแนนนักเรียน: ปิดอยู่</span>
                      </>
                    )}
                  </button>
                )}

                {onUpdateGradebookVisibility && studentGradebookEnabled && selectedRoom && (
                  <button
                    type="button"
                    onClick={() => {
                      const currentlyDisabled = gradebookDisabledRooms.includes(selectedRoom);
                      const nextDisabledRooms = currentlyDisabled
                        ? gradebookDisabledRooms.filter((r) => r !== selectedRoom)
                        : [...gradebookDisabledRooms, selectedRoom];
                      setPendingVisibilityChange({
                        title: currentlyDisabled
                          ? `ยืนยันเปิดสมุดคะแนนให้นักเรียนห้อง ${selectedRoom}?`
                          : `ยืนยันปิดสมุดคะแนนนักเรียนเฉพาะห้อง ${selectedRoom}?`,
                        description: currentlyDisabled
                          ? `นักเรียนในห้อง ${selectedRoom} จะสามารถเปิดดูสมุดคะแนนของตนเองได้`
                          : `นักเรียนในห้อง ${selectedRoom} จะถูกซ่อนเมนูสมุดคะแนนไว้ชั่วคราว (ห้องอื่นยังใช้งานได้ตามปกติ)`,
                        details: [
                          { label: 'ห้องเรียน', value: selectedRoom },
                          {
                            label: 'การตั้งค่าใหม่',
                            value: currentlyDisabled ? 'เปิดให้นักเรียนดู' : 'ปิดเฉพาะห้องนี้',
                          },
                        ],
                        confirmLabel: currentlyDisabled ? 'ยืนยันเปิดห้องนี้' : 'ยืนยันปิดเฉพาะห้องนี้',
                        variant: currentlyDisabled ? 'emerald' : 'amber',
                        nextEnabled: studentGradebookEnabled,
                        nextDisabledRooms,
                      });
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      gradebookDisabledRooms.includes(selectedRoom)
                        ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {gradebookDisabledRooms.includes(selectedRoom) ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        <span>ห้อง {selectedRoom}: ปิดนักเรียนอยู่</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span>ห้อง {selectedRoom}: เปิดให้นักเรียนดู</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={computedRows.length === 0}
                  className="theme-btn-sheen inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>ส่งออก Excel (.xlsx)</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={computedRows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>พิมพ์สมุดคะแนน</span>
                </button>
              </>
            )}
          </div>
        </div>

        {role === 'teacher' && isSelectedRoomDisabledForStudents && (
          <div className="mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2 print:hidden">
            <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              {!studentGradebookEnabled
                ? 'ขณะนี้ปิดสมุดคะแนนสำหรับนักเรียนทุกคนอยู่ (ครูยังดูและบันทึกคะแนนได้ตามปกติ หากต้องการให้นักเรียนดูได้ กดปุ่ม "สมุดคะแนนนักเรียน: ปิดอยู่" ด้านบน)'
                : `ขณะนี้ปิดสมุดคะแนนสำหรับนักเรียนห้อง ${selectedRoom} ชั่วคราว (กดปุ่มด้านบนเพื่อเปิดให้ห้อง ${selectedRoom} ดูได้)`}
            </span>
          </div>
        )}

        {/* Room Selector & Subject / Search Filter Bar */}
        <div className="mt-5 pt-5 border-t border-slate-200 dark:border-emerald-950/60 space-y-3 print:hidden">
          {role === 'teacher' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>เลือกห้องเรียน (แยกสมุดเก็บคะแนนแต่ละห้อง):</span>
                </span>
                {onOpenSettings && availableRooms.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenSettings('grades')}
                    className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold hover:underline cursor-pointer"
                  >
                    + ตั้งค่าชั้นเรียน
                  </button>
                )}
              </div>

              {availableRooms.length === 0 ? (
                <div className="text-xs text-slate-500 dark:text-slate-400 py-2">
                  ยังไม่มีข้อมูลห้องเรียน กรุณาเพิ่มชั้นเรียนหรือรายชื่อนักเรียนในเมนูตั้งค่า
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {availableRooms.map((room) => {
                    const countInRoom = studentsRoster.filter((s) =>
                      matchesSelectedRoom(s.gradeLevel, room)
                    ).length;
                    const isActive = selectedRoom === room;
                    return (
                      <button
                        key={room}
                        type="button"
                        onClick={() => setSelectedRoom(room)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                            : 'theme-soft-surface dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>ห้อง {room}</span>
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            isActive ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          ({countInRoom})
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 pt-1">
            {/* Subject Filter */}
            <div className={role === 'teacher' ? 'sm:col-span-5' : 'sm:col-span-12'}>
              <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                กรองตามรายวิชา
              </label>
              <div className="relative">
                <BookOpen className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 theme-soft-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                >
                  {subjectOptions.map((subj) => (
                    <option key={subj} value={subj}>
                      {subj === 'ทั้งหมด' ? 'ทุกรายวิชาในห้องนี้' : `วิชา: ${subj}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search Student (Teacher only) */}
            {role === 'teacher' && (
              <div className="sm:col-span-7">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  ค้นหานักเรียนในห้อง {selectedRoom}
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="พิมพ์เลขประจำตัว หรือ ชื่อนักเรียน..."
                    className="w-full pl-9 pr-8 py-2 theme-soft-surface dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      aria-label="ล้างคำค้นหา"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="theme-card-interactive bg-white dark:bg-[var(--theme-surface-dark)] border border-emerald-200/75 dark:border-emerald-950/70 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{role === 'student' ? 'ห้องเรียนของฉัน' : 'นักเรียนในห้อง'}</span>
            <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold font-prompt text-slate-900 dark:text-white tabular-nums">
            {role === 'student' ? (selectedRoom || '-') : `${roomKpis.totalStudents} คน`}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {role === 'student' ? `รหัส ${currentStudent.code || '-'}` : `ห้อง ${selectedRoom || '-'}`}
          </p>
        </div>

        <div className="theme-card-interactive bg-white dark:bg-[var(--theme-surface-dark)] border border-emerald-200/75 dark:border-emerald-950/70 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>จำนวนใบงานทั้งหมด</span>
            <ListOrdered className="w-4 h-4 text-teal-700 dark:text-teal-400" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold font-prompt text-slate-900 dark:text-white tabular-nums">
            {roomKpis.totalWorksheets} ใบงาน
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            คะแนนเต็มรวม {roomKpis.totalPossiblePerStudent} คะแนน
          </p>
        </div>

        <div className="theme-card-interactive bg-white dark:bg-[var(--theme-surface-dark)] border border-emerald-200/75 dark:border-emerald-950/70 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{role === 'student' ? 'คะแนนรวมที่ได้' : 'ค่าเฉลี่ยคะแนนทั้งห้อง'}</span>
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold font-prompt text-emerald-700 dark:text-emerald-400 tabular-nums">
            {roomKpis.avgPercent.toFixed(1)}%
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {role === 'student'
              ? `ได้ ${roomKpis.avgPoints} / ${roomKpis.totalPossiblePerStudent} คะแนน (เกรด ${computedRows[0]?.grade || '-'})`
              : `เฉลี่ย ${roomKpis.avgPoints.toFixed(1)} / ${roomKpis.totalPossiblePerStudent} คะแนน`}
          </p>
        </div>

        <div className="theme-card-interactive bg-white dark:bg-[var(--theme-surface-dark)] border border-emerald-200/75 dark:border-emerald-950/70 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>สถานะการตรวจคะแนน</span>
            <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold font-prompt text-slate-900 dark:text-white tabular-nums">
            {roomKpis.totalGradedCells} รายการ
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
            รอตรวจ {roomKpis.totalSubmittedWaiting} รายการ
            {roomKpis.totalRevisionCells > 0 ? ` · แก้ไข ${roomKpis.totalRevisionCells}` : ''}
          </p>
        </div>
      </div>

      {/* Worksheet Topic Directory */}
      {roomWorksheets.length > 0 && (
        <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTopicIndex(!showTopicIndex)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-emerald-50/40 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span className="text-sm font-bold font-prompt text-slate-900 dark:text-white">
                สารบัญใบงานของห้อง {selectedRoom} ({roomWorksheets.length} เรื่อง)
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{showTopicIndex ? 'ซ่อนรายการ' : 'แสดงหัวข้อทั้งหมด'}</span>
              {showTopicIndex ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showTopicIndex && (
            <div className="border-t border-slate-200 dark:border-emerald-950/60 divide-y divide-slate-100 dark:divide-emerald-950/60">
              {columnStats.map((stat) => (
                <div
                  key={stat.assignment.id}
                  className="px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap shrink-0 tabular-nums">
                      ใบงานที่ {stat.worksheetNumber}
                    </span>
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900 dark:text-slate-100 break-words">
                        เรื่อง {stat.assignment.title}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 ml-2">
                        · วิชา {stat.assignment.subject}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-600 dark:text-slate-300 shrink-0 tabular-nums">
                    <span>เต็ม {stat.assignment.totalPoints} คะแนน</span>
                    {role === 'teacher' && (
                      <>
                        <span>
                          ตรวจแล้ว {stat.gradedItems}/{stat.targetStudents} คน
                        </span>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          เฉลี่ย {stat.avgScore !== null ? stat.avgScore.toFixed(1) : '-'}
                        </span>
                        <button
                          type="button"
                          onClick={() => onOpenRosterModal(stat.assignment)}
                          className="text-emerald-700 dark:text-emerald-400 hover:underline font-semibold cursor-pointer print:hidden"
                        >
                          เปิดตรวจงาน
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Gradebook Matrix Table */}
      <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200/80 dark:border-emerald-950/70 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-sm sm:text-base font-bold font-prompt text-slate-900 dark:text-white">
              ตารางสมุดเก็บคะแนน — ห้อง {selectedRoom || '-'}
              {selectedSubject !== 'ทั้งหมด' ? ` (${selectedSubject})` : ''}
            </h2>
            {role === 'teacher' && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                คลิกที่ช่องคะแนนของนักเรียนเพื่อแก้ไขหรือกรอกคะแนนได้โดยตรง (หรือเปิดดูคำตอบใบงานเพื่อตรวจละเอียด)
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400 print:hidden">
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5" /> ตรวจแล้ว
            </span>
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5" /> รอตรวจ
            </span>
            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" /> ส่งกลับแก้ไข
            </span>
          </div>
        </div>

        {!selectedRoom ? (
          <div className="text-center py-14 px-4 text-sm text-slate-500 dark:text-slate-400 space-y-2">
            <p>
              {role === 'student'
                ? 'ยังไม่มีข้อมูลห้องเรียนในบัญชีนักเรียนของคุณ กรุณาติดต่อครูผู้สอน'
                : 'ยังไม่มีห้องเรียนที่เลือกในระบบ'}
            </p>
            {role === 'teacher' && onOpenSettings && (
              <button
                type="button"
                onClick={() => onOpenSettings('grades')}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                ตั้งค่าชั้นเรียนและรายชื่อนักเรียน
              </button>
            )}
          </div>
        ) : computedRows.length === 0 ? (
          <div className="text-center py-14 px-4 text-sm text-slate-500 dark:text-slate-400 space-y-2">
            <p>
              {role === 'student'
                ? 'ไม่พบข้อมูลรหัสนักเรียนในระบบ กรุณาเข้าสู่ระบบใหม่อีกครั้ง'
                : searchTerm
                ? `ไม่พบนักเรียนที่ตรงกับ "${searchTerm}" ในห้อง ${selectedRoom}`
                : `ยังไม่มีรายชื่อนักเรียนในห้อง ${selectedRoom}`}
            </p>
            {role === 'teacher' && onOpenSettings && !searchTerm && (
              <button
                type="button"
                onClick={() => onOpenSettings('students')}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                เพิ่มหรือนำเข้ารายชื่อนักเรียนห้อง {selectedRoom}
              </button>
            )}
          </div>
        ) : roomWorksheets.length === 0 ? (
          <div className="text-center py-14 px-4 text-sm text-slate-500 dark:text-slate-400 space-y-1">
            <p>
              ยังไม่มีใบงานที่มอบหมายให้ห้อง {selectedRoom}
              {selectedSubject !== 'ทั้งหมด' ? ` ในรายวิชา "${selectedSubject}"` : ''}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              เมื่อสร้างใบงานสำหรับห้อง {selectedRoom} หรือระดับชั้นนี้ ระบบจะดึงหัวข้อใบงานและคะแนนมาเก็บในตารางนี้ให้อัตโนมัติ
            </p>
          </div>
        ) : role === 'student' ? (
          (() => {
            const studentRow = computedRows[0];
            const applicableCells = studentRow.cells
              .map((cell, idx) => ({ ...cell, wsNumber: idx + 1 }))
              .filter((cell) => cell.isApplicable);

            return (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {/* Student Summary Bar */}
                <div className="px-5 py-3 theme-soft-surface dark:bg-slate-800/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-3 text-slate-700 dark:text-slate-200">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {studentRow.student.name}
                    </span>
                    <span className="font-mono text-slate-500 dark:text-slate-400">
                      รหัส {studentRow.student.code || '-'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      ส่งงานแล้ว {studentRow.submittedOrGradedCount}/{studentRow.applicableCount} ใบงาน
                    </span>
                  </div>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      คะแนนรวม {studentRow.earnedSum} / {studentRow.maxSum} ({studentRow.percent.toFixed(1)}%)
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-lg font-bold border ${
                        studentRow.grade === '0'
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                          : studentRow.grade === '4' || studentRow.grade === '3.5'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      เกรด {studentRow.grade}
                    </span>
                  </div>
                </div>

                {/* Student Per-Worksheet Breakdown Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs sm:text-sm">
                    <thead>
                      <tr className="bg-slate-50/80 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs">
                        <th className="px-4 py-3 text-left font-semibold w-24">ใบงานที่</th>
                        <th className="px-4 py-3 text-left font-semibold min-w-[200px]">เรื่อง / รายวิชา</th>
                        <th className="px-4 py-3 text-center font-semibold w-32">สถานะ</th>
                        <th className="px-4 py-3 text-right font-semibold w-32">คะแนน</th>
                        <th className="px-4 py-3 text-left font-semibold min-w-[180px]">ข้อเสนอแนะจากครู</th>
                        <th className="px-4 py-3 text-center font-semibold w-28 print:hidden">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {applicableCells.map((cell) => {
                        const sub = cell.submission;
                        const maxPts = cell.assignment.totalPoints;
                        const isGraded = sub?.status === 'graded' && typeof sub.score === 'number';
                        const isWaitingGrade = sub?.status === 'submitted';
                        const isRevision = sub?.status === 'needs_revision';

                        return (
                          <tr
                            key={cell.assignment.id}
                            className="hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors"
                          >
                            <td className="px-4 py-3 font-mono font-bold text-emerald-700 dark:text-emerald-300 tabular-nums align-top">
                              ใบงานที่ {cell.wsNumber}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="font-semibold text-slate-900 dark:text-white">
                                {cell.assignment.title}
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                วิชา {cell.assignment.subject} · คะแนนเต็ม {maxPts}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center align-top">
                              {isGraded ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold">
                                  <CheckCircle2 className="w-3 h-3" /> ตรวจแล้ว
                                </span>
                              ) : isWaitingGrade ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 text-[11px] font-semibold">
                                  <Clock className="w-3 h-3" /> รอครูตรวจ
                                </span>
                              ) : isRevision ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-[11px] font-semibold">
                                  <AlertCircle className="w-3 h-3" /> ต้องแก้ไข
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-medium">
                                  ยังไม่ส่ง
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-mono font-bold tabular-nums align-top">
                              {isGraded ? (
                                <span className="text-emerald-700 dark:text-emerald-300">
                                  {sub.score} / {maxPts}
                                </span>
                              ) : isRevision && typeof sub?.score === 'number' ? (
                                <span className="text-rose-600 dark:text-rose-400">
                                  {sub.score} / {maxPts}
                                </span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">- / {maxPts}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-slate-600 dark:text-slate-300 align-top">
                              {sub?.teacherComment ? (
                                <span className="line-clamp-2">{sub.teacherComment}</span>
                              ) : (
                                <span className="text-slate-400 dark:text-slate-500">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center align-top print:hidden">
                              <button
                                type="button"
                                onClick={() => onOpenSubmitModal(cell.assignment)}
                                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                {isGraded ? 'ดูผลตรวจ' : isRevision ? 'แก้ไขงาน' : isWaitingGrade ? 'ดูคำตอบ' : 'ทำใบงาน'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-emerald-50/50 dark:bg-emerald-950/25 border-t-2 border-slate-200 dark:border-slate-700 font-bold text-xs sm:text-sm">
                        <td colSpan={3} className="px-4 py-3 text-right text-slate-800 dark:text-slate-100">
                          รวมคะแนนทั้งหมด ({studentRow.percent.toFixed(1)}% · เกรด {studentRow.grade})
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                          {studentRow.earnedSum} / {studentRow.maxSum}
                        </td>
                        <td colSpan={2} className="px-4 py-3" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="theme-soft-surface dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                  <th className="sticky left-0 z-20 theme-soft-surface dark:bg-slate-800 px-3 py-3 text-center font-semibold border-r border-slate-200 dark:border-slate-700 w-10">
                    ที่
                  </th>
                  <th className="sticky left-10 z-20 theme-soft-surface dark:bg-slate-800 px-3 py-3 text-left font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[92px]">
                    รหัส
                  </th>
                  <th className="sticky left-[132px] z-20 theme-soft-surface dark:bg-slate-800 px-3 py-3 text-left font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[170px]">
                    ชื่อ-นามสกุล
                  </th>

                  {roomWorksheets.map((asg, idx) => (
                    <th
                      key={asg.id}
                      className="px-3 py-2.5 text-center font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[165px] max-w-[220px] align-top"
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                        <span>ใบงานที่ {idx + 1}</span>
                        <span className="text-slate-500 dark:text-slate-400 font-medium">
                          (เต็ม {asg.totalPoints})
                        </span>
                      </div>
                      <div
                        className="mt-1 text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-2 text-left"
                        title={`ใบงานที่ ${idx + 1}: ${asg.title}`}
                      >
                        {asg.title}
                      </div>
                      <div className="mt-0.5 text-[10px] font-normal text-slate-500 dark:text-slate-400 text-left truncate">
                        {asg.subject}
                        {asg.workMode === 'group' && (
                          <span className="text-teal-700 dark:text-teal-400 font-semibold">
                            {' '}· งานกลุ่ม
                          </span>
                        )}
                      </div>
                    </th>
                  ))}

                  <th className="px-3 py-3 text-center font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[78px] bg-slate-100/80 dark:bg-slate-800">
                    ส่งแล้ว
                  </th>
                  <th className="px-3 py-3 text-right font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[96px] bg-emerald-50/75 dark:bg-emerald-950/35">
                    <div>รวมคะแนน</div>
                    <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 tabular-nums">
                      (เต็ม {roomKpis.totalPossiblePerStudent})
                    </div>
                  </th>
                  <th className="px-3 py-3 text-right font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[72px] bg-emerald-50/75 dark:bg-emerald-950/35">
                    ร้อยละ
                  </th>
                  <th className="px-3 py-3 text-center font-semibold min-w-[68px] bg-emerald-50/75 dark:bg-emerald-950/35">
                    เกรด
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {computedRows.map((row, rowIdx) => (
                  <tr
                    key={row.student.id || row.student.code}
                    className="hover:bg-slate-50/90 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="sticky left-0 z-10 bg-white dark:bg-[var(--theme-surface-dark)] px-3 py-2.5 text-center text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-emerald-950/60 tabular-nums">
                      {rowIdx + 1}
                    </td>
                    <td className="sticky left-10 z-10 bg-white dark:bg-[var(--theme-surface-dark)] px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-emerald-950/60 tabular-nums">
                      {row.student.code || '-'}
                    </td>
                    <td className="sticky left-[132px] z-10 bg-white dark:bg-[var(--theme-surface-dark)] px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-emerald-950/60">
                      <span className="block truncate max-w-[200px]" title={row.student.name}>
                        {row.student.name}
                      </span>
                    </td>

                    {row.cells.map((cell) => {
                      const sub = cell.submission;
                      const maxPts = cell.assignment.totalPoints;

                      if (!cell.isApplicable) {
                        return (
                          <td
                            key={cell.assignment.id}
                            className="px-3 py-2.5 text-center text-slate-300 dark:text-slate-600 border-r border-slate-200 dark:border-slate-800"
                          >
                            ไม่ได้มอบหมาย
                          </td>
                        );
                      }

                      const isGraded = sub?.status === 'graded' && typeof sub.score === 'number';
                      const isWaitingGrade = sub?.status === 'submitted';
                      const isRevision = sub?.status === 'needs_revision';

                      return (
                        <td
                          key={cell.assignment.id}
                          className="px-2.5 py-2 text-center border-r border-slate-200 dark:border-slate-800 align-middle"
                        >
                          {role === 'teacher' ? (
                            <div className="flex items-center justify-center gap-1 group">
                              <button
                                type="button"
                                onClick={() => handleOpenInlineEditor(cell.assignment, row.student, sub)}
                                className={`px-2 py-1 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer inline-flex items-center gap-1 ${
                                  isGraded
                                    ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                    : isWaitingGrade
                                    ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                    : isRevision
                                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                    : 'text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }`}
                                title="คลิกเพื่อแก้ไขหรือกรอกคะแนน"
                              >
                                {isGraded ? (
                                  <span>
                                    {sub.score}/{maxPts}
                                  </span>
                                ) : isWaitingGrade ? (
                                  <span>รอตรวจ</span>
                                ) : isRevision ? (
                                  <span>
                                    {typeof sub?.score === 'number' ? `${sub.score} (แก้ไข)` : 'รอแก้ไข'}
                                  </span>
                                ) : (
                                  <span>-</span>
                                )}
                                <Edit3 className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity print:hidden" />
                              </button>

                              {sub && (
                                <button
                                  type="button"
                                  onClick={() => onOpenGradingModal(cell.assignment, sub)}
                                  className="p-1 text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer print:hidden"
                                  title="เปิดหน้าตรวจคำตอบใบงาน"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onOpenSubmitModal(cell.assignment)}
                              className={`px-2 py-1 rounded-lg text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                                isGraded
                                  ? 'text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40'
                                  : isWaitingGrade
                                  ? 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                                  : isRevision
                                  ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                              }`}
                            >
                              {isGraded
                                ? `${sub.score}/${maxPts}`
                                : isWaitingGrade
                                ? 'รอครูตรวจ'
                                : isRevision
                                ? 'ต้องแก้ไข'
                                : 'ยังไม่ส่ง'}
                            </button>
                          )}
                        </td>
                      );
                    })}

                    <td className="px-3 py-2.5 text-center border-r border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 tabular-nums">
                      {row.submittedOrGradedCount}/{row.applicableCount}
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold border-r border-slate-200 dark:border-slate-800 text-emerald-700 dark:text-emerald-300 bg-emerald-50/45 dark:bg-emerald-950/20 tabular-nums">
                      {row.earnedSum} / {row.maxSum}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 bg-emerald-50/45 dark:bg-emerald-950/20 tabular-nums">
                      {row.percent.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold bg-emerald-50/45 dark:bg-emerald-950/20 tabular-nums">
                      <span
                        className={
                          row.grade === '0'
                            ? 'text-rose-600 dark:text-rose-400'
                            : row.grade === '4' || row.grade === '3.5'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-800 dark:text-slate-200'
                        }
                      >
                        {row.grade}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>

              {role === 'teacher' && (
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-slate-800/70 border-t-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold">
                    <td
                      colSpan={3}
                      className="sticky left-0 z-10 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-right border-r border-slate-200 dark:border-slate-700"
                    >
                      เฉลี่ยทั้งห้อง / ส่งแล้วรายใบงาน
                    </td>
                    {columnStats.map((stat) => (
                      <td
                        key={stat.assignment.id}
                        className="px-3 py-2.5 text-center border-r border-slate-200 dark:border-slate-700 tabular-nums"
                      >
                        <div className="text-emerald-700 dark:text-emerald-400">
                          เฉลี่ย {stat.avgScore !== null ? stat.avgScore.toFixed(1) : '-'}
                        </div>
                        <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400">
                          ส่ง {stat.submittedItems}/{stat.targetStudents} คน
                        </div>
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center border-r border-slate-200 dark:border-slate-700 tabular-nums">
                      -
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-slate-200 dark:border-slate-700 tabular-nums">
                      {roomKpis.avgPoints.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right border-r border-slate-200 dark:border-slate-700 tabular-nums">
                      {roomKpis.avgPercent.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {roomKpis.totalPossiblePerStudent > 0
                        ? calculateThaiGrade(roomKpis.avgPercent)
                        : '-'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Inline Cell Score Editor Modal (Teacher Only) */}
      {editingCell && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingCell(null);
          }}
        >
          <form
            onSubmit={handleRequestSaveInlineScore}
            className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                  บันทึก / แก้ไขคะแนนในสมุดเก็บคะแนน
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  นักเรียน: <strong className="text-slate-800 dark:text-slate-200">{editingCell.student.code} · {editingCell.student.name}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
                aria-label="ปิดหน้าต่าง"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="theme-soft-surface dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs space-y-1">
              <div className="font-bold text-emerald-700 dark:text-emerald-300">
                ใบงานที่ {roomWorksheets.findIndex((w) => w.id === editingCell.assignment.id) + 1}:{' '}
                {editingCell.assignment.title}
              </div>
              <div className="text-slate-500 dark:text-slate-400">
                วิชา {editingCell.assignment.subject} · คะแนนเต็ม {editingCell.assignment.totalPoints} คะแนน
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  คะแนนที่ได้ (0 - {editingCell.assignment.totalPoints})
                </label>
                <input
                  type="number"
                  min={0}
                  max={editingCell.assignment.totalPoints}
                  step="0.5"
                  required
                  autoFocus
                  value={editingCell.scoreInput}
                  onChange={(e) =>
                    setEditingCell((prev) => (prev ? { ...prev, scoreInput: e.target.value } : null))
                  }
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 tabular-nums"
                  placeholder={`กรอกคะแนนเต็มไม่เกิน ${editingCell.assignment.totalPoints}`}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  สถานะงาน
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingCell((prev) => (prev ? { ...prev, status: 'graded' } : null))
                    }
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      editingCell.status === 'graded'
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-500 text-emerald-700 dark:text-emerald-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>ตรวจแล้ว</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingCell((prev) => (prev ? { ...prev, status: 'needs_revision' } : null))
                    }
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                      editingCell.status === 'needs_revision'
                        ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-500 text-rose-700 dark:text-rose-300'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>ส่งกลับแก้ไข</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  หมายเหตุ / ข้อเสนอแนะ (ไม่บังคับ)
                </label>
                <textarea
                  rows={2}
                  value={editingCell.commentInput}
                  onChange={(e) =>
                    setEditingCell((prev) => (prev ? { ...prev, commentInput: e.target.value } : null))
                  }
                  placeholder="ระบุเหตุผลหรือคำแนะนำเพิ่มเติม..."
                  className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              {editingCell.submission ? (
                <button
                  type="button"
                  onClick={() => {
                    const targetAsg = editingCell.assignment;
                    const targetSub = editingCell.submission;
                    setEditingCell(null);
                    onOpenGradingModal(targetAsg, targetSub);
                  }}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>ดูคำตอบใบงาน</span>
                </button>
              ) : (
                <span className="text-[11px] text-slate-400">กรอกคะแนนตรงเข้าสมุดคะแนน</span>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="theme-btn-sheen px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>บันทึกคะแนน</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Pre-Save Confirmation Modal (Inline Score) */}
      <SaveConfirmModal
        isOpen={Boolean(pendingConfirm)}
        title="ยืนยันการบันทึกคะแนนลงสมุดเก็บคะแนน?"
        description="คะแนนนี้จะถูกอัปเดตทั้งในสมุดเก็บคะแนนของห้องและใบงานของนักเรียน"
        details={pendingConfirm?.details || []}
        confirmLabel="ยืนยันบันทึกคะแนน"
        variant="emerald"
        onConfirm={handleConfirmSaveInlineScore}
        onCancel={() => setPendingConfirm(null)}
      />

      {/* Pre-Save Confirmation Modal (Student Gradebook Open/Close Toggle) */}
      <SaveConfirmModal
        isOpen={Boolean(pendingVisibilityChange)}
        title={pendingVisibilityChange?.title || 'ยืนยันการเปลี่ยนสถานะสมุดคะแนนนักเรียน?'}
        description={pendingVisibilityChange?.description || ''}
        details={pendingVisibilityChange?.details || []}
        confirmLabel={pendingVisibilityChange?.confirmLabel || 'ยืนยันการบันทึก'}
        variant={pendingVisibilityChange?.variant || 'emerald'}
        onConfirm={() => {
          if (pendingVisibilityChange && onUpdateGradebookVisibility) {
            onUpdateGradebookVisibility(
              pendingVisibilityChange.nextEnabled,
              pendingVisibilityChange.nextDisabledRooms
            );
          }
          setPendingVisibilityChange(null);
        }}
        onCancel={() => setPendingVisibilityChange(null)}
      />
    </div>
  );
};
