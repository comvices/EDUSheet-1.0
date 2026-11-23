import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  BookOpen,
  GraduationCap,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Image as ImageIcon,
  Upload,
  Layers,
  FileText,
  FolderOpen,
  Link as LinkIcon,
  Eye,
  EyeOff,
  Sparkles,
} from 'lucide-react';
import {
  Assignment,
  CourseUnitItem,
  LearningResource,
  ResourceType,
  SubjectClassroom,
} from '../types';
import { SaveConfirmModal } from './SaveConfirmModal';
import { isSafeHttpUrl, isSafeImageSrc, sanitizeImageSrc } from '../utils/security';
import { W22103_CURRICULUM_PRESET } from '../utils/classroomBuilder';

async function compressClassroomCover(file: File): Promise<string> {
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

    const MAX_W = 1120;
    const MAX_H = 630;
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

    ctx.fillStyle = '#0f172a';
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

interface CreateClassroomModalProps {
  editingClassroom?: SubjectClassroom | null;
  subjectsList: string[];
  gradeLevelsList: string[];
  assignments: Assignment[];
  resources: LearningResource[];
  currentTeacherName: string;
  onClose: () => void;
  onSaveClassroom: (classroom: SubjectClassroom) => void;
}

const createEmptyUnit = (order: number): CourseUnitItem => ({
  id: `unit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  title: `หน่วยการเรียนรู้ที่ ${order}`,
  description: '',
  order,
  mediaTitle: '',
  mediaUrl: '',
  mediaType: 'video',
  linkedAssignmentIds: [],
  linkedResourceIds: [],
});

export const CreateClassroomModal: React.FC<CreateClassroomModalProps> = ({
  editingClassroom,
  subjectsList,
  gradeLevelsList,
  assignments,
  resources,
  currentTeacherName,
  onClose,
  onSaveClassroom,
}) => {
  const selectableSubjects = subjectsList.filter((s) => s !== 'ทั้งหมด');
  const selectableGrades = gradeLevelsList.filter((g) => g !== 'ทั้งหมด');

  const [courseCode, setCourseCode] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState(selectableSubjects[0] || '');
  const [gradeLevel, setGradeLevel] = useState(selectableGrades[0] || 'ทั้งหมด');
  const [description, setDescription] = useState('');
  const [objectives, setObjectives] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [units, setUnits] = useState<CourseUnitItem[]>([createEmptyUnit(1)]);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);

  const [isProcessingCover, setIsProcessingCover] = useState(false);
  const [coverPreviewError, setCoverPreviewError] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pendingClassroom, setPendingClassroom] = useState<SubjectClassroom | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingClassroom) {
      setCourseCode(editingClassroom.courseCode);
      setTitle(editingClassroom.title);
      setSubject(editingClassroom.subject);
      setGradeLevel(editingClassroom.gradeLevel);
      setDescription(editingClassroom.description || '');
      setObjectives(editingClassroom.objectives || '');
      setCoverUrl(editingClassroom.coverUrl || '');
      setIsPublished(editingClassroom.isPublished !== false);
      const sortedUnits =
        editingClassroom.units && editingClassroom.units.length > 0
          ? [...editingClassroom.units].sort((a, b) => a.order - b.order)
          : [createEmptyUnit(1)];
      setUnits(sortedUnits);
      setExpandedUnitId(sortedUnits[0]?.id || null);
    } else {
      const initialUnit = createEmptyUnit(1);
      setCourseCode('');
      setTitle('');
      setSubject(selectableSubjects[0] || '');
      setGradeLevel(selectableGrades[0] || 'ทั้งหมด');
      setDescription('');
      setObjectives('');
      setCoverUrl('');
      setIsPublished(true);
      setUnits([initialUnit]);
      setExpandedUnitId(initialUnit.id);
    }
    setCoverPreviewError(false);
    setErrors({});
  }, [editingClassroom]);

  // Filter assignments & resources prioritizing current subject first
  const sortedAssignments = [...assignments].sort((a, b) => {
    const aMatch = a.subject === subject ? 0 : 1;
    const bMatch = b.subject === subject ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.title.localeCompare(b.title, 'th');
  });

  const sortedResources = [...resources].sort((a, b) => {
    const aMatch = a.subject === subject ? 0 : 1;
    const bMatch = b.subject === subject ? 0 : 1;
    if (aMatch !== bMatch) return aMatch - bMatch;
    return a.title.localeCompare(b.title, 'th');
  });

  const handleCoverUpload = async (file: File | undefined | null) => {
    if (!file) return;
    setIsProcessingCover(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.coverUrl;
      return next;
    });
    try {
      const compressed = await compressClassroomCover(file);
      setCoverUrl(compressed);
      setCoverPreviewError(false);
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        coverUrl: err?.message || 'ไม่สามารถอัปโหลดรูปภาพหน้าปกได้',
      }));
    } finally {
      setIsProcessingCover(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleAddUnit = () => {
    const nextOrder = units.length + 1;
    const nextUnit = createEmptyUnit(nextOrder);
    setUnits((prev) => [...prev, nextUnit]);
    setExpandedUnitId(nextUnit.id);
  };

  const handleUpdateUnit = (unitId: string, patch: Partial<CourseUnitItem>) => {
    setUnits((prev) => prev.map((u) => (u.id === unitId ? { ...u, ...patch } : u)));
  };

  const handleToggleUnitLink = (
    unitId: string,
    field: 'linkedAssignmentIds' | 'linkedResourceIds',
    targetId: string
  ) => {
    setUnits((prev) =>
      prev.map((u) => {
        if (u.id !== unitId) return u;
        const current = u[field] || [];
        const exists = current.includes(targetId);
        return {
          ...u,
          [field]: exists ? current.filter((id) => id !== targetId) : [...current, targetId],
        };
      })
    );
  };

  const handleMoveUnit = (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= units.length) return;
    const copy = [...units];
    const [item] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, item);
    setUnits(copy.map((u, i) => ({ ...u, order: i + 1 })));
  };

  const handleRemoveUnit = (unitId: string) => {
    if (units.length <= 1) return;
    const filtered = units.filter((u) => u.id !== unitId).map((u, i) => ({ ...u, order: i + 1 }));
    setUnits(filtered);
    if (expandedUnitId === unitId) {
      setExpandedUnitId(filtered[0]?.id || null);
    }
  };

  const handleApplyW22103Preset = () => {
    setCourseCode(W22103_CURRICULUM_PRESET.courseCode);
    if (!title.trim() || title.startsWith('ห้องเรียนวิชา')) {
      setTitle(W22103_CURRICULUM_PRESET.title);
    }
    const matchedSubj = selectableSubjects.find((s) =>
      W22103_CURRICULUM_PRESET.subjectCandidates.some((cand) =>
        s.toLowerCase().includes(cand.toLowerCase()) || cand.toLowerCase().includes(s.toLowerCase())
      )
    );
    if (matchedSubj) setSubject(matchedSubj);
    const matchedGrade = selectableGrades.find((g) => g.startsWith(W22103_CURRICULUM_PRESET.gradeLevel));
    if (matchedGrade) setGradeLevel(matchedGrade);
    setDescription(W22103_CURRICULUM_PRESET.description);
    setObjectives(W22103_CURRICULUM_PRESET.objectives);

    const presetUnits: CourseUnitItem[] = W22103_CURRICULUM_PRESET.units.map((u, idx) => ({
      id: `unit_w22103_${Date.now()}_${idx + 1}`,
      title: u.title,
      description: u.description,
      order: idx + 1,
      mediaType: 'video',
      mediaTitle: units[idx]?.mediaTitle || '',
      mediaUrl: units[idx]?.mediaUrl || '',
      linkedAssignmentIds: units[idx]?.linkedAssignmentIds || [],
      linkedResourceIds: units[idx]?.linkedResourceIds || [],
    }));
    setUnits(presetUnits);
    setExpandedUnitId(presetUnits[0]?.id || null);
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!courseCode.trim()) newErrors.courseCode = 'กรุณาระบุรหัสวิชา เช่น ว22103';
    if (!title.trim()) newErrors.title = 'กรุณาระบุชื่อห้องเรียนรายวิชา';
    if (!subject.trim()) newErrors.subject = 'กรุณาเลือกรายวิชา';
    if (coverUrl.trim() && !isSafeImageSrc(coverUrl)) {
      newErrors.coverUrl =
        'รูปภาพหน้าปกต้องเป็นลิงก์ https://, http:// หรือไฟล์รูป JPG/PNG/WebP/GIF เท่านั้น';
    }

    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      if (!u.title.trim()) {
        newErrors.units = `กรุณาระบุชื่อหน่วยการเรียนรู้ลำดับที่ ${i + 1}`;
        setExpandedUnitId(u.id);
        break;
      }
      if (u.mediaUrl && u.mediaUrl.trim() && !isSafeHttpUrl(u.mediaUrl)) {
        newErrors.units = `ลิงก์สื่อใน "${u.title}" ต้องขึ้นต้นด้วย https:// หรือ http:// เท่านั้น`;
        setExpandedUnitId(u.id);
        break;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const cleanCover = sanitizeImageSrc(coverUrl);
    const cleanedUnits: CourseUnitItem[] = units.map((u, idx) => ({
      id: u.id,
      title: u.title.trim(),
      description: (u.description || '').trim(),
      order: idx + 1,
      ...(u.mediaUrl && u.mediaUrl.trim()
        ? {
            mediaUrl: u.mediaUrl.trim(),
            mediaTitle: (u.mediaTitle || '').trim() || u.title.trim(),
            mediaType: u.mediaType || 'link',
          }
        : {}),
      linkedAssignmentIds: u.linkedAssignmentIds || [],
      linkedResourceIds: u.linkedResourceIds || [],
    }));

    const nowIso = new Date().toISOString();
    const isPersistedExisting = Boolean(editingClassroom && !editingClassroom.id.startsWith('auto_cls_'));
    const classroomPayload: SubjectClassroom = {
      id: isPersistedExisting ? editingClassroom!.id : `cls_${Date.now()}`,
      courseCode: courseCode.trim(),
      title: title.trim(),
      subject: subject.trim(),
      gradeLevel: gradeLevel.trim() || 'ทั้งหมด',
      description: description.trim(),
      ...(objectives.trim() ? { objectives: objectives.trim() } : {}),
      teacherName: editingClassroom ? editingClassroom.teacherName : currentTeacherName,
      ...(cleanCover ? { coverUrl: cleanCover } : {}),
      units: cleanedUnits,
      isPublished,
      createdDate: editingClassroom ? editingClassroom.createdDate : nowIso,
      updatedDate: nowIso,
    };

    setPendingClassroom(classroomPayload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-emerald-950/60 bg-slate-50/90 dark:bg-[var(--theme-surface-dark-elevated)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-900/20">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-prompt text-slate-900 dark:text-white leading-tight">
                {editingClassroom ? 'แก้ไขห้องเรียนรายวิชา' : 'สร้างห้องเรียนรายวิชาใหม่'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                จัดโครงสร้างบทเรียน หน่วยการเรียนรู้ เชื่อมต่อสื่อการสอนและใบงานประจำวิชา
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างสร้างห้องเรียน"
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Basic Course Info */}
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold font-prompt text-slate-900 dark:text-white">
                01. ข้อมูลพื้นฐานรายวิชา
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleApplyW22103Preset}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>โหลดโครงสร้างตัวอย่าง ว22103 (4 หน่วย)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublished(!isPublished)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
                    isPublished
                      ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>{isPublished ? 'เปิดให้นักเรียนเข้าเรียน' : 'ฉบับร่าง (ซ่อนจากนักเรียน)'}</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  รหัสวิชา <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={40}
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="เช่น ว22103, ค31101"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
                {errors.courseCode && (
                  <p className="text-[11px] text-rose-500 mt-1">{errors.courseCode}</p>
                )}
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  ชื่อห้องเรียน / ชื่อรายวิชา <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น วิทยาการคำนวณ 2 (การออกแบบอัลกอริทึมและไพทอน)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
                {errors.title && <p className="text-[11px] text-rose-500 mt-1">{errors.title}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  กลุ่มสาระ / หมวดรายวิชา <span className="text-rose-500">*</span>
                </label>
                {selectableSubjects.length > 0 ? (
                  <select
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  >
                    {!selectableSubjects.includes(subject) && subject && (
                      <option value={subject}>{subject}</option>
                    )}
                    {selectableSubjects.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="ระบุชื่อรายวิชา เช่น วิทยาการคำนวณ"
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                )}
                {errors.subject && (
                  <p className="text-[11px] text-rose-500 mt-1">{errors.subject}</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>ระดับชั้น / ห้องเรียนเป้าหมาย</span>
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                >
                  <option value="ทั้งหมด">ทั้งหมด (ทุกระดับชั้น)</option>
                  {!selectableGrades.includes(gradeLevel) &&
                    gradeLevel &&
                    gradeLevel !== 'ทั้งหมด' && <option value={gradeLevel}>{gradeLevel}</option>}
                  {selectableGrades.map((gl) => (
                    <option key={gl} value={gl}>
                      {gl}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  คำอธิบายรายวิชา (Course Overview)
                </label>
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="อธิบายขอบเขตเนื้อหา แนวทางการเรียน และการวัดผลประเมินผล..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  จุดประสงค์ / ผลการเรียนรู้ที่คาดหวัง
                </label>
                <textarea
                  rows={3}
                  maxLength={3000}
                  value={objectives}
                  onChange={(e) => setObjectives(e.target.value)}
                  placeholder="เช่น 1. เข้าใจแนวคิดเชิงคำนวณ  2. ออกแบบอัลกอริทึมแก้ปัญหาได้..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 resize-none"
                />
              </div>
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>รูปภาพหน้าปกห้องเรียน (แนบหรือไม่ก็ได้)</span>
                </label>
                {coverUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setCoverUrl('');
                      setCoverPreviewError(false);
                    }}
                    className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                  >
                    ลบรูปหน้าปก
                  </button>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={(e) => handleCoverUpload(e.target.files?.[0])}
                className="hidden"
              />

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessingCover}
                  className="sm:col-span-5 py-2.5 px-4 bg-slate-100 dark:bg-slate-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-center gap-2 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>{isProcessingCover ? 'กำลังปรับขนาด...' : 'อัปโหลดรูปหน้าปก'}</span>
                </button>

                <input
                  type="url"
                  value={coverUrl.startsWith('data:image/') ? '' : coverUrl}
                  onChange={(e) => {
                    setCoverUrl(e.target.value);
                    setCoverPreviewError(false);
                  }}
                  placeholder="หรือวางลิงก์รูปภาพหน้าปก (https://...)"
                  className="sm:col-span-7 px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {sanitizeImageSrc(coverUrl) && !coverPreviewError && (
                <div className="aspect-video max-h-40 w-full rounded-2xl overflow-hidden border border-slate-200 dark:border-emerald-950/60 bg-slate-100 dark:bg-slate-800">
                  <img
                    src={sanitizeImageSrc(coverUrl) || ''}
                    alt="ตัวอย่างหน้าปกห้องเรียน"
                    onError={() => setCoverPreviewError(true)}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {errors.coverUrl && <p className="text-[11px] text-rose-500">{errors.coverUrl}</p>}
            </div>
          </div>

          {/* Section 2: Learning Units Builder */}
          <div className="pt-5 border-t border-slate-200 dark:border-emerald-950/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold font-prompt text-slate-900 dark:text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>02. โครงสร้างหน่วยการเรียนรู้และเนื้อหา ({units.length} หน่วย)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  แบ่งเนื้อหาเป็นบท/หน่วย พร้อมแนบลิงก์บทเรียน เชื่อมสื่อการสอน และเชื่อมใบงานที่มีอยู่ได้เลย
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddUnit}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer self-start sm:self-auto shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>เพิ่มหน่วยการเรียนรู้</span>
              </button>
            </div>

            {errors.units && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300">
                {errors.units}
              </div>
            )}

            <div className="space-y-3">
              {units.map((unit, idx) => {
                const isExpanded = expandedUnitId === unit.id;
                const linkedAsgCount = unit.linkedAssignmentIds?.length || 0;
                const linkedResCount = unit.linkedResourceIds?.length || 0;

                return (
                  <div
                    key={unit.id}
                    className="border border-slate-200 dark:border-emerald-950/60 rounded-2xl overflow-hidden bg-slate-50/50 dark:bg-[var(--theme-surface-dark-elevated)]/60"
                  >
                    {/* Unit Header Row */}
                    <div className="px-4 py-3 bg-white dark:bg-[var(--theme-surface-dark)]/90 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setExpandedUnitId(isExpanded ? null : unit.id)}
                        className="flex-1 text-left flex items-center gap-3 min-w-0 cursor-pointer"
                      >
                        <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 font-mono text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold font-prompt text-slate-900 dark:text-white truncate">
                            {unit.title || `หน่วยการเรียนรู้ที่ ${idx + 1}`}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            ใบงาน {linkedAsgCount} รายการ · สื่อ {linkedResCount} รายการ
                            {unit.mediaUrl ? ' · มีลิงก์บทเรียน' : ''}
                          </p>
                        </div>
                      </button>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveUnit(idx, -1)}
                          disabled={idx === 0}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                          title="เลื่อนขึ้น"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveUnit(idx, 1)}
                          disabled={idx === units.length - 1}
                          className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-30 cursor-pointer"
                          title="เลื่อนลง"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {units.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveUnit(unit.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                            title="ลบหน่วยนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Unit Editor Body */}
                    {isExpanded && (
                      <div className="p-4 border-t border-slate-200 dark:border-emerald-950/60 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              ชื่อหน่วยการเรียนรู้ / บทเรียน
                            </label>
                            <input
                              type="text"
                              value={unit.title}
                              onChange={(e) => handleUpdateUnit(unit.id, { title: e.target.value })}
                              placeholder={`เช่น หน่วยที่ ${idx + 1}: แนวคิดเชิงคำนวณเบื้องต้น`}
                              className="w-full px-3.5 py-2 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                              สาระสำคัญ / คำชี้แจงประจำหน่วย
                            </label>
                            <textarea
                              rows={2}
                              value={unit.description || ''}
                              onChange={(e) =>
                                handleUpdateUnit(unit.id, { description: e.target.value })
                              }
                              placeholder="สรุปหัวข้อที่เรียน คำแนะนำสำหรับนักเรียน หรือขั้นตอนการศึกษาบทเรียน..."
                              className="w-full px-3.5 py-2 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600 resize-none"
                            />
                          </div>
                        </div>

                        {/* Optional Inline Lesson Media Link */}
                        <div className="p-3 bg-white dark:bg-[var(--theme-surface-dark)] rounded-xl border border-slate-200 dark:border-emerald-950/60 space-y-2.5">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <LinkIcon className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span>แนบลิงก์สื่อ / วิดีโอ / สไลด์ประจำบท (ถ้ามี)</span>
                          </span>
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <select
                              value={unit.mediaType || 'video'}
                              onChange={(e) =>
                                handleUpdateUnit(unit.id, {
                                  mediaType: e.target.value as ResourceType,
                                })
                              }
                              className="sm:col-span-3 px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium"
                            >
                              <option value="video">วิดีโอสอน</option>
                              <option value="slide">สไลด์นำเสนอ</option>
                              <option value="document">เอกสาร PDF</option>
                              <option value="link">ลิงก์บทเรียน</option>
                            </select>
                            <input
                              type="text"
                              value={unit.mediaTitle || ''}
                              onChange={(e) =>
                                handleUpdateUnit(unit.id, { mediaTitle: e.target.value })
                              }
                              placeholder="ชื่อสื่อ เช่น สไลด์บทที่ 1"
                              className="sm:col-span-4 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                            />
                            <input
                              type="url"
                              value={unit.mediaUrl || ''}
                              onChange={(e) =>
                                handleUpdateUnit(unit.id, { mediaUrl: e.target.value })
                              }
                              placeholder="https://..."
                              className="sm:col-span-5 px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono"
                            />
                          </div>
                        </div>

                        {/* Link Existing Assignments & Resources */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="p-3 bg-white dark:bg-[var(--theme-surface-dark)] rounded-xl border border-slate-200 dark:border-emerald-950/60 space-y-2">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <FileText className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>เชื่อมโยงใบงานในหน่วยนี้ ({linkedAsgCount})</span>
                            </span>
                            {sortedAssignments.length === 0 ? (
                              <p className="text-[11px] text-slate-400">ยังไม่มีใบงานในระบบ</p>
                            ) : (
                              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                                {sortedAssignments.map((asg) => {
                                  const checked = (unit.linkedAssignmentIds || []).includes(asg.id);
                                  return (
                                    <label
                                      key={asg.id}
                                      className={`flex items-start gap-2 p-2 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                                        checked
                                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold'
                                          : 'border-slate-200 dark:border-emerald-950/50 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          handleToggleUnitLink(unit.id, 'linkedAssignmentIds', asg.id)
                                        }
                                        className="mt-0.5 accent-emerald-700"
                                      />
                                      <div className="min-w-0">
                                        <p className="truncate">{asg.title}</p>
                                        <p className="text-[10px] text-slate-400 font-normal">
                                          {asg.subject} · {asg.gradeLevel} · {asg.totalPoints} คะแนน
                                        </p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="p-3 bg-white dark:bg-[var(--theme-surface-dark)] rounded-xl border border-slate-200 dark:border-emerald-950/60 space-y-2">
                            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                              <FolderOpen className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>เชื่อมโยงสื่อจากคลังสื่อ ({linkedResCount})</span>
                            </span>
                            {sortedResources.length === 0 ? (
                              <p className="text-[11px] text-slate-400">ยังไม่มีสื่อการเรียนรู้ในระบบ</p>
                            ) : (
                              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                                {sortedResources.map((res) => {
                                  const checked = (unit.linkedResourceIds || []).includes(res.id);
                                  return (
                                    <label
                                      key={res.id}
                                      className={`flex items-start gap-2 p-2 rounded-lg border text-[11px] cursor-pointer transition-colors ${
                                        checked
                                          ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200 font-semibold'
                                          : 'border-slate-200 dark:border-emerald-950/50 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() =>
                                          handleToggleUnitLink(unit.id, 'linkedResourceIds', res.id)
                                        }
                                        className="mt-0.5 accent-emerald-700"
                                      />
                                      <div className="min-w-0">
                                        <p className="truncate">{res.title}</p>
                                        <p className="text-[10px] text-slate-400 font-normal">
                                          {res.subject} · {res.gradeLevel}
                                        </p>
                                      </div>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Submit */}
          <div className="pt-4 border-t border-slate-200 dark:border-emerald-950/60 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="theme-btn-sheen px-6 py-2.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-900/15 transition-all inline-flex items-center gap-2 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{editingClassroom ? 'บันทึกการแก้ไขห้องเรียน' : 'สร้างห้องเรียนรายวิชา'}</span>
            </button>
          </div>
        </form>
      </div>

      <SaveConfirmModal
        isOpen={Boolean(pendingClassroom)}
        title={editingClassroom ? 'ยืนยันบันทึกการแก้ไขห้องเรียน?' : 'ยืนยันการสร้างห้องเรียนรายวิชา?'}
        description="ตรวจสอบรายละเอียดห้องเรียนและหน่วยการเรียนรู้ก่อนบันทึกลงระบบ"
        details={
          pendingClassroom
            ? [
                {
                  label: 'รหัสวิชา / ชื่อห้องเรียน',
                  value: `${pendingClassroom.courseCode} · ${pendingClassroom.title}`,
                },
                {
                  label: 'กลุ่มวิชา / ชั้นเรียน',
                  value: `${pendingClassroom.subject} (${pendingClassroom.gradeLevel})`,
                },
                {
                  label: 'จำนวนหน่วยการเรียนรู้',
                  value: `${pendingClassroom.units.length} หน่วย`,
                },
              ]
            : []
        }
        confirmLabel={editingClassroom ? 'ยืนยันบันทึกการแก้ไข' : 'ยืนยันสร้างห้องเรียน'}
        variant="emerald"
        onConfirm={() => {
          if (!pendingClassroom) return;
          onSaveClassroom(pendingClassroom);
          setPendingClassroom(null);
          onClose();
        }}
        onCancel={() => setPendingClassroom(null)}
      />
    </div>
  );
};
