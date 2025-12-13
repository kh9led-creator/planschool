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
    // STRICT A4 PORTRAIT CONTAINER
    // Width: 210mm, Height: 297mm. 
    // Flex-col to distribute height precisely.
    <div className="bg-white text-black mx-auto overflow-hidden relative flex flex-col justify-between"
         style={{ width: '210mm', height: '297mm', padding: '5mm' }}>
      
      {/* 1. HEADER SECTION (Approx 10% height) */}
      <div className="flex justify-between items-start border-b-2 border-black pb-1 mb-1 h-[10%] shrink-0">
        {/* Right Section */}
        <div className="text-right space-y-0.5 text-[10px] font-bold flex-1 pt-1">
          <p>{settings.ministryName}</p>
          <p>{settings.authorityName}</p>
          <p>{settings.directorateName}</p>
          <p>{settings.schoolName}</p>
        </div>
        
        {/* Center Section: Logo */}
        <div className="flex flex-col items-center justify-center flex-1 h-full">
            <img 
              src={settings.logoUrl}
              alt="Logo" 
              className="h-full max-h-[22mm] object-contain"
            />
        </div>

        {/* Left Section */}
        <div className="text-left space-y-0.5 text-[10px] font-bold flex-1 pt-1 flex flex-col items-end">
           <div className="text-right" dir="rtl">
              <p>من: <span className="font-normal">{weekInfo.startDate}</span></p>
              <p>إلى: <span className="font-normal">{weekInfo.endDate}</span></p>
              <p>الأسبوع: <span className="font-normal">{weekInfo.weekNumber}</span></p>
              <p>الصف: <span className="font-normal">{classGroup.name}</span></p>
              <p className="text-[9px] text-gray-500 mt-0.5">{weekInfo.semester}</p>
           </div>
        </div>
      </div>

      {/* 2. MAIN TABLE SECTION (Approx 72% height) */}
      <div className="border-2 border-black flex-1 mb-1 h-[72%] shrink-0 relative">
        <table className="w-full h-full border-collapse text-center table-fixed">
          <thead>
            <tr className="bg-gray-100 text-[9px] h-[3%]">
              <th className="border border-black p-0.5 w-[4%] font-bold">اليوم</th>
              <th className="border border-black p-0.5 w-[4%] font-bold">م</th>
              <th className="border border-black p-0.5 w-[13%] font-bold">المادة</th>
              <th className="border border-black p-0.5 w-[33%] font-bold">الدرس المقرر</th>
              <th className="border border-black p-0.5 w-[28%] font-bold">الواجب</th>
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
                  <tr key={`${dIndex}-${period}`} className="text-[9px] print:text-[8px] h-[2.7%]">
                    {/* Day Column: Merged vertically */}
                    {isFirstPeriod && (
                      <td 
                        className="border border-black bg-gray-50 font-bold p-0 text-center align-middle"
                        rowSpan={7}
                      >
                        <div className="flex items-center justify-center h-full w-full">
                           <div className="writing-vertical-rl whitespace-nowrap">
                               {day}
                           </div>
                        </div>
                      </td>
                    )}
                    
                    {/* Period Number */}
                    <td className="border border-black bg-gray-50 font-bold">{period}</td>
                    
                    {/* Subject */}
                    <td className={`border border-black font-bold truncate px-1 ${subject ? subject.color : ''}`}>
                      {subject ? subject.name : '-'}
                    </td>
                    
                    {/* Lesson Topic */}
                    <td className="border border-black text-right px-1 truncate">
                       {entry?.lessonTopic || '-'}
                    </td>
                    
                    {/* Homework */}
                    <td className="border border-black text-right px-1 truncate">
                        {entry?.homework || '-'}
                    </td>
                    
                    {/* Notes */}
                    <td className="border border-black text-right px-1 truncate text-[8px]">
                        {entry?.notes || ''}
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>

      {/* 3. FOOTER SECTION (Approx 18% height) */}
      <div className="h-[18%] shrink-0 flex border-2 border-black">
         {/* Right Section: General Messages */}
         <div className="w-1/2 border-l-2 border-black p-2 flex flex-col">
            <h4 className="font-bold text-[10px] mb-1 bg-gray-100 p-1 text-center border border-gray-300 rounded">رسائل وتوجيهات عامة</h4>
            {onUpdateSettings ? (
                <textarea 
                  className="w-full flex-1 resize-none text-[9px] border-none outline-none bg-transparent"
                  value={settings.footerNotesRight}
                  onChange={(e) => handleFooterChange('footerNotesRight', e.target.value)}
                  placeholder="اكتب التوجيهات هنا..."
                />
            ) : (
                <p className="whitespace-pre-wrap text-[9px] leading-relaxed">{settings.footerNotesRight}</p>
            )}
         </div>

         {/* Left Section: Notes & Image */}
         <div className="w-1/2 p-2 flex flex-col relative group">
             <h4 className="font-bold text-[10px] mb-1 bg-gray-100 p-1 text-center border border-gray-300 rounded">ملاحظات / نشاط أسبوعي</h4>
             <div className="flex-1 flex flex-col relative overflow-hidden">
                {/* Text Area */}
                <div className="flex-1 z-10">
                    {onUpdateSettings ? (
                        <textarea 
                        className="w-full h-full resize-none text-[9px] border-none outline-none bg-transparent/50 relative z-20"
                        value={settings.footerNotesLeft}
                        onChange={(e) => handleFooterChange('footerNotesLeft', e.target.value)}
                        placeholder="اكتب الملاحظات هنا..."
                        />
                    ) : (
                        <p className="whitespace-pre-wrap text-[9px] leading-relaxed relative z-20">{settings.footerNotesLeft}</p>
                    )}
                </div>

                {/* Background Image / Upload */}
                {settings.footerNotesLeftImage && (
                    <img 
                        src={settings.footerNotesLeftImage} 
                        className="absolute inset-0 w-full h-full object-contain opacity-20 z-0 pointer-events-none" 
                        alt="Footer decoration"
                    />
                )}
                
                {/* Upload Controls (Hidden in Print) */}
                {onUpdateSettings && (
                    <div className="absolute bottom-0 left-0 no-print flex gap-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                         <label className="cursor-pointer bg-blue-100 p-1 rounded hover:bg-blue-200" title="رفع صورة خلفية">
                             <ImageIcon size={12} className="text-blue-600"/>
                             <input type="file" accept="image/*" className="hidden" onChange={handleNoteImageUpload}/>
                         </label>
                         {settings.footerNotesLeftImage && (
                             <button onClick={handleRemoveNoteImage} className="bg-red-100 p-1 rounded hover:bg-red-200" title="حذف الصورة">
                                 <X size={12} className="text-red-600"/>
                             </button>
                         )}
                    </div>
                )}
             </div>
         </div>
      </div>

    </div>
  );
};

export default WeeklyPlanTemplate;