
import React, { useState, useMemo, useRef } from 'react';
import { ClassGroup, Student, PlanEntry, ScheduleSlot, WeekInfo, Teacher, ArchivedPlan, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from '../types';
import WeeklyPlanTemplate from './WeeklyPlanTemplate';
import { Users, FileText, Printer, Plus, Trash2, Grid, BookOpen, Settings, Book, UserCheck, CreditCard, LayoutDashboard, LogOut, School as SchoolIcon, Sparkles, UserPlus, Search, X, FileUp, UploadCloud, Check, AlertCircle } from 'lucide-react';
import { DAYS_OF_WEEK } from '../services/data';
import * as XLSX from 'xlsx';

const inputModernClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-400 text-sm font-medium text-right";
const labelModernClass = "block text-xs font-bold text-slate-500 mb-1.5 mr-1 text-right";
const btnPrimaryClass = "bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 px-6 py-3";
const btnSecondaryClass = "bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 px-6 py-3 shadow-sm";

interface SchoolMetadata {
    id: string;
    name: string;
    subscriptionEnd: string;
    plan: string;
    isActive: boolean;
    activationCode: string; 
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
  onUpdateSchedule: (s: ScheduleSlot) => void;
  attendanceRecords: AttendanceRecord[];
  onMarkAttendance: (record: AttendanceRecord) => void;
  messages: Message[];
  onSendMessage: (msg: Message) => void;
  schoolMetadata: SchoolMetadata;
  onRenewSubscription: (id: string, plan: string, code: string) => Promise<boolean>;
  pricing: PricingConfig;
  schoolId: string; 
  onResetSystem: () => void; 
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  classes, weekInfo, setWeekInfo, schoolSettings, setSchoolSettings, schedule, planEntries, teachers, students, subjects, onSetSubjects, onSetStudents, onSetClasses, onAddTeacher, onDeleteTeacher, onUpdateSchedule, attendanceRecords, schoolMetadata, onRenewSubscription, pricing, schoolId, onResetSystem
}) => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'plan' | 'classes' | 'students' | 'teachers' | 'setup'>('dashboard');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [newStudent, setNewStudent] = useState({ name: '', phone: '', classId: '' });
  const [newClass, setNewClass] = useState({ name: '', grade: '' });
  const [newSubject, setNewSubject] = useState({ name: '', color: 'text-blue-600' });
  const [newTeacher, setNewTeacher] = useState({ name: '', username: '', password: '', assignedClasses: [] as string[] });

  const stats = useMemo(() => ({
      totalStudents: students.length,
      totalTeachers: teachers.length,
      totalClasses: classes.length,
      todayAbsence: attendanceRecords.filter(r => r.date === new Date().toISOString().split('T')[0] && r.status === 'absent').length
  }), [students, teachers, classes, attendanceRecords]);

  const filteredStudents = useMemo(() => students.filter(s => s.name.includes(searchTerm)), [students, searchTerm]);

  // Smart Import Logic
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        // Smart Mapping for Noor Excel Headers
        const mappedData = data.map((row: any) => {
            const nameKey = Object.keys(row).find(k => k.includes('اسم الطالب') || k.includes('الاسم') || k.includes('اسم'));
            const phoneKey = Object.keys(row).find(k => k.includes('جوال') || k.includes('الهاتف') || k.includes('رقم'));
            const classKey = Object.keys(row).find(k => k.includes('الفصل') || k.includes('الشعبة') || k.includes('الصف'));

            return {
                id: `std_${Math.random().toString(36).substr(2, 9)}`,
                name: nameKey ? row[nameKey] : 'غير معروف',
                parentPhone: phoneKey ? String(row[phoneKey]) : '-',
                classId: selectedClassId || '', // Use currently selected class as fallback
                tempClassName: classKey ? row[classKey] : ''
            };
        });

        setImportPreview(mappedData);
        setIsImporting(true);
    };
    reader.readAsBinaryString(file);
  };

  const confirmImport = () => {
      const validStudents: Student[] = importPreview.map(p => ({
          id: p.id,
          name: p.name,
          parentPhone: p.parentPhone,
          classId: p.classId || classes.find(c => c.name === p.tempClassName)?.id || '',
          absenceCount: 0
      }));

      onSetStudents([...students, ...validStudents]);
      setIsImporting(false);
      setImportPreview([]);
      alert(`تم استيراد ${validStudents.length} طالب بنجاح!`);
  };

  return (
    <div className="w-full bg-slate-50 min-h-screen font-sans pb-20" dir="rtl">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-[60] no-print">
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><SchoolIcon size={24}/></div>
                  <div className="text-right">
                      <h2 className="font-black text-slate-900 leading-tight">{schoolSettings.schoolName}</h2>
                      <p className="text-xs text-slate-400 font-bold">لوحة تحكم الإدارة</p>
                  </div>
              </div>
              <div className="flex gap-3">
                  <button onClick={onResetSystem} className="text-slate-400 hover:text-rose-500 p-2 transition-colors"><LogOut size={20}/></button>
                  <button onClick={() => setShowRenewModal(true)} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-black text-xs border border-emerald-100 flex items-center gap-2 hover:bg-emerald-100 transition-all"> <CreditCard size={14}/> تجديد الاشتراك </button>
              </div>
          </div>
      </header>

      <nav className="max-w-7xl mx-auto px-6 pt-6 no-print">
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1 overflow-x-auto justify-end">
              {[
                  {id:'dashboard', label:'الإحصائيات', icon: LayoutDashboard},
                  {id:'students', label:'الطلاب', icon: Users},
                  {id:'teachers', label:'المعلمون', icon: UserCheck},
                  {id:'classes', label:'الجداول', icon: Grid},
                  {id:'plan', label:'الخطط الأسبوعية', icon: FileText},
                  {id:'setup', label:'الإعدادات', icon: Settings}
              ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <tab.icon size={16} /> {tab.label}
                  </button>
              ))}
          </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        
        {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-right">
                        <div className="text-slate-400 font-black text-[10px] uppercase mb-1">إجمالي الطلاب</div>
                        <div className="text-4xl font-black text-slate-900">{stats.totalStudents}</div>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-right">
                        <div className="text-slate-400 font-black text-[10px] uppercase mb-1">المعلمون</div>
                        <div className="text-4xl font-black text-slate-900">{stats.totalTeachers}</div>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-right">
                        <div className="text-slate-400 font-black text-[10px] uppercase mb-1">الفصول</div>
                        <div className="text-4xl font-black text-slate-900">{stats.totalClasses}</div>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm text-right">
                        <div className="text-rose-500 font-black text-[10px] uppercase mb-1">غياب اليوم</div>
                        <div className="text-4xl font-black text-slate-900">{stats.todayAbsence}</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-200 p-10 shadow-sm text-right">
                        <h3 className="font-black text-xl mb-6 flex items-center justify-end gap-3">آخر الطلاب المضافين <Users className="text-indigo-600"/></h3>
                        <div className="space-y-4">
                            {students.slice(-5).reverse().map(s => (
                                <div key={s.id} className="flex justify-between items-center p-4 border border-slate-100 rounded-2xl text-right">
                                    <span className="text-[10px] font-mono text-slate-400">{s.parentPhone}</span>
                                    <div className="flex items-center gap-3">
                                        <div className="text-right">
                                            <p className="font-black text-slate-800 text-sm">{s.name}</p>
                                            <p className="text-[10px] text-slate-400 font-bold">{classes.find(c=>c.id===s.classId)?.name || 'بدون فصل'}</p>
                                        </div>
                                        <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 font-black">{s.name.charAt(0)}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-xl relative overflow-hidden text-right">
                        <div className="relative z-10">
                            <h3 className="font-black text-xl mb-2">حالة النظام</h3>
                            <p className="text-slate-400 text-sm mb-8">إعدادات سريعة لبيئة العمل</p>
                            <div className="space-y-6">
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                                    <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black">نشط</span>
                                    <span className="text-xs font-black">الربط السحابي</span>
                                </div>
                                <div className="flex justify-between items-center bg-white/5 p-4 rounded-2xl border border-white/10">
                                    <span className="bg-emerald-500 text-white px-3 py-1 rounded-full text-[10px] font-black">مفعل</span>
                                    <span className="text-xs font-black">نسخ احتياطي فوري</span>
                                </div>
                            </div>
                        </div>
                        <Sparkles className="absolute -bottom-10 -left-10 text-white/5 w-64 h-64 pointer-events-none" />
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'students' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn text-right">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <div className="flex justify-between items-center mb-8">
                             <button onClick={() => fileInputRef.current?.click()} className="text-indigo-600 text-xs font-bold hover:underline flex items-center gap-1">
                                <FileUp size={14}/> استيراد من نور (Excel)
                             </button>
                             <h3 className="font-black text-slate-900 flex items-center gap-3 text-xl">إضافة طالب <Plus className="text-indigo-600"/></h3>
                             <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload}/>
                        </div>
                        <div className="space-y-5">
                            <div>
                                <label className={labelModernClass}>اسم الطالب الثلاثي</label>
                                <input className={inputModernClass} placeholder="أدخل الاسم..." value={newStudent.name} onChange={e=>setNewStudent({...newStudent, name:e.target.value})}/>
                            </div>
                            <div>
                                <label className={labelModernClass}>جوال ولي الأمر</label>
                                <input className={inputModernClass} placeholder="05xxxxxxxx" value={newStudent.phone} onChange={e=>setNewStudent({...newStudent, phone:e.target.value})}/>
                            </div>
                            <div>
                                <label className={labelModernClass}>الفصل الدراسي</label>
                                <select className={inputModernClass} value={newStudent.classId} onChange={e=>setNewStudent({...newStudent, classId:e.target.value})}>
                                    <option value="">اختر الفصل...</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <button onClick={() => {
                                if (!newStudent.name || !newStudent.classId) return alert('أكمل البيانات المطلوبة');
                                onSetStudents([...students, { id: `std_${Date.now()}`, name: newStudent.name, parentPhone: newStudent.phone, classId: newStudent.classId, absenceCount: 0 }]);
                                setNewStudent({ name: '', phone: '', classId: '' });
                            }} className={`w-full ${btnPrimaryClass} py-4`}>حفظ الطالب</button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-100 flex flex-row-reverse justify-between items-center bg-slate-50/50">
                            <h3 className="font-black text-slate-800">سجل الطلاب ({students.length})</h3>
                            <div className="relative w-64">
                                <Search className="absolute right-4 top-3.5 text-slate-400" size={18}/>
                                <input className="w-full bg-white border border-slate-200 rounded-2xl pr-12 py-3 text-xs outline-none focus:border-indigo-400 font-bold" placeholder="ابحث باسم الطالب..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
                            </div>
                        </div>
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50 text-slate-500 font-black text-[10px]">
                                <tr>
                                    <th className="p-6">اسم الطالب</th>
                                    <th className="p-6">الفصل</th>
                                    <th className="p-6">الجوال</th>
                                    <th className="p-6 text-center">العمليات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold">
                                {filteredStudents.map(student => (
                                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="p-6"><div className="font-black text-slate-800">{student.name}</div></td>
                                        <td className="p-6"><span className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-xl text-[10px] font-black border border-indigo-100">{classes.find(c=>c.id===student.classId)?.name || 'بدون فصل'}</span></td>
                                        <td className="p-6 font-mono text-xs text-slate-500">{student.parentPhone}</td>
                                        <td className="p-6 text-center"><button onClick={() => { if(confirm('حذف الطالب؟')) onSetStudents(students.filter(s=>s.id!==student.id))}} className="p-2.5 text-rose-400 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18}/></button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {/* --- REST OF THE TABS --- */}
        {activeTab === 'teachers' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn text-right">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="font-black text-slate-900 mb-8 flex items-center justify-end gap-3 text-xl">إضافة معلم <UserPlus className="text-indigo-600"/></h3>
                        <div className="space-y-5">
                            <input className={inputModernClass} placeholder="اسم المعلم" value={newTeacher.name} onChange={e=>setNewTeacher({...newTeacher, name:e.target.value})}/>
                            <input className={inputModernClass} placeholder="اسم المستخدم" value={newTeacher.username} onChange={e=>setNewTeacher({...newTeacher, username:e.target.value})}/>
                            <input className={inputModernClass} type="password" placeholder="كلمة المرور" value={newTeacher.password} onChange={e=>setNewTeacher({...newTeacher, password:e.target.value})}/>
                            <button onClick={() => {
                                if(!newTeacher.name || !newTeacher.username || !newTeacher.password) return alert('أكمل البيانات');
                                onAddTeacher({ id: `tea_${Date.now()}`, ...newTeacher, assignedClasses: [] });
                                setNewTeacher({ name: '', username: '', password: '', assignedClasses: [] });
                            }} className={`w-full ${btnPrimaryClass} py-4`}>إنشاء الحساب</button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {teachers.map(t => (
                            <div key={t.id} className="p-6 bg-white border border-slate-100 rounded-3xl flex flex-row-reverse justify-between items-center hover:border-indigo-200 transition-all shadow-sm">
                                <div className="text-right">
                                    <p className="font-black text-slate-800">{t.name}</p>
                                    <p className="text-[10px] text-slate-400 font-bold">@{t.username}</p>
                                </div>
                                <button onClick={() => { if(confirm('حذف المعلم؟')) onDeleteTeacher(t.id)}} className="p-2 text-slate-300 hover:text-rose-500 transition-all"><Trash2 size={20}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'classes' && (
            <div className="space-y-8 animate-fadeIn text-right">
                <div className="flex flex-col md:flex-row-reverse justify-between items-end bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm gap-6">
                    <div className="flex flex-row-reverse gap-4 items-end flex-1 w-full text-right">
                        <div className="flex-1 text-right">
                            <label className={labelModernClass}>اسم الفصل</label>
                            <input className={inputModernClass} placeholder="مثال: 1/أ" value={newClass.name} onChange={e=>setNewClass({...newClass, name:e.target.value})}/>
                        </div>
                        <div className="flex-1 text-right">
                            <label className={labelModernClass}>المرحلة</label>
                            <input className={inputModernClass} placeholder="الصف الأول" value={newClass.grade} onChange={e=>setNewClass({...newClass, grade:e.target.value})}/>
                        </div>
                        <button onClick={() => {
                            if(!newClass.name) return;
                            onSetClasses([...classes, { id: `cls_${Date.now()}`, ...newClass }]);
                            setNewClass({ name: '', grade: '' });
                        }} className={btnPrimaryClass}><Plus size={20}/> إضافة</button>
                    </div>
                    <div className="border-l pl-6 border-slate-100 text-right">
                        <label className={labelModernClass}>إدارة الحصص للفصل</label>
                        <select className={inputModernClass} value={selectedClassId} onChange={e=>setSelectedClassId(e.target.value)}>
                            <option value="">اختر الفصل لإدارة الجداول...</option>
                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                </div>

                {selectedClassId ? (
                    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden animate-slideDown">
                        <div className="bg-slate-900 text-white p-10 flex flex-row-reverse justify-between items-center">
                            <h3 className="text-3xl font-black">جدول الحصص: {classes.find(c=>c.id===selectedClassId)?.name}</h3>
                            <button onClick={() => setSelectedClassId('')} className="bg-white/10 p-3 rounded-full hover:bg-rose-500 transition-all"><X size={24}/></button>
                        </div>
                        <div className="p-10 overflow-x-auto">
                            <table className="w-full text-center border-collapse">
                                <thead className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase">
                                    <tr>
                                        <th className="p-6 border-b">اليوم</th>
                                        {[1,2,3,4,5,6,7].map(p => <th key={p} className="p-6 border-b">الحصة {p}</th>)}
                                    </tr>
                                </thead>
                                <tbody className="font-bold">
                                    {DAYS_OF_WEEK.map((day, dIdx) => (
                                        <tr key={day} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-6 border-b bg-slate-50/50 font-black text-slate-800 text-sm">{day}</td>
                                            {[1,2,3,4,5,6,7].map(p => {
                                                const slot = schedule.find(s => s.classId === selectedClassId && s.dayIndex === dIdx && s.period === p);
                                                return (
                                                    <td key={p} className="p-3 border-b group relative hover:bg-indigo-50 transition-all">
                                                        <div className="flex flex-col gap-1.5 min-w-[100px]">
                                                            <select 
                                                                className="w-full text-[10px] bg-white border border-slate-100 rounded-lg p-1.5 outline-none font-black text-slate-700 shadow-sm"
                                                                value={slot?.subjectId || ""}
                                                                onChange={e => onUpdateSchedule({ classId: selectedClassId, dayIndex: dIdx, period: p, subjectId: e.target.value, teacherId: slot?.teacherId || "" })}
                                                            >
                                                                <option value="">+ مادة</option>
                                                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                            </select>
                                                            <select 
                                                                className="w-full text-[9px] bg-slate-50 border border-slate-100 rounded-lg p-1.5 outline-none text-slate-500 font-bold"
                                                                value={slot?.teacherId || ""}
                                                                onChange={e => onUpdateSchedule({ classId: selectedClassId, dayIndex: dIdx, period: p, subjectId: slot?.subjectId || "", teacherId: e.target.value })}
                                                            >
                                                                <option value="">+ معلم</option>
                                                                {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                                            </select>
                                                        </div>
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200">
                         <h4 className="text-xl font-black text-slate-800">يرجى اختيار فصلاً لعرض جدول الحصص</h4>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'plan' && (
            <div className="space-y-6 animate-fadeIn text-right">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row-reverse justify-between items-center no-print gap-4">
                    <select className={inputModernClass} style={{maxWidth: '300px'}} value={selectedClassId} onChange={e=>setSelectedClassId(e.target.value)}>
                        <option value="">اختر الفصل لعرض الخطة...</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center gap-2 shadow-lg"><Printer size={18}/> طباعة الخطة </button>
                </div>
                {selectedClassId ? (
                    <div className="flex justify-center p-8 bg-slate-200 rounded-[3rem] shadow-inner overflow-auto min-h-[1122px] print:p-0 print:bg-white">
                        <div className="origin-top scale-[0.6] sm:scale-[0.8] lg:scale-100 shadow-2xl print:shadow-none print:scale-100 bg-white">
                            <WeeklyPlanTemplate 
                                classGroup={classes.find(c=>c.id===selectedClassId)!}
                                weekInfo={weekInfo}
                                subjects={subjects}
                                schedule={schedule.filter(s=>s.classId===selectedClassId)}
                                planEntries={planEntries.filter(e=>e.classId===selectedClassId)}
                                schoolSettings={schoolSettings}
                                onUpdateSettings={setSchoolSettings}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="p-32 text-center bg-white rounded-[3rem] border border-slate-100">
                         <p className="font-black text-slate-400">يرجى اختيار الفصل لعرض الخطة الأسبوعية</p>
                    </div>
                )}
            </div>
        )}

        {activeTab === 'setup' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn text-right">
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                    <h3 className="text-2xl font-black text-slate-800 flex flex-row-reverse items-center gap-3">إعدادات المرويسة والترويسة <Settings className="text-indigo-600"/></h3>
                    <input className={inputModernClass} placeholder="اسم الوزارة" value={schoolSettings.ministryName} onChange={e=>setSchoolSettings({...schoolSettings, ministryName:e.target.value})}/>
                    <input className={inputModernClass} placeholder="اسم المدرسة" value={schoolSettings.schoolName} onChange={e=>setSchoolSettings({...schoolSettings, schoolName:e.target.value})}/>
                    <input className={inputModernClass} placeholder="رابط الشعار" value={schoolSettings.logoUrl} onChange={e=>setSchoolSettings({...schoolSettings, logoUrl:e.target.value})}/>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <input type="date" className={inputModernClass} value={weekInfo.startDate} onChange={e=>setWeekInfo({...weekInfo, startDate:e.target.value})}/>
                        <input type="date" className={inputModernClass} value={weekInfo.endDate} onChange={e=>setWeekInfo({...weekInfo, endDate:e.target.value})}/>
                    </div>
                </div>
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                    <h3 className="text-2xl font-black text-slate-800 flex flex-row-reverse items-center gap-3">إدارة المواد الدراسية <Book className="text-indigo-600"/></h3>
                    <div className="flex flex-row-reverse gap-4">
                        <input className={inputModernClass} placeholder="اسم المادة..." value={newSubject.name} onChange={e=>setNewSubject({...newSubject, name:e.target.value})}/>
                        <button onClick={() => {
                            if(!newSubject.name) return;
                            onSetSubjects([...subjects, { id: `sub_${Date.now()}`, name: newSubject.name, color: 'bg-white' }]);
                            setNewSubject({ name: '', color: 'bg-white' });
                        }} className={btnPrimaryClass}>إضافة</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 max-h-[400px] overflow-y-auto pr-2">
                        {subjects.map(s => (
                            <div key={s.id} className="flex flex-row-reverse justify-between items-center p-4 border border-slate-100 rounded-2xl bg-slate-50 font-black text-xs">
                                <span>{s.name}</span>
                                <button onClick={() => onSetSubjects(subjects.filter(x=>x.id!==s.id))} className="text-rose-400 hover:text-rose-600"><X size={16}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </main>

      {/* Import Modal */}
      {isImporting && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] w-full max-w-4xl h-[80vh] flex flex-col shadow-2xl animate-slideDown border border-slate-100 overflow-hidden">
                  <div className="p-8 bg-indigo-600 text-white flex justify-between items-center shrink-0">
                      <div>
                          <h3 className="text-2xl font-black flex items-center gap-2"><UploadCloud/> معالجة بيانات الطلاب</h3>
                          <p className="text-indigo-100 text-xs mt-1">تم اكتشاف {importPreview.length} سجل في ملفك</p>
                      </div>
                      <button onClick={() => setIsImporting(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={24}/></button>
                  </div>
                  
                  <div className="flex-1 overflow-auto p-8">
                      <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl mb-6 flex items-start gap-3 text-amber-800 text-sm">
                          <AlertCircle className="shrink-0" size={20}/>
                          <p>يرجى التأكد من ربط الطلاب بالفصول الصحيحة. إذا لم يتم اكتشاف الفصل تلقائياً، سيتم الاستيراد بدون فصل ويمكنك تحديثه لاحقاً.</p>
                      </div>
                      
                      <table className="w-full text-right">
                          <thead className="sticky top-0 bg-white border-b-2 border-slate-100 text-slate-400 text-xs font-black">
                              <tr>
                                  <th className="pb-4 pt-2 px-4">اسم الطالب</th>
                                  <th className="pb-4 pt-2 px-4">رقم الجوال</th>
                                  <th className="pb-4 pt-2 px-4">الفصل المكتشف</th>
                                  <th className="pb-4 pt-2 px-4">الإجراء</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                              {importPreview.map((p, idx) => (
                                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                      <td className="py-4 px-4 font-bold text-slate-800">{p.name}</td>
                                      <td className="py-4 px-4 font-mono text-xs">{p.parentPhone}</td>
                                      <td className="py-4 px-4">
                                          {classes.find(c => c.name === p.tempClassName) ? (
                                              <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black">{p.tempClassName}</span>
                                          ) : (
                                              <span className="bg-rose-50 text-rose-500 px-3 py-1 rounded-full text-[10px] font-black">{p.tempClassName || 'غير محدد'}</span>
                                          )}
                                      </td>
                                      <td className="py-4 px-4">
                                          <button onClick={() => setImportPreview(importPreview.filter((_, i) => i !== idx))} className="text-rose-400 hover:text-rose-600 transition-colors"><Trash2 size={16}/></button>
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  <div className="p-8 border-t border-slate-100 bg-slate-50 flex gap-4">
                      <button onClick={confirmImport} className={`flex-1 ${btnPrimaryClass} py-4`}><Check size={20}/> تأكيد استيراد البيانات </button>
                      <button onClick={() => setIsImporting(false)} className={`${btnSecondaryClass} px-10`}> إلغاء </button>
                  </div>
              </div>
          </div>
      )}

      {/* Renew Modal */}
      {showRenewModal && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-slideDown border border-slate-100">
                  <h3 className="text-3xl font-black mb-8 text-center">تجديد الاشتراك</h3>
                  <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <button className="p-6 border-2 border-slate-100 rounded-[2rem] text-center bg-indigo-50/20">
                              <p className="text-[10px] font-black text-slate-400 mb-2">الباقة الفصلية</p>
                              <p className="text-2xl font-black text-slate-900">{pricing.quarterly} {pricing.currency}</p>
                          </button>
                          <button className="p-6 border-2 border-indigo-600 bg-indigo-50/50 rounded-[2rem] text-center shadow-xl">
                              <p className="text-[10px] font-black text-indigo-600 mb-2">الباقة السنوية</p>
                              <p className="text-2xl font-black text-indigo-900">{pricing.annual} {pricing.currency}</p>
                          </button>
                      </div>
                      <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-center font-black outline-none focus:border-indigo-500" placeholder="أدخل كود التفعيل" id="activationCodeInput"/>
                      <button 
                        onClick={async () => {
                            const val = (document.getElementById('activationCodeInput') as HTMLInputElement).value;
                            const ok = await onRenewSubscription(schoolId, 'annual', val);
                            if (ok) { alert('تم التجديد بنجاح!'); setShowRenewModal(false); }
                            else alert('الكود غير صحيح، يرجى التواصل مع الدعم الفني');
                        }}
                        className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xl shadow-xl shadow-slate-200"
                      > تفعيل الآن </button>
                      <button onClick={()=>setShowRenewModal(false)} className="w-full text-slate-400 font-bold">إلغاء</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
