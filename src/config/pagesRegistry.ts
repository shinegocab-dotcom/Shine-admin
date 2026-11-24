export type AdminSectionId =
  | 'dashboard'
  | 'customers'
  | 'drivers'
  | 'rides'
  | 'vehicles'
  | 'pricing'
  | 'finance'
  | 'marketing'
  | 'support_security';

export interface AdminPageMeta {
  num: number;
  id: string;
  section: AdminSectionId;
  sectionLabel: string;
  title: string;
  subtitle: string;
}

export const ADMIN_SECTIONS: { id: AdminSectionId; label: string }[] = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'customers', label: 'Customers' },
  { id: 'drivers', label: 'Drivers' },
  { id: 'rides', label: 'Rides' },
  { id: 'vehicles', label: 'Vehicles' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'finance', label: 'Finance' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'support_security', label: 'Support & Security' },
];

export const ADMIN_PAGES: AdminPageMeta[] = [
  // DASHBOARD (1-7)
  { num: 1, id: 'dashboard/main', section: 'dashboard', sectionLabel: 'Dashboard', title: 'Main Dashboard', subtitle: 'Executive operations overview across Customer App, Driver App, and live fleet' },
  { num: 2, id: 'dashboard/live-monitoring', section: 'dashboard', sectionLabel: 'Dashboard', title: 'Live Ride Monitoring', subtitle: 'Real-time dispatch pipeline from requested to payment completed' },
  { num: 3, id: 'dashboard/customer-analytics', section: 'dashboard', sectionLabel: 'Dashboard', title: 'Customer Analytics', subtitle: 'Customer acquisition, verification rates, and retention cohorts' },
  { num: 4, id: 'dashboard/driver-analytics', section: 'dashboard', sectionLabel: 'Dashboard', title: 'Driver Analytics', subtitle: 'Driver availability, category mix, and verification funnel' },
  { num: 5, id: 'dashboard/revenue-analytics', section: 'dashboard', sectionLabel: 'Dashboard', title: 'Revenue Analytics', subtitle: 'Gross booking value, payment methods, and completed ride revenue' },
  { num: 6, id: 'dashboard/commission-analytics', section: 'dashboard', sectionLabel: 'Dashboard', title: 'Commission Analytics', subtitle: 'Platform commission take-rate across Bike, Auto, and Cab segments' },
  { num: 7, id: 'dashboard/city-performance', section: 'dashboard', sectionLabel: 'Dashboard', title: 'City Performance', subtitle: 'City-by-city supply, ride volume, and service zone coverage' },

  // CUSTOMERS (8-15)
  { num: 8, id: 'customers/all', section: 'customers', sectionLabel: 'Customers', title: 'All Customers', subtitle: 'Search, filter, register, and manage SHINE CAB customer accounts' },
  { num: 9, id: 'customers/details', section: 'customers', sectionLabel: 'Customers', title: 'Customer Details', subtitle: 'Full customer profile, wallet ledger, rides, and account controls' },
  { num: 10, id: 'customers/verification', section: 'customers', sectionLabel: 'Customers', title: 'Customer Verification', subtitle: 'Verify or reject customer identity verification records' },
  { num: 11, id: 'customers/ride-history', section: 'customers', sectionLabel: 'Customers', title: 'Customer Ride History', subtitle: 'Inspect ride history and fare snapshots per customer' },
  { num: 12, id: 'customers/wallet', section: 'customers', sectionLabel: 'Customers', title: 'Customer Wallet', subtitle: 'Manage customer wallet balances and credit/debit ledger entries' },
  { num: 13, id: 'customers/payments', section: 'customers', sectionLabel: 'Customers', title: 'Customer Payments', subtitle: 'Review UPI, online, wallet, and cash payments by customer' },
  { num: 14, id: 'customers/complaints', section: 'customers', sectionLabel: 'Customers', title: 'Customer Complaints', subtitle: 'Track and resolve customer ride complaints and disputes' },
  { num: 15, id: 'customers/block-unblock', section: 'customers', sectionLabel: 'Customers', title: 'Block/Unblock Customers', subtitle: 'Suspend or reinstate customer booking privileges with audit trail' },

  // DRIVERS (16-25)
  { num: 16, id: 'drivers/all', section: 'drivers', sectionLabel: 'Drivers', title: 'All Drivers', subtitle: 'Master fleet directory across Bike, Auto, and Cab partners' },
  { num: 17, id: 'drivers/applications', section: 'drivers', sectionLabel: 'Drivers', title: 'New Applications', subtitle: 'Incoming driver partner registrations awaiting review' },
  { num: 18, id: 'drivers/details', section: 'drivers', sectionLabel: 'Drivers', title: 'Driver Details', subtitle: 'Comprehensive driver profile, vehicle, documents, and earnings' },
  { num: 19, id: 'drivers/kyc', section: 'drivers', sectionLabel: 'Drivers', title: 'KYC Verification', subtitle: 'Aadhaar and PAN identity verification queue' },
  { num: 20, id: 'drivers/dl-verification', section: 'drivers', sectionLabel: 'Drivers', title: 'Driving Licence Verification', subtitle: 'Verify commercial and two-wheeler driving licences' },
  { num: 21, id: 'drivers/rc-verification', section: 'drivers', sectionLabel: 'Drivers', title: 'RC Verification', subtitle: 'Registration Certificate checks for Bike, Auto, and Cab vehicles' },
  { num: 22, id: 'drivers/insurance-verification', section: 'drivers', sectionLabel: 'Drivers', title: 'Insurance Verification', subtitle: 'Verify active motor insurance policies and expiry dates' },
  { num: 23, id: 'drivers/approve-reject', section: 'drivers', sectionLabel: 'Drivers', title: 'Approve/Reject Drivers', subtitle: 'Final onboarding approval and ride eligibility authorization' },
  { num: 24, id: 'drivers/earnings', section: 'drivers', sectionLabel: 'Drivers', title: 'Driver Earnings', subtitle: 'Gross trip earnings, platform commission, and net driver wallet balance' },
  { num: 25, id: 'drivers/block-unblock', section: 'drivers', sectionLabel: 'Drivers', title: 'Block/Unblock Drivers', subtitle: 'Suspend or reactivate driver partners with mandatory reason logging' },

  // RIDES (26-34)
  { num: 26, id: 'rides/all', section: 'rides', sectionLabel: 'Rides', title: 'All Rides', subtitle: 'Complete ride ledger with lifecycle state, fare snapshot, and logs' },
  { num: 27, id: 'rides/live-map', section: 'rides', sectionLabel: 'Rides', title: 'Live Ride Map', subtitle: 'Interactive Google Map of authorized driver GPS beacons and active trips' },
  { num: 28, id: 'rides/pending', section: 'rides', sectionLabel: 'Rides', title: 'Pending Rides', subtitle: 'Trips in requested or searching_driver status awaiting partner match' },
  { num: 29, id: 'rides/accepted', section: 'rides', sectionLabel: 'Rides', title: 'Accepted Rides', subtitle: 'Trips with assigned driver en route or OTP verified' },
  { num: 30, id: 'rides/ongoing', section: 'rides', sectionLabel: 'Rides', title: 'Ongoing Rides', subtitle: 'Active trips currently in ride_started status' },
  { num: 31, id: 'rides/completed', section: 'rides', sectionLabel: 'Rides', title: 'Completed Rides', subtitle: 'Trips in ride_completed or payment_completed status' },
  { num: 32, id: 'rides/cancelled', section: 'rides', sectionLabel: 'Rides', title: 'Cancelled Rides', subtitle: 'Cancelled rides by customer, driver, or admin with reason logs' },
  { num: 33, id: 'rides/details', section: 'rides', sectionLabel: 'Rides', title: 'Ride Details', subtitle: 'Detailed ride timeline, OTP, route coordinates, and fare breakdown' },
  { num: 34, id: 'rides/manual-assign', section: 'rides', sectionLabel: 'Rides', title: 'Manual Ride Assignment', subtitle: 'Authorized atomic dispatch of pending rides to eligible drivers' },

  // VEHICLES (35-40)
  { num: 35, id: 'vehicles/categories', section: 'vehicles', sectionLabel: 'Vehicles', title: 'Vehicle Categories', subtitle: 'Bike, Auto, and Cab fleet distribution and operational status' },
  { num: 36, id: 'vehicles/bikes', section: 'vehicles', sectionLabel: 'Vehicles', title: 'Bike Management', subtitle: 'Two-wheeler taxi fleet registry and compliance' },
  { num: 37, id: 'vehicles/autos', section: 'vehicles', sectionLabel: 'Vehicles', title: 'Auto Management', subtitle: 'Three-wheeler auto rickshaw fleet registry and compliance' },
  { num: 38, id: 'vehicles/cabs', section: 'vehicles', sectionLabel: 'Vehicles', title: 'Cab Management', subtitle: 'Four-wheeler city and sedan cab fleet registry' },
  { num: 39, id: 'vehicles/documents', section: 'vehicles', sectionLabel: 'Vehicles', title: 'Vehicle Documents', subtitle: 'Combined RC and insurance compliance status per vehicle' },
  { num: 40, id: 'vehicles/availability', section: 'vehicles', sectionLabel: 'Vehicles', title: 'Zone Setup & Availability', subtitle: 'Set operating cities, geofence radius zones, and Bike, Auto, and Cab availability' },

  // PRICING (41-47)
  { num: 41, id: 'pricing/base-fare', section: 'pricing', sectionLabel: 'Pricing', title: 'Base Fare', subtitle: 'Configure base boarding fare per city and vehicle category' },
  { num: 42, id: 'pricing/per-km', section: 'pricing', sectionLabel: 'Pricing', title: 'Per KM Fare', subtitle: 'Configure distance rate per kilometre with live fare simulator' },
  { num: 43, id: 'pricing/per-minute', section: 'pricing', sectionLabel: 'Pricing', title: 'Per Minute Fare', subtitle: 'Configure ride duration and waiting charges per minute' },
  { num: 44, id: 'pricing/minimum-fare', section: 'pricing', sectionLabel: 'Pricing', title: 'Minimum Fare', subtitle: 'Set minimum trip fare floors across cities and categories' },
  { num: 45, id: 'pricing/surge', section: 'pricing', sectionLabel: 'Pricing', title: 'Surge Pricing', subtitle: 'Controlled demand multiplier rules (1.0x to 5.0x) with audit log' },
  { num: 46, id: 'pricing/commission', section: 'pricing', sectionLabel: 'Pricing', title: 'Driver Commission', subtitle: 'Configure SHINE CAB platform commission percentage by category' },
  { num: 47, id: 'pricing/cancellation', section: 'pricing', sectionLabel: 'Pricing', title: 'Cancellation Charges', subtitle: 'Configure rider and late-stage cancellation penalty rules' },

  // FINANCE (48-54)
  { num: 48, id: 'finance/transactions', section: 'finance', sectionLabel: 'Finance', title: 'All Transactions', subtitle: 'Unified payment ledger across cash, UPI, online, and wallet' },
  { num: 49, id: 'finance/cash', section: 'finance', sectionLabel: 'Finance', title: 'Cash Payments', subtitle: 'Cash trip collections and driver settlement reconciliation' },
  { num: 50, id: 'finance/upi-online', section: 'finance', sectionLabel: 'Finance', title: 'UPI/Online Payments', subtitle: 'Gateway-verified digital payments requiring provider confirmation' },
  { num: 51, id: 'finance/payouts', section: 'finance', sectionLabel: 'Finance', title: 'Driver Payouts', subtitle: 'Bank settlement queue requiring verified gateway payout IDs' },
  { num: 52, id: 'finance/refunds', section: 'finance', sectionLabel: 'Finance', title: 'Refund Management', subtitle: 'Authorized customer refund processing and payment status updates' },
  { num: 53, id: 'finance/wallets', section: 'finance', sectionLabel: 'Finance', title: 'Wallet Management', subtitle: 'Customer and driver wallet credit/debit ledger administration' },
  { num: 54, id: 'finance/reports', section: 'finance', sectionLabel: 'Finance', title: 'Financial Reports', subtitle: 'Reconciled gross bookings, commissions, payouts, and CSV export' },

  // MARKETING (55-59)
  { num: 55, id: 'marketing/coupons', section: 'marketing', sectionLabel: 'Marketing', title: 'Coupons', subtitle: 'Create and toggle promo codes for Customer App checkout' },
  { num: 56, id: 'marketing/promotions', section: 'marketing', sectionLabel: 'Marketing', title: 'Promotions', subtitle: 'City-wide promotional offers and category discounts' },
  { num: 57, id: 'marketing/customer-notifications', section: 'marketing', sectionLabel: 'Marketing', title: 'Customer Notifications', subtitle: 'Send targeted operational or promotional alerts to customers' },
  { num: 58, id: 'marketing/driver-notifications', section: 'marketing', sectionLabel: 'Marketing', title: 'Driver Notifications', subtitle: 'Send incentive, compliance, or zone alerts to drivers' },
  { num: 59, id: 'marketing/push-campaigns', section: 'marketing', sectionLabel: 'Marketing', title: 'Push Campaigns', subtitle: 'Multi-channel campaign queue with FCM adapter status' },

  // SUPPORT AND SECURITY (60-65)
  { num: 60, id: 'support/customer-tickets', section: 'support_security', sectionLabel: 'Support & Security', title: 'Customer Support', subtitle: 'Customer support ticket triage, assignment, and resolution' },
  { num: 61, id: 'support/driver-tickets', section: 'support_security', sectionLabel: 'Support & Security', title: 'Driver Support', subtitle: 'Driver partner support requests, payout queries, and app help' },
  { num: 62, id: 'support/sos', section: 'support_security', sectionLabel: 'Support & Security', title: 'SOS Emergency Management', subtitle: 'Critical safety alerts and live incident escalation queue' },
  { num: 63, id: 'security/admin-users', section: 'support_security', sectionLabel: 'Support & Security', title: 'Admin User Management', subtitle: 'Provision and manage admin accounts and active access status' },
  { num: 64, id: 'security/roles', section: 'support_security', sectionLabel: 'Support & Security', title: 'Roles and Permissions', subtitle: '7-role RBAC permission matrix enforced across UI and backend' },
  { num: 65, id: 'security/settings-audit', section: 'support_security', sectionLabel: 'Support & Security', title: 'System Settings and Audit Logs', subtitle: 'Integration health, system policies, and immutable audit trail' },
  { num: 66, id: 'security/app-links', section: 'support_security', sectionLabel: 'System & Security', title: 'App Links & 3-Way Sync', subtitle: 'Connect Customer APK, Driver APK & Admin Panel live ecosystem' },
  { num: 99, id: 'security/api-keys', section: 'support_security', sectionLabel: 'Support & Security', title: 'API Keys & Integrations', subtitle: 'Server-side API key readiness checklist and Secrets configuration guide' },
];

export const PAGE_BY_ID: Record<string, AdminPageMeta> = Object.fromEntries(
  ADMIN_PAGES.map((p) => [p.id, p])
);
