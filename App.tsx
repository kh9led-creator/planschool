
import React, { useState, useEffect, ReactNode, Suspense, Component } from 'react';
import { PlanEntry, Teacher, ArchivedPlan, WeekInfo, ClassGroup, ScheduleSlot, Student, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from './types';
// Add UserCheck to the import list from lucide-react
import { UserCog, ShieldCheck, Search, AlertOctagon, X, RefreshCcw, AlertTriangle, Loader2, Save, Calendar, Clock, CreditCard, Lock, Key, School as SchoolIcon, CheckCircle, Mail, User, UserCheck, ArrowRight, ArrowLeft, Phone, Smartphone, Wallet, Globe, LogIn, Shield, TrendingUp, Link as LinkIcon, LogOut, Rocket, Fingerprint, LockKeyhole, HelpCircle, Star, Sparkles, Layers } from 'lucide-react';
import { initFirebase, saveSchoolData, loadSchoolData, FirebaseConfig, getDB, saveSystemData, loadSystemData } from './services/firebase';
import { sendActivationEmail } from './services/emailService';

// --- Lazy Load Heavy Components ---
const AdminDashboard = React.lazy(() => import('./components/AdminDashboard'));
const TeacherPortal = React.lazy(() => import('./components/TeacherPortal'));
const SystemDashboard = React.lazy(() => import('./components/SystemDashboard'));

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
interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; error: Error | null; }

