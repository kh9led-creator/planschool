import React, { useState } from 'react';
import { CheckCircle, Printer, Download, CreditCard, School, Wallet, Copy, Upload } from 'lucide-react';

interface InvoiceModalProps {
  schoolName: string;
  plan: string;
  amount: number;
  date: string;
  invoiceId: string;
  onConfirm: () => void;
}

const InvoiceModal: React.FC<InvoiceModalProps> = ({ schoolName, plan, amount, date, invoiceId, onConfirm }) => {
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'transfer'>('card');
  const [processing, setProcessing] = useState(false);

  const handlePayment = () => {
      setProcessing(true);
      // Simulate API Call
      setTimeout(() => {
          setProcessing(false);
          onConfirm();
      }, 2000);
  };

  return (
    <div className="bg-white p-0 rounded-2xl shadow-xl w-full max-w-lg mx-auto border border-slate-100 animate-slideDown overflow-hidden flex flex-col max-h-[90vh]">
      {/* Header */}
      <div className="bg-slate-900 text-white p-6 text-center shrink-0">
        <h2 className="text-xl font-bold">إتمام عملية الدفع</h2>
        <p className="text-slate-400 text-xs mt-1">تجديد اشتراك: {plan === 'annual' ? 'الباقة السنوية' : 'الباقة الفصلية'}</p>
      </div>

      <div className="overflow-y-auto p-6 space-y-6">
        {/* Invoice Summary */}
        <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 flex justify-between items-center">
            <div>
                <p className="text-xs text-slate-500 font-bold uppercase">المبلغ المستحق</p>
                <p className="text-2xl font-bold text-slate-800">{amount} <span className="text-sm font-medium">ريال</span></p>
            </div>
            <div className="text-right">
                <p className="text-xs text-slate-500 font-bold uppercase">رقم الفاتورة</p>
                <p className="font-mono text-slate-700">{invoiceId}</p>
            </div>
        </div>

        {/* Payment Methods Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
            <button 
                onClick={() => setPaymentMethod('card')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${paymentMethod === 'card' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <CreditCard size={16}/> دفع إلكتروني
            </button>
            <button 
                onClick={() => setPaymentMethod('transfer')}
                className={`flex-1 py-2 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${paymentMethod === 'transfer' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
                <Wallet size={16}/> تحويل بنكي
            </button>
        </div>

        {/* Payment Form */}
        {paymentMethod === 'card' ? (
            <div className="space-y-4 animate-fadeIn">
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">رقم البطاقة</label>
                    <div className="relative">
                        <input type="text" placeholder="0000 0000 0000 0000" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 pl-10 outline-none focus:border-indigo-500 transition-all font-mono" dir="ltr"/>
                        <CreditCard className="absolute left-3 top-3.5 text-slate-400" size={18}/>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500">تاريخ الانتهاء</label>
                        <input type="text" placeholder="MM/YY" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-indigo-500 transition-all font-mono text-center" dir="ltr"/>
                    </div>
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500">رمز التحقق (CVC)</label>
                        <input type="text" placeholder="123" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-indigo-500 transition-all font-mono text-center" dir="ltr"/>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">اسم حامل البطاقة</label>
                    <input type="text" placeholder="الاسم كما يظهر على البطاقة" className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-3 outline-none focus:border-indigo-500 transition-all"/>
                </div>
            </div>
        ) : (
            <div className="space-y-4 animate-fadeIn">
                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
                    <h4 className="font-bold text-indigo-900 text-sm mb-2">بيانات الحساب البنكي</h4>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-indigo-700/70">البنك:</span>
                        <span className="font-bold text-indigo-900">مصرف الراجحي</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                        <span className="text-indigo-700/70">الآيبان:</span>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-indigo-900">SA00000000000000000000</span>
                            <button className="text-indigo-500 hover:text-indigo-700"><Copy size={14}/></button>
                        </div>
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500">إرفاق إيصال التحويل</label>
                    <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center cursor-pointer hover:bg-slate-50 transition-colors">
                        <Upload className="mx-auto text-slate-400 mb-2" size={24}/>
                        <p className="text-xs text-slate-500">اضغط لرفع صورة الإيصال</p>
                    </div>
                </div>
            </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-6 border-t border-slate-100 bg-white">
        <button 
            onClick={handlePayment}
            disabled={processing}
            className="w-full bg-indigo-600 text-white py-3.5 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
        >
            {processing ? (
                <>جاري المعالجة...</>
            ) : (
                <>
                    {paymentMethod === 'card' ? 'دفع آمن الآن' : 'إرسال طلب التحقق'}
                    <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{amount} ريال</span>
                </>
            )}
        </button>
      </div>
    </div>
  );
};

export default InvoiceModal;