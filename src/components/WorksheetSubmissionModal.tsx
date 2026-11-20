import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Save,
  Sparkles,
  Upload,
  FileText,
  Award,
  AlertCircle,
  Printer,
  ImagePlus,
  Trash2,
  ZoomIn,
  Loader2,
} from 'lucide-react';
import { Assignment, Submission, Question } from '../types';
import { SaveConfirmModal } from './SaveConfirmModal';

const MAX_TOTAL_ANSWER_IMAGES_CHARS = 780_000;

async function compressStudentAnswerImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WebP หรือ GIF เท่านั้น');
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error('ไฟล์รูปภาพมีขนาดใหญ่เกิน 12 MB กรุณาเลือกไฟล์ที่เล็กลง');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้'));
      el.src = objectUrl;
    });

    const attempts = [
      { maxDim: 960, quality: 0.74 },
      { maxDim: 800, quality: 0.62 },
      { maxDim: 680, quality: 0.5 },
    ];

    let bestDataUrl = '';
    for (const { maxDim, quality } of attempts) {
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h);
        w = Math.max(1, Math.round(w * ratio));
        h = Math.max(1, Math.round(h * ratio));
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('ไม่สามารถประมวลผลรูปภาพได้');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      bestDataUrl = canvas.toDataURL('image/jpeg', quality);
      if (bestDataUrl.length <= 160_000) {
        return bestDataUrl;
      }
    }
    return bestDataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

interface WorksheetSubmissionModalProps {
  assignment: Assignment;
  submission?: Submission;
  onClose: () => void;
  onSubmitWorksheet: (
    assignmentId: string,
    answers: Record<string, string>,
    files?: any[],
    answerImages?: Record<string, string>
  ) => void;
  onOpenHintModal: (assignment: Assignment, questionText?: string) => void;
}

