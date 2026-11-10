export interface LandlineValidationResult {
  valid: boolean;
  cleaned: string;
  error?: string;
}

export interface CairoDateTime {
  date: string; // YYYY-MM-DD
  time: string; // HH:mm:ss
  month: string; // YYYY-MM
  formattedArabicDate: string;
  timezone: 'Africa/Cairo';
}

export interface TechnicianSummaryRecord {
  id: number;
  technicianCode: string;
  fullName: string;
  status: string;
  email?: string;
}

export interface RegistrationSummaryRecord {
  id?: number;
  technicianId: number;
  technicianCode: string;
  technicianName: string;
  landlineNumber: string;
  registrationDate: string;
  registrationTime: string;
  registrationMonth: string;
}

/**
 * Converts Eastern Arabic digits (٠-٩) to Western digits (0-9) without stripping letters/symbols
 * so invalid characters are still caught by validation.
 */
export function normalizeArabicDigits(input: string): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  return input
    .trim()
    .split('')
    .map((ch) => {
      const idx = arabicDigits.indexOf(ch);
      return idx !== -1 ? String(idx) : ch;
    })
    .join('');
}

/**
 * Validates the 8-digit landline number according to strict FTTH rules:
 * - Accept exactly 8 numerical digits
 * - Reject letters and symbols
 * - Reject numbers with fewer or more than 8 digits
 */
export function validateLandlineNumber(rawInput: string): LandlineValidationResult {
  const normalized = normalizeArabicDigits(rawInput || '');

  if (!normalized) {
    return {
      valid: false,
      cleaned: '',
      error: 'يرجى إدخال رقم التليفون الأرضي المكون من 8 أرقام.',
    };
  }

  if (!/^\d+$/.test(normalized)) {
    return {
      valid: false,
      cleaned: normalized,
      error: 'رقم غير صالح: يُسمح بإدخال الأرقام فقط ويُمنع إدخال الحروف أو الرموز.',
    };
  }

  if (normalized.length !== 8) {
    return {
      valid: false,
      cleaned: normalized,
      error: `رقم غير صالح: يجب أن يتكون رقم التليفون الأرضي من 8 أرقام بالضبط (تم إدخال ${normalized.length} أرقام).`,
    };
  }

  return {
    valid: true,
    cleaned: normalized,
  };
}

/**
 * Returns the current date, time, and month in Egypt's local timezone (Africa/Cairo).
 */
