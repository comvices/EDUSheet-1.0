import React, { useEffect } from 'react';
import { CheckCircle2, Save, X } from 'lucide-react';

export interface SaveConfirmDetail {
  label: string;
  value: string;
}

interface SaveConfirmModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  details?: SaveConfirmDetail[];
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'emerald' | 'indigo' | 'amber';
  onConfirm: () => void;
  onCancel: () => void;
}

export const SaveConfirmModal: React.FC<SaveConfirmModalProps> = ({
  isOpen,
  title = 'ยืนยันการบันทึกข้อมูล?',
  description = 'กรุณาตรวจสอบรายละเอียดให้ถูกต้องก่อนบันทึกลงระบบ',
  details = [],
  confirmLabel = 'ยืนยันการบันทึก',
  cancelLabel = 'ตรวจสอบอีกครั้ง',
  variant = 'emerald',
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const iconBoxClasses =
    variant === 'amber'
      ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
      : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400';

  const confirmBtnClasses =
    variant === 'amber'
      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-500/20'
      : 'bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 shadow-emerald-900/20';

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div className="bg-white dark:bg-[#111c18] border border-slate-200 dark:border-emerald-950/60 rounded-2xl w-full max-w-md shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${iconBoxClasses}`}
            >
              <Save className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white leading-snug">
                {title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่างยืนยัน"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {details.length > 0 && (
          <div className="bg-slate-50 dark:bg-[#0d1613]/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl p-3.5 space-y-2 text-xs">
            {details.map((item, idx) => (
              <div
                key={`${item.label}_${idx}`}
                className="flex items-start justify-between gap-3"
              >
                <span className="text-slate-500 dark:text-slate-400 shrink-0">
                  {item.label}:
                </span>
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-right break-words">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`flex-1 py-2.5 px-4 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer ${confirmBtnClasses}`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
