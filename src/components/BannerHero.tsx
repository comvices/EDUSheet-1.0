import React from 'react';
import { Search, Clock, AlertTriangle, CheckCircle, FileText, Sparkles, PlusCircle } from 'lucide-react';
import { UserRole, StudentProfile, TeacherProfile } from '../types';
import heroBannerImg from '../assets/images/hero_worksheet_banner_1794303086797.jpg';

interface BannerHeroProps {
  role: UserRole;
  student: StudentProfile;
  teacher: TeacherProfile;
  totalCount: number;
  pendingCount: number;
  submittedCount: number;
  dueSoonCount: number;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onQuickFilterDueSoon: () => void;
  onOpenCreateWorksheet: () => void;
}

export const BannerHero: React.FC<BannerHeroProps> = ({
  role,
  student,
  teacher,
  totalCount,
  pendingCount,
  submittedCount,
  dueSoonCount,
  searchTerm,
  setSearchTerm,
  onQuickFilterDueSoon,
  onOpenCreateWorksheet,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-slate-900 text-white shadow-xl mb-8">
      {/* Background Media with overlay gradient */}
      <img
        src={heroBannerImg}
        alt="EduSheet Hero Workspace"
        className="absolute inset-0 w-full h-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-900/80 to-indigo-950/70" />

      <div className="relative z-10 px-6 sm:px-10 py-8 sm:py-12 max-w-5xl">
        {/* Kicker */}
        <div className="flex items-center gap-2 text-xs font-medium text-indigo-300 mb-2 font-prompt">
          <span>{role === 'student' ? 'ศูนย์รวมใบงานและการเรียนรู้ออนไลน์' : 'ระบบบริหารจัดการและตรวจใบงานออนไลน์'}</span>
          <span aria-hidden="true">·</span>
          <span>ภาคเรียนที่ 2/2569</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight font-prompt text-white mb-3 text-wrap-balance">
          {role === 'student'
            ? `สวัสดี ${student.name} 👋 พร้อมเรียนและส่งงานวันนี้หรือยัง?`
            : `สวัสดี ${teacher.name} 📚 ตรวจใบงานและสร้างโจทย์ใหม่ได้ทันที`}
        </h1>

        <p className="text-sm sm:text-base text-slate-300 max-w-2xl mb-6">
          {role === 'student'
            ? 'ค้นหาใบงาน พิมพ์คำตอบส่งงานออนไลน์ ตรวจสอบคะแนน และติดตามการแจ้งเตือนกำหนดส่งได้ในระบบเดียว'
            : 'จัดการใบงานออนไลน์ ตรวจและให้คะแนนการตอบของนักเรียนด้วยระบบ AI ช่วยวิเคราะห์ และออกใบงานใหม่ในไม่กี่วินาที'}
        </p>

        {/* Search Bar & Action Input */}
        <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mb-8">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อใบงาน, วิชา, ระดับชั้น หรือคำสั่ง..."
              className="w-full pl-10 pr-4 py-2.5 bg-white/10 dark:bg-slate-800/60 backdrop-blur border border-white/20 dark:border-slate-700/60 rounded-xl text-sm text-white placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-400 transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white"
              >
                ล้างคำค้น
              </button>
            )}
          </div>

          {role === 'teacher' ? (
            <button
              onClick={onOpenCreateWorksheet}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-indigo-600/30 transition-all shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>สร้างใบงานใหม่</span>
            </button>
          ) : (
            dueSoonCount > 0 && (
              <button
                onClick={onQuickFilterDueSoon}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all shrink-0 cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>ดูใบงานใกล้ส่ง ({dueSoonCount})</span>
              </button>
            )
          )}
        </div>

        {/* Stats Strip (Full-width desktop row) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-white/10">
          <div className="bg-white/5 backdrop-blur p-3.5 rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>ใบงานทั้งหมด</span>
              <FileText className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
              {totalCount} <span className="text-xs font-normal text-slate-400">รายการ</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur p-3.5 rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>ยังไม่ได้ส่ง</span>
              <Clock className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-300">
              {pendingCount} <span className="text-xs font-normal text-slate-400">ใบงาน</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur p-3.5 rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>ส่งแล้ว / ตรวจแล้ว</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-300">
              {submittedCount} <span className="text-xs font-normal text-slate-400">รายการ</span>
            </div>
          </div>

          <div className="bg-white/5 backdrop-blur p-3.5 rounded-xl border border-white/10">
            <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
              <span>ใกล้กำหนดส่ง (&lt;24 ชม.)</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-300">
              {dueSoonCount} <span className="text-xs font-normal text-slate-400">ใบงาน</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
