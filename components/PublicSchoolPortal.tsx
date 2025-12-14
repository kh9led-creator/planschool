import React, { useState } from 'react';
import { ClassGroup, PlanEntry, ScheduleSlot, SchoolSettings, Subject, WeekInfo } from '../types';
import WeeklyPlanTemplate from './WeeklyPlanTemplate';
import { Search, Printer, FileText, Grid, School as SchoolIcon, X, Download, LayoutGrid } from 'lucide-react';

interface PublicSchoolPortalProps {
  schoolSettings: SchoolSettings;
  classes: ClassGroup[];
  weekInfo: WeekInfo;
  schedule: ScheduleSlot[];
  planEntries: PlanEntry[];
  subjects: Subject[];
}

const PublicSchoolPortal: React.FC<PublicSchoolPortalProps> = ({
  schoolSettings,
  classes,
  weekInfo,
  schedule,
  planEntries,
  subjects
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'print_all'>('grid');
  const [selectedClass, setSelectedClass] = useState<ClassGroup | null>(null);

  const filteredClasses = classes.filter(c => 
    c.name.includes(searchTerm) || c.grade.includes(searchTerm)
  );

  // If Print All Mode is active, we render a clean list of all templates
  if (viewMode === 'print_all') {
    return (
      <div className="bg-gray-200 min-h-screen">
        <div className="fixed top-0 left-0 right-0 bg-slate-900 text-white p-4 flex justify-between items-center z-50 no-print shadow-lg">
            <div>
                <h2 className="font-bold text-lg">وضع الطباعة الشامل (PDF)</h2>
                <p className="text-xs text-slate-400">سيتم طباعة {filteredClasses.length} خطة دراسية</p>
            </div>
            <div className="flex gap-3">
                <button onClick={() => window.print()} className="bg-emerald-500 hover:bg-emerald-600 px-6 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
                    <Printer size={18}/> طباعة / حفظ كـ PDF
                </button>
                <button onClick={() => setViewMode('grid')} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
                    <X size={18}/> إلغاء
                </button>
            </div>
        </div>
        
        <div className="pt-24 pb-10 flex flex-col items-center gap-8 print:pt-0 print:pb-0 print:block">
            {filteredClasses.map((cls, index) => (
                <div key={cls.id} className="print:break-after-page page-container shadow-2xl print:shadow-none mb-8 print:mb-0">
                    <WeeklyPlanTemplate 
                        classGroup={cls}
                        weekInfo={weekInfo}
                        schedule={schedule.filter(s => s.classId === cls.id)}
                        planEntries={planEntries.filter(e => e.classId === cls.id)}
                        schoolSettings={schoolSettings}
                        subjects={subjects}
                    />
                </div>
            ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white pb-16 pt-8 px-4 shadow-xl no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-5">
                <div className="bg-white p-2 rounded-2xl h-24 w-24 flex items-center justify-center overflow-hidden shadow-lg">
                    {schoolSettings.logoUrl ? (
                        <img src={schoolSettings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                    ) : (
                        <SchoolIcon className="text-slate-900" size={48} />
                    )}
                </div>
                <div className="text-center md:text-right">
                    <h1 className="text-3xl font-extrabold mb-1">{schoolSettings.schoolName}</h1>
                    <p className="text-slate-400 font-medium">بوابة الخطط الأسبوعية العامة</p>
                </div>
            </div>
            
            <div className="bg-white/10 backdrop-blur-md border border-white/20 px-6 py-4 rounded-2xl flex flex-col items-center min-w-[200px]">
                <span className="text-slate-300 text-xs font-bold uppercase mb-1 flex items-center gap-2"><LayoutGrid size={14}/> العام الدراسي</span>
                <span className="text-emerald-400 font-bold text-lg">{weekInfo.weekNumber}</span>
                <span className="text-white/80 text-xs mt-1">{weekInfo.startDate} - {weekInfo.endDate}</span>
            </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 -mt-8 no-print">
        
        {/* Controls Bar */}
        <div className="bg-white p-4 rounded-2xl shadow-lg border border-slate-100 flex flex-col md:flex-row items-center gap-4 mb-8">
            <div className="relative flex-1 w-full">
                <input 
                    type="text" 
                    placeholder="ابحث عن اسم الفصل أو الصف..." 
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-12 py-3.5 text-slate-700 font-bold outline-none focus:border-indigo-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <Search className="absolute right-4 top-4 text-slate-400" size={20} />
            </div>
            <button 
                onClick={() => setViewMode('print_all')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 w-full md:w-auto justify-center"
            >
                <Download size={20}/> تحميل جميع الخطط (PDF)
            </button>
        </div>

        {/* Classes Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 pb-20">
            {filteredClasses.length === 0 ? (
                <div className="col-span-full text-center py-24 opacity-50 bg-white rounded-3xl border border-dashed border-slate-200">
                    <Grid size={48} className="mx-auto mb-4 text-slate-300"/>
                    <p className="font-bold text-lg text-slate-400">لا يوجد فصول مطابقة للبحث</p>
                </div>
            ) : (
                filteredClasses.map(cls => (
                    <button 
                        key={cls.id}
                        onClick={() => setSelectedClass(cls)}
                        className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-xl hover:border-indigo-300 hover:-translate-y-1 transition-all group text-right flex flex-col h-full"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-slate-50 group-hover:bg-indigo-50 group-hover:text-indigo-600 text-slate-400 w-12 h-12 rounded-2xl flex items-center justify-center transition-colors">
                                <FileText size={24} />
                            </div>
                            <div className="bg-slate-50 px-3 py-1 rounded-full text-[10px] font-bold text-slate-500 group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                عرض الخطة
                            </div>
                        </div>
                        <h3 className="font-bold text-slate-800 text-xl mb-1 group-hover:text-indigo-700 transition-colors">{cls.name}</h3>
                        <p className="text-sm text-slate-400">{cls.grade}</p>
                    </button>
                ))
            )}
        </div>
      </div>

      {/* Single Class Modal */}
      {selectedClass && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center p-0 md:p-4 overflow-hidden">
              <div className="bg-slate-200 w-full md:max-w-5xl h-full md:h-[95vh] md:rounded-2xl flex flex-col shadow-2xl animate-slideDown overflow-hidden relative">
                  
                  {/* Modal Header */}
                  <div className="bg-slate-900 text-white p-4 flex justify-between items-center shrink-0 z-10 shadow-md no-print">
                      <div>
                          <h3 className="font-bold text-lg flex items-center gap-2">
                              <FileText size={18} className="text-emerald-400"/>
                              الخطة الأسبوعية: {selectedClass.name}
                          </h3>
                      </div>
                      <div className="flex gap-3">
                          <button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-2">
                              <Printer size={16}/> طباعة
                          </button>
                          <button onClick={() => setSelectedClass(null)} className="bg-rose-500 hover:bg-rose-600 p-2 rounded-full transition-colors">
                              <X size={20}/>
                          </button>
                      </div>
                  </div>

                  {/* Plan Content */}
                  <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-slate-200 print:bg-white print:overflow-visible">
                      <div className="origin-top scale-[0.6] sm:scale-[0.7] md:scale-90 lg:scale-100 transition-transform page-container bg-white shadow-2xl">
                        <WeeklyPlanTemplate 
                            classGroup={selectedClass}
                            weekInfo={weekInfo}
                            schedule={schedule.filter(s => s.classId === selectedClass.id)}
                            planEntries={planEntries.filter(e => e.classId === selectedClass.id)}
                            schoolSettings={schoolSettings}
                            subjects={subjects}
                        />
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default PublicSchoolPortal;