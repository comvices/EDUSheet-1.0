import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Award,
  Sparkles,
  ChevronRight,
  FileText,
  Download,
  Copy,
  Check,
  Loader2,
  CheckSquare,
  Square,
  Save,
  Zap,
  RotateCcw,
  FolderGit2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Assignment, Submission, StudentProfile } from '../types';
import { SaveConfirmModal } from './SaveConfirmModal';
import { getAuthHeaders } from '../utils/security';

export interface BatchGradeSaveItem {
  submissionId: string;
  score: number;
  comment: string;
  status: 'graded' | 'needs_revision';
  aiGraded?: boolean;
}

interface BatchDraftResult {
  submissionId: string;
  studentName: string;
  studentCode: string;
  gradeLevel: string;
  success: boolean;
  include: boolean;
  score: number;
  maxPoints: number;
  status: 'graded' | 'needs_revision';
  comment: string;
  error?: string;
}

interface SubmissionRosterModalProps {
  assignment: Assignment;
  submissions: Submission[];
  students?: StudentProfile[];
  onClose: () => void;
  onSelectStudentSubmission: (submission: Submission) => void;
  onBatchSaveGrades?: (updates: BatchGradeSaveItem[]) => void;
  onOpenSplitThisWorksheet?: (assignment: Assignment) => void;
}

