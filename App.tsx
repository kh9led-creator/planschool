import React, { useState, useEffect, ErrorInfo, ReactNode, Component } from 'react';
import WeeklyPlanTemplate from './components/WeeklyPlanTemplate';
import TeacherPortal from './components/TeacherPortal';
import AdminDashboard from './components/AdminDashboard';
import { PlanEntry, Teacher, ArchivedPlan, WeekInfo, ClassGroup, ScheduleSlot, Student, SchoolSettings, Subject, AttendanceRecord, Message } from './types';
import { UserCog, ShieldCheck, Building2, PlusCircle, ChevronDown, Check, Power, Trash2, Search, AlertOctagon, X, RefreshCcw, AlertTriangle, Loader2, Cloud, CloudOff, Database, Save, Calendar, Clock, CreditCard, Lock, Copy, Key, School, CheckCircle, Mail, User, ArrowRight, ArrowLeft } from 'lucide-react';
import { initFirebase, saveSchoolData, loadSchoolData, FirebaseConfig, getDB } from './services/firebase';

// --- 1. Robust Types & Constants ---

enum ViewState {
  HOME,
  ADMIN,
  TEACHER
}

type SubscriptionPlan = 'basic' | 'pro' | 'enterprise';

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
  adminUsername?: string;
  adminPassword?: string;
  isVerified?: boolean;
}

const DEFAULT_SCHOOL_SETTINGS: SchoolSettings = {
  ministryName: 'المملكة العربية السعودية',
  authorityName: 'وزارة التعليم',
  directorateName: 'الإدارة العامة للتعليم ...',
  schoolName: 'اسم المدرسة',
  logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Ministry_of_Education_%28Saudi_Arabia%29.svg/1200px-Ministry_of_Education_%28Saudi_Arabia%29.svg.png',
  footerNotesRight: '( رسالة عامة )\n- عزيزي ولي أمر الطالب احرص على عدم غياب ابنك\n- عزيزي الطالب احرص على دخولك لمنصة مدرستي يوميا',
  footerNotesLeft: '- الاهتمام بالحضور وعدم الغياب\n- إحضار الكتب والأدوات المدرسية\n- اجعل حقيبة الطالب مثالية وعدم جعلها ذات وزن زائد تؤثر على سلامة الطالب',
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
        const timeoutId = setTimeout(() => {
            saveSchoolData(schoolId, key, value);
        }, 1000); 
        return () => clearTimeout(timeoutId);
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
  onRegisterSchool: (data: Partial<SchoolMetadata>) => void;
}

