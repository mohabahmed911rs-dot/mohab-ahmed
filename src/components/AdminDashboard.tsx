import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  Users,
  PhoneIncoming,
  FileSpreadsheet,
  CalendarRange,
  ShieldCheck,
  Globe,
  LogOut,
  Plus,
  Search,
  Edit3,
  Trash2,
  KeyRound,
  Eye,
  Download,
  RefreshCw,
  CheckCircle2,
  Power,
  Share2,
  Copy,
  Check,
  Loader2,
} from 'lucide-react';
import { MakkahWeLogo } from './MakkahWeLogo';
import type { AuthenticatedUser } from './LoginView';
import {
  TechnicianFormModal,
  PasswordResetModal,
  TechnicianActivityModal,
  RegistrationFormModal,
} from './AdminModals';
import type { AdminTechnicianItem, AdminRegistrationItem } from './AdminModals';

interface AuditLogItem {
  id: number;
  actorType: string;
  actorId: string;
  actorName: string;
  actionType: string;
  targetType: string;
  targetId: string;
  details: string;
  createdAt: string;
}

interface ArchivedMonthlyReportItem {
  id: number;
  reportMonth: string;
  title: string;
  totalRegistrations: number;
  activeTechniciansCount: number;
  summaryJson: string;
  generatedBy: string;
  createdAt: string;
}

interface MonthlyBreakdownItem {
  technicianId: number;
  technicianCode: string;
  technicianName: string;
  status: string;
  totalRegistrations: number;
  sharePercent: number;
  lastRegistrationDate: string;
}

