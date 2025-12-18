
import React, { Component, useState, useEffect, ReactNode, Suspense } from 'react';
import { PlanEntry, Teacher, ArchivedPlan, WeekInfo, ClassGroup, ScheduleSlot, Student, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from './types';
import { ShieldCheck, Loader2, RefreshCcw, AlertTriangle, LogIn, ArrowLeft, School as SchoolIcon, User, Key, Fingerprint, LockKeyhole, Sparkles, Globe, LogOut } from 'lucide-react';
import { initFirebase, saveSchoolData, loadSchoolData, FirebaseConfig, getDB, saveSystemData, loadSystemData } from './services/firebase';
import { sendActivationEmail } from './services/emailService';

// --- Lazy Load Components for Performance ---
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const TeacherPortal = React.lazy(() => import('./components/TeacherPortal'));
const SystemDashboard = React.lazy(() => import('./components/SystemDashboard'));

const inputModernClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700 font-medium text-right";

enum ViewState { HOME, ADMIN, TEACHER }
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
  directorateName: 'الإدارة العامة للتعليم بمحافظة ...',
  schoolName: 'اسم المدرسة',
  logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Ministry_of_Education_%28Saudi_Arabia%29.svg/1200px-Ministry_of_Education_%28Saudi_Arabia%29.svg.png',
  footerNotesRight: '',
  footerNotesLeft: '',
  footerNotesLeftImage: ''
};

// --- Robust Error Boundary ---
interface ErrorBoundaryProps { children?: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; }

// Fixed: Explicitly extended from React.Component to ensure props and state property access is correctly typed
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() { return { hasError: true }; }
  
  render() {
    // Fixed: Accessed state via this.state and props via this.props
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-6 text-center" dir="rtl">
          <AlertTriangle size={64} className="text-rose-500 mb-4" />
          <h1 className="text-3xl font-black text-slate-800 mb-2">عذراً، حدث خطأ غير متوقع</h1>
          <p className="text-slate-500 mb-8">تم تسجيل الخطأ، يرجى المحاولة مرة أخرى</p>
          <button onClick={() => window.location.reload()} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-xl hover:bg-indigo-700 transition-all"><RefreshCcw size={20} /> تحديث النظام</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const GlobalLoader = () => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
      <div className="relative">
          <Loader2 className="animate-spin text-indigo-600" size={48}/>
          <Sparkles className="absolute -top-1 -right-1 text-amber-400 animate-pulse" size={20}/>
      </div>
      <p className="text-slate-500 font-bold text-sm animate-pulse">جاري تحميل النظام...</p>
  </div>
);

// --- Custom Sync Hook ---
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
    if (isLoaded) {
        window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(value));
        if (isCloudEnabled && getDB()) {
            const handler = setTimeout(() => saveSchoolData(schoolId, key, value), 2000);
            return () => clearTimeout(handler);
        }
    }
  }, [key, value, schoolId, isLoaded, isCloudEnabled]);

  return [value, setValue, isLoaded];
}

