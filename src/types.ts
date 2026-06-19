export type UserRole = 'admin' | 'management' | 'reseller';

export type CoastArea = 'Mombasa' | 'Malindi' | 'Kilifi' | 'Kwale' | 'Lamu' | 'Tana River';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  area?: CoastArea;
  password?: string; // Standard bypass access password
}

export interface FundsRequest {
  id: string;
  recipientEmail: string;
  recipientName: string;
  amount: number;
  purpose: string;
  biweeklyPeriod: string; // e.g., "2026-W25-Biweekly"
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  signedReceipt: boolean;
  signedAt?: string;
  receiptDriveFileId?: string;
}

export interface KpiTarget {
  id: string;
  resellerId: string;
  resellerName: string;
  kpiName: string; // e.g., "Active Lead Connections", "Revenue Collected"
  targetValue: number;
  currentValue: number;
  period: string; // e.g. "June 2026"
}

export interface WeeklyPlan {
  id: string;
  resellerId: string;
  weekStartDate: string; // e.g., "2026-06-15"
  objective: string;
  tasks: string; // stringified array or lines
}

export interface StatusReport {
  id: string;
  resellerId: string;
  weekStartDate: string;
  achievements: string;
  challenges: string;
  status: 'draft' | 'pending_review' | 'reviewed';
  submittedAt: string;
  feedback?: string;
}

export interface LeadCollection {
  id: string;
  resellerId: string;
  resellerName: string;
  clientName: string;
  location: string; // specific ward or area, e.g. "Mombasa Old Town"
  institution: string; // e.g., "School", "Hotel", "Residential"
  contactNumber: string;
  revenueCollected: number;
  dateAdded: string; // ISO Date
}

export interface FinanceRecord {
  id: string;
  resellerId: string;
  resellerName: string;
  type: 'biweekly_support' | 'monthly_commission';
  amount: number;
  period: string; // e.g., "June 2026 - Biweekly 1", "June 2026 Commission"
  status: 'paid' | 'pending';
  date: string;
}
