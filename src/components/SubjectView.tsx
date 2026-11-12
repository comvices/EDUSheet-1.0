import React from 'react';
import { BookOpen, Atom, Calculator, Languages, Globe, Laptop, Palette, Settings } from 'lucide-react';
import { Assignment, Submission, UserRole } from '../types';
import { AssignmentCard } from './AssignmentCard';

interface SubjectViewProps {
  assignments: Assignment[];
  submissions: Submission[];
  role: UserRole;
  selectedSubject: string;
  setSelectedSubject: (subject: string) => void;
  onOpenSubmitModal: (assignment: Assignment) => void;
  onOpenGradingModal: (assignment: Assignment, submission?: Submission) => void;
  onOpenHintModal: (assignment: Assignment) => void;
  onOpenRosterModal?: (assignment: Assignment) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  onEditAssignment?: (assignment: Assignment) => void;
  subjects?: string[];
  onOpenSettings?: (tab?: 'grades' | 'subjects' | 'students') => void;
}

export const SubjectView: React.FC<SubjectViewProps> = ({
  assignments,
  submissions,
  role,
  selectedSubject,
  setSelectedSubject,
  onOpenSubmitModal,
  onOpenGradingModal,
  onOpenHintModal,
  onOpenRosterModal,
  onDeleteAssignment,
  onEditAssignment,
  subjects = ['ทั้งหมด', 'วิทยาศาสตร์', 'คณิตศาสตร์', 'ภาษาไทย', 'ภาษาอังกฤษ', 'สังคมศึกษา', 'เทคโนโลยี/คอมพิวเตอร์', 'ศิลปะและดนตรี'],
  onOpenSettings,
}) => {
  const filteredAssignments =
    selectedSubject === 'ทั้งหมด'
      ? assignments
      : assignments.filter((a) => a.subject === selectedSubject);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold font-prompt text-slate-900 dark:text-white">
                ค้นหาและจัดหมวดหมู่ตามรายวิชา
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                เลือกวิชาเรียนเพื่อเข้าถึงคลังใบงาน โจทย์แบบฝึกหัด และข้อสอบประจำวิชา
              </p>
            </div>
          </div>

          {role === 'teacher' && onOpenSettings && (
            <button
              onClick={() => onOpenSettings('subjects')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-colors shrink-0 self-start sm:self-auto"
            >
              <Settings className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>⚙️ จัดการรายวิชา (เมนูตั้งค่า)</span>
            </button>
          )}
        </div>

        {/* Subject Grid */}
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
      </div>

      {/* Room Quick Filter for Current Subject */}
      <div className="bg-white dark:bg-slate-900 px-5 py-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-300">
            วิชา: <strong className="text-indigo-600 dark:text-indigo-400">{selectedSubject}</strong>
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-500">
            จำแนกตามห้องเรียน ม.1/1 - ม.6/3
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
