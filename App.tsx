import React, { useState, useEffect, ErrorInfo, ReactNode, useRef } from 'react';
import WeeklyPlanTemplate from './components/WeeklyPlanTemplate';
import TeacherPortal from './components/TeacherPortal';
import AdminDashboard from './components/AdminDashboard';
import SystemDashboard from './components/SystemDashboard';
import PublicClassPlansView from './components/PublicClassPlansView';
import InvoiceModal from './components/InvoiceModal';
import { PlanEntry, Teacher, ArchivedPlan, ArchivedAttendance, WeekInfo, ClassGroup, ScheduleSlot, Student, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from './types';
import { UserCog, ShieldCheck, Building2, PlusCircle, ChevronDown, Check, Power, Trash2, Search, AlertOctagon, X, RefreshCcw, AlertTriangle, Loader2, Cloud, CloudOff, Database, Save, Calendar, Clock, CreditCard, Lock, Copy, Key, School as SchoolIcon, CheckCircle, Mail, User, ArrowRight, ArrowLeft, BarChart3, Wifi, WifiOff, Phone, Smartphone, Wallet, Landmark, Percent, Globe, Tag, LogIn, ExternalLink, Shield, TrendingUp, Filter, Link as LinkIcon, LogOut, LayoutGrid } from 'lucide-react';
import { initFirebase, saveSchoolData, loadSchoolData, FirebaseConfig, getDB, saveSystemData, loadSystemData } from './services/firebase';
import { sendActivationEmail } from './services/emailService';

// --- Styles ---
const inputModernClass = "w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700 font-medium";

// --- 1. Robust Types & Constants ---

enum ViewState {
  HOME,
  ADMIN,
  TEACHER,
  PUBLIC_CLASS
}

type SubscriptionPlan = 'trial' | 'quarterly' | 'annual' | string;

interface SchoolMetadata {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  subscriptionEnd: string;
  plan: SubscriptionPlan;
  licenseKey: string;
  maxTeachers?: number;
  email?: string;
  managerPhone: string;
  adminUsername?: string;
  adminPassword?: string;
  activationCode: string;
  isPaid: boolean;
  isVerified?: boolean;
}

const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  ministryName: 'المملكة العربية السعودية',
  authorityName: 'وزارة التعليم',
  directorateName: 'الإدارة العامة للتعليم ...',
  schoolName: 'اسم المدرسة',
  logoUrl: '',
  footerNotesRight: '( رسالة عامة )',
  footerNotesLeft: 'ملاحظات',
  footerNotesLeftImage: ''
};

const INITIAL_WEEK_INFO: WeekInfo = {
  startDate: '',
  endDate: '',
  weekNumber: 'الأسبوع الأول',
  semester: 'الفصل الدراسي الأول'
};

