import React, { useState, useEffect, ErrorInfo, ReactNode, Component, useRef } from 'react';
import WeeklyPlanTemplate from './components/WeeklyPlanTemplate';
import TeacherPortal from './components/TeacherPortal';
import AdminDashboard from './components/AdminDashboard';
import SystemDashboard from './components/SystemDashboard'; // Imported standalone component
import PublicClassPlansView from './components/PublicClassPlansView'; // New component
import InvoiceModal from './components/InvoiceModal';
import { PlanEntry, Teacher, ArchivedPlan, ArchivedAttendance, WeekInfo, ClassGroup, ScheduleSlot, Student, SchoolSettings, Subject, AttendanceRecord, Message, PricingConfig } from './types';
import { UserCog, ShieldCheck, Building2, PlusCircle, ChevronDown, Check, Power, Trash2, Search, AlertOctagon, X, RefreshCcw, AlertTriangle, Loader2, Cloud, CloudOff, Database, Save, Calendar, Clock, CreditCard, Lock, Copy, Key, School, CheckCircle, Mail, User, ArrowRight, ArrowLeft, BarChart3, Wifi, WifiOff, Phone, Smartphone, Wallet, Landmark, Percent, Globe, Tag, LogIn, ExternalLink, Shield, TrendingUp, Filter, Link as LinkIcon } from 'lucide-react';
import { initFirebase, saveSchoolData, loadSchoolData, FirebaseConfig, getDB, saveSystemData, loadSystemData } from './services/firebase';
import { sendActivationEmail } from './services/emailService';

// --- Styles ---
const inputModernClass = "w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-700 font-medium";

// --- 1. Robust Types & Constants ---

enum ViewState {
  HOME,
  ADMIN,
  TEACHER,
  PUBLIC_CLASS // New View State for shared class links
}

// Updated Subscription Plans
type SubscriptionPlan = 'trial' | 'quarterly' | 'annual' | string;

interface SchoolMetadata {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  // Subscription Fields
  subscriptionEnd: string;
  plan: SubscriptionPlan;
  licenseKey: string;
  maxTeachers?: number;
  // Admin Credentials
  email?: string;
  managerPhone: string; // New field
  adminUsername?: string;
  adminPassword?: string;
  activationCode: string; // New field
  isPaid: boolean; // New field
  isVerified?: boolean;
}

const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  ministryName: 'المملكة العربية السعودية',
  authorityName: 'وزارة التعليم',
  directorateName: 'الإدارة العامة للتعليم ...',
  schoolName: 'اسم المدرسة',
  logoUrl: '', // Clean default
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

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  readonly props: Readonly<ErrorBoundaryProps>;

  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.props = props;
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

