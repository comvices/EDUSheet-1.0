import React, { useState, useEffect } from 'react';
import { X, Send, Save, Sparkles, CheckCircle, Upload, FileText, Award, AlertCircle, HelpCircle } from 'lucide-react';
import { Assignment, Submission, Question } from '../types';

interface WorksheetSubmissionModalProps {
  assignment: Assignment;
  submission?: Submission;
  onClose: () => void;
  onSubmitWorksheet: (assignmentId: string, answers: Record<string, string>, files?: any[]) => void;
  onOpenHintModal: (assignment: Assignment, questionText?: string) => void;
}

export const WorksheetSubmissionModal: React.FC<WorksheetSubmissionModalProps> = ({
  assignment,
  submission,
  onClose,
  onSubmitWorksheet,
  onOpenHintModal,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savedDraftTime, setSavedDraftTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: string }[]>([]);

  // Load existing answers if submission exists
  useEffect(() => {
    if (submission?.answers) {
      setAnswers(submission.answers);
    }
  }, [submission]);

  const handleAnswerChange = (qId: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: value,
    }));
  };

  const handleSaveDraft = () => {
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    setSavedDraftTime(timeStr);
  };

  const handleFileSimulate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setAttachedFiles((prev) => [
        ...prev,
        { name: file.name, size: `${(file.size / 1024).toFixed(1)} KB` },
      ]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmitWorksheet(assignment.id, answers, attachedFiles);
      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  const isReadOnly = submission?.status === 'graded';

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

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
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
                        className={`flex items-center gap-3 p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                          answers[q.id] === opt
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-400 text-indigo-950 dark:text-indigo-100 font-medium'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <input
                          type="radio"
                          name={`question_${q.id}`}
                          value={opt}
                          disabled={isReadOnly}
                          checked={answers[q.id] === opt}
                          onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                          className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{opt}</span>
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
                    className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
                  />
                ) : (
                  <div>
                    <textarea
                      rows={4}
                      disabled={isReadOnly}
                      value={answers[q.id] || ''}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      placeholder="พิมพ์คำอธิบายหรือวิธีทำส่งครูในช่องนี้..."
                      className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-hidden resize-y"
                    />
                    <div className="text-[10px] text-slate-400 text-right mt-1 font-mono">
                      {(answers[q.id] || '').length} ตัวอักษร
                    </div>
                  </div>
                )}
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
    </div>
  );
};
