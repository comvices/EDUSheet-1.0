import React, { useState, useRef } from 'react';
import {
  X,
  UserPlus,
  FileSpreadsheet,
  Download,
  Upload,
  Users,
  Search,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Edit2,
  KeyRound,
  Sparkles,
  Save,
  GraduationCap,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { StudentProfile } from '../types';

interface ManageStudentsModalProps {
  students: StudentProfile[];
  gradeLevels: string[];
  onClose: () => void;
  onAddStudent: (newStudent: StudentProfile) => void;
  onImportStudents: (importedStudents: StudentProfile[]) => void;
  onUpdateStudent: (updatedStudent: StudentProfile) => void;
  onDeleteStudent: (studentId: string) => void;
}

export const ManageStudentsModal: React.FC<ManageStudentsModalProps> = ({
  students,
  gradeLevels,
  onClose,
  onAddStudent,
  onImportStudents,
  onUpdateStudent,
  onDeleteStudent,
}) => {
  const [activeTab, setActiveTab] = useState<'roster' | 'excel' | 'manual'>('roster');

  // Roster Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGradeFilter, setSelectedGradeFilter] = useState('ทั้งหมด');

  // Manual Form State
  const [manualCode, setManualCode] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualPassword, setManualPassword] = useState('123456');
  const [manualGrade, setManualGrade] = useState(
    gradeLevels.find((g) => g !== 'ทั้งหมด') || 'ม.3'
  );

  // Edit Mode State
  const [editingStudent, setEditingStudent] = useState<StudentProfile | null>(null);

  // Excel Upload & Preview State
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsedRows, setParsedRows] = useState<Partial<StudentProfile>[]>([]);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [excelSuccessMsg, setExcelSuccessMsg] = useState<string | null>(null);

  const activeGrades = gradeLevels.filter((g) => g !== 'ทั้งหมด');

  // Handle Excel File Drop / Selection
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExcelFileName(file.name);
    setExcelError(null);
    setExcelSuccessMsg(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });

        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (rawJson.length === 0) {
          setExcelError('ไม่พบข้อมูลนักเรียนในไฟล์ Excel นี้ กรุณาตรวจสอบอีกครั้ง');
          setParsedRows([]);
          return;
        }

        // Map flexible headers (Thai and English)
        const mappedStudents: Partial<StudentProfile>[] = rawJson.map((row, idx) => {
          // Find Code / Username
          const codeVal =
            row['เลขประจำตัวนักเรียน'] ||
            row['เลขประจำตัว'] ||
            row['Username'] ||
            row['Student ID'] ||
            row['code'] ||
            row['ID'] ||
            `ST-${68060 + idx}`;

          // Find Name
          const nameVal =
            row['ชื่อ-นามสกุล'] ||
            row['ชื่อนามสกุล'] ||
            row['ชื่อ'] ||
            row['Name'] ||
            row['Student Name'] ||
            `นักเรียนคนที่ ${idx + 1}`;

          // Find Password
          const passwordVal =
            row['รหัสผ่าน'] ||
            row['Password'] ||
            row['pass'] ||
            '123456';

          // Find Grade Level
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
        setExcelSuccessMsg(`อ่านข้อมูลสำเร็จทั้งหมด ${mappedStudents.length} รายการ (พร้อมตรวจสอบก่อนยืนยัน)`);
      } catch (err: any) {
        console.error('Excel read error:', err);
        setExcelError('เกิดข้อผิดพลาดในการอ่านไฟล์ Excel กรุณาใช้ไฟล์ .xlsx หรือ .csv ตามรูปแบบตัวอย่าง');
        setParsedRows([]);
      }
    };

    reader.readAsBinaryString(file);
  };

  // Download Demo Excel Template
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
  };

  // Export Current Roster to Excel
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
  };

  // Commit Excel Import to App State
  const handleConfirmImport = () => {
    if (parsedRows.length === 0) return;

    const validStudents: StudentProfile[] = parsedRows.map((r, idx) => ({
      id: r.id || `std_imp_${Date.now()}_${idx}`,
      code: r.code || `ST-IMP-${idx + 1}`,
      name: r.name || `นักเรียน ${idx + 1}`,
      password: r.password || '123456',
      gradeLevel: r.gradeLevel || 'ม.3',
      avatar: r.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    }));

    onImportStudents(validStudents);
    setParsedRows([]);
    setExcelFileName(null);
    setActiveTab('roster');
  };

  // Handle Submit Manual Add
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
    setActiveTab('roster');
  };

  // Save Student Edit
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    onUpdateStudent(editingStudent);
    setEditingStudent(null);
  };

  // Filtered Roster
  const filteredStudents = students.filter((std) => {
    const matchSearch =
      std.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      std.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchGrade = selectedGradeFilter === 'ทั้งหมด' || std.gradeLevel === selectedGradeFilter;
    return matchSearch && matchGrade;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2 text-slate-900 dark:text-white">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold font-prompt">
                จัดการข้อมูลนักเรียน & นำเข้า Excel (Student User Management)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                เพิ่มนักเรียนผ่านไฟล์ Excel, จัดการ Username (เลขประจำตัว) และรหัสผ่าน
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/50 p-1">
          <button
            onClick={() => setActiveTab('roster')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'roster'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>รายชื่อนักเรียนในระบบ ({students.length} คน)</span>
          </button>

          <button
            onClick={() => setActiveTab('excel')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'excel'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-300" />
            <span>นำเข้าผ่าน Excel / CSV (.xlsx)</span>
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'manual'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            <UserPlus className="w-4 h-4" />
            <span>+ เพิ่มนักเรียนรายบุคคล</span>
          </button>
        </div>

        {/* Modal Body Content */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
          {/* TAB 1: Roster List & Edit */}
          {activeTab === 'roster' && (
            <div className="space-y-4">
              {/* Search & Export Toolbar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 w-full sm:w-auto flex-1">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="ค้นหาตามชื่อ หรือ เลขประจำตัว (Username)..."
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                    />
                  </div>

                  <select
                    value={selectedGradeFilter}
                    onChange={(e) => setSelectedGradeFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
                  >
                    <option value="ทั้งหมด">ระดับชั้น (ทั้งหมด)</option>
                    {activeGrades.map((g) => (
                      <option key={g} value={g}>
                        ชั้น {g}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleExportRosterToExcel}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs rounded-xl shadow-xs transition-colors cursor-pointer shrink-0"
                >
                  <Download className="w-4 h-4" />
                  <span>ส่งออกเป็น Excel (.xlsx)</span>
                </button>
              </div>

              {/* Student Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-xs">
                <div className="max-h-[50vh] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold sticky top-0">
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
                                  className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md transition-colors"
                                  title="แก้ไขข้อมูล"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => {
                                    onUpdateStudent({ ...std, password: '123456' });
                                  }}
                                  className="p-1 text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-md transition-colors"
                                  title="รีเซ็ตรหัสผ่านเป็น 123456"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  onClick={() => onDeleteStudent(std.id)}
                                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
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

          {/* TAB 2: Excel / CSV Import */}
          {activeTab === 'excel' && (
            <div className="space-y-6">
              {/* Instructions & Template Download */}
              <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-900 dark:text-emerald-200 font-bold font-prompt text-sm">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span>นำเข้าบัญชีนักเรียนผ่านไฟล์ Excel (.xlsx / .csv)</span>
                  </div>
                  <p className="text-xs text-emerald-700 dark:text-emerald-300">
                    เตรียมไฟล์ Excel ที่มีคอลัมน์: <strong>เลขประจำตัวนักเรียน</strong>, <strong>ชื่อ-นามสกุล</strong>, <strong>รหัสผ่าน</strong>, <strong>ระดับชั้น</strong>
                  </p>
                </div>

                <button
                  onClick={handleDownloadSampleTemplate}
                  className="px-4 py-2 bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-bold text-xs rounded-xl transition-colors shrink-0 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>ดาวน์โหลดไฟล์ตัวอย่าง Excel</span>
                </button>
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
                    <h4 className="text-xs font-bold font-prompt text-slate-900 dark:text-white">
                      ตัวอย่างข้อมูลนักเรียนที่จะนำเข้า ({parsedRows.length} รายการ)
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

          {/* TAB 3: Manual Add Student */}
          {activeTab === 'manual' && (
            <form onSubmit={handleManualSubmit} className="space-y-4 max-w-lg mx-auto py-2">
              <div className="text-center space-y-1 mb-4">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                  <UserPlus className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                  เพิ่มนักเรียนเข้าสู่ระบบทีละคน
                </h3>
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs"
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

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 text-white dark:bg-indigo-600 hover:bg-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            เสร็จสิ้น
          </button>
        </div>
      </div>

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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-xs"
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
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-md hover:bg-indigo-700"
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
