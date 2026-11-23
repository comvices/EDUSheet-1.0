import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Users,
  Crown,
  UserPlus,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { Assignment, Submission, Question, StudentProfile } from '../types';
import { SaveConfirmModal } from './SaveConfirmModal';
import { findStudentGroup, normalizeCode } from '../utils/groupHelpers';

const MAX_TOTAL_ANSWER_IMAGES_CHARS = 520_000;

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
      { maxDim: 840, quality: 0.66 },
      { maxDim: 720, quality: 0.56 },
      { maxDim: 600, quality: 0.46 },
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
      if (bestDataUrl.length <= 90_000) {
        return bestDataUrl;
      }
    }
    return bestDataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export type GroupActionPayload =
  | { type: 'create'; groupName: string }
  | { type: 'join'; groupId: string }
  | { type: 'leave'; groupId: string };

interface WorksheetSubmissionModalProps {
  assignment: Assignment;
  submission?: Submission;
  groupSubmission?: Submission;
  currentStudent?: StudentProfile;
  studentsList?: StudentProfile[];
  onClose: () => void;
  onSubmitWorksheet: (
    assignmentId: string,
    answers: Record<string, string>,
    files?: any[],
    answerImages?: Record<string, string>,
    mode?: 'draft' | 'submitted'
  ) => void;
  onGroupAction?: (assignmentId: string, action: GroupActionPayload) => Promise<void> | void;
  onOpenHintModal: (assignment: Assignment, questionText?: string) => void;
}

