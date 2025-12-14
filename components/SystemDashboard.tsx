import React, { useState, useEffect } from 'react';
import { School, Wallet, Search, Filter, Shield, Key, Trash2, CheckCircle, TrendingUp, CreditCard, Landmark, Globe, Save, Loader2, Copy, AlertOctagon, UserCog, LogOut, MoreVertical, Calendar, Power, Link as LinkIcon, RefreshCcw, Eye, XCircle } from 'lucide-react';
import { SchoolSettings, PricingConfig } from '../types';
import { saveSystemData, loadSystemData } from '../services/firebase';

// --- Types needed locally ---
type SubscriptionPlan = 'trial' | 'quarterly' | 'annual' | string;

interface SchoolMetadata {
  id: string;
  name: string;
  createdAt: string;
  isActive: boolean;
  subscriptionEnd: string;
  plan: SubscriptionPlan;
  licenseKey: string;
  maxTeachers?: number;
  email?: string;
  managerPhone: string;
  adminUsername?: string;
  adminPassword?: string;
  activationCode: string;
  isPaid: boolean;
}

interface PaymentSettings {
    bankName: string;
    accountName: string;
    iban: string;
    swiftCode: string;
    enableStripe: boolean;
    stripePublicKey: string;
    stripeSecretKey: string;
    enableBankTransfer: boolean;
    vatNumber: string;
    vatRate: number;
    currency: string;
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

// --- Styles ---
const cardClass = "bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden";
const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all";
const labelClass = "block text-xs font-bold text-slate-500 mb-1.5 mr-1";
const tableHeaderClass = "px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-50/50 border-b border-slate-100 text-right";
const tableCellClass = "px-6 py-4 whitespace-nowrap text-sm text-slate-700 border-b border-slate-50";

const SystemDashboard: React.FC<SystemDashboardProps> = ({ 
    schools, 
    onSelectSchool, 
    onDeleteSchool,
    onToggleStatus,
    onLogout, 
    pricing, 
    onSavePricing 
}) => {
    const [activeTab, setActiveTab] = useState<'schools' | 'finance'>('schools');
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expired' | 'trial'>('all');
    const [localPricing, setLocalPricing] = useState<PricingConfig>(pricing);
    const [isSaving, setIsSaving] = useState(false);
    
    // Financial Config State
    const [paymentConfig, setPaymentConfig] = useState<PaymentSettings>({
        bankName: '', accountName: '', iban: '', swiftCode: '',
        enableStripe: false, stripePublicKey: '', stripeSecretKey: '',
        enableBankTransfer: true, vatNumber: '', vatRate: 15, currency: 'SAR'
    });

    // Load System Config on Mount
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const saved = await loadSystemData('payment_config');
                if (saved) setPaymentConfig(saved);
                setLocalPricing(pricing);
            } catch (e) { console.error('Failed to load config', e); }
        };
        loadSettings();
    }, [pricing]);

    // Handle Save
    const handleSavePaymentConfig = async () => {
        setIsSaving(true);
        try {
            await saveSystemData('payment_config', paymentConfig);
            onSavePricing(localPricing);
            await new Promise(r => setTimeout(r, 800)); 
            alert('تم تحديث إعدادات النظام بنجاح');
        } catch (e) {
            alert('فشل في الحفظ');
        }
        setIsSaving(false);
    };

    // Calculate Stats
    const stats = {
        total: schools.length,
        active: schools.filter(s => s.isActive && new Date(s.subscriptionEnd) > new Date()).length,
        revenue: schools.reduce((acc, curr) => acc + (curr.isPaid ? (curr.plan === 'annual' ? pricing.annual : pricing.quarterly) : 0), 0),
        trial: schools.filter(s => s.plan === 'trial').length
    };

    // Filtering Logic
    const filteredSchools = schools.filter(school => {
        const matchesSearch = school.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                              (school.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                              (school.adminUsername || '').toLowerCase().includes(searchTerm.toLowerCase());
        
        const isExpired = new Date(school.subscriptionEnd) < new Date();
        const matchesFilter = 
            statusFilter === 'all' ? true :
            statusFilter === 'active' ? (school.isActive && !isExpired) :
            statusFilter === 'expired' ? (isExpired) :
            statusFilter === 'trial' ? (school.plan === 'trial') : true;

        return matchesSearch && matchesFilter;
    });

    const copyLink = (schoolId: string) => {
        const link = `${window.location.origin}?school=${schoolId}`;
        navigator.clipboard.writeText(link);
        alert('تم نسخ رابط المدرسة المباشر');
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800" dir="rtl">
            
            {/* Top Navbar */}
            <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 h-20 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="bg-slate-900 p-2.5 rounded-xl"><UserCog size={24} className="text-white"/></div>
                        <div>
                            <h1 className="font-extrabold text-xl text-slate-900 leading-none">لوحة الإدارة المركزية</h1>
                            <p className="text-xs text-slate-500 mt-1 font-bold">نظام الخطط الأسبوعية - Admin Panel</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden lg:flex items-center gap-6 mr-8">
                            <div className="text-center">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">المدارس</p>
                                <p className="text-lg font-extrabold text-slate-800">{stats.total}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-200"></div>
                            <div className="text-center">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">نشطة</p>
                                <p className="text-lg font-extrabold text-emerald-600">{stats.active}</p>
                            </div>
                            <div className="h-8 w-px bg-slate-200"></div>
                            <div className="text-center">
                                <p className="text-[10px] text-slate-400 font-bold uppercase">تجريبي</p>
                                <p className="text-lg font-extrabold text-amber-600">{stats.trial}</p>
                            </div>
                        </div>
                        <button onClick={onLogout} className="flex items-center gap-2 text-xs font-bold bg-rose-50 text-rose-600 hover:bg-rose-100 px-4 py-2.5 rounded-xl transition-all border border-rose-100">
                            <LogOut size={16}/> تسجيل خروج
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
                
                {/* Tabs */}
                <div className="flex gap-2 p-1 bg-white border border-slate-200 rounded-xl w-fit">
                    <button 
                        onClick={() => setActiveTab('schools')}
                        className={`px-6 py-2.5 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${activeTab === 'schools' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <School size={18}/> إدارة المدارس
                    </button>
                    <button 
                        onClick={() => setActiveTab('finance')}
                        className={`px-6 py-2.5 text-sm font-bold rounded-lg flex items-center gap-2 transition-all ${activeTab === 'finance' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        <Wallet size={18}/> الإعدادات المالية
                    </button>
                </div>

                {/* --- SCHOOLS TAB (Direct Management View) --- */}
                {activeTab === 'schools' && (
                    <div className="space-y-6 animate-fadeIn">
                        
                        {/* Toolbar */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                            <div className="relative w-full md:w-96">
                                <input 
                                    type="text" 
                                    placeholder="بحث سريع (اسم المدرسة، المدير...)" 
                                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 rounded-xl pl-4 pr-10 py-3 text-sm font-bold text-slate-700 outline-none transition-all placeholder:font-normal"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <Search className="absolute right-3 top-3.5 text-slate-400" size={18}/>
                            </div>
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <Filter size={18} className="text-slate-400 ml-1"/>
                                <select 
                                    className="bg-slate-50 border-none font-bold text-slate-600 rounded-xl px-4 py-3 text-sm outline-none cursor-pointer hover:bg-slate-100 min-w-[150px]"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                >
                                    <option value="all">جميع الحالات</option>
                                    <option value="active">النشطة فقط</option>
                                    <option value="trial">الفترة التجريبية</option>
                                    <option value="expired">المنتهية</option>
                                </select>
                            </div>
                        </div>

                        {/* Schools Table View */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr>
                                            <th className={tableHeaderClass}>المدرسة</th>
                                            <th className={tableHeaderClass}>بيانات المدير</th>
                                            <th className={tableHeaderClass}>حالة الاشتراك</th>
                                            <th className={tableHeaderClass}>التفعيل</th>
                                            <th className={tableHeaderClass}>إجراءات سريعة</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredSchools.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="py-20 text-center">
                                                    <div className="flex flex-col items-center justify-center opacity-50">
                                                        <Search size={40} className="mb-2"/>
                                                        <p className="font-bold">لا توجد مدارس مطابقة</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredSchools.map(school => {
                                                const isExpired = new Date(school.subscriptionEnd) < new Date();
                                                const daysRemaining = Math.ceil((new Date(school.subscriptionEnd).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                                
                                                return (
                                                    <tr key={school.id} className="hover:bg-slate-50/80 transition-colors group">
                                                        <td className={tableCellClass}>
                                                            <div className="flex flex-col">
                                                                <span className="font-bold text-slate-800 text-base">{school.name}</span>
                                                                <span className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {school.id}</span>
                                                                <div className="flex gap-2 mt-1">
                                                                    <button onClick={() => copyLink(school.id)} className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded flex items-center gap-1 hover:bg-indigo-100 transition-colors" title="نسخ الرابط المباشر">
                                                                        <LinkIcon size={10}/> رابط المدرسة
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className={tableCellClass}>
                                                            <div className="flex flex-col gap-1">
                                                                <div className="text-xs">
                                                                    <span className="text-slate-400 ml-1">اسم المستخدم:</span>
                                                                    <span className="font-mono font-bold bg-slate-100 px-1 rounded select-all">{school.adminUsername}</span>
                                                                </div>
                                                                <div className="text-xs">
                                                                    <span className="text-slate-400 ml-1">كلمة المرور:</span>
                                                                    <span className="font-mono font-bold bg-slate-100 px-1 rounded select-all">{school.adminPassword}</span>
                                                                </div>
                                                                <div className="text-xs text-slate-500">{school.managerPhone || '-'}</div>
                                                            </div>
                                                        </td>
                                                        <td className={tableCellClass}>
                                                            <div className="flex flex-col gap-1">
                                                                <div className={`text-xs font-bold px-2 py-1 rounded-full w-fit ${isExpired ? 'bg-rose-100 text-rose-700' : school.plan === 'trial' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                                                                    {isExpired ? 'منتهي' : school.plan === 'trial' ? 'تجريبي' : 'اشتراك مدفوع'}
                                                                </div>
                                                                <span className="text-[10px] text-slate-500 font-mono">
                                                                    ينتهي: {new Date(school.subscriptionEnd).toLocaleDateString('en-GB')}
                                                                </span>
                                                                {!isExpired && <span className="text-[10px] text-slate-400">متبقي {daysRemaining} يوم</span>}
                                                            </div>
                                                        </td>
                                                        <td className={tableCellClass}>
                                                            <div className="flex items-center gap-3">
                                                                <button 
                                                                    onClick={() => onToggleStatus(school.id, school.isActive)}
                                                                    className={`relative w-10 h-5 rounded-full transition-colors ${school.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`}
                                                                    title={school.isActive ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                                                                >
                                                                    <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all shadow-sm ${school.isActive ? 'right-1' : 'right-6'}`}></div>
                                                                </button>
                                                                <span className="text-xs font-bold text-slate-600">{school.isActive ? 'مفعل' : 'معطل'}</span>
                                                            </div>
                                                        </td>
                                                        <td className={tableCellClass}>
                                                            <div className="flex items-center gap-2">
                                                                <button 
                                                                    onClick={() => onSelectSchool(school.id)}
                                                                    className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                                                    title="دخول كمسؤول للمدرسة"
                                                                >
                                                                    <Eye size={18}/>
                                                                </button>
                                                                <button 
                                                                    onClick={() => { if(window.confirm(`حذف مدرسة ${school.name} نهائياً؟`)) onDeleteSchool(school.id) }}
                                                                    className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-100"
                                                                    title="حذف المدرسة"
                                                                >
                                                                    <Trash2 size={18}/>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- FINANCE TAB --- */}
                {activeTab === 'finance' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fadeIn">
                        
                        {/* Pricing Configuration */}
                        <div className={cardClass}>
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <CreditCard className="text-indigo-600" size={20}/> تسعير الباقات
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">تحديد قيمة الاشتراكات التي ستظهر للعملاء</p>
                            </div>
                            <div className="p-6 space-y-6">
                                <div>
                                    <label className={labelClass}>العملة الأساسية</label>
                                    <select 
                                        className={inputClass}
                                        value={paymentConfig.currency}
                                        onChange={(e) => {
                                            setPaymentConfig({...paymentConfig, currency: e.target.value});
                                            setLocalPricing({...localPricing, currency: e.target.value});
                                        }}
                                    >
                                        <option value="SAR">ريال سعودي (SAR)</option>
                                        <option value="USD">دولار أمريكي (USD)</option>
                                        <option value="AED">درهم إماراتي (AED)</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>الباقة الفصلية (3 أشهر)</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                className={inputClass} 
                                                value={localPricing.quarterly} 
                                                onChange={e => setLocalPricing({...localPricing, quarterly: Number(e.target.value)})}
                                            />
                                            <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-400">{paymentConfig.currency}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelClass}>الباقة السنوية (12 شهر)</label>
                                        <div className="relative">
                                            <input 
                                                type="number" 
                                                className={inputClass} 
                                                value={localPricing.annual} 
                                                onChange={e => setLocalPricing({...localPricing, annual: Number(e.target.value)})}
                                            />
                                            <span className="absolute left-3 top-3.5 text-xs font-bold text-slate-400">{paymentConfig.currency}</span>
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="bg-indigo-50 rounded-xl p-4 flex gap-3 border border-indigo-100">
                                    <AlertOctagon size={20} className="text-indigo-600 shrink-0"/>
                                    <p className="text-xs text-indigo-800 leading-relaxed">
                                        تغيير الأسعار هنا سينعكس فوراً على جميع الفواتير الجديدة وعمليات التجديد القادمة في لوحات تحكم المدارس.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Bank Details */}
                        <div className={cardClass}>
                            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                                    <Landmark className="text-emerald-600" size={20}/> بيانات التحويل البنكي
                                </h3>
                                <p className="text-xs text-slate-500 mt-1">الحساب الذي سيتم تحويل الرسوم إليه</p>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-bold text-slate-700">تفعيل التحويل البنكي</span>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" checked={paymentConfig.enableBankTransfer} onChange={e => setPaymentConfig({...paymentConfig, enableBankTransfer: e.target.checked})}/>
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className={labelClass}>اسم البنك</label>
                                        <input type="text" className={inputClass} placeholder="مثال: مصرف الراجحي" value={paymentConfig.bankName} onChange={e => setPaymentConfig({...paymentConfig, bankName: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className={labelClass}>اسم صاحب الحساب</label>
                                        <input type="text" className={inputClass} value={paymentConfig.accountName} onChange={e => setPaymentConfig({...paymentConfig, accountName: e.target.value})} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelClass}>رقم الآيبان (IBAN)</label>
                                    <input type="text" className={`${inputClass} font-mono text-left`} dir="ltr" placeholder="SA..." value={paymentConfig.iban} onChange={e => setPaymentConfig({...paymentConfig, iban: e.target.value})} />
                                </div>
                            </div>
                        </div>

                        {/* Action Button */}
                        <div className="lg:col-span-2">
                            <button 
                                onClick={handleSavePaymentConfig}
                                disabled={isSaving}
                                className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed transform active:scale-[0.99]"
                            >
                                {isSaving ? <Loader2 className="animate-spin"/> : <Save size={20}/>}
                                حفظ وتطبيق كافة الإعدادات
                            </button>
                        </div>

                    </div>
                )}

            </main>
        </div>
    );
};

export default SystemDashboard;