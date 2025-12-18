
import React, { useState, useMemo } from 'react';
import { PlanEntry, ScheduleSlot, Subject, Teacher, WeekInfo, Student, ClassGroup, AttendanceRecord, Message, SchoolSettings } from '../types';
import { DAYS_OF_WEEK } from '../services/data';
import { User, MessageSquare, Save, ChevronDown, ChevronUp, UserCheck, CheckCircle, XCircle, X, MessageCircle, Send, Bell, Calendar, BookOpen, PenTool, Printer, Sparkles, LayoutDashboard, Clock, History, LogOut } from 'lucide-react';

const teacherInputClass = "w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 focus:bg-white focus:border-emerald-400 outline-none transition-all";

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
  const [activeDay, setActiveDay] = useState<number | null>(new Date().getDay() === 5 || new Date().getDay() === 6 ? 0 : new Date().getDay());
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<{classId: string, className: string} | null>(null);
  const [newMessageText, setNewMessageText] = useState('');

  const teacherSchedule = useMemo(() => schedule.filter(s => s.teacherId === teacher.id), [schedule, teacher.id]);
  const todayDate = new Date().toISOString().split('T')[0];

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
      <header className="bg-emerald-600 text-white p-8 shadow-xl relative overflow-hidden no-print">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center relative z-10">
              <div className="flex items-center gap-5">
                  <div className="bg-white/10 p-4 rounded-3xl backdrop-blur-md border border-white/20">
                      <User size={32} className="text-white"/>
                  </div>
                  <div className="text-center md:text-right">
                      <h2 className="text-3xl font-black">أهلاً، {teacher.name}</h2>
                      <p className="text-emerald-100 font-bold">{schoolSettings.schoolName}</p>
                  </div>
              </div>
              <button onClick={() => window.location.reload()} className="p-4 bg-white/10 rounded-2xl hover:bg-white/20 border border-white/20 transition-all"><LogOut size={24}/></button>
          </div>
      </header>

      <nav className="max-w-5xl mx-auto px-6 -mt-8 relative z-20 no-print">
          <div className="bg-white p-2 rounded-3xl shadow-2xl flex border border-slate-100">
              <button onClick={() => setActiveTab('schedule')} className={`flex-1 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 ${activeTab === 'schedule' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}><Calendar size={18}/> الجدول</button>
              <button onClick={() => setActiveTab('messages')} className={`flex-1 py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 ${activeTab === 'messages' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}><MessageCircle size={18}/> الرسائل</button>
          </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10 animate-fadeIn">
        {activeTab === 'schedule' && (
            <div className="space-y-4">
                {DAYS_OF_WEEK.map((day, dIdx) => {
                    const daySlots = teacherSchedule.filter(s => s.dayIndex === dIdx).sort((a,b) => a.period - b.period);
                    if (daySlots.length === 0) return null;
                    const isOpen = activeDay === dIdx;

                    return (
                        <div key={day} className={`bg-white rounded-[2.5rem] border transition-all overflow-hidden ${isOpen ? 'shadow-xl border-emerald-100' : 'border-slate-100'}`}>
                            <button onClick={() => setActiveDay(isOpen ? null : dIdx)} className="w-full flex justify-between p-8 items-center bg-white hover:bg-slate-50">
                                <h3 className={`font-black text-xl ${isOpen ? 'text-emerald-900' : 'text-slate-800'}`}>{day}</h3>
                                {isOpen ? <ChevronUp className="text-emerald-600"/> : <ChevronDown className="text-slate-300"/>}
                            </button>
                            {isOpen && (
                                <div className="p-8 space-y-8 animate-slideDown">
                                    {daySlots.map(slot => {
                                        const cls = classes.find(c => c.id === slot.classId);
                                        const sub = subjects.find(s => s.id === slot.subjectId);
                                        return (
                                            <div key={slot.period} className="p-8 border-2 border-slate-50 rounded-[2.5rem] bg-white hover:border-emerald-200 transition-all">
                                                <div className="flex justify-between items-center mb-8 pb-4 border-b">
                                                    <div>
                                                        <h4 className="font-black text-2xl text-slate-800">{sub?.name}</h4>
                                                        <p className="text-xs font-bold text-slate-400">الفصل: {cls?.name}</p>
                                                    </div>
                                                    <span className="bg-slate-900 text-white px-5 py-2 rounded-xl text-xs font-black">الحصة {slot.period}</span>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                    <input className={teacherInputClass} placeholder="موضوع الدرس" value={getEntryValue(slot, 'lessonTopic')} onChange={e=>handleInputChange(slot, 'lessonTopic', e.target.value)} />
                                                    <input className={teacherInputClass} placeholder="الواجب المنزلي" value={getEntryValue(slot, 'homework')} onChange={e=>handleInputChange(slot, 'homework', e.target.value)} />
                                                </div>
                                                <div className="mt-8 flex justify-end">
                                                    <button onClick={() => { setSelectedClassForAttendance({ classId: slot.classId, className: cls?.name || '' }); setShowAttendanceModal(true); }} className="bg-emerald-50 text-emerald-700 px-6 py-3 rounded-2xl font-black text-sm flex items-center gap-2 hover:bg-emerald-100"><UserCheck size={18}/> رصد الغياب</button>
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
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                    <h3 className="font-black text-lg mb-6">مراسلة الإدارة</h3>
                    <textarea className="w-full h-40 bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-400 focus:bg-white resize-none" placeholder="اكتب رسالتك للإدارة هنا..." value={newMessageText} onChange={e=>setNewMessageText(e.target.value)} />
                    <button onClick={() => { if(!newMessageText) return; onSendMessage({ id: `msg_${Date.now()}`, senderId: teacher.id, senderName: teacher.name, receiverId: 'admin', content: newMessageText, timestamp: new Date().toLocaleTimeString('ar-SA'), isRead: false, type: 'direct' }); setNewMessageText(''); alert('تم الإرسال'); }} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-lg mt-4 flex items-center justify-center gap-2 hover:bg-slate-800 shadow-xl shadow-slate-200"><Send size={20}/> إرسال </button>
                </div>
            </div>
        )}
      </main>

      {showAttendanceModal && selectedClassForAttendance && (
          <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden animate-slideDown flex flex-col max-h-[90vh]">
                   <div className="bg-slate-900 text-white p-10 flex justify-between items-center shrink-0">
                       <h3 className="text-2xl font-black">{selectedClassForAttendance.className} - رصد الغياب</h3>
                       <button onClick={() => setShowAttendanceModal(false)} className="bg-white/10 p-3 rounded-full hover:bg-rose-500 transition-all"><X size={24}/></button>
                   </div>
                   <div className="flex-1 overflow-y-auto p-10 space-y-4">
                       {students.filter(s => s.classId === selectedClassForAttendance.classId).map(student => {
                           const isAbsent = attendanceRecords.some(r => r.studentId === student.id && r.date === todayDate && r.status === 'absent');
                           return (
                               <div key={student.id} onClick={() => onMarkAttendance({ date: todayDate, studentId: student.id, status: isAbsent ? 'present' : 'absent', reportedBy: teacher.name, timestamp: new Date().toLocaleTimeString('ar-SA') })} className={`flex items-center justify-between p-5 rounded-[2rem] border-2 cursor-pointer transition-all ${isAbsent ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-100 hover:border-emerald-300'}`}>
                                   <p className={`font-black ${isAbsent ? 'text-rose-900' : 'text-slate-800'}`}>{student.name}</p>
                                   {isAbsent ? <XCircle size={24} className="text-rose-500"/> : <CheckCircle size={24} className="text-slate-200"/>}
                               </div>
                           );
                       })}
                   </div>
                   <div className="p-10 border-t bg-white">
                       <button onClick={() => setShowAttendanceModal(false)} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-black text-xl">إغلاق</button>
                   </div>
               </div>
          </div>
      )}
    </div>
  );
};

export default TeacherPortal;
