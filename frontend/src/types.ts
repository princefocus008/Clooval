/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = "student" | "admin";

export interface User {
  id: string;
  name: string;
  email: string;
  studentId: string; // e.g. ALU Student ID (auto-generated now)
  role: UserRole;
  phone?: string;          // WhatsApp phone number
  nationality?: string;    // Optional nationality/country
  programmeOfStudy?: string; // Optional programme of study
  resident?: "Maps" | "Songhai" | "Aksum"; // Resident location dropdown
  notificationEmail?: boolean;
  notificationSMS?: boolean;
  notificationInApp?: boolean;
  isVerified?: boolean;
}

export type RequestCategory = "phone" | "laptop" | "clothing" | "shoe" | "accessories" | "other";

export type RequestStatus =
  | "submitted"
  | "under_review"
  | "quote_sent"
  | "confirmed"
  | "with_provider"
  | "ready_for_collection"
  | "completed"
  | "cancelled";

export type PriorityLevel = "low" | "normal" | "high" | "urgent";

export interface Request {
  id: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone?: string;
  category: RequestCategory;
  brand?: string;
  model?: string;
  accessoryType?: string;
  issues: string[];
  customIssue?: string;
  description: string;
  photos: string[]; // Base64 data strings for mock instant uploads or URLs
  priority: PriorityLevel;
  additionalNotes?: string;
  status: RequestStatus;
  providerCost?: number; // MUR
  serviceCharge?: number; // MUR
  totalCost?: number; // MUR
  isQuoteAccepted?: boolean;
  depositPaid?: boolean;
  finalPaid?: boolean;
  readyNotes?: string; // drop point info
  operatorNotes?: string; // Operator's message to student
  internalNotes?: string; // Private admin-only notes
  providerId?: string; // Assigned provider ID
  providerTranslation?: string; // French/Creole description for the provider
  cancelReason?: string; // Student custom or preset reason for cancellation
  createdAt: string;
}

export interface Provider {
  id: string;
  name: string;
  phone: string;
  specialty: RequestCategory[];
  notes?: string;
  rating: number; // 1-5
  requestCount?: number;
}

export interface Notification {
  id: string;
  studentId: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  requestId?: string;
  amount?: number;
}

export interface SupportMessage {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  category: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  details: string;
  createdAt: string;
  requestId?: string;
}