// --- 2. Error Boundary ---
interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("System Error Caught:", error, errorInfo);
  }

  handleHardReset = () => {
    if (window.confirm('هل أنت متأكد؟ سيتم حذف جميع البيانات المخزنة وإعادة التطبيق لحالته الأصلية.')) {
      localStorage.clear();
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center" dir="rtl">
          <AlertTriangle size={64} className="text-red-500 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">عذراً، حدث خطأ في النظام</h1>
          <p className="text-gray-600 mb-6 max-w-md">
             قد يكون هناك تعارض في البيانات المحفوظة. يرجى محاولة إعادة ضبط النظام.
          </p>
          <div className="bg-red-50 border border-red-200 p-4 rounded-lg mb-6 w-full max-w-lg overflow-auto text-left dir-ltr">
            <code className="text-xs text-red-800 font-mono">
              {this.state.error?.toString()}
            </code>
          </div>
          <button 
            onClick={this.handleHardReset}
            className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-red-700 flex items-center gap-2 shadow-lg"
          >
            <RefreshCcw size={20} />
            إصلاح النظام (حذف البيانات)
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- 3. Enhanced Storage Hook ---
function useSyncedState<T>(defaultValue: T, key: string, schoolId: string, isCloudEnabled: boolean): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [isLoaded, setIsLoaded] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [value, setValue] = useState<T>(() => {
    try {
      const stickyValue = window.localStorage.getItem(`${schoolId}_${key}`);
      if (stickyValue !== null && stickyValue !== 'undefined') {
        return JSON.parse(stickyValue);
      }
    } catch (error) {
      console.warn(`Error parsing localStorage key "${key}".`);
    }
    return defaultValue;
  });

  useEffect(() => {
    let mounted = true;
    setIsLoaded(false);
    
    const fetchCloud = async () => {
        if (!isCloudEnabled || !getDB()) {
            setIsLoaded(true);
            return;
        }
        const cloudData = await loadSchoolData(schoolId, key);
        if (mounted) {
            if (cloudData) {
                setValue(cloudData);
                window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(cloudData));
            }
            setIsLoaded(true);
        }
    };
    fetchCloud();
    return () => { mounted = false; };
  }, [schoolId, key, isCloudEnabled]);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving locally:`, error);
    }
    if (isCloudEnabled && getDB()) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        debounceTimer.current = setTimeout(() => {
            saveSchoolData(schoolId, key, value);
        }, 2000);
    }
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); }
  }, [key, value, schoolId, isLoaded, isCloudEnabled]);

  return [value, setValue, isLoaded];
}

// --- 4. School Directory Component (The "Smart Portal") ---
interface SchoolDirectoryProps {
    schools: SchoolMetadata[];
    onSelectSchool: (id: string) => void;
    onOpenSystemAdmin: () => void;
    onRegisterNew: () => void;
}

const SchoolDirectory: React.FC<SchoolDirectoryProps> = ({ schools, onSelectSchool, onOpenSystemAdmin, onRegisterNew }) => {
    const [search, setSearch] = useState('');
    
    const activeSchools = schools.filter(s => s.isActive && new Date(s.subscriptionEnd) > new Date());
    const filteredSchools = activeSchools.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col font-sans" dir="rtl">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-2 text-indigo-700">
                    <ShieldCheck size={28} />
                    <span className="font-bold text-lg tracking-tight">منصة الخطط المدرسية</span>
                </div>
                <div className="flex gap-3">
                    <button onClick={onRegisterNew} className="hidden md:flex bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-4 py-2 rounded-xl text-sm font-bold transition-colors items-center gap-2">
                        <PlusCircle size={16}/> تسجيل مدرسة جديدة
                    </button>
                    <button onClick={onOpenSystemAdmin} className="bg-slate-900 text-white hover:bg-slate-800 px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-2 shadow-lg shadow-slate-200">
                        <Power size={16}/> إدارة النظام
                    </button>
                </div>
            </div>

            {/* Hero & Search */}
            <div className="flex-1 flex flex-col items-center justify-center p-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 z-0"></div>
                
                <div className="relative z-10 w-full max-w-4xl mx-auto text-center mb-12">
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-800 mb-4 leading-tight">
                        بوابة المدارس الذكية
                    </h1>
                    <p className="text-slate-500 text-lg mb-8 max-w-2xl mx-auto">
                        نظام متكامل لإدارة الخطط الأسبوعية، الجداول المدرسية، ومتابعة الحضور والغياب لجميع المدارس المشتركة.
                    </p>

                    <div className="relative max-w-xl mx-auto group">
                        <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <div className="relative bg-white rounded-2xl shadow-xl flex items-center p-2 border border-slate-100">
                            <Search className="text-slate-400 mr-3 ml-2" size={24}/>
                            <input 
                                type="text" 
                                className="flex-1 bg-transparent outline-none text-lg font-bold text-slate-700 placeholder:font-normal placeholder:text-slate-400 py-3"
                                placeholder="ابحث عن اسم مدرستك..."
                                value={search}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <div className="relative z-10 w-full max-w-6xl mx-auto">
                    {filteredSchools.length === 0 ? (
                        <div className="text-center py-12">
                            <SchoolIcon size={48} className="mx-auto text-slate-300 mb-4" />
                            <p className="text-slate-500 font-bold">لم يتم العثور على مدارس مطابقة</p>
                            <button onClick={onRegisterNew} className="mt-4 text-indigo-600 font-bold underline text-sm">تسجيل مدرسة جديدة؟</button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredSchools.map(school => (
                                <button 
                                    key={school.id}
                                    onClick={() => onSelectSchool(school.id)}
                                    className="bg-white p-6 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-slate-100 group text-right flex flex-col items-center"
                                >
                                    <div className="w-16 h-16 bg-slate-50 rounded-full mb-4 flex items-center justify-center group-hover:bg-indigo-50 transition-colors border border-slate-100">
                                        <SchoolIcon className="text-slate-400 group-hover:text-indigo-600 transition-colors" size={32} />
                                    </div>
                                    <h3 className="font-bold text-slate-800 text-lg mb-1 group-hover:text-indigo-700 transition-colors">{school.name}</h3>
                                    <p className="text-xs text-slate-400 font-mono mb-4">Code: {school.id.substring(0,6)}</p>
                                    <div className="w-full mt-auto pt-4 border-t border-slate-50 flex justify-between items-center">
                                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-1 rounded-full">نظام نشط</span>
                                        <span className="text-xs text-indigo-500 flex items-center gap-1 font-bold group-hover:translate-x-[-4px] transition-transform">
                                            دخول <ArrowLeft size={14}/>
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            
            <footer className="bg-white border-t border-slate-100 p-6 text-center text-slate-400 text-xs">
                &copy; {new Date().getFullYear()} نظام الخطط المدرسية الذكي. جميع الحقوق محفوظة.
            </footer>
        </div>
    );
};

// --- 5. School System Logic (Specific School Context) ---
interface SchoolSystemProps {
  schoolId: string;
  schoolMetadata: SchoolMetadata; 
  onSwitchSchool: (id: string) => void;
  onExitSchool: () => void;
  onOpenSystemAdmin: () => void;
  isCloudConnected: boolean;
  onRegisterSchool: (data: Partial<SchoolMetadata>) => Promise<void>;
  onUpgradeSubscription: (id: string, plan: SubscriptionPlan, code: string) => Promise<boolean> | boolean;
  pricing: PricingConfig;
  availableSchools: SchoolMetadata[];
  initialView?: ViewState;
}

const SchoolSystem: React.FC<SchoolSystemProps> = ({ 
  schoolId, 
  schoolMetadata, 
  onSwitchSchool,
  onExitSchool,
  onOpenSystemAdmin,
  isCloudConnected,
  onRegisterSchool,
  onUpgradeSubscription,
  pricing,
  availableSchools,
  initialView = ViewState.HOME
}) => {
  const [view, setView] = useState<ViewState>(initialView);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showSchoolMenu, setShowSchoolMenu] = useState(false);
  const [loginError, setLoginError] = useState('');
  
  // Data States
  const [schoolSettings, setSchoolSettings, l1] = useSyncedState<SchoolSettings>({...DEFAULT_SCHOOL_SETTINGS, schoolName: schoolMetadata.name}, 'settings_v1', schoolId, isCloudConnected);
  const [weekInfo, setWeekInfo, l2] = useSyncedState<WeekInfo>(INITIAL_WEEK_INFO, 'week_v1', schoolId, isCloudConnected);
  const [subjects, setSubjects, l3] = useSyncedState<Subject[]>([], 'subjects_v1', schoolId, isCloudConnected);
  const [classes, setClasses, l4] = useSyncedState<ClassGroup[]>([], 'classes_v1', schoolId, isCloudConnected);
  const [schedule, setSchedule, l5] = useSyncedState<ScheduleSlot[]>([], 'schedule_v1', schoolId, isCloudConnected);
  const [students, setStudents, l6] = useSyncedState<Student[]>([], 'students_v1', schoolId, isCloudConnected);
  const [teachers, setTeachers, l7] = useSyncedState<Teacher[]>([], 'teachers_v1', schoolId, isCloudConnected);
  const [planEntries, setPlanEntries, l8] = useSyncedState<PlanEntry[]>([], 'plans_v1', schoolId, isCloudConnected);
  const [archivedPlans, setArchivedPlans, l9] = useSyncedState<ArchivedPlan[]>([], 'archives_v1', schoolId, isCloudConnected);
  const [attendanceRecords, setAttendanceRecords, l10] = useSyncedState<AttendanceRecord[]>([], 'attendance_v1', schoolId, isCloudConnected);
  const [messages, setMessages, l11] = useSyncedState<Message[]>([], 'messages_v1', schoolId, isCloudConnected);
  const [archivedAttendanceLogs, setArchivedAttendanceLogs, l12] = useSyncedState<ArchivedAttendance[]>([], 'attendance_archives_v1', schoolId, isCloudConnected);

  const isLoading = isCloudConnected && (!l1 || !l2 || !l3 || !l4 || !l5 || !l6 || !l7 || !l8 || !l9 || !l10 || !l11 || !l12);

  // Sync school name
  useEffect(() => {
     if (schoolMetadata.name && schoolSettings.schoolName !== schoolMetadata.name) {
         setSchoolSettings(prev => ({...prev, schoolName: schoolMetadata.name}));
     }
  }, [schoolMetadata.name, schoolId]);

  // Handle Shared Class Link
  useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedClassId = urlParams.get('classShare');
      if (sharedClassId && initialView !== ViewState.PUBLIC_CLASS) {
          // Verify class exists (wait for load)
          if (l4) {
             const cls = classes.find(c => c.id === sharedClassId);
             if (cls) {
                 setView(ViewState.PUBLIC_CLASS);
             }
          }
      }
  }, [classes, l4, initialView]);

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');

      // Admin Login
      if (username === schoolMetadata.adminUsername && password === schoolMetadata.adminPassword) {
          setView(ViewState.ADMIN);
          return;
      }

      // Teacher Login
      const teacher = teachers.find(t => t.username === username && (t.password === password || (!t.password && password === '')));
      if (teacher) {
          setSelectedTeacherId(teacher.id);
          setView(ViewState.TEACHER);
          return;
      }

      setLoginError('بيانات الدخول غير صحيحة');
  };

  const activeTeacher = teachers.find(t => t.id === selectedTeacherId);
  const sharedClassId = new URLSearchParams(window.location.search).get('classShare');
  const sharedClass = classes.find(c => c.id === sharedClassId);

  if (isLoading) {
      return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={40}/></div>;
  }

  // PUBLIC VIEW
  if (view === ViewState.PUBLIC_CLASS && sharedClass) {
      return (
          <PublicClassPlansView 
              schoolSettings={schoolSettings}
              classGroup={sharedClass}
              students={students.filter(s => s.classId === sharedClass.id)}
              weekInfo={weekInfo}
              schedule={schedule}
              planEntries={planEntries}
              subjects={subjects}
          />
      );
  }

  // ADMIN VIEW
  if (view === ViewState.ADMIN) {
      return (
          <div className="relative">
              <button onClick={() => setView(ViewState.HOME)} className="fixed top-4 left-4 z-[100] bg-rose-500 text-white p-2 rounded-full shadow-lg hover:bg-rose-600 transition-colors" title="تسجيل خروج">
                  <LogOut size={20}/>
              </button>
              <AdminDashboard 
                  schoolId={schoolId}
                  schoolMetadata={schoolMetadata}
                  classes={classes}
                  onAddClass={c => setClasses([...classes, c])}
                  onSetClasses={setClasses}
                  weekInfo={weekInfo}
                  setWeekInfo={setWeekInfo}
                  schoolSettings={schoolSettings}
                  setSchoolSettings={setSchoolSettings}
                  schedule={schedule}
                  onUpdateSchedule={slot => {
                      const others = schedule.filter(s => !(s.dayIndex === slot.dayIndex && s.period === slot.period && s.classId === slot.classId));
                      setSchedule([...others, slot]);
                  }}
                  planEntries={planEntries}
                  teachers={teachers}
                  onAddTeacher={t => setTeachers([...teachers, t])}
                  onUpdateTeacher={t => setTeachers(teachers.map(x => x.id === t.id ? t : x))}
                  onDeleteTeacher={id => setTeachers(teachers.filter(x => x.id !== id))}
                  students={students}
                  onSetStudents={setStudents}
                  subjects={subjects}
                  onSetSubjects={setSubjects}
                  onArchivePlan={(name, w, e) => setArchivedPlans([...archivedPlans, {id: Date.now().toString(), schoolId, name, className: name.split(' - ')[0], archivedDate: new Date().toLocaleDateString('ar-SA'), weekInfo: w, entries: e}])}
                  onClearPlans={() => setPlanEntries([])}
                  archivedPlans={archivedPlans}
                  onDeleteArchive={id => setArchivedPlans(archivedPlans.filter(a => a.id !== id))}
                  attendanceRecords={attendanceRecords}
                  onMarkAttendance={r => {
                      const others = attendanceRecords.filter(x => !(x.studentId === r.studentId && x.date === r.date));
                      setAttendanceRecords([...others, r]);
                  }}
                  messages={messages}
                  onSendMessage={m => setMessages([...messages, m])}
                  onRenewSubscription={onUpgradeSubscription}
                  pricing={pricing}
                  onResetSystem={() => {
                      setClasses([]); setSubjects([]); setStudents([]); setTeachers([]); setSchedule([]); setPlanEntries([]); setAttendanceRecords([]); setArchivedPlans([]); setArchivedAttendanceLogs([]); setMessages([]);
                  }}
                  archivedAttendanceLogs={archivedAttendanceLogs}
                  onArchiveAttendance={log => setArchivedAttendanceLogs([...archivedAttendanceLogs, log])}
                  onDeleteAttendanceArchive={id => setArchivedAttendanceLogs(archivedAttendanceLogs.filter(a => a.id !== id))}
              />
          </div>
      );
  }

  // TEACHER VIEW
  if (view === ViewState.TEACHER && activeTeacher) {
      return (
          <div className="relative">
              <button onClick={() => setView(ViewState.HOME)} className="fixed top-4 left-4 z-[100] bg-rose-500 text-white p-2 rounded-full shadow-lg hover:bg-rose-600 transition-colors" title="تسجيل خروج">
                  <LogOut size={20}/>
              </button>
              <TeacherPortal 
                  teacher={activeTeacher}
                  schedule={schedule}
                  existingEntries={planEntries}
                  weekInfo={weekInfo}
                  onSaveEntry={e => {
                      const others = planEntries.filter(x => !(x.dayIndex === e.dayIndex && x.period === e.period && x.classId === e.classId));
                      setPlanEntries([...others, e]);
                  }}
                  subjects={subjects}
                  students={students}
                  classes={classes}
                  attendanceRecords={attendanceRecords}
                  onMarkAttendance={r => {
                      const others = attendanceRecords.filter(x => !(x.studentId === r.studentId && x.date === r.date));
                      setAttendanceRecords([...others, r]);
                  }}
                  messages={messages}
                  onSendMessage={m => setMessages([...messages, m])}
                  schoolSettings={schoolSettings}
              />
          </div>
      );
  }

  // SCHOOL LOGIN VIEW (Independent Feeling)
  return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
          
          {/* Top Bar - Clean, just exit button */}
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20">
              <div className="flex items-center gap-2 text-white/50">
                   <ShieldCheck size={20}/>
                   <span className="text-xs font-mono">نظام إدارة الخطط المدرسية</span>
              </div>
              <button onClick={onExitSchool} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 backdrop-blur-sm border border-white/10 transition-all">
                  <LayoutGrid size={16}/> دليل المدارس
              </button>
          </div>

          <div className="w-full max-w-md relative z-10">
              <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl overflow-hidden border border-white/20">
                  <div className="p-8 text-center bg-white relative">
                      <div className="w-24 h-24 bg-slate-50 rounded-full mx-auto mb-4 flex items-center justify-center shadow-inner border border-slate-100">
                          {schoolSettings.logoUrl ? (
                              <img src={schoolSettings.logoUrl} alt="Logo" className="w-16 h-16 object-contain"/>
                          ) : (
                              <SchoolIcon size={40} className="text-indigo-600"/>
                          )}
                      </div>
                      <h1 className="text-2xl font-extrabold text-slate-900 mb-1">{schoolMetadata.name}</h1>
                      <p className="text-slate-500 text-sm">بوابة الدخول الموحدة</p>
                  </div>
                  
                  <form onSubmit={handleLogin} className="p-8 space-y-5">
                      {loginError && (
                          <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-100">
                              <AlertOctagon size={16}/> {loginError}
                          </div>
                      )}
                      
                      <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 mr-1">اسم المستخدم</label>
                          <div className="relative">
                              <input 
                                  type="text" 
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pl-10 outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700 font-bold placeholder:font-normal"
                                  placeholder="أدخل اسم المستخدم"
                                  value={username}
                                  onChange={e => setUsername(e.target.value)}
                              />
                              <User className="absolute left-3 top-3.5 text-slate-400" size={18}/>
                          </div>
                      </div>

                      <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500 mr-1">كلمة المرور</label>
                          <div className="relative">
                              <input 
                                  type="password" 
                                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 pl-10 outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700 font-bold placeholder:font-normal"
                                  placeholder="••••••••"
                                  value={password}
                                  onChange={e => setPassword(e.target.value)}
                              />
                              <Key className="absolute left-3 top-3.5 text-slate-400" size={18}/>
                          </div>
                      </div>

                      <button type="submit" className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 group">
                          <LogIn size={20} className="group-hover:translate-x-1 transition-transform"/>
                          تسجيل الدخول
                      </button>

                  </form>
              </div>
              <p className="text-center text-slate-500 text-xs mt-6 font-medium">جميع الحقوق محفوظة &copy; {new Date().getFullYear()}</p>
          </div>
      </div>
  );
};

const App: React.FC = () => {
    // System State
    const [schools, setSchools] = useState<SchoolMetadata[]>([]);
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
    const [isSystemAdmin, setIsSystemAdmin] = useState(false);
    const [isCloudConnected, setIsCloudConnected] = useState(false);
    const [pricing, setPricing] = useState<PricingConfig>({ quarterly: 100, annual: 300, currency: 'SAR' });
    const [loaded, setLoaded] = useState(false);
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    
    // Register Form State (Moved to App level for modal)
    const [regForm, setRegForm] = useState({ name: '', email: '', phone: '', username: '', password: '' });
    const [isRegistering, setIsRegistering] = useState(false);

    // Init Logic
    useEffect(() => {
        const init = async () => {
            const config: FirebaseConfig = {
                apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                appId: import.meta.env.VITE_FIREBASE_APP_ID
            };
            
            const connected = initFirebase(config);
            setIsCloudConnected(connected);

            // Load Schools Registry
            let loadedSchools: SchoolMetadata[] = [];
            if (connected) {
                const cloudSchools = await loadSystemData('schools_registry');
                if (cloudSchools) loadedSchools = cloudSchools;
            }

            if (loadedSchools.length === 0) {
                const localSchools = localStorage.getItem('system_schools');
                if (localSchools) {
                    try { loadedSchools = JSON.parse(localSchools); } catch(e) {}
                }
            }

            // Fallback for demo
            if (loadedSchools.length === 0) {
                loadedSchools = [{
                    id: 'school_default',
                    name: 'مدرسة تجريبية',
                    createdAt: new Date().toISOString(),
                    isActive: true,
                    subscriptionEnd: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
                    plan: 'trial',
                    licenseKey: 'DEMO-KEY',
                    managerPhone: '',
                    adminUsername: 'admin',
                    adminPassword: '123',
                    activationCode: '1234',
                    isPaid: false
                }];
            }
            
            setSchools(loadedSchools);

            // Load Pricing
            if (connected) {
                const cloudPricing = await loadSystemData('pricing_config');
                if (cloudPricing) setPricing(cloudPricing);
            }

            // Determine Start View
            const urlParams = new URLSearchParams(window.location.search);
            const urlSchoolId = urlParams.get('school');
            const urlAdmin = urlParams.get('admin');

            if (urlAdmin) {
                setIsSystemAdmin(true);
            } else if (urlSchoolId) {
                const schoolExists = loadedSchools.find(s => s.id === urlSchoolId);
                if (schoolExists) {
                    setCurrentSchoolId(urlSchoolId);
                } else {
                    // Invalid school link, stay on directory
                    setCurrentSchoolId(null);
                }
            } else {
                setCurrentSchoolId(null); // Default to directory
            }

            setLoaded(true);
        };
        init();
    }, []);

    // Persist Registry
    useEffect(() => {
        if (!loaded) return;
        localStorage.setItem('system_schools', JSON.stringify(schools));
        if (isCloudConnected) {
            saveSystemData('schools_registry', schools);
            saveSystemData('pricing_config', pricing);
        }
    }, [schools, isCloudConnected, loaded, pricing]);

    const handleRegisterSchool = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        
        if (isRegistering) return;
        setIsRegistering(true);

        const data = regForm;
        
        const newSchool: SchoolMetadata = {
            id: `sch_${Date.now()}`,
            name: data.name || 'مدرسة جديدة',
            createdAt: new Date().toISOString(),
            isActive: true,
            subscriptionEnd: new Date(Date.now() + 7*24*60*60*1000).toISOString(), // 7 days trial
            plan: 'trial',
            licenseKey: `KEY-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
            managerPhone: data.phone || '',
            adminUsername: data.username || 'admin',
            adminPassword: data.password || '123456',
            activationCode: Math.floor(1000 + Math.random() * 9000).toString(),
            isPaid: false,
            email: data.email
        };
        
        const updatedSchools = [...schools, newSchool];
        setSchools(updatedSchools);
        
        // Save
        if (isCloudConnected) {
            await saveSystemData('schools_registry', updatedSchools);
        } else {
            localStorage.setItem('system_schools', JSON.stringify(updatedSchools));
        }

        // Send email
        if (newSchool.email) {
            await sendActivationEmail(newSchool.email, newSchool.name, newSchool.activationCode, 'registration');
        }

        setIsRegistering(false);
        setShowRegisterModal(false);
        setRegForm({ name: '', email: '', phone: '', username: '', password: '' });
        setCurrentSchoolId(newSchool.id); // Auto enter
        alert(`تم تسجيل مدرسة ${newSchool.name} بنجاح!`);
    };

    const handleUpgradeSubscription = async (id: string, plan: SubscriptionPlan, code: string) => {
        const school = schools.find(s => s.id === id);
        if (!school) return false;

        if (code === school.activationCode) {
            const duration = plan === 'annual' ? 365 : 90;
            const updated = {
                ...school,
                plan: plan,
                isPaid: true,
                isActive: true,
                subscriptionEnd: new Date(Date.now() + duration*24*60*60*1000).toISOString(),
                activationCode: Math.floor(1000 + Math.random() * 9000).toString() // Reset code
            };
            setSchools(schools.map(s => s.id === id ? updated : s));
            return true;
        }
        return false;
    };

    if (!loaded) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-indigo-600" size={48}/></div>;

    // 1. System Admin View
    if (isSystemAdmin) {
        return (
            <ErrorBoundary>
                <SystemDashboard 
                    schools={schools}
                    onSelectSchool={(id) => { setCurrentSchoolId(id); setIsSystemAdmin(false); }}
                    onDeleteSchool={(id) => setSchools(schools.filter(s => s.id !== id))}
                    onToggleStatus={(id, current) => setSchools(schools.map(s => s.id === id ? {...s, isActive: !current} : s))}
                    onLogout={() => { setIsSystemAdmin(false); window.history.pushState({}, '', window.location.pathname); }}
                    pricing={pricing}
                    onSavePricing={setPricing}
                />
            </ErrorBoundary>
        );
    }

    // 2. School System View (When a school is selected)
    const currentSchool = schools.find(s => s.id === currentSchoolId);
    if (currentSchool) {
        return (
            <ErrorBoundary>
                <SchoolSystem 
                    schoolId={currentSchool.id}
                    schoolMetadata={currentSchool}
                    onSwitchSchool={setCurrentSchoolId}
                    onExitSchool={() => {
                        setCurrentSchoolId(null);
                        window.history.pushState({}, '', window.location.pathname); // clear param
                    }}
                    onOpenSystemAdmin={() => setIsSystemAdmin(true)}
                    isCloudConnected={isCloudConnected}
                    onRegisterSchool={(data) => {
                        setRegForm({...regForm, ...data});
                        handleRegisterSchool();
                        return Promise.resolve();
                    }}
                    onUpgradeSubscription={handleUpgradeSubscription}
                    pricing={pricing}
                    availableSchools={schools}
                />
            </ErrorBoundary>
        );
    }

    // 3. School Directory (Default Landing)
    return (
        <ErrorBoundary>
            <SchoolDirectory 
                schools={schools}
                onSelectSchool={setCurrentSchoolId}
                onOpenSystemAdmin={() => setIsSystemAdmin(true)}
                onRegisterNew={() => setShowRegisterModal(true)}
            />

            {/* Registration Modal at App Level */}
            {showRegisterModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideDown flex flex-col max-h-[90vh]">
                        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex justify-between items-start shrink-0">
                            <div>
                                <h3 className="text-xl font-bold flex items-center gap-2"><SchoolIcon size={24}/> تسجيل مدرسة جديدة</h3>
                                <p className="text-indigo-100 text-sm mt-1">ابدأ فترتك التجريبية المجانية (7 أيام)</p>
                            </div>
                            <button onClick={() => setShowRegisterModal(false)} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors">
                                <X size={20}/>
                            </button>
                        </div>

                        <div className="p-8 space-y-4 overflow-y-auto">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">اسم المدرسة</label>
                                <input type="text" className={inputModernClass} placeholder="مدرسة..." value={regForm.name} onChange={(e) => setRegForm({...regForm, name: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">رقم جوال المدير</label>
                                    <div className="relative">
                                        <input type="text" className={`${inputModernClass} pl-10`} placeholder="05xxxxxxxx" value={regForm.phone} onChange={(e) => setRegForm({...regForm, phone: e.target.value})} />
                                        <Smartphone size={18} className="absolute left-3 top-3.5 text-slate-400"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                                    <div className="relative">
                                        <input type="email" className={`${inputModernClass} pl-10`} placeholder="email@..." value={regForm.email} onChange={(e) => setRegForm({...regForm, email: e.target.value})} />
                                        <Mail size={18} className="absolute left-3 top-3.5 text-slate-400"/>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">اسم المستخدم</label>
                                    <input type="text" className={inputModernClass} placeholder="admin" value={regForm.username} onChange={(e) => setRegForm({...regForm, username: e.target.value})} />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">كلمة المرور</label>
                                    <input type="password" className={inputModernClass} placeholder="****" value={regForm.password} onChange={(e) => setRegForm({...regForm, password: e.target.value})} />
                                </div>
                            </div>
                            
                            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 flex gap-3 items-start">
                                    <CheckCircle className="text-indigo-600 shrink-0 mt-0.5" size={18}/>
                                    <p className="text-xs text-indigo-800 leading-relaxed">
                                        عند التسجيل، ستحصل على صلاحية كاملة للنظام لمدة 7 أيام مجاناً. يمكنك ترقية الباقة لاحقاً من إعدادات المدرسة.
                                    </p>
                            </div>

                            <button onClick={(e) => handleRegisterSchool(e)} disabled={isRegistering} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 mt-4 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                                {isRegistering ? <Loader2 className="animate-spin"/> : <><ArrowRight size={20} className="rotate-180"/> إنشاء الحساب وبدء التجربة</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </ErrorBoundary>
    );
};

export default App;