import React, { useState, useEffect } from 'react';
import {
  X,
  Save,
  Video,
  FileText,
  Presentation,
  Link as LinkIcon,
  BookOpen,
  GraduationCap,
  Sparkles,
} from 'lucide-react';
import { LearningResource, ResourceType } from '../types';

interface CreateResourceModalProps {
  editingResource?: LearningResource | null;
  onClose: () => void;
  onSaveResource: (resource: LearningResource) => void;
  gradeLevelsList: string[];
  subjectsList: string[];
  currentTeacherName: string;
}

export const CreateResourceModal: React.FC<CreateResourceModalProps> = ({
  editingResource,
  onClose,
  onSaveResource,
  gradeLevelsList,
  subjectsList,
  currentTeacherName,
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [subject, setSubject] = useState(
    subjectsList.find((s) => s !== 'ทั้งหมด') || 'วิทยาศาสตร์'
  );
  const [gradeLevel, setGradeLevel] = useState(
    gradeLevelsList.find((g) => g !== 'ทั้งหมด') || 'ม.1/1'
  );
  const [type, setType] = useState<ResourceType>('video');
  const [url, setUrl] = useState('');
  const [fileSize, setFileSize] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (editingResource) {
      setTitle(editingResource.title);
      setDescription(editingResource.description);
      setSubject(editingResource.subject);
      setGradeLevel(editingResource.gradeLevel);
      setType(editingResource.type);
      setUrl(editingResource.url);
      setFileSize(editingResource.fileSize || '');
    } else {
      setTitle('');
      setDescription('');
      setUrl('');
      setFileSize('');
    }
  }, [editingResource]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'กรุณาระบุชื่อสื่อการเรียนรู้';
    }
    if (!url.trim()) {
      newErrors.url = 'กรุณาระบุลิงก์หรือ URL ของสื่อ';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const savedRes: LearningResource = {
      id: editingResource ? editingResource.id : `res_${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      subject,
      gradeLevel,
      type,
      url: url.trim(),
      createdDate: editingResource ? editingResource.createdDate : new Date().toISOString(),
      teacherName: editingResource ? editingResource.teacherName : currentTeacherName,
      ...(fileSize.trim() ? { fileSize: fileSize.trim() } : {}),
    };

    onSaveResource(savedRes);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-prompt text-slate-900 dark:text-white leading-tight">
                {editingResource ? 'แก้ไขสื่อการเรียนรู้' : 'เพิ่มสื่อการเรียนรู้ใหม่'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                คลังสื่อการเรียนรู้ประจำวิชาและห้องเรียน (ม.1/1 - ม.6/3)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Resource Type Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt mb-2">
              1. เลือกประเภทสื่อการเรียนรู้ <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => setType('video')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  type === 'video'
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-500 text-rose-700 dark:text-rose-300 font-bold ring-2 ring-rose-500/20'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <Video className="w-5 h-5 text-rose-500" />
                <span className="text-xs">🎥 วิดีโอสอน</span>
              </button>

              <button
                type="button"
                onClick={() => setType('document')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  type === 'document'
                    ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-700 dark:text-sky-300 font-bold ring-2 ring-sky-500/20'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <FileText className="w-5 h-5 text-sky-500" />
                <span className="text-xs">📄 เอกสาร PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setType('slide')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  type === 'slide'
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <Presentation className="w-5 h-5 text-emerald-500" />
                <span className="text-xs">📊 สไลด์นำเสนอ</span>
              </button>

              <button
                type="button"
                onClick={() => setType('link')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  type === 'link'
                    ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-500 text-purple-700 dark:text-purple-300 font-bold ring-2 ring-purple-500/20'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                }`}
              >
                <LinkIcon className="w-5 h-5 text-purple-500" />
                <span className="text-xs">🔗 ลิงก์ภายนอก</span>
              </button>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt mb-1.5">
              2. หัวข้อสื่อการเรียนรู้ <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น วิดีโอสอน: การสังเคราะห์ด้วยแสง ม.3/1"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            {errors.title && <p className="text-[11px] text-rose-500 mt-1">{errors.title}</p>}
          </div>

          {/* Subject & Grade Level / Room Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span>วิชาเรียน</span>
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {subjectsList
                  .filter((s) => s !== 'ทั้งหมด')
                  .map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt mb-1.5 flex items-center gap-1.5">
                <GraduationCap className="w-3.5 h-3.5 text-indigo-500" />
                <span>ระดับชั้น / ห้องเรียน</span>
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ทั้งหมด">ทั้งหมด (ทุกระดับชั้น)</option>
                <option value="ม.1 (ทุกห้อง)">ม.1 (ทุกห้อง)</option>
                <option value="ม.2 (ทุกห้อง)">ม.2 (ทุกห้อง)</option>
                <option value="ม.3 (ทุกห้อง)">ม.3 (ทุกห้อง)</option>
                <option value="ม.4 (ทุกห้อง)">ม.4 (ทุกห้อง)</option>
                <option value="ม.5 (ทุกห้อง)">ม.5 (ทุกห้อง)</option>
                <option value="ม.6 (ทุกห้อง)">ม.6 (ทุกห้อง)</option>
                {gradeLevelsList
                  .filter((g) => g !== 'ทั้งหมด')
                  .map((gl) => (
                    <option key={gl} value={gl}>
                      {gl}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt mb-1.5">
              3. ลิงก์ URL สื่อการเรียนรู้ <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... หรือ ลิงก์ PDF / Google Drive"
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-mono"
            />
            {errors.url && <p className="text-[11px] text-rose-500 mt-1">{errors.url}</p>}
            <p className="text-[10px] text-slate-400 mt-1">
              💡 สำหรับวิดีโอ YouTube ระบบจะสร้างตัวอย่างพรีวิวแบบเล่นวิดีโอในหน้าเว็บให้อัตโนมัติ
            </p>
          </div>

          {/* Optional File Size */}
          {(type === 'document' || type === 'slide') && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt mb-1.5">
                ขนาดไฟล์ (ระบุหรือไม่ก็ได้)
              </label>
              <input
                type="text"
                value={fileSize}
                onChange={(e) => setFileSize(e.target.value)}
                placeholder="เช่น 2.5 MB, 10 Pages"
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt mb-1.5">
              4. คำอธิบายสื่อการเรียนรู้ / คำแนะนำสำหรับนักเรียน
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="อธิบายสรุปเนื้อหาสำคัญ หรือประเด็นที่ควรเน้นย้ำให้นักเรียนศึกษา..."
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Submit Button */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-semibold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md shadow-indigo-500/20 transition-colors flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{editingResource ? 'บันทึกการแก้ไข' : 'เผยแพร่สื่อการเรียนรู้'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
