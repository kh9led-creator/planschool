import React, { useState, useEffect, useRef } from 'react';
import { ClassGroup, Student, PlanEntry, ScheduleSlot, WeekInfo, Teacher, ArchivedPlan, SchoolSettings, Subject, AttendanceRecord, Message } from '../types';
import WeeklyPlanTemplate from './WeeklyPlanTemplate';
import { Users, FileText, Calendar, Printer, Share2, UploadCloud, CheckCircle, XCircle, Plus, Trash2, Edit2, Save, Archive, History, Grid, BookOpen, Settings, Book, Eraser, Image as ImageIcon, UserCheck, MessageSquare, Send, Bell, Key, AlertCircle, GraduationCap } from 'lucide-react';
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
  onAddClass: (c: ClassGroup) => void;
  onUpdateSchedule: (s: ScheduleSlot) => void;
  attendanceRecords: AttendanceRecord[];
  onMarkAttendance: (record: AttendanceRecord) => void;
  messages: Message[];
  onSendMessage: (msg: Message) => void;
}

const COLORS = [
    { label: 'أحمر', value: 'bg-red-50' },
    { label: 'أزرق', value: 'bg-blue-50' },
    { label: 'أخضر', value: 'bg-green-50' },
    { label: 'أصفر', value: 'bg-yellow-50' },
    { label: 'بنفسجي', value: 'bg-purple-50' },
    { label: 'رمادي', value: 'bg-gray-50' },
    { label: 'برتقالي', value: 'bg-orange-50' },
    { label: 'وردي', value: 'bg-pink-50' },
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
  const [subjectForm, setSubjectForm] = useState({ name: '', color: 'bg-gray-50' });

  // Class Add State
  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('');

  // Schedule Edit State
  const [editingSlot, setEditingSlot] = useState<{dayIndex: number, period: number} | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ subjectId: '', teacherId: '' });

  // Messaging State
  const [messageRecipient, setMessageRecipient] = useState('all');
  const [messageContent, setMessageContent] = useState('');

  // --- Noor Import Logic (Updated for Specific Columns) ---
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
        const lines = text.split('\n');
        
        const newStudents: Student[] = [];
        const newClasses: ClassGroup[] = [];
        
        // Map to track classes (Name -> ID) to prevent duplicates in this batch
        const processedClasses = new Map<string, string>(); 
        classes.forEach(c => processedClasses.set(c.name, c.id));

        let studentsAddedCount = 0;
        let classesAddedCount = 0;

        // Iterate Data Rows
        for (let i = 0; i < lines.length; i++) {
          // Robust split dealing with potential CSV issues slightly better
          const row = lines[i].split(',').map(cell => cell.replace(/"/g, '').trim());
          
          // Column Mapping based on request:
          // Col B (Index 1) -> Phone
          // Col C (Index 2) -> Grade part
          // Col D (Index 3) -> Section part (Take first 2 words)
          // Col E (Index 4) -> Student Name

          // Check if row has enough data and Col E is valid (not empty, not header)
          if (row.length < 5 || !row[4]) continue; 
          if (row[4] === 'اسم الطالب' || row[4].includes('Student Name')) continue; // Skip Header

          const studentName = row[4]; // Col E
          const parentPhone = row[1]; // Col B

          // Class Construction Logic
          const colC = row[2] || '';
          const colD = row[3] || '';
          
          // "يستورد من العامود D فقط اول كلمتين منه"
          const colDProcessed = colD.split(/\s+/).slice(0, 2).join(' ');

          const fullClassName = `${colC} ${colDProcessed}`.trim();

          // Skip if class name is empty or invalid
          if (fullClassName.length < 2) continue;

          // Check if class exists or create it
          let classId = processedClasses.get(fullClassName);

          if (!classId) {
             // Create new class
             classId = `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
             const newClassGroup: ClassGroup = {
               id: classId,
               name: fullClassName,
               grade: colC // Use Col C as the "Grade" field
             };
             
             newClasses.push(newClassGroup);
             processedClasses.set(fullClassName, classId);
             classesAddedCount++;
          }

          // Check for duplicate students (by name)
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

        // Apply updates
        if (newClasses.length > 0) {
            onSetClasses([...classes, ...newClasses]);
        }
        
        if (newStudents.length > 0) {
            onSetStudents([...students, ...newStudents]);
        }

        if (studentsAddedCount === 0 && classesAddedCount === 0) {
             alert('لم يتم العثور على بيانات لاستيرادها. يرجى التأكد من تنسيق الملف (CSV) وأن الأعمدة B, C, D, E تحتوي على البيانات المطلوبة.');
        } else {
             alert(`تم استيراد البيانات بنجاح!\n- تم إضافة ${studentsAddedCount} طالب.\n- تم إنشاء ${classesAddedCount} فصول دراسية.`);
        }
        
      } catch (error: any) {
        alert('حدث خطأ أثناء معالجة الملف: ' + error.message);
        console.error(error);
      } finally {
        setImportLoading(false);
        if(fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // ... (Other handlers remain the same) ...
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
    setSubjectForm({ name: '', color: 'bg-gray-50' });
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

  const handleWhatsAppShare = () => {
    if (!activeClass) return;
    const text = `تم إصدار الخطة الأسبوعية للصف ${activeClass.name} للأسبوع ${weekInfo.weekNumber}.`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
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

  const handleSendAdminMessage = () => {
      if(!messageContent.trim()) return;
      const msg: Message = {
          id: `msg_${Date.now()}`,
          senderId: 'admin',
          senderName: 'الإدارة',
          receiverId: messageRecipient,
          content: messageContent,
          timestamp: new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'}),
          isRead: false,
          type: messageRecipient === 'all' ? 'announcement' : 'direct'
      };
      onSendMessage(msg);
      setMessageContent('');
      alert('تم إرسال الرسالة بنجاح');
  };

  const absentsForClass = activeClass ? classStudents.filter(s => {
      const record = attendanceRecords.find(r => r.studentId === s.id && r.date === attendanceDate);
      return record?.status === 'absent';
  }) : [];

  return (
    <div className="w-full">
      {/* Hidden File Input for CSV Import */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={processNoorFile} 
        className="hidden" 
        accept=".csv,.txt"
      />

      {/* Admin Navigation */}
      <div className="bg-white shadow mb-6 no-print">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8 space-x-reverse h-16 items-center overflow-x-auto">
            <h1 className="text-xl font-bold text-green-700 ml-4 whitespace-nowrap">لوحة تحكم المدير</h1>
            <nav className="flex space-x-4 space-x-reverse">
              <button 
                onClick={() => setActiveTab('students')}
                className={`px-3 py-2 rounded-md text-sm font-bold whitespace-nowrap ${activeTab === 'students' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <div className="flex items-center gap-2"><GraduationCap size={18}/> الطلاب (استيراد)</div>
              </button>
              <button 
                onClick={() => setActiveTab('classes')}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${activeTab === 'classes' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <div className="flex items-center gap-2"><Grid size={16}/> الفصول والجداول</div>
              </button>
              <button 
                onClick={() => setActiveTab('plan')}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${activeTab === 'plan' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                 <div className="flex items-center gap-2"><FileText size={16}/> الخطة الحالية</div>
              </button>
              <button 
                onClick={() => setActiveTab('attendance')}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${activeTab === 'attendance' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                 <div className="flex items-center gap-2"><Users size={16}/> رصد الغياب</div>
              </button>
              <button 
                onClick={() => setActiveTab('messages')}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${activeTab === 'messages' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                 <div className="flex items-center gap-2"><MessageSquare size={16}/> التواصل الداخلي</div>
              </button>
              <button 
                onClick={() => setActiveTab('setup')}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${activeTab === 'setup' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <div className="flex items-center gap-2"><Settings size={16}/> إعدادات عامة</div>
              </button>
              <button 
                onClick={() => setActiveTab('archive')}
                className={`px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap ${activeTab === 'archive' ? 'bg-green-100 text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                 <div className="flex items-center gap-2"><History size={16}/> الأرشيف</div>
              </button>
            </nav>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 print:max-w-none print:px-0 pb-20">
        
        {/* GLOBAL CLASS SELECTOR */}
        {activeTab !== 'archive' && activeTab !== 'messages' && activeTab !== 'setup' && (
            <div className="mb-6 bg-white p-4 rounded-lg shadow flex items-center gap-4 no-print">
                <label className="font-bold text-gray-700">الفصل الحالي:</label>
                {hasClasses ? (
                    <select 
                        value={selectedClassId} 
                        onChange={(e) => setSelectedClassId(e.target.value)}
                        className="border-2 border-green-600 rounded-lg p-2 font-bold text-gray-800 bg-green-50"
                    >
                        {classes.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                ) : (
                    <span className="text-red-500 font-bold text-sm">لا يوجد فصول (يرجى إضافتها أو استيرادها)</span>
                )}
                <span className="text-sm text-gray-500">
                    (يتم عرض بيانات الطلاب والجداول والخطط الخاصة بهذا الفصل فقط)
                </span>
            </div>
        )}

        {/* --- STUDENTS TAB (New) --- */}
        {activeTab === 'students' && (
             <div className="bg-white rounded-lg shadow p-6 animate-fadeIn">
                <div className="mb-8 border-b pb-6">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-gray-800">
                    <UploadCloud className="text-green-600"/>
                    إدارة بيانات الطلاب والاستيراد
                    </h2>
                    
                    <div className="flex flex-col md:flex-row gap-4 mb-4">
                        <button 
                            onClick={handleNoorImportClick}
                            disabled={importLoading}
                            className={`flex-1 py-4 rounded-xl text-white font-bold transition-all flex flex-col items-center justify-center gap-2 shadow-lg ${importLoading ? 'bg-gray-400 cursor-wait' : 'bg-green-600 hover:bg-green-700 transform hover:-translate-y-1'}`}
                        >
                            <UploadCloud size={32}/>
                            <span>{importLoading ? 'جاري الاستيراد...' : 'استيراد الطلاب من نظام نور (CSV)'}</span>
                            <span className="text-[10px] font-normal opacity-80">يدعم ملفات CSV مع إنشاء الفصول تلقائياً</span>
                        </button>
                        
                        <button 
                            onClick={() => setIsAddingStudent(!isAddingStudent)}
                            className="flex-1 bg-indigo-50 text-indigo-800 py-4 rounded-xl hover:bg-indigo-100 font-bold flex flex-col items-center justify-center gap-2 border border-indigo-200 shadow-sm"
                        >
                            <Plus size={32} />
                            <span>إضافة طالب يدوياً</span>
                        </button>
                    </div>

                    {isAddingStudent && (
                        <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4 animate-fadeIn">
                            <h3 className="text-sm font-bold text-gray-700 mb-3">بيانات الطالب الجديد</h3>
                            <div className="flex flex-col md:flex-row gap-4 items-end">
                                <div className="w-full md:w-1/3">
                                    <label className="block text-xs mb-1">الاسم الرباعي</label>
                                    <input 
                                        type="text" 
                                        className="w-full border p-2 rounded text-sm"
                                        placeholder="اسم الطالب"
                                        value={studentForm.name}
                                        onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                                    />
                                </div>
                                <div className="w-full md:w-1/3">
                                    <label className="block text-xs mb-1">رقم ولي الأمر</label>
                                    <input 
                                        type="text" 
                                        className="w-full border p-2 rounded text-sm"
                                        placeholder="05xxxxxxxx"
                                        value={studentForm.parentPhone}
                                        onChange={(e) => setStudentForm({...studentForm, parentPhone: e.target.value})}
                                    />
                                </div>
                                <div className="w-full md:w-1/3">
                                    <label className="block text-xs mb-1">الفصل</label>
                                    <select 
                                        className="w-full border p-2 rounded text-sm bg-white"
                                        value={studentForm.classId || selectedClassId}
                                        onChange={(e) => setStudentForm({...studentForm, classId: e.target.value})}
                                    >
                                        <option value="">اختر الفصل...</option>
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <button onClick={handleAddStudent} className="bg-indigo-600 text-white px-6 py-2 rounded text-sm h-10 font-bold">حفظ</button>
                            </div>
                        </div>
                    )}
                </div>

                <div>
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        قائمة الطلاب المسجلين ({classStudents.length})
                        <span className="text-sm font-normal text-gray-500">- {activeClass?.name || 'الكل'}</span>
                    </h2>
                    {classStudents.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                           {hasClasses ? 'لا يوجد طلاب في هذا الفصل حالياً. قم بالاستيراد أو الإضافة اليدوية.' : 'الرجاء استيراد البيانات لإنشاء الفصول والطلاب تلقائياً.'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 border rounded-lg overflow-hidden">
                                <thead className="bg-gray-50">
                                    <tr>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم الطالب</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">رقم ولي الأمر</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">الفصل</th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {classStudents.map(s => (
                                    <tr key={s.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {editingStudentId === s.id ? (
                                                <input 
                                                    value={studentForm.name} 
                                                    onChange={(e) => setStudentForm({...studentForm, name: e.target.value})}
                                                    className="border p-1 rounded w-full"
                                                />
                                            ) : s.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {editingStudentId === s.id ? (
                                                <input 
                                                    value={studentForm.parentPhone} 
                                                    onChange={(e) => setStudentForm({...studentForm, parentPhone: e.target.value})}
                                                    className="border p-1 rounded w-full"
                                                />
                                            ) : s.parentPhone}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {editingStudentId === s.id ? (
                                                <select 
                                                    value={studentForm.classId} 
                                                    onChange={(e) => setStudentForm({...studentForm, classId: e.target.value})}
                                                    className="border p-1 rounded w-full"
                                                >
                                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                                </select>
                                            ) : classes.find(c => c.id === s.classId)?.name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm flex justify-center gap-3">
                                            {editingStudentId === s.id ? (
                                                <>
                                                    <button onClick={saveEditStudent} className="text-green-600 hover:text-green-800" title="حفظ"><Save size={18}/></button>
                                                    <button onClick={() => setEditingStudentId(null)} className="text-gray-500 hover:text-gray-700" title="إلغاء"><XCircle size={18}/></button>
                                                </>
                                            ) : (
                                                <>
                                                    <button onClick={() => startEditStudent(s)} className="text-blue-600 hover:text-blue-800" title="تعديل"><Edit2 size={18}/></button>
                                                    <button onClick={() => handleDeleteStudent(s.id)} className="text-red-600 hover:text-red-800" title="حذف"><Trash2 size={18}/></button>
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
                {/* Add New Class */}
                <div className="bg-white p-6 rounded-lg shadow">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Grid className="text-purple-600"/>
                        إدارة الفصول
                    </h2>
                    <div className="flex flex-col md:flex-row gap-4 items-end bg-purple-50 p-4 rounded-lg">
                        <div className="flex-1">
                            <label className="block text-xs font-bold mb-1">اسم الفصل (الشعبة)</label>
                            <input 
                                type="text" 
                                placeholder="مثال: أول - أ" 
                                className="w-full border p-2 rounded"
                                value={newClassName}
                                onChange={(e) => setNewClassName(e.target.value)}
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-bold mb-1">الصف الدراسي</label>
                            <input 
                                type="text" 
                                placeholder="مثال: الصف الأول" 
                                className="w-full border p-2 rounded"
                                value={newClassGrade}
                                onChange={(e) => setNewClassGrade(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={handleAddClass}
                            className="bg-purple-600 text-white px-6 py-2 rounded font-bold hover:bg-purple-700"
                        >
                            إضافة فصل
                        </button>
                    </div>
                </div>

                {/* Schedule Editor */}
                <div className="bg-white p-6 rounded-lg shadow">
                    {activeClass ? (
                        <>
                             <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                                <BookOpen className="text-blue-600"/>
                                الجدول الدراسي للفصل: <span className="text-blue-800">{activeClass.name}</span>
                            </h2>
                            <p className="text-sm text-gray-500 mb-4">اضغط على أي حصة لتعديل المادة والمعلم.</p>
                            
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-center text-sm">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="border p-2">اليوم / الحصة</th>
                                            {[1,2,3,4,5,6,7].map(p => <th key={p} className="border p-2">الحصة {p}</th>)}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {DAYS_OF_WEEK.map((day, dIndex) => (
                                            <tr key={dIndex}>
                                                <td className="border p-2 font-bold bg-gray-50">{day}</td>
                                                {[1,2,3,4,5,6,7].map(period => {
                                                    const slot = schedule.find(s => s.classId === selectedClassId && s.dayIndex === dIndex && s.period === period);
                                                    const subject = subjects.find(s => s.id === slot?.subjectId);
                                                    const teacher = teachers.find(t => t.id === slot?.teacherId);

                                                    return (
                                                        <td 
                                                            key={period} 
                                                            onClick={() => openScheduleEdit(dIndex, period)}
                                                            className={`border p-2 cursor-pointer hover:bg-blue-50 transition-colors ${subject ? subject.color : 'bg-white'}`}
                                                        >
                                                            {slot ? (
                                                                <div className="flex flex-col gap-1">
                                                                    <span className="font-bold text-gray-800">{subject?.name}</span>
                                                                    <span className="text-xs text-gray-600">{teacher?.name}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-gray-300 text-2xl">+</span>
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
                        <div className="text-center py-10 text-gray-400">
                            <AlertCircle className="mx-auto mb-2" size={32}/>
                            <p>لا يوجد فصول مسجلة. الرجاء إضافة فصل أولاً من الأعلى.</p>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* Setup Tab */}
        {activeTab === 'setup' && (
          <div className="space-y-6 animate-fadeIn">
            
             {/* Header & Date Settings */}
             <div className="bg-white rounded-lg shadow p-6 border-t-4 border-yellow-500">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                    <Settings className="text-yellow-600" />
                    إعدادات الترويسة والتاريخ
                </h2>
                {/* ... existing header/date inputs ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h3 className="font-bold text-sm text-gray-600 border-b pb-1">معلومات المدرسة</h3>
                        <div>
                            <label className="block text-xs font-bold mb-1">اسم الوزارة</label>
                            <input 
                                type="text" className="w-full border p-2 rounded text-sm"
                                value={schoolSettings.authorityName}
                                onChange={(e) => setSchoolSettings({...schoolSettings, authorityName: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">اسم الإدارة</label>
                            <input 
                                type="text" className="w-full border p-2 rounded text-sm"
                                value={schoolSettings.directorateName}
                                onChange={(e) => setSchoolSettings({...schoolSettings, directorateName: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">اسم المدرسة</label>
                            <input 
                                type="text" className="w-full border p-2 rounded text-sm"
                                value={schoolSettings.schoolName}
                                onChange={(e) => setSchoolSettings({...schoolSettings, schoolName: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1 flex items-center gap-2">
                              شعار المدرسة
                              <span className="text-gray-400 font-normal text-[10px]">(رفع صورة أو رابط)</span>
                            </label>
                            <div className="flex gap-3 items-start p-2 border rounded-lg bg-gray-50">
                                <div className="w-16 h-16 bg-white border rounded flex items-center justify-center overflow-hidden shrink-0">
                                   {schoolSettings.logoUrl ? (
                                      <img src={schoolSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                   ) : (
                                      <ImageIcon className="text-gray-300" />
                                   )}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <input 
                                      type="file"
                                      accept="image/*"
                                      onChange={handleLogoUpload}
                                      className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-green-100 file:text-green-700 hover:file:bg-green-200 cursor-pointer"
                                    />
                                    <input 
                                        type="text" 
                                        className="w-full border p-2 rounded text-xs dir-ltr text-left"
                                        placeholder="أو ألصق رابط الصورة هنا..."
                                        value={schoolSettings.logoUrl}
                                        onChange={(e) => setSchoolSettings({...schoolSettings, logoUrl: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <h3 className="font-bold text-sm text-gray-600 border-b pb-1">إعدادات الأسبوع الحالي</h3>
                        <div>
                             <label className="block text-xs font-bold mb-1">رقم/اسم الأسبوع</label>
                             <input 
                                type="text" className="w-full border p-2 rounded text-sm"
                                value={weekInfo.weekNumber}
                                onChange={(e) => setWeekInfo({...weekInfo, weekNumber: e.target.value})}
                             />
                        </div>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <label className="block text-xs font-bold mb-1">من تاريخ</label>
                                <input 
                                    type="text" className="w-full border p-2 rounded text-sm"
                                    value={weekInfo.startDate}
                                    onChange={(e) => setWeekInfo({...weekInfo, startDate: e.target.value})}
                                />
                            </div>
                            <div className="flex-1">
                                <label className="block text-xs font-bold mb-1">إلى تاريخ</label>
                                <input 
                                    type="text" className="w-full border p-2 rounded text-sm"
                                    value={weekInfo.endDate}
                                    onChange={(e) => setWeekInfo({...weekInfo, endDate: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold mb-1">الفصل الدراسي</label>
                            <input 
                                type="text" className="w-full border p-2 rounded text-sm"
                                value={weekInfo.semester}
                                onChange={(e) => setWeekInfo({...weekInfo, semester: e.target.value})}
                            />
                        </div>
                    </div>
                </div>
             </div>
             
             {/* Subjects Management */}
             <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                   <Book className="text-green-600"/>
                   إدارة المواد الدراسية
                </h2>
                {/* ... existing subject form ... */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">تعريف مادة جديدة</h3>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-1/3">
                            <label className="block text-xs text-gray-500 mb-1">اسم المادة</label>
                            <input 
                                type="text" 
                                className="w-full border p-2 rounded text-sm"
                                placeholder="مثال: لغتي الجميلة"
                                value={subjectForm.name}
                                onChange={(e) => setSubjectForm({...subjectForm, name: e.target.value})}
                            />
                        </div>
                        <div className="w-full md:w-1/3">
                            <label className="block text-xs text-gray-500 mb-1">لون التمييز</label>
                            <select 
                                className="w-full border p-2 rounded text-sm bg-white"
                                value={subjectForm.color}
                                onChange={(e) => setSubjectForm({...subjectForm, color: e.target.value})}
                            >
                                {COLORS.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                        <button 
                            onClick={handleAddSubject}
                            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 text-sm font-bold flex items-center gap-2"
                        >
                            <Plus size={16} /> إضافة
                        </button>
                    </div>
                </div>
                <div className="mt-4">
                    <p className="text-sm text-gray-600 mb-2 font-bold">المواد المعرفة بالنظام:</p>
                    <div className="flex flex-wrap gap-2">
                        {subjects.map(s => (
                            <div key={s.id} className={`border px-3 py-2 rounded-lg text-sm shadow-sm flex items-center gap-2 ${s.color}`}>
                                <span className="font-bold">{s.name}</span>
                                <button onClick={() => handleDeleteSubject(s.id)} className="text-gray-400 hover:text-red-600">
                                    <XCircle size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
             </div>

             {/* Teachers Section */}
             <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-gray-800">
                   <Users className="text-blue-600"/>
                   إدارة حسابات المعلمين
                </h2>
                {/* ... existing teacher form ... */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mb-6">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">إضافة معلم جديد</h3>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="w-full md:w-1/3">
                            <label className="block text-xs text-gray-500 mb-1">اسم المعلم</label>
                            <input 
                                type="text" 
                                className="w-full border p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="مثال: أ. محمد الحربي"
                                value={teacherForm.name}
                                onChange={(e) => setTeacherForm({...teacherForm, name: e.target.value})}
                            />
                        </div>
                        <div className="w-full md:w-1/3">
                            <label className="block text-xs text-gray-500 mb-1">اسم المستخدم (للدخول)</label>
                            <input 
                                type="text" 
                                className="w-full border p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="اسم المستخدم"
                                value={teacherForm.username}
                                onChange={(e) => setTeacherForm({...teacherForm, username: e.target.value})}
                            />
                        </div>
                        <div className="w-full md:w-1/3">
                            <label className="block text-xs text-gray-500 mb-1">كلمة المرور</label>
                            <input 
                                type="text" 
                                className="w-full border p-2 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
                                placeholder="******"
                                value={teacherForm.password}
                                onChange={(e) => setTeacherForm({...teacherForm, password: e.target.value})}
                            />
                        </div>
                        <button 
                            onClick={handleCreateTeacher}
                            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-sm font-bold flex items-center gap-2"
                        >
                            <Plus size={16} /> إضافة
                        </button>
                    </div>
                </div>
                
                <div className="overflow-x-auto">
                    <h3 className="text-sm font-bold text-gray-600 mb-2">المعلمون المسجلون ({teachers.length})</h3>
                    <table className="min-w-full divide-y divide-gray-200 border rounded-lg overflow-hidden">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم المعلم</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">اسم الدخول</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">كلمة المرور</th>
                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {teachers.map(t => (
                                <tr key={t.id} className="hover:bg-gray-50">
                                    {/* ... table rows ... */}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {editingTeacherId === t.id ? (
                                            <input 
                                                value={teacherEditForm.name} 
                                                onChange={(e) => setTeacherEditForm({...teacherEditForm, name: e.target.value})}
                                                className="border p-1 rounded w-full"
                                            />
                                        ) : t.name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dir-ltr text-right">
                                        {editingTeacherId === t.id ? (
                                            <input 
                                                value={teacherEditForm.username} 
                                                onChange={(e) => setTeacherEditForm({...teacherEditForm, username: e.target.value})}
                                                className="border p-1 rounded w-full"
                                            />
                                        ) : t.username}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dir-ltr text-right">
                                        {editingTeacherId === t.id ? (
                                            <input 
                                                value={teacherEditForm.password} 
                                                onChange={(e) => setTeacherEditForm({...teacherEditForm, password: e.target.value})}
                                                className="border p-1 rounded w-full"
                                            />
                                        ) : '******'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm flex justify-center gap-3">
                                        {editingTeacherId === t.id ? (
                                            <>
                                                <button onClick={saveEditTeacher} className="text-green-600 hover:text-green-800" title="حفظ"><Save size={18}/></button>
                                                <button onClick={() => setEditingTeacherId(null)} className="text-gray-500 hover:text-gray-700" title="إلغاء"><XCircle size={18}/></button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEditTeacher(t)} className="text-blue-600 hover:text-blue-800" title="تعديل"><Edit2 size={18}/></button>
                                                <button onClick={() => handleDeleteTeacher(t.id)} className="text-red-600 hover:text-red-800" title="حذف"><Trash2 size={18}/></button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
             </div>
          </div>
        )}

        {/* Weekly Plan Tab */}
        {activeTab === 'plan' && (
          <div className="animate-fadeIn">
             {activeClass ? (
                 <>
                    <div className="mb-4 flex flex-col md:flex-row justify-between items-center no-print gap-4">
                        <h2 className="text-xl font-bold">معاينة الخطة الحالية ({activeClass.name})</h2>
                        <div className="flex flex-wrap gap-2 justify-center">
                            <button 
                                onClick={onClearPlans}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center gap-2 transition-colors text-sm"
                            >
                                <Eraser size={18} />
                                <span>تفريغ الخطط (أسبوع جديد)</span>
                            </button>
                            <button 
                                onClick={handleArchiveClick}
                                className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 flex items-center gap-2 transition-colors text-sm"
                            >
                                <Archive size={18} />
                                <span>أرشفة هذه الخطة</span>
                            </button>
                            <button 
                                onClick={handleWhatsAppShare}
                                className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2 transition-colors text-sm"
                            >
                                <Share2 size={18} />
                                <span>مشاركة واتس اب</span>
                            </button>
                            <button 
                                onClick={handlePrint}
                                className="bg-gray-800 text-white px-4 py-2 rounded-lg hover:bg-gray-900 flex items-center gap-2 transition-colors text-sm"
                            >
                                <Printer size={18} />
                                <span>طباعة الخطة</span>
                            </button>
                        </div>
                    </div>
                    <div className="bg-white shadow-2xl print:shadow-none">
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
                <div className="text-center py-20 bg-white rounded-lg shadow">
                    <AlertCircle className="mx-auto mb-4 text-gray-300" size={48}/>
                    <h3 className="text-xl font-bold text-gray-500">لا يوجد خطط لعرضها</h3>
                    <p className="text-gray-400 mt-2">يرجى إضافة فصول دراسية أولاً.</p>
                </div>
             )}
          </div>
        )}

        {/* Messages Tab (Unchanged) */}
        {activeTab === 'messages' && (
          <div className="animate-fadeIn bg-white rounded-lg shadow h-[600px] flex overflow-hidden">
             {/* ... existing messaging UI ... */}
             <div className="w-1/3 border-l bg-gray-50 flex flex-col">
                 <div className="p-4 border-b">
                     <h3 className="font-bold text-gray-700 mb-2">الرسائل الواردة</h3>
                     <p className="text-xs text-gray-500">رسائل وطلبات من المعلمين</p>
                 </div>
                 <div className="flex-1 overflow-y-auto">
                     {messages.filter(m => m.receiverId === 'admin').length === 0 ? (
                         <div className="p-4 text-center text-gray-400 text-sm">لا يوجد رسائل جديدة</div>
                     ) : (
                        messages.filter(m => m.receiverId === 'admin').map(msg => (
                            <div key={msg.id} className="p-4 border-b hover:bg-white cursor-pointer transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <span className="font-bold text-gray-800 text-sm">{msg.senderName}</span>
                                    <span className="text-xs text-gray-400">{msg.timestamp}</span>
                                </div>
                                <p className="text-gray-600 text-xs line-clamp-2">{msg.content}</p>
                            </div>
                        ))
                     )}
                 </div>
             </div>

             <div className="w-2/3 flex flex-col p-6">
                 <div className="mb-6 border-b pb-4">
                     <h3 className="font-bold text-lg text-blue-800 mb-4 flex items-center gap-2">
                         <Send size={20}/>
                         إرسال رسالة جديدة (تعميم أو خاص)
                     </h3>
                     <div className="space-y-4">
                         <div>
                             <label className="block text-sm font-bold text-gray-700 mb-1">المستلم</label>
                             <select 
                                value={messageRecipient}
                                onChange={(e) => setMessageRecipient(e.target.value)}
                                className="w-full border rounded p-2 text-sm bg-gray-50"
                             >
                                 <option value="all">الكل (تعميم لجميع المعلمين)</option>
                                 {teachers.map(t => (
                                     <option key={t.id} value={t.id}>{t.name}</option>
                                 ))}
                             </select>
                         </div>
                         <div>
                             <label className="block text-sm font-bold text-gray-700 mb-1">نص الرسالة</label>
                             <textarea 
                                value={messageContent}
                                onChange={(e) => setMessageContent(e.target.value)}
                                className="w-full border rounded p-2 text-sm h-24 resize-none"
                                placeholder="اكتب نص الرسالة هنا..."
                             />
                         </div>
                         <div className="flex justify-end">
                             <button 
                                onClick={handleSendAdminMessage}
                                className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center gap-2"
                             >
                                 <Send size={16}/> إرسال
                             </button>
                         </div>
                     </div>
                 </div>

                 <div className="flex-1 bg-gray-50 rounded-lg p-4 overflow-y-auto">
                     <h4 className="font-bold text-gray-500 text-xs mb-3">آخر الرسائل الصادرة:</h4>
                     {messages.filter(m => m.senderId === 'admin').length === 0 ? (
                         <p className="text-center text-gray-400 text-sm">لم يتم إرسال أي رسائل بعد</p>
                     ) : (
                         <div className="space-y-2">
                             {messages.filter(m => m.senderId === 'admin').map(msg => (
                                 <div key={msg.id} className="bg-white p-3 rounded border shadow-sm">
                                     <div className="flex justify-between items-center mb-1">
                                         <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                             {msg.receiverId === 'all' ? 'تعميم عام' : `إلى: ${teachers.find(t => t.id === msg.receiverId)?.name || 'مستخدم'}`}
                                         </span>
                                         <span className="text-xs text-gray-400">{msg.timestamp}</span>
                                     </div>
                                     <p className="text-sm text-gray-700">{msg.content}</p>
                                 </div>
                             ))}
                         </div>
                     )}
                 </div>
             </div>
          </div>
        )}

        {/* Archive Tab (Unchanged) */}
        {activeTab === 'archive' && (
          <div className="animate-fadeIn bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <History className="text-orange-600"/>
                أرشيف الخطط الأسبوعية
            </h2>
            {archivedPlans.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 border border-dashed rounded-lg text-gray-500">
                    لا يوجد خطط مؤرشفة حتى الآن.
                </div>
            ) : (
                <div className="grid gap-4">
                    {archivedPlans.map((plan) => (
                        <div key={plan.id} className="border p-4 rounded-lg hover:shadow-md transition-shadow flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-gray-800">{plan.name}</h3>
                                <p className="text-xs text-gray-500 mt-1">الفصل: {plan.className}</p>
                                <p className="text-xs text-gray-500">تاريخ الأرشفة: {plan.archivedDate}</p>
                            </div>
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => alert('ميزة العرض الكامل للأرشيف ستكون متاحة قريباً')} 
                                    className="text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1 rounded text-sm hover:bg-blue-100"
                                >
                                    عرض
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        )}

        {/* Attendance Tab */}
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-lg shadow p-6 animate-fadeIn">
            {activeClass ? (
                <>
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                        <Calendar className="text-red-600"/>
                        كشف الغياب اليومي: {activeClass.name}
                        </h2>
                        <input 
                        type="date" 
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                        className="border rounded-md p-2 text-sm"
                        />
                    </div>

                    {classStudents.length === 0 ? (
                        <div className="text-center py-10 text-gray-400 bg-gray-50 rounded-lg border border-dashed">
                        يرجى استيراد أو إضافة طلاب لهذا الفصل أولاً.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {classStudents.map(student => {
                            const record = attendanceRecords.find(r => r.studentId === student.id && r.date === attendanceDate);
                            const isAbsent = record?.status === 'absent';
                            
                            return (
                            <div 
                                key={student.id} 
                                onClick={() => toggleAttendance(student.id)}
                                className={`cursor-pointer border-2 rounded-lg p-4 flex flex-col justify-between transition-all relative ${isAbsent ? 'border-red-500 bg-red-50' : 'border-green-500 bg-green-50'}`}
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${isAbsent ? 'bg-red-500' : 'bg-green-500'}`}>
                                            {student.name.charAt(0)}
                                        </div>
                                        <div>
                                            <p className="font-bold text-gray-800">{student.name}</p>
                                            <p className="text-xs text-gray-500">{student.parentPhone}</p>
                                        </div>
                                    </div>
                                    <div>
                                        {isAbsent ? <XCircle className="text-red-600" size={24}/> : <CheckCircle className="text-green-600" size={24}/>}
                                    </div>
                                </div>
                                
                                {isAbsent && record?.reportedBy && (
                                    <div className="mt-2 text-xs bg-red-100 text-red-800 p-2 rounded flex items-center gap-1">
                                        <UserCheck size={12} />
                                        تم الرصد بواسطة: <span className="font-bold">{record.reportedBy}</span>
                                    </div>
                                )}
                                {!isAbsent && (
                                    <div className="mt-2 text-xs text-green-700 opacity-50">حاضر</div>
                                )}
                            </div>
                            );
                        })}
                        </div>
                    )}
                    
                    {absentsForClass.length > 0 && (
                        <div className="mt-8 bg-red-50 border border-red-200 p-4 rounded-lg">
                            <h3 className="font-bold text-red-800 mb-2">ملخص الغياب ({activeClass.name}) - {attendanceDate}</h3>
                            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                {absentsForClass.map(s => {
                                    const record = attendanceRecords.find(r => r.studentId === s.id && r.date === attendanceDate);
                                    return (
                                        <li key={s.id}>
                                            {s.name} - (رصد بواسطة: {record?.reportedBy || 'غير معروف'})
                                        </li>
                                    );
                                })}
                            </ul>
                            <div className="mt-4 flex justify-end">
                                <button 
                                    onClick={() => alert(`تم إشعار أولياء الأمور عبر واتس اب لعدد ${absentsForClass.length} طلاب.`)}
                                    className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 text-sm font-bold flex items-center gap-2"
                                >
                                    <Share2 size={16} />
                                    إرسال رسائل غياب واتس اب
                                </button>
                            </div>
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center py-20">
                     <AlertCircle className="mx-auto mb-2 text-gray-300" size={48}/>
                     <h3 className="text-xl font-bold text-gray-500">لا يوجد بيانات لعرضها</h3>
                     <p className="text-gray-400 mt-2">يرجى إضافة فصول دراسية أولاً.</p>
                </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;