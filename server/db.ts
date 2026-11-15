import { DatabaseSync } from 'node:sqlite';
import crypto from 'node:crypto';
import path from 'node:path';

const DB_PATH = path.resolve(process.cwd(), 'vems.db');

export const db = new DatabaseSync(DB_PATH);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      head_id INTEGER,
      annual_budget REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      department_id INTEGER,
      designation TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      joining_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active',
      created_at TEXT NOT NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      clock_in TEXT NOT NULL,
      clock_out TEXT,
      break_started_at TEXT,
      break_minutes INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL,
      UNIQUE(user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS leave_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      leave_type TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      reason TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Pending',
      reviewed_by INTEGER,
      review_note TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department_id INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      priority TEXT NOT NULL DEFAULT 'Medium',
      due_date TEXT NOT NULL,
      assigned_by INTEGER NOT NULL,
      assignee_id INTEGER NOT NULL,
      state TEXT NOT NULL DEFAULT 'assigned',
      progress_percent INTEGER NOT NULL DEFAULT 0,
      submission_notes TEXT,
      submission_link TEXT,
      attachment_name TEXT,
      attachment_url TEXT,
      rework_feedback TEXT,
      rework_count INTEGER NOT NULL DEFAULT 0,
      submitted_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (assignee_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      message TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS meetings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      platform TEXT NOT NULL,
      meeting_link TEXT NOT NULL,
      meeting_date TEXT NOT NULL,
      meeting_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL DEFAULT 45,
      description TEXT NOT NULL DEFAULT '',
      scheduled_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
      FOREIGN KEY (scheduled_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS holidays (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      holiday_date TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      published_by INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (published_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL,
      link_module TEXT NOT NULL,
      action_url TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  seedIfEmpty();
}

function formatDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return d.toISOString().slice(0, 10);
}

function seedIfEmpty(): void {
  const countRow = db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number };
  if (countRow.cnt > 0) return;

  const now = new Date().toISOString();
  const today = formatDateOffset(0);
  const yesterday = formatDateOffset(-1);
  const twoDaysAgo = formatDateOffset(-2);
  const threeDaysAgo = formatDateOffset(-3);

  const insertDept = db.prepare(
    'INSERT INTO departments (name, head_id, annual_budget, created_at) VALUES (?, NULL, ?, ?)'
  );
  const engDeptId = Number(insertDept.run('Engineering', 1450000, now).lastInsertRowid);
  const opsDeptId = Number(insertDept.run('Product & Operations', 720000, now).lastInsertRowid);
  const hrDeptId = Number(insertDept.run('Human Resources', 410000, now).lastInsertRowid);

  const defaultPass = hashPassword('Vems@2026');

  const insertUser = db.prepare(`
    INSERT INTO users (employee_code, name, email, password_hash, role, department_id, designation, phone, joining_date, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const hrId = Number(
    insertUser.run(
      'EMP-1001',
      'claire.bennett',
      'hr@vems.work',
      defaultPass,
      'HR',
      hrDeptId,
      'People Operations Director',
      '+1 (415) 555-0140',
      '2023-03-14',
      'Active',
      now
    ).lastInsertRowid
  );
  // Fix capitalization nicely
  db.prepare('UPDATE users SET name = ? WHERE id = ?').run('Claire Bennett', hrId);

  const headEngId = Number(
    insertUser.run(
      'EMP-1002',
      'Marcus Vance',
      'head@vems.work',
      defaultPass,
      'Department Head',
      engDeptId,
      'VP of Engineering',
      '+1 (415) 555-0182',
      '2023-06-01',
      'Active',
      now
    ).lastInsertRowid
  );

  const leadOpsId = Number(
    insertUser.run(
      'EMP-1003',
      'Priya Nair',
      'lead@vems.work',
      defaultPass,
      'Team Lead',
      engDeptId,
      'Platform Team Lead',
      '+1 (415) 555-0165',
      '2024-01-15',
      'Active',
      now
    ).lastInsertRowid
  );

  const emp1Id = Number(
    insertUser.run(
      'EMP-1004',
      'Elena Rostova',
      'employee@vems.work',
      defaultPass,
      'Employee',
      engDeptId,
      'Senior Frontend Engineer',
      '+1 (415) 555-0191',
      '2024-05-20',
      'Active',
      now
    ).lastInsertRowid
  );

  const emp2Id = Number(
    insertUser.run(
      'EMP-1005',
      'David Kim',
      'david.kim@vems.work',
      defaultPass,
      'Employee',
      engDeptId,
      'Backend Systems Engineer',
      '+1 (415) 555-0128',
      '2024-08-12',
      'Active',
      now
    ).lastInsertRowid
  );

  const headOpsId = Number(
    insertUser.run(
      'EMP-1006',
      'Hannah Morales',
      'hannah.morales@vems.work',
      defaultPass,
      'Department Head',
      opsDeptId,
      'Head of Product Operations',
      '+1 (415) 555-0177',
      '2023-11-04',
      'Active',
      now
    ).lastInsertRowid
  );

  const emp3Id = Number(
    insertUser.run(
      'EMP-1007',
      'Lucas Meyer',
      'lucas.meyer@vems.work',
      defaultPass,
      'Employee',
      opsDeptId,
      'Operations Analyst',
      '+1 (415) 555-0153',
      '2025-02-10',
      'Active',
      now
    ).lastInsertRowid
  );

  // Assign department heads
  db.prepare('UPDATE departments SET head_id = ? WHERE id = ?').run(headEngId, engDeptId);
  db.prepare('UPDATE departments SET head_id = ? WHERE id = ?').run(headOpsId, opsDeptId);
  db.prepare('UPDATE departments SET head_id = ? WHERE id = ?').run(hrId, hrDeptId);

  // Seed Projects
  const insertProject = db.prepare(
    'INSERT INTO projects (name, department_id, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
  );
  const projAuthId = Number(
    insertProject.run(
      'Core Workspace Portal v2',
      engDeptId,
      'Unify SSO session management, role permissions, and attendance audit views.',
      headEngId,
      now
    ).lastInsertRowid
  );
  const projInfraId = Number(
    insertProject.run(
      'API Gateway Observability',
      engDeptId,
      'Improve p95 latency telemetry and automated incident alerting.',
      leadOpsId,
      now
    ).lastInsertRowid
  );
  const projOpsId = Number(
    insertProject.run(
      'Q4 Vendor Onboarding Audit',
      opsDeptId,
      'Review compliance checklists and SLA turnaround benchmarks.',
      headOpsId,
      now
    ).lastInsertRowid
  );

  // Seed Tasks
  const insertTask = db.prepare(`
    INSERT INTO tasks (
      project_id, department_id, title, description, priority, due_date,
      assigned_by, assignee_id, state, progress_percent,
      submission_notes, submission_link, rework_feedback, rework_count,
      submitted_at, completed_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const task1Id = Number(
    insertTask.run(
      projAuthId,
      engDeptId,
      'Implement Role Navigation Guard & Breadcrumbs',
      'Ensure left sidebar modules adapt dynamically per role and mobile drawer closes cleanly on route selection.',
      'High',
      formatDateOffset(3),
      headEngId,
      emp1Id,
      'in_progress',
      65,
      null,
      null,
      null,
      0,
      null,
      null,
      now
    ).lastInsertRowid
  );

  insertTask.run(
    projAuthId,
    engDeptId,
    'Accessibility Audit on Attendance Form Controls',
    'Verify keyboard focus rings, tabular numerals on timestamps, and WCAG AA contrast on all semantic labels.',
    'Medium',
    formatDateOffset(5),
    leadOpsId,
    emp1Id,
    'assigned',
    0,
    null,
    null,
    null,
    0,
    null,
    null,
    now
  );

  const task3Id = Number(
    insertTask.run(
      projInfraId,
      engDeptId,
      'Database Connection Pool Diagnostics Endpoint',
      'Expose read-only diagnostics summary for internal engineering review and attach benchmark CSV.',
      'High',
      formatDateOffset(1),
      headEngId,
      emp2Id,
      'submitted',
      100,
      'Implemented diagnostics route with connection timing metrics and tested under 200 concurrent requests.',
      'https://git.internal.vems.work/platform/pull/418',
      null,
      0,
      now,
      null,
      now
    ).lastInsertRowid
  );

  insertTask.run(
    projInfraId,
    engDeptId,
    'Zero-Downtime Schema Migration Checklist',
    'Document rollback procedures and pre-flight row lock checks before Friday release.',
    'Urgent',
    formatDateOffset(2),
    leadOpsId,
    emp1Id,
    'rework_requested',
    80,
    'Drafted initial migration runbook in internal wiki.',
    'https://docs.internal.vems.work/migrations/zero-downtime',
    'Please add concrete lock_timeout examples and verify rollback SQL for foreign key tables.',
    1,
    now,
    null,
    now
  );

  insertTask.run(
    projAuthId,
    engDeptId,
    'Session Token Rotation Hardening',
    'Rotate HMAC session signatures and add unit coverage for expired session handling.',
    'Medium',
    formatDateOffset(-2),
    headEngId,
    emp2Id,
    'completed',
    100,
    'Deployed token rotation middleware with full test pass.',
    'https://git.internal.vems.work/platform/pull/402',
    null,
    0,
    yesterday,
    yesterday,
    twoDaysAgo
  );

  insertTask.run(
    projOpsId,
    opsDeptId,
    'Compile Q4 Supplier SLA Matrix',
    'Aggregate response time metrics across top 12 logistics vendors.',
    'Medium',
    formatDateOffset(4),
    headOpsId,
    emp3Id,
    'accepted',
    10,
    null,
    null,
    null,
    0,
    null,
    null,
    now
  );

  // Task comments
  const insertComment = db.prepare(
    'INSERT INTO task_comments (task_id, user_id, message, created_at) VALUES (?, ?, ?, ?)'
  );
  insertComment.run(
    task1Id,
    headEngId,
    'Focus on keeping mobile header height compact while preserving notification bell visibility.',
    yesterday
  );
  insertComment.run(
    task1Id,
    emp1Id,
    'Understood. Desktop sidebar and mobile drawer are wired; finalizing breadcrumb alignment today.',
    now
  );
  insertComment.run(
    task3Id,
    emp2Id,
    'Ready for your review whenever you have a window after standup.',
    now
  );

  // Seed Attendance
  const insertAtt = db.prepare(`
    INSERT INTO attendance (user_id, date, clock_in, clock_out, break_started_at, break_minutes, status)
    VALUES (?, ?, ?, ?, NULL, ?, ?)
  `);

  const pastDates = [threeDaysAgo, twoDaysAgo, yesterday];
  for (const d of pastDates) {
    insertAtt.run(emp1Id, d, `${d}T08:56:00`, `${d}T17:32:00`, 30, 'Present');
    insertAtt.run(emp2Id, d, `${d}T09:24:00`, `${d}T18:05:00`, 45, 'Late');
    insertAtt.run(leadOpsId, d, `${d}T08:48:00`, `${d}T17:45:00`, 30, 'Present');
    insertAtt.run(headEngId, d, `${d}T08:40:00`, `${d}T18:10:00`, 20, 'Present');
    insertAtt.run(emp3Id, d, `${d}T09:05:00`, `${d}T17:20:00`, 30, 'Present');
  }
  // Today's attendance for some org members (leave emp1Id & hrId unclocked or clocked so user can test!)
  insertAtt.run(emp2Id, today, `${today}T09:21:00`, null, 15, 'Late');
  insertAtt.run(leadOpsId, today, `${today}T08:52:00`, null, 0, 'Present');
  insertAtt.run(emp3Id, today, `${today}T09:03:00`, null, 0, 'Present');

  // Seed Leave Requests
  const insertLeave = db.prepare(`
    INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, status, reviewed_by, review_note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertLeave.run(
    emp1Id,
    'Annual',
    formatDateOffset(12),
    formatDateOffset(14),
    'Family travel over long weekend.',
    'Pending',
    null,
    null,
    yesterday
  );
  insertLeave.run(
    emp2Id,
    'Sick',
    formatDateOffset(-6),
    formatDateOffset(-5),
    'Seasonal flu recovery.',
    'Approved',
    hrId,
    'Approved — take care and rest well.',
    twoDaysAgo
  );
  insertLeave.run(
    emp3Id,
    'Personal',
    formatDateOffset(8),
    formatDateOffset(8),
    'DMV appointment and personal errands.',
    'Pending',
    null,
    null,
    now
  );

  // Seed Meetings
  const insertMeeting = db.prepare(`
    INSERT INTO meetings (department_id, title, platform, meeting_link, meeting_date, meeting_time, duration_minutes, description, scheduled_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertMeeting.run(
    engDeptId,
    'Engineering Weekly Architecture & Sprint Sync',
    'Google Meet',
    'https://meet.google.com/vems-eng-sync',
    formatDateOffset(1),
    '10:00',
    45,
    'Review Core Workspace Portal v2 milestones and unblock pending PRs.',
    headEngId,
    now
  );
  insertMeeting.run(
    engDeptId,
    'Frontend Design & Accessibility Walkthrough',
    'Zoom',
    'https://zoom.us/j/9482011842',
    formatDateOffset(3),
    '14:30',
    30,
    'Walk through attendance and task card contrast refinements.',
    leadOpsId,
    now
  );
  insertMeeting.run(
    opsDeptId,
    'Q4 Operations Cadence Check-in',
    'Microsoft Teams',
    'https://teams.microsoft.com/l/meetup-join/vems-ops-q4',
    formatDateOffset(2),
    '11:00',
    40,
    'Vendor SLA matrix review.',
    headOpsId,
    now
  );

  // Seed Holidays
  const insertHoliday = db.prepare(`
    INSERT INTO holidays (name, holiday_date, description, published_by, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertHoliday.run(
    'Thanksgiving Day',
    formatDateOffset(12),
    'Company-wide paid holiday. Offices closed.',
    hrId,
    now
  );
  insertHoliday.run(
    'Day After Thanksgiving',
    formatDateOffset(13),
    'Extended Thanksgiving company break.',
    hrId,
    now
  );
  insertHoliday.run(
    'Year-End Winter Holiday',
    formatDateOffset(41),
    'Annual winter observance across all departments.',
    hrId,
    now
  );

  // Seed Notifications
  const insertNotif = db.prepare(`
    INSERT INTO notifications (user_id, title, message, category, link_module, action_url, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
  `);
  insertNotif.run(
    emp1Id,
    'Rework Requested on Task',
    'Priya Nair requested rework on "Zero-Downtime Schema Migration Checklist".',
    'Task',
    'my-tasks',
    null,
    now
  );
  insertNotif.run(
    emp1Id,
    'Department Meeting Scheduled',
    'Marcus Vance shared a Google Meet link for "Engineering Weekly Architecture & Sprint Sync".',
    'Meeting',
    'meetings',
    'https://meet.google.com/vems-eng-sync',
    now
  );
  insertNotif.run(
    emp1Id,
    'Company Holiday Published',
    'HR published "Thanksgiving Day" on the company holiday calendar.',
    'Holiday',
    'holidays',
    null,
    yesterday
  );
  insertNotif.run(
    headEngId,
    'Task Submitted for Review',
    'David Kim submitted "Database Connection Pool Diagnostics Endpoint" for review.',
    'Task',
    'projects-tasks',
    null,
    now
  );
  insertNotif.run(
    hrId,
    'Pending Leave Requests',
    '2 new leave requests (Elena Rostova, Lucas Meyer) are awaiting HR review.',
    'Leave',
    'leave',
    null,
    now
  );
}
