# SHINE CAB Super Admin Panel

Enterprise command center controlling the **SHINE CAB Customer App**, **SHINE CAB Driver App**, and live dispatch operations.

## Architecture & Connected Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Radix UI primitives, Lucide Icons, Recharts, Google Maps (`@vis.gl/react-google-maps`).
- **Backend Server (`server.ts`)**: Express server on port `3000` handling server-side pricing validation, ride transition guards, payment/payout verification gates, RBAC role matrix APIs, and integration health reporting.
- **Primary Operational Database & Auth**: Firebase Firestore + Firebase Google Sign-In with strict Eight-Pillar security rules (`firestore.rules`) and immutable `audit_logs`.
- **Shared Supabase Contract**: Complete PostgreSQL migrations (`/supabase/migrations/001_initial_schema.sql`), atomic driver assignment RPC (`assign_driver_to_ride`), Row Level Security policies, and Edge Functions (`/supabase/functions/ride-lifecycle`, `/supabase/functions/payment-webhook`).

## 65 Admin Modules

1. **Dashboard (1–7)**: Main Dashboard, Live Ride Monitoring, Customer Analytics, Driver Analytics, Revenue Analytics, Commission Analytics, City Performance.
2. **Customers (8–15)**: All Customers, Customer Details, Customer Verification, Customer Ride History, Customer Wallet, Customer Payments, Customer Complaints, Block/Unblock Customers.
3. **Drivers (16–25)**: All Drivers, New Applications, Driver Details, KYC Verification, Driving Licence Verification, RC Verification, Insurance Verification, Approve/Reject Drivers, Driver Earnings, Block/Unblock Drivers.
4. **Rides (26–34)**: All Rides, Live Ride Map, Pending Rides, Accepted Rides, Ongoing Rides, Completed Rides, Cancelled Rides, Ride Details, Manual Ride Assignment.
5. **Vehicles (35–40)**: Vehicle Categories, Bike Management, Auto Management, Cab Management, Vehicle Documents, Service Availability.
6. **Pricing (41–47)**: Base Fare, Per KM Fare, Per Minute Fare, Minimum Fare, Surge Pricing, Driver Commission, Cancellation Charges.
7. **Finance (48–54)**: All Transactions, Cash Payments, UPI/Online Payments, Driver Payouts, Refund Management, Wallet Management, Financial Reports.
8. **Marketing (55–59)**: Coupons, Promotions, Customer Notifications, Driver Notifications, Push Campaigns.
9. **Support & Security (60–65)**: Customer Support, Driver Support, SOS Emergency Management, Admin User Management, Roles and Permissions, System Settings and Audit Logs.

## Role-Based Access Control (7 Roles)

- `super_admin`
- `operations_admin`
- `kyc_admin`
- `finance_admin`
- `support_admin`
- `marketing_admin`
- `read_only_admin`

## Environment Configuration

See `.env.example` for optional external adapters:
- `VITE_GOOGLE_MAPS_API_KEY`: Google Maps Platform key for Live Ride Map.
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY`: Connect external Supabase PostgreSQL / Realtime / Storage.
- `PAYMENT_PROVIDER`, `PAYMENT_KEY_ID`, `PAYMENT_KEY_SECRET`: Enable verified online/UPI settlement confirmation and bank payout verification.
- `FCM_SERVER_KEY`: Enable live push dispatch (otherwise logged honestly with `provider_not_configured`).

## Commands

- `npm run dev` — Start Express + Vite dev server on port 3000
- `npm run build` — Production Vite bundle build
- `npm run lint` — TypeScript strict check (`tsc --noEmit`)
- `npm test` — Run Vitest unit and security rules test suite
