import React, { useState, useEffect, useMemo } from 'react';
import { X, Sparkles, Plus, Minus, Trash2, Save, FilePlus, Edit3, Users, EyeOff, Eye, Search, Upload, Layers, Shuffle, Crown, UserPlus } from 'lucide-react';
import { Assignment, Question, CategoryType, StudentProfile, WorksheetSection, WorksheetWorkMode, WorksheetGroup } from '../types';
import { CATEGORY_LIST } from '../data/mockData';
import { SaveConfirmModal } from './SaveConfirmModal';
import { getAuthHeaders } from '../utils/security';
import { buildAutoWorksheetGroups, getEligibleStudentsForWorksheet, normalizeCode } from '../utils/groupHelpers';

interface CreateWorksheetModalProps {
  onClose: () => void;
  onCreateAssignment: (newAssignment: Assignment) => void;
  onUpdateAssignment?: (updatedAssignment: Assignment) => void;
  editingAssignment?: Assignment | null;
  gradeLevelsList?: string[];
  subjectsList?: string[];
  currentTeacherName?: string;
  studentsList?: StudentProfile[];
  initialSubject?: string;
  initialGradeLevel?: string;
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
  initialSubject,
  initialGradeLevel,
}) => {
  const isEditMode = Boolean(editingAssignment);
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');

  const activeSubjects = subjectsList.filter((s) => s !== 'ทั้งหมด');
  const activeGrades = gradeLevelsList.filter((g) => g !== 'ทั้งหมด');

  const resolvedDefaultSubject =
    initialSubject && initialSubject !== 'ทั้งหมด' ? initialSubject : activeSubjects[0] || '';
  const resolvedDefaultGrade =
    initialGradeLevel === 'ทั้งหมด'
      ? 'ทั้งหมด'
      : initialGradeLevel || activeGrades[0] || '';

  // Form State
  const [title, setTitle] = useState(editingAssignment?.title || '');
  const [subject, setSubject] = useState(editingAssignment?.subject || resolvedDefaultSubject);
  const [gradeLevel, setGradeLevel] = useState(editingAssignment?.gradeLevel || resolvedDefaultGrade);

  const subjectOptions = useMemo(() => {
    const list = [...activeSubjects];
    if (subject && subject !== 'ทั้งหมด' && !list.includes(subject)) {
      list.unshift(subject);
    }
    return list;
  }, [activeSubjects, subject]);

  const gradeOptions = useMemo(() => {
    const list = [...activeGrades];
    if (gradeLevel && !list.includes(gradeLevel)) {
      list.unshift(gradeLevel);
    }
    return list;
  }, [activeGrades, gradeLevel]);
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
  const [workMode, setWorkMode] = useState<WorksheetWorkMode>(
    editingAssignment?.workMode || 'individual'
  );
  const [maxGroupSize, setMaxGroupSize] = useState<number>(
    editingAssignment?.groupSettings?.maxGroupSize || 4
  );
  const [allowStudentCreateGroup, setAllowStudentCreateGroup] = useState<boolean>(
    editingAssignment?.groupSettings?.allowStudentCreateGroup !== false
  );
  const [groups, setGroups] = useState<WorksheetGroup[]>(() =>
    editingAssignment?.groups
      ? editingAssignment.groups.map((g) => ({
          ...g,
          memberCodes: [...(g.memberCodes || [])],
        }))
      : []
  );
  const [validationError, setValidationError] = useState('');
  const [pendingAssignment, setPendingAssignment] = useState<Assignment | null>(null);

  const eligibleStudentsForGroups = useMemo(
    () =>
      getEligibleStudentsForWorksheet(
        studentsList,
        gradeLevel,
        assignScope === 'specific' ? assignedStudentCodes : undefined
      ).sort((a, b) => a.code.localeCompare(b.code, 'th', { numeric: true })),
    [studentsList, gradeLevel, assignScope, assignedStudentCodes]
  );

  const handleAddEmptyGroup = () => {
    if (groups.length >= 50) return;
    const nextIdx = groups.length + 1;
    setGroups((prev) => [
      ...prev,
      {
        id: `grp_${Date.now()}_${nextIdx}`,
        name: `กลุ่มที่ ${nextIdx}`,
        memberCodes: [],
      },
    ]);
  };

  const handleAutoCreateGroups = (shuffle: boolean) => {
    if (eligibleStudentsForGroups.length === 0) {
      setValidationError('ไม่พบรายชื่อนักเรียนในชั้น/ขอบเขตที่เลือกสำหรับจัดกลุ่มอัตโนมัติ');
      return;
    }
    setValidationError('');
    const nextGroups = buildAutoWorksheetGroups(
      eligibleStudentsForGroups,
      maxGroupSize,
      shuffle
    );
    setGroups(nextGroups);
  };

  const handleToggleMemberInGroup = (groupId: string, studentCode: string) => {
    const norm = normalizeCode(studentCode);
    setGroups((prev) =>
      prev.map((g) => {
        const hasMember = g.memberCodes.some((c) => normalizeCode(c) === norm);
        if (g.id === groupId) {
          if (hasMember) {
            const nextMembers = g.memberCodes.filter((c) => normalizeCode(c) !== norm);
            const nextLeader =
              g.leaderCode && normalizeCode(g.leaderCode) === norm
                ? nextMembers[0]
                : g.leaderCode;
            return { ...g, memberCodes: nextMembers, leaderCode: nextLeader };
          }
          if (g.memberCodes.length >= maxGroupSize) return g;
          const nextMembers = [...g.memberCodes, studentCode];
          return {
            ...g,
            memberCodes: nextMembers,
            leaderCode: g.leaderCode || studentCode,
          };
        }
        // Remove from any other group to guarantee 1 student = 1 group
        if (hasMember) {
          const nextMembers = g.memberCodes.filter((c) => normalizeCode(c) !== norm);
          const nextLeader =
            g.leaderCode && normalizeCode(g.leaderCode) === norm
              ? nextMembers[0]
              : g.leaderCode;
          return { ...g, memberCodes: nextMembers, leaderCode: nextLeader };
        }
        return g;
      })
    );
  };

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

  const [sections, setSections] = useState<WorksheetSection[]>(() => {
    if (editingAssignment?.sections && editingAssignment.sections.length > 0) {
      return editingAssignment.sections.map((s) => ({
        id: s.id,
        title: s.title,
        instructions: s.instructions || '',
      }));
    }
    return [{ id: 'sec_1', title: 'ตอนที่ 1', instructions: '' }];
  });

  const [questions, setQuestions] = useState<Question[]>(() => {
    const firstSecId =
      editingAssignment?.sections && editingAssignment.sections.length > 0
        ? editingAssignment.sections[0].id
        : 'sec_1';
    const validSecIds = new Set(
      editingAssignment?.sections && editingAssignment.sections.length > 0
        ? editingAssignment.sections.map((s) => s.id)
        : ['sec_1']
    );
    if (editingAssignment?.questions && editingAssignment.questions.length > 0) {
      return editingAssignment.questions.map((q) => ({
        ...q,
        sectionId: q.sectionId && validSecIds.has(q.sectionId) ? q.sectionId : firstSecId,
      }));
    }
    return [
      {
        id: 'q_1',
        sectionId: firstSecId,
        text: 'ข้อความคำถามข้อที่ 1',
        type: 'text',
        maxPoints: 5,
        answerKey: 'เฉลยและเกณฑ์การให้คะแนน',
      },
    ];
  });

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
  const [aiSectionsPlan, setAiSectionsPlan] = useState<
    Array<{
      id: string;
      title: string;
      instructions: string;
      questionType: 'mixed' | 'text' | 'multiple_choice' | 'fill_blank';
      questionCount: number;
    }>
  >([
    {
      id: 'sec_1',
      title: 'ตอนที่ 1',
      instructions: '',
      questionType: 'mixed',
      questionCount: 3,
    },
  ]);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);

  const createUniqueQuestionId = () =>
    `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const totalWorksheetPoints = useMemo(
    () => questions.reduce((sum, q) => sum + (Number(q.maxPoints) || 0), 0),
    [questions]
  );

  const handleAddSection = () => {
    if (sections.length >= 15) return;
    const nextSecIndex = sections.length + 1;
    const newSecId = `sec_${Date.now()}_${nextSecIndex}`;
    setSections((prev) => [
      ...prev,
      { id: newSecId, title: `ตอนที่ ${nextSecIndex}`, instructions: '' },
    ]);
    if (questions.length < 100) {
      setQuestions((prev) => [
        ...prev,
        {
          id: createUniqueQuestionId(),
          sectionId: newSecId,
          text: '',
          type: 'text',
          maxPoints: 5,
          answerKey: '',
        },
      ]);
    }
  };

  const handleRemoveSection = (secId: string) => {
    if (sections.length <= 1) return;
    const remainingSections = sections.filter((s) => s.id !== secId);
    setSections(remainingSections);
    setQuestions((prev) => {
      const next = prev.filter((q) => q.sectionId !== secId);
      if (next.length > 0) return next;
      return [
        {
          id: createUniqueQuestionId(),
          sectionId: remainingSections[0].id,
          text: '',
          type: 'text',
          maxPoints: 5,
          answerKey: '',
        },
      ];
    });
  };

  const handleSectionChange = (
    secId: string,
    field: keyof WorksheetSection,
    value: string
  ) => {
    setSections((prev) =>
      prev.map((s) => (s.id === secId ? { ...s, [field]: value } : s))
    );
  };

  const handleSetSectionQuestionCount = (secId: string, desiredCountRaw: number) => {
    const desired = Number.isFinite(desiredCountRaw) ? Math.floor(desiredCountRaw) : 1;
    setQuestions((prev) => {
      const secQuestions = prev.filter((q) => q.sectionId === secId);
      const otherQuestions = prev.filter((q) => q.sectionId !== secId);
      const maxForSection = Math.max(1, Math.min(50, 100 - otherQuestions.length));
      const targetCount = Math.max(1, Math.min(maxForSection, desired));

      if (targetCount === secQuestions.length) return prev;

      if (targetCount > secQuestions.length) {
        const lastQ = secQuestions[secQuestions.length - 1];
        const inheritedType = lastQ?.type || 'text';
        const inheritedPoints = lastQ?.maxPoints || (inheritedType === 'multiple_choice' ? 1 : 5);
        const toAddCount = targetCount - secQuestions.length;
        const added: Question[] = Array.from({ length: toAddCount }, () => ({
          id: `q_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          sectionId: secId,
          text: '',
          type: inheritedType,
          ...(inheritedType === 'multiple_choice'
            ? { options: ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2', 'ตัวเลือกที่ 3', 'ตัวเลือกที่ 4'] }
            : {}),
          maxPoints: inheritedPoints,
          answerKey: '',
        }));
        return [...prev, ...added];
      }

      // Trim trailing questions within this section while preserving order of all other sections
      let keptInSec = 0;
      return prev.filter((q) => {
        if (q.sectionId !== secId) return true;
        keptInSec += 1;
        return keptInSec <= targetCount;
      });
    });
  };

  const handleAddQuestionToSection = (secId: string) => {
    const currentCount = questions.filter((q) => q.sectionId === secId).length;
    handleSetSectionQuestionCount(secId, currentCount + 1);
  };

  const handleRemoveQuestion = (id: string) => {
    const target = questions.find((q) => q.id === id);
    if (!target) return;
    const countInSec = questions.filter((q) => q.sectionId === target.sectionId).length;
    if (questions.length <= 1 || countInSec <= 1) return;
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  };

  const handleQuestionChange = (id: string, field: keyof Question, value: any) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== id) return q;
        if (field === 'type' && value === 'multiple_choice' && (!q.options || q.options.length === 0)) {
          return {
            ...q,
            type: 'multiple_choice',
            options: ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2', 'ตัวเลือกที่ 3', 'ตัวเลือกที่ 4'],
          };
        }
        return { ...q, [field]: value };
      })
    );
  };

  const handleQuestionOptionChange = (qId: string, optIdx: number, val: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const nextOpts = [...(q.options || [])];
        nextOpts[optIdx] = val;
        return { ...q, options: nextOpts };
      })
    );
  };

  const handleAddQuestionOption = (qId: string) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const curr = q.options || [];
        if (curr.length >= 8) return q;
        return { ...q, options: [...curr, `ตัวเลือกที่ ${curr.length + 1}`] };
      })
    );
  };

  const handleRemoveQuestionOption = (qId: string, optIdx: number) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== qId) return q;
        const curr = q.options || [];
        if (curr.length <= 2) return q;
        return { ...q, options: curr.filter((_, i) => i !== optIdx) };
      })
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

    const totalRequested = aiSectionsPlan.reduce((sum, s) => sum + Math.max(1, s.questionCount || 1), 0);

    try {
      const res = await fetch('/api/ai/generate-worksheet', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          subject,
          gradeLevel,
          topic: aiTopic,
          numberOfQuestions: totalRequested,
          sectionsPlan: aiSectionsPlan,
        }),
      });
      const data = await res.json();
      if (data.success && data.worksheet) {
        const ws = data.worksheet;
        setTitle(ws.title || `ใบงานเรื่อง ${aiTopic}`);
        setDescription(ws.description || `แบบฝึกหัดเรื่อง ${aiTopic} สำหรับนักเรียนชั้น ${gradeLevel}`);
        setInstructions(ws.instructions || 'จงตอบคำถามให้ครบถ้วน');

        const generatedSections: WorksheetSection[] =
          Array.isArray(ws.sections) && ws.sections.length > 0
            ? ws.sections.map((s: any, idx: number) => ({
                id: String(s?.id || `sec_${idx + 1}`),
                title: String(s?.title || `ตอนที่ ${idx + 1}`),
                instructions: String(s?.instructions || ''),
              }))
            : aiSectionsPlan.map((s) => ({
                id: s.id,
                title: s.title,
                instructions: s.instructions,
              }));
        setSections(generatedSections);

        if (ws.questions && Array.isArray(ws.questions) && ws.questions.length > 0) {
          const validSecIds = new Set(generatedSections.map((s) => s.id));
          setQuestions(
            ws.questions.map((q: any, idx: number) => ({
              ...q,
              id: q?.id || `q_${Date.now()}_${idx + 1}`,
              sectionId:
                q?.sectionId && validSecIds.has(q.sectionId)
                  ? q.sectionId
                  : generatedSections[0].id,
            }))
          );
        }
        setActiveTab('manual'); // Switch to manual tab to inspect & fine-tune
      } else {
        throw new Error('AI generation returned empty');
      }
    } catch (err) {
      console.warn('AI Worksheet generation fallback template used:', err);
      // Smart Fallback template matching requested sections & question counts
      setTitle(`ใบงานเรื่อง ${aiTopic}`);
      setDescription(`แบบฝึกหัดพัฒนาทักษะ เรื่อง ${aiTopic} สำหรับนักเรียนระดับชั้น ${gradeLevel}`);
      setInstructions(`ให้นักเรียนศึกษาค้นคว้า และตอบคำถามเรื่อง "${aiTopic}" ให้ครบทุกตอน`);

      const fallbackSections: WorksheetSection[] = aiSectionsPlan.map((s, idx) => ({
        id: s.id,
        title: s.title.trim() || `ตอนที่ ${idx + 1}`,
        instructions: s.instructions.trim(),
      }));
      const fallbackQuestions: Question[] = [];
      let qCounter = 1;
      aiSectionsPlan.forEach((secPlan) => {
        const count = Math.max(1, Math.min(25, secPlan.questionCount || 1));
        for (let i = 0; i < count; i += 1) {
          const resolvedType =
            secPlan.questionType === 'mixed'
              ? i % 2 === 0
                ? 'text'
                : 'fill_blank'
              : secPlan.questionType;
          fallbackQuestions.push({
            id: `q_${Date.now()}_${qCounter}`,
            sectionId: secPlan.id,
            text:
              resolvedType === 'multiple_choice'
                ? `ข้อใดเกี่ยวข้องกับ "${aiTopic}" อย่างถูกต้อง (${secPlan.title} ข้อที่ ${i + 1})`
                : resolvedType === 'fill_blank'
                ? `จงเติมคำตอบสำคัญเกี่ยวกับ "${aiTopic}" (${secPlan.title} ข้อที่ ${i + 1})`
                : `จงอธิบายและวิเคราะห์ประเด็นสำคัญของ "${aiTopic}" (${secPlan.title} ข้อที่ ${i + 1})`,
            type: resolvedType,
            ...(resolvedType === 'multiple_choice'
              ? { options: ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2', 'ตัวเลือกที่ 3', 'ตัวเลือกที่ 4'] }
              : {}),
            maxPoints: resolvedType === 'multiple_choice' ? 1 : 5,
            answerKey:
              resolvedType === 'multiple_choice'
                ? 'ตัวเลือกที่ 1'
                : `อธิบายหลักการ แนวคิด และตัวอย่างเกี่ยวกับ ${aiTopic} ได้อย่างถูกต้องครบถ้วน`,
          });
          qCounter += 1;
        }
      });
      setSections(fallbackSections);
      setQuestions(fallbackQuestions);
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

    const normalizedSections: WorksheetSection[] = sections.map((s, idx) => ({
      id: s.id,
      title: s.title.trim() || `ตอนที่ ${idx + 1}`,
      ...(s.instructions?.trim() ? { instructions: s.instructions.trim() } : {}),
    }));

    const validSecSet = new Set(normalizedSections.map((s) => s.id));
    const orderedQuestions: Question[] = [];
    normalizedSections.forEach((sec) => {
      questions
        .filter((q) => q.sectionId === sec.id)
        .forEach((q) => orderedQuestions.push(q));
    });
    questions
      .filter((q) => !q.sectionId || !validSecSet.has(q.sectionId))
      .forEach((q) => orderedQuestions.push({ ...q, sectionId: normalizedSections[0].id }));

    const normalizedGroups: WorksheetGroup[] =
      workMode === 'group'
        ? groups
            .filter((g) => g.name.trim() || g.memberCodes.length > 0)
            .slice(0, 50)
            .map((g, idx) => ({
              id: g.id,
              name: g.name.trim() || `กลุ่มที่ ${idx + 1}`,
              memberCodes: Array.from(new Set(g.memberCodes)),
              ...(g.leaderCode && g.memberCodes.includes(g.leaderCode)
                ? { leaderCode: g.leaderCode }
                : g.memberCodes[0]
                ? { leaderCode: g.memberCodes[0] }
                : {}),
            }))
        : [];

    if (workMode === 'group' && !allowStudentCreateGroup && normalizedGroups.length === 0) {
      setValidationError(
        'กรุณาจัดกลุ่มนักเรียนอย่างน้อย 1 กลุ่ม หรือเปิดสิทธิ์ให้นักเรียนสร้าง/เข้าร่วมกลุ่มเองได้'
      );
      return;
    }

    const totalPoints = orderedQuestions.reduce((sum, q) => sum + (Number(q.maxPoints) || 0), 0);
    const targetingPayload = {
      isPublished,
      assignedStudentCodes: assignScope === 'specific' ? assignedStudentCodes : [],
      workMode,
      ...(workMode === 'group'
        ? {
            groupSettings: {
              maxGroupSize: Math.max(2, Math.min(15, Number(maxGroupSize) || 4)),
              allowStudentCreateGroup,
            },
            groups: normalizedGroups,
          }
        : { groups: [] }),
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
        sections: normalizedSections,
        questions: orderedQuestions,
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
        sections: normalizedSections,
        questions: orderedQuestions,
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
      <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-emerald-950/60 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-emerald-950/60 flex items-center justify-between bg-slate-50/90 dark:bg-[var(--theme-surface-dark-elevated)]">
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
          <div className="flex border-b border-slate-200 dark:border-emerald-950/60 bg-slate-100/70 dark:bg-[var(--theme-surface-dark-elevated)] p-1">
            <button
              onClick={() => setActiveTab('manual')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === 'manual'
                  ? 'bg-white dark:bg-[var(--theme-surface-dark)] text-emerald-800 dark:text-emerald-400 shadow-xs'
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
                    {subjectOptions.map((s) => (
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
                    {gradeOptions.map((g) => (
                      <option key={g} value={g}>
                        {g === 'ทั้งหมด' ? 'ทุกห้องเรียน (ทั้งหมด)' : `ชั้น ${g}`}
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

              {/* AI Sections & Question Count Planner */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>
                      โครงสร้างตอนและจำนวนข้อ ({aiSectionsPlan.length} ตอน · รวม{' '}
                      {aiSectionsPlan.reduce((s, x) => s + x.questionCount, 0)} ข้อ)
                    </span>
                  </div>
                  {aiSectionsPlan.length < 10 && (
                    <button
                      type="button"
                      onClick={() =>
                        setAiSectionsPlan((prev) => [
                          ...prev,
                          {
                            id: `sec_${Date.now()}_${prev.length + 1}`,
                            title: `ตอนที่ ${prev.length + 1}`,
                            instructions: '',
                            questionType: 'mixed',
                            questionCount: 3,
                          },
                        ])
                      }
                      className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เพิ่มตอนที่ {aiSectionsPlan.length + 1}</span>
                    </button>
                  )}
                </div>

                <div className="space-y-2.5">
                  {aiSectionsPlan.map((secPlan, idx) => (
                    <div
                      key={secPlan.id}
                      className="p-3 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-slate-700 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          ตอนที่ {idx + 1}
                        </span>
                        {aiSectionsPlan.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              setAiSectionsPlan((prev) => prev.filter((s) => s.id !== secPlan.id))
                            }
                            className="text-rose-500 hover:text-rose-700 p-0.5 cursor-pointer"
                            title="ลบตอนนี้"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <input
                          type="text"
                          value={secPlan.title}
                          onChange={(e) =>
                            setAiSectionsPlan((prev) =>
                              prev.map((s) =>
                                s.id === secPlan.id ? { ...s, title: e.target.value } : s
                              )
                            )
                          }
                          placeholder={`ชื่อตอน เช่น ตอนที่ ${idx + 1}: จงเลือกคำตอบที่ถูกต้อง`}
                          className="sm:col-span-5 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        />

                        <select
                          value={secPlan.questionType}
                          onChange={(e) =>
                            setAiSectionsPlan((prev) =>
                              prev.map((s) =>
                                s.id === secPlan.id
                                  ? {
                                      ...s,
                                      questionType: e.target.value as
                                        | 'mixed'
                                        | 'text'
                                        | 'multiple_choice'
                                        | 'fill_blank',
                                    }
                                  : s
                              )
                            )
                          }
                          className="sm:col-span-4 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                        >
                          <option value="mixed">ผสมหลายรูปแบบ</option>
                          <option value="multiple_choice">ปรนัย (เลือกตอบ)</option>
                          <option value="fill_blank">เติมคำในช่องว่าง</option>
                          <option value="text">ข้อเขียนตอบบรรยาย</option>
                        </select>

                        <div className="sm:col-span-3 flex items-center gap-1.5">
                          <span className="text-[11px] text-slate-500 shrink-0">จำนวน</span>
                          <input
                            type="number"
                            min={1}
                            max={25}
                            value={secPlan.questionCount}
                            onChange={(e) => {
                              const val = Math.max(1, Math.min(25, Number(e.target.value) || 1));
                              setAiSectionsPlan((prev) =>
                                prev.map((s) =>
                                  s.id === secPlan.id ? { ...s, questionCount: val } : s
                                )
                              );
                            }}
                            className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-center"
                          />
                          <span className="text-[11px] text-slate-500 shrink-0">ข้อ</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateAiWorksheet}
                disabled={isGeneratingAi || !aiTopic.trim()}
                className="theme-btn-sheen w-full py-2.5 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white font-semibold rounded-xl text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
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
                    {subjectOptions.map((s) => (
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
                    {gradeOptions.map((g) => (
                      <option key={g} value={g}>
                        {g === 'ทั้งหมด' ? 'ทุกห้องเรียน (ทั้งหมด)' : `ชั้น ${g}`}
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
                        ? 'bg-white dark:bg-[var(--theme-surface-dark)] border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'bg-white/60 dark:bg-[var(--theme-surface-dark)]/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
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
                        ? 'bg-white dark:bg-[var(--theme-surface-dark)] border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'bg-white/60 dark:bg-[var(--theme-surface-dark)]/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
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
                  <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2.5">
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

              {/* Work Mode Selector: Individual vs Group Collaborative */}
              <div className="p-4 bg-teal-50/50 dark:bg-teal-950/25 border border-teal-200/80 dark:border-teal-900/60 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-teal-700 dark:text-teal-400" />
                    <span className="text-xs font-bold font-prompt text-slate-900 dark:text-white">
                      รูปแบบการทำงาน (งานเดี่ยว / งานกลุ่มร่วมกัน)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setWorkMode('individual');
                      setValidationError('');
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      workMode === 'individual'
                        ? 'bg-white dark:bg-[var(--theme-surface-dark)] border-emerald-600 ring-2 ring-emerald-500/20 text-emerald-800 dark:text-emerald-300 font-bold'
                        : 'bg-white/60 dark:bg-[var(--theme-surface-dark)]/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="block">งานเดี่ยว (Individual)</span>
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                      นักเรียนแต่ละคนทำและส่งคำตอบของตนเองแยกกัน
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setWorkMode('group');
                      setValidationError('');
                    }}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      workMode === 'group'
                        ? 'bg-white dark:bg-[var(--theme-surface-dark)] border-teal-600 ring-2 ring-teal-500/20 text-teal-800 dark:text-teal-300 font-bold'
                        : 'bg-white/60 dark:bg-[var(--theme-surface-dark)]/50 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    <span className="block">งานกลุ่มร่วมกัน (Group Worksheet)</span>
                    <span className="block text-[10px] font-normal text-slate-400 mt-0.5">
                      สมาชิกในกลุ่มช่วยกันทำ บันทึกร่างร่วมกัน และส่ง/รับคะแนนพร้อมกันทั้งกลุ่ม
                    </span>
                  </button>
                </div>

                {workMode === 'group' && (
                  <div className="bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-slate-700 rounded-xl p-3.5 space-y-3.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          จำนวนสมาชิกสูงสุดต่อกลุ่ม:
                        </span>
                        <input
                          type="number"
                          min={2}
                          max={15}
                          value={maxGroupSize}
                          onChange={(e) =>
                            setMaxGroupSize(Math.max(2, Math.min(15, Number(e.target.value) || 4)))
                          }
                          className="w-16 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold font-mono text-center text-emerald-700 dark:text-emerald-300"
                        />
                        <span className="text-xs text-slate-500">คน</span>
                      </div>

                      <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-200">
                        <input
                          type="checkbox"
                          checked={allowStudentCreateGroup}
                          onChange={(e) => setAllowStudentCreateGroup(e.target.checked)}
                          className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                        />
                        <span>อนุญาตให้นักเรียนสร้าง/เข้าร่วมกลุ่มเองได้</span>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {groups.length > 0
                          ? `จัดไว้แล้ว ${groups.length} กลุ่ม (สมาชิกทั้งหมด ${groups.reduce(
                              (acc, g) => acc + g.memberCodes.length,
                              0
                            )}/${eligibleStudentsForGroups.length} คน)`
                          : allowStudentCreateGroup
                          ? 'ครูสามารถจัดกลุ่มล่วงหน้า หรือปล่อยให้นักเรียนจับกลุ่มกันเองเมื่อเปิดใบงาน'
                          : 'กรุณาจัดกลุ่มให้นักเรียนล่วงหน้าด้านล่าง'}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAutoCreateGroups(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 text-[11px] font-bold cursor-pointer"
                        >
                          <Shuffle className="w-3.5 h-3.5" />
                          <span>สุ่มจัดกลุ่มอัตโนมัติ ({eligibleStudentsForGroups.length} คน)</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleAddEmptyGroup}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-200 text-[11px] font-bold cursor-pointer"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ เพิ่มกลุ่มเอง</span>
                        </button>

                        {groups.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setGroups([])}
                            className="px-2 py-1.5 text-[11px] font-semibold text-rose-500 hover:underline cursor-pointer"
                          >
                            ล้างกลุ่ม
                          </button>
                        )}
                      </div>
                    </div>

                    {groups.length > 0 && (
                      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                        {groups.map((grp, gIdx) => {
                          const groupMemberSet = new Set(grp.memberCodes.map(normalizeCode));
                          const otherAssignedSet = new Set(
                            groups
                              .filter((o) => o.id !== grp.id)
                              .flatMap((o) => o.memberCodes.map(normalizeCode))
                          );

                          return (
                            <div
                              key={grp.id}
                              className="p-3 bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <input
                                  type="text"
                                  value={grp.name}
                                  onChange={(e) =>
                                    setGroups((prev) =>
                                      prev.map((item) =>
                                        item.id === grp.id ? { ...item, name: e.target.value } : item
                                      )
                                    )
                                  }
                                  placeholder={`ชื่อกลุ่มที่ ${gIdx + 1}`}
                                  className="flex-1 px-2.5 py-1 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white"
                                />
                                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                                  {grp.memberCodes.length}/{maxGroupSize} คน
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setGroups((prev) => prev.filter((item) => item.id !== grp.id))
                                  }
                                  className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                                  title="ลบกลุ่มนี้"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {eligibleStudentsForGroups.length === 0 ? (
                                <p className="text-[11px] text-slate-400">
                                  ยังไม่มีรายชื่อนักเรียนในห้อง {gradeLevel} (นักเรียนสามารถเข้ามากดเข้าร่วมกลุ่มเองได้)
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-1.5">
                                  {eligibleStudentsForGroups.map((st) => {
                                    const norm = normalizeCode(st.code);
                                    const inThis = groupMemberSet.has(norm);
                                    const inOther = otherAssignedSet.has(norm);
                                    const isLeader =
                                      Boolean(grp.leaderCode) &&
                                      normalizeCode(grp.leaderCode) === norm;

                                    return (
                                      <div
                                        key={st.id}
                                        className={`inline-flex items-center gap-1 rounded-lg border text-[11px] transition-colors ${
                                          inThis
                                            ? 'bg-emerald-600 text-white border-emerald-600 font-semibold'
                                            : inOther
                                            ? 'bg-slate-100 dark:bg-slate-800/70 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60'
                                            : 'bg-white dark:bg-[var(--theme-surface-dark)] text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          disabled={!inThis && grp.memberCodes.length >= maxGroupSize}
                                          onClick={() => handleToggleMemberInGroup(grp.id, st.code)}
                                          className="px-2 py-1 cursor-pointer disabled:opacity-40"
                                          title={
                                            inOther
                                              ? 'คลิกเพื่อย้ายมาอยู่กลุ่มนี้'
                                              : inThis
                                              ? 'คลิกเพื่อนำออกจากกลุ่ม'
                                              : 'คลิกเพื่อเพิ่มเข้ากลุ่ม'
                                          }
                                        >
                                          {st.name} ({st.code})
                                        </button>
                                        {inThis && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setGroups((prev) =>
                                                prev.map((item) =>
                                                  item.id === grp.id
                                                    ? { ...item, leaderCode: st.code }
                                                    : item
                                                )
                                              )
                                            }
                                            className={`pr-1.5 py-1 cursor-pointer ${
                                              isLeader ? 'text-amber-300' : 'text-white/60 hover:text-amber-200'
                                            }`}
                                            title={isLeader ? 'หัวหน้ากลุ่ม' : 'ตั้งเป็นหัวหน้ากลุ่ม'}
                                          >
                                            <Crown className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Dynamic Sections & Questions Builder */}
              <div className="space-y-4 pt-3 border-t border-slate-200 dark:border-emerald-950/60">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold font-prompt text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                      <span>
                        โครงสร้างใบงาน: {sections.length} ตอน · รวม {questions.length} ข้อ ({totalWorksheetPoints} คะแนน)
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      กำหนดชื่อตอน คำชี้แจงประจำตอน และระบุจำนวนข้อในแต่ละตอนได้ทันที
                    </p>
                  </div>

                  {sections.length < 15 && (
                    <button
                      type="button"
                      onClick={handleAddSection}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>เพิ่มตอนที่ {sections.length + 1}</span>
                    </button>
                  )}
                </div>

                {sections.map((section, secIdx) => {
                  const secQuestions = questions.filter((q) => q.sectionId === section.id);
                  const secPoints = secQuestions.reduce(
                    (sum, q) => sum + (Number(q.maxPoints) || 0),
                    0
                  );

                  return (
                    <div
                      key={section.id}
                      className="p-4 bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-200/80 dark:border-emerald-900/60 rounded-2xl space-y-3.5"
                    >
                      {/* Section Header Controls */}
                      <div className="flex flex-col gap-2.5 pb-3 border-b border-emerald-200/60 dark:border-emerald-900/50">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                            <span className="px-2.5 py-1 bg-emerald-700 text-white rounded-lg text-[11px] font-bold shrink-0">
                              ตอนที่ {secIdx + 1}
                            </span>
                            <input
                              type="text"
                              value={section.title}
                              onChange={(e) =>
                                handleSectionChange(section.id, 'title', e.target.value)
                              }
                              placeholder={`เช่น ตอนที่ ${secIdx + 1}: จงเลือกคำตอบที่ถูกต้อง`}
                              className="flex-1 px-3 py-1.5 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                            />
                          </div>

                          {/* Question Count Stepper for this section */}
                          <div className="flex items-center gap-2">
                            <div className="inline-flex items-center gap-1 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-300 dark:border-slate-700 rounded-xl px-2 py-1">
                              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-0.5">
                                จำนวนข้อ:
                              </span>
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetSectionQuestionCount(
                                    section.id,
                                    secQuestions.length - 1
                                  )
                                }
                                disabled={secQuestions.length <= 1}
                                className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
                                title="ลดจำนวนข้อในตอนนี้"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={50}
                                value={secQuestions.length}
                                onChange={(e) =>
                                  handleSetSectionQuestionCount(section.id, Number(e.target.value))
                                }
                                className="w-11 text-center text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300 bg-transparent focus:outline-hidden"
                                aria-label={`จำนวนข้อในตอนที่ ${secIdx + 1}`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  handleSetSectionQuestionCount(
                                    section.id,
                                    secQuestions.length + 1
                                  )
                                }
                                disabled={questions.length >= 100 || secQuestions.length >= 50}
                                className="p-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-35 cursor-pointer"
                                title="เพิ่มจำนวนข้อในตอนนี้"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>

                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                              ({secPoints} คะแนน)
                            </span>

                            {sections.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveSection(section.id)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                                title={`ลบตอนที่ ${secIdx + 1}`}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <input
                          type="text"
                          value={section.instructions || ''}
                          onChange={(e) =>
                            handleSectionChange(section.id, 'instructions', e.target.value)
                          }
                          placeholder={`คำชี้แจงประจำตอนที่ ${secIdx + 1} (ไม่บังคับ เช่น จงเลือกคำตอบที่ถูกต้องที่สุดเพียงข้อเดียว)`}
                          className="w-full px-3 py-1.5 bg-white/80 dark:bg-[var(--theme-surface-dark)] border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-700 dark:text-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>

                      {/* Questions within this section */}
                      <div className="space-y-3">
                        {secQuestions.map((q, qIdxInSec) => (
                          <div
                            key={q.id}
                            className="p-4 bg-white dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3 relative"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                {section.title.trim() || `ตอนที่ ${secIdx + 1}`} · ข้อที่ {qIdxInSec + 1}
                              </span>
                              {secQuestions.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveQuestion(q.id)}
                                  className="text-rose-500 hover:text-rose-700 text-xs p-1 cursor-pointer"
                                  title="ลบข้อนี้"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            <input
                              type="text"
                              required
                              placeholder={`พิมพ์โจทย์คำถามข้อที่ ${qIdxInSec + 1}...`}
                              value={q.text}
                              onChange={(e) => handleQuestionChange(q.id, 'text', e.target.value)}
                              className="w-full px-3 py-2 bg-slate-50 dark:bg-[var(--theme-surface-dark-elevated)] border border-slate-300 dark:border-emerald-950/60 rounded-lg text-xs font-medium text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                            />

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[11px] text-slate-500 mb-1">
                                  ประเภทโจทย์
                                </label>
                                <select
                                  value={q.type}
                                  onChange={(e) => handleQuestionChange(q.id, 'type', e.target.value)}
                                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-[var(--theme-surface-dark-elevated)] border border-slate-300 dark:border-emerald-950/60 rounded-lg text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
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
                                  className="w-full px-2 py-1.5 bg-slate-50 dark:bg-[var(--theme-surface-dark-elevated)] border border-slate-300 dark:border-emerald-950/60 rounded-lg text-xs font-mono focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                                />
                              </div>
                            </div>

                            {/* Multiple choice options editor */}
                            {q.type === 'multiple_choice' && (
                              <div className="p-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                    ตัวเลือกคำตอบ (คลิกเลือกเป็นเฉลยได้)
                                  </span>
                                  {(q.options?.length || 0) < 8 && (
                                    <button
                                      type="button"
                                      onClick={() => handleAddQuestionOption(q.id)}
                                      className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                                    >
                                      + เพิ่มตัวเลือก
                                    </button>
                                  )}
                                </div>
                                <div className="space-y-1.5">
                                  {(q.options || []).map((opt, optIdx) => {
                                    const isKey = Boolean(opt && q.answerKey === opt);
                                    return (
                                      <div key={optIdx} className="flex items-center gap-2">
                                        <span className="text-[11px] font-mono text-slate-400 w-5 text-center shrink-0">
                                          {optIdx + 1}.
                                        </span>
                                        <input
                                          type="text"
                                          value={opt}
                                          onChange={(e) =>
                                            handleQuestionOptionChange(q.id, optIdx, e.target.value)
                                          }
                                          placeholder={`ตัวเลือกที่ ${optIdx + 1}`}
                                          className="flex-1 px-2.5 py-1 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-300 dark:border-slate-700 rounded-lg text-xs"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleQuestionChange(q.id, 'answerKey', opt)
                                          }
                                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer shrink-0 ${
                                            isKey
                                              ? 'bg-emerald-600 text-white border-emerald-600'
                                              : 'bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                                          }`}
                                        >
                                          {isKey ? '✓ เฉลย' : 'ตั้งเป็นเฉลย'}
                                        </button>
                                        {(q.options?.length || 0) > 2 && (
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveQuestionOption(q.id, optIdx)}
                                            className="p-1 text-rose-500 hover:text-rose-700 cursor-pointer"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <input
                              type="text"
                              placeholder="เฉลยคำตอบ/เกณฑ์ตรวจสำหรับครู (ถ้ามี)"
                              value={q.answerKey || ''}
                              onChange={(e) => handleQuestionChange(q.id, 'answerKey', e.target.value)}
                              className="w-full px-3 py-1.5 bg-slate-50 dark:bg-[var(--theme-surface-dark-elevated)] border border-slate-200 dark:border-emerald-950/60 rounded-lg text-[11px] text-slate-600 dark:text-slate-300 italic focus:outline-hidden focus:ring-2 focus:ring-emerald-600"
                            />

                            {/* Question Image Attachment */}
                            <div className="space-y-1.5 pt-1">
                              {q.imageUrl ? (
                                <div className="flex items-center gap-3 p-2 bg-slate-50 dark:bg-[var(--theme-surface-dark-elevated)] border border-slate-200 dark:border-emerald-950/60 rounded-xl">
                                  <img
                                    src={q.imageUrl}
                                    alt="Question attachment preview"
                                    className="w-16 h-12 object-cover rounded-lg border border-slate-200 dark:border-slate-800"
                                    referrerPolicy="no-referrer"
                                  />
                                  <div className="flex-1 min-w-0 text-xs">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                      แนบรูปภาพโจทย์แล้ว
                                    </p>
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
                                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[var(--theme-surface-dark)] border border-slate-300 dark:border-slate-700 hover:border-emerald-500 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer transition-colors shadow-2xs">
                                    <Upload className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                                    <span>แนบรูปภาพประกอบข้อนี้</span>
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp,image/gif"
                                      className="hidden"
                                      onChange={(e) =>
                                        handleQuestionImageUpload(q.id, e.target.files?.[0])
                                      }
                                    />
                                  </label>
                                  <span className="text-[10px] text-slate-400">
                                    รองรับ JPG, PNG, WebP (สูงสุด 10MB)
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <button
                          type="button"
                          onClick={() => handleAddQuestionToSection(section.id)}
                          disabled={questions.length >= 100 || secQuestions.length >= 50}
                          className="inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-semibold cursor-pointer disabled:opacity-40"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>เพิ่มข้อใหม่ใน {section.title.trim() || `ตอนที่ ${secIdx + 1}`}</span>
                        </button>
                        <span className="text-[11px] text-slate-400">
                          ทั้งหมด {secQuestions.length} ข้อ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-emerald-950/60 bg-slate-50/90 dark:bg-[var(--theme-surface-dark-elevated)] flex items-center justify-between">
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
              className="theme-btn-sheen inline-flex items-center gap-1.5 px-5 py-2 bg-gradient-to-r from-emerald-700 to-teal-700 hover:from-emerald-800 hover:to-teal-800 text-white text-xs font-semibold rounded-lg shadow-md transition-all cursor-pointer"
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
                {
                  label: 'รูปแบบการทำงาน',
                  value:
                    pendingAssignment.workMode === 'group'
                      ? `งานกลุ่ม (สูงสุด ${pendingAssignment.groupSettings?.maxGroupSize || 4} คน/กลุ่ม · จัดไว้ ${pendingAssignment.groups?.length || 0} กลุ่ม)`
                      : 'งานเดี่ยว',
                },
                {
                  label: 'โครงสร้าง / จำนวนข้อ',
                  value: `${pendingAssignment.sections?.length || 1} ตอน · ${pendingAssignment.questions.length} ข้อ (${pendingAssignment.totalPoints} คะแนน)`,
                },
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
