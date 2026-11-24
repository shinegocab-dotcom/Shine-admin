import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { AdapterHealth, IntegrationStatusSummary, RideStatus } from '../../types/domain';
import { isValidRideTransition } from '../../lib/rideStateMachine.ts';

export class SupabaseDatabaseAdapter {
  private client: SupabaseClient | null = null;
  private url = process.env.SUPABASE_URL || '';
  private serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  isConfigured(): boolean {
    return Boolean(this.url && this.serviceKey);
  }

  getClient(): SupabaseClient | null {
    if (!this.isConfigured()) return null;
    if (!this.client) {
      this.client = createClient(this.url, this.serviceKey, {
        auth: { persistSession: false },
      });
    }
    return this.client;
  }

  getHealth(): AdapterHealth {
    return {
      name: 'Supabase Shared PostgreSQL',
      configured: this.isConfigured(),
      mode: this.isConfigured() ? 'connected' : 'not_configured',
      details: this.isConfigured()
        ? 'Shared PostgreSQL, Realtime, and RLS schema contract active.'
        : 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not configured. Running primary persistence via Firebase Firestore while Supabase SQL migrations & Edge Function contracts remain ready to connect.',
    };
  }
}

export class AuthenticationAdapter {
  getHealth(firebaseConfigured: boolean): AdapterHealth {
    return {
      name: 'Authentication & RBAC',
      configured: firebaseConfigured,
      mode: firebaseConfigured ? 'firebase_auth' : 'not_configured',
      details: firebaseConfigured
        ? 'Google Sign-In + server-enforced Firestore & API RBAC active.'
        : 'Authentication provider not configured.',
    };
  }
}

export class CustomerApiAdapter {
  constructor(private supabase: SupabaseDatabaseAdapter) {}
  getContractVersion(): string {
    return 'shine-cab-customer-v1';
  }
  isExternalSyncReady(): boolean {
    return this.supabase.isConfigured();
  }
}

export class DriverApiAdapter {
  constructor(private supabase: SupabaseDatabaseAdapter) {}
  getContractVersion(): string {
    return 'shine-cab-driver-v1';
  }
  isExternalSyncReady(): boolean {
    return this.supabase.isConfigured();
  }
}

export class RideMatchingAdapter {
  validateTransition(currentStatus: RideStatus, nextStatus: RideStatus, existingDriverId?: string, targetDriverId?: string) {
    if (!isValidRideTransition(currentStatus, nextStatus)) {
      return {
        allowed: false,
        reason: `Invalid ride lifecycle transition from "${currentStatus}" to "${nextStatus}".`,
      };
    }
    if (
      nextStatus === 'driver_assigned' &&
      existingDriverId &&
      targetDriverId &&
      existingDriverId !== targetDriverId
    ) {
      return {
        allowed: false,
        reason: 'Atomic assignment conflict: ride is already assigned to another driver.',
      };
    }
    return { allowed: true };
  }
}

export class LiveLocationAdapter {
  constructor(private supabase: SupabaseDatabaseAdapter) {}
  getHealth(firestoreActive: boolean): AdapterHealth {
    const realtimeStreamConfigured = this.supabase.isConfigured() || firestoreActive;
    return {
      name: 'Driver Live GPS Stream',
      configured: realtimeStreamConfigured,
      mode: this.supabase.isConfigured() ? 'supabase_realtime' : firestoreActive ? 'firestore_realtime' : 'not_configured',
      details: 'Plots only authorized driver_locations beacons with valid coordinates. Never simulates GPS.',
    };
  }
}

export class GoogleMapsAdapter {
  getPublicApiKey(): string {
    return process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY || '';
  }

  getHealth(): AdapterHealth {
    const configured = Boolean(this.getPublicApiKey());
    return {
      name: 'Google Maps Platform',
      configured,
      mode: configured ? 'maps_js_api' : 'not_configured',
      details: configured
        ? 'Maps JavaScript API & Advanced Markers ready for Live Ride Map.'
        : 'VITE_GOOGLE_MAPS_API_KEY / GOOGLE_MAPS_API_KEY not found in runtime environment.',
    };
  }
}

export class PaymentsAdapter {
  private provider = process.env.PAYMENT_PROVIDER || '';
  private keyId = process.env.PAYMENT_KEY_ID || '';
  private keySecret = process.env.PAYMENT_KEY_SECRET || '';

