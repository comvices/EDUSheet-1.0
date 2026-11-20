import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  FolderGit2,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Users,
  FileText,
  Layers,
} from 'lucide-react';
import { Assignment, StudentProfile, Submission } from '../types';
import { SaveConfirmModal } from './SaveConfirmModal';

export interface SplitWorksheetPlanItem {
  sourceAssignment: Assignment;
  actionType: 'split_whole_grade' | 'extract_from_all' | 'relocate_submissions';
  targetRooms: Array<{
    room: string;
    assignmentId: string;
    isNewAssignment: boolean;
    submissionCount: number;
  }>;
  movedSubmissionsCount: number;
}

export interface GradeSplitMigrationPlan {
  baseGrade: string;
  availableTargetRooms: string[];
  studentCountByRoom: Record<string, number>;
  items: SplitWorksheetPlanItem[];
  upsertAssignments: Assignment[];
  deleteAssignmentIds: string[];
  upsertSubmissions: Submission[];
}

const makeSafeAssignmentId = (baseId: string, roomIndex: number, batchTag: string): string => {
  const cleaned = baseId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 72) || 'asg';
  const safeTag = batchTag.replace(/[^a-zA-Z0-9_-]/g, '');
  return `${cleaned}_r${roomIndex}_${safeTag}`.slice(0, 120);
};

export function extractBaseGrade(gradeLevel: string): string | null {
  if (!gradeLevel || gradeLevel === 'ทั้งหมด') return null;
  const cleaned = gradeLevel.replace(/\s*\(ทุกห้อง\)$/, '').trim();
  if (!cleaned) return null;
  return cleaned.includes('/') ? cleaned.split('/')[0].trim() : cleaned;
}

