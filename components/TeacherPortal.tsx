import React, { useState } from 'react';
import { PlanEntry, ScheduleSlot, Subject, Teacher, WeekInfo, Student, ClassGroup, AttendanceRecord, Message } from '../types';
import { DAYS_OF_WEEK } from '../services/data';
import { Save, ChevronDown, ChevronUp, UserCheck, CheckCircle, XCircle, X, MessageCircle, Send, Bell } from 'lucide-react';

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
  onSendMessage
}) => {
  const [activeDay, setActiveDay] = useState<number | null>(0);
  const [showAttendanceModal, setShowAttendanceModal] = useState<boolean>(false);
  const [showMessagesModal, setShowMessagesModal] = useState<boolean>(false);
  const [selectedClassForAttendance, setSelectedClassForAttendance] = useState<{classId: string, className: string} | null>(null);
  const [newMessageText, setNewMessageText] = useState('');
  const [msgTab, setMsgTab] = useState<'inbox' | 'compose'>('inbox');

  // Filter schedule for this teacher
  const teacherSchedule = schedule.filter(s => s.teacherId === teacher.id);
  const todayDate = new Date().toISOString().split('T')[0];

  // Messaging Logic
  const myMessages = messages.filter(m => m.receiverId === teacher.id || m.receiverId === 'all' || m.senderId === teacher.id);
  const unreadCount = messages.filter(m => (m.receiverId === teacher.id || m.receiverId === 'all') && !m.isRead).length; // Simplified read logic

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

  return (
    <div className="p-4 max-w-4xl mx-auto pb-20">
      {/* Header Card with Messaging Icon */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6 flex justify-between items-start">
        <div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">بوابة المعلم</h2>
            <p className="text-gray-600">مرحباً, {teacher.name}</p>
            <p className="text-sm text-green-600 font-semibold mt-1">
            {weekInfo.weekNumber} | {weekInfo.startDate} - {weekInfo.endDate}
            </p>
        </div>
        <button 
            onClick={() => setShowMessagesModal(true)}
            className="relative p-3 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
        >
            <MessageCircle size={24} />
            {unreadCount > 0 && (
                <span className="absolute top-0 right-0 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full border-2 border-white">
                    {unreadCount}
                </span>
            )}
        </button>
      </div>

      <div className="space-y-4">
        {DAYS_OF_WEEK.map((day, dIndex) => {
          const daySlots = teacherSchedule.filter(s => s.dayIndex === dIndex).sort((a,b) => a.period - b.period);
          if (daySlots.length === 0) return null;

          const isOpen = activeDay === dIndex;

          return (
            <div key={dIndex} className="bg-white border rounded-lg overflow-hidden shadow-sm">
              <button 
                onClick={() => setActiveDay(isOpen ? null : dIndex)}
                className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg text-gray-700">{day}</span>
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                    {daySlots.length} حصص
                  </span>
                </div>
                {isOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              {isOpen && (
                <div className="p-4 space-y-4 animate-fadeIn">
                  {daySlots.map((slot) => {
                     const subject = subjects.find(s => s.id === slot.subjectId);
                     const classObj = classes.find(c => c.id === slot.classId);
                     
                     return (
                      <div key={slot.period} className="border rounded-md p-4 bg-white relative">
                         <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-2 mt-2">
                                <div className={`w-3 h-3 rounded-full ${subject?.color.replace('bg-', 'bg-')}-400`}></div>
                                <div>
                                    <span className="font-bold block text-lg">{subject?.name}</span>
                                    <span className="text-sm text-gray-500">{classObj?.name}</span>
                                </div>
                            </div>
                            <div className="bg-gray-200 px-2 py-1 rounded text-xs font-bold">
                                الحصة {slot.period}
                            </div>
                         </div>
                         
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">عنوان الدرس</label>
                                <input 
                                  type="text" 
                                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 border p-2 text-sm"
                                  placeholder="أدخل عنوان الدرس..."
                                  value={getEntryValue(slot, 'lessonTopic')}
                                  onChange={(e) => handleInputChange(slot, 'lessonTopic', e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">الواجب المنزلي</label>
                                <input 
                                  type="text" 
                                  className="w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 border p-2 text-sm"
                                  placeholder="أدخل الواجب..."
                                  value={getEntryValue(slot, 'homework')}
                                  onChange={(e) => handleInputChange(slot, 'homework', e.target.value)}
                                />
                            </div>
                         </div>
                         <div className="mt-3">
                            <label className="block text-xs font-medium text-gray-700 mb-1">ملاحظات (اختياري)</label>
                            <input 
                              type="text" 
                              className="w-full border-gray-300 rounded-md shadow-sm focus:ring-green-500 focus:border-green-500 border p-2 text-sm"
                              placeholder="ملاحظات..."
                              value={getEntryValue(slot, 'notes')}
                              onChange={(e) => handleInputChange(slot, 'notes', e.target.value)}
                            />
                         </div>
                         
                         <div className="flex justify-end gap-2 pt-4 border-t mt-4">
                            <button 
                                onClick={() => openAttendance(slot.classId)}
                                className="flex items-center gap-2 bg-indigo-50 text-indigo-700 border border-indigo-200 px-4 py-2 rounded-md hover:bg-indigo-100 text-sm transition-colors"
                            >
                                <UserCheck size={16} />
                                <span>رصد الغياب</span>
                            </button>
                            <button className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 text-sm">
                                <Save size={16} />
                                <span>حفظ التغييرات</span>
                            </button>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                <div className="bg-indigo-600 text-white p-4 flex justify-between items-center">
                    <h3 className="font-bold flex items-center gap-2">
                        <UserCheck size={20}/>
                        رصد الغياب: {selectedClassForAttendance.className}
                    </h3>
                    <button onClick={() => setShowAttendanceModal(false)} className="text-white hover:bg-indigo-700 p-1 rounded">
                        <X size={24}/>
                    </button>
                </div>
                
                <div className="p-4 overflow-y-auto flex-1">
                    <p className="text-sm text-gray-500 mb-4 text-center">اضغط على الطالب لتغيير الحالة (أخضر = حاضر، أحمر = غائب)</p>
                    
                    <div className="space-y-2">
                        {students.filter(s => s.classId === selectedClassForAttendance.classId).length === 0 ? (
                            <div className="text-center py-8 text-gray-400">لا يوجد طلاب مسجلين في هذا الفصل</div>
                        ) : (
                            students.filter(s => s.classId === selectedClassForAttendance.classId).map(student => {
                                const record = attendanceRecords.find(r => r.studentId === student.id && r.date === todayDate);
                                const isAbsent = record?.status === 'absent';

                                return (
                                    <div 
                                        key={student.id}
                                        onClick={() => toggleAttendance(student.id)}
                                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${isAbsent ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-300'}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold ${isAbsent ? 'bg-red-500' : 'bg-green-500'}`}>
                                                {student.name.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800">{student.name}</p>
                                                <p className="text-xs text-gray-500">{student.parentPhone}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {isAbsent ? (
                                                <span className="flex items-center gap-1 text-red-700 font-bold text-sm">
                                                    <XCircle size={16}/> غائب
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-green-700 font-bold text-sm">
                                                    <CheckCircle size={16}/> حاضر
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button 
                        onClick={() => setShowAttendanceModal(false)}
                        className="bg-indigo-600 text-white px-6 py-2 rounded font-bold hover:bg-indigo-700"
                    >
                        تم
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Messaging Modal */}
      {showMessagesModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-lg w-full max-w-md shadow-2xl overflow-hidden flex flex-col h-[500px]">
                  <div className="bg-blue-600 text-white p-4 flex justify-between items-center">
                       <h3 className="font-bold flex items-center gap-2">
                          <MessageCircle size={20}/>
                          التواصل الداخلي
                       </h3>
                       <button onClick={() => setShowMessagesModal(false)} className="text-white hover:bg-blue-700 p-1 rounded">
                           <X size={24}/>
                       </button>
                  </div>
                  
                  <div className="flex border-b">
                      <button 
                        onClick={() => setMsgTab('inbox')}
                        className={`flex-1 p-3 text-sm font-bold ${msgTab === 'inbox' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                          الوارد
                      </button>
                      <button 
                        onClick={() => setMsgTab('compose')}
                        className={`flex-1 p-3 text-sm font-bold ${msgTab === 'compose' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50' : 'text-gray-500 hover:bg-gray-50'}`}
                      >
                          مراسلة الإدارة
                      </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                      {msgTab === 'inbox' ? (
                          <div className="space-y-3">
                              {myMessages.filter(m => m.senderId !== teacher.id).length === 0 ? (
                                  <div className="text-center text-gray-400 mt-10">لا يوجد رسائل واردة</div>
                              ) : (
                                  myMessages.filter(m => m.senderId !== teacher.id).map(msg => (
                                      <div key={msg.id} className="bg-white p-3 rounded-lg shadow-sm border border-gray-200">
                                          <div className="flex justify-between items-start mb-1">
                                              <span className="font-bold text-blue-800 text-sm flex items-center gap-1">
                                                  {msg.type === 'announcement' && <Bell size={12} />}
                                                  {msg.senderName}
                                              </span>
                                              <span className="text-xs text-gray-400">{msg.timestamp}</span>
                                          </div>
                                          <p className="text-gray-700 text-sm whitespace-pre-wrap">{msg.content}</p>
                                      </div>
                                  ))
                              )}
                          </div>
                      ) : (
                          <div className="h-full flex flex-col">
                              <label className="block text-sm font-bold text-gray-700 mb-2">نص الرسالة للمدير:</label>
                              <textarea 
                                className="flex-1 w-full border rounded-lg p-3 text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="اكتب رسالتك أو طلبك هنا..."
                                value={newMessageText}
                                onChange={(e) => setNewMessageText(e.target.value)}
                              />
                              <button 
                                onClick={handleSendToAdmin}
                                className="mt-4 w-full bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 flex items-center justify-center gap-2"
                              >
                                  <Send size={16}/> إرسال
                              </button>
                              
                              <div className="mt-4 pt-4 border-t">
                                  <h4 className="text-xs font-bold text-gray-500 mb-2">رسائلي المرسلة:</h4>
                                  <div className="space-y-2 max-h-[150px] overflow-y-auto">
                                      {myMessages.filter(m => m.senderId === teacher.id).map(msg => (
                                          <div key={msg.id} className="bg-blue-50 p-2 rounded border border-blue-100 text-xs">
                                              <p className="text-gray-700">{msg.content}</p>
                                              <span className="text-gray-400 block text-[10px] mt-1 text-left">{msg.timestamp}</span>
                                          </div>
                                      ))}
                                  </div>
                              </div>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default TeacherPortal;