export const WorksheetSubmissionModal: React.FC<WorksheetSubmissionModalProps> = ({
  assignment,
  submission,
  onClose,
  onSubmitWorksheet,
  onOpenHintModal,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    submission?.answers ? { ...submission.answers } : {}
  );
  const [answerImages, setAnswerImages] = useState<Record<string, string>>(() =>
    submission?.answerImages ? { ...submission.answerImages } : {}
  );
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
  const [savedDraftTime, setSavedDraftTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: string; url?: string }[]>(
    () => (submission?.files ? [...submission.files] : [])
  );

  const hasUserEditedRef = useRef(false);
  const initializedSubKeyRef = useRef<string | null>(
    submission ? `${assignment.id}_${submission.id}` : null
  );

  // Sync initial submission only if modal opened before submission arrived and user hasn't started typing
  useEffect(() => {
    const subKey = submission ? `${assignment.id}_${submission.id}` : null;
    if (
      submission &&
      !hasUserEditedRef.current &&
      initializedSubKeyRef.current !== subKey
    ) {
      setAnswers(submission.answers ? { ...submission.answers } : {});
      setAnswerImages(submission.answerImages ? { ...submission.answerImages } : {});
      if (submission.files) {
        setAttachedFiles([...submission.files]);
      }
      initializedSubKeyRef.current = subKey;
    }
  }, [assignment.id, submission?.id]);

  const handleAnswerChange = (qId: string, value: string) => {
    hasUserEditedRef.current = true;
    setAnswers((prev) => ({
      ...prev,
      [qId]: value,
    }));
  };

  const handleQuestionImageAttach = async (qId: string, file: File | undefined) => {
    if (!file) return;
    setUploadingQuestionId(qId);
    setImageErrors((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
    try {
      const compressed = await compressStudentAnswerImage(file);
      const nextMap = { ...answerImages, [qId]: compressed };
      const totalChars = Object.values(nextMap).reduce((sum, v) => sum + (v?.length || 0), 0);
      if (totalChars > MAX_TOTAL_ANSWER_IMAGES_CHARS) {
        setImageErrors((prev) => ({
          ...prev,
          [qId]: 'ขนาดรวมของภาพคำตอบทุกข้อใกล้เต็มความจุระบบแล้ว กรุณาลดขนาดภาพหรือลบบางข้อก่อนแนบเพิ่ม',
        }));
        return;
      }
      hasUserEditedRef.current = true;
      setAnswerImages(nextMap);
    } catch (err: any) {
      setImageErrors((prev) => ({
        ...prev,
        [qId]: err?.message || 'ไม่สามารถแนบรูปภาพได้ กรุณาลองใหม่อีกครั้ง',
      }));
    } finally {
      setUploadingQuestionId(null);
    }
  };

  const handleRemoveQuestionImage = (qId: string) => {
    hasUserEditedRef.current = true;
    setAnswerImages((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
    setImageErrors((prev) => {
      const next = { ...prev };
      delete next[qId];
      return next;
    });
  };

  const executeSaveDraft = () => {
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    setSavedDraftTime(timeStr);
  };

  const handleSaveDraft = () => {
    setIsDraftConfirmOpen(true);
  };

  const handleFileSimulate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      hasUserEditedRef.current = true;
      setAttachedFiles((prev) => [
        ...prev,
        { name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` },
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitConfirmOpen(true);
  };

  const executeSubmitWorksheet = () => {
    setIsSubmitConfirmOpen(false);
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmitWorksheet(assignment.id, answers, attachedFiles, answerImages);
      setIsSubmitting(false);
      onClose();
    }, 400);
  };

  const isReadOnly = submission?.status === 'graded';
  const answeredQuestionCount = assignment.questions.filter(
    (q) => (answers[q.id] || '').trim().length > 0 || Boolean(answerImages[q.id])
  ).length;
  const attachedQuestionImagesCount = Object.values(answerImages).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
          <div>
            <div className="flex items-center gap-2 text-xs text-indigo-600 dark:text-indigo-400 font-medium mb-0.5">
              <span>ชั้น {assignment.gradeLevel}</span>
              <span aria-hidden="true">·</span>
              <span>วิชา{assignment.subject}</span>
              <span aria-hidden="true">·</span>
              <span>ครูผู้สอน: {assignment.teacherName}</span>
            </div>
            <h2 className="text-lg font-bold font-prompt text-slate-900 dark:text-white">
              {assignment.title}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="พิมพ์ใบงานชุดนี้ หรือ บันทึกเป็น PDF"
            >
              <Printer className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>พิมพ์ใบงาน / บันทึก PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800 dark:text-slate-200">
          {/* Instructions Box */}
          <div className="p-4 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl">
            <h4 className="text-xs font-bold font-prompt text-indigo-900 dark:text-indigo-200 mb-1">
              📌 คำชี้แจงในการทำใบงาน
            </h4>
            <p className="text-xs text-indigo-800 dark:text-indigo-300">
              {assignment.instructions} (คะแนนเต็ม {assignment.totalPoints} คะแนน)
            </p>
          </div>

          {/* Teacher Review Box (If Graded) */}
          {submission?.status === 'graded' && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200 text-sm">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <span>ผลการตรวจและคะแนนจากครูผู้สอน</span>
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                  {submission.score} / {submission.maxScore} คะแนน
                </div>
              </div>
              <p className="text-xs text-emerald-900 dark:text-emerald-200 bg-white/60 dark:bg-slate-900/60 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40 italic">
                "{submission.teacherComment || 'ไม่มีคำติชมเพิ่มเติม'}"
              </p>
            </div>
          )}

          {/* Need Revision Alert Box */}
          {submission?.status === 'needs_revision' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200 text-sm mb-1">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span>ข้อเสนอแนะจากครูเพื่อแก้ไข</span>
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-200">
                {submission.teacherComment}
              </p>
            </div>
          )}

          {/* Questions Form */}
          <form id="submission-form" onSubmit={handleSubmit} className="space-y-6">
            {assignment.questions.map((q: Question, idx: number) => (
              <div
                key={q.id}
                className="p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3"
              >
                {q.imageUrl && (
                  <div className="mb-3">
                    <img
                      src={q.imageUrl}
                      alt={`ภาพประกอบข้อที่ ${idx + 1}`}
                      className="max-h-60 rounded-xl border border-slate-200 dark:border-slate-700 object-contain bg-slate-900/5 mx-auto shadow-2xs"
                    />
                  </div>
                )}
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug">
                    ข้อที่ {idx + 1}. {q.text}
                  </h3>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-mono text-slate-500 font-medium">
                      ({q.maxPoints} คะแนน)
                    </span>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => onOpenHintModal(assignment, q.text)}
                        className="inline-flex items-center gap-1 text-[11px] text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 px-2 py-1 rounded-md transition-colors"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>ขอคำใบ้ AI</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Question Inputs by type */}
                {q.type === 'multiple_choice' && q.options ? (
                  <div className="space-y-2 pt-1">
                    {q.options.map((opt, oIdx) => (
                      <label
                        key={oIdx}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border text-sm sm:text-[15px] cursor-pointer transition-colors ${
                          answers[q.id] === opt
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-950 dark:text-indigo-100 font-semibold shadow-2xs'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question_${q.id}`}
                          value={opt}
                          disabled={isReadOnly}
                          checked={answers[q.id] === opt}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="leading-relaxed">{opt}</span>
                      </label>
                    ))}
                  </div>
                ) : q.type === 'fill_blank' ? (
                  <input
                    type="text"
                    disabled={isReadOnly}
                    value={answers[q.id] || ''}
                    onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                    placeholder="พิมพ์คำตอบสั้นที่นี่..."
                    className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm sm:text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                ) : (
                  <div>
                    <textarea
                      rows={4}
                      disabled={isReadOnly}
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder="พิมพ์คำอธิบายหรือวิธีทำส่งครูในช่องนี้..."
                      className="w-full px-4 py-3.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-sm sm:text-[15px] leading-relaxed text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden resize-y font-normal"
                    />
                    <div className="text-xs text-slate-400 text-right mt-1 font-mono">
                      {(answers[q.id] || '').length} ตัวอักษร
                    </div>
                  </div>
                )}

                {/* Per-question student image attachment */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/70">
                  {answerImages[q.id] ? (
                    <div className="p-3 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800/70 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          <ImagePlus className="w-3.5 h-3.5" />
                          <span>ภาพคำตอบที่แนบสำหรับข้อที่ {idx + 1}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage({
                                url: answerImages[q.id],
                                label: `ภาพคำตอบข้อที่ ${idx + 1}`,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                          >
                            <ZoomIn className="w-3 h-3" />
                            <span>ขยายดู</span>
                          </button>
                          {!isReadOnly && (
                            <>
                              <label className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-md transition-colors cursor-pointer">
                                <span>เปลี่ยนรูป</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    e.target.value = '';
                                    handleQuestionImageAttach(q.id, file);
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                onClick={() => handleRemoveQuestionImage(q.id)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-md transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>ลบรูป</span>
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage({
                            url: answerImages[q.id],
                            label: `ภาพคำตอบข้อที่ ${idx + 1}`,
                          })
                        }
                        className="block w-full text-center bg-slate-50 dark:bg-slate-950/60 rounded-lg p-2 border border-slate-100 dark:border-slate-800 cursor-zoom-in"
                      >
                        <img
                          src={answerImages[q.id]}
                          alt={`ภาพคำตอบข้อที่ ${idx + 1}`}
                          className="max-h-56 mx-auto rounded-lg object-contain"
                        />
                      </button>
                    </div>
                  ) : !isReadOnly ? (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        แนบภาพคำตอบของข้อนี้ (เช่น ถ่ายรูปวิธีทำในสมุด หรือภาพชิ้นงาน)
                      </span>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg shadow-2xs hover:bg-indigo-50/50 dark:hover:bg-indigo-950/40 transition-colors cursor-pointer">
                        {uploadingQuestionId === q.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                        ) : (
                          <ImagePlus className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                        )}
                        <span>
                          {uploadingQuestionId === q.id
                            ? 'กำลังย่อขนาดภาพ...'
                            : 'แนบรูปภาพคำตอบข้อนี้'}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingQuestionId === q.id}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            handleQuestionImageAttach(q.id, file);
                          }}
                        />
                      </label>
                    </div>
                  ) : null}

                  {imageErrors[q.id] && (
                    <p className="mt-1.5 text-[11px] text-rose-600 dark:text-rose-400 font-medium">
                      {imageErrors[q.id]}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* File Attachments Section */}
            <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <Upload className="w-4 h-4 text-indigo-500" />
                  <span>แนบไฟล์ประกอบการส่ง (รูปถ่ายใบงาน / PDF / เอกสาร)</span>
                </div>
                {!isReadOnly && (
                  <label className="px-3 py-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                    <span>+ เลือกไฟล์แนบ</span>
                    <input
                      type="file"
                      onChange={handleFileSimulate}
                      className="hidden"
                      accept="image/*,.pdf,.docx"
                    />
                  </label>
                )}
              </div>

              {attachedFiles.length > 0 ? (
                <div className="space-y-2">
                  {attachedFiles.map((file, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-indigo-500 shrink-0" />
                        <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                          {file.name}
                        </span>
                        <span className="text-[10px] text-slate-400">({file.size})</span>
                      </div>
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold text-[10px]">
                        แนบแล้ว
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400 text-center py-2">
                  ยังไม่ได้แนบไฟล์เพิ่มเติม (สามารถพิมพ์ตอบในกล่องข้อความด้านบนได้โดยตรง)
                </p>
              )}
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono">
            {savedDraftTime && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ บันทึกร่างเมื่อ {savedDraftTime} น.
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              ยกเลิก / ปิด
            </button>

            {!isReadOnly && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>บันทึกร่าง</span>
                </button>

                <button
                  type="submit"
                  form="submission-form"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'กำลังส่งงาน...' : 'ยืนยันการส่งใบงาน'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <SaveConfirmModal
        isOpen={isDraftConfirmOpen}
        title="ยืนยันการบันทึกร่างใบงาน?"
        description="บันทึกร่างคำตอบปัจจุบันชั่วคราวก่อนส่งงานจริง"
        variant="indigo"
        details={[
          { label: 'ใบงาน', value: assignment.title },
          {
            label: 'ข้อที่ตอบแล้ว',
            value: `${answeredQuestionCount} / ${assignment.questions.length} ข้อ`,
          },
          ...(attachedQuestionImagesCount > 0
            ? [{ label: 'ภาพคำตอบรายข้อ', value: `${attachedQuestionImagesCount} รูป` }]
            : []),
        ]}
        confirmLabel="ยืนยันบันทึกร่าง"
        onConfirm={() => {
          setIsDraftConfirmOpen(false);
          executeSaveDraft();
        }}
        onCancel={() => setIsDraftConfirmOpen(false)}
      />

      <SaveConfirmModal
        isOpen={isSubmitConfirmOpen}
        title="ยืนยันการส่งและบันทึกใบงาน?"
        description="เมื่อยืนยันแล้ว ระบบจะส่งคำตอบของคุณให้ครูผู้สอนตรวจ"
        details={[
          { label: 'ใบงาน', value: assignment.title },
          { label: 'รายวิชา', value: assignment.subject },
          {
            label: 'จำนวนข้อที่ตอบแล้ว',
            value: `${answeredQuestionCount} / ${assignment.questions.length} ข้อ`,
          },
          ...(attachedQuestionImagesCount > 0
            ? [{ label: 'ภาพคำตอบรายข้อ', value: `${attachedQuestionImagesCount} รูป` }]
            : []),
          ...(attachedFiles.length > 0
            ? [{ label: 'ไฟล์แนบเพิ่มเติม', value: `${attachedFiles.length} ไฟล์` }]
            : []),
        ]}
        confirmLabel="ยืนยันส่งใบงาน"
        onConfirm={executeSubmitWorksheet}
        onCancel={() => setIsSubmitConfirmOpen(false)}
      />

      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-2xl border border-slate-200 dark:border-slate-700"
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
              className="max-h-[75vh] w-full object-contain rounded-xl bg-slate-50 dark:bg-slate-950"
            />
          </div>
        </div>
      )}
    </div>
  );
};