export function buildGradeSplitMigrationPlan(params: {
  baseGrade: string;
  assignments: Assignment[];
  submissions: Submission[];
  studentsRoster: StudentProfile[];
  gradeLevelsList: string[];
  focusAssignmentId?: string;
}): GradeSplitMigrationPlan {
  const {
    baseGrade,
    assignments,
    submissions,
    studentsRoster,
    gradeLevelsList,
    focusAssignmentId,
  } = params;

  const targetRoomSet = new Set<string>();
  gradeLevelsList.forEach((g) => {
    if (g && g.startsWith(`${baseGrade}/`)) targetRoomSet.add(g);
  });
  studentsRoster.forEach((s) => {
    if (s.gradeLevel && s.gradeLevel.startsWith(`${baseGrade}/`)) targetRoomSet.add(s.gradeLevel);
  });
  submissions.forEach((sub) => {
    if (sub.gradeLevel && sub.gradeLevel.startsWith(`${baseGrade}/`)) {
      targetRoomSet.add(sub.gradeLevel);
    }
  });

  const availableTargetRooms = Array.from(targetRoomSet).sort((a, b) =>
    a.localeCompare(b, 'th', { numeric: true })
  );

  const studentByCode = new Map<string, StudentProfile>();
  const studentById = new Map<string, StudentProfile>();
  studentsRoster.forEach((s) => {
    if (s.code) studentByCode.set(s.code.toUpperCase().trim(), s);
    if (s.id) studentById.set(s.id, s);
  });

  const studentCountByRoom: Record<string, number> = {};
  availableTargetRooms.forEach((r) => {
    studentCountByRoom[r] = studentsRoster.filter((s) => s.gradeLevel === r).length;
  });

  const resolveStudentRoom = (sub: Submission): string => {
    const codeKey = sub.studentCode?.toUpperCase().trim();
    const rosterMatch =
      (codeKey ? studentByCode.get(codeKey) : undefined) ||
      (sub.studentId ? studentById.get(sub.studentId) : undefined);
    if (rosterMatch?.gradeLevel) return rosterMatch.gradeLevel;
    return sub.gradeLevel || '';
  };

  const scopeAssignments = focusAssignmentId
    ? assignments.filter((a) => a.id === focusAssignmentId)
    : assignments;

  const upsertAssignments: Assignment[] = [];
  const deleteAssignmentIds: string[] = [];
  const upsertSubmissions: Submission[] = [];
  const items: SplitWorksheetPlanItem[] = [];
  const batchTag = Date.now().toString(36);
  let cloneSeq = 0;

  // Lookup to match existing room-specific assignment with same title+subject when relocating misplaced submissions
  const existingByKey = new Map<string, Assignment>();
  assignments.forEach((a) => {
    existingByKey.set(`${a.title}__${a.subject}__${a.gradeLevel}`, a);
  });

  if (availableTargetRooms.length === 0) {
    return {
      baseGrade,
      availableTargetRooms,
      studentCountByRoom,
      items,
      upsertAssignments,
      deleteAssignmentIds,
      upsertSubmissions,
    };
  }

  for (const asg of scopeAssignments) {
    const asgSubs = submissions.filter((s) => s.assignmentId === asg.id);
    const isWholeBaseGrade =
      asg.gradeLevel === baseGrade || asg.gradeLevel === `${baseGrade} (ทุกห้อง)`;
    const isAllGrades = asg.gradeLevel === 'ทั้งหมด';
    const isRoomOfBaseGrade = asg.gradeLevel.startsWith(`${baseGrade}/`);

    if (isWholeBaseGrade) {
      // Determine which rooms should receive a split worksheet
      let roomsToCreate: string[] = [];
      if (asg.assignedStudentCodes && asg.assignedStudentCodes.length > 0) {
        const roomSet = new Set<string>();
        asg.assignedStudentCodes.forEach((code) => {
          const st = studentByCode.get(code.toUpperCase().trim());
          if (st?.gradeLevel && st.gradeLevel.startsWith(`${baseGrade}/`)) {
            roomSet.add(st.gradeLevel);
          }
        });
        asgSubs.forEach((sub) => {
          const r = resolveStudentRoom(sub);
          if (r.startsWith(`${baseGrade}/`)) roomSet.add(r);
        });
        roomsToCreate = Array.from(roomSet).sort((a, b) =>
          a.localeCompare(b, 'th', { numeric: true })
        );
      }
      if (roomsToCreate.length === 0) {
        roomsToCreate = [...availableTargetRooms];
      }

      const roomToAsgId = new Map<string, string>();
      const roomSubCounts = new Map<string, number>();

      roomsToCreate.forEach((room, idx) => {
        // Reuse original assignment ID for the first room so existing references stay intact
        const targetId =
          idx === 0 ? asg.id : makeSafeAssignmentId(asg.id, ++cloneSeq, batchTag);
        roomToAsgId.set(room, targetId);
        roomSubCounts.set(room, 0);

        const filteredCodes =
          asg.assignedStudentCodes && asg.assignedStudentCodes.length > 0
            ? asg.assignedStudentCodes.filter((code) => {
                const st = studentByCode.get(code.toUpperCase().trim());
                return st?.gradeLevel === room;
              })
            : [];

        const nextAsg: Assignment = {
          ...asg,
          id: targetId,
          gradeLevel: room,
          assignedStudentCodes: filteredCodes,
        };
        upsertAssignments.push(nextAsg);
        existingByKey.set(`${nextAsg.title}__${nextAsg.subject}__${room}`, nextAsg);
      });

      let movedCount = 0;
      asgSubs.forEach((sub) => {
        const resolvedRoom = resolveStudentRoom(sub);
        const fallbackRoom = roomsToCreate[0];
        const finalRoom = roomToAsgId.has(resolvedRoom) ? resolvedRoom : fallbackRoom;
        const targetAsgId = roomToAsgId.get(finalRoom);
        if (!targetAsgId) return;

        roomSubCounts.set(finalRoom, (roomSubCounts.get(finalRoom) || 0) + 1);
        if (sub.assignmentId !== targetAsgId || sub.gradeLevel !== finalRoom) {
          movedCount += 1;
          upsertSubmissions.push({
            ...sub,
            assignmentId: targetAsgId,
            gradeLevel: finalRoom,
          });
        }
      });

      items.push({
        sourceAssignment: asg,
        actionType: 'split_whole_grade',
        targetRooms: roomsToCreate.map((room) => ({
          room,
          assignmentId: roomToAsgId.get(room) || '',
          isNewAssignment: roomToAsgId.get(room) !== asg.id,
          submissionCount: roomSubCounts.get(room) || 0,
        })),
        movedSubmissionsCount: movedCount,
      });
    } else if (isAllGrades) {
      // Check if this 'ทั้งหมด' worksheet has students/submissions in baseGrade rooms
      const subsForBase = asgSubs.filter((sub) =>
        resolveStudentRoom(sub).startsWith(`${baseGrade}/`)
      );
      const targetedBaseRooms = new Set<string>();
      subsForBase.forEach((sub) => {
        const r = resolveStudentRoom(sub);
        if (r.startsWith(`${baseGrade}/`)) targetedBaseRooms.add(r);
      });
      if (asg.assignedStudentCodes && asg.assignedStudentCodes.length > 0) {
        asg.assignedStudentCodes.forEach((code) => {
          const st = studentByCode.get(code.toUpperCase().trim());
          if (st?.gradeLevel.startsWith(`${baseGrade}/`)) targetedBaseRooms.add(st.gradeLevel);
        });
      }

      if (subsForBase.length === 0 && targetedBaseRooms.size === 0) continue;

      const hasOtherGradeRooms = gradeLevelsList.some(
        (g) => g && g !== 'ทั้งหมด' && !g.startsWith(`${baseGrade}/`) && g !== baseGrade
      );
      const hasOtherSubs = asgSubs.some(
        (sub) => !resolveStudentRoom(sub).startsWith(`${baseGrade}/`)
      );
      const canConvertInPlace = !hasOtherGradeRooms && !hasOtherSubs;

      const roomsList =
        targetedBaseRooms.size > 0
          ? Array.from(targetedBaseRooms).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }))
          : [...availableTargetRooms];

      const roomToAsgId = new Map<string, string>();
      const roomSubCounts = new Map<string, number>();

      roomsList.forEach((room, idx) => {
        const targetId =
          canConvertInPlace && idx === 0
            ? asg.id
            : makeSafeAssignmentId(asg.id, ++cloneSeq, batchTag);
        roomToAsgId.set(room, targetId);
        roomSubCounts.set(room, 0);

        const filteredCodes =
          asg.assignedStudentCodes && asg.assignedStudentCodes.length > 0
            ? asg.assignedStudentCodes.filter((code) => {
                const st = studentByCode.get(code.toUpperCase().trim());
                return st?.gradeLevel === room;
              })
            : [];

        const nextAsg: Assignment = {
          ...asg,
          id: targetId,
          gradeLevel: room,
          assignedStudentCodes: filteredCodes,
        };
        upsertAssignments.push(nextAsg);
        existingByKey.set(`${nextAsg.title}__${nextAsg.subject}__${room}`, nextAsg);
      });

      let movedCount = 0;
      subsForBase.forEach((sub) => {
        const resolvedRoom = resolveStudentRoom(sub);
        const targetAsgId = roomToAsgId.get(resolvedRoom);
        if (!targetAsgId) return;
        roomSubCounts.set(resolvedRoom, (roomSubCounts.get(resolvedRoom) || 0) + 1);
        if (sub.assignmentId !== targetAsgId || sub.gradeLevel !== resolvedRoom) {
          movedCount += 1;
          upsertSubmissions.push({
            ...sub,
            assignmentId: targetAsgId,
            gradeLevel: resolvedRoom,
          });
        }
      });

      items.push({
        sourceAssignment: asg,
        actionType: 'extract_from_all',
        targetRooms: roomsList.map((room) => ({
          room,
          assignmentId: roomToAsgId.get(room) || '',
          isNewAssignment: roomToAsgId.get(room) !== asg.id,
          submissionCount: roomSubCounts.get(room) || 0,
        })),
        movedSubmissionsCount: movedCount,
      });
    } else if (isRoomOfBaseGrade) {
      // Check for cross-room submissions (e.g., student belongs to ม.6/2 but submission is attached to ม.6/1 worksheet)
      const subsNeedingRelocation = asgSubs.filter((sub) => {
        const resolvedRoom = resolveStudentRoom(sub);
        return resolvedRoom.startsWith(`${baseGrade}/`) && (resolvedRoom !== asg.gradeLevel || sub.gradeLevel !== resolvedRoom);
      });

      if (subsNeedingRelocation.length === 0) continue;

      const roomToAsgId = new Map<string, string>();
      const roomSubCounts = new Map<string, number>();
      let movedCount = 0;

      subsNeedingRelocation.forEach((sub) => {
        const resolvedRoom = resolveStudentRoom(sub);
        if (resolvedRoom === asg.gradeLevel) {
          // Only gradeLevel string on submission needed syncing
          movedCount += 1;
          upsertSubmissions.push({
            ...sub,
            gradeLevel: resolvedRoom,
          });
          return;
        }

        let targetAsgId = roomToAsgId.get(resolvedRoom);
        if (!targetAsgId) {
          const existingTarget = existingByKey.get(
            `${asg.title}__${asg.subject}__${resolvedRoom}`
          );
          if (existingTarget) {
            targetAsgId = existingTarget.id;
          } else {
            targetAsgId = makeSafeAssignmentId(asg.id, ++cloneSeq, batchTag);
            const newRoomAsg: Assignment = {
              ...asg,
              id: targetAsgId,
              gradeLevel: resolvedRoom,
              assignedStudentCodes: [],
            };
            upsertAssignments.push(newRoomAsg);
            existingByKey.set(`${asg.title}__${asg.subject}__${resolvedRoom}`, newRoomAsg);
          }
          roomToAsgId.set(resolvedRoom, targetAsgId);
        }

        roomSubCounts.set(resolvedRoom, (roomSubCounts.get(resolvedRoom) || 0) + 1);
        movedCount += 1;
        upsertSubmissions.push({
          ...sub,
          assignmentId: targetAsgId,
          gradeLevel: resolvedRoom,
        });
      });

      if (movedCount > 0) {
        items.push({
          sourceAssignment: asg,
          actionType: 'relocate_submissions',
          targetRooms: Array.from(roomToAsgId.entries()).map(([room, id]) => ({
            room,
            assignmentId: id,
            isNewAssignment: !assignments.some((a) => a.id === id),
            submissionCount: roomSubCounts.get(room) || 0,
          })),
          movedSubmissionsCount: movedCount,
        });
      }
    }
  }

  return {
    baseGrade,
    availableTargetRooms,
    studentCountByRoom,
    items,
    upsertAssignments,
    deleteAssignmentIds,
    upsertSubmissions,
  };
}

