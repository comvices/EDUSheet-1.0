import React from 'react';
import { GraduationCap, BookOpen, ChevronRight, Settings } from 'lucide-react';
import { Assignment, Submission, UserRole } from '../types';
import { AssignmentCard } from './AssignmentCard';

interface GradeLevelViewProps {
  assignments: Assignment[];
  submissions: Submission[];
  role: UserRole;
  studentGradeLevel?: string;
  selectedGrade: string;
  setSelectedGrade: (grade: string) => void;
  onOpenSubmitModal: (assignment: Assignment) => void;
  onOpenGradingModal: (assignment: Assignment, submission?: Submission) => void;
  onOpenHintModal: (assignment: Assignment) => void;
  onOpenRosterModal?: (assignment: Assignment) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  onEditAssignment?: (assignmentId: Assignment) => void;
  gradeLevels?: string[];
  onOpenSettings?: (tab?: 'grades' | 'subjects' | 'students') => void;
}

export const GradeLevelView: React.FC<GradeLevelViewProps> = ({
  assignments,
  submissions,
  role,
  studentGradeLevel,
  selectedGrade,
  setSelectedGrade,
  onOpenSubmitModal,
  onOpenGradingModal,
  onOpenHintModal,
  onOpenRosterModal,
  onDeleteAssignment,
  onEditAssignment,
  gradeLevels = ['ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
  onOpenSettings,
}) => {
  const activeGradeList = gradeLevels.filter((g) => g !== 'ทั้งหมด');

  const filteredAssignments =
    selectedGrade === 'ทั้งหมด'
      ? assignments
      : assignments.filter((a) => a.gradeLevel === selectedGrade);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-prompt text-slate-900 dark:text-white">
                ค้นหาใบงานตามระดับชั้นเรียน
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เลือกระดับชั้นเรียน เพื่อดูใบงานเฉพาะระดับชั้น
              </p>
            </div>
          </div>

          {role === 'teacher' && onOpenSettings && (
            <button
              onClick={() => onOpenSettings('grades')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0 self-start sm:self-auto"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>⚙️ จัดการระดับชั้น (เมนูตั้งค่า)</span>
            </button>
          )}
        </div>

        {/* Student Grade Banner */}
        {role === 'student' && studentGradeLevel && (
          <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl flex items-center gap-2 text-xs text-amber-800 dark:text-amber-200">
            <span>
              🔒 คุณกำลังเข้าใช้งานในสิทธิ์นักเรียนระดับชั้น <strong>{studentGradeLevel}</strong> — ระบบเปิดให้คุณมองเห็นเฉพาะใบงานของระดับชั้น <strong>{studentGradeLevel}</strong> เพื่อความเป็นส่วนตัวแยกตามระดับชั้น
            </span>
          </div>
        )}

        {/* Grade Selection Grid */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2 pt-4">
          <button
            onClick={() => setSelectedGrade('ทั้งหมด')}
            className={`py-2 px-3 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              selectedGrade === 'ทั้งหมด'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            ทุกระดับชั้น
          </button>

          {activeGradeList.map((g) => {
            const count = assignments.filter((a) => a.gradeLevel === g).length;
            const isStudentGrade = role === 'student' && g === studentGradeLevel;

            return (
              <button
                key={g}
                onClick={() => setSelectedGrade(g)}
                className={`py-2 px-3 rounded-xl text-xs font-medium transition-all flex flex-col items-center cursor-pointer relative ${
                  selectedGrade === g
                    ? 'bg-indigo-600 text-white shadow-sm font-bold'
                    : isStudentGrade
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-semibold'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                <span>ชั้น {g}</span>
                <span className="text-[10px] opacity-75 font-mono">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Assignment Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
            ใบงานในระดับชั้น {selectedGrade} ({filteredAssignments.length} รายการ)
          </h3>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs space-y-2">
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              ไม่พบใบงานสำหรับระดับชั้น {selectedGrade}
            </p>
            {role === 'student' && studentGradeLevel && selectedGrade !== studentGradeLevel && (
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                🔒 ใบงานของระดับชั้น {selectedGrade} สงวนไว้เฉพาะนักเรียนในระดับชั้น {selectedGrade} เท่านั้น (คุณถูกลงทะเบียนในระดับชั้น {studentGradeLevel})
              </p>
            )}
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
