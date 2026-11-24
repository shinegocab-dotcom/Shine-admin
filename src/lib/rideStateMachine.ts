import { RideStatus } from '../types/domain';

export const RIDE_LIFECYCLE_STEPS: RideStatus[] = [
  'requested',
  'searching_driver',
  'driver_assigned',
  'driver_arrived',
  'otp_verified',
  'ride_started',
  'ride_completed',
  'payment_completed',
];

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

export const RIDE_STATUS_LABELS: Record<RideStatus, string> = {
  requested: 'Requested',
  searching_driver: 'Searching Driver',
  driver_assigned: 'Driver Assigned',
  driver_arrived: 'Driver Arrived',
  otp_verified: 'OTP Verified',
  ride_started: 'Ride Started',
  ride_completed: 'Ride Completed',
  payment_completed: 'Payment Completed',
  cancelled_by_customer: 'Cancelled by Customer',
  cancelled_by_driver: 'Cancelled by Driver',
  cancelled_by_admin: 'Cancelled by Admin',
};

export function isValidRideTransition(from: RideStatus, to: RideStatus): boolean {
  return ALLOWED_RIDE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminalRideStatus(status: RideStatus): boolean {
  return (
    status === 'payment_completed' ||
    status === 'cancelled_by_customer' ||
    status === 'cancelled_by_driver' ||
    status === 'cancelled_by_admin'
  );
}
