
import React, { useState, useMemo } from 'react';
import { PlanEntry, ScheduleSlot, Subject, Teacher, WeekInfo, Student, ClassGroup, AttendanceRecord, Message, SchoolSettings } from '../types';
import { DAYS_OF_WEEK } from '../services/data';
// Added User and MessageSquare imports to fix build errors
import { User, MessageSquare, Save, ChevronDown, ChevronUp, UserCheck, CheckCircle, XCircle, X, MessageCircle, Send, Bell, Calendar, BookOpen, PenTool, Printer, Sparkles, LayoutDashboard, Clock, History, LogOut } from 'lucide-react';
import AttendanceReportTemplate from './AttendanceReportTemplate';

const teacherInputClass = "w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 placeholder-slate-300 focus:bg-white focus:border-emerald-400 outline-none transition-all";

interface TeacherPortalProps {
  teacher: Teacher;
  schedule: ScheduleSlot[];
  existingEntries: PlanEntry[];
  weekInfo: WeekInfo;
  onSaveEntry: (entry: PlanEntry) => void;
  subjects: Subject[];
  students: Student[];
  classes: ClassGroup[];
  attendanceRecords: AttendanceRecord[];
  onMarkAttendance: (record: AttendanceRecord) => void;
  messages: Message[];
  onSendMessage: (msg: Message) => void;
  schoolSettings: SchoolSettings;
}

