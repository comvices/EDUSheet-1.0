export type QuestionType = 'text' | 'multiple_choice' | 'fill_blank' | 'file_upload';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  maxPoints: number;
  answerKey?: string;
  hint?: string;
  imageUrl?: string;
}

export type CategoryType = 'แบบฝึกหัด' | 'ใบงานเติมคำ' | 'ข้อสอบ/แบบทดสอบ' | 'รายงาน/เรียงความ';

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  gradeLevel: string; // e.g. "ม.3", "ป.6"
  category: CategoryType;
  description: string;
  instructions: string;
  questions: Question[];
  totalPoints: number;
  dueDate: string; // ISO string or YYYY-MM-DDTHH:mm
  createdDate: string;
  teacherName: string;
  attachmentUrl?: string;
  assignedStudentCodes?: string[]; // ถ้าระบุ จะให้นักเรียนที่มีรหัสตรงกันเท่านั้นที่เห็นใบงานนี้
  isPublished?: boolean; // หากเป็น false จะซ่อนใบงานจากนักเรียนทั้งหมด (ฉบับร่าง)
}

export type SubmissionStatus = 'pending' | 'submitted' | 'graded' | 'needs_revision' | 'overdue';

export interface SubmissionFile {
  name: string;
  url: string;
  size: string;
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  gradeLevel: string;
  submissionDate: string;
  answers: Record<string, string>; // questionId -> answer text or selected option
  answerImages?: Record<string, string>; // questionId -> compressed image data URL or URL
  files?: SubmissionFile[];
  status: SubmissionStatus;
  score?: number;
  maxScore: number;
  teacherComment?: string;
  gradedAt?: string;
  aiGraded?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  date: string;
  type: 'due_soon' | 'graded' | 'revision' | 'new_assignment' | 'overdue';
  isRead: boolean;
  assignmentId: string;
}

export type UserRole = 'student' | 'teacher';

export interface StudentProfile {
  id: string;
  name: string;
  code: string; // เลขประจำตัวนักเรียน
  password: string; // รหัสผ่าน
  gradeLevel: string;
  avatar: string;
  email?: string;
}

export interface TeacherProfile {
  id: string;
  name: string;
  code: string; // เลขประจำตัวครู
  password: string;
  subject: string;
  avatar: string;
}

export type ResourceType = 'video' | 'document' | 'link' | 'slide';

export interface LearningResource {
  id: string;
  title: string;
  description: string;
  subject: string;
  gradeLevel: string; // e.g. "ม.1/1", "ม.1", "ทั้งหมด"
  type: ResourceType;
  url: string;
  createdDate: string;
  teacherName: string;
  fileSize?: string;
  thumbnailUrl?: string;
}

export interface CourseUnitItem {
  id: string;
  title: string;
  description?: string;
  order: number;
  mediaTitle?: string;
  mediaUrl?: string;
  mediaType?: ResourceType;
  linkedAssignmentIds?: string[];
  linkedResourceIds?: string[];
}

export interface SubjectClassroom {
  id: string;
  courseCode: string;
  title: string;
  subject: string;
  gradeLevel: string;
  description: string;
  objectives?: string;
  teacherName: string;
  coverUrl?: string;
  units: CourseUnitItem[];
  isPublished?: boolean;
  createdDate: string;
  updatedDate?: string;
}

export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday';

export interface PeriodConfig {
  id: string;
  period: number; // 0 = คาบพักเที่ยง/คาบพัก, 1-12 = คาบเรียน
  label: string; // ชื่อแสดงผล เช่น "คาบที่ 1", "พักเที่ยง", "คาบที่ 5"
  startTime: string; // e.g. "08:30"
  endTime: string; // e.g. "09:20"
  isBreak?: boolean; // true สำหรับคาบพักเที่ยง / คาบพัก
}

export interface TeachingSchedule {
  id: string;
  teacherId: string;
  teacherCode: string;
  teacherName: string;
  dayOfWeek: DayOfWeek;
  period: number; // คาบที่ 0 - 12 (0 = คาบพัก/กิจกรรมพักเที่ยง)
  endPeriod?: number; // กรณีสอนควบหลายคาบติดกัน เช่น 1 ถึง 2 (หากสอนคาบเดียวไม่ระบุหรือเท่ากับ period)
  startTime: string; // e.g. "08:30"
  endTime: string; // e.g. "09:20"
  subject: string;
  gradeLevel: string; // e.g. "ม.3/1"
  classroom?: string; // e.g. "ห้อง 301" หรือ "ห้องวิทย์ 2"
  note?: string;
}

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave';

export interface StudentAttendanceRecord {
  studentId: string;
  studentCode: string;
  studentName: string;
  gradeLevel: string;
  status: AttendanceStatus;
  note?: string;
}

export interface AttendanceSession {
  id: string;
  scheduleId?: string; // อ้างอิงจากตารางสอน (ถ้าเป็นการเช็คชื่อในตาราง)
  date: string; // YYYY-MM-DD
  dayOfWeek: DayOfWeek;
  period: number;
  endPeriod?: number; // กรณีเช็คชื่อครั้งเดียวครอบคลุมหลายคาบติดกัน
  startTime?: string;
  endTime?: string;
  subject: string;
  gradeLevel: string;
  teacherId: string;
  teacherCode: string;
  teacherName: string;
  topicTaught?: string; // หัวข้อที่สอนในคาบนี้
  records: StudentAttendanceRecord[];
  updatedAt: string;
}

export interface FilterState {
  search: string;
  subject: string;
  gradeLevel: string;
  status: string;
  category: string;
  dateSort: 'due_soon' | 'newest' | 'points';
}
