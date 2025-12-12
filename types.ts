
export interface Subject {
  id: string;
  name: string;
  color: string;
}

export interface Teacher {
  id: string;
  name: string;
  username: string; // Will be used as login ID
  password?: string; // New field for simple auth
  assignedClasses: string[]; // Class IDs
}

export interface Student {
  id: string;
  name: string;
  classId: string;
  parentPhone: string;
  absenceCount: number;
}

export interface ClassGroup {
  id: string;
  name: string; // e.g., "ثالث - أ"
  grade: string;
}

export interface ScheduleSlot {
  id?: string;
  classId: string; // Link slot to a specific class
  dayIndex: number; // 0 = Sunday, 1 = Monday, etc.
  period: number; // 1 to 7
  subjectId: string;
  teacherId: string;
}

export interface PlanEntry {
  id: string;
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
  footerNotesLeft: string; // The "Notes" section (Text)
  footerNotesLeftImage?: string; // The "Notes" section (Image)
  footerNotesRight: string; // The "Other Notes/General Messages" section
}

// Attendance record for a specific date
export interface AttendanceRecord {
  date: string; // ISO Date string YYYY-MM-DD
  studentId: string;
  status: 'present' | 'absent' | 'excused';
  reportedBy?: string; // Teacher Name
  timestamp?: string;
}

export interface ArchivedPlan {
  id: string;
  archivedDate: string;
  weekInfo: WeekInfo;
  entries: PlanEntry[];
  name: string;
  className: string;
}

export interface Message {
  id: string;
  senderId: string; // 'admin' or teacherId
  senderName: string;
  receiverId: string; // 'admin', 'all', or teacherId
  content: string;
  timestamp: string;
  isRead: boolean;
  type: 'announcement' | 'direct';
}
