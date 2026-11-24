export type VehicleCategory = 'bike' | 'auto' | 'cab';

export type RideStatus =
  | 'requested'
  | 'searching_driver'
  | 'driver_assigned'
  | 'driver_arrived'
  | 'otp_verified'
  | 'ride_started'
  | 'ride_completed'
  | 'payment_completed'
  | 'cancelled_by_customer'
  | 'cancelled_by_driver'
  | 'cancelled_by_admin';

export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export type AdminRoleId =
  | 'super_admin'
  | 'operations_admin'
  | 'kyc_admin'
  | 'finance_admin'
  | 'support_admin'
  | 'marketing_admin'
  | 'read_only_admin';

export interface Profile {
  id: string;
  uid: string;
  fullName: string;
  email?: string;
  phone?: string;
  userType: 'customer' | 'driver' | 'admin';
  city?: string;
  status: 'active' | 'suspended' | 'blocked' | 'pending';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Customer {
  id: string;
  profileId: string;
  fullName: string;
  phone: string;
  email?: string;
  city: string;
  kycStatus: VerificationStatus;
  walletBalance: number;
  totalRides: number;
  rating?: number;
  isBlocked: boolean;
  blockReason?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Driver {
  id: string;
  profileId: string;
  fullName: string;
  phone: string;
  city: string;
  vehicleCategory: VehicleCategory;
  applicationStatus: 'pending' | 'under_review' | 'approved' | 'rejected';
  kycStatus: VerificationStatus;
  dlStatus?: VerificationStatus;
  rcStatus?: VerificationStatus;
  insuranceStatus?: VerificationStatus;
  isOnline: boolean;
  isBlocked: boolean;
  blockReason?: string;
  rating?: number;
  totalRides?: number;
  walletBalance?: number;
  totalEarnings?: number;
  commissionPct?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Vehicle {
  id: string;
  driverId: string;
  category: VehicleCategory;
  make: string;
  model: string;
  plateNumber: string;
  city: string;
  rcStatus?: VerificationStatus;
  insuranceStatus?: VerificationStatus;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DriverDocument {
  id: string;
  driverId: string;
  docType: 'kyc_aadhaar_pan' | 'driving_licence' | 'vehicle_rc' | 'vehicle_insurance';
  docNumber: string;
  status: VerificationStatus;
  expiryDate?: string;
  rejectionReason?: string;
  verifiedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Ride {
  id: string;
  customerId: string;
  driverId?: string;
  vehicleCategory: VehicleCategory;
  city: string;
  status: RideStatus;
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  dropAddress: string;
  dropLat?: number;
  dropLng?: number;
  distanceKm?: number;
  durationMin?: number;
  otpCode?: string;
  finalFare: number;
  commissionAmount?: number;
  driverPayoutAmount?: number;
  paymentMethod: 'cash' | 'upi' | 'online' | 'wallet';
  paymentStatus: 'pending' | 'verified' | 'failed' | 'refunded';
  cancellationReason?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RideEvent {
  id: string;
  rideId: string;
  fromStatus?: string;
  toStatus: string;
  actorUid: string;
  note?: string;
  createdAt?: unknown;
}

export interface DriverLocation {
  id: string;
  driverId: string;
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
  isAuthorized: boolean;
  isOnline: boolean;
  activeRideId?: string;
  updatedAt?: unknown;
}

export interface FareConfig {
  id: string;
  city: string;
  vehicleCategory: VehicleCategory;
  baseFare: number;
  minimumFare: number;
  perKmRate: number;
  perMinuteRate: number;
  waitingChargePerMin: number;
  surgeMultiplier: number;
  cancellationFee: number;
  commissionPct: number;
  effectiveFrom?: string;
  isActive: boolean;
  updatedBy?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Payment {
  id: string;
  rideId: string;
  customerId: string;
  amount: number;
  method: 'cash' | 'upi' | 'online' | 'wallet';
  status: 'pending' | 'succeeded' | 'failed' | 'refunded';
  provider?: string;
  providerTxId?: string;
  verifiedByProvider: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface WalletTransaction {
  id: string;
  ownerId: string;
  ownerType: 'customer' | 'driver';
  amount: number;
  direction: 'credit' | 'debit';
  reason: string;
  referenceId?: string;
  createdBy?: string;
  createdAt?: unknown;
}

export interface Payout {
  id: string;
  driverId: string;
  amount: number;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'rejected';
  bankAccountMask: string;
  ifscCode?: string;
  providerPayoutId?: string;
  verifiedByProvider: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Coupon {
  id: string;
  code: string;
  title: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  maxDiscount?: number;
  minFare?: number;
  vehicleCategory: 'all' | VehicleCategory;
  city?: string;
  usageLimit?: number;
  usedCount?: number;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SupportTicket {
  id: string;
  userId: string;
  userType: 'customer' | 'driver';
  rideId?: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'resolved' | 'escalated';
  subject: string;
  description: string;
  isSos: boolean;
  resolutionNote?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface NotificationRecord {
  id: string;
  targetAudience: 'customers' | 'drivers' | 'all';
  title: string;
  body: string;
  channel: 'push' | 'in_app' | 'sms';
  campaignName?: string;
  status: 'draft' | 'queued' | 'dispatched' | 'provider_not_configured';
  sentBy?: string;
  createdAt?: unknown;
}

export interface ServiceZone {
  id: string;
  city: string;
  zoneName: string;
  state: string;
  isActive: boolean;
  bikeEnabled: boolean;
  autoEnabled: boolean;
  cabEnabled: boolean;
  centerLat?: number;
  centerLng?: number;
  radiusKm?: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminUser {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  roleId: AdminRoleId;
  isActive: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface RoleDefinition {
  id: string;
  name: AdminRoleId;
  label: string;
  description?: string;
  permissions: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  summary?: string;
  createdAt?: unknown;
}

export interface SystemSetting {
  id: string;
  key: string;
  value: string;
  category: string;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface AdapterHealth {
  name: string;
  configured: boolean;
  mode: string;
  details: string;
}

export interface IntegrationStatusSummary {
  firebase: AdapterHealth;
  supabase: AdapterHealth;
  googleMaps: AdapterHealth;
  payments: AdapterHealth;
  notifications: AdapterHealth;
  liveLocation: AdapterHealth;
  storage: AdapterHealth;
}
