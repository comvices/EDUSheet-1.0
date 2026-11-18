import React, { useState, useMemo, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Users,
  Plus,
  Edit3,
  Trash2,
  Search,
  Download,
  Copy,
  Check,
  ClipboardCheck,
  BookOpen,
  MapPin,
  BarChart3,
  LayoutGrid,
  List,
  Sparkles,
  UserCheck,
  X,
  Save,
  Coffee,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
import {
  AttendanceSession,
  AttendanceStatus,
  DayOfWeek,
  PeriodConfig,
  StudentAttendanceRecord,
  StudentProfile,
  TeacherProfile,
  TeachingSchedule,
  UserRole,
} from '../types';
import { DAYS_OF_WEEK_LIST, DEFAULT_PERIOD_CONFIGS } from '../data/mockData';
import { ScheduleFormModal } from './ScheduleFormModal';
import { PeriodSettingsModal } from './PeriodSettingsModal';
import { SaveConfirmModal } from './SaveConfirmModal';

interface AttendanceViewProps {
  role: UserRole;
  currentStudent: StudentProfile;
  currentTeacher: TeacherProfile;
  studentsRoster: StudentProfile[];
  teachersRoster: TeacherProfile[];
  subjectsList: string[];
  gradeLevelsList: string[];
  schedules: TeachingSchedule[];
  attendanceSessions: AttendanceSession[];
  periodConfigs?: PeriodConfig[];
  onSavePeriodConfigs?: (nextConfigs: PeriodConfig[]) => void;
  onSaveSchedule: (schedule: TeachingSchedule) => void;
  onDeleteSchedule: (scheduleId: string) => void;
  onSaveAttendanceSession: (session: AttendanceSession) => void;
  onDeleteAttendanceSession: (sessionId: string) => void;
  onOpenSettings?: (tab?: 'grades' | 'subjects' | 'students' | 'teachers') => void;
}

type TeacherSubTab = 'checkin' | 'schedule' | 'history';
type HistoryInnerTab = 'sessions' | 'student_stats';
type ScheduleViewMode = 'by_day' | 'weekly_grid';

const STATUS_META: Record<
  AttendanceStatus,
  {
    label: string;
    shortLabel: string;
    activeClass: string;
    badgeClass: string;
  }
> = {
  present: {
    label: 'มาเรียน',
    shortLabel: 'มา',
    activeClass:
      'bg-emerald-600 text-white border-emerald-600 shadow-xs ring-2 ring-emerald-500/20',
    badgeClass:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  },
  late: {
    label: 'มาสาย',
    shortLabel: 'สาย',
    activeClass:
      'bg-amber-500 text-white border-amber-500 shadow-xs ring-2 ring-amber-500/20',
    badgeClass:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  },
  leave: {
    label: 'ลา',
    shortLabel: 'ลา',
    activeClass:
      'bg-sky-600 text-white border-sky-600 shadow-xs ring-2 ring-sky-500/20',
    badgeClass:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800',
  },
  absent: {
    label: 'ขาดเรียน',
    shortLabel: 'ขาด',
    activeClass:
      'bg-rose-600 text-white border-rose-600 shadow-xs ring-2 ring-rose-500/20',
    badgeClass:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800',
  },
};

// Local YYYY-MM-DD helper
function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Convert YYYY-MM-DD to DayOfWeek (or null for Sat/Sun)
function getDayOfWeekFromDateString(dateStr: string): DayOfWeek | null {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return null;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  const jsDay = dt.getDay(); // 0=Sun, 1=Mon ... 6=Sat
  const found = DAYS_OF_WEEK_LIST.find((d) => d.jsDay === jsDay);
  return found ? found.id : null;
}

function formatThaiDate(dateStr: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3) return dateStr;
  const dt = new Date(parts[0], parts[1] - 1, parts[2]);
  return dt.toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

// Smart room matching between schedule gradeLevel and student gradeLevel
function getStudentsForRoom(
  studentsRoster: StudentProfile[],
  targetGradeLevel: string
): { students: StudentProfile[]; isBaseFallback: boolean } {
  if (!targetGradeLevel || targetGradeLevel === 'ทั้งหมด') {
    return { students: studentsRoster, isBaseFallback: false };
  }

  const normalizedTarget = targetGradeLevel.replace(' (ทุกห้อง)', '').trim();

  // Exact match
  const exact = studentsRoster.filter((s) => s.gradeLevel === targetGradeLevel);
  if (exact.length > 0) {
    return { students: exact, isBaseFallback: false };
  }

  // Whole-grade target (e.g. "ม.3" or "ม.3 (ทุกห้อง)")
  if (!targetGradeLevel.includes('/')) {
    const wholeGradeMatches = studentsRoster.filter(
      (s) =>
        s.gradeLevel === normalizedTarget ||
        s.gradeLevel.startsWith(`${normalizedTarget}/`)
    );
    return { students: wholeGradeMatches, isBaseFallback: false };
  }

  // Specific room (e.g. "ม.3/1") with no exact students -> fallback to base grade ("ม.3") if present
  const baseGrade = targetGradeLevel.split('/')[0];
  const baseMatches = studentsRoster.filter((s) => s.gradeLevel === baseGrade);
  if (baseMatches.length > 0) {
    return { students: baseMatches, isBaseFallback: true };
  }

  return { students: [], isBaseFallback: false };
}

function studentMatchesRoom(studentGrade: string, targetGrade: string): boolean {
  if (!targetGrade || targetGrade === 'ทั้งหมด') return true;
  if (studentGrade === targetGrade) return true;
  const baseStudent = studentGrade.includes('/') ? studentGrade.split('/')[0] : studentGrade;
  const normalizedTarget = targetGrade.replace(' (ทุกห้อง)', '').trim();
  if (normalizedTarget === baseStudent) return true;
  if (studentGrade === normalizedTarget) return true;
  return false;
}

export const AttendanceView: React.FC<AttendanceViewProps> = ({
  role,
  currentStudent,
  currentTeacher,
  studentsRoster,
  teachersRoster,
  subjectsList,
  gradeLevelsList,
  schedules,
  attendanceSessions,
  periodConfigs = DEFAULT_PERIOD_CONFIGS,
  onSavePeriodConfigs,
  onSaveSchedule,
  onDeleteSchedule,
  onSaveAttendanceSession,
  onDeleteAttendanceSession,
  onOpenSettings,
}) => {
  const activePeriods = useMemo(
    () => (periodConfigs && periodConfigs.length > 0 ? periodConfigs : DEFAULT_PERIOD_CONFIGS),
    [periodConfigs]
  );

  const getPeriodMeta = (periodNum: number) =>
    activePeriods.find((p) => p.period === periodNum);

  const getPeriodDisplayLabel = (periodNum: number, compact = false): string => {
    const matched = getPeriodMeta(periodNum);
    if (matched) {
      return compact ? matched.label.replace(/^คาบที่\s*/, 'คาบ ') : matched.label;
    }
    if (periodNum === 0) return 'พักเที่ยง';
    return compact ? `คาบ ${periodNum}` : `คาบที่ ${periodNum}`;
  };

  const isBreakPeriodNum = (periodNum: number): boolean => {
    const matched = getPeriodMeta(periodNum);
    return matched ? Boolean(matched.isBreak) : periodNum === 0;
  };

  const getPeriodRangeDisplayLabel = (
    periodNum: number,
    endPeriodNum?: number,
    compact = false
  ): string => {
    if (!endPeriodNum || endPeriodNum === periodNum) {
      return getPeriodDisplayLabel(periodNum, compact);
    }
    const startLbl = getPeriodDisplayLabel(periodNum, compact);
    const endLbl = getPeriodDisplayLabel(endPeriodNum, compact);
    const startMatch = startLbl.match(/^(คาบที่|คาบ)\s*(\d+)$/);
    const endMatch = endLbl.match(/^(คาบที่|คาบ)\s*(\d+)$/);
    if (startMatch && endMatch) {
      return `${startMatch[1]} ${startMatch[2]}–${endMatch[2]}`;
    }
    return `${startLbl} – ${endLbl}`;
  };

  const getPeriodSpanCount = (periodNum: number, endPeriodNum?: number): number => {
    if (!endPeriodNum || endPeriodNum === periodNum) return 1;
    const i1 = activePeriods.findIndex((p) => p.period === periodNum);
    const i2 = activePeriods.findIndex((p) => p.period === endPeriodNum);
    if (i1 >= 0 && i2 >= i1) {
      const nonBreakCount = activePeriods.slice(i1, i2 + 1).filter((p) => !p.isBreak).length;
      return Math.max(1, nonBreakCount || i2 - i1 + 1);
    }
    if (endPeriodNum > periodNum) return endPeriodNum - periodNum + 1;
    return 2;
  };

  const areSchedulesConsecutive = (
    prevEndPeriod: number,
    prevEndTime: string,
    nextStartPeriod: number,
    nextStartTime: string
  ): boolean => {
    if (isBreakPeriodNum(prevEndPeriod) || isBreakPeriodNum(nextStartPeriod)) {
      return false;
    }
    const idxPrev = activePeriods.findIndex((p) => p.period === prevEndPeriod);
    const idxNext = activePeriods.findIndex((p) => p.period === nextStartPeriod);
    if (idxPrev >= 0 && idxNext >= 0) {
      if (idxNext <= idxPrev) return false;
      const hasBreakBetween = activePeriods
        .slice(idxPrev + 1, idxNext)
        .some((p) => p.isBreak);
      if (hasBreakBetween) return false;
      return idxNext === idxPrev + 1;
    }
    return prevEndTime === nextStartTime || nextStartPeriod === prevEndPeriod + 1;
  };

  const sortSchedulesChronologically = (
    a: { period: number; startTime?: string },
    b: { period: number; startTime?: string }
  ): number => {
    const idxA = activePeriods.findIndex((p) => p.period === a.period);
    const idxB = activePeriods.findIndex((p) => p.period === b.period);
    if (idxA >= 0 && idxB >= 0 && idxA !== idxB) {
      return idxA - idxB;
    }
    if ((a.startTime || '') !== (b.startTime || '')) {
      return (a.startTime || '').localeCompare(b.startTime || '');
    }
    return a.period - b.period;
  };

  const defaultTeachingPeriod =
    activePeriods.find((p) => !p.isBreak)?.period ?? activePeriods[0]?.period ?? 1;

  // Navigation states
  const [subTab, setSubTab] = useState<TeacherSubTab>('checkin');
  const [historyInnerTab, setHistoryInnerTab] = useState<HistoryInnerTab>('sessions');
  const [scheduleViewMode, setScheduleViewMode] = useState<ScheduleViewMode>('by_day');

  // Daily Check-in states
  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateString());
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>(
    currentTeacher.id
  );

  // Active check-in sheet draft state
  const [activeSheet, setActiveSheet] = useState<{
    sessionId: string;
    scheduleId?: string;
    coveredScheduleIds?: string[];
    date: string;
    dayOfWeek: DayOfWeek;
    period: number;
    endPeriod?: number;
    startTime: string;
    endTime: string;
    subject: string;
    gradeLevel: string;
    teacherId: string;
    teacherCode: string;
    teacherName: string;
    topicTaught: string;
    records: StudentAttendanceRecord[];
    isBaseFallback?: boolean;
  } | null>(null);
  const [studentSearch, setStudentSearch] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);

  // Ad-hoc (Extra / Substitute) check-in modal
  const [isAdhocModalOpen, setIsAdhocModalOpen] = useState(false);
  const [adhocSubject, setAdhocSubject] = useState<string>(
    subjectsList.filter((s) => s !== 'ทั้งหมด')[0] || ''
  );
  const [adhocGrade, setAdhocGrade] = useState<string>(
    gradeLevelsList.filter((g) => g !== 'ทั้งหมด')[0] || ''
  );
  const [adhocPeriod, setAdhocPeriod] = useState<number>(defaultTeachingPeriod);
  const [adhocEndPeriod, setAdhocEndPeriod] = useState<number>(defaultTeachingPeriod);
  const [adhocTeacherId, setAdhocTeacherId] = useState<string>(currentTeacher.id);

  // Schedule & Period Management states
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isPeriodSettingsOpen, setIsPeriodSettingsOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<TeachingSchedule | null>(null);
  const [scheduleTeacherFilter, setScheduleTeacherFilter] = useState<string>(
    currentTeacher.id
  );
  const [scheduleGradeFilter, setScheduleGradeFilter] = useState<string>('ทั้งหมด');
  const [scheduleSubjectFilter, setScheduleSubjectFilter] = useState<string>('ทั้งหมด');

  // History & Stats filters
  const [historyTeacherFilter, setHistoryTeacherFilter] = useState<string>('all');
  const [historySubjectFilter, setHistorySubjectFilter] = useState<string>('ทั้งหมด');
  const [historyGradeFilter, setHistoryGradeFilter] = useState<string>('ทั้งหมด');
  const [historySearch, setHistorySearch] = useState<string>('');

  // Custom Delete & Save Confirmation Modal States
  const [deleteScheduleConfirm, setDeleteScheduleConfirm] = useState<TeachingSchedule | null>(null);
  const [deleteSessionConfirm, setDeleteSessionConfirm] = useState<AttendanceSession | null>(null);
  const [isSaveSheetConfirmOpen, setIsSaveSheetConfirmOpen] = useState(false);

  // Sync teacher default filter when logged-in teacher changes
  useEffect(() => {
    setSelectedTeacherFilter(currentTeacher.id);
    setScheduleTeacherFilter(currentTeacher.id);
    setAdhocTeacherId(currentTeacher.id);
  }, [currentTeacher.id]);

  const currentDayOfWeek = useMemo(
    () => getDayOfWeekFromDateString(selectedDate),
    [selectedDate]
  );

  const currentDayMeta = useMemo(
    () => DAYS_OF_WEEK_LIST.find((d) => d.id === currentDayOfWeek) || null,
    [currentDayOfWeek]
  );

  // KPI Metrics for Teacher header
  const kpiStats = useMemo(() => {
    const today = getTodayDateString();
    const mySchedules = schedules.filter((s) => s.teacherId === currentTeacher.id);
    const todaySessions = attendanceSessions.filter((s) => s.date === today);

    let totalRecs = 0;
    let presentLikeRecs = 0;
    for (const sess of attendanceSessions) {
      for (const r of sess.records) {
        totalRecs += 1;
        if (r.status === 'present' || r.status === 'late') {
          presentLikeRecs += 1;
        }
      }
    }
    const avgRate = totalRecs > 0 ? Math.round((presentLikeRecs / totalRecs) * 100) : 100;

    return {
      myScheduleCount: mySchedules.length,
      allScheduleCount: schedules.length,
      todayCheckedCount: todaySessions.length,
      totalSessionsCount: attendanceSessions.length,
      avgRate,
    };
  }, [schedules, attendanceSessions, currentTeacher.id]);

  // Scheduled periods for selected date & teacher
  const dailyScheduledPeriods = useMemo(() => {
    if (!currentDayOfWeek) return [];
    return schedules
      .filter((sch) => {
        if (sch.dayOfWeek !== currentDayOfWeek) return false;
        if (
          selectedTeacherFilter !== 'all' &&
          sch.teacherId !== selectedTeacherFilter
        ) {
          return false;
        }
        return true;
      })
      .sort(sortSchedulesChronologically);
  }, [schedules, currentDayOfWeek, selectedTeacherFilter, activePeriods]);

  // Group consecutive periods of the same teacher + subject + gradeLevel into ONE check-in block
  const dailyScheduleBlocks = useMemo(() => {
    interface DailyBlock {
      id: string;
      primary: TeachingSchedule;
      schedules: TeachingSchedule[];
      period: number;
      endPeriod: number;
      startTime: string;
      endTime: string;
      periodCount: number;
    }

    const blocks: DailyBlock[] = [];
    for (const sch of dailyScheduledPeriods) {
      const schEndPeriod =
        sch.endPeriod && sch.endPeriod !== sch.period ? sch.endPeriod : sch.period;
      const lastBlock = blocks[blocks.length - 1];

      if (
        lastBlock &&
        lastBlock.primary.teacherId === sch.teacherId &&
        lastBlock.primary.subject.trim() === sch.subject.trim() &&
        lastBlock.primary.gradeLevel.trim() === sch.gradeLevel.trim() &&
        areSchedulesConsecutive(
          lastBlock.endPeriod,
          lastBlock.endTime,
          sch.period,
          sch.startTime
        )
      ) {
        lastBlock.schedules.push(sch);
        lastBlock.endPeriod = schEndPeriod;
        lastBlock.endTime = sch.endTime;
        lastBlock.periodCount = getPeriodSpanCount(lastBlock.period, lastBlock.endPeriod);
      } else {
        blocks.push({
          id: sch.id,
          primary: sch,
          schedules: [sch],
          period: sch.period,
          endPeriod: schEndPeriod,
          startTime: sch.startTime,
          endTime: sch.endTime,
          periodCount: getPeriodSpanCount(sch.period, schEndPeriod),
        });
      }
    }
    return blocks;
  }, [dailyScheduledPeriods, activePeriods]);

  const periodRangesOverlap = (
    p1Start: number,
    p1End: number | undefined,
    p2Start: number,
    p2End: number | undefined
  ): boolean => {
    const toIndices = (a: number, b?: number): [number, number] => {
      const i1 = activePeriods.findIndex((p) => p.period === a);
      const i2 = activePeriods.findIndex((p) => p.period === (b ?? a));
      if (i1 >= 0 && i2 >= i1) return [i1, i2];
      if (i1 >= 0) return [i1, i1];
      return [a, b ?? a];
    };
    const [s1, e1] = toIndices(p1Start, p1End);
    const [s2, e2] = toIndices(p2Start, p2End);
    return s1 <= e2 && s2 <= e1;
  };

  // Helper to find saved session for a schedule block on selectedDate
  const findSessionForBlock = (
    block: {
      primary: TeachingSchedule;
      schedules: TeachingSchedule[];
      period: number;
      endPeriod: number;
    },
    date: string
  ) => {
    const coveredIds = new Set(block.schedules.map((s) => s.id));
    return attendanceSessions.find(
      (s) =>
        s.date === date &&
        ((s.scheduleId && coveredIds.has(s.scheduleId)) ||
          (s.teacherId === block.primary.teacherId &&
            s.subject === block.primary.subject &&
            s.gradeLevel === block.primary.gradeLevel &&
            periodRangesOverlap(s.period, s.endPeriod, block.period, block.endPeriod)))
    );
  };

  // Open Check-in Sheet from a merged consecutive block
  const handleOpenCheckinForBlock = (
    block: {
      primary: TeachingSchedule;
      schedules: TeachingSchedule[];
      period: number;
      endPeriod: number;
      startTime: string;
      endTime: string;
    },
    targetDate: string = selectedDate
  ) => {
    const dayOfWk = getDayOfWeekFromDateString(targetDate) || block.primary.dayOfWeek;
    const existing = findSessionForBlock(block, targetDate);
    const coveredScheduleIds = block.schedules.map((s) => s.id);
    const resolvedEndPeriod =
      block.endPeriod !== block.period ? block.endPeriod : undefined;

    if (existing) {
      const { students: roomStudents, isBaseFallback } = getStudentsForRoom(
        studentsRoster,
        block.primary.gradeLevel
      );
      const existingMap = new Map(
        existing.records.map((r) => [r.studentCode || r.studentId, r])
      );
      const mergedRecords: StudentAttendanceRecord[] = [...existing.records];

      for (const st of roomStudents) {
        if (!existingMap.has(st.code) && !existingMap.has(st.id)) {
          mergedRecords.push({
            studentId: st.id,
            studentCode: st.code,
            studentName: st.name,
            gradeLevel: st.gradeLevel,
            status: 'present',
          });
        }
      }

      setActiveSheet({
        sessionId: existing.id,
        scheduleId: existing.scheduleId || block.primary.id,
        coveredScheduleIds,
        date: targetDate,
        dayOfWeek: dayOfWk,
        period: block.period,
        ...(resolvedEndPeriod !== undefined ? { endPeriod: resolvedEndPeriod } : {}),
        startTime: block.startTime,
        endTime: block.endTime,
        subject: block.primary.subject,
        gradeLevel: block.primary.gradeLevel,
        teacherId: block.primary.teacherId,
        teacherCode: block.primary.teacherCode,
        teacherName: block.primary.teacherName,
        topicTaught: existing.topicTaught || '',
        records: mergedRecords,
        isBaseFallback,
      });
    } else {
      const { students: roomStudents, isBaseFallback } = getStudentsForRoom(
        studentsRoster,
        block.primary.gradeLevel
      );
      const initialRecords: StudentAttendanceRecord[] = roomStudents.map((st) => ({
        studentId: st.id,
        studentCode: st.code,
        studentName: st.name,
        gradeLevel: st.gradeLevel,
        status: 'present',
      }));

      setActiveSheet({
        sessionId: `att_${targetDate.replace(/-/g, '')}_${block.primary.id}`,
        scheduleId: block.primary.id,
        coveredScheduleIds,
        date: targetDate,
        dayOfWeek: dayOfWk,
        period: block.period,
        ...(resolvedEndPeriod !== undefined ? { endPeriod: resolvedEndPeriod } : {}),
        startTime: block.startTime,
        endTime: block.endTime,
        subject: block.primary.subject,
        gradeLevel: block.primary.gradeLevel,
        teacherId: block.primary.teacherId,
        teacherCode: block.primary.teacherCode,
        teacherName: block.primary.teacherName,
        topicTaught: '',
        records: initialRecords,
        isBaseFallback,
      });
    }
    setStudentSearch('');
    setCopiedReport(false);
  };

  // Open Check-in Sheet from a TeachingSchedule (merges with matching block if consecutive)
  const handleOpenCheckinForSchedule = (
    schedule: TeachingSchedule,
    targetDate: string = selectedDate
  ) => {
    const matchedBlock = dailyScheduleBlocks.find((b) =>
      b.schedules.some((s) => s.id === schedule.id)
    );
    if (matchedBlock) {
      handleOpenCheckinForBlock(matchedBlock, targetDate);
      return;
    }

    handleOpenCheckinForBlock(
      {
        primary: schedule,
        schedules: [schedule],
        period: schedule.period,
        endPeriod:
          schedule.endPeriod && schedule.endPeriod !== schedule.period
            ? schedule.endPeriod
            : schedule.period,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      },
      targetDate
    );
  };

  // Open Check-in Sheet from an existing AttendanceSession (e.g. from History)
  const handleEditExistingSession = (session: AttendanceSession) => {
    setSelectedDate(session.date);
    setSubTab('checkin');
    setActiveSheet({
      sessionId: session.id,
      scheduleId: session.scheduleId,
      date: session.date,
      dayOfWeek: session.dayOfWeek,
      period: session.period,
      ...(session.endPeriod && session.endPeriod !== session.period
        ? { endPeriod: session.endPeriod }
        : {}),
      startTime: session.startTime || '08:30',
      endTime: session.endTime || '09:20',
      subject: session.subject,
      gradeLevel: session.gradeLevel,
      teacherId: session.teacherId,
      teacherCode: session.teacherCode,
      teacherName: session.teacherName,
      topicTaught: session.topicTaught || '',
      records: [...session.records],
    });
    setStudentSearch('');
    setCopiedReport(false);
  };

  // Create ad-hoc check-in sheet
  const handleStartAdhocCheckin = (e: React.FormEvent) => {
    e.preventDefault();
    const tch =
      teachersRoster.find((t) => t.id === adhocTeacherId) || currentTeacher;
    const startPreset =
      activePeriods.find((p) => p.period === adhocPeriod) || activePeriods[0];
    const endPreset =
      activePeriods.find((p) => p.period === adhocEndPeriod) || startPreset;
    const dayOfWk = getDayOfWeekFromDateString(selectedDate) || 'monday';
    const { students: roomStudents, isBaseFallback } = getStudentsForRoom(
      studentsRoster,
      adhocGrade
    );

    const initialRecords: StudentAttendanceRecord[] = roomStudents.map((st) => ({
      studentId: st.id,
      studentCode: st.code,
      studentName: st.name,
      gradeLevel: st.gradeLevel,
      status: 'present',
    }));

    setActiveSheet({
      sessionId: `att_${selectedDate.replace(/-/g, '')}_adhoc_${Date.now()}`,
      date: selectedDate,
      dayOfWeek: dayOfWk,
      period: adhocPeriod,
      ...(adhocEndPeriod !== adhocPeriod ? { endPeriod: adhocEndPeriod } : {}),
      startTime: startPreset.startTime,
      endTime: endPreset.endTime,
      subject: adhocSubject,
      gradeLevel: adhocGrade,
      teacherId: tch.id,
      teacherCode: tch.code,
      teacherName: tch.name,
      topicTaught: '',
      records: initialRecords,
      isBaseFallback,
    });
    setIsAdhocModalOpen(false);
    setStudentSearch('');
  };

  // Update individual student status in activeSheet
  const handleUpdateStudentStatus = (
    studentCode: string,
    status: AttendanceStatus
  ) => {
    if (!activeSheet) return;
    setActiveSheet({
      ...activeSheet,
      records: activeSheet.records.map((r) =>
        r.studentCode === studentCode ? { ...r, status } : r
      ),
    });
  };

  const handleUpdateStudentNote = (studentCode: string, note: string) => {
    if (!activeSheet) return;
    setActiveSheet({
      ...activeSheet,
      records: activeSheet.records.map((r) =>
        r.studentCode === studentCode ? { ...r, note } : r
      ),
    });
  };

  const handleMarkAllStatus = (status: AttendanceStatus) => {
    if (!activeSheet) return;
    setActiveSheet({
      ...activeSheet,
      records: activeSheet.records.map((r) => ({ ...r, status })),
    });
  };

  const handleAddExtraStudentToSheet = (studentId: string) => {
    if (!activeSheet || !studentId) return;
    const found = studentsRoster.find((s) => s.id === studentId);
    if (!found) return;
    if (activeSheet.records.some((r) => r.studentCode === found.code)) return;
    setActiveSheet({
      ...activeSheet,
      records: [
        ...activeSheet.records,
        {
          studentId: found.id,
          studentCode: found.code,
          studentName: found.name,
          gradeLevel: found.gradeLevel,
          status: 'present',
        },
      ],
    });
  };

  const handleSaveActiveSheet = () => {
    if (!activeSheet) return;
    const sessionToSave: AttendanceSession = {
      id: activeSheet.sessionId,
      ...(activeSheet.scheduleId ? { scheduleId: activeSheet.scheduleId } : {}),
      date: activeSheet.date,
      dayOfWeek: activeSheet.dayOfWeek,
      period: activeSheet.period,
      ...(activeSheet.endPeriod && activeSheet.endPeriod !== activeSheet.period
        ? { endPeriod: activeSheet.endPeriod }
        : {}),
      startTime: activeSheet.startTime,
      endTime: activeSheet.endTime,
      subject: activeSheet.subject,
      gradeLevel: activeSheet.gradeLevel,
      teacherId: activeSheet.teacherId,
      teacherCode: activeSheet.teacherCode,
      teacherName: activeSheet.teacherName,
      ...(activeSheet.topicTaught.trim()
        ? { topicTaught: activeSheet.topicTaught.trim() }
        : {}),
      records: activeSheet.records.map((r) => ({
        studentId: r.studentId,
        studentCode: r.studentCode,
        studentName: r.studentName,
        gradeLevel: r.gradeLevel,
        status: r.status,
        ...(r.note && r.note.trim() ? { note: r.note.trim() } : {}),
      })),
      updatedAt: new Date().toISOString(),
    };
    onSaveAttendanceSession(sessionToSave);
  };

  // Sheet counters
  const sheetCounts = useMemo(() => {
    if (!activeSheet) {
      return { total: 0, present: 0, late: 0, leave: 0, absent: 0 };
    }
    return {
      total: activeSheet.records.length,
      present: activeSheet.records.filter((r) => r.status === 'present').length,
      late: activeSheet.records.filter((r) => r.status === 'late').length,
      leave: activeSheet.records.filter((r) => r.status === 'leave').length,
      absent: activeSheet.records.filter((r) => r.status === 'absent').length,
    };
  }, [activeSheet]);

  const filteredSheetRecords = useMemo(() => {
    if (!activeSheet) return [];
    if (!studentSearch.trim()) return activeSheet.records;
    const q = studentSearch.toLowerCase();
    return activeSheet.records.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.studentCode.toLowerCase().includes(q)
    );
  }, [activeSheet, studentSearch]);

  const handleCopyLineSummary = async () => {
    if (!activeSheet) return;
    const absentList = activeSheet.records.filter((r) => r.status === 'absent');
    const leaveList = activeSheet.records.filter((r) => r.status === 'leave');
    const lateList = activeSheet.records.filter((r) => r.status === 'late');

    const lines = [
      `📋 รายงานการเช็คชื่อเข้าเรียน`,
      `📅 ${formatThaiDate(activeSheet.date)} (${getPeriodRangeDisplayLabel(activeSheet.period, activeSheet.endPeriod)} | ${activeSheet.startTime}-${activeSheet.endTime})`,
      `📚 วิชา: ${activeSheet.subject} | ชั้น ${activeSheet.gradeLevel}`,
      `👩‍🏫 ผู้สอน: ${activeSheet.teacherName}`,
      ...(activeSheet.topicTaught.trim()
        ? [`📝 หัวข้อที่สอน: ${activeSheet.topicTaught.trim()}`]
        : []),
      `------------------`,
      `👥 นักเรียนทั้งหมด: ${sheetCounts.total} คน`,
      `✅ มาเรียน: ${sheetCounts.present} คน`,
      `⏰ มาสาย: ${sheetCounts.late} คน`,
      `📩 ลา: ${sheetCounts.leave} คน`,
      `❌ ขาดเรียน: ${sheetCounts.absent} คน`,
    ];

    if (absentList.length > 0) {
      lines.push(`\n❌ รายชื่อนักเรียนที่ขาดเรียน:`);
      absentList.forEach((r, idx) => {
        lines.push(`${idx + 1}. ${r.studentName} (${r.studentCode})${r.note ? ` - ${r.note}` : ''}`);
      });
    }
    if (leaveList.length > 0) {
      lines.push(`\n📩 รายชื่อนักเรียนที่ลา:`);
      leaveList.forEach((r, idx) => {
        lines.push(`${idx + 1}. ${r.studentName} (${r.studentCode})${r.note ? ` - ${r.note}` : ''}`);
      });
    }
    if (lateList.length > 0) {
      lines.push(`\n⏰ รายชื่อนักเรียนที่มาสาย:`);
      lateList.forEach((r, idx) => {
        lines.push(`${idx + 1}. ${r.studentName} (${r.studentCode})${r.note ? ` - ${r.note}` : ''}`);
      });
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 3000);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
    }
  };

  const handleExportSessionExcel = (session: {
    date: string;
    period: number;
    endPeriod?: number;
    subject: string;
    gradeLevel: string;
    teacherName: string;
    topicTaught?: string;
    records: StudentAttendanceRecord[];
  }) => {
    const periodText = getPeriodRangeDisplayLabel(session.period, session.endPeriod);
    const rows = session.records.map((r, idx) => ({
      ลำดับ: idx + 1,
      รหัสนักเรียน: r.studentCode,
      ชื่อนามสกุล: r.studentName,
      ชั้นเรียน: r.gradeLevel,
      สถานะ: STATUS_META[r.status].label,
      หมายเหตุ: r.note || '-',
      วันที่: session.date,
      คาบที่: periodText,
      วิชา: session.subject,
      ครูผู้สอน: session.teacherName,
      หัวข้อที่สอน: session.topicTaught || '-',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    const safeSubject = session.subject.replace(/[\\/:*?"<>|]/g, '_');
    const safeGrade = session.gradeLevel.replace(/[\\/:*?"<>|]/g, '_');
    const periodSlug =
      session.period === 0
        ? 'พักเที่ยง'
        : session.endPeriod && session.endPeriod !== session.period
        ? `คาบ${session.period}-${session.endPeriod}`
        : `คาบ${session.period}`;
    XLSX.writeFile(
      wb,
      `เช็คชื่อ_${safeSubject}_${safeGrade}_${session.date}_${periodSlug}.xlsx`
    );
  };

  // Schedule Management filtered schedules
  const filteredSchedules = useMemo(() => {
    return schedules.filter((sch) => {
      if (
        scheduleTeacherFilter !== 'all' &&
        sch.teacherId !== scheduleTeacherFilter
      ) {
        return false;
      }
      if (
        scheduleGradeFilter !== 'ทั้งหมด' &&
        sch.gradeLevel !== scheduleGradeFilter
      ) {
        return false;
      }
      if (
        scheduleSubjectFilter !== 'ทั้งหมด' &&
        sch.subject !== scheduleSubjectFilter
      ) {
        return false;
      }
      return true;
    });
  }, [schedules, scheduleTeacherFilter, scheduleGradeFilter, scheduleSubjectFilter]);

  // History filtered sessions
  const filteredHistorySessions = useMemo(() => {
    return attendanceSessions.filter((sess) => {
      if (
        historyTeacherFilter !== 'all' &&
        sess.teacherId !== historyTeacherFilter
      ) {
        return false;
      }
      if (
        historySubjectFilter !== 'ทั้งหมด' &&
        sess.subject !== historySubjectFilter
      ) {
        return false;
      }
      if (
        historyGradeFilter !== 'ทั้งหมด' &&
        sess.gradeLevel !== historyGradeFilter
      ) {
        return false;
      }
      if (historySearch.trim()) {
        const q = historySearch.toLowerCase();
        const matchTopic = (sess.topicTaught || '').toLowerCase().includes(q);
        const matchSubject = sess.subject.toLowerCase().includes(q);
        const matchGrade = sess.gradeLevel.toLowerCase().includes(q);
        const matchStudent = sess.records.some(
          (r) =>
            r.studentName.toLowerCase().includes(q) ||
            r.studentCode.toLowerCase().includes(q)
        );
        if (!matchTopic && !matchSubject && !matchGrade && !matchStudent) {
          return false;
        }
      }
      return true;
    });
  }, [
    attendanceSessions,
    historyTeacherFilter,
    historySubjectFilter,
    historyGradeFilter,
    historySearch,
  ]);

  // Aggregate per-student attendance stats from filteredHistorySessions
  const studentAggregateStats = useMemo(() => {
    const map = new Map<
      string,
      {
        studentCode: string;
        studentName: string;
        gradeLevel: string;
        total: number;
        present: number;
        late: number;
        leave: number;
        absent: number;
      }
    >();

    for (const sess of filteredHistorySessions) {
      for (const rec of sess.records) {
        const key = rec.studentCode || rec.studentId;
        const curr = map.get(key) || {
          studentCode: rec.studentCode,
          studentName: rec.studentName,
          gradeLevel: rec.gradeLevel,
          total: 0,
          present: 0,
          late: 0,
          leave: 0,
          absent: 0,
        };
        curr.total += 1;
        curr[rec.status] += 1;
        map.set(key, curr);
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      a.studentCode.localeCompare(b.studentCode)
    );
  }, [filteredHistorySessions]);

  const handleExportAllHistoryExcel = () => {
    const rows: Record<string, any>[] = [];
    filteredHistorySessions.forEach((sess) => {
      sess.records.forEach((rec) => {
        rows.push({
          วันที่: sess.date,
          คาบที่: getPeriodRangeDisplayLabel(sess.period, sess.endPeriod),
          เวลา: `${sess.startTime || ''}-${sess.endTime || ''}`,
          รายวิชา: sess.subject,
          ชั้นเรียน: sess.gradeLevel,
          ครูผู้สอน: sess.teacherName,
          หัวข้อที่สอน: sess.topicTaught || '-',
          รหัสนักเรียน: rec.studentCode,
          ชื่อนักเรียน: rec.studentName,
          สถานะ: STATUS_META[rec.status].label,
          หมายเหตุ: rec.note || '-',
        });
      });
    });

    if (rows.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AttendanceHistory');
    XLSX.writeFile(wb, `รายงานการเข้าเรียนทั้งหมด_${getTodayDateString()}.xlsx`);
  };

  // ============================================================================
  // STUDENT VIEW (Read-Only Timetable & Personal Attendance History)
  // ============================================================================
  const studentSchedules = useMemo(() => {
    return schedules.filter((sch) =>
      studentMatchesRoom(currentStudent.gradeLevel, sch.gradeLevel)
    );
  }, [schedules, currentStudent.gradeLevel]);

  const studentAttendanceHistory = useMemo(() => {
    const items: {
      session: AttendanceSession;
      record: StudentAttendanceRecord;
    }[] = [];

    for (const sess of attendanceSessions) {
      const rec = sess.records.find(
        (r) =>
          r.studentCode === currentStudent.code ||
          r.studentId === currentStudent.id
      );
      if (rec) {
        items.push({ session: sess, record: rec });
      }
    }
    return items;
  }, [attendanceSessions, currentStudent]);

  const studentSummary = useMemo(() => {
    const total = studentAttendanceHistory.length;
    const present = studentAttendanceHistory.filter((i) => i.record.status === 'present').length;
    const late = studentAttendanceHistory.filter((i) => i.record.status === 'late').length;
    const leave = studentAttendanceHistory.filter((i) => i.record.status === 'leave').length;
    const absent = studentAttendanceHistory.filter((i) => i.record.status === 'absent').length;
    const rate = total > 0 ? Math.round(((present + late) / total) * 100) : 100;
    return { total, present, late, leave, absent, rate };
  }, [studentAttendanceHistory]);

  if (role === 'student') {
    return (
      <div className="space-y-6 animate-in fade-in duration-300">
        {/* Student Hero Header */}
        <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="inline-flex items-center gap-1.5 text-xs font-bold bg-white/15 px-3 py-1 rounded-lg">
                <ClipboardCheck className="w-4 h-4 text-emerald-300" />
                <span>ตารางเรียนและสถิติการเข้าเรียนของฉัน</span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-prompt">
                {currentStudent.name} ({currentStudent.code})
              </h1>
              <p className="text-xs sm:text-sm text-indigo-100">
                ระดับชั้น / ห้องเรียน: <strong>{currentStudent.gradeLevel}</strong>
              </p>
            </div>

            <div className="grid grid-cols-5 gap-2 text-center bg-white/10 backdrop-blur-xs rounded-2xl p-3 border border-white/15">
              <div>
                <span className="block text-[10px] text-indigo-100">อัตราเข้าเรียน</span>
                <span className="text-lg font-bold font-prompt text-emerald-300">
                  {studentSummary.rate}%
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-indigo-100">มาเรียน</span>
                <span className="text-lg font-bold font-prompt">{studentSummary.present}</span>
              </div>
              <div>
                <span className="block text-[10px] text-indigo-100">มาสาย</span>
                <span className="text-lg font-bold font-prompt text-amber-300">
                  {studentSummary.late}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-indigo-100">ลา</span>
                <span className="text-lg font-bold font-prompt text-sky-300">
                  {studentSummary.leave}
                </span>
              </div>
              <div>
                <span className="block text-[10px] text-indigo-100">ขาด</span>
                <span className="text-lg font-bold font-prompt text-rose-300">
                  {studentSummary.absent}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Student Timetable */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold font-prompt text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-indigo-600" />
              <span>ตารางเรียนประจำสัปดาห์ ({currentStudent.gradeLevel})</span>
            </h2>
            <span className="text-xs text-slate-500">
              ทั้งหมด {studentSchedules.length} คาบ/สัปดาห์
            </span>
          </div>

          {studentSchedules.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              ยังไม่มีตารางสอนสำหรับระดับชั้น {currentStudent.gradeLevel} ในระบบ
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {DAYS_OF_WEEK_LIST.map((day) => {
                const dayItems = studentSchedules
                  .filter((s) => s.dayOfWeek === day.id)
                  .sort(sortSchedulesChronologically);

                return (
                  <div
                    key={day.id}
                    className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/70 p-3 space-y-2.5"
                  >
                    <div
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg border text-center ${day.badgeClass}`}
                    >
                      {day.label}
                    </div>
                    {dayItems.length === 0 ? (
                      <p className="text-[11px] text-slate-400 text-center py-4">
                        ไม่มีคาบในระบบ
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {dayItems.map((item) => (
                          <div
                            key={item.id}
                            className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 text-xs space-y-1 shadow-2xs"
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span
                                className={`font-bold ${
                                  isBreakPeriodNum(item.period)
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-indigo-600 dark:text-indigo-400'
                                }`}
                              >
                                {getPeriodRangeDisplayLabel(item.period, item.endPeriod, true)}
                              </span>
                              <span className="text-slate-400 font-mono">
                                {item.startTime}-{item.endTime}
                              </span>
                            </div>
                            <p className="font-bold text-slate-800 dark:text-slate-100">
                              {item.subject}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">
                              {item.teacherName}
                            </p>
                            {item.classroom && (
                              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {item.classroom}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Student Attendance History */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          <h2 className="text-base font-bold font-prompt text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-emerald-600" />
            <span>ประวัติการเช็คชื่อเข้าเรียนของฉัน ({studentAttendanceHistory.length} ครั้ง)</span>
          </h2>

          {studentAttendanceHistory.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              ยังไม่มีบันทึกการเช็คชื่อในชั้นเรียนของคุณ
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {studentAttendanceHistory.map(({ session, record }) => (
                <div
                  key={session.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatThaiDate(session.date)}
                      </span>
                      <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                        {getPeriodRangeDisplayLabel(session.period, session.endPeriod)}
                      </span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">
                        วิชา {session.subject}
                      </span>
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                      ผู้สอน: {session.teacherName}
                      {session.topicTaught ? ` · หัวข้อ: ${session.topicTaught}` : ''}
                    </p>
                    {record.note && (
                      <p className="text-amber-600 dark:text-amber-400 text-[11px]">
                        หมายเหตุ: {record.note}
                      </p>
                    )}
                  </div>
                  <span
                    className={`self-start sm:self-center px-3 py-1 rounded-lg text-xs font-bold border ${
                      STATUS_META[record.status].badgeClass
                    }`}
                  >
                    {STATUS_META[record.status].label}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // TEACHER VIEW (Full Schedule & Attendance Management)
  // ============================================================================
  const nonAllSubjects = subjectsList.filter((s) => s !== 'ทั้งหมด');
  const nonAllGrades = gradeLevelsList.filter((g) => g !== 'ทั้งหมด');

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Banner & KPI Summary */}
      <div className="bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 dark:from-slate-900 dark:via-indigo-950/90 dark:to-slate-950 rounded-2xl p-5 sm:p-6 text-white shadow-lg border border-indigo-500/20">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold bg-indigo-500/20 text-indigo-200 px-3 py-1 rounded-lg border border-indigo-400/20">
              <ClipboardCheck className="w-4 h-4 text-emerald-400" />
              <span>ระบบเช็คชื่อในชั้นเรียนอ้างอิงตามตารางสอน</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-prompt">
              บริหารตารางสอน & เช็คชื่อนักเรียนรายคาบ
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
              เช็คชื่อนักเรียนตามคาบสอนประจำวันของครู พร้อมจัดการตารางสอนรายสัปดาห์ บันทึกหัวข้อที่สอน ส่งสรุปรายงาน LINE และส่งออก Excel ได้ทันที
            </p>
          </div>

          {/* KPI Stat Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <span className="text-[11px] text-slate-300 block">คาบสอนของฉัน</span>
              <span className="text-xl font-bold font-prompt text-white">
                {kpiStats.myScheduleCount}{' '}
                <span className="text-xs font-normal text-slate-300">คาบ/สัปดาห์</span>
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <span className="text-[11px] text-slate-300 block">เช็คชื่อวันนี้แล้ว</span>
              <span className="text-xl font-bold font-prompt text-emerald-400">
                {kpiStats.todayCheckedCount}{' '}
                <span className="text-xs font-normal text-slate-300">คาบ</span>
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <span className="text-[11px] text-slate-300 block">บันทึกสะสม</span>
              <span className="text-xl font-bold font-prompt text-sky-300">
                {kpiStats.totalSessionsCount}{' '}
                <span className="text-xs font-normal text-slate-300">ครั้ง</span>
              </span>
            </div>
            <div className="bg-white/10 backdrop-blur-xs rounded-xl p-3 border border-white/10">
              <span className="text-[11px] text-slate-300 block">อัตราเข้าเรียนเฉลี่ย</span>
              <span className="text-xl font-bold font-prompt text-amber-300">
                {kpiStats.avgRate}%
              </span>
            </div>
          </div>
        </div>

        {/* Teacher Sub-Tabs Navigation */}
        <div className="flex flex-wrap items-center gap-2 mt-5 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={() => setSubTab('checkin')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'checkin'
                ? 'bg-white text-indigo-700 shadow-md'
                : 'bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>1. เช็คชื่อตามตารางสอนวันนี้</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('schedule')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'schedule'
                ? 'bg-white text-indigo-700 shadow-md'
                : 'bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
          >
            <CalendarClock className="w-4 h-4" />
            <span>2. บริหารจัดการตารางสอน ({schedules.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('history')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              subTab === 'history'
                ? 'bg-white text-indigo-700 shadow-md'
                : 'bg-white/10 text-slate-200 hover:bg-white/20'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>3. ประวัติ & สถิติการเข้าเรียน ({attendanceSessions.length})</span>
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SUB-TAB 1: DAILY CHECK-IN BY SCHEDULE                                */}
      {/* ===================================================================== */}
      {subTab === 'checkin' && (
        <div className="space-y-6">
          {/* Date & Teacher Control Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  วันที่เช็คชื่อเรียน
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-indigo-600 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => {
                        setSelectedDate(e.target.value);
                        setActiveSheet(null);
                      }}
                      className="pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDate(getTodayDateString());
                      setActiveSheet(null);
                    }}
                    className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    วันนี้
                  </button>
                  {currentDayMeta ? (
                    <span
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${currentDayMeta.badgeClass}`}
                    >
                      {currentDayMeta.label}
                    </span>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
                      วันเสาร์/อาทิตย์
                    </span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                  แสดงตารางสอนของครู
                </label>
                <select
                  value={selectedTeacherFilter}
                  onChange={(e) => {
                    setSelectedTeacherFilter(e.target.value);
                    setActiveSheet(null);
                  }}
                  className="px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value={currentTeacher.id}>
                    ตารางสอนของฉัน ({currentTeacher.name})
                  </option>
                  <option value="all">ครูผู้สอนทุกคนในระบบ</option>
                  {teachersRoster
                    .filter((t) => t.id !== currentTeacher.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onSavePeriodConfigs && (
                <button
                  type="button"
                  onClick={() => setIsPeriodSettingsOpen(true)}
                  className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  <span>ตั้งค่าคาบ/พักเที่ยง</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!adhocSubject && nonAllSubjects[0]) setAdhocSubject(nonAllSubjects[0]);
                  if (!adhocGrade && nonAllGrades[0]) setAdhocGrade(nonAllGrades[0]);
                  setIsAdhocModalOpen(true);
                }}
                className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                <span>เช็คชื่อคาบนอกตาราง / สอนแทน</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEditingSchedule(null);
                  setIsScheduleModalOpen(true);
                }}
                className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มคาบสอน</span>
              </button>
            </div>
          </div>

          {/* Scheduled Periods List for Selected Day */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm sm:text-base font-bold font-prompt text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4.5 h-4.5 text-indigo-600" />
                <span>
                  คาบสอนประจำ{formatThaiDate(selectedDate)} ({dailyScheduleBlocks.length} รายการ
                  {dailyScheduledPeriods.length > dailyScheduleBlocks.length
                    ? ` · รวมคาบสอนติดกัน`
                    : ''}
                  )
                </span>
              </h2>
            </div>

            {!currentDayOfWeek ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
                <Calendar className="w-10 h-10 text-slate-400 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    วันที่เลือกตรงกับวันหยุดสุดสัปดาห์ (เสาร์/อาทิตย์)
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    ไม่มีคาบสอนปกติตามตารางวันจันทร์–ศุกร์ คุณสามารถเปลี่ยนวันที่เพื่อดูตารางสอน หรือกดปุ่ม "เช็คชื่อคาบนอกตาราง / สอนแทน" ได้
                  </p>
                </div>
              </div>
            ) : dailyScheduleBlocks.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
                <CalendarClock className="w-10 h-10 text-slate-400 mx-auto" />
                <div>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    ไม่พบคาบสอนใน{currentDayMeta?.label}ตามตัวกรองที่เลือก
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    คุณสามารถเพิ่มคาบสอนเข้าตารางสอน หรือลองเลือก "ครูผู้สอนทุกคนในระบบ"
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSchedule(null);
                      setIsScheduleModalOpen(true);
                    }}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                  >
                    + เพิ่มคาบสอนใหม่
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTeacherFilter('all')}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                  >
                    ดูตารางครูทุกคน
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {dailyScheduleBlocks.map((block) => {
                  const sch = block.primary;
                  const savedSession = findSessionForBlock(block, selectedDate);
                  const { students: roomStudents } = getStudentsForRoom(
                    studentsRoster,
                    sch.gradeLevel
                  );
                  const isActive =
                    activeSheet?.date === selectedDate &&
                    ((activeSheet?.scheduleId &&
                      block.schedules.some((s) => s.id === activeSheet.scheduleId)) ||
                      (activeSheet?.coveredScheduleIds &&
                        block.schedules.some((s) =>
                          activeSheet.coveredScheduleIds?.includes(s.id)
                        )));

                  const presentCnt = savedSession
                    ? savedSession.records.filter((r) => r.status === 'present').length
                    : 0;
                  const lateCnt = savedSession
                    ? savedSession.records.filter((r) => r.status === 'late').length
                    : 0;
                  const leaveCnt = savedSession
                    ? savedSession.records.filter((r) => r.status === 'leave').length
                    : 0;
                  const absentCnt = savedSession
                    ? savedSession.records.filter((r) => r.status === 'absent').length
                    : 0;

                  const isMultiPeriod = block.periodCount > 1 || block.endPeriod !== block.period;

                  return (
                    <div
                      key={block.id}
                      className={`rounded-2xl border p-4 transition-all bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3 ${
                        isActive
                          ? 'border-indigo-500 ring-2 ring-indigo-500/20'
                          : savedSession
                          ? 'border-emerald-200 dark:border-emerald-800/70'
                          : 'border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700'
                      }`}
                    >
                      <div className="space-y-2.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                              isBreakPeriodNum(block.period)
                                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300'
                            }`}
                          >
                            {isBreakPeriodNum(block.period) ? (
                              <Coffee className="w-3.5 h-3.5" />
                            ) : (
                              <Clock className="w-3.5 h-3.5" />
                            )}
                            {getPeriodRangeDisplayLabel(block.period, block.endPeriod)} ({block.startTime}-{block.endTime})
                          </span>

                          {savedSession ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-bold">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              เช็คชื่อแล้ว
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold">
                              ยังไม่เช็คชื่อ
                            </span>
                          )}
                        </div>

                        {isMultiPeriod && (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-violet-50 dark:bg-violet-950/50 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 text-[11px] font-bold">
                            <Layers className="w-3 h-3" />
                            <span>สอน {block.periodCount} คาบติดกัน · เช็คชื่อครั้งเดียว</span>
                          </div>
                        )}

                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                              {sch.subject}
                            </h3>
                            <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-bold">
                              ชั้น {sch.gradeLevel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-3 flex-wrap">
                            <span className="flex items-center gap-1">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                              {sch.teacherName}
                            </span>
                            {sch.classroom && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                {sch.classroom}
                              </span>
                            )}
                          </p>
                        </div>

                        {savedSession ? (
                          <div className="p-2 bg-slate-50 dark:bg-slate-800/70 rounded-xl text-[11px] flex items-center justify-between gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                              มา {presentCnt}
                            </span>
                            <span className="text-amber-600 dark:text-amber-400 font-bold">
                              สาย {lateCnt}
                            </span>
                            <span className="text-sky-600 dark:text-sky-400 font-bold">
                              ลา {leaveCnt}
                            </span>
                            <span className="text-rose-600 dark:text-rose-400 font-bold">
                              ขาด {absentCnt}
                            </span>
                          </div>
                        ) : (
                          <div className="p-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5" />
                            <span>รายชื่อนักเรียนในระบบ: {roomStudents.length} คน</span>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleOpenCheckinForBlock(block, selectedDate)}
                        className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                          savedSession
                            ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        }`}
                      >
                        <ClipboardCheck className="w-4 h-4" />
                        <span>
                          {savedSession
                            ? 'เปิดดู / แก้ไขการเช็คชื่อ'
                            : isMultiPeriod
                            ? `เช็คชื่อครั้งเดียว (${block.periodCount} คาบติดกัน)`
                            : 'เช็คชื่อเข้าเรียนคาบนี้'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Check-in Sheet Panel */}
          {activeSheet && (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-indigo-500/60 shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              {/* Sheet Header */}
              <div className="p-4 sm:p-5 bg-indigo-50/80 dark:bg-indigo-950/40 border-b border-indigo-100 dark:border-indigo-900/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-lg bg-indigo-600 text-white text-xs font-bold">
                      {getPeriodRangeDisplayLabel(activeSheet.period, activeSheet.endPeriod)} ({activeSheet.startTime}-{activeSheet.endTime})
                    </span>
                    <span className="text-sm sm:text-base font-bold font-prompt text-slate-900 dark:text-white">
                      วิชา {activeSheet.subject} · ชั้น {activeSheet.gradeLevel}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300">
                    📅 {formatThaiDate(activeSheet.date)} · 👩‍🏫 ผู้สอน: {activeSheet.teacherName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveSheet(null)}
                  className="self-start md:self-center px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>ปิดใบเช็คชื่อ</span>
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {activeSheet.isBaseFallback && (
                  <div className="p-3 bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl text-xs text-sky-800 dark:text-sky-300 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-sky-600" />
                      <span>
                        ยังไม่พบนักเรียนที่ตั้งค่าห้อง <strong>{activeSheet.gradeLevel}</strong> โดยตรง ระบบจึงดึงรายชื่อนักเรียนระดับชั้น <strong>{activeSheet.gradeLevel.split('/')[0]}</strong> มาแสดงให้อัตโนมัติ
                      </span>
                    </div>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => onOpenSettings('students')}
                        className="shrink-0 font-bold underline hover:text-sky-950 cursor-pointer"
                      >
                        จัดการห้องนักเรียน
                      </button>
                    )}
                  </div>
                )}

                {/* Topic Taught + Search + Bulk Actions */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                  <div className="lg:col-span-5">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      หัวข้อ/เนื้อหาที่สอนในคาบนี้ (ไม่บังคับ)
                    </label>
                    <input
                      type="text"
                      value={activeSheet.topicTaught}
                      onChange={(e) =>
                        setActiveSheet({ ...activeSheet, topicTaught: e.target.value })
                      }
                      placeholder="เช่น บทที่ 3 การสังเคราะห์ด้วยแสง..."
                      className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="lg:col-span-4">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1">
                      ค้นหานักเรียนในใบเช็คชื่อ
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={studentSearch}
                        onChange={(e) => setStudentSearch(e.target.value)}
                        placeholder="พิมพ์ชื่อ หรือรหัสนักเรียน..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-3 flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => handleMarkAllStatus('present')}
                      className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>มาเรียนทั้งหมด</span>
                    </button>
                  </div>
                </div>

                {/* Live Summary Counter Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-center">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                      นักเรียนทั้งหมด
                    </span>
                    <span className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                      {sheetCounts.total} คน
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-center">
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block">
                      มาเรียน
                    </span>
                    <span className="text-base font-bold font-prompt text-emerald-700 dark:text-emerald-300">
                      {sheetCounts.present} คน
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-center">
                    <span className="text-[11px] text-amber-700 dark:text-amber-300 block">
                      มาสาย
                    </span>
                    <span className="text-base font-bold font-prompt text-amber-700 dark:text-amber-300">
                      {sheetCounts.late} คน
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800/60 text-center">
                    <span className="text-[11px] text-sky-700 dark:text-sky-300 block">
                      ลา
                    </span>
                    <span className="text-base font-bold font-prompt text-sky-700 dark:text-sky-300">
                      {sheetCounts.leave} คน
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-center col-span-2 sm:col-span-1">
                    <span className="text-[11px] text-rose-700 dark:text-rose-300 block">
                      ขาดเรียน
                    </span>
                    <span className="text-base font-bold font-prompt text-rose-700 dark:text-rose-300">
                      {sheetCounts.absent} คน
                    </span>
                  </div>
                </div>

                {/* Add Extra Student Quick Selector */}
                {studentsRoster.some(
                  (s) => !activeSheet.records.some((r) => r.studentCode === s.code)
                ) && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700/70">
                    <span className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                      เพิ่มนักเรียนเพิ่มเติมในคาบนี้ (เช่น เรียนเสริม / ย้ายห้อง):
                    </span>
                    <select
                      value=""
                      onChange={(e) => handleAddExtraStudentToSheet(e.target.value)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200"
                    >
                      <option value="">+ เลือกรายชื่อนักเรียนเพิ่ม...</option>
                      {studentsRoster
                        .filter(
                          (s) =>
                            !activeSheet.records.some((r) => r.studentCode === s.code)
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.code} - {s.name} ({s.gradeLevel})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Student List */}
                {filteredSheetRecords.length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 space-y-2">
                    <Users className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      ไม่พบรายชื่อนักเรียนในชั้น {activeSheet.gradeLevel}
                    </p>
                    {onOpenSettings && (
                      <button
                        type="button"
                        onClick={() => onOpenSettings('students')}
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-bold underline cursor-pointer"
                      >
                        ไปที่เมนูตั้งค่า &gt; จัดการนักเรียน เพื่อเพิ่มรายชื่อเข้าห้องเรียน
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                    {filteredSheetRecords.map((rec, index) => (
                      <div
                        key={rec.studentCode}
                        className="p-3 bg-white dark:bg-slate-900 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="w-6 text-center text-xs font-bold text-slate-400 shrink-0">
                            {index + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                              {rec.studentName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              รหัส: {rec.studentCode} · ชั้น {rec.gradeLevel}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
                          {/* 4 Tactile Status Buttons */}
                          <div className="grid grid-cols-4 gap-1.5">
                            {(['present', 'late', 'leave', 'absent'] as AttendanceStatus[]).map(
                              (stKey) => {
                                const isChosen = rec.status === stKey;
                                return (
                                  <button
                                    key={stKey}
                                    type="button"
                                    onClick={() =>
                                      handleUpdateStudentStatus(rec.studentCode, stKey)
                                    }
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                      isChosen
                                        ? STATUS_META[stKey].activeClass
                                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                                    }`}
                                  >
                                    {STATUS_META[stKey].shortLabel}
                                  </button>
                                );
                              }
                            )}
                          </div>

                          {/* Optional Note */}
                          <input
                            type="text"
                            value={rec.note || ''}
                            onChange={(e) =>
                              handleUpdateStudentNote(rec.studentCode, e.target.value)
                            }
                            placeholder="หมายเหตุ (ถ้ามี)..."
                            className="w-full sm:w-44 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Sheet Footer Actions */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyLineSummary}
                      className="px-3.5 py-2 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedReport ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>คัดลอกข้อความรายงานแล้ว!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>คัดลอกสรุปส่ง LINE</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportSessionExcel(activeSheet)}
                      className="px-3.5 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-indigo-600" />
                      <span>Export Excel (.xlsx)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsSaveSheetConfirmOpen(true)}
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Save className="w-4 h-4" />
                    <span>บันทึกการเช็คชื่อลงระบบ</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 2: SCHEDULE MANAGEMENT                                        */}
      {/* ===================================================================== */}
      {subTab === 'schedule' && (
        <div className="space-y-5">
          {/* Schedule Filters & Actions */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={scheduleTeacherFilter}
                onChange={(e) => setScheduleTeacherFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value={currentTeacher.id}>
                  ตารางสอนของฉัน ({currentTeacher.name})
                </option>
                <option value="all">ครูผู้สอนทุกคน</option>
                {teachersRoster
                  .filter((t) => t.id !== currentTeacher.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
              </select>

              <select
                value={scheduleSubjectFilter}
                onChange={(e) => setScheduleSubjectFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="ทั้งหมด">ทุกวิชา</option>
                {nonAllSubjects.map((s) => (
                  <option key={s} value={s}>
                    วิชา {s}
                  </option>
                ))}
              </select>

              <select
                value={scheduleGradeFilter}
                onChange={(e) => setScheduleGradeFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
              >
                <option value="ทั้งหมด">ทุกระดับชั้น/ห้อง</option>
                {nonAllGrades.map((g) => (
                  <option key={g} value={g}>
                    ชั้น {g}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setScheduleViewMode('by_day')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    scheduleViewMode === 'by_day'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>รายวัน (จ.-ศ.)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleViewMode('weekly_grid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    scheduleViewMode === 'weekly_grid'
                      ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>ตารางรวมสัปดาห์</span>
                </button>
              </div>

              {onSavePeriodConfigs && (
                <button
                  type="button"
                  onClick={() => setIsPeriodSettingsOpen(true)}
                  className="px-3.5 py-2 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span>ตั้งค่าคาบเรียน / พักเที่ยง</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setEditingSchedule(null);
                  setIsScheduleModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มคาบสอนใหม่</span>
              </button>
            </div>
          </div>

          {filteredSchedules.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-10 text-center space-y-3">
              <CalendarClock className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                ไม่พบข้อมูลตารางสอนตามเงื่อนไขที่เลือก
              </p>
              <button
                type="button"
                onClick={() => {
                  setEditingSchedule(null);
                  setIsScheduleModalOpen(true);
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                + เพิ่มคาบสอนแรกในตาราง
              </button>
            </div>
          ) : scheduleViewMode === 'by_day' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              {DAYS_OF_WEEK_LIST.map((day) => {
                const items = filteredSchedules
                  .filter((s) => s.dayOfWeek === day.id)
                  .sort(sortSchedulesChronologically);

                return (
                  <div
                    key={day.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-3 shadow-xs flex flex-col"
                  >
                    <div
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-between ${day.badgeClass}`}
                    >
                      <span>{day.label}</span>
                      <span>{items.length} คาบ</span>
                    </div>

                    {items.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center py-8 text-xs text-slate-400">
                        ว่าง / ไม่มีคาบสอน
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {items.map((sch) => (
                          <div
                            key={sch.id}
                            className={`p-3 rounded-xl border space-y-2 ${
                              isBreakPeriodNum(sch.period)
                                ? 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/70'
                                : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700/80'
                            }`}
                          >
                            <div className="flex items-center justify-between text-[11px]">
                              <span
                                className={`font-bold flex items-center gap-1 ${
                                  isBreakPeriodNum(sch.period)
                                    ? 'text-amber-700 dark:text-amber-300'
                                    : 'text-indigo-600 dark:text-indigo-400'
                                }`}
                              >
                                {isBreakPeriodNum(sch.period) && <Coffee className="w-3 h-3" />}
                                {getPeriodRangeDisplayLabel(sch.period, sch.endPeriod, true)}
                              </span>
                              <span className="font-mono text-slate-400">
                                {sch.startTime}-{sch.endTime}
                              </span>
                            </div>

                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white">
                                {sch.subject} · {sch.gradeLevel}
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {sch.teacherName}
                              </p>
                              {sch.classroom && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                                  <MapPin className="w-3 h-3" />
                                  {sch.classroom}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-slate-200/70 dark:border-slate-700">
                              <button
                                type="button"
                                onClick={() => {
                                  setSubTab('checkin');
                                  handleOpenCheckinForSchedule(sch, selectedDate);
                                }}
                                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                              >
                                เช็คชื่อ
                              </button>

                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingSchedule(sch);
                                    setIsScheduleModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors cursor-pointer"
                                  title="แก้ไขคาบสอน"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteScheduleConfirm(sch)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors cursor-pointer"
                                  title="ลบคาบสอน"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Weekly Timetable Grid */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
              <table className="w-full min-w-[960px] text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <th className="p-3 text-left font-bold text-slate-700 dark:text-slate-200 w-28 border-r border-slate-200 dark:border-slate-700">
                      วัน / คาบ
                    </th>
                    {activePeriods.map((p) => (
                      <th
                        key={p.id}
                        className={`p-2.5 text-center font-bold border-r last:border-r-0 border-slate-200 dark:border-slate-700 ${
                          p.isBreak
                            ? 'bg-amber-50/90 dark:bg-amber-950/35 text-amber-800 dark:text-amber-300 min-w-[96px]'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {p.isBreak && <Coffee className="w-3.5 h-3.5 shrink-0" />}
                          <span>{p.label.replace(/^คาบที่\s*/, 'คาบ ')}</span>
                        </div>
                        <div
                          className={`text-[10px] font-normal font-mono ${
                            p.isBreak ? 'text-amber-600/80 dark:text-amber-400/80' : 'text-slate-400'
                          }`}
                        >
                          {p.startTime}-{p.endTime}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {DAYS_OF_WEEK_LIST.map((day) => {
                    const skipCols = new Set<number>();
                    return (
                      <tr key={day.id}>
                        <td className="p-3 font-bold border-r border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/30">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-lg border text-[11px] ${day.badgeClass}`}
                          >
                            {day.label}
                          </span>
                        </td>
                        {activePeriods.map((p, colIdx) => {
                          if (skipCols.has(colIdx)) return null;

                          const hasDuplicatePeriodNum =
                            activePeriods.filter((x) => x.period === p.period).length > 1;
                          const cellSchedules = filteredSchedules.filter(
                            (s) =>
                              s.dayOfWeek === day.id &&
                              s.period === p.period &&
                              (!hasDuplicatePeriodNum || s.startTime === p.startTime)
                          );

                          // Safely compute colSpan if a single multi-period schedule spans contiguous empty columns
                          let colSpan = 1;
                          if (cellSchedules.length === 1 && cellSchedules[0].endPeriod && cellSchedules[0].endPeriod !== cellSchedules[0].period) {
                            const endIdx = activePeriods.findIndex(
                              (ap) => ap.period === cellSchedules[0].endPeriod
                            );
                            if (endIdx > colIdx) {
                              const spannedColsHaveOtherItems = activePeriods
                                .slice(colIdx + 1, endIdx + 1)
                                .some((ap) =>
                                  filteredSchedules.some(
                                    (other) =>
                                      other.dayOfWeek === day.id &&
                                      other.id !== cellSchedules[0].id &&
                                      other.period === ap.period
                                  )
                                );
                              if (!spannedColsHaveOtherItems) {
                                colSpan = endIdx - colIdx + 1;
                                for (let k = colIdx + 1; k <= endIdx; k++) {
                                  skipCols.add(k);
                                }
                              }
                            }
                          }

                          return (
                            <td
                              key={p.id}
                              colSpan={colSpan}
                              className={`p-1.5 align-top border-r last:border-r-0 border-slate-200 dark:border-slate-700 ${
                                p.isBreak
                                  ? 'bg-amber-50/40 dark:bg-amber-950/15 min-w-[96px]'
                                  : 'min-w-[115px]'
                              }`}
                            >
                              {cellSchedules.length === 0 ? (
                                p.isBreak ? (
                                  <div className="h-14 flex flex-col items-center justify-center gap-0.5 text-amber-600/75 dark:text-amber-400/75 text-[10px] font-semibold">
                                    <Coffee className="w-3.5 h-3.5" />
                                    <span>{p.label}</span>
                                  </div>
                                ) : (
                                  <div className="h-14 flex items-center justify-center text-slate-300 dark:text-slate-700 text-[10px]">
                                    -
                                  </div>
                                )
                              ) : (
                                <div className="space-y-1">
                                  {cellSchedules.map((sch) => (
                                    <div
                                      key={sch.id}
                                      className={`p-2 rounded-lg border space-y-1 group ${
                                        p.isBreak
                                          ? 'bg-amber-100/80 dark:bg-amber-950/60 border-amber-300/80 dark:border-amber-800/70'
                                          : 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-200/80 dark:border-indigo-800/60'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-1">
                                        <div
                                          className={`font-bold leading-tight ${
                                            p.isBreak
                                              ? 'text-amber-900 dark:text-amber-200'
                                              : 'text-indigo-900 dark:text-indigo-200'
                                          }`}
                                        >
                                          {sch.subject}
                                        </div>
                                        {sch.endPeriod && sch.endPeriod !== sch.period && (
                                          <span className="shrink-0 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/70 text-violet-700 dark:text-violet-200 text-[9px] font-bold">
                                            {getPeriodRangeDisplayLabel(sch.period, sch.endPeriod, true)}
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">
                                        ชั้น {sch.gradeLevel}
                                      </div>
                                      <div className="text-[10px] text-slate-500 truncate">
                                        {sch.teacherName}
                                      </div>
                                      <div className="flex items-center justify-between pt-1">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setEditingSchedule(sch);
                                            setIsScheduleModalOpen(true);
                                          }}
                                          className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                                        >
                                          แก้ไข
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setDeleteScheduleConfirm(sch)}
                                          className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                                        >
                                          ลบ
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUB-TAB 3: ATTENDANCE HISTORY & STUDENT ANALYTICS                     */}
      {/* ===================================================================== */}
      {subTab === 'history' && (
        <div className="space-y-5">
          {/* History Filter Bar */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="ค้นหาชื่อนักเรียน, รหัส, หัวข้อที่สอน..."
                    className="pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white w-60 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={historyTeacherFilter}
                  onChange={(e) => setHistoryTeacherFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="all">ครูทุกคน</option>
                  {teachersRoster.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>

                <select
                  value={historySubjectFilter}
                  onChange={(e) => setHistorySubjectFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="ทั้งหมด">ทุกวิชา</option>
                  {nonAllSubjects.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <select
                  value={historyGradeFilter}
                  onChange={(e) => setHistoryGradeFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="ทั้งหมด">ทุกระดับชั้น</option>
                  {nonAllGrades.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 border border-slate-200 dark:border-slate-700">
                  <button
                    type="button"
                    onClick={() => setHistoryInnerTab('sessions')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      historyInnerTab === 'sessions'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    ประวัติรายคาบ ({filteredHistorySessions.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryInnerTab('student_stats')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                      historyInnerTab === 'student_stats'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                        : 'text-slate-500'
                    }`}
                  >
                    สถิติรายนักเรียน ({studentAggregateStats.length})
                  </button>
                </div>

                {filteredHistorySessions.length > 0 && (
                  <button
                    type="button"
                    onClick={handleExportAllHistoryExcel}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Export ทั้งหมด (.xlsx)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {filteredHistorySessions.length === 0 ? (
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-12 text-center space-y-2">
              <FileText className="w-10 h-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                ยังไม่มีประวัติการเช็คชื่อที่ตรงกับเงื่อนไข
              </p>
              <p className="text-xs text-slate-400">
                เลือกแถบ "1. เช็คชื่อตามตารางสอนวันนี้" เพื่อเริ่มบันทึกการเข้าเรียนของนักเรียน
              </p>
            </div>
          ) : historyInnerTab === 'sessions' ? (
            <div className="space-y-3">
              {filteredHistorySessions.map((sess) => {
                const pCnt = sess.records.filter((r) => r.status === 'present').length;
                const lCnt = sess.records.filter((r) => r.status === 'late').length;
                const vCnt = sess.records.filter((r) => r.status === 'leave').length;
                const aCnt = sess.records.filter((r) => r.status === 'absent').length;

                return (
                  <div
                    key={sess.id}
                    className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-bold">
                          {formatThaiDate(sess.date)}
                        </span>
                        <span className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold">
                          {getPeriodRangeDisplayLabel(sess.period, sess.endPeriod)}
                        </span>
                        <span className="text-sm font-bold font-prompt text-slate-900 dark:text-white">
                          วิชา {sess.subject} · ชั้น {sess.gradeLevel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        ผู้สอน: {sess.teacherName}
                        {sess.topicTaught ? ` · หัวข้อ: ${sess.topicTaught}` : ''}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold pt-0.5">
                        <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                          มา {pCnt}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300">
                          สาย {lCnt}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300">
                          ลา {vCnt}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300">
                          ขาด {aCnt}
                        </span>
                        <span className="text-slate-400 font-normal">
                          (รวม {sess.records.length} คน)
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleEditExistingSession(sess)}
                        className="px-3 py-2 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>ดู / แก้ไข</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleExportSessionExcel(sess)}
                        className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Excel</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeleteSessionConfirm(sess)}
                        className="px-3 py-2 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>ลบ</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Per-Student Aggregated Attendance Stats Table */
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                  <tr>
                    <th className="p-3.5">รหัสนักเรียน</th>
                    <th className="p-3.5">ชื่อ-นามสกุล</th>
                    <th className="p-3.5">ชั้น</th>
                    <th className="p-3.5 text-center">รวมคาบ</th>
                    <th className="p-3.5 text-center text-emerald-600">มาเรียน</th>
                    <th className="p-3.5 text-center text-amber-600">มาสาย</th>
                    <th className="p-3.5 text-center text-sky-600">ลา</th>
                    <th className="p-3.5 text-center text-rose-600">ขาดเรียน</th>
                    <th className="p-3.5 text-center">อัตราการเข้าเรียน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {studentAggregateStats.map((st) => {
                    const rate =
                      st.total > 0
                        ? Math.round(((st.present + st.late) / st.total) * 100)
                        : 100;
                    const isLow = rate < 80;
                    return (
                      <tr
                        key={st.studentCode}
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      >
                        <td className="p-3.5 font-mono text-slate-500">{st.studentCode}</td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white">
                          {st.studentName}
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300">
                          {st.gradeLevel}
                        </td>
                        <td className="p-3.5 text-center font-bold">{st.total}</td>
                        <td className="p-3.5 text-center font-bold text-emerald-600">
                          {st.present}
                        </td>
                        <td className="p-3.5 text-center font-bold text-amber-600">{st.late}</td>
                        <td className="p-3.5 text-center font-bold text-sky-600">{st.leave}</td>
                        <td className="p-3.5 text-center font-bold text-rose-600">
                          {st.absent}
                        </td>
                        <td className="p-3.5 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-bold border ${
                              isLow
                                ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
                            }`}
                          >
                            {rate}%
                            {isLow && ' (ต่ำกว่าเกณฑ์)'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Schedule Create/Edit Modal */}
      {isScheduleModalOpen && (
        <ScheduleFormModal
          editingSchedule={editingSchedule}
          teachersList={teachersRoster}
          currentTeacher={currentTeacher}
          subjectsList={subjectsList}
          gradeLevelsList={gradeLevelsList}
          existingSchedules={schedules}
          periodConfigs={activePeriods}
          onClose={() => {
            setIsScheduleModalOpen(false);
            setEditingSchedule(null);
          }}
          onSaveSchedule={onSaveSchedule}
        />
      )}

      {/* Period & Lunch Break Settings Modal */}
      {isPeriodSettingsOpen && onSavePeriodConfigs && (
        <PeriodSettingsModal
          periodConfigs={activePeriods}
          onClose={() => setIsPeriodSettingsOpen(false)}
          onSavePeriodConfigs={onSavePeriodConfigs}
        />
      )}

      {/* Save Attendance Confirmation Modal */}
      {activeSheet && (
        <SaveConfirmModal
          isOpen={isSaveSheetConfirmOpen}
          title="ยืนยันการบันทึกการเช็คชื่อ?"
          description="กรุณาตรวจสอบสรุปยอดการเข้าเรียนก่อนบันทึกลงฐานข้อมูล"
          details={[
            { label: 'รายวิชา / ชั้น', value: `${activeSheet.subject} (${activeSheet.gradeLevel})` },
            { label: 'วันที่เช็คชื่อ', value: formatThaiDate(activeSheet.date) },
            {
              label: 'ช่วงคาบเรียน',
              value: `${getPeriodRangeDisplayLabel(activeSheet.period, activeSheet.endPeriod)} (${activeSheet.startTime}-${activeSheet.endTime})`,
            },
            {
              label: 'สรุปยอดนักเรียน',
              value: `มา ${sheetCounts.present} · สาย ${sheetCounts.late} · ลา ${sheetCounts.leave} · ขาด ${sheetCounts.absent} (รวม ${sheetCounts.total} คน)`,
            },
            ...(activeSheet.topicTaught.trim()
              ? [{ label: 'หัวข้อที่สอน', value: activeSheet.topicTaught.trim() }]
              : []),
          ]}
          confirmLabel="ยืนยันการบันทึกเช็คชื่อ"
          onConfirm={() => {
            setIsSaveSheetConfirmOpen(false);
            handleSaveActiveSheet();
          }}
          onCancel={() => setIsSaveSheetConfirmOpen(false)}
        />
      )}

      {/* Ad-hoc / Substitute Period Modal */}
      {isAdhocModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-prompt text-slate-900 dark:text-white">
                    เช็คชื่อคาบนอกตาราง / สอนแทน
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    วันที่ {formatThaiDate(selectedDate)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAdhocModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartAdhocCheckin} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ครูผู้เข้าสอน
                </label>
                <select
                  value={adhocTeacherId}
                  onChange={(e) => setAdhocTeacherId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                >
                  {teachersRoster.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    รายวิชา
                  </label>
                  <select
                    value={adhocSubject}
                    onChange={(e) => setAdhocSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {nonAllSubjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ระดับชั้น / ห้อง
                  </label>
                  <select
                    value={adhocGrade}
                    onChange={(e) => setAdhocGrade(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {nonAllGrades.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    เริ่มคาบเรียน
                  </label>
                  <select
                    value={adhocPeriod}
                    onChange={(e) => {
                      const nextP = Number(e.target.value);
                      setAdhocPeriod(nextP);
                      setAdhocEndPeriod(nextP);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {activePeriods.map((p) => (
                      <option key={p.id} value={p.period}>
                        {p.isBreak ? `☕ ${p.label}` : p.label} ({p.startTime}-{p.endTime})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ถึงคาบที่ (สอนควบติดกัน)
                  </label>
                  <select
                    value={adhocEndPeriod}
                    onChange={(e) => setAdhocEndPeriod(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs"
                  >
                    {(() => {
                      const sIdx = activePeriods.findIndex((x) => x.period === adhocPeriod);
                      if (sIdx < 0) {
                        return <option value={adhocPeriod}>คาบเดียว</option>;
                      }
                      const opts: PeriodConfig[] = [activePeriods[sIdx]];
                      if (!activePeriods[sIdx].isBreak) {
                        for (let i = sIdx + 1; i < activePeriods.length; i++) {
                          if (activePeriods[i].isBreak) break;
                          opts.push(activePeriods[i]);
                        }
                      }
                      return opts.map((p, idx) => (
                        <option key={p.id} value={p.period}>
                          {idx === 0
                            ? `คาบเดียว (${p.label})`
                            : `${p.label} (${idx + 1} คาบติดกัน)`}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdhocModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  เปิดใบเช็คชื่อทันที
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Delete Schedule Confirmation Modal */}
      {deleteScheduleConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                ยืนยันการลบคาบสอน?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                คุณต้องการลบ{getPeriodRangeDisplayLabel(deleteScheduleConfirm.period, deleteScheduleConfirm.endPeriod)} วิชา{' '}
                <strong>{deleteScheduleConfirm.subject}</strong> (ชั้น{' '}
                {deleteScheduleConfirm.gradeLevel}) ออกจากตารางสอนหรือไม่?
                ประวัติการเช็คชื่อที่บันทึกไว้แล้วยังคงอยู่ครบถ้วน
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteScheduleConfirm(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteSchedule(deleteScheduleConfirm.id);
                  setDeleteScheduleConfirm(null);
                }}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ลบคาบสอน
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Delete Attendance Session Confirmation Modal */}
      {deleteSessionConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                ยืนยันการลบบันทึกการเช็คชื่อ?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                บันทึกวันที่ {formatThaiDate(deleteSessionConfirm.date)}{' '}
                {getPeriodRangeDisplayLabel(deleteSessionConfirm.period, deleteSessionConfirm.endPeriod)} วิชา{' '}
                <strong>{deleteSessionConfirm.subject}</strong> จะถูกลบออกจากระบบอย่างถาวร
              </p>
            </div>
            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeleteSessionConfirm(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteAttendanceSession(deleteSessionConfirm.id);
                  setDeleteSessionConfirm(null);
                }}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                ลบบันทึกนี้
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
