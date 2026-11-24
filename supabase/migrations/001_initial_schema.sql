-- SHINE CAB Shared PostgreSQL Schema (Supabase)
-- Shared across: SHINE CAB Customer App, SHINE CAB Driver App, SHINE CAB Super Admin Panel

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Roles & Permissions
CREATE TABLE IF NOT EXISTS public.roles (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id TEXT NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- 2. Shared Identity Profiles (linked to auth.users.id)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  avatar_url TEXT,
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'driver', 'admin')),
  city TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'blocked', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES public.roles(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Customers & Drivers
CREATE TABLE IF NOT EXISTS public.customers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_rides INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  block_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.drivers (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  vehicle_category TEXT NOT NULL CHECK (vehicle_category IN ('bike', 'auto', 'cab')),
  application_status TEXT NOT NULL DEFAULT 'pending' CHECK (application_status IN ('pending', 'under_review', 'approved', 'rejected')),
  kyc_status TEXT NOT NULL DEFAULT 'pending' CHECK (kyc_status IN ('pending', 'verified', 'rejected')),
  dl_status TEXT NOT NULL DEFAULT 'pending' CHECK (dl_status IN ('pending', 'verified', 'rejected')),
  rc_status TEXT NOT NULL DEFAULT 'pending' CHECK (rc_status IN ('pending', 'verified', 'rejected')),
  insurance_status TEXT NOT NULL DEFAULT 'pending' CHECK (insurance_status IN ('pending', 'verified', 'rejected')),
  is_online BOOLEAN NOT NULL DEFAULT false,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  block_reason TEXT,
  rating NUMERIC(3,2) NOT NULL DEFAULT 5.00,
  total_rides INTEGER NOT NULL DEFAULT 0,
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  total_earnings NUMERIC(12,2) NOT NULL DEFAULT 0.00,
  commission_override_pct NUMERIC(5,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('bike', 'auto', 'cab')),
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  plate_number TEXT NOT NULL UNIQUE,
  color TEXT,
  year INTEGER,
  rc_status TEXT NOT NULL DEFAULT 'pending' CHECK (rc_status IN ('pending', 'verified', 'rejected')),
  insurance_status TEXT NOT NULL DEFAULT 'pending' CHECK (insurance_status IN ('pending', 'verified', 'rejected')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  vehicle_id UUID REFERENCES public.vehicles(id) ON DELETE SET NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('kyc_aadhaar_pan', 'driving_licence', 'vehicle_rc', 'vehicle_insurance')),
  doc_number TEXT NOT NULL,
  file_path TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'rejected')),
  rejection_reason TEXT,
  expiry_date DATE,
  verified_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Service Zones & Fare Engine
CREATE TABLE IF NOT EXISTS public.service_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  zone_name TEXT NOT NULL,
  state TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  bike_enabled BOOLEAN NOT NULL DEFAULT true,
  auto_enabled BOOLEAN NOT NULL DEFAULT true,
  cab_enabled BOOLEAN NOT NULL DEFAULT true,
  center_lat DOUBLE PRECISION NOT NULL,
  center_lng DOUBLE PRECISION NOT NULL,
  radius_km NUMERIC(6,2) NOT NULL DEFAULT 15.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (city, zone_name)
);

CREATE TABLE IF NOT EXISTS public.fare_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city TEXT NOT NULL,
  vehicle_category TEXT NOT NULL CHECK (vehicle_category IN ('bike', 'auto', 'cab')),
  base_fare NUMERIC(10,2) NOT NULL CHECK (base_fare >= 0),
  minimum_fare NUMERIC(10,2) NOT NULL CHECK (minimum_fare >= 0),
  per_km_rate NUMERIC(10,2) NOT NULL CHECK (per_km_rate >= 0),
  per_minute_rate NUMERIC(10,2) NOT NULL CHECK (per_minute_rate >= 0),
  waiting_charge_per_min NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (waiting_charge_per_min >= 0),
  surge_multiplier NUMERIC(4,2) NOT NULL DEFAULT 1.00 CHECK (surge_multiplier >= 1.00 AND surge_multiplier <= 5.00),
  cancellation_fee NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (cancellation_fee >= 0),
  commission_pct NUMERIC(5,2) NOT NULL CHECK (commission_pct >= 0 AND commission_pct <= 50),
  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Rides, Atomic Assignment & Telemetry
