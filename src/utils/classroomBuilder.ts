import {
  Assignment,
  CourseUnitItem,
  LearningResource,
  SubjectClassroom,
  TeacherProfile,
  TeachingSchedule,
} from '../types';

export interface W22103Preset {
  courseCode: string;
  title: string;
  subjectCandidates: string[];
  gradeLevel: string;
  description: string;
  objectives: string;
  units: Array<{
    title: string;
    description: string;
  }>;
}

export const W22103_CURRICULUM_PRESET: W22103Preset = {
  courseCode: 'ว22103',
  title: 'เทคโนโลยี (วิทยาการคำนวณ) ม.2',
  subjectCandidates: ['เทคโนโลยี/คอมพิวเตอร์', 'วิทยาการคำนวณ', 'คอมพิวเตอร์', 'วิทยาศาสตร์'],
  gradeLevel: 'ม.2',
  description:
    'รายวิชาพื้นฐานกลุ่มสาระการเรียนรู้วิทยาศาสตร์และเทคโนโลยี มุ่งเน้นการประยุกต์ใช้แนวคิดเชิงคำนวณในการแก้ปัญหา การออกแบบและเขียนโปรแกรมด้วยตรรกะและฟังก์ชัน การเข้าใจระบบคอมพิวเตอร์และการสื่อสาร รวมถึงการใช้เทคโนโลยีสารสนเทศอย่างปลอดภัยและมีความรับผิดชอบ',
  objectives:
    '1. ใช้แนวคิดเชิงคำนวณในการแก้ปัญหาที่พบในชีวิตจริงอย่างเป็นขั้นตอน\n2. ออกแบบอัลกอริทึมและเขียนโปรแกรมโดยใช้ตัวดำเนินการทางตรรกะ ฟังก์ชัน และการวนซ้ำ\n3. อธิบายองค์ประกอบ หลักการทำงานของระบบคอมพิวเตอร์ และเทคโนโลยีการสื่อสารเบื้องต้น\n4. ใช้เทคโนโลยีสารสนเทศอย่างปลอดภัย เคารพสิทธิ์ ลิขสิทธิ์ และมีความรับผิดชอบต่อสังคมดิจิทัล',
  units: [
    {
      title: 'หน่วยที่ 1: แนวคิดเชิงคำนวณกับการแก้ปัญหา',
      description:
        'ศึกษาการใช้แนวคิดเชิงคำนวณ (Computational Thinking) ได้แก่ การแยกส่วนประกอบ (Decomposition) การหารูปแบบ (Pattern Recognition) การคิดเชิงนามธรรม (Abstraction) และการออกแบบอัลกอริทึมเพื่อแก้ปัญหาอย่างเป็นระบบ (ว 4.2 ม.2/1)',
    },
    {
      title: 'หน่วยที่ 2: การออกแบบและเขียนโปรแกรมด้วยตรรกะและฟังก์ชัน',
      description:
        'ฝึกออกแบบขั้นตอนวิธีและพัฒนาโปรแกรมคอมพิวเตอร์ด้วยภาษา Python หรือ Scratch โดยประยุกต์ใช้ตัวแปร เงื่อนไขทางตรรกะ การวนซ้ำ และฟังก์ชันเพื่อแก้ปัญหาทางคณิตศาสตร์และชีวิตประจำวัน (ว 4.2 ม.2/2)',
    },
    {
      title: 'หน่วยที่ 3: ระบบคอมพิวเตอร์และเทคโนโลยีการสื่อสาร',
      description:
        'ทำความเข้าใจองค์ประกอบและหลักการทำงานของระบบคอมพิวเตอร์ ฮาร์ดแวร์ ซอฟต์แวร์ เครือข่ายคอมพิวเตอร์ และเทคโนโลยีการสื่อสารเพื่อประยุกต์ใช้งานและแก้ปัญหาเบื้องต้น (ว 4.2 ม.2/3)',
    },
    {
      title: 'หน่วยที่ 4: การใช้เทคโนโลยีสารสนเทศอย่างปลอดภัยและมีความรับผิดชอบ',
      description:
        'เรียนรู้แนวทางการใช้งานอินเทอร์เน็ตอย่างปลอดภัย การรับมือภัยคุกคามทางไซเบอร์ จริยธรรมดิจิทัล การเคารพลิขสิทธิ์ และการกำหนดสิทธิ์ในการเผยแพร่ผลงาน (ว 4.2 ม.2/4)',
    },
  ],
};

function extractCourseCodeFromName(subject: string): string | null {
  const match = subject.match(/[ก-ฮA-Za-z]{1,3}\d{4,6}/);
  return match ? match[0] : null;
}

