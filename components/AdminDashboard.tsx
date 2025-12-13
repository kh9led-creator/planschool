import React, { useState, useEffect, useRef } from 'react';
import { ClassGroup, Student, PlanEntry, ScheduleSlot, WeekInfo, Teacher, ArchivedPlan, SchoolSettings, Subject, AttendanceRecord, Message } from '../types';
import WeeklyPlanTemplate from './WeeklyPlanTemplate';
import { Users, FileText, Calendar, Printer, Share2, UploadCloud, CheckCircle, XCircle, Plus, Trash2, Edit2, Save, Archive, History, Grid, BookOpen, Settings, Book, Eraser, Image as ImageIcon, UserCheck, MessageSquare, Send, Bell, Key, AlertCircle, GraduationCap, ChevronLeft, LayoutDashboard, Search, X, Eye } from 'lucide-react';
import { DAYS_OF_WEEK } from '../services/data';

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
  onSendMessage
}) => {
  // Added 'students' as a separate tab
  const [activeTab, setActiveTab] = useState<'plan' | 'attendance' | 'setup' | 'archive' | 'classes' | 'messages' | 'students'>('students');
  
  // Safe Class Selection
  const hasClasses = classes && classes.length > 0;
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  // Update selected class if it becomes invalid or empty
  useEffect(() => {
    if (hasClasses) {
        if (!selectedClassId || !classes.find(c => c.id === selectedClassId)) {
            setSelectedClassId(classes[0].id);
        }
    } else {
        setSelectedClassId('');
    }
  }, [classes, hasClasses, selectedClassId]);

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

  // Search Terms
  const [studentSearch, setStudentSearch] = useState('');

  // --- Noor Import Logic (Updated for automatic Class creation) ---
  const handleNoorImportClick = () => {
    fileInputRef.current?.click();
  };

  const processNoorFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r\n|\n/);
        
        const newStudents: Student[] = [];
        const newClasses: ClassGroup[] = [];
        
        // Map to track classes (Name -> ID) to prevent duplicates in this batch
        const processedClasses = new Map<string, string>(); 
        classes.forEach(c => processedClasses.set(c.name, c.id));

        let studentsAddedCount = 0;
        let classesAddedCount = 0;

        // Smart Header Detection
        let headerIndex = -1;
        let nameColIdx = -1;
        let phoneColIdx = -1;
        let classColIdx = -1; // "الفصل"
        let gradeColIdx = -1; // "الصف"
        
        // Pre-scan to find header
        for (let i = 0; i < Math.min(lines.length, 30); i++) {
            const rowRaw = lines[i];
            // Normalize quotes and delimiters
            const delimiter = rowRaw.includes(';') ? ';' : ',';
            // Simple CSV split (handles basic cases)
            const row = rowRaw.split(delimiter).map(c => c.replace(/["\r]/g, '').trim());
            
            // Check for keywords
            const nameIdx = row.findIndex(c => c.includes('اسم الطالب') || c.includes('Student Name'));
            if (nameIdx !== -1) {
                headerIndex = i;
                nameColIdx = nameIdx;
                phoneColIdx = row.findIndex(c => c.includes('جوال') || c.includes('هاتف') || c.includes('Mobile'));
                classColIdx = row.findIndex(c => c.includes('فصل') || c.includes('شعبة') || c.includes('Section'));
                gradeColIdx = row.findIndex(c => c.includes('صف') || c.includes('Grade'));
                break;
            }
        }

        if (headerIndex === -1) {
            // Fallback for standard files if header is missing/renamed
            // Assumed: [ID, Phone, Grade, Class, Name, ...]
             headerIndex = 0; 
             nameColIdx = 4; // Col E
             phoneColIdx = 1; // Col B
             gradeColIdx = 2; // Col C
             classColIdx = 3; // Col D
        }

        // Iterate Data Rows
        for (let i = headerIndex + 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const delimiter = lines[i].includes(';') ? ';' : ',';
          const row = lines[i].split(delimiter).map(cell => cell.replace(/["\r]/g, '').trim());
          
          if (row.length <= nameColIdx) continue;

          const studentName = row[nameColIdx];
          
          // Validation
          if (!studentName || studentName.length < 3 || !/[\u0600-\u06FF]/.test(studentName)) continue;
          if (studentName === 'اسم الطالب') continue; 

          const parentPhone = (phoneColIdx !== -1 && row[phoneColIdx]) ? row[phoneColIdx] : '';

          // --- Automatic Class Detection ---
          let finalClassName = "عام";
          let gradeName = "عام";

          // Extract Grade (e.g., "الصف الأول الابتدائي")
          if (gradeColIdx !== -1 && row[gradeColIdx]) {
              gradeName = row[gradeColIdx];
          }

          // Extract Class Number (e.g., "1", "2", "أ")
          let classNum = "";
          if (classColIdx !== -1 && row[classColIdx]) {
              classNum = row[classColIdx];
          }

          // Construct Full Class Name (e.g., "الصف الأول - 1")
          if (gradeName !== "عام" && classNum) {
              const shortGrade = gradeName.split(' ').slice(0, 2).join(' ');
              finalClassName = `${shortGrade} - ${classNum}`;
          } else if (classNum) {
              finalClassName = classNum;
          } else if (gradeName !== "عام") {
              finalClassName = gradeName;
          }

          // Check if Class exists
          let classId = processedClasses.get(finalClassName);

          if (!classId) {
             // Create New Class
             classId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
             const newClassGroup: ClassGroup = {
               id: classId,
               name: finalClassName,
               grade: gradeName
             };
             
             newClasses.push(newClassGroup);
             processedClasses.set(finalClassName, classId);
             classesAddedCount++;
          }

          // Check Duplicate Student
          const isDuplicate = students.some(s => s.name === studentName) || newStudents.some(s => s.name === studentName);
          
          if (!isDuplicate) {
              newStudents.push({
                id: `s_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                name: studentName,
                parentPhone: parentPhone, 
                classId: classId, 
                absenceCount: 0
              });
              studentsAddedCount++;
          }
        }

        // Apply State Updates
        if (newClasses.length > 0) {
            onSetClasses([...classes, ...newClasses]);
        }
        
        if (newStudents.length > 0) {
            onSetStudents([...students, ...newStudents]);
        }

        if (studentsAddedCount === 0 && classesAddedCount === 0) {
             alert('لم يتم العثور على بيانات. تأكد من صحة الملف.');
        } else {
             alert(`تم الاستيراد بنجاح:\n- ${studentsAddedCount} طالب\n- ${classesAddedCount} فصل جديد`);
        }
        
      } catch (error: any) {
        alert('حدث خطأ: ' + error.message);
      } finally {
        setImportLoading(false);
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleClearStudents = () => {
    if (students.length === 0) {
        alert('لا يوجد طلاب لحذفهم.');
        return;
    }
    if (window.confirm('تحذير: سيتم حذف جميع الطلاب المسجلين في النظام. هل أنت متأكد؟\n(لن يتم حذف الفصول أو الجداول)')) {
        onSetStudents([]);
        alert('تم حذف جميع الطلاب بنجاح.');
    }
  };

  const handleManualSaveSettings = () => {
      // Logic is handled by useSyncedState in App.tsx, this is just for feedback
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
  };

  // ... (Rest of handlers remain unchanged)
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setSchoolSettings({ ...schoolSettings, logoUrl: reader.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddSubject = () => {
    if(!subjectForm.name) return;
    const newSubject: Subject = {
        id: `sub_${Date.now()}`,
        name: subjectForm.name,
        color: subjectForm.color
    };
    onSetSubjects([...subjects, newSubject]);
    setSubjectForm({ name: '', color: 'bg-slate-50 border-slate-200 text-slate-800' });
  };

  const handleDeleteSubject = (id: string) => {
    if(window.confirm('هل أنت متأكد من حذف هذه المادة؟ قد يؤثر ذلك على الجدول الحالي.')) {
        onSetSubjects(subjects.filter(s => s.id !== id));
    }
  };

  const handleAddClass = () => {
      if(!newClassName) return;
      const newClass: ClassGroup = {
          id: `c_${Date.now()}`,
          name: newClassName,
          grade: newClassGrade || 'عام'
      };
      onAddClass(newClass);
      setNewClassName('');
      setNewClassGrade('');
      setSelectedClassId(newClass.id);
  };

  const openScheduleEdit = (dayIndex: number, period: number) => {
      if (!selectedClassId) return;
      const existing = schedule.find(s => s.classId === selectedClassId && s.dayIndex === dayIndex && s.period === period);
      setScheduleForm({
          subjectId: existing?.subjectId || '',
          teacherId: existing?.teacherId || ''
      });
      setEditingSlot({ dayIndex, period });
  };

  const saveScheduleSlot = () => {
      if(editingSlot && scheduleForm.subjectId && scheduleForm.teacherId && selectedClassId) {
          onUpdateSchedule({
              classId: selectedClassId,
              dayIndex: editingSlot.dayIndex,
              period: editingSlot.period,
              subjectId: scheduleForm.subjectId,
              teacherId: scheduleForm.teacherId
          });
          setEditingSlot(null);
      }
  };

  const handleAddStudent = () => {
    if (!studentForm.name) return;
    const newStudent: Student = {
      id: Date.now().toString(),
      name: studentForm.name,
      parentPhone: studentForm.parentPhone,
      classId: studentForm.classId || selectedClassId,
      absenceCount: 0
    };
    onSetStudents([...students, newStudent]);
    setStudentForm({ name: '', parentPhone: '', classId: '' });
    setIsAddingStudent(false);
  };

  const handleDeleteStudent = (id: string) => {
    if (window.confirm('هل أنت متأكد من حذف الطالب؟')) {
      onSetStudents(students.filter(s => s.id !== id));
    }
  };

  const startEditStudent = (student: Student) => {
    setEditingStudentId(student.id);
    setStudentForm({ name: student.name, parentPhone: student.parentPhone, classId: student.classId });
  };

  const saveEditStudent = () => {
    onSetStudents(students.map(s => 
      s.id === editingStudentId ? { ...s, name: studentForm.name, parentPhone: studentForm.parentPhone, classId: studentForm.classId } : s
    ));
    setEditingStudentId(null);
    setStudentForm({ name: '', parentPhone: '', classId: '' });
  };

  const handleCreateTeacher = () => {
    if (!teacherForm.name || !teacherForm.password) {
        alert("الرجاء إدخال الاسم وكلمة المرور");
        return;
    }
    const newTeacher: Teacher = {
        id: `t_${Date.now()}`,
        name: teacherForm.name,
        username: teacherForm.username || teacherForm.name.replace(/\s/g, '').toLowerCase(),
        password: teacherForm.password,
        assignedClasses: [] 
    };
    onAddTeacher(newTeacher);
    setTeacherForm({ name: '', username: '', password: '' });
    alert("تم إضافة المعلم بنجاح");
  };

  const handleDeleteTeacher = (id: string) => {
      if(window.confirm('هل أنت متأكد من حذف هذا المعلم؟ سيؤدي ذلك لحذف حسابه من النظام.')) {
          onDeleteTeacher(id);
      }
  };

  const startEditTeacher = (teacher: Teacher) => {
      setEditingTeacherId(teacher.id);
      setTeacherEditForm({
          name: teacher.name,
          username: teacher.username,
          password: teacher.password || ''
      });
  };

  const saveEditTeacher = () => {
      const teacher = teachers.find(t => t.id === editingTeacherId);
      if(teacher) {
          onUpdateTeacher({
              ...teacher,
              name: teacherEditForm.name,
              username: teacherEditForm.username,
              password: teacherEditForm.password
          });
      }
      setEditingTeacherId(null);
  };

  const handleArchiveClick = () => {
    if (!activeClass) return;
    const name = `${activeClass.name} - ${weekInfo.weekNumber}`;
    const classEntries = planEntries.filter(e => e.classId === selectedClassId);
    onArchivePlan(name, weekInfo, classEntries);
    alert('تم أرشفة الخطة الحالية بنجاح');
  };

  const handlePrint = () => {
    window.print();
  };

  const toggleAttendance = (studentId: string) => {
      const currentRecord = attendanceRecords.find(r => r.studentId === studentId && r.date === attendanceDate);
      const newStatus = currentRecord?.status === 'absent' ? 'present' : 'absent';
      onMarkAttendance({
          date: attendanceDate,
          studentId: studentId,
          status: newStatus,
          reportedBy: 'مدير النظام',
          timestamp: new Date().toLocaleTimeString('ar-SA')
      });
  };

  // Messages Logic
  const handleAdminSendMessage = () => {
      if(!newMessageText.trim()) return;
      const msg: Message = {
          id: `msg_${Date.now()}`,
          senderId: 'admin',
          senderName: 'الإدارة',
          receiverId: msgFilter, // 'all' or specific teacherId
          content: newMessageText,
          timestamp: new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'}),
          isRead: false,
          type: msgFilter === 'all' ? 'announcement' : 'direct'
      };
      onSendMessage(msg);
      setNewMessageText('');
  };

  const getFilteredMessages = () => {
      return messages.filter(m => {
          if (msgFilter === 'all') {
              // Show announcements (messages to 'all') OR all messages sent by any teacher to admin
              return m.receiverId === 'all' || m.receiverId === 'admin';
          } else {
              // Conversation between admin and specific teacher
              return (m.senderId === 'admin' && m.receiverId === msgFilter) || 
                     (m.senderId === msgFilter && m.receiverId === 'admin');
          }
      }).sort((a,b) => a.id.localeCompare(b.id)); // sort by ID (roughly timestamp)
  };

  useEffect(() => {
      if (activeTab === 'messages' && messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
  }, [messages, activeTab, msgFilter]);

  const filteredStudents = classStudents.filter(s => s.name.includes(studentSearch));

  // --- TAB CONFIG ---
  const tabs = [
      { id: 'students', label: 'الطلاب', icon: GraduationCap },
      { id: 'classes', label: 'الفصول والجداول', icon: Grid },
      { id: 'plan', label: 'الخطة الحالية', icon: FileText },
      { id: 'attendance', label: 'الغياب', icon: Users },
      { id: 'messages', label: 'الرسائل', icon: MessageSquare },
      { id: 'setup', label: 'الإعدادات', icon: Settings },
      { id: 'archive', label: 'الأرشيف', icon: History },
  ];

  return (
    <div className="w-full bg-slate-50 min-h-screen">
      {/* Hidden File Input for CSV Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={processNoorFile} 
        className="hidden" 
        accept=".csv,.txt"
      />

      {/* Admin Navigation (Floating & Glassmorphism) */}
      <div className="sticky top-0 z-50 pt-4 px-4 pb-2 no-print">
        <div className="max-w-7xl mx-auto bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-slate-200/60 p-2 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as any)}
                            className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all duration-300 font-bold text-sm
                                ${isActive 
                                    ? 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-200' 
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'
                                }`
                            }
                        >
                            <Icon size={18} />
                            {tab.label}
                        </button>
                    )
                })}
            </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 print:max-w-none print:px-0 pb-20 pt-6">
        
        {/* GLOBAL CLASS SELECTOR (Hidden in print & certain tabs) */}
        {activeTab !== 'archive' && activeTab !== 'messages' && activeTab !== 'setup' && (
            <div className="mb-8 bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-4 no-print animate-slideDown">
                <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                    <LayoutDashboard size={24} />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-800">لوحة التحكم النشطة</h2>
                    <p className="text-xs text-slate-500">اختر الفصل لعرض بياناته</p>
                </div>
                <div className="mr-auto flex items-center gap-4 w-full md:w-auto">
                    {hasClasses ? (
                        <div className="relative w-full md:w-64">
                            <select 
                                value={selectedClassId} 
                                onChange={(e) => setSelectedClassId(e.target.value)}
                                className="w-full appearance-none bg-slate-50 border-2 border-slate-200 hover:border-indigo-300 rounded-xl px-4 py-3 pr-10 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50 transition-all cursor-pointer"
                            >
                                {classes.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16}/>
                        </div>
                    ) : (
                        <span className="text-rose-500 font-bold text-sm bg-rose-50 px-4 py-2 rounded-lg border border-rose-100">
                            <AlertCircle className="inline-block ml-2" size={16}/>
                            لا يوجد فصول (يرجى إضافتها أو استيرادها)
                        </span>
                    )}
                </div>
            </div>
        )}

        {/* --- STUDENTS TAB --- */}
        {activeTab === 'students' && (
             <div className="space-y-6 animate-fadeIn">
                 {/* Actions Card */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                        <div>
                            <h2 className="text-3xl font-extrabold mb-2">الطلاب</h2>
                            <p className="text-indigo-100 text-sm max-w-md leading-relaxed opacity-90">
                                إدارة بيانات الطلاب، الاستيراد من نظام نور، وتوزيعهم على الفصول بشكل تلقائي وذكي.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                             <button 
                                onClick={handleNoorImportClick}
                                disabled={importLoading}
                                className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-lg flex items-center gap-2"
                             >
                                {importLoading ? <div className="loader w-4 h-4 border-indigo-600"></div> : <UploadCloud size={20}/>}
                                استيراد (Excel/CSV)
                             </button>
                             <button 
                                onClick={() => setIsAddingStudent(!isAddingStudent)}
                                className="bg-indigo-400/30 backdrop-blur-md text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-400/40 transition-all flex items-center gap-2 border border-white/20"
                             >
                                <Plus size={20}/> إضافة يدوي
                             </button>
                             <button 
                                onClick={handleClearStudents}
                                className="bg-rose-500/80 backdrop-blur-md text-white px-4 py-3 rounded-xl font-bold hover:bg-rose-600/90 transition-all flex items-center gap-2"
                                title="حذف الكل"
                             >
                                <Trash2 size={20}/>
                             </button>
                        </div>
                    </div>
                    {/* Decor */}
                    <GraduationCap className="absolute -bottom-6 -left-6 text-white/10 w-48 h-48 rotate-12" />
                </div>

                {isAddingStudent && (
                    <div className="bg-white p-6 rounded-2xl shadow-lg border border-slate-100 animate-slideDown">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-slate-700 flex items-center gap-2"><Plus className="text-indigo-500"/> إضافة طالب جديد</h3>
                            <button onClick={() => setIsAddingStudent(false)} className="text-slate-400 hover:text-rose-500"><XCircle size={20}/></button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                            <input 
                                type="text" 
                                className="input-modern"
                                placeholder="اسم الطالب"
                                value={studentForm.name}
                                onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                            />
                            <input 
                                type="text" 
                                className="input-modern"
                                placeholder="رقم ولي الأمر"
                                value={studentForm.parentPhone}
                                onChange={(e) => setStudentForm({...studentForm, parentPhone: e.target.value})}
                            />
                            <select 
                                className="input-modern bg-white"
                                value={studentForm.classId || selectedClassId}
                                onChange={(e) => setStudentForm({...studentForm, classId: e.target.value})}
                            >
                                <option value="">اختر الفصل...</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <button onClick={handleAddStudent} className="btn-primary h-[50px]">حفظ البيانات</button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                        <h3 className="font-bold text-slate-700">
                            قائمة الطلاب <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full mr-2">{filteredStudents.length} طالب</span>
                        </h3>
                        <div className="relative w-64">
                            <input 
                                type="text" 
                                placeholder="بحث عن طالب..." 
                                className="w-full bg-white border border-slate-200 rounded-lg py-2 pr-8 pl-4 text-sm focus:border-indigo-400 outline-none"
                                value={studentSearch}
                                onChange={(e) => setStudentSearch(e.target.value)}
                            />
                            <Search className="absolute right-2 top-2.5 text-slate-400" size={16} />
                        </div>
                    </div>

                    {filteredStudents.length === 0 ? (
                        <div className="text-center py-16">
                           <div className="bg-slate-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="text-slate-300" size={32}/>
                           </div>
                           <p className="text-slate-500">لا يوجد طلاب مطابقين للعرض</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase">
                                    <tr>
                                        <th className="px-6 py-4">اسم الطالب</th>
                                        <th className="px-6 py-4">ولي الأمر</th>
                                        <th className="px-6 py-4">الفصل</th>
                                        <th className="px-6 py-4 text-center">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredStudents.map(s => (
                                    <tr key={s.id} className="hover:bg-indigo-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            {editingStudentId === s.id ? (
                                                <input value={studentForm.name} onChange={(e) => setStudentForm({...studentForm, name: e.target.value})} className="input-table" />
                                            ) : <span className="font-bold text-slate-700">{s.name}</span>}
                                        </td>
                                        <td className="px-6 py-4 font-mono text-sm text-slate-500">
                                            {editingStudentId === s.id ? (
                                                <input value={studentForm.parentPhone} onChange={(e) => setStudentForm({...studentForm, parentPhone: e.target.value})} className="input-table" />
                                            ) : s.parentPhone}
                                        </td>
                                        <td className="px-6 py-4">
                                            {editingStudentId === s.id ? (
                                                <select value={studentForm.classId} onChange={(e) => setStudentForm({...studentForm, classId: e.target.value})} className="input-table bg-white">
                                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            ) : <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded border border-slate-200">{classes.find(c => c.id === s.classId)?.name}</span>}
                                        </td>
                                        <td className="px-6 py-4 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {editingStudentId === s.id ? (
                                                <>
                                                    <button onClick={saveEditStudent} className="text-emerald-600 bg-emerald-50 p-2 rounded-lg hover:bg-emerald-100"><Save size={16}/></button>
                                                    <button onClick={() => setEditingStudentId(null)} className="text-slate-500 bg-slate-50 p-2 rounded-lg hover:bg-slate-100"><XCircle size={16}/></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEditStudent(s)} className="text-indigo-600 bg-indigo-50 p-2 rounded-lg hover:bg-indigo-100"><Edit2 size={16}/></button>
                                                    <button onClick={() => handleDeleteStudent(s.id)} className="text-rose-600 bg-rose-50 p-2 rounded-lg hover:bg-rose-100"><Trash2 size={16}/></button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
             </div>
        )}

        {/* Classes & Schedules Tab */}
        {activeTab === 'classes' && (
            <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Class Form */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                            <Grid className="text-indigo-500"/>
                            إضافة فصل جديد
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="label-modern">اسم الفصل (الشعبة)</label>
                                <input 
                                    type="text" 
                                    placeholder="مثال: أول - أ" 
                                    className="input-modern w-full"
                                    value={newClassName}
                                    onChange={(e) => setNewClassName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="label-modern">الصف الدراسي</label>
                                <input 
                                    type="text" 
                                    placeholder="مثال: الصف الأول" 
                                    className="input-modern w-full"
                                    value={newClassGrade}
                                    onChange={(e) => setNewClassGrade(e.target.value)}
                                />
                            </div>
                            <button 
                                onClick={handleAddClass}
                                className="w-full btn-primary py-3"
                            >
                                <Plus size={18} />
                                إنشاء الفصل
                            </button>
                        </div>
                    </div>

                    {/* Schedule Editor */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
                        {activeClass ? (
                            <>
                                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                                    <BookOpen className="text-indigo-500"/>
                                    الجدول الدراسي: <span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-base">{activeClass.name}</span>
                                </h2>
                                
                                <div className="overflow-x-auto rounded-xl border border-slate-200">
                                    <table className="w-full text-center text-sm">
                                        <thead className="bg-slate-50 text-slate-500">
                                            <tr>
                                                <th className="p-3 border-b">اليوم</th>
                                                {[1,2,3,4,5,6,7].map(p => <th key={p} className="p-3 border-b border-r border-slate-200">الحصة {p}</th>)}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {DAYS_OF_WEEK.map((day, dIndex) => (
                                                <tr key={dIndex} className="hover:bg-slate-50/50">
                                                    <td className="p-3 font-bold text-slate-600 bg-slate-50/30">{day}</td>
                                                    {[1,2,3,4,5,6,7].map(period => {
                                                        const slot = schedule.find(s => s.classId === selectedClassId && s.dayIndex === dIndex && s.period === period);
                                                        const subject = subjects.find(s => s.id === slot?.subjectId);
                                                        const teacher = teachers.find(t => t.id === slot?.teacherId);

                                                        return (
                                                            <td 
                                                                key={period} 
                                                                onClick={() => openScheduleEdit(dIndex, period)}
                                                                className={`p-2 border-r border-slate-100 cursor-pointer transition-all hover:brightness-95 ${subject ? subject.color.replace('text-', 'bg-opacity-20 text-') : 'hover:bg-indigo-50'}`}
                                                            >
                                                                {slot ? (
                                                                    <div className={`rounded-lg p-1 ${subject?.color} bg-opacity-10 border`}>
                                                                        <span className="font-bold block text-xs">{subject?.name}</span>
                                                                        <span className="text-[10px] opacity-80 block mt-0.5">{teacher?.name}</span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="w-full h-8 rounded-lg border-2 border-dashed border-slate-100 flex items-center justify-center text-slate-300 hover:border-indigo-300 hover:text-indigo-300">
                                                                        <Plus size={14}/>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="text-center py-20">
                                <AlertCircle className="mx-auto mb-3 text-slate-300" size={40}/>
                                <p className="text-slate-500 font-medium">الرجاء اختيار أو إضافة فصل للبدء</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Editor Modal */}
                {editingSlot && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-6 rounded-2xl w-full max-w-sm animate-slideDown shadow-2xl">
                             <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg text-slate-800">تعديل الحصة {editingSlot.period}</h3>
                                <button onClick={() => setEditingSlot(null)} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
                             </div>
                             
                             <div className="space-y-4">
                                 <div>
                                     <label className="label-modern">المادة الدراسية</label>
                                     <select 
                                        className="input-modern w-full"
                                        value={scheduleForm.subjectId}
                                        onChange={(e) => setScheduleForm({...scheduleForm, subjectId: e.target.value})}
                                     >
                                         <option value="">-- اختر المادة --</option>
                                         {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                     </select>
                                 </div>
                                 <div>
                                     <label className="label-modern">المعلم المسؤول</label>
                                     <select 
                                        className="input-modern w-full"
                                        value={scheduleForm.teacherId}
                                        onChange={(e) => setScheduleForm({...scheduleForm, teacherId: e.target.value})}
                                     >
                                         <option value="">-- اختر المعلم --</option>
                                         {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                     </select>
                                 </div>
                                 
                                 <button onClick={saveScheduleSlot} className="btn-primary w-full py-3 mt-4">حفظ التغييرات</button>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* --- MESSAGES TAB --- */}
        {activeTab === 'messages' && (
            <div className="animate-fadeIn h-[calc(100vh-200px)] min-h-[500px]">
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden h-full flex flex-col md:flex-row">
                    {/* Sidebar */}
                    <div className="w-full md:w-80 border-l border-slate-100 bg-slate-50 flex flex-col">
                        <div className="p-4 border-b border-slate-200 bg-white">
                            <h3 className="font-bold text-slate-800 mb-1">المحادثات</h3>
                            <p className="text-xs text-slate-500">اختر معلماً للمراسلة</p>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            <button 
                                onClick={() => setMsgFilter('all')}
                                className={`w-full p-4 flex items-center gap-3 border-b border-slate-100 transition-colors hover:bg-white ${msgFilter === 'all' ? 'bg-white border-r-4 border-r-indigo-500 shadow-sm' : ''}`}
                            >
                                <div className="bg-amber-100 p-2.5 rounded-full text-amber-600"><Bell size={20}/></div>
                                <div className="text-right">
                                    <p className="font-bold text-sm text-slate-800">تعميم للجميع</p>
                                    <p className="text-[10px] text-slate-400">إرسال إعلانات عامة</p>
                                </div>
                            </button>
                            {teachers.map(t => (
                                <button 
                                    key={t.id}
                                    onClick={() => setMsgFilter(t.id)}
                                    className={`w-full p-4 flex items-center gap-3 border-b border-slate-100 transition-colors hover:bg-white ${msgFilter === t.id ? 'bg-white border-r-4 border-r-indigo-500 shadow-sm' : ''}`}
                                >
                                    <div className="bg-indigo-100 p-2.5 rounded-full text-indigo-600 font-bold text-xs">
                                        {t.name.charAt(0)}
                                    </div>
                                    <div className="text-right overflow-hidden">
                                        <p className="font-bold text-sm text-slate-800 truncate">{t.name}</p>
                                        <p className="text-[10px] text-slate-400">@{t.username}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Chat Area */}
                    <div className="flex-1 flex flex-col bg-white relative">
                        {/* Chat Header */}
                        <div className="p-4 border-b border-slate-100 bg-white/80 backdrop-blur flex justify-between items-center shadow-sm z-10">
                            <div className="flex items-center gap-3">
                                {msgFilter === 'all' ? (
                                    <>
                                        <div className="bg-amber-500 p-2 rounded-lg text-white"><Bell size={20}/></div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">تعميم لجميع المعلمين</h3>
                                            <p className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={10}/> نشط</p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-indigo-600 p-2 rounded-lg text-white"><UserCheck size={20}/></div>
                                        <div>
                                            <h3 className="font-bold text-slate-800">{teachers.find(t => t.id === msgFilter)?.name}</h3>
                                            <p className="text-xs text-slate-500">محادثة مباشرة</p>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
                            {getFilteredMessages().length === 0 ? (
                                <div className="text-center py-20 opacity-50">
                                    <MessageSquare size={48} className="mx-auto mb-2 text-slate-300"/>
                                    <p className="text-slate-400">ابدأ المحادثة بإرسال رسالة</p>
                                </div>
                            ) : (
                                getFilteredMessages().map(msg => {
                                    const isMe = msg.senderId === 'admin';
                                    return (
                                        <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                            <div className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${isMe ? 'bg-indigo-600 text-white rounded-tl-none' : 'bg-white text-slate-800 border border-slate-100 rounded-tr-none'}`}>
                                                {!isMe && <p className="text-[10px] font-bold text-indigo-600 mb-1">{msg.senderName}</p>}
                                                <p className="text-sm leading-relaxed">{msg.content}</p>
                                                <p className={`text-[10px] mt-2 text-right ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.timestamp}</p>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input Area */}
                        <div className="p-4 border-t border-slate-100 bg-white">
                            <div className="flex gap-3">
                                <input 
                                    type="text" 
                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                                    placeholder="اكتب رسالتك هنا..."
                                    value={newMessageText}
                                    onChange={(e) => setNewMessageText(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAdminSendMessage()}
                                />
                                <button 
                                    onClick={handleAdminSendMessage}
                                    className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
                                >
                                    <Send size={20}/>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* --- ARCHIVE TAB (Fully Implemented) --- */}
        {activeTab === 'archive' && (
             <div className="animate-fadeIn">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {archivedPlans.length === 0 ? (
                        <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
                            <div className="bg-amber-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <History size={32} className="text-amber-400"/>
                            </div>
                            <h3 className="text-xl font-bold text-slate-700">الأرشيف فارغ</h3>
                            <p className="text-slate-400 mt-2">لم يتم أرشفة أي خطط بعد.</p>
                        </div>
                    ) : (
                        archivedPlans.map(plan => (
                            <div key={plan.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow group">
                                <div className="bg-gradient-to-r from-slate-800 to-slate-700 p-4 flex justify-between items-center text-white">
                                    <div className="flex items-center gap-2">
                                        <FileText size={18} className="text-slate-300"/>
                                        <span className="font-bold text-sm">{plan.name}</span>
                                    </div>
                                    <span className="text-[10px] bg-white/20 px-2 py-1 rounded">{plan.archivedDate}</span>
                                </div>
                                <div className="p-5">
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">{plan.className}</span>
                                        <span className="text-xs text-slate-400">{plan.entries.length} درس مسجل</span>
                                    </div>
                                    <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100">
                                        <button 
                                            onClick={() => setViewingArchive(plan)}
                                            className="flex-1 bg-indigo-50 text-indigo-600 py-2 rounded-lg font-bold text-sm hover:bg-indigo-100 flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Eye size={16}/> معاينة
                                        </button>
                                        {onDeleteArchive && (
                                            <button 
                                                onClick={() => { if(window.confirm('هل أنت متأكد من حذف هذه الخطة من الأرشيف؟')) onDeleteArchive(plan.id) }}
                                                className="bg-rose-50 text-rose-600 p-2 rounded-lg hover:bg-rose-100 transition-colors"
                                                title="حذف من الأرشيف"
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                 </div>

                 {/* Archive Viewer Modal */}
                 {viewingArchive && (
                     <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 overflow-hidden">
                         <div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col shadow-2xl animate-slideDown overflow-hidden">
                             <div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0">
                                 <div>
                                     <h3 className="font-bold text-lg flex items-center gap-2"><History size={20}/> معاينة الأرشيف</h3>
                                     <p className="text-xs text-slate-400">{viewingArchive.name} | {viewingArchive.archivedDate}</p>
                                 </div>
                                 <div className="flex items-center gap-3">
                                     <button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                                         <Printer size={14}/> طباعة
                                     </button>
                                     <button onClick={() => setViewingArchive(null)} className="bg-rose-500 hover:bg-rose-600 p-2 rounded-full transition-colors">
                                         <X size={18}/>
                                     </button>
                                 </div>
                             </div>
                             <div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center">
                                 <div className="scale-90 origin-top">
                                     <WeeklyPlanTemplate 
                                        classGroup={{id: 'archived', name: viewingArchive.className, grade: ''}} // Mock class for display
                                        weekInfo={viewingArchive.weekInfo}
                                        schedule={[]} // Archive doesn't store schedule, just entries. Template will render entries correctly based on day/period in PlanEntry
                                        // Trick: We pass a mock schedule derived from entries to force cells to render if needed, 
                                        // OR relies on the fact that the Template iterates 1..7.
                                        // The current Template implementation iterates 1..7 regardless of schedule.
                                        // However, it looks up subject from schedule. Archive needs to store Subject info or we might lose color context if subject deleted.
                                        // For simplicity, we use current subjects. If subject deleted, name shows as '-'.
                                        // Improvement: ArchivedPlan should ideally store snapshot of subjects. 
                                        // Current impl: We'll do best effort with current subjects.
                                        planEntries={viewingArchive.entries}
                                        schoolSettings={schoolSettings}
                                        subjects={subjects}
                                     />
                                 </div>
                             </div>
                         </div>
                     </div>
                 )}
             </div>
        )}

        {/* --- SETUP TAB (Updated with Save Button) --- */}
        {activeTab === 'setup' && (
             <div className="space-y-6 animate-fadeIn max-w-5xl mx-auto">
                 {/* School Info */}
                 <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-slate-50 to-white p-6 border-b border-slate-100 flex justify-between items-center">
                        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                            <Settings className="text-slate-600" />
                            الإعدادات العامة
                        </h2>
                        {saveSuccess && (
                            <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 animate-pulse">
                                <CheckCircle size={14}/> تم الحفظ
                            </span>
                        )}
                    </div>
                    
                    <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10">
                        {/* Right Col */}
                        <div className="space-y-5">
                            <h3 className="text-sm font-bold text-indigo-900/50 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">بيانات الترويسة</h3>
                            <div><label className="label-modern">اسم الوزارة</label><input type="text" className="input-modern w-full" value={schoolSettings.authorityName} onChange={(e) => setSchoolSettings({...schoolSettings, authorityName: e.target.value})}/></div>
                            <div><label className="label-modern">اسم الإدارة</label><input type="text" className="input-modern w-full" value={schoolSettings.directorateName} onChange={(e) => setSchoolSettings({...schoolSettings, directorateName: e.target.value})}/></div>
                            <div><label className="label-modern">اسم المدرسة</label><input type="text" className="input-modern w-full" value={schoolSettings.schoolName} onChange={(e) => setSchoolSettings({...schoolSettings, schoolName: e.target.value})}/></div>
                        </div>

                        {/* Left Col */}
                        <div className="space-y-5">
                             <h3 className="text-sm font-bold text-indigo-900/50 uppercase tracking-wider mb-2 border-b border-slate-100 pb-2">تفاصيل الفصل الدراسي</h3>
                             <div className="flex gap-4">
                                 <div className="flex-1"><label className="label-modern">رقم الأسبوع</label><input type="text" className="input-modern w-full" value={weekInfo.weekNumber} onChange={(e) => setWeekInfo({...weekInfo, weekNumber: e.target.value})}/></div>
                                 <div className="flex-[2]"><label className="label-modern">الفصل الدراسي</label><input type="text" className="input-modern w-full" value={weekInfo.semester} onChange={(e) => setWeekInfo({...weekInfo, semester: e.target.value})}/></div>
                             </div>
                             <div className="flex gap-4">
                                 <div className="flex-1"><label className="label-modern">تاريخ البدء</label><input type="text" className="input-modern w-full text-center" value={weekInfo.startDate} onChange={(e) => setWeekInfo({...weekInfo, startDate: e.target.value})}/></div>
                                 <div className="flex-1"><label className="label-modern">تاريخ الانتهاء</label><input type="text" className="input-modern w-full text-center" value={weekInfo.endDate} onChange={(e) => setWeekInfo({...weekInfo, endDate: e.target.value})}/></div>
                             </div>
                             
                             <div>
                                <label className="label-modern">شعار المدرسة</label>
                                <div className="flex items-center gap-4 bg-slate-50 p-3 rounded-xl border border-slate-200 border-dashed">
                                    <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
                                        {schoolSettings.logoUrl ? <img src={schoolSettings.logoUrl} className="w-full h-full object-contain" /> : <ImageIcon className="text-slate-300" />}
                                    </div>
                                    <div className="flex-1">
                                        <input type="file" accept="image/*" onChange={handleLogoUpload} className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 mb-2" />
                                        <input type="text" className="w-full border-none bg-transparent text-xs text-slate-400 focus:text-slate-600 outline-none" placeholder="أو الصق رابط الصورة هنا..." value={schoolSettings.logoUrl} onChange={(e) => setSchoolSettings({...schoolSettings, logoUrl: e.target.value})}/>
                                    </div>
                                </div>
                             </div>
                        </div>
                    </div>
                    
                    {/* The Save Button requested */}
                    <div className="bg-slate-50 p-4 flex justify-end border-t border-slate-200">
                        <button 
                            onClick={handleManualSaveSettings}
                            className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 transform active:scale-95"
                        >
                            <Save size={20} />
                            حفظ كافة الإعدادات
                        </button>
                    </div>
                 </div>
                 
                 {/* Subjects & Teachers */}
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Book className="text-emerald-500"/> المواد الدراسية</h2>
                        <div className="flex gap-2 mb-4">
                            <input type="text" className="input-modern flex-1" placeholder="اسم المادة" value={subjectForm.name} onChange={(e) => setSubjectForm({...subjectForm, name: e.target.value})}/>
                            <select className="input-modern w-32" value={subjectForm.color} onChange={(e) => setSubjectForm({...subjectForm, color: e.target.value})}>
                                {COLORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                            </select>
                            <button onClick={handleAddSubject} className="bg-emerald-600 text-white px-4 rounded-xl hover:bg-emerald-700 transition-colors"><Plus/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                            {subjects.map(s => (
                                <div key={s.id} className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 ${s.color}`}>
                                    {s.name}
                                    <button onClick={() => handleDeleteSubject(s.id)} className="opacity-50 hover:opacity-100"><XCircle size={14}/></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                         <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Users className="text-blue-500"/> حسابات المعلمين</h2>
                         <div className="flex flex-col gap-3 mb-4 bg-blue-50 p-4 rounded-xl border border-blue-100">
                             <div className="flex gap-2">
                                <input type="text" className="input-modern flex-1 bg-white" placeholder="الاسم" value={teacherForm.name} onChange={(e) => setTeacherForm({...teacherForm, name: e.target.value})}/>
                                <input type="text" className="input-modern w-1/3 bg-white" placeholder="User" value={teacherForm.username} onChange={(e) => setTeacherForm({...teacherForm, username: e.target.value})}/>
                             </div>
                             <div className="flex gap-2">
                                <input type="text" className="input-modern flex-1 bg-white" placeholder="Pass" value={teacherForm.password} onChange={(e) => setTeacherForm({...teacherForm, password: e.target.value})}/>
                                <button onClick={handleCreateTeacher} className="bg-blue-600 text-white px-6 rounded-xl hover:bg-blue-700 font-bold text-sm">إضافة</button>
                             </div>
                         </div>
                         <div className="max-h-60 overflow-y-auto pr-1 space-y-2">
                             {teachers.map(t => (
                                 <div key={t.id} className="flex justify-between items-center p-3 bg-white border border-slate-100 rounded-lg shadow-sm">
                                     <div>
                                         <p className="font-bold text-sm text-slate-800">{t.name}</p>
                                         <p className="text-xs text-slate-400 font-mono">@{t.username}</p>
                                     </div>
                                     <button onClick={() => handleDeleteTeacher(t.id)} className="text-rose-400 hover:text-rose-600 bg-rose-50 p-2 rounded-lg"><Trash2 size={16}/></button>
                                 </div>
                             ))}
                         </div>
                    </div>
                 </div>
             </div>
        )}

        {/* PLAN TAB */}
        {activeTab === 'plan' && (
          <div className="animate-fadeIn">
             {activeClass ? (
                 <>
                    <div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center no-print gap-4">
                        <div className="flex items-center gap-3">
                             <div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><FileText size={24}/></div>
                             <div>
                                 <h2 className="text-xl font-bold text-slate-800">معاينة الخطة</h2>
                                 <p className="text-xs text-slate-500">جاهزة للطباعة (A4)</p>
                             </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                            <button onClick={onClearPlans} className="btn-secondary text-rose-600 bg-rose-50 hover:bg-rose-100"><Eraser size={18} /><span>تفريغ</span></button>
                            <button onClick={handleArchiveClick} className="btn-secondary text-amber-600 bg-amber-50 hover:bg-amber-100"><Archive size={18} /><span>أرشفة</span></button>
                            <button onClick={handlePrint} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl hover:bg-slate-900 flex items-center gap-2 font-bold shadow-lg shadow-slate-300 transition-all"><Printer size={18} /><span>طباعة</span></button>
                        </div>
                    </div>
                    {/* Print container */}
                    <div className="bg-white shadow-2xl print:shadow-none mx-auto rounded-none">
                        <WeeklyPlanTemplate 
                            classGroup={activeClass}
                            weekInfo={weekInfo}
                            schedule={schedule.filter(s => s.classId === selectedClassId)}
                            planEntries={planEntries.filter(e => e.classId === selectedClassId)}
                            schoolSettings={schoolSettings}
                            subjects={subjects}
                            onUpdateSettings={setSchoolSettings}
                        />
                    </div>
                 </>
             ) : (
                <div className="text-center py-20 bg-white rounded-2xl shadow border border-slate-100">
                    <AlertCircle className="mx-auto mb-4 text-slate-200" size={48}/>
                    <h3 className="text-xl font-bold text-slate-400">لا يوجد بيانات للعرض</h3>
                </div>
             )}
          </div>
        )}

        {/* Placeholder Tabs */}
        {(activeTab === 'attendance') && (
             <div className="min-h-[400px] bg-white rounded-3xl shadow-sm border border-slate-200 p-10 flex flex-col items-center justify-center text-slate-400 animate-fadeIn">
                 <div className="bg-slate-50 p-6 rounded-full mb-4">
                    {activeTab === 'attendance' && <Users size={48}/>}
                 </div>
                 <h3 className="text-2xl font-bold text-slate-300">قريباً: تحسين واجهة {activeTab === 'attendance' ? 'الغياب' : ''}</h3>
                 <p className="text-slate-400 mt-2">الوظائف تعمل، لكن التصميم قيد التحديث.</p>
             </div>
        )}

      </div>
      
      <style>{`
        .input-modern {
            @apply w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-400 text-sm font-medium;
        }
        .label-modern {
            @apply block text-xs font-bold text-slate-500 mb-1.5 mr-1;
        }
        .btn-primary {
            @apply bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95;
        }
        .btn-secondary {
            @apply px-4 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all active:scale-95 border border-transparent;
        }
        .input-table {
            @apply w-full border border-indigo-300 rounded px-2 py-1 outline-none text-sm focus:ring-2 focus:ring-indigo-100;
        }
      `}</style>
    </div>
  );
};

export default AdminDashboard;