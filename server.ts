import express from 'express';
import type { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'node:path';
import fs from 'node:fs';
import * as dotenv from 'dotenv';
import * as XLSX from 'xlsx';

import {
  getAllTechnicians,
  getTechnicianByCode,
  getTechnicianById,
  getAdminByIdentifier,
  getAllRegistrations,
  getRegistrationsByTechnician,
  createRegistrationRecord,
  updateRegistrationRecord,
  deleteRegistrationRecord,
  createTechnicianRecord,
  updateTechnicianRecord,
  updateTechnicianPassword,
  updateTechnicianStatus,
  deleteTechnicianRecord,
  getAllActivityLogs,
  getArchivedMonthlyReports,
  saveArchivedMonthlyReport,
  logActivity,
} from './src/db/repository.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';
import { hashPassword, verifyPassword, createSessionToken } from './src/lib/security.ts';
import { requireAuth, requireAdmin, requireTechnician } from './src/middleware/auth.ts';
import type { AuthRequest } from './src/middleware/auth.ts';
import {
  validateLandlineNumber,
  getCairoDateTime,
  isDuplicateRegistrationOnSameDay,
  validateTechnicianPayload,
  computeDashboardStats,
  computeMonthlyReportSummary,
} from './src/utils/ftthRules.ts';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  // Ensure any previously registered Service Workers in client browsers immediately unregister
  app.get(['/sw.js', '/registerSW.js'], (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.send(
      `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => {
  self.registration.unregister().then(() => self.clients.matchAll()).then((clients) => {
    clients.forEach((client) => client.navigate(client.url));
  });
});`
    );
  });

  app.get('/manifest.webmanifest', (_req: Request, res: Response) => {
    res.status(404).end();
  });

  // =========================================================================
  // 1. PUBLIC & AUTHENTICATION ROUTES
  // =========================================================================

  app.get('/api/cairo-time', (_req: Request, res: Response) => {
    const cairo = getCairoDateTime();
    res.json(cairo);
  });

  /**
   * Unified Login Endpoint:
   * - If technicianCode is "admin" and password is "1001" (or matches admin hash), logs in as Administrator.
   * - Otherwise logs in as Technician using Technician Code + Admin-created Password.
   */
  app.post('/api/auth/technician-login', async (req: Request, res: Response) => {
    try {
      const { technicianCode, password } = req.body || {};
      const rawCode = String(technicianCode || '').trim();
      const rawPassword = String(password || '').trim();

      if (!rawCode || !rawPassword) {
        return res.status(400).json({
          error: 'يرجى إدخال كود الفني وكلمة المرور.',
        });
      }

      // Check if logging in as Administrator (code = admin, password = 1001)
      if (rawCode.toLowerCase() === 'admin') {
        const admin = await getAdminByIdentifier('admin');
        const isValidAdminPw =
          rawPassword === '1001' || (admin ? verifyPassword(rawPassword, admin.passwordHash) : false);

        if (!isValidAdminPw) {
          return res.status(401).json({
            error: 'كود الفني أو كلمة المرور غير صحيحة.',
          });
        }

        const adminUser = admin || {
          id: 1,
          username: 'admin',
          fullName: 'مدير النظام - MAKKAH WE',
          email: 'mohabahmed.911rs@gmail.com',
        };

        const token = createSessionToken({
          role: 'admin',
          id: adminUser.id,
          code: adminUser.username,
          name: adminUser.fullName,
          email: adminUser.email,
        });

        await logActivity({
          actorType: 'admin',
          actorId: adminUser.username,
          actorName: adminUser.fullName,
          actionType: 'ADMIN_LOGIN',
          targetType: 'auth',
          targetId: adminUser.username,
          details: 'تسجيل دخول المسؤول (admin) إلى لوحة التحكم المركزية',
        });

        return res.json({
          token,
          user: {
            id: adminUser.id,
            role: 'admin',
            username: adminUser.username,
            fullName: adminUser.fullName,
            email: adminUser.email,
          },
          cairoTime: getCairoDateTime(),
        });
      }

      const cleanCode = rawCode.toUpperCase();
      const tech = await getTechnicianByCode(cleanCode);
      if (!tech) {
        return res.status(401).json({
          error: 'كود الفني أو كلمة المرور غير صحيحة.',
        });
      }

      if (!verifyPassword(rawPassword, tech.passwordHash)) {
        return res.status(401).json({
          error: 'كود الفني أو كلمة المرور غير صحيحة.',
        });
      }

      if (tech.status !== 'active') {
        return res.status(403).json({
          error: 'هذا الحساب موقوف حالياً من قِبل الإدارة. يرجى التواصل مع المسؤول لتفعيل الحساب.',
        });
      }

      const token = createSessionToken({
        role: 'technician',
        id: tech.id,
        code: tech.technicianCode,
        name: tech.fullName,
        email: tech.email,
      });

      await logActivity({
        actorType: 'technician',
        actorId: tech.technicianCode,
        actorName: tech.fullName,
        actionType: 'TECHNICIAN_LOGIN',
        targetType: 'auth',
        targetId: tech.technicianCode,
        details: `تسجيل دخول ناجح للفني (${tech.technicianCode}) إلى تطبيق MAKKAH WE`,
      });

      res.json({
        token,
        user: {
          id: tech.id,
          role: 'technician',
          technicianCode: tech.technicianCode,
          username: tech.username,
          fullName: tech.fullName,
          email: tech.email,
          status: tech.status,
          phone: tech.phone,
          governorate: tech.governorate,
        },
        cairoTime: getCairoDateTime(),
      });
    } catch (error: unknown) {
      console.error('Technician login error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'حدث خطأ أثناء تسجيل الدخول.',
      });
    }
  });

  /**
   * Administrator Login (Credentials)
   */
  app.post('/api/auth/admin-login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};
      const cleanId = String(username || '').trim();
      const rawPassword = String(password || '');

      if (!cleanId || !rawPassword) {
        return res.status(400).json({
          error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور للمسؤول.',
        });
      }

      const admin = await getAdminByIdentifier(cleanId);
      if (!admin || !verifyPassword(rawPassword, admin.passwordHash)) {
        return res.status(401).json({
          error: 'بيانات دخول المسؤول غير صحيحة.',
        });
      }

      const token = createSessionToken({
        role: 'admin',
        id: admin.id,
        code: admin.username,
        name: admin.fullName,
        email: admin.email,
      });

      await logActivity({
        actorType: 'admin',
        actorId: admin.username,
        actorName: admin.fullName,
        actionType: 'ADMIN_LOGIN',
        targetType: 'auth',
        targetId: admin.username,
        details: `تسجيل دخول المسؤول (${admin.fullName}) إلى لوحة التحكم المركزية`,
      });

      res.json({
        token,
        user: {
          id: admin.id,
          role: 'admin',
          username: admin.username,
          fullName: admin.fullName,
          email: admin.email,
        },
        cairoTime: getCairoDateTime(),
      });
    } catch (error: unknown) {
      console.error('Admin login error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'حدث خطأ أثناء تسجيل دخول المسؤول.',
      });
    }
  });

  /**
   * Administrator Login via Firebase Google Sign-In
   */
  app.post('/api/auth/admin-firebase', async (req: Request, res: Response) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'رمز المصادقة مفقود.' });
      }
      const idToken = authHeader.split('Bearer ')[1].trim();
      const decoded = await adminAuth.verifyIdToken(idToken);
      const email = decoded.email || 'admin@makkahwe.com';
      const dbUser = await getOrCreateUser(decoded.uid, email);

      const sessionToken = createSessionToken({
        role: 'admin',
        id: dbUser?.id || 1,
        code: 'ADMIN',
        name: decoded.name || 'مدير النظام (Google)',
        email,
      });

      await logActivity({
        actorType: 'admin',
        actorId: email,
        actorName: decoded.name || email,
        actionType: 'ADMIN_GOOGLE_LOGIN',
        targetType: 'auth',
        targetId: email,
        details: `تسجيل دخول المسؤول عبر Google Auth (${email})`,
      });

      res.json({
        token: sessionToken,
        user: {
          id: dbUser?.id || 1,
          role: 'admin',
          username: 'admin',
          fullName: decoded.name || 'مدير النظام - MAKKAH WE',
          email,
        },
        cairoTime: getCairoDateTime(),
      });
    } catch (error: unknown) {
      console.error('Firebase admin auth error:', error);
      res.status(401).json({ error: 'فشل التحقق من مصادقة Google للمسؤول.' });
    }
  });

  /**
   * Verify Current Session
   */
  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const session = req.session!;
      const cairoTime = getCairoDateTime();

      if (session.role === 'technician') {
        const tech = await getTechnicianById(session.id);
        if (!tech || tech.status !== 'active') {
          return res.status(403).json({
            error: 'تم إيقاف هذا الحساب من قِبل الإدارة.',
          });
        }
        return res.json({
          user: {
            id: tech.id,
            role: 'technician',
            technicianCode: tech.technicianCode,
            username: tech.username,
            fullName: tech.fullName,
            email: tech.email,
            status: tech.status,
            phone: tech.phone,
            governorate: tech.governorate,
          },
          cairoTime,
        });
      }

      return res.json({
        user: {
          id: session.id,
          role: 'admin',
          username: session.code,
          fullName: session.name,
          email: session.email,
        },
        cairoTime,
      });
    } catch (error: unknown) {
      console.error('Session verify error:', error);
      res.status(500).json({ error: 'تعذر التحقق من جلسة المستخدم.' });
    }
  });

  // =========================================================================
  // 2. TECHNICIAN PORTAL ROUTES (Strictly Isolated to Own Account)
  // =========================================================================

  app.get('/api/technician/dashboard', requireTechnician, async (req: AuthRequest, res: Response) => {
    try {
      const session = req.session!;
      const tech = await getTechnicianById(session.id);

      if (!tech || tech.status !== 'active') {
        return res.status(403).json({
          error: 'حساب الفني غير مفعل حالياً. يرجى التواصل مع الإدارة.',
        });
      }

      const cairoTime = getCairoDateTime();
      const myRegistrations = await getRegistrationsByTechnician(tech.id);

      const dailyCount = myRegistrations.filter((r) => r.registrationDate === cairoTime.date).length;
      const monthlyCount = myRegistrations.filter((r) => r.registrationMonth === cairoTime.month).length;

      res.json({
        technician: {
          id: tech.id,
          technicianCode: tech.technicianCode,
          username: tech.username,
          fullName: tech.fullName,
          email: tech.email,
          status: tech.status,
          phone: tech.phone,
          governorate: tech.governorate,
        },
        cairoTime,
        stats: {
          dailyCount,
          monthlyCount,
          totalCount: myRegistrations.length,
        },
        registrations: myRegistrations,
      });
    } catch (error: unknown) {
      console.error('Technician dashboard error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر تحميل بيانات الفني.',
      });
    }
  });

  /**
   * Technician Save Landline Number:
   * - Validates 8 numerical digits
   * - Automatically retrieves technician account info
   * - Automatically retrieves current date/time in Africa/Cairo timezone
   * - Prevents duplicate landline on the same day
   */
  app.post('/api/technician/registrations', requireTechnician, async (req: AuthRequest, res: Response) => {
    try {
      const session = req.session!;
      const tech = await getTechnicianById(session.id);

      if (!tech || tech.status !== 'active') {
        return res.status(403).json({
          error: 'حساب الفني غير مفعل. لا يمكن تسجيل خطوط جديدة.',
        });
      }

      const { landlineNumber, registrationDate } = req.body || {};
      const validation = validateLandlineNumber(String(landlineNumber || ''));

      if (!validation.valid) {
        return res.status(400).json({
          error: validation.error,
        });
      }

      // Retrieve current Egypt date & time, allowing technician to specify/adjust registrationDate
      const cairoNow = getCairoDateTime();
      const targetDate =
        typeof registrationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(registrationDate.trim())
          ? registrationDate.trim()
          : cairoNow.date;
      const targetMonth = targetDate.slice(0, 7);

      // Check duplicate registration of the same landline number on the same day
      const allRegs = await getAllRegistrations();
      if (isDuplicateRegistrationOnSameDay(allRegs, validation.cleaned, targetDate)) {
        return res.status(409).json({
          error: `رقم التليفون الأرضي (${validation.cleaned}) مسجل بالفعل في تاريخ (${targetDate}). لا يمكن تكرار تسجيل نفس الرقم في نفس اليوم.`,
        });
      }

      const created = await createRegistrationRecord({
        technicianId: tech.id,
        technicianCode: tech.technicianCode,
        technicianName: tech.fullName,
        landlineNumber: validation.cleaned,
        registrationDate: targetDate,
        registrationTime: cairoNow.time,
        registrationMonth: targetMonth,
        createdBy: tech.technicianCode,
      });

      await logActivity({
        actorType: 'technician',
        actorId: tech.technicianCode,
        actorName: tech.fullName,
        actionType: 'CREATE_REGISTRATION',
        targetType: 'registration',
        targetId: String(created.id),
        details: `قام الفني ${tech.fullName} (${tech.technicianCode}) بتسجيل خط أرضي رقم ${validation.cleaned} بتاريخ ${targetDate} الساعة ${cairoNow.time}`,
      });

      res.status(201).json({
        message: 'تم حفظ رقم التليفون الأرضي بنجاح ومزامنته مع لوحة تحكم المسؤول.',
        registration: created,
        cairoTime: cairoNow,
      });
    } catch (error: unknown) {
      console.error('Technician create registration error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر حفظ رقم التليفون الأرضي.',
      });
    }
  });

  /**
   * Technician Edit Own Registration (Landline Number & Registration Date)
   */
  app.put(
    '/api/technician/registrations/:id',
    requireTechnician,
    async (req: AuthRequest, res: Response) => {
      try {
        const session = req.session!;
        const tech = await getTechnicianById(session.id);
        if (!tech || tech.status !== 'active') {
          return res.status(403).json({
            error: 'حساب الفني غير مفعل.',
          });
        }

        const regId = Number(req.params.id);
        if (!regId) {
          return res.status(400).json({ error: 'معرف التسجيل غير صالح.' });
        }

        const allRegs = await getAllRegistrations();
        const existingReg = allRegs.find((r) => r.id === regId && r.technicianId === tech.id);
        if (!existingReg) {
          return res.status(404).json({ error: 'السجل المطلوب تعديله غير موجود.' });
        }

        const { landlineNumber, registrationDate } = req.body || {};
        const validation = validateLandlineNumber(
          String(landlineNumber ?? existingReg.landlineNumber)
        );
        if (!validation.valid) {
          return res.status(400).json({ error: validation.error });
        }

        const targetDate =
          typeof registrationDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(registrationDate.trim())
            ? registrationDate.trim()
            : existingReg.registrationDate;
        const targetMonth = targetDate.slice(0, 7);

        if (isDuplicateRegistrationOnSameDay(allRegs, validation.cleaned, targetDate, regId)) {
          return res.status(409).json({
            error: `رقم التليفون الأرضي (${validation.cleaned}) مسجل بالفعل في تاريخ (${targetDate}).`,
          });
        }

        const updated = await updateRegistrationRecord(regId, {
          technicianId: tech.id,
          technicianCode: tech.technicianCode,
          technicianName: tech.fullName,
          landlineNumber: validation.cleaned,
          registrationDate: targetDate,
          registrationTime: existingReg.registrationTime,
          registrationMonth: targetMonth,
        });

        await logActivity({
          actorType: 'technician',
          actorId: tech.technicianCode,
          actorName: tech.fullName,
          actionType: 'TECH_EDIT_REGISTRATION',
          targetType: 'registration',
          targetId: String(regId),
          details: `قام الفني ${tech.fullName} بتعديل التسجيل #${regId}: الرقم (${existingReg.landlineNumber} -> ${validation.cleaned})، التاريخ (${existingReg.registrationDate} -> ${targetDate})`,
        });

        res.json({
          message: 'تم تعديل رقم التليفون الأرضي والتاريخ بنجاح.',
          registration: updated,
        });
      } catch (error: unknown) {
        console.error('Technician update registration error:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'تعذر تعديل بيانات التسجيل.',
        });
      }
    }
  );

  /**
   * Technician Delete Own Registration
   */
  app.delete(
    '/api/technician/registrations/:id',
    requireTechnician,
    async (req: AuthRequest, res: Response) => {
      try {
        const session = req.session!;
        const tech = await getTechnicianById(session.id);
        if (!tech || tech.status !== 'active') {
          return res.status(403).json({
            error: 'حساب الفني غير مفعل.',
          });
        }

        const regId = Number(req.params.id);
        if (!regId) {
          return res.status(400).json({ error: 'معرف التسجيل غير صالح.' });
        }

        const myRegs = await getRegistrationsByTechnician(tech.id);
        const target = myRegs.find((r) => r.id === regId);
        if (!target) {
          return res.status(404).json({ error: 'السجل المطلوب حذفه غير موجود.' });
        }

        const deleted = await deleteRegistrationRecord(regId);

        await logActivity({
          actorType: 'technician',
          actorId: tech.technicianCode,
          actorName: tech.fullName,
          actionType: 'TECH_DELETE_REGISTRATION',
          targetType: 'registration',
          targetId: String(regId),
          details: `قام الفني ${tech.fullName} بحذف تسجيل الرقم (${target.landlineNumber}) المؤرخ في ${target.registrationDate}`,
        });

        res.json({
          message: `تم حذف الرقم (${deleted?.landlineNumber || target.landlineNumber}) بنجاح.`,
        });
      } catch (error: unknown) {
        console.error('Technician delete registration error:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'تعذر حذف التسجيل.',
        });
      }
    }
  );

  // =========================================================================
  // 3. ADMINISTRATOR DASHBOARD ROUTES (Role-Based Access Control)
  // =========================================================================

  app.get('/api/admin/overview', requireAdmin, async (_req: AuthRequest, res: Response) => {
    try {
      const cairoTime = getCairoDateTime();
      const [allTechs, allRegs, logs, archivedReports] = await Promise.all([
        getAllTechnicians(),
        getAllRegistrations(),
        getAllActivityLogs(),
        getArchivedMonthlyReports(),
      ]);

      const stats = computeDashboardStats(allTechs, allRegs, cairoTime.date, cairoTime.month);
      const currentMonthReport = computeMonthlyReportSummary(allTechs, allRegs, cairoTime.month);

      // Build daily trend for the last 7 dates with activity or recent days
      const dailyMap = new Map<string, number>();
      for (const r of allRegs) {
        dailyMap.set(r.registrationDate, (dailyMap.get(r.registrationDate) || 0) + 1);
      }
      const dailyTrend = Array.from(dailyMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-10);

      // Technician total registrations ranking
      const technicianPerformance = allTechs
        .map((t) => {
          const techRegs = allRegs.filter((r) => r.technicianId === t.id);
          const todayRegs = techRegs.filter((r) => r.registrationDate === cairoTime.date).length;
          const monthRegs = techRegs.filter((r) => r.registrationMonth === cairoTime.month).length;
          return {
            id: t.id,
            technicianCode: t.technicianCode,
            username: t.username,
            fullName: t.fullName,
            email: t.email,
            status: t.status,
            phone: t.phone || '',
            governorate: t.governorate || '',
            totalRegistrations: techRegs.length,
            todayRegistrations: todayRegs,
            monthRegistrations: monthRegs,
          };
        })
        .sort((a, b) => b.totalRegistrations - a.totalRegistrations);

      res.json({
        cairoTime,
        stats,
        recentRegistrations: allRegs.slice(0, 15),
        dailyTrend,
        technicianPerformance,
        currentMonthReport,
        recentLogs: logs.slice(0, 20),
        archivedReportsCount: archivedReports.length,
      });
    } catch (error: unknown) {
      console.error('Admin overview error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر تحميل إحصائيات لوحة التحكم.',
      });
    }
  });

  /**
   * Technician Management: List & Search
   */
  app.get('/api/admin/technicians', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const cairoTime = getCairoDateTime();
      const search = String(req.query.search || '').trim().toLowerCase();
      const statusFilter = String(req.query.status || '').trim();

      const [allTechs, allRegs] = await Promise.all([
        getAllTechnicians(),
        getAllRegistrations(),
      ]);

      let enriched = allTechs.map((t) => {
        const techRegs = allRegs.filter((r) => r.technicianId === t.id);
        const todayCount = techRegs.filter((r) => r.registrationDate === cairoTime.date).length;
        const monthCount = techRegs.filter((r) => r.registrationMonth === cairoTime.month).length;
        return {
          id: t.id,
          technicianCode: t.technicianCode,
          username: t.username,
          email: t.email,
          fullName: t.fullName,
          status: t.status,
          phone: t.phone || '',
          governorate: t.governorate || '',
          createdAt: t.createdAt,
          totalRegistrations: techRegs.length,
          todayRegistrations: todayCount,
          monthRegistrations: monthCount,
          recentRegistrations: techRegs.slice(0, 10),
        };
      });

      if (statusFilter === 'active' || statusFilter === 'disabled') {
        enriched = enriched.filter((t) => t.status === statusFilter);
      }

      if (search) {
        enriched = enriched.filter(
          (t) =>
            t.technicianCode.toLowerCase().includes(search) ||
            t.fullName.toLowerCase().includes(search) ||
            t.email.toLowerCase().includes(search) ||
            t.governorate.toLowerCase().includes(search)
        );
      }

      res.json({ technicians: enriched });
    } catch (error: unknown) {
      console.error('Admin list technicians error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر جلب بيانات الفنيين.',
      });
    }
  });

  /**
   * Technician Management: Create Technician
   * Only Administrator can create technician accounts.
   * Username is automatically set to Technician Code.
   */
  app.post('/api/admin/technicians', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const session = req.session!;
      const { technicianCode, fullName, email, password, phone, governorate, status } = req.body || {};

      const validation = validateTechnicianPayload({
        technicianCode: String(technicianCode || ''),
        fullName: String(fullName || ''),
        email: String(email || ''),
        password: String(password || ''),
        requirePassword: true,
      });

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const existing = await getTechnicianByCode(validation.normalizedCode);
      if (existing) {
        return res.status(409).json({
          error: `كود الفني (${validation.normalizedCode}) مسجل بالفعل لفني آخر.`,
        });
      }

      const created = await createTechnicianRecord({
        technicianCode: validation.normalizedCode,
        username: validation.username, // Username = Technician Code
        email: validation.normalizedEmail,
        passwordHash: hashPassword(String(password).trim()),
        fullName: validation.trimmedName,
        status: status === 'disabled' ? 'disabled' : 'active',
        phone: String(phone || '').trim(),
        governorate: String(governorate || 'القاهرة').trim(),
      });

      await logActivity({
        actorType: 'admin',
        actorId: session.code,
        actorName: session.name,
        actionType: 'CREATE_TECHNICIAN',
        targetType: 'technician',
        targetId: created.technicianCode,
        details: `إنشاء حساب فني جديد: ${created.fullName} (الكود/اسم المستخدم: ${created.technicianCode}، البريد: ${created.email})`,
      });

      res.status(201).json({
        message: 'تم إنشاء حساب الفني بنجاح.',
        technician: {
          id: created.id,
          technicianCode: created.technicianCode,
          username: created.username,
          email: created.email,
          fullName: created.fullName,
          status: created.status,
          phone: created.phone,
          governorate: created.governorate,
        },
      });
    } catch (error: unknown) {
      console.error('Admin create technician error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر إنشاء حساب الفني.',
      });
    }
  });

  /**
   * Technician Management: Edit Technician Info
   */
  app.put('/api/admin/technicians/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const session = req.session!;
      const techId = Number(req.params.id);
      if (!techId) {
        return res.status(400).json({ error: 'معرف الفني غير صالح.' });
      }

      const existingTech = await getTechnicianById(techId);
      if (!existingTech) {
        return res.status(404).json({ error: 'الفني غير موجود.' });
      }

      const { technicianCode, fullName, email, phone, governorate, status } = req.body || {};
      const validation = validateTechnicianPayload({
        technicianCode: String(technicianCode || existingTech.technicianCode),
        fullName: String(fullName || existingTech.fullName),
        email: String(email || existingTech.email),
        requirePassword: false,
      });

      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      if (validation.normalizedCode !== existingTech.technicianCode) {
        const duplicateCode = await getTechnicianByCode(validation.normalizedCode);
        if (duplicateCode && duplicateCode.id !== techId) {
          return res.status(409).json({
            error: `كود الفني (${validation.normalizedCode}) مستخدم بالفعل لفني آخر.`,
          });
        }
      }

      const updated = await updateTechnicianRecord(techId, {
        technicianCode: validation.normalizedCode,
        username: validation.username,
        email: validation.normalizedEmail,
        fullName: validation.trimmedName,
        status: status === 'disabled' ? 'disabled' : 'active',
        phone: String(phone ?? existingTech.phone ?? '').trim(),
        governorate: String(governorate ?? existingTech.governorate ?? '').trim(),
      });

      await logActivity({
        actorType: 'admin',
        actorId: session.code,
        actorName: session.name,
        actionType: 'EDIT_TECHNICIAN',
        targetType: 'technician',
        targetId: validation.normalizedCode,
        details: `تعديل بيانات الفني (${existingTech.technicianCode} -> ${validation.normalizedCode}): الاسم: ${validation.trimmedName}، الحالة: ${status === 'disabled' ? 'موقوف' : 'نشط'}`,
      });

      res.json({
        message: 'تم تحديث بيانات الفني بنجاح.',
        technician: updated,
      });
    } catch (error: unknown) {
      console.error('Admin update technician error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر تحديث بيانات الفني.',
      });
    }
  });

  /**
   * Technician Management: Instant Password Reset (Admin Only)
   */
  app.post(
    '/api/admin/technicians/:id/reset-password',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const session = req.session!;
        const techId = Number(req.params.id);
        const { newPassword } = req.body || {};

        if (!techId || !newPassword || String(newPassword).trim().length < 3) {
          return res.status(400).json({
            error: 'كلمة المرور الجديدة يجب أن تتكون من 3 خانات على الأقل.',
          });
        }

        const tech = await getTechnicianById(techId);
        if (!tech) {
          return res.status(404).json({ error: 'حساب الفني غير موجود.' });
        }

        await updateTechnicianPassword(techId, hashPassword(String(newPassword).trim()));

        await logActivity({
          actorType: 'admin',
          actorId: session.code,
          actorName: session.name,
          actionType: 'RESET_PASSWORD',
          targetType: 'technician',
          targetId: tech.technicianCode,
          details: `إعادة تعيين كلمة المرور للفني ${tech.fullName} (${tech.technicianCode}) بواسطة المسؤول`,
        });

        res.json({
          message: `تم إعادة تعيين كلمة مرور الفني (${tech.technicianCode}) بنجاح وبشكل فوري.`,
        });
      } catch (error: unknown) {
        console.error('Admin reset password error:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'تعذر إعادة تعيين كلمة المرور.',
        });
      }
    }
  );

  /**
   * Technician Management: Activate / Disable Account
   */
  app.post(
    '/api/admin/technicians/:id/status',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const session = req.session!;
        const techId = Number(req.params.id);
        const { status } = req.body || {};

        if (!techId || (status !== 'active' && status !== 'disabled')) {
          return res.status(400).json({ error: 'حالة الحساب غير صالحة.' });
        }

        const tech = await getTechnicianById(techId);
        if (!tech) {
          return res.status(404).json({ error: 'حساب الفني غير موجود.' });
        }

        const updated = await updateTechnicianStatus(techId, status);

        await logActivity({
          actorType: 'admin',
          actorId: session.code,
          actorName: session.name,
          actionType: 'STATUS_CHANGE',
          targetType: 'technician',
          targetId: tech.technicianCode,
          details: `تغيير حالة حساب الفني ${tech.fullName} (${tech.technicianCode}) إلى: ${status === 'active' ? 'مفعل (نشط)' : 'موقوف'}`,
        });

        res.json({
          message:
            status === 'active'
              ? `تم تفعيل حساب الفني (${tech.technicianCode}) بنجاح.`
              : `تم إيقاف حساب الفني (${tech.technicianCode}) بنجاح.`,
          technician: updated,
        });
      } catch (error: unknown) {
        console.error('Admin status toggle error:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'تعذر تغيير حالة الحساب.',
        });
      }
    }
  );

  /**
   * Technician Management: Delete Technician (Admin Only)
   */
  app.delete(
    '/api/admin/technicians/:id',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const session = req.session!;
        const techId = Number(req.params.id);
        if (!techId) {
          return res.status(400).json({ error: 'معرف الفني غير صالح.' });
        }

        const deleted = await deleteTechnicianRecord(techId);
        if (!deleted) {
          return res.status(404).json({ error: 'حساب الفني المطلوب حذفه غير موجود.' });
        }

        await logActivity({
          actorType: 'admin',
          actorId: session.code,
          actorName: session.name,
          actionType: 'DELETE_TECHNICIAN',
          targetType: 'technician',
          targetId: deleted.technicianCode,
          details: `حذف حساب الفني ${deleted.fullName} (${deleted.technicianCode}) نهائياً بواسطة المسؤول`,
        });

        res.json({
          message: `تم حذف حساب الفني ${deleted.fullName} (${deleted.technicianCode}) بنجاح.`,
        });
      } catch (error: unknown) {
        console.error('Admin delete technician error:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'تعذر حذف حساب الفني.',
        });
      }
    }
  );

  // =========================================================================
  // 4. REGISTRATION MANAGEMENT ROUTES (Admin Full Control + Audit Logs)
  // =========================================================================

  app.get('/api/admin/registrations', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const search = String(req.query.search || '').trim().toLowerCase();
      const landlineFilter = String(req.query.landlineNumber || '').trim();
      const codeFilter = String(req.query.technicianCode || '').trim().toLowerCase();
      const nameFilter = String(req.query.technicianName || '').trim().toLowerCase();
      const dateFilter = String(req.query.date || '').trim();
      const monthFilter = String(req.query.month || '').trim();
      const techIdFilter = req.query.technicianId ? Number(req.query.technicianId) : 0;
      const startDate = String(req.query.startDate || '').trim();
      const endDate = String(req.query.endDate || '').trim();

      let rows = await getAllRegistrations();

      if (search) {
        rows = rows.filter(
          (r) =>
            r.landlineNumber.includes(search) ||
            r.technicianCode.toLowerCase().includes(search) ||
            r.technicianName.toLowerCase().includes(search) ||
            r.registrationDate.includes(search)
        );
      }
      if (landlineFilter) {
        rows = rows.filter((r) => r.landlineNumber.includes(landlineFilter));
      }
      if (codeFilter) {
        rows = rows.filter((r) => r.technicianCode.toLowerCase().includes(codeFilter));
      }
      if (nameFilter) {
        rows = rows.filter((r) => r.technicianName.toLowerCase().includes(nameFilter));
      }
      if (dateFilter) {
        rows = rows.filter((r) => r.registrationDate === dateFilter);
      }
      if (monthFilter) {
        rows = rows.filter((r) => r.registrationMonth === monthFilter);
      }
      if (techIdFilter) {
        rows = rows.filter((r) => r.technicianId === techIdFilter);
      }
      if (startDate) {
        rows = rows.filter((r) => r.registrationDate >= startDate);
      }
      if (endDate) {
        rows = rows.filter((r) => r.registrationDate <= endDate);
      }

      res.json({
        total: rows.length,
        registrations: rows,
      });
    } catch (error: unknown) {
      console.error('Admin get registrations error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر جلب سجل التركيبات.',
      });
    }
  });

  /**
   * Admin Create Registration on behalf of a technician
   */
  app.post('/api/admin/registrations', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const session = req.session!;
      const { technicianId, landlineNumber, registrationDate, registrationTime } = req.body || {};

      const validation = validateLandlineNumber(String(landlineNumber || ''));
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const tech = await getTechnicianById(Number(technicianId));
      if (!tech) {
        return res.status(404).json({ error: 'يرجى اختيار فني صالح.' });
      }

      const cairoNow = getCairoDateTime();
      const targetDate = String(registrationDate || cairoNow.date).trim();
      const targetTime = String(registrationTime || cairoNow.time).trim();
      const targetMonth = targetDate.slice(0, 7);

      const allRegs = await getAllRegistrations();
      if (isDuplicateRegistrationOnSameDay(allRegs, validation.cleaned, targetDate)) {
        return res.status(409).json({
          error: `رقم التليفون الأرضي (${validation.cleaned}) مسجل بالفعل في تاريخ ${targetDate}.`,
        });
      }

      const created = await createRegistrationRecord({
        technicianId: tech.id,
        technicianCode: tech.technicianCode,
        technicianName: tech.fullName,
        landlineNumber: validation.cleaned,
        registrationDate: targetDate,
        registrationTime: targetTime,
        registrationMonth: targetMonth,
        createdBy: `Admin (${session.name})`,
      });

      await logActivity({
        actorType: 'admin',
        actorId: session.code,
        actorName: session.name,
        actionType: 'ADMIN_CREATE_REGISTRATION',
        targetType: 'registration',
        targetId: String(created.id),
        details: `إضافة تسجيل خط أرضي (${validation.cleaned}) للفني ${tech.fullName} (${tech.technicianCode}) بتاريخ ${targetDate} بواسطة المسؤول`,
      });

      res.status(201).json({
        message: 'تم إضافة التسجيل بنجاح.',
        registration: created,
      });
    } catch (error: unknown) {
      console.error('Admin create registration error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر إضافة التسجيل.',
      });
    }
  });

  /**
   * Admin Edit / Correct Registration (Landline number, Date, Time, Technician)
   */
  app.put('/api/admin/registrations/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const session = req.session!;
      const regId = Number(req.params.id);
      if (!regId) {
        return res.status(400).json({ error: 'معرف التسجيل غير صالح.' });
      }

      const allRegs = await getAllRegistrations();
      const existingReg = allRegs.find((r) => r.id === regId);
      if (!existingReg) {
        return res.status(404).json({ error: 'سجل التركيب غير موجود.' });
      }

      const { landlineNumber, registrationDate, registrationTime, technicianId } = req.body || {};
      const validation = validateLandlineNumber(
        String(landlineNumber ?? existingReg.landlineNumber)
      );
      if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
      }

      const targetDate = String(registrationDate || existingReg.registrationDate).trim();
      const targetTime = String(registrationTime || existingReg.registrationTime).trim();
      const targetMonth = targetDate.slice(0, 7);

      if (isDuplicateRegistrationOnSameDay(allRegs, validation.cleaned, targetDate, regId)) {
        return res.status(409).json({
          error: `رقم التليفون الأرضي (${validation.cleaned}) مسجل بالفعل في تاريخ ${targetDate}.`,
        });
      }

      let targetTechId = existingReg.technicianId;
      let targetTechCode = existingReg.technicianCode;
      let targetTechName = existingReg.technicianName;

      if (technicianId && Number(technicianId) !== existingReg.technicianId) {
        const newTech = await getTechnicianById(Number(technicianId));
        if (newTech) {
          targetTechId = newTech.id;
          targetTechCode = newTech.technicianCode;
          targetTechName = newTech.fullName;
        }
      }

      const updated = await updateRegistrationRecord(regId, {
        technicianId: targetTechId,
        technicianCode: targetTechCode,
        technicianName: targetTechName,
        landlineNumber: validation.cleaned,
        registrationDate: targetDate,
        registrationTime: targetTime,
        registrationMonth: targetMonth,
      });

      await logActivity({
        actorType: 'admin',
        actorId: session.code,
        actorName: session.name,
        actionType: 'EDIT_REGISTRATION',
        targetType: 'registration',
        targetId: String(regId),
        details: `تعديل سجل تركيب #${regId}: الرقم (${existingReg.landlineNumber} -> ${validation.cleaned})، التاريخ (${existingReg.registrationDate} -> ${targetDate})، الفني (${existingReg.technicianCode} -> ${targetTechCode})`,
      });

      res.json({
        message: 'تم تعديل بيانات التسجيل وتوثيق العملية في سجل الرقابة بنجاح.',
        registration: updated,
      });
    } catch (error: unknown) {
      console.error('Admin update registration error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر تعديل التسجيل.',
      });
    }
  });

  /**
   * Admin Delete Registration
   */
  app.delete(
    '/api/admin/registrations/:id',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const session = req.session!;
        const regId = Number(req.params.id);
        if (!regId) {
          return res.status(400).json({ error: 'معرف التسجيل غير صالح.' });
        }

        const deleted = await deleteRegistrationRecord(regId);
        if (!deleted) {
          return res.status(404).json({ error: 'السجل المطلوب حذفه غير موجود.' });
        }

        await logActivity({
          actorType: 'admin',
          actorId: session.code,
          actorName: session.name,
          actionType: 'DELETE_REGISTRATION',
          targetType: 'registration',
          targetId: String(regId),
          details: `حذف تسجيل خط أرضي رقم (${deleted.landlineNumber}) الخاص بالفني ${deleted.technicianName} (${deleted.technicianCode}) المؤرخ في ${deleted.registrationDate}`,
        });

        res.json({
          message: `تم حذف تسجيل الرقم (${deleted.landlineNumber}) وتوثيق الحذف في سجل الرقابة.`,
        });
      } catch (error: unknown) {
        console.error('Admin delete registration error:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'تعذر حذف التسجيل.',
        });
      }
    }
  );

  // =========================================================================
  // 5. MONTHLY REPORTING & AUDIT LOG ROUTES
  // =========================================================================

  app.get('/api/admin/monthly-reports', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const cairoNow = getCairoDateTime();
      const selectedMonth = String(req.query.month || cairoNow.month).trim();

      const [allTechs, allRegs, archived] = await Promise.all([
        getAllTechnicians(),
        getAllRegistrations(),
        getArchivedMonthlyReports(),
      ]);

      const report = computeMonthlyReportSummary(allTechs, allRegs, selectedMonth);

      // Available months across registrations and archives
      const monthSet = new Set<string>([cairoNow.month]);
      for (const r of allRegs) monthSet.add(r.registrationMonth);
      for (const a of archived) monthSet.add(a.reportMonth);
      const availableMonths = Array.from(monthSet).sort((a, b) => b.localeCompare(a));

      res.json({
        selectedMonth,
        availableMonths,
        report,
        archivedReports: archived,
      });
    } catch (error: unknown) {
      console.error('Admin monthly reports error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر تحميل التقرير الشهري.',
      });
    }
  });

  app.post(
    '/api/admin/monthly-reports/generate',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      try {
        const session = req.session!;
        const cairoNow = getCairoDateTime();
        const reportMonth = String(req.body?.month || cairoNow.month).trim();

        const [allTechs, allRegs] = await Promise.all([
          getAllTechnicians(),
          getAllRegistrations(),
        ]);

        const summary = computeMonthlyReportSummary(allTechs, allRegs, reportMonth);

        const saved = await saveArchivedMonthlyReport({
          reportMonth,
          title: `التقرير الشهري الشامل لتركيبات الألياف الضوئية FTTH - ${reportMonth}`,
          totalRegistrations: summary.totalRegistrations,
          activeTechniciansCount: summary.activeContributorsCount,
          summaryJson: JSON.stringify(summary.technicianBreakdown),
          generatedBy: session.name,
        });

        await logActivity({
          actorType: 'admin',
          actorId: session.code,
          actorName: session.name,
          actionType: 'GENERATE_MONTHLY_REPORT',
          targetType: 'report',
          targetId: reportMonth,
          details: `إصدار وأرشفة التقرير الشهري المعتمد لشهر ${reportMonth} بإجمالي ${summary.totalRegistrations} تركيبات`,
        });

        res.json({
          message: `تم إصدار وحفظ التقرير الشهري لشهر (${reportMonth}) في الأرشيف الدائم بنجاح.`,
          archivedReport: saved,
          summary,
        });
      } catch (error: unknown) {
        console.error('Admin generate monthly report error:', error);
        res.status(500).json({
          error: error instanceof Error ? error.message : 'تعذر إصدار التقرير الشهري.',
        });
      }
    }
  );

  app.get('/api/admin/audit-logs', requireAdmin, async (_req: AuthRequest, res: Response) => {
    try {
      const logs = await getAllActivityLogs();
      res.json({ logs });
    } catch (error: unknown) {
      console.error('Admin audit logs error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر جلب سجل الرقابة.',
      });
    }
  });

  // =========================================================================
  // 6. REAL EXCEL (.XLSX) EXPORT ENGINE
  // =========================================================================

  app.get('/api/admin/export/excel', requireAdmin, async (req: AuthRequest, res: Response) => {
    try {
      const session = req.session!;
      const cairoNow = getCairoDateTime();
      const mode = String(req.query.mode || 'all').trim(); // 'all' | 'daily' | 'monthly' | 'technician' | 'range'
      const dateParam = String(req.query.date || cairoNow.date).trim();
      const monthParam = String(req.query.month || cairoNow.month).trim();
      const technicianCodeParam = String(req.query.technicianCode || '').trim().toUpperCase();
      const startDateParam = String(req.query.startDate || '').trim();
      const endDateParam = String(req.query.endDate || '').trim();

      const [allTechs, allRegs] = await Promise.all([
        getAllTechnicians(),
        getAllRegistrations(),
      ]);

      let filtered = [...allRegs];
      let filenameTag = 'All_Registrations';

      if (mode === 'daily') {
        filtered = filtered.filter((r) => r.registrationDate === dateParam);
        filenameTag = `Daily_${dateParam}`;
      } else if (mode === 'monthly') {
        filtered = filtered.filter((r) => r.registrationMonth === monthParam);
        filenameTag = `Monthly_${monthParam}`;
      } else if (mode === 'technician' && technicianCodeParam) {
        filtered = filtered.filter((r) => r.technicianCode.toUpperCase() === technicianCodeParam);
        filenameTag = `Technician_${technicianCodeParam}`;
      } else if (mode === 'range') {
        if (startDateParam) {
          filtered = filtered.filter((r) => r.registrationDate >= startDateParam);
        }
        if (endDateParam) {
          filtered = filtered.filter((r) => r.registrationDate <= endDateParam);
        }
        filenameTag = `Range_${startDateParam || 'Start'}_to_${endDateParam || 'End'}`;
      }

      // Automatic sorting: Date descending, Time descending
      filtered.sort((a, b) => {
        const dCmp = b.registrationDate.localeCompare(a.registrationDate);
        if (dCmp !== 0) return dCmp;
        return b.registrationTime.localeCompare(a.registrationTime);
      });

      // Sheet 1: Master Registrations Table matching exact specification
      // | Technician Code | Technician Name | Landline Number | Date | Time |
      const masterRows = filtered.map((r, index) => ({
        'م (#)': index + 1,
        'Technician Code | كود الفني': r.technicianCode,
        'Technician Name | اسم الفني': r.technicianName,
        'Landline Number | رقم التليفون الأرضي': r.landlineNumber,
        'Date | التاريخ': r.registrationDate,
        'Time | الوقت': r.registrationTime,
        'Month | الشهر': r.registrationMonth,
        'Created By | مسجل بواسطة': r.createdBy,
      }));

      const wb = XLSX.utils.book_new();

      const wsMaster =
        masterRows.length > 0
          ? XLSX.utils.json_to_sheet(masterRows)
          : XLSX.utils.json_to_sheet([
              {
                'م (#)': '-',
                'Technician Code | كود الفني': '-',
                'Technician Name | اسم الفني': 'لا توجد تسجيلات مطابقة للفترة المحددة',
                'Landline Number | رقم التليفون الأرضي': '-',
                'Date | التاريخ': dateParam,
                'Time | الوقت': '-',
                'Month | الشهر': monthParam,
                'Created By | مسجل بواسطة': '-',
              },
            ]);

      // Set column widths for professional layout
      wsMaster['!cols'] = [
        { wch: 8 },
        { wch: 24 },
        { wch: 30 },
        { wch: 28 },
        { wch: 16 },
        { wch: 14 },
        { wch: 14 },
        { wch: 20 },
      ];

      // Enable Excel AutoFilter across all columns
      const totalRowsCount = Math.max(2, masterRows.length + 1);
      wsMaster['!autofilter'] = { ref: `A1:H${totalRowsCount}` };

      XLSX.utils.book_append_sheet(wb, wsMaster, 'Registrations_سجل_التركيبات');

      // Sheet 2: Technician Summary & Monthly Statistics
      const summaryRows = allTechs.map((tech) => {
        const countInReport = filtered.filter((r) => r.technicianCode === tech.technicianCode).length;
        const totalAllTime = allRegs.filter((r) => r.technicianCode === tech.technicianCode).length;
        return {
          'Technician Code | كود الفني': tech.technicianCode,
          'Technician Name | اسم الفني': tech.fullName,
          'Email | البريد الإلكتروني': tech.email,
          'Account Status | حالة الحساب': tech.status === 'active' ? 'Active (نشط)' : 'Disabled (موقوف)',
          'Report Registrations | تركيبات التقرير': countInReport,
          'Total All-Time | إجمالي التركيبات الكلي': totalAllTime,
        };
      });

      summaryRows.push({
        'Technician Code | كود الفني': 'TOTAL / الإجمالي',
        'Technician Name | اسم الفني': `إجمالي الفنيين: ${allTechs.length}`,
        'Email | البريد الإلكتروني': '-',
        'Account Status | حالة الحساب': '-',
        'Report Registrations | تركيبات التقرير': filtered.length,
        'Total All-Time | إجمالي التركيبات الكلي': allRegs.length,
      });

      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      wsSummary['!cols'] = [
        { wch: 24 },
        { wch: 30 },
        { wch: 30 },
        { wch: 22 },
        { wch: 26 },
        { wch: 26 },
      ];
      wsSummary['!autofilter'] = { ref: `A1:F${summaryRows.length + 1}` };
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Technicians_ملخص_الفنيين');

      const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;

      await logActivity({
        actorType: 'admin',
        actorId: session.code,
        actorName: session.name,
        actionType: 'EXPORT_EXCEL',
        targetType: 'report',
        targetId: filenameTag,
        details: `تصدير ملف Excel (${filenameTag}) يحتوي على ${filtered.length} سجل تركيبات`,
      });

      const safeFilename = `MAKKAH_WE_FTTH_${filenameTag}.xlsx`;
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);
      res.send(excelBuffer);
    } catch (error: unknown) {
      console.error('Excel export error:', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'تعذر تصدير ملف Excel.',
      });
    }
  });

  // =========================================================================
  // 7. VITE MIDDLEWARE / PRODUCTION STATIC ASSETS
  // =========================================================================

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MAKKAH WE – FTTH Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
});