const SchoolSystem: React.FC<SchoolSystemProps> = ({ 
  schoolId, 
  schoolMetadata, 
  onSwitchSchool,
  onOpenSystemAdmin,
  isCloudConnected,
  onRegisterSchool
}) => {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  // Registration State
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [regStep, setRegStep] = useState(1); // 1: Info, 2: Verification
  const [regForm, setRegForm] = useState({ name: '', email: '', username: '', password: '' });
  const [verificationCode, setVerificationCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Check Subscription Status
  const isExpired = new Date(schoolMetadata.subscriptionEnd) < new Date();
  const daysRemaining = Math.ceil((new Date(schoolMetadata.subscriptionEnd).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

  // --- Data State Management (Synced) ---
  const [schoolSettings, setSchoolSettings, l1] = useSyncedState<SchoolSettings>(
    {...DEFAULT_SCHOOL_SETTINGS, schoolName: schoolMetadata.name !== 'المدرسة الافتراضية' ? schoolMetadata.name : DEFAULT_SCHOOL_SETTINGS.schoolName}, 
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

  const isLoading = isCloudConnected && (!l1 || !l2 || !l3 || !l4 || !l5 || !l6 || !l7 || !l8 || !l9 || !l10 || !l11);

  useEffect(() => {
     if (schoolMetadata.name && schoolSettings.schoolName !== schoolMetadata.name && schoolMetadata.name !== 'المدرسة الافتراضية') {
         setSchoolSettings(prev => ({...prev, schoolName: schoolMetadata.name}));
     }
  }, [schoolMetadata.name]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (isExpired) return;

    // 1. Check Global System Admin
    if (username === 'admin' && password === '123456') {
        setView(ViewState.ADMIN);
        setUsername('');
        setPassword('');
        return;
    }

    // 2. Check Specific School Admin (Registered via Portal)
    if (schoolMetadata.adminUsername && schoolMetadata.adminPassword) {
        if (username === schoolMetadata.adminUsername && password === schoolMetadata.adminPassword) {
             setView(ViewState.ADMIN);
             setUsername('');
             setPassword('');
             return;
        }
    }

    // 3. Check Teacher Login
    const teacher = teachers.find(t => t.username === username && t.password === password);
    if (teacher) {
        setSelectedTeacherId(teacher.id);
        setView(ViewState.TEACHER);
        setUsername('');
        setPassword('');
    } else {
        alert('بيانات الدخول غير صحيحة.');
    }
  };

  const handleInitiateRegistration = (e: React.FormEvent) => {
      e.preventDefault();
      if(regForm.name.length < 3 || regForm.username.length < 3 || regForm.password.length < 4 || !regForm.email.includes('@')) {
          alert('الرجاء تعبئة جميع الحقول بشكل صحيح');
          return;
      }
      
      setIsSendingEmail(true);
      
      // Simulate API Call to send Email
      setTimeout(() => {
          const code = Math.floor(1000 + Math.random() * 9000).toString();
          setVerificationCode(code);
          setIsSendingEmail(false);
          setRegStep(2);
          alert(`رمز التحقق (محاكاة): ${code}\nتم إرسال الرمز إلى ${regForm.email}`);
      }, 2000);
  };

  const handleVerifyAndRegister = (e: React.FormEvent) => {
      e.preventDefault();
      if (inputCode !== verificationCode) {
          alert('رمز التحقق غير صحيح');
          return;
      }

      onRegisterSchool({
          name: regForm.name,
          email: regForm.email,
          adminUsername: regForm.username,
          adminPassword: regForm.password,
          isVerified: true
      });

      // Reset
      setShowRegisterModal(false);
      setRegForm({ name: '', email: '', username: '', password: '' });
      setRegStep(1);
      setInputCode('');
  };

  const currentTeacher = teachers.find(t => t.id === selectedTeacherId);

  if (isLoading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
              <div className="loader"></div>
              <p className="text-gray-600 font-bold">جاري المزامنة مع قاعدة البيانات السحابية...</p>
          </div>
      )
  }

  // --- Views ---

  if (view === ViewState.HOME) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 relative font-sans">
        
        {/* System Admin Button (Hidden Trigger) */}
        <button 
            onClick={onOpenSystemAdmin}
            className="absolute top-4 left-4 text-slate-300 hover:text-slate-500 p-2 rounded-full transition-colors z-20"
            title="إدارة النظام"
        >
            <UserCog size={20} />
        </button>

        {/* Top Right Controls - REPLACED Switcher with Registration Button */}
        <div className="absolute top-4 right-4 z-20 flex gap-4 items-center">
           {isCloudConnected ? (
               <div className="flex items-center gap-1 text-green-600 bg-white px-3 py-1 rounded-full shadow-sm text-xs font-bold border border-green-100" title="متصل بالسحابة">
                   <Cloud size={14} /> متصل
               </div>
           ) : (
               <div className="flex items-center gap-1 text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm text-xs font-bold border border-gray-100" title="محلي فقط">
                   <Database size={14} /> محلي
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
                {!isExpired ? (
                  <p className="text-emerald-600 text-[10px] mt-2 font-bold bg-emerald-50 inline-block px-2 py-1 rounded-lg">
                    الاشتراك ساري ({daysRemaining} يوم متبقي)
                  </p>
                ) : (
                  <p className="text-red-600 text-[10px] mt-2 font-bold bg-red-50 inline-block px-2 py-1 rounded-lg flex items-center gap-1">
                    <AlertOctagon size={12}/> الاشتراك منتهي
                  </p>
                )}
             </div>
           </div>

           {isExpired ? (
             <div className="bg-red-50 border border-red-100 rounded-xl p-6 text-center space-y-3">
               <Lock size={40} className="text-red-400 mx-auto" />
               <h3 className="font-bold text-red-800">الخدمة متوقفة مؤقتاً</h3>
               <p className="text-xs text-red-600 leading-relaxed">
                 عفواً، لقد انتهت صلاحية اشتراك هذه المدرسة بتاريخ {schoolMetadata.subscriptionEnd}.
                 يرجى التواصل مع إدارة النظام لتجديد الترخيص.
               </p>
               <div className="pt-2 text-[10px] text-slate-400 font-mono select-all bg-white p-2 rounded border border-slate-100">
                  REF: {schoolMetadata.licenseKey}
               </div>
             </div>
           ) : (
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
           )}
           
           <div className="text-xs text-slate-400 pt-4 border-t flex justify-between items-center">
               <span>v3.2.0</span>
               <span className="flex items-center gap-1 font-mono text-[10px] opacity-70">
                   {schoolMetadata.plan.toUpperCase()} LICENSE
               </span>
           </div>
        </div>

        {/* Registration Modal */}
        {showRegisterModal && (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-slideDown flex flex-col max-h-[90vh]">
                    <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex justify-between items-start shrink-0">
                        <div>
                            <h3 className="text-xl font-bold flex items-center gap-2"><School size={24}/> تسجيل مدرسة جديدة</h3>
                            <p className="text-indigo-100 text-sm mt-1">ابدأ رحلتك التعليمية الرقمية الآن</p>
                        </div>
                        <button onClick={() => { setShowRegisterModal(false); setRegStep(1); }} className="bg-white/20 hover:bg-white/30 p-2 rounded-full transition-colors">
                            <X size={20}/>
                        </button>
                    </div>

                    <div className="p-8 space-y-6 overflow-y-auto">
                        {/* Steps Indicator */}
                        <div className="flex items-center justify-center gap-4 mb-4">
                             <div className={`flex items-center gap-2 text-sm font-bold ${regStep === 1 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                 <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${regStep === 1 ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300'}`}>1</div>
                                 البيانات
                             </div>
                             <div className="w-10 h-0.5 bg-slate-200"></div>
                             <div className={`flex items-center gap-2 text-sm font-bold ${regStep === 2 ? 'text-indigo-600' : 'text-slate-400'}`}>
                                 <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${regStep === 2 ? 'border-indigo-600 bg-indigo-50' : 'border-slate-300'}`}>2</div>
                                 التفعيل
                             </div>
                        </div>

                        {regStep === 1 ? (
                            <form onSubmit={handleInitiateRegistration} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">اسم المدرسة</label>
                                    <div className="relative">
                                        <input 
                                            type="text" 
                                            className="input-modern pl-10"
                                            placeholder="مثال: مدرسة الأفق العالمية"
                                            value={regForm.name}
                                            onChange={(e) => setRegForm({...regForm, name: e.target.value})}
                                            required
                                        />
                                        <School size={18} className="absolute left-3 top-3.5 text-slate-400"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 mb-1">البريد الإلكتروني</label>
                                    <div className="relative">
                                        <input 
                                            type="email" 
                                            className="input-modern pl-10 text-left"
                                            dir="ltr"
                                            placeholder="manager@school.com"
                                            value={regForm.email}
                                            onChange={(e) => setRegForm({...regForm, email: e.target.value})}
                                            required
                                        />
                                        <Mail size={18} className="absolute left-3 top-3.5 text-slate-400"/>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">اسم المستخدم</label>
                                        <div className="relative">
                                            <input 
                                                type="text" 
                                                className="input-modern pl-10 text-left"
                                                dir="ltr"
                                                placeholder="admin_user"
                                                value={regForm.username}
                                                onChange={(e) => setRegForm({...regForm, username: e.target.value})}
                                                required
                                            />
                                            <User size={18} className="absolute left-3 top-3.5 text-slate-400"/>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">كلمة المرور</label>
                                        <div className="relative">
                                            <input 
                                                type="password" 
                                                className="input-modern pl-10 text-left"
                                                dir="ltr"
                                                placeholder="****"
                                                value={regForm.password}
                                                onChange={(e) => setRegForm({...regForm, password: e.target.value})}
                                                required
                                            />
                                            <Lock size={18} className="absolute left-3 top-3.5 text-slate-400"/>
                                        </div>
                                    </div>
                                </div>

                                <button type="submit" disabled={isSendingEmail} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center gap-2 mt-4 disabled:opacity-70">
                                    {isSendingEmail ? <Loader2 className="animate-spin"/> : <>متابعة وتفعيل <ArrowRight size={20} className="rotate-180"/></>}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleVerifyAndRegister} className="space-y-6 text-center animate-fadeIn">
                                <div className="bg-indigo-50 p-6 rounded-full w-24 h-24 flex items-center justify-center mx-auto text-indigo-600 mb-4">
                                    <Mail size={48} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-xl text-slate-800">تفعيل الحساب</h3>
                                    <p className="text-slate-500 text-sm mt-2">أدخل رمز التحقق المرسل إلى <span className="font-mono text-indigo-600 font-bold">{regForm.email}</span></p>
                                </div>
                                
                                <input 
                                    type="text" 
                                    className="w-full text-center text-3xl tracking-[1em] font-mono font-bold border-2 border-slate-200 rounded-xl py-4 focus:border-indigo-500 outline-none transition-all"
                                    maxLength={4}
                                    placeholder="0000"
                                    value={inputCode}
                                    onChange={(e) => setInputCode(e.target.value)}
                                    autoFocus
                                />

                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setRegStep(1)} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl font-bold hover:bg-slate-200 transition-colors">
                                        تعديل البيانات
                                    </button>
                                    <button type="submit" className="flex-[2] bg-emerald-600 text-white py-3 rounded-xl font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2">
                                        <CheckCircle size={20}/> تأكيد وإنشاء
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        )}

      </div>
    );
  }

  // Teacher & Admin Views remain similar but with access control checks if needed later
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
            onArchivePlan={(name, week, entries) => setArchivedPlans(prev => [{id: Date.now().toString(), archivedDate: new Date().toLocaleDateString('ar-SA'), weekInfo: week, entries, name, className: classes[0]?.name || 'عام'}, ...prev])}
            onClearPlans={() => { if(window.confirm('تأكيد تفريغ الخطط؟')) setPlanEntries([]) }}
            archivedPlans={archivedPlans}
            onDeleteArchive={(id) => setArchivedPlans(prev => prev.filter(a => a.id !== id))}
            onAddClass={(c) => setClasses(prev => [...prev, c])}
            onUpdateSchedule={(s) => setSchedule(prev => [...prev.filter(old => !(old.classId === s.classId && old.dayIndex === s.dayIndex && old.period === s.period)), s])}
            attendanceRecords={attendanceRecords}
            onMarkAttendance={(record) => setAttendanceRecords(prev => [...prev.filter(r => !(r.studentId === record.studentId && r.date === record.date)), record])}
            messages={messages}
            onSendMessage={(msg) => setMessages(prev => [msg, ...prev])}
         />
      </div>
    );
  }

  return <div className="p-10 text-center"><Loader2 className="animate-spin mx-auto"/> جاري تحميل النظام...</div>;
};

// --- 5. System Admin Dashboard ---
interface SystemDashboardProps {
  config: FirebaseConfig;
  onSaveConfig: (cfg: FirebaseConfig) => void;
  schools: SchoolMetadata[];
  onAddSchool: (school: SchoolMetadata) => void;
  onUpdateSchool: (school: SchoolMetadata) => void;
  onDeleteSchool: (id: string) => void;
  onClose: () => void;
}

const SystemDashboard: React.FC<SystemDashboardProps> = ({
  config, onSaveConfig, schools, onAddSchool, onUpdateSchool, onDeleteSchool, onClose
}) => {
  const [localConfig, setLocalConfig] = useState<FirebaseConfig>(config);
  const [activeTab, setActiveTab] = useState<'cloud' | 'schools'>('schools');
  
  // Create School Form State
  const [newSchoolName, setNewSchoolName] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('basic');
  const [durationMonths, setDurationMonths] = useState(12);

  const generateLicenseKey = () => {
      return Array.from({length: 4}, () => Math.random().toString(36).substring(2, 6).toUpperCase()).join('-');
  };

  const handleAddSchool = () => {
      if(!newSchoolName) return;
      const startDate = new Date();
      const endDate = new Date(startDate);
      endDate.setMonth(startDate.getMonth() + durationMonths);

      const newSchool: SchoolMetadata = {
          id: `sch_${Date.now()}`,
          name: newSchoolName,
          createdAt: startDate.toISOString(),
          isActive: true,
          subscriptionEnd: endDate.toISOString().split('T')[0],
          plan: selectedPlan,
          licenseKey: generateLicenseKey(),
      };
      onAddSchool(newSchool);
      setNewSchoolName('');
      alert(`تم إنشاء مدرسة: ${newSchoolName}\nرمز الترخيص: ${newSchool.licenseKey}`);
  };

  const handleRenew = (school: SchoolMetadata, months: number) => {
      const currentEnd = new Date(school.subscriptionEnd) > new Date() ? new Date(school.subscriptionEnd) : new Date();
      currentEnd.setMonth(currentEnd.getMonth() + months);
      onUpdateSchool({
          ...school,
          subscriptionEnd: currentEnd.toISOString().split('T')[0],
          isActive: true // Reactivate if it was expired
      });
  };

  const getPlanBadge = (plan: string) => {
      switch(plan) {
          case 'basic': return <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-bold">أساسي</span>;
          case 'pro': return <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-xs font-bold">متقدم</span>;
          case 'enterprise': return <span className="bg-purple-100 text-purple-600 px-2 py-1 rounded text-xs font-bold">مؤسسي</span>;
          default: return null;
      }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white w-full max-w-6xl rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row h-[80vh]">
        {/* Sidebar */}
        <div className="bg-slate-800 text-white p-6 md:w-64 shrink-0 flex flex-col justify-between">
           <div>
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <UserCog /> إدارة النظام
              </h2>
              <div className="space-y-2">
                  <button onClick={() => setActiveTab('schools')} className={`w-full text-right px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'schools' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}>
                      <Building2 size={18}/> المدارس والاشتراكات
                  </button>
                  <button onClick={() => setActiveTab('cloud')} className={`w-full text-right px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${activeTab === 'cloud' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700 text-slate-300'}`}>
                      <Cloud size={18}/> الربط السحابي
                  </button>
              </div>
           </div>
           <button onClick={onClose} className="mt-8 bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg flex items-center gap-2 w-full transition-colors">
              <Power size={16} /> خروج للنظام
           </button>
        </div>

        {/* Content */}
        <div className="p-8 flex-1 overflow-y-auto bg-slate-50">
            {activeTab === 'cloud' && (
                <section className="max-w-2xl">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2 text-xl">
                        <Cloud className="text-indigo-500"/> إعدادات Firebase
                    </h3>
                    <div className="grid grid-cols-1 gap-4 bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                        <div className="space-y-3">
                            <label className="text-xs font-bold text-slate-500">API Config</label>
                            <input type="text" placeholder="apiKey" className="input-field" value={localConfig.apiKey} onChange={e => setLocalConfig({...localConfig, apiKey: e.target.value})} />
                            <input type="text" placeholder="authDomain" className="input-field" value={localConfig.authDomain} onChange={e => setLocalConfig({...localConfig, authDomain: e.target.value})} />
                            <input type="text" placeholder="projectId" className="input-field" value={localConfig.projectId} onChange={e => setLocalConfig({...localConfig, projectId: e.target.value})} />
                            <input type="text" placeholder="storageBucket" className="input-field" value={localConfig.storageBucket} onChange={e => setLocalConfig({...localConfig, storageBucket: e.target.value})} />
                            <input type="text" placeholder="messagingSenderId" className="input-field" value={localConfig.messagingSenderId} onChange={e => setLocalConfig({...localConfig, messagingSenderId: e.target.value})} />
                            <input type="text" placeholder="appId" className="input-field" value={localConfig.appId} onChange={e => setLocalConfig({...localConfig, appId: e.target.value})} />
                        </div>
                        <button onClick={() => onSaveConfig(localConfig)} className="bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 mt-2">
                            <Save size={18}/> حفظ الاتصال
                        </button>
                    </div>
                </section>
            )}

            {activeTab === 'schools' && (
                <section>
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 text-xl">
                            <CreditCard className="text-emerald-500"/> إدارة الاشتراكات
                        </h3>
                        <div className="bg-white px-3 py-1 rounded-full text-xs font-bold shadow-sm border text-slate-500">
                            {schools.length} مدرسة مسجلة
                        </div>
                    </div>

                    {/* Add School Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 mb-8">
                        <h4 className="font-bold text-sm text-slate-600 mb-4 flex items-center gap-2"><PlusCircle size={16}/> تسجيل اشتراك جديد</h4>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                            <div className="md:col-span-2">
                                <label className="text-xs font-bold text-slate-400 mb-1 block">اسم المدرسة</label>
                                <input 
                                    type="text" 
                                    className="input-field"
                                    placeholder="مثال: مدرسة الأفق العالمية"
                                    value={newSchoolName}
                                    onChange={e => setNewSchoolName(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 mb-1 block">الباقة</label>
                                <select className="input-field" value={selectedPlan} onChange={(e) => setSelectedPlan(e.target.value as any)}>
                                    <option value="basic">أساسي (Basic)</option>
                                    <option value="pro">متقدم (Pro)</option>
                                    <option value="enterprise">مؤسسي (Enterprise)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-400 mb-1 block">المدة</label>
                                <select className="input-field" value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))}>
                                    <option value={1}>شهر واحد</option>
                                    <option value={6}>6 أشهر</option>
                                    <option value={12}>سنة كاملة</option>
                                </select>
                            </div>
                        </div>
                        <button 
                            onClick={handleAddSchool}
                            className="w-full mt-4 bg-emerald-600 text-white py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-bold flex items-center justify-center gap-2"
                        >
                            <Key size={18}/> إنشاء وإصدار ترخيص
                        </button>
                    </div>

                    {/* Schools List */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {schools.map(s => {
                            const daysLeft = Math.ceil((new Date(s.subscriptionEnd).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                            const isExpired = daysLeft <= 0;

                            return (
                                <div key={s.id} className={`bg-white p-5 rounded-xl border-2 transition-all relative group ${isExpired ? 'border-red-100 opacity-90' : 'border-slate-100 hover:border-indigo-200'}`}>
                                    <div className="flex justify-between items-start mb-3">
                                         <div>
                                             <h4 className="font-bold text-slate-800 text-lg">{s.name}</h4>
                                             <div className="flex items-center gap-2 mt-1">
                                                {getPlanBadge(s.plan)}
                                                <span className="text-[10px] text-slate-400 font-mono">{s.id}</span>
                                             </div>
                                         </div>
                                         <div className="text-left">
                                             <span className={`block text-xs font-bold ${isExpired ? 'text-red-600' : 'text-emerald-600'}`}>
                                                 {isExpired ? 'منتهية الصلاحية' : 'نشطة'}
                                             </span>
                                             <span className="text-[10px] text-slate-400">{s.subscriptionEnd}</span>
                                         </div>
                                    </div>
                                    
                                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 mb-4 flex justify-between items-center">
                                        <code className="text-xs font-mono text-slate-600">{s.licenseKey || 'NO-LICENSE'}</code>
                                        <button className="text-slate-400 hover:text-indigo-600" title="نسخ"><Copy size={14}/></button>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                        <div className="flex gap-2">
                                            <button onClick={() => handleRenew(s, 1)} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 font-bold">+شهر</button>
                                            <button onClick={() => handleRenew(s, 12)} className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-100 font-bold">+سنة</button>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => onUpdateSchool({...s, isActive: !s.isActive})} className={`p-2 rounded-lg ${s.isActive ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`} title="تجميد/تنشيط">
                                                <Power size={16}/>
                                            </button>
                                            <button onClick={() => { if(window.confirm('حذف نهائي؟')) onDeleteSchool(s.id) }} className="p-2 rounded-lg bg-rose-50 text-rose-500 hover:bg-rose-100" title="حذف">
                                                <Trash2 size={16}/>
                                            </button>
                                        </div>
                                    </div>
                                    {isExpired && (
                                        <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center rounded-xl pointer-events-none group-hover:hidden">
                                            <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg transform -rotate-12">منتهية</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                        {schools.length === 0 && <p className="text-center text-slate-400 col-span-full py-10">لا توجد مدارس مضافة</p>}
                    </div>
                </section>
            )}
        </div>
      </div>
      <style>{`
        .input-field {
            @apply w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors focus:ring-2 focus:ring-indigo-100;
        }
      `}</style>
    </div>
  );
};

// --- 6. Main App Component ---
const App: React.FC = () => {
    // System State
    const [firebaseConfig, setFirebaseConfig] = useState<FirebaseConfig>(() => {
        try {
            const saved = localStorage.getItem('sys_firebase_config');
            return saved ? JSON.parse(saved) : { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' };
        } catch {
             return { apiKey: '', authDomain: '', projectId: '', storageBucket: '', messagingSenderId: '', appId: '' };
        }
    });

    const [schools, setSchools] = useState<SchoolMetadata[]>(() => {
        try {
            const saved = localStorage.getItem('sys_schools');
            // Migration logic for old data format
            const parsed = saved ? JSON.parse(saved) : [];
            if (parsed.length > 0 && !parsed[0].plan) {
                return parsed.map((s: any) => ({
                    ...s, 
                    plan: 'basic', 
                    subscriptionEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split('T')[0],
                    licenseKey: 'MIGRATED-LEGACY'
                }));
            }
            return parsed.length ? parsed : [{ 
                id: 'default', 
                name: 'المدرسة الافتراضية', 
                createdAt: new Date().toISOString(), 
                isActive: true,
                plan: 'basic',
                subscriptionEnd: '2030-01-01',
                licenseKey: 'FREE-TIER-DEFAULT'
            }];
        } catch {
             return [{ 
                id: 'default', 
                name: 'المدرسة الافتراضية', 
                createdAt: new Date().toISOString(), 
                isActive: true,
                plan: 'basic',
                subscriptionEnd: '2030-01-01',
                licenseKey: 'FREE-TIER-DEFAULT'
             }];
        }
    });

    const [currentSchoolId, setCurrentSchoolId] = useState<string>(() => localStorage.getItem('sys_current_school') || 'default');
    const [isSystemAdminOpen, setIsSystemAdminOpen] = useState(false);
    const [isCloudConnected, setIsCloudConnected] = useState(false);

    // Persist System Config
    useEffect(() => {
        localStorage.setItem('sys_firebase_config', JSON.stringify(firebaseConfig));
        localStorage.setItem('sys_schools', JSON.stringify(schools));
        localStorage.setItem('sys_current_school', currentSchoolId);
    }, [firebaseConfig, schools, currentSchoolId]);

    // Initialize Cloud
    useEffect(() => {
        if (firebaseConfig.apiKey) {
            const success = initFirebase(firebaseConfig);
            setIsCloudConnected(success);
        }
    }, [firebaseConfig]);

    const activeSchool = schools.find(s => s.id === currentSchoolId) || schools[0];

    const generateLicenseKey = () => {
        return Array.from({length: 4}, () => Math.random().toString(36).substring(2, 6).toUpperCase()).join('-');
    };

    const handleRegisterNewSchool = (data: Partial<SchoolMetadata>) => {
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 30); // 30 Days Trial

        const newSchool: SchoolMetadata = {
            id: `sch_${Date.now()}`,
            name: data.name || 'New School',
            createdAt: startDate.toISOString(),
            isActive: true,
            subscriptionEnd: endDate.toISOString().split('T')[0],
            plan: 'basic',
            licenseKey: generateLicenseKey(),
            email: data.email,
            adminUsername: data.adminUsername,
            adminPassword: data.adminPassword,
            isVerified: true
        };

        setSchools(prev => [...prev, newSchool]);
        setCurrentSchoolId(newSchool.id);
    };

    return (
        <ErrorBoundary>
            {isSystemAdminOpen ? (
                <SystemDashboard 
                    config={firebaseConfig}
                    onSaveConfig={(cfg) => { setFirebaseConfig(cfg); setIsSystemAdminOpen(false); }}
                    schools={schools}
                    onAddSchool={(school) => {
                        setSchools(prev => [...prev, school]);
                        if(schools.length === 0) setCurrentSchoolId(school.id);
                    }}
                    onUpdateSchool={(updatedSchool) => {
                        setSchools(prev => prev.map(s => s.id === updatedSchool.id ? updatedSchool : s));
                    }}
                    onDeleteSchool={(id) => {
                        const newSchools = schools.filter(s => s.id !== id);
                        setSchools(newSchools);
                        if (currentSchoolId === id) setCurrentSchoolId(newSchools.length > 0 ? newSchools[0].id : '');
                    }}
                    onClose={() => setIsSystemAdminOpen(false)}
                />
            ) : (
                <SchoolSystem 
                    schoolId={currentSchoolId}
                    schoolMetadata={activeSchool}
                    onSwitchSchool={setCurrentSchoolId}
                    onOpenSystemAdmin={() => setIsSystemAdminOpen(true)}
                    isCloudConnected={isCloudConnected}
                    onRegisterSchool={handleRegisterNewSchool}
                />
            )}
        </ErrorBoundary>
    );
};

export default App;