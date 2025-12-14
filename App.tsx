import React, { useState, useEffect, ErrorInfo, ReactNode, Suspense } from 'react';
// Keep lightweight components eagerly loaded
import PublicClassPlansView from './components/PublicClassPlansView';
import InvoiceModal from './components/InvoiceModal';
import { PlanEntry, Teacher, ArchivedPlan, ArchivedAttendance, WeekInfo, ClassGroup, ScheduleSlot, Student, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from './types';
import { UserCog, ShieldCheck, Building2, PlusCircle, ChevronDown, Check, Power, Trash2, Search, AlertOctagon, X, RefreshCcw, AlertTriangle, Loader2, Cloud, CloudOff, Database, Save, Calendar, Clock, CreditCard, Lock, Copy, Key, School as SchoolIcon, CheckCircle, Mail, User, ArrowRight, ArrowLeft, BarChart3, Wifi, WifiOff, Phone, Smartphone, Wallet, Landmark, Percent, Globe, Tag, LogIn, ExternalLink, Shield, TrendingUp, Filter, Link as LinkIcon, LogOut, LayoutGrid, Rocket, Fingerprint } from 'lucide-react';
import { initFirebase, saveSchoolData, loadSchoolData, FirebaseConfig, getDB, saveSystemData, loadSystemData } from './services/firebase';
import { sendActivationEmail } from './services/emailService';

// --- Lazy Load Heavy Components ---
// This splits the code so the main page loads instantly
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const TeacherPortal = React.lazy(() => import('./components/TeacherPortal'));
const SystemDashboard = React.lazy(() => import('./components/SystemDashboard'));
const WeeklyPlanTemplate = React.lazy(() => import('./components/WeeklyPlanTemplate'));
const PublicSchoolPortal = React.lazy(() => import('./components/PublicSchoolPortal'));

// --- Styles ---
const inputModernClass = "w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700 font-medium";

// --- 1. Robust Types & Constants ---

enum ViewState {
  HOME,
  ADMIN,
  TEACHER,
  PUBLIC_CLASS,
  PUBLIC_PORTAL
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

  useEffect(() => {
    let mounted = true;
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
    setTimeout(fetchCloud, 10);
    return () => { mounted = false; };
  }, [schoolId, key, isCloudEnabled]);

  useEffect(() => {
    try {
      window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving locally:`, error);
    }
  }, [key, value, schoolId]);

  useEffect(() => {
    if (!isLoaded || !isCloudEnabled || !getDB()) return;
    const handler = setTimeout(() => {
        saveSchoolData(schoolId, key, value);
    }, 2000);
    return () => clearTimeout(handler);
  }, [key, value, schoolId, isLoaded, isCloudEnabled]);

  return [value, setValue, isLoaded];
}

// --- 5. SaaS Landing Page Component (No Directory) ---
interface LandingPageProps {
    schools: SchoolMetadata[];
    onEnterSchool: (id: string) => void;
    onOpenSystemAdmin: () => void;
    onRegisterNew: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ schools, onEnterSchool, onOpenSystemAdmin, onRegisterNew }) => {
    const [schoolCodeInput, setSchoolCodeInput] = useState('');
    const [errorMsg, setErrorMsg] = useState('');

    const handleLoginSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMsg('');
        
        if (!schoolCodeInput.trim()) {
            setErrorMsg('الرجاء إدخال كود المدرسة');
            return;
        }

        // Check if school exists in the loaded registry
        const school = schools.find(s => s.id === schoolCodeInput.trim());
        
        if (school) {
            if (!school.isActive) {
                setErrorMsg('عذراً، هذا النظام غير نشط حالياً.');
                return;
            }
            onEnterSchool(school.id);
        } else {
            setErrorMsg('كود المدرسة غير صحيح. تأكد من الرابط أو الكود.');
        }
    };

    return (
        <div className="min-h-screen bg-white flex flex-col font-sans relative overflow-hidden" dir="rtl">
            {/* Background Effects */}
            <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-indigo-50/80 to-white -z-10"></div>
            <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-purple-100/40 rounded-full blur-3xl -z-10 animate-pulse"></div>
            <div className="absolute top-20 -left-20 w-[400px] h-[400px] bg-blue-100/40 rounded-full blur-3xl -z-10"></div>

            {/* Navbar */}
            <nav className="max-w-7xl mx-auto w-full px-6 py-6 flex justify-between items-center z-50">
                <div className="flex items-center gap-2 text-indigo-700">
                    <ShieldCheck size={32} />
                    <span className="font-extrabold text-xl tracking-tight text-slate-900">Madrasti Planner</span>
                </div>
                <div className="flex gap-4 items-center">
                    <button onClick={onRegisterNew} className="hidden md:flex bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
                        ابدأ التجربة المجانية
                    </button>
                    <button onClick={onOpenSystemAdmin} className="text-slate-400 hover:text-slate-600 transition-colors p-2" title="إدارة النظام">
                        <Power size={20}/>
                    </button>
                </div>
            </nav>

            {/* Hero Content */}
            <div className="flex-1 flex flex-col lg:flex-row items-center justify-center max-w-7xl mx-auto w-full px-6 gap-12 lg:gap-24 pb-20">
                
                {/* Left: Value Proposition */}
                <div className="flex-1 text-center lg:text-right space-y-8 animate-slideDown">
                    <div className="inline-flex items-center gap-2 bg-white shadow-sm text-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold border border-indigo-100 mb-2">
                        <Rocket size={14}/> الإصدار السحابي 2.0
                    </div>
                    <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1]">
                        نظام إدارة <br/>
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">الخطط المدرسية</span>
                    </h1>
                    <p className="text-lg text-slate-500 leading-relaxed max-w-xl mx-auto lg:mx-0">
                        منصة سحابية متكاملة تتيح للمدارس إدارة الخطط الأسبوعية، الجداول الدراسية، والغياب بكل سهولة. احصل على نظام خاص بمدرستك في دقيقة واحدة.
                    </p>
                    
                    <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start pt-4">
                        <button 
                            onClick={onRegisterNew}
                            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 hover:-translate-y-1 flex items-center justify-center gap-3 group"
                        >
                            أنشئ نظام مدرستك الآن <ArrowLeft className="group-hover:-translate-x-1 transition-transform"/>
                        </button>
                        <a href="#features" className="bg-white text-slate-600 border border-slate-200 px-8 py-4 rounded-2xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-2">
                            تعرف على المزايا
                        </a>
                    </div>

                    <div className="pt-8 flex flex-wrap justify-center lg:justify-start gap-6 text-slate-400 text-sm font-bold opacity-80">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm"><CheckCircle size={16} className="text-emerald-500"/> جداول ذكية</div>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm"><CheckCircle size={16} className="text-emerald-500"/> متابعة الغياب</div>
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-100 shadow-sm"><CheckCircle size={16} className="text-emerald-500"/> طباعة PDF</div>
                    </div>
                </div>

                {/* Right: Login Box */}
                <div className="flex-1 w-full max-w-md animate-fadeIn delay-100">
                    <div className="bg-white rounded-[2rem] shadow-2xl shadow-indigo-100 border border-white p-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
                        
                        <div className="mb-8 text-center">
                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-indigo-600">
                                <LogIn size={32}/>
                            </div>
                            <h2 className="text-2xl font-bold text-slate-800">تسجيل الدخول للنظام</h2>
                            <p className="text-sm text-slate-500 mt-2">لديك حساب بالفعل؟ أدخل كود المدرسة للدخول.</p>
                        </div>

                        <form onSubmit={handleLoginSubmit} className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-500 mr-1">كود المدرسة التعريفي (School ID)</label>
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-4 text-slate-800 font-bold outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/50 transition-all placeholder:text-slate-300 placeholder:font-normal text-left dir-ltr font-mono tracking-wider"
                                        placeholder="sch_..."
                                        value={schoolCodeInput}
                                        onChange={(e) => setSchoolCodeInput(e.target.value)}
                                    />
                                    <Fingerprint className="absolute right-4 top-4 text-slate-400" size={20}/>
                                </div>
                            </div>

                            {errorMsg && (
                                <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-bold flex items-center gap-2 border border-rose-100 animate-pulse">
                                    <AlertOctagon size={16}/> {errorMsg}
                                </div>
                            )}

                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-200">
                                الدخول للوحة التحكم <ArrowLeft size={18}/>
                            </button>
                        </form>

                        <div className="mt-8 pt-6 border-t border-slate-50 text-center">
                            <p className="text-xs text-slate-400 mb-2">ليس لديك كود مدرسة؟</p>
                            <button onClick={onRegisterNew} className="text-indigo-600 font-bold text-sm hover:underline">
                                سجل مدرستك الآن واحصل على كود خاص
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <footer className="w-full py-8 text-center text-slate-400 text-xs font-medium border-t border-slate-100 bg-slate-50/50">
                &copy; {new Date().getFullYear()} Madrasti Planner System. All rights reserved.
            </footer>
        </div>
    );
};

// --- 6. School System Logic (UNCHANGED logic, just layout context) ---
// (Keeping the internal logic of SchoolSystem as is, just ensuring it receives correct props)
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
  onExitSchool,
  isCloudConnected,
  onUpgradeSubscription,
  pricing,
  initialView = ViewState.HOME
}) => {
  const [view, setView] = useState<ViewState>(initialView);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Data States
  const [schoolSettings, setSchoolSettings] = useSyncedState<SchoolSettings>({...DEFAULT_SCHOOL_SETTINGS, schoolName: schoolMetadata.name}, 'settings_v1', schoolId, isCloudConnected);
  const [weekInfo, setWeekInfo] = useSyncedState<WeekInfo>(INITIAL_WEEK_INFO, 'week_v1', schoolId, isCloudConnected);
  const [subjects, setSubjects] = useSyncedState<Subject[]>([], 'subjects_v1', schoolId, isCloudConnected);
  const [classes, setClasses] = useSyncedState<ClassGroup[]>([], 'classes_v1', schoolId, isCloudConnected);
  const [schedule, setSchedule] = useSyncedState<ScheduleSlot[]>([], 'schedule_v1', schoolId, isCloudConnected);
  const [students, setStudents] = useSyncedState<Student[]>([], 'students_v1', schoolId, isCloudConnected);
  const [teachers, setTeachers] = useSyncedState<Teacher[]>([], 'teachers_v1', schoolId, isCloudConnected);
  const [planEntries, setPlanEntries] = useSyncedState<PlanEntry[]>([], 'plans_v1', schoolId, isCloudConnected);
  const [archivedPlans, setArchivedPlans] = useSyncedState<ArchivedPlan[]>([], 'archives_v1', schoolId, isCloudConnected);
  const [attendanceRecords, setAttendanceRecords] = useSyncedState<AttendanceRecord[]>([], 'attendance_v1', schoolId, isCloudConnected);
  const [messages, setMessages] = useSyncedState<Message[]>([], 'messages_v1', schoolId, isCloudConnected);
  const [archivedAttendanceLogs, setArchivedAttendanceLogs] = useSyncedState<ArchivedAttendance[]>([], 'attendance_archives_v1', schoolId, isCloudConnected);

  // Handle Shared Class Link
  useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedClassId = urlParams.get('classShare');
      if (sharedClassId && initialView !== ViewState.PUBLIC_CLASS) {
          const cls = classes.find(c => c.id === sharedClassId);
          if (cls) setView(ViewState.PUBLIC_CLASS);
      }
  }, [classes, initialView]);

  const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      setLoginError('');
      if (username === schoolMetadata.adminUsername && password === schoolMetadata.adminPassword) {
          setView(ViewState.ADMIN);
          return;
      }
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

  // VIEW RENDERING
  if (view === ViewState.PUBLIC_CLASS && sharedClass) {
      return <PublicClassPlansView schoolSettings={schoolSettings} classGroup={sharedClass} students={students.filter(s => s.classId === sharedClass.id)} weekInfo={weekInfo} schedule={schedule} planEntries={planEntries} subjects={subjects} />;
  }

  if (view === ViewState.PUBLIC_PORTAL) {
      return (
        <Suspense fallback={<GlobalLoader />}>
          <PublicSchoolPortal schoolSettings={schoolSettings} classes={classes} weekInfo={weekInfo} schedule={schedule} planEntries={planEntries} subjects={subjects} />
        </Suspense>
      );
  }

  if (view === ViewState.ADMIN) {
      return (
          <div className="relative">
              <button onClick={() => setView(ViewState.HOME)} className="fixed top-4 left-4 z-[100] bg-rose-500 text-white p-2 rounded-full shadow-lg hover:bg-rose-600 transition-colors" title="تسجيل خروج"><LogOut size={20}/></button>
              <Suspense fallback={<GlobalLoader />}>
                <AdminDashboard schoolId={schoolId} schoolMetadata={schoolMetadata} classes={classes} onAddClass={c => setClasses([...classes, c])} onSetClasses={setClasses} weekInfo={weekInfo} setWeekInfo={setWeekInfo} schoolSettings={schoolSettings} setSchoolSettings={setSchoolSettings} schedule={schedule} onUpdateSchedule={slot => { const others = schedule.filter(s => !(s.dayIndex === slot.dayIndex && s.period === slot.period && s.classId === slot.classId)); setSchedule([...others, slot]); }} planEntries={planEntries} teachers={teachers} onAddTeacher={t => setTeachers([...teachers, t])} onUpdateTeacher={t => setTeachers(teachers.map(x => x.id === t.id ? t : x))} onDeleteTeacher={id => setTeachers(teachers.filter(x => x.id !== id))} students={students} onSetStudents={setStudents} subjects={subjects} onSetSubjects={setSubjects} onArchivePlan={(name, w, e) => setArchivedPlans([...archivedPlans, {id: Date.now().toString(), schoolId, name, className: name.split(' - ')[0], archivedDate: new Date().toLocaleDateString('ar-SA'), weekInfo: w, entries: e}])} onClearPlans={() => setPlanEntries([])} archivedPlans={archivedPlans} onDeleteArchive={id => setArchivedPlans(archivedPlans.filter(a => a.id !== id))} attendanceRecords={attendanceRecords} onMarkAttendance={r => { const others = attendanceRecords.filter(x => !(x.studentId === r.studentId && x.date === r.date)); setAttendanceRecords([...others, r]); }} messages={messages} onSendMessage={m => setMessages([...messages, m])} onRenewSubscription={onUpgradeSubscription} pricing={pricing} onResetSystem={() => { setClasses([]); setSubjects([]); setStudents([]); setTeachers([]); setSchedule([]); setPlanEntries([]); setAttendanceRecords([]); setArchivedPlans([]); setArchivedAttendanceLogs([]); setMessages([]); }} archivedAttendanceLogs={archivedAttendanceLogs} onArchiveAttendance={log => setArchivedAttendanceLogs([...archivedAttendanceLogs, log])} onDeleteAttendanceArchive={id => setArchivedAttendanceLogs(archivedAttendanceLogs.filter(a => a.id !== id))} />
              </Suspense>
          </div>
      );
  }

  if (view === ViewState.TEACHER && activeTeacher) {
      return (
          <div className="relative">
              <button onClick={() => setView(ViewState.HOME)} className="fixed top-4 left-4 z-[100] bg-rose-500 text-white p-2 rounded-full shadow-lg hover:bg-rose-600 transition-colors" title="تسجيل خروج"><LogOut size={20}/></button>
              <Suspense fallback={<GlobalLoader />}>
                <TeacherPortal teacher={activeTeacher} schedule={schedule} existingEntries={planEntries} weekInfo={weekInfo} onSaveEntry={e => { const others = planEntries.filter(x => !(x.dayIndex === e.dayIndex && x.period === e.period && x.classId === e.classId)); setPlanEntries([...others, e]); }} subjects={subjects} students={students} classes={classes} attendanceRecords={attendanceRecords} onMarkAttendance={r => { const others = attendanceRecords.filter(x => !(x.studentId === r.studentId && x.date === r.date)); setAttendanceRecords([...others, r]); }} messages={messages} onSendMessage={m => setMessages([...messages, m])} schoolSettings={schoolSettings} />
              </Suspense>
          </div>
      );
  }

  // SCHOOL LOGIN VIEW (Standard SaaS Login)
  return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative overflow-hidden" dir="rtl">
          {/* Background */}
          <div className="absolute top-0 left-0 w-full h-1/2 bg-slate-900 -z-10"></div>
          
          <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-20">
              <div className="flex items-center gap-2 text-white/50">
                   <ShieldCheck size={20}/>
                   <span className="text-xs font-mono">ID: {schoolMetadata.id}</span>
              </div>
              <button onClick={onExitSchool} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 backdrop-blur-sm border border-white/10 transition-all">
                  <Globe size={16}/> الصفحة الرئيسية
              </button>
          </div>

          <div className="w-full max-w-md relative z-10 animate-slideDown">
              <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200">
                  <div className="p-8 text-center bg-white relative border-b border-slate-100">
                      <div className="w-20 h-20 bg-indigo-50 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-inner">
                          {schoolSettings.logoUrl ? (
                              <img src={schoolSettings.logoUrl} alt="Logo" className="w-14 h-14 object-contain"/>
                          ) : (
                              <SchoolIcon size={32} className="text-indigo-600"/>
                          )}
                      </div>
                      <h1 className="text-xl font-extrabold text-slate-900 mb-1">{schoolMetadata.name}</h1>
                      <p className="text-slate-500 text-sm font-medium">بوابة إدارة المدرسة</p>
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
              <p className="text-center text-slate-400/50 text-xs mt-6 font-medium">System v2.0 &copy; {new Date().getFullYear()}</p>
          </div>
      </div>
  );
};

// --- APP COMPONENT ---
const App: React.FC = () => {
    // System State
    const [schools, setSchools] = useState<SchoolMetadata[]>([]);
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
    const [isSystemAdmin, setIsSystemAdmin] = useState(false);
    const [isCloudConnected, setIsCloudConnected] = useState(false);
    const [pricing, setPricing] = useState<PricingConfig>({ quarterly: 100, annual: 300, currency: 'SAR' });
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    
    // Register Form
    const [regForm, setRegForm] = useState({ name: '', email: '', phone: '', username: '', password: '' });
    const [isRegistering, setIsRegistering] = useState(false);

    // Initialization
    useEffect(() => {
        // 1. Local Load
        const localSchools = localStorage.getItem('system_schools');
        let initialSchools: SchoolMetadata[] = [];
        
        if (localSchools) {
            try { 
                initialSchools = JSON.parse(localSchools);
                setSchools(initialSchools);
            } catch(e) {}
        }

        // 2. URL Params check
        const urlParams = new URLSearchParams(window.location.search);
        const urlSchoolId = urlParams.get('school');
        const urlAdmin = urlParams.get('admin');

        if (urlAdmin) setIsSystemAdmin(true);
        else if (urlSchoolId) setCurrentSchoolId(urlSchoolId);

        // 3. Cloud Sync
        const syncCloud = async () => {
            // Environment variables are loaded automatically by Vite
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
                    // Re-check URL param against cloud data
                    if (urlSchoolId && cloudSchools.find(s => s.id === urlSchoolId)) {
                        setCurrentSchoolId(urlSchoolId);
                    }
                }
                const cloudPricing = await loadSystemData('pricing_config');
                if (cloudPricing) setPricing(cloudPricing);
            }
        };
        setTimeout(syncCloud, 50);
    }, []);

    // Persist Registry
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
        
        // Generate a reasonably short, unique ID
        const newId = `sch_${Math.random().toString(36).substr(2, 6)}`;

        const newSchool: SchoolMetadata = {
            id: newId,
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
        
        // Save immediately
        localStorage.setItem('system_schools', JSON.stringify(updatedSchools));
        if (isCloudConnected) await saveSystemData('schools_registry', updatedSchools);

        // Send Welcome Email (Async)
        if (newSchool.email) sendActivationEmail(newSchool.email, newSchool.name, newSchool.activationCode, 'registration');

        setIsRegistering(false);
        setShowRegisterModal(false);
        setRegForm({ name: '', email: '', phone: '', username: '', password: '' });
        
        // Direct Login
        setCurrentSchoolId(newSchool.id); 
        // Update URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('school', newSchool.id);
        window.history.pushState({}, '', newUrl);
        
        alert(`تم تسجيل مدرسة ${newSchool.name} بنجاح!\nالكود الخاص بكم هو: ${newId}`);
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
                activationCode: Math.floor(1000 + Math.random() * 9000).toString()
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

    // 3. SaaS Landing Page
    return (
        <ErrorBoundary>
            <LandingPage 
                schools={schools}
                onEnterSchool={setCurrentSchoolId}
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
                                        عند التسجيل، ستحصل على صلاحية كاملة للنظام لمدة 7 أيام مجاناً. سيتم إنشاء <strong>كود مدرسة</strong> خاص بكم للدخول.
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