// --- 3. Enhanced Storage Hook (Hybrid: Cloud + Local) ---
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

  // Load from Cloud on Mount (or when schoolId changes)
  useEffect(() => {
    let mounted = true;
    setIsLoaded(false); // Reset loaded state when switching schools
    
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
            } else {
                // If cloud data is empty but we have local data for this school, keep local? 
                // Better approach for switching: Re-read local storage for the NEW schoolId first
                const local = window.localStorage.getItem(`${schoolId}_${key}`);
                if (local) {
                    try { setValue(JSON.parse(local)); } catch(e) {}
                } else {
                    setValue(defaultValue);
                }
            }
            setIsLoaded(true);
        }
    };
    fetchCloud();
    return () => { mounted = false; };
  }, [schoolId, key, isCloudEnabled]);

  // Save to Local + Cloud (Debounced)
  useEffect(() => {
    if (!isLoaded) return;
    
    // Immediate Local Save
    try {
      window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving locally:`, error);
    }

    // Debounced Cloud Save
    if (isCloudEnabled && getDB()) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        
        debounceTimer.current = setTimeout(() => {
            saveSchoolData(schoolId, key, value);
        }, 2000); // Wait 2 seconds of inactivity before writing to cloud
    }

    return () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
    }
  }, [key, value, schoolId, isLoaded, isCloudEnabled]);

  return [value, setValue, isLoaded];
}

// --- 4. Inner System Logic (The School Instance) ---
interface SchoolSystemProps {
  schoolId: string;
  schoolMetadata: SchoolMetadata; 
  onSwitchSchool: (id: string) => void;
  onOpenSystemAdmin: () => void;
  isCloudConnected: boolean;
  onRegisterSchool: (data: Partial<SchoolMetadata>) => Promise<void>;
  onUpgradeSubscription: (id: string, plan: SubscriptionPlan, code: string) => Promise<boolean> | boolean;
  pricing: PricingConfig; // Received from App
  availableSchools: SchoolMetadata[]; // For switcher
  initialView?: ViewState; // NEW: For smart navigation
}

const SchoolSystem: React.FC<SchoolSystemProps> = ({ 
  schoolId, 
  schoolMetadata, 
  onSwitchSchool,
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
  
  // Registration State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [regForm, setRegForm] = useState({ 
      name: '', email: '', phone: '', username: '', password: ''
  });

  // Check Subscription Status
  const isExpired = new Date(schoolMetadata.subscriptionEnd) < new Date();
  const daysRemaining = Math.ceil((new Date(schoolMetadata.subscriptionEnd).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

  // --- Data State Management (Synced) ---
  const [schoolSettings, setSchoolSettings, l1] = useSyncedState<SchoolSettings>(
    {...DEFAULT_SCHOOL_SETTINGS, schoolName: schoolMetadata.name}, 
    'settings_v1', schoolId, isCloudConnected
  );
  
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

  // Update local settings name if metadata changes (sync issue fix)
  useEffect(() => {
     if (schoolMetadata.name && schoolSettings.schoolName !== schoolMetadata.name) {
         setSchoolSettings(prev => ({...prev, schoolName: schoolMetadata.name}));
     }
  }, [schoolMetadata.name, schoolId]);

  // Shared Class Logic Detection
  useEffect(() => {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedClassId = urlParams.get('classShare');
      if (sharedClassId) {
          setView(ViewState.PUBLIC_CLASS);
      }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // System Admin Login (Global)
    if (username === 'kh9led' && password === '121212') {
        onOpenSystemAdmin();
        return;
    }

    // Default School Admin Login (For specific school dashboard)
    if (username === 'admin' && password === '123456') {
        setView(ViewState.ADMIN);
        setUsername('');
        setPassword('');
        return;
    }

    if (schoolMetadata.adminUsername && schoolMetadata.adminPassword) {
        if (username === schoolMetadata.adminUsername && password === schoolMetadata.adminPassword) {
             setView(ViewState.ADMIN);
             setUsername('');
             setPassword('');
             return;
        }
    }

    if (isExpired) {
        alert('عذراً، الاشتراك منتهي. النظام متوقف مؤقتاً.');
        return;
    }
    
    // Check against teachers loaded for THIS schoolId
    const teacher = teachers.find(t => t.username === username && t.password === password);
    if (teacher) {
        if (!schoolMetadata.isActive) {
             alert('عذراً، حساب المدرسة غير مفعل. يرجى مراجعة إدارة النظام.');
             return;
        }
        setSelectedTeacherId(teacher.id);
        setView(ViewState.TEACHER);
        setUsername('');
        setPassword('');
    } else {
        alert('بيانات الدخول غير صحيحة. تأكد من اختيار المدرسة الصحيحة.');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
      e.preventDefault();
      if(regForm.name.length < 3 || regForm.username.length < 3 || regForm.password.length < 4 || regForm.phone.length < 10) {
          alert('الرجاء تعبئة جميع الحقول بشكل صحيح');
          return;
      }

      setIsRegistering(true);
      
      try {
        await onRegisterSchool({
            name: regForm.name,
            email: regForm.email,
            managerPhone: regForm.phone,
            adminUsername: regForm.username,
            adminPassword: regForm.password,
            plan: 'trial',
            isActive: true,
            isPaid: false
        });
        
        setShowRegisterModal(false);
        setRegForm({ name: '', email: '', phone: '', username: '', password: '' });
      } catch (error) {
          alert('حدث خطأ أثناء التسجيل. يرجى المحاولة مرة أخرى.');
      } finally {
          setIsRegistering(false);
      }
  };

  const handleFullSystemReset = () => {
      // This wipes all operational data but keeps school settings
      setStudents([]);
      setTeachers([]);
      setClasses([]);
      setSchedule([]);
      setPlanEntries([]);
      setSubjects([]);
      setArchivedPlans([]);
      setAttendanceRecords([]);
      setMessages([]);
      setArchivedAttendanceLogs([]);
      // We keep 'schoolSettings' and 'weekInfo' to not break the basic UI immediately
  };

  const currentTeacher = teachers.find(t => t.id === selectedTeacherId);

  if (isLoading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={40} />
              <p className="text-gray-600 font-bold">جاري تحميل بيانات المدرسة...</p>
          </div>
      )
  }

  // --- PUBLIC CLASS VIEW RENDER ---
  if (view === ViewState.PUBLIC_CLASS) {
      const urlParams = new URLSearchParams(window.location.search);
      const sharedClassId = urlParams.get('classShare');
      const targetClass = classes.find(c => c.id === sharedClassId);

      if (!targetClass) {
          return <div className="min-h-screen flex items-center justify-center text-gray-500 font-bold">عذراً، الرابط غير صحيح أو الفصل غير موجود.</div>
      }

      return (
          <PublicClassPlansView 
              schoolSettings={schoolSettings}
              classGroup={targetClass}
              students={students.filter(s => s.classId === sharedClassId)}
              weekInfo={weekInfo}
              schedule={schedule}
              planEntries={planEntries}
              subjects={subjects}
          />
      );
  }

  if (view === ViewState.HOME) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative font-sans">
        
        {/* Top Right Controls */}
        <div className="absolute top-4 right-4 z-20 flex gap-4 items-center">
           {isCloudConnected ? (
               <div className="flex items-center gap-1 text-green-600 bg-white px-3 py-1 rounded-full shadow-sm text-xs font-bold border border-green-100" title="متصل بالسحابة">
                   <Wifi size={14} /> متصل
               </div>
           ) : (
               <div className="flex items-center gap-1 text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm text-xs font-bold border border-gray-100" title="محلي فقط">
                   <WifiOff size={14} /> محلي
               </div>
           )}

           <button 
                onClick={() => setShowRegisterModal(true)}
                className="bg-white hover:bg-indigo-50 text-indigo-600 px-5 py-2.5 rounded-full flex items-center gap-2 shadow-sm font-bold text-sm border border-indigo-100 transition-all hover:shadow-md"
           >
               <PlusCircle size={16} />
               تسجيل مدرسة جديدة
           </button>
        </div>

        {/* Missing Config Alert */}
        {!isCloudConnected && (
            <div className="absolute top-4 left-4 z-20 bg-amber-50 text-amber-800 px-4 py-2 rounded-lg border border-amber-200 text-xs font-bold shadow-sm max-w-xs">
                <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle size={14}/> تنبيه إعدادات
                </div>
                لم يتم العثور على مفاتيح Firebase. النظام يعمل محلياً. للربط، قم بإنشاء ملف .env
            </div>
        )}

        {/* Login Card */}
        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-center space-y-8 border border-white/50 backdrop-blur-sm relative overflow-hidden animate-slideDown">
           <div className={`absolute top-0 left-0 w-full h-2 ${isExpired ? 'bg-red-500' : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500'}`}></div>

           <div className="space-y-4">
             <div className="w-28 h-28 bg-white rounded-full mx-auto flex items-center justify-center text-white shadow-lg border-4 border-slate-50 overflow-hidden relative">
               {schoolSettings.logoUrl ? (
                   <img src={schoolSettings.logoUrl} alt="Logo" className="w-full h-full object-contain p-2" />
               ) : (
                   <ShieldCheck size={48} className="text-slate-300"/>
               )}
             </div>
             <div>
                <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">نظام الخطط الأسبوعية</h1>
                <p className="text-slate-500 text-sm mt-1 font-medium">{schoolMetadata.name}</p>
                
                {/* School Switcher */}
                {availableSchools.length > 1 && (
                    <div className="relative mt-2 inline-block">
                        <button 
                            onClick={() => setShowSchoolMenu(!showSchoolMenu)}
                            className="text-indigo-600 text-xs font-bold flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition-colors mx-auto"
                        >
                            تغيير المدرسة <ChevronDown size={12}/>
                        </button>
                        {showSchoolMenu && (
                            <div className="absolute top-full left-1/2 -translate-x-1/2 w-48 bg-white border border-slate-200 shadow-xl rounded-xl mt-2 py-1 z-50 max-h-60 overflow-y-auto">
                                {availableSchools.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => { onSwitchSchool(s.id); setShowSchoolMenu(false); }}
                                        className={`w-full text-right px-4 py-2 text-xs font-bold hover:bg-slate-50 ${s.id === schoolId ? 'text-indigo-600 bg-indigo-50' : 'text-slate-600'}`}
                                    >
                                        {s.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="mt-2">
                    {!isExpired ? (
                    <p className="text-emerald-600 text-[10px] font-bold bg-emerald-50 inline-block px-2 py-1 rounded-lg">
                        {schoolMetadata.plan === 'trial' ? 'فترة تجريبية' : 'اشتراك مدفوع'} ({daysRemaining} يوم متبقي)
                    </p>
                    ) : (
                    <p className="text-red-600 text-[10px] font-bold bg-red-50 inline-block px-2 py-1 rounded-lg flex items-center gap-1 mx-auto w-fit">
                        <AlertOctagon size={12}/> الاشتراك منتهي
                    </p>
                    )}
                </div>
             </div>
           </div>

           {isExpired && (
             <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center space-y-3">
               <Lock size={40} className="text-red-400 mx-auto" />
               <h3 className="font-bold text-red-800">النظام مجمد</h3>
               <p className="text-xs text-red-600 leading-relaxed">
                 انتهت صلاحية الاشتراك. تم إيقاف جميع الخصائص للمعلمين. يرجى من المدير تسجيل الدخول لتجديد الاشتراك.
               </p>
             </div>
           )}

           <form onSubmit={handleLogin} className="space-y-4 text-right">
                  <div className="relative group">
                     <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <UserCog size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                     </div>
                     <input 
                       type="text" 
                       placeholder="اسم المستخدم" 
                       className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                       value={username}
                       onChange={e => setUsername(e.target.value)}
                     />
                  </div>
                  <div className="relative group">
                     <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <ShieldCheck size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors"/>
                     </div>
                     <input 
                       type="password" 
                       placeholder="كلمة المرور" 
                       className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                       value={password}
                       onChange={e => setPassword(e.target.value)}
                     />
                  </div>
                  <button 
                    type="submit"
                    className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3.5 rounded-xl hover:from-indigo-700 hover:to-indigo-800 font-bold transition-all shadow-lg shadow-indigo-200 transform hover:-translate-y-0.5"
                  >
                    تسجيل الدخول
                  </button>
           </form>
           
           <div className="text-xs text-slate-400 pt-4 border-t flex justify-between items-center">
               <span>v3.9.8</span>
               <span className="flex items-center gap-1 font-mono text-[10px] opacity-70">
                   {schoolMetadata.plan.toUpperCase()}
               </span>
           </div>
        </div>

        {/* Simplified Registration Modal */}
        {showRegisterModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideDown flex flex-col max-h-[90vh]">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex justify-between items-start shrink-0">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2"><School size={24}/> تسجيل مدرسة جديدة</h3>
                            <p className="text-indigo-100 text-sm mt-1">ابدأ فترتك التجريبية المجانية (14 يوم)</p>
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
                                 عند التسجيل، ستحصل على صلاحية كاملة للنظام لمدة 14 يوماً مجاناً. يمكنك ترقية الباقة لاحقاً من إعدادات المدرسة.
                             </p>
                        </div>

                        <button onClick={handleRegister} disabled={isRegistering} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 mt-4 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
                            {isRegistering ? <Loader2 className="animate-spin"/> : <><ArrowRight size={20} className="rotate-180"/> إنشاء الحساب وبدء التجربة</>}
                        </button>
                    </div>
                </div>
            </div>
        )}

      </div>
    );
  }

  if (view === ViewState.TEACHER && currentTeacher) {
      return (
      <div className="min-h-screen flex flex-col bg-gray-100">
         <div className="bg-gradient-to-r from-green-700 to-emerald-600 text-white p-4 shadow-lg flex justify-between items-center sticky top-0 z-40">
            <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg"><UserCog size={20}/></div>
                <div>
                    <h1 className="font-bold text-lg leading-tight">بوابة المعلم</h1>
                    <span className="text-green-100 text-xs block">{schoolSettings.schoolName}</span>
                </div>
            </div>
            <div className="flex items-center gap-3">
                {isCloudConnected && (
                    <span className="text-xs bg-green-800/50 px-2 py-1 rounded flex items-center gap-1">
                        <Cloud size={12}/> متزامن
                    </span>
                )}
                <button onClick={() => setView(ViewState.HOME)} className="text-xs bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-colors backdrop-blur-sm font-bold">
                    تسجيل خروج
                </button>
            </div>
         </div>
         <TeacherPortal 
            teacher={currentTeacher}
            schedule={schedule}
            weekInfo={weekInfo}
            existingEntries={planEntries}
            onSaveEntry={(entry) => setPlanEntries(prev => [...prev.filter(e => !(e.dayIndex === entry.dayIndex && e.period === entry.period && e.classId === entry.classId)), entry])}
            subjects={subjects}
            students={students}
            classes={classes}
            attendanceRecords={attendanceRecords}
            onMarkAttendance={(record) => setAttendanceRecords(prev => [...prev.filter(r => !(r.studentId === record.studentId && r.date === record.date)), record])}
            messages={messages}
            onSendMessage={(msg) => setMessages(prev => [msg, ...prev])}
            schoolSettings={schoolSettings}
         />
      </div>
    );
  }

  if (view === ViewState.ADMIN) {
      return (
       <div className="min-h-screen flex flex-col bg-gray-100">
         <div className="bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 shadow-lg flex justify-between items-center no-print sticky top-0 z-40">
            <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-lg"><ShieldCheck size={20}/></div>
                <div>
                     <h1 className="font-bold text-lg leading-tight">بوابة الإدارة</h1>
                     <span className="text-slate-400 text-xs block">لوحة التحكم المركزية</span>
                     {isExpired && <span className="text-[10px] bg-red-500 text-white px-2 rounded-full ml-1 animate-pulse">اشتراك منتهي</span>}
                </div>
            </div>
            <div className="flex items-center gap-3">
                {isCloudConnected && (
                    <span className="text-xs bg-slate-700 px-2 py-1 rounded flex items-center gap-1">
                        <Cloud size={12}/> متزامن
                    </span>
                )}
                <button onClick={() => setView(ViewState.HOME)} className="text-xs bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors font-bold">
                    تسجيل خروج
                </button>
            </div>
         </div>
         <AdminDashboard 
            classes={classes}
            weekInfo={weekInfo}
            setWeekInfo={setWeekInfo}
            schoolSettings={schoolSettings}
            setSchoolSettings={setSchoolSettings}
            schedule={schedule}
            planEntries={planEntries}
            teachers={teachers}
            students={students}
            subjects={subjects}
            onSetSubjects={setSubjects}
            onSetStudents={setStudents}
            onSetClasses={setClasses}
            onAddTeacher={(t) => setTeachers(prev => [...prev, t])}
            onUpdateTeacher={(t) => setTeachers(prev => prev.map(old => old.id === t.id ? t : old))}
            onDeleteTeacher={(id) => setTeachers(prev => prev.filter(t => t.id !== id))}
            onArchivePlan={(name, week, entries) => setArchivedPlans(prev => [{id: Date.now().toString(), schoolId: schoolId, archivedDate: new Date().toLocaleDateString('ar-SA'), weekInfo: week, entries, name, className: classes[0]?.name || 'عام'}, ...prev])}
            onClearPlans={() => { if(window.confirm('تأكيد تفريغ الخطط؟')) setPlanEntries([]) }}
            archivedPlans={archivedPlans}
            onDeleteArchive={(id) => setArchivedPlans(prev => prev.filter(a => a.id !== id))}
            onAddClass={(c) => setClasses(prev => [...prev, c])}
            onUpdateSchedule={(s) => setSchedule(prev => [...prev.filter(old => !(old.classId === s.classId && old.dayIndex === s.dayIndex && old.period === s.period)), s])}
            attendanceRecords={attendanceRecords}
            onMarkAttendance={(record) => setAttendanceRecords(prev => [...prev.filter(r => !(r.studentId === record.studentId && r.date === record.date)), record])}
            messages={messages}
            onSendMessage={(msg) => setMessages(prev => [msg, ...prev])}
            // Pass Subscription Data
            schoolMetadata={schoolMetadata}
            onRenewSubscription={(plan, code) => onUpgradeSubscription(schoolMetadata.id, plan, code)}
            pricing={pricing}
            schoolId={schoolId} // Added Prop for Data Ownership
            onResetSystem={handleFullSystemReset} // NEW: Reset Logic
            // NEW: Attendance Archive
            archivedAttendanceLogs={archivedAttendanceLogs}
            onArchiveAttendance={(log) => setArchivedAttendanceLogs(prev => [log, ...prev])}
            onDeleteAttendanceArchive={(id) => setArchivedAttendanceLogs(prev => prev.filter(a => a.id !== id))}
         />
      </div>
    );
  }

  return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto"/> جاري تحميل النظام...</div>;
};

const App: React.FC = () => {
  const [isCloudConnected, setIsCloudConnected] = useState(false);
  const [schools, setSchools] = useState<SchoolMetadata[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [showSystemAdmin, setShowSystemAdmin] = useState(false);
  const [pricing, setPricing] = useState<PricingConfig>({ quarterly: 150, annual: 450, currency: 'SAR' });
  const [loading, setLoading] = useState(true);

  // Initialize Firebase
  useEffect(() => {
    const config: FirebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };
    
    if (config.apiKey && config.apiKey.length > 0) {
        const success = initFirebase(config);
        setIsCloudConnected(success);
    }
  }, []);

  // Load Schools & System Settings
  useEffect(() => {
    const loadSystem = async () => {
        setLoading(true);
        try {
            if (!isCloudConnected) {
                // Local Mode
                const localSchools = localStorage.getItem('system_schools');
                if (localSchools) {
                    setSchools(JSON.parse(localSchools));
                } else {
                     // Create default school if nothing exists
                     const defaultSchool: SchoolMetadata = {
                         id: 'default_school',
                         name: 'المدرسة الافتراضية',
                         createdAt: new Date().toISOString(),
                         isActive: true,
                         subscriptionEnd: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
                         plan: 'trial',
                         licenseKey: 'DEMO-KEY',
                         managerPhone: '',
                         activationCode: '1234',
                         isPaid: false
                     };
                     setSchools([defaultSchool]);
                     localStorage.setItem('system_schools', JSON.stringify([defaultSchool]));
                }
                
                const localPricing = localStorage.getItem('system_pricing');
                if (localPricing) setPricing(JSON.parse(localPricing));
            } else {
                // Cloud Mode
                const cloudSchools = await loadSchoolData('system', 'schools_registry');
                if (cloudSchools && Array.isArray(cloudSchools)) {
                    setSchools(cloudSchools);
                } else {
                     const defaultSchool: SchoolMetadata = {
                         id: 'default_school',
                         name: 'المدرسة الافتراضية',
                         createdAt: new Date().toISOString(),
                         isActive: true,
                         subscriptionEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                         plan: 'trial',
                         licenseKey: 'DEMO-KEY',
                         managerPhone: '',
                         activationCode: '1234',
                         isPaid: false
                     };
                     setSchools([defaultSchool]); 
                }
    
                const cloudPricing = await loadSystemData('pricing_config');
                if (cloudPricing) setPricing(cloudPricing);
            }
        } catch (error) {
            console.error("System Load Error", error);
        } finally {
            setLoading(false);
        }
    };

    loadSystem();
  }, [isCloudConnected]);

  // URL Handling
  useEffect(() => {
      if (loading) return;
      
      const params = new URLSearchParams(window.location.search);
      const urlSchoolId = params.get('school');
      
      if (urlSchoolId) {
          const exists = schools.find(s => s.id === urlSchoolId);
          if (exists) {
              setSelectedSchoolId(urlSchoolId);
              return;
          }
      }
      
      if (!selectedSchoolId && schools.length > 0) {
          setSelectedSchoolId(schools[0].id);
      }
  }, [schools, selectedSchoolId, loading]);

  // Handlers
  const handleRegisterSchool = async (data: Partial<SchoolMetadata>) => {
      const newSchool: SchoolMetadata = {
          id: `sch_${Date.now()}`,
          name: data.name || 'مدرسة جديدة',
          createdAt: new Date().toISOString(),
          isActive: true,
          subscriptionEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          plan: 'trial',
          licenseKey: `KEY-${Date.now()}`,
          managerPhone: data.managerPhone || '',
          email: data.email,
          adminUsername: data.adminUsername || 'admin',
          adminPassword: data.adminPassword || '123456',
          activationCode: Math.floor(1000 + Math.random() * 9000).toString(),
          isPaid: false
      };

      const updatedSchools = [...schools, newSchool];
      setSchools(updatedSchools);
      setSelectedSchoolId(newSchool.id);
      
      if (isCloudConnected) {
          await saveSchoolData('system', 'schools_registry', updatedSchools);
      } else {
          localStorage.setItem('system_schools', JSON.stringify(updatedSchools));
      }

      if (newSchool.email) {
          await sendActivationEmail(newSchool.email, newSchool.name, newSchool.activationCode, 'registration');
      }
      
      alert(`تم تسجيل المدرسة بنجاح!\nاسم المستخدم: ${newSchool.adminUsername}\nكلمة المرور: ${newSchool.adminPassword}`);
  };

  const handleUpgradeSubscription = async (id: string, plan: SubscriptionPlan, code: string) => {
      const school = schools.find(s => s.id === id);
      if (!school) return false;

      if (code !== school.activationCode) {
          return false;
      }

      const duration = plan === 'annual' ? 365 : 90;
      const updatedSchool: SchoolMetadata = {
          ...school,
          plan: plan,
          subscriptionEnd: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString(),
          isActive: true,
          isPaid: true
      };

      const updatedSchools = schools.map(s => s.id === id ? updatedSchool : s);
      setSchools(updatedSchools);

      if (isCloudConnected) {
          await saveSchoolData('system', 'schools_registry', updatedSchools);
      } else {
          localStorage.setItem('system_schools', JSON.stringify(updatedSchools));
      }
      
      return true;
  };

  const handleSystemSavePricing = (newPricing: PricingConfig) => {
      setPricing(newPricing);
      if (isCloudConnected) {
          saveSystemData('pricing_config', newPricing);
      } else {
          localStorage.setItem('system_pricing', JSON.stringify(newPricing));
      }
  };
  
  const handleDeleteSchool = (id: string) => {
      const updated = schools.filter(s => s.id !== id);
      setSchools(updated);
      if(isCloudConnected) saveSchoolData('system', 'schools_registry', updated);
      else localStorage.setItem('system_schools', JSON.stringify(updated));
      
      if (selectedSchoolId === id) setSelectedSchoolId(updated[0]?.id || '');
  };

  const handleToggleSchoolStatus = (id: string, currentStatus: boolean) => {
       const updated = schools.map(s => s.id === id ? { ...s, isActive: !currentStatus } : s);
       setSchools(updated);
       if(isCloudConnected) saveSchoolData('system', 'schools_registry', updated);
       else localStorage.setItem('system_schools', JSON.stringify(updated));
  };

  if (showSystemAdmin) {
      return (
          <SystemDashboard 
              schools={schools}
              onSelectSchool={(id) => { setSelectedSchoolId(id); setShowSystemAdmin(false); }}
              onDeleteSchool={handleDeleteSchool}
              onToggleStatus={handleToggleSchoolStatus}
              onLogout={() => setShowSystemAdmin(false)}
              pricing={pricing}
              onSavePricing={handleSystemSavePricing}
          />
      );
  }

  const selectedSchool = schools.find(s => s.id === selectedSchoolId);

  if (loading) {
     return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
              <Loader2 className="animate-spin text-indigo-600" size={32}/>
              <p className="text-slate-500 font-bold">جاري تحميل النظام...</p>
          </div>
     );
  }

  if (!selectedSchool) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-50 flex-col gap-4">
              <p className="text-slate-500 font-bold">لا توجد مدارس مسجلة.</p>
              <button onClick={() => handleRegisterSchool({name: 'المدرسة الأولى'})} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold">
                  إنشاء مدرسة جديدة
              </button>
          </div>
      );
  }

  return (
    <ErrorBoundary>
        <SchoolSystem 
            schoolId={selectedSchool.id}
            schoolMetadata={selectedSchool}
            onSwitchSchool={setSelectedSchoolId}
            onOpenSystemAdmin={() => setShowSystemAdmin(true)}
            isCloudConnected={isCloudConnected}
            onRegisterSchool={handleRegisterSchool}
            onUpgradeSubscription={handleUpgradeSubscription}
            pricing={pricing}
            availableSchools={schools}
        />
    </ErrorBoundary>
  );
};

export default App;