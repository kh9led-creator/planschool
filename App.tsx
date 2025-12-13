import React, { useState, useEffect, ErrorInfo, ReactNode, useRef } from 'react';
import WeeklyPlanTemplate from './components/WeeklyPlanTemplate';
import TeacherPortal from './components/TeacherPortal';
import AdminDashboard from './components/AdminDashboard';
import { PlanEntry, Teacher, ArchivedPlan, WeekInfo, ClassGroup, ScheduleSlot, Student, SchoolSettings, Subject, AttendanceRecord, Message } from './types';
import { UserCog, ShieldCheck, Building2, PlusCircle, ChevronDown, Check, Power, Trash2, Search, AlertOctagon, X, RefreshCcw, AlertTriangle, Loader2, Cloud, CloudOff, Database, Save } from 'lucide-react';
import { initFirebase, saveSchoolData, loadSchoolData, FirebaseConfig, getDB } from './services/firebase';

// --- 1. Robust Types & Constants ---

enum ViewState {
  HOME,
  ADMIN,
  TEACHER
}

interface SchoolMetadata {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
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

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

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
  // Loading state for initial fetch
  const [isLoaded, setIsLoaded] = useState(false);
  
  const [value, setValue] = useState<T>(() => {
    // Always check local storage first for immediate render
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

  // Effect 1: Load from Cloud on Mount (if enabled)
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
                setValue(cloudData); // Update state with cloud data
                // Update local storage too to keep them in sync
                window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(cloudData));
            }
            setIsLoaded(true);
        }
    };

    fetchCloud();

    return () => { mounted = false; };
  }, [schoolId, key, isCloudEnabled]);

  // Effect 2: Save to Local & Cloud on Change
  useEffect(() => {
    if (!isLoaded) return; // Don't save initial default values if we are waiting for cloud

    // 1. Local Save
    try {
      window.localStorage.setItem(`${schoolId}_${key}`, JSON.stringify(value));
    } catch (error) {
      console.error(`Error saving locally:`, error);
    }

    // 2. Cloud Save (Debounced)
    if (isCloudEnabled && getDB()) {
        const timeoutId = setTimeout(() => {
            saveSchoolData(schoolId, key, value);
        }, 1000); // 1 second debounce
        return () => clearTimeout(timeoutId);
    }

  }, [key, value, schoolId, isLoaded, isCloudEnabled]);

  return [value, setValue, isLoaded];
}

// --- 4. Inner System Logic (The School Instance) ---
interface SchoolSystemProps {
  schoolId: string;
  schoolName: string; 
  availableSchools: SchoolMetadata[];
  onSwitchSchool: (id: string) => void;
  onOpenSystemAdmin: () => void;
  isCloudConnected: boolean;
}

