import { relations } from 'drizzle-orm';
import { integer, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

// 1. Firebase Auth linked users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  role: text('role').notNull().default('admin'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 2. Technicians table
export const technicians = pgTable('technicians', {
  id: serial('id').primaryKey(),
  technicianCode: text('technician_code').notNull().unique(),
  username: text('username').notNull().unique(),
  email: text('email').notNull(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'disabled'
  phone: text('phone').default(''),
  governorate: text('governorate').default('القاهرة'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 3. Administrators table
export const administrators = pgTable('administrators', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('super_admin'),
  firebaseUid: text('firebase_uid'),
  createdAt: timestamp('created_at').defaultNow(),
});

// 4. Landline Registrations table
export const registrations = pgTable('registrations', {
  id: serial('id').primaryKey(),
  technicianId: integer('technician_id')
    .references(() => technicians.id, { onDelete: 'cascade' })
    .notNull(),
  technicianCode: text('technician_code').notNull(),
  technicianName: text('technician_name').notNull(),
  landlineNumber: text('landline_number').notNull(),
  registrationDate: text('registration_date').notNull(), // YYYY-MM-DD in Africa/Cairo
  registrationTime: text('registration_time').notNull(), // HH:mm:ss in Africa/Cairo
  registrationMonth: text('registration_month').notNull(), // YYYY-MM
  createdBy: text('created_by').notNull(), // technician_code or admin username
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// 5. Activity & Audit Logs table
export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  actorType: text('actor_type').notNull(), // 'admin' | 'technician' | 'system'
  actorId: text('actor_id').notNull(),
  actorName: text('actor_name').notNull(),
  actionType: text('action_type').notNull(), // e.g., 'CREATE_REGISTRATION', 'EDIT_REGISTRATION', 'DELETE_REGISTRATION', 'CREATE_TECHNICIAN', 'RESET_PASSWORD', 'STATUS_CHANGE'
  targetType: text('target_type').notNull(), // 'registration' | 'technician' | 'report' | 'auth'
  targetId: text('target_id').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// 6. Archived Monthly Reports table
export const monthlyReports = pgTable('monthly_reports', {
  id: serial('id').primaryKey(),
  reportMonth: text('report_month').notNull().unique(), // YYYY-MM
  title: text('title').notNull(),
  totalRegistrations: integer('total_registrations').notNull().default(0),
  activeTechniciansCount: integer('active_technicians_count').notNull().default(0),
  summaryJson: text('summary_json').notNull(), // JSON string of technician breakdown
  generatedBy: text('generated_by').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

// Relations
export const techniciansRelations = relations(technicians, ({ many }) => ({
  registrations: many(registrations),
}));

export const registrationsRelations = relations(registrations, ({ one }) => ({
  technician: one(technicians, {
    fields: [registrations.technicianId],
    references: [technicians.id],
  }),
}));
