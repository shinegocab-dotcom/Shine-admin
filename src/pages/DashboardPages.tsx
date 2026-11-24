import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowUpRight,
  CarFront,
  CheckCircle2,
  Clock,
  IndianRupee,
  MapPin,
  Navigation,
  ShieldAlert,
  UserCheck,
  Users,
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { cn, formatDateTime, formatINR } from '../lib/utils';
import { RIDE_STATUS_LABELS } from '../lib/rideStateMachine';
import { Button, DataTable, EmptyState, Panel, StatTile, StatusText } from '../components/ui/Primitives';

interface DashboardPagesProps {
  pageId: string;
  onNavigate: (pageId: string, selectedId?: string) => void;
}

const DarkChartTooltip: React.FC<{
  active?: boolean;
  payload?: Array<{ name?: string; value?: number; dataKey?: string }>;
  label?: string;
  currency?: boolean;
}> = ({ active, payload, label, currency }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0];
  const val = item?.value ?? 0;
  return (
    <div className="bg-[#111111] text-white px-3 py-2 rounded-lg shadow-lg text-xs border border-[#262626] space-y-0.5">
      <div className="text-[#9CA3AF] font-medium">{label}</div>
      <div className="font-mono font-semibold tabular-nums text-[#FFC928]">
        {currency ? formatINR(val) : val}
      </div>
    </div>
  );
};

