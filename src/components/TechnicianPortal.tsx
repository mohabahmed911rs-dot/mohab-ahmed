import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PhoneCall,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Search,
  History,
  Home,
  LogOut,
  Loader2,
  Clock,
  RefreshCw,
  Edit3,
  Trash2,
  X,
} from 'lucide-react';
import { MakkahWeLogo } from './MakkahWeLogo';
import type { AuthenticatedUser } from './LoginView';
import { validateLandlineNumber, normalizeArabicDigits } from '../utils/ftthRules';

interface TechnicianRegistration {
  id: number;
  technicianId: number;
  technicianCode: string;
  technicianName: string;
  landlineNumber: string;
  registrationDate: string;
  registrationTime: string;
  registrationMonth: string;
}

interface CairoTimeInfo {
  date: string;
  time: string;
  month: string;
  formattedArabicDate: string;
  timezone: string;
}

interface TechnicianPortalProps {
  token: string;
  user: AuthenticatedUser;
  onLogout: () => void;
}

export const TechnicianPortal: React.FC<TechnicianPortalProps> = ({ token, user, onLogout }) => {
  const [activeTab, setActiveTab] = useState<'home' | 'history'>('home');
  const [landlineInput, setLandlineInput] = useState('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [successCelebration, setSuccessCelebration] = useState<{
    landlineNumber: string;
    date: string;
    time: string;
  } | null>(null);

  // Edit Registration Modal State
  const [editingReg, setEditingReg] = useState<TechnicianRegistration | null>(null);
  const [editLandline, setEditLandline] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [cairoTime, setCairoTime] = useState<CairoTimeInfo>({
    date: new Date().toISOString().slice(0, 10),
    time: '00:00:00',
    month: new Date().toISOString().slice(0, 7),
    formattedArabicDate: '',
    timezone: 'Africa/Cairo',
  });

  const cacheKey = `makkah_we_tech_cache_${user.id}`;
  const cachedTechData = React.useMemo(() => {
    try {
      const raw = localStorage.getItem(cacheKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, [cacheKey]);

  const [stats, setStats] = useState(
    cachedTechData?.stats || {
      dailyCount: 0,
      monthlyCount: 0,
      totalCount: 0,
    }
  );

  const [registrations, setRegistrations] = useState<TechnicianRegistration[]>(
    cachedTechData?.registrations || []
  );

  // History Filters
  const [historySearch, setHistorySearch] = useState('');
  const [historyDateFilter, setHistoryDateFilter] = useState('');
  const [historyMonthFilter, setHistoryMonthFilter] = useState('');

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  };

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoadingData(true);
      const res = await fetch('/api/technician/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 401 || res.status === 403) {
        onLogout();
        return;
      }
      const data = await res.json();
      if (res.ok) {
        setCairoTime(data.cairoTime);
        setSelectedDate((prev) => prev || data.cairoTime.date);
        setStats(data.stats);
        setRegistrations(data.registrations || []);
        try {
          localStorage.setItem(
            cacheKey,
            JSON.stringify({
              stats: data.stats,
              registrations: data.registrations || [],
            })
          );
        } catch {
          // Ignore storage errors
        }
      }
    } catch (err) {
      console.error('Failed to load technician dashboard:', err);
    } finally {
      setLoadingData(false);
    }
  }, [token, onLogout, cacheKey]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Keep Egypt local time refreshed every 30 seconds
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/cairo-time');
        if (res.ok) {
          const data = await res.json();
          setCairoTime(data);
        }
      } catch {
        // Ignore transient offline check
      }
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleLandlineChange = (value: string) => {
    setLandlineInput(value);
    if (validationError) {
      const check = validateLandlineNumber(value);
      if (check.valid) {
        setValidationError(null);
      }
    }
  };

  const handleSaveLandline = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);
    setSuccessCelebration(null);

    const check = validateLandlineNumber(landlineInput);
    if (!check.valid) {
      setValidationError(check.error || 'رقم التليفون الأرضي غير صالح.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/technician/registrations', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          landlineNumber: check.cleaned,
          registrationDate: selectedDate || cairoTime.date,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setValidationError(data.error || 'تعذر حفظ رقم التليفون الأرضي.');
        return;
      }

      setLandlineInput('');
      if (data.cairoTime) {
        setCairoTime(data.cairoTime);
      }
      setSuccessCelebration({
        landlineNumber: data.registration.landlineNumber,
        date: data.registration.registrationDate,
        time: data.registration.registrationTime,
      });

      await fetchDashboardData();
    } catch {
      setValidationError('تعذر الاتصال بقاعدة البيانات المركزية. يرجى المحاولة مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (reg: TechnicianRegistration) => {
    setEditingReg(reg);
    setEditLandline(reg.landlineNumber);
    setEditDate(reg.registrationDate);
    setEditError(null);
  };

  const handleUpdateRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReg) return;
    setEditError(null);

    const check = validateLandlineNumber(editLandline);
    if (!check.valid) {
      setEditError(check.error || 'رقم التليفون الأرضي غير صالح.');
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch(`/api/technician/registrations/${editingReg.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          landlineNumber: check.cleaned,
          registrationDate: editDate || editingReg.registrationDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error || 'تعذر حفظ التعديلات.');
        return;
      }
      setEditingReg(null);
      showToast(data.message || 'تم تعديل الرقم والتاريخ بنجاح.');
      await fetchDashboardData();
    } catch {
      setEditError('تعذر الاتصال بالخادم.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteRegistration = async (reg: TechnicianRegistration) => {
    try {
      const res = await fetch(`/api/technician/registrations/${reg.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `تم حذف الرقم (${reg.landlineNumber}) بنجاح.`);
        await fetchDashboardData();
      } else if (data.error) {
        showToast(data.error);
      }
    } catch {
      showToast('تعذر حذف التسجيل.');
    }
  };

  const normalizedDigitsPreview = normalizeArabicDigits(landlineInput);

  const filteredHistory = registrations.filter((reg) => {
    if (historySearch.trim()) {
      const q = normalizeArabicDigits(historySearch.trim());
      if (!reg.landlineNumber.includes(q) && !reg.registrationDate.includes(q)) {
        return false;
      }
    }
    if (historyDateFilter && reg.registrationDate !== historyDateFilter) {
      return false;
    }
    if (historyMonthFilter && reg.registrationMonth !== historyMonthFilter) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-8">
      {/* WebApp Top Header Bar */}
      <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-4 px-4 sm:px-6 py-3.5 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <a
          href="#top"
          className="text-base sm:text-lg font-extrabold tracking-tight text-purple-950 whitespace-nowrap shrink-0"
        >
          MAKKAH WE – FTTH
        </a>

        <nav
          className="flex items-center gap-4 sm:gap-6 text-xs sm:text-sm font-medium text-slate-600"
          aria-label="تنقل الفني"
        >
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className={`inline-flex items-center gap-1.5 hover:text-purple-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 ${
              activeTab === 'home' ? 'text-purple-900 font-bold underline underline-offset-8' : ''
            }`}
          >
            <Home className="w-4 h-4" />
            <span>الرئيسية وتسجيل الخطوط</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`inline-flex items-center gap-1.5 hover:text-purple-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer py-1 ${
              activeTab === 'history' ? 'text-purple-900 font-bold underline underline-offset-8' : ''
            }`}
          >
            <History className="w-4 h-4" />
            <span>سجل التركيبات ({stats.totalCount})</span>
          </button>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 hover:text-red-700 hover:bg-red-50 border border-slate-200 transition whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              role="status"
              className="p-4 rounded-2xl bg-emerald-900 text-white text-xs sm:text-sm font-bold flex items-center justify-between shadow-md"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0" />
                <span>{toastMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                className="text-xs text-emerald-200 hover:text-white px-2 cursor-pointer"
              >
                إغلاق
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WELCOME BANNER SECTION */}
        <section
          aria-label="بطاقة ترحيب الفني"
          className="rounded-3xl bg-gradient-to-br from-[#2E1065] via-[#4C1D95] to-[#3B0764] text-white p-6 sm:p-8 shadow-md border border-purple-800/40"
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-3">
              <MakkahWeLogo size="md" light />
              <div>
                <p className="text-xs text-purple-200 font-medium">مرحباً بك في بوابة فنيي الألياف الضوئية</p>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-0.5">
                  {user.fullName}
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-purple-100 pt-1">
                <span>
                  كود الفني:{' '}
                  <strong className="font-mono-tabular text-white">{user.technicianCode}</strong>
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  التاريخ اليوم:{' '}
                  <strong className="font-mono-tabular text-white">{cairoTime.date}</strong>
                </span>
                {cairoTime.formattedArabicDate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{cairoTime.formattedArabicDate}</span>
                  </>
                )}
              </div>
            </div>

            {/* Technician Live Quick Counters */}
            <div className="grid grid-cols-3 gap-3 sm:gap-4 bg-purple-950/45 border border-purple-400/20 rounded-2xl p-4 shrink-0">
              <div className="text-center px-2">
                <p className="text-[11px] text-purple-200">تركيبات اليوم</p>
                <p
                  data-testid="tech-daily-count"
                  className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mt-1"
                >
                  {stats.dailyCount}
                </p>
              </div>
              <div className="text-center px-2 border-x border-purple-400/20">
                <p className="text-[11px] text-purple-200">تركيبات الشهر</p>
                <p
                  data-testid="tech-monthly-count"
                  className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mt-1"
                >
                  {stats.monthlyCount}
                </p>
              </div>
              <div className="text-center px-2">
                <p className="text-[11px] text-purple-200">إجمالي السجل</p>
                <p
                  data-testid="tech-total-count"
                  className="text-2xl sm:text-3xl font-extrabold font-mono-tabular text-white mt-1"
                >
                  {stats.totalCount}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* TAB 1: HOME & LANDLINE REGISTRATION */}
        {activeTab === 'home' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Landline Registration Form Card */}
            <motion.section
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-7 bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                    تسجيل خط أرضي جديد (FTTH)
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    يتم الحفظ والمزامنة تلقائياً مع قاعدة البيانات المركزية ولوحة المسؤول
                  </p>
                </div>
                <div className="w-11 h-11 rounded-2xl bg-purple-100 text-purple-800 flex items-center justify-center shrink-0">
                  <PhoneCall className="w-5 h-5" />
                </div>
              </div>

              <form onSubmit={handleSaveLandline} className="mt-6 space-y-5" noValidate>
                {/* LANDLINE REGISTRATION SECTION */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="landline-number-input"
                      className="text-sm sm:text-base font-extrabold text-slate-900"
                    >
                      رقم التليفون الأرضي
                    </label>
                    <span className="text-xs font-mono-tabular text-slate-500">
                      {normalizedDigitsPreview.length} / 8 أرقام
                    </span>
                  </div>

                  <input
                    id="landline-number-input"
                    type="text"
                    inputMode="numeric"
                    dir="ltr"
                    maxLength={12}
                    placeholder="أدخل 8 أرقام (مثال: 23456789)"
                    value={landlineInput}
                    onChange={(e) => handleLandlineChange(e.target.value)}
                    className={`w-full rounded-2xl border px-4 py-4 text-center font-mono-tabular font-bold transition focus:outline-none focus:ring-3 ${
                      landlineInput
                        ? 'tracking-widest text-xl sm:text-2xl'
                        : 'tracking-normal text-sm sm:text-base'
                    } ${
                      validationError
                        ? 'border-red-400 bg-red-50/40 text-red-900 focus:border-red-600 focus:ring-red-500/20'
                        : 'border-slate-300 bg-slate-50/70 text-slate-900 focus:bg-white focus:border-purple-700 focus:ring-purple-700/20'
                    }`}
                  />
                  <p className="mt-2 text-xs text-slate-500">
                    يجب أن يتكون الرقم من 8 أرقام عددية بالضبط بدون حروف أو رموز أو مسافات.
                  </p>
                </div>

                {/* Validation Error Message */}
                <AnimatePresence>
                  {validationError && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      role="alert"
                      data-testid="landline-error-alert"
                      className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-start gap-2.5"
                    >
                      <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                      <span className="font-bold leading-relaxed">{validationError}</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* EDITABLE DATE SECTION */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs text-slate-600">
                    <label
                      htmlFor="landline-date-input"
                      className="font-bold flex items-center gap-1.5 text-slate-800 cursor-pointer"
                    >
                      <Calendar className="w-4 h-4 text-purple-800" />
                      <span>تاريخ التسجيل (يمكنك تعديل التاريخ عند الحاجة)</span>
                    </label>
                    {selectedDate && selectedDate !== cairoTime.date && (
                      <button
                        type="button"
                        onClick={() => setSelectedDate(cairoTime.date)}
                        className="text-xs font-bold text-purple-800 hover:underline cursor-pointer"
                      >
                        العودة لتاريخ اليوم ({cairoTime.date})
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                    <input
                      id="landline-date-input"
                      type="date"
                      dir="ltr"
                      value={selectedDate || cairoTime.date}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 font-mono-tabular text-sm font-extrabold text-slate-900 focus:border-purple-700 focus:outline-none"
                    />
                    <span className="text-xs text-slate-600">{cairoTime.formattedArabicDate}</span>
                  </div>
                </div>

                {/* SAVE BUTTON: حفظ البيانات */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={submitting}
                  className="w-full min-h-[54px] rounded-2xl bg-gradient-to-r from-[#4C1D95] via-[#6B21A8] to-[#581C87] hover:from-[#3B0764] hover:to-[#4C1D95] text-white font-extrabold text-base sm:text-lg py-4 px-6 shadow-md transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>جاري حفظ البيانات والمزامنة...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      <span>حفظ البيانات</span>
                    </>
                  )}
                </motion.button>
              </form>

              {/* Animated Success Celebration after saving a landline number */}
              <AnimatePresence>
                {successCelebration && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.94, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    role="status"
                    data-testid="save-success-banner"
                    className="mt-6 p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950"
                  >
                    <div className="flex items-start gap-3">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                        className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"
                      >
                        <CheckCircle2 className="w-6 h-6" />
                      </motion.div>
                      <div className="flex-1">
                        <h3 className="text-sm sm:text-base font-extrabold text-emerald-900">
                          تم حفظ رقم التليفون الأرضي بنجاح!
                        </h3>
                        <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                          تم تسجيل الرقم{' '}
                          <strong className="font-mono-tabular text-sm">
                            {successCelebration.landlineNumber}
                          </strong>{' '}
                          في سجل التركيبات الخاص بك ومزامنته فوراً مع لوحة تحكم المسؤول.
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-emerald-700 font-mono-tabular">
                          <span>التاريخ: {successCelebration.date}</span>
                          <span aria-hidden="true">·</span>
                          <span>الوقت: {successCelebration.time}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>

            {/* Quick Recent Installations Preview on Home with Direct Edit & Delete */}
            <section className="lg:col-span-5 bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 shadow-xs">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                    أحدث تركيباتك المسجلة
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    يمكنك تعديل الرقم أو التاريخ أو حذف أي رقم كتبته بالخطأ
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className="text-xs font-bold text-purple-800 hover:text-purple-950 underline underline-offset-4 cursor-pointer min-h-[40px] px-2"
                >
                  عرض كل السجل
                </button>
              </div>

              {loadingData && registrations.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-700" />
                  <span className="text-xs">جاري تحديث سجل التركيبات...</span>
                </div>
              ) : registrations.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-xs space-y-1">
                  <p className="font-bold text-slate-700">لا توجد تركيبات مسجلة حتى الآن</p>
                  <p>ابدأ بإدخال رقم التليفون الأرضي (8 أرقام) ثم اضغط حفظ البيانات.</p>
                </div>
              ) : (
                <div className="mt-4 divide-y divide-slate-100">
                  {registrations.slice(0, 6).map((reg) => (
                    <div
                      key={reg.id}
                      className="py-3.5 flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-800 flex items-center justify-center font-mono-tabular font-bold text-xs shrink-0">
                          FTTH
                        </div>
                        <div>
                          <p className="font-mono-tabular font-extrabold text-slate-900 text-base">
                            {reg.landlineNumber}
                          </p>
                          <p className="text-xs text-slate-500 font-mono-tabular">
                            {reg.registrationDate} · {reg.registrationTime}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(reg)}
                          aria-label={`تعديل رقم ${reg.landlineNumber}`}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteRegistration(reg)}
                          aria-label={`حذف رقم ${reg.landlineNumber}`}
                          className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* TAB 2: TECHNICIAN REGISTRATION HISTORY (سجل التركيبات) */}
        {activeTab === 'history' && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
              <div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">سجل التركيبات</h2>
                <p className="text-xs sm:text-sm text-slate-500 mt-1">
                  يعرض هذا السجل جميع الخطوط الأرضية المسجلة بحسابك ({user.technicianCode}) مع إمكانية تعديل الرقم أو التاريخ أو الحذف.
                </p>
              </div>
              <button
                type="button"
                onClick={fetchDashboardData}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition cursor-pointer self-start sm:self-auto min-h-[42px]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>تحديث السجل</span>
              </button>
            </div>

            {/* Summary KPI Strip for History */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">عدد التركيبات اليوم ({cairoTime.date})</p>
                <p className="text-2xl font-extrabold font-mono-tabular text-purple-900 mt-1">
                  {stats.dailyCount}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">عدد التركيبات هذا الشهر ({cairoTime.month})</p>
                <p className="text-2xl font-extrabold font-mono-tabular text-purple-900 mt-1">
                  {stats.monthlyCount}
                </p>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">إجمالي تركيباتك المسجلة</p>
                <p className="text-2xl font-extrabold font-mono-tabular text-slate-900 mt-1">
                  {stats.totalCount}
                </p>
              </div>
            </div>

            {/* Search & Date Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label
                  htmlFor="tech-history-search"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  بحث برقم التليفون الأرضي
                </label>
                <div className="relative">
                  <input
                    id="tech-history-search"
                    type="text"
                    dir="ltr"
                    placeholder="ابحث بالرقم الأرضي..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-tabular focus:border-purple-700 focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>

              <div>
                <label
                  htmlFor="tech-history-date"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  تصفية حسب التاريخ
                </label>
                <input
                  id="tech-history-date"
                  type="date"
                  dir="ltr"
                  value={historyDateFilter}
                  onChange={(e) => setHistoryDateFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-tabular focus:border-purple-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="tech-history-month"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  تصفية حسب الشهر
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="tech-history-month"
                    type="month"
                    dir="ltr"
                    value={historyMonthFilter}
                    onChange={(e) => setHistoryMonthFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-tabular focus:border-purple-700 focus:outline-none"
                  />
                  {(historySearch || historyDateFilter || historyMonthFilter) && (
                    <button
                      type="button"
                      onClick={() => {
                        setHistorySearch('');
                        setHistoryDateFilter('');
                        setHistoryMonthFilter('');
                      }}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 whitespace-nowrap cursor-pointer min-h-[42px]"
                    >
                      إلغاء التصفية
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Registrations Table with Edit & Delete Actions */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                    <th className="py-3.5 px-4">#</th>
                    <th className="py-3.5 px-4">رقم التليفون الأرضي</th>
                    <th className="py-3.5 px-4">تاريخ التسجيل</th>
                    <th className="py-3.5 px-4">وقت التسجيل</th>
                    <th className="py-3.5 px-4">كود الفني</th>
                    <th className="py-3.5 px-4">تعديل / حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-500 text-xs">
                        لا توجد سجلات مطابقة لمعايير البحث الحالية.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-500">
                          {idx + 1}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular font-extrabold text-base text-purple-950">
                          {item.landlineNumber}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-slate-700">
                          {item.registrationDate}
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-slate-600">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {item.registrationTime}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-600">
                          {item.technicianCode}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              aria-label={`تعديل رقم ${item.landlineNumber}`}
                              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>تعديل الرقم والتاريخ</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRegistration(item)}
                              aria-label={`حذف رقم ${item.landlineNumber}`}
                              className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.section>
        )}

      </main>

      {/* Edit Landline Number & Date Modal */}
      {editingReg && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="tech-edit-reg-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 id="tech-edit-reg-title" className="text-base font-extrabold text-slate-900">
                تعديل رقم التليفون الأرضي والتاريخ
              </h3>
              <button
                type="button"
                onClick={() => setEditingReg(null)}
                aria-label="إغلاق"
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
                {editError}
              </div>
            )}

            <form onSubmit={handleUpdateRegistration} className="mt-4 space-y-4">
              <div>
                <label
                  htmlFor="tech-edit-landline-input"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  رقم التليفون الأرضي (8 أرقام)
                </label>
                <input
                  id="tech-edit-landline-input"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  required
                  maxLength={8}
                  value={editLandline}
                  onChange={(e) => setEditLandline(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-mono-tabular font-bold text-slate-900 focus:border-purple-700 focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="tech-edit-date-input"
                  className="block text-xs font-bold text-slate-700 mb-1.5"
                >
                  تاريخ التسجيل
                </label>
                <input
                  id="tech-edit-date-input"
                  type="date"
                  dir="ltr"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-tabular font-bold text-slate-900 focus:border-purple-700 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingReg(null)}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer min-h-[40px]"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#4C1D95] hover:bg-[#3B0764] text-white text-xs font-bold transition cursor-pointer min-h-[40px]"
                >
                  {editSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>حفظ التعديل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