export const WorksheetSubmissionModal: React.FC<WorksheetSubmissionModalProps> = ({
  assignment,
  submission,
  groupSubmission,
  currentStudent,
  studentsList = [],
  onClose,
  onSubmitWorksheet,
  onGroupAction,
  onOpenHintModal,
}) => {
  const isGroupMode = assignment.workMode === 'group';
  const activeGroup = useMemo(
    () => findStudentGroup(assignment, currentStudent?.code),
    [assignment, currentStudent?.code]
  );

  const effectiveSubmission = useMemo(() => {
    if (!isGroupMode) return submission;
    if (groupSubmission && submission) {
      const tsG = new Date(groupSubmission.submissionDate || 0).getTime() || 0;
      const tsS = new Date(submission.submissionDate || 0).getTime() || 0;
      return tsG >= tsS ? groupSubmission : submission;
    }
    return groupSubmission || submission;
  }, [isGroupMode, groupSubmission, submission]);

  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    effectiveSubmission?.answers ? { ...effectiveSubmission.answers } : {}
  );
  const [answerImages, setAnswerImages] = useState<Record<string, string>>(() =>
    effectiveSubmission?.answerImages ? { ...effectiveSubmission.answerImages } : {}
  );
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const [uploadingQuestionId, setUploadingQuestionId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null);
  const [savedDraftTime, setSavedDraftTime] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitConfirmOpen, setIsSubmitConfirmOpen] = useState(false);
  const [isDraftConfirmOpen, setIsDraftConfirmOpen] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: string; url?: string }[]>(
    () => (effectiveSubmission?.files ? [...effectiveSubmission.files] : [])
  );

  // Collaborative group UI state
  const [newGroupName, setNewGroupName] = useState('');
  const [isGroupActionBusy, setIsGroupActionBusy] = useState(false);
  const [groupActionError, setGroupActionError] = useState('');
  const [hasRemoteTeammateUpdate, setHasRemoteTeammateUpdate] = useState(false);

  const studentByCode = useMemo(() => {
    const map = new Map<string, StudentProfile>();
    studentsList.forEach((st) => {
      const norm = normalizeCode(st.code);
      if (norm) map.set(norm, st);
    });
    return map;
  }, [studentsList]);

  const hasUserEditedRef = useRef(false);
  const initializedSubKeyRef = useRef<string | null>(
    effectiveSubmission
      ? `${assignment.id}_${effectiveSubmission.id}_${effectiveSubmission.submissionDate}`
      : null
  );

  const applySubmissionToLocalState = (sub: Submission) => {
    setAnswers(sub.answers ? { ...sub.answers } : {});
    setAnswerImages(sub.answerImages ? { ...sub.answerImages } : {});
    setAttachedFiles(sub.files ? [...sub.files] : []);
    hasUserEditedRef.current = false;
    setHasRemoteTeammateUpdate(false);
    initializedSubKeyRef.current = `${assignment.id}_${sub.id}_${sub.submissionDate}`;
  };

  // Sync incoming Firestore submission / teammate updates cleanly
  useEffect(() => {
    if (!effectiveSubmission) return;
    const subKey = `${assignment.id}_${effectiveSubmission.id}_${effectiveSubmission.submissionDate}`;
    if (initializedSubKeyRef.current === subKey) return;

    const editedByOther =
      Boolean(effectiveSubmission.lastEditedByCode) &&
      normalizeCode(effectiveSubmission.lastEditedByCode) !== normalizeCode(currentStudent?.code);

    if (!hasUserEditedRef.current) {
      applySubmissionToLocalState(effectiveSubmission);
    } else if (isGroupMode && editedByOther) {
      setHasRemoteTeammateUpdate(true);
    }
  }, [
    assignment.id,
    effectiveSubmission,
    isGroupMode,
    currentStudent?.code,
  ]);

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
    onSubmitWorksheet(assignment.id, answers, attachedFiles, answerImages, 'draft');
    hasUserEditedRef.current = false;
    setHasRemoteTeammateUpdate(false);
    const timeStr = new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    setSavedDraftTime(timeStr);
  };

  const handleSaveDraft = () => {
    if (isGroupMode && !activeGroup) {
      setGroupActionError('กรุณาเข้าร่วมกลุ่มหรือสร้างกลุ่มก่อนบันทึกร่างร่วมกัน');
      return;
    }
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
    if (isGroupMode && !activeGroup) {
      setGroupActionError('กรุณาเข้าร่วมกลุ่มหรือสร้างกลุ่มก่อนยืนยันส่งใบงานกลุ่ม');
      return;
    }
    setIsSubmitConfirmOpen(true);
  };

  const executeSubmitWorksheet = () => {
    setIsSubmitConfirmOpen(false);
    setIsSubmitting(true);
    setTimeout(() => {
      onSubmitWorksheet(assignment.id, answers, attachedFiles, answerImages, 'submitted');
      setIsSubmitting(false);
      onClose();
    }, 350);
  };

  const runGroupAction = async (action: GroupActionPayload) => {
    if (!onGroupAction) return;
    setGroupActionError('');
    setIsGroupActionBusy(true);
    try {
      await onGroupAction(assignment.id, action);
      if (action.type === 'create') {
        setNewGroupName('');
      }
    } catch (err: any) {
      setGroupActionError(err?.message || 'ไม่สามารถดำเนินการจัดการกลุ่มได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setIsGroupActionBusy(false);
    }
  };

  const isReadOnly = effectiveSubmission?.status === 'graded' || (isGroupMode && !activeGroup);
  const answeredQuestionCount = assignment.questions.filter(
    (q) => (answers[q.id] || '').trim().length > 0 || Boolean(answerImages[q.id])
  ).length;
  const attachedQuestionImagesCount = Object.values(answerImages).filter(Boolean).length;
  const maxGroupSize = assignment.groupSettings?.maxGroupSize || 4;
  const allowStudentCreateGroup = assignment.groupSettings?.allowStudentCreateGroup !== false;
  const availableGroups = assignment.groups || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950/60 flex items-center justify-between bg-slate-50/90 dark:bg-[var(--theme-surface-dark-elevated)]">
          <div>
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-0.5">
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
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-emerald-900/60 bg-white dark:bg-[var(--theme-surface-dark)] hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 text-slate-700 dark:text-slate-200 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              title="พิมพ์ใบงานชุดนี้ หรือ บันทึกเป็น PDF"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
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
          <div className="p-4 bg-emerald-50/70 dark:bg-emerald-950/35 border border-emerald-200/80 dark:border-emerald-900/60 rounded-xl space-y-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold font-prompt text-emerald-950 dark:text-emerald-200">
                📌 คำชี้แจงในการทำใบงาน
              </h4>
              <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                {assignment.sections && assignment.sections.length > 0
                  ? `${assignment.sections.length} ตอน · ${assignment.questions.length} ข้อ · ${assignment.totalPoints} คะแนน`
                  : `${assignment.questions.length} ข้อ · ${assignment.totalPoints} คะแนน`}
              </span>
            </div>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">
              {assignment.instructions} (คะแนนเต็ม {assignment.totalPoints} คะแนน)
            </p>
          </div>

          {/* Group Collaboration Lobby / Active Team Panel */}
          {isGroupMode && (
            <div className="p-4 bg-teal-50/75 dark:bg-teal-950/35 border border-teal-200 dark:border-teal-800/70 rounded-2xl space-y-3">
              {!activeGroup ? (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-bold font-prompt text-slate-900 dark:text-white">
                          ใบงานนี้เป็นงานกลุ่ม — กรุณาเลือกหรือสร้างกลุ่มก่อนเริ่มทำใบงาน
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300">
                          สมาชิกสูงสุด {maxGroupSize} คน/กลุ่ม · คำตอบและไฟล์ของกลุ่มจะซิงค์ร่วมกันแบบเรียลไทม์
                        </p>
                      </div>
                    </div>
                  </div>

                  {groupActionError && (
                    <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      {groupActionError}
                    </p>
                  )}

                  {availableGroups.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
                        กลุ่มที่มีอยู่ในใบงานนี้ ({availableGroups.length} กลุ่ม):
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {availableGroups.map((grp) => {
                          const isFull = grp.memberCodes.length >= maxGroupSize;
                          return (
                            <div
                              key={grp.id}
                              className="p-3 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-slate-700 rounded-xl flex flex-col justify-between gap-2.5"
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                    {grp.name}
                                  </span>
                                  <span className="text-[11px] font-mono text-teal-700 dark:text-teal-300 font-semibold shrink-0">
                                    {grp.memberCodes.length}/{maxGroupSize} คน
                                  </span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {grp.memberCodes.length === 0 ? (
                                    <span className="text-[11px] text-slate-400">ยังไม่มีสมาชิก</span>
                                  ) : (
                                    grp.memberCodes.map((code) => {
                                      const st = studentByCode.get(normalizeCode(code));
                                      return (
                                        <span
                                          key={code}
                                          className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-medium text-slate-700 dark:text-slate-300"
                                        >
                                          {st ? `${st.name} (${st.code})` : code}
                                        </span>
                                      );
                                    })
                                  )}
                                </div>
                              </div>

                              <button
                                type="button"
                                disabled={isFull || isGroupActionBusy}
                                onClick={() => runGroupAction({ type: 'join', groupId: grp.id })}
                                className="w-full py-1.5 px-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-200 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white text-xs font-bold transition-colors cursor-pointer"
                              >
                                {isFull ? 'กลุ่มเต็มแล้ว' : 'เข้าร่วมกลุ่มนี้'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {allowStudentCreateGroup ? (
                    <div className="pt-2 border-t border-teal-200/70 dark:border-teal-800/60 flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="ตั้งชื่อกลุ่มใหม่ เช่น กลุ่มสายฟ้า หรือ กลุ่มที่ 1..."
                        className="flex-1 px-3 py-2 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-teal-600"
                      />
                      <button
                        type="button"
                        disabled={isGroupActionBusy || !newGroupName.trim()}
                        onClick={() =>
                          runGroupAction({ type: 'create', groupName: newGroupName.trim() })
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span>สร้างกลุ่มใหม่และเข้าร่วม</span>
                      </button>
                    </div>
                  ) : (
                    availableGroups.length === 0 && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">
                        ครูผู้สอนเป็นผู้จัดกลุ่มสำหรับใบงานนี้ — กรุณาติดต่อครูเพื่อเพิ่มชื่อคุณเข้ากลุ่ม
                      </p>
                    )
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-teal-700 text-white flex items-center justify-center shrink-0">
                        <Users className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold font-prompt text-slate-900 dark:text-white">
                            กลุ่มของคุณ: {activeGroup.name}
                          </h4>
                          <span className="text-[11px] font-mono font-semibold text-teal-700 dark:text-teal-300">
                            ({activeGroup.memberCodes.length}/{maxGroupSize} คน)
                          </span>
                        </div>
                        {effectiveSubmission?.lastEditedByName && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            อัปเดตคำตอบกลุ่มล่าสุดโดย{' '}
                            <strong>{effectiveSubmission.lastEditedByName}</strong> (
                            {new Date(effectiveSubmission.submissionDate).toLocaleTimeString('th-TH', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}{' '}
                            น.)
                          </p>
                        )}
                      </div>
                    </div>

                    {effectiveSubmission?.status !== 'graded' &&
                      effectiveSubmission?.status !== 'submitted' &&
                      allowStudentCreateGroup && (
                        <button
                          type="button"
                          disabled={isGroupActionBusy}
                          onClick={() =>
                            runGroupAction({ type: 'leave', groupId: activeGroup.id })
                          }
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 text-[11px] font-semibold cursor-pointer"
                        >
                          <LogOut className="w-3 h-3" />
                          <span>ออกจากกลุ่ม</span>
                        </button>
                      )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {activeGroup.memberCodes.map((code) => {
                      const st = studentByCode.get(normalizeCode(code));
                      const isMe =
                        Boolean(currentStudent?.code) &&
                        normalizeCode(code) === normalizeCode(currentStudent?.code);
                      const isLeader =
                        Boolean(activeGroup.leaderCode) &&
                        normalizeCode(activeGroup.leaderCode) === normalizeCode(code);

                      return (
                        <span
                          key={code}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] border ${
                            isMe
                              ? 'bg-emerald-700 text-white border-emerald-700 font-bold'
                              : 'bg-white dark:bg-[var(--theme-surface-dark)] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 font-medium'
                          }`}
                        >
                          {isLeader && (
                            <Crown
                              className={`w-3 h-3 ${isMe ? 'text-amber-300' : 'text-amber-500'}`}
                            />
                          )}
                          <span>{st ? st.name : code}</span>
                          <span className="opacity-75 font-mono">({code})</span>
                          {isMe && <span className="text-[10px] opacity-90">· คุณ</span>}
                        </span>
                      );
                    })}
                  </div>

                  {hasRemoteTeammateUpdate && effectiveSubmission && (
                    <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="text-amber-900 dark:text-amber-200 font-medium">
                        เพื่อนร่วมกลุ่ม ({effectiveSubmission.lastEditedByName || 'สมาชิกในกลุ่ม'}) เพิ่งบันทึกคำตอบใหม่ลงในกลุ่ม
                      </span>
                      <button
                        type="button"
                        onClick={() => applySubmissionToLocalState(effectiveSubmission)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg text-[11px] font-bold cursor-pointer"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>โหลดคำตอบล่าสุดของกลุ่ม</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Teacher Review Box (If Graded) */}
          {effectiveSubmission?.status === 'graded' && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 font-bold text-emerald-800 dark:text-emerald-200 text-sm">
                  <Award className="w-5 h-5 text-emerald-600" />
                  <span>ผลการตรวจและคะแนนจากครูผู้สอน</span>
                </div>
                <div className="text-lg font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-300">
                  {effectiveSubmission.score} / {effectiveSubmission.maxScore ?? assignment.totalPoints} คะแนน
                </div>
              </div>
              <p className="text-xs text-emerald-900 dark:text-emerald-200 bg-white/60 dark:bg-[var(--theme-surface-dark-elevated)]/60 p-3 rounded-lg border border-emerald-100 dark:border-emerald-900/40 italic">
                "{effectiveSubmission.teacherComment || 'ไม่มีคำติชมเพิ่มเติม'}"
              </p>
            </div>
          )}

          {/* Need Revision Alert Box */}
          {effectiveSubmission?.status === 'needs_revision' && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl">
              <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-200 text-sm mb-1">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span>ข้อเสนอแนะจากครูเพื่อแก้ไข</span>
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-200">
                {effectiveSubmission.teacherComment}
              </p>
            </div>
          )}

          {/* Questions Form */}
          <form id="submission-form" onSubmit={handleSubmit} className="space-y-6">
            {(() => {
              const sectionsList =
                assignment.sections && assignment.sections.length > 0
                  ? assignment.sections
                  : null;

              const renderQuestionCard = (q: Question, displayNum: number) => (
                <div
                  key={q.id}
                  className="p-5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3"
                >
                  {q.imageUrl && (
                    <div className="mb-3">
                      <img
                        src={q.imageUrl}
                        alt={`ภาพประกอบข้อที่ ${displayNum}`}
                        className="max-h-60 rounded-xl border border-slate-200 dark:border-slate-700 object-contain bg-slate-900/5 mx-auto shadow-2xs"
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-snug">
                      ข้อที่ {displayNum}. {q.text}
                    </h3>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-mono text-slate-500 font-medium">
                        ({q.maxPoints} คะแนน)
                      </span>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => onOpenHintModal(assignment, q.text)}
                          className="inline-flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 px-2 py-1 rounded-md transition-colors cursor-pointer"
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
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-950 dark:text-emerald-100 font-semibold shadow-2xs'
                              : 'bg-white dark:bg-[var(--theme-surface-dark)] border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question_${q.id}`}
                            value={opt}
                            disabled={isReadOnly}
                            checked={answers[q.id] === opt}
                            onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                            className="w-4 h-4 text-emerald-700 focus:ring-emerald-600 cursor-pointer"
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
                      className="w-full px-4 py-3 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-300 dark:border-slate-700 rounded-xl text-sm sm:text-[15px] text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden"
                    />
                  ) : (
                    <div>
                      <textarea
                        rows={4}
                        disabled={isReadOnly}
                        value={answers[q.id] || ''}
                        onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                        placeholder="พิมพ์คำอธิบายหรือวิธีทำส่งครูในช่องนี้..."
                        className="w-full px-4 py-3.5 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-300 dark:border-slate-700 rounded-xl text-sm sm:text-[15px] leading-relaxed text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-600 focus:outline-hidden resize-y font-normal"
                      />
                      <div className="text-xs text-slate-400 text-right mt-1 font-mono">
                        {(answers[q.id] || '').length} ตัวอักษร
                      </div>
                    </div>
                  )}

                  {/* Per-question student image attachment */}
                  <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/70">
                    {answerImages[q.id] ? (
                      <div className="p-3 bg-white dark:bg-[var(--theme-surface-dark)] border border-emerald-200 dark:border-emerald-800/70 rounded-xl space-y-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                            <ImagePlus className="w-3.5 h-3.5" />
                            <span>ภาพคำตอบที่แนบสำหรับข้อที่ {displayNum}</span>
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                setPreviewImage({
                                  url: answerImages[q.id],
                                  label: `ภาพคำตอบข้อที่ ${displayNum}`,
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors cursor-pointer"
                            >
                              <ZoomIn className="w-3 h-3" />
                              <span>ขยายดู</span>
                            </button>
                            {!isReadOnly && (
                              <>
                                <label className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-md transition-colors cursor-pointer">
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
                              label: `ภาพคำตอบข้อที่ ${displayNum}`,
                            })
                          }
                          className="block w-full text-center bg-slate-50 dark:bg-slate-950/60 rounded-lg p-2 border border-slate-100 dark:border-slate-800 cursor-zoom-in"
                        >
                          <img
                            src={answerImages[q.id]}
                            alt={`ภาพคำตอบข้อที่ ${displayNum}`}
                            className="max-h-56 mx-auto rounded-lg object-contain"
                          />
                        </button>
                      </div>
                    ) : !isReadOnly ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          แนบภาพคำตอบของข้อนี้ (เช่น ถ่ายรูปวิธีทำในสมุด หรือภาพชิ้นงาน)
                        </span>
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg shadow-2xs hover:bg-emerald-50/50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer">
                          {uploadingQuestionId === q.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-700" />
                          ) : (
                            <ImagePlus className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
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
              );

              if (!sectionsList) {
                return assignment.questions.map((q: Question, idx: number) =>
                  renderQuestionCard(q, idx + 1)
                );
              }

              const validSecIds = new Set(sectionsList.map((s) => s.id));
              return (
                <div className="space-y-6">
                  {sectionsList.map((sec, sIdx) => {
                    const secQuestions = assignment.questions.filter((q) =>
                      q.sectionId && validSecIds.has(q.sectionId)
                        ? q.sectionId === sec.id
                        : sIdx === 0
                    );
                    if (secQuestions.length === 0) return null;
                    const secPoints = secQuestions.reduce(
                      (sum, q) => sum + (Number(q.maxPoints) || 0),
                      0
                    );
                    return (
                      <div key={sec.id} className="space-y-3.5">
                        <div className="px-4 py-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-900/60 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h3 className="text-sm font-bold font-prompt text-emerald-950 dark:text-emerald-100">
                              {sec.title}
                            </h3>
                            {sec.instructions && (
                              <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                                {sec.instructions}
                              </p>
                            )}
                          </div>
                          <span className="text-xs font-mono font-semibold text-emerald-700 dark:text-emerald-300">
                            {secQuestions.length} ข้อ · {secPoints} คะแนน
                          </span>
                        </div>
                        <div className="space-y-4">
                          {secQuestions.map((q, qIdx) => renderQuestionCard(q, qIdx + 1))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* File Attachments Section */}
            <div className="p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <Upload className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
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
                      className="flex items-center justify-between p-2 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
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
        <div className="px-6 py-4 border-t border-slate-200 dark:border-emerald-950/60 bg-slate-50/90 dark:bg-[var(--theme-surface-dark-elevated)] flex items-center justify-between gap-2 flex-wrap">
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 font-mono">
            {savedDraftTime && (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ {isGroupMode ? 'บันทึกร่างร่วมกันและซิงค์ให้กลุ่มแล้วเมื่อ' : 'บันทึกร่างเมื่อ'} {savedDraftTime} น.
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

            {effectiveSubmission?.status !== 'graded' && (
              <>
                <button
                  type="button"
                  disabled={isGroupMode && !activeGroup}
                  onClick={handleSaveDraft}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold rounded-lg hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isGroupMode ? 'บันทึกร่างร่วมกัน (ซิงค์กลุ่ม)' : 'บันทึกร่าง'}</span>
                </button>

                <button
                  type="submit"
                  form="submission-form"
                  disabled={isSubmitting || (isGroupMode && !activeGroup)}
                  className="theme-btn-sheen inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-xs font-semibold rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {isSubmitting
                      ? 'กำลังส่งงาน...'
                      : isGroupMode
                      ? 'ยืนยันส่งใบงานกลุ่ม'
                      : 'ยืนยันการส่งใบงาน'}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <SaveConfirmModal
        isOpen={isDraftConfirmOpen}
        title={isGroupMode ? 'ยืนยันบันทึกร่างร่วมกันให้กลุ่ม?' : 'ยืนยันการบันทึกร่างใบงาน?'}
        description={
          isGroupMode
            ? 'คำตอบปัจจุบันจะถูกบันทึกลงระบบและแสดงให้สมาชิกทุกคนในกลุ่มเห็นทันที'
            : 'บันทึกร่างคำตอบปัจจุบันชั่วคราวลงระบบก่อนส่งงานจริง'
        }
        variant="emerald"
        details={[
          { label: 'ใบงาน', value: assignment.title },
          ...(activeGroup
            ? [
                {
                  label: 'กลุ่มที่ซิงค์',
                  value: `${activeGroup.name} (${activeGroup.memberCodes.length} คน)`,
                },
              ]
            : []),
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
        title={isGroupMode ? 'ยืนยันส่งใบงานในนามกลุ่ม?' : 'ยืนยันการส่งและบันทึกใบงาน?'}
        description={
          isGroupMode && activeGroup
            ? `ระบบจะส่งคำตอบชุดนี้ให้ครูตรวจสำหรับสมาชิกทุกคนในกลุ่ม "${activeGroup.name}" (${activeGroup.memberCodes.length} คน)`
            : 'เมื่อยืนยันแล้ว ระบบจะส่งคำตอบของคุณให้ครูผู้สอนตรวจ'
        }
        details={[
          { label: 'ใบงาน', value: assignment.title },
          { label: 'รายวิชา', value: assignment.subject },
          ...(activeGroup
            ? [
                {
                  label: 'ส่งในนามกลุ่ม',
                  value: `${activeGroup.name} (${activeGroup.memberCodes.length} คน)`,
                },
              ]
            : []),
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
        confirmLabel={isGroupMode ? 'ยืนยันส่งใบงานกลุ่ม' : 'ยืนยันส่งใบงาน'}
        onConfirm={executeSubmitWorksheet}
        onCancel={() => setIsSubmitConfirmOpen(false)}
      />

      {previewImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-xs"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-white dark:bg-[var(--theme-surface-dark)] rounded-2xl p-3 shadow-2xl border border-slate-200 dark:border-emerald-900/60"
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
