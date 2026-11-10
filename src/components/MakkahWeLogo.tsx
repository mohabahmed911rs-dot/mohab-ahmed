import React, { useState } from 'react';
import { motion } from 'motion/react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  light?: boolean;
  showSubtitle?: boolean;
}

export const MakkahWeLogo: React.FC<LogoProps> = ({
  size = 'md',
  light = false,
  showSubtitle = true,
}) => {
  const [imgError, setImgError] = useState(false);

  const dimensions = {
    sm: 'w-9 h-9',
    md: 'w-11 h-11',
    lg: 'w-14 h-14',
    xl: 'w-20 h-20',
  }[size];

  const titleClass = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }[size];

  return (
    <div className="inline-flex items-center gap-3 select-none">
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={`${dimensions} relative rounded-2xl overflow-hidden bg-gradient-to-br from-[#4C1D95] via-[#3B0764] to-[#1E0538] shadow-md flex items-center justify-center shrink-0 border border-purple-400/30`}
      >
        {!imgError ? (
          <img
            src="/src/assets/images/makkah_we_logo_emblem_1794241641465.jpg"
            alt="شعار MAKKAH WE للألياف الضوئية"
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : null}
        {/* Animated SVG Fiber Optic Overlay */}
        <svg
          viewBox="0 0 100 100"
          className={`w-full h-full p-1.5 ${!imgError ? 'absolute inset-0 bg-purple-950/35' : ''}`}
          fill="none"
          aria-hidden="true"
        >
          <motion.path
            d="M16 68 C 34 42, 48 44, 58 54 C 68 64, 78 38, 86 22"
            stroke="#FFFFFF"
            strokeWidth="5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.5 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
          <motion.path
            d="M22 78 C 38 54, 52 54, 62 64 C 72 74, 82 50, 88 34"
            stroke="#D8B4FE"
            strokeWidth="3.5"
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0.4 }}
            animate={{ pathLength: 1, opacity: 0.9 }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.1 }}
          />
          <circle cx="86" cy="22" r="4.5" fill="#FFFFFF" />
          <circle cx="88" cy="34" r="3" fill="#E9D5FF" />
          <circle cx="16" cy="68" r="3.5" fill="#C084FC" />
        </svg>
      </motion.div>

      <div className="flex flex-col leading-tight">
        <span
          className={`${titleClass} font-extrabold tracking-tight whitespace-nowrap ${
            light ? 'text-white' : 'text-slate-900'
          }`}
        >
          MAKKAH <span className={light ? 'text-purple-200' : 'text-purple-800'}>WE</span>
        </span>
        {showSubtitle && (
          <span
            className={`text-xs font-medium whitespace-nowrap ${
              light ? 'text-purple-200/90' : 'text-slate-500'
            }`}
          >
            FTTH Fiber Optics · الألياف الضوئية
          </span>
        )}
      </div>
    </div>
  );
};

export const AnimatedSplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#1E0538] via-[#3B0764] to-[#4C1D95] text-white px-6"
    >
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 12 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col items-center text-center max-w-md"
      >
        <MakkahWeLogo size="xl" light showSubtitle={false} />
        <p className="mt-4 text-lg font-semibold text-purple-100">
          نظام إدارة فنيي الألياف الضوئية والخطوط الأرضية
        </p>
        <p className="mt-1 text-xs text-purple-200/80">
          MAKKAH WE – FTTH Telecommunications Management
        </p>

        <div className="mt-8 w-56 h-1.5 bg-purple-950/70 rounded-full overflow-hidden border border-purple-400/20">
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '0%' }}
            transition={{ duration: 1.1, ease: 'easeInOut' }}
            onAnimationComplete={onFinish}
            className="h-full w-full bg-gradient-to-r from-purple-300 via-white to-purple-200 rounded-full"
          />
        </div>

        <button
          type="button"
          onClick={onFinish}
          className="mt-6 text-xs text-purple-200/90 hover:text-white underline underline-offset-4 cursor-pointer min-h-[44px] px-4"
        >
          الدخول مباشرة إلى النظام
        </button>
      </motion.div>
    </motion.div>
  );
};
