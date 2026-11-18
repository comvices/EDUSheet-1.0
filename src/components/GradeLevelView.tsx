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
  gradeLevels = ['ทั้งหมด'],
  onOpenSettings,
}) => {
  const activeGradeList = gradeLevels.filter((g) => g && g !== 'ทั้งหมด');
  const baseLevels = Array.from(
    new Set(
      activeGradeList.map((g) =>
        g.includes('/') ? g.split('/')[0] : g.replace(/\s*\(ทุกห้อง\)$/, '')
      )
    )
  );

  const filteredAssignments =
    role === 'student' || selectedGrade === 'ทั้งหมด'
      ? assignments
      : assignments.filter((a) => {
          if (a.gradeLevel === selectedGrade) return true;
          if (selectedGrade.includes('/')) {
            const baseLevel = selectedGrade.split('/')[0];
            if (a.gradeLevel === baseLevel || a.gradeLevel === `${baseLevel} (ทุกห้อง)`) return true;
          }
          return false;
        });

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
                {role === 'student'
                  ? `ใบงานประจำระดับชั้น ${studentGradeLevel || selectedGrade}`
                  : 'ค้นหาใบงานตามระดับชั้นเรียน'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {role === 'student'
                  ? 'แสดงใบงานทั้งหมดที่ครูผู้สอนกำหนดไว้สำหรับระดับชั้นเรียนของคุณ'
                  : 'เลือกระดับชั้นเรียน เพื่อดูใบงานเฉพาะระดับชั้น'}
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

        {/* Secondary Level Grouping & Room Selector (Teacher Only) */}
        {role === 'teacher' && (
          <div className="space-y-3 pt-3">
            {activeGradeList.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>ยังไม่มีระดับชั้นหรือห้องเรียนที่คุณสร้างในระบบ</span>
                {onOpenSettings && (
                  <button
                    type="button"
                    onClick={() => onOpenSettings('grades')}
                    className="text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer self-start sm:self-auto"
                  >
                    + เพิ่มระดับชั้น/ห้องเรียนในเมนูตั้งค่า
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Main Grade Levels Bar (derived strictly from user-created levels) */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    onClick={() => setSelectedGrade('ทั้งหมด')}
                    className={`py-2 px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedGrade === 'ทั้งหมด'
                        ? 'bg-indigo-600 text-white shadow-sm font-bold'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200'
                    }`}
                  >
                    ทุกระดับชั้น
                  </button>

                  {baseLevels.map((level) => {
                    const isCurrentLevelActive =
                      selectedGrade === level ||
                      selectedGrade.startsWith(`${level}/`) ||
                      selectedGrade === `${level} (ทุกห้อง)`;

                    const levelCount = assignments.filter(
                      (a) =>
                        a.gradeLevel === level ||
                        a.gradeLevel.startsWith(`${level}/`) ||
                        a.gradeLevel === `${level} (ทุกห้อง)`
                    ).length;

                    return (
                      <button
                        key={level}
                        onClick={() => {
                          const firstMatchingRoom =
                            activeGradeList.find((g) => g.startsWith(`${level}/`)) ||
                            activeGradeList.find((g) => g === level) ||
                            level;
                          setSelectedGrade(firstMatchingRoom);
                        }}
                        className={`py-2 px-3.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                          isCurrentLevelActive
                            ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                        }`}
                      >
                        <span>ชั้น {level}</span>
                        <span
                          className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                            isCurrentLevelActive
                              ? 'bg-white/20 text-white dark:bg-black/20 dark:text-slate-900'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {levelCount}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Sub-level Room Tabs (strictly user-created rooms) */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-[11px] font-medium text-slate-400 mr-1">
                    เลือกดูตามห้อง:
                  </span>
                  {activeGradeList.map((g) => {
                    const count = assignments.filter((a) => {
                      if (a.gradeLevel === g) return true;
                      if (g.includes('/')) {
                        const baseLevel = g.split('/')[0];
                        if (a.gradeLevel === baseLevel || a.gradeLevel === `${baseLevel} (ทุกห้อง)`) return true;
                      }
                      return false;
                    }).length;
                    const isSelected = selectedGrade === g;

                    return (
                      <button
                        key={g}
                        onClick={() => setSelectedGrade(g)}
                        className={`py-1.5 px-3 rounded-xl text-xs transition-all flex items-center gap-1.5 cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-sm font-bold ring-2 ring-indigo-400/30'
                            : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                        }`}
                      >
                        <span>ชั้น {g}</span>
                        <span className="text-[10px] font-mono opacity-80">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Assignment Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
            ใบงานในระดับชั้น {role === 'student' ? (studentGradeLevel || selectedGrade) : selectedGrade} ({filteredAssignments.length} รายการ)
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
