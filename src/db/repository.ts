import { desc, eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import { db } from './index.ts';
import {
  technicians,
  administrators,
  registrations,
  activityLogs,
  monthlyReports,
} from './schema.ts';
import { hashPassword } from '../lib/security.ts';

const BACKUP_FILE_PATH = path.resolve(process.cwd(), '.makkah-we-backup.json');

interface BackupSnapshot {
  updatedAt: string;
  technicians: Array<{
    technicianCode: string;
    username: string;
    email: string;
    passwordHash: string;
    fullName: string;
    status: string;
    phone: string | null;
    governorate: string | null;
  }>;
  registrations: Array<{
    technicianCode: string;
    technicianName: string;
    landlineNumber: string;
    registrationDate: string;
    registrationTime: string;
    registrationMonth: string;
    createdBy: string;
  }>;
}

async function syncSnapshotToDisk(): Promise<void> {
  try {
    const [allTechs, allRegs] = await Promise.all([
      db.select().from(technicians).orderBy(technicians.id),
      db.select().from(registrations).orderBy(registrations.id),
    ]);

    const snapshot: BackupSnapshot = {
      updatedAt: new Date().toISOString(),
      technicians: allTechs.map((t) => ({
        technicianCode: t.technicianCode,
        username: t.username,
        email: t.email,
        passwordHash: t.passwordHash,
        fullName: t.fullName,
        status: t.status,
        phone: t.phone,
        governorate: t.governorate,
      })),
      registrations: allRegs.map((r) => ({
        technicianCode: r.technicianCode,
        technicianName: r.technicianName,
        landlineNumber: r.landlineNumber,
        registrationDate: r.registrationDate,
        registrationTime: r.registrationTime,
        registrationMonth: r.registrationMonth,
        createdBy: r.createdBy,
      })),
    };

    fs.writeFileSync(BACKUP_FILE_PATH, JSON.stringify(snapshot, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to sync snapshot to disk:', err);
  }
}

let seedPromise: Promise<void> | null = null;

/**
 * Ensures the default Administrator account (admin / 1001) exists in PostgreSQL,
 * and restores any user-created data from the persistent backup mirror if needed.
 */
export async function ensureSeedData(): Promise<void> {
  if (seedPromise) {
    return seedPromise;
  }
  seedPromise = (async () => {
    try {
      const existingAdmins = await db.select().from(administrators);
      if (existingAdmins.length === 0) {
        await db.insert(administrators).values([
          {
            username: 'admin',
            email: 'mohabahmed.911rs@gmail.com',
            passwordHash: hashPassword('1001'),
            fullName: 'مدير النظام - MAKKAH WE',
            role: 'super_admin',
          },
        ]);
      }

      const existingTechs = await db.select().from(technicians);
      if (existingTechs.length === 0 && fs.existsSync(BACKUP_FILE_PATH)) {
        try {
          const raw = fs.readFileSync(BACKUP_FILE_PATH, 'utf-8');
          const snapshot = JSON.parse(raw) as BackupSnapshot;
          if (Array.isArray(snapshot.technicians) && snapshot.technicians.length > 0) {
            const insertedTechs = await db
              .insert(technicians)
              .values(
                snapshot.technicians.map((t) => ({
                  technicianCode: t.technicianCode,
                  username: t.username || t.technicianCode,
                  email: t.email,
                  passwordHash: t.passwordHash,
                  fullName: t.fullName,
                  status: t.status || 'active',
                  phone: t.phone || '',
                  governorate: t.governorate || 'القاهرة',
                }))
              )
              .returning();

            const codeToId = new Map<string, number>();
            for (const tech of insertedTechs) {
              codeToId.set(tech.technicianCode.toUpperCase(), tech.id);
            }

            if (Array.isArray(snapshot.registrations) && snapshot.registrations.length > 0) {
              const validRegs = snapshot.registrations
                .map((r) => {
                  const techId = codeToId.get(r.technicianCode.toUpperCase());
                  if (!techId) return null;
                  return {
                    technicianId: techId,
                    technicianCode: r.technicianCode,
                    technicianName: r.technicianName,
                    landlineNumber: r.landlineNumber,
                    registrationDate: r.registrationDate,
                    registrationTime: r.registrationTime,
                    registrationMonth: r.registrationMonth,
                    createdBy: r.createdBy || r.technicianCode,
                  };
                })
                .filter((r): r is NonNullable<typeof r> => r !== null);

              if (validRegs.length > 0) {
                await db.insert(registrations).values(validRegs);
              }
            }
          }
        } catch (restoreErr) {
          console.error('Could not restore from backup snapshot:', restoreErr);
        }
      } else if (existingTechs.length > 0) {
        await syncSnapshotToDisk();
      }
    } catch (error) {
      console.error('Failed to initialize admin account:', error);
      seedPromise = null;
      throw new Error('Failed to initialize administrator account.', { cause: error });
    }
  })();

  return seedPromise;
}

export async function logActivity(entry: {
  actorType: 'admin' | 'technician' | 'system';
  actorId: string;
  actorName: string;
  actionType: string;
  targetType: string;
  targetId: string;
  details: string;
}) {
  try {
    await db.insert(activityLogs).values(entry);
  } catch (error) {
    console.error('Failed to write activity log:', error);
  }
}

export async function getAllTechnicians() {
  try {
    await ensureSeedData();
    return await db.select().from(technicians).orderBy(technicians.technicianCode);
  } catch (error) {
    console.error('Database query getAllTechnicians failed:', error);
    throw new Error('تعذر جلب قائمة الفنيين من قاعدة البيانات.', { cause: error });
  }
}

export async function getTechnicianByCode(code: string) {
  try {
    await ensureSeedData();
    const normalized = code.trim().toUpperCase();
    const rows = await db
      .select()
      .from(technicians)
      .where(eq(technicians.technicianCode, normalized));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query getTechnicianByCode failed:', error);
    throw new Error('تعذر التحقق من بيانات الفني.', { cause: error });
  }
}

export async function getTechnicianById(id: number) {
  try {
    await ensureSeedData();
    const rows = await db.select().from(technicians).where(eq(technicians.id, id));
    return rows[0] || null;
  } catch (error) {
    console.error('Database query getTechnicianById failed:', error);
    throw new Error('تعذر جلب بيانات الفني.', { cause: error });
  }
}

export async function getAdminByIdentifier(identifier: string) {
  try {
    await ensureSeedData();
    const clean = identifier.trim().toLowerCase();
    const allAdmins = await db.select().from(administrators);
    return (
      allAdmins.find(
        (a) => a.username.toLowerCase() === clean || a.email.toLowerCase() === clean
      ) || null
    );
  } catch (error) {
    console.error('Database query getAdminByIdentifier failed:', error);
    throw new Error('تعذر التحقق من حساب المسؤول.', { cause: error });
  }
}

export async function getAllRegistrations() {
  try {
    await ensureSeedData();
    return await db
      .select()
      .from(registrations)
      .orderBy(desc(registrations.registrationDate), desc(registrations.registrationTime), desc(registrations.id));
  } catch (error) {
    console.error('Database query getAllRegistrations failed:', error);
    throw new Error('تعذر جلب سجل التركيبات من قاعدة البيانات.', { cause: error });
  }
}

export async function getRegistrationsByTechnician(technicianId: number) {
  try {
    await ensureSeedData();
    return await db
      .select()
      .from(registrations)
      .where(eq(registrations.technicianId, technicianId))
      .orderBy(desc(registrations.registrationDate), desc(registrations.registrationTime), desc(registrations.id));
  } catch (error) {
    console.error('Database query getRegistrationsByTechnician failed:', error);
    throw new Error('تعذر جلب سجل التركيبات الخاص بالفني.', { cause: error });
  }
}

export async function createRegistrationRecord(data: {
  technicianId: number;
  technicianCode: string;
  technicianName: string;
  landlineNumber: string;
  registrationDate: string;
  registrationTime: string;
  registrationMonth: string;
  createdBy: string;
}) {
  try {
    const result = await db.insert(registrations).values(data).returning();
    await syncSnapshotToDisk();
    return result[0];
  } catch (error) {
    console.error('Database insert createRegistrationRecord failed:', error);
    throw new Error('تعذر حفظ رقم التليفون الأرضي في قاعدة البيانات.', { cause: error });
  }
}

export async function updateRegistrationRecord(
  id: number,
  data: {
    technicianId: number;
    technicianCode: string;
    technicianName: string;
    landlineNumber: string;
    registrationDate: string;
    registrationTime: string;
    registrationMonth: string;
  }
) {
  try {
    const result = await db
      .update(registrations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(registrations.id, id))
      .returning();
    await syncSnapshotToDisk();
    return result[0] || null;
  } catch (error) {
    console.error('Database updateRegistrationRecord failed:', error);
    throw new Error('تعذر تحديث بيانات التسجيل.', { cause: error });
  }
}

export async function deleteRegistrationRecord(id: number) {
  try {
    const existing = await db.select().from(registrations).where(eq(registrations.id, id));
    if (!existing[0]) return null;
    await db.delete(registrations).where(eq(registrations.id, id));
    await syncSnapshotToDisk();
    return existing[0];
  } catch (error) {
    console.error('Database deleteRegistrationRecord failed:', error);
    throw new Error('تعذر حذف التسجيل من قاعدة البيانات.', { cause: error });
  }
}

export async function createTechnicianRecord(data: {
  technicianCode: string;
  username: string;
  email: string;
  passwordHash: string;
  fullName: string;
  status: string;
  phone: string;
  governorate: string;
}) {
  try {
    const result = await db.insert(technicians).values(data).returning();
    await syncSnapshotToDisk();
    return result[0];
  } catch (error) {
    console.error('Database createTechnicianRecord failed:', error);
    throw new Error('تعذر إنشاء حساب الفني. تأكد من عدم تكرار كود الفني.', { cause: error });
  }
}

export async function updateTechnicianRecord(
  id: number,
  data: {
    technicianCode: string;
    username: string;
    email: string;
    fullName: string;
    status: string;
    phone: string;
    governorate: string;
  }
) {
  try {
    const result = await db
      .update(technicians)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(technicians.id, id))
      .returning();

    if (result[0]) {
      // Keep denormalized technician name & code synced in registrations
      await db
        .update(registrations)
        .set({
          technicianCode: data.technicianCode,
          technicianName: data.fullName,
        })
        .where(eq(registrations.technicianId, id));
    }

    await syncSnapshotToDisk();
    return result[0] || null;
  } catch (error) {
    console.error('Database updateTechnicianRecord failed:', error);
    throw new Error('تعذر تحديث بيانات الفني.', { cause: error });
  }
}

export async function updateTechnicianPassword(id: number, passwordHash: string) {
  try {
    const result = await db
      .update(technicians)
      .set({
        passwordHash,
        updatedAt: new Date(),
      })
      .where(eq(technicians.id, id))
      .returning();
    await syncSnapshotToDisk();
    return result[0] || null;
  } catch (error) {
    console.error('Database updateTechnicianPassword failed:', error);
    throw new Error('تعذر إعادة تعيين كلمة مرور الفني.', { cause: error });
  }
}

export async function updateTechnicianStatus(id: number, status: 'active' | 'disabled') {
  try {
    const result = await db
      .update(technicians)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(eq(technicians.id, id))
      .returning();
    await syncSnapshotToDisk();
    return result[0] || null;
  } catch (error) {
    console.error('Database updateTechnicianStatus failed:', error);
    throw new Error('تعذر تغيير حالة حساب الفني.', { cause: error });
  }
}

export async function deleteTechnicianRecord(id: number) {
  try {
    const existing = await db.select().from(technicians).where(eq(technicians.id, id));
    if (!existing[0]) return null;
    await db.delete(technicians).where(eq(technicians.id, id));
    await syncSnapshotToDisk();
    return existing[0];
  } catch (error) {
    console.error('Database deleteTechnicianRecord failed:', error);
    throw new Error('تعذر حذف حساب الفني من قاعدة البيانات.', { cause: error });
  }
}

export async function getAllActivityLogs() {
  try {
    await ensureSeedData();
    return await db.select().from(activityLogs).orderBy(desc(activityLogs.id)).limit(200);
  } catch (error) {
    console.error('Database getAllActivityLogs failed:', error);
    throw new Error('تعذر جلب سجل النشاطات والرقابة.', { cause: error });
  }
}

export async function getArchivedMonthlyReports() {
  try {
    await ensureSeedData();
    return await db.select().from(monthlyReports).orderBy(desc(monthlyReports.reportMonth));
  } catch (error) {
    console.error('Database getArchivedMonthlyReports failed:', error);
    throw new Error('تعذر جلب أرشيف التقارير الشهرية.', { cause: error });
  }
}

export async function saveArchivedMonthlyReport(data: {
  reportMonth: string;
  title: string;
  totalRegistrations: number;
  activeTechniciansCount: number;
  summaryJson: string;
  generatedBy: string;
}) {
  try {
    const result = await db
      .insert(monthlyReports)
      .values(data)
      .onConflictDoUpdate({
        target: monthlyReports.reportMonth,
        set: {
          title: data.title,
          totalRegistrations: data.totalRegistrations,
          activeTechniciansCount: data.activeTechniciansCount,
          summaryJson: data.summaryJson,
          generatedBy: data.generatedBy,
          createdAt: new Date(),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database saveArchivedMonthlyReport failed:', error);
    throw new Error('تعذر حفظ التقرير الشهري في الأرشيف.', { cause: error });
  }
}
