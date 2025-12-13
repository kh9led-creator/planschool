import React from 'react';
import { CheckCircle, Printer, Download, CreditCard, School } from 'lucide-react';

interface InvoiceModalProps {
  schoolName: string;
  plan: string;
  amount: number;
  date: string;
  invoiceId: string;
  onConfirm: () => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ schoolName, plan, amount, date, invoiceId, onConfirm }) => {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-lg mx-auto border border-slate-100 animate-slideDown">
      {/* Header */}
      <div className="text-center border-b border-dashed border-slate-300 pb-6 mb-6">
        <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600">
            <CheckCircle size={32} />
        </div>
        <h2 className="text-2xl font-bold text-slate-800">تم تسجيل البيانات بنجاح</h2>
        <p className="text-slate-500 text-sm mt-1">يرجى سداد الفاتورة للحصول على كود التفعيل</p>
      </div>

      {/* Invoice Details */}
      <div className="bg-slate-50 rounded-xl p-6 mb-6 border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
        
        <div className="flex justify-between items-center mb-4">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">رقم الفاتورة</span>
            <span className="font-mono font-bold text-slate-700">#{invoiceId}</span>
        </div>

        <div className="space-y-3">
            <div className="flex justify-between">
                <span className="text-sm text-slate-600">المدرسة</span>
                <span className="text-sm font-bold text-slate-800">{schoolName}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-sm text-slate-600">الباقة المختارة</span>
                <span className="text-sm font-bold text-slate-800 uppercase">{plan}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-sm text-slate-600">تاريخ الإصدار</span>
                <span className="text-sm font-bold text-slate-800">{date}</span>
            </div>
        </div>

        <div className="border-t border-slate-200 mt-4 pt-4 flex justify-between items-center">
            <span className="font-bold text-lg text-slate-800">الإجمالي المستحق</span>
            <span className="font-bold text-2xl text-emerald-600">{amount} <span className="text-xs text-slate-500">ريال</span></span>
        </div>
      </div>

      {/* Payment Methods Mockup */}
      <div className="mb-8">
          <p className="text-xs font-bold text-slate-400 mb-2">طرق الدفع المقبولة</p>
          <div className="flex gap-2">
              <div className="h-8 w-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center"><CreditCard size={16} className="text-slate-400"/></div>
              <div className="h-8 w-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-400">MADA</div>
              <div className="h-8 w-12 bg-slate-100 rounded border border-slate-200 flex items-center justify-center font-bold text-[10px] text-slate-400">VISA</div>
          </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        <button 
            onClick={onConfirm}
            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg flex items-center justify-center gap-2"
        >
            <CreditCard size={20}/>
            تأكيد الدفع والمتابعة
        </button>
        <div className="flex gap-2">
            <button className="flex-1 py-2 text-slate-500 hover:text-indigo-600 font-bold text-xs flex items-center justify-center gap-1">
                <Printer size={14}/> طباعة الفاتورة
            </button>
            <button className="flex-1 py-2 text-slate-500 hover:text-indigo-600 font-bold text-xs flex items-center justify-center gap-1">
                <Download size={14}/> تحميل PDF
            </button>
        </div>
      </div>
    </div>
  );
};

export default InvoiceModal;