const SchoolSystem: React.FC<SchoolSystemProps> = ({ 
  schoolId, 
  schoolName, 
  availableSchools, 
  onSwitchSchool,
  onOpenSystemAdmin,
  isCloudConnected
}) => {
  const [view, setView] = useState<ViewState>(ViewState.HOME);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  const [showSchoolSwitcher, setShowSchoolSwitcher] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  // --- Data State Management (Synced) ---
  const [schoolSettings, setSchoolSettings, l1] = useSyncedState<SchoolSettings>(
    {...DEFAULT_SCHOOL_SETTINGS, schoolName: schoolName !== 'المدرسة الافتراضية' ? schoolName : DEFAULT_SCHOOL_SETTINGS.schoolName}, 
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

  // Sync School Name if changed from System Admin
  useEffect(() => {
     if (schoolName && schoolSettings.schoolName !== schoolName && schoolName !== 'المدرسة الافتراضية') {
         setSchoolSettings(prev => ({...prev, schoolName}));
     }
  }, [schoolName]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'admin' && password === '123456') {
        setView(ViewState.ADMIN);
        setUsername('');
        setPassword('');
        return;
    }
    const teacher = teachers.find(t => t.username === username && t.password === password);
    if (teacher) {
        setSelectedTeacherId(teacher.id);
        setView(ViewState.TEACHER);
        setUsername('');
        setPassword('');
    } else {
        alert('بيانات الدخول غير صحيحة. للإدارة: admin/123456');
    }
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
        <button 
            onClick={onOpenSystemAdmin}
            className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors z-20 flex items-center gap-2"
            title="إدارة النظام"
        >
            <UserCog size={24} />
            <span className="text-xs font-bold">إدارة النظام</span>
        </button>

        <div className="absolute top-4 right-4 z-20 flex gap-4">
           {isCloudConnected ? (
               <div className="flex items-center gap-1 text-green-600 bg-white px-3 py-1 rounded-full shadow-sm text-xs font-bold" title="متصل بالسحابة">
                   <Cloud size={14} /> متصل
               </div>
           ) : (
               <div className="flex items-center gap-1 text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm text-xs font-bold" title="محلي فقط">
                   <Database size={14} /> محلي
               </div>
           )}

           <div className="relative">
              <button 
                onClick={() => setShowSchoolSwitcher(!showSchoolSwitcher)}
                className="bg-white shadow-md px-5 py-2.5 rounded-full flex items-center gap-3 text-slate-700 hover:bg-slate-50 transition-all border border-slate-100"
              >
                  <Building2 size={18} className="text-indigo-600"/>
                  <span className="font-bold text-sm">{schoolName}</span>
                  <ChevronDown size={14} className={`transition-transform ${showSchoolSwitcher ? 'rotate-180' : ''}`} />
              </button>
              
              {showSchoolSwitcher && (
                  <div className="absolute top-full right-0 mt-3 w-72 bg-white rounded-xl shadow-2xl border border-slate-100 overflow-hidden animate-fadeIn z-30">
                      <div className="p-3 bg-slate-50 border-b text-xs font-bold text-slate-500">المدارس المتاحة</div>
                      <div className="max-h-60 overflow-y-auto">
                          {availableSchools.filter(s => s.isActive).map(s => (
                              <button 
                                key={s.id}
                                onClick={() => { onSwitchSchool(s.id); setShowSchoolSwitcher(false); }}
                                className={`w-full text-right px-4 py-3 text-sm flex justify-between items-center hover:bg-indigo-50 transition-colors border-b last:border-0 ${s.id === schoolId ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700'}`}
                              >
                                  {s.name}
                                  {s.id === schoolId && <Check size={16} className="text-indigo-600"/>}
                              </button>
                          ))}
                          {availableSchools.filter(s => s.isActive).length === 0 && (
                             <div className="p-4 text-center text-sm text-slate-400">لا توجد مدارس نشطة حالياً</div>
                          )}
                      </div>
                  </div>
              )}
           </div>
        </div>

        <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md text-center space-y-8 border border-white/50 backdrop-blur-sm relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

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
                <p className="text-slate-500 text-sm mt-1 font-medium">{schoolSettings.schoolName}</p>
             </div>
           </div>

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
               <span>نسخة النظام: v2.6.0 (Cloud Ready)</span>
               <span className="flex items-center gap-1">
                   {isCloudConnected ? <Cloud size={10} className="text-green-500"/> : <CloudOff size={10}/>}
               </span>
           </div>
        </div>
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
    schools: SchoolMetadata[];
    onToggleStatus: (id: string) => void;
    onDeleteSchool: (id: string) => void;
    onCreateSchool: () => void;
    onLogout: () => void;
    dbConfig: FirebaseConfig | null;
    onSaveDbConfig: (config: FirebaseConfig | null) => void;
}

const SystemDashboard: React.FC<SystemDashboardProps> = ({ 
    schools, onToggleStatus, onDeleteSchool, onCreateSchool, onLogout, dbConfig, onSaveDbConfig 
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [showDbModal, setShowDbModal] = useState(false);
    
    // DB Config Form
    const [apiKey, setApiKey] = useState(dbConfig?.apiKey || '');
    const [authDomain, setAuthDomain] = useState(dbConfig?.authDomain || '');
    const [projectId, setProjectId] = useState(dbConfig?.projectId || '');
    const [storageBucket, setStorageBucket] = useState(dbConfig?.storageBucket || '');
    const [messagingSenderId, setMessagingSenderId] = useState(dbConfig?.messagingSenderId || '');
    const [appId, setAppId] = useState(dbConfig?.appId || '');

    const filteredSchools = schools.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));

    const handleSaveConfig = () => {
        if (!apiKey || !projectId) {
            alert('يجب إدخال البيانات الأساسية (API Key, Project ID)');
            return;
        }
        onSaveDbConfig({ apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId });
        setShowDbModal(false);
        alert('تم حفظ الإعدادات. سيتم إعادة تحميل الصفحة لتطبيق الاتصال.');
        window.location.reload();
    };

    const handleDisconnect = () => {
        if(window.confirm('هل أنت متأكد من قطع الاتصال بقاعدة البيانات السحابية؟')) {
            onSaveDbConfig(null);
            setShowDbModal(false);
            window.location.reload();
        }
    }

    return (
        <div className="min-h-screen bg-slate-100 p-8 font-sans">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-2xl shadow-sm">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                            <div className="bg-indigo-100 p-2 rounded-lg"><UserCog size={28} className="text-indigo-600"/></div>
                            لوحة تحكم النظام
                        </h1>
                        <p className="text-slate-500 mt-1 text-sm mr-12">إدارة المدارس وتراخيص التشغيل</p>
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={() => setShowDbModal(true)}
                            className={`px-5 py-2.5 rounded-xl font-bold transition-colors text-sm flex items-center gap-2 ${dbConfig ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}
                        >
                            <Database size={16}/>
                            {dbConfig ? 'إعدادات القاعدة (متصل)' : 'ربط قاعدة بيانات'}
                        </button>
                        <button onClick={onLogout} className="bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold hover:bg-slate-300 transition-colors text-sm">
                            تسجيل خروج
                        </button>
                    </div>
                </div>

                {showDbModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-fadeIn">
                             <div className="flex justify-between items-center mb-4 border-b pb-4">
                                 <h3 className="text-lg font-bold flex items-center gap-2">
                                     <Cloud size={20} className="text-indigo-600"/>
                                     إعدادات Google Firebase Firestore
                                 </h3>
                                 <button onClick={() => setShowDbModal(false)}><X size={20} className="text-gray-400"/></button>
                             </div>
                             <div className="space-y-3 max-h-[60vh] overflow-y-auto p-1">
                                 <p className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                                     قم بإنشاء مشروع في <a href="https://console.firebase.google.com/" target="_blank" className="text-blue-600 underline">Firebase Console</a>، ثم انسخ إعدادات الويب (Web App Config) وضعها هنا.
                                 </p>
                                 <div><label className="text-xs font-bold block mb-1">apiKey</label><input className="w-full border p-2 rounded text-sm font-mono dir-ltr" value={apiKey} onChange={e => setApiKey(e.target.value)}/></div>
                                 <div><label className="text-xs font-bold block mb-1">authDomain</label><input className="w-full border p-2 rounded text-sm font-mono dir-ltr" value={authDomain} onChange={e => setAuthDomain(e.target.value)}/></div>
                                 <div><label className="text-xs font-bold block mb-1">projectId</label><input className="w-full border p-2 rounded text-sm font-mono dir-ltr" value={projectId} onChange={e => setProjectId(e.target.value)}/></div>
                                 <div><label className="text-xs font-bold block mb-1">storageBucket</label><input className="w-full border p-2 rounded text-sm font-mono dir-ltr" value={storageBucket} onChange={e => setStorageBucket(e.target.value)}/></div>
                                 <div><label className="text-xs font-bold block mb-1">messagingSenderId</label><input className="w-full border p-2 rounded text-sm font-mono dir-ltr" value={messagingSenderId} onChange={e => setMessagingSenderId(e.target.value)}/></div>
                                 <div><label className="text-xs font-bold block mb-1">appId</label><input className="w-full border p-2 rounded text-sm font-mono dir-ltr" value={appId} onChange={e => setAppId(e.target.value)}/></div>
                             </div>
                             <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                                 {dbConfig && (
                                     <button onClick={handleDisconnect} className="text-red-600 text-sm font-bold hover:bg-red-50 px-3 py-2 rounded">
                                         قطع الاتصال
                                     </button>
                                 )}
                                 <button onClick={handleSaveConfig} className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-2">
                                     <Save size={16}/> حفظ واتصال
                                 </button>
                             </div>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-lg overflow-hidden border border-slate-100">
                    <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
                        <div className="relative w-full md:w-96 group">
                            <Search className="absolute right-3 top-3 text-slate-400 group-focus-within:text-indigo-500 transition-colors" size={18}/>
                            <input 
                                type="text" 
                                placeholder="بحث عن مدرسة..." 
                                className="w-full bg-white border border-slate-200 rounded-xl py-2.5 pr-10 pl-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button 
                            onClick={onCreateSchool}
                            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-0.5"
                        >
                            <PlusCircle size={20}/>
                            تسجيل مدرسة جديدة
                        </button>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-right">
                            <thead className="bg-slate-50 text-slate-500 font-bold text-xs uppercase tracking-wider">
                                <tr>
                                    <th className="p-5 border-b">اسم المدرسة</th>
                                    <th className="p-5 border-b">تاريخ التسجيل</th>
                                    <th className="p-5 border-b">المعرف (ID)</th>
                                    <th className="p-5 border-b text-center">الحالة</th>
                                    <th className="p-5 border-b text-center">الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-slate-700 text-sm">
                                {filteredSchools.map(school => (
                                    <tr key={school.id} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="p-5 font-bold text-slate-800">{school.name}</td>
                                        <td className="p-5 font-mono text-slate-500">{new Date(school.createdAt).toLocaleDateString('ar-SA')}</td>
                                        <td className="p-5 font-mono text-xs text-slate-400">{school.id}</td>
                                        <td className="p-5 text-center">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${school.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {school.isActive ? <Check size={12}/> : <Power size={12}/>}
                                                {school.isActive ? 'نشطة' : 'موقوفة'}
                                            </span>
                                        </td>
                                        <td className="p-5 flex justify-center gap-2">
                                            <button 
                                                onClick={() => onToggleStatus(school.id)}
                                                className={`p-2 rounded-lg transition-all border ${school.isActive ? 'text-red-500 border-red-200 hover:bg-red-50' : 'text-green-600 border-green-200 hover:bg-green-50'}`}
                                                title={school.isActive ? "إيقاف" : "تفعيل"}
                                            >
                                                <Power size={18}/>
                                            </button>
                                            <button 
                                                onClick={() => onDeleteSchool(school.id)}
                                                className="p-2 rounded-lg text-slate-400 hover:text-red-600 border border-transparent hover:bg-red-50 transition-colors"
                                                title="حذف نهائي"
                                            >
                                                <Trash2 size={18}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- 6. Main App Component ---

const App: React.FC = () => {
  // Use a simple local state for registry, eventually this should also move to DB but for now we keep it simple
  const [schoolRegistry, setSchoolRegistry] = useState<SchoolMetadata[]>(() => {
       const saved = localStorage.getItem('madrasti_registry_v3');
       return saved ? JSON.parse(saved) : [{ id: 'default', name: 'المدرسة الافتراضية', createdAt: new Date().toISOString(), isActive: true }];
  });

  const [currentSchoolId, setCurrentSchoolId] = useState<string>(() => localStorage.getItem('madrasti_current_school_id') || 'default');
  
  // Database Config State
  const [dbConfig, setDbConfig] = useState<FirebaseConfig | null>(() => {
      const saved = localStorage.getItem('madrasti_firebase_config');
      return saved ? JSON.parse(saved) : null;
  });

  const [isCloudConnected, setIsCloudConnected] = useState(false);

  // Initialize Firebase on App Start if config exists
  useEffect(() => {
      if (dbConfig) {
          const success = initFirebase(dbConfig);
          setIsCloudConnected(success);
      } else {
          setIsCloudConnected(false);
      }
  }, [dbConfig]);

  // Persist Registry & Current School (Local only for metadata)
  useEffect(() => {
      localStorage.setItem('madrasti_registry_v3', JSON.stringify(schoolRegistry));
  }, [schoolRegistry]);

  useEffect(() => {
      localStorage.setItem('madrasti_current_school_id', currentSchoolId);
  }, [currentSchoolId]);

  
  const [isSystemAdmin, setIsSystemAdmin] = useState(false);
  const [showSystemLogin, setShowSystemLogin] = useState(false);
  const [sysUsername, setSysUsername] = useState('');
  const [sysPassword, setSysPassword] = useState('');

  // SAFEGUARD: Ensure currentSchool exists
  const currentSchool = schoolRegistry.find(s => s.id === currentSchoolId);

  // Auto-Repair
  if (!currentSchool) {
      if (schoolRegistry.length > 0) {
          setCurrentSchoolId(schoolRegistry[0].id);
      } else {
          const defaultSchool = { id: 'default', name: 'المدرسة الافتراضية', createdAt: new Date().toISOString(), isActive: true };
          setSchoolRegistry([defaultSchool]);
          setCurrentSchoolId('default');
      }
      return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin text-indigo-600" size={32}/></div>;
  }

  const handleCreateSchool = () => {
      const name = prompt('أدخل اسم المدرسة الجديدة:');
      if(name) {
          const newId = `school_${Date.now()}`;
          const newSchool: SchoolMetadata = {
              id: newId,
              name: name,
              createdAt: new Date().toISOString(),
              isActive: true
          };
          setSchoolRegistry(prev => [...prev, newSchool]);
          if(!isSystemAdmin) setCurrentSchoolId(newId);
          else alert('تم إنشاء المدرسة بنجاح.');
      }
  };

  const handleSystemLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if(sysUsername === 'master' && sysPassword === 'master123') {
          setIsSystemAdmin(true);
          setShowSystemLogin(false);
          setSysUsername('');
          setSysPassword('');
      } else {
          alert('بيانات مدير النظام غير صحيحة');
      }
  };

  const toggleSchoolStatus = (id: string) => {
      setSchoolRegistry(prev => prev.map(s => 
          s.id === id ? { ...s, isActive: !s.isActive } : s
      ));
  };

  const handleDeleteSchool = (id: string) => {
      if (schoolRegistry.length <= 1) {
          alert("لا يمكن حذف المدرسة الوحيدة في النظام.");
          return;
      }
      if(window.confirm('تحذير: سيتم حذف المدرسة نهائياً مع كافة البيانات. هل أنت متأكد؟')) {
          if (currentSchoolId === id) {
             const nextSchool = schoolRegistry.find(s => s.id !== id);
             if (nextSchool) setCurrentSchoolId(nextSchool.id);
          }
          setSchoolRegistry(prev => prev.filter(s => s.id !== id));
      }
  };

  const saveDbConfig = (config: FirebaseConfig | null) => {
      setDbConfig(config);
      if (config) localStorage.setItem('madrasti_firebase_config', JSON.stringify(config));
      else localStorage.removeItem('madrasti_firebase_config');
  };

  if (isSystemAdmin) {
      return (
          <ErrorBoundary>
            <SystemDashboard 
                schools={schoolRegistry}
                onToggleStatus={toggleSchoolStatus}
                onDeleteSchool={handleDeleteSchool}
                onCreateSchool={handleCreateSchool}
                onLogout={() => setIsSystemAdmin(false)}
                dbConfig={dbConfig}
                onSaveDbConfig={saveDbConfig}
            />
          </ErrorBoundary>
      );
  }

  if (showSystemLogin) {
      return (
          <div className="min-h-screen bg-slate-900/95 backdrop-blur-sm flex items-center justify-center p-4 z-50 fixed inset-0">
              <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm relative animate-fadeIn">
                   <button onClick={() => setShowSystemLogin(false)} className="absolute top-4 left-4 text-slate-400 hover:text-slate-600 bg-slate-100 rounded-full p-1">
                       <X size={20}/>
                   </button>
                   <div className="flex flex-col items-center mb-6">
                       <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mb-4 text-indigo-600 border border-indigo-100">
                           <UserCog size={32}/>
                       </div>
                       <h2 className="text-xl font-bold text-slate-800">مدير النظام</h2>
                       <p className="text-slate-500 text-sm">الوصول المقيد للإدارة العليا</p>
                   </div>
                   <form onSubmit={handleSystemLogin} className="space-y-4">
                       <div>
                           <label className="block text-xs font-bold text-slate-600 mb-1.5 mr-1">اسم المستخدم</label>
                           <input 
                             type="text" 
                             className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 dir-ltr text-center focus:ring-2 focus:ring-indigo-500 outline-none" 
                             value={sysUsername}
                             onChange={e => setSysUsername(e.target.value)}
                           />
                       </div>
                       <div>
                           <label className="block text-xs font-bold text-slate-600 mb-1.5 mr-1">كلمة المرور</label>
                           <input 
                             type="password" 
                             className="w-full border border-slate-200 p-3 rounded-xl bg-slate-50 dir-ltr text-center focus:ring-2 focus:ring-indigo-500 outline-none" 
                             value={sysPassword}
                             onChange={e => setSysPassword(e.target.value)}
                           />
                       </div>
                       <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 mt-2 shadow-lg shadow-indigo-200">
                           تسجيل دخول
                       </button>
                   </form>
              </div>
          </div>
      )
  }

  if (currentSchool && !currentSchool.isActive && !isSystemAdmin) {
      return (
          <div className="min-h-screen bg-red-50 flex flex-col items-center justify-center p-8 text-center font-sans">
              <div className="bg-white p-8 rounded-3xl shadow-xl max-w-lg w-full border border-red-100">
                  <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <AlertOctagon size={40} className="text-red-500"/>
                  </div>
                  <h1 className="text-2xl font-bold text-red-600 mb-3">المدرسة متوقفة حالياً</h1>
                  <p className="text-gray-600 mb-8 leading-relaxed">
                      عذراً، تم إيقاف الخدمة عن <strong>{currentSchool.name}</strong> مؤقتاً من قبل إدارة النظام.
                  </p>
                  
                  <div className="flex flex-col gap-3">
                      <button onClick={() => setShowSystemLogin(true)} className="text-slate-400 hover:text-indigo-600 text-sm flex items-center justify-center gap-2 py-2 transition-colors">
                          <UserCog size={16}/> تسجيل دخول مدير النظام
                      </button>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <ErrorBoundary>
        <SchoolSystem 
           key={currentSchoolId} 
           schoolId={currentSchoolId} 
           schoolName={currentSchool.name}
           availableSchools={schoolRegistry}
           onSwitchSchool={setCurrentSchoolId}
           onOpenSystemAdmin={() => setShowSystemLogin(true)}
           isCloudConnected={isCloudConnected}
        />
    </ErrorBoundary>
  );
};

export default App;