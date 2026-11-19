import React, { useState, useEffect } from 'react';
import {
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  GraduationCap,
  UserCheck,
  AlertCircle,
  ShieldAlert,
  X,
} from 'lucide-react';
import { StudentProfile, TeacherProfile, UserRole } from '../types';
import { constantTimeEqual, sanitizeImageSrc } from '../utils/security';
import defaultSchoolCover from '../assets/images/school_campus_cover_1795065722838.jpg';

interface LoginModalProps {
  onLoginSuccess: (
    user: StudentProfile | TeacherProfile,
    role: UserRole,
    meta?: { isDefaultAdminFallback?: boolean }
  ) => void;
  onClose?: () => void;
  isDismissable?: boolean;
  studentsList?: StudentProfile[];
  teachersList?: TeacherProfile[];
  schoolCoverUrl?: string;
  schoolName?: string;
  schoolSubtitle?: string;
}

const BUILTIN_ADMIN_TEACHER: TeacherProfile = {
  id: 'tch_admin',
  code: 'ADMIN',
  name: 'ผู้ดูแลระบบ (Admin)',
  password: '',
  subject: 'ผู้ดูแลระบบ',
  avatar: '',
};

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export const LoginModal: React.FC<LoginModalProps> = ({
  onLoginSuccess,
  onClose,
  isDismissable = false,
  studentsList = [],
  teachersList = [],
  schoolCoverUrl = '',
  schoolName = '',
  schoolSubtitle = '',
}) => {
  const [loginRole, setLoginRole] = useState<UserRole>('student');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState(0);
  const [coverImageError, setCoverImageError] = useState(false);

  const sanitizedCustomCover = sanitizeImageSrc(schoolCoverUrl);
  const resolvedCoverSrc = !coverImageError ? sanitizedCustomCover || defaultSchoolCover : null;
  const displaySchoolName = schoolName.trim() || 'EduSheet TH';
  const displaySchoolSubtitle =
    schoolSubtitle.trim() || 'ระบบใบงานออนไลน์ สมุดเก็บคะแนน และคลังสื่อการเรียนรู้ประจำสถานศึกษา';

  useEffect(() => {
    setCoverImageError(false);
  }, [schoolCoverUrl]);

  useEffect(() => {
    if (lockoutSecondsLeft <= 0) return;
    const timer = setInterval(() => {
      setLockoutSecondsLeft((prev) => {
        if (prev <= 1) {
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutSecondsLeft]);

  const registerFailedAttempt = (msg: string) => {
    const nextCount = failedAttempts + 1;
    setFailedAttempts(nextCount);
    if (nextCount >= MAX_FAILED_ATTEMPTS) {
      setLockoutSecondsLeft(LOCKOUT_SECONDS);
      setErrorMsg(`กรอกข้อมูลผิดติดต่อกัน ${MAX_FAILED_ATTEMPTS} ครั้ง กรุณารอ ${LOCKOUT_SECONDS} วินาทีแล้วลองใหม่`);
    } else {
      setErrorMsg(`${msg} (เหลือโอกาสอีก ${MAX_FAILED_ATTEMPTS - nextCount} ครั้ง)`);
    }
  };

  const handleRoleSwitch = (role: UserRole) => {
    setLoginRole(role);
    setErrorMsg(null);
    setCode('');
    setPassword('');
  };

  const authenticateTeacherOrAdmin = (rawCode: string, rawPassword: string): boolean => {
    const inputTrimmed = rawCode.trim();
    const inputUpper = inputTrimmed.toUpperCase();
    const cleanNumeric = inputUpper.replace(/^TCH-/, '');

    // 1. Check exact / unambiguous matches in registered teachersList
    const matchingTeachers = teachersList.filter((t) => {
      const tCode = (t.code || '').trim().toUpperCase();
      const tName = (t.name || '').trim().toLowerCase();
      const cleanTCode = tCode.replace(/^TCH-/, '');

      if (tCode === inputUpper) return true;
      if (cleanNumeric && tCode.startsWith('TCH-') && cleanTCode === cleanNumeric) return true;
      if (cleanNumeric && inputUpper.startsWith('TCH-') && cleanTCode === cleanNumeric) return true;
      if (tName && tName === inputTrimmed.toLowerCase()) return true;
      return false;
    });

    const passwordMatchedTeacher = matchingTeachers.find((t) =>
      constantTimeEqual(t.password, rawPassword)
    );
    if (passwordMatchedTeacher) {
      setFailedAttempts(0);
      onLoginSuccess(passwordMatchedTeacher, 'teacher');
      return true;
    }

    // 2. Built-in System Admin fallback only if no explicit ADMIN account exists in Firestore
    const hasExplicitAdminInDb = teachersList.some(
      (t) => (t.code || '').trim().toUpperCase() === 'ADMIN'
    );

    if (
      inputUpper === 'ADMIN' &&
      !hasExplicitAdminInDb &&
      constantTimeEqual(rawPassword, 'admin123')
    ) {
      setFailedAttempts(0);
      onLoginSuccess(BUILTIN_ADMIN_TEACHER, 'teacher', { isDefaultAdminFallback: true });
      return true;
    }

    if (matchingTeachers.length > 0 || (inputUpper === 'ADMIN' && !hasExplicitAdminInDb)) {
      registerFailedAttempt('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      return false;
    }

    registerFailedAttempt('ไม่พบรหัสประจำตัวครูผู้สอนนี้ในระบบ (ผู้ดูแลระบบใช้ชื่อผู้ใช้ admin)');
    return false;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSecondsLeft > 0) return;
    setErrorMsg(null);

    const inputCodeClean = code.trim().toUpperCase();

    if (loginRole === 'student') {
      const foundStudent = studentsList.find(
        (s) =>
          s.code.trim().toUpperCase() === inputCodeClean ||
          s.code.trim().toUpperCase().replace(/^ST-/, '') === inputCodeClean
      );

      // Seamless Admin login even if user did not switch the Student/Teacher tab
      if (!foundStudent && inputCodeClean === 'ADMIN') {
        authenticateTeacherOrAdmin(code, password);
        return;
      }

      if (!foundStudent) {
        registerFailedAttempt('ไม่พบเลขประจำตัวนักเรียนนี้ในระบบ กรุณาตรวจสอบอีกครั้ง');
        return;
      }

      if (!constantTimeEqual(foundStudent.password, password)) {
        registerFailedAttempt('รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
        return;
      }

      setFailedAttempts(0);
      onLoginSuccess(foundStudent, 'student');
    } else {
      authenticateTeacherOrAdmin(code, password);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200 grid grid-cols-1 md:grid-cols-12 items-stretch">
        {/* Left / Top School Cover Panel */}
        <div className="md:col-span-6 relative min-h-[210px] sm:min-h-[250px] md:min-h-[540px] bg-slate-900 overflow-hidden flex flex-col justify-end">
          {resolvedCoverSrc ? (
            <img
              src={resolvedCoverSrc}
              alt={displaySchoolName}
              referrerPolicy="no-referrer"
              onError={() => setCoverImageError(true)}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 flex items-center justify-center">
              <GraduationCap className="w-24 h-24 text-indigo-400/25" />
            </div>
          )}

          {/* Measured Contrast Scrim for AA Legibility */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-950/15" />

          <div className="relative z-10 p-6 sm:p-8 space-y-3 text-white">
            <div className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center text-white shadow-lg">
              <GraduationCap className="w-6 h-6" />
            </div>

            <div className="space-y-1.5">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-prompt tracking-tight leading-snug text-balance">
                {displaySchoolName}
              </h1>
              <p className="text-xs sm:text-sm text-slate-200/95 leading-relaxed max-w-sm">
                {displaySchoolSubtitle}
              </p>
            </div>

            <div className="pt-2 flex items-center gap-2 text-[11px] text-slate-300 font-medium">
              <span>นักเรียน</span>
              <span aria-hidden="true">·</span>
              <span>ครูผู้สอน</span>
              <span aria-hidden="true">·</span>
              <span>ฝ่ายวิชาการ</span>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="md:col-span-6 p-6 sm:p-8 lg:p-10 flex flex-col justify-center space-y-6 relative bg-white dark:bg-slate-900">
          {isDismissable && onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="ปิดหน้าต่างเข้าสู่ระบบ"
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <div className="space-y-1">
            <h2 className="text-xl font-bold font-prompt text-slate-900 dark:text-white tracking-tight">
              เข้าสู่ระบบ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              เลือกบทบาทและกรอกรหัสประจำตัวเพื่อเริ่มต้นใช้งาน
            </p>
          </div>

          {/* Role Toggle Selector */}
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => handleRoleSwitch('student')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                loginRole === 'student'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>นักเรียน</span>
            </button>
            <button
              type="button"
              onClick={() => handleRoleSwitch('teacher')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
                loginRole === 'teacher'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-4 h-4" />
              <span>ครูผู้สอน / Admin</span>
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
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                {loginRole === 'student'
                  ? 'เลขประจำตัวนักเรียน (Username / Code)'
                  : 'รหัสประจำตัวครูผู้สอน / ผู้ดูแลระบบ (admin)'}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={loginRole === 'student' ? 'เช่น ST-68042 หรือ 68042' : 'เช่น admin หรือ TCH-001'}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
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
                  aria-label={showPassword ? 'ซ่อนรหัสผ่าน' : 'แสดงรหัสผ่าน'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={lockoutSecondsLeft > 0}
              className="w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              {lockoutSecondsLeft > 0 ? (
                <>
                  <ShieldAlert className="w-4 h-4" />
                  <span>กรุณารอสักครู่ ({lockoutSecondsLeft} วินาที)</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>เข้าสู่ระบบ{loginRole === 'student' ? 'นักเรียน' : 'ครูผู้สอน / Admin'}</span>
                </>
              )}
            </button>
          </form>

          {/* Developer Credit */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              ผู้พัฒนาระบบ:{' '}
              <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-prompt">
                นายปราชญ์ชยาวิช ศรีก่อเกื้อ
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

