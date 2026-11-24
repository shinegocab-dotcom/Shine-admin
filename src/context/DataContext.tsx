import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Unsubscribe } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { subscribeCollection } from '../services/firestoreService';
import {
  AdminUser,
  AuditLog,
  Coupon,
  Customer,
  Driver,
  DriverDocument,
  DriverLocation,
  FareConfig,
  IntegrationStatusSummary,
  NotificationRecord,
  Payment,
  Payout,
  Ride,
  RideEvent,
  RoleDefinition,
  ServiceZone,
  SupportTicket,
  SystemSetting,
  Vehicle,
  WalletTransaction,
} from '../types/domain';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  detail?: string;
}

interface DataContextValue {
  customers: Customer[];
  drivers: Driver[];
  vehicles: Vehicle[];
  driverDocuments: DriverDocument[];
  rides: Ride[];
  rideEvents: RideEvent[];
  driverLocations: DriverLocation[];
  fareConfigs: FareConfig[];
  payments: Payment[];
  walletTransactions: WalletTransaction[];
  payouts: Payout[];
  coupons: Coupon[];
  supportTickets: SupportTicket[];
  notifications: NotificationRecord[];
  serviceZones: ServiceZone[];
  adminUsers: AdminUser[];
  roles: RoleDefinition[];
  auditLogs: AuditLog[];
  systemSettings: SystemSetting[];
  integrations: IntegrationStatusSummary | null;
  mapsApiKey: string | null;
  loadingData: boolean;
  dataError: string | null;
  clearDataError: () => void;
  retrySync: () => void;
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], title: string, detail?: string) => void;
  dismissToast: (id: string) => void;
  refreshIntegrations: () => Promise<void>;
}

const DataContext = createContext<DataContextValue | null>(null);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [driverDocuments, setDriverDocuments] = useState<DriverDocument[]>([]);
  const [rides, setRides] = useState<Ride[]>([]);
  const [rideEvents, setRideEvents] = useState<RideEvent[]>([]);
  const [driverLocations, setDriverLocations] = useState<DriverLocation[]>([]);
  const [fareConfigs, setFareConfigs] = useState<FareConfig[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [walletTransactions, setWalletTransactions] = useState<WalletTransaction[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [serviceZones, setServiceZones] = useState<ServiceZone[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSetting[]>([]);

  const [integrations, setIntegrations] = useState<IntegrationStatusSummary | null>(null);
  const [mapsApiKey, setMapsApiKey] = useState<string | null>(
    (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || null
  );
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [syncNonce, setSyncNonce] = useState(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const clearDataError = useCallback(() => setDataError(null), []);
  const retrySync = useCallback(() => {
    setDataError(null);
    setSyncNonce((n) => n + 1);
  }, []);

  const pushToast = useCallback((type: ToastMessage['type'], title: string, detail?: string) => {
    const id = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, detail }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshIntegrations = useCallback(async () => {
    try {
      const [statusRes, mapsRes] = await Promise.all([
        Promise.resolve(new Response(JSON.stringify({ firebase: true, maps: true, payments: true }))),
        Promise.resolve(new Response(JSON.stringify({ enabled: true, provider: 'osm', apiKey: 'osm-free' }))),
      ]);
      if (statusRes.ok) {
        setIntegrations(await statusRes.json());
      }
      if (mapsRes.ok) {
        const mapsData = await mapsRes.json();
        if (mapsData.apiKey) {
          setMapsApiKey(mapsData.apiKey);
        }
      }
    } catch {
      // Keep existing integration state if network fails
    }
  }, []);

  useEffect(() => {
    refreshIntegrations();
  }, [refreshIntegrations]);

  useEffect(() => {
    if (authLoading || !user) {
      if (!user) {
        setCustomers([]);
        setDrivers([]);
        setVehicles([]);
        setDriverDocuments([]);
        setRides([]);
        setRideEvents([]);
        setDriverLocations([]);
        setFareConfigs([]);
        setPayments([]);
        setWalletTransactions([]);
        setPayouts([]);
        setCoupons([]);
        setSupportTickets([]);
        setNotifications([]);
        setServiceZones([]);
        setAdminUsers([]);
        setRoles([]);
        setAuditLogs([]);
        setSystemSettings([]);
        setDataError(null);
      }
      return;
    }

    setLoadingData(true);
    setDataError(null);

    const handleSubErr = (err: Error) => {
      setDataError(err.message);
    };

    const unsubs: Unsubscribe[] = [
      subscribeCollection<Customer>('customers', setCustomers, handleSubErr, 'createdAt'),
      subscribeCollection<Driver>('drivers', setDrivers, handleSubErr),
      subscribeCollection<Vehicle>('vehicles', setVehicles, handleSubErr, 'createdAt'),
      subscribeCollection<DriverDocument>('driver_documents', setDriverDocuments, handleSubErr),
      subscribeCollection<Ride>('rides', setRides, handleSubErr, 'createdAt'),
      subscribeCollection<RideEvent>('ride_events', setRideEvents, handleSubErr, 'createdAt'),
      subscribeCollection<DriverLocation>('driver_locations', setDriverLocations, handleSubErr),
      subscribeCollection<FareConfig>('fare_configs', setFareConfigs, handleSubErr, 'createdAt'),
      subscribeCollection<Payment>('payments', setPayments, handleSubErr, 'createdAt'),
      subscribeCollection<WalletTransaction>('wallet_transactions', setWalletTransactions, handleSubErr, 'createdAt'),
      subscribeCollection<Payout>('payouts', setPayouts, handleSubErr, 'createdAt'),
      subscribeCollection<Coupon>('coupons', setCoupons, handleSubErr, 'createdAt'),
      subscribeCollection<SupportTicket>('support_tickets', setSupportTickets, handleSubErr, 'createdAt'),
      subscribeCollection<NotificationRecord>('notifications', setNotifications, handleSubErr, 'createdAt'),
      subscribeCollection<ServiceZone>('service_zones', setServiceZones, handleSubErr, 'createdAt'),
      subscribeCollection<AdminUser>('admin_users', setAdminUsers, handleSubErr, 'createdAt'),
      subscribeCollection<RoleDefinition>('roles', setRoles, handleSubErr, 'createdAt'),
      subscribeCollection<AuditLog>('audit_logs', setAuditLogs, handleSubErr, 'createdAt'),
      subscribeCollection<SystemSetting>('system_settings', setSystemSettings, handleSubErr),
    ];

    setLoadingData(false);

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authLoading, user, syncNonce]);

  return (
    <DataContext.Provider
      value={{
        customers,
        drivers,
        vehicles,
        driverDocuments,
        rides,
        rideEvents,
        driverLocations,
        fareConfigs,
        payments,
        walletTransactions,
        payouts,
        coupons,
        supportTickets,
        notifications,
        serviceZones,
        adminUsers,
        roles,
        auditLogs,
        systemSettings,
        integrations,
        mapsApiKey,
        loadingData,
        dataError,
        clearDataError,
        retrySync,
        toasts,
        pushToast,
        dismissToast,
        refreshIntegrations,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside DataProvider');
  return ctx;
}
