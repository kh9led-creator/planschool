
// @google/genai used via context in child components if needed
import React, { useState, useEffect, ErrorInfo, ReactNode, Suspense } from 'react';
import PublicClassPlansView from './components/PublicClassPlansView';
import { PlanEntry, Teacher, ArchivedPlan, ArchivedAttendance, WeekInfo, ClassGroup, ScheduleSlot, Student, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from './types';
import { UserCog, ShieldCheck, Search, AlertOctagon, X, RefreshCcw, AlertTriangle, Loader2, Save, Calendar, Clock, CreditCard, Lock, Key, School as SchoolIcon, CheckCircle, Mail, User, ArrowRight, ArrowLeft, Phone, Smartphone, Wallet, Globe, LogIn, Shield, TrendingUp, Link as LinkIcon, LogOut, Rocket, Fingerprint, LockKeyhole, HelpCircle } from 'lucide-react';
import { initFirebase, saveSchoolData, loadSchoolData, FirebaseConfig, getDB, saveSystemData, loadSystemData } from './services/firebase';
import { sendActivationEmail } from './services/emailService';

// --- Lazy Load Heavy Components ---
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const TeacherPortal = React.lazy(() => import('./components/TeacherPortal'));
const SystemDashboard = React.lazy(() => import('./components/SystemDashboard'));
const PublicSchoolPortal = React.lazy(() => import('./components/PublicSchoolPortal'));

// --- Constants & Styles ---
const inputModernClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700 font-medium";

enum ViewState { HOME, ADMIN, TEACHER, PUBLIC_CLASS, PUBLIC_PORTAL }
type SubscriptionPlan = 'trial' | 'quarterly' | 'annual' | string;

interface SchoolMetadata {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  subscriptionEnd: string;
  plan: SubscriptionPlan;
  licenseKey: string;
  email?: string;
  managerPhone: string;
  adminUsername?: string;
  adminPassword?: string;
  activationCode: string;
  isPaid: boolean;
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

// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// Added explicit React.Component inheritance and constructor to fix 'props' type resolution issue
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center" dir="rtl">
          <AlertTriangle size={64} className="text-red-500 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">عذراً، حدث خطأ في النظام</h1>
          <button onClick={() => {localStorage.clear(); window.location.reload();}} className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-red-700 transition-all"><RefreshCcw size={20} /> إصلاح النظام (حذف البيانات المؤقتة)</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const GlobalLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <Loader2 className="animate-spin text-indigo-600" size={40}/>
      <p className="text-slate-400 font-bold text-sm animate-pulse">جاري تحميل النظام...</p>
  </div>
);

// --- Storage Hook ---
function useSyncedState<T>(defaultValue: T, key: string, schoolId: string, isCloudEnabled: boolean): [T, React.Dispatch<React.SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(() => {
    const stickyValue = window.localStorage.getItem(`${schoolId}_${key}`);
    return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
  });
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const fetchCloud = async () => {
        if (!isCloudEnabled || !getDB()) { setIsLoaded(true); return; }
        const cloudData = await loadSchoolData(schoolId, key);
        if (cloudData) {
            setValue(cloudData);
            window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(cloudData));
        }
        setIsLoaded(true);
    };
    fetchCloud();
  }, [schoolId, key, isCloudEnabled]);

  useEffect(() => {
    window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(value));
    if (isLoaded && isCloudEnabled && getDB()) {
        const handler = setTimeout(() => saveSchoolData(schoolId, key, value), 2000);
        return () => clearTimeout(handler);
    }
  }, [key, value, schoolId, isLoaded, isCloudEnabled]);

  return [value, setValue, isLoaded];
}

