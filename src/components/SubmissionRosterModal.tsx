import React, { useState } from 'react';
import { X, Search, CheckCircle2, Clock, AlertCircle, Award, Sparkles, ChevronRight, Filter, UserCheck, FileText, Download, Users, Copy, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Assignment, Submission, StudentProfile } from '../types';

interface SubmissionRosterModalProps {
  assignment: Assignment;
  submissions: Submission[];
  students?: StudentProfile[];
  onClose: () => void;
  onSelectStudentSubmission: (submission: Submission) => void;
  onBatchAiGrade?: () => void;
}

export const SubmissionRosterModal: React.FC<SubmissionRosterModalProps> = ({
  assignment,
  submissions,
  students = [],
  onClose,
  onSelectStudentSubmission,
  onBatchAiGrade,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'submitted' | 'missing'>('submitted');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'graded' | 'needs_revision'>('all');
  const [hasCopiedNames, setHasCopiedNames] = useState(false);

  // Filter submissions for this assignment
  const assignmentSubmissions = submissions.filter((s) => s.assignmentId === assignment.id);

  // Determine students targeted by this assignment
  const targetedStudents = students.filter((std) => {
    if (assignment.gradeLevel === 'ทั้งหมด') return true;
    if (std.gradeLevel === assignment.gradeLevel) return true;
    if (std.gradeLevel.includes('/')) {
      const baseGrade = std.gradeLevel.split('/')[0];
      if (assignment.gradeLevel === baseGrade || assignment.gradeLevel === `${baseGrade} (ทุกห้อง)`) return true;
    }
    return false;
  });

  // Calculate who hasn't submitted yet
  const submittedStudentCodes = new Set(
    assignmentSubmissions.map((s) => s.studentCode?.toUpperCase().trim()).filter(Boolean)
  );

  const missingStudents = targetedStudents.filter(
    (std) => !submittedStudentCodes.has(std.code?.toUpperCase().trim())
  );

  const filteredSubmissions = assignmentSubmissions.filter((s) => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      const matchName = s.studentName.toLowerCase().includes(q);
      const matchCode = s.studentCode.toLowerCase().includes(q);
      if (!matchName && !matchCode) return false;
    }
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    return true;
  });

  // Calculate statistics
  const totalCount = assignmentSubmissions.length;
  const gradedCount = assignmentSubmissions.filter((s) => s.status === 'graded').length;
  const pendingCount = assignmentSubmissions.filter((s) => s.status === 'submitted').length;
  const revisionCount = assignmentSubmissions.filter((s) => s.status === 'needs_revision').length;

  const gradedScores = assignmentSubmissions.filter((s) => s.score !== undefined).map((s) => s.score || 0);
  const avgScore = gradedScores.length > 0 ? (gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length).toFixed(1) : '0';

  const handleExportScoresToExcel = () => {
    const exportData = assignmentSubmissions.map((s, idx) => ({
      'ลำดับ': idx + 1,
      'เลขประจำตัวนักเรียน': s.studentCode,
      'ชื่อ-นามสกุล': s.studentName,
      'ระดับชั้น': s.gradeLevel,
      'วิชา': assignment.subject,
      'ชื่อใบงาน': assignment.title,
      'วันที่ส่ง': new Date(s.submissionDate).toLocaleString('th-TH'),
      'คะแนนที่ได้': s.score !== undefined ? s.score : 'ยังไม่ได้ตรวจ',
      'คะแนนเต็ม': s.maxScore || assignment.totalPoints,
      'สถานะ': s.status === 'graded' ? 'ตรวจแล้ว' : s.status === 'needs_revision' ? 'ต้องแก้ไข' : 'รอตรวจ',
      'ความคิดเห็นครู': s.teacherComment || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานการส่งงาน');
    XLSX.writeFile(workbook, `รายงานผลการส่ง_${assignment.title}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-0.5">
              <span>รายชื่อการส่งงานของนักเรียน ({totalCount} คน)</span>
              <span aria-hidden="true">·</span>
              <span>ระดับชั้น {assignment.gradeLevel}</span>
              <span aria-hidden="true">·</span>
              <span>วิชา{assignment.subject}</span>
            </div>
            <h2 className="text-lg font-bold font-prompt text-slate-900 dark:text-white">
              {assignment.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Top Summary Banner */}
        <div className="p-6 bg-slate-900 text-white relative overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-indigo-300 font-medium mb-1">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>คะแนนเต็ม {assignment.totalPoints} คะแนน</span>
                <span aria-hidden="true">·</span>
                <span>ระดับชั้น: {assignment.gradeLevel}</span>
                <span aria-hidden="true">·</span>
                <span>ครูผู้สอน: {assignment.teacherName}</span>
              </div>
              <h3 className="text-xl font-bold font-prompt">
                ส่งแล้ว {totalCount} คน {targetedStudents.length > 0 ? `(จากนักเรียนทั้งหมด ${targetedStudents.length} คน)` : ''}
              </h3>
            </div>

            {/* Quick Stats Grid */}
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur px-3.5 py-2 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] text-slate-400">ตรวจแล้ว</p>
                <p className="text-base font-bold font-mono text-emerald-400">{gradedCount} คน</p>
              </div>

              <div className="bg-white/10 backdrop-blur px-3.5 py-2 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] text-slate-400">รอตรวจ</p>
                <p className="text-base font-bold font-mono text-amber-400">{pendingCount} คน</p>
              </div>

              <div className="bg-white/10 backdrop-blur px-3.5 py-2 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] text-slate-400">ยังไม่ส่ง</p>
                <p className="text-base font-bold font-mono text-rose-400">{missingStudents.length} คน</p>
              </div>

              <div className="bg-white/10 backdrop-blur px-3.5 py-2 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] text-slate-400">คะแนนเฉลี่ย</p>
                <p className="text-base font-bold font-mono text-indigo-300">{avgScore} / {assignment.totalPoints}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Selector: Submitted vs Missing */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 px-4 py-2 gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('submitted')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'submitted'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>นักเรียนที่ส่งแล้ว ({assignmentSubmissions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('missing')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'missing'
                  ? 'bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-xs border border-slate-200 dark:border-slate-700'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Clock className="w-4 h-4 text-rose-500" />
              <span>นักเรียนที่ยังไม่ส่ง ({missingStudents.length})</span>
            </button>
          </div>

          {activeTab === 'missing' && missingStudents.length > 0 && (
            <button
              onClick={() => {
                const textList = missingStudents.map((s, i) => `${i + 1}. ${s.name} (${s.code}) ชั้น ${s.gradeLevel}`).join('\n');
                navigator.clipboard.writeText(`รายชื่อนักเรียนที่ยังไม่ส่งงาน "${assignment.title}":\n${textList}`);
                setHasCopiedNames(true);
                setTimeout(() => setHasCopiedNames(false), 3000);
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {hasCopiedNames ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-indigo-500" />}
              <span>{hasCopiedNames ? 'คัดลอกรายชื่อแล้ว!' : 'คัดลอกรายชื่อคนยังไม่ส่งไปแจ้งในไลน์'}</span>
            </button>
          )}
        </div>

        {/* Filter and Search Bar */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อ หรือเลขประจำตัวนักเรียน..."
              className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Segmented Filter (only in submitted tab) */}
          {activeTab === 'submitted' && (
            <div className="flex items-center gap-1 p-1 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs w-full sm:w-auto overflow-x-auto">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'all'
                    ? 'bg-indigo-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ทั้งหมด ({totalCount})
              </button>
              <button
                onClick={() => setStatusFilter('submitted')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'submitted'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                รอตรวจ ({pendingCount})
              </button>
              <button
                onClick={() => setStatusFilter('graded')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'graded'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ตรวจแล้ว ({gradedCount})
              </button>
              <button
                onClick={() => setStatusFilter('needs_revision')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap ${
                  statusFilter === 'needs_revision'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                ให้แก้ไข ({revisionCount})
              </button>
            </div>
          )}
        </div>

        {/* Student Submissions Table / Roster Grid */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {activeTab === 'missing' ? (
            missingStudents.length === 0 ? (
              <div className="text-center py-16 text-emerald-600 dark:text-emerald-400 text-xs space-y-1">
                <CheckCircle2 className="w-8 h-8 mx-auto" />
                <p className="font-bold text-sm">ยอดเยี่ยมมาก! นักเรียนส่งงานครบทุกคนแล้ว</p>
                <p className="text-slate-400">ไม่มีนักเรียนค้างส่งในระดับชั้น {assignment.gradeLevel}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-2 px-1">
                  <span>รายชื่อนักเรียนที่ยังไม่ได้ส่งงาน ({missingStudents.length} คน)</span>
                  <span className="text-rose-500 font-semibold font-prompt">สถานะ: ยังไม่ส่ง</span>
                </div>
                {missingStudents.map((std, idx) => (
                  <div
                    key={std.id}
                    className="p-3.5 bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/80 dark:border-rose-900/40 rounded-xl flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-950 text-rose-600 font-bold text-xs flex items-center justify-center shrink-0">
                        {idx + 1}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                            {std.name}
                          </h4>
                          <span className="px-2 py-0.5 bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800 rounded-md text-[10px] font-mono text-rose-700 dark:text-rose-300">
                            {std.code}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          ระดับชั้น: <strong>{std.gradeLevel}</strong>
                        </p>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-rose-100 dark:bg-rose-900/50 text-rose-700 dark:text-rose-300 rounded-lg text-[10px] font-bold">
                      ค้างส่ง
                    </span>
                  </div>
                ))}
              </div>
            )
          ) : filteredSubmissions.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              ไม่พบรายชื่อนักเรียนในเงื่อนไขที่เลือก
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2.5">
              {filteredSubmissions.map((sub, idx) => (
                <div
                  key={sub.id}
                  onClick={() => onSelectStudentSubmission(sub)}
                  className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all flex items-center justify-between gap-4 cursor-pointer group shadow-2xs hover:shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {sub.studentName}
                        </h4>
                        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-mono text-slate-600 dark:text-slate-400 shrink-0">
                          {sub.studentCode}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        ส่งเมื่อ: {new Date(sub.submissionDate).toLocaleString('th-TH')}
                      </p>
                    </div>
                  </div>

                  {/* Right Status & Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    {sub.status === 'graded' ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-bold font-mono text-emerald-600 dark:text-emerald-400">
                          <Award className="w-3.5 h-3.5" />
                          {sub.score}/{sub.maxScore} คะแนน
                        </span>
                        <p className="text-[10px] text-emerald-700 dark:text-emerald-300">ตรวจแล้ว</p>
                      </div>
                    ) : sub.status === 'needs_revision' ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          <AlertCircle className="w-3.5 h-3.5" />
                          ให้กลับไปแก้ไข
                        </span>
                        <p className="text-[10px] text-slate-400">{sub.score ? `${sub.score} คะแนน` : 'รอแก้ไข'}</p>
                      </div>
                    ) : (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                          <Clock className="w-3.5 h-3.5" />
                          ส่งแล้ว (รอตรวจ)
                        </span>
                        <p className="text-[10px] text-indigo-500 font-medium">กดตรวจด้วย AI ทันที</p>
                      </div>
                    )}

                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>คลิกที่รายชื่อนักเรียนคนใดก็ได้เพื่อตรวจทานคำตอบหรือใช้ Gemini AI ตรวจทันที</span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleExportScoresToExcel}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
              title="ส่งออกรายงานคะแนนและผลการตรวจของใบงานนี้เป็น Excel"
            >
              <Download className="w-4 h-4" />
              <span>ส่งออกคะแนนเป็น Excel (.xlsx)</span>
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-white font-medium rounded-xl transition-colors cursor-pointer"
            >
              ปิดหน้าต่าง
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
