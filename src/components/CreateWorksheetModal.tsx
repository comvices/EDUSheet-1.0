import React, { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, Plus, Trash2, Save, FilePlus, Edit3, Users, EyeOff, Eye, Search, Upload, Image as ImageIcon } from 'lucide-react';
import { Assignment, Question, CategoryType, StudentProfile } from '../types';
import { CATEGORY_LIST } from '../data/mockData';
import { SaveConfirmModal } from './SaveConfirmModal';
import { getAuthHeaders } from '../utils/security';

interface CreateWorksheetModalProps {
  onClose: () => void;
  onCreateAssignment: (newAssignment: Assignment) => void;
  onUpdateAssignment?: (updatedAssignment: Assignment) => void;
  editingAssignment?: Assignment | null;
  gradeLevelsList?: string[];
  subjectsList?: string[];
  currentTeacherName?: string;
  studentsList?: StudentProfile[];
}

export const CreateWorksheetModal: React.FC<CreateWorksheetModalProps> = ({
  onClose,
  onCreateAssignment,
  onUpdateAssignment,
  editingAssignment,
  gradeLevelsList = [],
  subjectsList = [],
  currentTeacherName = 'ครูผู้สอน',
  studentsList = [],
}) => {
  const isEditMode = Boolean(editingAssignment);
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');

  const activeSubjects = subjectsList.filter((s) => s !== 'ทั้งหมด');
  const activeGrades = gradeLevelsList.filter((g) => g !== 'ทั้งหมด');

  // Form State
  const [title, setTitle] = useState(editingAssignment?.title || '');
  const [subject, setSubject] = useState(editingAssignment?.subject || activeSubjects[0] || '');
  const [gradeLevel, setGradeLevel] = useState(editingAssignment?.gradeLevel || activeGrades[0] || '');
  const [category, setCategory] = useState<CategoryType>(editingAssignment?.category || 'แบบฝึกหัด');
  const [description, setDescription] = useState(editingAssignment?.description || '');
  const [instructions, setInstructions] = useState(editingAssignment?.instructions || 'จงตอบคำถามให้ถูกต้องตามหลักการ');
  const [dueDate, setDueDate] = useState('');

  // Visibility & Student Targeting State
  const [isPublished, setIsPublished] = useState<boolean>(
    editingAssignment?.isPublished !== false
  );
  const [assignScope, setAssignScope] = useState<'class' | 'specific'>(
    editingAssignment?.assignedStudentCodes && editingAssignment.assignedStudentCodes.length > 0
      ? 'specific'
      : 'class'
  );
  const [assignedStudentCodes, setAssignedStudentCodes] = useState<string[]>(
    editingAssignment?.assignedStudentCodes || []
  );
  const [studentPickerSearch, setStudentPickerSearch] = useState('');
  const [validationError, setValidationError] = useState('');
  const [pendingAssignment, setPendingAssignment] = useState<Assignment | null>(null);

  const sortedStudentsForPicker = useMemo(() => {
    const query = studentPickerSearch.trim().toLowerCase();
    const baseGrade = gradeLevel.includes('/') ? gradeLevel.split('/')[0] : gradeLevel;

    return [...studentsList]
      .filter((st) => {
        if (!query) return true;
        return (
          st.name.toLowerCase().includes(query) ||
          st.code.toLowerCase().includes(query) ||
          st.gradeLevel.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aMatch = a.gradeLevel === gradeLevel || a.gradeLevel === baseGrade ? 0 : 1;
        const bMatch = b.gradeLevel === gradeLevel || b.gradeLevel === baseGrade ? 0 : 1;
        if (aMatch !== bMatch) return aMatch - bMatch;
        return a.code.localeCompare(b.code);
      });
  }, [studentsList, studentPickerSearch, gradeLevel]);

  const toggleStudentCode = (code: string) => {
    setAssignedStudentCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const [questions, setQuestions] = useState<Question[]>(
    editingAssignment?.questions || [
      {
        id: 'q1',
        text: 'ข้อความคำถามข้อที่ 1',
        type: 'text',
        maxPoints: 5,
        answerKey: 'เฉลยและเกณฑ์การให้คะแนน',
      },
    ]
  );

  useEffect(() => {
    if (editingAssignment?.dueDate) {
      try {
        const d = new Date(editingAssignment.dueDate);
        const isoLocal = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        setDueDate(isoLocal);
      } catch {
        setDueDate('');
      }
    }
  }, [editingAssignment]);

  // AI Generator Form
  const [aiTopic, setAiTopic] = useState('');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const handleAddQuestion = () => {
    const nextId = `q${questions.length + 1}`;
    setQuestions((prev) => [
      ...prev,
      {
        id: nextId,
        text: '',
        type: 'text',
        maxPoints: 5,
        answerKey: '',
      },
    ]);
  };

  const handleRemoveQuestion = (id: string) => {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleQuestionChange = (id: string, field: keyof Question, value: any) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  async function compressClassroomCover(file: File): Promise<string> {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      throw new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WebP หรือ GIF เท่านั้น');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('ไฟล์รูปภาพมีขนาดใหญ่เกิน 10 MB');
    }
    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้'));
        el.src = objectUrl;
      });
      const MAX_W = 1120;
      const MAX_H = 630;
      let w = img.width;
      let h = img.height;
      if (w > MAX_W || h > MAX_H) {
        const ratio = Math.min(MAX_W / w, MAX_H / h);
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context error');
      ctx.drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', 0.82);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  const handleQuestionImageUpload = async (qId: string, file: File | undefined) => {
    if (!file) return;
    try {
      const compressed = await compressClassroomCover(file);
      handleQuestionChange(qId, 'imageUrl', compressed);
    } catch (err: any) {
      alert(err?.message || 'ไม่สามารถอัปโหลดรูปภาพได้');
    }
  };

  const handleGenerateAiWorksheet = async () => {
    if (!aiTopic.trim()) return;
    setIsGeneratingAi(true);

    try {
      const res = await fetch('/api/ai/generate-worksheet', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          subject,
          gradeLevel,
          topic: aiTopic,
          numberOfQuestions: 3,
        }),
      });
      const data = await res.json();
      if (data.success && data.worksheet) {
        const ws = data.worksheet;
        setTitle(ws.title || `ใบงานเรื่อง ${aiTopic}`);
        setDescription(ws.description || `แบบฝึกหัดเรื่อง ${aiTopic} สำหรับนักเรียนชั้น ${gradeLevel}`);
        setInstructions(ws.instructions || 'จงตอบคำถามให้ครบถ้วน');
        if (ws.questions && Array.isArray(ws.questions)) {
          setQuestions(ws.questions);
        }
        setActiveTab('manual'); // Switch to manual tab to inspect & fine-tune
      } else {
        throw new Error('AI generation returned empty');
      }
    } catch (err) {
      console.warn('AI Worksheet generation fallback template used:', err);
      // Smart Fallback template
      setTitle(`ใบงานเรื่อง ${aiTopic}`);
      setDescription(`แบบฝึกหัดพัฒนาทักษะ เรื่อง ${aiTopic} สำหรับนักเรียนระดับชั้น ${gradeLevel}`);
      setInstructions(`ให้นักเรียนศึกษาค้นคว้า และอธิบายคำตอบเรื่อง "${aiTopic}" ให้ถูกต้อง ชัดเจน`);
      setQuestions([
        {
          id: 'q1',
          text: `จงอธิบายความหมายและความสำคัญของ "${aiTopic}"`,
          type: 'text',
          maxPoints: 5,
          answerKey: `อธิบายหลักการ แนวคิด และความสำคัญของ ${aiTopic} ได้อย่างถูกต้องและครอบคลุม`,
        },
        {
          id: 'q2',
          text: `ยกตัวอย่างการนำ "${aiTopic}" ไปประยุกต์ใช้ในชีวิตประจำวันหรือสถานการณ์จริง`,
          type: 'text',
          maxPoints: 5,
          answerKey: `ยกตัวอย่างได้อย่างน้อย 2 ตัวอย่างพร้อมอธิบายเหตุผลประกอบอย่างชัดเจน`,
        },
        {
          id: 'q3',
          text: `วิเคราะห์ปัญหาหรือข้อควรระวังที่เกี่ยวข้องกับ "${aiTopic}" และเสนอแนะวิธีแก้ไข`,
          type: 'text',
          maxPoints: 5,
          answerKey: `วิเคราะห์และเสนอแนวทางแก้ไขได้อย่างสร้างสรรค์และสมเหตุสมผล`,
        },
      ]);
      setActiveTab('manual');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    if (!title.trim()) return;

    if (assignScope === 'specific' && assignedStudentCodes.length === 0) {
      setValidationError('กรุณาเลือกนักเรียนอย่างน้อย 1 คน หรือเลือกมอบหมายให้ทุกคนในชั้นเรียน');
      return;
    }

    const totalPoints = questions.reduce((sum, q) => sum + (q.maxPoints || 5), 0);
    const targetingPayload = {
      isPublished,
      assignedStudentCodes: assignScope === 'specific' ? assignedStudentCodes : [],
    };

    if (isEditMode && editingAssignment && onUpdateAssignment) {
      const updatedAsg: Assignment = {
        ...editingAssignment,
        title,
        subject,
        gradeLevel,
        category,
        description: description || `ใบงานวิชา${subject} เรื่อง ${title}`,
        instructions,
        questions,
        totalPoints,
        dueDate: dueDate
          ? new Date(dueDate).toISOString()
          : editingAssignment.dueDate,
        ...targetingPayload,
      };
      setPendingAssignment(updatedAsg);
    } else {
      const newAsg: Assignment = {
        id: `asg_${Date.now()}`,
        title,
        subject,
        gradeLevel,
        category,
        description: description || `ใบงานวิชา${subject} เรื่อง ${title}`,
        instructions,
        questions,
        totalPoints,
        dueDate: dueDate
          ? new Date(dueDate).toISOString()
          : new Date(Date.now() + 86400000 * 3).toISOString(),
        createdDate: new Date().toISOString(),
        teacherName: currentTeacherName,
        ...targetingPayload,
      };
      setPendingAssignment(newAsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#111c18] border border-slate-200 dark:border-emerald-950/60 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950/60 flex items-center justify-between bg-slate-50/90 dark:bg-[#0d1613]">
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <Edit3 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            ) : (
              <FilePlus className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
            )}
            <h2 className="text-lg font-bold font-prompt text-slate-900 dark:text-white">
              {isEditMode ? 'แก้ไขใบงาน' : 'สร้างใบงานออนไลน์ใหม่'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (Only show AI option when creating new) */}
        {!isEditMode && (
          <div className="flex border-b border-slate-200 dark:border-emerald-950/60 bg-slate-100/70 dark:bg-[#0d1613] p-1">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-white dark:bg-[#111c18] text-emerald-800 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              ✏️ กำหนดโจทย์เอง
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>สร้างใบงานอัตโนมัติด้วย AI</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
          {activeTab === 'ai' && !isEditMode ? (
            <div className="space-y-4 max-w-xl mx-auto py-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950 rounded-2xl text-emerald-700 dark:text-emerald-400 flex items-center justify-center mx-auto">
                  <Sparkles className="w-6 h-6" />
                </div>
                <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                  สร้างชุดโจทย์ใบงานด้วย Gemini AI
                </h3>
                <p className="text-xs text-slate-500">
                  ระบุหัวข้อบทเรียนและระดับชั้น แล้วให้ AI ร่างข้อสอบพร้อมเฉลยในไม่กี่วินาที
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    วิชา
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  >
                    {activeSubjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    ระดับชั้น
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                  >
                    {activeGrades.map((g) => (
                      <option key={g} value={g}>
                        ชั้น {g}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  หัวข้อบทเรียน / เรื่องที่ต้องการสร้างโจทย์
                </label>
                <input
                  type="text"
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  placeholder="เช่น ระบบสุริยะและดาวเคราะห์, สมการเชิงเส้น, คำสรรพนาม..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateAiWorksheet}
                disabled={isGeneratingAi || !aiTopic.trim()}
                className="w-full py-2.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{isGeneratingAi ? 'กำลังประมวลผลและสร้างใบงาน...' : 'สร้างใบงานด้วย AI ทันที'}</span>
              </button>
            </div>
          ) : (
            <form id="create-asg-form" onSubmit={handleSubmit} className="space-y-5">
              {/* Basic Meta */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อใบงาน *
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="เช่น ใบงานที่ 5: เรื่อง กระบวนการสังเคราะห์ด้วยแสง"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    วิชา *
                  </label>
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {activeSubjects.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    ระดับชั้น *
                  </label>
                  <select
                    value={gradeLevel}
                    onChange={(e) => setGradeLevel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {activeGrades.map((g) => (
                      <option key={g} value={g}>
                        ชั้น {g}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    หมวดหมู่
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CategoryType)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  >
                    {CATEGORY_LIST.filter((c) => c !== 'ทั้งหมด').map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    คำชี้แจงสำหรับนักเรียน
                  </label>
                  <input
                    type="text"
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="เช่น จงตอบคำถามให้ถูกต้องครบถ้วน..."
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    กำหนดส่งงาน (Due Date)
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Visibility & Student Assignment Targeting */}
              <div className="p-4 bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-900/60 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span className="text-xs font-bold font-prompt text-slate-900 dark:text-white">
                      กำหนดสิทธิ์นักเรียนที่มองเห็นใบงานนี้
                    </span>
                  </div>

                  <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                    />
                    <span className={`flex items-center gap-1 ${isPublished ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      {isPublished ? 'เผยแพร่ให้นักเรียนเห็นทันที' : 'ซ่อนไว้ก่อน (ฉบับร่าง)'}
                    </span>
                  </label>
                </div>

                {validationError && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                    {validationError}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignScope('class');
                      setValidationError('');
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      assignScope === 'class'
                        ? 'bg-white dark:bg-[#111c18] border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'bg-white/60 dark:bg-[#111c18]/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="block">มอบหมายตามห้อง/ระดับชั้น (ชั้น {gradeLevel})</span>
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                      เฉพาะนักเรียนในชั้น {gradeLevel} เท่านั้นที่มองเห็น
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignScope('specific')}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      assignScope === 'specific'
                        ? 'bg-white dark:bg-[#111c18] border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'bg-white/60 dark:bg-[#111c18]/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="block">
                      ระบุนักเรียนรายบุคคล ({assignedStudentCodes.length} คน)
                    </span>
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                      เฉพาะนักเรียนที่ครูเลือกชื่อเท่านั้นที่จะมองเห็น
                    </span>
                  </button>
                </div>

                {assignScope === 'specific' && (
                  <div className="bg-white dark:bg-[#111c18] border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="relative flex-1 min-w-[180px]">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={studentPickerSearch}
                          onChange={(e) => setStudentPickerSearch(e.target.value)}
                          placeholder="ค้นหาชื่อ, รหัส หรือห้องเรียน..."
                          className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />
                      </div>

                      <div className="flex items-center gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => {
                            const baseG = gradeLevel.includes('/') ? gradeLevel.split('/')[0] : gradeLevel;
                            const roomCodes = studentsList
                              .filter((s) => s.gradeLevel === gradeLevel || s.gradeLevel === baseG)
                              .map((s) => s.code);
                            setAssignedStudentCodes(Array.from(new Set([...assignedStudentCodes, ...roomCodes])));
                          }}
                          className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                        >
                          เลือกทุกคนในชั้น {gradeLevel}
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          type="button"
                          onClick={() => setAssignedStudentCodes([])}
                          className="text-rose-500 font-semibold hover:underline cursor-pointer"
                        >
                          ล้างที่เลือก
                        </button>
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-100 dark:border-slate-800 rounded-lg">
                      {sortedStudentsForPicker.length === 0 ? (
                        <p className="text-center py-4 text-xs text-slate-400">
                          ไม่พบรายชื่อนักเรียน
                        </p>
                      ) : (
                        sortedStudentsForPicker.map((st) => {
                          const checked = assignedStudentCodes.includes(st.code);
                          return (
                            <label
                              key={st.id}
                              className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer text-xs"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleStudentCode(st.code)}
                                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                                />
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {st.name}
                                </span>
                                <span className="text-[11px] font-mono text-slate-400">
                                  ({st.code})
                                </span>
                              </div>
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[10px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                                {st.gradeLevel}
                              </span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Dynamic Questions Builder */}
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-emerald-950/60">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-prompt text-slate-900 dark:text-white">
                    รายการโจทย์คำถาม ({questions.length} ข้อ)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>เพิ่มข้อใหม่</span>
                  </button>
                </div>

                {questions.map((q, idx) => (
                  <div
                    key={q.id}
                    className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        ข้อที่ {idx + 1}
                      </span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(q.id)}
                          className="text-rose-500 hover:text-rose-700 text-xs p-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      required
                      placeholder="พิมพ์โจทย์คำถาม..."
                      value={q.text}
                      onChange={(e) => handleQuestionChange(q.id, 'text', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-[#0d1613] border border-slate-300 dark:border-emerald-950/60 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          ประเภทโจทย์
                        </label>
                        <select
                          value={q.type}
                          onChange={(e) => handleQuestionChange(q.id, 'type', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-[#0d1613] border border-slate-300 dark:border-emerald-950/60 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                        >
                          <option value="text">ข้อเขียนตอบแบบบรรยาย</option>
                          <option value="multiple_choice">ปรนัย (เลือกตอบ)</option>
                          <option value="fill_blank">เติมคำในช่องว่าง</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          คะแนนเต็มข้อนี้
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={q.maxPoints}
                          onChange={(e) =>
                            handleQuestionChange(q.id, 'maxPoints', Number(e.target.value))
                          }
                          className="w-full px-2 py-1.5 bg-white dark:bg-[#0d1613] border border-slate-300 dark:border-emerald-950/60 rounded-lg text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="เฉลยคำตอบ/เกณฑ์ตรวจสำหรับครู (ถ้ามี)"
                      value={q.answerKey || ''}
                      onChange={(e) => handleQuestionChange(q.id, 'answerKey', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-[#0d1613] border border-slate-200 dark:border-emerald-950/60 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 italic focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                    />

                    {/* Question Image Attachment */}
                    <div className="space-y-1.5 pt-1">
                      {q.imageUrl ? (
                        <div className="flex items-center gap-3 p-2 bg-white dark:bg-[#0d1613] border border-slate-200 dark:border-emerald-950/60 rounded-xl">
                          <img
                            src={q.imageUrl}
                            alt="Question attachment preview"
                            className="w-16 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-800"
                            referrerPolicy="no-referrer"
                          />
                          <div className="flex-1 min-w-0 text-xs">
                            <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">แนบรูปภาพโจทย์แล้ว</p>
                            <button
                              type="button"
                              onClick={() => handleQuestionChange(q.id, 'imageUrl', '')}
                              className="text-[11px] text-rose-500 hover:underline cursor-pointer font-medium"
                            >
                              ลบรูปภาพนี้ออก
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#111c18] border border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors shadow-2xs">
                            <Upload className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                            <span>แนบรูปภาพประกอบข้อนี้</span>
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp,image/gif"
                              className="hidden"
                              onChange={(e) => handleQuestionImageUpload(q.id, e.target.files?.[0])}
                            />
                          </label>
                          <span className="text-[10px] text-slate-400">รองรับ JPG, PNG, WebP (สูงสุด 10MB)</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-emerald-950/60 bg-slate-50/90 dark:bg-[#0d1613] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            ยกเลิก
          </button>

          {(activeTab === 'manual' || isEditMode) && (
            <button
              type="submit"
              form="create-asg-form"
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-xs font-semibold rounded-lg shadow-md transition-all cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'บันทึกการแก้ไขใบงาน' : 'บันทึกและเผยแพร่ใบงาน'}</span>
            </button>
          )}
        </div>
      </div>

      <SaveConfirmModal
        isOpen={Boolean(pendingAssignment)}
        title={isEditMode ? 'ยืนยันการบันทึกการแก้ไขใบงาน?' : 'ยืนยันการบันทึกและเผยแพร่ใบงาน?'}
        description="ตรวจสอบรายละเอียดใบงานก่อนบันทึกลงระบบ"
        details={
          pendingAssignment
            ? [
                { label: 'ชื่อใบงาน', value: pendingAssignment.title },
                { label: 'รายวิชา / ชั้น', value: `${pendingAssignment.subject} (${pendingAssignment.gradeLevel})` },
                { label: 'จำนวนข้อ / คะแนน', value: `${pendingAssignment.questions.length} ข้อ (${pendingAssignment.totalPoints} คะแนน)` },
                { label: 'สถานะการมองเห็น', value: pendingAssignment.isPublished === false ? 'ซ่อนชั่วคราว (ร่าง)' : 'เผยแพร่ให้นักเรียนเห็น' },
              ]
            : []
        }
        confirmLabel={isEditMode ? 'ยืนยันบันทึกการแก้ไข' : 'ยืนยันสร้างและบันทึก'}
        onConfirm={() => {
          if (!pendingAssignment) return;
          if (isEditMode && onUpdateAssignment) {
            onUpdateAssignment(pendingAssignment);
          } else {
            onCreateAssignment(pendingAssignment);
          }
          setPendingAssignment(null);
          onClose();
        }}
        onCancel={() => setPendingAssignment(null)}
      />
    </div>
  );
};