const App: React.FC = () => {
    const [schools, setSchools] = useState<SchoolMetadata[]>([]);
    const [currentSchoolId, setCurrentSchoolId] = useState<string | null>(null);
    const [isSystemAdmin, setIsSystemAdmin] = useState(false);
    const [isCloudConnected, setIsCloudConnected] = useState(false);
    const [pricing, setPricing] = useState<PricingConfig>({ quarterly: 150, annual: 450, currency: 'SAR' });
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
        
        if (newSchool.email) {
            await sendActivationEmail(newSchool.email, newSchool.name, newId, 'registration');
        }

        setIsRegistering(false);
        setShowRegisterModal(false);
        setCurrentSchoolId(newId);
        alert(`تم تسجيل مدرستك بنجاح!\nكود الدخول الخاص بمدرستكم هو: ${newId}`);
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

    const handleSystemLogin = (e: React.FormEvent) => {
        e.preventDefault();
        if (sysUsername === 'admin' && sysPassword === 'admin123') {
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
                <SchoolSystem schoolId={currentSchool.id} schoolMetadata={currentSchool} onExitSchool={() => setCurrentSchoolId(null)} isCloudConnected={isCloudConnected} onUpgradeSubscription={handleUpgradeSubscription} pricing={pricing} />
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
                <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-40 border-b border-slate-100 shadow-sm">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3 text-indigo-600 font-extrabold text-2xl">
                            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-indigo-200 shadow-lg"><ShieldCheck size={28} /></div>
                            Madrasti Planner
                        </div>
                        <div className="flex gap-4">
                             <button onClick={() => setShowSystemLoginModal(true)} className="text-slate-300 hover:text-slate-500 transition-colors"><LockKeyhole size={20}/></button>
                             <button onClick={() => setShowRegisterModal(true)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg">ابدأ الآن</button>
                        </div>
                    </div>
                </nav>

                <div className="pt-32 pb-24 px-6 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                    <div className="space-y-10 text-center lg:text-right">
                        <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-5 py-2 rounded-full text-xs font-black border border-indigo-100 shadow-sm">
                            <Sparkles size={16} /> النظام الأول لإدارة المدارس الذكية
                        </div>
                        <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1]">
                            تخطيط مدرسي <br/>
                            <span className="bg-clip-text text-transparent bg-gradient-to-l from-indigo-600 to-purple-600">بلمسة واحدة</span>
                        </h1>
                        <p className="text-lg text-slate-500 max-w-xl leading-relaxed">
                            نظام سحابي متكامل يسهل للمعلمين إدخال الخطط وللإدارة رصد الغياب وطباعة التقارير بأناقة واحترافية.
                        </p>
                        <button onClick={() => setShowRegisterModal(true)} className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] font-bold text-lg hover:bg-indigo-700 transition-all shadow-2xl flex items-center justify-center gap-3 group mx-auto lg:mx-0">
                            سجل مدرستك الآن <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20}/>
                        </button>
                    </div>

                    <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-12 relative overflow-hidden animate-slideDown">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16"></div>
                        <h2 className="text-3xl font-black text-slate-900 mb-2">الدخول للمدرسة</h2>
                        <p className="text-slate-400 text-sm mb-10 font-medium">استخدم كود المدرسة (ID) للوصول المباشر.</p>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const code = (e.currentTarget.elements.namedItem('schoolCode') as HTMLInputElement).value;
                            const school = schools.find(s => s.id === code);
                            if (school) {
                                if (!school.isActive) alert('هذا الحساب معطل حالياً');
                                else setCurrentSchoolId(code);
                            } else alert('كود المدرسة غير صحيح.');
                        }} className="space-y-8">
                            <div className="relative">
                                <input name="schoolCode" required className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-5 text-2xl font-mono font-black text-indigo-600 outline-none focus:border-indigo-500 text-center" placeholder="sch_xxxxx" />
                                <Fingerprint className="absolute left-6 top-6 text-slate-200" size={32}/>
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-3xl font-bold text-xl hover:bg-slate-800 transition-all shadow-xl flex items-center justify-center gap-3">دخول النظام <LogIn size={24}/></button>
                        </form>
                    </div>
                </div>

                {showRegisterModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-slideDown">
                            <div className="bg-indigo-600 p-10 text-white"><h3 className="text-3xl font-black">تسجيل مدرسة جديدة</h3></div>
                            <form onSubmit={handleRegisterSchool} className="p-10 space-y-4">
                                <input required className={inputModernClass} placeholder="اسم المدرسة" value={regForm.name} onChange={e=>setRegForm({...regForm, name:e.target.value})} />
                                <input required className={inputModernClass} placeholder="البريد الإلكتروني" value={regForm.email} onChange={e=>setRegForm({...regForm, email:e.target.value})} />
                                <input required className={inputModernClass} placeholder="رقم الجوال" value={regForm.phone} onChange={e=>setRegForm({...regForm, phone:e.target.value})} />
                                <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                    <input required className={inputModernClass} placeholder="اسم مستخدم المدير" value={regForm.username} onChange={e=>setRegForm({...regForm, username:e.target.value})} />
                                    <input required className={inputModernClass} type="password" placeholder="كلمة المرور" value={regForm.password} onChange={e=>setRegForm({...regForm, password:e.target.value})} />
                                </div>
                                <button className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-indigo-100">تفعيل الحساب مجاناً</button>
                                <button type="button" onClick={()=>setShowRegisterModal(false)} className="w-full text-slate-400 font-bold mt-2">إلغاء</button>
                            </form>
                        </div>
                    </div>
                )}

                {showSystemLoginModal && (
                    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-800 rounded-3xl w-full max-sm p-10 text-white">
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl mx-auto flex items-center justify-center text-emerald-500 mb-6"><ShieldCheck size={40}/></div>
                            <h3 className="text-2xl font-black mb-10 text-center">إدارة النظام المركزية</h3>
                            <form onSubmit={handleSystemLogin} className="space-y-4">
                                <input className="w-full bg-slate-700/50 border border-slate-600 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 font-bold text-right" placeholder="اسم المستخدم" value={sysUsername} onChange={e=>setSysUsername(e.target.value)}/>
                                <input className="w-full bg-slate-700/50 border border-slate-600 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 font-bold text-right" type="password" placeholder="كلمة المرور" value={sysPassword} onChange={e=>setSysPassword(e.target.value)}/>
                                <button className="w-full bg-emerald-600 py-4 rounded-2xl font-black text-lg shadow-lg hover:bg-emerald-700 transition-all">دخول</button>
                                <button type="button" onClick={()=>setShowSystemLoginModal(false)} className="w-full text-slate-500 mt-2 font-bold">إغلاق</button>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </ErrorBoundary>
    );
};

