import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { db, hashPassword, initDatabase, verifyPassword } from './server/db.ts';

initDatabase();

const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const SESSION_SECRET =
  process.env.SESSION_SECRET || crypto.createHash('sha256').update('vems-workspace-secret-key').digest('hex');

interface SessionPayload {
  userId: number;
  exp: number;
}

function signToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [data, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!parsed.userId || !parsed.exp || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      out[k] = decodeURIComponent(v);
    }
  }
  return out;
}

interface DbUserRow {
  id: number;
  employee_code: string;
  name: string;
  email: string;
  password_hash: string;
  role: string;
  department_id: number | null;
  department_name: string | null;
  designation: string;
  phone: string;
  joining_date: string;
  status: string;
}

function getUserById(id: number): DbUserRow | null {
  const row = db
    .prepare(
      `SELECT u.*, d.name as department_name
       FROM users u
       LEFT JOIN departments d ON d.id = u.department_id
       WHERE u.id = ?`
    )
    .get(id) as DbUserRow | undefined;
  return row ?? null;
}

function sanitizeUser(u: DbUserRow) {
  return {
    id: u.id,
    employeeCode: u.employee_code,
    name: u.name,
    email: u.email,
    role: u.role,
    departmentId: u.department_id,
    departmentName: u.department_name ?? null,
    designation: u.designation,
    phone: u.phone,
    joiningDate: u.joining_date,
    status: u.status,
  };
}

