import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  Search,
  Plus,
  Video,
  FileText,
  Presentation,
  Link as LinkIcon,
  ExternalLink,
  Pencil,
  Trash2,
  GraduationCap,
  Filter,
  Play,
  X,
  Sparkles,
  Layers,
  Calendar,
  User,
  CheckCircle2,
} from 'lucide-react';
import { LearningResource, ResourceType, UserRole } from '../types';

interface ResourcesViewProps {
  resources: LearningResource[];
  role: UserRole;
  studentGradeLevel?: string;
  subjectsList: string[];
  gradeLevelsList: string[];
  onOpenCreateResource: () => void;
  onEditResource: (resource: LearningResource) => void;
  onDeleteResource: (resourceId: string) => void;
}

export const ResourcesView: React.FC<ResourcesViewProps> = ({
  resources,
  role,
  studentGradeLevel,
  subjectsList,
  gradeLevelsList,
  onOpenCreateResource,
  onEditResource,
  onDeleteResource,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('ทั้งหมด');
  const [selectedGrade, setSelectedGrade] = useState('ทั้งหมด');
  const [selectedType, setSelectedType] = useState<string>('all');
  
  // Video Modal Preview & Delete Modal States
  const [activeVideoUrl, setActiveVideoUrl] = useState<{ url: string; title: string } | null>(null);
  const [deletingResourceConfirm, setDeletingResourceConfirm] = useState<LearningResource | null>(null);

  // Filter resources based on role, grade level, subject, type, and search term
  const filteredResources = useMemo(() => {
    return resources.filter((res) => {
      // 1. Role-based Grade Filter for Students
      if (role === 'student' && studentGradeLevel) {
        const baseGrade = studentGradeLevel.includes('/') ? studentGradeLevel.split('/')[0] : studentGradeLevel;
        const matchesStudent =
          res.gradeLevel === 'ทั้งหมด' ||
          res.gradeLevel === studentGradeLevel ||
          res.gradeLevel === baseGrade ||
          res.gradeLevel === `${baseGrade} (ทุกห้อง)`;
        
        if (!matchesStudent) return false;
      }

      // 2. Explicit Grade Selection Filter (if user manually chooses grade)
      if (selectedGrade !== 'ทั้งหมด') {
        if (selectedGrade.includes('/')) {
          // Specific room e.g. "ม.1/1"
          const base = selectedGrade.split('/')[0];
          if (
            res.gradeLevel !== selectedGrade &&
            res.gradeLevel !== base &&
            res.gradeLevel !== `${base} (ทุกห้อง)` &&
            res.gradeLevel !== 'ทั้งหมด'
          ) {
            return false;
          }
        } else {
          // Whole grade level e.g. "ม.1"
          if (
            res.gradeLevel !== selectedGrade &&
            !res.gradeLevel.startsWith(selectedGrade) &&
            res.gradeLevel !== 'ทั้งหมด'
          ) {
            return false;
          }
        }
      }

      // 3. Subject Filter
      if (selectedSubject !== 'ทั้งหมด' && res.subject !== selectedSubject) {
        return false;
      }

      // 4. Resource Type Filter
      if (selectedType !== 'all' && res.type !== selectedType) {
        return false;
      }

      // 5. Search Term Filter
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchTitle = res.title.toLowerCase().includes(query);
        const matchDesc = res.description.toLowerCase().includes(query);
        const matchSubject = res.subject.toLowerCase().includes(query);
        const matchTeacher = res.teacherName.toLowerCase().includes(query);
        if (!matchTitle && !matchDesc && !matchSubject && !matchTeacher) {
          return false;
        }
      }

      return true;
    });
  }, [resources, role, studentGradeLevel, selectedGrade, selectedSubject, selectedType, searchTerm]);

  // Helper to extract YouTube Embed URL
  const getYouTubeEmbedUrl = (url: string): string | null => {
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        return `https://www.youtube.com/embed/${match[2]}?autoplay=1`;
      }
    } catch (e) {}
    return null;
  };

  // Helper to get Youtube Thumbnail URL
  const getYouTubeThumbnail = (url: string): string | null => {
    try {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        return `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg`;
      }
    } catch (e) {}
    return null;
  };

  const getBadgeStyle = (type: ResourceType) => {
    switch (type) {
      case 'video':
        return {
          bg: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
          icon: <Video className="w-3.5 h-3.5 text-rose-500" />,
          label: '🎥 วิดีโอสอน',
        };
      case 'document':
        return {
          bg: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800',
          icon: <FileText className="w-3.5 h-3.5 text-sky-500" />,
          label: '📄 เอกสาร PDF',
        };
      case 'slide':
        return {
          bg: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
          icon: <Presentation className="w-3.5 h-3.5 text-emerald-500" />,
          label: '📊 สไลด์นำเสนอ',
        };
      case 'link':
        return {
          bg: 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
          icon: <LinkIcon className="w-3.5 h-3.5 text-purple-500" />,
          label: '🔗 ลิงก์ภายนอก',
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner & Hero Section */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-violet-900 text-white p-6 sm:p-8 shadow-xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/30 border border-indigo-400/30 text-indigo-200 text-xs font-semibold backdrop-blur-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>คลังสื่อการเรียนรู้แบบแยกตามห้องเรียน (ม.1/1 - ม.6/3)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold font-prompt leading-tight tracking-tight">
              📚 คลังสื่อการเรียนรู้ประจำวิชา
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/90 leading-relaxed">
              รวบรวมวิดีโอคลิปการสอน เอกสารสรุป PDF สไลด์นำเสนอบทเรียน และลิงก์แหล่งเรียนรู้เพิ่มเติม
              ให้นักเรียนได้ศึกษาทบทวนความรู้ได้ทุกที่ทุกเวลา
            </p>
          </div>

          {/* Teacher Action Button */}
          {role === 'teacher' && (
            <button
              onClick={onOpenCreateResource}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 bg-white text-indigo-900 hover:bg-indigo-50 font-bold font-prompt text-xs rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-indigo-600" />
              <span>+ เพิ่มสื่อการเรียนรู้ใหม่</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหาชื่อสื่อ, รายวิชา, คำอธิบาย หรือชื่อครูผู้สอน..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 font-medium"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Grade & Subject Selectors */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Grade Level Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">
              <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
              >
                <option value="ทั้งหมด">ระดับชั้น: ทั้งหมด</option>
                {gradeLevelsList
                  .filter((g) => g !== 'ทั้งหมด')
                  .map((gl) => (
                    <option key={gl} value={gl}>
                      {gl}
                    </option>
                  ))}
              </select>
            </div>

            {/* Subject Filter */}
            <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2 rounded-xl">
              <BookOpen className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
              <select
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 dark:text-slate-300 focus:outline-hidden cursor-pointer"
              >
                <option value="ทั้งหมด">วิชาเรียน: ทั้งหมด</option>
                {subjectsList
                  .filter((s) => s !== 'ทั้งหมด')
                  .map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>

        {/* Resource Type Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none border-t border-slate-100 dark:border-slate-800 pt-3">
          <span className="text-xs font-semibold text-slate-400 shrink-0 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> ประเภทสื่อ:
          </span>
          <button
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer ${
              selectedType === 'all'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            ทั้งหมด ({resources.length})
          </button>
          <button
            onClick={() => setSelectedType('video')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedType === 'video'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 hover:bg-rose-100'
            }`}
          >
            <Video className="w-3.5 h-3.5" />
            <span>🎥 วิดีโอ</span>
          </button>
          <button
            onClick={() => setSelectedType('document')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedType === 'document'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 hover:bg-sky-100'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>📄 เอกสาร PDF</span>
          </button>
          <button
            onClick={() => setSelectedType('slide')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedType === 'slide'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
            }`}
          >
            <Presentation className="w-3.5 h-3.5" />
            <span>📊 สไลด์นำเสนอ</span>
          </button>
          <button
            onClick={() => setSelectedType('link')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer ${
              selectedType === 'link'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            <span>🔗 ลิงก์ภายนอก</span>
          </button>
        </div>
      </div>

      {/* Grid of Learning Resources */}
      {filteredResources.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 text-slate-400 space-y-3">
          <BookOpen className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-700 stroke-1" />
          <p className="text-sm font-semibold font-prompt text-slate-600 dark:text-slate-300">
            ไม่พบสื่อการเรียนรู้ในหมวดหมู่นี้
          </p>
          {role === 'student' && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400">
              🔒 ระบบแสดงเฉพาะสื่อการเรียนรู้สำหรับระดับชั้น {studentGradeLevel} หรือระดับชั้นกลาง
            </p>
          )}
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedSubject('ทั้งหมด');
              setSelectedGrade('ทั้งหมด');
              setSelectedType('all');
            }}
            className="text-xs text-indigo-600 dark:text-indigo-400 underline font-semibold cursor-pointer"
          >
            ล้างตัวกรองทั้งหมด
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredResources.map((res) => {
            const badge = getBadgeStyle(res.type);
            const ytEmbed = getYouTubeEmbedUrl(res.url);
            const ytThumb = getYouTubeThumbnail(res.url);

            return (
              <div
                key={res.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col group"
              >
                {/* Media Header / Video Thumbnail Preview */}
                {res.type === 'video' && (
                  <div className="relative aspect-video bg-slate-950 overflow-hidden group-hover:brightness-105 transition-all">
                    {ytThumb ? (
                      <img
                        src={ytThumb}
                        alt={res.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-tr from-rose-950 to-indigo-950 flex items-center justify-center">
                        <Video className="w-12 h-12 text-rose-500/50" />
                      </div>
                    )}

                    <div className="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                      <button
                        onClick={() => {
                          if (ytEmbed) {
                            setActiveVideoUrl({ url: ytEmbed, title: res.title });
                          } else {
                            window.open(res.url, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="w-14 h-14 rounded-full bg-rose-600/90 hover:bg-rose-600 text-white flex items-center justify-center shadow-lg backdrop-blur-xs transform group-hover:scale-110 transition-transform cursor-pointer"
                        title="คลิกเพื่อรับชมวิดีโอ"
                      >
                        <Play className="w-6 h-6 fill-current ml-1" />
                      </button>
                    </div>

                    <div className="absolute top-3 left-3">
                      <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border backdrop-blur-md shadow-xs ${badge.bg}`}>
                        {badge.label}
                      </span>
                    </div>
                  </div>
                )}

                {/* Card Header for non-video items */}
                {res.type !== 'video' && (
                  <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${badge.bg} flex items-center gap-1.5`}>
                      {badge.icon}
                      <span>{badge.label}</span>
                    </span>

                    {res.fileSize && (
                      <span className="text-[10px] text-slate-400 font-mono font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-md">
                        {res.fileSize}
                      </span>
                    )}
                  </div>
                )}

                {/* Card Content Body */}
                <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-2">
                    {/* Tags: Subject & Grade Room */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="px-2.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 rounded-md text-[11px] font-bold">
                        {res.subject}
                      </span>
                      <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-md text-[11px] font-bold flex items-center gap-1">
                        <GraduationCap className="w-3 h-3 text-indigo-500" />
                        <span>{res.gradeLevel}</span>
                      </span>
                    </div>

                    <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white leading-snug group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                      {res.title}
                    </h3>

                    {res.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                        {res.description}
                      </p>
                    )}
                  </div>

                  {/* Teacher & Date Footer */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 truncate max-w-[180px]">
                      <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{res.teacherName}</span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] shrink-0 font-mono">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(res.createdDate).toLocaleDateString('th-TH')}</span>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="px-5 py-3 bg-slate-50/70 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (res.type === 'video' && ytEmbed) {
                        e.preventDefault();
                        setActiveVideoUrl({ url: ytEmbed, title: res.title });
                      }
                    }}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  >
                    {res.type === 'video' ? <Play className="w-3.5 h-3.5" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    <span>{res.type === 'video' ? 'รับชมวิดีโอ' : res.type === 'document' ? 'เปิดดู PDF' : 'เปิดดูสื่อ'}</span>
                  </a>

                  {/* Teacher Edit / Delete Tools */}
                  {role === 'teacher' && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onEditResource(res)}
                        className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl transition-colors cursor-pointer"
                        title="แก้ไขสื่อ"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingResourceConfirm(res)}
                        className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-xl transition-colors cursor-pointer"
                        title="ลบสื่อ"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingResourceConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-base font-bold font-prompt text-slate-900 dark:text-white">
                ยืนยันการลบสื่อการเรียนรู้?
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                คุณต้องการลบสื่อการเรียนรู้ <strong>"{deletingResourceConfirm.title}"</strong> ออกจากฐานข้อมูลหรือไม่? การดำเนินการนี้ไม่สามารถยกเลิกได้
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingResourceConfirm(null)}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  onDeleteResource(deletingResourceConfirm.id);
                  setDeletingResourceConfirm(null);
                }}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>ยืนยันลบสื่อ</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Video Player Embed Modal */}
      {activeVideoUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2 truncate pr-4">
                <Video className="w-5 h-5 text-rose-500 shrink-0" />
                <h3 className="text-sm font-bold font-prompt text-white truncate">
                  {activeVideoUrl.title}
                </h3>
              </div>
              <button
                onClick={() => setActiveVideoUrl(null)}
                className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-video bg-black">
              <iframe
                src={activeVideoUrl.url}
                title={activeVideoUrl.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full border-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
