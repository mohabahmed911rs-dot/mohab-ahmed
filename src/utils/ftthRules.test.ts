import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateLandlineNumber,
  getCairoDateTime,
  isDuplicateRegistrationOnSameDay,
  validateTechnicianPayload,
  computeDashboardStats,
  computeMonthlyReportSummary,
} from './ftthRules';

test('validateLandlineNumber accepts exactly 8 numerical digits (Western and Arabic numerals)', () => {
  const res1 = validateLandlineNumber('23456789');
  assert.equal(res1.valid, true);
  assert.equal(res1.cleaned, '23456789');

  const resArabic = validateLandlineNumber('٢٣٤٥٦٧٨٩');
  assert.equal(resArabic.valid, true);
  assert.equal(resArabic.cleaned, '23456789');
});

test('validateLandlineNumber rejects letters, symbols, and fewer/more than 8 digits', () => {
  assert.equal(validateLandlineNumber('').valid, false);
  assert.equal(validateLandlineNumber('1234567').valid, false);
  assert.equal(validateLandlineNumber('123456789').valid, false);
  assert.equal(validateLandlineNumber('1234abcd').valid, false);
  assert.equal(validateLandlineNumber('1234-567').valid, false);
});

test('getCairoDateTime formats date in Africa/Cairo timezone accurately', () => {
  const fixedUtc = new Date('2026-11-09T22:30:00.000Z'); // In Cairo (UTC+2), this is 2026-11-10 00:30:00
  const cairo = getCairoDateTime(fixedUtc);
  assert.equal(cairo.date, '2026-11-10');
  assert.equal(cairo.month, '2026-11');
  assert.equal(cairo.timezone, 'Africa/Cairo');
  assert.match(cairo.time, /^00:30:00$/);
});

test('isDuplicateRegistrationOnSameDay prevents duplicate landline on the same day only', () => {
  const existing = [
    { id: 1, landlineNumber: '24567890', registrationDate: '2026-11-09' },
    { id: 2, landlineNumber: '38765432', registrationDate: '2026-11-08' },
  ];

  assert.equal(isDuplicateRegistrationOnSameDay(existing, '24567890', '2026-11-09'), true);
  assert.equal(isDuplicateRegistrationOnSameDay(existing, '24567890', '2026-11-10'), false);
  assert.equal(isDuplicateRegistrationOnSameDay(existing, '24567890', '2026-11-09', 1), false);
});

test('validateTechnicianPayload enforces username === technicianCode and validates fields', () => {
  const validTech = validateTechnicianPayload({
    technicianCode: 'tech-1005',
    fullName: 'أحمد محمود السيد',
    email: 'ahmed.tech@makkahwe.com',
    password: 'StrongPassword123',
    requirePassword: true,
  });

  assert.equal(validTech.valid, true);
  assert.equal(validTech.normalizedCode, 'TECH-1005');
  assert.equal(validTech.username, 'TECH-1005');

  const shortPass = validateTechnicianPayload({
    technicianCode: 'TECH-1005',
    fullName: 'أحمد محمود',
    email: 'ahmed@makkahwe.com',
    password: '12',
    requirePassword: true,
  });
  assert.equal(shortPass.valid, false);
});

test('computeDashboardStats and computeMonthlyReportSummary calculate exact KPI counts', () => {
  const techs = [
    { id: 1, technicianCode: 'TECH-1001', fullName: 'فني 1', status: 'active' },
    { id: 2, technicianCode: 'TECH-1002', fullName: 'فني 2', status: 'active' },
    { id: 3, technicianCode: 'TECH-1003', fullName: 'فني 3', status: 'disabled' },
  ];
  const regs = [
    {
      id: 10,
      technicianId: 1,
      technicianCode: 'TECH-1001',
      technicianName: 'فني 1',
      landlineNumber: '22334455',
      registrationDate: '2026-11-09',
      registrationTime: '10:00:00',
      registrationMonth: '2026-11',
    },
    {
      id: 11,
      technicianId: 1,
      technicianCode: 'TECH-1001',
      technicianName: 'فني 1',
      landlineNumber: '22334456',
      registrationDate: '2026-11-08',
      registrationTime: '11:00:00',
      registrationMonth: '2026-11',
    },
    {
      id: 12,
      technicianId: 2,
      technicianCode: 'TECH-1002',
      technicianName: 'فني 2',
      landlineNumber: '33445566',
      registrationDate: '2026-10-25',
      registrationTime: '14:00:00',
      registrationMonth: '2026-10',
    },
  ];

  const kpis = computeDashboardStats(techs, regs, '2026-11-09', '2026-11');
  assert.equal(kpis.totalTechnicians, 3);
  assert.equal(kpis.activeTechnicians, 2);
  assert.equal(kpis.disabledTechnicians, 1);
  assert.equal(kpis.totalRegistrations, 3);
  assert.equal(kpis.registrationsToday, 1);
  assert.equal(kpis.registrationsThisMonth, 2);

  const monthly = computeMonthlyReportSummary(techs, regs, '2026-11');
  assert.equal(monthly.totalRegistrations, 2);
  assert.equal(monthly.activeContributorsCount, 1);
  assert.equal(monthly.technicianBreakdown[0].technicianCode, 'TECH-1001');
  assert.equal(monthly.technicianBreakdown[0].totalRegistrations, 2);
  assert.equal(monthly.technicianBreakdown[0].sharePercent, 100);
});