function inferCourseCode(subject: string, usedCodes: Set<string>, fallbackIndex: number): string {
  const explicit = extractCourseCodeFromName(subject);
  if (explicit && !usedCodes.has(explicit)) {
    usedCodes.add(explicit);
    return explicit;
  }

  const normalized = subject.toLowerCase();
  let candidate = '';
  if (
    normalized.includes('เทคโนโลยี') ||
    normalized.includes('คอมพิวเตอร์') ||
    normalized.includes('วิทยาการคำนวณ')
  ) {
    candidate = 'ว22103';
  } else if (normalized.includes('วิทย')) {
    candidate = 'ว21101';
  } else if (normalized.includes('คณิต')) {
    candidate = 'ค21101';
  } else if (normalized.includes('ภาษาไทย') || normalized === 'ไทย') {
    candidate = 'ท21101';
  } else if (normalized.includes('อังกฤษ') || normalized.includes('english')) {
    candidate = 'อ21101';
  } else if (normalized.includes('สังคม') || normalized.includes('ประวัติ')) {
    candidate = 'ส21101';
  } else if (normalized.includes('ศิลป') || normalized.includes('ดนตรี') || normalized.includes('นาฏศิลป์')) {
    candidate = 'ศ21101';
  } else if (normalized.includes('สุข') || normalized.includes('พลศึกษา')) {
    candidate = 'พ21101';
  } else if (normalized.includes('การงาน')) {
    candidate = 'ง21101';
  } else {
    candidate = `SUB-${String(fallbackIndex + 1).padStart(3, '0')}`;
  }

  if (!usedCodes.has(candidate)) {
    usedCodes.add(candidate);
    return candidate;
  }

  let suffix = 2;
  while (usedCodes.has(`${candidate}-${suffix}`)) {
    suffix += 1;
  }
  const uniqueCode = `${candidate}-${suffix}`;
  usedCodes.add(uniqueCode);
  return uniqueCode;
}

function inferGradeLevel(
  subjAssignments: Assignment[],
  subjSchedules: TeachingSchedule[],
  subjResources: LearningResource[]
): string {
  const grades = new Set<string>();
  subjAssignments.forEach((a) => {
    if (a.gradeLevel && a.gradeLevel !== 'ทั้งหมด') grades.add(a.gradeLevel);
  });
  subjSchedules.forEach((s) => {
    if (s.gradeLevel && s.gradeLevel !== 'ทั้งหมด') grades.add(s.gradeLevel);
  });
  if (grades.size === 0) {
    subjResources.forEach((r) => {
      if (r.gradeLevel && r.gradeLevel !== 'ทั้งหมด') grades.add(r.gradeLevel);
    });
  }

  const list = Array.from(grades);
  if (list.length === 0) return 'ทั้งหมด';
  if (list.length === 1) return list[0];

  const baseGrades = new Set(list.map((g) => (g.includes('/') ? g.split('/')[0] : g)));
  if (baseGrades.size === 1) {
    return Array.from(baseGrades)[0];
  }
  return 'ทั้งหมด';
}

function inferTeacherName(
  subject: string,
  subjAssignments: Assignment[],
  subjSchedules: TeachingSchedule[],
  subjResources: LearningResource[],
  teachersRoster: TeacherProfile[],
  fallbackTeacherName: string
): string {
  const fromSchedule = subjSchedules.find((s) => s.teacherName?.trim())?.teacherName;
  if (fromSchedule) return fromSchedule.trim();

  const fromAssignment = subjAssignments.find((a) => a.teacherName?.trim())?.teacherName;
  if (fromAssignment) return fromAssignment.trim();

  const fromResource = subjResources.find((r) => r.teacherName?.trim())?.teacherName;
  if (fromResource) return fromResource.trim();

  const fromRoster = teachersRoster.find(
    (t) => t.subject && (t.subject.includes(subject) || subject.includes(t.subject))
  )?.name;
  if (fromRoster) return fromRoster.trim();

  return fallbackTeacherName?.trim() || 'ครูผู้สอนประจำวิชา';
}

function isTechSubject(subject: string): boolean {
  const s = subject.toLowerCase();
  return s.includes('เทคโนโลยี') || s.includes('คอมพิวเตอร์') || s.includes('วิทยาการคำนวณ');
}