interface AdminDashboardProps {
  token: string;
  user: AuthenticatedUser;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ token, user, onLogout }) => {
  const [activeSection, setActiveSection] = useState<
    'overview' | 'technicians' | 'registrations' | 'excel' | 'monthly' | 'control'
  >(() => {
    try {
      const saved = localStorage.getItem('makkah_we_admin_section');
      if (
        saved === 'overview' ||
        saved === 'technicians' ||
        saved === 'registrations' ||
        saved === 'excel' ||
        saved === 'monthly' ||
        saved === 'control'
      ) {
        return saved;
      }
    } catch {
      // Ignore storage errors
    }
    return 'overview';
  });

  useEffect(() => {
    try {
      localStorage.setItem('makkah_we_admin_section', activeSection);
    } catch {
      // Ignore storage errors
    }
  }, [activeSection]);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [cairoTime, setCairoTime] = useState({
    date: new Date().toISOString().slice(0, 10),
    time: '00:00:00',
    month: new Date().toISOString().slice(0, 7),
    formattedArabicDate: '',
  });

  // Load cached admin snapshot so added technicians and registrations are visible immediately on reload
  const cachedAdmin = React.useMemo(() => {
    try {
      const raw = localStorage.getItem('makkah_we_admin_cache_v1');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }, []);

  // Overview state
  const [stats, setStats] = useState(
    cachedAdmin?.stats || {
      totalTechnicians: 0,
      registrationsToday: 0,
      registrationsThisMonth: 0,
      totalRegistrations: 0,
      activeTechnicians: 0,
      disabledTechnicians: 0,
    }
  );
  const [dailyTrend, setDailyTrend] = useState<Array<{ date: string; count: number }>>(
    cachedAdmin?.dailyTrend || []
  );
  const [technicians, setTechnicians] = useState<AdminTechnicianItem[]>(
    cachedAdmin?.technicians || []
  );
  const [registrations, setRegistrations] = useState<AdminRegistrationItem[]>(
    cachedAdmin?.registrations || []
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Technician Filters
  const [techSearch, setTechSearch] = useState('');
  const [techStatusFilter, setTechStatusFilter] = useState<'all' | 'active' | 'disabled'>('all');

  // Registration Filters
  const [regSearchLandline, setRegSearchLandline] = useState('');
  const [regSearchCode, setRegSearchCode] = useState('');
  const [regSearchName, setRegSearchName] = useState('');
  const [regDateFilter, setRegDateFilter] = useState('');
  const [regMonthFilter, setRegMonthFilter] = useState('');
  const [regTechIdFilter, setRegTechIdFilter] = useState<string>('');

  // Excel Export Center Parameters
  const [excelDate, setExcelDate] = useState('');
  const [excelMonth, setExcelMonth] = useState('');
  const [excelTechCode, setExcelTechCode] = useState('');
  const [excelStartDate, setExcelStartDate] = useState('');
  const [excelEndDate, setExcelEndDate] = useState('');
  const [downloadingExcel, setDownloadingExcel] = useState<string | null>(null);

  // Monthly Report State
  const [selectedReportMonth, setSelectedReportMonth] = useState('');
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [monthlyReportData, setMonthlyReportData] = useState<{
    reportMonth: string;
    totalRegistrations: number;
    activeContributorsCount: number;
    totalTechniciansCount: number;
    technicianBreakdown: MonthlyBreakdownItem[];
    registrations: AdminRegistrationItem[];
  } | null>(null);
  const [archivedReports, setArchivedReports] = useState<ArchivedMonthlyReportItem[]>([]);
  const [generatingMonthly, setGeneratingMonthly] = useState(false);

  // Modals State
  const [techModalOpen, setTechModalOpen] = useState(false);
  const [editingTech, setEditingTech] = useState<AdminTechnicianItem | null>(null);
  const [resetPwTech, setResetPwTech] = useState<AdminTechnicianItem | null>(null);
  const [activityTech, setActivityTech] = useState<AdminTechnicianItem | null>(null);
  const [regModalOpen, setRegModalOpen] = useState(false);
  const [editingReg, setEditingReg] = useState<AdminRegistrationItem | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const fetchAllAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [overviewRes, techsRes, regsRes, monthlyRes, logsRes] = await Promise.all([
        fetch('/api/admin/overview', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/technicians', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/registrations', { headers: { Authorization: `Bearer ${token}` } }),
        fetch(
          `/api/admin/monthly-reports${selectedReportMonth ? `?month=${selectedReportMonth}` : ''}`,
          { headers: { Authorization: `Bearer ${token}` } }
        ),
        fetch('/api/admin/audit-logs', { headers: { Authorization: `Bearer ${token}` } }),
      ]);

      if (overviewRes.status === 401 || overviewRes.status === 403) {
        onLogout();
        return;
      }

      let nextStats = stats;
      let nextTrend = dailyTrend;
      let nextTechs = technicians;
      let nextRegs = registrations;

      if (overviewRes.ok) {
        const ov = await overviewRes.json();
        setCairoTime(ov.cairoTime);
        setStats(ov.stats);
        setDailyTrend(ov.dailyTrend || []);
        nextStats = ov.stats;
        nextTrend = ov.dailyTrend || [];
        if (!excelDate) setExcelDate(ov.cairoTime.date);
        if (!excelMonth) setExcelMonth(ov.cairoTime.month);
        if (!selectedReportMonth) setSelectedReportMonth(ov.cairoTime.month);
      }

      if (techsRes.ok) {
        const td = await techsRes.json();
        setTechnicians(td.technicians || []);
        nextTechs = td.technicians || [];
        if (!excelTechCode && td.technicians?.length > 0) {
          setExcelTechCode(td.technicians[0].technicianCode);
        }
      }

      if (regsRes.ok) {
        const rd = await regsRes.json();
        setRegistrations(rd.registrations || []);
        nextRegs = rd.registrations || [];
      }

      try {
        localStorage.setItem(
          'makkah_we_admin_cache_v1',
          JSON.stringify({
            stats: nextStats,
            dailyTrend: nextTrend,
            technicians: nextTechs,
            registrations: nextRegs,
          })
        );
      } catch {
        // Ignore storage errors
      }

      if (monthlyRes.ok) {
        const md = await monthlyRes.json();
        setAvailableMonths(md.availableMonths || []);
        setMonthlyReportData(md.report);
        setArchivedReports(md.archivedReports || []);
      }

      if (logsRes.ok) {
        const ld = await logsRes.json();
        setAuditLogs(ld.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch admin dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [token, onLogout, selectedReportMonth, excelDate, excelMonth, excelTechCode]);

  useEffect(() => {
    fetchAllAdminData();
  }, [fetchAllAdminData]);

  const handleToggleTechStatus = async (tech: AdminTechnicianItem) => {
    const nextStatus = tech.status === 'active' ? 'disabled' : 'active';
    try {
      const res = await fetch(`/api/admin/technicians/${tech.id}/status`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        await fetchAllAdminData();
      }
    } catch (err) {
      console.error('Error toggling technician status:', err);
    }
  };

  const handleDeleteTechnician = async (tech: AdminTechnicianItem) => {
    try {
      const res = await fetch(`/api/admin/technicians/${tech.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `تم حذف الفني ${tech.fullName} بنجاح.`);
        await fetchAllAdminData();
      } else if (data.error) {
        showToast(data.error);
      }
    } catch (err) {
      console.error('Error deleting technician:', err);
    }
  };

  const handleDeleteRegistration = async (reg: AdminRegistrationItem) => {
    try {
      const res = await fetch(`/api/admin/registrations/${reg.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        await fetchAllAdminData();
      }
    } catch (err) {
      console.error('Error deleting registration:', err);
    }
  };

  const handleDownloadExcel = async (params: {
    mode: 'all' | 'daily' | 'monthly' | 'technician' | 'range';
    date?: string;
    month?: string;
    technicianCode?: string;
    startDate?: string;
    endDate?: string;
    label: string;
  }) => {
    setDownloadingExcel(params.mode);
    try {
      const qs = new URLSearchParams({ mode: params.mode });
      if (params.date) qs.set('date', params.date);
      if (params.month) qs.set('month', params.month);
      if (params.technicianCode) qs.set('technicianCode', params.technicianCode);
      if (params.startDate) qs.set('startDate', params.startDate);
      if (params.endDate) qs.set('endDate', params.endDate);

      const res = await fetch(`/api/admin/export/excel?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        showToast('تعذر تصدير ملف Excel. يرجى المحاولة مرة أخرى.');
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `MAKKAH_WE_FTTH_${params.mode}_${params.date || params.month || params.technicianCode || 'Report'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      showToast(`تم تصدير وتحميل ملف Excel (${params.label}) بنجاح.`);
      await fetchAllAdminData();
    } catch (err) {
      console.error('Excel download error:', err);
      showToast('حدث خطأ أثناء تحميل ملف Excel.');
    } finally {
      setDownloadingExcel(null);
    }
  };

  const handleGenerateMonthlyArchive = async () => {
    setGeneratingMonthly(true);
    try {
      const res = await fetch('/api/admin/monthly-reports/generate', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ month: selectedReportMonth || cairoTime.month }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message);
        await fetchAllAdminData();
      }
    } catch (err) {
      console.error('Monthly archive error:', err);
    } finally {
      setGeneratingMonthly(false);
    }
  };

  // Filtered Technicians
  const filteredTechnicians = technicians.filter((t) => {
    if (techStatusFilter !== 'all' && t.status !== techStatusFilter) {
      return false;
    }
    if (techSearch.trim()) {
      const q = techSearch.trim().toLowerCase();
      return (
        t.technicianCode.toLowerCase().includes(q) ||
        t.fullName.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.governorate.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Filtered Registrations
  const filteredRegistrations = registrations.filter((r) => {
    if (regSearchLandline.trim() && !r.landlineNumber.includes(regSearchLandline.trim())) {
      return false;
    }
    if (
      regSearchCode.trim() &&
      !r.technicianCode.toLowerCase().includes(regSearchCode.trim().toLowerCase())
    ) {
      return false;
    }
    if (
      regSearchName.trim() &&
      !r.technicianName.toLowerCase().includes(regSearchName.trim().toLowerCase())
    ) {
      return false;
    }
    if (regDateFilter && r.registrationDate !== regDateFilter) {
      return false;
    }
    if (regMonthFilter && r.registrationMonth !== regMonthFilter) {
      return false;
    }
    if (regTechIdFilter && r.technicianId !== Number(regTechIdFilter)) {
      return false;
    }
    return true;
  });

  const maxTrendCount = Math.max(1, ...dailyTrend.map((d) => d.count));
  const maxTechRegs = Math.max(1, ...technicians.map((t) => t.totalRegistrations));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200">
        <a
          href="#top"
          className="text-lg font-extrabold tracking-tight text-purple-950 whitespace-nowrap shrink-0"
        >
          MAKKAH WE – FTTH
        </a>

        <nav
          className="hidden xl:flex items-center gap-6 text-sm font-medium text-slate-600"
          aria-label="التنقل الرئيسي للوحة المسؤول"
        >
          <button
            type="button"
            onClick={() => setActiveSection('overview')}
            className={`hover:text-purple-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'overview' ? 'text-purple-900 font-bold underline underline-offset-8' : ''
            }`}
          >
            الرئيسية
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('technicians')}
            className={`hover:text-purple-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'technicians' ? 'text-purple-900 font-bold underline underline-offset-8' : ''
            }`}
          >
            إدارة الفنيين
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('registrations')}
            className={`hover:text-purple-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'registrations' ? 'text-purple-900 font-bold underline underline-offset-8' : ''
            }`}
          >
            إدارة التركيبات
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('excel')}
            className={`hover:text-purple-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'excel' ? 'text-purple-900 font-bold underline underline-offset-8' : ''
            }`}
          >
            تقارير Excel
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('monthly')}
            className={`hover:text-purple-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeSection === 'monthly' ? 'text-purple-900 font-bold underline underline-offset-8' : ''
            }`}
          >
            التقارير الشهرية
          </button>
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-[#3B0764] hover:bg-[#2E1065] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer min-h-[40px]"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل خروج المسؤول</span>
          </button>
        </div>
      </header>

      {/* Workspace Canvas: Sidebar (260px) + Main Content Viewport */}
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1600px] w-full mx-auto">
        {/* Modern Purple & White Sidebar Navigation */}
        <aside className="lg:w-68 shrink-0 bg-white border-b lg:border-b-0 lg:border-l border-slate-200 p-4 sm:p-5 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-[#2E1065] via-[#3B0764] to-[#4C1D95] text-white">
              <MakkahWeLogo size="sm" light showSubtitle={false} />
              <p className="mt-3 text-xs text-purple-200">مركز تحكم المسؤول المعتمد</p>
              <p className="text-sm font-extrabold text-white truncate mt-0.5">{user.fullName}</p>
              <p className="text-[11px] text-purple-200/90 font-mono-tabular mt-1">
                توقيت مصر: {cairoTime.date}
              </p>
            </div>

            <nav className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-1 gap-1.5" aria-label="قائمة أقسام الإدارة">
              <button
                type="button"
                onClick={() => setActiveSection('overview')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap min-h-[44px] ${
                  activeSection === 'overview'
                    ? 'bg-[#4C1D95] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-purple-50 hover:text-purple-950'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span>لوحة الإحصائيات</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('technicians')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap min-h-[44px] ${
                  activeSection === 'technicians'
                    ? 'bg-[#4C1D95] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-purple-50 hover:text-purple-950'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                <span>إدارة الفنيين ({stats.totalTechnicians})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('registrations')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap min-h-[44px] ${
                  activeSection === 'registrations'
                    ? 'bg-[#4C1D95] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-purple-50 hover:text-purple-950'
                }`}
              >
                <PhoneIncoming className="w-4 h-4 shrink-0" />
                <span>إدارة التركيبات ({stats.totalRegistrations})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('excel')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap min-h-[44px] ${
                  activeSection === 'excel'
                    ? 'bg-[#4C1D95] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-purple-50 hover:text-purple-950'
                }`}
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" />
                <span>تصدير تقارير Excel</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('monthly')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap min-h-[44px] ${
                  activeSection === 'monthly'
                    ? 'bg-[#4C1D95] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-purple-50 hover:text-purple-950'
                }`}
              >
                <CalendarRange className="w-4 h-4 shrink-0" />
                <span>التقارير الشهرية</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveSection('control')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer whitespace-nowrap min-h-[44px] ${
                  activeSection === 'control'
                    ? 'bg-[#4C1D95] text-white shadow-xs'
                    : 'text-slate-700 hover:bg-purple-50 hover:text-purple-950'
                }`}
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>مركز التحكم والرقابة</span>
              </button>
            </nav>
          </div>

          <div className="hidden lg:block pt-6 border-t border-slate-100">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              جميع العمليات محمية بنظام الصلاحيات وتُسجل تلقائياً في سجل الرقابة المركزي.
            </p>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 overflow-x-hidden">
          {/* Toast Notification */}
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

          {/* ===============================================================
              SECTION 1: DASHBOARD HOME (OVERVIEW & 6 KPI STATISTICS)
          =============================================================== */}
          {activeSection === 'overview' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Header & Quick Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    لوحة تحكم المسؤول — الإحصائيات المركزية
                  </h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>التاريخ الحالي بتوقيت مصر: {cairoTime.date}</span>
                    <span aria-hidden="true">·</span>
                    <span>{cairoTime.formattedArabicDate}</span>
                    <span aria-hidden="true">·</span>
                    <span>تحديث لحظي من قاعدة البيانات</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTech(null);
                      setTechModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#3B0764] text-white text-xs font-bold transition cursor-pointer whitespace-nowrap min-h-[42px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة فني جديد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadExcel({
                        mode: 'all',
                        label: 'جميع التركيبات الشاملة',
                      })
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap min-h-[42px]"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تصدير Excel الشامل</span>
                  </button>

                  <button
                    type="button"
                    onClick={fetchAllAdminData}
                    aria-label="تحديث البيانات"
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition cursor-pointer min-h-[42px] min-w-[42px] flex items-center justify-center"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* 6 MANDATORY DASHBOARD STATISTICS CARDS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-bold text-slate-500">1. إجمالي الفنيين</p>
                  <p
                    data-testid="kpi-total-technicians"
                    className="text-3xl font-extrabold font-mono-tabular text-slate-900 mt-2"
                  >
                    {stats.totalTechnicians}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">مسجلون بالنظام</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-bold text-slate-500">2. تركيبات اليوم</p>
                  <p
                    data-testid="kpi-registrations-today"
                    className="text-3xl font-extrabold font-mono-tabular text-purple-900 mt-2"
                  >
                    {stats.registrationsToday}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono-tabular mt-1">
                    {cairoTime.date}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-bold text-slate-500">3. تركيبات هذا الشهر</p>
                  <p
                    data-testid="kpi-registrations-month"
                    className="text-3xl font-extrabold font-mono-tabular text-purple-900 mt-2"
                  >
                    {stats.registrationsThisMonth}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono-tabular mt-1">
                    {cairoTime.month}
                  </p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-bold text-slate-500">4. إجمالي التركيبات</p>
                  <p
                    data-testid="kpi-total-registrations"
                    className="text-3xl font-extrabold font-mono-tabular text-slate-900 mt-2"
                  >
                    {stats.totalRegistrations}
                  </p>
                  <p className="text-[11px] text-slate-500 mt-1">خط أرضي مسجل</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-bold text-slate-500">5. الفنيون النشطون</p>
                  <p
                    data-testid="kpi-active-technicians"
                    className="text-3xl font-extrabold font-mono-tabular text-emerald-700 mt-2"
                  >
                    {stats.activeTechnicians}
                  </p>
                  <p className="text-[11px] text-emerald-700 mt-1">حساب مفعل</p>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5">
                  <p className="text-xs font-bold text-slate-500">6. الفنيون الموقوفون</p>
                  <p
                    data-testid="kpi-disabled-technicians"
                    className="text-3xl font-extrabold font-mono-tabular text-amber-700 mt-2"
                  >
                    {stats.disabledTechnicians}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1">حساب موقوف</p>
                </div>
              </div>

              {/* Animated Charts Row */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Technician Performance Comparison */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">
                        مؤشر أداء الفنيين وإجمالي التركيبات
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        مقارنة عدد الخطوط الأرضية المسجلة لكل فني
                      </p>
                    </div>
                    <span className="text-xs font-mono-tabular text-slate-500">
                      إجمالي {stats.totalRegistrations} خط
                    </span>
                  </div>

                  <div className="mt-5 space-y-4">
                    {technicians.length === 0 ? (
                      <p className="py-10 text-center text-xs text-slate-400">
                        لا يوجد فنيون مسجلون حالياً. يمكنك إضافة فني جديد من زر &quot;إضافة فني جديد&quot;.
                      </p>
                    ) : (
                      technicians.map((tech) => {
                        const pct = Math.round((tech.totalRegistrations / maxTechRegs) * 100);
                        return (
                          <div key={tech.id} className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-800">
                                {tech.fullName}{' '}
                                <span className="font-mono-tabular text-slate-500">
                                  ({tech.technicianCode})
                                </span>
                              </span>
                              <span className="font-mono-tabular font-extrabold text-purple-900">
                                {tech.totalRegistrations} خط · اليوم: {tech.todayRegistrations}
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.max(4, pct)}%` }}
                                transition={{ duration: 0.6, ease: 'easeOut' }}
                                className="h-full bg-gradient-to-r from-[#4C1D95] to-[#9333EA] rounded-full"
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Chart 2: Daily Installations Trend */}
                <div className="bg-white rounded-3xl border border-slate-200 p-6 flex flex-col justify-between">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900">
                        المنحنى اليومي لتسجيلات الخطوط الأرضية
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        توزيع التركيبات اليومية حسب توقيت القاهرة
                      </p>
                    </div>
                    <span className="text-xs font-mono-tabular text-purple-900 font-bold">
                      Africa/Cairo
                    </span>
                  </div>

                  <div className="mt-6 h-48 flex items-end justify-between gap-3 pt-6 px-2 border-b border-slate-100">
                    {dailyTrend.length === 0 ? (
                      <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">
                        لا توجد تسجيلات خطوط أرضية حتى الآن.
                      </div>
                    ) : (
                      dailyTrend.map((item) => {
                        const barHeightPercent = Math.max(
                          12,
                          Math.round((item.count / maxTrendCount) * 100)
                        );
                        return (
                          <div
                            key={item.date}
                            className="flex-1 flex flex-col items-center justify-end h-full group"
                          >
                            <span className="text-xs font-mono-tabular font-extrabold text-purple-950 mb-1.5">
                              {item.count}
                            </span>
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: `${barHeightPercent}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                              className="w-full max-w-[44px] bg-gradient-to-t from-[#3B0764] to-[#9333EA] rounded-t-xl"
                            />
                            <span className="text-[11px] font-mono-tabular text-slate-500 mt-2 pb-2">
                              {item.date.slice(5)}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <div className="pt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>تتحدث الإحصائيات تلقائياً مع كل عملية حفظ من تطبيق الفنيين</span>
                    <button
                      type="button"
                      onClick={() => setActiveSection('registrations')}
                      className="font-bold text-purple-800 hover:underline cursor-pointer"
                    >
                      عرض كل السجلات
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Registrations Table on Dashboard Home */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-base sm:text-lg font-extrabold text-slate-900">
                      أحدث تسجيلات الخطوط الأرضية (مباشر)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      يمكنك تعديل الرقم أو التاريخ أو حذف أي تسجيل مباشرة من الجدول
                    </p>
                  </div>
                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingReg(null);
                        setRegModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 text-xs font-bold transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>إضافة خط أرضي</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('registrations')}
                      className="text-xs font-bold text-purple-900 hover:underline cursor-pointer"
                    >
                      فتح إدارة التركيبات الكاملة
                    </button>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                        <th className="py-3.5 px-4">كود الفني</th>
                        <th className="py-3.5 px-4">اسم الفني</th>
                        <th className="py-3.5 px-4">رقم التليفون الأرضي</th>
                        <th className="py-3.5 px-4">التاريخ</th>
                        <th className="py-3.5 px-4">الوقت</th>
                        <th className="py-3.5 px-4">تعديل / حذف</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {registrations.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-400">
                            لا توجد أي تسجيلات حالياً.
                          </td>
                        </tr>
                      ) : (
                        registrations.slice(0, 8).map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50/80">
                            <td className="py-3 px-4 font-mono-tabular font-bold text-xs text-purple-900">
                              {r.technicianCode}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">{r.technicianName}</td>
                            <td className="py-3 px-4 font-mono-tabular font-extrabold text-base text-slate-900">
                              {r.landlineNumber}
                            </td>
                            <td className="py-3 px-4 font-mono-tabular text-xs text-slate-700">
                              {r.registrationDate}
                            </td>
                            <td className="py-3 px-4 font-mono-tabular text-xs text-slate-500">
                              {r.registrationTime}
                            </td>
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingReg(r);
                                    setRegModalOpen(true);
                                  }}
                                  aria-label={`تعديل رقم ${r.landlineNumber}`}
                                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 text-xs font-bold inline-flex items-center gap-1 transition cursor-pointer"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                  <span>تعديل</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRegistration(r)}
                                  aria-label={`حذف رقم ${r.landlineNumber}`}
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
              </div>
            </motion.div>
          )}

          {/* ===============================================================
              SECTION 2: TECHNICIAN MANAGEMENT (إدارة الفنيين)
          =============================================================== */}
          {activeSection === 'technicians' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    إدارة حسابات الفنيين (Technician Management)
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    إنشاء الحسابات، تعيين الأكواد وكلمات المرور، التفعيل والإيقاف، ومتابعة إجمالي تركيبات كل فني.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTech(null);
                    setTechModalOpen(true);
                  }}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#4C1D95] hover:bg-[#3B0764] text-white text-xs sm:text-sm font-bold shadow-xs transition cursor-pointer whitespace-nowrap min-h-[44px]"
                >
                  <Plus className="w-4 h-4" />
                  <span>إنشاء حساب فني جديد</span>
                </button>
              </div>

              {/* Search & Filter Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div className="relative flex-1">
                  <input
                    type="text"
                    aria-label="ابحث بكود الفني أو الاسم أو البريد الإلكتروني"
                    placeholder="ابحث بكود الفني (TECH-1001)، اسم الفني، أو البريد الإلكتروني..."
                    value={techSearch}
                    onChange={(e) => setTechSearch(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm focus:border-purple-700 focus:outline-none"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
                </div>

                {/* Interactive Filter Tabs */}
                <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => setTechStatusFilter('all')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      techStatusFilter === 'all'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الكل ({stats.totalTechnicians})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTechStatusFilter('active')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      techStatusFilter === 'active'
                        ? 'bg-white text-emerald-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    نشط ({stats.activeTechnicians})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTechStatusFilter('disabled')}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                      techStatusFilter === 'disabled'
                        ? 'bg-white text-amber-800 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    موقوف ({stats.disabledTechnicians})
                  </button>
                </div>
              </div>

              {/* Technicians Table */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                      <th className="py-3.5 px-4">كود الفني / اسم المستخدم</th>
                      <th className="py-3.5 px-4">اسم الفني</th>
                      <th className="py-3.5 px-4">البريد الإلكتروني</th>
                      <th className="py-3.5 px-4">حالة الحساب</th>
                      <th className="py-3.5 px-4">تركيبات اليوم</th>
                      <th className="py-3.5 px-4">تركيبات الشهر</th>
                      <th className="py-3.5 px-4">الإجمالي الكلي</th>
                      <th className="py-3.5 px-4">إجراءات التحكم</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredTechnicians.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-xs text-slate-500">
                          لا يوجد فنيون مطابقون للبحث.
                        </td>
                      </tr>
                    ) : (
                      filteredTechnicians.map((tech) => (
                        <tr key={tech.id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-4 font-mono-tabular font-extrabold text-purple-950">
                            {tech.technicianCode}
                          </td>
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-900">{tech.fullName}</p>
                            <p className="text-xs text-slate-500">{tech.governorate}</p>
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-600">
                            {tech.email}
                          </td>
                          <td className="py-3.5 px-4 text-xs font-bold">
                            {tech.status === 'active' ? (
                              <span className="text-emerald-700">نشط (مفعل)</span>
                            ) : (
                              <span className="text-amber-700">موقوف</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular font-bold text-slate-800">
                            {tech.todayRegistrations}
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular font-bold text-purple-900">
                            {tech.monthRegistrations}
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular font-extrabold text-base text-slate-900">
                            {tech.totalRegistrations}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setActivityTech(tech)}
                                title={`عرض نشاط ${tech.fullName}`}
                                aria-label={`عرض نشاط ${tech.fullName}`}
                                className="p-2 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 transition cursor-pointer"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingTech(tech);
                                  setTechModalOpen(true);
                                }}
                                title={`تعديل بيانات ${tech.fullName}`}
                                aria-label={`تعديل بيانات ${tech.fullName}`}
                                className="p-2 rounded-lg bg-slate-100 hover:bg-purple-100 text-slate-700 hover:text-purple-900 transition cursor-pointer"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setResetPwTech(tech)}
                                title={`إعادة تعيين كلمة مرور ${tech.fullName}`}
                                aria-label={`إعادة تعيين كلمة مرور ${tech.fullName}`}
                                className="p-2 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 transition cursor-pointer"
                              >
                                <KeyRound className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleTechStatus(tech)}
                                title={
                                  tech.status === 'active'
                                    ? `إيقاف حساب ${tech.fullName}`
                                    : `تفعيل حساب ${tech.fullName}`
                                }
                                aria-label={
                                  tech.status === 'active'
                                    ? `إيقاف حساب ${tech.fullName}`
                                    : `تفعيل حساب ${tech.fullName}`
                                }
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap ${
                                  tech.status === 'active'
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-800'
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                <Power className="w-3.5 h-3.5" />
                                <span>{tech.status === 'active' ? 'إيقاف' : 'تفعيل'}</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDeleteTechnician(tech)}
                                title={`حذف الفني ${tech.fullName}`}
                                aria-label={`حذف الفني ${tech.fullName}`}
                                className="px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold transition cursor-pointer inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف الفني</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ===============================================================
              SECTION 3: REGISTRATION MANAGEMENT (إدارة التركيبات)
          =============================================================== */}
          {activeSection === 'registrations' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
                <div>
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    إدارة سجل التركيبات الشامل (Registration Management)
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    عرض وتصفية وتعديل أو حذف أي تسجيل خط أرضي من جميع الفنيين مع توثيق التعديلات في سجل الرقابة.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingReg(null);
                      setRegModalOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#3B0764] text-white text-xs font-bold transition cursor-pointer whitespace-nowrap min-h-[42px]"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة تسجيل جديد</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadExcel({
                        mode: 'all',
                        label: 'سجل التركيبات الكامل',
                      })
                    }
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer whitespace-nowrap min-h-[42px]"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    <span>تصدير الجدول إلى Excel</span>
                  </button>
                </div>
              </div>

              {/* Advanced Filters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div>
                  <label htmlFor="filter-landline" className="block text-[11px] font-bold text-slate-600 mb-1">
                    بحث برقم التليفون الأرضي
                  </label>
                  <input
                    id="filter-landline"
                    type="text"
                    dir="ltr"
                    placeholder="22748190"
                    value={regSearchLandline}
                    onChange={(e) => setRegSearchLandline(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono-tabular focus:border-purple-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="filter-tech-code" className="block text-[11px] font-bold text-slate-600 mb-1">
                    بحث بكود الفني
                  </label>
                  <input
                    id="filter-tech-code"
                    type="text"
                    dir="ltr"
                    placeholder="TECH-1001"
                    value={regSearchCode}
                    onChange={(e) => setRegSearchCode(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono-tabular focus:border-purple-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="filter-tech-name" className="block text-[11px] font-bold text-slate-600 mb-1">
                    بحث باسم الفني
                  </label>
                  <input
                    id="filter-tech-name"
                    type="text"
                    placeholder="اسم الفني..."
                    value={regSearchName}
                    onChange={(e) => setRegSearchName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-purple-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="filter-tech-select" className="block text-[11px] font-bold text-slate-600 mb-1">
                    اختيار الفني
                  </label>
                  <select
                    id="filter-tech-select"
                    value={regTechIdFilter}
                    onChange={(e) => setRegTechIdFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs focus:border-purple-700 focus:outline-none"
                  >
                    <option value="">جميع الفنيين</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.technicianCode} - {t.fullName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="filter-exact-date" className="block text-[11px] font-bold text-slate-600 mb-1">
                    تصفية بالتاريخ
                  </label>
                  <input
                    id="filter-exact-date"
                    type="date"
                    dir="ltr"
                    value={regDateFilter}
                    onChange={(e) => setRegDateFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono-tabular focus:border-purple-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="filter-exact-month" className="block text-[11px] font-bold text-slate-600 mb-1">
                    تصفية بالشهر
                  </label>
                  <input
                    id="filter-exact-month"
                    type="month"
                    dir="ltr"
                    value={regMonthFilter}
                    onChange={(e) => setRegMonthFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono-tabular focus:border-purple-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>
                  عدد السجلات المعروضة:{' '}
                  <strong className="font-mono-tabular text-slate-900">
                    {filteredRegistrations.length}
                  </strong>{' '}
                  من إجمالي {registrations.length}
                </span>
                {(regSearchLandline ||
                  regSearchCode ||
                  regSearchName ||
                  regDateFilter ||
                  regMonthFilter ||
                  regTechIdFilter) && (
                  <button
                    type="button"
                    onClick={() => {
                      setRegSearchLandline('');
                      setRegSearchCode('');
                      setRegSearchName('');
                      setRegDateFilter('');
                      setRegMonthFilter('');
                      setRegTechIdFilter('');
                    }}
                    className="text-purple-800 font-bold hover:underline cursor-pointer"
                  >
                    مسح جميع الفلاتر
                  </button>
                )}
              </div>

              {/* Master Registrations Table: | Technician Code | Technician Name | Landline Number | Date | Time | */}
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                      <th className="py-3.5 px-4">كود الفني (Technician Code)</th>
                      <th className="py-3.5 px-4">اسم الفني (Technician Name)</th>
                      <th className="py-3.5 px-4">رقم التليفون الأرضي (Landline Number)</th>
                      <th className="py-3.5 px-4">التاريخ (Date)</th>
                      <th className="py-3.5 px-4">الوقت (Time)</th>
                      <th className="py-3.5 px-4">مسجل بواسطة</th>
                      <th className="py-3.5 px-4">إجراءات المسؤول</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredRegistrations.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-xs text-slate-500">
                          لا توجد تسجيلات مطابقة لمعايير التصفية الحالية.
                        </td>
                      </tr>
                    ) : (
                      filteredRegistrations.map((reg) => (
                        <tr key={reg.id} className="hover:bg-slate-50/80">
                          <td className="py-3.5 px-4 font-mono-tabular font-bold text-xs text-purple-900">
                            {reg.technicianCode}
                          </td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {reg.technicianName}
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular font-extrabold text-base text-slate-900">
                            {reg.landlineNumber}
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-700">
                            {reg.registrationDate}
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-500">
                            {reg.registrationTime}
                          </td>
                          <td className="py-3.5 px-4 font-mono-tabular text-xs text-slate-500">
                            {reg.createdBy}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingReg(reg);
                                  setRegModalOpen(true);
                                }}
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
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ===============================================================
              SECTION 4: EXCEL INTEGRATION CENTER (تصدير تقارير Excel)
          =============================================================== */}
          {activeSection === 'excel' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6">
                <div className="pb-5 border-b border-slate-100">
                  <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                    مركز تقارير وتصدير ملفات Excel (XLSX Integration)
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    اتصال مباشر بقاعدة البيانات المركزية. أي رقم أرضي يحفظه الفني يصبح متاحاً للتصدير الفوري بصيغة XLSX منسقة مع الفلاتر والترتيب التلقائي.
                  </p>
                </div>

                {/* 5 Export Modes Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* 1. Export All Registrations */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">
                        1. التقرير الشامل لجميع التركيبات
                      </h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        تصدير جميع سجلات الخطوط الأرضية لكل الفنيين منذ بداية التشغيل ({stats.totalRegistrations} سجل) مع ورقة ملخص الفنيين.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={downloadingExcel === 'all'}
                      onClick={() =>
                        handleDownloadExcel({
                          mode: 'all',
                          label: 'التقرير الشامل',
                        })
                      }
                      className="w-full min-h-[44px] rounded-xl bg-[#4C1D95] hover:bg-[#3B0764] text-white text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>تحميل ملف Excel الشامل (.xlsx)</span>
                    </button>
                  </div>

                  {/* 2. Export Daily Report */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <h3 className="text-base font-extrabold text-slate-900">
                        2. التقرير اليومي للتركيبات
                      </h3>
                      <div>
                        <label htmlFor="excel-daily-input" className="block text-xs font-bold text-slate-700 mb-1">
                          اختر اليوم المطلوب:
                        </label>
                        <input
                          id="excel-daily-input"
                          type="date"
                          dir="ltr"
                          value={excelDate}
                          onChange={(e) => setExcelDate(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono-tabular"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={downloadingExcel === 'daily'}
                      onClick={() =>
                        handleDownloadExcel({
                          mode: 'daily',
                          date: excelDate,
                          label: `تقرير يوم ${excelDate}`,
                        })
                      }
                      className="w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>تحميل التقرير اليومي (.xlsx)</span>
                    </button>
                  </div>

                  {/* 3. Export Monthly Report */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <h3 className="text-base font-extrabold text-slate-900">
                        3. التقرير الشهري المعتمد
                      </h3>
                      <div>
                        <label htmlFor="excel-monthly-input" className="block text-xs font-bold text-slate-700 mb-1">
                          اختر الشهر المطلوب:
                        </label>
                        <input
                          id="excel-monthly-input"
                          type="month"
                          dir="ltr"
                          value={excelMonth}
                          onChange={(e) => setExcelMonth(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono-tabular"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={downloadingExcel === 'monthly'}
                      onClick={() =>
                        handleDownloadExcel({
                          mode: 'monthly',
                          month: excelMonth,
                          label: `تقرير شهر ${excelMonth}`,
                        })
                      }
                      className="w-full min-h-[44px] rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>تحميل التقرير الشهري (.xlsx)</span>
                    </button>
                  </div>

                  {/* 4. Export Individual Technician Report */}
                  <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <h3 className="text-base font-extrabold text-slate-900">
                        4. تقرير فني منفرد
                      </h3>
                      <div>
                        <label htmlFor="excel-tech-select" className="block text-xs font-bold text-slate-700 mb-1">
                          اختر الفني:
                        </label>
                        <select
                          id="excel-tech-select"
                          value={excelTechCode}
                          onChange={(e) => setExcelTechCode(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs"
                        >
                          {technicians.map((t) => (
                            <option key={t.id} value={t.technicianCode}>
                              {t.technicianCode} — {t.fullName}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={downloadingExcel === 'technician'}
                      onClick={() =>
                        handleDownloadExcel({
                          mode: 'technician',
                          technicianCode: excelTechCode,
                          label: `تقرير الفني ${excelTechCode}`,
                        })
                      }
                      className="w-full min-h-[44px] rounded-xl bg-[#4C1D95] hover:bg-[#3B0764] text-white text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>تحميل تقرير الفني (.xlsx)</span>
                    </button>
                  </div>

                  {/* 5. Export Date Range Report */}
                  <div className="md:col-span-2 p-5 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <h3 className="text-base font-extrabold text-slate-900">
                        5. تقرير فترة زمنية مخصصة (Date Range Report)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="excel-start-date" className="block text-xs font-bold text-slate-700 mb-1">
                            من تاريخ:
                          </label>
                          <input
                            id="excel-start-date"
                            type="date"
                            dir="ltr"
                            value={excelStartDate}
                            onChange={(e) => setExcelStartDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono-tabular"
                          />
                        </div>
                        <div>
                          <label htmlFor="excel-end-date" className="block text-xs font-bold text-slate-700 mb-1">
                            إلى تاريخ:
                          </label>
                          <input
                            id="excel-end-date"
                            type="date"
                            dir="ltr"
                            value={excelEndDate}
                            onChange={(e) => setExcelEndDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-mono-tabular"
                          />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={downloadingExcel === 'range'}
                      onClick={() =>
                        handleDownloadExcel({
                          mode: 'range',
                          startDate: excelStartDate,
                          endDate: excelEndDate,
                          label: 'تقرير الفترة المحددة',
                        })
                      }
                      className="w-full min-h-[44px] rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-4 flex items-center justify-center gap-2 transition cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                      <span>تحميل تقرير الفترة الزمنية (.xlsx)</span>
                    </button>
                  </div>
                </div>

                {/* Live Master Excel Structure Preview */}
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-extrabold text-slate-900">
                      معاينة هيكل تقرير Master Excel المعتمد ({registrations.length} سجل جاهز للتصدير)
                    </h2>
                    <span className="text-xs text-slate-500 font-mono-tabular">
                      Format: XLSX · AutoFilter · Sorted
                    </span>
                  </div>
                  <div className="overflow-x-auto rounded-2xl border border-slate-200">
                    <table className="w-full text-right border-collapse">
                      <thead>
                        <tr className="bg-purple-950 text-white text-xs font-bold">
                          <th className="py-3 px-4">Technician Code | كود الفني</th>
                          <th className="py-3 px-4">Technician Name | اسم الفني</th>
                          <th className="py-3 px-4">Landline Number | رقم التليفون الأرضي</th>
                          <th className="py-3 px-4">Date | التاريخ</th>
                          <th className="py-3 px-4">Time | الوقت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                        {registrations.slice(0, 6).map((r) => (
                          <tr key={r.id} className="hover:bg-slate-50">
                            <td className="py-2.5 px-4 font-mono-tabular font-bold text-purple-900">
                              {r.technicianCode}
                            </td>
                            <td className="py-2.5 px-4 font-bold text-slate-900">
                              {r.technicianName}
                            </td>
                            <td className="py-2.5 px-4 font-mono-tabular font-extrabold text-slate-900">
                              {r.landlineNumber}
                            </td>
                            <td className="py-2.5 px-4 font-mono-tabular text-slate-700">
                              {r.registrationDate}
                            </td>
                            <td className="py-2.5 px-4 font-mono-tabular text-slate-500">
                              {r.registrationTime}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ===============================================================
              SECTION 5: MONTHLY REPORTING SYSTEM (التقارير الشهرية)
          =============================================================== */}
          {activeSection === 'monthly' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-100">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                      نظام التقارير الشهرية الآلي (Monthly Reporting System)
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1">
                      تجميع شامل لجميع الفنيين وأرقام التليفونات الأرضية وإجمالي التركيبات لكل فني مع حفظ التقارير السابقة للرجوع إليها.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <select
                      aria-label="اختيار شهر التقرير"
                      value={selectedReportMonth}
                      onChange={(e) => setSelectedReportMonth(e.target.value)}
                      className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-mono-tabular font-bold text-slate-900"
                    >
                      {availableMonths.map((m) => (
                        <option key={m} value={m}>
                          شهر: {m}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={generatingMonthly}
                      onClick={handleGenerateMonthlyArchive}
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#3B0764] text-white text-xs font-bold transition cursor-pointer min-h-[42px]"
                    >
                      {generatingMonthly ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4" />
                      )}
                      <span>إصدار وأرشفة تقرير الشهر</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadExcel({
                          mode: 'monthly',
                          month: selectedReportMonth || cairoTime.month,
                          label: `التقرير الشهري ${selectedReportMonth || cairoTime.month}`,
                        })
                      }
                      className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer min-h-[42px]"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      <span>تحميل التقرير الشهري كملف Excel</span>
                    </button>
                  </div>
                </div>

                {monthlyReportData && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                        <p className="text-xs text-slate-500">الشهر المحدد للتقرير</p>
                        <p className="text-2xl font-extrabold font-mono-tabular text-purple-900 mt-1">
                          {monthlyReportData.reportMonth}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                        <p className="text-xs text-slate-500">إجمالي التركيبات لكل الفنيين بالشهر</p>
                        <p className="text-2xl font-extrabold font-mono-tabular text-slate-900 mt-1">
                          {monthlyReportData.totalRegistrations} خط أرضي
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                        <p className="text-xs text-slate-500">عدد الفنيين المساهمين بالشهر</p>
                        <p className="text-2xl font-extrabold font-mono-tabular text-emerald-700 mt-1">
                          {monthlyReportData.activeContributorsCount} / {monthlyReportData.totalTechniciansCount}
                        </p>
                      </div>
                    </div>

                    {/* Technician Monthly Breakdown Table */}
                    <div>
                      <h2 className="text-base font-extrabold text-slate-900 mb-3">
                        إجمالي التركيبات الشهرية لكل فني ({monthlyReportData.reportMonth})
                      </h2>
                      <div className="overflow-x-auto rounded-2xl border border-slate-200">
                        <table className="w-full text-right border-collapse">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                              <th className="py-3 px-4">كود الفني</th>
                              <th className="py-3 px-4">اسم الفني</th>
                              <th className="py-3 px-4">حالة الحساب</th>
                              <th className="py-3 px-4">إجمالي تركيبات الشهر</th>
                              <th className="py-3 px-4">النسبة من إجمالي الشهر</th>
                              <th className="py-3 px-4">آخر تاريخ تسجيل</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-sm">
                            {monthlyReportData.technicianBreakdown.map((tb) => (
                              <tr key={tb.technicianId} className="hover:bg-slate-50/80">
                                <td className="py-3 px-4 font-mono-tabular font-bold text-purple-900">
                                  {tb.technicianCode}
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-900">
                                  {tb.technicianName}
                                </td>
                                <td className="py-3 px-4 text-xs">
                                  {tb.status === 'active' ? 'نشط' : 'موقوف'}
                                </td>
                                <td className="py-3 px-4 font-mono-tabular font-extrabold text-base text-slate-900">
                                  {tb.totalRegistrations}
                                </td>
                                <td className="py-3 px-4 font-mono-tabular text-xs text-purple-900 font-bold">
                                  {tb.sharePercent}%
                                </td>
                                <td className="py-3 px-4 font-mono-tabular text-xs text-slate-500">
                                  {tb.lastRegistrationDate}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}

                {/* Archived Previous Monthly Reports */}
                <div className="pt-4 border-t border-slate-100">
                  <h2 className="text-base font-extrabold text-slate-900 mb-3">
                    أرشيف التقارير الشهرية المحفوظة للرجوع إليها
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {archivedReports.map((arch) => (
                      <div
                        key={arch.id}
                        className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4"
                      >
                        <div>
                          <p className="text-sm font-extrabold text-slate-900">{arch.title}</p>
                          <p className="text-xs text-slate-500 mt-1">
                            الشهر: <strong className="font-mono-tabular">{arch.reportMonth}</strong> ·
                            إجمالي التركيبات:{' '}
                            <strong className="font-mono-tabular">{arch.totalRegistrations}</strong> ·
                            بواسطة: {arch.generatedBy}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            handleDownloadExcel({
                              mode: 'monthly',
                              month: arch.reportMonth,
                              label: `أرشيف شهر ${arch.reportMonth}`,
                            })
                          }
                          className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shrink-0 cursor-pointer inline-flex items-center gap-1.5 min-h-[40px]"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Excel</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

              {/* ===============================================================
              SECTION 6: ADMINISTRATOR CONTROL CENTER & AUDIT LOGS
          =============================================================== */}
          {activeSection === 'control' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* WebApp & WhatsApp Distribution Card */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 text-purple-900 flex items-center justify-center shrink-0">
                      <Globe className="w-6 h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                        مشاركة رابط تطبيق الويب (MAKKAH WE – FTTH WebApp)
                      </h2>
                      <p className="text-xs text-slate-500 mt-0.5">
                        إرسال رابط تطبيق الويب المباشر للفنيين عبر واتساب للعمل من أي متصفح مع حفظ دائم لجميع البيانات
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <h3 className="text-sm font-extrabold text-slate-900">
                      إرسال رابط تطبيق الويب للفنيين عبر WhatsApp:
                    </h3>
                    <p className="text-xs text-slate-600 leading-relaxed">
                      انسخ رابط تطبيق الويب الرسمي أو اضغط على زر الإرسال عبر واتساب لإرساله لأي فني. بمجرد فتح الفني للرابط في المتصفح وتسجيل الدخول بكود الفني وكلمة المرور، يتم حفظ جميع تسجيلاته بشكل دائم في قاعدة البيانات المركزية.
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <a
                        href={`https://wa.me/?text=${encodeURIComponent(
                          `مرحباً بك في منظومة MAKKAH WE – FTTH\nافتح رابط تطبيق الويب لتسجيل الخطوط الأرضية اليومية من خلال الرابط التالي:\n${window.location.origin}\n\nسجل الدخول باستخدام كود الفني وكلمة المرور المسلمة لك من الإدارة.`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition min-h-[42px]"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>إرسال رابط WebApp عبر WhatsApp</span>
                      </a>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin);
                          setCopiedUrl(true);
                          setTimeout(() => setCopiedUrl(false), 2500);
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-bold transition cursor-pointer min-h-[42px]"
                      >
                        {copiedUrl ? (
                          <>
                            <Check className="w-4 h-4 text-emerald-600" />
                            <span>تم نسخ الرابط</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>نسخ رابط تطبيق الويب</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-purple-50/60 border border-purple-100 space-y-2 text-xs text-slate-700">
                    <h3 className="text-sm font-extrabold text-purple-950">
                      مميزات الحفظ الدائم في تطبيق الويب (WebApp):
                    </h3>
                    <p className="leading-relaxed">
                      • <strong>قاعدة بيانات سحابية دائمة (Cloud SQL PostgreSQL):</strong> أي فني أو خط أرضي تضيفه يُحفظ فوراً في قاعدة البيانات المركزية ولا يُمحى عند إغلاق المتصفح أو تحديث الصفحة.
                    </p>
                    <p className="leading-relaxed">
                      • <strong>حفظ تلقائي لجلسة الدخول:</strong> يبقى حسابك مسجلاً عند إعادة تحميل الصفحة حتى تضغط على تسجيل الخروج بنفسك.
                    </p>
                    <p className="leading-relaxed">
                      • <strong>مزامنة فورية:</strong> أي تسجيل جديد يظهر لحظياً في لوحة تحكم المسؤول وفي تقارير Excel.
                    </p>
                  </div>
                </div>
              </div>

              {/* Security & Modifications Audit Log Table */}
              <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 space-y-4">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900">
                      سجل الرقابة والعمليات الأمنية (Audit Log)
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      يوثق جميع عمليات تسجيل الخطوط، التعديلات، الحذف، إعادة تعيين كلمات المرور، وتغيير حالة حسابات الفنيين.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600">
                        <th className="py-3 px-4">#</th>
                        <th className="py-3 px-4">المنفذ</th>
                        <th className="py-3 px-4">نوع العملية</th>
                        <th className="py-3 px-4">الهدف</th>
                        <th className="py-3 px-4">التفاصيل الكاملة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                      {auditLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-4 font-mono-tabular text-slate-400">{log.id}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {log.actorName}{' '}
                            <span className="font-mono-tabular text-xs text-slate-500">
                              ({log.actorType === 'admin' ? 'مسؤول' : 'فني'})
                            </span>
                          </td>
                          <td className="py-3 px-4 font-mono-tabular font-bold text-xs text-purple-900">
                            {log.actionType}
                          </td>
                          <td className="py-3 px-4 font-mono-tabular text-xs text-slate-600">
                            {log.targetId}
                          </td>
                          <td className="py-3 px-4 text-slate-700 leading-relaxed">{log.details}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}
        </main>
      </div>

      {/* Interactive Modals */}
      <TechnicianFormModal
        isOpen={techModalOpen}
        onClose={() => setTechModalOpen(false)}
        editingTech={editingTech}
        token={token}
        onSaved={async (msg) => {
          showToast(msg);
          await fetchAllAdminData();
        }}
      />

      <PasswordResetModal
        isOpen={!!resetPwTech}
        onClose={() => setResetPwTech(null)}
        technician={resetPwTech}
        token={token}
        onResetSuccess={async (msg) => {
          showToast(msg);
          await fetchAllAdminData();
        }}
      />

      <TechnicianActivityModal
        isOpen={!!activityTech}
        onClose={() => setActivityTech(null)}
        technician={activityTech}
        onExportTechnicianExcel={(code) => {
          setActivityTech(null);
          handleDownloadExcel({
            mode: 'technician',
            technicianCode: code,
            label: `تقرير الفني ${code}`,
          });
        }}
      />

      <RegistrationFormModal
        isOpen={regModalOpen}
        onClose={() => setRegModalOpen(false)}
        editingReg={editingReg}
        technicians={technicians}
        defaultDate={cairoTime.date}
        token={token}
        onSaved={async (msg) => {
          showToast(msg);
          await fetchAllAdminData();
        }}
      />
    </div>
  );
};
