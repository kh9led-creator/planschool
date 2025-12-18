
import React, { useState, useEffect } from 'react';
import { School, Wallet, Search, Filter, Shield, Key, Trash2, CheckCircle, TrendingUp, CreditCard, Landmark, Globe, Save, Loader2, Copy, AlertOctagon, UserCog, LogOut, XCircle, Mail, Smartphone, Lock, Calendar, Power, Edit3, UserPlus, Zap } from 'lucide-react';
import { PricingConfig } from '../types';
import { saveSystemData, loadSystemData } from '../services/firebase';

interface SchoolMetadata {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  subscriptionEnd: string;
  plan: string;
  email?: string;
  managerPhone: string;
  adminUsername?: string;
  adminPassword?: string;
  activationCode: string;
  isPaid: boolean;
}

interface SystemDashboardProps {
    schools: SchoolMetadata[];
    onSelectSchool: (id: string) => void;
    onDeleteSchool: (id: string) => void;
    onToggleStatus: (id: string, currentStatus: boolean) => void; 
    onLogout: () => void;
    pricing: PricingConfig;
    onSavePricing: (config: PricingConfig) => void;
}

const SystemDashboard: React.FC<SystemDashboardProps> = ({ 
    schools, onSelectSchool, onDeleteSchool, onToggleStatus, onLogout, pricing, onSavePricing 
}) => {
    const [activeTab, setActiveTab] = useState<'schools' | 'finance'>('schools');
    const [searchTerm, setSearchTerm] = useState('');
    const [localPricing, setLocalPricing] = useState<PricingConfig>(pricing);
    const [isSaving, setIsSaving] = useState(false);
    const [showExtendModal, setShowExtendModal] = useState<SchoolMetadata | null>(null);
    const [newEndDate, setNewEndDate] = useState('');

    const filteredSchools = schools.filter(s => s.name.includes(searchTerm) || s.id.includes(searchTerm));

    const handleExtendSubscription = async () => {
        if (!showExtendModal || !newEndDate) return;
        setIsSaving(true);
        const updatedSchools = schools.map(s => s.id === showExtendModal.id ? {...s, subscriptionEnd: new Date(newEndDate).toISOString(), isActive: true, isPaid: true} : s);
        await saveSystemData('schools_registry', updatedSchools);
        setIsSaving(false);
        setShowExtendModal(null);
        window.location.reload();
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
            <header className="bg-slate-900 text-white p-6 sticky top-0 z-50 flex justify-between items-center shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-indigo-500 p-3 rounded-2xl"><Shield size={28}/></div>
                    <div>
                        <h1 className="font-black text-xl">لوحة تحكم النظام</h1>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">التحكم المركزي بالاشتراكات</p>
                    </div>
                </div>
                <div className="flex gap-4">
                    <button onClick={onLogout} className="bg-rose-500 hover:bg-rose-600 px-5 py-2.5 rounded-xl font-bold transition-all flex items-center gap-2"><LogOut size={20}/> تسجيل الخروج</button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-8 space-y-10">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="text-slate-400 font-bold text-xs uppercase mb-1">إجمالي المدارس</div>
                        <div className="text-3xl font-black text-slate-900">{schools.length}</div>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="text-emerald-500 font-bold text-xs uppercase mb-1">المدارس النشطة</div>
                        <div className="text-3xl font-black text-slate-900">{schools.filter(s=>s.isActive).length}</div>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="text-indigo-500 font-bold text-xs uppercase mb-1">الاشتراكات المدفوعة</div>
                        <div className="text-3xl font-black text-slate-900">{schools.filter(s=>s.isPaid).length}</div>
                    </div>
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
                        <div className="text-amber-500 font-bold text-xs uppercase mb-1">فترة تجريبية</div>
                        <div className="text-3xl font-black text-slate-900">{schools.filter(s=>s.plan==='trial').length}</div>
                    </div>
                </div>

                <div className="flex gap-4 p-1.5 bg-white border border-slate-200 rounded-2xl w-fit shadow-sm">
                    <button onClick={() => setActiveTab('schools')} className={`px-8 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'schools' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>إدارة المدارس</button>
                    <button onClick={() => setActiveTab('finance')} className={`px-8 py-3 rounded-xl font-black text-sm transition-all ${activeTab === 'finance' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>إعدادات النظام</button>
                </div>

                {activeTab === 'schools' && (
                    <div className="space-y-6">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 flex gap-4 shadow-sm">
                            <div className="relative flex-1">
                                <Search className="absolute right-5 top-4 text-slate-400" size={20}/>
                                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl py-4 pr-14 outline-none focus:bg-white focus:border-indigo-400 transition-all font-bold" placeholder="ابحث باسم المدرسة، الكود، أو البريد الإلكتروني..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
                            </div>
                        </div>

                        <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-black uppercase">
                                    <tr>
                                        <th className="p-6">المدرسة والبيانات</th>
                                        <th className="p-6">الحالة والاشتراك</th>
                                        <th className="p-6">تاريخ الانتهاء</th>
                                        <th className="p-6">التحكم والعمليات</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 font-bold">
                                    {filteredSchools.map(school => {
                                        const isExpired = new Date(school.subscriptionEnd) < new Date();
                                        return (
                                            <tr key={school.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-6">
                                                    <div className="font-black text-slate-800 text-lg">{school.name}</div>
                                                    <div className="flex gap-2 mt-1">
                                                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">ID: {school.id}</span>
                                                        <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">USR: {school.adminUsername}</span>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex flex-col gap-2">
                                                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black w-fit flex items-center gap-1 ${school.isActive ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                                                            {school.isActive ? <CheckCircle size={12}/> : <XCircle size={12}/>}
                                                            {school.isActive ? 'نشط' : 'معطل'}
                                                        </span>
                                                        <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black w-fit border ${school.plan === 'trial' ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-indigo-50 text-indigo-600 border-indigo-100'}`}>
                                                            {school.plan === 'trial' ? 'فترة تجريبية' : 'باقة مدفوعة'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-6">
                                                    <div className={`text-sm font-black ${isExpired ? 'text-rose-500' : 'text-slate-600'}`}>
                                                        {new Date(school.subscriptionEnd).toLocaleDateString('ar-SA')}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">{isExpired ? 'منتهي' : 'قيد العمل'}</div>
                                                </td>
                                                <td className="p-6">
                                                    <div className="flex gap-2">
                                                        <button onClick={() => onSelectSchool(school.id)} className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-colors" title="دخول"> <Globe size={20}/> </button>
                                                        <button onClick={() => setShowExtendModal(school)} className="p-3 bg-amber-50 text-amber-600 rounded-2xl hover:bg-amber-100 transition-colors" title="تمديد الاشتراك"> <Calendar size={20}/> </button>
                                                        <button onClick={() => onToggleStatus(school.id, school.isActive)} className={`p-3 rounded-2xl transition-colors ${school.isActive ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}> <Power size={20}/> </button>
                                                        <button onClick={() => onDeleteSchool(school.id)} className="p-3 bg-slate-100 text-slate-400 rounded-2xl hover:bg-rose-50 hover:text-rose-500 transition-colors" title="حذف"> <Trash2 size={20}/> </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'finance' && (
                    <div className="bg-white rounded-[2.5rem] p-12 border border-slate-200 shadow-sm max-w-2xl">
                        <h3 className="text-2xl font-black mb-10 flex items-center gap-3"><Zap className="text-indigo-600"/> إعدادات الأسعار والمنصة</h3>
                        <div className="space-y-8">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-500 block">سعر الباقة الفصلية (3 أشهر)</label>
                                    <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" value={localPricing.quarterly} onChange={e=>setLocalPricing({...localPricing, quarterly: Number(e.target.value)})}/>
                                </div>
                                <div className="space-y-3">
                                    <label className="text-xs font-black text-slate-500 block">سعر الباقة السنوية (12 شهر)</label>
                                    <input type="number" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" value={localPricing.annual} onChange={e=>setLocalPricing({...localPricing, annual: Number(e.target.value)})}/>
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-xs font-black text-slate-500 block">العملة</label>
                                <input type="text" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" value={localPricing.currency} onChange={e=>setLocalPricing({...localPricing, currency: e.target.value})}/>
                            </div>
                            <button onClick={() => onSavePricing(localPricing)} className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-lg hover:bg-slate-800 transition-all flex items-center gap-2"> <Save size={20}/> حفظ الإعدادات </button>
                        </div>
                    </div>
                )}

                {showExtendModal && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-10 shadow-2xl animate-slideDown border border-slate-100">
                            <h3 className="text-2xl font-black mb-4">تعديل اشتراك</h3>
                            <p className="text-slate-400 text-sm mb-8 font-bold">تعديل صلاحية مدرسة: <br/><span className="text-indigo-600 font-black">{showExtendModal.name}</span></p>
                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-black text-slate-500 block mb-2">تاريخ انتهاء الصلاحية الجديد</label>
                                    <input type="date" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 outline-none focus:border-indigo-500 font-black" value={newEndDate} onChange={e=>setNewEndDate(e.target.value)} />
                                </div>
                                <button onClick={handleExtendSubscription} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-black text-lg hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100">تأكيد التعديل وتفعيل الحساب</button>
                                <button onClick={() => setShowExtendModal(null)} className="w-full text-slate-400 text-sm font-bold hover:text-slate-600">إلغاء</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default SystemDashboard;
