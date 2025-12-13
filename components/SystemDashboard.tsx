import React, { useState, useEffect } from 'react';
import { School, Wallet, Search, Filter, Shield, Key, Trash2, CheckCircle, TrendingUp, CreditCard, Landmark, Globe, Save, Loader2, Copy, AlertOctagon, UserCog, LogOut, MoreVertical, Calendar } from 'lucide-react';
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
    onLogout: () => void;
    pricing: PricingConfig;
    onSavePricing: (config: PricingConfig) => void;
}

// --- Styles ---
const cardClass = "bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden";
const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50 transition-all";
const labelClass = "block text-xs font-bold text-slate-500 mb-1.5 mr-1";
const badgeClass = "px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1";

const SystemDashboard: React.FC<SystemDashboardProps> = ({ 
    schools, 
    onSelectSchool, 
    onDeleteSchool, 
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
            // Simulate delay for effect
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

    const copyCredentials = (school: SchoolMetadata) => {
        const text = `رابط النظام: ${window.location.origin}\nاسم المستخدم: ${school.adminUsername}\nكلمة المرور: ${school.adminPassword}`;
        navigator.clipboard.writeText(text);
        alert(`تم نسخ بيانات دخول: ${school.name}`);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800" dir="rtl">
            
            {/* Top Navbar */}
            <header className="bg-slate-900 text-white sticky top-0 z-50 shadow-lg border-b border-slate-800">
                <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-lg"><UserCog size={20} className="text-white"/></div>
                        <div>
                            <h1 className="font-bold text-lg leading-tight">لوحة تحكم النظام</h1>
                            <p className="text-[10px] text-slate-400">الإدارة المركزية</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 text-xs font-mono bg-slate-800 px-3 py-1.5 rounded-full border border-slate-700 text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            System Online
                        </div>
                        <button onClick={onLogout} className="flex items-center gap-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg transition-all">
                            <LogOut size={14}/> خروج
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
                
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-slideDown">
                    <div className={`${cardClass} p-5 flex items-center justify-between border-l-4 border-l-indigo-500`}>
                        <div>
                            <p className="text-slate-500 text-xs font-bold mb-1">إجمالي المدارس</p>
                            <h3 className="text-3xl font-extrabold text-slate-800">{stats.total}</h3>
                        </div>
                        <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600"><School size={24}/></div>
                    </div>
                    <div className={`${cardClass} p-5 flex items-center justify-between border-l-4 border-l-emerald-500`}>
                        <div>
                            <p className="text-slate-500 text-xs font-bold mb-1">الاشتراكات النشطة</p>
                            <h3 className="text-3xl font-extrabold text-emerald-600">{stats.active}</h3>
                        </div>
                        <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600"><CheckCircle size={24}/></div>
                    </div>
                    <div className={`${cardClass} p-5 flex items-center justify-between border-l-4 border-l-amber-500`}>
                        <div>
                            <p className="text-slate-500 text-xs font-bold mb-1">فترة تجريبية</p>
                            <h3 className="text-3xl font-extrabold text-amber-600">{stats.trial}</h3>
                        </div>
                        <div className="bg-amber-50 p-3 rounded-xl text-amber-600"><CreditCard size={24}/></div>
                    </div>
                    <div className={`${cardClass} p-5 flex items-center justify-between border-l-4 border-l-blue-500`}>
                        <div>
                            <p className="text-slate-500 text-xs font-bold mb-1">إجمالي الإيرادات</p>
                            <h3 className="text-3xl font-extrabold text-blue-600">{stats.revenue.toLocaleString()} <span className="text-xs font-normal text-slate-400">{pricing.currency}</span></h3>
                        </div>
                        <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><TrendingUp size={24}/></div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-4 border-b border-slate-200 pb-1">
                    <button 
                        onClick={() => setActiveTab('schools')}
                        className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'schools' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <School size={18}/> إدارة المدارس
                    </button>
                    <button 
                        onClick={() => setActiveTab('finance')}
                        className={`pb-3 px-2 text-sm font-bold flex items-center gap-2 transition-all ${activeTab === 'finance' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                        <Wallet size={18}/> الإعدادات المالية
                    </button>
                </div>

                {/* --- SCHOOLS TAB --- */}
                {activeTab === 'schools' && (
                    <div className="space-y-6 animate-fadeIn">
                        {/* Search & Filter */}
                        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                            <div className="relative w-full md:w-96">
                                <input 
                                    type="text" 
                                    placeholder="بحث باسم المدرسة، المستخدم، أو الإيميل..." 
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-4 pr-10 py-3 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                                <Search className="absolute right-3 top-3.5 text-slate-400" size={18}/>
                            </div>
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                <Filter size={18} className="text-slate-400 ml-1"/>
                                <select 
                                    className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-600 outline-none cursor-pointer hover:bg-slate-100"
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value as any)}
                                >
                                    <option value="all">جميع الحالات</option>
                                    <option value="active">نشط فقط</option>
                                    <option value="trial">تجريبي</option>
                                    <option value="expired">منتهي الصلاحية</option>
                                </select>
                            </div>
                        </div>

                        {/* Schools Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {filteredSchools.length === 0 ? (
                                <div className="col-span-full py-20 bg-white rounded-3xl border border-dashed border-slate-300 text-center flex flex-col items-center">
                                    <div className="bg-slate-50 p-6 rounded-full mb-4"><Search size={40} className="text-slate-300"/></div>
                                    <h3 className="text-lg font-bold text-slate-700">لا توجد نتائج مطابقة</h3>
                                    <p className="text-slate-400 text-sm mt-1">جرب تغيير كلمات البحث أو الفلتر</p>
                                </div>
                            ) : (
                                filteredSchools.map(school => {
                                    const isExpired = new Date(school.subscriptionEnd) < new Date();
                                    const daysRemaining = Math.ceil((new Date(school.subscriptionEnd).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                                    
                                    return (
                                        <div key={school.id} className={`${cardClass} flex flex-col group relative`}>
                                            {/* Status Stripe */}
                                            <div className={`h-1.5 w-full ${isExpired ? 'bg-rose-500' : school.plan === 'trial' ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
                                            
                                            <div className="p-5 flex justify-between items-start">
                                                <div>
                                                    <h3 className="font-bold text-lg text-slate-800 group-hover:text-indigo-700 transition-colors">{school.name}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className={`text-[10px] px-2 py-0.5 rounded border ${
                                                            school.plan === 'annual' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                                            school.plan === 'quarterly' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                                            'bg-amber-50 text-amber-700 border-amber-100'
                                                        }`}>
                                                            {school.plan === 'annual' ? 'سنوي' : school.plan === 'quarterly' ? 'فصلي' : 'تجريبي'}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-mono">#{school.id.slice(-6)}</span>
                                                    </div>
                                                </div>
                                                <button onClick={() => copyCredentials(school)} className="text-slate-300 hover:text-indigo-500 transition-colors" title="نسخ بيانات الدخول">
                                                    <Copy size={18}/>
                                                </button>
                                            </div>

                                            <div className="px-5 py-3 space-y-3 bg-slate-50/50 border-y border-slate-50">
                                                <div className="flex justify-between items-center text-xs">
                                                    <span className="text-slate-500 flex items-center gap-1"><Calendar size={12}/> انتهاء الاشتراك</span>
                                                    <span className={`font-mono font-bold ${daysRemaining < 7 ? 'text-rose-600' : 'text-slate-700'}`}>
                                                        {new Date(school.subscriptionEnd).toLocaleDateString('en-GB')}
                                                    </span>
                                                </div>
                                                <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                                    <div 
                                                        className={`h-full rounded-full ${daysRemaining < 7 ? 'bg-rose-500' : daysRemaining < 30 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                                        style={{ width: `${Math.min(100, Math.max(0, (daysRemaining / 365) * 100))}%` }}
                                                    ></div>
                                                </div>
                                                <p className={`text-[10px] text-right ${daysRemaining < 0 ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                                                    {daysRemaining < 0 ? 'اشتراك منتهي' : `متبقي ${daysRemaining} يوم`}
                                                </p>
                                            </div>

                                            <div className="p-4 grid grid-cols-2 gap-3 mt-auto">
                                                <button 
                                                    onClick={() => onSelectSchool(school.id)}
                                                    className="bg-slate-800 hover:bg-indigo-600 text-white py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Shield size={14}/> إدارة
                                                </button>
                                                <button 
                                                    onClick={() => { if(window.confirm(`هل أنت متأكد من حذف ${school.name}؟ لا يمكن التراجع.`)) onDeleteSchool(school.id) }}
                                                    className="bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-rose-600 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                                                >
                                                    <Trash2 size={14}/> حذف
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
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