function buildUnitsFromExistingData(
  subject: string,
  subjAssignments: Assignment[],
  subjResources: LearningResource[]
): CourseUnitItem[] {
  const sortedAsg = [...subjAssignments].sort(
    (a, b) => new Date(a.createdDate || a.dueDate).getTime() - new Date(b.createdDate || b.dueDate).getTime()
  );
  const sortedRes = [...subjResources].sort(
    (a, b) => new Date(a.createdDate).getTime() - new Date(b.createdDate).getTime()
  );

  // Case 1: Technology/Computing subject with <= 4 assignments and no extra clutter -> align nicely if needed or use existing assignments
  if (sortedAsg.length > 0 && sortedAsg.length <= 12) {
    return sortedAsg.map((asg, idx) => {
      const matchingRes = sortedRes.filter(
        (r) =>
          !r.gradeLevel ||
          r.gradeLevel === 'ทั้งหมด' ||
          r.gradeLevel === asg.gradeLevel ||
          asg.gradeLevel.startsWith(r.gradeLevel.split('/')[0])
      );
      const assignedRes = idx === 0 ? sortedRes : matchingRes;
      const primaryMedia = idx < sortedRes.length ? sortedRes[idx] : undefined;

      return {
        id: `unit_auto_${idx + 1}`,
        title: `หน่วยที่ ${idx + 1}: ${asg.title}`.slice(0, 200),
        description:
          asg.description?.trim() ||
          `เนื้อหาการเรียนรู้และแบบฝึกหัดประจำหน่วยในรายวิชา ${subject} (${asg.gradeLevel})`,
        order: idx + 1,
        ...(primaryMedia
          ? {
              mediaTitle: primaryMedia.title,
              mediaUrl: primaryMedia.url,
              mediaType: primaryMedia.type,
            }
          : {}),
        linkedAssignmentIds: [asg.id],
        linkedResourceIds: assignedRes.map((r) => r.id).slice(0, 20),
      };
    });
  }

  // Case 2: Many assignments (> 12) -> group cleanly by category or gradeLevel
  if (sortedAsg.length > 12) {
    const groups = new Map<string, Assignment[]>();
    sortedAsg.forEach((asg) => {
      const key = asg.category?.trim() || asg.gradeLevel || 'บทเรียนหลัก';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(asg);
    });

    return Array.from(groups.entries())
      .slice(0, 20)
      .map(([groupName, groupAsg], idx) => ({
        id: `unit_auto_grp_${idx + 1}`,
        title: `หน่วยที่ ${idx + 1}: ${groupName}`.slice(0, 200),
        description: `รวมใบงานและกิจกรรมหมวด ${groupName} ในรายวิชา ${subject} จำนวน ${groupAsg.length} รายการ`,
        order: idx + 1,
        ...(idx === 0 && sortedRes[0]
          ? {
              mediaTitle: sortedRes[0].title,
              mediaUrl: sortedRes[0].url,
              mediaType: sortedRes[0].type,
            }
          : {}),
        linkedAssignmentIds: groupAsg.map((a) => a.id),
        linkedResourceIds: idx === 0 ? sortedRes.map((r) => r.id).slice(0, 20) : [],
      }));
  }

  // Case 3: No assignments yet, but has real learning resources in this subject
  if (sortedRes.length > 0) {
    return sortedRes.slice(0, 20).map((res, idx) => ({
      id: `unit_auto_res_${idx + 1}`,
      title: `หน่วยที่ ${idx + 1}: ${res.title}`.slice(0, 200),
      description:
        res.description?.trim() ||
        `สื่อการเรียนรู้ประจำรายวิชา ${subject} (${res.gradeLevel})`,
      order: idx + 1,
      mediaTitle: res.title,
      mediaUrl: res.url,
      mediaType: res.type,
      linkedAssignmentIds: [],
      linkedResourceIds: [res.id],
    }));
  }

  // Case 4: Tech/Computing subject with no items yet -> use structured W22103 syllabus skeleton
  if (isTechSubject(subject)) {
    return W22103_CURRICULUM_PRESET.units.map((u, idx) => ({
      id: `unit_w22103_${idx + 1}`,
      title: u.title,
      description: u.description,
      order: idx + 1,
      linkedAssignmentIds: [],
      linkedResourceIds: [],
    }));
  }

  // Case 5: General subject configured in Settings with no items yet
  return [
    {
      id: 'unit_auto_starter_1',
      title: `หน่วยการเรียนรู้ที่ 1: บทนำรายวิชา ${subject}`.slice(0, 200),
      description: `หน่วยการเรียนรู้เริ่มต้นสำหรับรายวิชา ${subject} คุณครูสามารถเพิ่มสื่อการสอนและเชื่อมใบงานเข้ากับหน่วยนี้ได้`,
      order: 1,
      linkedAssignmentIds: [],
      linkedResourceIds: [],
    },
  ];
}

