import React, { useState, useEffect, useRef } from 'react';
import { ClassGroup, Student, PlanEntry, ScheduleSlot, WeekInfo, Teacher, ArchivedPlan, ArchivedAttendance, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from '../types';
import WeeklyPlanTemplate from './WeeklyPlanTemplate';
import AttendanceReportTemplate from './AttendanceReportTemplate';
import InvoiceModal from './InvoiceModal';
import { Users, FileText, Calendar, Printer, Share2, UploadCloud, CheckCircle, XCircle, Plus, Trash2, Edit2, Save, Archive, History, Grid, BookOpen, Settings, Book, Eraser, Image as ImageIcon, UserCheck, MessageSquare, Send, Bell, Key, AlertCircle, GraduationCap, ChevronLeft, LayoutDashboard, Search, X, Eye, Copy, User, Filter, BarChart3, CreditCard, Lock, Download, Loader2, AlertTriangle, FileArchive, Link as LinkIcon } from 'lucide-react';
import { DAYS_OF_WEEK } from '../services/data';
import { sendActivationEmail } from '../services/emailService';
import * as XLSX from 'xlsx';

// --- Styles ---
const inputModernClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-400 text-sm font-medium";
const labelModernClass = "block text-xs font-bold text-slate-500 mb-1.5 mr-1";
const btnPrimaryClass = "bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95";
const btnSecondaryClass = "px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 border border-transparent";
const inputTableClass = "w-full border border-indigo-300 rounded px-2 py-1 outline-none text-sm focus:ring-2 focus:ring-indigo-100";

interface SchoolMetadata {
    id: string;
    name: string;
    subscriptionEnd: string;
    plan: string;
    isActive: boolean;
    activationCode: string; // Included for demo purposes
    email?: string; // Needed for renewal email
}

interface AdminDashboardProps {
  classes: ClassGroup[];
  weekInfo: WeekInfo;
  setWeekInfo: (info: WeekInfo) => void;
  schoolSettings: SchoolSettings;
  setSchoolSettings: (settings: SchoolSettings) => void;
  schedule: ScheduleSlot[];
  planEntries: PlanEntry[];
  teachers: Teacher[];
  students: Student[];
  subjects: Subject[];
  onSetSubjects: (subjects: Subject[]) => void;
  onSetStudents: (students: Student[]) => void;
  onSetClasses: (classes: ClassGroup[]) => void;
  onAddTeacher: (t: Teacher) => void;
  onUpdateTeacher: (t: Teacher) => void;
  onDeleteTeacher: (id: string) => void;
  onArchivePlan: (name: string, week: WeekInfo, entries: PlanEntry[]) => void;
  onClearPlans: () => void;
  archivedPlans: ArchivedPlan[];
  onDeleteArchive?: (id: string) => void;
  onAddClass: (c: ClassGroup) => void;
  onUpdateSchedule: (s: ScheduleSlot) => void;
  attendanceRecords: AttendanceRecord[];
  onMarkAttendance: (record: AttendanceRecord) => void;
  messages: Message[];
  onSendMessage: (msg: Message) => void;
  // Subscription Props
  schoolMetadata?: SchoolMetadata;
  onRenewSubscription?: (plan: string, code: string) => Promise<boolean> | boolean;
  pricing?: PricingConfig;
  schoolId: string; // New Prop for Data Ownership
  onResetSystem?: () => void; // New Prop for Resetting
  // Attendance Archive Props
  archivedAttendanceLogs?: ArchivedAttendance[];
  onArchiveAttendance?: (log: ArchivedAttendance) => void;
  onDeleteAttendanceArchive?: (id: string) => void;
}

const COLORS = [
    { label: 'أحمر', value: 'bg-red-50 border-red-200 text-red-800' },
    { label: 'أزرق', value: 'bg-blue-50 border-blue-200 text-blue-800' },
    { label: 'أخضر', value: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
    { label: 'أصفر', value: 'bg-amber-50 border-amber-200 text-amber-800' },
    { label: 'بنفسجي', value: 'bg-violet-50 border-violet-200 text-violet-800' },
    { label: 'رمادي', value: 'bg-slate-50 border-slate-200 text-slate-800' },
    { label: 'برتقالي', value: 'bg-orange-50 border-orange-200 text-orange-800' },
    { label: 'وردي', value: 'bg-pink-50 border-pink-200 text-pink-800' },
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  classes,
  weekInfo,
  setWeekInfo,
  schoolSettings,
  setSchoolSettings,
  schedule,
  planEntries,
  teachers,
  students,
  subjects,
  onSetSubjects,
  onSetStudents,
  onSetClasses,
  onAddTeacher,
  onUpdateTeacher,
  onDeleteTeacher,
  onArchivePlan,
  onClearPlans,
  archivedPlans,
  onDeleteArchive,
  onAddClass,
  onUpdateSchedule,
  attendanceRecords,
  onMarkAttendance,
  messages,
  onSendMessage,
  schoolMetadata,
  onRenewSubscription,
  pricing = { quarterly: 100, annual: 300, currency: 'SAR' },
  schoolId, // Destructure schoolId
  onResetSystem,
  archivedAttendanceLogs = [],
  onArchiveAttendance,
  onDeleteAttendanceArchive
}) => {
  // Check Frozen Status
  const isExpired = schoolMetadata ? new Date(schoolMetadata.subscriptionEnd) < new Date() : false;
  const isFrozen = isExpired || (schoolMetadata ? !schoolMetadata.isActive : false);

  // Added 'students' as a separate tab
  const [activeTab, setActiveTab] = useState<'plan' | 'attendance' | 'setup' | 'archive' | 'classes' | 'messages' | 'students'>('students');
  
  // Archive View State
  const [archiveViewType, setArchiveViewType] = useState<'weekly_plans' | 'attendance'>('weekly_plans');

  // Force Settings tab if frozen
  useEffect(() => {
      if (isFrozen) {
          setActiveTab('setup');
      }
  }, [isFrozen]);

  // Print Mode State
  const [printMode, setPrintMode] = useState<'master' | 'students'>('master');
  
  // Safe Class Selection
  const hasClasses = classes && classes.length > 0;
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Update selected class if it becomes invalid or empty, BUT preserve selection if valid
  useEffect(() => {
    if (hasClasses) {
        // Only reset if the currently selected ID doesn't exist in the new classes list
        if (!selectedClassId || !classes.find(c => c.id === selectedClassId)) {
            setSelectedClassId(classes[0].id);
        }
    } else {
        setSelectedClassId('');
    }
  }, [classes, hasClasses]); // Removed selectedClassId from deps to prevent loop resets

  const activeClass = hasClasses ? classes.find(c => c.id === selectedClassId) || classes[0] : null;
  const classStudents = activeClass ? students.filter(s => s.classId === activeClass.id) : [];

  // Local UI States
  const [importLoading, setImportLoading] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Student CRUD State
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({ name: '', parentPhone: '', classId: '' });

  // Teacher CRUD State
  const [teacherForm, setTeacherForm] = useState({ name: '', username: '', password: '' });
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [teacherEditForm, setTeacherEditForm] = useState({ name: '', username: '', password: '' });

  // Subject Add State
  const [subjectForm, setSubjectForm] = useState({ name: '', color: 'bg-slate-50 border-slate-200 text-slate-800' });

  // Class Add State
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('');

  // Schedule Edit State
  const [editingSlot, setEditingSlot] = useState<{dayIndex: number, period: number} | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ subjectId: '', teacherId: '' });

  // Messaging State
  const [msgFilter, setMsgFilter] = useState<string>('all'); // 'all' for broadcasts, or teacherId
  const [newMessageText, setNewMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Archive Viewing State
  const [viewingArchive, setViewingArchive] = useState<ArchivedPlan | null>(null);
  const [viewingAttendanceArchive, setViewingAttendanceArchive] = useState<ArchivedAttendance | null>(null);

  // Attendance Printing State
  const [printAttendanceClass, setPrintAttendanceClass] = useState<ClassGroup | null>(null);

  // Search Terms
  const [studentSearch, setStudentSearch] = useState('');

  // Subscription Logic
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewPlan, setRenewPlan] = useState<'quarterly' | 'annual'>('quarterly');
  const [renewStep, setRenewStep] = useState(1); // 1: Invoice, 2: Code
  const [activationCodeInput, setActivationCodeInput] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);

  // --- Excel Import Logic ---
  const handleNoorImportClick = () => { fileInputRef.current?.click(); };
  
  const handleDownloadTemplate = () => { 
      const wb = XLSX.utils.book_new();
      const wsData = [
          { "اسم الطالب": "مثال: محمد عبدالله", "رقم ولي الأمر": "0500000000", "الفصل": "1", "رقم الصف": "الأول الابتدائي" },
          { "اسم الطالب": "مثال: خالد علي", "رقم ولي الأمر": "0555555555", "الفصل": "2", "رقم الصف": "الأول الابتدائي" }
      ];
      const ws = XLSX.utils.json_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Students");
      XLSX.writeFile(wb, "madrasti_students_template.xlsx");
  };

  const processNoorFile = async (e: React.ChangeEvent<HTMLInputElement>) => { 
      const file = e.target.files?.[0];
      if (!file) return;

      setImportLoading(true);
      try {
          const data = await file.arrayBuffer();
          const workbook = XLSX.read(data);
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          
          // Use 'any' type for flexible row data structure
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
          
          const newStudents: Student[] = [];
          const newClassesToAdd: ClassGroup[] = [];
          // Copy existing classes to keep track of what we have (including newly created ones in this loop)
          const currentClasses = [...classes];

          let createdClassesCount = 0;
          
          jsonData.forEach((row, index) => {
              // 1. Extract Name (Supports common headers)
              const name = row['اسم الطالب'] || row['Name'] || row['name'] || row['Student Name'];
              
              if (name) {
                  // 2. Extract and Clean Phone
                  let phone = row['الجوال'] || row['رقم ولي الأمر'] || row['Phone'] || row['Mobile'] || '';
                  phone = phone.toString().trim();
                  // Smart Clean: Replace 966 start with 0
                  if (phone.startsWith('966')) {
                      phone = '0' + phone.substring(3);
                  }

                  // 3. Extract Class Info (Smart Detection)
                  // Looks for "رقم الصف" (Grade Name) and "الفصل" (Section Number)
                  const gradeName = row['رقم الصف'] || row['الصف'] || row['Grade'] || '';
                  const sectionNum = row['الفصل'] || row['Class'] || row['Section'] || '';
                  
                  // Construct a unique Class Name: e.g., "الأول الابتدائي (1)"
                  let targetClassName = '';
                  if (gradeName && sectionNum) {
                      targetClassName = `${gradeName} (${sectionNum})`;
                  } else if (gradeName) {
                      targetClassName = gradeName;
                  } else if (sectionNum) {
                      targetClassName = `فصل ${sectionNum}`;
                  } else {
                      // Fallback: If no class info, assume unassigned or skip
                      // But for "Smart" import, let's try to put them in a generic class if totally missing
                      targetClassName = 'طلاب مستجدين'; 
                  }

                  // 4. Find or Create Class
                  let targetClass = currentClasses.find(c => c.name.trim() === targetClassName.trim());

                  if (!targetClass) {
                      // Create new class automatically
                      const newClassId = `c_imp_${Date.now()}_${createdClassesCount}_${Math.random().toString(36).substr(2, 4)}`;
                      const newClassObj: ClassGroup = {
                          id: newClassId,
                          schoolId: schoolId,
                          name: targetClassName,
                          grade: gradeName || 'عام'
                      };
                      
                      newClassesToAdd.push(newClassObj);
                      currentClasses.push(newClassObj); // Add to local tracker for subsequent rows
                      targetClass = newClassObj;
                      createdClassesCount++;
                  }

                  // 5. Check for Student Duplicates (in existing list AND new list)
                  const existsInCurrent = students.some(s => s.name === name && s.classId === targetClass!.id);
                  const existsInNew = newStudents.some(s => s.name === name && s.classId === targetClass!.id);

                  if (!existsInCurrent && !existsInNew) {
                      newStudents.push({
                          id: `s_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
                          schoolId: schoolId,
                          name: name.toString().trim(),
                          parentPhone: phone,
                          classId: targetClass!.id,
                          absenceCount: 0
                      });
                  }
              }
          });

          // Update State
          if (newClassesToAdd.length > 0) {
              onSetClasses([...classes, ...newClassesToAdd]);
          }
          
          if (newStudents.length > 0) {
              onSetStudents([...students, ...newStudents]);
              alert(`تمت العملية بذكاء:\n- تم استيراد ${newStudents.length} طالب.\n- تم إنشاء ${newClassesToAdd.length} فصل جديد تلقائياً.`);
          } else {
              alert('لم يتم العثور على بيانات جديدة لاستيرادها (ربما البيانات مكررة أو الملف فارغ).');
          }

      } catch (error) {
          console.error("Import Error:", error);
          alert('حدث خطأ أثناء قراءة الملف. تأكد أنه ملف Excel صالح.');
      } finally {
          setImportLoading(false);
          if (fileInputRef.current) fileInputRef.current.value = ''; // Reset input to allow re-upload
      }
  };

  // ... (Other handlers remain unchanged)
  // Re-declare handleClearStudents etc. for completeness since they were inside scope
  const handleClearStudents = () => {
    if (students.length === 0) { alert('لا يوجد طلاب لحذفهم.'); return; }
    if (window.confirm('تحذير: سيتم حذف جميع الطلاب المسجلين في النظام. هل أنت متأكد؟\n(لن يتم حذف الفصول أو الجداول)')) {
        onSetStudents([]); alert('تم حذف جميع الطلاب بنجاح.');
    }
  };
  const handleManualSaveSettings = () => { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 3000); };
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
  const handleAddSubject = () => { if(!subjectForm.name) return; onSetSubjects([...subjects, { id: `sub_${Date.now()}`, schoolId: schoolId, name: subjectForm.name, color: subjectForm.color }]); setSubjectForm({ name: '', color: 'bg-slate-50 border-slate-200 text-slate-800' }); };
  const handleDeleteSubject = (id: string) => { if(window.confirm('هل أنت متأكد من حذف هذه المادة؟')) onSetSubjects(subjects.filter(s => s.id !== id)); };
  const handleAddClass = () => { if(!newClassName) return; const newClass = { id: `c_${Date.now()}`, schoolId: schoolId, name: newClassName, grade: newClassGrade || 'عام' }; onAddClass(newClass); setNewClassName(''); setNewClassGrade(''); setSelectedClassId(newClass.id); };
  const openScheduleEdit = (dayIndex: number, period: number) => { if (!selectedClassId) return; const existing = schedule.find(s => s.classId === selectedClassId && s.dayIndex === dayIndex && s.period === period); setScheduleForm({ subjectId: existing?.subjectId || '', teacherId: existing?.teacherId || '' }); setEditingSlot({ dayIndex, period }); };
  const saveScheduleSlot = () => { if(editingSlot && scheduleForm.subjectId && scheduleForm.teacherId && selectedClassId) { onUpdateSchedule({ classId: selectedClassId, dayIndex: editingSlot.dayIndex, period: editingSlot.period, subjectId: scheduleForm.subjectId, teacherId: scheduleForm.teacherId }); setEditingSlot(null); } };
  const handleAddStudent = () => { if (!studentForm.name) return; onSetStudents([...students, { id: Date.now().toString(), schoolId: schoolId, name: studentForm.name, parentPhone: studentForm.parentPhone, classId: studentForm.classId || selectedClassId, absenceCount: 0 }]); setStudentForm({ name: '', parentPhone: '', classId: '' }); setIsAddingStudent(false); };
  const handleDeleteStudent = (id: string) => { if (window.confirm('هل أنت متأكد من حذف الطالب؟')) onSetStudents(students.filter(s => s.id !== id)); };
  const startEditStudent = (student: Student) => { setEditingStudentId(student.id); setStudentForm({ name: student.name, parentPhone: student.parentPhone, classId: student.classId }); };
  const saveEditStudent = () => { onSetStudents(students.map(s => s.id === editingStudentId ? { ...s, name: studentForm.name, parentPhone: studentForm.parentPhone, classId: studentForm.classId } : s)); setEditingStudentId(null); setStudentForm({ name: '', parentPhone: '', classId: '' }); };
  const handleCreateTeacher = () => { if (!teacherForm.name || !teacherForm.password) { alert("الرجاء إدخال الاسم وكلمة المرور"); return; } onAddTeacher({ id: `t_${Date.now()}`, schoolId: schoolId, name: teacherForm.name, username: teacherForm.username || teacherForm.name.replace(/\s/g, '').toLowerCase(), password: teacherForm.password, assignedClasses: [] }); setTeacherForm({ name: '', username: '', password: '' }); alert("تم إضافة المعلم بنجاح"); };
  const handleDeleteTeacher = (id: string) => { if(window.confirm('هل أنت متأكد؟')) onDeleteTeacher(id); };
  const startEditTeacher = (teacher: Teacher) => { setEditingTeacherId(teacher.id); setTeacherEditForm({ name: teacher.name, username: teacher.username, password: teacher.password || '' }); };
  const saveEditTeacher = () => { const teacher = teachers.find(t => t.id === editingTeacherId); if(teacher) onUpdateTeacher({ ...teacher, name: teacherEditForm.name, username: teacherEditForm.username, password: teacherEditForm.password }); setEditingTeacherId(null); };
  const handleArchiveClick = () => { if (!activeClass) return; onArchivePlan(`${activeClass.name} - ${weekInfo.weekNumber}`, weekInfo, planEntries.filter(e => e.classId === selectedClassId)); alert('تم أرشفة الخطة الحالية بنجاح'); };
  const handlePrint = () => { window.print(); };
  const handleAdminSendMessage = () => { if(!newMessageText.trim()) return; onSendMessage({ id: `msg_${Date.now()}`, senderId: 'admin', senderName: 'الإدارة', receiverId: msgFilter, content: newMessageText, timestamp: new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'}), isRead: false, type: msgFilter === 'all' ? 'announcement' : 'direct' }); setNewMessageText(''); };
  const getFilteredMessages = () => { return messages.filter(m => { if (msgFilter === 'all') return m.receiverId === 'all' || m.receiverId === 'admin'; return (m.senderId === 'admin' && m.receiverId === msgFilter) || (m.senderId === msgFilter && m.receiverId === 'admin'); }).sort((a,b) => a.id.localeCompare(b.id)); };
  useEffect(() => { if (activeTab === 'messages' && messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeTab, msgFilter]);
  const filteredStudents = classStudents.filter(s => s.name.includes(studentSearch));
  const tabs = [ { id: 'students', label: 'الطلاب', icon: GraduationCap }, { id: 'classes', label: 'الفصول والجداول', icon: Grid }, { id: 'plan', label: 'الخطة الحالية', icon: FileText }, { id: 'attendance', label: 'الغياب', icon: Users }, { id: 'messages', label: 'الرسائل', icon: MessageSquare }, { id: 'setup', label: 'الإعدادات', icon: Settings }, { id: 'archive', label: 'الأرشيف', icon: History } ];

  // --- RENEWAL LOGIC ---
  const handleRenewClick = (plan: 'quarterly' | 'annual') => {
      setRenewPlan(plan);
      setShowRenewModal(true);
      setRenewStep(1);
  };

  const handlePaymentConfirm = async () => {
     if (!schoolMetadata) return;
     
     setIsSendingCode(true);
     try {
         const renewalCode = schoolMetadata.activationCode; 
         await sendActivationEmail(schoolMetadata.email || 'manager@school.com', schoolSettings.schoolName, renewalCode, 'renewal');
         setIsSendingCode(false);
         setRenewStep(2);
         alert(`تم إرسال كود التفعيل إلى البريد الإلكتروني (لأغراض الاختبار: ${renewalCode})`);
     } catch (e) {
         alert('فشل إرسال كود التفعيل.');
         setIsSendingCode(false);
     }
  };

  const handleRenewCodeSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (onRenewSubscription) {
          const success = await onRenewSubscription(renewPlan, activationCodeInput);
          if (success) {
              alert('تم تجديد الاشتراك بنجاح!');
              setShowRenewModal(false);
              setActivationCodeInput('');
          } else {
              alert('كود التفعيل غير صحيح.');
          }
      }
  };

  const handleResetSchoolData = () => {
      if (window.confirm('تحذير خطير: سيتم حذف جميع بيانات المدرسة (طلاب، فصول، معلمين، جداول، خطط، سجلات). هل أنت متأكد؟')) {
          if (window.confirm('تأكيد نهائي: لا يمكن التراجع عن هذه الخطوة. سيتم تصفير النظام بالكامل. هل تريد الاستمرار؟')) {
              if (onResetSystem) {
                  onResetSystem();
                  alert('تم مسح جميع البيانات وإعادة تعيين النظام بنجاح.');
              }
          }
      }
  };

  const handleArchiveDailyAttendance = () => {
      const absentRecords = attendanceRecords.filter(r => r.date === attendanceDate && r.status === 'absent');
      const totalAbsent = absentRecords.length;
      
      if (!onArchiveAttendance) {
          alert('خاصية أرشفة الغياب غير متوفرة حالياً.');
          return;
      }

      const newArchive: ArchivedAttendance = {
          id: `att_arch_${Date.now()}`,
          schoolId: schoolId,
          reportDate: attendanceDate,
          archivedAt: new Date().toLocaleTimeString('ar-SA'),
          absentStudents: absentRecords.map(r => {
              const s = students.find(st => st.id === r.studentId);
              const c = classes.find(cl => cl.id === s?.classId);
              return {
                  id: s?.id || 'unknown',
                  name: s?.name || 'Unknown',
                  className: c?.name || 'Unknown',
                  parentPhone: s?.parentPhone || ''
              };
          })
      };

      onArchiveAttendance(newArchive);
      alert(`تم أرشفة سجل الغياب ليوم ${attendanceDate} بنجاح.`);
  };

  // --- Share Public Class Link ---
  const handleShareClass = (classId: string, className: string) => {
      const link = `${window.location.origin}?school=${schoolId}&classShare=${classId}`;
      navigator.clipboard.writeText(link);
      alert(`تم نسخ رابط الخطط للفصل: ${className}\n\n${link}`);
  };

  return (
    <div className="w-full bg-slate-50 min-h-screen">
      {/* Hidden File Input for CSV Import */}
      <input type="file" ref={fileInputRef} onChange={processNoorFile} className="hidden" accept=".csv,.xlsx,.xls" />

      {/* FREEZE BANNER */}
      {isFrozen && (
          <div className="bg-red-600 text-white p-4 text-center sticky top-0 z-[60] shadow-lg animate-slideDown">
              <div className="container mx-auto flex items-center justify-center gap-3">
                  <Lock className="animate-pulse" />
                  <p className="font-bold">
                      تم تجميد خصائص النظام بسبب {isExpired ? 'انتهاء الاشتراك' : 'عدم التفعيل'}. 
                      يرجى تجديد الاشتراك من قسم الإعدادات أدناه لاستعادة الصلاحيات.
                  </p>
              </div>
          </div>
      )}

      {/* Admin Navigation */}
      <div className={`sticky top-0 z-50 pt-4 px-4 pb-2 no-print ${isFrozen ? 'top-14 pointer-events-none opacity-50' : ''}`}>
        <div className="max-w-7xl mx-auto bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-slate-200/60 p-2 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    // Disable all tabs except 'setup' if frozen
                    const isDisabled = isFrozen && tab.id !== 'setup';
                    const isActive = activeTab === tab.id;
                    
                    return (
                        <button 
                            key={tab.id} 
                            onClick={() => !isDisabled && setActiveTab(tab.id as any)} 
                            disabled={isDisabled}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-sm ${isActive ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'} ${isDisabled ? 'opacity-50 cursor-not-allowed bg-slate-100 text-slate-400' : 'pointer-events-auto'}`}
                        >
                            <Icon size={18} /> {tab.label} {isDisabled && <Lock size={12} className="ml-1"/>}
                        </button>
                    )
                })}
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`max-w-7xl mx-auto px-4 print:max-w-none print:px-0 pb-20 pt-6 ${isFrozen && activeTab !== 'setup' ? 'opacity-30 pointer-events-none' : ''}`}>
        
        {/* GLOBAL CLASS SELECTOR (Skipped for Archive, Messages, Setup, Attendance) */}
        {activeTab !== 'archive' && activeTab !== 'messages' && activeTab !== 'setup' && activeTab !== 'attendance' && (
            <div className="mb-8 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4 no-print animate-slideDown">
                <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600"><LayoutDashboard size={24} /></div>
                <div><h2 className="text-lg font-bold text-slate-800">لوحة التحكم النشطة</h2><p className="text-xs text-slate-500">اختر الفصل لعرض بياناته</p></div>
                <div className="mr-auto flex items-center gap-4 w-full md:w-auto">
                    {hasClasses ? (
                        <div className="relative w-full md:w-64">
                            <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-full appearance-none bg-slate-50 border-2 border-slate-200 hover:border-indigo-300 rounded-xl px-4 py-3 pr-10 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50 transition-all cursor-pointer">
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16}/>
                        </div>
                    ) : (
                        <span className="text-rose-500 font-bold text-sm bg-rose-50 px-4 py-2 rounded-lg border border-rose-100"><AlertCircle className="inline-block ml-2" size={16}/> لا يوجد فصول</span>
                    )}
                </div>
            </div>
        )}
        
        {/* ... (STUDENTS TAB) ... */}
        {activeTab === 'students' && (
             <div className="space-y-6 animate-fadeIn">
                 {/* ... content ... */}
                 {/* (Included in previous response, keeping it brief here to focus on requested changes) */}
                 <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                        <div>
                            <h2 className="text-3xl font-extrabold mb-2">الطلاب</h2>
                            <p className="text-indigo-100 text-sm max-w-md leading-relaxed opacity-90">إدارة بيانات الطلاب، الاستيراد من نظام نور، وتوزيعهم على الفصول بشكل تلقائي وذكي.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                             <button onClick={handleDownloadTemplate} className="bg-indigo-700/50 backdrop-blur-md text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-800/60 transition-all border border-indigo-400/30 flex items-center gap-2" title="تحميل قالب Excel">
                                <Download size={20} />
                             </button>
                             <button onClick={handleNoorImportClick} disabled={importLoading} className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-lg flex items-center gap-2">
                                {importLoading ? <div className="loader w-4 h-4 border-indigo-600"></div> : <UploadCloud size={20}/>} استيراد (Excel/CSV)
                             </button>
                             <button onClick={() => setIsAddingStudent(!isAddingStudent)} className="bg-indigo-400/30 backdrop-blur-md text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-400/40 transition-all flex items-center gap-2 border border-white/20"><Plus size={20}/> إضافة يدوي</button>
                             <button onClick={handleClearStudents} className="bg-rose-500/80 backdrop-blur-md text-white px-4 py-3 rounded-xl font-bold hover:bg-rose-600/90 transition-all flex items-center gap-2" title="حذف الكل"><Trash2 size={20}/></button>
                        </div>
                    </div>
                    <GraduationCap className="absolute -bottom-6 -left-6 text-white/10 w-48 h-48 rotate-12" />
                </div>
                {/* ... student list ... */}
                {isAddingStudent && (
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 animate-slideDown">
                        <div className="flex justify-between items-center mb-4"><h3 className="font-bold text-slate-700 flex items-center gap-2"><Plus className="text-indigo-500"/> إضافة طالب جديد</h3><button onClick={() => setIsAddingStudent(false)} className="text-slate-400 hover:text-rose-500"><XCircle size={20}/></button></div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <input type="text" className={inputModernClass} placeholder="اسم الطالب" value={studentForm.name} onChange={(e) => setStudentForm({...studentForm, name: e.target.value})} />
                            <input type="text" className={inputModernClass} placeholder="رقم ولي الأمر" value={studentForm.parentPhone} onChange={(e) => setStudentForm({...studentForm, parentPhone: e.target.value})} />
                            <select className={`${inputModernClass} bg-white`} value={studentForm.classId || selectedClassId} onChange={(e) => setStudentForm({...studentForm, classId: e.target.value})}><option value="">اختر الفصل...</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                            <button onClick={handleAddStudent} className={`${btnPrimaryClass} h-[50px]`}>حفظ البيانات</button>
                        </div>
                    </div>
                )}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-700">قائمة الطلاب <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full mr-2">{filteredStudents.length} طالب</span></h3>
                        <div className="relative w-64"><input type="text" placeholder="بحث عن طالب..." className="w-full bg-white border border-slate-200 rounded-lg py-2 pr-8 pl-4 text-sm focus:border-indigo-400 outline-none" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} /><Search className="absolute right-2 top-2.5 text-slate-400" size={16} /></div>
                    </div>
                    {filteredStudents.length === 0 ? <div className="text-center py-16"><div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"><Users className="text-slate-300" size={32}/></div><p className="text-slate-500">لا يوجد طلاب مطابقين للعرض</p></div> : <div className="overflow-x-auto"><table className="w-full text-right"><thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase"><tr><th className="px-6 py-4">اسم الطالب</th><th className="px-6 py-4">ولي الأمر</th><th className="px-6 py-4">الفصل</th><th className="px-6 py-4 text-center">إجراءات</th></tr></thead><tbody className="divide-y divide-slate-100">{filteredStudents.map(s => (<tr key={s.id} className="hover:bg-indigo-50/30 transition-colors group"><td className="px-6 py-4">{editingStudentId === s.id ? <input value={studentForm.name} onChange={(e) => setStudentForm({...studentForm, name: e.target.value})} className={inputTableClass} /> : <span className="font-bold text-slate-700">{s.name}</span>}</td><td className="px-6 py-4 font-mono text-sm text-slate-500">{editingStudentId === s.id ? <input value={studentForm.parentPhone} onChange={(e) => setStudentForm({...studentForm, parentPhone: e.target.value})} className={inputTableClass} /> : s.parentPhone}</td><td className="px-6 py-4">{editingStudentId === s.id ? <select value={studentForm.classId} onChange={(e) => setStudentForm({...studentForm, classId: e.target.value})} className={`${inputTableClass} bg-white`}>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{classes.find(c => c.id === s.classId)?.name}</span>}</td><td className="px-6 py-4 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">{editingStudentId === s.id ? <><button onClick={saveEditStudent} className="text-emerald-600 bg-emerald-50 p-2 rounded-lg hover:bg-emerald-100"><Save size={16}/></button><button onClick={() => setEditingStudentId(null)} className="text-slate-500 bg-slate-50 p-2 rounded-lg hover:bg-slate-100"><XCircle size={16}/></button></> : <><button onClick={() => startEditStudent(s)} className="text-indigo-600 bg-indigo-50 p-2 rounded-lg hover:bg-indigo-100"><Edit2 size={16}/></button><button onClick={() => handleDeleteStudent(s.id)} className="text-rose-600 bg-rose-50 p-2 rounded-lg hover:bg-rose-100"><Trash2 size={16}/></button></>}</td></tr>))}</tbody></table></div>}
                </div>
             </div>
        )}

        {/* ... (Classes, Plan, Attendance, Messages, Archive tabs remain same) ... */}
        {activeTab === 'classes' && <div className="space-y-6 animate-fadeIn"><div className="grid grid-cols-1 lg:grid-cols-3 gap-6"><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1"><h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Grid className="text-indigo-500"/> إضافة فصل جديد</h2><div className="space-y-4"><div><label className={labelModernClass}>اسم الفصل (الشعبة)</label><input type="text" placeholder="مثال: أول - أ" className={inputModernClass} value={newClassName} onChange={(e) => setNewClassName(e.target.value)}/></div><div><label className={labelModernClass}>الصف الدراسي</label><input type="text" placeholder="مثال: الصف الأول" className={inputModernClass} value={newClassGrade} onChange={(e) => setNewClassGrade(e.target.value)}/></div><button onClick={handleAddClass} className={`${btnPrimaryClass} w-full py-3`}><Plus size={18} /> إنشاء الفصل</button></div></div><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">{activeClass ? (<>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><BookOpen className="text-indigo-500"/> الجدول الدراسي: <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-base">{activeClass.name}</span></h2>
                <button onClick={() => handleShareClass(activeClass.id, activeClass.name)} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm border border-emerald-100" title="نسخ رابط الخطط للعامة"><Share2 size={14}/> مشاركة الخطط</button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full text-center text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3 border-b">اليوم</th>{[1,2,3,4,5,6,7].map(p => <th key={p} className="p-3 border-b border-r border-slate-200">الحصة {p}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{DAYS_OF_WEEK.map((day, dIndex) => (<tr key={dIndex} className="hover:bg-slate-50/50"><td className="p-3 font-bold text-slate-600 bg-slate-50/30">{day}</td>{[1,2,3,4,5,6,7].map(period => { const slot = schedule.find(s => s.classId === selectedClassId && s.dayIndex === dIndex && s.period === period); const subject = subjects.find(s => s.id === slot?.subjectId); const teacher = teachers.find(t => t.id === slot?.teacherId); return (<td key={period} onClick={() => openScheduleEdit(dIndex, period)} className={`p-2 border-r border-slate-100 cursor-pointer transition-all hover:brightness-95 ${subject ? subject.color.replace('text-', 'bg-opacity-20 text-') : 'hover:bg-indigo-50'}`}>{slot ? (<div className={`rounded-lg p-1 ${subject?.color} bg-opacity-10 border`}><span className="font-bold block text-xs">{subject?.name}</span><span className="text-[10px] opacity-80 block mt-0.5">{teacher?.name}</span></div>) : (<div className="w-full h-8 rounded-lg border-2 border-dashed border-slate-100 flex items-center justify-center text-slate-300 hover:border-indigo-300 hover:text-indigo-300"><Plus size={14}/></div>)}</td>); })}</tr>))}</tbody></table></div></>) : (<div className="text-center py-20"><AlertCircle className="mx-auto mb-3 text-slate-300" size={40}/><p className="text-slate-500 font-medium">الرجاء اختيار أو إضافة فصل للبدء</p></div>)}</div></div>{editingSlot && (<div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"><div className="bg-white p-6 rounded-2xl w-full max-w-sm animate-slideDown shadow-2xl"><div className="flex justify-between items-center mb-6"><h3 className="font-bold text-lg text-slate-800">تعديل الحصة {editingSlot.period}</h3><button onClick={() => setEditingSlot(null)} className="text-slate-400 hover:text-rose-500"><X size={20}/></button></div><div className="space-y-4"><div><label className={labelModernClass}>المادة الدراسية</label><select className={inputModernClass} value={scheduleForm.subjectId} onChange={(e) => setScheduleForm({...scheduleForm, subjectId: e.target.value})}><option value="">-- اختر المادة --</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div><div><label className={labelModernClass}>المعلم المسؤول</label><select className={inputModernClass} value={scheduleForm.teacherId} onChange={(e) => setScheduleForm({...scheduleForm, teacherId: e.target.value})}><option value="">-- اختر المعلم --</option>{teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div><button onClick={saveScheduleSlot} className={`${btnPrimaryClass} w-full py-3 mt-4`}>حفظ التغييرات</button></div></div></div>)}</div>}
        {activeTab === 'plan' && <div className="animate-fadeIn">{activeClass ? (<><div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center no-print gap-4"><div className="flex items-center gap-3"><div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><FileText size={24}/></div><div><h2 className="text-xl font-bold text-slate-800">معاينة الخطة</h2><p className="text-xs text-slate-500">جاهزة للطباعة (A4)</p></div></div><div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100"><button onClick={() => setPrintMode('master')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${printMode === 'master' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><Copy size={14}/> نسخة عامة</button><button onClick={() => setPrintMode('students')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${printMode === 'students' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><User size={14}/> نسخ للطلاب ({classStudents.length})</button></div><div className="flex flex-wrap gap-2 justify-center"><button onClick={onClearPlans} className={`${btnSecondaryClass} text-rose-600 bg-rose-50 hover:bg-rose-100`}><Eraser size={18} /><span>تفريغ</span></button><button onClick={handleArchiveClick} className={`${btnSecondaryClass} text-amber-600 bg-amber-50 hover:bg-amber-100`}><Archive size={18} /><span>أرشفة</span></button><button onClick={handlePrint} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl hover:bg-slate-900 flex items-center gap-2 font-bold shadow-lg shadow-slate-300 transition-all"><Printer size={18} /><span>طباعة</span></button></div></div><div className="mx-auto rounded-none print:shadow-none">{printMode === 'master' ? (<div className="bg-white shadow-2xl print:shadow-none page-container"><WeeklyPlanTemplate classGroup={activeClass} weekInfo={weekInfo} schedule={schedule.filter(s => s.classId === selectedClassId)} planEntries={planEntries.filter(e => e.classId === selectedClassId)} schoolSettings={schoolSettings} subjects={subjects} onUpdateSettings={setSchoolSettings}/></div>) : (<div>{classStudents.length === 0 ? (<div className="bg-orange-50 p-6 rounded-xl border border-orange-100 text-center text-orange-600 font-bold">لا يوجد طلاب مسجلين في هذا الفصل لطباعة نسخ لهم.</div>) : (classStudents.map((student, index) => (<div key={student.id} className="mb-8 print:mb-0 bg-white shadow-2xl print:shadow-none page-container"><WeeklyPlanTemplate classGroup={activeClass} weekInfo={weekInfo} schedule={schedule.filter(s => s.classId === selectedClassId)} planEntries={planEntries.filter(e => e.classId === selectedClassId)} schoolSettings={schoolSettings} subjects={subjects} onUpdateSettings={setSchoolSettings} studentName={student.name}/></div>)))}</div>)}</div></>) : (<div className="text-center py-20 bg-white rounded-2xl shadow border border-slate-100"><AlertCircle className="mx-auto mb-4 text-slate-200" size={48}/><h3 className="text-xl font-bold text-slate-400">لا يوجد بيانات للعرض</h3></div>)}</div>}
        {activeTab === 'attendance' && <div className="animate-fadeIn space-y-6"><div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4"><div className="flex items-center gap-3"><div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600"><Calendar size={20} /></div><div><label className={labelModernClass}>تاريخ اليوم</label><input type="date" className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)}/></div></div><div className="h-10 w-px bg-slate-200 mx-2 hidden md:block"></div><div className="flex-1"><h2 className="font-bold text-lg text-slate-800">سجل الحضور والغياب</h2><p className="text-xs text-slate-500">متابعة الغياب اليومي وطباعة الكشوفات</p></div><button onClick={handleArchiveDailyAttendance} className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"><Archive size={16}/> أرشفة السجل اليومي</button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{classes.length === 0 ? (<div className="col-span-full py-12 text-center text-slate-400"><Users size={48} className="mx-auto mb-3 opacity-50"/><p>لا يوجد فصول لعرضها</p></div>) : (classes.map(cls => { const absentStudents = students.filter(s => s.classId === cls.id && attendanceRecords.some(r => r.studentId === s.id && r.date === attendanceDate && r.status === 'absent')); const totalStudents = students.filter(s => s.classId === cls.id).length; const hasAbsence = absentStudents.length > 0; return (<div key={cls.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group"><div className="p-5 border-b border-slate-100 flex justify-between items-start"><div><h3 className="font-bold text-lg text-slate-800">{cls.name}</h3><p className="text-xs text-slate-400 mt-1">{totalStudents} طالب مسجل</p></div><div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${hasAbsence ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>{hasAbsence ? (<><XCircle size={14}/> {absentStudents.length} غياب</>) : (<><CheckCircle size={14}/> حضور كامل</>)}</div></div><div className="p-5 bg-slate-50/50 h-32 overflow-hidden relative">{hasAbsence ? (<ul className="space-y-2">{absentStudents.slice(0, 3).map(s => (<li key={s.id} className="flex items-center gap-2 text-sm text-slate-600"><div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>{s.name}</li>))}{absentStudents.length > 3 && (<li className="text-xs text-slate-400 italic pr-4">+ {absentStudents.length - 3} آخرين...</li>)}</ul>) : (<div className="h-full flex flex-col items-center justify-center text-slate-300"><CheckCircle size={32} className="mb-2 opacity-50"/><span className="text-xs">لم يتم تسجيل غياب</span></div>)}</div><div className="p-4 bg-white border-t border-slate-100"><button onClick={() => setPrintAttendanceClass(cls)} className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all flex items-center justify-center gap-2"><Printer size={16}/> طباعة كشف الغياب</button></div></div>); }))}</div>{printAttendanceClass && (<div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 overflow-hidden"><div className="bg-white w-full max-w-4xl h-[95vh] rounded-2xl flex flex-col shadow-2xl animate-slideDown overflow-hidden"><div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0"><div><h3 className="font-bold text-lg flex items-center gap-2"><Printer size={20} className="text-emerald-400"/> كشف الغياب: {printAttendanceClass.name}</h3><p className="text-xs text-slate-400 mt-0.5">{attendanceDate}</p></div><div className="flex items-center gap-3"><button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"><Printer size={14}/> طباعة</button><button onClick={() => setPrintAttendanceClass(null)} className="bg-rose-500 hover:bg-rose-600 p-2 rounded-full transition-colors"><X size={18}/></button></div></div><div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center"><div className="origin-top scale-[0.85] md:scale-100 transition-transform"><AttendanceReportTemplate schoolSettings={schoolSettings} classGroup={printAttendanceClass} teacherName="إدارة النظام / وكيل شؤون الطلاب" date={attendanceDate} absentStudents={students.filter(s => s.classId === printAttendanceClass.id && attendanceRecords.some(r => r.studentId === s.id && r.date === attendanceDate && r.status === 'absent'))}/></div></div></div></div>)}</div>}
        {activeTab === 'messages' && <div className="animate-fadeIn h-[calc(100vh-200px)] min-h-[500px]"><div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden h-full flex flex-col md:flex-row"><div className="w-full md:w-80 border-l border-slate-100 bg-slate-50 flex flex-col"><div className="p-4 border-b border-slate-200 bg-white"><h3 className="font-bold text-slate-800 mb-1">المحادثات</h3><p className="text-xs text-slate-500">اختر معلماً للمراسلة</p></div><div className="flex-1 overflow-y-auto"><button onClick={() => setMsgFilter('all')} className={`w-full p-4 flex items-center gap-3 border-b border-slate-100 transition-colors hover:bg-white ${msgFilter === 'all' ? 'bg-white border-r-4 border-r-indigo-500 shadow-sm' : ''}`}><div className="bg-amber-100 p-2.5 rounded-full text-amber-600"><Bell size={20}/></div><div className="text-right"><p className="font-bold text-sm text-slate-800">تعميم للجميع</p><p className="text-[10px] text-slate-400">إرسال إعلانات عامة</p></div></button>{teachers.map(t => (<button key={t.id} onClick={() => setMsgFilter(t.id)} className={`w-full p-4 flex items-center gap-3 border-b border-slate-100 transition-colors hover:bg-white ${msgFilter === t.id ? 'bg-white border-r-4 border-r-indigo-500 shadow-sm' : ''}`}><div className="bg-indigo-100 p-2.5 rounded-full text-indigo-600 font-bold text-xs">{t.name.charAt(0)}</div><div className="text-right overflow-hidden"><p className="font-bold text-sm text-slate-800 truncate">{t.name}</p><p className="text-[10px] text-slate-400">@{t.username}</p></div></button>))}</div></div><div className="flex-1 flex flex-col bg-white relative"><div className="p-4 border-b border-slate-100 bg-white/80 backdrop-blur flex justify-between items-center shadow-sm z-10"><div className="flex items-center gap-3">{msgFilter === 'all' ? (<><div className="bg-amber-500 p-2 rounded-lg text-white"><Bell size={20}/></div><div><h3 className="font-bold text-slate-800">تعميم لجميع المعلمين</h3><p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={10}/> نشط</p></div></>) : (<><div className="bg-indigo-600 p-2 rounded-lg text-white"><UserCheck size={20}/></div><div><h3 className="font-bold text-slate-800">{teachers.find(t => t.id === msgFilter)?.name}</h3><p className="text-xs text-slate-500">محادثة مباشرة</p></div></>)}</div></div><div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">{getFilteredMessages().length === 0 ? (<div className="text-center py-20 opacity-50"><MessageSquare size={48} className="mx-auto mb-2 text-slate-300"/><p className="text-slate-400">ابدأ المحادثة بإرسال رسالة</p></div>) : (getFilteredMessages().map(msg => { const isMe = msg.senderId === 'admin'; return (<div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tl-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tr-none'}`}>{!isMe && <p className="text-[10px] font-bold text-indigo-600 mb-1">{msg.senderName}</p>}<p className="text-sm leading-relaxed">{msg.content}</p><p className={`text-[10px] mt-2 text-right ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.timestamp}</p></div></div>); }))}<div ref={messagesEndRef} /></div><div className="p-4 border-t border-slate-100 bg-white"><div className="flex gap-3"><input type="text" className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all" placeholder="اكتب رسالتك هنا..." value={newMessageText} onChange={(e) => setNewMessageText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdminSendMessage()} /><button onClick={handleAdminSendMessage} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"><Send size={20}/></button></div></div></div></div></div>}

        {activeTab === 'setup' && (
             <div className="animate-fadeIn space-y-6">
                
                {/* School Link Card - NEW */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mb-6">
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800">
                        <LinkIcon className="text-indigo-500" /> رابط الدخول المباشر للمدرسة
                    </h3>
                    <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-1 bg-white border border-indigo-200 rounded-lg p-3 font-mono text-sm text-slate-600 text-left dir-ltr select-all">
                                {window.location.origin}?school={schoolId}
                            </div>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}?school=${schoolId}`);
                                    alert('تم نسخ الرابط بنجاح');
                                }}
                                className="bg-indigo-600 text-white p-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                                title="نسخ الرابط"
                            >
                                <Copy size={20} />
                            </button>
                        </div>
                        <p className="text-xs text-indigo-500 mt-3 font-medium">
                            هذا الرابط خاص بمدرستكم. شاركه مع المعلمين والإداريين للدخول المباشر دون الحاجة للبحث عن المدرسة.
                        </p>
                    </div>
                </div>

                {/* Existing Setup Content - UPDATED LAYOUT */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Settings className="text-indigo-500"/> بيانات ترويسة التقرير</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className={labelModernClass}>السطر الأول (الوزارة)</label>
                                    <input type="text" className={inputModernClass} value={schoolSettings.ministryName} onChange={(e) => setSchoolSettings({...schoolSettings, ministryName: e.target.value})} placeholder="المملكة العربية السعودية" />
                                </div>
                                <div>
                                    <label className={labelModernClass}>السطر الثاني (الجهة)</label>
                                    <input type="text" className={inputModernClass} value={schoolSettings.authorityName} onChange={(e) => setSchoolSettings({...schoolSettings, authorityName: e.target.value})} placeholder="وزارة التعليم" />
                                </div>
                                <div>
                                    <label className={labelModernClass}>السطر الثالث (الإدارة)</label>
                                    <input type="text" className={inputModernClass} value={schoolSettings.directorateName} onChange={(e) => setSchoolSettings({...schoolSettings, directorateName: e.target.value})} placeholder="الإدارة العامة للتعليم..." />
                                </div>
                                <div>
                                    <label className={labelModernClass}>السطر الرابع (المدرسة)</label>
                                    <input type="text" className={inputModernClass} value={schoolSettings.schoolName} onChange={(e) => setSchoolSettings({...schoolSettings, schoolName: e.target.value})} placeholder="اسم المدرسة" />
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-100">
                                 <label className={labelModernClass}>رابط الشعار (Logo URL)</label>
                                 <div className="flex gap-2">
                                     <input type="text" className={`${inputModernClass} text-left`} dir="ltr" value={schoolSettings.logoUrl} onChange={(e) => setSchoolSettings({...schoolSettings, logoUrl: e.target.value})} placeholder="https://..." />
                                     {schoolSettings.logoUrl && (
                                         <div className="w-12 h-12 border border-slate-200 rounded-lg p-1 bg-white flex items-center justify-center shrink-0">
                                             <img src={schoolSettings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                                         </div>
                                     )}
                                 </div>
                            </div>

                            <button onClick={handleManualSaveSettings} className={`${btnPrimaryClass} w-full py-3 mt-4`}>{saveSuccess ? <><CheckCircle size={20}/> تم الحفظ!</> : <><Save size={20}/> حفظ الإعدادات</>}</button>
                        </div>
                    </div>
                    {/* Subscription & Teachers Management */}
                    <div className="space-y-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                             <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Key className="text-amber-500"/> حالة الاشتراك</h3>
                             <div className={`p-4 rounded-xl mb-4 ${isExpired ? 'bg-rose-50 border border-rose-100 text-rose-700' : 'bg-emerald-50 border border-emerald-100 text-emerald-700'}`}>
                                 <p className="font-bold text-sm mb-1">{isExpired ? 'الاشتراك منتهي' : 'الاشتراك نشط'}</p>
                                 <p className="text-xs opacity-80">ينتهي في: {new Date(schoolMetadata?.subscriptionEnd || '').toLocaleDateString('ar-SA')}</p>
                             </div>
                             {!isExpired ? (
                                 <div className="grid grid-cols-2 gap-3">
                                     <button onClick={() => handleRenewClick('quarterly')} className="bg-slate-50 border border-slate-200 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">تجديد (فصلي)</button>
                                     <button onClick={() => handleRenewClick('annual')} className="bg-slate-50 border border-slate-200 text-slate-600 py-2 rounded-lg text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all">تجديد (سنوي)</button>
                                 </div>
                             ) : (
                                 <button onClick={() => handleRenewClick('annual')} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-indigo-700 shadow-lg shadow-indigo-200 animate-pulse">تجديد الاشتراك الآن واستعادة الخدمة</button>
                             )}
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><UserCheck className="text-indigo-500"/> إدارة المعلمين</h3>
                             <div className="space-y-4">
                                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-100">
                                    <h4 className="font-bold text-sm text-indigo-900 mb-2">إضافة معلم جديد</h4>
                                    <div className="space-y-2">
                                        <input type="text" placeholder="الاسم الرباعي" className="w-full bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" value={teacherForm.name} onChange={(e) => setTeacherForm({...teacherForm, name: e.target.value})} />
                                        <div className="flex gap-2">
                                            <input type="text" placeholder="اسم المستخدم" className="w-1/2 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" value={teacherForm.username} onChange={(e) => setTeacherForm({...teacherForm, username: e.target.value})} />
                                            <input type="text" placeholder="كلمة المرور" className="w-1/2 bg-white border border-indigo-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-400" value={teacherForm.password} onChange={(e) => setTeacherForm({...teacherForm, password: e.target.value})} />
                                        </div>
                                        <button onClick={handleCreateTeacher} className="w-full bg-indigo-600 text-white py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition-colors">إضافة المعلم</button>
                                    </div>
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                    {teachers.length === 0 ? <p className="text-center text-xs text-slate-400 py-4">لا يوجد معلمين مسجلين</p> : teachers.map(t => (
                                        <div key={t.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100 group hover:border-indigo-200 transition-colors">
                                            {editingTeacherId === t.id ? (
                                                <div className="flex-1 flex gap-2">
                                                     <input value={teacherEditForm.name} onChange={e => setTeacherEditForm({...teacherEditForm, name: e.target.value})} className="w-1/3 text-xs p-1 border rounded"/>
                                                     <input value={teacherEditForm.username} onChange={e => setTeacherEditForm({...teacherEditForm, username: e.target.value})} className="w-1/4 text-xs p-1 border rounded"/>
                                                     <input value={teacherEditForm.password} onChange={e => setTeacherEditForm({...teacherEditForm, password: e.target.value})} placeholder="Pass" className="w-1/4 text-xs p-1 border rounded"/>
                                                     <button onClick={saveEditTeacher} className="text-green-600"><Save size={14}/></button>
                                                </div>
                                            ) : (
                                                <>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-700">{t.name}</p>
                                                        <p className="text-[10px] text-slate-400">@{t.username} | {t.password}</p>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => startEditTeacher(t)} className="p-1 text-slate-400 hover:text-indigo-600"><Edit2 size={14}/></button>
                                                        <button onClick={() => handleDeleteTeacher(t.id)} className="p-1 text-slate-400 hover:text-rose-600"><Trash2 size={14}/></button>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    ))}
                                </div>
                             </div>
                        </div>
                    </div>
                </div>

                <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 mt-8">
                    <h3 className="font-bold text-lg text-rose-700 mb-2 flex items-center gap-2"><AlertTriangle size={20}/> منطقة الخطر</h3>
                    <p className="text-xs text-rose-600 mb-4">الإجراءات التالية لا يمكن التراجع عنها. يرجى الحذر.</p>
                    <button onClick={handleResetSchoolData} className="bg-white border border-rose-200 text-rose-600 px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-rose-600 hover:text-white transition-all shadow-sm flex items-center gap-2">
                        <Trash2 size={16}/> إعادة تعيين بيانات المدرسة (حذف الكل)
                    </button>
                </div>
             </div>
        )}

        {/* ... (Archive and Subscription Modals) ... */}
        {activeTab === 'archive' && (
             <div className="animate-fadeIn">
                 {/* ... content ... */}
                 {/* (Included in previous response, keeping it brief here to focus on requested changes) */}
                 <div className="flex justify-center mb-8">
                     <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-100 inline-flex">
                         <button 
                             onClick={() => setArchiveViewType('weekly_plans')}
                             className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${archiveViewType === 'weekly_plans' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                         >
                             <FileText size={18}/> الخطط الأسبوعية
                         </button>
                         <button 
                             onClick={() => setArchiveViewType('attendance')}
                             className={`px-6 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${archiveViewType === 'attendance' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500 hover:text-slate-700'}`}
                         >
                             <UserCheck size={18}/> تقارير الغياب
                         </button>
                     </div>
                 </div>

                 {archiveViewType === 'weekly_plans' && (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {archivedPlans.length === 0 ? (
                             <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                                 <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"><History size={32} className="text-amber-400"/></div>
                                 <h3 className="text-xl font-bold text-slate-700">أرشيف الخطط فارغ</h3>
                                 <p className="text-slate-400 mt-2">لم يتم أرشفة أي خطط أسبوعية بعد.</p>
                             </div>
                         ) : (
                             archivedPlans.map(plan => (
                                 <div key={plan.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                                     <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex justify-between items-center text-white">
                                         <div className="flex items-center gap-2"><FileText size={18} className="text-slate-300"/><span className="font-bold text-sm">{plan.name}</span></div>
                                         <span className="text-[10px] bg-white/20 px-2 py-1 rounded">{plan.archivedDate}</span>
                                     </div>
                                     <div className="p-5">
                                         <div className="flex justify-between items-center mb-4"><span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{plan.className}</span><span className="text-xs text-slate-400">{plan.entries.length} سجل</span></div>
                                         <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                                             <button onClick={() => setViewingArchive(plan)} className="flex-1 bg-indigo-50 text-indigo-600 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 flex items-center justify-center gap-2 transition-colors"><Eye size={16}/> معاينة</button>
                                             {onDeleteArchive && (<button onClick={() => { if(window.confirm('هل أنت متأكد من حذف هذه الخطة من الأرشيف؟')) onDeleteArchive(plan.id) }} className="bg-rose-50 text-rose-600 p-2 rounded-lg hover:bg-rose-100 transition-colors" title="حذف من الأرشيف"><Trash2 size={18}/></button>)}
                                         </div>
                                     </div>
                                 </div>
                             ))
                         )}
                     </div>
                 )}

                 {archiveViewType === 'attendance' && (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                         {archivedAttendanceLogs.length === 0 ? (
                             <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                                 <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4"><FileArchive size={32} className="text-amber-400"/></div>
                                 <h3 className="text-xl font-bold text-slate-700">أرشيف الغياب فارغ</h3>
                                 <p className="text-slate-400 mt-2">لم يتم أرشفة أي تقارير غياب بعد.</p>
                             </div>
                         ) : (
                             archivedAttendanceLogs.map(log => (
                                 <div key={log.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                                     <div className="bg-gradient-to-r from-teal-700 to-teal-600 p-4 flex justify-between items-center text-white">
                                         <div className="flex items-center gap-2"><Calendar size={18} className="text-teal-200"/><span className="font-bold text-sm">سجل {log.reportDate}</span></div>
                                         <span className="text-[10px] bg-white/20 px-2 py-1 rounded">{log.archivedAt}</span>
                                     </div>
                                     <div className="p-5">
                                         <div className="flex justify-between items-center mb-4">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-rose-500"></div>
                                                <span className="text-sm font-bold text-slate-600">{log.absentStudents.length} غياب</span>
                                            </div>
                                         </div>
                                         <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                                             <button onClick={() => setViewingAttendanceArchive(log)} className="flex-1 bg-teal-50 text-teal-600 py-2 rounded-lg font-bold text-sm hover:bg-teal-100 flex items-center justify-center gap-2 transition-colors"><Eye size={16}/> معاينة</button>
                                             {onDeleteAttendanceArchive && (<button onClick={() => { if(window.confirm('هل أنت متأكد من حذف هذا السجل من الأرشيف؟')) onDeleteAttendanceArchive(log.id) }} className="bg-rose-50 text-rose-600 p-2 rounded-lg hover:bg-rose-100 transition-colors" title="حذف من الأرشيف"><Trash2 size={18}/></button>)}
                                         </div>
                                     </div>
                                 </div>
                             ))
                         )}
                     </div>
                 )}

                 {/* Plan Archive Modal */}
                 {viewingArchive && (
                     <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 overflow-hidden">
                         <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col shadow-2xl animate-slideDown overflow-hidden">
                             <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                                 <div><h3 className="font-bold text-lg flex items-center gap-2"><History size={20}/> معاينة الخطة الأسبوعية</h3><p className="text-xs text-slate-400">{viewingArchive.name} | {viewingArchive.archivedDate}</p></div>
                                 <div className="flex items-center gap-3"><button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"><Printer size={14}/> طباعة</button><button onClick={() => setViewingArchive(null)} className="bg-rose-500 hover:bg-rose-600 p-2 rounded-full transition-colors"><X size={18}/></button></div>
                             </div>
                             <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center"><div className="scale-90 origin-top"><WeeklyPlanTemplate classGroup={{id: 'archived', name: viewingArchive.className, grade: ''}} weekInfo={viewingArchive.weekInfo} schedule={[]} planEntries={viewingArchive.entries} schoolSettings={schoolSettings} subjects={subjects}/></div></div>
                         </div>
                     </div>
                 )}

                 {/* Attendance Archive Modal */}
                 {viewingAttendanceArchive && (
                     <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 overflow-hidden">
                         <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col shadow-2xl animate-slideDown overflow-hidden">
                             <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                                 <div><h3 className="font-bold text-lg flex items-center gap-2"><UserCheck size={20}/> معاينة تقرير الغياب</h3><p className="text-xs text-slate-400">{viewingAttendanceArchive.reportDate} | {viewingAttendanceArchive.archivedAt}</p></div>
                                 <div className="flex items-center gap-3"><button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2"><Printer size={14}/> طباعة</button><button onClick={() => setViewingAttendanceArchive(null)} className="bg-rose-500 hover:bg-rose-600 p-2 rounded-full transition-colors"><X size={18}/></button></div>
                             </div>
                             <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center"><div className="scale-90 origin-top"><AttendanceReportTemplate schoolSettings={schoolSettings} classGroup={{id: 'archived', name: 'تقرير مؤرشف'}} teacherName="أرشيف النظام" date={viewingAttendanceArchive.reportDate} absentStudents={viewingAttendanceArchive.absentStudents} showClassColumn={true}/></div></div>
                         </div>
                     </div>
                 )}
             </div>
        )}

        {/* Subscription Renewal Modal */}
        {showRenewModal && schoolMetadata && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                {renewStep === 1 ? (
                   <InvoiceModal 
                       schoolName={schoolMetadata.name}
                       plan={renewPlan}
                       amount={renewPlan === 'annual' ? pricing.annual : pricing.quarterly}
                       date={new Date().toLocaleDateString('ar-SA')}
                       invoiceId={`INV-${Date.now()}`}
                       onConfirm={handlePaymentConfirm}
                   />
                ) : (
                   <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-slideDown text-center space-y-4">
                       <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-indigo-600 mb-2"><Key size={32}/></div>
                       <h3 className="text-xl font-bold text-slate-800">تفعيل الاشتراك</h3>
                       <p className="text-sm text-slate-500">تم إرسال كود التفعيل إلى البريد الإلكتروني. الرجاء إدخاله أدناه.</p>
                       <form onSubmit={handleRenewCodeSubmit} className="space-y-4 pt-2">
                           <input 
                               type="text" 
                               className="w-full text-center text-2xl font-mono tracking-widest border-2 border-indigo-100 rounded-xl py-3 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 outline-none transition-all uppercase"
                               placeholder="XXXX-XXXX"
                               value={activationCodeInput}
                               onChange={(e) => setActivationCodeInput(e.target.value)}
                           />
                           <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg">تفعيل الآن</button>
                           <button type="button" onClick={() => setShowRenewModal(false)} className="text-slate-400 text-sm font-bold hover:text-slate-600">إلغاء</button>
                       </form>
                   </div>
                )}
            </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;