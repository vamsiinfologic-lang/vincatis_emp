export enum UserRole {
  HR = 'HR',
  DEPARTMENT_HEAD = 'Department Head',
  TEAM_LEAD = 'Team Lead',
  EMPLOYEE = 'Employee',
}

export enum EmployeeStatus {
  ACTIVE = 'Active',
  INACTIVE = 'Inactive',
  ON_LEAVE = 'On Leave',
}

export enum AttendanceStatus {
  PRESENT = 'Present',
  LATE = 'Late',
}

export enum LeaveType {
  ANNUAL = 'Annual',
  SICK = 'Sick',
  PERSONAL = 'Personal',
  UNPAID = 'Unpaid',
}

export enum LeaveStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export enum TaskWorkflowState {
  ASSIGNED = 'assigned',
  ACCEPTED = 'accepted',
  IN_PROGRESS = 'in_progress',
  SUBMITTED = 'submitted',
  REWORK_REQUESTED = 'rework_requested',
  COMPLETED = 'completed',
}

export enum TaskFilterBucket {
  ALL = 'All',
  PENDING = 'Pending',
  ONGOING = 'Ongoing',
  FINISHED = 'Finished',
}

export interface UserProfile {
  id: number;
  employeeCode: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: number | null;
  departmentName: string | null;
  designation: string;
  phone: string;
  joiningDate: string;
  status: EmployeeStatus;
}

export interface Department {
  id: number;
  name: string;
  headId: number | null;
  headName: string | null;
  annualBudget: number;
  employeeCount: number;
  createdAt: string;
}

export interface AttendanceRecord {
  id: number;
  userId: number;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  date: string;
  clockIn: string;
  clockOut: string | null;
  breakStartedAt: string | null;
  breakMinutes: number;
  status: AttendanceStatus;
}

export interface LeaveRequest {
  id: number;
  userId: number;
  employeeName: string;
  employeeCode: string;
  departmentName: string | null;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: LeaveStatus;
  reviewedByName: string | null;
  reviewNote: string | null;
  createdAt: string;
}

export interface Project {
  id: number;
  name: string;
  departmentId: number;
  departmentName: string;
  description: string;
  createdByName: string;
  createdAt: string;
}

export interface TaskComment {
  id: number;
  taskId: number;
  userId: number;
  authorName: string;
  authorRole: string;
  message: string;
  createdAt: string;
}

export interface TaskAssignment {
  id: number;
  projectId: number;
  projectName: string;
  departmentId: number;
  departmentName: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string;
  assignedById: number;
  assignedByName: string;
  assigneeId: number;
  assigneeName: string;
  assigneeCode: string;
  assigneeDesignation: string;
  state: TaskWorkflowState;
  bucket: 'Pending' | 'Ongoing' | 'Finished';
  progressPercent: number;
  submissionNotes: string | null;
  submissionLink: string | null;
  attachmentName: string | null;
  attachmentUrl: string | null;
  reworkFeedback: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  comments: TaskComment[];
}

export interface DepartmentMeeting {
  id: number;
  departmentId: number;
  departmentName: string;
  title: string;
  platform: string;
  meetingLink: string;
  meetingDate: string;
  meetingTime: string;
  durationMinutes: number;
  description: string;
  scheduledByName: string;
  createdAt: string;
}

export interface CompanyHoliday {
  id: number;
  name: string;
  holidayDate: string;
  description: string;
  publishedByName: string;
  createdAt: string;
}

export interface AppNotification {
  id: number;
  userId: number;
  title: string;
  message: string;
  category: string;
  linkModule: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export interface EmployeePerformanceSummary {
  employee: UserProfile;
  tasksTotal: number;
  tasksPending: number;
  tasksOngoing: number;
  tasksFinished: number;
  reworkCount: number;
  avgCompletion: number;
  attendanceDays: number;
  presentDays: number;
  lateDays: number;
  leaveRequestsTotal: number;
  approvedLeaveDays: number;
}