export const SubmissionRosterModal: React.FC<SubmissionRosterModalProps> = ({
  assignment,
  submissions,
  students = [],
  onClose,
  onSelectStudentSubmission,
  onBatchSaveGrades,
  onOpenSplitThisWorksheet,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roomFilter, setRoomFilter] = useState<string>('ทั้งหมด');
  const [activeTab, setActiveTab] = useState<'submitted' | 'missing'>('submitted');
  const [statusFilter, setStatusFilter] = useState<'all' | 'submitted' | 'graded' | 'needs_revision'>('all');
  const [hasCopiedNames, setHasCopiedNames] = useState(false);

  // Multi-select & Batch AI Grading states
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchGrading, setIsBatchGrading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchResults, setBatchResults] = useState<BatchDraftResult[] | null>(null);
  const [isBatchSaveConfirmOpen, setIsBatchSaveConfirmOpen] = useState(false);

  // Filter submissions for this assignment
  const assignmentSubmissions = useMemo(
    () => submissions.filter((s) => s.assignmentId === assignment.id),
    [submissions, assignment.id]
  );

  // Determine students targeted by this assignment
  const targetedStudents = useMemo(
    () =>
      students.filter((std) => {
        if (assignment.gradeLevel === 'ทั้งหมด') return true;
        if (std.gradeLevel === assignment.gradeLevel) return true;
        if (std.gradeLevel.includes('/')) {
          const baseGrade = std.gradeLevel.split('/')[0];
          if (assignment.gradeLevel === baseGrade || assignment.gradeLevel === `${baseGrade} (ทุกห้อง)`) {
            return true;
          }
        }
        return false;
      }),
    [students, assignment.gradeLevel]
  );

  const submittedStudentCodes = useMemo(
    () =>
      new Set(
        assignmentSubmissions.map((s) => s.studentCode?.toUpperCase().trim()).filter(Boolean)
      ),
    [assignmentSubmissions]
  );

  const studentRoomByCode = useMemo(() => {
    const map = new Map<string, string>();
    students.forEach((s) => {
      if (s.code && s.gradeLevel) {
        map.set(s.code.toUpperCase().trim(), s.gradeLevel);
      }
    });
    return map;
  }, [students]);

  const getSubmissionEffectiveRoom = (sub: Submission): string => {
    const fromRoster = sub.studentCode
      ? studentRoomByCode.get(sub.studentCode.toUpperCase().trim())
      : undefined;
    return fromRoster || sub.gradeLevel || '';
  };

  const availableRoomsInModal = useMemo(() => {
    const set = new Set<string>();
    assignmentSubmissions.forEach((s) => {
      const r = getSubmissionEffectiveRoom(s);
      if (r) set.add(r);
    });
    targetedStudents.forEach((s) => {
      if (s.gradeLevel) set.add(s.gradeLevel);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
  }, [assignmentSubmissions, targetedStudents, studentRoomByCode]);

  const missingStudents = useMemo(
    () =>
      targetedStudents.filter((std) => {
        if (submittedStudentCodes.has(std.code?.toUpperCase().trim())) return false;
        if (roomFilter !== 'ทั้งหมด' && std.gradeLevel !== roomFilter) return false;
        return true;
      }),
    [targetedStudents, submittedStudentCodes, roomFilter]
  );

  const filteredSubmissions = useMemo(
    () =>
      assignmentSubmissions.filter((s) => {
        if (roomFilter !== 'ทั้งหมด') {
          if (getSubmissionEffectiveRoom(s) !== roomFilter) return false;
        }
        if (searchTerm) {
          const q = searchTerm.toLowerCase();
          const matchName = s.studentName.toLowerCase().includes(q);
          const matchCode = s.studentCode.toLowerCase().includes(q);
          if (!matchName && !matchCode) return false;
        }
        if (statusFilter !== 'all' && s.status !== statusFilter) return false;
        return true;
      }),
    [assignmentSubmissions, roomFilter, searchTerm, statusFilter, studentRoomByCode]
  );

  // Calculate statistics
  const totalCount = assignmentSubmissions.length;
  const gradedCount = assignmentSubmissions.filter((s) => s.status === 'graded').length;
  const pendingCount = assignmentSubmissions.filter((s) => s.status === 'submitted').length;
  const revisionCount = assignmentSubmissions.filter((s) => s.status === 'needs_revision').length;

  const gradedScores = assignmentSubmissions
    .filter((s) => s.score !== undefined)
    .map((s) => s.score || 0);
  const avgScore =
    gradedScores.length > 0
      ? (gradedScores.reduce((a, b) => a + b, 0) / gradedScores.length).toFixed(1)
      : '0';

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const pendingSubmissions = useMemo(
    () => assignmentSubmissions.filter((s) => s.status === 'submitted'),
    [assignmentSubmissions]
  );

  const toggleSelectId = (subId: string) => {
    setSelectedIds((prev) =>
      prev.includes(subId) ? prev.filter((id) => id !== subId) : [...prev, subId]
    );
  };

  const handleSelectPendingOnly = () => {
    setSelectedIds(pendingSubmissions.map((s) => s.id));
  };

  const handleSelectAllFiltered = () => {
    const ids = filteredSubmissions.map((s) => s.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedSet.has(id));
    if (allSelected) {
      setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  };

  const runBatchAiGrading = async (targetSubmissions: Submission[]) => {
    if (targetSubmissions.length === 0) return;

    setIsBatchGrading(true);
    setBatchError(null);
    setBatchResults(null);
    setBatchProgress({ done: 0, total: targetSubmissions.length });

    const CHUNK_SIZE = 10;
    const accumulated: BatchDraftResult[] = [];
    const subLookup = new Map(targetSubmissions.map((s) => [s.id, s]));

    try {
      for (let i = 0; i < targetSubmissions.length; i += CHUNK_SIZE) {
        const chunk = targetSubmissions.slice(i, i + CHUNK_SIZE);
        const res = await fetch('/api/ai/grade-batch', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({
            assignmentTitle: assignment.title,
            subject: assignment.subject,
            gradeLevel: assignment.gradeLevel,
            instructions: assignment.instructions,
            questions: assignment.questions,
            maxPoints: assignment.totalPoints,
            submissions: chunk.map((s) => ({
              submissionId: s.id,
              studentName: s.studentName,
              studentCode: s.studentCode,
              answers: s.answers || {},
              files: s.files || [],
            })),
          }),
        });

        const rawBody = await res.text();
        let data: any = null;
        try {
          data = rawBody ? JSON.parse(rawBody) : null;
        } catch {
          data = null;
        }

        if (!res.ok || !data?.success || !Array.isArray(data?.results)) {
          throw new Error(data?.message || data?.error || 'ไม่สามารถตรวจงานแบบกลุ่มด้วย AI ได้');
        }

        for (const item of data.results as Array<{
          submissionId: string;
          success: boolean;
          result?: {
            suggestedScore: number;
            maxPoints: number;
            recommendedStatus: 'graded' | 'needs_revision';
            overallFeedback: string;
          };
          error?: string;
        }>) {
          const origSub = subLookup.get(item.submissionId);
          if (!origSub) continue;

          if (item.success && item.result) {
            accumulated.push({
              submissionId: origSub.id,
              studentName: origSub.studentName,
              studentCode: origSub.studentCode,
              gradeLevel: origSub.gradeLevel,
              success: true,
              include: true,
              score: item.result.suggestedScore,
              maxPoints: item.result.maxPoints || assignment.totalPoints,
              status: item.result.recommendedStatus || 'graded',
              comment: item.result.overallFeedback || '',
            });
          } else {
            accumulated.push({
              submissionId: origSub.id,
              studentName: origSub.studentName,
              studentCode: origSub.studentCode,
              gradeLevel: origSub.gradeLevel,
              success: false,
              include: false,
              score: origSub.score || 0,
              maxPoints: assignment.totalPoints,
              status: 'graded',
              comment: origSub.teacherComment || '',
              error: item.error || 'ประเมินไม่สำเร็จ',
            });
          }
        }

        setBatchProgress({
          done: Math.min(targetSubmissions.length, i + chunk.length),
          total: targetSubmissions.length,
        });
      }

      setBatchResults(accumulated);
    } catch (err: any) {
      console.error('Batch AI grading error:', err);
      setBatchError(
        err?.message ||
          'เกิดข้อผิดพลาดระหว่างการตรวจงานแบบกลุ่มด้วย AI กรุณาลองใหม่อีกครั้ง'
      );
      if (accumulated.length > 0) {
        setBatchResults(accumulated);
      }
    } finally {
      setIsBatchGrading(false);
    }
  };

  const includedBatchItems = useMemo(
    () => (batchResults || []).filter((r) => r.success && r.include),
    [batchResults]
  );

  const handleConfirmBatchSave = () => {
    if (!onBatchSaveGrades || includedBatchItems.length === 0) return;
    onBatchSaveGrades(
      includedBatchItems.map((item) => ({
        submissionId: item.submissionId,
        score: Math.max(0, Math.min(item.maxPoints, Number(item.score) || 0)),
        comment: item.comment,
        status: item.status,
        aiGraded: true,
      }))
    );
    setIsBatchSaveConfirmOpen(false);
    setBatchResults(null);
    setSelectedIds([]);
  };

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
      'สถานะ':
        s.status === 'graded'
          ? 'ตรวจแล้ว'
          : s.status === 'needs_revision'
          ? 'ต้องแก้ไข'
          : 'รอตรวจ',
      'ความคิดเห็นครู': s.teacherComment || '-',
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงานการส่งงาน');
    XLSX.writeFile(
      workbook,
      `รายงานผลการส่ง_${assignment.title}_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const allFilteredSelected =
    filteredSubmissions.length > 0 &&
    filteredSubmissions.every((s) => selectedSet.has(s.id));

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
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
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
                ส่งแล้ว {totalCount} คน{' '}
                {targetedStudents.length > 0
                  ? `(จากนักเรียนทั้งหมด ${targetedStudents.length} คน)`
                  : ''}
              </h3>
            </div>

            {/* Quick Stats Grid */}
            <div className="flex items-center gap-2.5 flex-wrap">
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
                <p className="text-base font-bold font-mono text-rose-400">
                  {missingStudents.length} คน
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur px-3.5 py-2 rounded-xl border border-white/10 text-center">
                <p className="text-[10px] text-slate-400">คะแนนเฉลี่ย</p>
                <p className="text-base font-bold font-mono text-indigo-300">
                  {avgScore} / {assignment.totalPoints}
                </p>
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

          {activeTab === 'submitted' && onBatchSaveGrades && assignmentSubmissions.length > 0 && !batchResults && (
            <div className="flex items-center gap-2 flex-wrap">
              {pendingSubmissions.length > 0 && (
                <button
                  type="button"
                  disabled={isBatchGrading}
                  onClick={() => {
                    setSelectedIds(pendingSubmissions.map((s) => s.id));
                    runBatchAiGrading(pendingSubmissions);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isBatchGrading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                  )}
                  <span>AI ตรวจรอตรวจทั้งหมด ({pendingSubmissions.length} คน)</span>
                </button>
              )}

              {selectedIds.length > 0 && (
                <button
                  type="button"
                  disabled={isBatchGrading}
                  onClick={() => {
                    const chosen = assignmentSubmissions.filter((s) => selectedSet.has(s.id));
                    runBatchAiGrading(chosen);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>AI ตรวจที่เลือก ({selectedIds.length} คน)</span>
                </button>
              )}
            </div>
          )}

          {activeTab === 'missing' && missingStudents.length > 0 && (
            <button
              onClick={() => {
                const textList = missingStudents
                  .map((s, i) => `${i + 1}. ${s.name} (${s.code}) ชั้น ${s.gradeLevel}`)
                  .join('\n');
                navigator.clipboard.writeText(
                  `รายชื่อนักเรียนที่ยังไม่ส่งงาน "${assignment.title}":\n${textList}`
                );
                setHasCopiedNames(true);
                setTimeout(() => setHasCopiedNames(false), 3000);
              }}
              className="px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              {hasCopiedNames ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-indigo-500" />
              )}
              <span>{hasCopiedNames ? 'คัดลอกรายชื่อแล้ว!' : 'คัดลอกรายชื่อคนยังไม่ส่งไปแจ้งในไลน์'}</span>
            </button>
          )}
        </div>

        {/* Batch Progress / Error Banner */}
        {(isBatchGrading || batchError) && (
          <div className="px-6 py-3 bg-indigo-50 dark:bg-indigo-950/40 border-b border-indigo-200 dark:border-indigo-800/60 space-y-2">
            {isBatchGrading && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-indigo-700 dark:text-indigo-300">
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>กำลังตรวจงานพร้อมกันด้วย AI (แบบขนาน)...</span>
                  </span>
                  <span className="font-mono">
                    {batchProgress.done} / {batchProgress.total} คน (
                    {batchProgress.total > 0
                      ? Math.round((batchProgress.done / batchProgress.total) * 100)
                      : 0}
                    %)
                  </span>
                </div>
                <div className="w-full h-2 bg-indigo-200/70 dark:bg-indigo-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 dark:bg-indigo-400 transition-all duration-300 rounded-full"
                    style={{
                      width: `${
                        batchProgress.total > 0
                          ? (batchProgress.done / batchProgress.total) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            )}

            {batchError && (
              <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{batchError}</span>
              </div>
            )}
          </div>
        )}

        {/* Filter and Selection Toolbar (hidden during Batch Review screen) */}
        {!batchResults && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
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
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    ทั้งหมด ({totalCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('submitted')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'submitted'
                        ? 'bg-amber-500 text-slate-950 font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    รอตรวจ ({pendingCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('graded')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      statusFilter === 'graded'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    ตรวจแล้ว ({gradedCount})
                  </button>
                  <button
                    onClick={() => setStatusFilter('needs_revision')}
                    className={`px-3 py-1.5 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
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

            {availableRoomsInModal.length > 1 && (
              <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
                <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-semibold mr-1">
                    แยกดูตามห้อง:
                  </span>
                  {['ทั้งหมด', ...availableRoomsInModal].map((rm) => (
                    <button
                      key={rm}
                      type="button"
                      onClick={() => setRoomFilter(rm)}
                      className={`px-2.5 py-1 rounded-lg font-semibold border transition-colors cursor-pointer ${
                        roomFilter === rm
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-indigo-400'
                      }`}
                    >
                      {rm === 'ทั้งหมด' ? 'ทุกห้อง' : `ห้อง ${rm}`}
                    </button>
                  ))}
                </div>

                {onOpenSplitThisWorksheet && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenSplitThisWorksheet(assignment);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-[11px] font-bold cursor-pointer"
                  >
                    <FolderGit2 className="w-3.5 h-3.5" />
                    <span>โยกแยกใบงานนี้ตามห้องนักเรียน</span>
                  </button>
                )}
              </div>
            )}

            {activeTab === 'submitted' && onBatchSaveGrades && filteredSubmissions.length > 0 && (
              <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] pt-1 border-t border-slate-200/70 dark:border-slate-700/60">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={handleSelectAllFiltered}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-400 font-semibold cursor-pointer"
                  >
                    {allFilteredSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-400" />
                    )}
                    <span>
                      {allFilteredSelected
                        ? 'ยกเลิกเลือกทั้งหมดในหน้านี้'
                        : `เลือกทั้งหมดที่แสดง (${filteredSubmissions.length} คน)`}
                    </span>
                  </button>

                  {pendingSubmissions.length > 0 && (
                    <button
                      type="button"
                      onClick={handleSelectPendingOnly}
                      className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 hover:bg-amber-100 font-semibold cursor-pointer"
                    >
                      เลือกเฉพาะที่รอตรวจ ({pendingSubmissions.length} คน)
                    </button>
                  )}

                  {selectedIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="px-2.5 py-1 rounded-lg text-slate-500 hover:text-rose-600 font-semibold cursor-pointer"
                    >
                      ล้างการเลือก ({selectedIds.length})
                    </button>
                  )}
                </div>

                <span className="text-slate-500 dark:text-slate-400">
                  เลือกหลายคนเพื่อใช้ AI ตรวจพร้อมกันทีเดียว หรือคลิกชื่อเพื่อตรวจรายบุคคล
                </span>
              </div>
            )}
          </div>
        )}

        {/* Main Scrollable Content Area */}
        <div className="p-6 overflow-y-auto flex-1 space-y-3">
          {batchResults ? (
            /* Batch AI Grading Review & Save View */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                <div>
                  <h3 className="text-sm font-bold font-prompt text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span>
                      ผลการประเมินด้วย AI พร้อมกัน ({batchResults.filter((r) => r.success).length}/
                      {batchResults.length} คน)
                    </span>
                  </h3>
                  <p className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5">
                    ครูสามารถปรับคะแนน ความคิดเห็น หรือสถานะของแต่ละคนได้ทันที แล้วกดบันทึกผลการตรวจทั้งหมดพร้อมกัน
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setBatchResults(null)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>กลับไปหน้ารายชื่อ</span>
                </button>
              </div>

              <div className="space-y-2.5">
                {batchResults.map((item, idx) => (
                  <div
                    key={item.submissionId}
                    className={`p-4 rounded-2xl border transition-all space-y-3 ${
                      !item.success
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                        : item.include
                        ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800 shadow-2xs'
                        : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 opacity-70'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {item.success && (
                          <input
                            type="checkbox"
                            checked={item.include}
                            onChange={(e) =>
                              setBatchResults((prev) =>
                                prev
                                  ? prev.map((r) =>
                                      r.submissionId === item.submissionId
                                        ? { ...r, include: e.target.checked }
                                        : r
                                    )
                                  : prev
                              )
                            }
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                        )}
                        <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center shrink-0">
                          {idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-bold text-slate-900 dark:text-white">
                              {item.studentName}
                            </span>
                            <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md text-[10px] font-mono text-slate-600 dark:text-slate-400">
                              {item.studentCode}
                            </span>
                            <span className="text-[10px] text-slate-400">{item.gradeLevel}</span>
                          </div>
                        </div>
                      </div>

                      {item.success ? (
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="text-[11px] text-slate-500">คะแนน:</span>
                            <input
                              type="number"
                              min={0}
                              max={item.maxPoints}
                              step="0.5"
                              value={item.score}
                              onChange={(e) => {
                                const val = Math.max(
                                  0,
                                  Math.min(item.maxPoints, Number(e.target.value) || 0)
                                );
                                setBatchResults((prev) =>
                                  prev
                                    ? prev.map((r) =>
                                        r.submissionId === item.submissionId
                                          ? { ...r, score: val }
                                          : r
                                      )
                                    : prev
                                );
                              }}
                              className="w-16 px-1.5 py-0.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-bold font-mono text-center text-indigo-600 dark:text-indigo-400"
                            />
                            <span className="text-[11px] text-slate-500 font-mono">
                              / {item.maxPoints}
                            </span>
                          </div>

                          <select
                            value={item.status}
                            onChange={(e) => {
                              const nextSt = e.target.value as 'graded' | 'needs_revision';
                              setBatchResults((prev) =>
                                prev
                                  ? prev.map((r) =>
                                      r.submissionId === item.submissionId
                                        ? { ...r, status: nextSt }
                                        : r
                                    )
                                  : prev
                              );
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border cursor-pointer ${
                              item.status === 'graded'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                : 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                            }`}
                          >
                            <option value="graded">ตรวจแล้ว (อนุมัติ)</option>
                            <option value="needs_revision">ส่งกลับแก้ไข</option>
                          </select>
                        </div>
                      ) : (
                        <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                          {item.error || 'ประเมินไม่สำเร็จ'}
                        </span>
                      )}
                    </div>

                    {item.success && (
                      <input
                        type="text"
                        value={item.comment}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchResults((prev) =>
                            prev
                              ? prev.map((r) =>
                                  r.submissionId === item.submissionId
                                    ? { ...r, comment: val }
                                    : r
                                )
                              : prev
                          );
                        }}
                        placeholder="ความเห็นเพิ่มเติมสำหรับนักเรียน..."
                        className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-700 dark:text-slate-200 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : activeTab === 'missing' ? (
            missingStudents.length === 0 ? (
              <div className="text-center py-16 text-emerald-600 dark:text-emerald-400 text-xs space-y-1">
                <CheckCircle2 className="w-8 h-8 mx-auto" />
                <p className="font-bold text-sm">ยอดเยี่ยมมาก! นักเรียนส่งงานครบทุกคนแล้ว</p>
                <p className="text-slate-400">
                  ไม่มีนักเรียนค้างส่งในระดับชั้น {assignment.gradeLevel}
                </p>
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
              {filteredSubmissions.map((sub, idx) => {
                const isSelected = selectedSet.has(sub.id);
                return (
                  <div
                    key={sub.id}
                    onClick={() => onSelectStudentSubmission(sub)}
                    className={`p-4 bg-white dark:bg-slate-900 border rounded-xl hover:border-indigo-500 dark:hover:border-indigo-500 transition-all flex items-center justify-between gap-4 cursor-pointer group shadow-2xs hover:shadow-md ${
                      isSelected
                        ? 'border-indigo-500 ring-1 ring-indigo-500/30 bg-indigo-50/30 dark:bg-indigo-950/20'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {onBatchSaveGrades && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelectId(sub.id);
                          }}
                          className="p-1 text-slate-400 hover:text-indigo-600 cursor-pointer shrink-0"
                          title="เลือกเพื่อตรวจพร้อมกันด้วย AI"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      )}

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
                          <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
                            ตรวจแล้ว
                          </p>
                        </div>
                      ) : sub.status === 'needs_revision' ? (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                            <AlertCircle className="w-3.5 h-3.5" />
                            ให้กลับไปแก้ไข
                          </span>
                          <p className="text-[10px] text-slate-400">
                            {sub.score ? `${sub.score} คะแนน` : 'รอแก้ไข'}
                          </p>
                        </div>
                      ) : (
                        <div className="text-right">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                            <Clock className="w-3.5 h-3.5" />
                            ส่งแล้ว (รอตรวจ)
                          </span>
                          <p className="text-[10px] text-indigo-500 font-medium">
                            กดตรวจด้วย AI ทันที
                          </p>
                        </div>
                      )}

                      <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          {batchResults ? (
            <>
              <span>
                เลือกบันทึก {includedBatchItems.length} จาก {batchResults.length} คน
              </span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setBatchResults(null)}
                  className="px-4 py-2 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-white font-medium rounded-xl transition-colors cursor-pointer"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  disabled={includedBatchItems.length === 0}
                  onClick={() => setIsBatchSaveConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>ยืนยันและบันทึกผลการตรวจ ({includedBatchItems.length} คน)</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <span>
                ติ๊กเลือกนักเรียนหลายคนเพื่อตรวจพร้อมกันด้วย AI หรือคลิกที่รายชื่อเพื่อตรวจรายบุคคล
              </span>
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
            </>
          )}
        </div>
      </div>

      <SaveConfirmModal
        isOpen={isBatchSaveConfirmOpen}
        title={`ยืนยันการบันทึกผลการตรวจพร้อมกัน (${includedBatchItems.length} คน)?`}
        description="ผลการตรวจและคะแนนทั้งหมดที่เลือกจะถูกบันทึกลงฐานข้อมูลทันที"
        details={[
          { label: 'ใบงาน', value: assignment.title },
          { label: 'จำนวนที่บันทึก', value: `${includedBatchItems.length} คน` },
          {
            label: 'ผ่าน/ตรวจแล้ว',
            value: `${includedBatchItems.filter((i) => i.status === 'graded').length} คน`,
          },
          {
            label: 'ส่งกลับแก้ไข',
            value: `${includedBatchItems.filter((i) => i.status === 'needs_revision').length} คน`,
          },
        ]}
        confirmLabel="ยืนยันบันทึกผลทั้งหมด"
        onConfirm={handleConfirmBatchSave}
        onCancel={() => setIsBatchSaveConfirmOpen(false)}
      />
    </div>
  );
};