const SchoolSystem: React.FC<{schoolId: string, schoolMetadata: SchoolMetadata, onExitSchool: () => void, isCloudConnected: boolean, onUpgradeSubscription: (id: string, p: string, c: string) => Promise<boolean>, pricing: PricingConfig}> = ({
    schoolId, schoolMetadata, onExitSchool, isCloudConnected, onUpgradeSubscription, pricing
}) => {
    const [view, setView] = useState<ViewState>(ViewState.HOME);
    const [selectedTeacherId, setSelectedTeacherId] = useState('');
    const [loginData, setLoginData] = useState({user:'', pass:''});
    const [loginError, setLoginError] = useState('');

    const [schoolSettings, setSchoolSettings] = useSyncedState<SchoolSettings>({...DEFAULT_SCHOOL_SETTINGS, schoolName: schoolMetadata.name}, 'settings', schoolId, isCloudConnected);
    const [weekInfo, setWeekInfo] = useSyncedState<WeekInfo>({startDate:'', endDate:'', weekNumber:'الأسبوع الأول', semester:'الفصل الدراسي الأول'}, 'week', schoolId, isCloudConnected);
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
        if (loginData.user === schoolMetadata.adminUsername && loginData.pass === schoolMetadata.adminPassword) { 
            setView(ViewState.ADMIN); return; 
        }
        const t = teachers.find(x => x.username === loginData.user && (x.password === loginData.pass || x.id === loginData.pass));
        if (t) { 
            setSelectedTeacherId(t.id); 
            setView(ViewState.TEACHER); return; 
        }
        setLoginError('بيانات الدخول غير صحيحة');
    };

    if (view === ViewState.ADMIN) {
        return (
            <Suspense fallback={<GlobalLoader/>}>
                <AdminDashboard 
                    schoolId={schoolId}
                    schoolMetadata={schoolMetadata} 
                    classes={classes} 
                    onSetClasses={setClasses} 
                    weekInfo={weekInfo} 
                    setWeekInfo={setWeekInfo} 
                    schoolSettings={schoolSettings} 
                    setSchoolSettings={setSchoolSettings} 
                    schedule={schedule} 
                    onUpdateSchedule={s=>{
                        const o = schedule.filter(x => !(x.dayIndex === s.dayIndex && x.period === s.period && x.classId === s.classId));
                        setSchedule([...o, s]);
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
                    onArchivePlan={(n, w, e) => setArchivedPlans([...archivedPlans, { id: Date.now().toString(), schoolId, archivedDate: new Date().toLocaleDateString(), weekInfo: w, entries: e, name: n, className: n }])} 
                    onClearPlans={() => setPlanEntries([])} 
                    archivedPlans={archivedPlans} 
                    attendanceRecords={attendanceRecords} 
                    onMarkAttendance={r => {
                        const o = attendanceRecords.filter(x => !(x.studentId === r.studentId && x.date === r.date));
                        setAttendanceRecords([...o, r]);
                    }} 
                    messages={messages} 
                    onSendMessage={m => setMessages([...messages, m])} 
                    onRenewSubscription={onUpgradeSubscription} 
                    pricing={pricing} 
                    onResetSystem={onExitSchool}
                />
            </Suspense>
        );
    }

    if (view === ViewState.TEACHER) {
        const activeTeacher = teachers.find(t => t.id === selectedTeacherId);
        if (!activeTeacher) return <GlobalLoader />;
        return (
            <Suspense fallback={<GlobalLoader/>}>
                <TeacherPortal 
                    teacher={activeTeacher} 
                    schedule={schedule} 
                    existingEntries={planEntries} 
                    weekInfo={weekInfo} 
                    onSaveEntry={e => {
                        const o = planEntries.filter(x => !(x.dayIndex === e.dayIndex && x.period === e.period && x.classId === e.classId));
                        setPlanEntries([...o, e]);
                    }} 
                    subjects={subjects} 
                    students={students} 
                    classes={classes} 
                    attendanceRecords={attendanceRecords} 
                    onMarkAttendance={r => {
                        const o = attendanceRecords.filter(x => !(x.studentId === r.studentId && x.date === r.date));
                        setAttendanceRecords([...o, r]);
                    }} 
                    messages={messages} 
                    onSendMessage={m => setMessages([...messages, m])} 
                    schoolSettings={schoolSettings}
                />
            </Suspense>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-10 right-10 flex items-center gap-4 z-10">
                <button onClick={onExitSchool} className="bg-white text-slate-600 px-6 py-3 rounded-2xl text-sm font-black border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><Globe size={18}/> العودة للرئيسية</button>
            </div>
            <div className="w-full max-w-lg bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-slideDown relative z-10">
                <div className="p-12 text-center bg-slate-900 text-white relative">
                    <div className="w-24 h-24 bg-white/10 rounded-[2rem] mx-auto mb-6 flex items-center justify-center backdrop-blur-md border border-white/20">
                        <SchoolIcon size={48}/>
                    </div>
                    <h2 className="text-3xl font-black">{schoolMetadata.name}</h2>
                    <p className="text-slate-400 font-bold mt-2 uppercase tracking-widest text-xs">بوابة الدخول الموحدة</p>
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                </div>
                <form onSubmit={handleLogin} className="p-12 space-y-8">
                    {loginError && <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-black border border-rose-100 text-center animate-pulse">{loginError}</div>}
                    <div className="space-y-4">
                        <div className="relative">
                            <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all pr-14 text-right" placeholder="اسم المستخدم" value={loginData.user} onChange={e=>setLoginData({...loginData, user:e.target.value})} />
                            <User className="absolute right-5 top-4 text-slate-300" size={24}/>
                        </div>
                        <div className="relative">
                            <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all pr-14 text-right" type="password" placeholder="كلمة المرور" value={loginData.pass} onChange={e=>setLoginData({...loginData, pass:e.target.value})} />
                            <Key className="absolute right-5 top-4 text-slate-300" size={24}/>
                        </div>
                    </div>
                    <button className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2">
                        دخول النظام <ArrowLeft size={24}/>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default App;