export function getCairoDateTime(now: Date = new Date()): CairoDateTime {
  const partsFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = partsFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '00';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  let hour = getPart('hour');
  if (hour === '24') hour = '00';
  const minute = getPart('minute');
  const second = getPart('second');

  const date = `${year}-${month}-${day}`;
  const time = `${hour}:${minute}:${second}`;
  const yearMonth = `${year}-${month}`;

  let formattedArabicDate = date;
  try {
    formattedArabicDate = new Intl.DateTimeFormat('ar-EG', {
      timeZone: 'Africa/Cairo',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(now);
  } catch {
    formattedArabicDate = date;
  }

  return {
    date,
    time,
    month: yearMonth,
    formattedArabicDate,
    timezone: 'Africa/Cairo',
  };
}

/**
 * Checks whether the same landline number has already been registered on the same date.
 */
export function isDuplicateRegistrationOnSameDay(
  existingRegistrations: Array<{ id?: number; landlineNumber: string; registrationDate: string }>,
  landlineNumber: string,
  registrationDate: string,
  excludeId?: number
): boolean {
  const cleanedTarget = normalizeArabicDigits(landlineNumber);
  return existingRegistrations.some(
    (reg) =>
      (excludeId === undefined || reg.id !== excludeId) &&
      reg.landlineNumber === cleanedTarget &&
      reg.registrationDate === registrationDate
  );
}

/**
 * Validates technician creation / update fields and enforces username = technicianCode.
 */
export function validateTechnicianPayload(input: {
  technicianCode: string;
  fullName: string;
  email: string;
  password?: string;
  requirePassword?: boolean;
}): {
  valid: boolean;
  normalizedCode: string;
  username: string;
  normalizedEmail: string;
  trimmedName: string;
  error?: string;
} {
  const normalizedCode = (input.technicianCode || '').trim().toUpperCase();
  const trimmedName = (input.fullName || '').trim();
  const normalizedEmail = (input.email || '').trim().toLowerCase();
  const password = input.password || '';

  if (!normalizedCode || normalizedCode.length < 3 || normalizedCode.length > 32) {
    return {
      valid: false,
      normalizedCode,
      username: normalizedCode,
      normalizedEmail,
      trimmedName,
      error: 'يرجى إدخال كود فني صالح (من 3 إلى 32 حرفاً أو رقماً).',
    };
  }

  if (!/^[A-Z0-9_-]+$/.test(normalizedCode)) {
    return {
      valid: false,
      normalizedCode,
      username: normalizedCode,
      normalizedEmail,
      trimmedName,
      error: 'كود الفني يجب أن يحتوي على حروف إنجليزية وأرقام أو شرطة فقط (مثال: TECH-1001).',
    };
  }

  if (!trimmedName || trimmedName.length < 3) {
    return {
      valid: false,
      normalizedCode,
      username: normalizedCode,
      normalizedEmail,
      trimmedName,
      error: 'يرجى إدخال اسم الفني بالكامل (3 أحرف على الأقل).',
    };
  }

  if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return {
      valid: false,
      normalizedCode,
      username: normalizedCode,
      normalizedEmail,
      trimmedName,
      error: 'يرجى إدخال بريد إلكتروني صحيح للفني.',
    };
  }

  if (input.requirePassword && password.trim().length < 3) {
    return {
      valid: false,
      normalizedCode,
      username: normalizedCode,
      normalizedEmail,
      trimmedName,
      error: 'كلمة المرور يجب أن تتكون من 3 خانات على الأقل.',
    };
  }

  return {
    valid: true,
    normalizedCode,
    username: normalizedCode, // Username is strictly enforced to equal Technician Code
    normalizedEmail,
    trimmedName,
  };
}

/**
 * Computes the 6 mandatory administrator dashboard KPIs.
 */
export function computeDashboardStats(
  technicians: TechnicianSummaryRecord[],
  registrations: RegistrationSummaryRecord[],
  todayDate: string,
  currentMonth: string
) {
  const totalTechnicians = technicians.length;
  const activeTechnicians = technicians.filter((t) => t.status === 'active').length;
  const disabledTechnicians = technicians.filter((t) => t.status !== 'active').length;

  const totalRegistrations = registrations.length;
  const registrationsToday = registrations.filter((r) => r.registrationDate === todayDate).length;
  const registrationsThisMonth = registrations.filter((r) => r.registrationMonth === currentMonth).length;

  return {
    totalTechnicians,
    activeTechnicians,
    disabledTechnicians,
    totalRegistrations,
    registrationsToday,
    registrationsThisMonth,
  };
}

/**
 * Computes monthly report metrics per technician and overall totals for a given YYYY-MM month.
 */
export function computeMonthlyReportSummary(
  technicians: TechnicianSummaryRecord[],
  registrations: RegistrationSummaryRecord[],
  reportMonth: string
) {
  const monthRegs = registrations.filter((r) => r.registrationMonth === reportMonth);
  const totalRegistrations = monthRegs.length;

  const technicianBreakdown = technicians
    .map((tech) => {
      const techRegs = monthRegs.filter(
        (r) => r.technicianId === tech.id || r.technicianCode === tech.technicianCode
      );
      const count = techRegs.length;
      const sharePercent =
        totalRegistrations > 0 ? Math.round((count / totalRegistrations) * 1000) / 10 : 0;
      const lastDate =
        techRegs.length > 0
          ? [...techRegs].sort((a, b) => b.registrationDate.localeCompare(a.registrationDate))[0]
              .registrationDate
          : '-';

      return {
        technicianId: tech.id,
        technicianCode: tech.technicianCode,
        technicianName: tech.fullName,
        status: tech.status,
        totalRegistrations: count,
        sharePercent,
        lastRegistrationDate: lastDate,
      };
    })
    .sort((a, b) => b.totalRegistrations - a.totalRegistrations);

  const activeContributorsCount = technicianBreakdown.filter((t) => t.totalRegistrations > 0).length;

  return {
    reportMonth,
    totalRegistrations,
    activeContributorsCount,
    totalTechniciansCount: technicians.length,
    technicianBreakdown,
    registrations: monthRegs,
  };
}
