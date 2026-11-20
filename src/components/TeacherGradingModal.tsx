import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Award,
  CheckCircle,
  RotateCcw,
  AlertCircle,
  User,
  CheckCircle2,
  XCircle,
  MinusCircle,
  HelpCircle,
  Loader2,
  Paperclip,
  Image as ImageIcon,
  ZoomIn,
} from 'lucide-react';
import { Assignment, Submission } from '../types';
import { SaveConfirmModal } from './SaveConfirmModal';
import { getAuthHeaders } from '../utils/security';

interface ItemFeedbackResult {
  questionIndex: number;
  questionId?: string;
  status: 'correct' | 'partial' | 'incorrect' | 'unanswered';
  score: number;
  maxScore: number;
  comment: string;
}

interface AiFeedbackResult {
  suggestedScore: number;
  maxPoints?: number;
  recommendedStatus?: 'graded' | 'needs_revision';
  overallFeedback: string;
  strengths?: string[];
  improvements?: string[];
  itemFeedback?: ItemFeedbackResult[];
}

interface TeacherGradingModalProps {
  assignment: Assignment;
  submission?: Submission;
  onClose: () => void;
  onSaveGrade: (
    submissionId: string,
    score: number,
    comment: string,
    status: 'graded' | 'needs_revision',
    aiGraded?: boolean
  ) => void;
}