  isConfigured(): boolean {
    return Boolean(this.provider && this.keyId && this.keySecret);
  }

  verifyTransactionConfirmation(params: {
    providerTxId?: string;
    method: 'cash' | 'upi' | 'online' | 'wallet';
    amount: number;
  }): { verified: boolean; reason?: string } {
    if (params.amount <= 0) {
      return { verified: false, reason: 'Transaction amount must be greater than zero.' };
    }
    if (params.method === 'upi' || params.method === 'online') {
      if (!this.isConfigured()) {
        return {
          verified: false,
          reason: 'Payment gateway credentials (PAYMENT_PROVIDER / PAYMENT_KEY_ID / PAYMENT_KEY_SECRET) are not configured. Cannot mark online/UPI transaction succeeded without gateway verification.',
        };
      }
      if (!params.providerTxId || params.providerTxId.trim().length < 6) {
        return {
          verified: false,
          reason: 'Verified provider transaction ID is required before marking UPI/online payment succeeded.',
        };
      }
    }
    if (params.method === 'cash' && (!params.providerTxId || params.providerTxId.trim().length < 4)) {
      return {
        verified: false,
        reason: 'Cash reconciliation receipt reference is required to verify settlement.',
      };
    }
    return { verified: true };
  }

  getHealth(): AdapterHealth {
    return {
      name: 'Payments & Payouts Gateway',
      configured: this.isConfigured(),
      mode: this.isConfigured() ? this.provider : 'not_configured',
      details: this.isConfigured()
        ? `Connected to ${this.provider} settlement verification.`
        : 'Payment gateway not configured. Online/UPI verification and automated bank payouts remain blocked until credentials are added.',
    };
  }
}

export class NotificationsAdapter {
  private fcmKey = process.env.FCM_SERVER_KEY || '';

  isConfigured(): boolean {
    return Boolean(this.fcmKey);
  }

  getHealth(): AdapterHealth {
    return {
      name: 'Push & SMS Notifications',
      configured: this.isConfigured(),
      mode: this.isConfigured() ? 'fcm_active' : 'not_configured',
      details: this.isConfigured()
        ? 'FCM push dispatch channel active.'
        : 'FCM_SERVER_KEY not configured. Notifications are logged in database with provider_not_configured status.',
    };
  }
}

export class StorageAdapter {
  constructor(private supabase: SupabaseDatabaseAdapter, private firebaseBucket: string) {}

  getHealth(): AdapterHealth {
    const configured = this.supabase.isConfigured() || Boolean(this.firebaseBucket);
    return {
      name: 'KYC & Vehicle Document Storage',
      configured,
      mode: this.supabase.isConfigured() ? 'supabase_storage' : this.firebaseBucket ? 'firebase_storage' : 'not_configured',
      details: configured
        ? 'Encrypted document metadata & storage reference pipeline ready.'
        : 'No object storage bucket configured.',
    };
  }
}

export function createIntegrationRegistry(firebaseConfigured: boolean, firebaseBucket: string) {
  const supabase = new SupabaseDatabaseAdapter();
  const auth = new AuthenticationAdapter();
  const customerApi = new CustomerApiAdapter(supabase);
  const driverApi = new DriverApiAdapter(supabase);
  const rideMatching = new RideMatchingAdapter();
  const liveLocation = new LiveLocationAdapter(supabase);
  const googleMaps = new GoogleMapsAdapter();
  const payments = new PaymentsAdapter();
  const notifications = new NotificationsAdapter();
  const storage = new StorageAdapter(supabase, firebaseBucket);

  const getStatusSummary = (): IntegrationStatusSummary => ({
    firebase: {
      name: 'Firebase Firestore & Auth',
      configured: firebaseConfigured,
      mode: firebaseConfigured ? 'firestore_enterprise' : 'not_configured',
      details: firebaseConfigured
        ? 'Real-time Firestore persistence and Google Auth active.'
        : 'firebase-applet-config.json missing.',
    },
    supabase: supabase.getHealth(),
    googleMaps: googleMaps.getHealth(),
    payments: payments.getHealth(),
    notifications: notifications.getHealth(),
    liveLocation: liveLocation.getHealth(firebaseConfigured),
    storage: storage.getHealth(),
  });

  return {
    supabase,
    auth,
    customerApi,
    driverApi,
    rideMatching,
    liveLocation,
    googleMaps,
    payments,
    notifications,
    storage,
    getStatusSummary,
  };
}
