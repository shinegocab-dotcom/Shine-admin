// Supabase Edge Function Contract: Atomic Ride Lifecycle & Fare Snapshot Preservation
// Deploy with: supabase functions deploy ride-lifecycle

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

export const ALLOWED_RIDE_TRANSITIONS: Record<RideStatus, RideStatus[]> = {
  requested: ['searching_driver', 'driver_assigned', 'cancelled_by_customer', 'cancelled_by_admin'],
  searching_driver: ['driver_assigned', 'cancelled_by_customer', 'cancelled_by_admin'],
  driver_assigned: ['driver_arrived', 'cancelled_by_customer', 'cancelled_by_driver', 'cancelled_by_admin'],
  driver_arrived: ['otp_verified', 'cancelled_by_customer', 'cancelled_by_driver', 'cancelled_by_admin'],
  otp_verified: ['ride_started', 'cancelled_by_customer', 'cancelled_by_driver', 'cancelled_by_admin'],
  ride_started: ['ride_completed', 'cancelled_by_admin'],
  ride_completed: ['payment_completed'],
  payment_completed: [],
  cancelled_by_customer: [],
  cancelled_by_driver: [],
  cancelled_by_admin: [],
};

export function canTransitionRide(from: RideStatus, to: RideStatus): boolean {
  return ALLOWED_RIDE_TRANSITIONS[from]?.includes(to) ?? false;
}
