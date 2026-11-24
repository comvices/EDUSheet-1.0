import React, { useState } from 'react';
import { Calendar, Clock, FileText, CheckCircle2, AlertCircle, Edit3, HelpCircle, Eye, ChevronRight, Award, Trash2, Users, Copy } from 'lucide-react';
import { Assignment, Submission, UserRole } from '../types';
import { CardCornerOrnament } from './ThemeGraphics';
import { findStudentGroup } from '../utils/groupHelpers';

interface AssignmentCardProps {
  assignment: Assignment;
  submission?: Submission;
  submissionCount?: number;
  role: UserRole;
  currentStudentCode?: string;
  onOpenSubmitModal: (assignment: Assignment) => void;
  onOpenGradingModal: (assignment: Assignment, submission?: Submission) => void;
  onOpenHintModal: (assignment: Assignment) => void;
  onOpenRosterModal?: (assignment: Assignment) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  onEditAssignment?: (assignment: Assignment) => void;
  onCloneAssignment?: (assignment: Assignment) => void;
}

export const AssignmentCard: React.FC<AssignmentCardProps> = ({
  assignment,
  submission,
  submissionCount = 0,
  role,
  currentStudentCode,
  onOpenSubmitModal,
  onOpenGradingModal,
  onOpenHintModal,
  onOpenRosterModal,
  onDeleteAssignment,
  onEditAssignment,
  onCloneAssignment,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Calculate relative due date status
  const now = new Date();
  const dueDate = new Date(assignment.dueDate);
  const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  const isOverdue = diffHours < 0 && (!submission || submission.status === 'pending');
  const isDueSoon = diffHours > 0 && diffHours <= 24 && (!submission || submission.status === 'pending');
  const isGroupWork = assignment.workMode === 'group';
  const myGroup = role === 'student' ? findStudentGroup(assignment, currentStudentCode) : undefined;

  // Format date readable in Thai
  const formattedDueDate = dueDate.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="theme-card-interactive overflow-hidden bg-white dark:bg-[var(--theme-surface-dark)] rounded-2xl border border-emerald-200/75 dark:border-emerald-950/75 p-5 shadow-2xs hover:border-emerald-400 dark:hover:border-emerald-700/80 hover:-translate-y-0.5 flex flex-col justify-between h-full group relative">
      <CardCornerOrnament className="absolute -top-2 -right-2 w-24 h-24 opacity-60 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative z-10">
        {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-emerald-700 dark:text-emerald-400 font-bold">ชั้น {assignment.gradeLevel}</span>
            <span aria-hidden="true">·</span>
            <span>{assignment.subject}</span>
            <span aria-hidden="true">·</span>
            <span>{assignment.category}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 font-semibold">
              {assignment.totalPoints} คะแนน
            </span>

            {/* Teacher Actions: Clone, Edit & Trash */}
            {role === 'teacher' && (
              <div className="flex items-center gap-1">
                {onCloneAssignment && (
                  <button
                    onClick={() => onCloneAssignment(assignment)}
                    className="p-1 text-slate-400 hover:text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-md transition-colors cursor-pointer"
                    title="คัดลอกใบงานไปห้องอื่น"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                )}
                {onEditAssignment && (
                  <button
                    onClick={() => onEditAssignment(assignment)}
                    className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-md transition-colors cursor-pointer"
                    title="แก้ไขใบงานนี้"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDeleteAssignment && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors cursor-pointer"
                    title="ลบใบงานนี้"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">
          {assignment.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-2.5 leading-relaxed">
          {assignment.description}
        </p>

        {/* Section, Question Count & Group Work Summary (Unboxed Metadata Line) */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500 dark:text-slate-400 font-medium mb-3">
          <span>
            {assignment.sections && assignment.sections.length > 0
              ? `${assignment.sections.length} ตอน · ${assignment.questions.length} ข้อ`
              : `${assignment.questions.length} ข้อ`}
          </span>
          {isGroupWork && (
            <>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-bold text-teal-700 dark:text-teal-300">
                <Users className="w-3 h-3" />
                {role === 'student'
                  ? myGroup
                    ? `กลุ่ม: ${myGroup.name} (${myGroup.memberCodes.length} คน)`
                    : `งานกลุ่ม (สูงสุด ${assignment.groupSettings?.maxGroupSize || 4} คน)`
                  : `งานกลุ่ม (${assignment.groups?.length || 0} กลุ่ม)`}
              </span>
            </>
          )}
        </div>

        {/* Teacher-only Assignment Visibility Indicator */}
        {role === 'teacher' && (assignment.isPublished === false || (assignment.assignedStudentCodes && assignment.assignedStudentCodes.length > 0)) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2.5 text-[11px]">
            {assignment.isPublished === false && (
              <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-bold">
                ฉบับร่าง (ซ่อนจากนักเรียน)
              </span>
            )}
            {assignment.assignedStudentCodes && assignment.assignedStudentCodes.length > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 font-bold">
                มอบหมายเฉพาะ {assignment.assignedStudentCodes.length} คน
              </span>
            )}
          </div>
        )}

        {/* Due Date Indicator & Status Ribbon */}
        <div className="flex items-center justify-between text-xs py-2 px-3 theme-soft-surface dark:bg-slate-800/60 rounded-xl mb-4 border border-emerald-900/10 dark:border-emerald-900/40">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-emerald-700/60 dark:text-emerald-400/70" />
            <span>กำหนดส่ง: {formattedDueDate}</span>
          </div>

          {/* Status badge */}
          {submission && submission.status !== 'pending' ? (
            submission.status === 'graded' ? (
              <span className="flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-400 tabular-nums">
                <Award className="w-3.5 h-3.5" />
                {submission.score}/{submission.maxScore} คะแนน
              </span>
            ) : submission.status === 'needs_revision' ? (
              <span className="flex items-center gap-1 font-semibold text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                ให้แก้ไข
              </span>
            ) : (
              <span className="flex items-center gap-1 font-medium text-teal-700 dark:text-teal-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ส่งแล้ว (รอตรวจ)
              </span>
            )
          ) : submission?.status === 'pending' ? (
            <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              {isGroupWork ? 'ร่างงานกลุ่ม' : 'กำลังทำร่าง'}
            </span>
          ) : isOverdue ? (
            <span className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
              เกินกำหนดส่ง
            </span>
          ) : isDueSoon ? (
            <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
              <Clock className="w-3.5 h-3.5" />
              เหลืออีก {Math.ceil(diffHours)} ชม.
            </span>
          ) : (
            <span className="text-slate-500 font-medium">ยังไม่ได้ส่ง</span>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-3 border-t border-slate-100 dark:border-emerald-950/60 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400 truncate">
          {role === 'teacher' && submissionCount > 0
            ? `ส่งงานแล้ว ${submissionCount} คน`
            : `โดย ${assignment.teacherName}`}
        </span>

        <div className="flex items-center gap-2">
          {/* AI Hint button for students */}
          {role === 'student' && (!submission || submission.status === 'pending' || submission.status === 'needs_revision') && (
            <button
              onClick={() => onOpenHintModal(assignment)}
              className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors cursor-pointer"
              title="ขอคำแนะนำ/คำใบ้จาก AI"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}

          {/* Primary Action Button */}
          {role === 'student' ? (
            <button
              onClick={() => onOpenSubmitModal(assignment)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer active:scale-[0.98] ${
                submission?.status === 'graded'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 border border-emerald-200/80 dark:border-emerald-800'
                  : submission?.status === 'submitted'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  : submission?.status === 'needs_revision'
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
                  : 'bg-emerald-700 hover:bg-emerald-800 text-white shadow-xs'
              }`}
            >
              {submission?.status === 'graded' ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>ดูผลการตรวจ</span>
                </>
              ) : submission?.status === 'submitted' ? (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  <span>ดูใบงานที่ส่ง</span>
                </>
              ) : submission?.status === 'needs_revision' ? (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>แก้ไขใบงาน</span>
                </>
              ) : submission?.status === 'pending' ? (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isGroupWork ? 'ทำใบงานกลุ่มต่อ' : 'ทำใบงานต่อ'}</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isGroupWork ? 'เข้ากลุ่ม / ทำใบงาน' : 'ทำและส่งใบงาน'}</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                if (onOpenRosterModal && (isGroupWork || submissionCount > 1 || assignment.id === 'asg_101')) {
                  onOpenRosterModal(assignment);
                } else {
                  onOpenGradingModal(assignment, submission);
                }
              }}
              className="theme-btn-sheen inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <span>
                {isGroupWork
                  ? `จัดการกลุ่ม / ตรวจงาน (${submissionCount})`
                  : submissionCount > 1 || assignment.id === 'asg_101'
                  ? `ดูรายชื่อส่งงาน (${submissionCount || 20} คน)`
                  : 'ตรวจใบงานนี้'}
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal Overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600 dark:text-rose-400">
              <div className="p-3 bg-rose-100 dark:bg-rose-950 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                ยืนยันการลบใบงานนี้?
              </h4>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              คุณกำลังจะลบใบงาน <strong className="text-slate-900 dark:text-white">"{assignment.title}"</strong> ข้อมูลคำถามและประวัติการส่งงานทั้งหมดของนักเรียนในใบงานนี้จะถูกลบออกจากระบบอย่างถาวร
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>

              <button
                type="button"
                onClick={() => {
                  if (onDeleteAssignment) {
                    onDeleteAssignment(assignment.id);
                  }
                  setShowDeleteConfirm(false);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                ยืนยันการลบใบงาน
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
