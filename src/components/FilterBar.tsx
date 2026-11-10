import React from 'react';
import { Filter, RotateCcw, Settings } from 'lucide-react';
import { FilterState, UserRole } from '../types';
import { SUBJECTS_LIST, GRADE_LEVELS_LIST, STATUS_LIST, CATEGORY_LIST } from '../data/mockData';

interface FilterBarProps {
  filters: FilterState;
  setFilters: React.Dispatch<React.SetStateAction<FilterState>>;
  onResetFilters: () => void;
  resultCount: number;
  gradeLevels?: string[];
  subjects?: string[];
  role?: UserRole;
  studentGradeLevel?: string;
  onOpenManageCategories?: () => void;
  onOpenSettings?: (tab?: 'grades' | 'subjects' | 'students') => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  setFilters,
  onResetFilters,
  resultCount,
  gradeLevels = GRADE_LEVELS_LIST,
  subjects = SUBJECTS_LIST,
  role = 'student',
  studentGradeLevel,
  onOpenManageCategories,
  onOpenSettings,
}) => {
  const isFiltered =
    filters.gradeLevel !== 'ทั้งหมด' ||
    filters.subject !== 'ทั้งหมด' ||
    filters.status !== 'all' ||
    filters.category !== 'ทั้งหมด' ||
    filters.search !== '';

  const activeSubjectsPills = subjects.slice(0, 6);

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800 shadow-xs mb-6">
      <div className="flex flex-col gap-4">
        {/* Top Header Row of Filter Bar */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-semibold font-prompt text-slate-800 dark:text-slate-200">
              ตัวกรองใบงานและการค้นหา
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              (พบ {resultCount} รายการ)
            </span>
          </div>

          <div className="flex items-center gap-3">
            {role === 'teacher' && (onOpenSettings || onOpenManageCategories) && (
              <button
                onClick={() => {
                  if (onOpenSettings) onOpenSettings('grades');
                  else if (onOpenManageCategories) onOpenManageCategories();
                }}
                className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-bold cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>⚙️ เมนูตั้งค่า (ชั้นเรียน / วิชา / นักเรียน)</span>
              </button>
            )}

            {isFiltered && (
              <button
                onClick={onResetFilters}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>ล้างตัวกรองทั้งหมด</span>
              </button>
            )}
          </div>
        </div>

        {/* Dropdowns Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Grade Level Dropdown */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
              <span>ระดับชั้น</span>
              {role === 'student' && studentGradeLevel && (
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                  (ชั้น {studentGradeLevel})
                </span>
              )}
            </label>
            <select
              value={filters.gradeLevel}
              onChange={(e) => setFilters((prev) => ({ ...prev, gradeLevel: e.target.value }))}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {gradeLevels.map((g) => {
                const isStudentGrade = role === 'student' && g === studentGradeLevel;
                return (
                  <option key={g} value={g}>
                    {g === 'ทั้งหมด'
                      ? role === 'student' && studentGradeLevel
                        ? `ทุกระดับชั้น (แสดงเฉพาะ ${studentGradeLevel})`
                        : 'ระดับชั้น (ทั้งหมด)'
                      : isStudentGrade
                      ? `⭐ ชั้น ${g} (ระดับชั้นของคุณ)`
                      : `ชั้น ${g}`}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Subject Dropdown */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              วิชา
            </label>
            <select
              value={filters.subject}
              onChange={(e) => setFilters((prev) => ({ ...prev, subject: e.target.value }))}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {subjects.map((s) => (
                <option key={s} value={s}>
                  {s === 'ทั้งหมด' ? 'วิชาเรียน (ทั้งหมด)' : s}
                </option>
              ))}
            </select>
          </div>

          {/* Submission Status Dropdown */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              สถานะการส่งงาน
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {STATUS_LIST.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              หมวดหมู่
            </label>
            <select
              value={filters.category}
              onChange={(e) => setFilters((prev) => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {CATEGORY_LIST.map((c) => (
                <option key={c} value={c}>
                  {c === 'ทั้งหมด' ? 'หมวดหมู่ (ทั้งหมด)' : c}
                </option>
              ))}
            </select>
          </div>

          {/* Sorting */}
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              เรียงลำดับตาม
            </label>
            <select
              value={filters.dateSort}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  dateSort: e.target.value as FilterState['dateSort'],
                }))
              }
              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              <option value="due_soon">ใกล้กำหนดส่งที่สุด</option>
              <option value="newest">ใบงานล่าสุด</option>
              <option value="points">คะแนนมากไปน้อย</option>
            </select>
          </div>
        </div>

        {/* Quick Filter Buttons (Segmented Controls) */}
        <div className="flex items-center gap-1.5 pt-2 overflow-x-auto text-xs">
          <span className="text-[11px] text-slate-400 shrink-0 mr-1">วิชายอดฮิต:</span>
          {activeSubjectsPills.map((subj) => (
            <button
              key={subj}
              onClick={() => setFilters((prev) => ({ ...prev, subject: subj }))}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors shrink-0 cursor-pointer ${
                filters.subject === subj
                  ? 'bg-indigo-600 text-white font-semibold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {subj}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
