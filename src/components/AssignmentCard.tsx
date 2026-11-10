import React, { useState } from 'react';
import { Calendar, Clock, FileText, CheckCircle2, AlertCircle, Edit3, HelpCircle, Eye, ChevronRight, Award, Trash2 } from 'lucide-react';
import { Assignment, Submission, UserRole } from '../types';

interface AssignmentCardProps {
  assignment: Assignment;
  submission?: Submission;
  submissionCount?: number;
  role: UserRole;
  onOpenSubmitModal: (assignment: Assignment) => void;
  onOpenGradingModal: (assignment: Assignment, submission?: Submission) => void;
  onOpenHintModal: (assignment: Assignment) => void;
  onOpenRosterModal?: (assignment: Assignment) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  onEditAssignment?: (assignment: Assignment) => void;
}

export const AssignmentCard: React.FC<AssignmentCardProps> = ({
  assignment,
  submission,
  submissionCount = 0,
  role,
  onOpenSubmitModal,
  onOpenGradingModal,
  onOpenHintModal,
  onOpenRosterModal,
  onDeleteAssignment,
  onEditAssignment,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Calculate relative due date status
  const now = new Date();
  const dueDate = new Date(assignment.dueDate);
  const diffHours = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  const isOverdue = diffHours < 0 && (!submission || submission.status === 'pending');
  const isDueSoon = diffHours > 0 && diffHours <= 24 && (!submission || submission.status === 'pending');

  // Format date readable in Thai
  const formattedDueDate = dueDate.toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between h-full group relative">
      <div>
        {/* Unboxed Metadata Line (Zero-Pill Discipline) */}
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
          <div className="flex items-center gap-1.5 font-medium">
            <span className="text-indigo-600 dark:text-indigo-400 font-bold">ชั้น {assignment.gradeLevel}</span>
            <span aria-hidden="true">·</span>
            <span>{assignment.subject}</span>
            <span aria-hidden="true">·</span>
            <span>{assignment.category}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-mono tabular-nums text-slate-600 dark:text-slate-300 font-semibold">
              {assignment.totalPoints} คะแนน
            </span>

            {/* Teacher Actions: Edit & Trash */}
            {role === 'teacher' && (
              <div className="flex items-center gap-1">
                {onEditAssignment && (
                  <button
                    onClick={() => onEditAssignment(assignment)}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md transition-colors"
                    title="แก้ไขใบงานนี้"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                )}
                {onDeleteAssignment && (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
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
        <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {assignment.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-4">
          {assignment.description}
        </p>

        {/* Due Date Indicator & Status Ribbon */}
        <div className="flex items-center justify-between text-xs py-2 px-3 bg-slate-50 dark:bg-slate-800/60 rounded-lg mb-4 border border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <span>กำหนดส่ง: {formattedDueDate}</span>
          </div>

          {/* Status badge pill */}
          {submission ? (
            submission.status === 'graded' ? (
              <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
                <Award className="w-3.5 h-3.5" />
                {submission.score}/{submission.maxScore} คะแนน
              </span>
            ) : submission.status === 'needs_revision' ? (
              <span className="flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                ให้แก้ไข
              </span>
            ) : (
              <span className="flex items-center gap-1 font-medium text-sky-600 dark:text-sky-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                ส่งแล้ว (รอตรวจ)
              </span>
            )
          ) : isOverdue ? (
            <span className="flex items-center gap-1 font-bold text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-3.5 h-3.5" />
              เกินกำหนดส่ง
            </span>
          ) : isDueSoon ? (
            <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400 animate-pulse">
              <Clock className="w-3.5 h-3.5" />
              เหลืออีก {Math.ceil(diffHours)} ชม.
            </span>
          ) : (
            <span className="text-slate-500 font-medium">ยังไม่ได้ส่ง</span>
          )}
        </div>
      </div>

      {/* Footer Actions */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <span className="text-[11px] text-slate-400 truncate">
          {role === 'teacher' && submissionCount > 0
            ? `ส่งงานแล้ว ${submissionCount} คน`
            : `โดย ${assignment.teacherName}`}
        </span>

        <div className="flex items-center gap-2">
          {/* AI Hint button for students */}
          {role === 'student' && (!submission || submission.status === 'needs_revision') && (
            <button
              onClick={() => onOpenHintModal(assignment)}
              className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 rounded-lg transition-colors"
              title="ขอคำแนะนำ/คำใบ้จาก AI"
            >
              <HelpCircle className="w-4 h-4" />
            </button>
          )}

          {/* Primary Action Button */}
          {role === 'student' ? (
            <button
              onClick={() => onOpenSubmitModal(assignment)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                submission?.status === 'graded'
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900'
                  : submission?.status === 'submitted'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                  : submission?.status === 'needs_revision'
                  ? 'bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-xs'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs'
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
              ) : (
                <>
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>พิมพ์ส่งงาน</span>
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => {
                if (onOpenRosterModal && (submissionCount > 1 || assignment.id === 'asg_101')) {
                  onOpenRosterModal(assignment);
                } else {
                  onOpenGradingModal(assignment, submission);
                }
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer"
            >
              <span>{submissionCount > 1 || assignment.id === 'asg_101' ? `ดูรายชื่อส่งงาน (${submissionCount || 20} คน)` : 'ตรวจใบงานนี้'}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal Overlay */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
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
