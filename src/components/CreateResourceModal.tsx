import React, { useState, useEffect, useRef } from 'react';
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
  Image as ImageIcon,
  Upload,
  Trash2,
} from 'lucide-react';
import { LearningResource, ResourceType } from '../types';
import { SaveConfirmModal } from './SaveConfirmModal';
import { isSafeHttpUrl, isSafeImageSrc, sanitizeImageSrc } from '../utils/security';

async function compressPreviewImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error('รองรับเฉพาะไฟล์รูปภาพ JPG, PNG, WebP หรือ GIF เท่านั้น');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('ไฟล์รูปภาพมีขนาดใหญ่เกิน 10 MB กรุณาเลือกไฟล์ที่เล็กลง');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพนี้ได้'));
      el.src = objectUrl;
    });

    const MAX_W = 960;
    const MAX_H = 540;
    let width = img.naturalWidth || MAX_W;
    let height = img.naturalHeight || MAX_H;

    const ratio = Math.min(MAX_W / width, MAX_H / height, 1);
    width = Math.max(1, Math.round(width * ratio));
    height = Math.max(1, Math.round(height * ratio));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('เบราว์เซอร์ไม่รองรับการประมวลผลรูปภาพ');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const qualities = [0.82, 0.7, 0.56, 0.42];
    for (const q of qualities) {
      const dataUrl = canvas.toDataURL('image/jpeg', q);
      if (dataUrl.length <= 320000) {
        return dataUrl;
      }
    }

    throw new Error('รูปภาพยังมีขนาดใหญ่เกินไปหลังย่อขนาด กรุณาเลือกรูปอื่น');
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

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
    subjectsList.find((s) => s !== 'ทั้งหมด') || ''
  );
  const [gradeLevel, setGradeLevel] = useState(
    gradeLevelsList.find((g) => g !== 'ทั้งหมด') || 'ทั้งหมด'
  );
  const [type, setType] = useState<ResourceType>('video');
  const [url, setUrl] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const [previewLoadError, setPreviewLoadError] = useState(false);
  const [fileSize, setFileSize] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingResource, setPendingResource] = useState<LearningResource | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingResource) {
      setTitle(editingResource.title);
      setDescription(editingResource.description);
      setSubject(editingResource.subject);
      setGradeLevel(editingResource.gradeLevel);
      setType(editingResource.type);
      setUrl(editingResource.url);
      setThumbnailUrl(editingResource.thumbnailUrl || '');
      setFileSize(editingResource.fileSize || '');
    } else {
      setTitle('');
      setDescription('');
      setUrl('');
      setThumbnailUrl('');
      setFileSize('');
    }
    setPreviewLoadError(false);
    setErrors({});
  }, [editingResource]);

  const handleImageFileSelect = async (file: File | undefined | null) => {
    if (!file) return;
    setIsProcessingImage(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.thumbnailUrl;
      return next;
    });
    try {
      const compressed = await compressPreviewImage(file);
      setThumbnailUrl(compressed);
      setPreviewLoadError(false);
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        thumbnailUrl: err?.message || 'ไม่สามารถแนบรูปภาพตัวอย่างได้',
      }));
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = 'กรุณาระบุชื่อสื่อการเรียนรู้';
    }
    if (!url.trim()) {
      newErrors.url = 'กรุณาระบุลิงก์หรือ URL ของสื่อ';
    } else if (!isSafeHttpUrl(url)) {
      newErrors.url = 'URL ต้องขึ้นต้นด้วย https:// หรือ http:// เท่านั้นเพื่อความปลอดภัย';
    }
    if (thumbnailUrl.trim() && !isSafeImageSrc(thumbnailUrl)) {
      newErrors.thumbnailUrl =
        'รูปภาพตัวอย่างต้องเป็นลิงก์ https://, http:// หรือไฟล์รูป JPG/PNG/WebP/GIF ที่อัปโหลดเท่านั้น';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const cleanThumbnail = sanitizeImageSrc(thumbnailUrl);
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
      ...(cleanThumbnail ? { thumbnailUrl: cleanThumbnail } : {}),
    };

    setPendingResource(savedRes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-emerald-950/60 bg-slate-50/90 dark:bg-[var(--theme-surface-dark-elevated)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-900/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-prompt text-slate-900 dark:text-white leading-tight">
                {editingResource ? 'แก้ไขสื่อการเรียนรู้' : 'เพิ่มสื่อการเรียนรู้ใหม่'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                คลังสื่อการเรียนรู้ประจำวิชาและห้องเรียนที่คุณกำหนด
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
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-emerald-950/60 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
                }`}
              >
                <Video className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <span className="text-xs">🎥 วิดีโอสอน</span>
              </button>

              <button
                type="button"
                onClick={() => setType('document')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  type === 'document'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-emerald-950/60 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
                }`}
              >
                <FileText className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <span className="text-xs">📄 เอกสาร PDF</span>
              </button>

              <button
                type="button"
                onClick={() => setType('slide')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  type === 'slide'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-emerald-950/60 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
                }`}
              >
                <Presentation className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <span className="text-xs">📊 สไลด์นำเสนอ</span>
              </button>

              <button
                type="button"
                onClick={() => setType('link')}
                className={`p-3 rounded-2xl border flex flex-col items-center gap-2 transition-all cursor-pointer ${
                  type === 'link'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 text-emerald-800 dark:text-emerald-300 font-bold ring-2 ring-emerald-500/20'
                    : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-emerald-950/60 text-slate-600 dark:text-slate-400 hover:border-emerald-300'
                }`}
              >
                <LinkIcon className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
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
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
            />
            {errors.title && <p className="text-[11px] text-rose-500 mt-1">{errors.title}</p>}
          </div>

          {/* Subject & Grade Level / Room Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>วิชาเรียน</span>
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
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
                <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>ระดับชั้น / ห้องเรียน</span>
              </label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
              >
                <option value="ทั้งหมด">ทั้งหมด (ทุกระดับชั้น)</option>
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
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono"
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
                className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
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
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-2xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 resize-none"
            />
          </div>

          {/* Preview Image Attachment */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>5. รูปภาพตัวอย่างสื่อ (แนบหรือไม่ก็ได้)</span>
              </label>
              {thumbnailUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setThumbnailUrl('');
                    setPreviewLoadError(false);
                  }}
                  className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>ลบรูปตัวอย่าง</span>
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => handleImageFileSelect(e.target.files?.[0])}
              className="hidden"
            />

            {sanitizeImageSrc(thumbnailUrl) && !previewLoadError ? (
              <div className="relative aspect-video w-full max-h-52 rounded-2xl overflow-hidden border border-slate-200 dark:border-emerald-950/60 bg-slate-100 dark:bg-slate-800 group">
                <img
                  src={sanitizeImageSrc(thumbnailUrl) || ''}
                  alt="ตัวอย่างรูปภาพสื่อ"
                  onError={() => setPreviewLoadError(true)}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3.5 py-2 bg-white text-slate-900 rounded-xl text-xs font-bold shadow-md hover:bg-emerald-50 inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-emerald-700" />
                    <span>เปลี่ยนรูปภาพ</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessingImage}
                className="w-full py-5 px-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-emerald-950/60 hover:border-emerald-500 dark:hover:border-emerald-600 bg-slate-50/70 dark:bg-slate-800/40 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-all flex flex-col items-center justify-center gap-1.5 text-center cursor-pointer disabled:opacity-60"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold font-prompt text-slate-700 dark:text-slate-200">
                  {isProcessingImage ? 'กำลังปรับขนาดรูปภาพ...' : 'คลิกเพื่ออัปโหลดรูปภาพตัวอย่างจากเครื่อง'}
                </span>
                <span className="text-[11px] text-slate-400">
                  รองรับ JPG, PNG, WebP, GIF (ระบบย่อขนาดให้อัตโนมัติเพื่อให้โหลดเร็ว)
                </span>
              </button>
            )}

            {/* External Image URL option */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type="url"
                value={thumbnailUrl.startsWith('data:image/') ? '' : thumbnailUrl}
                onChange={(e) => {
                  setThumbnailUrl(e.target.value);
                  setPreviewLoadError(false);
                }}
                placeholder="หรือวางลิงก์รูปภาพตัวอย่าง (https://...)"
                className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 font-mono"
              />
              {thumbnailUrl.startsWith('data:image/') && (
                <span className="px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[11px] font-semibold shrink-0">
                  แนบไฟล์รูปจากเครื่องแล้ว
                </span>
              )}
            </div>

            {previewLoadError && thumbnailUrl.trim() && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">
                ไม่สามารถโหลดภาพตัวอย่างจากลิงก์นี้ได้ กรุณาตรวจสอบ URL หรืออัปโหลดรูปจากเครื่องแทน
              </p>
            )}
            {errors.thumbnailUrl && (
              <p className="text-[11px] text-rose-500">{errors.thumbnailUrl}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="pt-3 border-t border-slate-200 dark:border-emerald-950/60 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-2xl text-xs font-semibold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="theme-btn-sheen px-6 py-2.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white rounded-2xl text-xs font-bold shadow-md shadow-emerald-900/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{editingResource ? 'บันทึกการแก้ไข' : 'เผยแพร่สื่อการเรียนรู้'}</span>
            </button>
          </div>
        </form>
      </div>

      <SaveConfirmModal
        isOpen={Boolean(pendingResource)}
        title={editingResource ? 'ยืนยันการบันทึกการแก้ไขสื่อ?' : 'ยืนยันการเผยแพร่สื่อการเรียนรู้?'}
        description="ตรวจสอบรายละเอียดสื่อการเรียนรู้ก่อนบันทึกลงระบบ"
        details={
          pendingResource
            ? [
                { label: 'ชื่อสื่อ', value: pendingResource.title },
                { label: 'ประเภท', value: pendingResource.type },
                { label: 'รายวิชา / ชั้น', value: `${pendingResource.subject} (${pendingResource.gradeLevel})` },
                { label: 'รูปภาพตัวอย่าง', value: pendingResource.thumbnailUrl ? 'แนบแล้ว' : 'ไม่มี (ใช้ค่าเริ่มต้น)' },
              ]
            : []
        }
        confirmLabel={editingResource ? 'ยืนยันบันทึกการแก้ไข' : 'ยืนยันเผยแพร่สื่อ'}
        variant="emerald"
        onConfirm={() => {
          if (!pendingResource) return;
          onSaveResource(pendingResource);
          setPendingResource(null);
          onClose();
        }}
        onCancel={() => setPendingResource(null)}
      />
    </div>
  );
};
