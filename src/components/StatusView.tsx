import React from 'react';
import { Clock, CheckCircle2, AlertCircle, Award, RotateCcw, Filter } from 'lucide-react';
import { Assignment, Submission, UserRole } from '../types';
import { AssignmentCard } from './AssignmentCard';

interface StatusViewProps {
  assignments: Assignment[];
  submissions: Submission[];
  role: UserRole;
  selectedStatus: string;
  setSelectedStatus: (status: string) => void;
  onOpenSubmitModal: (assignment: Assignment) => void;
  onOpenGradingModal: (assignment: Assignment, submission?: Submission) => void;
  onOpenHintModal: (assignment: Assignment) => void;
  onOpenRosterModal?: (assignment: Assignment) => void;
  onDeleteAssignment?: (assignmentId: string) => void;
  onEditAssignment?: (assignment: Assignment) => void;
}

export const StatusView: React.FC<StatusViewProps> = ({
  assignments,
  submissions,
  role,
  selectedStatus,
  setSelectedStatus,
  onOpenSubmitModal,
  onOpenGradingModal,
  onOpenHintModal,
  onOpenRosterModal,
  onDeleteAssignment,
  onEditAssignment,
}) => {
  // Helper to test if assignment matches status
  const filterByStatus = (asg: Assignment) => {
    const sub = submissions.find((s) => s.assignmentId === asg.id);
    const now = new Date();
    const dueDate = new Date(asg.dueDate);
    const isOverdue = dueDate.getTime() < now.getTime() && (!sub || sub.status === 'pending');

    if (selectedStatus === 'all') return true;
    if (selectedStatus === 'pending') return (!sub || sub.status === 'pending') && !isOverdue;
    if (selectedStatus === 'submitted') return sub?.status === 'submitted';
    if (selectedStatus === 'needs_revision') return sub?.status === 'needs_revision';
    if (selectedStatus === 'graded') return sub?.status === 'graded';
    if (selectedStatus === 'overdue') return isOverdue;
    return true;
  };

  const filteredAssignments = assignments.filter(filterByStatus);

  const STATUS_CARDS = [
    { id: 'all', label: 'ทั้งหมด', icon: Filter, color: 'text-emerald-700 dark:text-emerald-400' },
    { id: 'pending', label: 'ยังไม่ได้ส่ง', icon: Clock, color: 'text-amber-600' },
    { id: 'submitted', label: 'ส่งแล้ว (รอตรวจ)', icon: CheckCircle2, color: 'text-teal-600' },
    { id: 'needs_revision', label: 'ให้กลับไปแก้ไข', icon: RotateCcw, color: 'text-orange-600' },
    { id: 'graded', label: 'ตรวจแล้ว/ผ่าน', icon: Award, color: 'text-emerald-600' },
    { id: 'overdue', label: 'เกินกำหนดส่ง', icon: AlertCircle, color: 'text-rose-600' },
  ];

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="bg-white dark:bg-[#111c18] p-6 rounded-2xl border border-slate-200/80 dark:border-emerald-950/70 shadow-xs">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-prompt text-slate-900 dark:text-white">
              ติดตามสถานะการส่งและตรวจงาน
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              ติดตามสถานะความคืบหน้าของใบงาน แยกตามงานที่รอดำเนินการ ตรวจแล้ว และเกินกำหนดส่ง
            </p>
          </div>
        </div>

        {/* Status Filter Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-4">
          {STATUS_CARDS.map((st) => {
            const Icon = st.icon;
            const count = assignments.filter((asg) => {
              const sub = submissions.find((s) => s.assignmentId === asg.id);
              const now = new Date();
              const isOverdue = new Date(asg.dueDate).getTime() < now.getTime() && (!sub || sub.status === 'pending');
              if (st.id === 'all') return true;
              if (st.id === 'pending') return (!sub || sub.status === 'pending') && !isOverdue;
              if (st.id === 'submitted') return sub?.status === 'submitted';
              if (st.id === 'needs_revision') return sub?.status === 'needs_revision';
              if (st.id === 'graded') return sub?.status === 'graded';
              if (st.id === 'overdue') return isOverdue;
              return false;
            }).length;

            const isSelected = selectedStatus === st.id;

            return (
              <button
                key={st.id}
                onClick={() => setSelectedStatus(st.id)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between h-20 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-br from-emerald-700 to-teal-700 text-white border-emerald-700 shadow-md shadow-emerald-900/15 font-bold -translate-y-0.5'
                    : 'bg-[#f7f9f7] dark:bg-slate-800/60 border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:border-emerald-400 hover:-translate-y-0.5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Icon className={`w-4 h-4 ${isSelected ? 'text-white' : st.color}`} />
                  <span className={`text-xs font-mono font-bold ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                    {count}
                  </span>
                </div>
                <p className="text-xs font-semibold leading-tight">{st.label}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Assignment List */}
      <div>
        <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white mb-4">
          รายการใบงาน ({filteredAssignments.length} รายการ)
        </h3>

        {filteredAssignments.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-[#111c18] rounded-xl border border-slate-200 dark:border-emerald-950/60 text-slate-400 text-xs">
            ไม่พบรายการใบงานในสถานะนี้
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
