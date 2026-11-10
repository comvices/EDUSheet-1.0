export type QuestionType = 'text' | 'multiple_choice' | 'fill_blank' | 'file_upload';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options?: string[];
  maxPoints: number;
  answerKey?: string;
  hint?: string;
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

export interface FilterState {
  search: string;
  subject: string;
  gradeLevel: string;
  status: string;
  category: string;
  dateSort: 'due_soon' | 'newest' | 'points';
}
