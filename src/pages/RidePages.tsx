import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  assignDriverToRideAtomic,
  createRecord,
  transitionRideStatusAtomic,
  updateRecord,
} from '../services/firestoreService';
import { calculateFareBreakdown } from '../lib/pricingEngine';
import {
  ALLOWED_RIDE_TRANSITIONS,
  RIDE_LIFECYCLE_STEPS,
  RIDE_STATUS_LABELS,
} from '../lib/rideStateMachine';
import { formatDateTime, formatINR, sanitizeId } from '../lib/utils';
import {
  Button,
  DataTable,
  EmptyState,
  Field,
  inputCls,
  ModalDialog,
  Panel,
  selectCls,
  StatTile,
  StatusText,
} from '../components/ui/Primitives';
import { LiveRideMapCanvas } from '../components/maps/LiveRideMapCanvas';
import { Ride, RideStatus, VehicleCategory } from '../types/domain';

interface RidePagesProps {
  pageId: string;
  selectedId: string | null;
  onNavigate: (pageId: string, selectedId?: string) => void;
}

const CITY_COORD_DEFAULTS: Record<string, { lat: number; lng: number }> = {
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  delhi: { lat: 28.6139, lng: 77.209 },
  mumbai: { lat: 19.076, lng: 72.8777 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  pune: { lat: 18.5204, lng: 73.8567 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
  lucknow: { lat: 26.8467, lng: 80.9462 },
  patna: { lat: 25.5941, lng: 85.1376 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  surat: { lat: 21.1702, lng: 72.8311 },
};

export const RidePages: React.FC<RidePagesProps> = ({ pageId, selectedId, onNavigate }) => {
  const { user, roleId, can, getToken } = useAuth();
  const {
    rides,
    rideEvents,
    customers,
    drivers,
    driverLocations,
    fareConfigs,
    serviceZones,
    mapsApiKey,
    pushToast,
  } = useData();

  const [createOpen, setCreateOpen] = useState(false);
  const [customerId, setCustomerId] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [category, setCategory] = useState<VehicleCategory>('cab');
  const [pickupAddress, setPickupAddress] = useState('');
  const [dropAddress, setDropAddress] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLng, setPickupLng] = useState('');
  const [dropLat, setDropLat] = useState('');
  const [dropLng, setDropLng] = useState('');
  const [distanceKm, setDistanceKm] = useState('8.5');
  const [durationMin, setDurationMin] = useState('22');
  const [paymentMethod, setPaymentMethod] = useState<Ride['paymentMethod']>('upi');
  const [saving, setSaving] = useState(false);

  const [activeRideId, setActiveRideId] = useState<string>(selectedId || '');
  const [assignDriverByRide, setAssignDriverByRide] = useState<Record<string, string>>({});
  const [reassignDriverId, setReassignDriverId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);

  useEffect(() => {
    if (selectedId) {
      setActiveRideId(selectedId);
    }
  }, [selectedId]);

  // Filters on rides queue
  const [categoryFilter, setCategoryFilter] = useState<'all' | VehicleCategory>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | RideStatus>('all');

  const actor = useMemo(
    () => ({ uid: user?.uid || 'unknown', email: user?.email || 'unknown', roleId }),
    [user, roleId]
  );

  const activeRide = useMemo(
    () => rides.find((r) => r.id === (activeRideId || selectedId)) || rides[0] || null,
    [rides, selectedId, activeRideId]
  );

  const prefillCoordinatesFromZone = () => {
    const cleanCity = city.trim().toLowerCase();
    const zoneMatch = serviceZones.find(
      (z) =>
        z.isActive &&
        z.city.toLowerCase() === cleanCity &&
        typeof z.centerLat === 'number' &&
        typeof z.centerLng === 'number'
    );
    const fallback = CITY_COORD_DEFAULTS[cleanCity];
    const baseLat = zoneMatch?.centerLat ?? fallback?.lat;
    const baseLng = zoneMatch?.centerLng ?? fallback?.lng;
    if (typeof baseLat === 'number' && typeof baseLng === 'number') {
      setPickupLat(Number(baseLat || 0).toFixed(5));
      setPickupLng(Number(baseLng || 0).toFixed(5));
      setDropLat((baseLat + 0.025).toFixed(5));
      setDropLng((baseLng + 0.028).toFixed(5));
      pushToast('info', 'Coordinates Prefilled', `Using ${zoneMatch ? zoneMatch.zoneName : city} hub coordinates.`);
    } else {
      pushToast('info', 'No Saved Coordinates', 'Configure this city in Zone Setup or enter lat/lng manually.');
    }
  };

  const handleCreateRide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('rides', 'write')) {
      pushToast('error', 'Permission Denied', 'Your role cannot dispatch rides.');
      return;
    }
    const cust = customerId || customers[0]?.id;
    if (!cust || !pickupAddress.trim() || !dropAddress.trim()) {
      pushToast('error', 'Validation Error', 'Select a customer and enter pickup & drop addresses.');
      return;
    }

    const pLat = pickupLat.trim() ? Number(pickupLat) : undefined;
    const pLng = pickupLng.trim() ? Number(pickupLng) : undefined;
    const dLat = dropLat.trim() ? Number(dropLat) : undefined;
    const dLng = dropLng.trim() ? Number(dropLng) : undefined;

    if (
      (pLat !== undefined && (!Number.isFinite(pLat) || pLat < -90 || pLat > 90)) ||
      (pLng !== undefined && (!Number.isFinite(pLng) || pLng < -180 || pLng > 180)) ||
      (dLat !== undefined && (!Number.isFinite(dLat) || dLat < -90 || dLat > 90)) ||
      (dLng !== undefined && (!Number.isFinite(dLng) || dLng < -180 || dLng > 180))
    ) {
      pushToast('error', 'Invalid Coordinates', 'Latitude must be -90..90 and longitude -180..180.');
      return;
    }

    const matchedConfig =
      fareConfigs.find(
        (f) => f.isActive && f.vehicleCategory === category && f.city.toLowerCase() === city.trim().toLowerCase()
      ) ||
      fareConfigs.find((f) => f.isActive && f.vehicleCategory === category) || {
        city: city.trim(),
        vehicleCategory: category,
        baseFare: category === 'bike' ? 20 : category === 'auto' ? 30 : 50,
        minimumFare: category === 'bike' ? 30 : category === 'auto' ? 40 : 80,
        perKmRate: category === 'bike' ? 7 : category === 'auto' ? 12 : 16,
        perMinuteRate: category === 'bike' ? 1 : category === 'auto' ? 1.5 : 2,
        waitingChargePerMin: 2,
        surgeMultiplier: 1,
        cancellationFee: 30,
        commissionPct: 20,
      };

    const fare = calculateFareBreakdown({
      config: matchedConfig,
      distanceKm: Number(distanceKm) || 5,
      durationMin: Number(durationMin) || 15,
    });

    setSaving(true);
    try {
      const id = sanitizeId('ride');
      const otpCode = String(Math.floor(1000 + Math.random() * 9000));
      await createRecord(
        'rides',
        id,
        {
          customerId: cust,
          vehicleCategory: category,
          city: city.trim(),
          status: 'searching_driver',
          pickupAddress: pickupAddress.trim(),
          ...(pLat !== undefined && pLng !== undefined ? { pickupLat: pLat, pickupLng: pLng } : {}),
          dropAddress: dropAddress.trim(),
          ...(dLat !== undefined && dLng !== undefined ? { dropLat: dLat, dropLng: dLng } : {}),
          distanceKm: Number(distanceKm) || 5,
          durationMin: Number(durationMin) || 15,
          otpCode,
          finalFare: fare.finalFare,
          commissionAmount: fare.commissionAmount,
          driverPayoutAmount: fare.driverPayoutAmount,
          paymentMethod,
          paymentStatus: 'pending',
        },
        actor,
        'create_ride_dispatch',
        `Created ride ${id} (${category}) with fare snapshot ${formatINR(fare.finalFare)}`
      );
      await createRecord(
        'ride_events',
        sanitizeId('evt'),
        {
          rideId: id,
          fromStatus: 'requested',
          toStatus: 'searching_driver',
          actorUid: actor.uid,
          note: 'Ride created and entered driver matching queue',
        },
        actor,
        'ride_event_init',
        `Initialized lifecycle for ride ${id}`,
        false
      );
      pushToast('success', 'Ride Created', `Ride ${id} queued with fare ${formatINR(fare.finalFare)}.`);
      setPickupAddress('');
      setDropAddress('');
      setPickupLat('');
      setPickupLng('');
      setDropLat('');
      setDropLng('');
      setCreateOpen(false);
    } catch (err) {
      pushToast('error', 'Dispatch Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAssignDriver = async (ride: Ride, drvId: string) => {
    if (!can('rides', 'write')) {
      pushToast('error', 'Permission Denied', 'Ride write permission required.');
      return;
    }
    if (!drvId) {
      pushToast('error', 'Driver Required', 'Select an eligible approved driver.');
      return;
    }
    setSaving(true);
    try {
      await assignDriverToRideAtomic(ride.id, drvId, actor);
      pushToast('success', 'Driver Assigned Atomically', `Ride ${ride.id} assigned to ${drvId}.`);
    } catch (err) {
      pushToast('error', 'Assignment Conflict', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleReassignDriver = async (ride: Ride, newDriverId: string) => {
    if (!can('rides', 'write')) {
      pushToast('error', 'Permission Denied', 'Ride write permission required.');
      return;
    }
    if (!newDriverId || newDriverId === ride.driverId) {
      pushToast('error', 'Select New Driver', 'Choose a different approved driver to reassign.');
      return;
    }
    setSaving(true);
    try {
      await updateRecord(
        'rides',
        ride.id,
        { driverId: newDriverId },
        actor,
        'reassign_ride_driver',
        `Reassigned ride ${ride.id} from ${ride.driverId || 'none'} to ${newDriverId}`
      );
      await createRecord(
        'ride_events',
        sanitizeId('evt'),
        {
          rideId: ride.id,
          fromStatus: ride.status,
          toStatus: ride.status,
          actorUid: actor.uid,
          note: `Admin reassigned driver from ${ride.driverId || 'unassigned'} to ${newDriverId}`,
        },
        actor,
        'ride_event_reassign',
        `Logged driver reassignment on ${ride.id}`,
        false
      );
      pushToast('success', 'Driver Reassigned', `Ride ${ride.id} moved to ${newDriverId}.`);
      setReassignDriverId('');
    } catch (err) {
      pushToast('error', 'Reassignment Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleTransition = async (ride: Ride, nextStatus: RideStatus, reason?: string) => {
    if (!can('rides', 'write')) {
      pushToast('error', 'Permission Denied', 'Insufficient permissions.');
      return;
    }
    setSaving(true);
    try {
      await transitionRideStatusAtomic(
        ride.id,
        nextStatus,
        actor,
        `Admin transitioned ride from ${ride.status} to ${nextStatus}`,
        reason
      );
      pushToast('success', 'Ride Status Updated', `${ride.id} → ${RIDE_STATUS_LABELS[nextStatus]}`);
      setCancelOpen(false);
      setCancelReason('');
    } catch (err) {
      pushToast('error', 'Transition Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const createModal = (
    <ModalDialog
      open={createOpen}
      onOpenChange={setCreateOpen}
      title="Create Ride Dispatch"
      description="Preserves the active city/category fare snapshot on the ride record."
    >
      <form onSubmit={handleCreateRide} className="space-y-4">
        <Field label="Customer">
          <select className={selectCls} value={customerId || customers[0]?.id || ''} onChange={(e) => setCustomerId(e.target.value)} required>
            {customers.length === 0 ? (
              <option value="">No customers registered yet</option>
            ) : (
              customers.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName} ({c.city})</option>
              ))
            )}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} required />
          </Field>
          <Field label="Vehicle Category">
            <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value as VehicleCategory)}>
              <option value="bike">Bike</option>
              <option value="auto">Auto</option>
              <option value="cab">Cab</option>
            </select>
          </Field>
        </div>
        <Field label="Pickup Address">
          <input className={inputCls} value={pickupAddress} onChange={(e) => setPickupAddress(e.target.value)} required placeholder="e.g. Indiranagar Metro Station, Bengaluru" />
        </Field>
        <Field label="Drop Address">
          <input className={inputCls} value={dropAddress} onChange={(e) => setDropAddress(e.target.value)} required placeholder="e.g. Kempegowda International Airport" />
        </Field>

        <div className="p-3 border border-[#E5E7EB] rounded-lg bg-[#FAFAFB] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-[#111111]">GPS Coordinates (Optional · Plots on Live Map)</span>
            <Button type="button" size="sm" variant="outline" onClick={prefillCoordinatesFromZone}>
              Prefill from Zone
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Pickup Lat">
              <input className={inputCls} type="number" step="0.00001" value={pickupLat} onChange={(e) => setPickupLat(e.target.value)} placeholder="12.97160" />
            </Field>
            <Field label="Pickup Lng">
              <input className={inputCls} type="number" step="0.00001" value={pickupLng} onChange={(e) => setPickupLng(e.target.value)} placeholder="77.59460" />
            </Field>
            <Field label="Drop Lat">
              <input className={inputCls} type="number" step="0.00001" value={dropLat} onChange={(e) => setDropLat(e.target.value)} placeholder="12.99660" />
            </Field>
            <Field label="Drop Lng">
              <input className={inputCls} type="number" step="0.00001" value={dropLng} onChange={(e) => setDropLng(e.target.value)} placeholder="77.62260" />
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Distance (km)">
            <input className={inputCls} type="number" step="0.1" min="0.5" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} required />
          </Field>
          <Field label="Duration (min)">
            <input className={inputCls} type="number" step="1" min="1" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} required />
          </Field>
          <Field label="Payment">
            <select className={selectCls} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as Ride['paymentMethod'])}>
              <option value="upi">UPI</option>
              <option value="cash">Cash</option>
              <option value="online">Online</option>
              <option value="wallet">Wallet</option>
            </select>
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={saving || customers.length === 0}>Dispatch Ride</Button>
        </div>
      </form>
    </ModalDialog>
  );

  // Page 27: Live Ride Map
  if (pageId === 'rides/live-map') {
    return (
      <div className="space-y-6">
        <Panel
          title="Live Ride & Fleet GPS Map"
          subtitle="Authorized live driver beacons, pickup pins, and drop points rendered via Google Maps"
          action={
            <div className="flex flex-wrap gap-2">
              {can('rides', 'write') && (
                <Button size="sm" onClick={() => setCreateOpen(true)}>+ Dispatch Ride</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onNavigate('rides/manual-assign')}>
                Manual Assignment
              </Button>
            </div>
          }
        >
          <LiveRideMapCanvas
            apiKey={mapsApiKey}
            driverLocations={driverLocations}
            drivers={drivers}
            activeRides={rides}
            onSelectRide={(id) => onNavigate('rides/details', id)}
          />
        </Panel>
        {createModal}
      </div>
    );
  }

  // Page 33: Ride Details
  if (pageId === 'rides/details') {
    const events = activeRide ? rideEvents.filter((e) => e.rideId === activeRide.id) : [];
    const nextAllowed = activeRide ? ALLOWED_RIDE_TRANSITIONS[activeRide.status] || [] : [];
    const reassignCandidates = activeRide
      ? drivers.filter(
          (d) =>
            d.applicationStatus === 'approved' &&
            !d.isBlocked &&
            d.vehicleCategory === activeRide.vehicleCategory &&
            d.id !== activeRide.driverId
        )
      : [];

    return (
      <div className="space-y-6">
        <Panel
          title="Ride Lifecycle Inspector"
          action={<Button size="sm" variant="outline" onClick={() => onNavigate('rides/all')}>All Rides</Button>}
        >
          {rides.length === 0 ? (
            <EmptyState
              title="No Rides Available"
              description="Dispatch a ride or wait for Customer App bookings to inspect lifecycle events and fare snapshots."
              action={<Button size="sm" onClick={() => setCreateOpen(true)}>Create Ride</Button>}
            />
          ) : (
            <div className="space-y-5">
              <div className="max-w-sm">
                <Field label="Select Ride">
                  <select className={selectCls} value={activeRide?.id || ''} onChange={(e) => setActiveRideId(e.target.value)}>
                    {rides.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.id} · {RIDE_STATUS_LABELS[r.status]} · {formatINR(r.finalFare)}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {activeRide && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatTile label="Status" value={RIDE_STATUS_LABELS[activeRide.status]} />
                    <StatTile label="Final Fare Snapshot" value={formatINR(activeRide.finalFare)} tone="green" />
                    <StatTile label="Platform Commission" value={formatINR(activeRide.commissionAmount || 0)} />
                    <StatTile label="Driver Net Share" value={formatINR(activeRide.driverPayoutAmount || 0)} />
                  </div>

                  <div className="p-4 border border-[#E5E7EB] rounded-xl bg-[#FAFAFB] space-y-3">
                    <div className="text-xs font-semibold text-[#111111]">8-Stage Lifecycle Progression</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                      {RIDE_LIFECYCLE_STEPS.map((step) => {
                        const isCurrent = activeRide.status === step;
                        const currentIdx = RIDE_LIFECYCLE_STEPS.indexOf(activeRide.status);
                        const stepIdx = RIDE_LIFECYCLE_STEPS.indexOf(step);
                        const completed = currentIdx >= 0 && stepIdx <= currentIdx;
                        return (
                          <div
                            key={step}
                            className={`px-2.5 py-2 rounded-lg border text-[11px] font-medium ${
                              isCurrent
                                ? 'bg-[#FFC928] border-[#111111] text-[#111111]'
                                : completed
                                  ? 'bg-[#F0FDF4] border-[#BBF7D0] text-[#16A34A]'
                                  : 'bg-white border-[#E5E7EB] text-[#6B7280]'
                            }`}
                          >
                            {RIDE_STATUS_LABELS[step]}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                    <div className="p-4 border border-[#E5E7EB] rounded-xl space-y-1.5">
                      <div className="font-semibold text-sm text-[#111111]">Trip Coordinates & Parties</div>
                      <div>Customer ID: <span className="font-mono">{activeRide.customerId}</span></div>
                      <div>Driver ID: <span className="font-mono">{activeRide.driverId || 'Unassigned'}</span></div>
                      <div>Pickup: {activeRide.pickupAddress}</div>
                      <div>Drop: {activeRide.dropAddress}</div>
                      <div>
                        Distance / Duration:{' '}
                        <span className="font-mono tabular-nums">
                          {activeRide.distanceKm ?? '—'} km · {activeRide.durationMin ?? '—'} min
                        </span>
                      </div>
                      <div>
                        Payment:{' '}
                        <span className="uppercase font-mono font-semibold">{activeRide.paymentMethod}</span>{' '}
                        ({activeRide.paymentStatus})
                      </div>
                      {typeof activeRide.pickupLat === 'number' && typeof activeRide.pickupLng === 'number' && (
                        <div className="font-mono text-[11px] text-[#6B7280] tabular-nums">
                          GPS: {Number(activeRide.pickupLat || 0).toFixed(4)}, {Number(activeRide.pickupLng || 0).toFixed(4)}
                          {typeof activeRide.dropLat === 'number' && typeof activeRide.dropLng === 'number'
                            ? ` → ${Number(activeRide.dropLat || 0).toFixed(4)}, ${Number(activeRide.dropLng || 0).toFixed(4)}`
                            : ''}
                        </div>
                      )}
                      <div>OTP Verification Code: <span className="font-mono font-semibold">{activeRide.otpCode || '—'}</span></div>
                      {activeRide.cancellationReason && (
                        <div className="text-[#DC2626]">Cancellation Reason: {activeRide.cancellationReason}</div>
                      )}
                    </div>
                    <div className="p-4 border border-[#E5E7EB] rounded-xl space-y-3">
                      <div className="font-semibold text-sm text-[#111111]">Authorized Lifecycle Actions</div>
                      <div className="flex flex-wrap gap-2">
                        {nextAllowed
                          .filter((s) => s !== 'driver_assigned' && !s.startsWith('cancelled'))
                          .map((next) => (
                            <Button
                              key={next}
                              size="sm"
                              disabled={saving || !can('rides', 'write')}
                              onClick={() => handleTransition(activeRide, next)}
                            >
                              Move to {RIDE_STATUS_LABELS[next]}
                            </Button>
                          ))}
                        {nextAllowed.includes('cancelled_by_admin') && (
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={saving || !can('rides', 'write')}
                            onClick={() => setCancelOpen(true)}
                          >
                            Cancel Ride
                          </Button>
                        )}
                      </div>

                      {(activeRide.status === 'driver_assigned' || activeRide.status === 'driver_arrived') &&
                        can('rides', 'write') && (
                          <div className="pt-3 border-t border-[#F3F4F6] space-y-2">
                            <div className="text-xs font-semibold text-[#111111]">Reassign Driver (Pre-Trip)</div>
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg flex-1 min-w-[180px]"
                                value={reassignDriverId || reassignCandidates[0]?.id || ''}
                                onChange={(e) => setReassignDriverId(e.target.value)}
                              >
                                {reassignCandidates.length === 0 ? (
                                  <option value="">No other approved {activeRide.vehicleCategory} drivers</option>
                                ) : (
                                  reassignCandidates.map((d) => (
                                    <option key={d.id} value={d.id}>
                                      {d.fullName} ({d.city})
                                    </option>
                                  ))
                                )}
                              </select>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={saving || reassignCandidates.length === 0}
                                onClick={() =>
                                  handleReassignDriver(
                                    activeRide,
                                    reassignDriverId || reassignCandidates[0]?.id || ''
                                  )
                                }
                              >
                                Reassign Driver
                              </Button>
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Ride Event Audit Log" subtitle="Immutable state transition events">
          <DataTable
            rows={events}
            emptyTitle="No Ride Events Logged"
            emptyDescription="Every state change records an immutable ride_events entry."
            columns={[
              { key: 'from', header: 'From', render: (e) => e.fromStatus || 'init' },
              { key: 'to', header: 'To', render: (e) => <StatusText status={e.toStatus} /> },
              { key: 'actor', header: 'Actor UID', render: (e) => <span className="font-mono text-xs">{e.actorUid}</span> },
              { key: 'note', header: 'Note', render: (e) => e.note || '—' },
              { key: 'dt', header: 'Timestamp', render: (e) => <span className="text-xs text-[#6B7280]">{formatDateTime(e.createdAt)}</span> },
            ]}
          />
        </Panel>

        <ModalDialog open={cancelOpen} onOpenChange={setCancelOpen} title="Cancel Ride as Admin">
          <div className="space-y-4">
            <Field label="Cancellation Reason">
              <input className={inputCls} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="e.g. Driver vehicle breakdown or customer requested cancel" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCancelOpen(false)}>Back</Button>
              <Button
                variant="danger"
                disabled={saving || cancelReason.trim().length < 3 || !activeRide}
                onClick={() => activeRide && handleTransition(activeRide, 'cancelled_by_admin', cancelReason.trim())}
              >
                Confirm Cancellation
              </Button>
            </div>
          </div>
        </ModalDialog>
        {createModal}
      </div>
    );
  }

  // Page 34: Manual Ride Assignment
  if (pageId === 'rides/manual-assign') {
    const assignable = rides.filter((r) => r.status === 'requested' || r.status === 'searching_driver');
    return (
      <div className="space-y-6">
        <Panel
          title="Manual Ride Assignment"
          subtitle="Atomic assignment prevents multiple drivers from accepting the same ride"
          action={can('rides', 'write') ? <Button size="sm" onClick={() => setCreateOpen(true)}>+ Dispatch Ride</Button> : undefined}
        >
          {assignable.length === 0 ? (
            <EmptyState
              title="No Unassigned Pending Rides"
              description="Rides in requested or searching_driver status appear here for manual atomic assignment."
              action={can('rides', 'write') ? <Button size="sm" onClick={() => setCreateOpen(true)}>Create Ride Dispatch</Button> : undefined}
            />
          ) : (
            <div className="space-y-3">
              {assignable.map((ride) => {
                const matchingDrivers = drivers.filter(
                  (d) =>
                    d.applicationStatus === 'approved' &&
                    !d.isBlocked &&
                    d.vehicleCategory === ride.vehicleCategory
                );
                return (
                  <div
                    key={ride.id}
                    className="p-4 border border-[#E5E7EB] rounded-xl bg-white flex flex-wrap items-center justify-between gap-4"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm text-[#111111]">{ride.id}</span>
                        <StatusText status={ride.status} />
                        <span className="uppercase font-semibold">{ride.vehicleCategory}</span>
                      </div>
                      <div className="text-[#4B5563]">{ride.pickupAddress} → {ride.dropAddress}</div>
                      <div className="text-[#6B7280] font-mono">Fare Snapshot: {formatINR(ride.finalFare)} · City: {ride.city}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        className="h-9 px-3 text-sm bg-white border border-[#D1D5DB] rounded-lg"
                        value={assignDriverByRide[ride.id] || matchingDrivers[0]?.id || ''}
                        onChange={(e) =>
                          setAssignDriverByRide((prev) => ({ ...prev, [ride.id]: e.target.value }))
                        }
                      >
                        {matchingDrivers.length === 0 ? (
                          <option value="">No approved {ride.vehicleCategory} drivers</option>
                        ) : (
                          matchingDrivers.map((d) => (
                            <option key={d.id} value={d.id}>{d.fullName} ({d.city})</option>
                          ))
                        )}
                      </select>
                      <Button
                        size="sm"
                        disabled={saving || matchingDrivers.length === 0 || !can('rides', 'write')}
                        onClick={() =>
                          handleAssignDriver(
                            ride,
                            assignDriverByRide[ride.id] || matchingDrivers[0]?.id || ''
                          )
                        }
                      >
                        Assign Atomically
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        {createModal}
      </div>
    );
  }

  // Filtered Ride Queues (Pages 26, 28, 29, 30, 31, 32)
  const filterMap: Record<string, (r: Ride) => boolean> = {
    'rides/all': () => true,
    'rides/pending': (r) => r.status === 'requested' || r.status === 'searching_driver',
    'rides/accepted': (r) => r.status === 'driver_assigned' || r.status === 'driver_arrived' || r.status === 'otp_verified',
    'rides/ongoing': (r) => r.status === 'ride_started',
    'rides/completed': (r) => r.status === 'ride_completed' || r.status === 'payment_completed',
    'rides/cancelled': (r) => r.status.startsWith('cancelled'),
  };

  const baseQueue = rides.filter(filterMap[pageId] || (() => true));
  const filteredRides = baseQueue.filter((r) => {
    if (categoryFilter !== 'all' && r.vehicleCategory !== categoryFilter) return false;
    if (pageId === 'rides/all' && statusFilter !== 'all' && r.status !== statusFilter) return false;
    return true;
  });

  const exportRidesCsv = () => {
    const header = ['RideID', 'City', 'Category', 'Status', 'CustomerID', 'DriverID', 'Pickup', 'Drop', 'FareINR', 'PaymentMethod'];
    const lines = [
      header.join(','),
      ...filteredRides.map((r) =>
        [
          r.id,
          r.city,
          r.vehicleCategory,
          r.status,
          r.customerId,
          r.driverId || '',
          r.pickupAddress,
          r.dropAddress,
          r.finalFare,
          r.paymentMethod,
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shine-cab-rides-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Rides CSV Exported', `${filteredRides.length} ride rows downloaded.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Matching Rides" value={filteredRides.length} />
        <StatTile label="Pending Match" value={rides.filter((r) => r.status === 'requested' || r.status === 'searching_driver').length} tone="amber" />
        <StatTile label="Ongoing Trips" value={rides.filter((r) => r.status === 'ride_started').length} tone="green" />
        <StatTile label="Cancelled" value={rides.filter((r) => r.status.startsWith('cancelled')).length} tone="red" />
      </div>
      <Panel
        title="Rides Ledger"
        subtitle="Click any ride to inspect full timeline, OTP, and lifecycle actions"
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportRidesCsv}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate('rides/live-map')}>Live Map</Button>
            {can('rides', 'write') && <Button size="sm" onClick={() => setCreateOpen(true)}>+ Dispatch Ride</Button>}
          </div>
        }
      >
        <DataTable
          rows={filteredRides}
          filterControls={
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter by vehicle category"
                className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as 'all' | VehicleCategory)}
              >
                <option value="all">All Categories</option>
                <option value="bike">Bike</option>
                <option value="auto">Auto</option>
                <option value="cab">Cab</option>
              </select>
              {pageId === 'rides/all' && (
                <select
                  aria-label="Filter by ride status"
                  className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as 'all' | RideStatus)}
                >
                  <option value="all">All Statuses</option>
                  {Object.entries(RIDE_STATUS_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              )}
            </div>
          }
          emptyTitle="No Rides in This Queue"
          emptyDescription="Rides matching this lifecycle stage will appear here in real time."
          columns={[
            { key: 'id', header: 'Ride ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
            { key: 'city', header: 'City', render: (r) => r.city },
            { key: 'cat', header: 'Category', render: (r) => <span className="uppercase text-xs font-semibold">{r.vehicleCategory}</span> },
            { key: 'route', header: 'Route', render: (r) => <div className="text-xs max-w-xs truncate">{r.pickupAddress} → {r.dropAddress}</div> },
            { key: 'status', header: 'Status', render: (r) => <StatusText status={RIDE_STATUS_LABELS[r.status] || r.status} /> },
            { key: 'fare', header: 'Fare', align: 'right', render: (r) => <span className="font-mono font-medium tabular-nums">{formatINR(r.finalFare)}</span> },
          ]}
          onRowClick={(r) => onNavigate('rides/details', r.id)}
        />
      </Panel>
      {createModal}
    </div>
  );
};
