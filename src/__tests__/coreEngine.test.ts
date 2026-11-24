import { describe, expect, it } from 'vitest';
import { calculateFareBreakdown } from '../lib/pricingEngine';
import {
  isTerminalRideStatus,
  isValidRideTransition,
  RIDE_LIFECYCLE_STEPS,
} from '../lib/rideStateMachine';
import { hasPermission, ROLE_MATRIX } from '../lib/rbac';
import { ADMIN_PAGES, ADMIN_SECTIONS } from '../config/pagesRegistry';
import {
  PaymentsAdapter,
  RideMatchingAdapter,
  SupabaseDatabaseAdapter,
} from '../services/adapters/integrationAdapters';

describe('SHINE CAB Fare & Commission Engine', () => {
  it('computes Bike ride breakdown with base, distance, time, waiting, surge, and commission', () => {
    const res = calculateFareBreakdown({
      config: {
        city: 'Bengaluru',
        vehicleCategory: 'bike',
        baseFare: 20,
        minimumFare: 30,
        perKmRate: 7,
        perMinuteRate: 1,
        waitingChargePerMin: 2,
        surgeMultiplier: 1.5,
        commissionPct: 15,
        cancellationFee: 15,
      },
      distanceKm: 6,
      durationMin: 18,
      waitingMin: 2,
    });

    // subtotalBeforeSurge = 20 + (6*7=42) + (18*1=18) + (2*2=4) = 84
    // surgedTotal = 84 * 1.5 = 126 >= min 30 => finalFare = 126
    // commissionAmount = 126 * 0.15 = 18.9 => driverPayoutAmount = 107.1
    expect(res.subtotalBeforeSurge).toBe(84);
    expect(res.finalFare).toBe(126);
    expect(res.minimumFareApplied).toBe(false);
    expect(res.commissionAmount).toBe(18.9);
    expect(res.driverPayoutAmount).toBe(107.1);
  });

  it('applies minimum fare floor when calculated fare is below minimumFare', () => {
    const res = calculateFareBreakdown({
      config: {
        city: 'Delhi',
        vehicleCategory: 'cab',
        baseFare: 40,
        minimumFare: 100,
        perKmRate: 14,
        perMinuteRate: 2,
        waitingChargePerMin: 3,
        surgeMultiplier: 1,
        commissionPct: 20,
        cancellationFee: 40,
      },
      distanceKm: 1,
      durationMin: 4,
      waitingMin: 0,
    });

    expect(res.subtotalBeforeSurge).toBe(62);
    expect(res.finalFare).toBe(100);
    expect(res.minimumFareApplied).toBe(true);
    expect(res.commissionAmount).toBe(20);
    expect(res.driverPayoutAmount).toBe(80);
  });

  it('rejects negative distance or out-of-range surge multipliers', () => {
    expect(() =>
      calculateFareBreakdown({
        config: {
          city: 'Mumbai',
          vehicleCategory: 'auto',
          baseFare: 30,
          minimumFare: 40,
          perKmRate: 10,
          perMinuteRate: 1.5,
          waitingChargePerMin: 2,
          surgeMultiplier: 1,
          commissionPct: 18,
          cancellationFee: 20,
        },
        distanceKm: -2,
        durationMin: 10,
        waitingMin: 0,
      })
    ).toThrow(/negative/i);

    expect(() =>
      calculateFareBreakdown({
        config: {
          city: 'Mumbai',
          vehicleCategory: 'auto',
          baseFare: 30,
          minimumFare: 40,
          perKmRate: 10,
          perMinuteRate: 1.5,
          waitingChargePerMin: 2,
          surgeMultiplier: 6.5,
          commissionPct: 18,
          cancellationFee: 20,
        },
        distanceKm: 5,
        durationMin: 10,
        waitingMin: 0,
      })
    ).toThrow(/surge/i);
  });
});

describe('SHINE CAB Ride Lifecycle State Machine', () => {
  it('supports the full 8-step lifecycle in exact order', () => {
    for (let i = 0; i < RIDE_LIFECYCLE_STEPS.length - 1; i++) {
      expect(isValidRideTransition(RIDE_LIFECYCLE_STEPS[i], RIDE_LIFECYCLE_STEPS[i + 1])).toBe(true);
    }
    expect(isTerminalRideStatus('payment_completed')).toBe(true);
    expect(isTerminalRideStatus('cancelled_by_admin')).toBe(true);
    expect(isTerminalRideStatus('ride_started')).toBe(false);
  });

  it('rejects skipping OTP verification or moving backward from terminal states', () => {
    expect(isValidRideTransition('driver_arrived', 'ride_started')).toBe(false);
    expect(isValidRideTransition('payment_completed', 'ride_completed')).toBe(false);
    expect(isValidRideTransition('cancelled_by_customer', 'driver_assigned')).toBe(false);
  });
});

describe('SHINE CAB 7-Role RBAC Matrix', () => {
  it('defines all 7 required roles', () => {
    expect(Object.keys(ROLE_MATRIX)).toEqual([
      'super_admin',
      'operations_admin',
      'kyc_admin',
      'finance_admin',
      'support_admin',
      'marketing_admin',
      'read_only_admin',
    ]);
  });

  it('restricts privileged modules per role', () => {
    expect(hasPermission('super_admin', 'security', 'admin')).toBe(true);
    expect(hasPermission('kyc_admin', 'drivers', 'approve')).toBe(true);
    expect(hasPermission('kyc_admin', 'pricing', 'write')).toBe(false);
    expect(hasPermission('finance_admin', 'finance', 'approve')).toBe(true);
    expect(hasPermission('finance_admin', 'rides', 'write')).toBe(false);
    expect(hasPermission('read_only_admin', 'dashboard', 'read')).toBe(true);
    expect(hasPermission('read_only_admin', 'customers', 'write')).toBe(false);
    expect(hasPermission('marketing_admin', 'marketing', 'write')).toBe(true);
  });
});

describe('Admin Registry Integrity', () => {
  it('registers 66 unique sequentially numbered pages across 9 sections', () => {
    expect(ADMIN_SECTIONS).toHaveLength(9);
    expect(ADMIN_PAGES).toHaveLength(66);
    const ids = new Set(ADMIN_PAGES.map((p) => p.id));
    expect(ids.size).toBe(66);
    ADMIN_PAGES.forEach((p, idx) => {
      expect(p.num).toBe(idx + 1);
    });
  });
});

describe('Modular Integration Adapters', () => {
  it('blocks marking online/UPI payments succeeded without gateway config and verified tx ID', () => {
    const adapter = new PaymentsAdapter();
    expect(adapter.isConfigured()).toBe(false);
    const check = adapter.verifyTransactionConfirmation({
      method: 'upi',
      amount: 250,
      providerTxId: 'upi_123456',
    });
    expect(check.verified).toBe(false);
    expect(check.reason).toMatch(/not configured/i);
  });

  it('prevents multiple drivers accepting the same ride via atomic conflict check', () => {
    const matcher = new RideMatchingAdapter();
    const conflict = matcher.validateTransition(
      'searching_driver',
      'driver_assigned',
      'drv_existing_1',
      'drv_other_2'
    );
    expect(conflict.allowed).toBe(false);
    expect(conflict.reason).toMatch(/conflict/i);
  });

  it('reports honest not_configured mode when Supabase env vars are absent', () => {
    const supa = new SupabaseDatabaseAdapter();
    expect(supa.getHealth().mode).toBe('not_configured');
  });
});
