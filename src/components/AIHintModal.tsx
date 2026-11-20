import React, { useState } from 'react';
import { X, Sparkles, HelpCircle, Lightbulb, Send } from 'lucide-react';
import { Assignment } from '../types';
import { getAuthHeaders } from '../utils/security';

interface AIHintModalProps {
  assignment: Assignment;
  initialQuestionText?: string;
  onClose: () => void;
}

export const AIHintModal: React.FC<AIHintModalProps> = ({
  assignment,
  initialQuestionText,
  onClose,
}) => {
  const [selectedQuestionText, setSelectedQuestionText] = useState(
    initialQuestionText || assignment.questions[0]?.text || ''
  );
  const [studentQuery, setStudentQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hintResult, setHintResult] = useState<string | null>(null);

  const handleFetchHint = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/hint', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          assignmentTitle: assignment.title,
          questionText: selectedQuestionText,
          studentQuery,
        }),
      });
      const data = await res.json();
      if (data.success && data.hint) {
        setHintResult(data.hint);
      } else {
        throw new Error('AI Hint empty');
      }
    } catch (err) {
      console.warn('AI Hint fallback estimation used:', err);
      setHintResult(
        `💡 แนวทางการคิดสำหรับโจทย์ข้อนี้:\n` +
        `1. ลองวิเคราะห์คีย์เวิร์ดสำคัญในโจทย์: แยกสิ่งที่โจทย์กำหนดให้ กับสิ่งที่ต้องการหา\n` +
        `2. ทบทวนกฎเกณฑ์หรือทฤษฎีบทที่เกี่ยวข้องในบทเรียนนี้\n` +
        `3. เขียนลำดับความคิดทีละขั้น และตรวจสอบความสมเหตุสมผลของเหตุผลประกอบ\n` +
        `ข้อแนะนำ: ไม่จำเป็นต้องกังวลเรื่องตอบผิด ให้ลองอธิบายหลักการตามความเข้าใจของตนเองก่อนครับ!`
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[#111c18] border border-slate-200 dark:border-emerald-950/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-emerald-900/30 flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-700 text-white">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h3 className="text-base font-bold font-prompt">
              ผู้ช่วยติวเตอร์ AI (ขอคำใบ้ & ช่วยคิด)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-white/80 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-slate-800 dark:text-slate-200">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              เลือกโจทย์ข้อที่ต้องการคำใบ้:
            </label>
            <select
              value={selectedQuestionText}
              onChange={(e) => setSelectedQuestionText(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            >
              {assignment.questions.map((q, idx) => (
                <option key={q.id} value={q.text}>
                  ข้อ {idx + 1}: {q.text}
                </option>
              ))}
            </select>
          </div>

          <form onSubmit={handleFetchHint} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                สิ่งที่คุณสงสัย หรือต้องการให้ AI ช่วยอธิบายสั้นๆ:
              </label>
              <input
                type="text"
                value={studentQuery}
                onChange={(e) => setStudentQuery(e.target.value)}
                placeholder="เช่น ไม่เข้าใจขั้นตอนการย้ายข้างสมการ / ขอคำใบ้คำศัพท์..."
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-semibold rounded-lg text-xs shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Lightbulb className="w-4 h-4 text-amber-300" />
              <span>{isLoading ? 'กำลังคิดคำใบ้...' : 'ขอคำใบ้จาก AI'}</span>
            </button>
          </form>

          {/* Hint Output Box */}
          {hintResult && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-900 dark:text-emerald-200">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>คำใบ้และแนวทางจาก AI:</span>
              </div>
              <p className="text-xs text-emerald-950 dark:text-emerald-100 leading-relaxed font-sans whitespace-pre-wrap">
                {hintResult}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
