import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen,
  Settings,
  Plus,
  Layers,
  GraduationCap,
  User,
  ArrowRight,
  School,
  EyeOff,
  Sparkles,
  Save,
} from 'lucide-react';
import {
  Assignment,
  LearningResource,
  StudentProfile,
  SubjectClassroom,
  Submission,
  TeacherProfile,
  TeachingSchedule,
  UserRole,
} from '../types';
import { AssignmentCard } from './AssignmentCard';
import { SubjectClassroomDetailView } from './SubjectClassroomDetailView';
import { sanitizeImageSrc } from '../utils/security';
import {
  buildAutoSubjectClassrooms,
  materializeClassroomForSave,
} from '../utils/classroomBuilder';
import classroomBannerImg from '../assets/images/classroom_banner_1795069105021.jpg';

interface SubjectViewProps {
  assignments: Assignment[];
  submissions: Submission[];
  classrooms?: SubjectClassroom[];
  resources?: LearningResource[];
  students?: StudentProfile[];
  role: UserRole;
  currentStudentCode?: string;
  studentGradeLevel?: string;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
  onOpenSubmitModal: (assignment: Assignment) => void;
  onOpenGradingModal: (assignment: Assignment, submission?: Submission) => void;
  onOpenHintModal: (assignment: Assignment) => void;
  onOpenRosterModal?: (assignment: Assignment) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  onEditAssignment?: (assignment: Assignment) => void;
  subjects?: string[];
  teachingSchedules?: TeachingSchedule[];
  teachersRoster?: TeacherProfile[];
  currentTeacherName?: string;
  onOpenSettings?: (tab?: 'grades' | 'subjects' | 'students') => void;
  onOpenCreateClassroom?: () => void;
  onEditClassroom?: (classroom: SubjectClassroom) => void;
  onDeleteClassroom?: (classroomId: string) => void;
  onSaveClassroom?: (classroom: SubjectClassroom) => void;
  onSaveBatchClassrooms?: (classrooms: SubjectClassroom[]) => Promise<void> | void;
  onActiveClassroomChange?: (isActive: boolean) => void;
  onRestoreWorksheets?: () => void;
}

function studentMatchesClassroomGrade(classroomGrade: string, studentGrade?: string): boolean {
  if (!classroomGrade || classroomGrade === 'ทั้งหมด') return true;
  if (!studentGrade) return true;
  if (classroomGrade === studentGrade) return true;
  const baseStudent = studentGrade.includes('/') ? studentGrade.split('/')[0] : studentGrade;
  if (!classroomGrade.includes('/') && classroomGrade === baseStudent) return true;
  if (classroomGrade === `${baseStudent} (ทุกห้อง)`) return true;
  return false;
}

