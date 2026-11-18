import React, { useState } from 'react';
import {
  X,
  Clock,
  Plus,
  Trash2,
  Save,
  Coffee,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { PeriodConfig } from '../types';
import { DEFAULT_PERIOD_CONFIGS } from '../data/mockData';

interface PeriodSettingsModalProps {
  periodConfigs: PeriodConfig[];
  onClose: () => void;
  onSavePeriodConfigs: (nextConfigs: PeriodConfig[]) => void;
}

function addMinutesToTime(timeStr: string, minutesToAdd: number): string {
  const [hStr, mStr] = (timeStr || '08:30').split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return '08:30';
  const total = h * 60 + m + minutesToAdd;
  const nextH = Math.floor(total / 60) % 24;
  const nextM = total % 60;
  return `${String(nextH).padStart(2, '0')}:${String(nextM).padStart(2, '0')}`;
}

export const PeriodSettingsModal: React.FC<PeriodSettingsModalProps> = ({
  periodConfigs,
  onClose,
  onSavePeriodConfigs,
}) => {
  const [draftPeriods, setDraftPeriods] = useState<PeriodConfig[]>(() =>
    periodConfigs.length > 0 ? periodConfigs.map((p) => ({ ...p })) : DEFAULT_PERIOD_CONFIGS.map((p) => ({ ...p }))
  );
  const [errorMsg, setErrorMsg] = useState<string>('');

  const handleUpdateRow = (id: string, patch: Partial<PeriodConfig>) => {
    setDraftPeriods((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  };

  const handleToggleBreak = (id: string, nextIsBreak: boolean) => {
    setDraftPeriods((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        return {
          ...row,
          isBreak: nextIsBreak,
          label: nextIsBreak
            ? row.label.startsWith('คาบที่')
              ? 'พักเที่ยง'
              : row.label
            : row.label === 'พักเที่ยง' || row.label === 'คาบพัก'
            ? `คาบที่ ${row.period > 0 ? row.period : 1}`
            : row.label,
          period: nextIsBreak ? 0 : row.period === 0 ? 1 : row.period,
        };
      })
    );
  };

  const handleMoveRow = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= draftPeriods.length) return;
    setDraftPeriods((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIdx];
      next[targetIdx] = temp;
      return next;
    });
  };

  const handleAddTeachingPeriod = () => {
    const existingNums = draftPeriods.filter((p) => !p.isBreak && p.period > 0).map((p) => p.period);
    const nextNum = Math.min(12, existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1);
    const lastRow = draftPeriods[draftPeriods.length - 1];
    const start = lastRow ? lastRow.endTime : '08:30';
    const end = addMinutesToTime(start, 50);

    setDraftPeriods((prev) => [
      ...prev,
      {
        id: `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        period: nextNum,
        label: `คาบที่ ${nextNum}`,
        startTime: start,
        endTime: end,
        isBreak: false,
      },
    ]);
  };

  const handleAddBreakPeriod = () => {
    const hasLunch = draftPeriods.some((p) => p.isBreak);
    const label = hasLunch ? 'คาบพักเบรก' : 'พักเที่ยง';
    const start = hasLunch ? '10:10' : '11:50';
    const end = hasLunch ? '10:25' : '12:50';

    const newBreak: PeriodConfig = {
      id: `p_break_${Date.now()}`,
      period: 0,
      label,
      startTime: start,
      endTime: end,
      isBreak: true,
    };

    // Insert after Period 4 if adding lunch and Period 4 exists
    if (!hasLunch) {
      const idx4 = draftPeriods.findIndex((p) => p.period === 4);
      if (idx4 >= 0) {
        setDraftPeriods((prev) => [
          ...prev.slice(0, idx4 + 1),
          newBreak,
          ...prev.slice(idx4 + 1),
        ]);
        return;
      }
    }

    setDraftPeriods((prev) => [...prev, newBreak]);
  };

  const handleDeleteRow = (id: string) => {
    if (draftPeriods.length <= 1) return;
    setDraftPeriods((prev) => prev.filter((p) => p.id !== id));
  };

  const handleResetDefault = () => {
    setDraftPeriods(DEFAULT_PERIOD_CONFIGS.map((p) => ({ ...p })));
    setErrorMsg('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    for (const row of draftPeriods) {
      if (!row.label.trim()) {
        setErrorMsg('กรุณาระบุชื่อคาบให้ครบทุกแถว');
        return;
      }
      if (!row.startTime || !row.endTime) {
        setErrorMsg(`กรุณาระบุเวลาเริ่มและสิ้นสุดสำหรับ "${row.label}"`);
        return;
      }
      if (row.period < 0 || row.period > 12) {
        setErrorMsg('เลขคาบต้องอยู่ระหว่าง 0 ถึง 12');
        return;
      }
    }

    onSavePeriodConfigs(
      draftPeriods.map((row) => ({
        ...row,
        label: row.label.trim(),
      }))
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                ตั้งค่าคาบเรียน และคาบพักเที่ยง
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                กำหนดจำนวนคาบ ช่วงเวลาเรียน และคาบพักเที่ยงให้ตรงกับตารางสอนจริงของโรงเรียน
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAddTeachingPeriod}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>เพิ่มคาบเรียน</span>
              </button>

              <button
                type="button"
                onClick={handleAddBreakPeriod}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Coffee className="w-3.5 h-3.5" />
                <span>เพิ่มคาบพักเที่ยง / พักเบรก</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetDefault}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ค่ามาตรฐาน (รวมพักเที่ยง)</span>
            </button>
          </div>

          {/* Period List */}
          <div className="space-y-2.5">
            {draftPeriods.map((row, idx) => (
              <div
                key={row.id}
                className={`p-3 rounded-xl border transition-colors flex flex-col md:flex-row md:items-center gap-2.5 ${
                  row.isBreak
                    ? 'bg-amber-50/70 dark:bg-amber-950/25 border-amber-200 dark:border-amber-800/70'
                    : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                }`}
              >
                {/* Order Controls + Type Badge */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => handleMoveRow(idx, -1)}
                      disabled={idx === 0}
                      className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-25 cursor-pointer"
                      title="เลื่อนขึ้น"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveRow(idx, 1)}
                      disabled={idx === draftPeriods.length - 1}
                      className="p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-25 cursor-pointer"
                      title="เลื่อนลง"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleBreak(row.id, !row.isBreak)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer min-w-[100px] justify-center ${
                      row.isBreak
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white dark:bg-slate-900 text-indigo-700 dark:text-indigo-300 border-slate-200 dark:border-slate-700 hover:bg-indigo-50'
                    }`}
                    title="คลิกเพื่อสลับระหว่าง คาบสอน กับ คาบพักเที่ยง/พักเบรก"
                  >
                    {row.isBreak ? (
                      <>
                        <Coffee className="w-3.5 h-3.5" />
                        <span>คาบพักเที่ยง</span>
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        <span>คาบสอน</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Name + Period Number + Time Inputs */}
                <div className="grid grid-cols-2 sm:grid-cols-12 gap-2 flex-1 items-center">
                  <div className="col-span-2 sm:col-span-4">
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      ชื่อคาบ
                    </label>
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => handleUpdateRow(row.id, { label: e.target.value })}
                      placeholder="เช่น คาบที่ 1 หรือ พักเที่ยง"
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="col-span-2 sm:col-span-2">
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      เลขคาบ (0=พัก)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={12}
                      value={row.period}
                      onChange={(e) =>
                        handleUpdateRow(row.id, {
                          period: Math.max(0, Math.min(12, Number(e.target.value) || 0)),
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-center text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      เวลาเริ่ม
                    </label>
                    <input
                      type="time"
                      value={row.startTime}
                      onChange={(e) => handleUpdateRow(row.id, { startTime: e.target.value })}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="col-span-1 sm:col-span-3">
                    <label className="block text-[10px] font-semibold text-slate-400 mb-0.5">
                      เวลาสิ้นสุด
                    </label>
                    <input
                      type="time"
                      value={row.endTime}
                      onChange={(e) => handleUpdateRow(row.id, { endTime: e.target.value })}
                      className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Delete Row */}
                <button
                  type="button"
                  onClick={() => handleDeleteRow(row.id)}
                  disabled={draftPeriods.length <= 1}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition-colors self-end md:self-center disabled:opacity-30 cursor-pointer"
                  title="ลบคาบนี้"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
            💡 <strong>คำแนะนำ:</strong> สามารถตั้ง <strong>เลขคาบเป็น 0</strong> สำหรับ{' '}
            <strong>พักเที่ยง</strong> เพื่อไม่ให้ทับซ้อนกับคาบเรียนที่ 1–8 หรือจะกำหนดเลขคาบเองได้ (0–12)
            ตารางสอนรายสัปดาห์และฟอร์มเพิ่มคาบสอนจะใช้ช่วงเวลาที่ตั้งค่านี้โดยอัตโนมัติ
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800 sticky bottom-0 bg-white dark:bg-slate-900">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>บันทึกการตั้งค่าคาบเรียน</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
