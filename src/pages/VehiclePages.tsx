import React, { useMemo, useState } from 'react';
import { Download, Globe, Layers, MapPin, Navigation, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { createRecord, deleteRecord, updateRecord } from '../services/firestoreService';
import { sanitizeId } from '../lib/utils';
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
import { ZoneMapCanvas } from '../components/maps/ZoneMapCanvas';
import { ServiceZone, Vehicle, VehicleCategory } from '../types/domain';

interface VehiclePagesProps {
  pageId: string;
}

const INDIAN_CITY_PRESETS = [
  { city: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { city: 'Delhi NCR', state: 'Delhi', lat: 28.6139, lng: 77.209 },
  { city: 'Mumbai', state: 'Maharashtra', lat: 19.076, lng: 72.8777 },
  { city: 'Hyderabad', state: 'Telangana', lat: 17.385, lng: 78.4867 },
  { city: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { city: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { city: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  { city: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  { city: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  { city: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376 },
  { city: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  { city: 'Surat', state: 'Gujarat', lat: 21.1702, lng: 72.8311 },
];

export const VehiclePages: React.FC<VehiclePagesProps> = ({ pageId }) => {
  const { user, roleId, can } = useAuth();
  const { vehicles, drivers, serviceZones, mapsApiKey, pushToast } = useData();

  // Vehicle form state
  const [vehicleOpen, setVehicleOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [deleteVehicleTarget, setDeleteVehicleTarget] = useState<Vehicle | null>(null);
  const [driverId, setDriverId] = useState('');
  const [category, setCategory] = useState<VehicleCategory>('cab');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [city, setCity] = useState('Bengaluru');

  // Zone form state
  const [editingZone, setEditingZone] = useState<ServiceZone | null>(null);
  const [deleteZoneTarget, setDeleteZoneTarget] = useState<ServiceZone | null>(null);
  const [zoneCity, setZoneCity] = useState('Bengaluru');
  const [zoneName, setZoneName] = useState('');
  const [zoneState, setZoneState] = useState('Karnataka');
  const [centerLat, setCenterLat] = useState('12.9716');
  const [centerLng, setCenterLng] = useState('77.5946');
  const [radiusKm, setRadiusKm] = useState('25');
  const [zoneBike, setZoneBike] = useState(true);
  const [zoneAuto, setZoneAuto] = useState(true);
  const [zoneCab, setZoneCab] = useState(true);
  const [zoneActive, setZoneActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const [zoneStatusFilter, setZoneStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  const actor = useMemo(
    () => ({ uid: user?.uid || 'unknown', email: user?.email || 'unknown', roleId }),
    [user, roleId]
  );

  const openVehicleEditor = (v?: Vehicle, defaultCat: VehicleCategory = 'cab') => {
    if (v) {
      setEditingVehicle(v);
      setDriverId(v.driverId);
      setCategory(v.category);
      setMake(v.make);
      setModel(v.model);
      setPlateNumber(v.plateNumber);
      setCity(v.city);
    } else {
      setEditingVehicle(null);
      setDriverId(drivers[0]?.id || '');
      setCategory(defaultCat);
      setMake('');
      setModel('');
      setPlateNumber('');
      setCity('Bengaluru');
    }
    setVehicleOpen(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('vehicles', 'write')) {
      pushToast('error', 'Permission Denied', 'Insufficient permissions to manage vehicles.');
      return;
    }
    const targetDriver = driverId || drivers[0]?.id;
    if (!targetDriver || !make.trim() || !model.trim() || plateNumber.trim().length < 4) {
      pushToast('error', 'Validation Error', 'Select a driver and enter make, model, and plate number.');
      return;
    }
    setSaving(true);
    try {
      if (editingVehicle) {
        await updateRecord(
          'vehicles',
          editingVehicle.id,
          {
            category,
            make: make.trim(),
            model: model.trim(),
            plateNumber: plateNumber.trim().toUpperCase(),
            city: city.trim(),
          },
          actor,
          'update_vehicle',
          `Updated vehicle ${plateNumber.trim().toUpperCase()}`
        );
        pushToast('success', 'Vehicle Updated', plateNumber.trim().toUpperCase());
      } else {
        const id = sanitizeId('veh');
        await createRecord(
          'vehicles',
          id,
          {
            driverId: targetDriver,
            category,
            make: make.trim(),
            model: model.trim(),
            plateNumber: plateNumber.trim().toUpperCase(),
            city: city.trim(),
            rcStatus: 'pending',
            insuranceStatus: 'pending',
            isActive: true,
          },
          actor,
          'register_vehicle',
          `Registered ${category} ${make.trim()} ${model.trim()} (${plateNumber.trim().toUpperCase()})`
        );
        pushToast('success', 'Vehicle Registered', plateNumber.trim().toUpperCase());
      }
      setVehicleOpen(false);
    } catch (err) {
      pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVehicle = async () => {
    if (!deleteVehicleTarget || !can('vehicles', 'write')) return;
    setSaving(true);
    try {
      await deleteRecord(
        'vehicles',
        deleteVehicleTarget.id,
        actor,
        'delete_vehicle',
        `Deleted vehicle ${deleteVehicleTarget.plateNumber}`
      );
      pushToast('success', 'Vehicle Deleted', deleteVehicleTarget.plateNumber);
      setDeleteVehicleTarget(null);
    } catch (err) {
      pushToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleVehicleDocStatus = async (
    v: Vehicle,
    field: 'rcStatus' | 'insuranceStatus',
    status: 'verified' | 'rejected'
  ) => {
    if (!can('kyc', 'approve') && !can('vehicles', 'write')) {
      pushToast('error', 'Permission Denied', 'KYC or Vehicle write permission required.');
      return;
    }
    try {
      await updateRecord(
        'vehicles',
        v.id,
        { [field]: status },
        actor,
        `vehicle_${field}_${status}`,
        `Set ${v.plateNumber} ${field} = ${status}`
      );
      pushToast('success', 'Document Updated', `${v.plateNumber} ${field === 'rcStatus' ? 'RC' : 'Insurance'} → ${status}`);
    } catch (err) {
      pushToast('error', 'Update Failed', err instanceof Error ? err.message : 'Failed');
    }
  };

  const toggleVehicleActive = async (v: Vehicle) => {
    if (!can('vehicles', 'write')) return;
    try {
      await updateRecord(
        'vehicles',
        v.id,
        { isActive: !v.isActive },
        actor,
        'toggle_vehicle_active',
        `Set vehicle ${v.plateNumber} active = ${!v.isActive}`
      );
      pushToast('success', 'Vehicle Status Updated', `${v.plateNumber} is now ${!v.isActive ? 'active' : 'suspended'}.`);
    } catch (err) {
      pushToast('error', 'Update Failed', err instanceof Error ? err.message : 'Failed');
    }
  };

  const applyZoneToForm = (z: ServiceZone) => {
    setEditingZone(z);
    setZoneName(z.zoneName);
    setZoneCity(z.city);
    setZoneState(z.state);
    setCenterLat(typeof z.centerLat === 'number' ? String(z.centerLat) : '12.9716');
    setCenterLng(typeof z.centerLng === 'number' ? String(z.centerLng) : '77.5946');
    setRadiusKm(typeof z.radiusKm === 'number' ? String(z.radiusKm) : '25');
    setZoneBike(z.bikeEnabled);
    setZoneAuto(z.autoEnabled);
    setZoneCab(z.cabEnabled);
    setZoneActive(z.isActive);
  };

  const resetZoneForm = () => {
    setEditingZone(null);
    setZoneName('');
    setZoneCity('Bengaluru');
    setZoneState('Karnataka');
    setCenterLat('12.9716');
    setCenterLng('77.5946');
    setRadiusKm('25');
    setZoneBike(true);
    setZoneAuto(true);
    setZoneCab(true);
    setZoneActive(true);
  };

  const handleSaveZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('vehicles', 'write')) {
      pushToast('error', 'Permission Denied', 'Insufficient permission to configure zones.');
      return;
    }
    if (!zoneCity.trim() || !zoneName.trim() || !zoneState.trim()) {
      pushToast('error', 'Validation Error', 'City, zone name, and state are required.');
      return;
    }
    const latNum = Number(centerLat);
    const lngNum = Number(centerLng);
    const radNum = Number(radiusKm);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum) || !Number.isFinite(radNum) || radNum < 1 || radNum > 200) {
      pushToast('error', 'Invalid Coordinates', 'Enter valid coordinates and coverage radius between 1 and 200 km.');
      return;
    }

    setSaving(true);
    try {
      if (editingZone) {
        await updateRecord(
          'service_zones',
          editingZone.id,
          {
            zoneName: zoneName.trim(),
            state: zoneState.trim(),
            isActive: zoneActive,
            bikeEnabled: zoneBike,
            autoEnabled: zoneAuto,
            cabEnabled: zoneCab,
            centerLat: latNum,
            centerLng: lngNum,
            radiusKm: radNum,
          },
          actor,
          'update_service_zone',
          `Updated zone ${zoneName.trim()} (${editingZone.city}, ${radNum} km radius)`
        );
        pushToast('success', 'Zone Updated', `${zoneName.trim()} (${radNum} km)`);
        resetZoneForm();
      } else {
        const id = sanitizeId('zone');
        await createRecord(
          'service_zones',
          id,
          {
            city: zoneCity.trim(),
            zoneName: zoneName.trim(),
            state: zoneState.trim(),
            isActive: zoneActive,
            bikeEnabled: zoneBike,
            autoEnabled: zoneAuto,
            cabEnabled: zoneCab,
            centerLat: latNum,
            centerLng: lngNum,
            radiusKm: radNum,
          },
          actor,
          'create_service_zone',
          `Created service zone ${zoneName.trim()}, ${zoneCity.trim()} (${radNum} km)`
        );
        pushToast('success', 'Operating Zone Added', `${zoneName.trim()} (${zoneCity.trim()})`);
        resetZoneForm();
      }
    } catch (err) {
      pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteZone = async () => {
    if (!deleteZoneTarget || !can('vehicles', 'write')) return;
    setSaving(true);
    try {
      await deleteRecord(
        'service_zones',
        deleteZoneTarget.id,
        actor,
        'delete_service_zone',
        `Removed operating zone ${deleteZoneTarget.zoneName} (${deleteZoneTarget.city})`
      );
      pushToast('success', 'Zone Deleted', deleteZoneTarget.zoneName);
      if (editingZone?.id === deleteZoneTarget.id) {
        resetZoneForm();
      }
      setDeleteZoneTarget(null);
    } catch (err) {
      pushToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleZoneField = async (zone: ServiceZone, field: 'isActive' | 'bikeEnabled' | 'autoEnabled' | 'cabEnabled') => {
    if (!can('vehicles', 'write')) return;
    try {
      await updateRecord(
        'service_zones',
        zone.id,
        { [field]: !zone[field] },
        actor,
        'toggle_service_availability',
        `Set ${zone.zoneName} ${field} = ${!zone[field]}`
      );
      pushToast('success', 'Availability Updated', `${zone.zoneName} updated.`);
    } catch (err) {
      pushToast('error', 'Update Failed', err instanceof Error ? err.message : 'Failed');
    }
  };

  const vehicleModal = (
    <ModalDialog
      open={vehicleOpen}
      onOpenChange={setVehicleOpen}
      title={editingVehicle ? `Edit Vehicle · ${editingVehicle.plateNumber}` : 'Register Fleet Vehicle'}
    >
      <form onSubmit={handleSaveVehicle} className="space-y-4">
        {!editingVehicle && (
          <Field label="Assigned Driver">
            <select className={selectCls} value={driverId || drivers[0]?.id || ''} onChange={(e) => setDriverId(e.target.value)} required>
              {drivers.length === 0 ? (
                <option value="">Onboard a driver first</option>
              ) : (
                drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.fullName} ({d.city})</option>
                ))
              )}
            </select>
          </Field>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <select className={selectCls} value={category} onChange={(e) => setCategory(e.target.value as VehicleCategory)}>
              <option value="bike">Bike</option>
              <option value="auto">Auto</option>
              <option value="cab">Cab</option>
            </select>
          </Field>
          <Field label="City">
            <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} required />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Make">
            <input className={inputCls} value={make} onChange={(e) => setMake(e.target.value)} required placeholder="e.g. Bajaj / Maruti" />
          </Field>
          <Field label="Model">
            <input className={inputCls} value={model} onChange={(e) => setModel(e.target.value)} required placeholder="e.g. RE / Dzire" />
          </Field>
        </div>
        <Field label="Registration Plate Number">
          <input className={inputCls} value={plateNumber} onChange={(e) => setPlateNumber(e.target.value)} required placeholder="KA01AB1234" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setVehicleOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={saving || (!editingVehicle && drivers.length === 0)}>
            {editingVehicle ? 'Update Vehicle' : 'Register Vehicle'}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );

  // Page 40: Zone Setup & Service Availability
  if (pageId === 'vehicles/availability') {
    const activeZones = serviceZones.filter((z) => z.isActive);
    const uniqueCities = new Set(serviceZones.map((z) => z.city.trim().toLowerCase())).size;
    const avgRadius =
      serviceZones.length > 0
        ? Math.round(serviceZones.reduce((s, z) => s + (z.radiusKm || 15), 0) / serviceZones.length)
        : 0;
    const draftLatNum = Number(centerLat);
    const draftLngNum = Number(centerLng);
    const draftCenter =
      Number.isFinite(draftLatNum) && Number.isFinite(draftLngNum)
        ? { lat: draftLatNum, lng: draftLngNum }
        : null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile
            label="Operating Zones Configured"
            value={serviceZones.length}
            detail={`${activeZones.length} live · ${serviceZones.length - activeZones.length} paused`}
            icon={<MapPin className="w-4 h-4" />}
            highlight
          />
          <StatTile
            label="Service Cities Covered"
            value={uniqueCities}
            detail="Cities active for Customer App"
            icon={<Globe className="w-4 h-4" />}
            tone="green"
          />
          <StatTile
            label="Avg Geofence Radius"
            value={`${avgRadius} km`}
            detail="Per operating zone center"
            icon={<Navigation className="w-4 h-4" />}
          />
          <StatTile
            label="Multi-Modal Zones"
            value={serviceZones.filter((z) => z.bikeEnabled && z.autoEnabled && z.cabEnabled).length}
            detail="Bike + Auto + Cab active"
            icon={<Layers className="w-4 h-4" />}
          />
        </div>

        {/* Interactive Zone Builder + Google Map Geofence Preview */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          <Panel
            title={editingZone ? `Edit Zone · ${editingZone.zoneName}` : 'Set Operating Zone & Coverage Area'}
            subtitle="Choose how many areas/cities SHINE CAB runs in, set radius (km), and toggle vehicle types"
            className="xl:col-span-5"
            action={
              editingZone ? (
                <Button size="sm" variant="outline" onClick={resetZoneForm}>
                  + New Zone
                </Button>
              ) : undefined
            }
          >
            <div className="space-y-4">
              <div>
                <div className="text-xs font-medium text-[#374151] mb-2">Quick Indian City Presets</div>
                <div className="flex flex-wrap gap-1.5">
                  {INDIAN_CITY_PRESETS.map((preset) => (
                    <button
                      key={preset.city}
                      type="button"
                      onClick={() => {
                        if (!editingZone) {
                          setZoneCity(preset.city);
                          setZoneState(preset.state);
                          if (!zoneName.trim()) {
                            setZoneName(`${preset.city} Central Zone`);
                          }
                        }
                        setCenterLat(String(preset.lat));
                        setCenterLng(String(preset.lng));
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded-md border border-[#E5E7EB] bg-[#F7F8FA] hover:bg-[#FFC928] hover:border-[#111111] text-[#111111] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      {preset.city}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleSaveZone} className="space-y-3.5 pt-2 border-t border-[#F3F4F6]">
                <Field label="Zone / Area Name">
                  <input
                    className={inputCls}
                    value={zoneName}
                    onChange={(e) => setZoneName(e.target.value)}
                    required
                    placeholder="e.g. Indiranagar & Koramangala Hub"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="City" hint={editingZone ? 'City locked on edit' : undefined}>
                    <input
                      className={inputCls}
                      value={zoneCity}
                      onChange={(e) => setZoneCity(e.target.value)}
                      required
                      disabled={Boolean(editingZone)}
                    />
                  </Field>
                  <Field label="State">
                    <input
                      className={inputCls}
                      value={zoneState}
                      onChange={(e) => setZoneState(e.target.value)}
                      required
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <Field label="Center Lat">
                    <input
                      className={inputCls}
                      type="number"
                      step="0.000001"
                      value={centerLat}
                      onChange={(e) => setCenterLat(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Center Lng">
                    <input
                      className={inputCls}
                      type="number"
                      step="0.000001"
                      value={centerLng}
                      onChange={(e) => setCenterLng(e.target.value)}
                      required
                    />
                  </Field>
                  <Field label="Radius (km)">
                    <input
                      className={inputCls}
                      type="number"
                      min="1"
                      max="200"
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(e.target.value)}
                      required
                    />
                  </Field>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between text-xs text-[#4B5563]">
                    <span>Coverage Radius Slider</span>
                    <span className="font-mono font-semibold text-[#111111]">{radiusKm || 15} km</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="80"
                    value={Number(radiusKm) || 15}
                    onChange={(e) => setRadiusKm(e.target.value)}
                    className="w-full accent-[#111111] cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { label: 'Zone Live', val: zoneActive, set: setZoneActive },
                    { label: 'Bike', val: zoneBike, set: setZoneBike },
                    { label: 'Auto', val: zoneAuto, set: setZoneAuto },
                    { label: 'Cab', val: zoneCab, set: setZoneCab },
                  ].map((item) => (
                    <label
                      key={item.label}
                      className="flex items-center gap-2 px-2.5 py-2 border border-[#E5E7EB] rounded-lg text-xs font-medium cursor-pointer bg-[#FAFAFB]"
                    >
                      <input
                        type="checkbox"
                        checked={item.val}
                        onChange={(e) => item.set(e.target.checked)}
                        className="accent-[#111111]"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  {editingZone && (
                    <Button type="button" variant="outline" onClick={resetZoneForm}>
                      Cancel Edit
                    </Button>
                  )}
                  <Button type="submit" disabled={saving || !can('vehicles', 'write')}>
                    {saving ? 'Saving...' : editingZone ? 'Save Zone Changes' : 'Add Operating Zone'}
                  </Button>
                </div>
              </form>
            </div>
          </Panel>

          <Panel
            title="Live Operating Geofence Map"
            subtitle="Click anywhere on Google Maps to drop a zone center pin and preview its service radius"
            className="xl:col-span-7"
          >
            <ZoneMapCanvas
              apiKey={mapsApiKey}
              zones={serviceZones}
              draftCenter={draftCenter}
              draftRadiusKm={Number(radiusKm) || 25}
              selectedZoneId={editingZone?.id || null}
              onPickCoordinates={(lat, lng) => {
                setCenterLat(String(lat));
                setCenterLng(String(lng));
              }}
              onSelectZone={(z) => applyZoneToForm(z)}
            />
          </Panel>
        </div>

        <Panel
          title="Configured Operating Zones & Service Availability"
          subtitle="Toggle Bike, Auto, and Cab booking availability per area in real time"
        >
          <DataTable
            rows={serviceZones.filter((z) =>
              zoneStatusFilter === 'active'
                ? z.isActive
                : zoneStatusFilter === 'paused'
                  ? !z.isActive
                  : true
            )}
            filterControls={
              <select
                aria-label="Filter zone status"
                className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
                value={zoneStatusFilter}
                onChange={(e) => setZoneStatusFilter(e.target.value as 'all' | 'active' | 'paused')}
              >
                <option value="all">All Zones ({serviceZones.length})</option>
                <option value="active">Live Zones ({activeZones.length})</option>
                <option value="paused">Paused Zones ({serviceZones.length - activeZones.length})</option>
              </select>
            }
            emptyTitle="No Service Zones Configured"
            emptyDescription="Use the Zone Setup form or click a city preset above to define where SHINE CAB operates."
            columns={[
              {
                key: 'zone',
                header: 'Zone / Area',
                sortValue: (z) => z.zoneName,
                render: (z) => (
                  <div>
                    <div className="font-semibold">{z.zoneName}</div>
                    <div className="text-xs text-[#6B7280]">{z.city}, {z.state}</div>
                  </div>
                ),
              },
              {
                key: 'geo',
                header: 'Coverage',
                render: (z) => (
                  <div className="text-xs font-mono tabular-nums text-[#4B5563]">
                    <div>{z.radiusKm || 15} km radius</div>
                    {typeof z.centerLat === 'number' && typeof z.centerLng === 'number' && (
                      <div className="text-[11px] text-[#6B7280]">
                        {z.centerLat.toFixed(3)}, {z.centerLng.toFixed(3)}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: 'active',
                header: 'Zone Status',
                render: (z) => (
                  <Button
                    size="sm"
                    variant={z.isActive ? 'success' : 'outline'}
                    disabled={!can('vehicles', 'write')}
                    onClick={() => toggleZoneField(z, 'isActive')}
                  >
                    {z.isActive ? 'Enabled' : 'Paused'}
                  </Button>
                ),
              },
              {
                key: 'bike',
                header: 'Bike',
                render: (z) => (
                  <Button
                    size="sm"
                    variant={z.bikeEnabled ? 'primary' : 'outline'}
                    disabled={!can('vehicles', 'write')}
                    onClick={() => toggleZoneField(z, 'bikeEnabled')}
                  >
                    {z.bikeEnabled ? 'On' : 'Off'}
                  </Button>
                ),
              },
              {
                key: 'auto',
                header: 'Auto',
                render: (z) => (
                  <Button
                    size="sm"
                    variant={z.autoEnabled ? 'primary' : 'outline'}
                    disabled={!can('vehicles', 'write')}
                    onClick={() => toggleZoneField(z, 'autoEnabled')}
                  >
                    {z.autoEnabled ? 'On' : 'Off'}
                  </Button>
                ),
              },
              {
                key: 'cab',
                header: 'Cab',
                render: (z) => (
                  <Button
                    size="sm"
                    variant={z.cabEnabled ? 'primary' : 'outline'}
                    disabled={!can('vehicles', 'write')}
                    onClick={() => toggleZoneField(z, 'cabEnabled')}
                  >
                    {z.cabEnabled ? 'On' : 'Off'}
                  </Button>
                ),
              },
              {
                key: 'actions',
                header: 'Manage',
                align: 'right',
                render: (z) => (
                  <div className="inline-flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!can('vehicles', 'write')}
                      onClick={() => applyZoneToForm(z)}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!can('vehicles', 'write')}
                      onClick={() => setDeleteZoneTarget(z)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Panel>

        <ConfirmDialog
          open={Boolean(deleteZoneTarget)}
          onOpenChange={(o) => !o && setDeleteZoneTarget(null)}
          title="Delete Operating Zone"
          description={
            deleteZoneTarget
              ? `Remove "${deleteZoneTarget.zoneName}" (${deleteZoneTarget.city})? Customers in this geofence will no longer see active availability unless covered by another zone.`
              : ''
          }
          confirmLabel="Delete Zone"
          danger
          loading={saving}
          onConfirm={handleDeleteZone}
        />
      </div>
    );
  }

  // Pages 35-39: Vehicle Categories, Bikes, Autos, Cabs, Vehicle Documents
  const catFilter: Record<string, VehicleCategory | null> = {
    'vehicles/categories': null,
    'vehicles/bikes': 'bike',
    'vehicles/autos': 'auto',
    'vehicles/cabs': 'cab',
    'vehicles/documents': null,
  };
  const targetCat = catFilter[pageId] ?? null;
  const rows = targetCat ? vehicles.filter((v) => v.category === targetCat) : vehicles;
  const isDocsPage = pageId === 'vehicles/documents';
  const defaultNewCategory: VehicleCategory = targetCat || 'cab';

  const exportVehiclesCsv = () => {
    const header = ['VehicleID', 'PlateNumber', 'Category', 'Make', 'Model', 'City', 'DriverID', 'RCStatus', 'InsuranceStatus', 'Active'];
    const lines = [
      header.join(','),
      ...rows.map((v) =>
        [v.id, v.plateNumber, v.category, v.make, v.model, v.city, v.driverId, v.rcStatus || 'pending', v.insuranceStatus || 'pending', v.isActive]
          .map((val) => `"${String(val).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shine-cab-vehicles-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Fleet CSV Exported', `${rows.length} vehicle rows downloaded.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total Fleet" value={vehicles.length} highlight />
        <StatTile label="Bikes" value={vehicles.filter((v) => v.category === 'bike').length} />
        <StatTile label="Autos" value={vehicles.filter((v) => v.category === 'auto').length} />
        <StatTile label="Cabs" value={vehicles.filter((v) => v.category === 'cab').length} />
      </div>
      <Panel
        title={isDocsPage ? 'Vehicle Compliance Documents (RC & Insurance)' : 'Fleet Vehicle Registry'}
        subtitle="Manage Bike, Auto, and Cab units linked to driver partners"
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportVehiclesCsv}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
            {can('vehicles', 'write') && (
              <Button size="sm" onClick={() => openVehicleEditor(undefined, defaultNewCategory)}>
                + Register {targetCat ? targetCat.toUpperCase() : 'Vehicle'}
              </Button>
            )}
          </div>
        }
      >
        <DataTable
          rows={rows}
          emptyTitle="No Vehicles Registered"
          emptyDescription="Register vehicles assigned to onboarded drivers to manage fleet compliance."
          emptyAction={can('vehicles', 'write') && drivers.length > 0 ? <Button size="sm" onClick={() => openVehicleEditor(undefined, defaultNewCategory)}>Register Vehicle</Button> : undefined}
          columns={[
            { key: 'plate', header: 'Plate Number', render: (v) => <span className="font-mono font-semibold">{v.plateNumber}</span> },
            { key: 'cat', header: 'Category', render: (v) => <span className="uppercase text-xs font-semibold">{v.category}</span> },
            { key: 'model', header: 'Make & Model', render: (v) => `${v.make} ${v.model}` },
            { key: 'city', header: 'City', render: (v) => v.city },
            { key: 'rc', header: 'RC', render: (v) => <StatusText status={v.rcStatus || 'pending'} /> },
            { key: 'ins', header: 'Insurance', render: (v) => <StatusText status={v.insuranceStatus || 'pending'} /> },
            { key: 'active', header: 'Status', render: (v) => <StatusText status={v.isActive ? 'active' : 'suspended'} /> },
            {
              key: 'act',
              header: 'Actions',
              align: 'right',
              render: (v) =>
                isDocsPage ? (
                  <div className="inline-flex flex-wrap justify-end gap-1.5">
                    <Button
                      size="sm"
                      variant="success"
                      disabled={v.rcStatus === 'verified' || (!can('kyc', 'approve') && !can('vehicles', 'write'))}
                      onClick={() => handleVehicleDocStatus(v, 'rcStatus', 'verified')}
                    >
                      Verify RC
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={v.rcStatus === 'rejected' || (!can('kyc', 'approve') && !can('vehicles', 'write'))}
                      onClick={() => handleVehicleDocStatus(v, 'rcStatus', 'rejected')}
                    >
                      Reject RC
                    </Button>
                    <Button
                      size="sm"
                      variant="success"
                      disabled={v.insuranceStatus === 'verified' || (!can('kyc', 'approve') && !can('vehicles', 'write'))}
                      onClick={() => handleVehicleDocStatus(v, 'insuranceStatus', 'verified')}
                    >
                      Verify Ins
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={v.insuranceStatus === 'rejected' || (!can('kyc', 'approve') && !can('vehicles', 'write'))}
                      onClick={() => handleVehicleDocStatus(v, 'insuranceStatus', 'rejected')}
                    >
                      Reject Ins
                    </Button>
                  </div>
                ) : (
                  <div className="inline-flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!can('vehicles', 'write')}
                      onClick={() => toggleVehicleActive(v)}
                    >
                      {v.isActive ? 'Pause' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!can('vehicles', 'write')}
                      onClick={() => openVehicleEditor(v)}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!can('vehicles', 'write')}
                      onClick={() => setDeleteVehicleTarget(v)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ),
            },
          ]}
        />
      </Panel>
      {vehicleModal}
      <ConfirmDialog
        open={Boolean(deleteVehicleTarget)}
        onOpenChange={(o) => !o && setDeleteVehicleTarget(null)}
        title="Delete Vehicle Record"
        description={deleteVehicleTarget ? `Delete vehicle ${deleteVehicleTarget.plateNumber} (${deleteVehicleTarget.make} ${deleteVehicleTarget.model})?` : ''}
        confirmLabel="Delete Vehicle"
        danger
        loading={saving}
        onConfirm={handleDeleteVehicle}
      />
    </div>
  );
};