interface SplitWorksheetsModalProps {
  isOpen: boolean;
  initialBaseGrade?: string;
  focusAssignmentId?: string;
  assignments: Assignment[];
  submissions: Submission[];
  studentsRoster: StudentProfile[];
  gradeLevelsList: string[];
  onClose: () => void;
  onExecuteMigration: (plan: GradeSplitMigrationPlan) => Promise<void> | void;
}

export const SplitWorksheetsModal: React.FC<SplitWorksheetsModalProps> = ({
  isOpen,
  initialBaseGrade,
  focusAssignmentId,
  assignments,
  submissions,
  studentsRoster,
  gradeLevelsList,
  onClose,
  onExecuteMigration,
}) => {
  // Discover candidate base grades from user's gradeLevels, students, and assignments
  const candidateBaseGrades = useMemo(() => {
    const set = new Set<string>();
    gradeLevelsList.forEach((g) => {
      const base = extractBaseGrade(g);
      if (base) set.add(base);
    });
    studentsRoster.forEach((s) => {
      const base = extractBaseGrade(s.gradeLevel);
      if (base) set.add(base);
    });
    assignments.forEach((a) => {
      const base = extractBaseGrade(a.gradeLevel);
      if (base) set.add(base);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'th', { numeric: true }));
  }, [gradeLevelsList, studentsRoster, assignments]);

  const [selectedBaseGrade, setSelectedBaseGrade] = useState<string>(() => {
    if (initialBaseGrade) {
      const base = extractBaseGrade(initialBaseGrade);
      if (base) return base;
    }
    if (candidateBaseGrades.includes('ม.6')) return 'ม.6';
    return candidateBaseGrades[0] || 'ม.6';
  });

  useEffect(() => {
    if (!isOpen) return;
    if (initialBaseGrade) {
      const base = extractBaseGrade(initialBaseGrade);
      if (base) {
        setSelectedBaseGrade(base);
        return;
      }
    }
    if (candidateBaseGrades.includes('ม.6')) {
      setSelectedBaseGrade('ม.6');
    } else if (candidateBaseGrades.length > 0 && !candidateBaseGrades.includes(selectedBaseGrade)) {
      setSelectedBaseGrade(candidateBaseGrades[0]);
    }
  }, [isOpen, initialBaseGrade, candidateBaseGrades]);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const plan = useMemo(
    () =>
      buildGradeSplitMigrationPlan({
        baseGrade: selectedBaseGrade,
        assignments,
        submissions,
        studentsRoster,
        gradeLevelsList,
        focusAssignmentId,
      }),
    [selectedBaseGrade, assignments, submissions, studentsRoster, gradeLevelsList, focusAssignmentId]
  );

  if (!isOpen) return null;

  const newSheetsCount = plan.items.reduce(
    (sum, item) => sum + item.targetRooms.filter((r) => r.isNewAssignment).length,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white dark:bg-[#111c18] border border-slate-200 dark:border-emerald-950/60 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950/60 flex items-center justify-between bg-slate-50/90 dark:bg-[#0d1613]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-700 to-teal-700 text-white flex items-center justify-center shrink-0">
              <FolderGit2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold font-prompt text-slate-900 dark:text-white">
                โยกใบงานแยกตามห้องของนักเรียน
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                แยกใบงานที่รวมระดับชั้น (หรือส่งข้ามห้อง) ไปเก็บเป็นใบงานแยกตามห้องที่กำหนดไว้ พร้อมย้ายงานที่นักเรียนส่งแล้วตามไปด้วย
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* Base Grade Selector */}
          {!focusAssignmentId && candidateBaseGrades.length > 0 && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 font-prompt">
                เลือกระดับชั้นที่ต้องการโยก/แยกตามห้อง:
              </label>
              <div className="flex flex-wrap gap-1.5">
                {candidateBaseGrades.map((grade) => {
                  const isActive = selectedBaseGrade === grade;
                  return (
                    <button
                      key={grade}
                      type="button"
                      onClick={() => setSelectedBaseGrade(grade)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-emerald-950/60 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      ระดับชั้น {grade}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Discovered Target Rooms for Selected Grade */}
          <div className="bg-slate-50 dark:bg-[#0d1613]/70 border border-slate-200 dark:border-emerald-950/60 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
              <span className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>ห้องเรียนระดับชั้น {selectedBaseGrade} ที่กำหนดไว้:</span>
              </span>
              <span className="font-mono text-emerald-700 dark:text-emerald-400 tabular-nums">
                {plan.availableTargetRooms.length} ห้อง
              </span>
            </div>

            {plan.availableTargetRooms.length === 0 ? (
              <div className="text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2 pt-1">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  ยังไม่พบห้องย่อยของชั้น {selectedBaseGrade} (เช่น {selectedBaseGrade}/1, {selectedBaseGrade}/2) ในรายการห้องเรียนหรือรายชื่อนักเรียน กรุณาเพิ่มห้องเรียนหรือนำเข้าข้อมูลนักเรียนก่อน
                </span>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                {plan.availableTargetRooms.map((room) => (
                  <div
                    key={room}
                    className="px-3 py-1.5 bg-white dark:bg-[#111c18] border border-slate-200 dark:border-emerald-950/60 rounded-xl text-xs flex items-center gap-2 tabular-nums"
                  >
                    <span className="font-bold text-slate-800 dark:text-slate-100">{room}</span>
                    <span className="text-slate-500 dark:text-slate-400">
                      ({plan.studentCountByRoom[room] || 0} คน)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Migration Preview List */}
          {plan.availableTargetRooms.length > 0 && plan.items.length === 0 ? (
            <div className="text-center py-8 px-4 bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/60 rounded-2xl space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-100">
                ใบงานระดับชั้น {selectedBaseGrade} ถูกแยกเก็บตามห้องของนักเรียนครบถ้วนแล้ว
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                ไม่พบใบงานที่ยังรวมทุกห้อง หรือรายการส่งงานที่ต้องโยกย้ายเพิ่มเติม
              </p>
            </div>
          ) : (
            plan.items.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>รายการใบงานที่จะโยก/แยกตามห้อง ({plan.items.length} เรื่อง):</span>
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-normal tabular-nums">
                    ย้ายการส่งงาน {plan.upsertSubmissions.length} รายการ
                  </span>
                </div>

                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {plan.items.map((item) => (
                    <div
                      key={item.sourceAssignment.id}
                      className="p-3.5 bg-white dark:bg-[#111c18] border border-slate-200 dark:border-emerald-950/60 rounded-xl space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
                            <FileText className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            <span className="truncate">{item.sourceAssignment.title}</span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            วิชา {item.sourceAssignment.subject} · เดิมอยู่ใน: <strong>{item.sourceAssignment.gradeLevel}</strong>
                          </p>
                        </div>
                        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 shrink-0 tabular-nums">
                          ย้ายส่งงาน {item.movedSubmissionsCount} คน
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-emerald-950/50 text-[11px]">
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="text-slate-500 dark:text-slate-400">แยกเก็บลง:</span>
                        {item.targetRooms.map((tr) => (
                          <span
                            key={tr.room}
                            className="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold tabular-nums"
                          >
                            {tr.room} ({tr.submissionCount} ส่งงาน)
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-emerald-950/60 bg-slate-50/90 dark:bg-[#0d1613] flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-emerald-950/60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
          >
            ปิด
          </button>
          {plan.items.length > 0 && (
            <button
              type="button"
              onClick={() => setIsConfirmOpen(true)}
              className="px-5 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white rounded-xl text-xs font-bold shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <FolderGit2 className="w-4 h-4" />
              <span>
                โยกใบงานชั้น {selectedBaseGrade} แยกตามห้อง ({plan.items.length} เรื่อง)
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Pre-Save Confirmation Modal */}
      <SaveConfirmModal
        isOpen={isConfirmOpen}
        title={`ยืนยันการโยกใบงานชั้น ${selectedBaseGrade} แยกตามห้อง?`}
        description="ระบบจะอัปเดตและสร้างใบงานแยกตามห้องเรียนที่กำหนด พร้อมย้ายรายการส่งงานและคะแนนของนักเรียนให้ตรงกับห้องของตนเอง"
        details={[
          { label: 'ระดับชั้น', value: selectedBaseGrade },
          { label: 'ห้องเรียนปลายทาง', value: plan.availableTargetRooms.join(', ') },
          { label: 'ใบงานที่ดำเนินการ', value: `${plan.items.length} เรื่อง (เพิ่มใบงานย่อย ${newSheetsCount} ชุด)` },
          { label: 'รายการส่งงานที่จะจัดเข้าห้อง', value: `${plan.upsertSubmissions.length} รายการ` },
        ]}
        confirmLabel="ยืนยันโยกใบงาน"
        variant="emerald"
        onConfirm={async () => {
          setIsConfirmOpen(false);
          await onExecuteMigration(plan);
          onClose();
        }}
        onCancel={() => setIsConfirmOpen(false)}
      />
    </div>
  );
};
