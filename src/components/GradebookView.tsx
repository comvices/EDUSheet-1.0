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

const matchesRoomAssignment = (asgGrade: string, room: string): boolean => {
  if (!room) return false;
  if (asgGrade === room) return true;
  if (asgGrade === 'ทั้งหมด') return true;
  const baseGrade = room.includes('/') ? room.split('/')[0] : room;
  if (asgGrade === `${baseGrade} (ทุกห้อง)`) return true;
  if (!asgGrade.includes('/') && asgGrade === baseGrade) return true;
  return false;
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
      return currentStudent.gradeLevel ? [currentStudent.gradeLevel] : [];
    }
    const roomSet = new Set<string>();
    gradeLevelsList.forEach((g) => {
      if (g && g !== 'ทั้งหมด') {
        roomSet.add(g);
      }
    });
    return Array.from(roomSet).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
  }, [gradeLevelsList, role, currentStudent.gradeLevel]);

  const [selectedRoom, setSelectedRoom] = useState<string>(() => {
    if (role === 'student' && currentStudent.gradeLevel) {
      return currentStudent.gradeLevel;
    }
    return availableRooms[0] || '';
  });

  useEffect(() => {
    if (role === 'student' && currentStudent.gradeLevel) {
      setSelectedRoom(currentStudent.gradeLevel);
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

  const isSelectedRoomDisabledForStudents =
    !studentGradebookEnabled || (selectedRoom ? gradebookDisabledRooms.includes(selectedRoom) : false);

  // Available subjects present in settings or assignments for this room
  const subjectOptions = useMemo(() => {
    const set = new Set<string>(['ทั้งหมด']);
    subjectsList.forEach((s) => {
      if (s) set.add(s);
    });
    assignments.forEach((a) => {
      if (a.subject) set.add(a.subject);
    });
    return Array.from(set);
  }, [subjectsList, assignments]);

  // Students belonging to selectedRoom (strictly isolated if student role)
  const roomStudents = useMemo(() => {
    if (role === 'student') {
      return currentStudent.code ? [currentStudent] : [];
    }
    if (!selectedRoom) return [];

    const matchesSelectedRoom = (studentGrade: string) => {
      if (!studentGrade) return false;
      if (studentGrade === selectedRoom) return true;
      if (selectedRoom.endsWith(' (ทุกห้อง)')) {
        const base = selectedRoom.replace(/\s*\(ทุกห้อง\)$/, '');
        return studentGrade === base || studentGrade.startsWith(`${base}/`);
      }
      if (!selectedRoom.includes('/') && studentGrade.startsWith(`${selectedRoom}/`)) {
        return true;
      }
      return false;
    };

    const baseStudents = studentsRoster.filter((s) => matchesSelectedRoom(s.gradeLevel));

    // Also include any ad-hoc students who have submissions in this room
    const seenCodes = new Set(baseStudents.map((s) => s.code));
    const extraFromSubs: StudentProfile[] = [];
    submissions.forEach((sub) => {
      if (matchesSelectedRoom(sub.gradeLevel) && sub.studentCode && !seenCodes.has(sub.studentCode)) {
        seenCodes.add(sub.studentCode);
        extraFromSubs.push({
          id: sub.studentId || `std_${sub.studentCode}`,
          code: sub.studentCode,
          name: sub.studentName || sub.studentCode,
          password: '',
          gradeLevel: sub.gradeLevel,
          avatar: '',
        });
      }
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

  // Worksheets assigned to the selected room (and optional subject), numbered 1..N chronologically
  const roomWorksheets = useMemo(() => {
    const roomCodes = new Set(roomStudents.map((s) => s.code));
    return assignments
      .filter((asg) => {
        if (selectedSubject !== 'ทั้งหมด' && asg.subject !== selectedSubject) {
          return false;
        }
        if (matchesRoomAssignment(asg.gradeLevel, selectedRoom)) {
          return true;
        }
        // Or individually assigned to at least one student in this room
        if (asg.assignedStudentCodes && asg.assignedStudentCodes.length > 0) {
          return asg.assignedStudentCodes.some((c) => roomCodes.has(c));
        }
        return false;
      })
      .sort((a, b) => {
        const createdDiff = new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime();
        if (!Number.isNaN(createdDiff) && createdDiff !== 0) return createdDiff;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      });
  }, [assignments, selectedRoom, selectedSubject, roomStudents]);

  // Quick lookup: `${assignmentId}__${studentCode}` -> Submission
  const submissionLookup = useMemo(() => {
    const map = new Map<string, Submission>();
    submissions.forEach((sub) => {
      const codeKey = `${sub.assignmentId}__${sub.studentCode}`;
      const existing = map.get(codeKey);
      // Prefer graded over submitted/pending if duplicates exist
      if (!existing || (existing.status !== 'graded' && sub.status === 'graded')) {
        map.set(codeKey, sub);
      }
      if (sub.studentId) {
        const idKey = `${sub.assignmentId}__ID_${sub.studentId}`;
        map.set(idKey, sub);
      }
    });
    return map;
  }, [submissions]);

  const getCellSubmission = (assignmentId: string, student: StudentProfile): Submission | undefined => {
    return (
      submissionLookup.get(`${assignmentId}__${student.code}`) ||
      submissionLookup.get(`${assignmentId}__ID_${student.id}`)
    );
  };

  // Check if worksheet applies to specific student (for individual targeted assignments)
  const isWorksheetTargetedToStudent = (asg: Assignment, studentCode: string): boolean => {
    if (!asg.assignedStudentCodes || asg.assignedStudentCodes.length === 0) return true;
    return asg.assignedStudentCodes.includes(studentCode);
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
    const totalWorksheets = roomWorksheets.length;
    const totalPossiblePerStudent = roomWorksheets.reduce((acc, a) => acc + (a.totalPoints || 0), 0);

    const avgPercent =
      totalStudents > 0 && totalPossiblePerStudent > 0
        ? computedRows.reduce((acc, r) => acc + r.percent, 0) / totalStudents
        : 0;
    const avgPoints =
      totalStudents > 0
        ? computedRows.reduce((acc, r) => acc + r.earnedSum, 0) / totalStudents
        : 0;

    let totalGradedCells = 0;
    let totalSubmittedWaiting = 0;
    computedRows.forEach((r) => {
      r.cells.forEach((c) => {
        if (!c.isApplicable || !c.submission) return;
        if (c.submission.status === 'graded') totalGradedCells += 1;
        else if (c.submission.status === 'submitted') totalSubmittedWaiting += 1;
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
    };
  }, [computedRows, roomWorksheets]);

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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0">
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
                        <Eye className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        <span>ห้อง {selectedRoom}: เปิดให้นักเรียนดู</span>
                      </>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleExportExcel}
                  disabled={computedRows.length === 0}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
        <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-800 space-y-3 print:hidden">
          {role === 'teacher' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>เลือกห้องเรียน (แยกสมุดเก็บคะแนนแต่ละห้อง):</span>
                </span>
                {onOpenSettings && availableRooms.length === 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenSettings('grades')}
                    className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
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
                    const countInRoom = studentsRoster.filter((s) => s.gradeLevel === room).length;
                    const isActive = selectedRoom === room;
                    return (
                      <button
                        key={room}
                        type="button"
                        onClick={() => setSelectedRoom(room)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                          isActive
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>ห้อง {room}</span>
                        <span
                          className={`text-[11px] font-mono tabular-nums ${
                            isActive ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'
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
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
                    className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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

      {/* KPI Metrics Strip (Single-Elevation Grid, Tabular Numerals) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{role === 'student' ? 'ห้องเรียนของฉัน' : 'นักเรียนในห้อง'}</span>
            <Users className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold font-prompt text-slate-900 dark:text-white tabular-nums">
            {role === 'student' ? (selectedRoom || '-') : `${roomKpis.totalStudents} คน`}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {role === 'student' ? `รหัส ${currentStudent.code || '-'}` : `ห้อง ${selectedRoom || '-'}`}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>จำนวนใบงานทั้งหมด</span>
            <ListOrdered className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold font-prompt text-slate-900 dark:text-white tabular-nums">
            {roomKpis.totalWorksheets} ใบงาน
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            คะแนนเต็มรวม {roomKpis.totalPossiblePerStudent} คะแนน
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>{role === 'student' ? 'คะแนนรวมที่ได้' : 'ค่าเฉลี่ยคะแนนทั้งห้อง'}</span>
            <Award className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold font-prompt text-emerald-700 dark:text-emerald-400 tabular-nums">
            {roomKpis.avgPercent.toFixed(1)}%
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            เฉลี่ย {roomKpis.avgPoints.toFixed(1)} / {roomKpis.totalPossiblePerStudent} คะแนน
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>สถานะการตรวจคะแนน</span>
            <CheckCircle2 className="w-4 h-4 text-sky-600 dark:text-sky-400" />
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold font-prompt text-slate-900 dark:text-white tabular-nums">
            {roomKpis.totalGradedCells} รายการ
          </p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 tabular-nums">
            รอตรวจ {roomKpis.totalSubmittedWaiting} รายการ
          </p>
        </div>
      </div>

      {/* Worksheet Topic Directory (สารบัญหัวใบงานที่ ของแต่ละเรื่อง) */}
      {roomWorksheets.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTopicIndex(!showTopicIndex)}
            className="w-full px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
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
            <div className="border-t border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
              {columnStats.map((stat) => (
                <div
                  key={stat.assignment.id}
                  className="px-5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-3 min-w-0">
                    <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap shrink-0 tabular-nums">
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
                          className="text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer print:hidden"
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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
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
            <p>ยังไม่มีห้องเรียนที่เลือกในระบบ</p>
            {role === 'teacher' && onOpenSettings && (
              <button
                type="button"
                onClick={() => onOpenSettings('grades')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
              >
                ตั้งค่าชั้นเรียนและรายชื่อนักเรียน
              </button>
            )}
          </div>
        ) : computedRows.length === 0 ? (
          <div className="text-center py-14 px-4 text-sm text-slate-500 dark:text-slate-400 space-y-2">
            <p>
              {searchTerm
                ? `ไม่พบนักเรียนที่ตรงกับ "${searchTerm}" ในห้อง ${selectedRoom}`
                : `ยังไม่มีรายชื่อนักเรียนในห้อง ${selectedRoom}`}
            </p>
            {role === 'teacher' && onOpenSettings && !searchTerm && (
              <button
                type="button"
                onClick={() => onOpenSettings('students')}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold cursor-pointer"
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                  <th className="sticky left-0 z-20 bg-slate-50 dark:bg-slate-800 px-3 py-3 text-center font-semibold border-r border-slate-200 dark:border-slate-700 w-10">
                    ที่
                  </th>
                  <th className="sticky left-10 z-20 bg-slate-50 dark:bg-slate-800 px-3 py-3 text-left font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[92px]">
                    รหัส
                  </th>
                  <th className="sticky left-[132px] z-20 bg-slate-50 dark:bg-slate-800 px-3 py-3 text-left font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[170px]">
                    ชื่อ-นามสกุล
                  </th>

                  {roomWorksheets.map((asg, idx) => (
                    <th
                      key={asg.id}
                      className="px-3 py-2.5 text-center font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[165px] max-w-[220px] align-top"
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] font-bold text-indigo-700 dark:text-indigo-300 tabular-nums">
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
                      </div>
                    </th>
                  ))}

                  <th className="px-3 py-3 text-center font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[78px] bg-slate-100/80 dark:bg-slate-800">
                    ส่งแล้ว
                  </th>
                  <th className="px-3 py-3 text-right font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[96px] bg-indigo-50/70 dark:bg-indigo-950/30">
                    <div>รวมคะแนน</div>
                    <div className="text-[10px] font-normal text-slate-500 dark:text-slate-400 tabular-nums">
                      (เต็ม {roomKpis.totalPossiblePerStudent})
                    </div>
                  </th>
                  <th className="px-3 py-3 text-right font-semibold border-r border-slate-200 dark:border-slate-700 min-w-[72px] bg-indigo-50/70 dark:bg-indigo-950/30">
                    ร้อยละ
                  </th>
                  <th className="px-3 py-3 text-center font-semibold min-w-[68px] bg-indigo-50/70 dark:bg-indigo-950/30">
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
                    <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2.5 text-center text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-800 tabular-nums">
                      {rowIdx + 1}
                    </td>
                    <td className="sticky left-10 z-10 bg-white dark:bg-slate-900 px-3 py-2.5 font-mono text-slate-700 dark:text-slate-300 border-r border-slate-200 dark:border-slate-800 tabular-nums">
                      {row.student.code || '-'}
                    </td>
                    <td className="sticky left-[132px] z-10 bg-white dark:bg-slate-900 px-3 py-2.5 font-medium text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800">
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
                                  className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer print:hidden"
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
                    <td className="px-3 py-2.5 text-right font-bold border-r border-slate-200 dark:border-slate-800 text-indigo-700 dark:text-indigo-300 bg-indigo-50/40 dark:bg-indigo-950/20 tabular-nums">
                      {row.earnedSum} / {row.maxSum}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold border-r border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 bg-indigo-50/40 dark:bg-indigo-950/20 tabular-nums">
                      {row.percent.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2.5 text-center font-bold bg-indigo-50/40 dark:bg-indigo-950/20 tabular-nums">
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
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150"
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

            <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs space-y-1">
              <div className="font-bold text-indigo-700 dark:text-indigo-300">
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
                  className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 tabular-nums"
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
                  className="w-full px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
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
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
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
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
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
