import React, { useState, useEffect } from 'react';
import { X, Sparkles, Plus, Trash2, Save, FilePlus, Edit3 } from 'lucide-react';
import { Assignment, Question, CategoryType } from '../types';
import { CATEGORY_LIST } from '../data/mockData';

interface CreateWorksheetModalProps {
  onClose: () => void;
  onCreateAssignment: (newAssignment: Assignment) => void;
  onUpdateAssignment?: (updatedAssignment: Assignment) => void;
  editingAssignment?: Assignment | null;
  gradeLevelsList?: string[];
  subjectsList?: string[];
  currentTeacherName?: string;
}

export const CreateWorksheetModal: React.FC<CreateWorksheetModalProps> = ({
  onClose,
  onCreateAssignment,
  onUpdateAssignment,
  editingAssignment,
  gradeLevelsList = ['ป.4', 'ป.5', 'ป.6', 'ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'],
  subjectsList = ['วิทยาศาสตร์', 'คณิตศาสตร์', 'ภาษาไทย', 'ภาษาอังกฤษ', 'สังคมศึกษา', 'เทคโนโลยี/คอมพิวเตอร์', 'ศิลปะและดนตรี'],
  currentTeacherName = 'ครูผู้สอน',
}) => {
  const isEditMode = Boolean(editingAssignment);
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');

  const activeSubjects = subjectsList.filter((s) => s !== 'ทั้งหมด');
  const activeGrades = gradeLevelsList.filter((g) => g !== 'ทั้งหมด');

  // Form State
  const [title, setTitle] = useState(editingAssignment?.title || '');
  const [subject, setSubject] = useState(editingAssignment?.subject || activeSubjects[0] || 'วิทยาศาสตร์');
  const [gradeLevel, setGradeLevel] = useState(editingAssignment?.gradeLevel || activeGrades[0] || 'ม.3');
  const [category, setCategory] = useState<CategoryType>(editingAssignment?.category || 'แบบฝึกหัด');
  const [description, setDescription] = useState(editingAssignment?.description || '');
  const [instructions, setInstructions] = useState(editingAssignment?.instructions || 'จงตอบคำถามให้ถูกต้องตามหลักการ');
  const [dueDate, setDueDate] = useState('');

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

  const handleGenerateAiWorksheet = async () => {
    if (!aiTopic.trim()) return;
    setIsGeneratingAi(true);

    try {
      const res = await fetch('/api/ai/generate-worksheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    if (!title.trim()) return;

    const totalPoints = questions.reduce((sum, q) => sum + (q.maxPoints || 5), 0);

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
      };
      onUpdateAssignment(updatedAsg);
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
      };
      onCreateAssignment(newAsg);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <Edit3 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            ) : (
              <FilePlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            )}
            <h2 className="text-lg font-bold font-prompt text-slate-900 dark:text-white">
              {isEditMode ? 'แก้ไขใบงาน' : 'สร้างใบงานออนไลน์ใหม่'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher (Only show AI option when creating new) */}
        {!isEditMode && (
          <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/50 p-1">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              ✏️ กำหนดโจทย์เอง
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === 'ai'
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span>สร้างใบงานอัตโนมัติด้วย AI</span>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 text-slate-800 dark:text-slate-200">
          {activeTab === 'ai' && !isEditMode ? (
            <div className="space-y-4 max-w-xl mx-auto py-4">
              <div className="text-center space-y-2">
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-950 rounded-2xl text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
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
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={handleGenerateAiWorksheet}
                disabled={isGeneratingAi || !aiTopic.trim()}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-xs shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4 text-yellow-300" />
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
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
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

              {/* Dynamic Questions Builder */}
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold font-prompt text-slate-900 dark:text-white">
                    รายการโจทย์คำถาม ({questions.length} ข้อ)
                  </h4>
                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold cursor-pointer"
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
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
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
                      className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-900 dark:text-white"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] text-slate-500 mb-1">
                          ประเภทโจทย์
                        </label>
                        <select
                          value={q.type}
                          onChange={(e) => handleQuestionChange(q.id, 'type', e.target.value)}
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
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
                          className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono"
                        />
                      </div>
                    </div>

                    <input
                      type="text"
                      placeholder="เฉลยคำตอบ/เกณฑ์ตรวจสำหรับครู (ถ้ามี)"
                      value={q.answerKey || ''}
                      onChange={(e) => handleQuestionChange(q.id, 'answerKey', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 italic"
                    />
                  </div>
                ))}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
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
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-md transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'บันทึกการแก้ไขใบงาน' : 'บันทึกและเผยแพร่ใบงาน'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
