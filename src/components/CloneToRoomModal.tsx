import React, { useMemo, useState } from 'react';
import {
  X,
  Copy,
  GraduationCap,
  Calendar,
  Check,
  AlertCircle,
  BookOpen,
  FileText,
  Layers,
  Users,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Assignment, SubjectClassroom } from '../types';
import { extractBaseGrade } from './SplitWorksheetsModal';

interface CloneAssignmentToRoomModalProps {
  mode: 'assignment';
  sourceAssignment: Assignment;
  existingAssignments: Assignment[];
  gradeLevelsList: string[];
  onClose: () => void;
  onConfirmCloneAssignments: (clonedAssignments: Assignment[]) => void;
}

interface CloneClassroomToRoomModalProps {
  mode: 'classroom';
  sourceClassroom: SubjectClassroom;
  existingClassrooms: SubjectClassroom[];
  existingAssignments: Assignment[];
  gradeLevelsList: string[];
  onClose: () => void;
  onConfirmCloneClassrooms: (clonedClassrooms: SubjectClassroom[]) => void;
}

export type CloneToRoomModalProps =
  | CloneAssignmentToRoomModalProps
  | CloneClassroomToRoomModalProps;

function toLocalDateTimeInput(isoOrDate: string): string {
  const d = new Date(isoOrDate);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return toLocalDateTimeInput(fallback.toISOString());
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function classroomRoomMatchesTarget(asgGrade: string, targetRoom: string): boolean {
  const cleanAsg = (asgGrade || '').trim();
  const cleanTarget = (targetRoom || '').trim();
  if (!cleanAsg || !cleanTarget) return false;
  if (cleanAsg === 'ทั้งหมด' || cleanTarget === 'ทั้งหมด') return true;
  if (cleanAsg === cleanTarget) return true;
  const baseAsg = extractBaseGrade(cleanAsg);
  const baseTarget = extractBaseGrade(cleanTarget);
  if (!cleanAsg.includes('/') && baseAsg && baseAsg === baseTarget) return true;
  if (cleanAsg === `${baseTarget} (ทุกห้อง)`) return true;
  return false;
}

export const CloneToRoomModal: React.FC<CloneToRoomModalProps> = (props) => {
  const sourceGrade =
    props.mode === 'assignment'
      ? props.sourceAssignment.gradeLevel
      : props.sourceClassroom.gradeLevel;
  const sourceBaseGrade = extractBaseGrade(sourceGrade);

  const availableRooms = useMemo(() => {
    const filtered = props.gradeLevelsList
      .filter((g) => g && g !== 'ทั้งหมด' && g !== sourceGrade)
      .filter((g, idx, arr) => arr.indexOf(g) === idx);

    return filtered.sort((a, b) => {
      const aSameBase = sourceBaseGrade && extractBaseGrade(a) === sourceBaseGrade ? 0 : 1;
      const bSameBase = sourceBaseGrade && extractBaseGrade(b) === sourceBaseGrade ? 0 : 1;
      if (aSameBase !== bSameBase) return aSameBase - bSameBase;
      return a.localeCompare(b, 'th', { numeric: true });
    });
  }, [props.gradeLevelsList, sourceGrade, sourceBaseGrade]);

  const existingTargetRoomsSet = useMemo(() => {
    const set = new Set<string>();
    if (props.mode === 'assignment') {
      const targetTitle = props.sourceAssignment.title.trim();
      const targetSubj = props.sourceAssignment.subject.trim();
      props.existingAssignments.forEach((a) => {
        if (a.title.trim() === targetTitle && a.subject.trim() === targetSubj) {
          set.add(a.gradeLevel.trim());
        }
      });
    } else {
      const targetSubj = props.sourceClassroom.subject.trim();
      const targetTitle = props.sourceClassroom.title.trim();
      props.existingClassrooms.forEach((c) => {
        if (
          !c.id.startsWith('auto_cls_') &&
          c.subject.trim() === targetSubj &&
          c.title.trim() === targetTitle
        ) {
          set.add(c.gradeLevel.trim());
        }
      });
    }
    return set;
  }, [props]);

  const defaultSelectedRooms = useMemo(() => {
    if (!sourceBaseGrade) return [];
    const sameBaseNotExisting = availableRooms.filter(
      (r) => extractBaseGrade(r) === sourceBaseGrade && !existingTargetRoomsSet.has(r)
    );
    return sameBaseNotExisting.length > 0 ? [sameBaseNotExisting[0]] : [];
  }, [availableRooms, sourceBaseGrade, existingTargetRoomsSet]);

  const [selectedRooms, setSelectedRooms] = useState<string[]>(defaultSelectedRooms);
  const [dueDateInput, setDueDateInput] = useState<string>(() =>
    props.mode === 'assignment' ? toLocalDateTimeInput(props.sourceAssignment.dueDate) : ''
  );
  const [isPublished, setIsPublished] = useState<boolean>(() =>
    props.mode === 'assignment'
      ? props.sourceAssignment.isPublished !== false
      : props.sourceClassroom.isPublished !== false
  );
  const [courseCodeInput, setCourseCodeInput] = useState<string>(() =>
    props.mode === 'classroom' ? props.sourceClassroom.courseCode : ''
  );
  const [classroomTitleInput, setClassroomTitleInput] = useState<string>(() =>
    props.mode === 'classroom' ? props.sourceClassroom.title : ''
  );
  const [errorMsg, setErrorMsg] = useState<string>('');

  const toggleRoom = (room: string) => {
    setErrorMsg('');
    setSelectedRooms((prev) =>
      prev.includes(room) ? prev.filter((r) => r !== room) : [...prev, room]
    );
  };

  const handleConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedRooms.length === 0) {
      setErrorMsg('กรุณาเลือกอย่างน้อย 1 ห้องเรียนปลายทาง');
      return;
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();

    if (props.mode === 'assignment') {
      const src = props.sourceAssignment;
      const resolvedDueIso = dueDateInput
        ? new Date(dueDateInput).toISOString()
        : src.dueDate;

      const clones: Assignment[] = selectedRooms.map((room, idx) => {
        const rand = Math.random().toString(36).slice(2, 6);
        const clonedSections = src.sections
          ? src.sections.map((s) => ({ ...s }))
          : undefined;
        const clonedQuestions = src.questions.map((q) => ({
          ...q,
          ...(q.options ? { options: [...q.options] } : {}),
        }));

        return {
          ...src,
          id: `asg_${now}_${idx}_${rand}`,
          gradeLevel: room,
          dueDate: resolvedDueIso,
          createdDate: nowIso,
          isPublished,
          assignedStudentCodes: undefined,
          sections: clonedSections,
          questions: clonedQuestions,
          ...(src.workMode === 'group'
            ? {
                groups: [],
                groupSettings: src.groupSettings
                  ? { ...src.groupSettings }
                  : { maxGroupSize: 4, allowStudentCreateGroup: true },
              }
            : {}),
        };
      });

      props.onConfirmCloneAssignments(clones);
      props.onClose();
      return;
    }

    const srcCls = props.sourceClassroom;
    const cleanCourseCode = courseCodeInput.trim() || srcCls.courseCode;
    const cleanTitle = classroomTitleInput.trim() || srcCls.title;
    const asgById = new Map(props.existingAssignments.map((a) => [a.id, a]));

    const clonedClassrooms: SubjectClassroom[] = selectedRooms.map((room, idx) => {
      const rand = Math.random().toString(36).slice(2, 6);
      const clonedUnits = (srcCls.units || []).map((u, uIdx) => {
        const remappedAssignmentIds: string[] = [];
        for (const linkedId of u.linkedAssignmentIds || []) {
          const origAsg = asgById.get(linkedId);
          if (!origAsg) continue;
          if (classroomRoomMatchesTarget(origAsg.gradeLevel, room)) {
            remappedAssignmentIds.push(origAsg.id);
            continue;
          }
          // Try finding an equivalent worksheet with the same title & subject in the target room
          const targetMatch = props.existingAssignments.find(
            (cand) =>
              cand.subject.trim() === origAsg.subject.trim() &&
              cand.title.trim() === origAsg.title.trim() &&
              classroomRoomMatchesTarget(cand.gradeLevel, room)
          );
          if (targetMatch && !remappedAssignmentIds.includes(targetMatch.id)) {
            remappedAssignmentIds.push(targetMatch.id);
          }
        }

        return {
          ...u,
          id: `unit_${now}_${idx}_${uIdx}_${rand}`,
          linkedAssignmentIds: remappedAssignmentIds,
          linkedResourceIds: [...(u.linkedResourceIds || [])],
        };
      });

      return {
        ...srcCls,
        id: `cls_${now}_${idx}_${rand}`,
        courseCode: cleanCourseCode,
        title: cleanTitle,
        gradeLevel: room,
        isPublished,
        units: clonedUnits,
        createdDate: nowIso,
        updatedAt: nowIso,
      };
    });

    props.onConfirmCloneClassrooms(clonedClassrooms);
    props.onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-emerald-200/80 dark:border-emerald-950/80 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-emerald-950/60 flex items-center justify-between gap-3 theme-soft-surface dark:bg-emerald-950/30">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 rounded-xl">
              <Copy className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold font-prompt text-slate-900 dark:text-white">
                {props.mode === 'assignment'
                  ? 'คัดลอกใบงานไปห้องเรียนอื่น'
                  : 'คัดลอกห้องเรียนรายวิชาไปห้องอื่น'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                สร้างชุดใหม่แยกตามห้องใน 1 คลิก ไม่ปะปนงานส่งและคะแนนของห้องเดิม
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            aria-label="ปิดหน้าต่าง"
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-white/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-5 space-y-4">
          {/* Source Summary */}
          <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-emerald-950/60 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                {props.mode === 'assignment' ? (
                  <FileText className="w-3.5 h-3.5" />
                ) : (
                  <BookOpen className="w-3.5 h-3.5" />
                )}
                ต้นฉบับจากห้อง: {sourceGrade}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {props.mode === 'assignment'
                  ? props.sourceAssignment.subject
                  : props.sourceClassroom.subject}
              </span>
            </div>
            <p className="text-xs sm:text-sm font-bold font-prompt text-slate-900 dark:text-white">
              {props.mode === 'assignment'
                ? props.sourceAssignment.title
                : `${props.sourceClassroom.courseCode} ${props.sourceClassroom.title}`}
            </p>
            {props.mode === 'assignment' ? (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span>{props.sourceAssignment.questions.length} ข้อ</span>
                <span aria-hidden="true">·</span>
                <span>{props.sourceAssignment.totalPoints} คะแนน</span>
                {props.sourceAssignment.workMode === 'group' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 text-teal-700 dark:text-teal-300 font-semibold">
                      <Users className="w-3 h-3" />
                      งานกลุ่ม (รีเซ็ตกลุ่มใหม่สำหรับห้องปลายทาง)
                    </span>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <Layers className="w-3 h-3" />
                  {props.sourceClassroom.units?.length || 0} หน่วยการเรียนรู้
                </span>
                <span aria-hidden="true">·</span>
                <span>เชื่อมใบงานที่ตรงกับห้องปลายทางให้อัตโนมัติ</span>
              </div>
            )}
          </div>

          {/* Target Room Selection */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>เลือกห้องเรียนปลายทาง (เลือกได้มากกว่า 1 ห้อง)</span>
              </label>
              {selectedRooms.length > 0 && (
                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  เลือกแล้ว {selectedRooms.length} ห้อง
                </span>
              )}
            </div>

            {availableRooms.length === 0 ? (
              <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-200">
                ไม่พบห้องเรียนอื่นในระบบ กรุณาเพิ่มชั้นเรียนในเมนูตั้งค่าก่อนครับ
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {availableRooms.map((room) => {
                  const isSelected = selectedRooms.includes(room);
                  const isSameBase = sourceBaseGrade && extractBaseGrade(room) === sourceBaseGrade;
                  const alreadyExists = existingTargetRoomsSet.has(room);

                  return (
                    <button
                      key={room}
                      type="button"
                      onClick={() => toggleRoom(room)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                        isSelected
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-white dark:bg-slate-800/70 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-bold">{room}</span>
                        <span
                          className={`w-4 h-4 rounded-md flex items-center justify-center border ${
                            isSelected
                              ? 'bg-white/20 border-white/40 text-white'
                              : 'border-slate-300 dark:border-slate-600'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </span>
                      </div>
                      {alreadyExists ? (
                        <span
                          className={`text-[10px] ${
                            isSelected ? 'text-amber-200' : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          มีชื่อซ้ำในห้องนี้แล้ว
                        </span>
                      ) : isSameBase ? (
                        <span
                          className={`text-[10px] ${
                            isSelected
                              ? 'text-emerald-100'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          ระดับชั้นเดียวกัน
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mode-specific Options */}
          {props.mode === 'assignment' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>กำหนดส่งของห้องใหม่</span>
                </label>
                <input
                  type="datetime-local"
                  value={dueDateInput}
                  onChange={(e) => setDueDateInput(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  สถานะการเผยแพร่
                </label>
                <button
                  type="button"
                  onClick={() => setIsPublished((v) => !v)}
                  className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                    isPublished
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                      : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                  }`}
                >
                  <span className="inline-flex items-center gap-1.5">
                    {isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{isPublished ? 'เผยแพร่ให้นักเรียนเห็นทันที' : 'บันทึกเป็นฉบับร่างก่อน'}</span>
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    รหัสวิชา
                  </label>
                  <input
                    type="text"
                    maxLength={40}
                    value={courseCodeInput}
                    onChange={(e) => setCourseCodeInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ชื่อห้องเรียนรายวิชา
                  </label>
                  <input
                    type="text"
                    maxLength={300}
                    value={classroomTitleInput}
                    onChange={(e) => setClassroomTitleInput(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsPublished((v) => !v)}
                className={`w-full px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between cursor-pointer transition-colors ${
                  isPublished
                    ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                    : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300'
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {isPublished ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  <span>
                    {isPublished
                      ? 'เปิดให้นักเรียนในห้องใหม่เข้าเรียนได้ทันที'
                      : 'บันทึกเป็นฉบับร่าง (ซ่อนจากนักเรียนก่อน)'}
                  </span>
                </span>
              </button>
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="pt-2 border-t border-slate-100 dark:border-emerald-950/60 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={props.onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={selectedRooms.length === 0}
              className="theme-btn-sheen px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold shadow-sm transition-all inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>
                {selectedRooms.length > 1
                  ? `คัดลอกไป ${selectedRooms.length} ห้อง`
                  : selectedRooms.length === 1
                  ? `คัดลอกไปห้อง ${selectedRooms[0]}`
                  : 'ยืนยันการคัดลอก'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
