import React, { useState, useEffect } from 'react';
import { X, KeyRound, UserPlus, Edit3, Eye, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from 'lucide-react';

export interface AdminTechnicianItem {
  id: number;
  technicianCode: string;
  username: string;
  email: string;
  fullName: string;
  status: string;
  phone: string;
  governorate: string;
  totalRegistrations: number;
  todayRegistrations: number;
  monthRegistrations: number;
  recentRegistrations?: Array<{
    id: number;
    landlineNumber: string;
    registrationDate: string;
    registrationTime: string;
  }>;
}

export interface AdminRegistrationItem {
  id: number;
  technicianId: number;
  technicianCode: string;
  technicianName: string;
  landlineNumber: string;
  registrationDate: string;
  registrationTime: string;
  registrationMonth: string;
  createdBy: string;
}

interface TechnicianFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingTech: AdminTechnicianItem | null;
  token: string;
  onSaved: (msg: string) => void;
}

export const TechnicianFormModal: React.FC<TechnicianFormModalProps> = ({
  isOpen,
  onClose,
  editingTech,
  token,
  onSaved,
}) => {
  const [technicianCode, setTechnicianCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [governorate, setGovernorate] = useState('القاهرة');
  const [status, setStatus] = useState<'active' | 'disabled'>('active');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingTech) {
      setTechnicianCode(editingTech.technicianCode);
      setFullName(editingTech.fullName);
      setEmail(editingTech.email);
      setPassword('');
      setPhone(editingTech.phone || '');
      setGovernorate(editingTech.governorate || 'القاهرة');
      setStatus(editingTech.status === 'disabled' ? 'disabled' : 'active');
    } else {
      setTechnicianCode('');
      setFullName('');
      setEmail('');
      setPassword('');
      setPhone('');
      setGovernorate('القاهرة');
      setStatus('active');
    }
    setError(null);
  }, [editingTech, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const url = editingTech
        ? `/api/admin/technicians/${editingTech.id}`
        : '/api/admin/technicians';
      const method = editingTech ? 'PUT' : 'POST';

      const cleanCode = technicianCode.trim().toUpperCase();
      const cleanEmail =
        email.trim() || `${cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '') || 'tech'}@makkahwe.com`;

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technicianCode: cleanCode,
          fullName: fullName.trim(),
          email: cleanEmail,
          password: password.trim(),
          phone: phone.trim(),
          governorate: governorate.trim(),
          status,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر حفظ بيانات الفني.');
        return;
      }

      onSaved(data.message || 'تم حفظ بيانات الفني بنجاح.');
      onClose();
    } catch {
      setError('تعذر الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tech-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto"
    >
      <div className="w-full max-w-lg rounded-3xl bg-white p-6 sm:p-8 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
              {editingTech ? <Edit3 className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
            </div>
            <div>
              <h3 id="tech-modal-title" className="text-lg font-extrabold text-slate-900">
                {editingTech ? 'تعديل بيانات الفني' : 'إضافة حساب فني جديد'}
              </h3>
              <p className="text-xs text-slate-500">
                اسم المستخدم يطابق كود الفني تلقائياً حسب سياسة النظام
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق النافذة"
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span className="font-bold">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-tech-code" className="block text-xs font-bold text-slate-700 mb-1">
                كود الفني (Technician Code)
              </label>
              <input
                id="modal-tech-code"
                type="text"
                dir="ltr"
                required
                value={technicianCode}
                onChange={(e) => setTechnicianCode(e.target.value.toUpperCase())}
                placeholder="TECH-1006"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-tabular font-bold text-slate-900 focus:border-purple-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="modal-tech-username" className="block text-xs font-bold text-slate-700 mb-1">
                اسم المستخدم (Username)
              </label>
              <input
                id="modal-tech-username"
                type="text"
                dir="ltr"
                readOnly
                value={technicianCode.trim().toUpperCase()}
                className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-2.5 text-sm font-mono-tabular text-slate-600"
              />
            </div>
          </div>

          <div>
            <label htmlFor="modal-tech-name" className="block text-xs font-bold text-slate-700 mb-1">
              اسم الفني بالكامل
            </label>
            <input
              id="modal-tech-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="مثال: محمد إبراهيم عبد الله"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-purple-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-tech-email" className="block text-xs font-bold text-slate-700 mb-1">
                البريد الإلكتروني (اختياري)
              </label>
              <input
                id="modal-tech-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tech@makkahwe.com"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-tabular text-slate-900 focus:border-purple-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="modal-tech-phone" className="block text-xs font-bold text-slate-700 mb-1">
                رقم الهاتف المحمول
              </label>
              <input
                id="modal-tech-phone"
                type="text"
                dir="ltr"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-tabular text-slate-900 focus:border-purple-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="modal-tech-gov" className="block text-xs font-bold text-slate-700 mb-1">
                المحافظة / السنترال
              </label>
              <input
                id="modal-tech-gov"
                type="text"
                value={governorate}
                onChange={(e) => setGovernorate(e.target.value)}
                placeholder="القاهرة - مدينة نصر"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-purple-700 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="modal-tech-status" className="block text-xs font-bold text-slate-700 mb-1">
                حالة الحساب
              </label>
              <select
                id="modal-tech-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'disabled')}
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-purple-700 focus:outline-none bg-white"
              >
                <option value="active">نشط (Active)</option>
                <option value="disabled">موقوف (Disabled)</option>
              </select>
            </div>
          </div>

          {!editingTech && (
            <div>
              <label htmlFor="modal-tech-password" className="block text-xs font-bold text-slate-700 mb-1">
                كلمة المرور المعتمدة للفني (تُنشأ بواسطة المسؤول فقط)
              </label>
              <input
                id="modal-tech-password"
                type="text"
                dir="ltr"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Makkah@1006"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-tabular text-slate-900 focus:border-purple-700 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-500">
                يتم تشفير كلمة المرور بخوارزمية scrypt الآمنة قبل تخزينها في قاعدة البيانات.
              </p>
            </div>
          )}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer min-h-[42px]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#4C1D95] hover:bg-[#3B0764] text-white text-xs font-bold transition cursor-pointer min-h-[42px] disabled:opacity-60"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{editingTech ? 'حفظ التعديلات' : 'إنشاء حساب الفني'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  technician: AdminTechnicianItem | null;
  token: string;
  onResetSuccess: (msg: string) => void;
}

export const PasswordResetModal: React.FC<PasswordResetModalProps> = ({
  isOpen,
  onClose,
  technician,
  token,
  onResetSuccess,
}) => {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (technician) {
      setNewPassword(`Makkah@${technician.technicianCode.replace(/\D/g, '') || '2026'}`);
      setError(null);
    }
  }, [technician, isOpen]);

  if (!isOpen || !technician) return null;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/technicians/${technician.id}/reset-password`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر إعادة تعيين كلمة المرور.');
        return;
      }
      onResetSuccess(data.message);
      onClose();
    } catch {
      setError('تعذر الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-pw-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 id="reset-pw-title" className="text-base font-extrabold text-slate-900">
                إعادة تعيين كلمة مرور الفني فوراً
              </h3>
              <p className="text-xs text-slate-500">
                {technician.fullName} ({technician.technicianCode})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleReset} className="mt-4 space-y-4">
          <div>
            <label htmlFor="reset-pw-input" className="block text-xs font-bold text-slate-700 mb-1.5">
              كلمة المرور الجديدة للفني
            </label>
            <input
              id="reset-pw-input"
              type="text"
              dir="ltr"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono-tabular font-bold text-slate-900 focus:border-purple-700 focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-slate-500">
              تُطبق كلمة المرور الجديدة فوراً، ويمكنك إرسالها للفني لتسجيل الدخول بها.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer min-h-[40px]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#4C1D95] hover:bg-[#3B0764] text-white text-xs font-bold transition cursor-pointer min-h-[40px]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              <span>تعيين كلمة المرور الآن</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface TechnicianActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  technician: AdminTechnicianItem | null;
  onExportTechnicianExcel: (code: string) => void;
}

export const TechnicianActivityModal: React.FC<TechnicianActivityModalProps> = ({
  isOpen,
  onClose,
  technician,
  onExportTechnicianExcel,
}) => {
  if (!isOpen || !technician) return null;

  const recent = technician.recentRegistrations || [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tech-activity-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 id="tech-activity-title" className="text-base font-extrabold text-slate-900">
                سجل نشاط الفني: {technician.fullName}
              </h3>
              <p className="text-xs text-slate-500 font-mono-tabular">
                {technician.technicianCode} · {technician.email}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 text-center">
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500">تركيبات اليوم</p>
            <p className="text-xl font-extrabold font-mono-tabular text-purple-900 mt-0.5">
              {technician.todayRegistrations}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500">تركيبات الشهر</p>
            <p className="text-xl font-extrabold font-mono-tabular text-purple-900 mt-0.5">
              {technician.monthRegistrations}
            </p>
          </div>
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500">الإجمالي الكلي</p>
            <p className="text-xl font-extrabold font-mono-tabular text-slate-900 mt-0.5">
              {technician.totalRegistrations}
            </p>
          </div>
        </div>

        <div className="mt-4">
          <h4 className="text-xs font-bold text-slate-700 mb-2">أحدث الخطوط الأرضية المسجلة:</h4>
          <div className="max-h-60 overflow-y-auto rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {recent.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-500">لا توجد تسجيلات لهذا الفني حتى الآن.</p>
            ) : (
              recent.map((r) => (
                <div key={r.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                  <span className="font-mono-tabular font-bold text-sm text-purple-950">
                    {r.landlineNumber}
                  </span>
                  <span className="font-mono-tabular text-slate-500">
                    {r.registrationDate} · {r.registrationTime}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onExportTechnicianExcel(technician.technicianCode)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition cursor-pointer min-h-[40px]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>تصدير تقرير Excel لهذا الفني</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer min-h-[40px]"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

interface RegistrationEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingReg: AdminRegistrationItem | null;
  technicians: AdminTechnicianItem[];
  defaultDate: string;
  token: string;
  onSaved: (msg: string) => void;
}

export const RegistrationFormModal: React.FC<RegistrationEditModalProps> = ({
  isOpen,
  onClose,
  editingReg,
  technicians,
  defaultDate,
  token,
  onSaved,
}) => {
  const [technicianId, setTechnicianId] = useState<number>(0);
  const [landlineNumber, setLandlineNumber] = useState('');
  const [registrationDate, setRegistrationDate] = useState('');
  const [registrationTime, setRegistrationTime] = useState('12:00:00');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editingReg) {
      setTechnicianId(editingReg.technicianId);
      setLandlineNumber(editingReg.landlineNumber);
      setRegistrationDate(editingReg.registrationDate);
      setRegistrationTime(editingReg.registrationTime);
    } else {
      setTechnicianId(technicians[0]?.id || 1);
      setLandlineNumber('');
      setRegistrationDate(defaultDate);
      setRegistrationTime('12:00:00');
    }
    setError(null);
  }, [editingReg, technicians, defaultDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const url = editingReg
        ? `/api/admin/registrations/${editingReg.id}`
        : '/api/admin/registrations';
      const method = editingReg ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          technicianId,
          landlineNumber,
          registrationDate,
          registrationTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'تعذر حفظ بيانات التسجيل.');
        return;
      }
      onSaved(data.message);
      onClose();
    } catch {
      setError('تعذر الاتصال بالخادم.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reg-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4"
    >
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl border border-slate-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h3 id="reg-modal-title" className="text-base font-extrabold text-slate-900">
            {editingReg ? 'تعديل وتصحيح سجل التركيب' : 'إضافة سجل تركيب جديد (بواسطة المسؤول)'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="reg-modal-tech" className="block text-xs font-bold text-slate-700 mb-1">
              الفني المسند إليه التركيب
            </label>
            <select
              id="reg-modal-tech"
              value={technicianId}
              onChange={(e) => setTechnicianId(Number(e.target.value))}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm bg-white focus:border-purple-700 focus:outline-none"
            >
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.technicianCode} — {t.fullName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reg-modal-landline" className="block text-xs font-bold text-slate-700 mb-1">
              رقم التليفون الأرضي (8 أرقام)
            </label>
            <input
              id="reg-modal-landline"
              type="text"
              dir="ltr"
              required
              maxLength={8}
              value={landlineNumber}
              onChange={(e) => setLandlineNumber(e.target.value)}
              placeholder="23456789"
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base font-mono-tabular font-bold text-slate-900 focus:border-purple-700 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="reg-modal-date" className="block text-xs font-bold text-slate-700 mb-1">
                تاريخ التسجيل
              </label>
              <input
                id="reg-modal-date"
                type="date"
                dir="ltr"
                required
                value={registrationDate}
                onChange={(e) => setRegistrationDate(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono-tabular focus:border-purple-700 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="reg-modal-time" className="block text-xs font-bold text-slate-700 mb-1">
                وقت التسجيل
              </label>
              <input
                id="reg-modal-time"
                type="text"
                dir="ltr"
                required
                value={registrationTime}
                onChange={(e) => setRegistrationTime(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-mono-tabular focus:border-purple-700 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer min-h-[40px]"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-[#4C1D95] hover:bg-[#3B0764] text-white text-xs font-bold transition cursor-pointer min-h-[40px]"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{editingReg ? 'حفظ التعديل وتوثيقه' : 'إضافة التسجيل'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
