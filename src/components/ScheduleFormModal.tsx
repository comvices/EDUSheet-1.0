import React, { useState, useEffect } from 'react';
import { X, CalendarClock, AlertTriangle, Save, Plus, Clock, Coffee } from 'lucide-react';
import { DayOfWeek, PeriodConfig, TeacherProfile, TeachingSchedule } from '../types';
import { DAYS_OF_WEEK_LIST, DEFAULT_PERIOD_CONFIGS } from '../data/mockData';

interface ScheduleFormModalProps {
  editingSchedule: TeachingSchedule | null;
  teachersList: TeacherProfile[];
  currentTeacher: TeacherProfile;
  subjectsList: string[];
  gradeLevelsList: string[];
  existingSchedules: TeachingSchedule[];
  periodConfigs?: PeriodConfig[];
  onClose: () => void;
  onSaveSchedule: (schedule: TeachingSchedule) => void;
}

export const ScheduleFormModal: React.FC<ScheduleFormModalProps> = ({
  editingSchedule,
  teachersList,
  currentTeacher,
  subjectsList,
  gradeLevelsList,
  existingSchedules,
  periodConfigs = DEFAULT_PERIOD_CONFIGS,
  onClose,
  onSaveSchedule,
}) => {
  const activePeriods = periodConfigs.length > 0 ? periodConfigs : DEFAULT_PERIOD_CONFIGS;
  const defaultPeriodObj = activePeriods.find((p) => !p.isBreak) || activePeriods[0];

  const selectableSubjects = subjectsList.filter((s) => s !== 'ทั้งหมด');
  const selectableGrades = gradeLevelsList.filter((g) => g !== 'ทั้งหมด');

  const initialPeriod = editingSchedule?.period ?? defaultPeriodObj.period;
  const initialPeriodMeta =
    activePeriods.find((p) => p.period === initialPeriod) || defaultPeriodObj;

  const [teacherId, setTeacherId] = useState<string>(
    editingSchedule?.teacherId || currentTeacher.id
  );
  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(
    editingSchedule?.dayOfWeek || 'monday'
  );
  const [period, setPeriod] = useState<number>(initialPeriod);
  const [startTime, setStartTime] = useState<string>(
    editingSchedule?.startTime || initialPeriodMeta.startTime
  );
  const [endTime, setEndTime] = useState<string>(
    editingSchedule?.endTime || initialPeriodMeta.endTime
  );
  const [subject, setSubject] = useState<string>(
    editingSchedule?.subject || selectableSubjects[0] || ''
  );
  const [gradeLevel, setGradeLevel] = useState<string>(
    editingSchedule?.gradeLevel || selectableGrades[0] || ''
  );
  const [classroom, setClassroom] = useState<string>(
    editingSchedule?.classroom || ''
  );
  const [note, setNote] = useState<string>(editingSchedule?.note || '');
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (!editingSchedule) {
      const preset = activePeriods.find((p) => p.period === period);
      if (preset) {
        setStartTime(preset.startTime);
        setEndTime(preset.endTime);
      }
    }
  }, [period, editingSchedule, activePeriods]);

  const handlePeriodChange = (nextPeriod: number) => {
    setPeriod(nextPeriod);
    const preset = activePeriods.find((p) => p.period === nextPeriod);
    if (preset) {
      setStartTime(preset.startTime);
      setEndTime(preset.endTime);
    }
  };

  const selectedPeriodConfig = activePeriods.find((p) => p.period === period);

  const selectedTeacher =
    teachersList.find((t) => t.id === teacherId) || currentTeacher;

  const conflictingSchedule = existingSchedules.find(
    (s) =>
      s.id !== editingSchedule?.id &&
      s.teacherId === teacherId &&
      s.dayOfWeek === dayOfWeek &&
      s.period === period
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!subject.trim()) {
      setErrorMsg('กรุณาระบุรายวิชา');
      return;
    }
    if (!gradeLevel.trim()) {
      setErrorMsg('กรุณาระบุระดับชั้น/ห้องเรียน');
      return;
    }
    if (!startTime || !endTime) {
      setErrorMsg('กรุณาระบุเวลาเริ่มและสิ้นสุดคาบเรียน');
      return;
    }

    const scheduleData: TeachingSchedule = {
      id: editingSchedule ? editingSchedule.id : `sch_${Date.now()}`,
      teacherId: selectedTeacher.id,
      teacherCode: selectedTeacher.code,
      teacherName: selectedTeacher.name,
      dayOfWeek,
      period,
      startTime,
      endTime,
      subject: subject.trim(),
      gradeLevel: gradeLevel.trim(),
      ...(classroom.trim() ? { classroom: classroom.trim() } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
    };

    onSaveSchedule(scheduleData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                {editingSchedule ? 'แก้ไขคาบสอนในตารางสอน' : 'เพิ่มคาบสอนในตารางสอน'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                กำหนดข้อมูลรายวิชา ห้องเรียน และคาบเวลา เพื่อใช้อ้างอิงในการเช็คชื่อ
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {conflictingSchedule && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <div>
                <p className="font-bold">พบคาบสอนซ้ำซ้อนสำหรับครูท่านนี้</p>
                <p className="mt-0.5">
                  วันและคาบนี้มีวิชา <strong>{conflictingSchedule.subject}</strong> (ชั้น{' '}
                  {conflictingSchedule.gradeLevel}) อยู่แล้ว กรุณาตรวจสอบก่อนบันทึก
                </p>
              </div>
            </div>
          )}

          {selectedPeriodConfig?.isBreak && (
            <div className="p-3 bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/70 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
              <Coffee className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                ช่วงเวลานี้เป็น <strong>{selectedPeriodConfig.label}</strong> (สามารถใช้บันทึกกิจกรรมชมรม ชุมนุม หรือคาบสอนเสริมได้)
              </span>
            </div>
          )}

          {/* Teacher */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              ครูผู้สอน
            </label>
            <select
              value={teacherId}
              onChange={(e) => setTeacherId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {teachersList.map((tch) => (
                <option key={tch.id} value={tch.id}>
                  {tch.name} ({tch.code}) — {tch.subject}
                </option>
              ))}
            </select>
          </div>

          {/* Day of Week */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
              วันสอนประจำสัปดาห์
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {DAYS_OF_WEEK_LIST.map((d) => {
                const isSelected = dayOfWeek === d.id;
                return (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDayOfWeek(d.id)}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span className="hidden sm:inline">{d.label}</span>
                    <span className="sm:hidden">{d.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Period & Time */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                คาบเรียน
              </label>
              <select
                value={period}
                onChange={(e) => handlePeriodChange(Number(e.target.value))}
                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {activePeriods.map((p) => (
                  <option key={p.id} value={p.period}>
                    {p.isBreak ? `☕ ${p.label}` : p.label} ({p.startTime}-{p.endTime})
                  </option>
                ))}
                {!activePeriods.some((p) => p.period === period) && (
                  <option value={period}>
                    {period === 0 ? 'พักเที่ยง' : `คาบที่ ${period}`}
                  </option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                เวลาเริ่ม
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                เวลาสิ้นสุด
              </label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Subject & Grade/Room */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                รายวิชาที่สอน
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {selectableSubjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
                {!selectableSubjects.includes(subject) && subject && (
                  <option value={subject}>{subject}</option>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                ระดับชั้น / ห้องเรียน
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {selectableGrades.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
                {!selectableGrades.includes(gradeLevel) && gradeLevel && (
                  <option value={gradeLevel}>{gradeLevel}</option>
                )}
              </select>
            </div>
          </div>

          {/* Classroom & Note */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                สถานที่ / ห้องปฏิบัติการ (ไม่บังคับ)
              </label>
              <input
                type="text"
                value={classroom}
                onChange={(e) => setClassroom(e.target.value)}
                placeholder="เช่น ห้อง 312, ห้องวิทย์ 1"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                หมายเหตุเพิ่มเติม (ไม่บังคับ)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="เช่น คาบซ่อมเสริม, สลับกลุ่ม A/B"
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
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
              {editingSchedule ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{editingSchedule ? 'บันทึกการแก้ไขคาบสอน' : 'เพิ่มลงตารางสอน'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
