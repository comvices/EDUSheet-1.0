import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Bell,
  UserCheck,
  GraduationCap,
  Plus,
  LogOut,
  KeyRound,
  Settings,
  Users,
  Menu,
  X,
  Home,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  ChevronDown,
  Moon,
  Sun,
  FolderOpen,
} from 'lucide-react';
import { UserRole, StudentProfile, TeacherProfile } from '../types';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  unreadNotifCount: number;
  onOpenNotifs: () => void;
  onOpenCreateWorksheet: () => void;
  onOpenManageCategories?: () => void;
  onOpenManageStudents?: () => void;
  onOpenSettings?: (tab?: 'grades' | 'subjects' | 'students' | 'teachers') => void;
  onOpenLoginModal: () => void;
  onLogOut: () => void;
  student: StudentProfile;
  teacher: TeacherProfile;
  isLoggedIn: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  role,
  setRole,
  unreadNotifCount,
  onOpenNotifs,
  onOpenCreateWorksheet,
  onOpenManageCategories,
  onOpenManageStudents,
  onOpenSettings,
  onOpenLoginModal,
  onLogOut,
  student,
  teacher,
  isLoggedIn,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsDropdownOpen, setSettingsDropdownOpen] = useState(false);
  const settingsDropdownRef = useRef<HTMLDivElement | null>(null);

  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved) return saved === 'dark';
      return document.documentElement.classList.contains('dark') || window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
    } catch (e) {}
  }, [isDarkMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        settingsDropdownRef.current &&
        !settingsDropdownRef.current.contains(event.target as Node)
      ) {
        setSettingsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTabClick = (tabKey: string) => {
    setActiveTab(tabKey);
    setMobileMenuOpen(false);
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 sm:gap-6 h-16">
            {/* Zone 1: Logo & Wordmark */}
            <button
              onClick={() => handleTabClick('home')}
              className="flex items-center gap-2 sm:gap-2.5 text-left text-slate-900 dark:text-white whitespace-nowrap shrink-0 group focus:outline-hidden cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <BookOpen className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              </div>
              <div>
                <span className="text-lg sm:text-xl font-bold tracking-tight font-prompt text-slate-900 dark:text-white block leading-none">
                  EduSheet <span className="text-indigo-600 dark:text-indigo-400">TH</span>
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
                  ระบบจัดเก็บ & ตรวจใบงานออนไลน์
                </span>
              </div>
            </button>

            {/* Zone 2: Navigation Links (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1 xl:gap-2 font-medium text-sm text-slate-600 dark:text-slate-300">
              <button
                onClick={() => handleTabClick('home')}
                className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'home'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                หน้าแรก
              </button>
              <button
                onClick={() => handleTabClick('grades')}
                className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'grades'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                ระดับชั้น
              </button>
              <button
                onClick={() => handleTabClick('subjects')}
                className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'subjects'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                วิชาเรียน
              </button>
              <button
                onClick={() => handleTabClick('statuses')}
                className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'statuses'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                สถานะการส่งงาน
              </button>
              <button
                onClick={() => handleTabClick('resources')}
                className={`px-3 py-2 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'resources'
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 font-semibold'
                    : 'hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-rose-500" />
                <span>คลังสื่อเรียนรู้</span>
              </button>
            </nav>

            {/* Zone 3: Actions, Tools & Role Selector */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Teacher Actions (Desktop) */}
              {role === 'teacher' && (
                <div className="hidden xl:flex items-center gap-2">
                  {/* Unified Settings Menu with Split Button & Dropdown */}
                  <div ref={settingsDropdownRef} className="relative inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 shadow-2xs">
                    <button
                      onClick={() => {
                        setSettingsDropdownOpen(false);
                        if (onOpenSettings) onOpenSettings();
                        else if (onOpenManageCategories) onOpenManageCategories();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-l-lg text-xs font-semibold transition-colors cursor-pointer group"
                      title="เปิดหน้าต่างเมนูตั้งค่าระบบ"
                    >
                      <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400 group-hover:rotate-45 transition-transform" />
                      <span>เมนูตั้งค่า</span>
                    </button>

                    <button
                      onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                      className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-r-lg border-l border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
                      title="เลือกหมวดหมู่ตั้งค่าด่วน"
                      aria-label="ตัวเลือกหมวดหมู่ตั้งค่า"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${settingsDropdownOpen ? 'rotate-180 text-indigo-600' : ''}`}
                      />
                    </button>

                    {/* Quick Settings Dropdown */}
                    {settingsDropdownOpen && (
                      <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3.5 py-1.5 border-b border-slate-100 dark:border-slate-800 text-[11px] font-bold text-slate-400 font-prompt flex items-center justify-between">
                          <span>⚙️ เมนูตั้งค่าระบบ</span>
                          <span className="text-[10px] text-indigo-600 dark:text-indigo-400">Settings</span>
                        </div>
                        <button
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            if (onOpenSettings) onOpenSettings('grades');
                            else if (onOpenManageCategories) onOpenManageCategories();
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer"
                        >
                          <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <div>
                            <span className="block font-semibold">1. จัดการชั้นเรียน</span>
                            <span className="block text-[10px] text-slate-400">เพิ่ม/ลบ ระดับชั้นเรียน</span>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            if (onOpenSettings) onOpenSettings('subjects');
                            else if (onOpenManageCategories) onOpenManageCategories();
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                          <div>
                            <span className="block font-semibold">2. จัดการรายวิชา</span>
                            <span className="block text-[10px] text-slate-400">เพิ่ม/ลบ รายวิชาเรียน</span>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            if (onOpenSettings) onOpenSettings('students');
                            else if (onOpenManageStudents) onOpenManageStudents();
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer border-t border-slate-100 dark:border-slate-800"
                        >
                          <Users className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <div>
                            <span className="block font-semibold">3. จัดการนักเรียน</span>
                            <span className="block text-[10px] text-slate-400">นำเข้า Excel / รหัสผ่าน</span>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            if (onOpenSettings) onOpenSettings('teachers');
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-sky-50 dark:hover:bg-sky-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer border-t border-slate-100 dark:border-slate-800"
                        >
                          <UserCheck className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                          <div>
                            <span className="block font-semibold">4. จัดการครูผู้สอน</span>
                            <span className="block text-[10px] text-slate-400">เพิ่ม / ลบ / แก้ไขครู</span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={onOpenCreateWorksheet}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>สร้างใบงานใหม่</span>
                  </button>
                </div>
              )}

              {/* Theme Toggle (Dark/Light Mode) */}
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title={isDarkMode ? 'เปลี่ยนเป็นโหมดสว่าง' : 'เปลี่ยนเป็นโหมดถนอมสายตา (โหมดมืด)'}
                aria-label="สลับโหมดการแสดงผล"
              >
                {isDarkMode ? (
                  <Sun className="w-4.5 h-4.5 text-amber-400 animate-in zoom-in-75 duration-150" />
                ) : (
                  <Moon className="w-4.5 h-4.5 text-slate-600 animate-in zoom-in-75 duration-150" />
                )}
              </button>

              {/* Notification Bell */}
              <button
                onClick={onOpenNotifs}
                className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                title="การแจ้งเตือนกำหนดส่ง"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-xs animate-pulse">
                    {unreadNotifCount}
                  </span>
                )}
              </button>



              {/* Account Status / Logged In User Pill */}
              {isLoggedIn ? (
                <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-800">
                  <img
                    src={role === 'student' ? student.avatar : teacher.avatar}
                    alt="Profile Avatar"
                    className="w-8 h-8 rounded-full object-cover ring-2 ring-indigo-500/30 shrink-0"
                  />
                  <div className="text-left text-xs">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[110px]">
                      {role === 'student' ? student.name : teacher.name}
                    </p>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                      {role === 'student' ? `${student.code}` : teacher.subject}
                    </p>
                  </div>

                  <button
                    onClick={onLogOut}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors ml-0.5 cursor-pointer"
                    title="ออกจากระบบ / สลับบัญชี"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenLoginModal}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                </button>
              )}

              {/* Hamburger Button for Mobile Drawer */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                aria-label="เปิดเมนูหลัก"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Slide-down Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-3 pb-6 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-150">
            {/* User Profile Card Mobile */}
            {isLoggedIn ? (
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-3">
                  <img
                    src={role === 'student' ? student.avatar : teacher.avatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500"
                  />
                  <div>
                    <p className="font-bold text-xs text-slate-900 dark:text-white">
                      {role === 'student' ? student.name : teacher.name}
                    </p>
                    <p className="text-[11px] text-slate-500 font-mono">
                      {role === 'student' ? `รหัสนักเรียน: ${student.code} (ชั้น ${student.gradeLevel})` : `รหัสครู: ${teacher.code} (${teacher.subject})`}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogOut();
                  }}
                  className="px-3 py-1.5 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 rounded-xl font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>ออก</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLoginModal();
                }}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <KeyRound className="w-4 h-4" />
                <span>เข้าสู่ระบบด้วยเลขประจำตัว</span>
              </button>
            )}

            {/* Main Navigation in Mobile Drawer */}
            <div className="space-y-1">
              <span className="text-[11px] font-semibold text-slate-400 block px-1">หน้าหลักของระบบ:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleTabClick('home')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                    activeTab === 'home'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Home className="w-4 h-4 text-indigo-600" />
                  <span>หน้าแรก</span>
                </button>

                <button
                  onClick={() => handleTabClick('grades')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                    activeTab === 'grades'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <GraduationCap className="w-4 h-4 text-indigo-600" />
                  <span>ระดับชั้น</span>
                </button>

                <button
                  onClick={() => handleTabClick('subjects')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                    activeTab === 'subjects'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-violet-600" />
                  <span>วิชาเรียน</span>
                </button>

                <button
                  onClick={() => handleTabClick('statuses')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                    activeTab === 'statuses'
                      ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>สถานะการส่ง</span>
                </button>

                <button
                  onClick={() => handleTabClick('resources')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer col-span-2 ${
                    activeTab === 'resources'
                      ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 text-rose-600" />
                  <span>คลังสื่อเรียนรู้ประจำวิชา (ม.1-6)</span>
                </button>
              </div>
            </div>



            {/* Teacher Quick Actions in Mobile Drawer */}
            {role === 'teacher' && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 block px-1">เมนูสำหรับครูผู้สอน:</span>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenCreateWorksheet();
                    }}
                    className="w-full p-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-xs cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>+ สร้างใบงานใหม่</span>
                  </button>

                  {/* Unified Settings Section in Mobile Drawer */}
                  <div className="bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold font-prompt text-slate-800 dark:text-slate-200">
                        <Settings className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>⚙️ เมนูตั้งค่า</span>
                      </div>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (onOpenSettings) onOpenSettings();
                          else if (onOpenManageCategories) onOpenManageCategories();
                        }}
                        className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline cursor-pointer"
                      >
                        เปิดหน้าต่างตั้งค่า
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (onOpenSettings) onOpenSettings('grades');
                          else if (onOpenManageCategories) onOpenManageCategories();
                        }}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors cursor-pointer"
                      >
                        <GraduationCap className="w-4 h-4 text-indigo-600 mx-auto mb-1" />
                        <span className="text-[10px] font-bold block text-slate-700 dark:text-slate-300">
                          ชั้นเรียน
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (onOpenSettings) onOpenSettings('subjects');
                          else if (onOpenManageCategories) onOpenManageCategories();
                        }}
                        className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-center hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-violet-600 mx-auto mb-1" />
                        <span className="text-[10px] font-bold block text-slate-700 dark:text-slate-300">
                          รายวิชา
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (onOpenSettings) onOpenSettings('students');
                          else if (onOpenManageStudents) onOpenManageStudents();
                        }}
                        className="p-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors cursor-pointer"
                      >
                        <Users className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
                        <span className="text-[10px] font-bold block text-slate-700 dark:text-slate-300">
                          นักเรียน
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (onOpenSettings) onOpenSettings('teachers');
                        }}
                        className="p-2 bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 rounded-xl text-center hover:bg-sky-50 dark:hover:bg-sky-950 transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4 text-sky-600 mx-auto mb-1" />
                        <span className="text-[10px] font-bold block text-slate-700 dark:text-slate-300">
                          ครูผู้สอน
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      {/* Floating Bottom Navigation Bar for Mobile Phones (< md) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => handleTabClick('home')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'home'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">หน้าแรก</span>
        </button>

        <button
          onClick={() => handleTabClick('grades')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'grades'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <GraduationCap className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">ระดับชั้น</span>
        </button>

        <button
          onClick={() => handleTabClick('subjects')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'subjects'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">วิชาเรียน</span>
        </button>

        <button
          onClick={() => handleTabClick('statuses')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'statuses'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">สถานะงาน</span>
        </button>

        <button
          onClick={() => handleTabClick('resources')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'resources'
              ? 'text-indigo-600 dark:text-indigo-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FolderOpen className="w-5 h-5 text-rose-500" />
          <span className="text-[10px] mt-0.5">คลังสื่อ</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex flex-col items-center py-1 px-2.5 rounded-xl text-slate-500 hover:text-indigo-600 transition-all cursor-pointer"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">เมนูอื่น</span>
        </button>
      </nav>
    </>
  );
};
