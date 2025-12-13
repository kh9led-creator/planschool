import React from 'react';
import { ClassGroup, PlanEntry, ScheduleSlot, SchoolSettings, Subject, WeekInfo } from '../types';
import { DAYS_OF_WEEK } from '../services/data';
import { Image as ImageIcon, X } from 'lucide-react';

interface WeeklyPlanTemplateProps {
  classGroup: ClassGroup;
  weekInfo: WeekInfo;
  schedule: ScheduleSlot[];
  planEntries: PlanEntry[];
  schoolSettings?: SchoolSettings;
  subjects: Subject[];
  onUpdateSettings?: (settings: SchoolSettings) => void;
}

const WeeklyPlanTemplate: React.FC<WeeklyPlanTemplateProps> = ({
  classGroup,
  weekInfo,
  schedule,
  planEntries,
  schoolSettings,
  subjects,
  onUpdateSettings
}) => {
  const getSubject = (id: string) => subjects.find((s) => s.id === id);
  
  const getEntry = (dayIndex: number, period: number) => 
    planEntries.find(e => e.dayIndex === dayIndex && e.period === period);

  const getSlot = (dayIndex: number, period: number) => 
    schedule.find(s => s.dayIndex === dayIndex && s.period === period);

  // Defaults if schoolSettings not provided
  const settings = schoolSettings || {
    ministryName: 'المملكة العربية السعودية',
    authorityName: 'وزارة التعليم',
    directorateName: 'الإدارة العامة للتعليم',
    schoolName: 'المدرسة',
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Ministry_of_Education_%28Saudi_Arabia%29.svg/1200px-Ministry_of_Education_%28Saudi_Arabia%29.svg.png',
    footerNotesRight: '',
    footerNotesLeft: '',
    footerNotesLeftImage: ''
  };

  const handleFooterChange = (field: 'footerNotesLeft' | 'footerNotesRight', value: string) => {
    if (onUpdateSettings && schoolSettings) {
      onUpdateSettings({ ...schoolSettings, [field]: value });
    }
  };

  const handleNoteImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdateSettings && schoolSettings) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          onUpdateSettings({ ...schoolSettings, footerNotesLeftImage: reader.result });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveNoteImage = () => {
      if (onUpdateSettings && schoolSettings) {
          onUpdateSettings({ ...schoolSettings, footerNotesLeftImage: '' });
      }
  };

  return (
    // A4 Portrait Container: Approx 210mm width. Using tailwind arbitrary values for print precision.
    <div className="w-full bg-white text-black p-4 mx-auto print:p-0 print:w-[210mm] print:h-[297mm] print:mx-0 overflow-hidden relative flex flex-col justify-between">
      
      {/* Header - Compact for Portrait (12% Height) */}
      <div className="flex justify-between items-start border-b-2 border-black pb-2 h-[12%]">
        {/* Right Section */}
        <div className="text-right space-y-0.5 text-[10px] font-bold flex-1 pt-2">
          <p>{settings.ministryName}</p>
          <p>{settings.authorityName}</p>
          <p>{settings.directorateName}</p>
          <p>{settings.schoolName}</p>
        </div>
        
        {/* Center Section: Logo */}
        <div className="flex flex-col items-center justify-center flex-1">
            <img 
              src={settings.logoUrl}
              alt="Logo" 
              className="h-20 object-contain print:h-20"
            />
        </div>

        {/* Left Section */}
        <div className="text-left space-y-0.5 text-[10px] font-bold flex-1 pt-2 flex flex-col items-end">
           <div className="text-right" dir="rtl">
              <p>من: <span className="font-normal">{weekInfo.startDate}</span></p>
              <p>إلى: <span className="font-normal">{weekInfo.endDate}</span></p>
              <p>الأسبوع: <span className="font-normal">{weekInfo.weekNumber}</span></p>
              <p>الصف: <span className="font-normal">{classGroup.name}</span></p>
              <p className="text-[9px] text-gray-500 mt-0.5">{weekInfo.semester}</p>
           </div>
        </div>
      </div>

      {/* Main Table - Optimized for Portrait Width (68% Height) */}
      <div className="border-2 border-black flex-1 mt-2 h-[68%]">
        <table className="w-full h-full border-collapse text-center table-fixed">
          <thead>
            <tr className="bg-gray-100 text-[10px] print:text-[9px] h-[4%]">
              <th className="border border-black p-0.5 w-[5%] font-bold">اليوم</th>
              <th className="border border-black p-0.5 w-[5%] font-bold">م</th>
              <th className="border border-black p-0.5 w-[12%] font-bold">المادة</th>
              <th className="border border-black p-0.5 w-[35%] font-bold">الدرس المقرر</th>
              <th className="border border-black p-0.5 w-[25%] font-bold">الواجب</th>
              <th className="border border-black p-0.5 w-[18%] font-bold">ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {DAYS_OF_WEEK.map((day, dIndex) => {
              return Array.from({ length: 7 }, (_, i) => i + 1).map((period, pIndex) => {
                const slot = getSlot(dIndex, period);
                const entry = getEntry(dIndex, period);
                const subject = slot ? getSubject(slot.subjectId) : null;
                const isFirstPeriod = pIndex === 0;

                return (
                  <tr key={`${dIndex}-${period}`} className="text-[10px] print:text-[9px]">
                    {/* Day Column: Vertical Text to save space */}
                    {isFirstPeriod && (
                      <td 
                        className="border border-black bg-gray-50 font-bold align-middle" 
                        rowSpan={7}
                      >
                        <div className="flex items-center justify-center h-full w-full writing-vertical-rl transform rotate-180 print:rotate-0 print:writing-mode-vertical">
                           <span className="block whitespace-nowrap p-1">{day}</span>
                        </div>
                      </td>
                    )}
                    
                    {/* Period Number */}
                    <td className="border border-black font-bold bg-gray-50">{period}</td>
                    
                    {/* Subject */}
                    <td className={`border border-black font-semibold truncate px-1 ${subject?.color || 'bg-white'}`}>
                      {subject?.name || '-'}
                    </td>
                    
                    {/* Lesson Topic */}
                    <td className="border border-black text-right px-1 align-middle overflow-hidden">
                      <div className="line-clamp-1 leading-tight text-[9px]">
                        {entry?.lessonTopic || ''}
                      </div>
                    </td>
                    
                    {/* Homework */}
                    <td className="border border-black text-right px-1 align-middle overflow-hidden">
                       <div className="line-clamp-1 leading-tight text-[9px]">
                        {entry?.homework || ''}
                       </div>
                    </td>
                    
                    {/* Notes */}
                    <td className="border border-black text-right px-1 align-middle overflow-hidden">
                        <div className="line-clamp-1 leading-tight text-[8px]">
                            {entry?.notes || ''}
                        </div>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Notes - Side by Side (18% Height) */}
      <div className="mt-2 border-2 border-black flex h-[18%]">
        {/* Right Note (General) */}
        <div className="w-1/2 border-l-2 border-black p-1 flex flex-col">
          <h3 className="font-bold text-center mb-1 bg-gray-100 py-0.5 text-[10px]">رسائل عامة</h3>
          <textarea
            className={`w-full h-full text-right text-[10px] resize-none focus:outline-none bg-transparent p-1 leading-snug ${onUpdateSettings ? 'cursor-text' : 'cursor-default'}`}
            value={settings.footerNotesRight}
            onChange={(e) => handleFooterChange('footerNotesRight', e.target.value)}
            readOnly={!onUpdateSettings}
          />
        </div>
        
        {/* Left Note (School Specific/Image) */}
        <div className="w-1/2 p-1 flex flex-col relative group">
            <h3 className="font-bold text-center mb-1 bg-gray-100 py-0.5 text-[10px] flex items-center justify-center gap-2">
                ملاحظات المدرسة
                {onUpdateSettings && (
                     <label className="cursor-pointer print:hidden p-0.5 hover:bg-gray-200 rounded-full" title="رفع صورة">
                        <ImageIcon size={10} className="text-gray-500 hover:text-blue-600"/>
                        <input type="file" accept="image/*" className="hidden" onChange={handleNoteImageUpload}/>
                     </label>
                )}
            </h3>
            
            <div className="flex-1 flex flex-col justify-center items-center overflow-hidden">
                {/* Image Section */}
                {settings.footerNotesLeftImage ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                        <img 
                            src={settings.footerNotesLeftImage} 
                            alt="Note" 
                            className="max-h-full max-w-full object-contain"
                        />
                         {onUpdateSettings && (
                            <button 
                                onClick={handleRemoveNoteImage}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-0.5 print:hidden hover:bg-red-600 opacity-50 hover:opacity-100"
                                title="حذف الصورة"
                            >
                                <X size={10}/>
                            </button>
                        )}
                    </div>
                ) : (
                    <textarea
                        className={`w-full h-full text-right text-[10px] resize-none focus:outline-none bg-transparent p-1 leading-snug ${onUpdateSettings ? 'cursor-text' : 'cursor-default'}`}
                        placeholder="اكتب ملاحظاتك هنا..."
                        value={settings.footerNotesLeft}
                        onChange={(e) => handleFooterChange('footerNotesLeft', e.target.value)}
                        readOnly={!onUpdateSettings}
                    />
                )}
            </div>
        </div>
      </div>
      
      {/* Branding */}
      <div className="text-center text-[8px] text-gray-400 mt-0.5 print:mt-0">
        Madrasti Planner System
      </div>
    </div>
  );
};

export default WeeklyPlanTemplate;