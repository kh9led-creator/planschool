import React, { useState } from 'react';
import { ClassGroup, PlanEntry, ScheduleSlot, SchoolSettings, Student, Subject, WeekInfo } from '../types';
import WeeklyPlanTemplate from './WeeklyPlanTemplate';
import { Search, User, X, BookOpen, Calendar, Download, School as SchoolIcon } from 'lucide-react';

interface PublicClassPlansViewProps {
  schoolSettings: SchoolSettings;
  classGroup: ClassGroup;
  students: Student[];
  weekInfo: WeekInfo;
  schedule: ScheduleSlot[];
  planEntries: PlanEntry[];
  subjects: Subject[];
}

const PublicClassPlansView: React.FC<PublicClassPlansViewProps> = ({
  schoolSettings,
  classGroup,
  students,
  weekInfo,
  schedule,
  planEntries,
  subjects
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  const filteredStudents = students.filter(s => 
    s.name.includes(searchTerm) || s.parentPhone.includes(searchTerm)
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      
      {/* Header */}
      <div className="bg-slate-900 text-white pb-12 pt-8 px-4 shadow-lg">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-right">
            <div className="flex items-center gap-4">
                <div className="bg-white p-2 rounded-xl h-20 w-20 flex items-center justify-center overflow-hidden">
                    {schoolSettings.logoUrl ? (
                        <img src={schoolSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                        <SchoolIcon className="text-slate-900" size={40} />
                    )}
                </div>
                <div>
                    <h1 className="text-2xl font-bold">{schoolSettings.schoolName}</h1>
                    <p className="text-slate-400 text-sm mt-1">بوابة الخطط الأسبوعية</p>
                </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl flex flex-col items-center min-w-[200px]">
                <span className="text-slate-300 text-xs font-bold uppercase mb-1">الفصل الدراسي</span>
                <span className="text-xl font-bold text-white">{classGroup.name}</span>
                <span className="text-emerald-400 text-xs mt-1">{weekInfo.weekNumber}</span>
            </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-8">
        
        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl shadow-lg border border-slate-100 flex items-center gap-3 mb-8">
            <Search className="text-slate-400" size={20} />
            <input 
                type="text" 
                placeholder="ابحث باسم الطالب..." 
                className="flex-1 outline-none text-slate-700 font-bold"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        {/* Students Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-20">
            {filteredStudents.length === 0 ? (
                <div className="col-span-full text-center py-20 opacity-50">
                    <User size={48} className="mx-auto mb-2"/>
                    <p>لا يوجد طلاب مطابقين</p>
                </div>
            ) : (
                filteredStudents.map(student => (
                    <button 
                        key={student.id}
                        onClick={() => setSelectedStudent(student)}
                        className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:border-indigo-300 hover:-translate-y-1 transition-all group text-right"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="bg-slate-100 group-hover:bg-indigo-100 group-hover:text-indigo-600 text-slate-500 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
                                <User size={20} />
                            </div>
                            <BookOpen size={16} className="text-slate-300 group-hover:text-indigo-400" />
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg mb-1 line-clamp-1">{student.name}</h3>
                        <p className="text-xs text-slate-400">عرض الخطة الأسبوعية</p>
                    </button>
                ))
            )}
        </div>
      </div>

      {/* Plan Modal */}
      {selectedStudent && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-0 md:p-4 overflow-hidden">
              <div className="bg-slate-100 w-full md:max-w-5xl h-full md:h-[95vh] md:rounded-2xl flex flex-col shadow-2xl animate-slideDown overflow-hidden relative">
                  
                  {/* Modal Header */}
                  <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0 z-10 shadow-md">
                      <div>
                          <h3 className="font-bold text-lg flex items-center gap-2">
                              <Calendar size={18} className="text-emerald-400"/>
                              خطة الطالب: {selectedStudent.name}
                          </h3>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                              <Download size={16}/> تحميل / طباعة
                          </button>
                          <button onClick={() => setSelectedStudent(null)} className="bg-rose-500 hover:bg-rose-600 p-2 rounded-full transition-colors">
                              <X size={20}/>
                          </button>
                      </div>
                  </div>

                  {/* Plan Content */}
                  <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-slate-200">
                      <div className="origin-top scale-[0.6] sm:scale-[0.7] md:scale-90 lg:scale-100 transition-transform">
                        <WeeklyPlanTemplate 
                            classGroup={classGroup}
                            weekInfo={weekInfo}
                            schedule={schedule.filter(s => s.classId === classGroup.id)}
                            planEntries={planEntries.filter(e => e.classId === classGroup.id)}
                            schoolSettings={schoolSettings}
                            subjects={subjects}
                            studentName={selectedStudent.name}
                        />
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default PublicClassPlansView;