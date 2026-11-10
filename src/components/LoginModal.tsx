import React, { useState } from 'react';
import { BookOpen, User, Lock, Eye, EyeOff, LogIn, GraduationCap, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import { StudentProfile, TeacherProfile, UserRole } from '../types';
import { STUDENTS_ROSTER, TEACHERS_ROSTER } from '../data/mockData';

interface LoginModalProps {
  onLoginSuccess: (user: StudentProfile | TeacherProfile, role: UserRole) => void;
  onClose?: () => void;
  isDismissable?: boolean;
  studentsList?: StudentProfile[];
  teachersList?: TeacherProfile[];
}

export const LoginModal: React.FC<LoginModalProps> = ({
  onLoginSuccess,
  onClose,
  isDismissable = false,
  studentsList = STUDENTS_ROSTER,
  teachersList = TEACHERS_ROSTER,
}) => {
  const [loginRole, setLoginRole] = useState<UserRole>('student');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRoleSwitch = (role: UserRole) => {
    setLoginRole(role);
    setErrorMsg(null);
    setCode('');
    setPassword('');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const inputCodeClean = code.trim().toUpperCase();

    if (loginRole === 'student') {
      const foundStudent = studentsList.find(
        (s) => s.code.toUpperCase() === inputCodeClean || s.code.replace('ST-', '') === inputCodeClean
      );

      if (!foundStudent) {
        setErrorMsg('ไม่พบเลขประจำตัวนักเรียนนี้ในระบบ กรุณาตรวจสอบอีกครั้ง');
        return;
      }

      if (foundStudent.password !== password) {
        setErrorMsg('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        return;
      }

      onLoginSuccess(foundStudent, 'student');
    } else {
      const foundTeacher = teachersList.find(
        (t) => t.code.toUpperCase() === inputCodeClean || t.code.replace('TCH-', '') === inputCodeClean
      );

      if (!foundTeacher) {
        setErrorMsg('ไม่พบรหัสครูผู้สอนนี้ในระบบ');
        return;
      }

      if (foundTeacher.password !== password) {
        setErrorMsg('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        return;
      }

      onLoginSuccess(foundTeacher, 'teacher');
    }
  };

  const handleQuickLoginStudent = (std: StudentProfile) => {
    setCode(std.code);
    setPassword(std.password);
    setLoginRole('student');
    onLoginSuccess(std, 'student');
  };

  const handleQuickLoginTeacher = (tch: TeacherProfile) => {
    setCode(tch.code);
    setPassword(tch.password);
    setLoginRole('teacher');
    onLoginSuccess(tch, 'teacher');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Top Header Graphic */}
        <div className="bg-gradient-to-tr from-indigo-700 via-indigo-600 to-violet-600 p-8 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px]" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center text-yellow-300 shadow-xl mb-3">
              <GraduationCap className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold font-prompt tracking-tight">EduSheet TH</h2>
            <p className="text-xs text-indigo-100 mt-1 font-medium">
              ระบบเข้าใช้งานใบงานและส่งการบ้านออนไลน์
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-6 sm:p-8 space-y-6">
          {/* Role Toggle Selector */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleRoleSwitch('student')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                loginRole === 'student'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>นักเรียน</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch('teacher')}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                loginRole === 'teacher'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>ครูผู้สอน</span>
            </button>
          </div>

          {/* Error Alert */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Form Inputs */}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                {loginRole === 'student' ? 'เลขประจำตัวนักเรียน (Username / Code)' : 'รหัสประจำตัวครูผู้สอน'}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={loginRole === 'student' ? 'เช่น ST-68042 หรือ 68042' : 'เช่น TCH-001'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                รหัสผ่าน (Password)
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="กรอกรหัสผ่านของคุณ"
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <LogIn className="w-4 h-4" />
              <span>เข้าสู่ระบบ{loginRole === 'student' ? 'นักเรียน' : 'ครูผู้สอน'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
