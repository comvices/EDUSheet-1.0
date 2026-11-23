import React, { useState, useEffect, useRef } from 'react';
import {
  BookOpen,
  Bell,
  UserCheck,
  GraduationCap,
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
  ClipboardCheck,
  FileSpreadsheet,
  Palette,
  Image as ImageIcon,
} from 'lucide-react';
import { UserRole, StudentProfile, TeacherProfile } from '../types';
import { LogoutIcon } from './LogoutIcon';
import { SettingsTab } from './SettingsModal';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  role: UserRole;
  setRole: (role: UserRole) => void;
  unreadNotifCount: number;
  onOpenNotifs: () => void;
  onOpenManageCategories?: () => void;
  onOpenManageStudents?: () => void;
  onOpenSettings?: (tab?: SettingsTab) => void;
  onOpenLoginModal: () => void;
  onLogOut: () => void;
  student: StudentProfile;
  teacher: TeacherProfile;
  isLoggedIn: boolean;
  showGradebookTab?: boolean;
  isAdmin?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  role,
  setRole,
  unreadNotifCount,
  onOpenNotifs,
  onOpenManageCategories,
  onOpenManageStudents,
  onOpenSettings,
  onOpenLoginModal,
  onLogOut,
  student,
  teacher,
  isLoggedIn,
  showGradebookTab = true,
  isAdmin = false,
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
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[var(--theme-surface-dark-elevated)]/92 backdrop-blur-md border-b border-emerald-900/10 dark:border-emerald-800/35 shadow-2xs theme-transition">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-2 sm:gap-6 h-16">
            {/* Zone 1: Logo & Wordmark */}
            <button
              onClick={() => handleTabClick('home')}
              className="flex items-center gap-2 sm:gap-2.5 text-left text-slate-900 dark:text-white whitespace-nowrap shrink-0 group focus:outline-hidden cursor-pointer"
            >
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-700 via-emerald-600 to-teal-700 flex items-center justify-center text-white shadow-md shadow-emerald-900/20 ring-1 ring-inset ring-white/20 group-hover:scale-105 transition-transform duration-200">
                <BookOpen className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              </div>
              <div>
                <span className="text-lg sm:text-xl font-bold tracking-tight font-prompt text-slate-900 dark:text-white block leading-none">
                  EduSheet <span className="text-emerald-700 dark:text-emerald-400">TH</span>
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-medium block mt-0.5">
                  ระบบจัดเก็บ & ตรวจใบงานออนไลน์
                </span>
              </div>
            </button>

            {/* Zone 2: Navigation Links (Desktop) */}
            <nav className="hidden lg:flex items-center gap-1 font-medium text-xs xl:text-sm text-slate-600 dark:text-slate-300">
              <button
                onClick={() => handleTabClick('home')}
                className={`px-3 py-2 rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === 'home'
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold ring-1 ring-emerald-200/80 dark:ring-emerald-800/60'
                    : 'hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                }`}
              >
                หน้าแรก
              </button>
              {role === 'teacher' && (
                <>
                  <button
                    onClick={() => handleTabClick('grades')}
                    className={`px-3 py-2 rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                      activeTab === 'grades'
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold ring-1 ring-emerald-200/80 dark:ring-emerald-800/60'
                        : 'hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                    }`}
                  >
                    ระดับชั้น
                  </button>
                  <button
                    onClick={() => handleTabClick('subjects')}
                    className={`px-3 py-2 rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer ${
                      activeTab === 'subjects'
                        ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold ring-1 ring-emerald-200/80 dark:ring-emerald-800/60'
                        : 'hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                    }`}
                  >
                    วิชาเรียน
                  </button>
                </>
              )}
              <button
                onClick={() => handleTabClick('resources')}
                className={`px-3 py-2 rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'resources'
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold ring-1 ring-emerald-200/80 dark:ring-emerald-800/60'
                    : 'hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                }`}
              >
                <FolderOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>คลังสื่อเรียนรู้</span>
              </button>
              <button
                onClick={() => handleTabClick('attendance')}
                className={`px-3 py-2 rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                  activeTab === 'attendance'
                    ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold ring-1 ring-emerald-200/80 dark:ring-emerald-800/60'
                    : 'hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                }`}
              >
                <ClipboardCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>เช็คชื่อเรียน</span>
              </button>
              {showGradebookTab && (
                <button
                  onClick={() => handleTabClick('gradebook')}
                  className={`px-3 py-2 rounded-lg transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'gradebook'
                      ? 'bg-emerald-50/90 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold ring-1 ring-emerald-200/80 dark:ring-emerald-800/60'
                      : 'hover:text-emerald-800 dark:hover:text-emerald-200 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/30'
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>สมุดคะแนน</span>
                </button>
              )}
            </nav>

            {/* Zone 3: Actions, Tools & Role Selector */}
            <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Teacher Actions (Desktop) */}
              {role === 'teacher' && (
                <div className="hidden xl:flex items-center gap-2">
                  {/* Unified Settings Menu with Split Button & Dropdown */}
                  <div ref={settingsDropdownRef} className="relative inline-flex items-center rounded-lg border border-emerald-900/15 dark:border-emerald-800/50 theme-soft-surface dark:bg-slate-800/90 shadow-2xs">
                    <button
                      onClick={() => {
                        setSettingsDropdownOpen(false);
                        if (onOpenSettings) onOpenSettings();
                        else if (onOpenManageCategories) onOpenManageCategories();
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-800 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-l-lg text-xs font-semibold transition-colors cursor-pointer group"
                      title="เปิดหน้าต่างเมนูตั้งค่าระบบ"
                    >
                      <Settings className="w-4 h-4 text-emerald-700 dark:text-emerald-400 group-hover:rotate-45 transition-transform duration-200" />
                      <span>เมนูตั้งค่า</span>
                    </button>

                    <button
                      onClick={() => setSettingsDropdownOpen(!settingsDropdownOpen)}
                      className="p-2 text-slate-400 hover:text-emerald-700 dark:hover:text-white hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-r-lg border-l border-emerald-900/10 dark:border-emerald-800/50 transition-colors cursor-pointer"
                      title="เลือกหมวดหมู่ตั้งค่าด่วน"
                      aria-label="ตัวเลือกหมวดหมู่ตั้งค่า"
                    >
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${settingsDropdownOpen ? 'rotate-180 text-emerald-700' : ''}`}
                      />
                    </button>

                    {/* Quick Settings Dropdown */}
                    {settingsDropdownOpen && (
                      <div className="absolute right-0 top-full mt-1.5 w-64 bg-white dark:bg-[var(--theme-surface-dark)] border border-emerald-900/15 dark:border-emerald-800/60 rounded-2xl shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100">
                        <div className="px-3.5 py-1.5 border-b border-slate-100 dark:border-emerald-950/70 text-[11px] font-bold text-slate-400 font-prompt flex items-center justify-between">
                          <span>เมนูตั้งค่าระบบ</span>
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400">Settings</span>
                        </div>
                        <button
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            if (onOpenSettings) onOpenSettings('grades');
                            else if (onOpenManageCategories) onOpenManageCategories();
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer"
                        >
                          <GraduationCap className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
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
                          className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer"
                        >
                          <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
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
                          className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer border-t border-slate-100 dark:border-emerald-950/70"
                        >
                          <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
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
                          className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer border-t border-slate-100 dark:border-emerald-950/70"
                        >
                          <UserCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          <div>
                            <span className="block font-semibold">4. จัดการครูผู้สอน</span>
                            <span className="block text-[10px] text-slate-400">เพิ่ม / ลบ / แก้ไขครู</span>
                          </div>
                        </button>
                        <button
                          onClick={() => {
                            setSettingsDropdownOpen(false);
                            if (onOpenSettings) onOpenSettings('school');
                          }}
                          className="w-full px-3.5 py-2 text-left text-xs font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 flex items-center gap-2.5 cursor-pointer border-t border-slate-100 dark:border-emerald-950/70"
                        >
                          {isAdmin ? (
                            <Palette className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          ) : (
                            <ImageIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                          )}
                          <div>
                            <span className="block font-semibold">
                              {isAdmin ? '5. ธีมสีและภาพโรงเรียน' : '5. ภาพหน้าปกโรงเรียน'}
                            </span>
                            <span className="block text-[10px] text-slate-400">
                              {isAdmin ? 'ธีมพาสเทล (Admin) / หน้าปก' : 'หน้าปก / ชื่อโรงเรียน'}
                            </span>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Theme Toggle (Dark/Light Mode) */}
              <button
                type="button"
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-colors cursor-pointer"
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
                className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-colors cursor-pointer"
                title="การแจ้งเตือนกำหนดส่ง"
              >
                <Bell className="w-4.5 h-4.5" />
                {unreadNotifCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-xs tabular-nums">
                    {unreadNotifCount}
                  </span>
                )}
              </button>

              {/* Account Status / Logged In User Pill */}
              {isLoggedIn ? (
                <div className="hidden md:flex items-center gap-2 pl-2 border-l border-emerald-900/10 dark:border-emerald-800/40">
                  {(role === 'student' ? student.avatar : teacher.avatar) ? (
                    <img
                      src={role === 'student' ? student.avatar : teacher.avatar}
                      alt="Profile Avatar"
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-emerald-600/30 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-700 to-teal-600 text-white flex items-center justify-center ring-2 ring-emerald-500/30 shrink-0">
                      {role === 'student' ? (
                        <GraduationCap className="w-4 h-4" />
                      ) : (
                        <UserCheck className="w-4 h-4" />
                      )}
                    </div>
                  )}
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
                    className="group inline-flex items-center justify-center w-8 h-8 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200/70 dark:border-rose-900/60 text-rose-500 dark:text-rose-400 hover:text-white hover:bg-gradient-to-tr hover:from-rose-500 hover:to-pink-600 hover:border-transparent hover:shadow-md hover:shadow-rose-500/25 active:scale-95 transition-all duration-200 ml-1 cursor-pointer"
                    title="ออกจากระบบ / สลับบัญชี"
                    aria-label="ออกจากระบบ / สลับบัญชี"
                  >
                    <LogoutIcon className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenLoginModal}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>เข้าสู่ระบบ</span>
                </button>
              )}

              {/* Hamburger Button for Mobile Drawer */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-xl transition-colors cursor-pointer"
                aria-label="เปิดเมนูหลัก"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Slide-down Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-emerald-900/10 dark:border-emerald-800/40 bg-white dark:bg-[var(--theme-surface-dark-elevated)] px-4 pt-3 pb-6 shadow-xl space-y-4 animate-in slide-in-from-top-2 duration-150 theme-transition">
            {/* User Profile Card Mobile */}
            {isLoggedIn ? (
              <div className="flex items-center justify-between p-3 theme-soft-surface dark:bg-slate-800/80 rounded-2xl border border-emerald-900/10 dark:border-emerald-800/40">
                <div className="flex items-center gap-3">
                  {(role === 'student' ? student.avatar : teacher.avatar) ? (
                    <img
                      src={role === 'student' ? student.avatar : teacher.avatar}
                      alt=""
                      className="w-10 h-10 rounded-full object-cover ring-2 ring-emerald-600"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-700 to-teal-600 text-white flex items-center justify-center ring-2 ring-emerald-600 shrink-0">
                      {role === 'student' ? (
                        <GraduationCap className="w-5 h-5" />
                      ) : (
                        <UserCheck className="w-5 h-5" />
                      )}
                    </div>
                  )}
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
                  className="group px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 hover:bg-gradient-to-r hover:from-rose-500 hover:to-pink-600 hover:text-white border border-rose-200/80 dark:border-rose-800/60 hover:border-transparent rounded-xl font-semibold flex items-center gap-1.5 shadow-2xs transition-all duration-200 active:scale-95 cursor-pointer"
                >
                  <LogoutIcon className="w-3.5 h-3.5" />
                  <span>ออกจากระบบ</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenLoginModal();
                }}
                className="w-full py-2.5 bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md"
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
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <Home className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>หน้าแรก</span>
                </button>

                {role === 'teacher' && (
                  <>
                    <button
                      onClick={() => handleTabClick('grades')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                        activeTab === 'grades'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <GraduationCap className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>ระดับชั้น</span>
                    </button>

                    <button
                      onClick={() => handleTabClick('subjects')}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                        activeTab === 'subjects'
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold'
                          : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>วิชาเรียน</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => handleTabClick('resources')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                    activeTab === 'resources'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <FolderOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>คลังสื่อเรียนรู้</span>
                </button>

                <button
                  onClick={() => handleTabClick('attendance')}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                    activeTab === 'attendance'
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <ClipboardCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>เช็คชื่อเรียน</span>
                </button>

                {showGradebookTab && (
                  <button
                    onClick={() => handleTabClick('gradebook')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors cursor-pointer ${
                      activeTab === 'gradebook'
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>สมุดคะแนน</span>
                  </button>
                )}
              </div>
            </div>

            {/* Teacher Quick Actions in Mobile Drawer */}
            {role === 'teacher' && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 block px-1">เมนูสำหรับครูผู้สอน:</span>
                <div className="space-y-2">
                  {/* Unified Settings Section in Mobile Drawer */}
                  <div className="theme-soft-surface dark:bg-slate-800/80 border border-emerald-900/10 dark:border-slate-700 rounded-2xl p-2.5 space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5 text-xs font-bold font-prompt text-slate-800 dark:text-slate-200">
                        <Settings className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                        <span>เมนูตั้งค่า</span>
                      </div>
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (onOpenSettings) onOpenSettings();
                          else if (onOpenManageCategories) onOpenManageCategories();
                        }}
                        className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                      >
                        เปิดหน้าต่างตั้งค่า
                      </button>
                    </div>

                    <div className="grid grid-cols-5 gap-1.5 pt-1">
                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (onOpenSettings) onOpenSettings('grades');
                          else if (onOpenManageCategories) onOpenManageCategories();
                        }}
                        className="p-2 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-xl text-center hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors cursor-pointer"
                      >
                        <GraduationCap className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mx-auto mb-1" />
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
                        className="p-2 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-xl text-center hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors cursor-pointer"
                      >
                        <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mx-auto mb-1" />
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
                        className="p-2 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-xl text-center hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors cursor-pointer"
                      >
                        <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mx-auto mb-1" />
                        <span className="text-[10px] font-bold block text-slate-700 dark:text-slate-300">
                          นักเรียน
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (onOpenSettings) onOpenSettings('teachers');
                        }}
                        className="p-2 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-xl text-center hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors cursor-pointer"
                      >
                        <UserCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mx-auto mb-1" />
                        <span className="text-[10px] font-bold block text-slate-700 dark:text-slate-300">
                          ครูผู้สอน
                        </span>
                      </button>

                      <button
                        onClick={() => {
                          setMobileMenuOpen(false);
                          if (onOpenSettings) onOpenSettings('school');
                        }}
                        className="p-2 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-xl text-center hover:bg-emerald-50 dark:hover:bg-emerald-950 transition-colors cursor-pointer"
                      >
                        {isAdmin ? (
                          <Palette className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mx-auto mb-1" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-emerald-700 dark:text-emerald-400 mx-auto mb-1" />
                        )}
                        <span className="text-[10px] font-bold block text-slate-700 dark:text-slate-300">
                          {isAdmin ? 'ธีม/หน้าปก' : 'หน้าปก'}
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[var(--theme-surface-dark-elevated)]/95 backdrop-blur-md border-t border-emerald-900/10 dark:border-emerald-800/40 px-2 py-1.5 flex items-center justify-around shadow-lg theme-transition">
        <button
          onClick={() => handleTabClick('home')}
          className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
            activeTab === 'home'
              ? 'text-emerald-700 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">หน้าแรก</span>
        </button>

        {showGradebookTab ? (
          <button
            onClick={() => handleTabClick('gradebook')}
            className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'gradebook'
                ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <FileSpreadsheet className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">สมุดคะแนน</span>
          </button>
        ) : role === 'teacher' ? (
          <button
            onClick={() => handleTabClick('grades')}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'grades'
                ? 'text-emerald-700 dark:text-emerald-400 font-bold'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-5 h-5" />
            <span className="text-[10px] mt-0.5">ระดับชั้น</span>
          </button>
        ) : null}

        <button
          onClick={() => handleTabClick('attendance')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'attendance'
              ? 'text-emerald-700 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <ClipboardCheck className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">เช็คชื่อ</span>
        </button>

        <button
          onClick={() => handleTabClick('statuses')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'statuses'
              ? 'text-emerald-700 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Clock className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">สถานะงาน</span>
        </button>

        <button
          onClick={() => handleTabClick('resources')}
          className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
            activeTab === 'resources'
              ? 'text-emerald-700 dark:text-emerald-400 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <FolderOpen className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">คลังสื่อ</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="flex flex-col items-center py-1 px-2 rounded-xl text-slate-500 hover:text-emerald-700 transition-all cursor-pointer"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">เมนูอื่น</span>
        </button>
      </nav>
    </>
  );
};