CREATE TABLE IF NOT EXISTS public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  driver_id UUID REFERENCES public.drivers(id),
  zone_id UUID REFERENCES public.service_zones(id),
  vehicle_category TEXT NOT NULL CHECK (vehicle_category IN ('bike', 'auto', 'cab')),
  city TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (
    status IN (
      'requested', 'searching_driver', 'driver_assigned', 'driver_arrived',
      'otp_verified', 'ride_started', 'ride_completed', 'payment_completed',
      'cancelled_by_customer', 'cancelled_by_driver', 'cancelled_by_admin'
    )
  ),
  pickup_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  drop_address TEXT NOT NULL,
  drop_lat DOUBLE PRECISION NOT NULL,
  drop_lng DOUBLE PRECISION NOT NULL,
  distance_km NUMERIC(8,2),
  duration_min NUMERIC(8,2),
  otp_code TEXT,
  fare_snapshot JSONB NOT NULL,
  final_fare NUMERIC(10,2) NOT NULL,
  commission_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  driver_payout_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'upi', 'online', 'wallet')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'verified', 'failed', 'refunded')),
  cancellation_reason TEXT,
  cancelled_by UUID REFERENCES public.profiles(id),
  assigned_by_admin_id UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ride_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  actor_id UUID REFERENCES public.profiles(id),
  actor_role TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.driver_locations (
  driver_id UUID PRIMARY KEY REFERENCES public.drivers(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  heading NUMERIC(5,2),
  speed_kmh NUMERIC(6,2),
  is_authorized BOOLEAN NOT NULL DEFAULT false,
  is_online BOOLEAN NOT NULL DEFAULT false,
  active_ride_id UUID REFERENCES public.rides(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Payments, Wallets, Payouts & Coupons
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  method TEXT NOT NULL CHECK (method IN ('cash', 'upi', 'online', 'wallet')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  provider TEXT,
  provider_tx_id TEXT UNIQUE,
  verified_by_provider BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  owner_type TEXT NOT NULL CHECK (owner_type IN ('customer', 'driver')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  reason TEXT NOT NULL,
  reference_id TEXT,
  balance_after NUMERIC(12,2),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.drivers(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'succeeded', 'failed', 'rejected')),
  bank_account_mask TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  provider_payout_id TEXT UNIQUE,
  verified_by_provider BOOLEAN NOT NULL DEFAULT false,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  processed_by UUID REFERENCES public.admin_users(id)
);

CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value > 0),
  max_discount NUMERIC(10,2),
  min_fare NUMERIC(10,2) DEFAULT 0,
  vehicle_category TEXT NOT NULL DEFAULT 'all' CHECK (vehicle_category IN ('all', 'bike', 'auto', 'cab')),
  city TEXT,
  usage_limit INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_until TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Support, Notifications & Audit Logs
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  user_type TEXT NOT NULL CHECK (user_type IN ('customer', 'driver')),
  ride_id UUID REFERENCES public.rides(id),
  category TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'escalated')),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  is_sos BOOLEAN NOT NULL DEFAULT false,
  assigned_admin_id UUID REFERENCES public.admin_users(id),
  resolution_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_audience TEXT NOT NULL CHECK (target_audience IN ('customers', 'drivers', 'all')),
  target_user_id UUID REFERENCES public.profiles(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'in_app', 'sms')),
  campaign_name TEXT,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('draft', 'queued', 'dispatched', 'provider_not_configured')),
  sent_by UUID REFERENCES public.admin_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_uid UUID NOT NULL REFERENCES public.profiles(id),
  actor_email TEXT,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_state JSONB,
  after_state JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for high-throughput dispatch & analytics queries
CREATE INDEX IF NOT EXISTS idx_rides_status_city ON public.rides(status, city);
CREATE INDEX IF NOT EXISTS idx_rides_customer ON public.rides(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rides_driver ON public.rides(driver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_driver_locations_online ON public.driver_locations(is_online, is_authorized);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status, method);
CREATE INDEX IF NOT EXISTS idx_payouts_status ON public.payouts(status, driver_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sos_status ON public.support_tickets(is_sos, status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id, created_at DESC);

-- Atomic Ride Assignment RPC (Prevents double-acceptance race conditions)
CREATE OR REPLACE FUNCTION public.assign_driver_to_ride(
  p_ride_id UUID,
  p_driver_id UUID,
  p_admin_id UUID DEFAULT NULL
)
RETURNS public.rides
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ride public.rides;
BEGIN
  SELECT * INTO v_ride
  FROM public.rides
  WHERE id = p_ride_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ride % not found', p_ride_id;
  END IF;

  IF v_ride.driver_id IS NOT NULL OR v_ride.status NOT IN ('requested', 'searching_driver') THEN
    RAISE EXCEPTION 'Ride % is already assigned or in non-assignable status: %', p_ride_id, v_ride.status;
  END IF;

  UPDATE public.rides
  SET driver_id = p_driver_id,
      status = 'driver_assigned',
      assigned_by_admin_id = p_admin_id,
      updated_at = now()
  WHERE id = p_ride_id
  RETURNING * INTO v_ride;

  INSERT INTO public.ride_events (ride_id, from_status, to_status, actor_id, actor_role, note)
  VALUES (
    p_ride_id,
    'searching_driver',
    'driver_assigned',
    COALESCE(p_admin_id, p_driver_id),
    CASE WHEN p_admin_id IS NOT NULL THEN 'admin' ELSE 'driver' END,
    'Atomic driver assignment committed'
  );

  RETURN v_ride;
END;
$$;

-- Enable Row Level Security across all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fare_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Helper RLS function to check active admin role
CREATE OR REPLACE FUNCTION public.is_active_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_users
    WHERE id = auth.uid() AND is_active = true
  );
$$;

-- Core RLS Policies
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT USING (public.is_active_admin() OR id = auth.uid());
CREATE POLICY "Admins read all rides" ON public.rides FOR SELECT USING (public.is_active_admin() OR customer_id = auth.uid() OR driver_id = auth.uid());
CREATE POLICY "Admins read all payments" ON public.payments FOR SELECT USING (public.is_active_admin() OR customer_id = auth.uid());
CREATE POLICY "Admins read all audit logs" ON public.audit_logs FOR SELECT USING (public.is_active_admin());
