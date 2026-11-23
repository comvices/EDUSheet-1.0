import React, { useState } from 'react';
import { X, Plus, Trash2, Edit2, Check, BookOpen, GraduationCap, Settings } from 'lucide-react';
import { SaveConfirmModal, SaveConfirmDetail } from './SaveConfirmModal';

interface ManageCategoriesModalProps {
  gradeLevels: string[];
  subjects: string[];
  onClose: () => void;
  onAddGradeLevel: (grade: string) => void;
  onRemoveGradeLevel: (grade: string) => void;
  onAddSubject: (subject: string) => void;
  onRemoveSubject: (subject: string) => void;
}

export const ManageCategoriesModal: React.FC<ManageCategoriesModalProps> = ({
  gradeLevels,
  subjects,
  onClose,
  onAddGradeLevel,
  onRemoveGradeLevel,
  onAddSubject,
  onRemoveSubject,
}) => {
  const [activeTab, setActiveTab] = useState<'grades' | 'subjects'>('grades');
  const [newGradeInput, setNewGradeInput] = useState('');
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const [pendingSave, setPendingSave] = useState<{
    title: string;
    description: string;
    details: SaveConfirmDetail[];
    confirmLabel?: string;
    onExecute: () => void;
  } | null>(null);

  const handleAddGrade = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGradeInput.trim();
    if (!trimmed) return;
    setPendingSave({
      title: 'ยืนยันการบันทึกระดับชั้นใหม่?',
      description: 'ระดับชั้นนี้จะถูกเพิ่มลงในระบบ',
      details: [{ label: 'ระดับชั้น', value: trimmed }],
      confirmLabel: 'ยืนยันเพิ่มระดับชั้น',
      onExecute: () => {
        onAddGradeLevel(trimmed);
        setNewGradeInput('');
      },
    });
  };

  const handleAddSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubjectInput.trim();
    if (!trimmed) return;
    setPendingSave({
      title: 'ยืนยันการบันทึกรายวิชาใหม่?',
      description: 'รายวิชานี้จะถูกเพิ่มลงในระบบ',
      details: [{ label: 'รายวิชา', value: trimmed }],
      confirmLabel: 'ยืนยันเพิ่มรายวิชา',
      onExecute: () => {
        onAddSubject(trimmed);
        setNewSubjectInput('');
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950/60 flex items-center justify-between bg-slate-50/90 dark:bg-[var(--theme-surface-dark-elevated)]">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <Settings className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            <h2 className="text-base font-bold font-prompt">
              จัดการระดับชั้นเรียน และรายวิชาเรียน (Teacher Settings)
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-200 dark:border-emerald-950/60 bg-slate-100/70 dark:bg-[var(--theme-surface-dark-elevated)]/70 p-1">
          <button
            onClick={() => setActiveTab('grades')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'grades'
                ? 'bg-white dark:bg-[var(--theme-surface-dark)] text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>จัดการระดับชั้น ({gradeLevels.filter((g) => g !== 'ทั้งหมด').length})</span>
          </button>

          <button
            onClick={() => setActiveTab('subjects')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'subjects'
                ? 'bg-white dark:bg-[var(--theme-surface-dark)] text-emerald-700 dark:text-emerald-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>จัดการรายวิชา ({subjects.filter((s) => s !== 'ทั้งหมด').length})</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh] space-y-5 text-slate-800 dark:text-slate-200">
          {activeTab === 'grades' ? (
            <div className="space-y-4">
              <form onSubmit={handleAddGrade} className="flex gap-2">
                <input
                  type="text"
                  value={newGradeInput}
                  onChange={(e) => setNewGradeInput(e.target.value)}
                  placeholder="พิมพ์ระดับชั้นใหม่ เช่น ป.1, ม.4/1, ปวช.1..."
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-emerald-950/60 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!newGradeInput.trim()}
                  className="theme-btn-sheen px-4 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-bold text-xs rounded-xl transition-all shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  + เพิ่มชั้น
                </button>
              </form>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-slate-500">รายชื่อระดับชั้นปัจจุบัน:</p>
                <div className="flex flex-wrap gap-2">
                  {gradeLevels
                    .filter((g) => g !== 'ทั้งหมด')
                    .map((g) => (
                      <div
                        key={g}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-semibold"
                      >
                        <span>ชั้น {g}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveGradeLevel(g)}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                          title={`ลบระดับชั้น ${g}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleAddSubjectSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={newSubjectInput}
                  onChange={(e) => setNewSubjectInput(e.target.value)}
                  placeholder="พิมพ์ชื่อวิชาใหม่ เช่น หุ่นยนต์, ดนตรีไทย, ฟิสิกส์..."
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-300 dark:border-emerald-950/60 rounded-xl text-xs focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
                <button
                  type="submit"
                  disabled={!newSubjectInput.trim()}
                  className="theme-btn-sheen px-4 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-bold text-xs rounded-xl transition-all shrink-0 disabled:opacity-50 cursor-pointer"
                >
                  + เพิ่มวิชา
                </button>
              </form>

              <div className="space-y-2 pt-2">
                <p className="text-xs font-semibold text-slate-500">รายชื่อวิชาเรียนปัจจุบัน:</p>
                <div className="flex flex-wrap gap-2">
                  {subjects
                    .filter((s) => s !== 'ทั้งหมด')
                    .map((s) => (
                      <div
                        key={s}
                        className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-semibold"
                      >
                        <span>วิชา {s}</span>
                        <button
                          type="button"
                          onClick={() => onRemoveSubject(s)}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                          title={`ลบวิชา ${s}`}
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-emerald-950/60 bg-slate-50/90 dark:bg-[var(--theme-surface-dark-elevated)] flex justify-end">
          <button
            onClick={onClose}
            className="theme-btn-sheen px-5 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-xs"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>

      <SaveConfirmModal
        isOpen={Boolean(pendingSave)}
        title={pendingSave?.title}
        description={pendingSave?.description}
        details={pendingSave?.details}
        confirmLabel={pendingSave?.confirmLabel}
        onConfirm={() => {
          if (!pendingSave) return;
          pendingSave.onExecute();
          setPendingSave(null);
        }}
        onCancel={() => setPendingSave(null)}
      />
    </div>
  );
};
