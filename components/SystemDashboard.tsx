import React, { useState, useEffect } from 'react';
import { School, Wallet, Search, Filter, Shield, Key, Trash2, CheckCircle, TrendingUp, CreditCard, Landmark, Globe, Save, Loader2, Copy, AlertOctagon, UserCog, LogOut, XCircle, Mail, Smartphone, Lock, Calendar, Power, Edit3 } from 'lucide-react';
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
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [showExtendModal, setShowExtendModal] = useState<SchoolMetadata | null>(null);
    const [newEndDate, setNewEndDate] = useState('');

    const filteredSchools = schools.filter(s => s.name.includes(searchTerm) || s.id.includes(searchTerm));

    const handleExtendSubscription = async () => {
        if (!showExtendModal || !newEndDate) return;
        setIsSaving(true);
        const updatedSchools = schools.map(s => s.id === showExtendModal.id ? {...s, subscriptionEnd: new Date(newEndDate).toISOString(), isActive: true, isPaid: true} : s);
        await saveSystemData('schools_registry', updatedSchools);
        window.location.reload(); // Simple sync
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans" dir="rtl">
            <header className="bg-slate-900 text-white p-6 sticky top-0 z-50 flex justify-between items-center shadow-2xl">
                <div className="flex items-center gap-4">
                    <div className="bg-emerald-500 p-2.5 rounded-xl"><Shield size={24}/></div>
                    <div>
                        <h1 className="font-bold text-xl">الإدارة المركزية</h1>
                        <p className="text-xs text-slate-400">التحكم بالمنصة والاشتراكات</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button onClick={() => setShowProfileModal(true)} className="bg-white/10 hover:bg-white/20 p-2.5 rounded-xl transition-all"><UserCog size={20}/></button>
                    <button onClick={onLogout} className="bg-rose-500 hover:bg-rose-600 p-2.5 rounded-xl transition-all"><LogOut size={20}/></button>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-8 space-y-8">
                <div className="flex gap-4 p-1 bg-white border border-slate-200 rounded-2xl w-fit">
                    <button onClick={() => setActiveTab('schools')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'schools' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>إدارة المدارس ({schools.length})</button>
                    <button onClick={() => setActiveTab('finance')} className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === 'finance' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-500 hover:bg-slate-50'}`}>الإعدادات والأسعار</button>
                </div>

                {activeTab === 'schools' && (
                    <div className="space-y-6">
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 flex gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute right-4 top-3.5 text-slate-400" size={20}/>
                                <input className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-12 outline-none focus:bg-white transition-all" placeholder="بحث باسم المدرسة أو الكود..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                            <table className="w-full text-right">
                                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs font-bold uppercase">
                                    <tr>
                                        <th className="p-4">المدرسة</th>
                                        <th className="p-4">الحالة</th>
                                        <th className="p-4">نهاية الاشتراك</th>
                                        <th className="p-4">التحكم</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSchools.map(school => {
                                        const isExpired = new Date(school.subscriptionEnd) < new Date();
                                        return (
                                            <tr key={school.id} className="hover:bg-slate-50/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="font-bold text-slate-800">{school.name}</div>
                                                    <div className="text-[10px] font-mono text-slate-400">ID: {school.id}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold ${school.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {school.isActive ? 'نشط' : 'معطل'}
                                                    </span>
                                                </td>
                                                <td className="p-4">
                                                    <div className={`text-xs font-bold ${isExpired ? 'text-rose-500' : 'text-slate-600'}`}>
                                                        {new Date(school.subscriptionEnd).toLocaleDateString('ar-SA')}
                                                    </div>
                                                    <div className="text-[10px] text-slate-400">{school.plan === 'trial' ? 'تجريبي' : 'مدفوع'}</div>
                                                </td>
                                                <td className="p-4 flex gap-2">
                                                    <button onClick={() => onSelectSchool(school.id)} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100" title="دخول"> <Globe size={18}/> </button>
                                                    <button onClick={() => setShowExtendModal(school)} className="p-2 bg-amber-50 text-amber-600 rounded-lg hover:bg-amber-100" title="تمديد الاشتراك"> <Calendar size={18}/> </button>
                                                    <button onClick={() => onToggleStatus(school.id, school.isActive)} className={`p-2 rounded-lg ${school.isActive ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}> <Power size={18}/> </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {showExtendModal && (
                    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl animate-slideDown">
                            <h3 className="text-xl font-bold mb-4">تعديل اشتراك: {showExtendModal.name}</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 block mb-2">تاريخ انتهاء الصلاحية الجديد</label>
                                    <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-indigo-500" value={newEndDate} onChange={e=>setNewEndDate(e.target.value)} />
                                </div>
                                <button onClick={handleExtendSubscription} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-all">تأكيد التعديل</button>
                                <button onClick={() => setShowExtendModal(null)} className="w-full text-slate-400 text-sm">إلغاء</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default SystemDashboard;