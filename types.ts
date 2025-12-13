
export interface Subject {
  id: string;
  schoolId?: string;
  name: string;
  color: string;
}

export interface Teacher {
  id: string;
  schoolId?: string;
  name: string;
  username: string;
  password?: string;
  assignedClasses: string[];
}

export interface Student {
  id: string;
  schoolId?: string;
  name: string;
  classId: string;
  parentPhone: string;
  absenceCount: number;
}

export interface ClassGroup {
  id: string;
  schoolId?: string;
  name: string;
  grade: string;
}

export interface ScheduleSlot {
  id?: string;
  schoolId?: string; // Added ownership
  classId: string;
  dayIndex: number;
  period: number;
  subjectId: string;
  teacherId: string;
}

export interface PlanEntry {
  id: string;
  schoolId?: string; // Added ownership
  classId: string;
  dayIndex: number;
  period: number;
  lessonTopic: string;
  homework: string;
  notes?: string;
}

export interface WeekInfo {
  startDate: string;
  endDate: string;
  weekNumber: string;
  semester: string;
}

export interface SchoolSettings {
  ministryName: string;
  authorityName: string;
  directorateName: string;
  schoolName: string;
  logoUrl: string;
  footerNotesLeft: string;
  footerNotesLeftImage?: string;
  footerNotesRight: string;
}

export interface AttendanceRecord {
  date: string;
  schoolId?: string; // Added ownership
  studentId: string;
  status: 'present' | 'absent' | 'excused';
  reportedBy?: string;
  timestamp?: string;
}

export interface ArchivedPlan {
  id: string;
  schoolId?: string; // Added ownership
  archivedDate: string;
  weekInfo: WeekInfo;
  entries: PlanEntry[];
  name: string;
  className: string;
}

export interface Message {
  id: string;
  schoolId?: string; // Added ownership
  senderId: string;
  senderName: string;
  receiverId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  type: 'announcement' | 'direct';
}

export interface PricingConfig {
    quarterly: number;
    annual: number;
    currency: string;
}