export const TeacherGradingModal: React.FC<TeacherGradingModalProps> = ({
  assignment,
  submission,
  onClose,
  onSaveGrade,
}) => {
  const defaultScore = submission?.score !== undefined ? submission.score : 0;
  const [score, setScore] = useState<number>(defaultScore);
  const [teacherComment, setTeacherComment] = useState<string>(submission?.teacherComment || '');

  const [isAiGrading, setIsAiGrading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiFeedbackResult, setAiFeedbackResult] = useState<AiFeedbackResult | null>(null);
  const [usedAiGrading, setUsedAiGrading] = useState<boolean>(Boolean(submission?.aiGraded));
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
  const [pendingGradeAction, setPendingGradeAction] = useState<{
    status: 'graded' | 'needs_revision';
    clampedScore: number;
  } | null>(null);

  // Call server-side Gemini AI for Auto-Grading assistance
  const handleRunAiGrading = async () => {
    if (!submission) {
      setAiError('ไม่พบข้อมูลการส่งงานของนักเรียนรายนี้');
      return;
    }

    setIsAiGrading(true);
    setAiError(null);

    try {
      const res = await fetch('/api/ai/grade', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          assignmentTitle: assignment.title,
          subject: assignment.subject,
          gradeLevel: assignment.gradeLevel,
          instructions: assignment.instructions,
          questions: assignment.questions,
          answers: submission.answers || {},
          answerImages: submission.answerImages || {},
          files: submission.files || [],
          maxPoints: assignment.totalPoints,
        }),
      });

      const rawBody = await res.text();
      let data: any = null;
      try {
        data = rawBody ? JSON.parse(rawBody) : null;
      } catch {
        data = null;
      }
      if (!res.ok || !data?.success || !data?.result) {
        throw new Error(data?.message || data?.error || 'ไม่สามารถประเมินคำตอบด้วย AI ได้');
      }

      const result: AiFeedbackResult = data.result;
      setAiFeedbackResult(result);
      setUsedAiGrading(true);

      if (typeof result.suggestedScore === 'number') {
        setScore(result.suggestedScore);
      }
      if (result.overallFeedback) {
        setTeacherComment(result.overallFeedback);
      }
    } catch (err: any) {
      console.error('AI Grading error:', err);
      setAiError(
        err?.message ||
          'เกิดข้อผิดพลาดในการเชื่อมต่อระบบ AI กรุณาตรวจสอบการตั้งค่า GEMINI_API_KEY หรือลองใหม่อีกครั้ง'
      );
    } finally {
      setIsAiGrading(false);
    }
  };

  // Allow teacher to adjust individual item score and automatically recalculate total score
  const handleAdjustItemScore = (questionIndex: number, newItemScore: number) => {
    if (!aiFeedbackResult?.itemFeedback) return;

    const updatedItems = aiFeedbackResult.itemFeedback.map((item) => {
      if (item.questionIndex !== questionIndex) return item;
      const clamped = Math.max(0, Math.min(item.maxScore, Number.isFinite(newItemScore) ? newItemScore : 0));
      let nextStatus: ItemFeedbackResult['status'] = item.status;
      if (clamped >= item.maxScore && item.maxScore > 0) nextStatus = 'correct';
      else if (clamped > 0) nextStatus = 'partial';
      else if (item.status !== 'unanswered') nextStatus = 'incorrect';

      return {
        ...item,
        score: clamped,
        status: nextStatus,
      };
    });

    const sumItems = updatedItems.reduce((acc, it) => acc + it.score, 0);
    const sumQuestionMax = assignment.questions.reduce((acc, q) => acc + (Number(q.maxPoints) || 0), 0);
    let nextTotal = sumItems;
    if (sumQuestionMax > 0 && assignment.totalPoints !== sumQuestionMax) {
      nextTotal = (sumItems / sumQuestionMax) * assignment.totalPoints;
    }
    nextTotal = Math.max(0, Math.min(assignment.totalPoints, Math.round(nextTotal * 2) / 2));

    setAiFeedbackResult({
      ...aiFeedbackResult,
      suggestedScore: nextTotal,
      itemFeedback: updatedItems,
    });
    setScore(nextTotal);
  };

  const handleApproveGrade = () => {
    if (!submission) return;
    const clampedScore = Math.max(0, Math.min(assignment.totalPoints, Number(score) || 0));
    setPendingGradeAction({ status: 'graded', clampedScore });
  };

  const handleRequestRevision = () => {
    if (!submission) return;
    const clampedScore = Math.max(0, Math.min(assignment.totalPoints, Number(score) || 0));
    setPendingGradeAction({ status: 'needs_revision', clampedScore });
  };

  const getItemBadge = (item: ItemFeedbackResult) => {
    switch (item.status) {
      case 'correct':
        return {
          cls: 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          icon: <CheckCircle2 className="w-3.5 h-3.5" />,
          label: 'ถูกต้อง',
        };
      case 'partial':
        return {
          cls: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800',
          icon: <MinusCircle className="w-3.5 h-3.5" />,
          label: 'ถูกบางส่วน',
        };
      case 'unanswered':
        return {
          cls: 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700',
          icon: <HelpCircle className="w-3.5 h-3.5" />,
          label: 'ไม่ได้ตอบ',
        };
      case 'incorrect':
      default:
        return {
          cls: 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          icon: <XCircle className="w-3.5 h-3.5" />,
          label: 'ไม่ถูกต้อง',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#111c18] border border-slate-200 dark:border-emerald-950/60 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950/60 flex items-center justify-between bg-slate-50/90 dark:bg-[#0d1613]">
          <div>
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-0.5">
              <span>โหมดครูตรวจงาน</span>
              <span aria-hidden="true">·</span>
              <span>{assignment.gradeLevel}</span>
              <span aria-hidden="true">·</span>
              <span>วิชา{assignment.subject}</span>
            </div>
            <h2 className="text-lg font-bold font-prompt text-slate-900 dark:text-white">
              ตรวจใบงาน: {assignment.title}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200">
          {/* Student Info Card */}
          <div className="flex items-center justify-between p-4 bg-emerald-50/60 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-900/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-700 text-white flex items-center justify-center font-bold text-sm">
                <User className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {submission?.studentName || 'ไม่พบข้อมูลนักเรียน'}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  รหัสประจำตัว: {submission?.studentCode || '-'} · ชั้น {submission?.gradeLevel || assignment.gradeLevel}
                </p>
              </div>
            </div>

            <div className="text-right text-xs text-slate-500 dark:text-slate-400">
              <p>
                ส่งเมื่อ:{' '}
                {submission?.submissionDate
                  ? new Date(submission.submissionDate).toLocaleString('th-TH')
                  : '-'}
              </p>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                คะแนนเต็ม {assignment.totalPoints} คะแนน
              </p>
            </div>
          </div>

          {/* Attached Files if any */}
          {submission?.files && submission.files.length > 0 && (
            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                <Paperclip className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span>ไฟล์แนบจากนักเรียน ({submission.files.length} ไฟล์):</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {submission.files.map((f, i) => (
                  <a
                    key={i}
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#111c18] border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    <span>{f.name}</span>
                    {f.size && <span className="text-[10px] text-slate-400">({f.size})</span>}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* AI Grading Trigger Banner */}
          <div className="relative overflow-hidden p-4 bg-gradient-to-r from-[#0d261d] via-[#133b2e] to-teal-800 rounded-xl text-white shadow-md border border-emerald-400/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-white/15 rounded-xl backdrop-blur border border-white/15">
                <Sparkles className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <h4 className="text-sm font-bold font-prompt">
                  ระบบช่วยตรวจใบงานอัตโนมัติด้วย Gemini AI (ตรวจละเอียดรายข้อ)
                </h4>
                <p className="text-xs text-emerald-100/90">
                  ตรวจเทียบเฉลยทีละข้อ คำนวณคะแนนตามเกณฑ์จริง แจกแจงเหตุผลรายข้อ และสรุปคำแนะนำให้ครูตรวจสอบ
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRunAiGrading}
              disabled={isAiGrading || !submission}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-emerald-800 hover:bg-emerald-50 text-xs font-bold rounded-lg shadow-sm transition-all shrink-0 cursor-pointer disabled:opacity-50"
            >
              {isAiGrading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isAiGrading ? 'กำลังตรวจทีละข้อด้วย AI...' : '🤖 ให้ AI ช่วยตรวจใบงาน'}</span>
            </button>
          </div>

          {/* Honest AI Error Callout */}
          {aiError && (
            <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3 animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold text-rose-800 dark:text-rose-200">
                  ไม่สามารถประเมินผลด้วย AI ได้
                </p>
                <p className="text-rose-700 dark:text-rose-300">{aiError}</p>
              </div>
            </div>
          )}

          {/* AI Results Callout if available */}
          {aiFeedbackResult && (
            <div className="p-4 bg-emerald-50/80 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-2.5 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2 font-bold text-xs text-emerald-950 dark:text-emerald-200">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  ผลการวิเคราะห์จาก Gemini AI (ตรวจเทียบเกณฑ์รายข้อ)
                </span>
                <div className="flex items-center gap-2">
                  {aiFeedbackResult.recommendedStatus === 'needs_revision' && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 text-[11px] font-semibold">
                      แนะนำ: ส่งกลับแก้ไข
                    </span>
                  )}
                  <span className="font-mono text-emerald-800 dark:text-emerald-300 bg-white dark:bg-[#111c18] px-2.5 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                    คะแนนที่แนะนำ: {aiFeedbackResult.suggestedScore} / {assignment.totalPoints}
                  </span>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed">
                {aiFeedbackResult.overallFeedback}
              </p>

              {aiFeedbackResult.strengths && aiFeedbackResult.strengths.length > 0 && (
                <div className="text-xs">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">จุดแข็ง: </span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {aiFeedbackResult.strengths.join(' · ')}
                  </span>
                </div>
              )}

              {aiFeedbackResult.improvements && aiFeedbackResult.improvements.length > 0 && (
                <div className="text-xs">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">ควรปรับปรุงเพิ่มเติม: </span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {aiFeedbackResult.improvements.join(' · ')}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Questions & Student Answers Side-by-Side Review */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold font-prompt text-slate-900 dark:text-white">
              รายการโจทย์และคำตอบที่นักเรียนส่งมา
            </h3>

            {assignment.questions.map((q, idx) => {
              const rawTextAnswer = (submission?.answers?.[q.id] || '').trim();
              const studentImage = submission?.answerImages?.[q.id];
              const studentAnswer =
                rawTextAnswer ||
                (studentImage ? '(ดูคำตอบจากรูปภาพที่นักเรียนแนบด้านล่าง)' : '(ยังไม่ได้ระบุคำตอบ)');
              const itemEval = aiFeedbackResult?.itemFeedback?.find(
                (it) => it.questionIndex === idx || it.questionId === q.id
              );
              const badge = itemEval ? getItemBadge(itemEval) : null;

              return (
                <div
                  key={q.id}
                  className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2.5 text-xs"
                >
                  {q.imageUrl && (
                    <div className="mb-2">
                      <img
                        src={q.imageUrl}
                        alt={`ภาพประกอบข้อที่ ${idx + 1}`}
                        className="max-h-52 rounded-xl border border-slate-200 dark:border-slate-700 object-contain bg-slate-900/5 mx-auto shadow-2xs"
                      />
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2 font-semibold text-slate-900 dark:text-white">
                    <span className="text-sm">
                      ข้อ {idx + 1}. {q.text}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      {badge && itemEval && (
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${badge.cls}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      )}
                      <span className="font-mono text-slate-500 font-normal">
                        ({q.maxPoints} คะแนน)
                      </span>
                    </div>
                  </div>

                  {/* Student Answer */}
                  <div className="p-3.5 bg-white dark:bg-[#111c18] rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-sm sm:text-[15px] space-y-3">
                    <div>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400 block mb-1.5 text-xs">
                        คำตอบของนักเรียน:
                      </span>
                      <p className="whitespace-pre-wrap leading-relaxed font-sans">{studentAnswer}</p>
                    </div>

                    {studentImage && (
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span>ภาพคำตอบที่นักเรียนแนบมา (ข้อที่ {idx + 1})</span>
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: studentImage,
                                label: `ภาพคำตอบของ ${submission?.studentName || 'นักเรียน'} - ข้อที่ ${idx + 1}`,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-md transition-colors cursor-pointer"
                          >
                            <ZoomIn className="w-3 h-3" />
                            <span>คลิกขยายดูภาพใหญ่</span>
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage({
                              url: studentImage,
                              label: `ภาพคำตอบของ ${submission?.studentName || 'นักเรียน'} - ข้อที่ ${idx + 1}`,
                            })
                          }
                          className="block w-full bg-slate-50 dark:bg-slate-950/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700 cursor-zoom-in hover:border-emerald-500 transition-colors"
                        >
                          <img
                            src={studentImage}
                            alt={`ภาพคำตอบของนักเรียนข้อที่ ${idx + 1}`}
                            className="max-h-64 mx-auto rounded-lg object-contain"
                          />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Answer Key / Rubric */}
                  {q.answerKey && (
                    <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/30 rounded-xl border border-emerald-100 dark:border-emerald-900/40 text-emerald-900 dark:text-emerald-300 text-xs sm:text-sm">
                      <span className="font-semibold block mb-0.5">เฉลย/เกณฑ์การตรวจ:</span>
                      <p className="leading-relaxed">{q.answerKey}</p>
                    </div>
                  )}

                  {/* Per-question AI Evaluation & Editable Score */}
                  {itemEval && (
                    <div className="p-3 bg-teal-50/80 dark:bg-teal-950/30 rounded-xl border border-teal-200 dark:border-teal-800/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-teal-950 dark:text-teal-200 space-y-0.5">
                        <span className="font-bold text-teal-800 dark:text-teal-300 block">
                          🤖 ความเห็น AI ข้อที่ {idx + 1}:
                        </span>
                        <p className="leading-relaxed">{itemEval.comment}</p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 bg-white dark:bg-[#111c18] px-2.5 py-1.5 rounded-lg border border-teal-200 dark:border-teal-800">
                        <span className="text-[11px] font-semibold text-slate-500">คะแนนข้อนี้:</span>
                        <input
                          type="number"
                          step="0.5"
                          min={0}
                          max={itemEval.maxScore}
                          value={itemEval.score}
                          onChange={(e) => handleAdjustItemScore(idx, Number(e.target.value))}
                          className="w-14 px-1.5 py-0.5 text-center font-mono font-bold text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded text-emerald-700 dark:text-emerald-300"
                        />
                        <span className="text-xs font-mono text-slate-500">/ {itemEval.maxScore}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Grading Input Form */}
          <div className="p-4 bg-white dark:bg-[#111c18] border border-slate-200 dark:border-emerald-950/60 rounded-xl space-y-4">
            <h3 className="text-sm font-bold font-prompt text-slate-900 dark:text-white flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>สรุปคะแนนและข้อเสนอแนะของครู</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ให้คะแนน (คะแนนเต็ม {assignment.totalPoints})
                </label>
                <input
                  type="number"
                  step="0.5"
                  min={0}
                  max={assignment.totalPoints}
                  value={score}
                  onChange={(e) => setScore(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  คำติชม / ข้อเสนอแนะสำหรับนักเรียน
                </label>
                <textarea
                  rows={2}
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  placeholder="พิมพ์ข้อความให้กำลังใจ หรือสิ่งที่ควรแก้ไขเพิ่มเติม..."
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-emerald-950/60 bg-slate-50/90 dark:bg-[#0d1613] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            ยกเลิก
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleRequestRevision}
              disabled={!submission}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>ส่งกลับให้แก้ไข</span>
            </button>

            <button
              type="button"
              onClick={handleApproveGrade}
              disabled={!submission}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors cursor-pointer disabled:opacity-50"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span>อนุมัติ & บันทึกการตรวจ</span>
            </button>
          </div>
        </div>
      </div>

      <SaveConfirmModal
        isOpen={Boolean(pendingGradeAction && submission)}
        title={
          pendingGradeAction?.status === 'needs_revision'
            ? 'ยืนยันการบันทึกและส่งกลับแก้ไข?'
            : 'ยืนยันการบันทึกผลการตรวจใบงาน?'
        }
        description="กรุณาตรวจสอบคะแนนและความเห็นครูผู้สอนก่อนบันทึก"
        variant={pendingGradeAction?.status === 'needs_revision' ? 'amber' : 'emerald'}
        details={
          pendingGradeAction && submission
            ? [
                { label: 'นักเรียน', value: `${submission.studentName} (${submission.studentCode})` },
                { label: 'ใบงาน', value: assignment.title },
                {
                  label: 'คะแนนที่ได้',
                  value: `${pendingGradeAction.clampedScore} / ${assignment.totalPoints} คะแนน`,
                },
                {
                  label: 'สถานะ',
                  value:
                    pendingGradeAction.status === 'needs_revision'
                      ? 'ส่งกลับให้นักเรียนแก้ไข'
                      : 'ตรวจแล้ว (อนุมัติคะแนน)',
                },
              ]
            : []
        }
        confirmLabel={
          pendingGradeAction?.status === 'needs_revision'
            ? 'ยืนยันส่งกลับแก้ไข'
            : 'ยืนยันบันทึกการตรวจ'
        }
        onConfirm={() => {
          if (!pendingGradeAction || !submission) return;
          onSaveGrade(
            submission.id,
            pendingGradeAction.clampedScore,
            teacherComment,
            pendingGradeAction.status,
            usedAiGrading
          );
          setPendingGradeAction(null);
          onClose();
        }}
        onCancel={() => setPendingGradeAction(null)}
      />

      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white dark:bg-[#111c18] rounded-2xl p-3 shadow-2xl border border-slate-200 dark:border-emerald-900/60"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-2 mb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
                {previewImage.label}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 text-slate-500 hover:text-slate-800 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImage.url}
              alt={previewImage.label}
              className="max-h-[78vh] w-full object-contain rounded-xl bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>
      )}
    </div>
  );
};