export const SubjectView: React.FC<SubjectViewProps> = ({
  assignments,
  submissions,
  classrooms = [],
  resources = [],
  students = [],
  role,
  currentStudentCode,
  studentGradeLevel,
  selectedSubject,
  setSelectedSubject,
  onOpenSubmitModal,
  onOpenGradingModal,
  onOpenHintModal,
  onOpenRosterModal,
  onDeleteAssignment,
  onEditAssignment,
  subjects = ['ทั้งหมด'],
  teachingSchedules = [],
  teachersRoster = [],
  currentTeacherName = 'ครูผู้สอน',
  onOpenSettings,
  onOpenCreateClassroom,
  onEditClassroom,
  onDeleteClassroom,
  onSaveClassroom,
  onSaveBatchClassrooms,
  onActiveClassroomChange,
  onRestoreWorksheets,
}) => {
  const [activeClassroomId, setActiveClassroomId] = useState<string | null>(null);
  const [activeClassroomSubject, setActiveClassroomSubject] = useState<string | null>(null);
  const [isSavingBatch, setIsSavingBatch] = useState(false);

  const autoClassrooms = useMemo(
    () =>
      buildAutoSubjectClassrooms({
        subjectsList: subjects,
        assignments,
        resources,
        teachingSchedules,
        teachersRoster,
        existingClassrooms: classrooms,
        currentTeacherName,
      }),
    [subjects, assignments, resources, teachingSchedules, teachersRoster, classrooms, currentTeacherName]
  );

  const allClassrooms = useMemo(
    () => [...classrooms, ...autoClassrooms],
    [classrooms, autoClassrooms]
  );

  const visibleClassrooms = useMemo(() => {
    return allClassrooms.filter((cls) => {
      if (role === 'student') {
        if (cls.isPublished === false) return false;
        if (!studentMatchesClassroomGrade(cls.gradeLevel, studentGradeLevel)) return false;
      }
      if (selectedSubject !== 'ทั้งหมด' && cls.subject !== selectedSubject) {
        return false;
      }
      return true;
    });
  }, [allClassrooms, role, studentGradeLevel, selectedSubject]);

  const activeClassroom = useMemo(() => {
    if (!activeClassroomId) return null;
    return (
      visibleClassrooms.find((c) => c.id === activeClassroomId) ||
      (activeClassroomSubject
        ? visibleClassrooms.find((c) => c.subject === activeClassroomSubject) || null
        : null)
    );
  }, [visibleClassrooms, activeClassroomId, activeClassroomSubject]);

  useEffect(() => {
    if (activeClassroomId && !activeClassroom) {
      setActiveClassroomId(null);
      setActiveClassroomSubject(null);
    }
  }, [activeClassroomId, activeClassroom]);

  useEffect(() => {
    onActiveClassroomChange?.(Boolean(activeClassroom));
  }, [activeClassroom, onActiveClassroomChange]);

  const handlePersistAllAutoClassrooms = async () => {
    if (!onSaveBatchClassrooms || autoClassrooms.length === 0 || isSavingBatch) return;
    setIsSavingBatch(true);
    try {
      const materialized = autoClassrooms.map((cls, idx) => materializeClassroomForSave(cls, idx));
      await onSaveBatchClassrooms(materialized);
    } finally {
      setIsSavingBatch(false);
    }
  };

  const handlePersistSingleAutoClassroom = (cls: SubjectClassroom) => {
    if (!onSaveClassroom) return;
    const saved = materializeClassroomForSave(cls, 0);
    onSaveClassroom(saved);
    setActiveClassroomId(saved.id);
    setActiveClassroomSubject(saved.subject);
  };

  const filteredAssignments =
    selectedSubject === 'ทั้งหมด'
      ? assignments
      : assignments.filter((a) => a.subject === selectedSubject);

  if (activeClassroom) {
    return (
      <SubjectClassroomDetailView
        classroom={activeClassroom}
        role={role}
        currentStudentCode={currentStudentCode}
        studentGradeLevel={studentGradeLevel}
        assignments={assignments}
        submissions={submissions}
        resources={resources}
        students={students}
        onBack={() => {
          setActiveClassroomId(null);
          setActiveClassroomSubject(null);
        }}
        onEditClassroom={(cls) => onEditClassroom && onEditClassroom(cls)}
        onDeleteClassroom={(clsId) => {
          setActiveClassroomId(null);
          setActiveClassroomSubject(null);
          if (onDeleteClassroom) onDeleteClassroom(clsId);
        }}
        onPersistAutoClassroom={onSaveClassroom ? handlePersistSingleAutoClassroom : undefined}
        onOpenSubmitModal={onOpenSubmitModal}
        onOpenGradingModal={onOpenGradingModal}
        onOpenHintModal={onOpenHintModal}
        onOpenRosterModal={onOpenRosterModal}
        onDeleteAssignment={onDeleteAssignment}
        onEditAssignment={onEditAssignment}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Classroom Hero Banner with Teacher and Students (Soft harmonious tone) */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 text-white shadow-lg border border-slate-200/80 dark:border-slate-800">
        <img
          src={classroomBannerImg}
          alt="Classroom Teacher and Students"
          className="absolute inset-0 w-full h-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/85 via-indigo-950/70 to-slate-900/60" />
        <div className="relative z-10 px-6 sm:px-8 py-7 sm:py-9 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[11px] font-medium text-indigo-200">
              <School className="w-3.5 h-3.5 text-indigo-300" />
              <span>ห้องเรียนประจำรายวิชา (Classroom Hub)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-prompt text-white tracking-tight">
              บรรยากาศการเรียนการสอนและบทเรียนออนไลน์
            </h2>
            <p className="text-xs sm:text-sm text-slate-200/90 leading-relaxed">
              ศึกษาบทเรียนตามหน่วยการเรียนรู้ เข้าถึงสื่อการสอน วิดีโอ และส่งใบงานประจำวิชาได้อย่างสะดวกครบถ้วนในที่เดียว
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/15 text-xs font-semibold text-indigo-100 shrink-0">
            <BookOpen className="w-4 h-4 text-indigo-300" />
            <span>พร้อมเรียนรู้ออนไลน์ตลอด 24 ชม.</span>
          </div>
        </div>
      </div>

      {/* Subject Selector Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-prompt text-slate-900 dark:text-white">
                ห้องเรียนรายวิชาและคลังใบงาน
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เข้าห้องเรียนประจำรายวิชาเพื่อศึกษาบทเรียนแต่ละหน่วย หรือค้นหาใบงานแยกตามวิชา
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
            {onRestoreWorksheets && (
              <button
                type="button"
                onClick={onRestoreWorksheets}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
                title="กู้คืนใบงานและข้อมูลทั้งหมดของโรงเรียน"
              >
                <Sparkles className="w-4 h-4" />
                <span>กู้คืนใบงานทั้งหมด</span>
              </button>
            )}
            {role === 'teacher' && onOpenCreateClassroom && (
              <button
                type="button"
                onClick={onOpenCreateClassroom}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>สร้างห้องเรียนรายวิชา</span>
              </button>
            )}
            {role === 'teacher' && onOpenSettings && (
              <button
                type="button"
                onClick={() => onOpenSettings('subjects')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
              >
                <Settings className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>จัดการรายวิชา</span>
              </button>
            )}
          </div>
        </div>

        {/* Subject Grid */}
        {role === 'student' && subjects.filter((s) => s !== 'ทั้งหมด').length === 0 ? (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/60 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-center text-xs text-slate-500 dark:text-slate-400">
            ยังไม่มีรายวิชาที่เปิดสอนสำหรับระดับชั้น <strong>{studentGradeLevel || 'ของคุณ'}</strong> ในขณะนี้
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 pt-4">
            {subjects.map((subjName) => {
              const count =
                subjName === 'ทั้งหมด'
                  ? assignments.length
                  : assignments.filter((a) => a.subject === subjName).length;
              const isSelected = selectedSubject === subjName;

              return (
                <button
                  key={subjName}
                  onClick={() => setSelectedSubject(subjName)}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-24 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md font-bold'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-indigo-400'
                  }`}
                >
                  <BookOpen className={`w-5 h-5 ${isSelected ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}`} />
                  <div>
                    <p className="text-xs font-semibold leading-tight line-clamp-1">{subjName}</p>
                    <p className={`text-[10px] font-mono ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {count} ใบงาน
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Subject Classrooms Showcase */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white flex items-center gap-2">
              <School className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span>
                ห้องเรียนรายวิชา {selectedSubject !== 'ทั้งหมด' ? `(${selectedSubject})` : ''}
              </span>
              <span className="text-xs font-mono font-normal text-slate-400 tabular-nums">
                ({visibleClassrooms.length})
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              รวมบทเรียนแยกตามหน่วยการเรียนรู้ สื่อประกอบการสอน และใบงานประจำวิชา
            </p>
          </div>
        </div>

        {/* Auto-Derived Classrooms Sync Banner for Teachers */}
        {role === 'teacher' && autoClassrooms.length > 0 && onSaveBatchClassrooms && (
          <div className="bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/70 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5">
                <Sparkles className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <p className="text-xs font-bold font-prompt text-slate-900 dark:text-white">
                  สร้างห้องเรียนรายวิชาจากข้อมูลเดิมของคุณให้แล้ว ({autoClassrooms.length} วิชา)
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  ดึงรายวิชา ใบงาน สื่อการสอน และตารางสอนเดิมของคุณมาจัดเป็นหน่วยเรียนให้อัตโนมัติ สามารถคลิกเข้าเรียนหรือกดบันทึกลงฐานข้อมูลเพื่อปรับแต่งรหัสวิชาและภาพหน้าปกได้เลย
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={isSavingBatch}
              onClick={handlePersistAllAutoClassrooms}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {isSavingBatch
                  ? 'กำลังบันทึก...'
                  : `บันทึกทั้ง ${autoClassrooms.length} วิชาลงระบบ`}
              </span>
            </button>
          </div>
        )}

        {visibleClassrooms.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-3">
            <School className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <div className="space-y-1">
              <p className="text-sm font-bold font-prompt text-slate-700 dark:text-slate-200">
                ยังไม่มีห้องเรียนรายวิชา{selectedSubject !== 'ทั้งหมด' ? `ในวิชา ${selectedSubject}` : ''}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                {role === 'teacher'
                  ? 'คุณครูสามารถสร้างห้องเรียนประจำวิชา (เช่น ว22103 วิทยาการคำนวณ) พร้อมแบ่งหน่วยการเรียนรู้ เชื่อมสื่อและใบงานที่มีอยู่ได้ทันที'
                  : 'เมื่อคุณครูสร้างห้องเรียนรายวิชาแล้ว จะแสดงรายการให้เข้าเรียนที่นี่'}
              </p>
            </div>
            {role === 'teacher' && onOpenCreateClassroom && (
              <button
                type="button"
                onClick={onOpenCreateClassroom}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>สร้างห้องเรียนรายวิชาแรก</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleClassrooms.map((cls) => {
              const safeCover = sanitizeImageSrc(cls.coverUrl);
              const unitCount = cls.units?.length || 0;
              const linkedCount = cls.units.reduce(
                (acc, u) => acc + (u.linkedAssignmentIds?.length || 0),
                0
              );
              const isAuto = cls.id.startsWith('auto_cls_');

              return (
                <div
                  key={cls.id}
                  onClick={() => {
                    setActiveClassroomId(cls.id);
                    setActiveClassroomSubject(cls.subject);
                  }}
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-400 rounded-2xl overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col cursor-pointer group"
                >
                  {/* Cover Header */}
                  <div className="relative aspect-video bg-slate-900 overflow-hidden">
                    {safeCover ? (
                      <img
                        src={safeCover}
                        alt={cls.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-indigo-400/40" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-transparent" />

                    <div className="absolute bottom-3 left-4 right-4 text-white flex items-end justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-mono font-bold text-indigo-200 block">
                          {cls.courseCode}
                        </span>
                        <h4 className="text-sm sm:text-base font-bold font-prompt leading-snug line-clamp-1">
                          {cls.title}
                        </h4>
                      </div>
                      {cls.isPublished === false && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-300 shrink-0">
                          <EyeOff className="w-3 h-3" />
                          <span>ฉบับร่าง</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                        <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
                          {cls.subject}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1">
                          <GraduationCap className="w-3 h-3" />
                          {cls.gradeLevel}
                        </span>
                      </div>

                      {cls.description && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {cls.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 truncate max-w-[150px]">
                        <User className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{cls.teacherName}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums shrink-0">
                        <Layers className="w-3.5 h-3.5 text-indigo-500" />
                        {unitCount} หน่วย · {linkedCount} งาน
                      </span>
                    </div>
                  </div>

                  {/* Enter Classroom Bar */}
                  <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-950/40 transition-colors">
                    <span className="flex items-center gap-2">
                      <span>เข้าสู่ห้องเรียนรายวิชา</span>
                      {isAuto && role === 'teacher' && (
                        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                          · สร้างจากข้อมูลเดิม
                        </span>
                      )}
                    </span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Room Quick Filter for Current Subject */}
      <div className="bg-white dark:bg-slate-900 px-5 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            วิชา: <strong className="text-indigo-600 dark:text-indigo-400">{selectedSubject}</strong>
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">
            จำแนกตามห้องเรียนที่กำหนดไว้ในระบบ
          </span>
        </div>
      </div>

      {/* Assignment Grid */}
      <div>
        <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white mb-4">
          คลังใบงานวิชา {selectedSubject} ({filteredAssignments.length} รายการ)
        </h3>

        {filteredAssignments.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
            ไม่พบใบงานในวิชา {selectedSubject} ในขณะนี้
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAssignments.map((asg) => {
              const sub = submissions.find((s) => s.assignmentId === asg.id);
              const subCount = submissions.filter((s) => s.assignmentId === asg.id).length;

              return (
                <AssignmentCard
                  key={asg.id}
                  assignment={asg}
                  submission={sub}
                  submissionCount={subCount}
                  role={role}
                  onOpenSubmitModal={onOpenSubmitModal}
                  onOpenGradingModal={onOpenGradingModal}
                  onOpenHintModal={onOpenHintModal}
                  onOpenRosterModal={onOpenRosterModal}
                  onDeleteAssignment={onDeleteAssignment}
                  onEditAssignment={onEditAssignment}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

