import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Trash2,
  Edit2,
  BookOpen,
  GraduationCap,
  Settings,
  Users,
  UserPlus,
  UserCheck,
  FileSpreadsheet,
  Download,
  Upload,
  Search,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Sparkles,
  ShieldCheck,
  Check,
  FileCheck,
  AlertTriangle,
  Eye,
  EyeOff,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentProfile, TeacherProfile, Assignment } from '../types';

export type SettingsTab = 'grades' | 'subjects' | 'students' | 'teachers';

interface SettingsModalProps {
  initialTab?: SettingsTab;
  gradeLevels: string[];
  subjects: string[];
  students: StudentProfile[];
  teachers?: TeacherProfile[];
  assignments?: Assignment[];
  onClose: () => void;
  onAddGradeLevel: (grade: string) => void;
  onRemoveGradeLevel: (grade: string) => void;
  onAddSubject: (subject: string) => void;
  onRemoveSubject: (subject: string) => void;
  onAddStudent: (newStudent: StudentProfile) => void;
  onImportStudents: (importedStudents: StudentProfile[]) => void;
  onUpdateStudent: (updatedStudent: StudentProfile) => void;
  onDeleteStudent: (studentId: string) => void;
  onAddTeacher?: (newTeacher: TeacherProfile) => void;
  onUpdateTeacher?: (updatedTeacher: TeacherProfile) => void;
  onDeleteTeacher?: (teacherId: string) => void;
  onResetSystem: () => void;
  onResetKeepUsers: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  initialTab = 'grades',
  gradeLevels,
  subjects,
  students,
  teachers = [],
  assignments = [],
  onClose,
  onAddGradeLevel,
  onRemoveGradeLevel,
  onAddSubject,
  onRemoveSubject,
  onAddStudent,
  onImportStudents,
  onUpdateStudent,
  onDeleteStudent,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onResetSystem,
  onResetKeepUsers,
}) => {
  // Main Settings Tab State
  const [activeMainTab, setActiveMainTab] = useState<SettingsTab>(initialTab);

  // Sync tab whenever initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveMainTab(initialTab);
    }
  }, [initialTab]);

  // --- Grade Level Management State ---
  const [newGradeInput, setNewGradeInput] = useState('');
  const activeGrades = gradeLevels.filter((g) => g !== 'ทั้งหมด');

  // --- Subject Management State ---
  const [newSubjectInput, setNewSubjectInput] = useState('');
  const activeSubjects = subjects.filter((s) => s !== 'ทั้งหมด');

  // --- Student Management Sub-tabs State ---
  const [studentSubTab, setStudentSubTab] = useState<'roster' | 'excel' | 'manual'>('roster');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ทั้งหมด');

  // Manual Add Student State
  const [manualCode, setManualCode] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPassword, setManualPassword] = useState('123456');
  const [manualGrade, setManualGrade] = useState(
    activeGrades[0] || 'ม.3'
  );

  // Edit Student State
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);

  // --- Teacher Management State ---
  const [teacherSearchTerm, setTeacherSearchTerm] = useState('');
  const [manualTeacherCode, setManualTeacherCode] = useState('');
  const [manualTeacherName, setManualTeacherName] = useState('');
  const [manualTeacherPassword, setManualTeacherPassword] = useState('admin123');
  const [manualTeacherSubject, setManualTeacherSubject] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<TeacherProfile | null>(null);
  const [showTeacherPasswords, setShowTeacherPasswords] = useState<Record<string, boolean>>({});

  // In-App Confirmation Modal (Replaces window.confirm which is blocked in iframes)
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'grade' | 'subject' | 'student' | 'teacher';
    id: string;
    name: string;
    details?: string;
  } | null>(null);

  // Excel Upload State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedRows, setParsedRows] = useState<Partial<StudentProfile>[]>([]);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccessMsg, setExcelSuccessMsg] = useState<string | null>(null);

  // Feedback Toast inside modal
  const [localToast, setLocalToast] = useState<string | null>(null);
  const triggerLocalToast = (msg: string) => {
    setLocalToast(msg);
    setTimeout(() => setLocalToast(null), 3000);
  };

  // 1. Grade Handlers
  const handleAddGradeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newGradeInput.trim();
    if (!trimmed) return;
    if (activeGrades.includes(trimmed)) {
      triggerLocalToast(`ระดับชั้น "${trimmed}" มีอยู่ในระบบแล้ว`);
      return;
    }
    onAddGradeLevel(trimmed);
    setNewGradeInput('');
    triggerLocalToast(`เพิ่มระดับชั้น "${trimmed}" เรียบร้อยแล้ว`);
  };

  const handleQuickAddGrade = (grade: string) => {
    if (!activeGrades.includes(grade)) {
      onAddGradeLevel(grade);
      triggerLocalToast(`เพิ่มระดับชั้น "${grade}" เรียบร้อยแล้ว`);
    }
  };

  // 2. Subject Handlers
  const handleAddSubjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSubjectInput.trim();
    if (!trimmed) return;
    if (activeSubjects.includes(trimmed)) {
      triggerLocalToast(`รายวิชา "${trimmed}" มีอยู่ในระบบแล้ว`);
      return;
    }
    onAddSubject(trimmed);
    setNewSubjectInput('');
    triggerLocalToast(`เพิ่มรายวิชา "${trimmed}" เรียบร้อยแล้ว`);
  };

  const handleQuickAddSubject = (subject: string) => {
    if (!activeSubjects.includes(subject)) {
      onAddSubject(subject);
      triggerLocalToast(`เพิ่มรายวิชา "${subject}" เรียบร้อยแล้ว`);
    }
  };

  // 3. Teacher Handlers
  const handleAddTeacherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTeacherCode.trim() || !manualTeacherName.trim()) return;

    const duplicate = teachers.find(
      (t) => t.code.trim().toUpperCase() === manualTeacherCode.trim().toUpperCase()
    );
    if (duplicate) {
      triggerLocalToast(`รหัสครูผู้สอน "${manualTeacherCode.trim()}" มีอยู่ในระบบแล้ว`);
      return;
    }

    const newTch: TeacherProfile = {
      id: `tch_manual_${Date.now()}`,
      code: manualTeacherCode.trim(),
      name: manualTeacherName.trim(),
      password: manualTeacherPassword.trim() || 'admin123',
      subject: manualTeacherSubject.trim() || activeSubjects[0] || 'วิทยาศาสตร์',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    };

    if (onAddTeacher) {
      onAddTeacher(newTch);
      triggerLocalToast(`เพิ่มบัญชีครูผู้สอน "${newTch.name}" เรียบร้อยแล้ว`);
    }

    setManualTeacherCode('');
    setManualTeacherName('');
    setManualTeacherPassword('admin123');
    setManualTeacherSubject('');
  };

  const handleSaveTeacherEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTeacher || !onUpdateTeacher) return;
    onUpdateTeacher(editingTeacher);
    triggerLocalToast(`บันทึกการแก้ไขครูผู้สอน "${editingTeacher.name}" เรียบร้อยแล้ว`);
    setEditingTeacher(null);
  };

  // 4. Delete Confirmed Handler
  const handleExecuteDelete = () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === 'grade') {
      onRemoveGradeLevel(itemToDelete.id);
      triggerLocalToast(`ลบระดับชั้น "${itemToDelete.name}" เรียบร้อยแล้ว`);
    } else if (itemToDelete.type === 'subject') {
      onRemoveSubject(itemToDelete.id);
      triggerLocalToast(`ลบรายวิชา "${itemToDelete.name}" เรียบร้อยแล้ว`);
    } else if (itemToDelete.type === 'student') {
      onDeleteStudent(itemToDelete.id);
      triggerLocalToast(`ลบบัญชีนักเรียน "${itemToDelete.name}" เรียบร้อยแล้ว`);
    } else if (itemToDelete.type === 'teacher' && onDeleteTeacher) {
      onDeleteTeacher(itemToDelete.id);
      triggerLocalToast(`ลบบัญชีครูผู้สอน "${itemToDelete.name}" เรียบร้อยแล้ว`);
    }

    setItemToDelete(null);
  };

  // 4. Excel File Upload Handler (Robust ArrayBuffer reading for Thai text)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setExcelError(null);
    setExcelSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arrayBuffer = evt.target?.result as ArrayBuffer;
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          setExcelError('ไม่พบข้อมูลในไฟล์ Excel นี้ กรุณาตรวจสอบว่ามีข้อมูลในชีตแรก');
          setParsedRows([]);
          return;
        }

        const mappedStudents: Partial<StudentProfile>[] = rawJson.map((row, idx) => {
          const codeVal =
            row['เลขประจำตัวนักเรียน'] ||
            row['เลขประจำตัว'] ||
            row['Username'] ||
            row['Student ID'] ||
            row['code'] ||
            row['ID'] ||
            `ST-${68060 + idx}`;

          const nameVal =
            row['ชื่อ-นามสกุล'] ||
            row['ชื่อนามสกุล'] ||
            row['ชื่อ'] ||
            row['Name'] ||
            row['Student Name'] ||
            `นักเรียนคนที่ ${idx + 1}`;

          const passwordVal =
            row['รหัสผ่าน'] ||
            row['Password'] ||
            row['pass'] ||
            '123456';

          const gradeVal =
            row['ระดับชั้น'] ||
            row['ชั้น'] ||
            row['Grade'] ||
            row['Grade Level'] ||
            manualGrade ||
            'ม.3';

          const avatarVal = `https://images.unsplash.com/photo-${
            1534528741775 + (idx % 10) * 100
          }?auto=format&fit=crop&w=150&q=80`;

          return {
            id: `std_excel_${Date.now()}_${idx}`,
            code: String(codeVal).trim(),
            name: String(nameVal).trim(),
            password: String(passwordVal).trim(),
            gradeLevel: String(gradeVal).trim(),
            avatar: avatarVal,
          };
        });

        setParsedRows(mappedStudents);
        setExcelSuccessMsg(`อ่านไฟล์สำเร็จ พบข้อมูลนักเรียน ${mappedStudents.length} รายการ (ตรวจสอบด้านล่างและกดยืนยัน)`);
      } catch (err: any) {
        console.error('Excel read error:', err);
        setExcelError('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาใช้ไฟล์ .xlsx หรือ .csv');
        setParsedRows([]);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Demo Load Sample Excel Rows (Instant 1-click test)
  const handleLoadSampleDemoRows = () => {
    const demoData: Partial<StudentProfile>[] = [
      {
        id: `std_demo_${Date.now()}_1`,
        code: 'ST-68071',
        name: 'ด.ช. ชนะชนม์ พรหมมินทร์',
        password: 'password123',
        gradeLevel: 'ม.3',
        avatar: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80',
      },
      {
        id: `std_demo_${Date.now()}_2`,
        code: 'ST-68072',
        name: 'ด.ญ. ลลิตา ประเสริฐกุล',
        password: '123456',
        gradeLevel: 'ม.3',
        avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=150&q=80',
      },
      {
        id: `std_demo_${Date.now()}_3`,
        code: 'ST-68073',
        name: 'ด.ช. พงศกร เตชะวัฒน์',
        password: 'pass68073',
        gradeLevel: 'ม.2',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
      },
      {
        id: `std_demo_${Date.now()}_4`,
        code: 'ST-68074',
        name: 'ด.ญ. ปรียานุช รัตนศิริ',
        password: '123456',
        gradeLevel: 'ม.1',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
      },
      {
        id: `std_demo_${Date.now()}_5`,
        code: 'ST-68075',
        name: 'ด.ช. อัครพล วงศ์สถิตย์',
        password: '123456',
        gradeLevel: 'ม.3',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
      },
    ];

    setExcelFileName('ตัวอย่างข้อมูลทดสอบ_5_คน.xlsx');
    setParsedRows(demoData);
    setExcelError(null);
    setExcelSuccessMsg('โหลดชุดข้อมูลตัวอย่าง 5 รายการเรียบร้อยแล้ว! สามารถกดยืนยันนำเข้าได้ทันที');
  };

  const handleDownloadSampleTemplate = () => {
    const templateData = [
      {
        'เลขประจำตัวนักเรียน': 'ST-68050',
        'ชื่อ-นามสกุล': 'ด.ช. ปัญญาวุฒิ สุขสวัสดิ์',
        'รหัสผ่าน': '123456',
        'ระดับชั้น': 'ม.3',
      },
      {
        'เลขประจำตัวนักเรียน': 'ST-68051',
        'ชื่อ-นามสกุล': 'ด.ญ. ชนัญชิดา แสงทอง',
        'รหัสผ่าน': '68051pass',
        'ระดับชั้น': 'ม.3',
      },
      {
        'เลขประจำตัวนักเรียน': 'ST-68052',
        'ชื่อ-นามสกุล': 'ด.ช. ณัฐดนัย รัตนกุล',
        'รหัสผ่าน': '123456',
        'ระดับชั้น': 'ม.2',
      },
      {
        'เลขประจำตัวนักเรียน': 'ST-68053',
        'ชื่อ-นามสกุล': 'ด.ญ. พิชญ์สินี บุญรัตน์',
        'รหัสผ่าน': 'pass123',
        'ระดับชั้น': 'ม.1',
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายชื่อนักเรียน');
    XLSX.writeFile(workbook, 'ตัวอย่างไฟล์นำเข้านักเรียน_EduSheet.xlsx');
    triggerLocalToast('ดาวน์โหลดไฟล์ตัวอย่าง Excel สำเร็จ');
  };

  const handleExportRosterToExcel = () => {
    const exportData = students.map((std, index) => ({
      'ลำดับ': index + 1,
      'เลขประจำตัวนักเรียน (Username)': std.code,
      'ชื่อ-นามสกุล': std.name,
      'ระดับชั้น': std.gradeLevel,
      'รหัสผ่าน (Password)': std.password,
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายชื่อนักเรียนทั้งหมด');
    XLSX.writeFile(workbook, `รายชื่อนักเรียน_EduSheet_${new Date().toISOString().slice(0, 10)}.xlsx`);
    triggerLocalToast('ส่งออกรายชื่อนักเรียนเป็น Excel สำเร็จ');
  };

  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;

    const validStudents: StudentProfile[] = parsedRows.map((r, idx) => ({
      id: r.id || `std_imp_${Date.now()}_${idx}`,
      code: r.code || `ST-IMP-${idx + 1}`,
      name: r.name || `นักเรียน ${idx + 1}`,
      password: r.password || '123456',
      gradeLevel: r.gradeLevel || 'ม.3',
      avatar:
        r.avatar ||
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    }));

    onImportStudents(validStudents);
    setParsedRows([]);
    setExcelFileName(null);
    setStudentSubTab('roster');
    triggerLocalToast(`นำเข้าบัญชีนักเรียนเรียบร้อยแล้ว ${validStudents.length} รายการ!`);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim() || !manualName.trim()) return;

    const newStd: StudentProfile = {
      id: `std_manual_${Date.now()}`,
      code: manualCode.trim().toUpperCase(),
      name: manualName.trim(),
      password: manualPassword.trim() || '123456',
      gradeLevel: manualGrade,
      avatar: `https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=150&q=80`,
    };

    onAddStudent(newStd);
    setManualCode('');
    setManualName('');
    setManualPassword('123456');
    setStudentSubTab('roster');
    triggerLocalToast(`เพิ่มนักเรียน "${newStd.name}" เข้าสู่ระบบเรียบร้อยแล้ว!`);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    onUpdateStudent(editingStudent);
    setEditingStudent(null);
    triggerLocalToast(`อัปเดตข้อมูลนักเรียน "${editingStudent.name}" เรียบร้อยแล้ว`);
  };

  // Filtered Roster
  const filteredStudents = students.filter((std) => {
    const matchSearch =
      std.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      std.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchGrade = selectedGradeFilter === 'ทั้งหมด' || std.gradeLevel === selectedGradeFilter;
    return matchSearch && matchGrade;
  });

  const getStudentCountByGrade = (grade: string) => {
    return students.filter((s) => s.gradeLevel === grade).length;
  };

  const getAssignmentCountBySubject = (subject: string) => {
    return assignments.filter((a) => a.subject === subject).length;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Main Modal Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-3 text-slate-900 dark:text-white">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
              <Settings className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold font-prompt text-slate-900 dark:text-white">
                  เมนูตั้งค่าระบบ (Settings)
                </h2>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-semibold rounded-full">
                  <ShieldCheck className="w-3 h-3" /> สำหรับครูผู้สอน
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                จัดการชั้นเรียน รายวิชา และจัดการนักเรียน (Username / Password / Excel)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่างตั้งค่า"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Local Toast Alert */}
        {localToast && (
          <div className="bg-indigo-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md animate-in slide-in-from-top-1">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              {localToast}
            </span>
            <button
              onClick={() => setLocalToast(null)}
              className="text-indigo-200 hover:text-white text-xs font-bold"
            >
              ✕
            </button>
          </div>
        )}

        {/* 4 Main Settings Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-800/60 p-1.5 gap-1.5 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => setActiveMainTab('grades')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMainTab === 'grades'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span className="font-prompt">1. ชั้นเรียน</span>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-[10px] font-mono text-indigo-700 dark:text-indigo-300">
              {activeGrades.length}
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('subjects')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMainTab === 'subjects'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span className="font-prompt">2. รายวิชา</span>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-[10px] font-mono text-indigo-700 dark:text-indigo-300">
              {activeSubjects.length}
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('students')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMainTab === 'students'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
            }`}
          >
            <Users className="w-4 h-4 text-emerald-600" />
            <span className="font-prompt">3. นักเรียน</span>
            <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-[10px] font-mono text-emerald-700 dark:text-emerald-300">
              {students.length}
            </span>
          </button>

          <button
            onClick={() => setActiveMainTab('teachers')}
            className={`flex-1 py-2.5 px-3 rounded-2xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeMainTab === 'teachers'
                ? 'bg-white dark:bg-slate-900 text-sky-600 dark:text-sky-400 shadow-sm border border-slate-200/80 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50'
            }`}
          >
            <UserCheck className="w-4 h-4 text-sky-600" />
            <span className="font-prompt">4. ครูผู้สอน</span>
            <span className="px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-950 text-[10px] font-mono text-sky-700 dark:text-sky-300">
              {teachers.length}
            </span>
          </button>
        </div>

        {/* Modal Body Container */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
          {/* ========================================================== */}
          {/* TAB 1: จัดการระดับชั้นเรียน (Class Levels) */}
          {/* ========================================================== */}
          {activeMainTab === 'grades' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Introduction Card */}
              <div className="p-4 bg-gradient-to-r from-indigo-50/80 to-purple-50/60 dark:from-indigo-950/40 dark:to-purple-950/20 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-prompt text-slate-900 dark:text-white">
                    กำหนดระดับชั้นเรียนในสถานศึกษา
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    คุณครูสามารถเพิ่ม ลบ หรือกำหนดระดับชั้นได้ด้วยตนเอง ระดับชั้นเหล่านี้จะถูกนำไปใช้จัดกลุ่มใบงาน และกำหนดชั้นเรียนของนักเรียน
                  </p>
                </div>
              </div>

            {/* Add New Grade Level Form */}
              <form onSubmit={handleAddGradeSubmit} className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt">
                  เพิ่มระดับชั้นเรียนใหม่:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newGradeInput}
                    onChange={(e) => setNewGradeInput(e.target.value)}
                    placeholder="พิมพ์ระดับชั้นใหม่ เช่น ป.1, ม.4/1, ปวช.1, มัธยมศึกษาปีที่ 4..."
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!newGradeInput.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shrink-0 disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มระดับชั้น</span>
                  </button>
                </div>
              </form>

              {/* Reset System Data Button */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('คุณต้องการล้างข้อมูลทั้งหมดในระบบและรีเซ็ตเป็นค่าเริ่มต้นใช่หรือไม่?')) {
                      // @ts-ignore
                      onResetSystem();
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>ล้างข้อมูลระบบทั้งหมด (Reset Factory)</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('คุณต้องการล้างข้อมูลใบงานและตั้งค่าระบบ แต่เก็บข้อมูลผู้ใช้งานไว้ใช่หรือไม่?')) {
                      // @ts-ignore
                      onResetKeepUsers();
                    }
                  }}
                  className="w-full px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer mt-3"
                >
                  <AlertTriangle className="w-4 h-4" />
                  <span>ล้างใบงาน/ตั้งค่า (เก็บข้อมูลผู้ใช้งาน)</span>
                </button>
              </div>

              {/* Quick Add Suggestions */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  แนะนำเพิ่มด่วน (คลิกเพื่อเพิ่มทันที):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6', 'ป.4', 'ป.5', 'ป.6'].map((suggestGrade) => {
                    const alreadyExists = activeGrades.includes(suggestGrade);
                    return (
                      <button
                        key={suggestGrade}
                        type="button"
                        onClick={() => handleQuickAddGrade(suggestGrade)}
                        disabled={alreadyExists}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                          alreadyExists
                            ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 border border-transparent cursor-not-allowed opacity-60'
                            : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {alreadyExists ? <Check className="w-3 h-3 text-emerald-500" /> : <Plus className="w-3 h-3 text-indigo-500" />}
                        <span>{suggestGrade}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Grade Levels Grid */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-prompt text-slate-700 dark:text-slate-300">
                    รายชื่อระดับชั้นเรียนปัจจุบัน ({activeGrades.length} ระดับชั้น)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    มีผลกับตัวกรองหน้าแรกและข้อมูลนักเรียนทันที
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeGrades.map((grade) => {
                    const studentCount = getStudentCountByGrade(grade);
                    return (
                      <div
                        key={grade}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs">
                            {grade.slice(0, 2)}
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white block font-prompt">
                              ชั้น {grade}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              นักเรียนในระบบ: {studentCount} คน
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setItemToDelete({
                              type: 'grade',
                              id: grade,
                              name: `ชั้น ${grade}`,
                              details: `มีนักเรียนในระดับชั้นนี้ ${studentCount} คน`,
                            });
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                          title={`ลบระดับชั้น ${grade}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 2: จัดการรายวิชาเรียน (Subjects) */}
          {/* ========================================================== */}
          {activeMainTab === 'subjects' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Introduction Card */}
              <div className="p-4 bg-gradient-to-r from-indigo-50/80 to-blue-50/60 dark:from-indigo-950/40 dark:to-blue-950/20 border border-indigo-100 dark:border-indigo-900/60 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shrink-0 mt-0.5">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-prompt text-slate-900 dark:text-white">
                    กำหนดรายวิชาเรียนในระบบ
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    คุณครูสามารถเพิ่ม ลบ หรือกำหนดรายวิชาได้ด้วยตนเอง เมื่อสร้างใบงานใหม่จะสามารถเลือกระบุวิชาเหล่านี้ได้ทันที
                  </p>
                </div>
              </div>

              {/* Add New Subject Form */}
              <form onSubmit={handleAddSubjectSubmit} className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt">
                  เพิ่มรายวิชาเรียนใหม่:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSubjectInput}
                    onChange={(e) => setNewSubjectInput(e.target.value)}
                    placeholder="พิมพ์ชื่อวิชาใหม่ เช่น วิทยาการคำนวณ, หุ่นยนต์, ดนตรีไทย, ฟิสิกส์..."
                    className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <button
                    type="submit"
                    disabled={!newSubjectInput.trim()}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors shrink-0 disabled:opacity-50 cursor-pointer shadow-xs flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>เพิ่มรายวิชา</span>
                  </button>
                </div>
              </form>

              {/* Quick Add Suggestions for Subjects */}
              <div>
                <span className="text-[11px] font-semibold text-slate-400 block mb-1.5">
                  วิชาเรียนแนะนำ (คลิกเพื่อเพิ่มทันที):
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['วิทยาการคำนวณ', 'ศิลปะและดนตรี', 'ภาษาจีน', 'สังคมศึกษา', 'สุขศึกษาและพลศึกษา', 'ประวัติศาสตร์'].map((suggestSubject) => {
                    const alreadyExists = activeSubjects.includes(suggestSubject);
                    return (
                      <button
                        key={suggestSubject}
                        type="button"
                        onClick={() => handleQuickAddSubject(suggestSubject)}
                        disabled={alreadyExists}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1 cursor-pointer ${
                          alreadyExists
                            ? 'bg-slate-100 dark:bg-slate-800/60 text-slate-400 border border-transparent cursor-not-allowed opacity-60'
                            : 'bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {alreadyExists ? <Check className="w-3 h-3 text-emerald-500" /> : <Plus className="w-3 h-3 text-indigo-500" />}
                        <span>{suggestSubject}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current Subjects Grid */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-prompt text-slate-700 dark:text-slate-300">
                    รายชื่อวิชาเรียนปัจจุบัน ({activeSubjects.length} วิชา)
                  </h4>
                  <span className="text-[11px] text-slate-400">
                    ซิงก์ตรงกับระบบสร้างใบงานและคลังข้อสอบ
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {activeSubjects.map((subj) => {
                    const asgCount = getAssignmentCountBySubject(subj);
                    return (
                      <div
                        key={subj}
                        className="p-3.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors shadow-2xs"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950/80 text-violet-600 dark:text-violet-400 flex items-center justify-center font-bold text-xs">
                            <BookOpen className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-xs text-slate-900 dark:text-white block font-prompt">
                              วิชา {subj}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              มีใบงานเปิดสอน: {asgCount} ชุด
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            setItemToDelete({
                              type: 'subject',
                              id: subj,
                              name: `วิชา ${subj}`,
                              details: `มีใบงานในวิชานี้ ${asgCount} ชุด`,
                            });
                          }}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                          title={`ลบวิชา ${subj}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 3: จัดการนักเรียน & Excel (Student User Management) */}
          {/* ========================================================== */}
          {activeMainTab === 'students' && (
            <div className="space-y-5 animate-in fade-in duration-150">
              {/* Sub-nav inside Students Tab */}
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2 flex-wrap gap-2">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    onClick={() => setStudentSubTab('roster')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      studentSubTab === 'roster'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>รายชื่อนักเรียน ({students.length})</span>
                  </button>

                  <button
                    onClick={() => setStudentSubTab('excel')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      studentSubTab === 'excel'
                        ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>นำเข้าผ่าน Excel</span>
                  </button>

                  <button
                    onClick={() => setStudentSubTab('manual')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                      studentSubTab === 'manual'
                        ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ เพิ่มรายคน</span>
                  </button>
                </div>

                {studentSubTab === 'roster' && (
                  <button
                    onClick={handleExportRosterToExcel}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                    title="ดาวน์โหลดรายชื่อนักเรียนและรหัสผ่านเป็นไฟล์ Excel"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>ส่งออก Excel (.xlsx)</span>
                  </button>
                )}
              </div>

              {/* Sub-view 1: Roster List */}
              {studentSubTab === 'roster' && (
                <div className="space-y-4">
                  {/* Search and Grade Filter */}
                  <div className="flex flex-col sm:flex-row items-center gap-2">
                    <div className="relative flex-1 w-full">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="ค้นหาตามชื่อ หรือ เลขประจำตัวนักเรียน (Username)..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                      />
                    </div>

                    <select
                      value={selectedGradeFilter}
                      onChange={(e) => setSelectedGradeFilter(e.target.value)}
                      className="w-full sm:w-auto px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                    >
                      <option value="ทั้งหมด">ชั้นเรียนทั้งหมด ({students.length})</option>
                      {activeGrades.map((g) => (
                        <option key={g} value={g}>
                          ชั้น {g} ({getStudentCountByGrade(g)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Student Table */}
                  <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                    <div className="max-h-[48vh] overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0 z-10">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">เลขประจำตัว (Username)</th>
                            <th className="p-3">ชื่อ-นามสกุล</th>
                            <th className="p-3">ระดับชั้น</th>
                            <th className="p-3">รหัสผ่าน (Password)</th>
                            <th className="p-3 text-right">จัดการ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                          {filteredStudents.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="text-center py-8 text-slate-400">
                                ไม่พบรายชื่อนักเรียนที่ตรงกับคำค้นหา
                              </td>
                            </tr>
                          ) : (
                            filteredStudents.map((std, idx) => (
                              <tr key={std.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="p-3 font-mono text-slate-400">{idx + 1}</td>
                                <td className="p-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {std.code}
                                </td>
                                <td className="p-3 font-medium flex items-center gap-2">
                                  <img
                                    src={std.avatar}
                                    alt=""
                                    className="w-6 h-6 rounded-full object-cover shrink-0"
                                  />
                                  <span>{std.name}</span>
                                </td>
                                <td className="p-3 font-semibold">ชั้น {std.gradeLevel}</td>
                                <td className="p-3 font-mono text-slate-600 dark:text-slate-400">
                                  {std.password}
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => setEditingStudent(std)}
                                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-lg transition-colors cursor-pointer"
                                      title="แก้ไขข้อมูลนักเรียน"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={() => {
                                        onUpdateStudent({ ...std, password: '123456' });
                                        triggerLocalToast(`รีเซ็ตรหัสผ่านของ ${std.name} เป็น 123456 เรียบร้อย`);
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg transition-colors cursor-pointer"
                                      title="รีเซ็ตรหัสผ่านเป็น 123456"
                                    >
                                      <KeyRound className="w-3.5 h-3.5" />
                                    </button>

                                    <button
                                      onClick={() => {
                                        setItemToDelete({
                                          type: 'student',
                                          id: std.id,
                                          name: `${std.name} (${std.code})`,
                                        });
                                      }}
                                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                      title="ลบนักเรียน"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-view 2: Excel Import */}
              {studentSubTab === 'excel' && (
                <div className="space-y-5">
                  {/* Instructions & Template Download */}
                  <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold font-prompt text-sm">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        <span>นำเข้าบัญชีนักเรียนผ่านไฟล์ Excel (.xlsx / .csv)</span>
                      </div>
                      <p className="text-xs text-emerald-700 dark:text-emerald-300">
                        จัดเตรียมไฟล์ที่มีคอลัมน์: <strong>เลขประจำตัวนักเรียน</strong>, <strong>ชื่อ-นามสกุล</strong>, <strong>รหัสผ่าน</strong>, <strong>ระดับชั้น</strong>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        onClick={handleLoadSampleDemoRows}
                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
                        title="ทดสอบโหลดข้อมูลนักเรียน 5 คนเพื่อทดลองนำเข้า"
                      >
                        <Sparkles className="w-4 h-4 text-yellow-300" />
                        <span>ทดลองโหลดข้อมูลตัวอย่าง (5 คน)</span>
                      </button>

                      <button
                        onClick={handleDownloadSampleTemplate}
                        className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-emerald-600" />
                        <span>ดาวน์โหลดไฟล์แม่แบบ Excel</span>
                      </button>
                    </div>
                  </div>

                  {/* Upload Dropzone */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-3xl p-8 text-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 transition-all group"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                      <Upload className="w-7 h-7" />
                    </div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200 font-prompt">
                      คลิกเพื่อเลือกไฟล์ Excel หรือลากไฟล์มาวางที่นี่
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      รองรับไฟล์รูปแบบ .xlsx, .xls และ .csv
                    </p>

                    {excelFileName && (
                      <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-950 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs font-bold text-emerald-800 dark:text-emerald-200">
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>ไฟล์ที่เลือก: {excelFileName}</span>
                      </div>
                    )}
                  </div>

                  {/* Error or Success Alert */}
                  {excelError && (
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>{excelError}</span>
                    </div>
                  )}

                  {excelSuccessMsg && (
                    <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>{excelSuccessMsg}</span>
                    </div>
                  )}

                  {/* Preview Table before Commit */}
                  {parsedRows.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold font-prompt text-slate-900 dark:text-white flex items-center gap-1.5">
                          <FileCheck className="w-4 h-4 text-emerald-600" />
                          <span>ตัวอย่างข้อมูลนักเรียนที่จะนำเข้า ({parsedRows.length} รายการ)</span>
                        </h4>
                        <button
                          onClick={handleConfirmImport}
                          className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>ยืนยันนำเข้าบัญชีนักเรียนทั้งหมด</span>
                        </button>
                      </div>

                      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden max-h-[35vh] overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 font-semibold sticky top-0">
                            <tr>
                              <th className="p-2.5">#</th>
                              <th className="p-2.5">เลขประจำตัว (Username)</th>
                              <th className="p-2.5">ชื่อ-นามสกุล</th>
                              <th className="p-2.5">รหัสผ่าน</th>
                              <th className="p-2.5">ระดับชั้น</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                            {parsedRows.map((r, idx) => (
                              <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                                <td className="p-2.5 font-mono text-slate-400">{idx + 1}</td>
                                <td className="p-2.5 font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                  {r.code}
                                </td>
                                <td className="p-2.5 font-medium">{r.name}</td>
                                <td className="p-2.5 font-mono text-slate-500">{r.password}</td>
                                <td className="p-2.5 font-semibold">ชั้น {r.gradeLevel}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-view 3: Manual Add */}
              {studentSubTab === 'manual' && (
                <form onSubmit={handleManualSubmit} className="space-y-4 max-w-lg mx-auto py-2">
                  <div className="text-center space-y-1 mb-3">
                    <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                      <UserPlus className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                      เพิ่มนักเรียนเข้าสู่ระบบทีละคน
                    </h3>
                    <p className="text-xs text-slate-400">
                      กำหนด Username (เลขประจำตัว) และรหัสผ่านสำหรับนักเรียนเข้าสู่ระบบ
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      เลขประจำตัวนักเรียน (Username / Code) *
                    </label>
                    <input
                      type="text"
                      required
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      placeholder="เช่น ST-68055 หรือ 68055"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      ชื่อ-นามสกุล นักเรียน *
                    </label>
                    <input
                      type="text"
                      required
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      placeholder="เช่น ด.ช. กฤษดา บุญยืน"
                      className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        รหัสผ่าน (Password)
                      </label>
                      <input
                        type="text"
                        value={manualPassword}
                        onChange={(e) => setManualPassword(e.target.value)}
                        placeholder="เช่น 123456"
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                        ระดับชั้น
                      </label>
                      <select
                        value={manualGrade}
                        onChange={(e) => setManualGrade(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-medium"
                      >
                        {activeGrades.map((g) => (
                          <option key={g} value={g}>
                            ชั้น {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>+ เพิ่มนักเรียนเข้าสู่ระบบ</span>
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ========================================================== */}
          {/* TAB 4: จัดการครูผู้สอน (Teacher User Management) */}
          {/* ========================================================== */}
          {activeMainTab === 'teachers' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Intro Banner */}
              <div className="p-4 bg-gradient-to-r from-sky-50/80 to-indigo-50/60 dark:from-sky-950/40 dark:to-indigo-950/20 border border-sky-100 dark:border-sky-900/60 rounded-2xl flex items-start gap-3">
                <div className="p-2 bg-sky-600 text-white rounded-xl shrink-0 mt-0.5">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold font-prompt text-slate-900 dark:text-white">
                    จัดการข้อมูลครูผู้สอนในระบบ
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                    คุณครูและผู้ดูแลระบบสามารถเพิ่มครูผู้สอนใหม่ กำหนดรหัสครู (Username) รหัสผ่าน (Password) วิชาที่รับผิดชอบหลัก แก้ไขข้อมูล หรือลบบัญชีครูผู้สอนได้ด้วยตนเอง
                  </p>
                </div>
              </div>

              {/* Add New Teacher Form Card */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold font-prompt text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                  <span>เพิ่มครูผู้สอนรายบุคคล</span>
                </h4>

                <form onSubmit={handleAddTeacherSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        รหัสครูผู้สอน (Username) *
                      </label>
                      <input
                        type="text"
                        required
                        value={manualTeacherCode}
                        onChange={(e) => setManualTeacherCode(e.target.value)}
                        placeholder="เช่น TCH-003, TCH-SCIENCE"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        ชื่อ-นามสกุล ครูผู้สอน *
                      </label>
                      <input
                        type="text"
                        required
                        value={manualTeacherName}
                        onChange={(e) => setManualTeacherName(e.target.value)}
                        placeholder="เช่น ครู วิทยา ศรีสวัสดิ์"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 font-prompt"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        วิชาที่รับผิดชอบหลัก
                      </label>
                      <input
                        type="text"
                        value={manualTeacherSubject}
                        onChange={(e) => setManualTeacherSubject(e.target.value)}
                        placeholder="เช่น วิทยาศาสตร์, คณิตศาสตร์"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500 font-prompt"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        รหัสผ่าน (Password) *
                      </label>
                      <input
                        type="text"
                        required
                        value={manualTeacherPassword}
                        onChange={(e) => setManualTeacherPassword(e.target.value)}
                        placeholder="รหัสผ่านเข้าใช้งาน"
                        className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono focus:ring-2 focus:ring-sky-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="submit"
                      disabled={!manualTeacherCode.trim() || !manualTeacherName.trim()}
                      className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50 shadow-xs flex items-center gap-1.5"
                    >
                      <UserPlus className="w-4 h-4" />
                      <span>+ ยืนยันเพิ่มครูผู้สอน</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Roster List Section */}
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-bold font-prompt text-slate-800 dark:text-slate-200">
                    รายชื่อครูผู้สอนในระบบ ({teachers.filter((tch) => {
                      if (!teacherSearchTerm.trim()) return true;
                      const q = teacherSearchTerm.toLowerCase().trim();
                      return (
                        tch.name.toLowerCase().includes(q) ||
                        tch.code.toLowerCase().includes(q) ||
                        tch.subject.toLowerCase().includes(q)
                      );
                    }).length} คน)
                  </h4>

                  {/* Search Bar */}
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={teacherSearchTerm}
                      onChange={(e) => setTeacherSearchTerm(e.target.value)}
                      placeholder="ค้นหาชื่อ, รหัสครู หรือวิชา..."
                      className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>

                {teachers.filter((tch) => {
                  if (!teacherSearchTerm.trim()) return true;
                  const q = teacherSearchTerm.toLowerCase().trim();
                  return (
                    tch.name.toLowerCase().includes(q) ||
                    tch.code.toLowerCase().includes(q) ||
                    tch.subject.toLowerCase().includes(q)
                  );
                }).length === 0 ? (
                  <div className="text-center py-10 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                    ไม่พบข้อมูลครูผู้สอนที่ตรงกับคำค้นหา
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {teachers
                      .filter((tch) => {
                        if (!teacherSearchTerm.trim()) return true;
                        const q = teacherSearchTerm.toLowerCase().trim();
                        return (
                          tch.name.toLowerCase().includes(q) ||
                          tch.code.toLowerCase().includes(q) ||
                          tch.subject.toLowerCase().includes(q)
                        );
                      })
                      .map((tch) => {
                        const isShowingPass = showTeacherPasswords[tch.id];

                        return (
                          <div
                            key={tch.id}
                            className="p-3.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-2xl flex items-center justify-between gap-3 hover:border-sky-300 dark:hover:border-sky-700 transition-colors shadow-2xs"
                          >
                            <div className="flex items-center gap-3 shrink min-w-0">
                              <img
                                src={tch.avatar || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80'}
                                alt={tch.name}
                                className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                              <div className="min-w-0">
                                <h5 className="font-bold text-xs text-slate-900 dark:text-white truncate font-prompt">
                                  {tch.name}
                                </h5>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-wrap">
                                  <span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">
                                    {tch.code}
                                  </span>
                                  <span>·</span>
                                  <span className="text-slate-600 dark:text-slate-300">
                                    วิชา: {tch.subject || 'ทั่วไป'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-400 font-mono">
                                  <span>รหัสผ่าน:</span>
                                  <span className="text-slate-700 dark:text-slate-300 font-bold">
                                    {isShowingPass ? tch.password : '••••••••'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowTeacherPasswords((prev) => ({
                                        ...prev,
                                        [tch.id]: !prev[tch.id],
                                      }))
                                    }
                                    className="p-0.5 text-slate-400 hover:text-sky-600 transition-colors cursor-pointer"
                                    title="แสดง/ซ่อนรหัสผ่าน"
                                  >
                                    {isShowingPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditingTeacher(tch)}
                                className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors cursor-pointer"
                                title={`แก้ไขข้อมูล ${tch.name}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setItemToDelete({
                                    type: 'teacher',
                                    id: tch.id,
                                    name: tch.name,
                                    details: `รหัสครูผู้สอน: ${tch.code} (วิชา ${tch.subject})`,
                                  });
                                }}
                                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                                title={`ลบบัญชี ${tch.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 sm:px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 hidden sm:inline">
            ข้อมูลการตั้งค่าจะซิงก์ตรงกับ Google Firebase Firestore แบบเรียลไทม์
          </span>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 text-white dark:bg-indigo-600 hover:bg-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-sm ml-auto"
          >
            ปิดหน้าต่างตั้งค่า
          </button>
        </div>
      </div>

      {/* In-App Confirmation Modal (for Deleting Grade, Subject, or Student) */}
      {itemToDelete && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/80 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                ยืนยันการลบ?
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300">
                คุณแน่ใจหรือไม่ว่าต้องการลบ <strong>{itemToDelete.name}</strong> ออกจากระบบ?
              </p>
              {itemToDelete.details && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                  {itemToDelete.details}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setItemToDelete(null)}
                className="py-2.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleExecuteDelete}
                className="py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md transition-colors cursor-pointer"
              >
                ยืนยันลบ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student Edit Modal Overlay */}
      {editingStudent && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                แก้ไขข้อมูลนักเรียน
              </h3>
              <button
                onClick={() => setEditingStudent(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  เลขประจำตัว (Username)
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.code}
                  onChange={(e) => setEditingStudent({ ...editingStudent, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อ-นามสกุล
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.name}
                  onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  รหัสผ่าน (Password)
                </label>
                <input
                  type="text"
                  required
                  value={editingStudent.password}
                  onChange={(e) => setEditingStudent({ ...editingStudent, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ระดับชั้น
                </label>
                <select
                  value={editingStudent.gradeLevel}
                  onChange={(e) => setEditingStudent({ ...editingStudent, gradeLevel: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs font-medium"
                >
                  {activeGrades.map((g) => (
                    <option key={g} value={g}>
                      ชั้น {g}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStudent(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700 cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Teacher Edit Modal Overlay */}
      {editingTeacher && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                แก้ไขข้อมูลครูผู้สอน
              </h3>
              <button
                onClick={() => setEditingTeacher(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTeacherEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  รหัสครูผู้สอน (Username)
                </label>
                <input
                  type="text"
                  required
                  value={editingTeacher.code}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, code: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ชื่อ-นามสกุล ครูผู้สอน
                </label>
                <input
                  type="text"
                  required
                  value={editingTeacher.name}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-prompt"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  วิชาที่รับผิดชอบหลัก
                </label>
                <input
                  type="text"
                  required
                  value={editingTeacher.subject}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-prompt"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  รหัสผ่าน (Password)
                </label>
                <input
                  type="text"
                  required
                  value={editingTeacher.password}
                  onChange={(e) => setEditingTeacher({ ...editingTeacher, password: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingTeacher(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-sky-600 text-white rounded-xl shadow-md hover:bg-sky-700 cursor-pointer"
                >
                  บันทึกการแก้ไข
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
