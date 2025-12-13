import React, { useState } from 'react';
import { PlanEntry, ScheduleSlot, Subject, Teacher, WeekInfo, Student, ClassGroup, AttendanceRecord, Message, SchoolSettings } from '../types';
import { DAYS_OF_WEEK } from '../services/data';
import { Save, ChevronDown, ChevronUp, UserCheck, CheckCircle, XCircle, X, MessageCircle, Send, Bell, Calendar, BookOpen, PenTool, Printer } from 'lucide-react';
import AttendanceReportTemplate from './AttendanceReportTemplate';

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
  teacher,
  schedule,
  existingEntries,
  weekInfo,
  onSaveEntry,
  subjects,
  students,
  classes,
  attendanceRecords,
  onMarkAttendance,
  messages,
  onSendMessage,
  schoolSettings
}) => {
  const [activeDay, setActiveDay] = useState<number | null>(0);
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [showMessagesModal, setShowMessagesModal] = useState<boolean>(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<{classId: string, className: string} | null>(null);
  const [newMessageText, setNewMessageText] = useState('');
  const [msgTab, setMsgTab] = useState<'inbox' | 'compose'>('inbox');
  
  // State for Report Printing
  const [showReportPreview, setShowReportPreview] = useState(false);

  // Filter schedule for this teacher
  const teacherSchedule = schedule.filter(s => s.teacherId === teacher.id);
  const todayDate = new Date().toISOString().split('T')[0];

  // Messaging Logic
  const myMessages = messages.filter(m => m.receiverId === teacher.id || m.receiverId === 'all' || m.senderId === teacher.id);
  const unreadCount = messages.filter(m => (m.receiverId === teacher.id || m.receiverId === 'all') && !m.isRead).length; 

  const handleSendToAdmin = () => {
    if (!newMessageText.trim()) return;
    const msg: Message = {
        id: `msg_${Date.now()}`,
        senderId: teacher.id,
        senderName: teacher.name,
        receiverId: 'admin',
        content: newMessageText,
        timestamp: new Date().toLocaleTimeString('ar-SA', {hour: '2-digit', minute:'2-digit'}),
        isRead: false,
        type: 'direct'
    };
    onSendMessage(msg);
    setNewMessageText('');
    setMsgTab('inbox');
    alert('تم إرسال رسالتك للإدارة بنجاح');
  };

  const handleInputChange = (slot: ScheduleSlot, field: keyof PlanEntry, value: string) => {
    // Find existing or create new
    const existing = existingEntries.find(
      e => e.dayIndex === slot.dayIndex && e.period === slot.period && e.classId === slot.classId
    );

    const newEntry: PlanEntry = existing
      ? { ...existing, [field]: value }
      : {
          id: Date.now().toString(),
          classId: slot.classId,
          dayIndex: slot.dayIndex,
          period: slot.period,
          lessonTopic: '',
          homework: '',
          [field]: value
        };
    
    onSaveEntry(newEntry);
  };

  const getEntryValue = (slot: ScheduleSlot, field: keyof PlanEntry) => {
    const entry = existingEntries.find(
      e => e.dayIndex === slot.dayIndex && e.period === slot.period && e.classId === slot.classId
    );
    return entry ? (entry[field] as string) : '';
  };

  const openAttendance = (classId: string) => {
    const cls = classes.find(c => c.id === classId);
    setSelectedClassForAttendance({ classId, className: cls?.name || 'فصل غير معروف' });
    setShowAttendanceModal(true);
    setShowReportPreview(false); // Reset report view
  };

  const toggleAttendance = (studentId: string) => {
     const currentRecord = attendanceRecords.find(r => r.studentId === studentId && r.date === todayDate);
     const newStatus = currentRecord?.status === 'absent' ? 'present' : 'absent';
     
     onMarkAttendance({
         date: todayDate,
         studentId: studentId,
         status: newStatus,
         reportedBy: teacher.name,
         timestamp: new Date().toLocaleTimeString('ar-SA')
     });
  };

  const getAbsentStudents = () => {
      if (!selectedClassForAttendance) return [];
      return students.filter(s => 
          s.classId === selectedClassForAttendance.classId && 
          attendanceRecords.some(r => r.studentId === s.id && r.date === todayDate && r.status === 'absent')
      );
  };

  const handlePrintReport = () => {
      window.print();
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto pb-20 font-sans">
      {/* Header Card */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl shadow-xl p-8 mb-8 text-white relative overflow-hidden no-print">
        <div className="relative z-10 flex justify-between items-start">
            <div>
                <h2 className="text-3xl font-extrabold mb-1">بوابة المعلم</h2>
                <p className="text-emerald-100 font-medium text-lg">أهلاً بك، أستاذ {teacher.name}</p>
                <div className="mt-4 flex gap-3 text-sm font-bold bg-white/10 p-2 rounded-xl inline-flex backdrop-blur-sm border border-white/20">
                    <span className="flex items-center gap-2"><Calendar size={16}/> {weekInfo.weekNumber}</span>
                    <span className="w-px bg-white/30"></span>
                    <span>{weekInfo.startDate} - {weekInfo.endDate}</span>
                </div>
            </div>
            <button 
                onClick={() => setShowMessagesModal(true)}
                className="relative p-3 bg-white/20 hover:bg-white/30 rounded-2xl transition-all border border-white/20"
            >
                <MessageCircle size={28} className="text-white" />
                {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-xs w-6 h-6 flex items-center justify-center rounded-full border-2 border-emerald-600 font-bold shadow-sm">
                        {unreadCount}
                    </span>
                )}
            </button>
        </div>
        <BookOpen className="absolute -bottom-6 -left-6 text-white/10 w-48 h-48 rotate-12 pointer-events-none" />
      </div>

      <div className="space-y-4 no-print">
        {DAYS_OF_WEEK.map((day, dIndex) => {
          const daySlots = teacherSchedule.filter(s => s.dayIndex === dIndex).sort((a,b) => a.period - b.period);
          if (daySlots.length === 0) return null;

          const isOpen = activeDay === dIndex;

          return (
            <div key={dIndex} className={`bg-white border transition-all duration-300 overflow-hidden ${isOpen ? 'rounded-2xl shadow-lg border-emerald-100 ring-2 ring-emerald-50' : 'rounded-xl shadow-sm border-gray-100 hover:border-emerald-200'}`}>
              <button 
                onClick={() => setActiveDay(isOpen ? null : dIndex)}
                className={`w-full flex justify-between items-center p-5 transition-colors ${isOpen ? 'bg-emerald-50/50' : 'bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg shadow-sm ${isOpen ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'}`}>
                      {dIndex + 1}
                  </div>
                  <div className="text-right">
                      <span className={`font-bold text-lg block ${isOpen ? 'text-emerald-900' : 'text-gray-700'}`}>{day}</span>
                      <span className="text-xs text-gray-500 font-medium">
                        {daySlots.length} حصص دراسية
                      </span>
                  </div>
                </div>
                {isOpen ? <ChevronUp size={24} className="text-emerald-600" /> : <ChevronDown size={24} className="text-gray-400" />}
              </button>

              {isOpen && (
                <div className="p-5 space-y-6 animate-slideDown">
                  {daySlots.map((slot) => {
                     const subject = subjects.find(s => s.id === slot.subjectId);
                     const classObj = classes.find(c => c.id === slot.classId);
                     const bgColor = subject?.color.replace('text-', 'bg-opacity-20 bg-') || 'bg-gray-50';
                     const borderColor = subject?.color.replace('text-', 'border-') || 'border-gray-200';
                     
                     return (
                      <div key={slot.period} className="relative group">
                         {/* Card Content */}
                         <div className={`border rounded-2xl p-6 bg-white shadow-sm hover:shadow-md transition-all relative z-10`}>
                             <div className="flex justify-between items-start mb-6 border-b border-gray-100 pb-4">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-12 rounded-full ${subject?.color.replace('text-', 'bg-')}`}></div>
                                    <div>
                                        <h3 className="font-bold text-xl text-gray-800">{subject?.name}</h3>
                                        <p className="text-sm font-medium text-gray-500 flex items-center gap-1">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{classObj?.name}</span>
                                        </p>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-gray-100 to-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold shadow-inner">
                                    الحصة {slot.period}
                                </div>
                             </div>
                             
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <PenTool size={12}/> عنوان الدرس
                                    </label>
                                    <input 
                                      type="text" 
                                      className="teacher-input"
                                      placeholder="ما هو موضوع الدرس اليوم؟"
                                      value={getEntryValue(slot, 'lessonTopic')}
                                      onChange={(e) => handleInputChange(slot, 'lessonTopic', e.target.value)}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                        <BookOpen size={12}/> الواجب المنزلي
                                    </label>
                                    <input 
                                      type="text" 
                                      className="teacher-input"
                                      placeholder="تفاصيل الواجب..."
                                      value={getEntryValue(slot, 'homework')}
                                      onChange={(e) => handleInputChange(slot, 'homework', e.target.value)}
                                    />
                                </div>
                             </div>
                             <div className="mt-4 space-y-2">
                                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    ملاحظات إضافية
                                </label>
                                <input 
                                  type="text" 
                                  className="teacher-input"
                                  placeholder="أي ملاحظات للطالب أو ولي الأمر..."
                                  value={getEntryValue(slot, 'notes')}
                                  onChange={(e) => handleInputChange(slot, 'notes', e.target.value)}
                                />
                             </div>
                             
                             <div className="flex justify-between items-center pt-6 mt-2">
                                <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                                    <CheckCircle size={12}/> يتم الحفظ تلقائياً
                                </span>
                                <button 
                                    onClick={() => openAttendance(slot.classId)}
                                    className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 px-5 py-2.5 rounded-xl hover:bg-emerald-100 text-sm font-bold transition-all active:scale-95"
                                >
                                    <UserCheck size={18} />
                                    <span>رصد الغياب</span>
                                </button>
                             </div>
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

      {/* Attendance Modal */}
      {showAttendanceModal && selectedClassForAttendance && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-slideDown ${showReportPreview ? '' : 'max-w-lg'}`}>
                
                {/* Modal Header */}
                <div className="bg-slate-800 text-white p-5 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <UserCheck size={20} className="text-emerald-400"/>
                            {showReportPreview ? 'معاينة تقرير الغياب' : 'رصد الغياب'}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">{selectedClassForAttendance.className} | {new Date().toLocaleDateString('ar-SA')}</p>
                    </div>
                    <div className="flex gap-2">
                        {showReportPreview && (
                            <button onClick={handlePrintReport} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                                <Printer size={14}/> طباعة التقرير
                            </button>
                        )}
                        <button onClick={() => setShowAttendanceModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                            <X size={20}/>
                        </button>
                    </div>
                </div>
                
                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto bg-slate-50">
                    {showReportPreview ? (
                        <div className="p-8 flex justify-center">
                            <AttendanceReportTemplate 
                                schoolSettings={schoolSettings}
                                classGroup={{name: selectedClassForAttendance.className, id: selectedClassForAttendance.classId}}
                                teacherName={teacher.name}
                                date={todayDate}
                                absentStudents={getAbsentStudents()}
                            />
                        </div>
                    ) : (
                        <div className="p-4">
                            <div className="space-y-3">
                                {students.filter(s => s.classId === selectedClassForAttendance.classId).length === 0 ? (
                                    <div className="text-center py-12 flex flex-col items-center">
                                        <div className="bg-white p-4 rounded-full shadow-sm mb-3"><UserCheck size={32} className="text-slate-300"/></div>
                                        <p className="text-slate-500 font-bold">لا يوجد طلاب مسجلين في هذا الفصل</p>
                                    </div>
                                ) : (
                                    students.filter(s => s.classId === selectedClassForAttendance.classId).map(student => {
                                        const record = attendanceRecords.find(r => r.studentId === student.id && r.date === todayDate);
                                        const isAbsent = record?.status === 'absent';

                                        return (
                                            <div 
                                                key={student.id}
                                                onClick={() => toggleAttendance(student.id)}
                                                className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all shadow-sm group ${isAbsent ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200 hover:border-emerald-300'}`}
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-sm transition-colors ${isAbsent ? 'bg-rose-500' : 'bg-slate-200 text-slate-500 group-hover:bg-emerald-500 group-hover:text-white'}`}>
                                                        {student.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <p className={`font-bold transition-colors ${isAbsent ? 'text-rose-800' : 'text-slate-700'}`}>{student.name}</p>
                                                        <p className="text-xs text-slate-400">{student.parentPhone}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {isAbsent ? (
                                                        <span className="flex items-center gap-1 text-rose-600 bg-rose-100 px-3 py-1 rounded-lg font-bold text-xs">
                                                            <XCircle size={14}/> غائب
                                                        </span>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg font-bold text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <CheckCircle size={14}/> حاضر
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="p-4 border-t bg-white flex justify-between items-center">
                    {!showReportPreview ? (
                        <>
                           <button 
                                onClick={() => setShowReportPreview(true)}
                                className="text-slate-500 hover:text-indigo-600 font-bold text-sm flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                           >
                               <Printer size={18}/> معاينة كشف الغياب
                           </button>
                           <button 
                                onClick={() => setShowAttendanceModal(false)}
                                className="bg-slate-800 text-white px-8 py-3 rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg"
                           >
                               حفظ وإغلاق
                           </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => setShowReportPreview(false)}
                            className="text-slate-500 hover:text-slate-700 font-bold text-sm px-4 py-2"
                        >
                            عودة للقائمة
                        </button>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* Messaging Modal */}
      {showMessagesModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col h-[600px] animate-slideDown">
                  <div className="bg-indigo-600 text-white p-5 flex justify-between items-center">
                       <div>
                           <h3 className="font-bold text-lg flex items-center gap-2">
                              <MessageCircle size={20}/>
                              التواصل الداخلي
                           </h3>
                           <p className="text-indigo-200 text-xs">مع إدارة المدرسة</p>
                       </div>
                       <button onClick={() => setShowMessagesModal(false)} className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors">
                           <X size={20}/>
                       </button>
                  </div>
                  
                  <div className="flex border-b bg-indigo-50/50 p-1 mx-4 mt-4 rounded-xl">
                      <button 
                        onClick={() => setMsgTab('inbox')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${msgTab === 'inbox' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-indigo-600'}`}
                      >
                          الوارد
                      </button>
                      <button 
                        onClick={() => setMsgTab('compose')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${msgTab === 'compose' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-indigo-600'}`}
                      >
                          رسالة جديدة
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 bg-white">
                      {msgTab === 'inbox' ? (
                          <div className="space-y-3">
                              {myMessages.filter(m => m.senderId !== teacher.id).length === 0 ? (
                                  <div className="flex flex-col items-center justify-center h-64 text-center">
                                      <div className="bg-gray-50 p-4 rounded-full mb-3"><Bell size={32} className="text-gray-300"/></div>
                                      <p className="text-gray-400 font-bold">لا يوجد رسائل واردة</p>
                                  </div>
                              ) : (
                                  myMessages.filter(m => m.senderId !== teacher.id).map(msg => (
                                      <div key={msg.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100 relative group hover:shadow-md transition-shadow">
                                          <div className="flex justify-between items-start mb-2">
                                              <span className="font-bold text-indigo-700 text-sm flex items-center gap-1.5">
                                                  {msg.type === 'announcement' && <Bell size={14} className="text-amber-500" />}
                                                  {msg.senderName}
                                              </span>
                                              <span className="text-[10px] text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-100">{msg.timestamp}</span>
                                          </div>
                                          <p className="text-gray-700 text-sm leading-relaxed">{msg.content}</p>
                                      </div>
                                  ))
                              )}
                          </div>
                      ) : (
                          <div className="h-full flex flex-col">
                              <label className="block text-sm font-bold text-gray-700 mb-2">محتوى الرسالة:</label>
                              <div className="relative flex-1 mb-4">
                                  <textarea 
                                    className="w-full h-full border-2 border-gray-100 rounded-xl p-4 text-sm resize-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 outline-none transition-all bg-gray-50 focus:bg-white"
                                    placeholder="اكتب رسالتك للإدارة هنا..."
                                    value={newMessageText}
                                    onChange={(e) => setNewMessageText(e.target.value)}
                                  />
                              </div>
                              <button 
                                onClick={handleSendToAdmin}
                                className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                              >
                                  <Send size={18}/> إرسال الرسالة
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
      
      <style>{`
        .teacher-input {
            @apply w-full bg-gray-50 border-2 border-transparent rounded-xl px-4 py-3 text-sm font-medium text-gray-700 placeholder-gray-400 focus:bg-white focus:border-emerald-400 focus:ring-4 focus:ring-emerald-50 outline-none transition-all;
        }
      `}</style>

    </div>
  );
};

export default TeacherPortal;