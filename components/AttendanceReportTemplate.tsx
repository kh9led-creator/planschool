import React from 'react';
import { ClassGroup, Student, SchoolSettings } from '../types';

interface AttendanceReportTemplateProps {
  schoolSettings: SchoolSettings;
  classGroup: { name: string; id: string };
  teacherName: string;
  date: string;
  absentStudents: (Student | { id: string; name: string; parentPhone: string; className?: string })[];
  showClassColumn?: boolean;
}

const AttendanceReportTemplate: React.FC<AttendanceReportTemplateProps> = ({
  schoolSettings,
  classGroup,
  teacherName,
  date,
  absentStudents,
  showClassColumn = false
}) => {
  const dateObj = new Date(date);
  const dayName = dateObj.toLocaleDateString('ar-SA', { weekday: 'long' });

  return (
    <div className="bg-white text-black mx-auto overflow-hidden relative flex flex-col p-8"
         style={{ width: '210mm', minHeight: '297mm', padding: '10mm' }}>
      
      {/* 1. HEADER SECTION (Consistent with Weekly Plan) */}
      <div className="flex justify-between items-start border-b-2 border-black pb-4 mb-6">
        {/* Right Section */}
        <div className="text-right space-y-1 text-xs font-bold flex-1 pt-2">
          <p>{schoolSettings.ministryName}</p>
          <p>{schoolSettings.authorityName}</p>
          <p>{schoolSettings.directorateName}</p>
          <p>{schoolSettings.schoolName}</p>
        </div>
        
        {/* Center Section: Logo */}
        <div className="flex flex-col items-center justify-center flex-1">
            <img 
              src={schoolSettings.logoUrl}
              alt="Logo" 
              className="h-24 object-contain"
            />
        </div>

        {/* Left Section: Report Details */}
        <div className="text-left space-y-1 text-xs font-bold flex-1 pt-2 flex flex-col items-end">
           <div className="text-right border border-black p-2 rounded-lg bg-gray-50 min-w-[150px]">
              <p>اليوم: <span className="font-normal">{dayName}</span></p>
              <p>التاريخ: <span className="font-normal font-mono">{date}</span></p>
              {!showClassColumn && <p>الفصل: <span className="font-normal">{classGroup.name}</span></p>}
           </div>
        </div>
      </div>

      {/* 2. TITLE */}
      <div className="text-center mb-6">
          <h1 className="text-xl font-extrabold border-2 border-black inline-block px-8 py-2 rounded-full shadow-sm bg-gray-50">
              {showClassColumn ? 'تقرير الغياب اليومي الشامل' : 'كشف الطلاب الغائبين'}
          </h1>
      </div>

      {/* 3. TABLE SECTION */}
      <div className="flex-1">
        {absentStudents.length === 0 ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-400">
                <p className="text-lg font-bold">لا يوجد غياب مسجل لهذا اليوم</p>
                <p className="text-sm">جميع الطلاب حاضرون</p>
            </div>
        ) : (
            <table className="w-full border-collapse text-center">
            <thead>
                <tr className="bg-gray-100 text-xs border-y-2 border-black">
                <th className="border-x border-black p-2 w-[5%] font-bold">م</th>
                <th className={`border-x border-black p-2 font-bold ${showClassColumn ? 'w-[30%]' : 'w-[40%]'}`}>اسم الطالب</th>
                {showClassColumn && <th className="border-x border-black p-2 w-[15%] font-bold">الفصل</th>}
                <th className="border-x border-black p-2 w-[20%] font-bold">رقم ولي الأمر</th>
                <th className="border-x border-black p-2 w-[30%] font-bold">ملاحظات / حالة العذر</th>
                </tr>
            </thead>
            <tbody>
                {absentStudents.map((student, index) => (
                    <tr key={student.id} className="text-sm border-b border-black">
                        <td className="border-x border-black p-3 font-bold bg-gray-50">{index + 1}</td>
                        <td className="border-x border-black p-3 text-right font-bold">{student.name}</td>
                        {showClassColumn && (
                             <td className="border-x border-black p-3 text-sm">{('className' in student) ? student.className : '-'}</td>
                        )}
                        <td className="border-x border-black p-3 font-mono">{student.parentPhone}</td>
                        <td className="border-x border-black p-3"></td>
                    </tr>
                ))}
            </tbody>
            </table>
        )}
      </div>

      {/* 4. FOOTER SIGNATURES */}
      <div className="mt-auto pt-10 grid grid-cols-2 gap-10">
          <div className="text-center">
              <p className="font-bold text-sm mb-10">{showClassColumn ? 'وكيل شؤون الطلاب' : 'معلم المادة / مربي الفصل'}</p>
              <p className="font-bold text-lg border-b-2 border-dotted border-black inline-block min-w-[200px] pb-1">{teacherName}</p>
          </div>
          <div className="text-center">
              <p className="font-bold text-sm mb-10">مدير المدرسة</p>
              <div className="border-b-2 border-dotted border-black w-2/3 mx-auto"></div>
          </div>
      </div>

    </div>
  );
};

export default AttendanceReportTemplate;