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
    <div className="w-full bg-white text-black p-4 md:p-8 max-w-[1200px] mx-auto print:p-0 print:max-w-none print:w-full">
      {/* Header */}
      <div className="flex justify-between items-center border-b-2 border-black pb-4 mb-2">
        {/* Right Section: Ministry Info */}
        <div className="text-right space-y-1 text-sm font-bold flex-1">
          <p>{settings.ministryName}</p>
          <p>{settings.authorityName}</p>
          <p>{settings.directorateName}</p>
          <p>{settings.schoolName}</p>
        </div>
        
        {/* Center Section: Logo */}
        <div className="flex flex-col items-center justify-center flex-1">
            <img 
              src={settings.logoUrl}
              alt="Ministry of Education Logo" 
              className="h-28 object-contain"
            />
        </div>

        {/* Left Section: Week & Class Info */}
        <div className="text-left space-y-1 text-sm font-bold flex-1">
           <div className="inline-block text-right" dir="rtl">
              <p>من: {weekInfo.startDate} إلى {weekInfo.endDate}</p>
              <p>الأسبوع ( {weekInfo.weekNumber} )</p>
              <p>الصف: {classGroup.name}</p>
              <p className="text-xs mt-1 text-gray-500">{weekInfo.semester}</p>
           </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="border-2 border-black">
        <table className="w-full border-collapse text-center text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-1 w-[8%] font-bold">اليوم</th>
              <th className="border border-black p-1 w-[5%] font-bold">الحصة</th>
              <th className="border border-black p-1 w-[12%] font-bold">المادة</th>
              <th className="border border-black p-1 w-[35%] font-bold">الدرس المقرر</th>
              <th className="border border-black p-1 w-[25%] font-bold">الواجب</th>
              <th className="border border-black p-1 w-[15%] font-bold">الملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {DAYS_OF_WEEK.map((day, dIndex) => {
              // We render 7 periods per day
              return Array.from({ length: 7 }, (_, i) => i + 1).map((period, pIndex) => {
                const slot = getSlot(dIndex, period);
                const entry = getEntry(dIndex, period);
                const subject = slot ? getSubject(slot.subjectId) : null;
                const isFirstPeriod = pIndex === 0;

                return (
                  <tr key={`${dIndex}-${period}`} className="h-10">
                    {/* Day Column: Only render on first period with rowspan 7 */}
                    {isFirstPeriod && (
                      <td 
                        className="border border-black bg-gray-50 font-bold align-middle transform -rotate-90 md:rotate-0 print:rotate-0" 
                        rowSpan={7}
                      >
                        <div className="flex items-center justify-center h-full w-full">
                           {day}
                        </div>
                      </td>
                    )}
                    
                    {/* Period Number */}
                    <td className="border border-black font-bold bg-gray-50">{period}</td>
                    
                    {/* Subject */}
                    <td className={`border border-black font-semibold ${subject?.color || 'bg-white'}`}>
                      {subject?.name || '-'}
                    </td>
                    
                    {/* Lesson Topic */}
                    <td className="border border-black text-right pr-2">
                      {entry?.lessonTopic || ''}
                    </td>
                    
                    {/* Homework */}
                    <td className="border border-black text-right pr-2 text-xs md:text-sm">
                       {entry?.homework || ''}
                    </td>
                    
                    {/* Notes */}
                    <td className="border border-black text-right pr-2 text-xs">
                        {entry?.notes || ''}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* Footer Notes */}
      <div className="mt-1 border-2 border-black flex">
        <div className="w-1/2 border-l-2 border-black p-2 flex flex-col">
          <h3 className="font-bold text-center mb-2 bg-gray-100 py-1">ملاحظات أخرى</h3>
          <textarea
            className={`w-full h-full text-right text-sm resize-none focus:outline-none bg-transparent ${onUpdateSettings ? 'cursor-text' : 'cursor-default'}`}
            value={settings.footerNotesRight}
            onChange={(e) => handleFooterChange('footerNotesRight', e.target.value)}
            readOnly={!onUpdateSettings}
            rows={5}
            style={{ minHeight: '100px', whiteSpace: 'pre-wrap' }}
          />
        </div>
        
        {/* Left Notes with Image Support */}
        <div className="w-1/2 p-2 flex flex-col relative group">
            <h3 className="font-bold text-center mb-2 bg-gray-100 py-1 flex items-center justify-center gap-2">
                الملاحظات
                {onUpdateSettings && (
                     <label className="cursor-pointer print:hidden p-1 hover:bg-gray-200 rounded-full" title="رفع صورة">
                        <ImageIcon size={14} className="text-gray-500 hover:text-blue-600"/>
                        <input type="file" accept="image/*" className="hidden" onChange={handleNoteImageUpload}/>
                     </label>
                )}
            </h3>
            
            <div className="flex-1 flex flex-col">
                {/* Image Section */}
                {settings.footerNotesLeftImage && (
                    <div className="relative mb-2 w-full flex justify-center bg-gray-50 border border-dashed border-gray-300 rounded p-1">
                        <img 
                            src={settings.footerNotesLeftImage} 
                            alt="Note" 
                            className="max-h-24 object-contain"
                        />
                         {onUpdateSettings && (
                            <button 
                                onClick={handleRemoveNoteImage}
                                className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-0.5 print:hidden hover:bg-red-600"
                                title="حذف الصورة"
                            >
                                <X size={12}/>
                            </button>
                        )}
                    </div>
                )}

                {/* Text Section */}
                <textarea
                className={`w-full text-right text-sm resize-none focus:outline-none bg-transparent flex-1 ${onUpdateSettings ? 'cursor-text' : 'cursor-default'}`}
                placeholder={settings.footerNotesLeftImage ? "نص إضافي..." : "اكتب ملاحظاتك هنا..."}
                value={settings.footerNotesLeft}
                onChange={(e) => handleFooterChange('footerNotesLeft', e.target.value)}
                readOnly={!onUpdateSettings}
                style={{ minHeight: settings.footerNotesLeftImage ? '60px' : '100px', whiteSpace: 'pre-wrap' }}
                />
            </div>
        </div>
      </div>
      
      {/* Footer Branding/Copyright if needed */}
      <div className="mt-4 text-center text-xs text-gray-400 print:hidden">
        تم إنشاء هذا التقرير عبر نظام الخطط الذكية
      </div>
    </div>
  );
};

export default WeeklyPlanTemplate;