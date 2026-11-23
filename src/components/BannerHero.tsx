import React from 'react';
import { Search, Clock, AlertTriangle, CheckCircle, FileText, PlusCircle } from 'lucide-react';
import { UserRole, StudentProfile, TeacherProfile } from '../types';
import { HeroSvgOrnaments } from './ThemeGraphics';
import heroBannerImg from '../assets/images/hero_green_academy_1795146588887.jpg';

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
    <div className="relative overflow-hidden rounded-3xl theme-hero-surface text-white shadow-lg border border-emerald-400/25 dark:border-emerald-800/45 mb-8 group theme-transition">
      {/* Background Media with theme-reactive scrim & SVG graphics */}
      <img
        src={heroBannerImg}
        alt="EduSheet Academy Workspace"
        referrerPolicy="no-referrer"
        className="absolute inset-0 w-full h-full object-cover opacity-35 transition-transform duration-700 group-hover:scale-[1.015]"
      />
      <div className="absolute inset-0 theme-hero-scrim" />
      <div className="absolute inset-0 edu-hero-grid opacity-30 pointer-events-none" />
      <HeroSvgOrnaments variant="home" />
      <div
        className="absolute -right-20 -top-20 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-25"
        style={{ backgroundColor: 'var(--theme-svg-primary)' }}
      />

      <div className="relative z-10 px-6 sm:px-10 py-8 sm:py-11 max-w-5xl">
        {/* Kicker */}
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-200/95 mb-2 font-prompt">
          <span>{role === 'student' ? 'ศูนย์รวมใบงานและการเรียนรู้ออนไลน์' : 'ระบบบริหารจัดการและตรวจใบงานออนไลน์'}</span>
          <span aria-hidden="true">·</span>
          <span>ภาคเรียนที่ 2/2569</span>
        </div>

        {/* Title */}
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight font-prompt text-white mb-3 text-balance leading-tight">
          {role === 'student'
            ? `สวัสดี ${student.name} พร้อมเรียนและส่งงานวันนี้หรือยัง?`
            : `สวัสดี ${teacher.name} จัดการบทเรียนและตรวจใบงานได้ทันที`}
        </h1>

        <p className="text-sm sm:text-base text-emerald-50/85 max-w-2xl mb-6 leading-relaxed">
          {role === 'student'
            ? 'ทำใบงาน พิมพ์คำตอบหรือแนบภาพวิธีทำส่งงานออนไลน์ ตรวจสอบคะแนน และติดตามกำหนดส่งได้ครบในระบบเดียว'
            : 'จัดการใบงานออนไลน์ ตรวจและให้คะแนนการตอบของนักเรียนด้วย AI ผู้ช่วยวิเคราะห์ และออกใบงานใหม่ได้อย่างเป็นระบบ'}
        </p>

        {/* Search Bar (Teacher only) & Primary Quick Action */}
        {role === 'teacher' ? (
          <div className="flex flex-col sm:flex-row gap-3 max-w-2xl mb-8">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-200/75" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ค้นหาชื่อใบงาน, วิชา, ระดับชั้น หรือคำสั่ง..."
                className="w-full pl-10 pr-4 py-2.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-sm text-white placeholder-emerald-100/55 focus:outline-hidden focus:ring-2 focus:ring-emerald-400 focus:bg-white/15 transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-200/80 hover:text-white cursor-pointer"
                >
                  ล้างคำค้น
                </button>
              )}
            </div>

            <button
              onClick={onOpenCreateWorksheet}
              className="theme-btn-sheen inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-semibold rounded-xl text-sm shadow-lg shadow-emerald-950/40 ring-1 ring-inset ring-white/20 transition-all shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>สร้างใบงานใหม่</span>
            </button>
          </div>
        ) : (
          dueSoonCount > 0 && (
            <div className="mb-8">
              <button
                onClick={onQuickFilterDueSoon}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-slate-950 font-semibold rounded-xl text-xs sm:text-sm shadow-md transition-all active:scale-[0.98] cursor-pointer"
              >
                <AlertTriangle className="w-4 h-4" />
                <span>ดูใบงานใกล้ส่ง ({dueSoonCount})</span>
              </button>
            </div>
          )
        )}

        {/* Stats Strip (Full-width desktop row) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 pt-4 border-t border-white/15">
          <div className="bg-white/8 hover:bg-white/12 backdrop-blur-md p-3.5 rounded-xl border border-white/12 transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between text-emerald-100/75 text-xs mb-1">
              <span>ใบงานทั้งหมด</span>
              <FileText className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-white">
              {totalCount} <span className="text-xs font-normal text-emerald-100/60">รายการ</span>
            </div>
          </div>

          <div className="bg-white/8 hover:bg-white/12 backdrop-blur-md p-3.5 rounded-xl border border-white/12 transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between text-emerald-100/75 text-xs mb-1">
              <span>ยังไม่ได้ส่ง</span>
              <Clock className="w-4 h-4 text-amber-300" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-amber-200">
              {pendingCount} <span className="text-xs font-normal text-emerald-100/60">ใบงาน</span>
            </div>
          </div>

          <div className="bg-white/8 hover:bg-white/12 backdrop-blur-md p-3.5 rounded-xl border border-white/12 transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between text-emerald-100/75 text-xs mb-1">
              <span>ส่งแล้ว / ตรวจแล้ว</span>
              <CheckCircle className="w-4 h-4 text-emerald-300" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-emerald-200">
              {submittedCount} <span className="text-xs font-normal text-emerald-100/60">รายการ</span>
            </div>
          </div>

          <div className="bg-white/8 hover:bg-white/12 backdrop-blur-md p-3.5 rounded-xl border border-white/12 transition-all duration-200 hover:-translate-y-0.5">
            <div className="flex items-center justify-between text-emerald-100/75 text-xs mb-1">
              <span>ใกล้กำหนดส่ง (&lt;24 ชม.)</span>
              <AlertTriangle className="w-4 h-4 text-rose-300" />
            </div>
            <div className="text-xl sm:text-2xl font-bold font-mono tabular-nums text-rose-200">
              {dueSoonCount} <span className="text-xs font-normal text-emerald-100/60">ใบงาน</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
