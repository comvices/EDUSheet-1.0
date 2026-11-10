import React from 'react';
import { X, Bell, CheckCircle2, AlertTriangle, Edit3, FilePlus, Check } from 'lucide-react';
import { NotificationItem, Assignment } from '../types';

interface NotificationDrawerProps {
  notifications: NotificationItem[];
  assignments: Assignment[];
  isOpen: boolean;
  onClose: () => void;
  onMarkAllRead: () => void;
  onSelectAssignment: (assignmentId: string) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  notifications,
  assignments,
  isOpen,
  onClose,
  onMarkAllRead,
  onSelectAssignment,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-xs" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                การแจ้งเตือนกำหนดส่งและใบงาน
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Mark Read bar */}
          <div className="px-4 py-2 bg-slate-100 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">
              มี {notifications.filter((n) => !n.isRead).length} รายการที่ยังไม่ได้อ่าน
            </span>
            <button
              onClick={onMarkAllRead}
              className="inline-flex items-center gap-1 text-indigo-600 dark:text-indigo-400 hover:underline font-semibold"
            >
              <Check className="w-3.5 h-3.5" />
              <span>ทำเครื่องหมายว่าอ่านแล้ว</span>
            </button>
          </div>

          {/* List */}
          <div className="p-4 overflow-y-auto space-y-3 flex-1">
            {notifications.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">
                ไม่มีการแจ้งเตือนในขณะนี้
              </div>
            ) : (
              notifications.map((notif) => {
                const matchedAsg = assignments.find((a) => a.id === notif.assignmentId);

                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (matchedAsg) {
                        onSelectAssignment(notif.assignmentId);
                        onClose();
                      }
                    }}
                    className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                      !notif.isRead
                        ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-900 shadow-2xs'
                        : 'bg-slate-50/50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">
                        {notif.type === 'due_soon' ? (
                          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="w-4 h-4" />
                          </div>
                        ) : notif.type === 'graded' ? (
                          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-4 h-4" />
                          </div>
                        ) : notif.type === 'revision' ? (
                          <div className="p-2 rounded-lg bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
                            <Edit3 className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                            <FilePlus className="w-4 h-4" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between text-[11px] mb-1">
                          <span className="font-bold text-slate-900 dark:text-white truncate">
                            {notif.title}
                          </span>
                          <span className="text-slate-400 shrink-0 font-mono text-[10px]">
                            {notif.date}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 leading-snug">
                          {notif.message}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
