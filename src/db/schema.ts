import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  doublePrecision,
  jsonb,
  timestamp,
  index,
} from 'drizzle-orm/pg-core';
import type {
  CourseUnitItem,
  GroupWorksheetSettings,
  PeriodConfig,
  Question,
  StudentAttendanceRecord,
  SubmissionFile,
  WorksheetGroup,
  WorksheetSection,
} from '../types/index.ts';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  role: text('role').notNull().default('teacher'),
  linkedCode: text('linked_code'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const appSettings = pgTable('app_settings', {
  id: text('id').primaryKey(),
  gradeLevels: jsonb('grade_levels').$type<string[]>().notNull().default([]),
  subjects: jsonb('subjects').$type<string[]>().notNull().default([]),
  periodConfigs: jsonb('period_configs').$type<PeriodConfig[] | null>(),
  studentGradebookEnabled: boolean('student_gradebook_enabled').notNull().default(true),
  gradebookDisabledRooms: jsonb('gradebook_disabled_rooms').$type<string[]>().notNull().default([]),
  schoolCoverUrl: text('school_cover_url').notNull().default(''),
  schoolName: text('school_name').notNull().default(''),
  schoolSubtitle: text('school_subtitle').notNull().default(''),
  themeColor: text('theme_color'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const students = pgTable(
  'students',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    password: text('password').notNull(),
    gradeLevel: text('grade_level').notNull(),
    avatar: text('avatar').notNull().default(''),
    email: text('email'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('students_code_idx').on(table.code)]
);

export const teachers = pgTable(
  'teachers',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull(),
    name: text('name').notNull(),
    password: text('password').notNull(),
    subject: text('subject').notNull(),
    avatar: text('avatar').notNull().default(''),
    email: text('email'),
    themeColor: text('theme_color'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (table) => [index('teachers_code_idx').on(table.code)]
);

export const assignments = pgTable('assignments', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  gradeLevel: text('grade_level').notNull(),
  category: text('category').notNull(),
  description: text('description').notNull().default(''),
  instructions: text('instructions').notNull().default(''),
  sections: jsonb('sections').$type<WorksheetSection[] | null>(),
  questions: jsonb('questions').$type<Question[]>().notNull().default([]),
  totalPoints: doublePrecision('total_points').notNull().default(10),
  dueDate: text('due_date').notNull(),
  createdDate: text('created_date').notNull(),
  teacherName: text('teacher_name').notNull(),
  attachmentUrl: text('attachment_url'),
  assignedStudentCodes: jsonb('assigned_student_codes').$type<string[] | null>(),
  isPublished: boolean('is_published').notNull().default(true),
  workMode: text('work_mode').default('individual'),
  groupSettings: jsonb('group_settings').$type<GroupWorksheetSettings | null>(),
  groups: jsonb('groups').$type<WorksheetGroup[] | null>(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const submissions = pgTable(
  'submissions',
  {
    id: text('id').primaryKey(),
    assignmentId: text('assignment_id').notNull(),
    studentId: text('student_id').notNull(),
    studentName: text('student_name').notNull(),
    studentCode: text('student_code').notNull(),
    gradeLevel: text('grade_level').notNull(),
    submissionDate: text('submission_date').notNull(),
    answers: jsonb('answers').$type<Record<string, string>>().notNull().default({}),
    answerImages: jsonb('answer_images').$type<Record<string, string> | null>(),
    files: jsonb('files').$type<SubmissionFile[] | null>(),
    status: text('status').notNull(),
    score: doublePrecision('score'),
    maxScore: doublePrecision('max_score').notNull().default(10),
    teacherComment: text('teacher_comment'),
    gradedAt: text('graded_at'),
    aiGraded: boolean('ai_graded'),
    groupId: text('group_id'),
    groupName: text('group_name'),
    groupMemberCodes: jsonb('group_member_codes').$type<string[] | null>(),
    lastEditedByName: text('last_edited_by_name'),
    lastEditedByCode: text('last_edited_by_code'),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (table) => [
    index('submissions_assignment_idx').on(table.assignmentId),
    index('submissions_student_code_idx').on(table.studentCode),
    index('submissions_group_idx').on(table.groupId),
  ]
);

export const resources = pgTable('resources', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  subject: text('subject').notNull(),
  gradeLevel: text('grade_level').notNull(),
  type: text('type').notNull(),
  url: text('url').notNull(),
  createdDate: text('created_date').notNull(),
  teacherName: text('teacher_name').notNull(),
  fileSize: text('file_size'),
  thumbnailUrl: text('thumbnail_url'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const teachingSchedules = pgTable('teaching_schedules', {
  id: text('id').primaryKey(),
  teacherId: text('teacher_id').notNull(),
  teacherCode: text('teacher_code').notNull(),
  teacherName: text('teacher_name').notNull(),
  dayOfWeek: text('day_of_week').notNull(),
  period: integer('period').notNull(),
  endPeriod: integer('end_period'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  subject: text('subject').notNull(),
  gradeLevel: text('grade_level').notNull(),
  classroom: text('classroom'),
  note: text('note'),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const attendanceSessions = pgTable('attendance_sessions', {
  id: text('id').primaryKey(),
  scheduleId: text('schedule_id'),
  date: text('date').notNull(),
  dayOfWeek: text('day_of_week').notNull(),
  period: integer('period').notNull(),
  endPeriod: integer('end_period'),
  startTime: text('start_time'),
  endTime: text('end_time'),
  subject: text('subject').notNull(),
  gradeLevel: text('grade_level').notNull(),
  teacherId: text('teacher_id').notNull(),
  teacherCode: text('teacher_code').notNull(),
  teacherName: text('teacher_name').notNull(),
  topicTaught: text('topic_taught'),
  records: jsonb('records').$type<StudentAttendanceRecord[]>().notNull().default([]),
  updatedAt: text('updated_at').notNull(),
});

export const subjectClassrooms = pgTable('subject_classrooms', {
  id: text('id').primaryKey(),
  courseCode: text('course_code').notNull(),
  title: text('title').notNull(),
  subject: text('subject').notNull(),
  gradeLevel: text('grade_level').notNull(),
  description: text('description').notNull().default(''),
  objectives: text('objectives'),
  teacherName: text('teacher_name').notNull(),
  coverUrl: text('cover_url'),
  units: jsonb('units').$type<CourseUnitItem[]>().notNull().default([]),
  isPublished: boolean('is_published').notNull().default(true),
  createdDate: text('created_date').notNull(),
  updatedDate: text('updated_date'),
});