const TeacherPortal: React.FC<TeacherPortalProps> = ({
  teacher, schedule, existingEntries, weekInfo, onSaveEntry, subjects, students, classes, attendanceRecords, onMarkAttendance, messages, onSendMessage, schoolSettings
}) => {
  const [activeTab, setActiveTab] = useState<'schedule' | 'messages' | 'stats'>('schedule');
  const [activeDay, setActiveDay] = useState<number | null>(new Date().getDay());
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<{classId: string, className: string} | null>(null);
  const [newMessageText, setNewMessageText] = useState('');
  const [showReportPreview, setShowReportPreview] = useState(false);

  const teacherSchedule = useMemo(() => schedule.filter(s => s.teacherId === teacher.id), [schedule, teacher.id]);
  const todayDate = new Date().toISOString().split('T')[0];
  const myMessages = messages.filter(m => m.receiverId === teacher.id || m.receiverId === 'all' || m.senderId === teacher.id);
  const unreadCount = messages.filter(m => (m.receiverId === teacher.id || m.receiverId === 'all') && !m.isRead).length;

  const handleSendToAdmin = () => {
    if (!newMessageText.trim()) return;
    onSendMessage({
        id: `msg_${Date.now()}`,
        senderId: teacher.id,
        senderName: teacher.name,
        receiverId: 'admin',
        content: newMessageText,
        timestamp: new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'}),
        isRead: false,
        type: 'direct'
    });
    setNewMessageText('');
    alert('تم إرسال رسالتك للإدارة بنجاح');
  };

  const handleInputChange = (slot: ScheduleSlot, field: keyof PlanEntry, value: string) => {
    const existing = existingEntries.find(e => e.dayIndex === slot.dayIndex && e.period === slot.period && e.classId === slot.classId);
    onSaveEntry(existing ? { ...existing, [field]: value } : { id: `entry_${Date.now()}`, classId: slot.classId, dayIndex: slot.dayIndex, period: slot.period, lessonTopic: '', homework: '', [field]: value });
  };

  const getEntryValue = (slot: ScheduleSlot, field: keyof PlanEntry) => {
    const entry = existingEntries.find(e => e.dayIndex === slot.dayIndex && e.period === slot.period && e.classId === slot.classId);
    return entry ? (entry[field] as string) : '';
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-24" dir="rtl">
      {/* Teacher Header */}
      <header className="bg-emerald-600 text-white p-8 no-print shadow-xl relative overflow-hidden">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
              <div className="flex items-center gap-5">
                  <div className="bg-white/10 p-4 rounded-[2rem] border border-white/20 backdrop-blur-md shadow-lg">
                      <User size={40} className="text-white"/>
                  </div>
                  <div className="text-center md:text-right">
                      <h2 className="text-3xl font-black">أهلاً، أستاذ {teacher.name}</h2>
                      <p className="text-emerald-100 font-bold mt-1 text-sm">{schoolSettings.schoolName}</p>
                  </div>
              </div>
              <div className="flex gap-3">
                  <button onClick={() => setActiveTab('messages')} className="relative p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all border border-white/20">
                      <MessageCircle size={24}/>
                      {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] w-5 h-5 flex items-center justify-center rounded-full font-black animate-bounce">{unreadCount}</span>}
                  </button>
                  <button onClick={() => window.location.reload()} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 transition-all border border-white/20"><LogOut size={24}/></button>
              </div>
          </div>
          <Sparkles className="absolute -bottom-10 -left-10 text-white/5 w-64 h-64 pointer-events-none" />
      </header>

      {/* Teacher Navigation */}
      <nav className="max-w-5xl mx-auto px-6 -mt-8 relative z-20 no-print">
          <div className="bg-white p-2 rounded-3xl shadow-2xl border border-slate-100 flex items-center gap-1">
              {[
                  {id:'schedule', label:'جدولي والخطط', icon: Calendar},
                  {id:'messages', label:'رسائل الإدارة', icon: MessageSquare},
                  {id:'stats', label:'إحصائياتي', icon: LayoutDashboard}
              ].map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id as any)} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-xs transition-all ${activeTab === tab.id ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>
                      <tab.icon size={18}/> {tab.label}
                  </button>
              ))}
          </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10 animate-fadeIn">
        {activeTab === 'schedule' && (
            <div className="space-y-4 no-print">
                {DAYS_OF_WEEK.map((day, dIdx) => {
                    const daySlots = teacherSchedule.filter(s => s.dayIndex === dIdx).sort((a,b) => a.period - b.period);
                    if (daySlots.length === 0) return null;
                    const isOpen = activeDay === dIdx;

                    return (
                        <div key={day} className={`bg-white rounded-[2.5rem] border transition-all overflow-hidden ${isOpen ? 'shadow-xl border-emerald-100 ring-4 ring-emerald-50' : 'border-slate-100 shadow-sm'}`}>
                            <button onClick={() => setActiveDay(isOpen ? null : dIdx)} className="w-full flex justify-between items-center p-8 bg-white hover:bg-slate-50 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl ${isOpen ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'}`}>{dIdx + 1}</div>
                                    <div className="text-right">
                                        <h3 className={`font-black text-xl ${isOpen ? 'text-emerald-900' : 'text-slate-800'}`}>{day}</h3>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{daySlots.length} حصص دراسية</p>
                                    </div>
                                </div>
                                {isOpen ? <ChevronUp className="text-emerald-600"/> : <ChevronDown className="text-slate-300"/>}
                            </button>

                            {isOpen && (
                                <div className="p-8 space-y-8 animate-slideDown">
                                    {daySlots.map(slot => {
                                        const cls = classes.find(c => c.id === slot.classId);
                                        const sub = subjects.find(s => s.id === slot.subjectId);
                                        return (
                                            <div key={slot.period} className="p-8 border-2 border-slate-50 rounded-[2.5rem] bg-white shadow-sm hover:border-emerald-200 transition-all group">
                                                <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-50">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-1.5 h-10 bg-emerald-500 rounded-full"></div>
                                                        <div>
                                                            <h4 className="font-black text-2xl text-slate-800">{sub?.name}</h4>
                                                            <p className="text-xs font-bold text-slate-400">الفصل: <span className="text-emerald-600">{cls?.name}</span></p>
                                                        </div>
                                                    </div>
                                                    <span className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black shadow-lg">الحصة {slot.period}</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-slate-400 mr-2 flex items-center gap-2"><PenTool size={14}/> موضوع الدرس</label>
                                                        <input className={teacherInputClass} placeholder="ماذا ستشرح اليوم؟" value={getEntryValue(slot, 'lessonTopic')} onChange={e=>handleInputChange(slot, 'lessonTopic', e.target.value)} />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-[10px] font-black text-slate-400 mr-2 flex items-center gap-2"><BookOpen size={14}/> الواجب المنزلي</label>
                                                        <input className={teacherInputClass} placeholder="أدخل تفاصيل الواجب..." value={getEntryValue(slot, 'homework')} onChange={e=>handleInputChange(slot, 'homework', e.target.value)} />
                                                    </div>
                                                </div>
                                                <div className="mt-8 flex justify-between items-center">
                                                    <div className="flex items-center gap-2 text-[10px] text-slate-300 font-bold"><CheckCircle size={14} className="text-emerald-400"/> حفظ تلقائي للبيانات</div>
                                                    <button onClick={() => { setSelectedClassForAttendance({ classId: slot.classId, className: cls?.name || '' }); setShowAttendanceModal(true); }} className="bg-emerald-50 text-emerald-700 px-6 py-3 rounded-2xl font-black text-sm border border-emerald-100 flex items-center gap-2 hover:bg-emerald-100 transition-all"><UserCheck size={18}/> رصد الغياب</button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        )}

        {activeTab === 'messages' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-4">
                    <h3 className="font-black text-xl mb-6 text-slate-800 flex items-center gap-3"><Bell className="text-emerald-600"/> الرسائل والتعميمات</h3>
                    {myMessages.length === 0 && <div className="p-20 text-center bg-white rounded-[2.5rem] border border-slate-100 text-slate-400 font-bold italic">لا توجد رسائل حالياً</div>}
                    {myMessages.map(m => (
                        <div key={m.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm relative group hover:border-emerald-200 transition-all">
                             <div className="flex justify-between items-center mb-3">
                                <span className={`text-[10px] font-black px-3 py-1 rounded-full ${m.senderId === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>{m.senderName}</span>
                                <span className="text-[10px] text-slate-400 font-mono">{m.timestamp}</span>
                             </div>
                             <p className="text-slate-700 font-bold text-sm leading-relaxed">{m.content}</p>
                        </div>
                    ))}
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm h-fit">
                    <h3 className="font-black text-lg mb-6">مراسلة الإدارة</h3>
                    <textarea className="w-full h-40 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white transition-all resize-none" placeholder="اكتب رسالتك للإدارة هنا..." value={newMessageText} onChange={e=>setNewMessageText(e.target.value)} />
                    <button onClick={handleSendToAdmin} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg mt-4 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"><Send size={20}/> إرسال </button>
                </div>
            </div>
        )}
      </main>

      {/* Attendance Modal */}
      {showAttendanceModal && selectedClassForAttendance && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-slideDown flex flex-col max-h-[90vh]">
                   <div className="bg-slate-900 text-white p-10 flex justify-between items-center shrink-0">
                       <div>
                           <h3 className="text-2xl font-black">رصد الغياب اليومي</h3>
                           <p className="text-slate-400 font-bold mt-1">{selectedClassForAttendance.className} | {new Date().toLocaleDateString('ar-SA')}</p>
                       </div>
                       <button onClick={() => setShowAttendanceModal(false)} className="bg-white/10 p-3 rounded-full hover:bg-rose-500 transition-all"><X size={24}/></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-10 space-y-4 bg-slate-50/50">
                       {students.filter(s => s.classId === selectedClassForAttendance.classId).map(student => {
                           const isAbsent = attendanceRecords.some(r => r.studentId === student.id && r.date === todayDate && r.status === 'absent');
                           return (
                               <div key={student.id} onClick={() => onMarkAttendance({ date: todayDate, studentId: student.id, status: isAbsent ? 'present' : 'absent', reportedBy: teacher.name, timestamp: new Date().toLocaleTimeString('ar-SA') })} className={`flex items-center justify-between p-5 rounded-[2rem] border-2 cursor-pointer transition-all ${isAbsent ? 'bg-rose-50 border-rose-200 shadow-inner' : 'bg-white border-slate-100 hover:border-emerald-300 shadow-sm'}`}>
                                   <div className="flex items-center gap-4">
                                       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl transition-colors ${isAbsent ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-400'}`}>{student.name.charAt(0)}</div>
                                       <div>
                                           <p className={`font-black ${isAbsent ? 'text-rose-900' : 'text-slate-800'}`}>{student.name}</p>
                                           <p className="text-[10px] text-slate-400 font-bold">{student.parentPhone}</p>
                                       </div>
                                   </div>
                                   {isAbsent ? <XCircle size={28} className="text-rose-500"/> : <CheckCircle size={28} className="text-slate-200 group-hover:text-emerald-500"/>}
                               </div>
                           );
                       })}
                       {students.filter(s => s.classId === selectedClassForAttendance.classId).length === 0 && <p className="text-center text-slate-400 py-10 font-bold italic">لا يوجد طلاب في هذا الفصل</p>}
                   </div>
                   <div className="p-10 border-t bg-white flex gap-4">
                       <button onClick={() => setShowAttendanceModal(false)} className="flex-1 bg-slate-900 text-white py-5 rounded-3xl font-black text-xl hover:bg-slate-800 transition-all shadow-xl shadow-slate-200">إغلاق وحفظ</button>
                   </div>
               </div>
          </div>
      )}
    </div>
  );
};

export default TeacherPortal;
