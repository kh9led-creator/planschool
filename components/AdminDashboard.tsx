
import React, { useState, useEffect, useRef } from 'react';
import { ClassGroup, Student, PlanEntry, ScheduleSlot, WeekInfo, Teacher, ArchivedPlan, ArchivedAttendance, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from '../types';
import WeeklyPlanTemplate from './WeeklyPlanTemplate';
import AttendanceReportTemplate from './AttendanceReportTemplate';
import InvoiceModal from './InvoiceModal';
import { Users, FileText, Calendar, Printer, Share2, UploadCloud, CheckCircle, XCircle, Plus, Trash2, Edit2, Save, Archive, History, Grid, BookOpen, Settings, Book, Eraser, Image as ImageIcon, UserCheck, MessageSquare, Send, Bell, Key, AlertCircle, GraduationCap, ChevronLeft, LayoutDashboard, Search, X, Eye, Copy, User, Filter, BarChart3, CreditCard, Lock, Download, Loader2, AlertTriangle, FileArchive, Link as LinkIcon, Globe, Palette } from 'lucide-react';
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
    activationCode: string; 
    email?: string; 
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
  schoolMetadata?: SchoolMetadata;
  onRenewSubscription?: (plan: string, code: string) => Promise<boolean> | boolean;
  pricing?: PricingConfig;
  schoolId: string; 
  onResetSystem?: () => void; 
  archivedAttendanceLogs?: ArchivedAttendance[];
  onArchiveAttendance?: (log: ArchivedAttendance) => void;
  onDeleteAttendanceArchive?: (id: string) => void;
}