// Use React.Component to ensure props and state are correctly typed and recognized
class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center" dir="rtl">
          <AlertTriangle size={64} className="text-red-500 mb-4" />
          <h1 className="text-3xl font-bold text-gray-800 mb-2">عذراً، حدث خطأ في النظام</h1>
          <button onClick={() => {localStorage.clear(); window.location.reload();}} className="bg-red-600 text-white px-6 py-3 rounded-lg font-bold flex items-center gap-2 shadow-lg hover:bg-red-700 transition-all"><RefreshCcw size={20} /> إصلاح النظام</button>
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
          <Sparkles className="absolute -top-2 -right-2 text-amber-400 animate-pulse" size={20}/>
      </div>
      <p className="text-slate-500 font-bold text-lg animate-pulse">جاري تحضير بيئة العمل...</p>
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
        alert(`تم تسجيل مدرستك بنجاح!\nكود الدخول الخاص بك هو: ${newId}\nتم إرسال الكود إلى بريدك الإلكتروني.`);
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
                <SchoolSystem schoolId={currentSchool.id} schoolMetadata={currentSchool} onExitSchool={() => setCurrentSchoolId(null)} isCloudConnected={isCloudConnected} onUpgradeSubscription={handleUpgradeSubscription} pricing={pricing} onOpenSystemAdmin={() => setShowSystemLoginModal(true)} />
            </ErrorBoundary>
        );
    }

    return (
        <ErrorBoundary>
            <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
                {/* Modern Landing Page Header */}
                <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md z-40 border-b border-slate-100 shadow-sm">
                    <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
                        <div className="flex items-center gap-3 text-indigo-600 font-extrabold text-2xl">
                            <div className="bg-indigo-600 p-2 rounded-xl text-white"><ShieldCheck size={28} /></div>
                            Madrasti Planner
                        </div>
                        <div className="hidden md:flex gap-8 text-slate-500 font-bold text-sm">
                            <a href="#features" className="hover:text-indigo-600 transition-colors">المميزات</a>
                            <a href="#pricing" className="hover:text-indigo-600 transition-colors">الأسعار</a>
                            <a href="#about" className="hover:text-indigo-600 transition-colors">عن المنصة</a>
                        </div>
                        <div className="flex gap-4">
                             <button onClick={() => setShowSystemLoginModal(true)} className="text-slate-300 hover:text-slate-500 transition-colors"><LockKeyhole size={20}/></button>
                             <button onClick={() => setShowRegisterModal(true)} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg">ابدأ الآن</button>
                        </div>
                    </div>
                </nav>

                {/* Hero Section */}
                <div className="pt-32 pb-24 px-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 -mr-24 -mt-24 w-96 h-96 bg-indigo-100/50 rounded-full blur-3xl opacity-50"></div>
                    <div className="absolute bottom-0 left-0 -ml-24 -mb-24 w-96 h-96 bg-purple-100/50 rounded-full blur-3xl opacity-50"></div>
                    
                    <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div className="space-y-10 relative z-10 text-center lg:text-right">
                            <div className="inline-flex items-center gap-2 bg-indigo-50 text-indigo-600 px-5 py-2 rounded-full text-xs font-black border border-indigo-100 shadow-sm">
                                <Sparkles size={16} /> الحل الأمثل للمدارس الذكية 2024
                            </div>
                            <h1 className="text-5xl lg:text-7xl font-black text-slate-900 leading-[1.1]">
                                اصنع التميز في <br/>
                                <span className="bg-clip-text text-transparent bg-gradient-to-l from-indigo-600 to-purple-600">إدارة خطط مدرستك</span>
                            </h1>
                            <p className="text-lg text-slate-500 leading-relaxed max-w-xl mx-auto lg:mx-0">
                                نظام سحابي متكامل يجمع بين ذكاء التخطيط وسهولة الاستخدام. وفر الوقت والجهد في إعداد الجداول والخطط الأسبوعية ورصد الغياب بضغطة زر.
                            </p>
                            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                <button onClick={() => setShowRegisterModal(true)} className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] font-bold text-lg hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-200 flex items-center justify-center gap-3 group">
                                    اشترك الآن مجاناً <ArrowLeft className="group-hover:-translate-x-1 transition-transform" size={20}/>
                                </button>
                                <div className="flex items-center gap-4 px-6 text-slate-400 font-medium">
                                    <div className="flex -space-x-3 space-x-reverse">
                                        {[1,2,3].map(i => <div key={i} className="w-10 h-10 rounded-full border-2 border-white bg-slate-200"></div>)}
                                    </div>
                                    <span className="text-sm">+100 مدرسة تثق بنا</span>
                                </div>
                            </div>
                        </div>

                        {/* Login Card */}
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-[3rem] blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                            <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-12 relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full -mr-16 -mt-16"></div>
                                <h2 className="text-3xl font-black text-slate-900 mb-2">الدخول للمدرسة</h2>
                                <p className="text-slate-400 text-sm mb-10 font-medium">أدخل "كود المدرسة" المسجل في نظامنا للوصول للوحة التحكم.</p>
                                
                                <form onSubmit={(e) => {
                                    e.preventDefault();
                                    const code = (e.currentTarget.elements.namedItem('schoolCode') as HTMLInputElement).value;
                                    const school = schools.find(s => s.id === code);
                                    if (school) {
                                        if (!school.isActive) alert('هذا الحساب معطل حالياً، تواصل مع الإدارة.');
                                        else setCurrentSchoolId(code);
                                    } else alert('كود المدرسة غير صحيح، تأكد من بريدك الإلكتروني.');
                                }} className="space-y-8">
                                    <div className="space-y-3">
                                        <label className="text-xs font-black text-slate-500 mr-2 flex items-center gap-2">
                                            <Fingerprint size={14}/> كود المدرسة (School ID)
                                        </label>
                                        <div className="relative">
                                            <input name="schoolCode" required type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl px-6 py-5 text-2xl font-mono font-black text-indigo-600 outline-none focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-50 transition-all text-center placeholder:text-slate-200" placeholder="sch_xxxxx" />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full bg-slate-900 text-white py-5 rounded-3xl font-bold text-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-3 shadow-xl">
                                        دخول النظام <LogIn size={24}/>
                                    </button>
                                </form>
                                <div className="mt-8 pt-8 border-t border-slate-50 flex justify-between items-center text-slate-400 text-sm font-bold">
                                    <span>ليس لديك كود؟</span>
                                    <button onClick={() => setShowRegisterModal(true)} className="text-indigo-600 hover:underline">سجل مدرسة جديدة</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Features Section */}
                <div id="features" className="bg-white py-24 px-6 border-y border-slate-100">
                    <div className="max-w-7xl mx-auto text-center space-y-4 mb-20">
                        <h3 className="text-indigo-600 font-black text-sm uppercase tracking-widest">مميزات المنصة</h3>
                        <h2 className="text-4xl font-black text-slate-900">كل ما تحتاجه في مكان واحد</h2>
                    </div>
                    <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            { icon: Calendar, title: 'خطط ذكية', desc: 'إدخال الدروس والواجبات بسهولة تامة مع قوالب طباعة احترافية.' },
                            { icon: UserCheck, title: 'رصد الغياب', desc: 'نظام رصد غياب يومي متصل بالطلاب وإمكانية طباعة تقارير فورية.' },
                            { icon: Shield, title: 'أمان البيانات', desc: 'حماية كاملة لبيانات مدرستك وطلابك مع نسخة احتياطية سحابية.' }
                        ].map((f, i) => (
                            <div key={i} className="p-10 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:bg-indigo-50 hover:border-indigo-100 transition-all group">
                                <div className="bg-white w-16 h-16 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-6 group-hover:scale-110 transition-transform"><f.icon size={32}/></div>
                                <h4 className="text-xl font-black text-slate-900 mb-3">{f.title}</h4>
                                <p className="text-slate-500 leading-relaxed font-medium">{f.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Registration Modal */}
                {showRegisterModal && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-xl shadow-2xl overflow-hidden animate-slideDown">
                            <div className="bg-indigo-600 p-10 text-white relative">
                                <div className="relative z-10">
                                    <h3 className="text-3xl font-black">انضم لمستقبل التعليم</h3>
                                    <p className="text-indigo-100 font-bold mt-2 opacity-80">ابدأ تجربة مجانية لمدة 7 أيام الآن</p>
                                </div>
                                <button onClick={() => setShowRegisterModal(false)} className="absolute top-8 left-8 bg-white/10 p-2 rounded-full hover:bg-white/20 transition-all"><X size={20}/></button>
                                <Rocket className="absolute -bottom-10 -right-10 text-white/10 w-48 h-48 -rotate-12 pointer-events-none" />
                            </div>
                            <form onSubmit={handleRegisterSchool} className="p-10 space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 mr-1">اسم المدرسة</label>
                                    <input required type="text" className={inputModernClass} placeholder="مثال: مدرسة التميز الأهلية" value={regForm.name} onChange={e=>setRegForm({...regForm, name:e.target.value})} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 mr-1">البريد الإلكتروني (لاستلام الكود)</label>
                                        <input required type="email" className={inputModernClass} placeholder="school@email.com" value={regForm.email} onChange={e=>setRegForm({...regForm, email:e.target.value})} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-black text-slate-500 mr-1">رقم الجوال</label>
                                        <input required type="tel" className={inputModernClass} placeholder="05xxxxxxxx" value={regForm.phone} onChange={e=>setRegForm({...regForm, phone:e.target.value})} />
                                    </div>
                                </div>
                                <div className="pt-6 border-t space-y-4">
                                    <p className="text-xs font-black text-slate-400">إعدادات حساب المدير المسؤول:</p>
                                    <div className="grid grid-cols-2 gap-4">
                                        <input required type="text" className={inputModernClass} placeholder="اسم مستخدم المدير" value={regForm.username} onChange={e=>setRegForm({...regForm, username:e.target.value})} />
                                        <input required type="password" className={inputModernClass} placeholder="كلمة المرور" value={regForm.password} onChange={e=>setRegForm({...regForm, password:e.target.value})} />
                                    </div>
                                </div>
                                <button disabled={isRegistering} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2">
                                    {isRegistering ? <Loader2 className="animate-spin" /> : 'إنشاء حساب المدرسة وتفعيل التجربة'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* System Admin Login Modal */}
                {showSystemLoginModal && (
                    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-slate-800 rounded-3xl w-full max-w-sm shadow-2xl border border-slate-700 p-10 text-white">
                            <div className="text-center mb-10">
                                <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl mx-auto flex items-center justify-center text-emerald-500 mb-4 shadow-xl shadow-emerald-500/10"><Shield size={40}/></div>
                                <h3 className="text-2xl font-black">إدارة النظام</h3>
                            </div>
                            <form onSubmit={handleSystemLogin} className="space-y-5">
                                {sysError && <div className="bg-rose-500/10 text-rose-500 p-4 rounded-xl text-xs font-bold border border-rose-500/20 text-center">{sysError}</div>}
                                <input className="w-full bg-slate-700/50 border border-slate-600 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 font-bold transition-all" placeholder="اسم المستخدم" value={sysUsername} onChange={e=>setSysUsername(e.target.value)}/>
                                <input className="w-full bg-slate-700/50 border border-slate-600 rounded-2xl px-5 py-4 outline-none focus:border-emerald-500 font-bold transition-all" type="password" placeholder="كلمة المرور" value={sysPassword} onChange={e=>setSysPassword(e.target.value)}/>
                                <button className="w-full bg-emerald-600 py-4 rounded-2xl font-black text-lg hover:bg-emerald-700 transition-all mt-4 shadow-lg">دخول لوحة التحكم</button>
                                <button type="button" onClick={()=>setShowSystemLoginModal(false)} className="w-full text-slate-500 text-sm font-bold mt-2">إغلاق</button>
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
    schoolId, schoolMetadata, onExitSchool, isCloudConnected, onUpgradeSubscription, pricing
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
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-24 -mt-24 w-64 h-64 bg-indigo-100 rounded-full blur-3xl opacity-30"></div>
            <div className="absolute top-10 right-10 flex items-center gap-4 z-10">
                <button onClick={onExitSchool} className="bg-white text-slate-600 px-6 py-3 rounded-2xl text-sm font-black border border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-2 shadow-sm"><Globe size={18}/> العودة للرئيسية</button>
            </div>
            <div className="w-full max-w-lg bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden animate-slideDown relative z-10">
                <div className="p-12 text-center bg-slate-900 text-white relative">
                    <div className="w-24 h-24 bg-white/10 rounded-[2rem] mx-auto mb-6 flex items-center justify-center backdrop-blur-md border border-white/20">
                        <SchoolIcon size={48}/>
                    </div>
                    <h2 className="text-3xl font-black">{schoolMetadata.name}</h2>
                    <p className="text-slate-400 font-bold mt-2">بوابة الدخول الموحدة</p>
                    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                </div>
                <form onSubmit={handleLogin} className="p-12 space-y-8">
                    {loginError && <div className="bg-rose-50 text-rose-600 p-4 rounded-2xl text-xs font-black border border-rose-100 text-center">{loginError}</div>}
                    <div className="space-y-4">
                        <div className="relative">
                            <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all pr-14" placeholder="اسم المستخدم" value={loginData.user} onChange={e=>setLoginData({...loginData, user:e.target.value})} />
                            <User className="absolute right-5 top-4.5 text-slate-300" size={24}/>
                        </div>
                        <div className="relative">
                            <input className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm font-bold outline-none focus:border-indigo-400 focus:bg-white transition-all pr-14" type="password" placeholder="كلمة المرور" value={loginData.pass} onChange={e=>setLoginData({...loginData, pass:e.target.value})} />
                            <Key className="absolute right-5 top-4.5 text-slate-300" size={24}/>
                        </div>
                    </div>
                    <button className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 flex items-center justify-center gap-2">
                        دخول <ArrowLeft size={24}/>
                    </button>
                </form>
            </div>
        </div>
    );
};

export default App;