export const DashboardPages: React.FC<DashboardPagesProps> = ({ pageId, onNavigate }) => {
  const {
    customers,
    drivers,
    rides,
    payments,
    serviceZones,
    supportTickets,
    driverLocations,
    integrations,
  } = useData();

  const [chartMetric, setChartMetric] = useState<'rides' | 'revenue' | 'commission'>('rides');

  const metrics = useMemo(() => {
    const activeRideStatuses = new Set([
      'requested',
      'searching_driver',
      'driver_assigned',
      'driver_arrived',
      'otp_verified',
      'ride_started',
    ]);
    const pendingSearchRides = rides.filter(
      (r) => r.status === 'requested' || r.status === 'searching_driver'
    );
    const assignedEnRouteRides = rides.filter(
      (r) => r.status === 'driver_assigned' || r.status === 'driver_arrived' || r.status === 'otp_verified'
    );
    const ongoingTrips = rides.filter((r) => r.status === 'ride_started');
    const activeRides = rides.filter((r) => activeRideStatuses.has(r.status));
    const completedRides = rides.filter(
      (r) => r.status === 'ride_completed' || r.status === 'payment_completed'
    );
    const cancelledRides = rides.filter((r) => r.status.startsWith('cancelled'));
    const grossBooking = completedRides.reduce((acc, r) => acc + (r.finalFare || 0), 0);
    const totalCommission = completedRides.reduce((acc, r) => acc + (r.commissionAmount || 0), 0);
    const onlineDrivers = drivers.filter((d) => d.isOnline && !d.isBlocked && d.applicationStatus === 'approved');
    const pendingApprovals = drivers.filter((d) => d.applicationStatus === 'pending' || d.applicationStatus === 'under_review');
    const openSos = supportTickets.filter((t) => t.isSos && t.status !== 'resolved');
    const verifiedPayments = payments.filter((p) => p.status === 'succeeded' && p.verifiedByProvider);

    return {
      pendingSearchRides,
      assignedEnRouteRides,
      ongoingTrips,
      activeRides,
      completedRides,
      cancelledRides,
      grossBooking,
      totalCommission,
      onlineDrivers,
      pendingApprovals,
      openSos,
      verifiedPayments,
    };
  }, [rides, drivers, supportTickets, payments]);

  const categoryBreakdown = useMemo(() => {
    const counts = { bike: 0, auto: 0, cab: 0 };
    const revenue = { bike: 0, auto: 0, cab: 0 };
    const commission = { bike: 0, auto: 0, cab: 0 };
    for (const r of rides) {
      counts[r.vehicleCategory] = (counts[r.vehicleCategory] || 0) + 1;
      if (r.status === 'ride_completed' || r.status === 'payment_completed') {
        revenue[r.vehicleCategory] = (revenue[r.vehicleCategory] || 0) + (r.finalFare || 0);
        commission[r.vehicleCategory] = (commission[r.vehicleCategory] || 0) + (r.commissionAmount || 0);
      }
    }
    return [
      { name: 'Bike', rides: counts.bike, revenue: revenue.bike, commission: commission.bike, fill: '#FFC928' },
      { name: 'Auto', rides: counts.auto, revenue: revenue.auto, commission: commission.auto, fill: '#111111' },
      { name: 'Cab', rides: counts.cab, revenue: revenue.cab, commission: commission.cab, fill: '#16A34A' },
    ];
  }, [rides]);

  const citySummary = useMemo(() => {
    const map: Record<string, { city: string; rides: number; completed: number; revenue: number; drivers: number; customers: number }> = {};
    const ensure = (city: string) => {
      const key = city || 'Unspecified';
      if (!map[key]) {
        map[key] = { city: key, rides: 0, completed: 0, revenue: 0, drivers: 0, customers: 0 };
      }
      return map[key];
    };
    for (const z of serviceZones) ensure(z.city);
    for (const c of customers) ensure(c.city).customers += 1;
    for (const d of drivers) ensure(d.city).drivers += 1;
    for (const r of rides) {
      const row = ensure(r.city);
      row.rides += 1;
      if (r.status === 'ride_completed' || r.status === 'payment_completed') {
        row.completed += 1;
        row.revenue += r.finalFare || 0;
      }
    }
    return Object.values(map).sort((a, b) => b.rides - a.rides);
  }, [serviceZones, customers, drivers, rides]);

  if (pageId === 'dashboard/main') {
    const authorizedBeacons = driverLocations.filter((l) => l.isAuthorized && l.isOnline).length;
    const isCurrencyChart = chartMetric !== 'rides';

    return (
      <div className="space-y-6">
        {/* Executive Command Strip */}
        <section className="bg-[#111111] text-white rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-[#222222]">
          <div className="space-y-1">
            <div className="text-xs font-medium text-[#FFC928]">
              SHINE CAB Command Center
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white">
              Real-Time Fleet, Dispatch & Revenue Control
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              {serviceZones.length} service zones configured · {authorizedBeacons} authorized GPS beacons online · {metrics.pendingApprovals.length} driver applications queued
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button size="sm" variant="primary" onClick={() => onNavigate('vehicles/availability')}>
              <MapPin className="w-3.5 h-3.5" />
              Set Operating Zones
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-[#1C1C1C] text-white border-[#333333] hover:bg-[#262626] hover:text-white"
              onClick={() => onNavigate('rides/live-map')}
            >
              <Navigation className="w-3.5 h-3.5 text-[#FFC928]" />
              Live Ride Map
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-[#1C1C1C] text-white border-[#333333] hover:bg-[#262626] hover:text-white"
              onClick={() => onNavigate('rides/manual-assign')}
            >
              <CarFront className="w-3.5 h-3.5 text-[#FFC928]" />
              Manual Dispatch
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="bg-[#1C1C1C] text-white border-[#333333] hover:bg-[#262626] hover:text-white"
              onClick={() => onNavigate('drivers/approve-reject')}
            >
              <UserCheck className="w-3.5 h-3.5 text-[#16A34A]" />
              Driver Approvals
            </Button>
          </div>
        </section>

        {/* 4-Column Executive KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <StatTile
            label="Total Rides"
            value={rides.length}
            detail={`${metrics.activeRides.length} active · ${metrics.completedRides.length} completed`}
            icon={<CarFront className="w-4 h-4" />}
            highlight
            onClick={() => onNavigate('rides/all')}
          />
          <StatTile
            label="Completed Revenue"
            value={formatINR(metrics.grossBooking)}
            detail={`Platform commission: ${formatINR(metrics.totalCommission)}`}
            tone="green"
            icon={<IndianRupee className="w-4 h-4" />}
            onClick={() => onNavigate('dashboard/revenue-analytics')}
          />
          <StatTile
            label="Drivers Online"
            value={metrics.onlineDrivers.length}
            detail={`${drivers.length} total fleet · ${metrics.pendingApprovals.length} pending`}
            icon={<Users className="w-4 h-4" />}
            onClick={() => onNavigate('drivers/all')}
          />
          <StatTile
            label="Active SOS Alerts"
            value={metrics.openSos.length}
            detail={`${customers.length} customers registered`}
            tone={metrics.openSos.length > 0 ? 'red' : 'default'}
            icon={<ShieldAlert className="w-4 h-4" />}
            onClick={() => onNavigate('support/sos')}
          />
        </div>

        {/* Live Dispatch Lifecycle Pipeline Strip */}
        <section className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#111111]">Live Ride Lifecycle Pipeline</h2>
              <p className="text-xs text-[#6B7280]">Select any stage to open the filtered dispatch queue</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('dashboard/live-monitoring')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#111111] hover:underline cursor-pointer whitespace-nowrap"
            >
              Open Live Monitor
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#E5E7EB]">
            {[
              {
                label: 'Searching / Requested',
                count: metrics.pendingSearchRides.length,
                hint: 'Awaiting partner match',
                page: 'rides/pending',
                icon: Clock,
                accent: 'text-[#B45309]',
              },
              {
                label: 'Driver En Route / OTP',
                count: metrics.assignedEnRouteRides.length,
                hint: 'Assigned or arrived at pickup',
                page: 'rides/accepted',
                icon: UserCheck,
                accent: 'text-[#111111]',
              },
              {
                label: 'Ride In Progress',
                count: metrics.ongoingTrips.length,
                hint: 'Currently on road',
                page: 'rides/ongoing',
                icon: Navigation,
                accent: 'text-[#16A34A]',
              },
              {
                label: 'Completed & Settled',
                count: metrics.completedRides.length,
                hint: `${metrics.cancelledRides.length} cancelled overall`,
                page: 'rides/completed',
                icon: CheckCircle2,
                accent: 'text-[#16A34A]',
              },
            ].map((stage) => {
              const Icon = stage.icon;
              return (
                <button
                  key={stage.label}
                  type="button"
                  onClick={() => onNavigate(stage.page)}
                  className="p-4 text-left hover:bg-[#FFFDF5] transition-colors cursor-pointer space-y-1.5"
                >
                  <div className="flex items-center justify-between text-xs text-[#6B7280]">
                    <span className="font-medium truncate">{stage.label}</span>
                    <Icon className={cn('w-3.5 h-3.5 shrink-0', stage.accent)} />
                  </div>
                  <div className={cn('text-2xl font-bold tabular-nums tracking-tight', stage.accent)}>
                    {stage.count}
                  </div>
                  <div className="text-[11px] text-[#6B7280] truncate">{stage.hint}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Analytics & Connected Adapters */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Panel
            title="Segment Performance Breakdown"
            subtitle="Real-time aggregation across Bike, Auto, and Cab tiers"
            className="lg:col-span-2"
            action={
              <div className="flex items-center gap-1 p-1 bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg">
                {(
                  [
                    { id: 'rides', label: 'Ride Volume' },
                    { id: 'revenue', label: 'Revenue' },
                    { id: 'commission', label: 'Commission' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setChartMetric(tab.id)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer',
                      chartMetric === tab.id
                        ? 'bg-[#111111] text-white'
                        : 'text-[#4B5563] hover:text-[#111111]'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            }
          >
            {rides.length === 0 ? (
              <EmptyState
                title="No Rides Recorded Yet"
                description="Rides created by the SHINE CAB Customer App or dispatched manually appear here in real time."
                action={
                  <Button size="sm" onClick={() => onNavigate('rides/manual-assign')}>
                    Create / Assign Ride
                  </Button>
                }
              />
            ) : (
              <div className="space-y-4">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryBreakdown} barSize={44}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#4B5563' }} axisLine={false} tickLine={false} />
                      <YAxis
                        tick={{ fontSize: 12, fill: '#4B5563' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                      />
                      <Tooltip content={<DarkChartTooltip currency={isCurrencyChart} />} cursor={{ fill: '#F7F8FA' }} />
                      <Bar dataKey={chartMetric} radius={[6, 6, 0, 0]}>
                        {categoryBreakdown.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Compact tabular category strip */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#F3F4F6] text-xs">
                  {categoryBreakdown.map((cat) => (
                    <div key={cat.name} className="flex items-center justify-between px-2 py-1">
                      <span className="font-semibold text-[#111111]">{cat.name}</span>
                      <span className="font-mono tabular-nums text-[#4B5563]">
                        {cat.rides} · {formatINR(cat.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Panel>

          <Panel
            title="Connected Platform Adapters"
            subtitle="Live configuration health across connected services"
            action={
              <Button size="sm" variant="ghost" onClick={() => onNavigate('security/api-keys')}>
                API Keys
              </Button>
            }
          >
            <div className="divide-y divide-[#F3F4F6]">
              {integrations ? (
                Object.values(integrations).map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#111111] truncate">{item.name}</div>
                      <div className="text-[11px] text-[#6B7280] font-mono truncate">{item.mode}</div>
                    </div>
                    <StatusText
                      status={item.configured ? 'configured' : 'not_configured'}
                      tone={item.configured ? 'green' : 'amber'}
                    />
                  </div>
                ))
              ) : (
                <div className="text-xs text-[#6B7280] py-4">Checking backend adapters...</div>
              )}
            </div>
          </Panel>
        </div>

        {/* City Supply Snapshot + Recent Operational Queue */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <Panel
            title="City Operations Summary"
            subtitle="Active supply and trips per city"
            action={
              <Button size="sm" variant="outline" onClick={() => onNavigate('dashboard/city-performance')}>
                All Cities
              </Button>
            }
          >
            {citySummary.length === 0 ? (
              <EmptyState
                title="No City Zones Yet"
                description="Add cities under Service Availability to track regional fleet supply."
                action={
                  <Button size="sm" onClick={() => onNavigate('vehicles/availability')}>
                    Configure Cities
                  </Button>
                }
              />
            ) : (
              <div className="divide-y divide-[#F3F4F6] text-xs">
                {citySummary.slice(0, 6).map((row) => (
                  <div key={row.city} className="py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-[#111111] truncate">{row.city}</div>
                      <div className="text-[11px] text-[#6B7280] tabular-nums">
                        {row.drivers} drivers · {row.customers} customers
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono font-semibold text-[#111111] tabular-nums">
                        {formatINR(row.revenue)}
                      </div>
                      <div className="text-[11px] text-[#6B7280] tabular-nums">{row.rides} rides</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel
            title="Recent Operational Queue"
            subtitle="Latest rides requiring dispatch, monitoring, or settlement"
            className="xl:col-span-2"
            action={
              <Button size="sm" variant="outline" onClick={() => onNavigate('rides/all')}>
                View All Rides
              </Button>
            }
          >
            <DataTable
              rows={rides.slice(0, 20)}
              pageSize={6}
              emptyTitle="No Ride Records Available"
              emptyDescription="Connect the Customer App or create a dispatch record under Manual Ride Assignment."
              emptyAction={
                <Button size="sm" onClick={() => onNavigate('rides/manual-assign')}>
                  Open Manual Ride Assignment
                </Button>
              }
              columns={[
                { key: 'id', header: 'Ride ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
                { key: 'city', header: 'City', render: (r) => r.city },
                { key: 'cat', header: 'Category', render: (r) => <span className="uppercase text-xs font-semibold">{r.vehicleCategory}</span> },
                { key: 'status', header: 'Lifecycle State', render: (r) => <StatusText status={RIDE_STATUS_LABELS[r.status] || r.status} /> },
                { key: 'fare', header: 'Fare Snapshot', align: 'right', render: (r) => <span className="font-mono font-medium">{formatINR(r.finalFare)}</span> },
                { key: 'created', header: 'Created', render: (r) => <span className="text-xs text-[#6B7280]">{formatDateTime(r.createdAt)}</span> },
              ]}
              onRowClick={(r) => onNavigate('rides/details', r.id)}
            />
          </Panel>
        </div>
      </div>
    );
  }

  if (pageId === 'dashboard/live-monitoring') {
    const authorizedOnline = driverLocations.filter((l) => l.isAuthorized && l.isOnline);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Active Rides" value={metrics.activeRides.length} icon={<CarFront className="w-4 h-4" />} highlight />
          <StatTile label="Authorized Live Beacons" value={authorizedOnline.length} tone={authorizedOnline.length > 0 ? 'green' : 'amber'} icon={<MapPin className="w-4 h-4" />} />
          <StatTile label="Searching Driver" value={metrics.pendingSearchRides.length} tone="amber" icon={<Clock className="w-4 h-4" />} />
          <StatTile label="In-Progress Trips" value={metrics.ongoingTrips.length} tone="green" icon={<Navigation className="w-4 h-4" />} />
        </div>

        <Panel
          title="Active Dispatch Monitor"
          subtitle="Click any active ride to inspect its event timeline or assign a driver"
          action={
            <Button size="sm" onClick={() => onNavigate('rides/live-map')}>
              Open Live Google Map
            </Button>
          }
        >
          <DataTable
            rows={metrics.activeRides}
            emptyTitle="No Active Rides Currently in Flight"
            emptyDescription="Active trips in requested, searching_driver, driver_assigned, driver_arrived, otp_verified, or ride_started states appear here."
            emptyAction={
              <Button size="sm" onClick={() => onNavigate('rides/manual-assign')}>
                Dispatch New Ride
              </Button>
            }
            columns={[
              { key: 'id', header: 'Ride ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
              { key: 'route', header: 'Pickup -> Drop', render: (r) => <div className="text-xs max-w-xs truncate">{r.pickupAddress} → {r.dropAddress}</div> },
              { key: 'cat', header: 'Vehicle', render: (r) => <span className="uppercase text-xs font-semibold">{r.vehicleCategory}</span> },
              { key: 'driver', header: 'Driver', render: (r) => r.driverId ? <span className="font-mono text-xs">{r.driverId}</span> : <span className="text-xs text-[#B45309]">Unassigned</span> },
              { key: 'status', header: 'Status', render: (r) => <StatusText status={r.status} /> },
              { key: 'fare', header: 'Fare', align: 'right', render: (r) => <span className="font-mono">{formatINR(r.finalFare)}</span> },
            ]}
            onRowClick={(r) => onNavigate('rides/details', r.id)}
          />
        </Panel>
      </div>
    );
  }

  if (pageId === 'dashboard/customer-analytics') {
    const verifiedCount = customers.filter((c) => c.kycStatus === 'verified').length;
    const blockedCount = customers.filter((c) => c.isBlocked).length;
    const totalWallet = customers.reduce((s, c) => s + (c.walletBalance || 0), 0);
    const kycPie = [
      { name: 'Verified', value: verifiedCount, color: '#16A34A' },
      { name: 'Pending', value: customers.filter((c) => c.kycStatus === 'pending').length, color: '#FFC928' },
      { name: 'Rejected', value: customers.filter((c) => c.kycStatus === 'rejected').length, color: '#DC2626' },
    ].filter((x) => x.value > 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Total Customers" value={customers.length} icon={<Users className="w-4 h-4" />} highlight />
          <StatTile label="Verified Customers" value={verifiedCount} tone="green" icon={<CheckCircle2 className="w-4 h-4" />} />
          <StatTile label="Blocked Accounts" value={blockedCount} tone={blockedCount > 0 ? 'red' : 'default'} icon={<ShieldAlert className="w-4 h-4" />} />
          <StatTile label="Aggregate Customer Wallets" value={formatINR(totalWallet)} icon={<IndianRupee className="w-4 h-4" />} />
        </div>
        <Panel title="Customer KYC Distribution" subtitle="Real-time customer verification metrics">
          {kycPie.length === 0 ? (
            <EmptyState
              title="No Customer Analytics Data"
              description="Register or sync customer accounts from the Customer App to view verification distribution."
              action={<Button size="sm" onClick={() => onNavigate('customers/all')}>Manage Customers</Button>}
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={kycPie} dataKey="value" nameKey="name" innerRadius={52} outerRadius={90} paddingAngle={3}>
                    {kycPie.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DarkChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  if (pageId === 'dashboard/driver-analytics') {
    const approved = drivers.filter((d) => d.applicationStatus === 'approved').length;
    const pending = drivers.filter((d) => d.applicationStatus === 'pending' || d.applicationStatus === 'under_review').length;
    const driverCat = [
      { name: 'Bike', count: drivers.filter((d) => d.vehicleCategory === 'bike').length, fill: '#FFC928' },
      { name: 'Auto', count: drivers.filter((d) => d.vehicleCategory === 'auto').length, fill: '#111111' },
      { name: 'Cab', count: drivers.filter((d) => d.vehicleCategory === 'cab').length, fill: '#16A34A' },
    ];
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Total Drivers" value={drivers.length} icon={<Users className="w-4 h-4" />} highlight />
          <StatTile label="Approved Partners" value={approved} tone="green" icon={<UserCheck className="w-4 h-4" />} />
          <StatTile label="Pending Onboarding" value={pending} tone="amber" icon={<Clock className="w-4 h-4" />} />
          <StatTile label="Currently Online" value={metrics.onlineDrivers.length} icon={<Navigation className="w-4 h-4" />} />
        </div>
        <Panel title="Fleet Supply by Category" subtitle="Driver partners across Bike, Auto, and Cab">
          {drivers.length === 0 ? (
            <EmptyState
              title="No Driver Partners Registered"
              description="Onboard driver applications to analyze supply distribution across vehicle categories."
              action={<Button size="sm" onClick={() => onNavigate('drivers/all')}>Open Drivers</Button>}
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={driverCat} barSize={44}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkChartTooltip />} cursor={{ fill: '#F7F8FA' }} />
                  <Bar dataKey="count" name="Drivers" radius={[6, 6, 0, 0]}>
                    {driverCat.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  if (pageId === 'dashboard/revenue-analytics') {
    const verifiedTotal = metrics.verifiedPayments.reduce((s, p) => s + p.amount, 0);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Gross Ride Revenue" value={formatINR(metrics.grossBooking)} icon={<IndianRupee className="w-4 h-4" />} highlight />
          <StatTile label="Verified Provider Payments" value={formatINR(verifiedTotal)} tone="green" icon={<CheckCircle2 className="w-4 h-4" />} />
          <StatTile label="Completed Rides" value={metrics.completedRides.length} icon={<CarFront className="w-4 h-4" />} />
          <StatTile label="Cancelled Rides" value={metrics.cancelledRides.length} tone="red" icon={<ShieldAlert className="w-4 h-4" />} />
        </div>
        <Panel title="Revenue by Vehicle Category" subtitle="Gross fare earned from completed rides">
          {metrics.completedRides.length === 0 ? (
            <EmptyState
              title="No Completed Revenue Recorded"
              description="Revenue analytics compute strictly from rides reaching ride_completed or payment_completed."
              action={<Button size="sm" onClick={() => onNavigate('rides/all')}>View Rides</Button>}
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={categoryBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkChartTooltip currency />} />
                  <Area type="monotone" dataKey="revenue" stroke="#111111" strokeWidth={2} fill="#FFC928" fillOpacity={0.45} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  if (pageId === 'dashboard/commission-analytics') {
    const netDriverPayout = metrics.completedRides.reduce((s, r) => s + (r.driverPayoutAmount || 0), 0);
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatTile label="Platform Commission Earned" value={formatINR(metrics.totalCommission)} tone="green" icon={<IndianRupee className="w-4 h-4" />} highlight />
          <StatTile label="Net Driver Share" value={formatINR(netDriverPayout)} icon={<Users className="w-4 h-4" />} />
          <StatTile
            label="Effective Take Rate"
            value={metrics.grossBooking > 0 ? `${((metrics.totalCommission / metrics.grossBooking) * 100).toFixed(1)}%` : '0.0%'}
            icon={<CarFront className="w-4 h-4" />}
          />
        </div>
        <Panel title="Commission Breakdown by Category" subtitle="Platform commission generated per vehicle tier">
          {metrics.completedRides.length === 0 ? (
            <EmptyState
              title="No Commission Data Yet"
              description="Commission figures populate automatically from immutable ride fare snapshots upon ride completion."
              action={<Button size="sm" onClick={() => onNavigate('pricing/commission')}>Configure Commission Rules</Button>}
            />
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryBreakdown} barSize={44}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} />
                  <YAxis axisLine={false} tickLine={false} />
                  <Tooltip content={<DarkChartTooltip currency />} cursor={{ fill: '#F7F8FA' }} />
                  <Bar dataKey="commission" name="Platform Commission (INR)" fill="#16A34A" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>
    );
  }

  // Page 7: dashboard/city-performance
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Active Cities" value={citySummary.length} icon={<MapPin className="w-4 h-4" />} highlight />
        <StatTile label="Service Zones" value={serviceZones.length} icon={<Navigation className="w-4 h-4" />} />
        <StatTile label="Total Rides" value={rides.length} icon={<CarFront className="w-4 h-4" />} />
        <StatTile label="Gross Revenue" value={formatINR(metrics.grossBooking)} tone="green" icon={<IndianRupee className="w-4 h-4" />} />
      </div>
      <Panel
        title="City Performance Matrix"
        subtitle="Supply, demand, and gross revenue aggregated from real city records"
        action={
          <Button size="sm" onClick={() => onNavigate('vehicles/availability')}>
            Manage Service Zones
          </Button>
        }
      >
        <DataTable
          rows={citySummary.map((c) => ({ id: c.city, ...c }))}
          emptyTitle="No City Performance Data"
          emptyDescription="Add service zones or onboard drivers and rides to track city-level unit economics."
          emptyAction={<Button size="sm" onClick={() => onNavigate('vehicles/availability')}>Add Service Zone</Button>}
          columns={[
            { key: 'city', header: 'City', sortValue: (r) => r.city, render: (r) => <span className="font-semibold">{r.city}</span> },
            { key: 'customers', header: 'Customers', align: 'right', sortValue: (r) => r.customers, render: (r) => r.customers },
            { key: 'drivers', header: 'Drivers', align: 'right', sortValue: (r) => r.drivers, render: (r) => r.drivers },
            { key: 'rides', header: 'Total Rides', align: 'right', sortValue: (r) => r.rides, render: (r) => r.rides },
            { key: 'completed', header: 'Completed', align: 'right', sortValue: (r) => r.completed, render: (r) => r.completed },
            { key: 'revenue', header: 'Revenue', align: 'right', sortValue: (r) => r.revenue, render: (r) => <span className="font-mono">{formatINR(r.revenue)}</span> },
          ]}
        />
      </Panel>
    </div>
  );
};