const COLORS = [
    { label: 'أزرق', value: 'text-blue-600 bg-blue-50 border-blue-200' },
    { label: 'أخضر', value: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
    { label: 'أرجواني', value: 'text-purple-600 bg-purple-50 border-purple-200' },
    { label: 'برتقالي', value: 'text-orange-600 bg-orange-50 border-orange-200' },
    { label: 'أحمر', value: 'text-rose-600 bg-rose-50 border-rose-200' },
    { label: 'أصفر', value: 'text-amber-600 bg-amber-50 border-amber-200' },
    { label: 'سماوي', value: 'text-cyan-600 bg-cyan-50 border-cyan-200' },
    { label: 'رمادي', value: 'text-slate-600 bg-slate-50 border-slate-200' },
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
  schoolId,
  onResetSystem,
  archivedAttendanceLogs = [],
  onArchiveAttendance,
  onDeleteAttendanceArchive
}) => {
  const isExpired = schoolMetadata ? new Date(schoolMetadata.subscriptionEnd) < new Date() : false;
  const isFrozen = isExpired || (schoolMetadata ? !schoolMetadata.isActive : false);

  const [activeTab, setActiveTab] = useState<'plan' | 'attendance' | 'setup' | 'archive' | 'classes' | 'messages' | 'students'>('students');
  const [archiveViewType, setArchiveViewType] = useState<'weekly_plans' | 'attendance'>('weekly_plans');

  useEffect(() => {
      if (isFrozen) setActiveTab('setup');
  }, [isFrozen]);

  const [printMode, setPrintMode] = useState<'master' | 'students'>('master');
  const hasClasses = classes && classes.length > 0;
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  useEffect(() => {
    if (hasClasses) {
        if (!selectedClassId || !classes.find(c => c.id === selectedClassId)) {
            setSelectedClassId(classes[0].id);
        }
    } else {
        setSelectedClassId('');
    }
  }, [classes, hasClasses]);

  const activeClass = hasClasses ? classes.find(c => c.id === selectedClassId) || classes[0] : null;
  const classStudents = activeClass ? students.filter(s => s.classId === activeClass.id) : [];

  const [importLoading, setImportLoading] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentForm, setStudentForm] = useState({ name: '', parentPhone: '', classId: '' });

  const [teacherForm, setTeacherForm] = useState({ name: '', username: '', password: '' });
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [teacherEditForm, setTeacherEditForm] = useState({ name: '', username: '', password: '' });

  const [subjectForm, setSubjectForm] = useState({ name: '', color: COLORS[0].value });

  const [newClassName, setNewClassName] = useState('');
  const [newClassGrade, setNewClassGrade] = useState('');

  const [editingSlot, setEditingSlot] = useState<{dayIndex: number, period: number} | null>(null);
  const [scheduleForm, setScheduleForm] = useState({ subjectId: '', teacherId: '' });

  const [msgFilter, setMsgFilter] = useState<string>('all'); 
  const [newMessageText, setNewMessageText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [viewingArchive, setViewingArchive] = useState<ArchivedPlan | null>(null);
  const [viewingAttendanceArchive, setViewingAttendanceArchive] = useState<ArchivedAttendance | null>(null);
  const [printAttendanceClass, setPrintAttendanceClass] = useState<ClassGroup | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewPlan, setRenewPlan] = useState<'quarterly' | 'annual'>('quarterly');
  const [renewStep, setRenewStep] = useState(1); 
  const [activationCodeInput, setActivationCodeInput] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);

  // Added missing handlers for subscription renewal
  const handlePaymentConfirm = () => {
    setRenewStep(2);
    if (schoolMetadata?.email) {
      setIsSendingCode(true);
      sendActivationEmail(schoolMetadata.email, schoolMetadata.name, schoolMetadata.activationCode, 'renewal')
        .finally(() => setIsSendingCode(false));
    }
  };

  // Added missing handlers for subscription renewal
  const handleRenewCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRenewSubscription) return;
    const success = await onRenewSubscription(renewPlan, activationCodeInput);
    if (success) {
      alert('تم تجديد الاشتراك بنجاح');
      setShowRenewModal(false);
      setRenewStep(1);
      setActivationCodeInput('');
    } else {
      alert('كود التفعيل غير صحيح');
    }
  };

  const handleNoorImportClick = () => { fileInputRef.current?.click(); };
  
  const handleDownloadTemplate = () => { 
      const wb = XLSX.utils.book_new();
      const wsData = [
          { "اسم الطالب": "مثال: محمد عبدالله", "رقم ولي الأمر": "0500000000", "الفصل": "1", "رقم الصف": "الأول الابتدائي" }
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
          const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          let headerRowIndex = 0;
          for (let i = 0; i < Math.min(rawData.length, 20); i++) {
              if (rawData[i].some((cell: any) => cell && (cell.toString().includes('اسم الطالب') || cell.toString().includes('Student Name')))) {
                  headerRowIndex = i; break;
              }
          }
          const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, { range: headerRowIndex });
          const newStudents: Student[] = [];
          const newClassesToAdd: ClassGroup[] = [];
          const currentClasses = [...classes];
          let createdClassesCount = 0;
          
          jsonData.forEach((row, index) => {
              const keys = Object.keys(row);
              const getName = (k: string) => keys.find(key => key.trim() === k);
              const name = row[getName('اسم الطالب') || ''] || row['name'] || row['Student Name'];
              if (name && typeof name === 'string' && name.trim().length > 1) {
                  let phone = row[getName('الجوال') || ''] || row[getName('رقم ولي الأمر') || ''] || '';
                  phone = (phone || '').toString().trim();
                  if (phone.startsWith('966')) phone = '0' + phone.substring(3);
                  let gradeName = row[getName('رقم الصف') || ''] || '';
                  const sectionNum = row[getName('الفصل') || ''] || '';
                  gradeName = (gradeName || '').toString().split('_')[0].trim();
                  let targetClassName = gradeName && sectionNum ? `${gradeName} (${sectionNum})` : (gradeName || sectionNum || 'طلاب مستجدين');
                  let targetClass = currentClasses.find(c => c.name.trim() === targetClassName.trim());
                  if (!targetClass) {
                      const newClassId = `c_imp_${Date.now()}_${createdClassesCount++}`;
                      const newClassObj = { id: newClassId, schoolId, name: targetClassName, grade: gradeName || 'عام' };
                      newClassesToAdd.push(newClassObj);
                      currentClasses.push(newClassObj);
                      targetClass = newClassObj;
                  }
                  if (!students.some(s => s.name === name.trim() && s.classId === targetClass!.id)) {
                      newStudents.push({ id: `s_${Date.now()}_${index}`, schoolId, name: name.toString().trim(), parentPhone: phone, classId: targetClass!.id, absenceCount: 0 });
                  }
              }
          });
          if (newClassesToAdd.length > 0) onSetClasses([...classes, ...newClassesToAdd]);
          if (newStudents.length > 0) onSetStudents([...students, ...newStudents]);
          alert(`نجاح: تم استيراد ${newStudents.length} طالب وإنشاء ${newClassesToAdd.length} فصل.`);
      } catch (e) { alert('خطأ في استيراد الملف'); } finally { setImportLoading(false); }
  };

  const handleClearStudents = () => {
    if (window.confirm('حذف جميع الطلاب؟')) onSetStudents([]);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => setSchoolSettings({ ...schoolSettings, logoUrl: reader.result as string });
          reader.readAsDataURL(file);
      }
  };

  const handleAddSubject = () => { 
      if(!subjectForm.name) return; 
      onSetSubjects([...subjects, { id: `sub_${Date.now()}`, schoolId, name: subjectForm.name, color: subjectForm.color }]); 
      setSubjectForm({ ...subjectForm, name: '' }); 
  };
  
  const handleDeleteSubject = (id: string) => { 
      if(window.confirm('حذف المادة؟')) onSetSubjects(subjects.filter(s => s.id !== id)); 
  };

  const handleAddClass = () => { 
      if(!newClassName) return; 
      const newClass = { id: `c_${Date.now()}`, schoolId, name: newClassName, grade: newClassGrade || 'عام' }; 
      onAddClass(newClass); setNewClassName(''); setNewClassGrade(''); setSelectedClassId(newClass.id); 
  };

  const openScheduleEdit = (dayIndex: number, period: number) => { 
      if (!selectedClassId) return; 
      const existing = schedule.find(s => s.classId === selectedClassId && s.dayIndex === dayIndex && s.period === period); 
      setScheduleForm({ subjectId: existing?.subjectId || '', teacherId: existing?.teacherId || '' }); 
      setEditingSlot({ dayIndex, period }); 
  };

  const saveScheduleSlot = () => { 
      if(editingSlot && scheduleForm.subjectId && scheduleForm.teacherId && selectedClassId) { 
          onUpdateSchedule({ classId: selectedClassId, dayIndex: editingSlot.dayIndex, period: editingSlot.period, subjectId: scheduleForm.subjectId, teacherId: scheduleForm.teacherId }); 
          setEditingSlot(null); 
      } 
  };

  const handleAddStudent = () => { 
      if (!studentForm.name) return; 
      onSetStudents([...students, { id: Date.now().toString(), schoolId, name: studentForm.name, parentPhone: studentForm.parentPhone, classId: studentForm.classId || selectedClassId, absenceCount: 0 }]); 
      setStudentForm({ name: '', parentPhone: '', classId: '' }); setIsAddingStudent(false); 
  };

  const handleCreateTeacher = () => { 
      if (!teacherForm.name || !teacherForm.password) return; 
      onAddTeacher({ id: `t_${Date.now()}`, schoolId, name: teacherForm.name, username: teacherForm.username || teacherForm.name.replace(/\s/g, '').toLowerCase(), password: teacherForm.password, assignedClasses: [] }); 
      setTeacherForm({ name: '', username: '', password: '' }); 
  };

  const startEditTeacher = (teacher: Teacher) => { 
      setEditingTeacherId(teacher.id); 
      setTeacherEditForm({ name: teacher.name, username: teacher.username, password: teacher.password || '' }); 
  };

  const saveEditTeacher = () => { 
      const teacher = teachers.find(t => t.id === editingTeacherId); 
      if(teacher) onUpdateTeacher({ ...teacher, name: teacherEditForm.name, username: teacherEditForm.username, password: teacherEditForm.password }); 
      setEditingTeacherId(null); 
  };

  const handleArchiveClick = () => { 
      if (!activeClass) return; 
      onArchivePlan(`${activeClass.name} - ${weekInfo.weekNumber}`, weekInfo, planEntries.filter(e => e.classId === selectedClassId)); 
      alert('تمت الأرشفة'); 
  };

  const handleAdminSendMessage = () => { 
      if(!newMessageText.trim()) return; 
      onSendMessage({ id: `msg_${Date.now()}`, senderId: 'admin', senderName: 'الإدارة', receiverId: msgFilter, content: newMessageText, timestamp: new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'}), isRead: false, type: msgFilter === 'all' ? 'announcement' : 'direct' }); 
      setNewMessageText(''); 
  };

  const getFilteredMessages = () => messages.filter(m => msgFilter === 'all' ? (m.receiverId === 'all' || m.receiverId === 'admin') : ((m.senderId === 'admin' && m.receiverId === msgFilter) || (m.senderId === msgFilter && m.receiverId === 'admin'))).sort((a,b) => a.id.localeCompare(b.id));

  const handleArchiveDailyAttendance = () => {
      const absentRecords = attendanceRecords.filter(r => r.date === attendanceDate && r.status === 'absent');
      if (!onArchiveAttendance) return;
      onArchiveAttendance({
          id: `att_arch_${Date.now()}`, schoolId, reportDate: attendanceDate, archivedAt: new Date().toLocaleTimeString('ar-SA'),
          absentStudents: absentRecords.map(r => {
              const s = students.find(st => st.id === r.studentId);
              return { id: s?.id || '?', name: s?.name || '?', className: classes.find(cl => cl.id === s?.classId)?.name || '?', parentPhone: s?.parentPhone || '' };
          })
      });
      alert('تم حفظ سجل الغياب');
  };

  const tabs = [ 
      { id: 'students', label: 'الطلاب', icon: GraduationCap }, 
      { id: 'classes', label: 'الفصول والجداول', icon: Grid }, 
      { id: 'plan', label: 'الخطة الحالية', icon: FileText }, 
      { id: 'attendance', label: 'الغياب', icon: Users }, 
      { id: 'messages', label: 'الرسائل', icon: MessageSquare }, 
      { id: 'setup', label: 'الإعدادات', icon: Settings }, 
      { id: 'archive', label: 'الأرشيف', icon: History } 
  ];

  return (
    <div className="w-full bg-slate-50 min-h-screen">
      <input type="file" ref={fileInputRef} onChange={processNoorFile} className="hidden" accept=".csv,.xlsx,.xls" />

      {isFrozen && (
          <div className="bg-red-600 text-white p-4 text-center sticky top-0 z-[60] shadow-lg no-print">
              <div className="container mx-auto flex items-center justify-center gap-3">
                  <Lock className="animate-pulse" />
                  <p className="font-bold">النظام مجمد بسبب انتهاء الاشتراك. يرجى التجديد من الإعدادات.</p>
              </div>
          </div>
      )}

      <div className={`sticky top-0 z-50 pt-4 px-4 pb-2 no-print ${isFrozen ? 'top-14 pointer-events-none opacity-50' : ''}`}>
        <div className="max-w-7xl mx-auto bg-white/90 backdrop-blur-md shadow-lg rounded-2xl border border-slate-200/60 p-2 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const isDisabled = isFrozen && tab.id !== 'setup';
                    const isActive = activeTab === tab.id;
                    return (
                        <button key={tab.id} onClick={() => !isDisabled && setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all font-bold text-sm ${isActive ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50 hover:text-indigo-600'} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                            <Icon size={18} /> {tab.label}
                        </button>
                    )
                })}
            </div>
        </div>
      </div>

      <div className={`max-w-7xl mx-auto px-4 pb-20 pt-6 ${isFrozen && activeTab !== 'setup' ? 'opacity-30 pointer-events-none' : ''}`}>
        
        {activeTab === 'classes' && (
            <div className="space-y-6 animate-fadeIn">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left Side: Forms */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* Class Add Card */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Grid className="text-indigo-500" size={20}/> إضافة فصل</h2>
                            <div className="space-y-4">
                                <div><label className={labelModernClass}>اسم الفصل</label><input type="text" placeholder="مثال: أول - أ" className={inputModernClass} value={newClassName} onChange={(e) => setNewClassName(e.target.value)}/></div>
                                <div><label className={labelModernClass}>الصف</label><input type="text" placeholder="مثال: الأول" className={inputModernClass} value={newClassGrade} onChange={(e) => setNewClassGrade(e.target.value)}/></div>
                                <button onClick={handleAddClass} className={`${btnPrimaryClass} w-full py-3`}><Plus size={18} /> إنشاء</button>
                            </div>
                        </div>

                        {/* Subject Add Card - RESTORED */}
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800"><Palette className="text-indigo-500" size={20}/> إدارة المواد</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelModernClass}>اسم المادة</label>
                                    <input type="text" placeholder="مثال: لغتي" className={inputModernClass} value={subjectForm.name} onChange={(e) => setSubjectForm({...subjectForm, name: e.target.value})}/>
                                </div>
                                <div>
                                    <label className={labelModernClass}>لون التميز</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {COLORS.map(c => (
                                            <button 
                                                key={c.value} 
                                                onClick={() => setSubjectForm({...subjectForm, color: c.value})}
                                                className={`w-full h-8 rounded-lg border-2 transition-all ${c.value.split(' ')[1]} ${subjectForm.color === c.value ? 'border-slate-800 scale-110 shadow-sm' : 'border-transparent opacity-60 hover:opacity-100'}`}
                                                title={c.label}
                                            />
                                        ))}
                                    </div>
                                </div>
                                <button onClick={handleAddSubject} className={`${btnPrimaryClass} w-full py-3 bg-slate-800 hover:bg-slate-900 shadow-slate-200`}><Plus size={18} /> إضافة المادة</button>
                                
                                {/* Subjects List */}
                                <div className="pt-4 border-t border-slate-100 max-h-48 overflow-y-auto space-y-2 custom-scrollbar pr-1">
                                    {subjects.map(sub => (
                                        <div key={sub.id} className={`flex justify-between items-center p-2 rounded-xl border ${sub.color.split(' ')[2]} ${sub.color.split(' ')[1]} group`}>
                                            <span className="text-xs font-bold">{sub.name}</span>
                                            <button onClick={() => handleDeleteSubject(sub.id)} className="opacity-0 group-hover:opacity-100 text-rose-600 hover:bg-rose-100 p-1 rounded-lg transition-all"><Trash2 size={14}/></button>
                                        </div>
                                    ))}
                                    {subjects.length === 0 && <p className="text-center text-[10px] text-slate-400 py-2">لا توجد مواد مضافة</p>}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Schedule */}
                    <div className="lg:col-span-3">
                        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6 flex flex-wrap items-center gap-4 no-print">
                            <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600"><LayoutDashboard size={24} /></div>
                            <div><h2 className="text-lg font-bold text-slate-800">إدارة الجداول الدراسية</h2><p className="text-xs text-slate-500">اختر الفصل لتعديل حصصه</p></div>
                            <div className="mr-auto w-full md:w-64">
                                {hasClasses && (
                                    <select value={selectedClassId} onChange={(e) => setSelectedClassId(e.target.value)} className="w-full appearance-none bg-slate-50 border-2 border-slate-200 hover:border-indigo-300 rounded-xl px-4 py-3 font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-50 transition-all cursor-pointer">
                                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                )}
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                            {activeClass ? (
                                <>
                                    <div className="flex justify-between items-center mb-4">
                                        <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800"><BookOpen className="text-indigo-500"/> الجدول: <span className="text-indigo-600">{activeClass.name}</span></h2>
                                        <button onClick={() => { const link = `${window.location.origin}?school=${schoolId}&classShare=${activeClass.id}`; navigator.clipboard.writeText(link); alert('تم نسخ رابط المشاركة'); }} className="bg-emerald-50 text-emerald-600 hover:bg-emerald-100 px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shadow-sm border border-emerald-100"><Share2 size={14}/> مشاركة الخطط</button>
                                    </div>
                                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                                        <table className="w-full text-center text-sm border-collapse">
                                            <thead className="bg-slate-50 text-slate-500">
                                                <tr>
                                                    <th className="p-3 border-b border-l">اليوم</th>
                                                    {[1,2,3,4,5,6,7].map(p => <th key={p} className="p-3 border-b border-l border-slate-200">الحصة {p}</th>)}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {DAYS_OF_WEEK.map((day, dIndex) => (
                                                    <tr key={dIndex}>
                                                        <td className="p-3 font-bold text-slate-600 bg-slate-50/30 border-l">{day}</td>
                                                        {[1,2,3,4,5,6,7].map(period => { 
                                                            const slot = schedule.find(s => s.classId === selectedClassId && s.dayIndex === dIndex && s.period === period); 
                                                            const subject = subjects.find(s => s.id === slot?.subjectId); 
                                                            const teacher = teachers.find(t => t.id === slot?.teacherId); 
                                                            return (
                                                                <td key={period} onClick={() => openScheduleEdit(dIndex, period)} className={`p-2 border-l border-slate-100 cursor-pointer transition-all hover:bg-indigo-50 relative group`}>
                                                                    {slot ? (
                                                                        <div className={`rounded-lg p-1.5 ${subject?.color.split(' ')[1]} ${subject?.color.split(' ')[2]} border shadow-sm`}>
                                                                            <span className={`font-bold block text-[10px] ${subject?.color.split(' ')[0]}`}>{subject?.name}</span>
                                                                            <span className="text-[9px] text-slate-500 block mt-0.5 truncate">{teacher?.name}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <div className="w-full h-10 rounded-lg border-2 border-dashed border-slate-100 flex items-center justify-center text-slate-300 group-hover:border-indigo-200 group-hover:text-indigo-400"><Plus size={14}/></div>
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
                                <div className="text-center py-20 text-slate-400"><AlertCircle className="mx-auto mb-3" size={40}/><p>يرجى إضافة فصول دراسية للبدء</p></div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Schedule Modal */}
                {editingSlot && (
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white p-6 rounded-2xl w-full max-w-sm animate-slideDown shadow-2xl">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-lg text-slate-800">تعديل الحصة {editingSlot.period}</h3>
                                <button onClick={() => setEditingSlot(null)} className="text-slate-400 hover:text-rose-500"><X size={20}/></button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className={labelModernClass}>المادة الدراسية</label>
                                    <select className={inputModernClass} value={scheduleForm.subjectId} onChange={(e) => setScheduleForm({...scheduleForm, subjectId: e.target.value})}>
                                        <option value="">-- اختر المادة --</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelModernClass}>المعلم المسؤول</label>
                                    <select className={inputModernClass} value={scheduleForm.teacherId} onChange={(e) => setScheduleForm({...scheduleForm, teacherId: e.target.value})}>
                                        <option value="">-- اختر المعلم --</option>
                                        {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                </div>
                                <button onClick={saveScheduleSlot} className={`${btnPrimaryClass} w-full py-3 mt-4`}>حفظ التغييرات</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* --- STUDENTS TAB --- */}
        {activeTab === 'students' && (
             <div className="space-y-6 animate-fadeIn">
                 <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-8 shadow-xl text-white relative overflow-hidden">
                    <div className="relative z-10 flex flex-col md:flex-row justify-between items-end gap-6">
                        <div>
                            <h2 className="text-3xl font-extrabold mb-2">الطلاب</h2>
                            <p className="text-indigo-100 text-sm max-w-md leading-relaxed opacity-90">إدارة بيانات الطلاب، الاستيراد من نظام نور، وتوزيعهم على الفصول بشكل تلقائي وذكي.</p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                             <button onClick={handleDownloadTemplate} className="bg-indigo-700/50 backdrop-blur-md text-white px-4 py-3 rounded-xl font-bold hover:bg-indigo-800/60 transition-all border border-indigo-400/30 flex items-center gap-2" title="تحميل قالب Excel"><Download size={20} /></button>
                             <button onClick={handleNoorImportClick} disabled={importLoading} className="bg-white text-indigo-600 px-6 py-3 rounded-xl font-bold hover:bg-indigo-50 transition-all shadow-lg flex items-center gap-2">{importLoading ? <Loader2 className="animate-spin" size={18}/> : <UploadCloud size={20}/>} استيراد (Excel/CSV)</button>
                             <button onClick={() => setIsAddingStudent(!isAddingStudent)} className="bg-indigo-400/30 backdrop-blur-md text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-400/40 transition-all flex items-center gap-2 border border-white/20"><Plus size={20}/> إضافة يدوي</button>
                             <button onClick={handleClearStudents} className="bg-rose-500/80 backdrop-blur-md text-white px-4 py-3 rounded-xl font-bold hover:bg-rose-600/90 transition-all flex items-center gap-2" title="حذف الكل"><Trash2 size={20}/></button>
                        </div>
                    </div>
                    <GraduationCap className="absolute -bottom-6 -left-6 text-white/10 w-48 h-48 rotate-12" />
                </div>
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
                        <h3 className="font-bold text-slate-700">قائمة الطلاب <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full mr-2">{students.filter(s => s.classId === selectedClassId).length} طالب</span></h3>
                        <div className="relative w-64"><input type="text" placeholder="بحث عن طالب..." className="w-full bg-white border border-slate-200 rounded-lg py-2 pr-8 pl-4 text-sm focus:border-indigo-400 outline-none" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} /><Search className="absolute right-2 top-2.5 text-slate-400" size={16} /></div>
                    </div>
                    {students.filter(s => s.classId === selectedClassId && s.name.includes(studentSearch)).length === 0 ? <div className="text-center py-16 opacity-50"><Users size={48} className="mx-auto mb-2"/><p>لا يوجد طلاب في هذا الفصل</p></div> : <div className="overflow-x-auto"><table className="w-full text-right"><thead className="bg-slate-50 text-slate-500 font-bold text-xs"><tr><th className="px-6 py-4">اسم الطالب</th><th className="px-6 py-4">ولي الأمر</th><th className="px-6 py-4">الفصل</th><th className="px-6 py-4 text-center">إجراءات</th></tr></thead><tbody className="divide-y divide-slate-100">{students.filter(s => s.classId === selectedClassId && s.name.includes(studentSearch)).map(s => (<tr key={s.id} className="hover:bg-indigo-50/30 transition-colors group"><td className="px-6 py-4 font-bold text-slate-700">{s.name}</td><td className="px-6 py-4 font-mono text-sm text-slate-500">{s.parentPhone}</td><td className="px-6 py-4 text-xs font-bold text-indigo-600">{activeClass?.name}</td><td className="px-6 py-4 flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity"><button onClick={() => { setEditingStudentId(s.id); setStudentForm({name: s.name, parentPhone: s.parentPhone, classId: s.classId}); setIsAddingStudent(true); }} className="text-indigo-600 bg-indigo-50 p-2 rounded-lg hover:bg-indigo-100"><Edit2 size={16}/></button><button onClick={() => onSetStudents(students.filter(x => x.id !== s.id))} className="text-rose-600 bg-rose-50 p-2 rounded-lg hover:bg-rose-100"><Trash2 size={16}/></button></td></tr>))}</tbody></table></div>}
                </div>
             </div>
        )}

        {/* --- PLAN TAB --- */}
        {activeTab === 'plan' && <div className="animate-fadeIn">{activeClass ? (<><div className="mb-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center no-print gap-4"><div className="flex items-center gap-3"><div className="bg-indigo-100 p-2 rounded-lg text-indigo-700"><FileText size={24}/></div><div><h2 className="text-xl font-bold text-slate-800">معاينة الخطة</h2><p className="text-xs text-slate-500">جاهزة للطباعة (A4)</p></div></div><div className="flex items-center gap-2 bg-slate-50 p-1 rounded-lg border border-slate-100"><button onClick={() => setPrintMode('master')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${printMode === 'master' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><Copy size={14}/> نسخة عامة</button><button onClick={() => setPrintMode('students')} className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all flex items-center gap-1 ${printMode === 'students' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500'}`}><User size={14}/> نسخ للطلاب ({classStudents.length})</button></div><div className="flex flex-wrap gap-2 justify-center"><button onClick={onClearPlans} className={`${btnSecondaryClass} text-rose-600 bg-rose-50 hover:bg-rose-100`}><Eraser size={18} /><span>تفريغ</span></button><button onClick={handleArchiveClick} className={`${btnSecondaryClass} text-amber-600 bg-amber-50 hover:bg-amber-100`}><Archive size={18} /><span>أرشفة</span></button><button onClick={() => window.print()} className="bg-slate-800 text-white px-6 py-2.5 rounded-xl hover:bg-slate-900 flex items-center gap-2 font-bold shadow-lg transition-all"><Printer size={18} /><span>طباعة</span></button></div></div><div className="mx-auto rounded-none print:shadow-none">{printMode === 'master' ? (<div className="bg-white shadow-2xl print:shadow-none page-container"><WeeklyPlanTemplate classGroup={activeClass} weekInfo={weekInfo} schedule={schedule.filter(s => s.classId === selectedClassId)} planEntries={planEntries.filter(e => e.classId === selectedClassId)} schoolSettings={schoolSettings} subjects={subjects} onUpdateSettings={setSchoolSettings}/></div>) : (<div>{classStudents.map(student => (<div key={student.id} className="mb-8 print:mb-0 bg-white shadow-2xl print:shadow-none page-container"><WeeklyPlanTemplate classGroup={activeClass} weekInfo={weekInfo} schedule={schedule.filter(s => s.classId === selectedClassId)} planEntries={planEntries.filter(e => e.classId === selectedClassId)} schoolSettings={schoolSettings} subjects={subjects} onUpdateSettings={setSchoolSettings} studentName={student.name}/></div>))}</div>)}</div></>) : <div className="text-center py-20 bg-white rounded-2xl shadow-sm"><AlertCircle className="mx-auto mb-4 text-slate-200" size={48}/><h3 className="text-xl font-bold text-slate-400">لا يوجد بيانات للعرض</h3></div>}</div>}
        {activeTab === 'attendance' && <div className="animate-fadeIn space-y-6"><div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-wrap items-center gap-4 no-print"><div className="flex items-center gap-3"><div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600"><Calendar size={20} /></div><div><label className={labelModernClass}>تاريخ اليوم</label><input type="date" className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)}/></div></div><div className="flex-1"><h2 className="font-bold text-lg text-slate-800">سجل الحضور والغياب</h2><p className="text-xs text-slate-500">متابعة الغياب اليومي وطباعة الكشوفات</p></div><button onClick={handleArchiveDailyAttendance} className="bg-amber-100 text-amber-700 hover:bg-amber-200 px-4 py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center gap-2"><Archive size={16}/> أرشفة السجل اليومي</button></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{classes.map(cls => { const absentCount = students.filter(s => s.classId === cls.id && attendanceRecords.some(r => r.studentId === s.id && r.date === attendanceDate && r.status === 'absent')).length; return (<div key={cls.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow"><div className="p-5 border-b border-slate-100 flex justify-between items-start"><div><h3 className="font-bold text-lg text-slate-800">{cls.name}</h3><p className="text-xs text-slate-400 mt-1">{students.filter(s => s.classId === cls.id).length} طالب مسجل</p></div><div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${absentCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'}`}>{absentCount > 0 ? <><XCircle size={14}/> {absentCount} غياب</> : <><CheckCircle size={14}/> حضور كامل</>}</div></div><div className="p-4 bg-white border-t border-slate-100"><button onClick={() => setPrintAttendanceClass(cls)} className="w-full py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center gap-2"><Printer size={16}/> طباعة كشف الغياب</button></div></div>) })}</div>{printAttendanceClass && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 overflow-hidden"><div className="bg-white w-full max-w-4xl h-[95vh] rounded-2xl flex flex-col shadow-2xl animate-slideDown overflow-hidden"><div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0 no-print"><div><h3 className="font-bold text-lg">كشف غياب: {printAttendanceClass.name}</h3><p className="text-xs text-slate-400">{attendanceDate}</p></div><div className="flex gap-2"><button onClick={() => window.print()} className="bg-white/10 px-4 py-2 rounded-lg text-xs font-bold transition-colors">طباعة</button><button onClick={() => setPrintAttendanceClass(null)} className="bg-rose-500 p-2 rounded-full"><X size={18}/></button></div></div><div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center"><div className="page-container"><AttendanceReportTemplate schoolSettings={schoolSettings} classGroup={printAttendanceClass} teacherName="إدارة النظام" date={attendanceDate} absentStudents={students.filter(s => s.classId === printAttendanceClass.id && attendanceRecords.some(r => r.studentId === s.id && r.date === attendanceDate && r.status === 'absent'))}/></div></div></div></div>}</div>}
        {activeTab === 'messages' && <div className="animate-fadeIn h-[calc(100vh-200px)] min-h-[500px]"><div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden h-full flex flex-col md:flex-row"><div className="w-full md:w-80 border-l border-slate-100 bg-slate-50 flex flex-col"><div className="p-4 border-b border-slate-200 bg-white"><h3 className="font-bold text-slate-800 mb-1">المحادثات</h3><p className="text-xs text-slate-500">اختر معلماً للمراسلة</p></div><div className="flex-1 overflow-y-auto"><button onClick={() => setMsgFilter('all')} className={`w-full p-4 flex items-center gap-3 border-b border-slate-100 transition-colors hover:bg-white ${msgFilter === 'all' ? 'bg-white border-r-4 border-r-indigo-500' : ''}`}><div className="bg-amber-100 p-2.5 rounded-full text-amber-600"><Bell size={20}/></div><div className="text-right font-bold text-sm">تعميم للجميع</div></button>{teachers.map(t => (<button key={t.id} onClick={() => setMsgFilter(t.id)} className={`w-full p-4 flex items-center gap-3 border-b border-slate-100 transition-colors hover:bg-white ${msgFilter === t.id ? 'bg-white border-r-4 border-r-indigo-500' : ''}`}><div className="bg-indigo-100 p-2.5 rounded-full text-indigo-600 font-bold text-xs">{t.name.charAt(0)}</div><div className="text-right"><p className="font-bold text-sm">{t.name}</p><p className="text-[10px] text-slate-400">@{t.username}</p></div></button>))}</div></div><div className="flex-1 flex flex-col bg-white relative"><div className="p-4 border-b border-slate-100 bg-white/80 flex justify-between items-center"><h3 className="font-bold text-slate-800">{msgFilter === 'all' ? 'تعميم لجميع المعلمين' : teachers.find(t => t.id === msgFilter)?.name}</h3></div><div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">{getFilteredMessages().map(msg => (<div key={msg.id} className={`flex ${msg.senderId === 'admin' ? 'justify-end' : 'justify-start'}`}><div className={`max-w-[70%] rounded-2xl p-4 shadow-sm ${msg.senderId === 'admin' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-800 border'}`}><p className="text-sm">{msg.content}</p><p className={`text-[10px] mt-2 text-right ${msg.senderId === 'admin' ? 'text-indigo-200' : 'text-slate-400'}`}>{msg.timestamp}</p></div></div>))}<div ref={messagesEndRef} /></div><div className="p-4 border-t border-slate-100 bg-white"><div className="flex gap-3"><input type="text" className="flex-1 bg-slate-50 border rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-indigo-500" placeholder="اكتب رسالتك..." value={newMessageText} onChange={(e) => setNewMessageText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdminSendMessage()} /><button onClick={handleAdminSendMessage} className="bg-indigo-600 text-white p-3 rounded-xl hover:bg-indigo-700 transition-colors shadow-lg"><Send size={20}/></button></div></div></div></div></div>}
        {activeTab === 'setup' && <div className="animate-fadeIn space-y-6"><div className="grid grid-cols-1 md:grid-cols-2 gap-6"><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><LinkIcon className="text-indigo-500" /> روابط المدرسة</h3><div className="space-y-3"><div className="bg-indigo-50 p-3 rounded-xl flex items-center justify-between"><span className="text-xs font-mono text-slate-600">الدخول المباشر: {window.location.origin}?school={schoolId}</span><button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}?school=${schoolId}`); alert('تم النسخ'); }} className="p-2 bg-white rounded-lg shadow-sm"><Copy size={16}/></button></div><div className="bg-emerald-50 p-3 rounded-xl flex items-center justify-between"><span className="text-xs font-mono text-slate-600">بوابة الخطط: {window.location.origin}?school={schoolId}&public=true</span><button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}?school=${schoolId}&public=true`); alert('تم النسخ'); }} className="p-2 bg-white rounded-lg shadow-sm"><Copy size={16}/></button></div></div></div><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><Settings className="text-indigo-500"/> بيانات المدرسة والشعار</h3><div className="space-y-4"><div><label className={labelModernClass}>اسم المدرسة</label><input type="text" className={inputModernClass} value={schoolSettings.schoolName} onChange={(e) => setSchoolSettings({...schoolSettings, schoolName: e.target.value})}/></div><div className="pt-2 flex items-center gap-4"><div className="w-16 h-16 border-2 border-dashed rounded-xl flex items-center justify-center overflow-hidden">{schoolSettings.logoUrl ? <img src={schoolSettings.logoUrl} className="w-full h-full object-contain"/> : <ImageIcon className="text-slate-300"/>}</div><label className="cursor-pointer bg-indigo-50 text-indigo-600 px-4 py-2 rounded-lg font-bold text-xs"><UploadCloud className="inline-block ml-1" size={14}/> رفع شعار<input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload}/></label></div><button onClick={() => { setSaveSuccess(true); setTimeout(() => setSaveSuccess(false), 2000); }} className={`${btnPrimaryClass} w-full py-3 mt-2`}>{saveSuccess ? 'تم الحفظ!' : 'حفظ الترويسة'}</button></div></div></div><div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200"><h3 className="font-bold text-lg mb-4 flex items-center gap-2 text-slate-800"><UserCheck className="text-indigo-500"/> إدارة المعلمين</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-8"><div><div className="p-4 bg-slate-50 rounded-2xl space-y-3"><input type="text" placeholder="الاسم" className={inputModernClass} value={teacherForm.name} onChange={(e) => setTeacherForm({...teacherForm, name: e.target.value})}/><div className="flex gap-2"><input type="text" placeholder="المستخدم" className={inputModernClass} value={teacherForm.username} onChange={(e) => setTeacherForm({...teacherForm, username: e.target.value})}/><input type="text" placeholder="كلمة المرور" className={inputModernClass} value={teacherForm.password} onChange={(e) => setTeacherForm({...teacherForm, password: e.target.value})}/></div><button onClick={handleCreateTeacher} className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold text-sm">إضافة معلم</button></div></div><div className="max-h-64 overflow-y-auto space-y-2">{teachers.map(t => (<div key={t.id} className="flex justify-between items-center p-3 bg-white border rounded-xl hover:border-indigo-200"><div><p className="font-bold text-sm">{t.name}</p><p className="text-[10px] text-slate-400">@{t.username} | {t.password}</p></div><div className="flex gap-2"><button onClick={() => startEditTeacher(t)} className="text-indigo-500"><Edit2 size={16}/></button><button onClick={() => onDeleteTeacher(t.id)} className="text-rose-500"><Trash2 size={16}/></button></div></div>))}</div></div></div></div>}
        {activeTab === 'archive' && <div className="animate-fadeIn space-y-8"><div className="flex justify-center no-print"><div className="bg-white p-1 rounded-xl shadow-sm border inline-flex"><button onClick={() => setArchiveViewType('weekly_plans')} className={`px-6 py-2.5 rounded-lg text-sm font-bold ${archiveViewType === 'weekly_plans' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}>الخطط</button><button onClick={() => setArchiveViewType('attendance')} className={`px-6 py-2.5 rounded-lg text-sm font-bold ${archiveViewType === 'attendance' ? 'bg-indigo-600 text-white shadow' : 'text-slate-500'}`}>الغياب</button></div></div><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 no-print">{archiveViewType === 'weekly_plans' ? archivedPlans.map(p => (<div key={p.id} className="bg-white rounded-2xl border shadow-sm p-5"><h3 className="font-bold text-slate-800 mb-1">{p.name}</h3><p className="text-[10px] text-slate-400 mb-4">{p.archivedDate}</p><div className="flex gap-2"><button onClick={() => setViewingArchive(p)} className="flex-1 bg-indigo-50 text-indigo-600 py-2 rounded-lg font-bold text-xs">معاينة</button><button onClick={() => onDeleteArchive?.(p.id)} className="text-rose-500 p-2"><Trash2 size={18}/></button></div></div>)) : archivedAttendanceLogs.map(log => (<div key={log.id} className="bg-white rounded-2xl border shadow-sm p-5 group"><h3 className="font-bold text-slate-800 mb-1">سجل {log.reportDate}</h3><p className="text-xs text-rose-600 mb-4">{log.absentStudents.length} غياب</p><div className="flex gap-2"><button onClick={() => setViewingAttendanceArchive(log)} className="flex-1 bg-teal-50 text-teal-600 py-2 rounded-lg font-bold text-xs">معاينة</button><button onClick={() => onDeleteAttendanceArchive?.(log.id)} className="text-rose-500 p-2"><Trash2 size={18}/></button></div></div>))}</div>{viewingArchive && <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-4 overflow-hidden"><div className="bg-white w-full max-w-4xl h-[90vh] rounded-2xl flex flex-col shadow-2xl animate-slideDown overflow-hidden"><div className="bg-slate-800 text-white p-4 flex justify-between items-center shrink-0"><div><h3 className="font-bold text-lg">معاينة الخطة</h3><p className="text-xs text-slate-400">{viewingArchive.name}</p></div><div className="flex gap-2"><button onClick={() => window.print()} className="bg-white/10 px-4 py-2 rounded-lg text-xs font-bold">طباعة</button><button onClick={() => setViewingArchive(null)} className="bg-rose-500 p-2 rounded-full"><X size={18}/></button></div></div><div className="flex-1 overflow-auto bg-slate-100 p-8 flex justify-center"><div className="scale-90 origin-top page-container"><WeeklyPlanTemplate classGroup={{id:'?', name:viewingArchive.className, grade:''}} weekInfo={viewingArchive.weekInfo} schedule={[]} planEntries={viewingArchive.entries} schoolSettings={schoolSettings} subjects={subjects}/></div></div></div></div>}</div>}

        {showRenewModal && schoolMetadata && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                {renewStep === 1 ? (
                   <InvoiceModal schoolName={schoolMetadata.name} plan={renewPlan} amount={renewPlan === 'annual' ? pricing.annual : pricing.quarterly} date={new Date().toLocaleDateString('ar-SA')} invoiceId={`INV-${Date.now()}`} onConfirm={handlePaymentConfirm} />
                ) : (
                   <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl animate-slideDown text-center space-y-4">
                       <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-indigo-600 mb-2"><Key size={32}/></div>
                       <h3 className="text-xl font-bold text-slate-800">تفعيل الاشتراك</h3>
                       <p className="text-sm text-slate-500">تم إرسال كود التفعيل إلى البريد الإلكتروني.</p>
                       <form onSubmit={handleRenewCodeSubmit} className="space-y-4 pt-2">
                           <input type="text" className="w-full text-center text-2xl font-mono border-2 rounded-xl py-3 focus:border-indigo-500 outline-none transition-all uppercase" placeholder="XXXX-XXXX" value={activationCodeInput} onChange={(e) => setActivationCodeInput(e.target.value)} />
                           <button className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg">{isSendingCode ? <Loader2 className="animate-spin mx-auto"/> : 'تفعيل الآن'}</button>
                           <button type="button" onClick={() => setShowRenewModal(false)} className="text-slate-400 text-sm font-bold">إلغاء</button>
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
