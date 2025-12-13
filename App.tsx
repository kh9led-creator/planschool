import React, { useState, useEffect, ErrorInfo, ReactNode, Component } from 'react';
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

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  // Explicitly declare props to avoid TS error
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
  onAddSchool: (name: string) => void;
  onToggleSchool: (id: string) => void;
  onDeleteSchool: (id: string) => void;
  onClose: () => void;
}

const SystemDashboard: React.FC<SystemDashboardProps> = ({
  config, onSaveConfig, schools, onAddSchool, onToggleSchool, onDeleteSchool, onClose
}) => {
  const [localConfig, setLocalConfig] = useState<FirebaseConfig>(config);
  const [newSchoolName, setNewSchoolName] = useState('');

  const handleSave = () => {
    onSaveConfig(localConfig);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        {/* Sidebar */}
        <div className="bg-slate-800 text-white p-6 md:w-1/3 flex flex-col justify-between">
           <div>
              <h2 className="text-2xl font-bold mb-2 flex items-center gap-2">
                  <UserCog /> إدارة النظام
              </h2>
              <p className="text-slate-400 text-sm">إعدادات الربط السحابي وإدارة المدارس</p>
           </div>
           <button onClick={onClose} className="mt-8 bg-white/10 hover:bg-white/20 text-white py-2 px-4 rounded-lg flex items-center gap-2 w-fit transition-colors">
              <Power size={16} /> خروج للنظام
           </button>
        </div>

        {/* Content */}
        <div className="p-8 md:w-2/3 space-y-8 overflow-y-auto max-h-[90vh]">
            <section>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2">
                    <Cloud className="text-indigo-500"/> إعدادات Firebase
                </h3>
                <div className="grid grid-cols-1 gap-3">
                    <input type="text" placeholder="apiKey" className="input-field" value={localConfig.apiKey} onChange={e => setLocalConfig({...localConfig, apiKey: e.target.value})} />
                    <input type="text" placeholder="authDomain" className="input-field" value={localConfig.authDomain} onChange={e => setLocalConfig({...localConfig, authDomain: e.target.value})} />
                    <input type="text" placeholder="projectId" className="input-field" value={localConfig.projectId} onChange={e => setLocalConfig({...localConfig, projectId: e.target.value})} />
                    <input type="text" placeholder="storageBucket" className="input-field" value={localConfig.storageBucket} onChange={e => setLocalConfig({...localConfig, storageBucket: e.target.value})} />
                    <input type="text" placeholder="messagingSenderId" className="input-field" value={localConfig.messagingSenderId} onChange={e => setLocalConfig({...localConfig, messagingSenderId: e.target.value})} />
                    <input type="text" placeholder="appId" className="input-field" value={localConfig.appId} onChange={e => setLocalConfig({...localConfig, appId: e.target.value})} />
                    
                    <button onClick={handleSave} className="bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2 mt-2">
                        <Save size={16}/> حفظ الاتصال
                    </button>
                </div>
            </section>

            <section>
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2 border-b pb-2">
                    <Building2 className="text-emerald-500"/> المدارس المسجلة
                </h3>
                <div className="flex gap-2 mb-4">
                    <input 
                        type="text" 
                        placeholder="اسم المدرسة الجديدة" 
                        className="input-field flex-1"
                        value={newSchoolName}
                        onChange={e => setNewSchoolName(e.target.value)}
                    />
                    <button 
                        onClick={() => { if(newSchoolName) { onAddSchool(newSchoolName); setNewSchoolName(''); } }}
                        className="bg-emerald-600 text-white px-4 rounded-lg hover:bg-emerald-700 transition-colors"
                    >
                        <PlusCircle size={20}/>
                    </button>
                </div>
                <div className="space-y-2">
                    {schools.map(s => (
                        <div key={s.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                             <div className="flex items-center gap-3">
                                 <button onClick={() => onToggleSchool(s.id)} className={`${s.isActive ? 'text-green-500' : 'text-slate-300'}`}>
                                     <Power size={18}/>
                                 </button>
                                 <span className={`font-bold ${!s.isActive && 'text-slate-400 line-through'}`}>{s.name}</span>
                             </div>
                             <button onClick={() => onDeleteSchool(s.id)} className="text-rose-400 hover:text-rose-600">
                                 <Trash2 size={16}/>
                             </button>
                        </div>
                    ))}
                    {schools.length === 0 && <p className="text-center text-slate-400 text-sm">لا توجد مدارس مضافة</p>}
                </div>
            </section>
        </div>
      </div>
      <style>{`
        .input-field {
            @apply w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500 transition-colors;
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
            return saved ? JSON.parse(saved) : [{ id: 'default', name: 'المدرسة الافتراضية', createdAt: new Date().toISOString(), isActive: true }];
        } catch {
             return [{ id: 'default', name: 'المدرسة الافتراضية', createdAt: new Date().toISOString(), isActive: true }];
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

    // Handlers
    const handleAddSchool = (name: string) => {
        const newSchool: SchoolMetadata = {
            id: `sch_${Date.now()}`,
            name,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        setSchools(prev => [...prev, newSchool]);
        if (schools.length === 0) setCurrentSchoolId(newSchool.id);
    };

    return (
        <ErrorBoundary>
            {isSystemAdminOpen ? (
                <SystemDashboard 
                    config={firebaseConfig}
                    onSaveConfig={(cfg) => { setFirebaseConfig(cfg); setIsSystemAdminOpen(false); }}
                    schools={schools}
                    onAddSchool={handleAddSchool}
                    onToggleSchool={(id) => setSchools(prev => prev.map(s => s.id === id ? {...s, isActive: !s.isActive} : s))}
                    onDeleteSchool={(id) => {
                        if (window.confirm('حذف المدرسة سيخفيها من القائمة. هل أنت متأكد؟')) {
                            const newSchools = schools.filter(s => s.id !== id);
                            setSchools(newSchools);
                            if (currentSchoolId === id) setCurrentSchoolId(newSchools.length > 0 ? newSchools[0].id : '');
                        }
                    }}
                    onClose={() => setIsSystemAdminOpen(false)}
                />
            ) : (
                <SchoolSystem 
                    schoolId={currentSchoolId}
                    schoolName={schools.find(s => s.id === currentSchoolId)?.name || 'مدرسة غير محددة'}
                    availableSchools={schools}
                    onSwitchSchool={setCurrentSchoolId}
                    onOpenSystemAdmin={() => setIsSystemAdminOpen(true)}
                    isCloudConnected={isCloudConnected}
                />
            )}
        </ErrorBoundary>
    );
};

export default App;