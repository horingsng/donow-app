// types.ts

import { Timestamp } from 'firebase/firestore';

export type TaskTimeType = 'immediate' | 'scheduled';
export type TaskStatus = 'draft' | 'open' | 'accepted' | 'in_progress' | 'pending_confirmation' | 'completed' | 'cancelled' | 'disputed' | 'expired';
export type TaskCategory = 'grocery' | 'queueing' | 'delivery' | 'pickup' | 'instant_help' | 'ride_share' | 'home_cleaning' | 'meal_companion' | 'event_companion' | 'other';

export interface UserProfile {
  uid: string;
  name: string;
  photoUrl?: string;
  phoneNumber?: string;
  email?: string;
  rating?: number;
  ratingCount?: number;
  completedCount?: number;
  cancelCount?: number;
  isVerified?: boolean;
  idVerificationStatus?: 'unverified' | 'pending' | 'verified' | 'rejected';
  idVerifiedAt?: Timestamp;
  verifiedAge?: number;
  idDocumentNumber?: string; // Encrypted
  riskAcknowledged?: boolean;
  consentSigned?: boolean;
  consentVersion?: string;
  consentSignedAt?: Timestamp;
  walletAvailable: number;
  walletHeld: number;
  walletWithdrawable: number;
  earnedTotal?: number;
  reimbursedTotal?: number;
  isOnlineForPush?: boolean;
  currentLat?: number;
  currentLng?: number;
  pushRadiusKm?: number;
  lastLocationUpdatedAt?: Timestamp;
  lastOnlineAt?: Timestamp;
  preferredCategories?: TaskCategory[];
  notificationPreferences?: any;
  fcmToken?: string;
  stripeCustomerId?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Task {
  taskId: string;
  posterUid: string;
  workerUid?: string;
  title: string;
  description: string;
  category: TaskCategory;
  taskTimeType: TaskTimeType;
  urgencyLevel?: 'normal' | 'urgent' | 'emergency';
  rewardAmount: number;
  posterFee: number;
  workerFee?: number;
  posterPayTotal: number;
  purchaseRequired: boolean;
  estimatedPurchaseAmount?: number;
  actualPurchaseAmount?: number;
  purchaseBudgetHeld?: number;
  district: string;
  subArea?: string;
  lat: number;
  lng: number;
  building?: string;
  detailedAddress?: string;
  images?: string[];
  receiptImages?: string[];
  status: TaskStatus;
  scheduledStartAt?: Timestamp;
  scheduledEndAt?: Timestamp;
  cancellationPolicy?: 'flexible' | 'moderate' | 'strict';
  estimatedDuration?: number; // minutes
  viewCount?: number;
  applicationCount?: number;
  createdAt: Timestamp;
  acceptedAt?: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
  expiredAt?: Timestamp;
  platformRevenue?: number;
}

export interface ChatRoom {
  chatId: string;
  taskId: string;
  posterUid: string;
  workerUid: string;
  participants: string[];
  lastMessage?: string;
  lastMessageType?: 'text' | 'image' | 'system';
  lastSenderUid?: string;
  unreadCountPoster?: number;
  unreadCountWorker?: number;
  updatedAt: Timestamp;
  createdAt: Timestamp;
}

export interface ChatMessage {
  messageId: string;
  chatId: string;
  senderUid: string;
  type: 'text' | 'image' | 'system';
  text?: string;
  imageUrl?: string;
  metadata?: any;
  createdAt: Timestamp;
}

export type TransactionType = 'top_up' | 'task_payment_hold' | 'task_payment_release' | 'poster_platform_fee' | 'worker_platform_fee' | 'purchase_budget_hold' | 'purchase_reimbursement' | 'purchase_refund' | 'withdraw_request' | 'withdraw_complete' | 'refund' | 'adjustment' | 'task_payment_refund';
export type TransactionDirection = 'in' | 'out';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface WalletTransaction {
  transactionId: string;
  uid: string;
  taskId?: string;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  status: TransactionStatus;
  title: string;
  description?: string;
  metadata?: any;
  createdAt: Timestamp;
}

export interface TopUp {
  topupId: string;
  uid: string;
  amount: number;
  paymentIntentId: string;
  stripePaymentMethod?: string;
  status: TransactionStatus;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export type WithdrawalMethod = 'FPS' | 'BankTransfer';

export interface Withdrawal {
  withdrawRequestId: string;
  uid: string;
  amount: number;
  method: WithdrawalMethod;
  accountInfo: string;
  accountNumber?: string;
  accountName?: string;
  bankCode?: string;
  status: TransactionStatus;
  processedBy?: string;
  processorNote?: string;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}

export interface Review {
  reviewId: string;
  taskId: string;
  fromUid: string;
  toUid: string;
  role: 'poster' | 'worker';
  rating: number; // 1-5 stars
  comment?: string;
  categories?: string[];
  createdAt: Timestamp;
}

export type ReportTargetType = 'task' | 'user' | 'chat' | 'message';

export interface Report {
  reportId: string;
  reporterUid: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
  description?: string;
  evidenceImages?: string[];
  status: 'pending' | 'in_review' | 'resolved' | 'rejected';
  assignedTo?: string;
  resolvedAt?: Timestamp;
  resolution?: string;
  createdAt: Timestamp;
}

export interface IdVerification {
  verificationId: string;
  uid: string;
  idCardFrontUrl: string;
  idCardBackUrl: string;
  selfieUrl: string;
  ocrName?: string;
  ocrIdNumber?: string; // Encrypted
  ocrBirthDate?: string;
  verifiedAge?: number;
  faceMatchScore?: number;
  faceMatchResult?: any; // Details from face match API
  status: 'unverified' | 'pending' | 'verified' | 'rejected';
  submittedAt: Timestamp;
  processedAt?: Timestamp;
  processedBy?: string; // Admin UID
  rejectionReason?: string;
  riskFlags?: string[];
}

export interface ConsentTerms {
  consentId: string; // e.g., 'risk_acknowledgment_v1'
  version: string;
  title: string;
  content: string;
  effectiveDate: Timestamp;
  isMandatory: boolean;
  acknowledgmentRequired: boolean;
}

export interface UserLocation {
  uid: string;
  lat: number;
  lng: number;
  geohash: string;
  isOnline: boolean;
  updatedAt: Timestamp;
}

export interface NotificationLog {
  notificationId: string;
  uid: string;
  type: string; // e.g., 'task_accepted', 'new_message', 'task_expired'
  title: string;
  body: string;
  data?: any; // Extra data for navigation, etc.
  sentAt: Timestamp;
  deliveredAt?: Timestamp;
  readAt?: Timestamp;
}