function createNotification(
  userId: number,
  title: string,
  message: string,
  category: string,
  linkModule: string,
  actionUrl: string | null = null
) {
  db.prepare(
    `INSERT INTO notifications (user_id, title, message, category, link_module, action_url, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(userId, title, message, category, linkModule, actionUrl, new Date().toISOString());
}

function mapTaskBucket(state: string): 'Pending' | 'Ongoing' | 'Finished' {
  if (state === 'assigned' || state === 'accepted') return 'Pending';
  if (state === 'completed') return 'Finished';
  return 'Ongoing';
}

function isManagerRole(role: string): boolean {
  return role === 'Department Head' || role === 'Team Lead';
}

function formatTasks(whereClause = '', params: Array<string | number> = []) {
  const rows = db
    .prepare(
      `SELECT t.*,
              p.name as project_name,
              d.name as department_name,
              ab.name as assigned_by_name,
              ae.name as assignee_name,
              ae.employee_code as assignee_code,
              ae.designation as assignee_designation
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN departments d ON d.id = t.department_id
       JOIN users ab ON ab.id = t.assigned_by
       JOIN users ae ON ae.id = t.assignee_id
       ${whereClause}
       ORDER BY t.created_at DESC, t.id DESC`
    )
    .all(...params) as Array<Record<string, unknown>>;

  const commentStmt = db.prepare(
    `SELECT c.id, c.task_id, c.user_id, c.message, c.created_at, u.name as author_name, u.role as author_role
     FROM task_comments c
     JOIN users u ON u.id = c.user_id
     WHERE c.task_id = ?
     ORDER BY c.created_at ASC, c.id ASC`
  );

  return rows.map((r) => {
    const comments = (commentStmt.all(Number(r.id)) as Array<Record<string, unknown>>).map((c) => ({
      id: Number(c.id),
      taskId: Number(c.task_id),
      userId: Number(c.user_id),
      authorName: String(c.author_name),
      authorRole: String(c.author_role),
      message: String(c.message),
      createdAt: String(c.created_at),
    }));

    return {
      id: Number(r.id),
      projectId: Number(r.project_id),
      projectName: String(r.project_name),
      departmentId: Number(r.department_id),
      departmentName: String(r.department_name),
      title: String(r.title),
      description: String(r.description ?? ''),
      priority: String(r.priority),
      dueDate: String(r.due_date),
      assignedById: Number(r.assigned_by),
      assignedByName: String(r.assigned_by_name),
      assigneeId: Number(r.assignee_id),
      assigneeName: String(r.assignee_name),
      assigneeCode: String(r.assignee_code),
      assigneeDesignation: String(r.assignee_designation),
      state: String(r.state),
      bucket: mapTaskBucket(String(r.state)),
      progressPercent: Number(r.progress_percent),
      submissionNotes: r.submission_notes ? String(r.submission_notes) : null,
      submissionLink: r.submission_link ? String(r.submission_link) : null,
      attachmentName: r.attachment_name ? String(r.attachment_name) : null,
      attachmentUrl: r.attachment_url ? String(r.attachment_url) : null,
      reworkFeedback: r.rework_feedback ? String(r.rework_feedback) : null,
      submittedAt: r.submitted_at ? String(r.submitted_at) : null,
      completedAt: r.completed_at ? String(r.completed_at) : null,
      createdAt: String(r.created_at),
      comments,
    };
  });
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // Auth middleware helper
  const requireAuth = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const authHeader = req.headers.authorization;
    const cookies = parseCookies(req.headers.cookie);
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : cookies.vems_session;

    if (!token) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const payload = verifyToken(token);
    if (!payload) {
      res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      return;
    }

    const user = getUserById(payload.userId);
    if (!user || user.status === 'Inactive') {
      res.status(401).json({ error: 'Account inactive or unavailable. Contact HR.' });
      return;
    }

    (req as express.Request & { currentUser: DbUserRow }).currentUser = user;
    next();
  };

  const getCurrentUser = (req: express.Request): DbUserRow => {
    return (req as express.Request & { currentUser: DbUserRow }).currentUser;
  };

  // --- AUTH ---
  app.post('/api/auth/login', (req, res) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');

    if (!email || !password) {
      res.status(400).json({ error: 'Work email and password are required.' });
      return;
    }

    const row = db
      .prepare(
        `SELECT u.*, d.name as department_name
         FROM users u
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE LOWER(u.email) = ?`
      )
      .get(email) as DbUserRow | undefined;

    if (!row || !verifyPassword(password, row.password_hash)) {
      res.status(401).json({
        error:
          'Invalid work email or password. Contact HR or the system administrator if you need a password reset.',
      });
      return;
    }

    if (row.status === 'Inactive') {
      res.status(403).json({
        error: 'Your account is currently marked Inactive. Contact HR for access.',
      });
      return;
    }

    const token = signToken({ userId: row.id, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
    res.cookie('vems_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({ token, user: sanitizeUser(row) });
  });

  app.post('/api/auth/logout', (_req, res) => {
    res.clearCookie('vems_session', { path: '/' });
    res.json({ ok: true });
  });

  app.get('/api/auth/me', requireAuth, (req, res) => {
    res.json({ user: sanitizeUser(getCurrentUser(req)) });
  });

  app.post('/api/auth/change-password', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const currentPassword = String(req.body?.currentPassword ?? '');
    const newPassword = String(req.body?.newPassword ?? '');

    if (!verifyPassword(currentPassword, user.password_hash)) {
      res.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
      hashPassword(newPassword),
      user.id
    );
    res.json({ ok: true });
  });

  // --- PROFILE ---
  app.patch('/api/profile', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const name = String(req.body?.name ?? user.name).trim();
    const email = String(req.body?.email ?? user.email).trim().toLowerCase();
    const phone = String(req.body?.phone ?? user.phone).trim();
    const designation = String(req.body?.designation ?? user.designation).trim();

    if (!name || !email || !designation) {
      res.status(400).json({ error: 'Name, work email, and designation are required.' });
      return;
    }

    if (email !== user.email.toLowerCase()) {
      const conflict = db
        .prepare('SELECT id FROM users WHERE LOWER(email) = ? AND id != ?')
        .get(email, user.id);
      if (conflict) {
        res.status(400).json({ error: 'Another employee already uses this work email.' });
        return;
      }
    }

    const changes: string[] = [];
    if (name !== user.name) changes.push(`Name (${user.name} → ${name})`);
    if (email !== user.email.toLowerCase()) changes.push(`Email (${user.email} → ${email})`);
    if (phone !== user.phone) changes.push(`Phone (${user.phone || '—'} → ${phone || '—'})`);
    if (designation !== user.designation) {
      changes.push(`Designation (${user.designation} → ${designation})`);
    }

    db.prepare(
      'UPDATE users SET name = ?, email = ?, phone = ?, designation = ? WHERE id = ?'
    ).run(name, email, phone, designation, user.id);

    if (changes.length > 0) {
      const hrUsers = db
        .prepare("SELECT id FROM users WHERE role = 'HR' AND status != 'Inactive'")
        .all() as Array<{ id: number }>;

      for (const hr of hrUsers) {
        createNotification(
          hr.id,
          'Employee Profile Updated',
          `${name} (${user.employee_code}) updated profile: ${changes.join(', ')}.`,
          'Profile',
          'employees'
        );
      }
    }

    const updated = getUserById(user.id)!;
    res.json({ user: sanitizeUser(updated), updatedFieldsCount: changes.length });
  });

  // --- DASHBOARD ---
  app.get('/api/dashboard', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const today = new Date().toISOString().slice(0, 10);

    const todayAttendanceRow = db
      .prepare(
        `SELECT a.*, u.name as employee_name, u.employee_code, d.name as department_name
         FROM attendance a
         JOIN users u ON u.id = a.user_id
         LEFT JOIN departments d ON d.id = u.department_id
         WHERE a.user_id = ? AND a.date = ?`
      )
      .get(user.id, today) as Record<string, unknown> | undefined;

    const todayAttendance = todayAttendanceRow
      ? {
          id: Number(todayAttendanceRow.id),
          userId: Number(todayAttendanceRow.user_id),
          employeeName: String(todayAttendanceRow.employee_name),
          employeeCode: String(todayAttendanceRow.employee_code),
          departmentName: todayAttendanceRow.department_name
            ? String(todayAttendanceRow.department_name)
            : null,
          date: String(todayAttendanceRow.date),
          clockIn: String(todayAttendanceRow.clock_in),
          clockOut: todayAttendanceRow.clock_out ? String(todayAttendanceRow.clock_out) : null,
          breakStartedAt: todayAttendanceRow.break_started_at
            ? String(todayAttendanceRow.break_started_at)
            : null,
          breakMinutes: Number(todayAttendanceRow.break_minutes),
          status: String(todayAttendanceRow.status),
        }
      : null;

    const upcomingHolidays = (
      db
        .prepare(
          `SELECT h.*, u.name as published_by_name
           FROM holidays h
           JOIN users u ON u.id = h.published_by
           WHERE h.holiday_date >= ?
           ORDER BY h.holiday_date ASC
           LIMIT 5`
        )
        .all(today) as Array<Record<string, unknown>>
    ).map((h) => ({
      id: Number(h.id),
      name: String(h.name),
      holidayDate: String(h.holiday_date),
      description: String(h.description ?? ''),
      publishedByName: String(h.published_by_name),
      createdAt: String(h.created_at),
    }));

    const meetingsQuery =
      user.role === 'HR'
        ? db
            .prepare(
              `SELECT m.*, d.name as department_name, u.name as scheduled_by_name
               FROM meetings m
               JOIN departments d ON d.id = m.department_id
               JOIN users u ON u.id = m.scheduled_by
               WHERE m.meeting_date >= ?
               ORDER BY m.meeting_date ASC, m.meeting_time ASC
               LIMIT 6`
            )
            .all(today)
        : db
            .prepare(
              `SELECT m.*, d.name as department_name, u.name as scheduled_by_name
               FROM meetings m
               JOIN departments d ON d.id = m.department_id
               JOIN users u ON u.id = m.scheduled_by
               WHERE m.department_id = ? AND m.meeting_date >= ?
               ORDER BY m.meeting_date ASC, m.meeting_time ASC
               LIMIT 6`
            )
            .all(user.department_id ?? -1, today);

    const upcomingMeetings = (meetingsQuery as Array<Record<string, unknown>>).map((m) => ({
      id: Number(m.id),
      departmentId: Number(m.department_id),
      departmentName: String(m.department_name),
      title: String(m.title),
      platform: String(m.platform),
      meetingLink: String(m.meeting_link),
      meetingDate: String(m.meeting_date),
      meetingTime: String(m.meeting_time),
      durationMinutes: Number(m.duration_minutes),
      description: String(m.description ?? ''),
      scheduledByName: String(m.scheduled_by_name),
      createdAt: String(m.created_at),
    }));

    const myTasks = formatTasks('WHERE t.assignee_id = ?', [user.id]);
    const myLeave = (
      db
        .prepare(
          `SELECT l.*, u.name as employee_name, u.employee_code, d.name as department_name, r.name as reviewed_by_name
           FROM leave_requests l
           JOIN users u ON u.id = l.user_id
           LEFT JOIN departments d ON d.id = u.department_id
           LEFT JOIN users r ON r.id = l.reviewed_by
           WHERE l.user_id = ?
           ORDER BY l.created_at DESC
           LIMIT 5`
        )
        .all(user.id) as Array<Record<string, unknown>>
    ).map((l) => ({
      id: Number(l.id),
      userId: Number(l.user_id),
      employeeName: String(l.employee_name),
      employeeCode: String(l.employee_code),
      departmentName: l.department_name ? String(l.department_name) : null,
      leaveType: String(l.leave_type),
      startDate: String(l.start_date),
      endDate: String(l.end_date),
      reason: String(l.reason ?? ''),
      status: String(l.status),
      reviewedByName: l.reviewed_by_name ? String(l.reviewed_by_name) : null,
      reviewNote: l.review_note ? String(l.review_note) : null,
      createdAt: String(l.created_at),
    }));

    let hrSummary: Record<string, unknown> | null = null;
    if (user.role === 'HR') {
      const totalEmployees = Number(
        (db.prepare("SELECT COUNT(*) as c FROM users WHERE status != 'Inactive'").get() as { c: number }).c
      );
      const totalDepartments = Number(
        (db.prepare('SELECT COUNT(*) as c FROM departments').get() as { c: number }).c
      );
      const presentToday = Number(
        (
          db
            .prepare("SELECT COUNT(*) as c FROM attendance WHERE date = ? AND status = 'Present'")
            .get(today) as { c: number }
        ).c
      );
      const lateToday = Number(
        (
          db
            .prepare("SELECT COUNT(*) as c FROM attendance WHERE date = ? AND status = 'Late'")
            .get(today) as { c: number }
        ).c
      );
      const pendingLeaveRows = (
        db
          .prepare(
            `SELECT l.*, u.name as employee_name, u.employee_code, d.name as department_name
             FROM leave_requests l
             JOIN users u ON u.id = l.user_id
             LEFT JOIN departments d ON d.id = u.department_id
             WHERE l.status = 'Pending'
             ORDER BY l.created_at DESC`
          )
          .all() as Array<Record<string, unknown>>
      ).map((l) => ({
        id: Number(l.id),
        userId: Number(l.user_id),
        employeeName: String(l.employee_name),
        employeeCode: String(l.employee_code),
        departmentName: l.department_name ? String(l.department_name) : null,
        leaveType: String(l.leave_type),
        startDate: String(l.start_date),
        endDate: String(l.end_date),
        reason: String(l.reason ?? ''),
        status: String(l.status),
        reviewedByName: null,
        reviewNote: null,
        createdAt: String(l.created_at),
      }));

      hrSummary = {
        totalEmployees,
        totalDepartments,
        presentToday,
        lateToday,
        pendingLeavesCount: pendingLeaveRows.length,
        pendingLeaves: pendingLeaveRows,
      };
    }

    let managerSummary: Record<string, unknown> | null = null;
    if (isManagerRole(user.role)) {
      const deptTasks = user.department_id
        ? formatTasks('WHERE t.department_id = ?', [user.department_id])
        : formatTasks('WHERE t.assigned_by = ?', [user.id]);
      const teamMembersCount = Number(
        (
          db
            .prepare(
              "SELECT COUNT(*) as c FROM users WHERE department_id = ? AND status != 'Inactive'"
            )
            .get(user.department_id ?? -1) as { c: number }
        ).c
      );
      managerSummary = {
        teamMembersCount,
        pendingCount: deptTasks.filter((t) => t.bucket === 'Pending').length,
        ongoingCount: deptTasks.filter((t) => t.bucket === 'Ongoing').length,
        finishedCount: deptTasks.filter((t) => t.bucket === 'Finished').length,
        awaitingReviewTasks: deptTasks.filter((t) => t.state === 'submitted'),
      };
    }

    res.json({
      todayAttendance,
      upcomingHolidays,
      upcomingMeetings,
      myTasks,
      myLeave,
      hrSummary,
      managerSummary,
    });
  });

  // --- DEPARTMENTS ---
  app.get('/api/departments', requireAuth, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT d.*, h.name as head_name,
                (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id AND u.status != 'Inactive') as employee_count
         FROM departments d
         LEFT JOIN users h ON h.id = d.head_id
         ORDER BY d.name ASC`
      )
      .all() as Array<Record<string, unknown>>;

    res.json({
      departments: rows.map((d) => ({
        id: Number(d.id),
        name: String(d.name),
        headId: d.head_id ? Number(d.head_id) : null,
        headName: d.head_name ? String(d.head_name) : null,
        annualBudget: Number(d.annual_budget),
        employeeCount: Number(d.employee_count),
        createdAt: String(d.created_at),
      })),
    });
  });

  app.post('/api/departments', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    if (user.role !== 'HR') {
      res.status(403).json({ error: 'Only HR can create departments.' });
      return;
    }
    const name = String(req.body?.name ?? '').trim();
    const headId = req.body?.headId ? Number(req.body.headId) : null;
    const annualBudget = Number(req.body?.annualBudget ?? 0);

    if (!name) {
      res.status(400).json({ error: 'Department name is required.' });
      return;
    }

    try {
      const result = db
        .prepare(
          'INSERT INTO departments (name, head_id, annual_budget, created_at) VALUES (?, ?, ?, ?)'
        )
        .run(name, headId, Number.isFinite(annualBudget) ? annualBudget : 0, new Date().toISOString());
      res.status(201).json({ id: Number(result.lastInsertRowid) });
    } catch {
      res.status(400).json({ error: 'A department with this name already exists.' });
    }
  });

  app.patch('/api/departments/:id', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    if (user.role !== 'HR') {
      res.status(403).json({ error: 'Only HR can update departments.' });
      return;
    }
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM departments WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Department not found.' });
      return;
    }
    const name = String(req.body?.name ?? existing.name).trim();
    const headId =
      req.body?.headId !== undefined
        ? req.body.headId
          ? Number(req.body.headId)
          : null
        : existing.head_id
          ? Number(existing.head_id)
          : null;
    const annualBudget =
      req.body?.annualBudget !== undefined
        ? Number(req.body.annualBudget)
        : Number(existing.annual_budget);

    try {
      db.prepare('UPDATE departments SET name = ?, head_id = ?, annual_budget = ? WHERE id = ?').run(
        name,
        headId,
        annualBudget,
        id
      );
      res.json({ ok: true });
    } catch {
      res.status(400).json({ error: 'Unable to update department. Name may already exist.' });
    }
  });

  // --- EMPLOYEES ---
  app.get('/api/employees', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const deptFilter = req.query.departmentId ? Number(req.query.departmentId) : null;

    let rows: DbUserRow[];
    if (user.role === 'HR') {
      rows = (
        deptFilter
          ? db
              .prepare(
                `SELECT u.*, d.name as department_name
                 FROM users u LEFT JOIN departments d ON d.id = u.department_id
                 WHERE u.department_id = ?
                 ORDER BY u.employee_code ASC`
              )
              .all(deptFilter)
          : db
              .prepare(
                `SELECT u.*, d.name as department_name
                 FROM users u LEFT JOIN departments d ON d.id = u.department_id
                 ORDER BY u.employee_code ASC`
              )
              .all()
      ) as unknown as DbUserRow[];
    } else if (isManagerRole(user.role)) {
      const targetDept = deptFilter ?? user.department_id ?? -1;
      rows = db
        .prepare(
          `SELECT u.*, d.name as department_name
           FROM users u LEFT JOIN departments d ON d.id = u.department_id
           WHERE u.department_id = ? AND u.status != 'Inactive'
           ORDER BY u.name ASC`
        )
        .all(targetDept) as unknown as DbUserRow[];
    } else {
      rows = [user];
    }

    res.json({ employees: rows.map(sanitizeUser) });
  });

  app.post('/api/employees', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    if (user.role !== 'HR') {
      res.status(403).json({ error: 'Only HR can add employees.' });
      return;
    }

    const name = String(req.body?.name ?? '').trim();
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const temporaryPassword = String(req.body?.temporaryPassword ?? '');
    const designation = String(req.body?.designation ?? '').trim();
    const phone = String(req.body?.phone ?? '').trim();
    const departmentId = req.body?.departmentId ? Number(req.body.departmentId) : null;
    const role = String(req.body?.role ?? 'Employee');
    const joiningDate = String(
      req.body?.joiningDate ?? new Date().toISOString().slice(0, 10)
    ).trim();

    if (!name || !email || !temporaryPassword || !designation) {
      res
        .status(400)
        .json({ error: 'Name, work email, temporary password, and designation are required.' });
      return;
    }
    if (temporaryPassword.length < 6) {
      res.status(400).json({ error: 'Temporary password must be at least 6 characters.' });
      return;
    }

    const validRoles = ['HR', 'Department Head', 'Team Lead', 'Employee'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Invalid role selected.' });
      return;
    }

    const maxRow = db.prepare('SELECT MAX(id) as maxId FROM users').get() as { maxId: number | null };
    const nextCode = `EMP-${1001 + Number(maxRow.maxId ?? 0)}`;

    try {
      const result = db
        .prepare(
          `INSERT INTO users (employee_code, name, email, password_hash, role, department_id, designation, phone, joining_date, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?)`
        )
        .run(
          nextCode,
          name,
          email,
          hashPassword(temporaryPassword),
          role,
          departmentId,
          designation,
          phone,
          joiningDate,
          new Date().toISOString()
        );
      const created = getUserById(Number(result.lastInsertRowid))!;
      res.status(201).json({ employee: sanitizeUser(created) });
    } catch {
      res.status(400).json({ error: 'An employee with this email already exists.' });
    }
  });

  app.patch('/api/employees/:id', requireAuth, (req, res) => {
    const current = getCurrentUser(req);
    if (current.role !== 'HR') {
      res.status(403).json({ error: 'Only HR can edit employee records.' });
      return;
    }

    const id = Number(req.params.id);
    const target = getUserById(id);
    if (!target) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const name = String(req.body?.name ?? target.name).trim();
    const designation = String(req.body?.designation ?? target.designation).trim();
    const phone = String(req.body?.phone ?? target.phone).trim();
    const departmentId =
      req.body?.departmentId !== undefined
        ? req.body.departmentId
          ? Number(req.body.departmentId)
          : null
        : target.department_id;
    const role = String(req.body?.role ?? target.role);
    const status = String(req.body?.status ?? target.status);
    const newPassword = req.body?.newPassword ? String(req.body.newPassword) : '';

    db.prepare(
      `UPDATE users SET name = ?, designation = ?, phone = ?, department_id = ?, role = ?, status = ? WHERE id = ?`
    ).run(name, designation, phone, departmentId, role, status, id);

    if (newPassword.length >= 6) {
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(
        hashPassword(newPassword),
        id
      );
    }

    const updated = getUserById(id)!;
    res.json({ employee: sanitizeUser(updated) });
  });

  app.get('/api/employees/:id/performance', requireAuth, (req, res) => {
    const current = getCurrentUser(req);
    const targetId = Number(req.params.id);
    if (current.role !== 'HR' && !isManagerRole(current.role) && current.id !== targetId) {
      res.status(403).json({ error: 'Access denied.' });
      return;
    }

    const target = getUserById(targetId);
    if (!target) {
      res.status(404).json({ error: 'Employee not found.' });
      return;
    }

    const tasks = db
      .prepare('SELECT state, progress_percent, rework_count FROM tasks WHERE assignee_id = ?')
      .all(targetId) as Array<{ state: string; progress_percent: number; rework_count: number }>;

    const tasksTotal = tasks.length;
    const tasksPending = tasks.filter((t) => mapTaskBucket(t.state) === 'Pending').length;
    const tasksOngoing = tasks.filter((t) => mapTaskBucket(t.state) === 'Ongoing').length;
    const tasksFinished = tasks.filter((t) => mapTaskBucket(t.state) === 'Finished').length;
    const reworkCount = tasks.reduce((sum, t) => sum + Number(t.rework_count), 0);
    const avgCompletion =
      tasksTotal > 0
        ? Math.round(tasks.reduce((sum, t) => sum + Number(t.progress_percent), 0) / tasksTotal)
        : 0;

    const attRows = db
      .prepare('SELECT status FROM attendance WHERE user_id = ?')
      .all(targetId) as Array<{ status: string }>;
    const attendanceDays = attRows.length;
    const presentDays = attRows.filter((a) => a.status === 'Present').length;
    const lateDays = attRows.filter((a) => a.status === 'Late').length;

    const leaveRows = db
      .prepare('SELECT status, start_date, end_date FROM leave_requests WHERE user_id = ?')
      .all(targetId) as Array<{ status: string; start_date: string; end_date: string }>;

    let approvedLeaveDays = 0;
    for (const l of leaveRows) {
      if (l.status === 'Approved') {
        const s = new Date(l.start_date).getTime();
        const e = new Date(l.end_date).getTime();
        const days = Math.max(1, Math.round((e - s) / 86400000) + 1);
        approvedLeaveDays += days;
      }
    }

    res.json({
      performance: {
        employee: sanitizeUser(target),
        tasksTotal,
        tasksPending,
        tasksOngoing,
        tasksFinished,
        reworkCount,
        avgCompletion,
        attendanceDays,
        presentDays,
        lateDays,
        leaveRequestsTotal: leaveRows.length,
        approvedLeaveDays,
      },
    });
  });

  // --- ATTENDANCE ---
  app.get('/api/attendance', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const scope = String(req.query.scope ?? (user.role === 'HR' ? 'org' : 'self'));

    const rows = (
      user.role === 'HR' && scope === 'org'
        ? db
            .prepare(
              `SELECT a.*, u.name as employee_name, u.employee_code, d.name as department_name
               FROM attendance a
               JOIN users u ON u.id = a.user_id
               LEFT JOIN departments d ON d.id = u.department_id
               ORDER BY a.date DESC, a.clock_in DESC`
            )
            .all()
        : db
            .prepare(
              `SELECT a.*, u.name as employee_name, u.employee_code, d.name as department_name
               FROM attendance a
               JOIN users u ON u.id = a.user_id
               LEFT JOIN departments d ON d.id = u.department_id
               WHERE a.user_id = ?
               ORDER BY a.date DESC`
            )
            .all(user.id)
    ) as Array<Record<string, unknown>>;

    res.json({
      records: rows.map((r) => ({
        id: Number(r.id),
        userId: Number(r.user_id),
        employeeName: String(r.employee_name),
        employeeCode: String(r.employee_code),
        departmentName: r.department_name ? String(r.department_name) : null,
        date: String(r.date),
        clockIn: String(r.clock_in),
        clockOut: r.clock_out ? String(r.clock_out) : null,
        breakStartedAt: r.break_started_at ? String(r.break_started_at) : null,
        breakMinutes: Number(r.break_minutes),
        status: String(r.status),
      })),
    });
  });

  app.post('/api/attendance/clock-in', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);

    const existing = db
      .prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(user.id, today);
    if (existing) {
      res.status(400).json({ error: 'You have already clocked in today.' });
      return;
    }

    // Late if after 09:15 local server time (using client hour/minute if provided safely or server time)
    const hours = now.getHours();
    const mins = now.getMinutes();
    const status = hours > 9 || (hours === 9 && mins > 15) ? 'Late' : 'Present';

    db.prepare(
      `INSERT INTO attendance (user_id, date, clock_in, clock_out, break_started_at, break_minutes, status)
       VALUES (?, ?, ?, NULL, NULL, 0, ?)`
    ).run(user.id, today, now.toISOString(), status);

    res.status(201).json({ ok: true, status });
  });

  app.post('/api/attendance/break-start', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const today = new Date().toISOString().slice(0, 10);
    const row = db
      .prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(user.id, today) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(400).json({ error: 'Clock in before starting a break.' });
      return;
    }
    if (row.clock_out) {
      res.status(400).json({ error: 'Cannot start a break after clocking out.' });
      return;
    }
    if (row.break_started_at) {
      res.status(400).json({ error: 'Break is already active.' });
      return;
    }

    db.prepare('UPDATE attendance SET break_started_at = ? WHERE id = ?').run(
      new Date().toISOString(),
      Number(row.id)
    );
    res.json({ ok: true });
  });

  app.post('/api/attendance/break-end', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const today = new Date().toISOString().slice(0, 10);
    const row = db
      .prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(user.id, today) as Record<string, unknown> | undefined;

    if (!row || !row.break_started_at) {
      res.status(400).json({ error: 'No active break to end.' });
      return;
    }

    const startedMs = new Date(String(row.break_started_at)).getTime();
    const elapsedMin = Math.max(1, Math.round((Date.now() - startedMs) / 60000));
    const totalBreak = Number(row.break_minutes) + elapsedMin;

    db.prepare('UPDATE attendance SET break_started_at = NULL, break_minutes = ? WHERE id = ?').run(
      totalBreak,
      Number(row.id)
    );
    res.json({ ok: true, breakMinutes: totalBreak });
  });

  app.post('/api/attendance/clock-out', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const row = db
      .prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(user.id, today) as Record<string, unknown> | undefined;

    if (!row) {
      res.status(400).json({ error: 'You have not clocked in today.' });
      return;
    }
    if (row.clock_out) {
      res.status(400).json({ error: 'You have already clocked out today.' });
      return;
    }

    let totalBreak = Number(row.break_minutes);
    if (row.break_started_at) {
      const startedMs = new Date(String(row.break_started_at)).getTime();
      totalBreak += Math.max(1, Math.round((now.getTime() - startedMs) / 60000));
    }

    db.prepare(
      'UPDATE attendance SET clock_out = ?, break_started_at = NULL, break_minutes = ? WHERE id = ?'
    ).run(now.toISOString(), totalBreak, Number(row.id));

    res.json({ ok: true });
  });

  // --- LEAVE ---
  app.get('/api/leave', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const scope = String(req.query.scope ?? (user.role === 'HR' ? 'org' : 'self'));

    const rows = (
      user.role === 'HR' && scope === 'org'
        ? db
            .prepare(
              `SELECT l.*, u.name as employee_name, u.employee_code, d.name as department_name, r.name as reviewed_by_name
               FROM leave_requests l
               JOIN users u ON u.id = l.user_id
               LEFT JOIN departments d ON d.id = u.department_id
               LEFT JOIN users r ON r.id = l.reviewed_by
               ORDER BY l.created_at DESC, l.id DESC`
            )
            .all()
        : db
            .prepare(
              `SELECT l.*, u.name as employee_name, u.employee_code, d.name as department_name, r.name as reviewed_by_name
               FROM leave_requests l
               JOIN users u ON u.id = l.user_id
               LEFT JOIN departments d ON d.id = u.department_id
               LEFT JOIN users r ON r.id = l.reviewed_by
               WHERE l.user_id = ?
               ORDER BY l.created_at DESC, l.id DESC`
            )
            .all(user.id)
    ) as Array<Record<string, unknown>>;

    res.json({
      requests: rows.map((l) => ({
        id: Number(l.id),
        userId: Number(l.user_id),
        employeeName: String(l.employee_name),
        employeeCode: String(l.employee_code),
        departmentName: l.department_name ? String(l.department_name) : null,
        leaveType: String(l.leave_type),
        startDate: String(l.start_date),
        endDate: String(l.end_date),
        reason: String(l.reason ?? ''),
        status: String(l.status),
        reviewedByName: l.reviewed_by_name ? String(l.reviewed_by_name) : null,
        reviewNote: l.review_note ? String(l.review_note) : null,
        createdAt: String(l.created_at),
      })),
    });
  });

  app.post('/api/leave', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const leaveType = String(req.body?.leaveType ?? 'Annual');
    const startDate = String(req.body?.startDate ?? '');
    const endDate = String(req.body?.endDate ?? '');
    const reason = String(req.body?.reason ?? '').trim();

    if (!['Annual', 'Sick', 'Personal', 'Unpaid'].includes(leaveType)) {
      res.status(400).json({ error: 'Invalid leave type.' });
      return;
    }
    if (!startDate || !endDate || endDate < startDate) {
      res.status(400).json({ error: 'Please provide valid start and end dates.' });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, reason, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'Pending', ?)`
      )
      .run(user.id, leaveType, startDate, endDate, reason, new Date().toISOString());

    // Notify HR users
    const hrUsers = db
      .prepare("SELECT id FROM users WHERE role = 'HR' AND status != 'Inactive' AND id != ?")
      .all(user.id) as Array<{ id: number }>;
    for (const hr of hrUsers) {
      createNotification(
        hr.id,
        'New Leave Request',
        `${user.name} submitted a ${leaveType} leave request (${startDate} to ${endDate}).`,
        'Leave',
        'leave'
      );
    }

    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  app.patch('/api/leave/:id/review', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    if (user.role !== 'HR') {
      res.status(403).json({ error: 'Only HR can approve or reject leave requests.' });
      return;
    }

    const id = Number(req.params.id);
    const decision = String(req.body?.decision ?? '');
    const reviewNote = String(req.body?.reviewNote ?? '').trim();

    if (!['Approved', 'Rejected'].includes(decision)) {
      res.status(400).json({ error: 'Decision must be Approved or Rejected.' });
      return;
    }

    const existing = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Leave request not found.' });
      return;
    }

    db.prepare(
      'UPDATE leave_requests SET status = ?, reviewed_by = ?, review_note = ? WHERE id = ?'
    ).run(decision, user.id, reviewNote || null, id);

    createNotification(
      Number(existing.user_id),
      `Leave Request ${decision}`,
      `HR ${decision.toLowerCase()} your ${existing.leave_type} leave request (${existing.start_date} to ${existing.end_date}).`,
      'Leave',
      'leave'
    );

    res.json({ ok: true });
  });

  // --- PROJECTS ---
  app.get('/api/projects', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const rows = (
      user.role === 'HR'
        ? db
            .prepare(
              `SELECT p.*, d.name as department_name, u.name as created_by_name
               FROM projects p
               JOIN departments d ON d.id = p.department_id
               JOIN users u ON u.id = p.created_by
               ORDER BY p.created_at DESC`
            )
            .all()
        : db
            .prepare(
              `SELECT p.*, d.name as department_name, u.name as created_by_name
               FROM projects p
               JOIN departments d ON d.id = p.department_id
               JOIN users u ON u.id = p.created_by
               WHERE p.department_id = ?
               ORDER BY p.created_at DESC`
            )
            .all(user.department_id ?? -1)
    ) as Array<Record<string, unknown>>;

    res.json({
      projects: rows.map((p) => ({
        id: Number(p.id),
        name: String(p.name),
        departmentId: Number(p.department_id),
        departmentName: String(p.department_name),
        description: String(p.description ?? ''),
        createdByName: String(p.created_by_name),
        createdAt: String(p.created_at),
      })),
    });
  });

  app.post('/api/projects', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    if (!isManagerRole(user.role) && user.role !== 'HR') {
      res.status(403).json({ error: 'Only managers or HR can create projects.' });
      return;
    }
    const name = String(req.body?.name ?? '').trim();
    const departmentId = Number(req.body?.departmentId ?? user.department_id);
    const description = String(req.body?.description ?? '').trim();

    if (!name || !departmentId) {
      res.status(400).json({ error: 'Project name and department are required.' });
      return;
    }

    const result = db
      .prepare(
        'INSERT INTO projects (name, department_id, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(name, departmentId, description, user.id, new Date().toISOString());

    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  // --- TASKS ---
  app.get('/api/tasks', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const scope = String(req.query.scope ?? 'mine');

    if (scope === 'team' && (isManagerRole(user.role) || user.role === 'HR')) {
      const tasks =
        user.role === 'HR'
          ? formatTasks()
          : formatTasks('WHERE t.department_id = ? OR t.assigned_by = ?', [
              user.department_id ?? -1,
              user.id,
            ]);
      res.json({ tasks });
      return;
    }

    res.json({ tasks: formatTasks('WHERE t.assignee_id = ?', [user.id]) });
  });

  app.post('/api/tasks', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    if (!isManagerRole(user.role)) {
      res.status(403).json({ error: 'Only Department Heads or Team Leads can assign tasks.' });
      return;
    }

    const departmentId = Number(req.body?.departmentId ?? user.department_id);
    const projectId = Number(req.body?.projectId);
    const title = String(req.body?.title ?? '').trim();
    const priority = String(req.body?.priority ?? 'Medium');
    const dueDate = String(req.body?.dueDate ?? '');
    const description = String(req.body?.description ?? '').trim();
    const assigneeIds: number[] = Array.isArray(req.body?.assigneeIds)
      ? req.body.assigneeIds.map((x: unknown) => Number(x)).filter((n: number) => Number.isFinite(n))
      : [];

    if (!departmentId || !projectId || !title || !dueDate || assigneeIds.length === 0) {
      res.status(400).json({
        error: 'Department, project, title, due date, and at least one employee are required.',
      });
      return;
    }

    const now = new Date().toISOString();
    const insert = db.prepare(
      `INSERT INTO tasks (
        project_id, department_id, title, description, priority, due_date,
        assigned_by, assignee_id, state, progress_percent, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'assigned', 0, ?)`
    );

    const createdIds: number[] = [];
    for (const assigneeId of assigneeIds) {
      const info = insert.run(
        projectId,
        departmentId,
        title,
        description,
        priority,
        dueDate,
        user.id,
        assigneeId,
        now
      );
      createdIds.push(Number(info.lastInsertRowid));
      createNotification(
        assigneeId,
        'New Task Assigned',
        `${user.name} assigned you "${title}" (${priority} priority, due ${dueDate}).`,
        'Task',
        'my-tasks'
      );
    }

    res.status(201).json({ ids: createdIds });
  });

  app.post('/api/tasks/:id/accept', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const id = Number(req.params.id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (Number(task.assignee_id) !== user.id) {
      res.status(403).json({ error: 'Only the assigned employee can accept this task.' });
      return;
    }
    if (task.state !== 'assigned') {
      res.status(400).json({ error: 'Task has already been accepted.' });
      return;
    }

    db.prepare("UPDATE tasks SET state = 'accepted' WHERE id = ?").run(id);
    res.json({ ok: true });
  });

  app.post('/api/tasks/:id/start', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const id = Number(req.params.id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (Number(task.assignee_id) !== user.id) {
      res.status(403).json({ error: 'Only the assigned employee can start this task.' });
      return;
    }
    if (task.state !== 'accepted' && task.state !== 'assigned') {
      res.status(400).json({ error: 'Task cannot be started from its current state.' });
      return;
    }

    const nextProgress = Math.max(5, Number(task.progress_percent));
    db.prepare("UPDATE tasks SET state = 'in_progress', progress_percent = ? WHERE id = ?").run(
      nextProgress,
      id
    );
    res.json({ ok: true });
  });

  app.post('/api/tasks/:id/progress', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const id = Number(req.params.id);
    const progress = Math.max(0, Math.min(100, Math.round(Number(req.body?.progressPercent ?? 0))));
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (Number(task.assignee_id) !== user.id) {
      res.status(403).json({ error: 'Only the assigned employee can update task progress.' });
      return;
    }

    db.prepare('UPDATE tasks SET progress_percent = ? WHERE id = ?').run(progress, id);
    res.json({ ok: true, progressPercent: progress });
  });

  app.post('/api/tasks/:id/comments', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const id = Number(req.params.id);
    const message = String(req.body?.message ?? '').trim();

    if (!message) {
      res.status(400).json({ error: 'Comment cannot be empty.' });
      return;
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    db.prepare(
      'INSERT INTO task_comments (task_id, user_id, message, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, user.id, message, new Date().toISOString());

    const recipientId =
      user.id === Number(task.assignee_id) ? Number(task.assigned_by) : Number(task.assignee_id);
    if (recipientId !== user.id) {
      createNotification(
        recipientId,
        'New Task Comment',
        `${user.name} commented on "${task.title}".`,
        'Task',
        user.id === Number(task.assignee_id) ? 'projects-tasks' : 'my-tasks'
      );
    }

    res.status(201).json({ ok: true });
  });

  app.post('/api/tasks/:id/submit', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const id = Number(req.params.id);
    const submissionNotes = String(req.body?.submissionNotes ?? '').trim();
    const submissionLink = String(req.body?.submissionLink ?? '').trim();
    const attachmentName = req.body?.attachmentName ? String(req.body.attachmentName) : null;
    const attachmentUrl = req.body?.attachmentUrl ? String(req.body.attachmentUrl) : null;

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }
    if (Number(task.assignee_id) !== user.id) {
      res.status(403).json({ error: 'Only the assignee can submit work.' });
      return;
    }
    if (!submissionNotes && !submissionLink && !attachmentUrl) {
      res
        .status(400)
        .json({ error: 'Please include submission details, a work link, or an attachment.' });
      return;
    }

    db.prepare(
      `UPDATE tasks
       SET state = 'submitted',
           progress_percent = 100,
           submission_notes = ?,
           submission_link = ?,
           attachment_name = COALESCE(?, attachment_name),
           attachment_url = COALESCE(?, attachment_url),
           submitted_at = ?
       WHERE id = ?`
    ).run(
      submissionNotes || null,
      submissionLink || null,
      attachmentName,
      attachmentUrl,
      new Date().toISOString(),
      id
    );

    createNotification(
      Number(task.assigned_by),
      'Work Submitted for Review',
      `${user.name} submitted "${task.title}" for review.`,
      'Task',
      'projects-tasks'
    );

    res.json({ ok: true });
  });

  app.post('/api/tasks/:id/review', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    if (!isManagerRole(user.role)) {
      res.status(403).json({ error: 'Only managers can review submitted work.' });
      return;
    }

    const id = Number(req.params.id);
    const decision = String(req.body?.decision ?? '');
    const feedback = String(req.body?.feedback ?? '').trim();

    if (!['complete', 'rework'].includes(decision)) {
      res.status(400).json({ error: 'Decision must be complete or rework.' });
      return;
    }

    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!task) {
      res.status(404).json({ error: 'Task not found.' });
      return;
    }

    if (decision === 'complete') {
      db.prepare(
        `UPDATE tasks
         SET state = 'completed',
             progress_percent = 100,
             rework_feedback = ?,
             completed_at = ?
         WHERE id = ?`
      ).run(feedback || null, new Date().toISOString(), id);

      createNotification(
        Number(task.assignee_id),
        'Task Completed',
        `${user.name} marked "${task.title}" as completed.`,
        'Task',
        'my-tasks'
      );
    } else {
      if (!feedback) {
        res.status(400).json({ error: 'Please provide rework feedback for the employee.' });
        return;
      }
      db.prepare(
        `UPDATE tasks
         SET state = 'rework_requested',
             progress_percent = 80,
             rework_feedback = ?,
             rework_count = rework_count + 1
         WHERE id = ?`
      ).run(feedback, id);

      createNotification(
        Number(task.assignee_id),
        'Rework Requested on Task',
        `${user.name} requested rework on "${task.title}": ${feedback}`,
        'Task',
        'my-tasks'
      );
    }

    res.json({ ok: true });
  });

  // --- MEETINGS ---
  app.get('/api/meetings', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const rows = (
      user.role === 'HR'
        ? db
            .prepare(
              `SELECT m.*, d.name as department_name, u.name as scheduled_by_name
               FROM meetings m
               JOIN departments d ON d.id = m.department_id
               JOIN users u ON u.id = m.scheduled_by
               ORDER BY m.meeting_date ASC, m.meeting_time ASC`
            )
            .all()
        : db
            .prepare(
              `SELECT m.*, d.name as department_name, u.name as scheduled_by_name
               FROM meetings m
               JOIN departments d ON d.id = m.department_id
               JOIN users u ON u.id = m.scheduled_by
               WHERE m.department_id = ? OR m.scheduled_by = ?
               ORDER BY m.meeting_date ASC, m.meeting_time ASC`
            )
            .all(user.department_id ?? -1, user.id)
    ) as Array<Record<string, unknown>>;

    res.json({
      meetings: rows.map((m) => ({
        id: Number(m.id),
        departmentId: Number(m.department_id),
        departmentName: String(m.department_name),
        title: String(m.title),
        platform: String(m.platform),
        meetingLink: String(m.meeting_link),
        meetingDate: String(m.meeting_date),
        meetingTime: String(m.meeting_time),
        durationMinutes: Number(m.duration_minutes),
        description: String(m.description ?? ''),
        scheduledByName: String(m.scheduled_by_name),
        createdAt: String(m.created_at),
      })),
    });
  });

  app.post('/api/meetings', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    if (!isManagerRole(user.role) && user.role !== 'HR') {
      res.status(403).json({ error: 'Only managers or HR can schedule department meetings.' });
      return;
    }

    const departmentId = Number(req.body?.departmentId ?? user.department_id);
    const title = String(req.body?.title ?? '').trim();
    const platform = String(req.body?.platform ?? 'Google Meet').trim();
    const meetingLink = String(req.body?.meetingLink ?? '').trim();
    const meetingDate = String(req.body?.meetingDate ?? '');
    const meetingTime = String(req.body?.meetingTime ?? '');
    const durationMinutes = Math.max(10, Number(req.body?.durationMinutes ?? 45));
    const description = String(req.body?.description ?? '').trim();

    if (!departmentId || !title || !meetingLink || !meetingDate || !meetingTime) {
      res.status(400).json({
        error: 'Department, title, meeting link, date, and time are required.',
      });
      return;
    }

    const result = db
      .prepare(
        `INSERT INTO meetings (department_id, title, platform, meeting_link, meeting_date, meeting_time, duration_minutes, description, scheduled_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        departmentId,
        title,
        platform,
        meetingLink,
        meetingDate,
        meetingTime,
        durationMinutes,
        description,
        user.id,
        new Date().toISOString()
      );

    // Notify all active department employees
    const deptUsers = db
      .prepare("SELECT id FROM users WHERE department_id = ? AND status != 'Inactive' AND id != ?")
      .all(departmentId, user.id) as Array<{ id: number }>;

    for (const emp of deptUsers) {
      createNotification(
        emp.id,
        'Department Meeting Scheduled',
        `${user.name} scheduled "${title}" (${platform}) on ${meetingDate} at ${meetingTime}.`,
        'Meeting',
        'meetings',
        meetingLink
      );
    }

    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  // --- HOLIDAYS ---
  app.get('/api/holidays', requireAuth, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT h.*, u.name as published_by_name
         FROM holidays h
         JOIN users u ON u.id = h.published_by
         ORDER BY h.holiday_date ASC`
      )
      .all() as Array<Record<string, unknown>>;

    res.json({
      holidays: rows.map((h) => ({
        id: Number(h.id),
        name: String(h.name),
        holidayDate: String(h.holiday_date),
        description: String(h.description ?? ''),
        publishedByName: String(h.published_by_name),
        createdAt: String(h.created_at),
      })),
    });
  });

  app.post('/api/holidays', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    if (user.role !== 'HR') {
      res.status(403).json({ error: 'Only HR can publish company holidays.' });
      return;
    }

    const name = String(req.body?.name ?? '').trim();
    const holidayDate = String(req.body?.holidayDate ?? '');
    const description = String(req.body?.description ?? '').trim();

    if (!name || !holidayDate) {
      res.status(400).json({ error: 'Holiday name and date are required.' });
      return;
    }

    const result = db
      .prepare(
        'INSERT INTO holidays (name, holiday_date, description, published_by, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .run(name, holidayDate, description, user.id, new Date().toISOString());

    const activeUsers = db
      .prepare("SELECT id FROM users WHERE status != 'Inactive' AND id != ?")
      .all(user.id) as Array<{ id: number }>;

    for (const u of activeUsers) {
      createNotification(
        u.id,
        'Company Holiday Published',
        `HR published "${name}" on ${holidayDate}.`,
        'Holiday',
        'holidays'
      );
    }

    res.status(201).json({ id: Number(result.lastInsertRowid) });
  });

  app.delete('/api/holidays/:id', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    if (user.role !== 'HR') {
      res.status(403).json({ error: 'Only HR can remove holidays.' });
      return;
    }
    db.prepare('DELETE FROM holidays WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  // --- NOTIFICATIONS ---
  app.get('/api/notifications', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    const rows = db
      .prepare(
        `SELECT * FROM notifications WHERE user_id = ? ORDER BY is_read ASC, created_at DESC, id DESC LIMIT 40`
      )
      .all(user.id) as Array<Record<string, unknown>>;

    res.json({
      notifications: rows.map((n) => ({
        id: Number(n.id),
        userId: Number(n.user_id),
        title: String(n.title),
        message: String(n.message),
        category: String(n.category),
        linkModule: String(n.link_module),
        actionUrl: n.action_url ? String(n.action_url) : null,
        isRead: Boolean(n.is_read),
        createdAt: String(n.created_at),
      })),
    });
  });

  app.post('/api/notifications/read-all', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(user.id);
    res.json({ ok: true });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req, res) => {
    const user = getCurrentUser(req);
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(
      Number(req.params.id),
      user.id
    );
    res.json({ ok: true });
  });

  // --- FILE ATTACHMENTS ---
  app.post('/api/upload', requireAuth, (req, res) => {
    const fileName = String(req.body?.fileName ?? 'attachment.bin').replace(/[^a-zA-Z0-9._-]/g, '_');
    const base64Data = String(req.body?.base64Data ?? '');

    if (!base64Data) {
      res.status(400).json({ error: 'File content is empty.' });
      return;
    }

    const cleanBase64 = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
    const buffer = Buffer.from(cleanBase64, 'base64');
    if (buffer.length > 5 * 1024 * 1024) {
      res.status(400).json({ error: 'File size exceeds 5 MB limit.' });
      return;
    }

    const storedName = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${fileName}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);

    res.status(201).json({
      attachmentName: fileName,
      attachmentUrl: `/api/uploads/${storedName}`,
    });
  });

  app.get('/api/uploads/:filename', (req, res) => {
    const safeName = path.basename(req.params.filename);
    const fullPath = path.join(UPLOAD_DIR, safeName);
    if (!fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Attachment not found.' });
      return;
    }
    res.sendFile(fullPath);
  });

  // Vite / static frontend
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`VEMS server listening on http://localhost:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start VEMS server:', err);
  process.exit(1);
});
