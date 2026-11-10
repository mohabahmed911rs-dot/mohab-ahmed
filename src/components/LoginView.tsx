import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, UserCheck, AlertCircle, Loader2, ArrowLeft } from 'lucide-react';
import { MakkahWeLogo } from './MakkahWeLogo';

export interface AuthenticatedUser {
  id: number;
  role: 'technician' | 'admin';
  technicianCode?: string;
  username: string;
  fullName: string;
  email: string;
  status?: string;
  phone?: string;
  governorate?: string;
}

interface LoginViewProps {
  onLoginSuccess: (token: string, user: AuthenticatedUser) => void;
  initialPortal?: 'technician' | 'admin';
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [technicianCode, setTechnicianCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const code = technicianCode.trim();
    if (!code || !password) {
      setError('يرجى إدخال كود الفني وكلمة المرور.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/technician-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ technicianCode: code, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'كود الفني أو كلمة المرور غير صحيحة.');
        return;
      }
      onLoginSuccess(data.token, data.user);
    } catch {
      setError('تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1E0538] via-[#2E1065] to-[#3B0764] flex flex-col justify-between p-4 sm:p-6">
      <header className="w-full max-w-md mx-auto flex items-center justify-center pt-2">
        <span className="text-sm font-extrabold tracking-tight text-white/90">
          MAKKAH WE – FTTH
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center py-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-md bg-white rounded-3xl border border-purple-100 p-7 sm:p-9 shadow-2xl"
        >
          <div className="flex flex-col items-center text-center mb-7">
            <MakkahWeLogo size="md" showSubtitle={false} />
            <h1 className="mt-4 text-2xl font-extrabold text-slate-900">
              تسجيل الدخول
            </h1>
          </div>

          {error && (
            <div
              role="alert"
              className="mb-5 p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-800 text-xs sm:text-sm flex items-center gap-2.5"
            >
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
              <span className="font-bold">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="tech-code-input"
                className="block text-sm font-bold text-slate-800 mb-2"
              >
                كود الفني
              </label>
              <div className="relative">
                <input
                  id="tech-code-input"
                  type="text"
                  dir="ltr"
                  required
                  autoComplete="username"
                  placeholder="Code"
                  value={technicianCode}
                  onChange={(e) => setTechnicianCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-4 py-3.5 text-left font-mono-tabular text-base font-bold text-slate-900 focus:bg-white focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
                />
                <UserCheck className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <div>
              <label
                htmlFor="tech-password-input"
                className="block text-sm font-bold text-slate-800 mb-2"
              >
                كلمة المرور
              </label>
              <div className="relative">
                <input
                  id="tech-password-input"
                  type="password"
                  dir="ltr"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50/70 px-4 py-3.5 text-left font-mono-tabular text-base text-slate-900 focus:bg-white focus:border-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-700/20"
                />
                <Lock className="w-5 h-5 text-slate-400 absolute right-3.5 top-3.5 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[50px] rounded-xl bg-gradient-to-r from-[#4C1D95] to-[#6B21A8] hover:from-[#3B0764] hover:to-[#581C87] text-white font-bold text-base py-3.5 px-6 shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>جاري الدخول...</span>
                </>
              ) : (
                <>
                  <span>تسجيل الدخول</span>
                  <ArrowLeft className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </motion.div>
      </main>

      <footer className="text-center text-xs text-purple-200/60 pb-2">
        MAKKAH WE – FTTH
      </footer>
    </div>
  );
};
