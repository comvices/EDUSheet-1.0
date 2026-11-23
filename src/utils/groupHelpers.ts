import { Assignment, StudentProfile, Submission, WorksheetGroup } from '../types';

export function normalizeCode(code?: string): string {
  return (code || '').trim().toUpperCase();
}

export function buildDeterministicSubmissionId(
  assignmentId: string,
  studentCode: string
): string {
  const safeAsg = (assignmentId || 'asg')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 56);
  const normCode = normalizeCode(studentCode) || 'STD';
  let safeCode = normCode.replace(/[^a-zA-Z0-9_-]/g, '_');

  if (safeCode.replace(/_/g, '').length === 0) {
    let hash = 0;
    for (let i = 0; i < normCode.length; i += 1) {
      hash = (hash * 31 + normCode.charCodeAt(i)) >>> 0;
    }
    safeCode = `u${hash.toString(36)}`;
  }

  return `sub_${safeAsg}_${safeCode.slice(0, 48)}`.slice(0, 128);
}

export function findStudentGroup(
  assignment?: Pick<Assignment, 'groups' | 'workMode'>,
  studentCode?: string
): WorksheetGroup | undefined {
  if (!assignment || assignment.workMode !== 'group') return undefined;
  const norm = normalizeCode(studentCode);
  if (!norm) return undefined;
  return (assignment.groups || []).find((grp) =>
    (grp.memberCodes || []).some((code) => normalizeCode(code) === norm)
  );
}

const GROUP_SUB_RANK: Record<Submission['status'], number> = {
  graded: 5,
  submitted: 4,
  needs_revision: 3,
  pending: 2,
  overdue: 1,
};

export function pickLatestGroupSubmission(
  assignmentId: string,
  group: WorksheetGroup | undefined,
  submissions: Submission[]
): Submission | undefined {
  if (!group) return undefined;
  const memberSet = new Set((group.memberCodes || []).map(normalizeCode).filter(Boolean));
  const candidates = submissions.filter((s) => {
    if (s.assignmentId !== assignmentId) return false;
    if (s.groupId && s.groupId === group.id) return true;
    return memberSet.has(normalizeCode(s.studentCode));
  });

  if (candidates.length === 0) return undefined;

  return [...candidates].sort((a, b) => {
    const tsB = new Date(b.submissionDate || b.gradedAt || 0).getTime() || 0;
    const tsA = new Date(a.submissionDate || a.gradedAt || 0).getTime() || 0;
    if (tsB !== tsA) return tsB - tsA;
    return (GROUP_SUB_RANK[b.status] ?? 0) - (GROUP_SUB_RANK[a.status] ?? 0);
  })[0];
}

export function getEligibleStudentsForWorksheet(
  studentsList: StudentProfile[],
  gradeLevel: string,
  assignedStudentCodes?: string[]
): StudentProfile[] {
  if (assignedStudentCodes && assignedStudentCodes.length > 0) {
    const codeSet = new Set(assignedStudentCodes.map(normalizeCode).filter(Boolean));
    return studentsList.filter((st) => codeSet.has(normalizeCode(st.code)));
  }

  const target = (gradeLevel || '').trim();
  if (!target || target === 'ทั้งหมด') return [...studentsList];

  const baseTarget = target.replace(/\s*\(ทุกห้อง\)$/, '').trim();
  return studentsList.filter((st) => {
    const stdGrade = (st.gradeLevel || '').trim();
    if (!stdGrade) return false;
    if (stdGrade === target) return true;
    const baseStd = stdGrade.includes('/') ? stdGrade.split('/')[0].trim() : stdGrade;
    if (target.endsWith('(ทุกห้อง)') && baseStd === baseTarget) return true;
    if (!target.includes('/') && baseStd === target) return true;
    return false;
  });
}

export function buildAutoWorksheetGroups(
  eligibleStudents: StudentProfile[],
  maxGroupSize: number,
  shuffle = true
): WorksheetGroup[] {
  const safeSize = Math.max(2, Math.min(15, Math.floor(maxGroupSize || 4)));
  const pool = [...eligibleStudents];
  if (pool.length === 0) return [];

  if (shuffle) {
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
  } else {
    pool.sort((a, b) => a.code.localeCompare(b.code, 'th', { numeric: true }));
  }

  const totalGroups = Math.max(1, Math.ceil(pool.length / safeSize));
  const groups: WorksheetGroup[] = Array.from({ length: totalGroups }, (_, idx) => ({
    id: `grp_${Date.now()}_${idx + 1}`,
    name: `กลุ่มที่ ${idx + 1}`,
    memberCodes: [],
  }));

  // Distribute round-robin so group sizes remain balanced
  pool.forEach((student, idx) => {
    const targetGrp = groups[idx % totalGroups];
    targetGrp.memberCodes.push(student.code);
    if (!targetGrp.leaderCode) {
      targetGrp.leaderCode = student.code;
    }
  });

  return groups;
}
