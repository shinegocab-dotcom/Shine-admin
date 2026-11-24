import React, { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { createRecord, deleteRecord, updateRecord } from '../services/firestoreService';
import { calculateFareBreakdown, FareCalculationResult } from '../lib/pricingEngine';
import { cn, formatDateTime, formatINR, sanitizeId } from '../lib/utils';
import {
  Button,
  ConfirmDialog,
  DataTable,
  Field,
  inputCls,
  ModalDialog,
  Panel,
  selectCls,
  StatTile,
  StatusText,
} from '../components/ui/Primitives';
import { FareConfig, VehicleCategory } from '../types/domain';

interface PricingPagesProps {
  pageId: string;
}

export const PricingPages: React.FC<PricingPagesProps> = ({ pageId }) => {
  const { user, roleId, can } = useAuth();
  const { fareConfigs, auditLogs, pushToast } = useData();

  const [catFilter, setCatFilter] = useState<'all' | VehicleCategory>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FareConfig | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FareConfig | null>(null);

  const [city, setCity] = useState('Bengaluru');
  const [vehicleCategory, setVehicleCategory] = useState<VehicleCategory>('cab');
  const [baseFare, setBaseFare] = useState('50');
  const [minimumFare, setMinimumFare] = useState('80');
  const [perKmRate, setPerKmRate] = useState('16');
  const [perMinuteRate, setPerMinuteRate] = useState('2');
  const [waitingChargePerMin, setWaitingChargePerMin] = useState('2');
  const [surgeMultiplier, setSurgeMultiplier] = useState('1.0');
  const [cancellationFee, setCancellationFee] = useState('35');
  const [commissionPct, setCommissionPct] = useState('20');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  // Live fare simulator state
  const [simKm, setSimKm] = useState('10');
  const [simMin, setSimMin] = useState('25');
  const [simWait, setSimWait] = useState('2');
  const [simResult, setSimResult] = useState<FareCalculationResult | null>(null);

  const actor = useMemo(
    () => ({ uid: user?.uid || 'unknown', email: user?.email || 'unknown', roleId }),
    [user, roleId]
  );

  const distinctCities = useMemo(
    () => Array.from(new Set(fareConfigs.map((f) => f.city).filter(Boolean))).sort(),
    [fareConfigs]
  );

  const filteredConfigs = useMemo(
    () =>
      fareConfigs.filter((f) => {
        if (catFilter !== 'all' && f.vehicleCategory !== catFilter) return false;
        if (cityFilter !== 'all' && f.city !== cityFilter) return false;
        return true;
      }),
    [fareConfigs, catFilter, cityFilter]
  );

  const pricingAuditLogs = useMemo(
    () => auditLogs.filter((l) => l.entityType === 'fare_configs').slice(0, 15),
    [auditLogs]
  );

  const openEditor = (cfg?: FareConfig) => {
    if (cfg) {
      setEditing(cfg);
      setCity(cfg.city);
      setVehicleCategory(cfg.vehicleCategory);
      setBaseFare(String(cfg.baseFare));
      setMinimumFare(String(cfg.minimumFare));
      setPerKmRate(String(cfg.perKmRate));
      setPerMinuteRate(String(cfg.perMinuteRate));
      setWaitingChargePerMin(String(cfg.waitingChargePerMin));
      setSurgeMultiplier(String(cfg.surgeMultiplier));
      setCancellationFee(String(cfg.cancellationFee));
      setCommissionPct(String(cfg.commissionPct));
      setEffectiveFrom(cfg.effectiveFrom || new Date().toISOString().slice(0, 10));
    } else {
      setEditing(null);
      setCity('Bengaluru');
      setVehicleCategory('cab');
      setBaseFare('50');
      setMinimumFare('80');
      setPerKmRate('16');
      setPerMinuteRate('2');
      setWaitingChargePerMin('2');
      setSurgeMultiplier('1.0');
      setCancellationFee('35');
      setCommissionPct('20');
      setEffectiveFrom(new Date().toISOString().slice(0, 10));
    }
    setModalOpen(true);
  };

  const handleSaveFare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('pricing', 'write')) {
      pushToast('error', 'Permission Denied', 'Pricing write permission required.');
      return;
    }
    const payload = {
      city: city.trim(),
      vehicleCategory,
      baseFare: Number(baseFare),
      minimumFare: Number(minimumFare),
      perKmRate: Number(perKmRate),
      perMinuteRate: Number(perMinuteRate),
      waitingChargePerMin: Number(waitingChargePerMin),
      surgeMultiplier: Number(surgeMultiplier),
      cancellationFee: Number(cancellationFee),
      commissionPct: Number(commissionPct),
      effectiveFrom,
      isActive: true,
      updatedBy: actor.uid,
    };

    if (
      payload.surgeMultiplier < 1 ||
      payload.surgeMultiplier > 5 ||
      payload.commissionPct < 0 ||
      payload.commissionPct > 50 ||
      payload.baseFare < 0
    ) {
      pushToast('error', 'Validation Failed', 'Surge must be 1.0x–5.0x and commission 0%–50%.');
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await updateRecord(
          'fare_configs',
          editing.id,
          {
            baseFare: payload.baseFare,
            minimumFare: payload.minimumFare,
            perKmRate: payload.perKmRate,
            perMinuteRate: payload.perMinuteRate,
            waitingChargePerMin: payload.waitingChargePerMin,
            surgeMultiplier: payload.surgeMultiplier,
            cancellationFee: payload.cancellationFee,
            commissionPct: payload.commissionPct,
            effectiveFrom: payload.effectiveFrom,
            isActive: editing.isActive,
            updatedBy: actor.uid,
          },
          actor,
          'update_fare_config',
          `Updated ${payload.city} ${payload.vehicleCategory} fare rules (Base: ${formatINR(payload.baseFare)}, Comm: ${payload.commissionPct}%)`
        );
        pushToast('success', 'Fare Rule Updated', `${payload.city} · ${payload.vehicleCategory.toUpperCase()}`);
      } else {
        const id = sanitizeId('fare');
        await createRecord(
          'fare_configs',
          id,
          payload,
          actor,
          'create_fare_config',
          `Created ${payload.city} ${payload.vehicleCategory} fare rule effective ${effectiveFrom}`
        );
        pushToast('success', 'Fare Rule Published', `${payload.city} · ${payload.vehicleCategory.toUpperCase()}`);
      }
      setModalOpen(false);
    } catch (err) {
      pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleFareActive = async (cfg: FareConfig) => {
    if (!can('pricing', 'write')) return;
    try {
      await updateRecord(
        'fare_configs',
        cfg.id,
        { isActive: !cfg.isActive, updatedBy: actor.uid },
        actor,
        'toggle_fare_rule',
        `${!cfg.isActive ? 'Activated' : 'Paused'} ${cfg.city} ${cfg.vehicleCategory} fare rule`
      );
      pushToast('success', 'Rule Status Updated', `${cfg.city} ${cfg.vehicleCategory} is now ${!cfg.isActive ? 'active' : 'paused'}.`);
    } catch (err) {
      pushToast('error', 'Update Failed', err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleDeleteFare = async () => {
    if (!deleteTarget || !can('pricing', 'write')) return;
    setSaving(true);
    try {
      await deleteRecord(
        'fare_configs',
        deleteTarget.id,
        actor,
        'delete_fare_config',
        `Deleted ${deleteTarget.city} ${deleteTarget.vehicleCategory} fare rule`
      );
      pushToast('success', 'Fare Rule Deleted', `${deleteTarget.city} (${deleteTarget.vehicleCategory})`);
      setDeleteTarget(null);
    } catch (err) {
      pushToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const runPreview = (cfg: FareConfig) => {
    const res = calculateFareBreakdown({
      config: cfg,
      distanceKm: Number(simKm) || 10,
      durationMin: Number(simMin) || 25,
      waitingMin: Number(simWait) || 0,
    });
    setSimResult(res);
  };

  const pageFocusLabel: Record<string, string> = {
    'pricing/base-fare': 'Base Fare Configuration',
    'pricing/per-km': 'Per KM Fare Configuration',
    'pricing/per-minute': 'Per Minute & Waiting Fare Configuration',
    'pricing/minimum-fare': 'Minimum Fare Floor Configuration',
    'pricing/surge': 'Surge Multiplier Governance',
    'pricing/commission': 'Driver & Platform Commission Configuration',
    'pricing/cancellation': 'Cancellation Charges Configuration',
  };

  return (
    <div className="space-y-6">
      {pageId === "pricing/cancellation" && (
        <div className="rounded-2xl border border-rose-300 bg-rose-50/70 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#111111]">SHINE CAB Cancellation Charges Control (INR)</h3>
              <p className="text-xs text-neutral-600">Configure rider late-stage cancellation fee for Bike, Auto & Cab. Applied when a trip is cancelled after driver dispatch.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 10, 20, 30].map((fee) => (
                <button
                  key={fee}
                  type="button"
                  onClick={async () => {
                    for (const cfg of fareConfigs) {
                      await updateRecord(
                        "fare_configs",
                        cfg.id,
                        { cancellationFee: fee, updatedBy: actor.uid },
                        actor,
                        "bulk_cancellation_fee_update",
                        `Set ${cfg.city} ${cfg.vehicleCategory} cancellation fee to ₹${fee}`
                      );
                    }
                    pushToast("success", "Cancellation Fee Updated", `All vehicle categories updated to ₹${fee} cancellation fee.`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#111111] text-white text-xs font-bold hover:bg-neutral-800 cursor-pointer"
                >
                  {fee === 0 ? "₹0 Free Cancel" : `Set ₹${fee} All`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {(["bike", "auto", "cab"] as const).map((cat) => {
              const cfg = fareConfigs.find((f) => String(f.vehicleCategory || "").toLowerCase() === cat);
              const fee = Number(cfg?.cancellationFee ?? 10);
              const title = cat === "bike" ? "Bike Cancellation" : cat === "auto" ? "Auto Cancellation" : "Cab Cancellation";
              return (
                <div key={cat} className="rounded-xl bg-white border border-rose-200 p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#111111]">{title}</div>
                    <div className="text-[11px] text-neutral-600 mt-0.5">
                      Penalty Fee: <strong className="text-rose-700">₹{fee}</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (cfg) {
                        openEdit(cfg);
                      } else {
                        setCity("Thakur Gangti");
                        setVehicleCategory(cat);
                        setBaseFare(String(cat === "bike" ? 15 : cat === "auto" ? 25 : 50));
                        setMinimumFare(String(cat === "bike" ? 20 : cat === "auto" ? 35 : 70));
                        setPerKmRate(String(cat === "bike" ? 7 : cat === "auto" ? 12 : 16));
                        setPerMinuteRate("1");
                        setWaitingChargePerMin("1");
                        setSurgeMultiplier("1");
                        setCancellationFee("10");
                        setCommissionPct("15");
                        setModalOpen(true);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 cursor-pointer"
                  >
                    Edit ₹
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pageId === "pricing/commission" && (
        <div className="rounded-2xl border border-emerald-300 bg-emerald-50/70 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-[#111111]">SHINE CAB Driver & Platform Commission Control (0% – 50%)</h3>
              <p className="text-xs text-neutral-600">Set platform commission percentage for Bike, Auto & Cab. Driver receives the remaining percentage directly in wallet earnings.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[0, 10, 15, 20].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={async () => {
                    for (const cfg of fareConfigs) {
                      await updateRecord(
                        "fare_configs",
                        cfg.id,
                        { commissionPct: pct, updatedBy: actor.uid },
                        actor,
                        "bulk_commission_update",
                        `Set ${cfg.city} ${cfg.vehicleCategory} platform commission to ${pct}%`
                      );
                    }
                    pushToast("success", "Commission Updated", `All vehicle categories updated to ${pct}% platform commission (Driver keeps ${100 - pct}%).`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#111111] text-white text-xs font-bold hover:bg-neutral-800 cursor-pointer"
                >
                  {pct === 0 ? "0% Launch Offer" : `Set ${pct}% All`}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {(["bike", "auto", "cab"] as const).map((cat) => {
              const cfg = fareConfigs.find((f) => String(f.vehicleCategory || "").toLowerCase() === cat);
              const comm = Number(cfg?.commissionPct ?? 15);
              const driverShare = Math.max(0, 100 - comm);
              const title = cat === "bike" ? "Bike Captain" : cat === "auto" ? "Auto Captain" : "Cab Captain";
              return (
                <div key={cat} className="rounded-xl bg-white border border-emerald-200 p-3.5 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold text-[#111111]">{title}</div>
                    <div className="text-[11px] text-neutral-600 mt-0.5">
                      Platform: <strong className="text-emerald-700">{comm}%</strong> · Driver: <strong className="text-[#111111]">{driverShare}%</strong>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (cfg) {
                        openEdit(cfg);
                      } else {
                        setCity("Thakur Gangti");
                        setVehicleCategory(cat);
                        setBaseFare(String(cat === "bike" ? 15 : cat === "auto" ? 25 : 50));
                        setMinimumFare(String(cat === "bike" ? 20 : cat === "auto" ? 35 : 70));
                        setPerKmRate(String(cat === "bike" ? 7 : cat === "auto" ? 12 : 16));
                        setPerMinuteRate("1");
                        setWaitingChargePerMin("1");
                        setSurgeMultiplier("1");
                        setCancellationFee("10");
                        setCommissionPct("15");
                        setModalOpen(true);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 cursor-pointer"
                  >
                    Edit %
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {pageId === "pricing/surge" && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/70 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-[#111111]">Live Surge Multiplier Control (1.0x – 5.0x)</h3>
              <p className="text-xs text-neutral-600">Instantly adjust peak demand surge multiplier for Bike, Auto & Cab across all active routes.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[1.0, 1.2, 1.5, 2.0].map((mult) => (
                <button
                  key={mult}
                  type="button"
                  onClick={async () => {
                    for (const cfg of fareConfigs) {
                      await updateRecord(
                        "fare_configs",
                        cfg.id,
                        { surgeMultiplier: mult, updatedBy: actor.uid },
                        actor,
                        "bulk_surge_update",
                        `Set ${cfg.city} ${cfg.vehicleCategory} surge to ${mult}x`
                      );
                    }
                    pushToast("success", "Surge Updated", `All active vehicle categories set to ${mult}x surge.`);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-[#111111] text-white text-xs font-bold hover:bg-neutral-800 cursor-pointer"
                >
                  Apply {mult.toFixed(1)}x All
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Quick Bike, Auto & Cab Rate Setter Cards for Every Pricing Page */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["bike", "auto", "cab"] as const).map((cat) => {
          const existing = fareConfigs.find((f) => String(f.vehicleCategory || "").toLowerCase() === cat);
          const label = cat === "bike" ? "Bike (2-Wheeler)" : cat === "auto" ? "Auto Rickshaw" : "Cab (4-Wheeler)";
          const focusBadge =
            pageId === "pricing/per-minute"
              ? `₹${existing?.perMinuteRate ?? 1}/min · Wait ₹${existing?.waitingChargePerMin ?? 1}/m`
              : pageId === "pricing/per-km"
              ? `₹${existing?.perKmRate ?? (cat === "bike" ? 7 : cat === "auto" ? 12 : 16)}/km`
              : pageId === "pricing/minimum-fare"
              ? `Min ₹${existing?.minimumFare ?? (cat === "bike" ? 20 : cat === "auto" ? 35 : 70)}`
              : pageId === "pricing/surge"
              ? `Surge ${existing?.surgeMultiplier ?? 1}x`
              : pageId === "pricing/commission"
              ? `Comm ${existing?.commissionPct ?? 15}%`
              : pageId === "pricing/cancellation"
              ? `Cancel ₹${existing?.cancellationFee ?? 10}`
              : `Base ₹${existing?.baseFare ?? (cat === "bike" ? 15 : cat === "auto" ? 25 : 50)}`;
          return (
            <div key={cat} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#111111]">{label}</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#FFC928]/25 text-[#111111]">
                    {focusBadge}
                  </span>
                </div>
                <p className="mt-2 text-xs text-neutral-600 leading-relaxed">
                  Base: <strong>₹{existing?.baseFare ?? (cat === "bike" ? 15 : cat === "auto" ? 25 : 50)}</strong> · Per KM: <strong>₹{existing?.perKmRate ?? (cat === "bike" ? 7 : cat === "auto" ? 12 : 16)}</strong> · Per Min: <strong>₹{existing?.perMinuteRate ?? 1}</strong> · Wait: <strong>₹{existing?.waitingChargePerMin ?? 1}/m</strong> · Min: <strong>₹{existing?.minimumFare ?? (cat === "bike" ? 20 : cat === "auto" ? 35 : 70)}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (existing) {
                    openEdit(existing);
                  } else {
                    setCity("Thakur Gangti");
                    setVehicleCategory(cat);
                    setBaseFare(String(cat === "bike" ? 15 : cat === "auto" ? 25 : 50));
                    setMinimumFare(String(cat === "bike" ? 20 : cat === "auto" ? 35 : 70));
                    setPerKmRate(String(cat === "bike" ? 7 : cat === "auto" ? 12 : 16));
                    setPerMinuteRate("1");
                    setWaitingChargePerMin("1");
                    setSurgeMultiplier("1");
                    setCancellationFee("10");
                    setCommissionPct("15");
                    setModalOpen(true);
                  }
                }}
                className="w-full py-2 px-3 rounded-xl bg-[#111111] text-white text-xs font-semibold hover:bg-neutral-800 cursor-pointer"
              >
                {existing ? `Edit ${label} Rates` : `+ Set ${label} Rates`}
              </button>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Active Fare Rules" value={fareConfigs.filter((f) => f.isActive).length} highlight />
        <StatTile
          label="Avg Surge Multiplier"
          value={
            fareConfigs.length > 0
              ? `${(fareConfigs.reduce((s, f) => s + f.surgeMultiplier, 0) / fareConfigs.length).toFixed(2)}x`
              : '1.00x'
          }
        />
        <StatTile
          label="Avg Commission"
          value={
            fareConfigs.length > 0
              ? `${(fareConfigs.reduce((s, f) => s + f.commissionPct, 0) / fareConfigs.length).toFixed(1)}%`
              : '0.0%'
          }
        />
        <StatTile label="Snapshot Guarantee" value="Immutable" detail="Existing rides keep original fare" tone="green" />
      </div>

      <Panel
        title={pageFocusLabel[pageId] || 'Fare & Commission Rules'}
        subtitle="Server-validated pricing engine with effective dates, active toggles, and audit history"
        action={can('pricing', 'write') ? <Button size="sm" onClick={() => openEditor()}>+ New Fare Rule</Button> : undefined}
      >
        <DataTable
          rows={filteredConfigs}
          filterControls={
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg">
                {(['all', 'bike', 'auto', 'cab'] as const).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCatFilter(cat)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium uppercase rounded-md transition-colors cursor-pointer whitespace-nowrap',
                      catFilter === cat ? 'bg-[#111111] text-white' : 'text-[#4B5563] hover:text-[#111111]'
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              {distinctCities.length > 0 && (
                <select
                  aria-label="Filter by city"
                  className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                >
                  <option value="all">All Cities</option>
                  {distinctCities.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              )}
            </div>
          }
          emptyTitle="No Pricing Rules Configured"
          emptyDescription="Create Bike, Auto, and Cab fare rules per city to power Customer App estimates and Driver App payouts."
          emptyAction={can('pricing', 'write') ? <Button size="sm" onClick={() => openEditor()}>Create Fare Config</Button> : undefined}
          columns={[
            { key: 'city', header: 'City / Category', render: (f) => <div><div className="font-semibold">{f.city}</div><div className="text-xs uppercase text-[#6B7280]">{f.vehicleCategory}</div></div> },
            { key: 'base', header: 'Base / Min', align: 'right', render: (f) => <span className="font-mono">{formatINR(f.baseFare)} / {formatINR(f.minimumFare)}</span> },
            { key: 'rates', header: 'KM / Min / Wait', align: 'right', render: (f) => <span className="font-mono text-xs">{formatINR(f.perKmRate)} · {formatINR(f.perMinuteRate)} · {formatINR(f.waitingChargePerMin)}</span> },
            { key: 'surge', header: 'Surge', align: 'right', render: (f) => <span className="font-mono font-semibold">{f.surgeMultiplier.toFixed(2)}x</span> },
            { key: 'comm', header: 'Commission', align: 'right', render: (f) => <span className="font-mono">{f.commissionPct}%</span> },
            { key: 'cancel', header: 'Cancel Fee', align: 'right', render: (f) => <span className="font-mono">{formatINR(f.cancellationFee)}</span> },
            { key: 'state', header: 'State', render: (f) => <StatusText status={f.isActive ? 'active' : 'suspended'} /> },
            {
              key: 'act',
              header: 'Actions',
              align: 'right',
              render: (f) => (
                <div className="inline-flex gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => runPreview(f)}>Simulate</Button>
                  {can('pricing', 'write') && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => toggleFareActive(f)}>
                        {f.isActive ? 'Pause' : 'Enable'}
                      </Button>
                      <Button size="sm" onClick={() => openEditor(f)}>Edit</Button>
                      <Button size="sm" variant="danger" onClick={() => setDeleteTarget(f)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Panel>

      <Panel title="Fare & Commission Calculation Preview" subtitle="Test trip pricing against any active rule above">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Field label="Distance (km)">
            <input className={inputCls} type="number" min="0" step="0.5" value={simKm} onChange={(e) => setSimKm(e.target.value)} />
          </Field>
          <Field label="Trip Duration (min)">
            <input className={inputCls} type="number" min="0" step="1" value={simMin} onChange={(e) => setSimMin(e.target.value)} />
          </Field>
          <Field label="Waiting Time (min)">
            <input className={inputCls} type="number" min="0" step="1" value={simWait} onChange={(e) => setSimWait(e.target.value)} />
          </Field>
        </div>
        {simResult ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 border border-[#E5E7EB] rounded-xl bg-[#FAFAFB] text-xs">
            <div><span className="text-[#6B7280]">Base + Dist + Time</span><div className="font-mono font-semibold text-sm mt-0.5">{formatINR(simResult.subtotalBeforeSurge)}</div></div>
            <div><span className="text-[#6B7280]">Surge ({simResult.surgeMultiplier}x)</span><div className="font-mono font-semibold text-sm mt-0.5">{formatINR(simResult.surgeAmount)}</div></div>
            <div><span className="text-[#6B7280]">Final Customer Fare</span><div className="font-mono font-bold text-sm mt-0.5 text-[#111111]">{formatINR(simResult.finalFare)}</div></div>
            <div><span className="text-[#6B7280]">Platform ({simResult.commissionPct}%)</span><div className="font-mono font-semibold text-sm mt-0.5 text-[#16A34A]">{formatINR(simResult.commissionAmount)}</div></div>
            <div><span className="text-[#6B7280]">Driver Payout</span><div className="font-mono font-semibold text-sm mt-0.5">{formatINR(simResult.driverPayoutAmount)}</div></div>
          </div>
        ) : (
          <div className="text-xs text-[#6B7280]">Click "Simulate" on any fare rule row above to preview fare and commission breakdown.</div>
        )}
      </Panel>

      <Panel title="Pricing Change Audit History" subtitle="Immutable history of fare and commission updates">
        <DataTable
          rows={pricingAuditLogs}
          pageSize={5}
          emptyTitle="No Pricing Changes Logged"
          emptyDescription="Creating, editing, or pausing fare rules appends an audit record here."
          columns={[
            { key: 'action', header: 'Action', render: (l) => <span className="font-mono text-xs font-semibold">{l.action}</span> },
            { key: 'actor', header: 'Admin', render: (l) => <span className="text-xs">{l.actorEmail || l.actorUid}</span> },
            { key: 'summary', header: 'Summary', render: (l) => <span className="text-xs text-[#4B5563]">{l.summary || '—'}</span> },
            { key: 'dt', header: 'Timestamp', render: (l) => <span className="text-xs text-[#6B7280]">{formatDateTime(l.createdAt)}</span> },
          ]}
        />
      </Panel>

      <ModalDialog
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={editing ? `Edit ${editing.city} ${editing.vehicleCategory.toUpperCase()} Fare Rule` : 'Create City Fare Rule'}
      >
        <form onSubmit={handleSaveFare} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="City">
              <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} required disabled={Boolean(editing)} />
            </Field>
            <Field label="Vehicle Category">
              <select className={selectCls} value={vehicleCategory} onChange={(e) => setVehicleCategory(e.target.value as VehicleCategory)} disabled={Boolean(editing)}>
                <option value="bike">Bike</option>
                <option value="auto">Auto</option>
                <option value="cab">Cab</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Base Fare (INR)"><input className={inputCls} type="number" step="0.5" min="0" value={baseFare} onChange={(e) => setBaseFare(e.target.value)} required /></Field>
            <Field label="Minimum Fare (INR)"><input className={inputCls} type="number" step="0.5" min="0" value={minimumFare} onChange={(e) => setMinimumFare(e.target.value)} required /></Field>
            <Field label="Per KM Rate (INR)"><input className={inputCls} type="number" step="0.5" min="0" value={perKmRate} onChange={(e) => setPerKmRate(e.target.value)} required /></Field>
            <Field label="Per Minute Rate (INR)"><input className={inputCls} type="number" step="0.5" min="0" value={perMinuteRate} onChange={(e) => setPerMinuteRate(e.target.value)} required /></Field>
            <Field label="Waiting Charge / Min"><input className={inputCls} type="number" step="0.5" min="0" value={waitingChargePerMin} onChange={(e) => setWaitingChargePerMin(e.target.value)} required /></Field>
            <Field label="Surge Multiplier (1.0 - 5.0)"><input className={inputCls} type="number" step="0.1" min="1" max="5" value={surgeMultiplier} onChange={(e) => setSurgeMultiplier(e.target.value)} required /></Field>
            <Field label="Platform Commission (%)"><input className={inputCls} type="number" step="0.5" min="0" max="50" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} required /></Field>
            <Field label="Cancellation Fee (INR)"><input className={inputCls} type="number" step="1" min="0" value={cancellationFee} onChange={(e) => setCancellationFee(e.target.value)} required /></Field>
          </div>
          <Field label="Effective Date">
            <input className={inputCls} type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Validating...' : 'Save Fare Rule'}</Button>
          </div>
        </form>
      </ModalDialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title="Delete Fare Configuration"
        description={deleteTarget ? `Delete pricing rule for ${deleteTarget.city} (${deleteTarget.vehicleCategory.toUpperCase()})? Existing rides retain their immutable fare snapshot.` : ''}
        confirmLabel="Delete Rule"
        danger
        loading={saving}
        onConfirm={handleDeleteFare}
      />
    </div>
  );
};