// --- App Component ---
const App: React.FC = () => {
    const [schools, setSchools] = useState<SchoolMetadata[]>([]);
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
    const [isSystemAdmin, setIsSystemAdmin] = useState(false);
    const [isCloudConnected, setIsCloudConnected] = useState(false);
    const [pricing, setPricing] = useState<PricingConfig>({ quarterly: 100, annual: 300, currency: 'SAR' });
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [showSystemLoginModal, setShowSystemLoginModal] = useState(false);
    
    const [regForm, setRegForm] = useState({ name: '', email: '', phone: '', username: '', password: '' });
    const [isRegistering, setIsRegistering] = useState(false);
    const [sysUsername, setSysUsername] = useState('');
    const [sysPassword, setSysPassword] = useState('');
    const [sysError, setSysError] = useState('');

    useEffect(() => {
        const localSchools = localStorage.getItem('system_schools');
        if (localSchools) setSchools(JSON.parse(localSchools));

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
                if (cloudSchools) setSchools(cloudSchools);
                const cloudPricing = await loadSystemData('pricing_config');
                if (cloudPricing) setPricing(cloudPricing);
            }
        };
        syncCloud();
    }, []);

    useEffect(() => {
        if (schools.length > 0) {
            localStorage.setItem('system_schools', JSON.stringify(schools));
            if (isCloudConnected) saveSystemData('schools_registry', schools);
        }
    }, [schools, isCloudConnected]);

    const handleRegisterSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isRegistering) return;
        setIsRegistering(true);
        
        const newId = `sch_${Math.random().toString(36).substr(2, 5)}`;
        const newSchool: SchoolMetadata = {
            id: newId,
            name: regForm.name,
            createdAt: new Date().toISOString(),
            isActive: true,
            subscriptionEnd: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
            plan: 'trial',
            licenseKey: `KEY-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
            managerPhone: regForm.phone,
            adminUsername: regForm.username || 'admin',
            adminPassword: regForm.password || '123456',
            activationCode: Math.floor(1000 + Math.random() * 9000).toString(),
            isPaid: false,
            email: regForm.email
        };

        const updatedSchools = [...schools, newSchool];
        setSchools(updatedSchools);
        
        // Send Welcome Email with School Code
        if (newSchool.email) {
            await sendActivationEmail(newSchool.email, newSchool.name, newId, 'registration');
        }

        setIsRegistering(false);
        setShowRegisterModal(false);
        setCurrentSchoolId(newId);
        
        alert(`تم تسجيل مدرستك بنجاح!\nكود الدخول الخاص بك هو: ${newId}\nلقد أرسلنا نسخة من الكود إلى بريدك الإلكتروني: ${newSchool.email}`);
    };

    const handleUpgradeSubscription = async (id: string, plan: string, code: string) => {
        const school = schools.find(s => s.id === id);
        if (school && code === school.activationCode) {
            const duration = plan === 'annual' ? 365 : 90;
            const updated = {
                ...school,
                plan,
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

    const handleSystemLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        let validUser = 'admin', validPass = 'admin123';
        if (isCloudConnected) {
            const profile = await loadSystemData('system_admin_profile');
            if (profile) { validUser = profile.username; validPass = profile.password; }
        }
        if (sysUsername === validUser && sysPassword === validPass) {
            setIsSystemAdmin(true);
            setShowSystemLoginModal(false);
        } else {
            setSysError('بيانات الدخول غير صحيحة');
        }
    };

    const currentSchool = schools.find(s => s.id === currentSchoolId);

    if (isSystemAdmin) {
        return (
            <ErrorBoundary>
                <Suspense fallback={<GlobalLoader />}>
                    <SystemDashboard schools={schools} onSelectSchool={(id) => {setCurrentSchoolId(id); setIsSystemAdmin(false);}} onDeleteSchool={id => setSchools(schools.filter(s=>s.id!==id))} onToggleStatus={(id, st) => setSchools(schools.map(s=>s.id===id?{...s, isActive:!st}:s))} onLogout={() => setIsSystemAdmin(false)} pricing={pricing} onSavePricing={setPricing} />
                </Suspense>
            </ErrorBoundary>
        );
    }

    if (currentSchool) {
        return (
            <ErrorBoundary>
                <SchoolSystem schoolId={currentSchool.id} schoolMetadata={currentSchool} onExitSchool={() => setCurrentSchoolId(null)} isCloudConnected={isCloudConnected} onUpgradeSubscription={handleUpgradeSubscription} pricing={pricing} onOpenSystemAdmin={() => setShowSystemLoginModal(true)} />
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900" dir="rtl">
                {/* Modern Hero & Landing */}
                <nav className="max-w-7xl mx-auto px-6 py-6 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-indigo-600 font-extrabold text-2xl tracking-tight">
                        <ShieldCheck size={32} /> Madrasti Planner
                    </div>
                    <button onClick={() => setShowSystemLoginModal(true)} className="text-slate-400 hover:text-slate-600 transition-colors"><LockKeyhole size={20}/></button>
                </nav>

                <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center pt-12 pb-24">
                    <div className="space-y-8">
                        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-bold border border-indigo-100">
                           <Rocket size={14}/> الإصدار السحابي 2024
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1]">
                            نظام إدارة الخطط <br/>
                            <span className="text-indigo-600">الأسبوعية الذكي</span>
                        </h1>
                        <p className="text-lg text-slate-500 leading-relaxed max-w-lg">
                            منصة متكاملة للمدارس لإدارة الجداول والخطط والغياب. ابدأ تجربتك المجانية الآن وانضم لمئات المدارس المتميزة.
                        </p>
                        <div className="flex flex-wrap gap-4">
                            <button onClick={() => setShowRegisterModal(true)} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center gap-3 group">
                                سجل مدرستك مجاناً <ArrowLeft className="group-hover:-translate-x-1 transition-transform"/>
                            </button>
                        </div>
                    </div>

                    <div className="relative">
                        <div className="absolute -top-10 -right-10 w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-50 -z-10 animate-pulse"></div>
                        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-10 relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                            <h2 className="text-2xl font-bold text-slate-800 mb-2">تسجيل الدخول</h2>
                            <p className="text-slate-400 text-sm mb-8">أدخل كود المدرسة الخاص بك للدخول إلى لوحة التحكم.</p>
                            <form onSubmit={(e) => {
                                e.preventDefault();
                                const code = (e.currentTarget.elements.namedItem('schoolCode') as HTMLInputElement).value;
                                const school = schools.find(s => s.id === code);
                                if (school) {
                                    if (!school.isActive) alert('هذا الحساب معطل حالياً');
                                    else setCurrentSchoolId(code);
                                } else alert('كود المدرسة غير صحيح');
                            }} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-500 mr-1">كود المدرسة</label>
                                    <div className="relative">
                                        <input name="schoolCode" type="text" className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-5 py-4 text-lg font-mono font-bold text-indigo-600 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all" placeholder="sch_xxxxx" />
                                        <Fingerprint className="absolute left-4 top-4 text-slate-300" size={24}/>
                                    </div>
                                </div>
                                <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-2">
                                    دخول للنظام <LogIn size={20}/>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>

                {/* Modals */}
                {showRegisterModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideDown">
                            <div className="bg-indigo-600 p-8 text-white flex justify-between items-start">
                                <div><h3 className="text-2xl font-bold">تسجيل مدرسة جديدة</h3><p className="text-indigo-100 opacity-80 mt-1">فترة تجريبية مجانية لمدة 7 أيام</p></div>
                                <button onClick={() => setShowRegisterModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={20}/></button>
                            </div>
                            <form onSubmit={handleRegisterSchool} className="p-8 space-y-4">
                                <input required type="text" className={inputModernClass} placeholder="اسم المدرسة" value={regForm.name} onChange={e=>setRegForm({...regForm, name:e.target.value})} />
                                <div className="grid grid-cols-2 gap-4">
                                    <input required type="email" className={inputModernClass} placeholder="البريد الإلكتروني" value={regForm.email} onChange={e=>setRegForm({...regForm, email:e.target.value})} />
                                    <input required type="tel" className={inputModernClass} placeholder="رقم الجوال" value={regForm.phone} onChange={e=>setRegForm({...regForm, phone:e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                                    <input required type="text" className={inputModernClass} placeholder="اسم المستخدم للمدير" value={regForm.username} onChange={e=>setRegForm({...regForm, username:e.target.value})} />
                                    <input required type="password" className={inputModernClass} placeholder="كلمة المرور" value={regForm.password} onChange={e=>setRegForm({...regForm, password:e.target.value})} />
                                </div>
                                <button disabled={isRegistering} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2">
                                    {isRegistering ? <Loader2 className="animate-spin" /> : 'إنشاء الحساب وبدء التجربة'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {showSystemLoginModal && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-900 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-800 p-8 text-white">
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 bg-emerald-500/20 rounded-2xl mx-auto flex items-center justify-center text-emerald-500 mb-4"><Shield size={32}/></div>
                                <h3 className="text-xl font-bold">إدارة النظام المركزية</h3>
                            </div>
                            <form onSubmit={handleSystemLogin} className="space-y-4">
                                {sysUsername && <div className="bg-red-500/10 text-red-500 p-3 rounded-xl text-xs font-bold border border-red-500/20 flex items-center gap-2">خطأ في البيانات</div>}
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500" placeholder="اسم المستخدم" value={sysUsername} onChange={e=>setSysUsername(e.target.value)}/>
                                <input className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500" type="password" placeholder="كلمة المرور" value={sysPassword} onChange={e=>setSysPassword(e.target.value)}/>
                                <button className="w-full bg-emerald-600 py-3 rounded-xl font-bold hover:bg-emerald-700 transition-all mt-4">دخول كمدير نظام</button>
                                <button type="button" onClick={()=>setShowSystemLoginModal(false)} className="w-full text-slate-500 text-sm mt-2">إلغاء</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
};

// --- School System Wrapper ---
const SchoolSystem: React.FC<{schoolId: string, schoolMetadata: SchoolMetadata, onExitSchool: () => void, isCloudConnected: boolean, onUpgradeSubscription: (id: string, p: string, c: string) => Promise<boolean>, pricing: PricingConfig, onOpenSystemAdmin: () => void}> = ({
    schoolId, schoolMetadata, onExitSchool, isCloudConnected, onUpgradeSubscription, pricing, onOpenSystemAdmin
}) => {
    const [view, setView] = useState<ViewState>(ViewState.HOME);
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [loginData, setLoginData] = useState({user:'', pass:''});
    const [loginError, setLoginError] = useState('');

    const [schoolSettings, setSchoolSettings] = useSyncedState<SchoolSettings>({...DEFAULT_SCHOOL_SETTINGS, schoolName: schoolMetadata.name}, 'settings', schoolId, isCloudConnected);
    const [weekInfo, setWeekInfo] = useSyncedState<WeekInfo>({startDate:'', endDate:'', weekNumber:'الأسبوع الأول', semester:'الأول'}, 'week', schoolId, isCloudConnected);
    const [subjects, setSubjects] = useSyncedState<Subject[]>([], 'subjects', schoolId, isCloudConnected);
    const [classes, setClasses] = useSyncedState<ClassGroup[]>([], 'classes', schoolId, isCloudConnected);
    const [schedule, setSchedule] = useSyncedState<ScheduleSlot[]>([], 'schedule', schoolId, isCloudConnected);
    const [students, setStudents] = useSyncedState<Student[]>([], 'students', schoolId, isCloudConnected);
    const [teachers, setTeachers] = useSyncedState<Teacher[]>([], 'teachers', schoolId, isCloudConnected);
    const [planEntries, setPlanEntries] = useSyncedState<PlanEntry[]>([], 'plans', schoolId, isCloudConnected);
    const [archivedPlans, setArchivedPlans] = useSyncedState<ArchivedPlan[]>([], 'archives', schoolId, isCloudConnected);
    const [attendanceRecords, setAttendanceRecords] = useSyncedState<AttendanceRecord[]>([], 'attendance', schoolId, isCloudConnected);
    const [messages, setMessages] = useSyncedState<Message[]>([], 'messages', schoolId, isCloudConnected);

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (loginData.user === schoolMetadata.adminUsername && loginData.pass === schoolMetadata.adminPassword) { setView(ViewState.ADMIN); return; }
        const t = teachers.find(x => x.username === loginData.user && (x.password === loginData.pass || x.id === loginData.pass));
        if (t) { setSelectedTeacherId(t.id); setView(ViewState.TEACHER); return; }
        setLoginError('بيانات الدخول غير صحيحة');
    };

    if (view === ViewState.ADMIN) return <Suspense fallback={<GlobalLoader/>}><AdminDashboard schoolId={schoolId} schoolMetadata={schoolMetadata} classes={classes} onSetClasses={setClasses} weekInfo={weekInfo} setWeekInfo={setWeekInfo} schoolSettings={schoolSettings} setSchoolSettings={setSchoolSettings} schedule={schedule} onUpdateSchedule={s=>{const o=schedule.filter(x=>!(x.dayIndex===s.dayIndex&&x.period===s.period&&x.classId===s.classId)); setSchedule([...o,s])}} planEntries={planEntries} teachers={teachers} onAddTeacher={t=>setTeachers([...teachers,t])} onUpdateTeacher={t=>setTeachers(teachers.map(x=>x.id===t.id?t:x))} onDeleteTeacher={id=>setTeachers(teachers.filter(x=>x.id!==id))} students={students} onSetStudents={setStudents} subjects={subjects} onSetSubjects={setSubjects} onArchivePlan={(n,w,e)=>setArchivedPlans([...archivedPlans, {id:Date.now().toString(), schoolId, archivedDate:new Date().toLocaleDateString(), weekInfo:w, entries:e, name:n, className:n}])} onClearPlans={()=>setPlanEntries([])} archivedPlans={archivedPlans} attendanceRecords={attendanceRecords} onMarkAttendance={r=>{const o=attendanceRecords.filter(x=>!(x.studentId===r.studentId&&x.date===r.date)); setAttendanceRecords([...o,r])}} messages={messages} onSendMessage={m=>setMessages([...messages,m])} onRenewSubscription={onUpgradeSubscription} pricing={pricing} onResetSystem={onExitSchool}/></Suspense>;
    
    if (view === ViewState.TEACHER) return <Suspense fallback={<GlobalLoader/>}><TeacherPortal teacher={teachers.find(t=>t.id===selectedTeacherId)!} schedule={schedule} existingEntries={planEntries} weekInfo={weekInfo} onSaveEntry={e=>{const o=planEntries.filter(x=>!(x.dayIndex===e.dayIndex&&x.period===e.period&&x.classId===e.classId)); setPlanEntries([...o,e])}} subjects={subjects} students={students} classes={classes} attendanceRecords={attendanceRecords} onMarkAttendance={r=>{const o=attendanceRecords.filter(x=>!(x.studentId===r.studentId&&x.date===r.date)); setAttendanceRecords([...o,r])}} messages={messages} onSendMessage={m=>setMessages([...messages,m])} schoolSettings={schoolSettings}/></Suspense>;

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 relative">
            <div className="absolute top-6 right-6 flex items-center gap-4">
                <button onClick={onExitSchool} className="bg-white text-slate-600 px-4 py-2 rounded-xl text-sm font-bold border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2"><Globe size={16}/> خروج</button>
            </div>
            <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden animate-slideDown">
                <div className="p-10 text-center bg-slate-900 text-white relative">
                    <div className="w-20 h-20 bg-white/10 rounded-3xl mx-auto mb-4 flex items-center justify-center backdrop-blur-md">
                        <SchoolIcon size={40}/>
                    </div>
                    <h2 className="text-2xl font-bold">{schoolMetadata.name}</h2>
                    <p className="text-slate-400 text-sm mt-1">بوابة الدخول الموحدة</p>
                </div>
                <form onSubmit={handleLogin} className="p-10 space-y-6">
                    {loginError && <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-xs font-bold border border-rose-100">{loginError}</div>}
                    <div className="space-y-4">
                        <div className="relative">
                            <input className={inputModernClass} placeholder="اسم المستخدم" value={loginData.user} onChange={e=>setLoginData({...loginData, user:e.target.value})} />
                            <User className="absolute left-4 top-3.5 text-slate-300" size={20}/>
                        </div>
                        <div className="relative">
                            <input className={inputModernClass} type="password" placeholder="كلمة المرور" value={loginData.pass} onChange={e=>setLoginData({...loginData, pass:e.target.value})} />
                            <Key className="absolute left-4 top-3.5 text-slate-300" size={20}/>
                        </div>
                    </div>
                    <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2">دخول <ArrowLeft size={18}/></button>
                </form>
            </div>
        </div>
    );
};

export default App;
