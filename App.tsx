import React, { useState, useEffect, ErrorInfo, ReactNode, Suspense } from 'react';
// Keep lightweight components eagerly loaded
import PublicClassPlansView from './components/PublicClassPlansView';
import InvoiceModal from './components/InvoiceModal';
import { PlanEntry, Teacher, ArchivedPlan, ArchivedAttendance, WeekInfo, ClassGroup, ScheduleSlot, Student, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from './types';
import { UserCog, ShieldCheck, Building2, PlusCircle, ChevronDown, Check, Power, Trash2, Search, AlertOctagon, X, RefreshCcw, AlertTriangle, Loader2, Cloud, CloudOff, Database, Save, Calendar, Clock, CreditCard, Lock, Copy, Key, School as SchoolIcon, CheckCircle, Mail, User, ArrowRight, ArrowLeft, BarChart3, Wifi, WifiOff, Phone, Smartphone, Wallet, Landmark, Percent, Globe, Tag, LogIn, ExternalLink, Shield, TrendingUp, Filter, Link as LinkIcon, LogOut, LayoutGrid, Rocket } from 'lucide-react';
import { initFirebase, saveSchoolData, loadSchoolData, FirebaseConfig, getDB, saveSystemData, loadSystemData } from './services/firebase';
import { sendActivationEmail } from './services/emailService';

// --- Lazy Load Heavy Components ---
// This splits the code so the main page loads instantly
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const TeacherPortal = React.lazy(() => import('./components/TeacherPortal'));
const SystemDashboard = React.lazy(() => import('./components/SystemDashboard'));
const WeeklyPlanTemplate = React.lazy(() => import('./components/WeeklyPlanTemplate'));

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

// --- 3. Loading Component ---
const GlobalLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="animate-spin text-indigo-600" size={40}/>
      <p className="text-slate-400 font-bold text-sm animate-pulse">جاري تحميل النظام...</p>
  </div>
);

