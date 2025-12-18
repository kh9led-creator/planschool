
import React, { useState, useMemo } from 'react';
import { ClassGroup, Student, PlanEntry, ScheduleSlot, WeekInfo, Teacher, ArchivedPlan, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from '../types';
import WeeklyPlanTemplate from './WeeklyPlanTemplate';
import { Users, FileText, Calendar, Printer, Plus, Trash2, Edit2, Save, History, Grid, BookOpen, Settings, Book, Image as ImageIcon, UserCheck, MessageSquare, Send, Bell, Key, AlertCircle, GraduationCap, ChevronLeft, Search, X, User, Filter, CreditCard, ShieldAlert, CheckCircle, PieChart, LayoutDashboard, Smartphone, LogOut, School as SchoolIcon, Sparkles, UserPlus } from 'lucide-react';
import { DAYS_OF_WEEK } from '../services/data';

const inputModernClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 outline-none focus:bg-white focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 transition-all placeholder:text-slate-400 text-sm font-medium";
const labelModernClass = "block text-xs font-bold text-slate-500 mb-1.5 mr-1";
const btnPrimaryClass = "bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 active:scale-95 px-6 py-3";

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
  onUpdateSchedule: (s: ScheduleSlot) => void;
  attendanceRecords: AttendanceRecord[];
  onMarkAttendance: (record: AttendanceRecord) => void;
  messages: Message[];
  onSendMessage: (msg: Message) => void;
  schoolMetadata?: SchoolMetadata;
  onRenewSubscription?: (id: string, plan: string, code: string) => Promise<boolean>;
  pricing?: PricingConfig;
  schoolId: string; 
  onResetSystem?: () => void; 
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({
  classes, weekInfo, setWeekInfo, schoolSettings, setSchoolSettings, schedule, planEntries, teachers, students, subjects, onSetSubjects, onSetStudents, onSetClasses, onAddTeacher, onUpdateTeacher, onDeleteTeacher, onArchivePlan, archivedPlans, onUpdateSchedule, attendanceRecords, messages, onSendMessage, schoolMetadata, onRenewSubscription, pricing = { quarterly: 150, annual: 450, currency: 'SAR' }, schoolId, onResetSystem
}) => {
  const isExpired = schoolMetadata ? new Date(schoolMetadata.subscriptionEnd) < new Date() : false;
  const daysLeft = schoolMetadata ? Math.ceil((new Date(schoolMetadata.subscriptionEnd).getTime() - Date.now()) / (1000 * 3600 * 24)) : 0;

  const [activeTab, setActiveTab] = useState<'dashboard' | 'plan' | 'attendance' | 'setup' | 'classes' | 'students' | 'teachers'>('dashboard');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

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

  return (
    <div className="w-full bg-slate-50 min-h-screen font-sans pb-20" dir="rtl">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-[60] no-print">
          {schoolMetadata && (
            <div className={`p-2 text-center text-[10px] font-black transition-colors ${isExpired ? 'bg-rose-600 text-white' : daysLeft < 5 ? 'bg-amber-500 text-white' : 'bg-slate-900 text-slate-400'}`}>
                {isExpired ? 'انتهت صلاحية الاشتراك' : `ينتهي الاشتراك خلال ${daysLeft} يوم`}
            </div>
          )}
          <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-4">
                  <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><SchoolIcon size={24}/></div>
                  <div>
                      <h2 className="font-black text-slate-900 leading-tight">{schoolSettings.schoolName}</h2>
                      <p className="text-xs text-slate-400 font-bold">لوحة الإدارة</p>
                  </div>
              </div>
              <div className="flex gap-3">
                  <button onClick={onResetSystem} className="text-slate-400 hover:text-rose-500 p-2"><LogOut size={20}/></button>
                  <button onClick={() => setShowRenewModal(true)} className="bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl font-black text-xs border border-emerald-100 flex items-center gap-2 hover:bg-emerald-100"> <CreditCard size={14}/> تجديد الاشتراك </button>
              </div>
          </div>
      </header>

      <nav className="max-w-7xl mx-auto px-6 pt-6 no-print">
          <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-1 overflow-x-auto">
              {[
                  {id:'dashboard', label:'الإحصائيات', icon: LayoutDashboard},
                  {id:'students', label:'الطلاب', icon: GraduationCap},
                  {id:'teachers', label:'المعلمون', icon: User},
                  {id:'classes', label:'الجداول', icon: Grid},
                  {id:'plan', label:'الخطط', icon: FileText},
                  {id:'setup', label:'الإعدادات', icon: Settings}
              ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex items-center gap-2 px-5 py-3 rounded-xl font-black text-xs whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <tab.icon size={16} /> {tab.label}
                  </button>
              ))}
          </div>
      </nav>

      <main className={`max-w-7xl mx-auto px-6 py-8 ${isExpired ? 'opacity-30 pointer-events-none' : ''}`}>
        {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-fadeIn">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="text-slate-400 font-black text-[10px] uppercase mb-1">إجمالي الطلاب</div>
                        <div className="text-4xl font-black text-slate-900">{stats.totalStudents}</div>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="text-slate-400 font-black text-[10px] uppercase mb-1">المعلمون</div>
                        <div className="text-4xl font-black text-slate-900">{stats.totalTeachers}</div>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="text-slate-400 font-black text-[10px] uppercase mb-1">الفصول</div>
                        <div className="text-4xl font-black text-slate-900">{stats.totalClasses}</div>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="text-rose-500 font-black text-[10px] uppercase mb-1">غياب اليوم</div>
                        <div className="text-4xl font-black text-slate-900">{stats.todayAbsence}</div>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'students' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="font-black text-slate-900 mb-8 flex items-center gap-3 text-xl"><Plus className="text-indigo-600"/> إضافة طالب</h3>
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
                            }} className={`w-full ${btnPrimaryClass} py-4`}>حفظ</button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden p-4">
                        <div className="relative mb-4">
                            <Search className="absolute right-4 top-3.5 text-slate-400" size={18}/>
                            <input className="w-full bg-white border border-slate-200 rounded-2xl pr-12 py-3 text-xs outline-none focus:border-indigo-400 font-bold" placeholder="ابحث باسم الطالب..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
                        </div>
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50 font-black">
                                <tr>
                                    <th className="p-4">اسم الطالب</th>
                                    <th className="p-4">الفصل</th>
                                    <th className="p-4 text-center">حذف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map(student => (
                                    <tr key={student.id} className="border-t border-slate-100">
                                        <td className="p-4 font-bold">{student.name}</td>
                                        <td className="p-4"><span className="text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs">{classes.find(c=>c.id===student.classId)?.name}</span></td>
                                        <td className="p-4 text-center">
                                            <button onClick={() => onSetStudents(students.filter(s=>s.id!==student.id))} className="text-rose-400 hover:text-rose-600"><Trash2 size={16}/></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'teachers' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                        <h3 className="font-black text-slate-900 mb-8 flex items-center gap-3 text-xl"><UserPlus className="text-indigo-600"/> إضافة معلم</h3>
                        <div className="space-y-5">
                            <input className={inputModernClass} placeholder="الاسم الكامل" value={newTeacher.name} onChange={e=>setNewTeacher({...newTeacher, name:e.target.value})}/>
                            <input className={inputModernClass} placeholder="اسم المستخدم" value={newTeacher.username} onChange={e=>setNewTeacher({...newTeacher, username:e.target.value})}/>
                            <input className={inputModernClass} type="password" placeholder="كلمة المرور" value={newTeacher.password} onChange={e=>setNewTeacher({...newTeacher, password:e.target.value})}/>
                            <button onClick={() => {
                                if(!newTeacher.name || !newTeacher.username || !newTeacher.password) return alert('أكمل البيانات');
                                onAddTeacher({ id: `tea_${Date.now()}`, ...newTeacher });
                                setNewTeacher({ name: '', username: '', password: '', assignedClasses: [] });
                            }} className={`w-full ${btnPrimaryClass} py-4`}>حفظ</button>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {teachers.map(t => (
                            <div key={t.id} className="bg-white p-6 border border-slate-200 rounded-2xl flex justify-between items-center group">
                                <div>
                                    <p className="font-black text-slate-800">{t.name}</p>
                                    <p className="text-[10px] text-slate-400">@{t.username}</p>
                                </div>
                                <button onClick={() => onDeleteTeacher(t.id)} className="text-slate-300 hover:text-rose-500"><Trash2 size={20}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {activeTab === 'classes' && (
            <div className="space-y-8 animate-fadeIn">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 flex gap-4">
                    <input className={inputModernClass} placeholder="اسم الفصل (مثلاً: 1/أ)" value={newClass.name} onChange={e=>setNewClass({...newClass, name:e.target.value})}/>
                    <input className={inputModernClass} placeholder="المرحلة" value={newClass.grade} onChange={e=>setNewClass({...newClass, grade:e.target.value})}/>
                    <button onClick={() => {
                        if(!newClass.name) return;
                        onSetClasses([...classes, { id: `cls_${Date.now()}`, ...newClass }]);
                        setNewClass({ name: '', grade: '' });
                    }} className={btnPrimaryClass}>إضافة</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {classes.map(c => (
                        <button key={c.id} onClick={() => setSelectedClassId(c.id)} className={`p-6 rounded-2xl border-2 transition-all ${selectedClassId === c.id ? 'border-indigo-600 bg-indigo-50 shadow-lg' : 'border-slate-100 bg-white'}`}>
                            <p className="font-black text-slate-800">{c.name}</p>
                            <p className="text-xs text-slate-400">{c.grade}</p>
                        </button>
                    ))}
                </div>
            </div>
        )}

        {activeTab === 'plan' && (
            <div className="space-y-6 animate-fadeIn">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 flex justify-between no-print">
                    <select className={inputModernClass} style={{maxWidth: '300px'}} value={selectedClassId} onChange={e=>setSelectedClassId(e.target.value)}>
                        <option value="">اختر الفصل لعرض الخطة...</option>
                        {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black text-sm flex items-center gap-2"><Printer size={18}/> طباعة </button>
                </div>
                {selectedClassId && (
                    <div className="flex justify-center p-8 bg-slate-200 rounded-[3rem] overflow-auto">
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
                )}
            </div>
        )}

        {activeTab === 'setup' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Settings className="text-indigo-600"/> إعدادات المرويسة</h3>
                    <input className={inputModernClass} placeholder="اسم الوزارة" value={schoolSettings.ministryName} onChange={e=>setSchoolSettings({...schoolSettings, ministryName:e.target.value})}/>
                    <input className={inputModernClass} placeholder="اسم المدرسة" value={schoolSettings.schoolName} onChange={e=>setSchoolSettings({...schoolSettings, schoolName:e.target.value})}/>
                    <input className={inputModernClass} placeholder="رابط الشعار" value={schoolSettings.logoUrl} onChange={e=>setSchoolSettings({...schoolSettings, logoUrl:e.target.value})}/>
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                        <input type="date" className={inputModernClass} value={weekInfo.startDate} onChange={e=>setWeekInfo({...weekInfo, startDate:e.target.value})}/>
                        <input type="date" className={inputModernClass} value={weekInfo.endDate} onChange={e=>setWeekInfo({...weekInfo, endDate:e.target.value})}/>
                    </div>
                </div>
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
                    <h3 className="text-2xl font-black text-slate-800 flex items-center gap-3"><Book className="text-indigo-600"/> إدارة المواد</h3>
                    <div className="flex gap-4">
                        <input className={inputModernClass} placeholder="اسم المادة..." value={newSubject.name} onChange={e=>setNewSubject({...newSubject, name:e.target.value})}/>
                        <button onClick={() => {
                            if(!newSubject.name) return;
                            onSetSubjects([...subjects, { id: `sub_${Date.now()}`, name: newSubject.name, color: 'bg-white' }]);
                            setNewSubject({ name: '', color: 'bg-white' });
                        }} className={btnPrimaryClass}>إضافة</button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 max-h-[300px] overflow-y-auto">
                        {subjects.map(s => (
                            <div key={s.id} className="flex justify-between items-center p-3 border border-slate-100 rounded-xl bg-slate-50">
                                <span className="text-xs font-bold">{s.name}</span>
                                <button onClick={() => onSetSubjects(subjects.filter(x=>x.id!==s.id))} className="text-rose-400"><X size={14}/></button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}
      </main>

      {showRenewModal && schoolMetadata && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
              <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-slideDown">
                  <h3 className="text-3xl font-black mb-8">تجديد الاشتراك</h3>
                  <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                          <button className="p-6 border-2 border-slate-100 rounded-[2rem] hover:border-indigo-500 text-center transition-all bg-indigo-50/20">
                              <p className="text-[10px] font-black text-slate-400 mb-2">الباقة الفصلية</p>
                              <p className="text-2xl font-black text-slate-900">{pricing.quarterly} ريال</p>
                          </button>
                          <button className="p-6 border-2 border-indigo-600 bg-indigo-50/50 rounded-[2rem] text-center shadow-xl">
                              <p className="text-[10px] font-black text-indigo-600 mb-2">الباقة السنوية</p>
                              <p className="text-2xl font-black text-indigo-900">{pricing.annual} ريال</p>
                          </button>
                      </div>
                      <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-5 text-center font-black" placeholder="أدخل كود التفعيل" id="activationCodeInput"/>
                      <button 
                        onClick={async () => {
                            const val = (document.getElementById('activationCodeInput') as HTMLInputElement).value;
                            if (onRenewSubscription) {
                                const ok = await onRenewSubscription(schoolId, 'annual', val);
                                if (ok) { alert('تم التجديد!'); setShowRenewModal(false); }
                                else alert('الكود غير صحيح');
                            }
                        }}
                        className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xl shadow-xl"
                      > تفعيل </button>
                      <button onClick={()=>setShowRenewModal(false)} className="w-full text-slate-400 font-bold">إلغاء</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default AdminDashboard;