export function buildAutoSubjectClassrooms(params: {
  subjectsList: string[];
  assignments: Assignment[];
  resources: LearningResource[];
  teachingSchedules: TeachingSchedule[];
  teachersRoster: TeacherProfile[];
  existingClassrooms: SubjectClassroom[];
  currentTeacherName: string;
}): SubjectClassroom[] {
  const {
    subjectsList,
    assignments,
    resources,
    teachingSchedules,
    teachersRoster,
    existingClassrooms,
    currentTeacherName,
  } = params;

  const existingSubjects = new Set(existingClassrooms.map((c) => c.subject.trim()));
  const usedCodes = new Set(existingClassrooms.map((c) => c.courseCode.trim()));

  // Collect all unique subjects from settings + real assignments + real resources + teaching schedules
  const subjectSet = new Set<string>();
  subjectsList.forEach((s) => {
    const clean = s.trim();
    if (clean && clean !== 'ทั้งหมด') subjectSet.add(clean);
  });
  assignments.forEach((a) => {
    const clean = a.subject?.trim();
    if (clean && clean !== 'ทั้งหมด') subjectSet.add(clean);
  });
  resources.forEach((r) => {
    const clean = r.subject?.trim();
    if (clean && clean !== 'ทั้งหมด') subjectSet.add(clean);
  });
  teachingSchedules.forEach((t) => {
    const clean = t.subject?.trim();
    if (clean && clean !== 'ทั้งหมด') subjectSet.add(clean);
  });

  const nowIso = new Date().toISOString();
  const result: SubjectClassroom[] = [];
  let idx = 0;

  subjectSet.forEach((subj) => {
    if (existingSubjects.has(subj)) return;

    const subjAssignments = assignments.filter((a) => a.subject === subj);
    const subjResources = resources.filter((r) => r.subject === subj);
    const subjSchedules = teachingSchedules.filter((s) => s.subject === subj);

    const courseCode = inferCourseCode(subj, usedCodes, idx);
    const gradeLevel = inferGradeLevel(subjAssignments, subjSchedules, subjResources);
    const teacherName = inferTeacherName(
      subj,
      subjAssignments,
      subjSchedules,
      subjResources,
      teachersRoster,
      currentTeacherName
    );
    const units = buildUnitsFromExistingData(subj, subjAssignments, subjResources);

    const coverCandidate = subjResources.find((r) => r.thumbnailUrl?.trim())?.thumbnailUrl || '';

    const description =
      subjAssignments.length > 0 || subjResources.length > 0
        ? `ห้องเรียนรายวิชา ${subj} รวบรวมบทเรียนเป็นหน่วยการเรียนรู้ พร้อมใบงานเดิมในระบบ (${subjAssignments.length} ใบงาน) และสื่อประกอบการสอน (${subjResources.length} รายการ)`
        : isTechSubject(subj)
        ? W22103_CURRICULUM_PRESET.description
        : `ห้องเรียนออนไลน์ประจำวิชา ${subj} สำหรับจัดเก็บหน่วยการเรียนรู้ สื่อการสอน และใบงานประจำวิชา`;

    const objectives = isTechSubject(subj)
      ? W22103_CURRICULUM_PRESET.objectives
      : `1. เข้าใจสาระสำคัญและแนวคิดหลักของรายวิชา ${subj}\n2. ปฏิบัติกิจกรรมและส่งใบงานประจำหน่วยการเรียนรู้ได้ครบถ้วนตามกำหนด\n3. นำความรู้ไปประยุกต์ใช้ในการเรียนรู้และการแก้ปัญหาได้จริง`;

    result.push({
      id: `auto_cls_${idx}`,
      courseCode: courseCode.slice(0, 40),
      title: `ห้องเรียนวิชา ${subj}`.slice(0, 300),
      subject: subj.slice(0, 100),
      gradeLevel: gradeLevel.slice(0, 100),
      description: description.slice(0, 3000),
      objectives: objectives.slice(0, 3000),
      teacherName: teacherName.slice(0, 200),
      ...(coverCandidate ? { coverUrl: coverCandidate } : {}),
      units: units.slice(0, 50),
      isPublished: true,
      createdDate: nowIso,
      updatedDate: nowIso,
    });

    idx += 1;
  });

  return result;
}

export function materializeClassroomForSave(cls: SubjectClassroom, idx = 0): SubjectClassroom {
  const nowIso = new Date().toISOString();
  const safeId =
    cls.id && !cls.id.startsWith('auto_cls_') && /^[a-zA-Z0-9_-]+$/.test(cls.id)
      ? cls.id
      : `cls_${Date.now()}_${idx}`;

  return {
    ...cls,
    id: safeId.slice(0, 128),
    courseCode: (cls.courseCode || 'SUB-001').slice(0, 40),
    title: (cls.title || cls.subject).slice(0, 300),
    subject: cls.subject.slice(0, 100),
    gradeLevel: (cls.gradeLevel || 'ทั้งหมด').slice(0, 100),
    teacherName: (cls.teacherName || 'ครูผู้สอน').slice(0, 200),
    description: (cls.description || '').slice(0, 3000),
    ...(cls.objectives ? { objectives: cls.objectives.slice(0, 3000) } : {}),
    units: (cls.units || []).slice(0, 50),
    isPublished: cls.isPublished !== false,
    createdDate: cls.createdDate || nowIso,
    updatedDate: nowIso,
  };
}