// --- 4. Enhanced Storage Hook ---
function useSyncedState<T>(defaultValue: T, key: string, schoolId: string, isCloudEnabled: boolean): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  // Initialize state directly from localStorage if available (Blocking render for 1 tick but much faster perceived speed)
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

  const [isLoaded, setIsLoaded] = useState(false);

  // Async Cloud Fetch (Background)
  useEffect(() => {
    let mounted = true;
    
    const fetchCloud = async () => {
        if (!isCloudEnabled || !getDB()) {
            setIsLoaded(true);
            return;
        }
        
        // We allow the component to render with local data FIRST, then fetch cloud
        const cloudData = await loadSchoolData(schoolId, key);
        if (mounted) {
            if (cloudData) {
                // Only update if cloud data exists
                setValue(cloudData);
                window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(cloudData));
            }
            setIsLoaded(true);
        }
    };
    
    // Small delay to prioritize UI painting
    setTimeout(fetchCloud, 10);
    
    return () => { mounted = false; };
  }, [schoolId, key, isCloudEnabled]);

  // Sync to LocalStorage immediately on change
  useEffect(() => {
    try {
      window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving locally:`, error);
    }
  }, [key, value, schoolId]);

  // Sync to Cloud (Debounced)
  useEffect(() => {
    if (!isLoaded || !isCloudEnabled || !getDB()) return;

    const handler = setTimeout(() => {
        saveSchoolData(schoolId, key, value);
    }, 2000);

    return () => clearTimeout(handler);
  }, [key, value, schoolId, isLoaded, isCloudEnabled]);

  return [value, setValue, isLoaded];
}

// --- 5. School Directory Component (Modern Landing Page) ---
interface SchoolDirectoryProps {
    schools: SchoolMetadata[];
    onSelectSchool: (id: string) => void;
    onOpenSystemAdmin: () => void;
    onRegisterNew: () => void;
}

const SchoolDirectory: React.FC<SchoolDirectoryProps> = ({ schools, onSelectSchool, onOpenSystemAdmin, onRegisterNew }) => {
    const [search, setSearch] = useState('');
    const [foundSchools, setFoundSchools] = useState<SchoolMetadata[]>([]);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!search.trim()) {
            setFoundSchools([]);
            setHasSearched(false);
            return;
        }
        
        // Only find exact matches or very specific partials to maintain privacy
        const results = schools.filter(s => 
            (s.name.toLowerCase().includes(search.toLowerCase()) && s.isActive) || 
            s.id === search.trim()
        );
        
        setFoundSchools(results);
        setHasSearched(true);
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans relative overflow-hidden" dir="rtl">
            {/* Ambient Background */}
            <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-indigo-50 to-white -z-10"></div>
            <div className="absolute -top-20 -right-20 w-96 h-96 bg-purple-100 rounded-full blur-3xl opacity-50 -z-10"></div>
            <div className="absolute top-40 -left-20 w-72 h-72 bg-blue-100 rounded-full blur-3xl opacity-50 -z-10"></div>

            {/* Header */}
            <div className="max-w-7xl mx-auto w-full px-6 py-6 flex justify-between items-center z-50">
                <div className="flex items-center gap-2 text-indigo-700">
                    <ShieldCheck size={32} />
                    <span className="font-extrabold text-xl tracking-tight text-slate-900">Madrasti Planner</span>
                </div>
                <button onClick={onOpenSystemAdmin} className="text-slate-400 hover:text-slate-600 transition-colors" title="إدارة النظام">
                    <Power size={20}/>
                </button>
            </div>

            {/* Main Content: Split Layout */}
            <div className="flex-1 flex flex-col lg:flex-row items-center justify-center max-w-7xl mx-auto w-full px-6 gap-12 lg:gap-24">
                
                {/* Left: Value Prop */}
                <div className="flex-1 text-center lg:text-right space-y-6">
                    <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-sm font-bold border border-indigo-100 mb-2">
                        <Rocket size={16}/> الإصدار الجديد 2.0
                    </div>
                    <h1 className="text-4xl lg:text-6xl font-extrabold text-slate-900 leading-tight">
                        نظام إدارة <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">الخطط المدرسية</span> الذكي
                    </h1>
                    <p className="text-lg text-slate-500 leading-relaxed max-w-xl mx-auto lg:mx-0">
                        منصة متكاملة للمدارس المستقلة لإدارة الخطط الأسبوعية، الجداول، والغياب. أنشئ نظام مدرستك الخاص في ثوانٍ وامتلك رابطاً خاصاً بك.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                        <button 
                            onClick={onRegisterNew}
                            className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2 group"
                        >
                            ابدأ نسختك الخاصة مجاناً <ArrowLeft className="group-hover:-translate-x-1 transition-transform"/>
                        </button>
                    </div>
                    <div className="pt-8 flex items-center justify-center lg:justify-start gap-8 text-slate-400 grayscale opacity-70">
                        {/* Fake Logos for trust */}
                        <div className="flex items-center gap-1 font-bold"><Shield size={18}/> آمن ومشفر</div>
                        <div className="flex items-center gap-1 font-bold"><Cloud size={18}/> حفظ سحابي</div>
                        <div className="flex items-center gap-1 font-bold"><CheckCircle size={18}/> دعم فني</div>
                    </div>
                </div>

                {/* Right: Access Portal */}
                <div className="flex-1 w-full max-w-md">
                    <div className="bg-white rounded-3xl shadow-2xl shadow-slate-200/50 border border-slate-100 p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                        
                        <h2 className="text-xl font-bold text-slate-800 mb-2">الدخول للنظام</h2>
                        <p className="text-sm text-slate-500 mb-6">هل مدرستك مسجلة؟ ابحث عنها للدخول.</p>

                        <form onSubmit={handleSearch} className="space-y-4">
                            <div className="relative">
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-4 text-slate-800 font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all placeholder:text-slate-400 placeholder:font-normal"
                                    placeholder="اسم المدرسة أو الكود التعريفي..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                                <Search className="absolute right-4 top-4 text-slate-400" size={20}/>
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 transition-all">
                                بحث ودخول
                            </button>
                        </form>

                        {/* Search Results Area */}
                        {hasSearched && (
                            <div className="mt-6 space-y-3 animate-fadeIn">
                                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">نتائج البحث</div>
                                {foundSchools.length > 0 ? (
                                    <div className="space-y-3">
                                        {foundSchools.map(school => (
                                            <button 
                                                key={school.id}
                                                onClick={() => onSelectSchool(school.id)}
                                                className="w-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 p-4 rounded-xl flex items-center justify-between group transition-all"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-indigo-600 shadow-sm">
                                                        <SchoolIcon size={20}/>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-slate-800">{school.name}</div>
                                                        <div className="text-[10px] text-slate-500">نظام نشط</div>
                                                    </div>
                                                </div>
                                                <div className="bg-white text-indigo-600 p-2 rounded-lg shadow-sm group-hover:scale-110 transition-transform">
                                                    <LogIn size={16}/>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-6 bg-slate-50 rounded-xl border border-slate-100 border-dashed">
                                        <SchoolIcon className="mx-auto text-slate-300 mb-2" size={24}/>
                                        <p className="text-sm text-slate-500 font-medium">لم يتم العثور على مدرسة بهذا الاسم.</p>
                                        <p className="text-xs text-slate-400 mt-1">تأكد من الاسم أو قم بإنشاء مدرسة جديدة.</p>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {!hasSearched && (
                             <div className="mt-6 pt-6 border-t border-slate-50 text-center">
                                 <p className="text-xs text-slate-400">
                                     يتم الدخول عادةً عبر الرابط المباشر الذي يرسله مدير المدرسة.
                                 </p>
                             </div>
                        )}
                    </div>
                </div>
            </div>
            
            <footer className="w-full py-6 text-center text-slate-400 text-xs font-medium">
                &copy; {new Date().getFullYear()} Madrasti Planner System. All rights reserved.
            </footer>
        </div>
    );
};

// --- 6. School System Logic (Specific School Context) ---
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

  // Even if cloud is loading, we can show the UI if we have local data. 
  // We don't block render on 'l1...l12' anymore unless it's a critical first-time load with no local data.
  
  // Handle Shared Class Link
  useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedClassId = urlParams.get('classShare');
      if (sharedClassId && initialView !== ViewState.PUBLIC_CLASS) {
          // Verify class exists
          const cls = classes.find(c => c.id === sharedClassId);
          if (cls) {
              setView(ViewState.PUBLIC_CLASS);
          }
      }
  }, [classes, initialView]);

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

  // ADMIN VIEW - Lazy Loaded
  if (view === ViewState.ADMIN) {
      return (
          <div className="relative">
              <button onClick={() => setView(ViewState.HOME)} className="fixed top-4 left-4 z-[100] bg-rose-500 text-white p-2 rounded-full shadow-lg hover:bg-rose-600 transition-colors" title="تسجيل خروج">
                  <LogOut size={20}/>
              </button>
              <Suspense fallback={<GlobalLoader />}>
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
              </Suspense>
          </div>
      );
  }

  // TEACHER VIEW - Lazy Loaded
  if (view === ViewState.TEACHER && activeTeacher) {
      return (
          <div className="relative">
              <button onClick={() => setView(ViewState.HOME)} className="fixed top-4 left-4 z-[100] bg-rose-500 text-white p-2 rounded-full shadow-lg hover:bg-rose-600 transition-colors" title="تسجيل خروج">
                  <LogOut size={20}/>
              </button>
              <Suspense fallback={<GlobalLoader />}>
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
              </Suspense>
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
                  <LayoutGrid size={16}/> بوابة النظام
              </button>
          </div>

          <div className="w-full max-w-md relative z-10 animate-slideDown">
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
                      <p className="text-slate-500 text-sm">تسجيل الدخول للنظام</p>
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
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    
    // Register Form State (Moved to App level for modal)
    const [regForm, setRegForm] = useState({ name: '', email: '', phone: '', username: '', password: '' });
    const [isRegistering, setIsRegistering] = useState(false);

    // Optimized Init Logic: Local First
    useEffect(() => {
        // 1. Immediate Local Load
        const localSchools = localStorage.getItem('system_schools');
        let initialSchools: SchoolMetadata[] = [];
        
        if (localSchools) {
            try { 
                initialSchools = JSON.parse(localSchools);
                setSchools(initialSchools);
            } catch(e) {}
        } else {
            // Default demo data if absolutely nothing exists
            initialSchools = [{
                id: 'school_demo',
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
            setSchools(initialSchools);
        }

        // 2. Determine View based on URL (Immediate)
        const urlParams = new URLSearchParams(window.location.search);
        const urlSchoolId = urlParams.get('school');
        const urlAdmin = urlParams.get('admin');

        if (urlAdmin) {
            setIsSystemAdmin(true);
        } else if (urlSchoolId) {
            const schoolExists = initialSchools.find(s => s.id === urlSchoolId);
            if (schoolExists) {
                setCurrentSchoolId(urlSchoolId);
            }
        }

        // 3. Cloud Sync (Background)
        const syncCloud = async () => {
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

            if (connected) {
                const cloudSchools = await loadSystemData('schools_registry');
                if (cloudSchools && Array.isArray(cloudSchools) && cloudSchools.length > 0) {
                    setSchools(cloudSchools);
                    // Update URL context if needed
                    if (urlSchoolId && cloudSchools.find(s => s.id === urlSchoolId)) {
                        setCurrentSchoolId(urlSchoolId);
                    }
                }
                
                const cloudPricing = await loadSystemData('pricing_config');
                if (cloudPricing) setPricing(cloudPricing);
            }
        };

        // Defer cloud sync slightly to allow main thread to render local data first
        setTimeout(syncCloud, 50);

    }, []);

    // Persist Registry (Debounced)
    useEffect(() => {
        const handler = setTimeout(() => {
            if (schools.length > 0) {
                localStorage.setItem('system_schools', JSON.stringify(schools));
                if (isCloudConnected) {
                    saveSystemData('schools_registry', schools);
                    saveSystemData('pricing_config', pricing);
                }
            }
        }, 1000);
        return () => clearTimeout(handler);
    }, [schools, isCloudConnected, pricing]);

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
        
        // Immediate Local Save
        localStorage.setItem('system_schools', JSON.stringify(updatedSchools));

        // Cloud Save
        if (isCloudConnected) {
            await saveSystemData('schools_registry', updatedSchools);
        }

        // Send email
        if (newSchool.email) {
            // Non-blocking email
            sendActivationEmail(newSchool.email, newSchool.name, newSchool.activationCode, 'registration');
        }

        setIsRegistering(false);
        setShowRegisterModal(false);
        setRegForm({ name: '', email: '', phone: '', username: '', password: '' });
        setCurrentSchoolId(newSchool.id); 
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

    // 1. System Admin View
    if (isSystemAdmin) {
        return (
            <ErrorBoundary>
                <Suspense fallback={<GlobalLoader />}>
                    <SystemDashboard 
                        schools={schools}
                        onSelectSchool={(id) => { setCurrentSchoolId(id); setIsSystemAdmin(false); }}
                        onDeleteSchool={(id) => setSchools(schools.filter(s => s.id !== id))}
                        onToggleStatus={(id, current) => setSchools(schools.map(s => s.id === id ? {...s, isActive: !current} : s))}
                        onLogout={() => { setIsSystemAdmin(false); window.history.pushState({}, '', window.location.pathname); }}
                        pricing={pricing}
                        onSavePricing={setPricing}
                    />
                </Suspense>
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