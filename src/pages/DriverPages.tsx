import React, { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { createRecord, deleteRecord, updateRecord } from '../services/firestoreService';
import { formatINR, maskPhone, sanitizeId } from '../lib/utils';
import {
  Button,
  ConfirmDialog,
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
import { Driver, DriverDocument, VehicleCategory } from '../types/domain';

interface DriverPagesProps {
  pageId: string;
  selectedId: string | null;
  onNavigate: (pageId: string, selectedId?: string) => void;
}

export const DriverPages: React.FC<DriverPagesProps> = ({ pageId, selectedId, onNavigate }) => {
  const { user, roleId, can } = useAuth();
  const { drivers, driverDocuments, vehicles, rides, pushToast } = useData();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Driver | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [category, setCategory] = useState<VehicleCategory>('cab');
  const [commissionPct, setCommissionPct] = useState('20');
  const [saving, setSaving] = useState(false);

  const [docModalOpen, setDocModalOpen] = useState(false);
  const [docDriverId, setDocDriverId] = useState('');
  const [docType, setDocType] = useState<DriverDocument['docType']>('driving_licence');
  const [docNumber, setDocNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  const [rejectDocTarget, setRejectDocTarget] = useState<DriverDocument | null>(null);
  const [docRejectReason, setDocRejectReason] = useState('');

  const [walletOpen, setWalletOpen] = useState(false);
  const [walletDirection, setWalletDirection] = useState<'credit' | 'debit'>('credit');
  const [walletAmount, setWalletAmount] = useState('250');
  const [walletReason, setWalletReason] = useState('');

  const [selectedDriverId, setSelectedDriverId] = useState<string>(selectedId || '');
  const [catFilter, setCatFilter] = useState<'all' | VehicleCategory>('all');
  const [appFilter, setAppFilter] = useState<'all' | Driver['applicationStatus'] | 'blocked'>('all');

  useEffect(() => {
    if (selectedId) {
      setSelectedDriverId(selectedId);
    }
  }, [selectedId]);

  const [blockTarget, setBlockTarget] = useState<Driver | null>(null);
  const [blockReason, setBlockReason] = useState('');

  const actor = useMemo(
    () => ({ uid: user?.uid || 'unknown', email: user?.email || 'unknown', roleId }),
    [user, roleId]
  );

  const activeDriver = useMemo(
    () => drivers.find((d) => d.id === (selectedDriverId || selectedId)) || drivers[0] || null,
    [drivers, selectedId, selectedDriverId]
  );

  const openDriverModal = (drv?: Driver) => {
    if (drv) {
      setEditingDriver(drv);
      setFullName(drv.fullName);
      setPhone(drv.phone);
      setCity(drv.city);
      setCategory(drv.vehicleCategory);
      setCommissionPct(String(drv.commissionPct ?? 20));
    } else {
      setEditingDriver(null);
      setFullName('');
      setPhone('');
      setCity('Bengaluru');
      setCategory('cab');
      setCommissionPct('20');
    }
    setCreateOpen(true);
  };

  const handleSaveDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('drivers', 'write')) {
      pushToast('error', 'Permission Denied', 'Your role cannot modify drivers.');
      return;
    }
    if (!fullName.trim() || phone.trim().length < 7) {
      pushToast('error', 'Validation Error', 'Enter valid driver name and phone.');
      return;
    }
    const commVal = Number(commissionPct);
    if (!Number.isFinite(commVal) || commVal < 0 || commVal > 50) {
      pushToast('error', 'Validation Error', 'Commission percentage must be between 0% and 50%.');
      return;
    }
    setSaving(true);
    try {
      if (editingDriver) {
        await updateRecord(
          'drivers',
          editingDriver.id,
          {
            fullName: fullName.trim(),
            phone: phone.trim(),
            city: city.trim() || 'Bengaluru',
            vehicleCategory: category,
            commissionPct: commVal,
          },
          actor,
          'update_driver',
          `Updated driver ${fullName.trim()} (${category}, ${commVal}% commission)`
        );
        pushToast('success', 'Driver Updated', fullName.trim());
      } else {
        const id = sanitizeId('drv');
        await createRecord(
          'drivers',
          id,
          {
            profileId: id,
            fullName: fullName.trim(),
            phone: phone.trim(),
            city: city.trim() || 'Bengaluru',
            vehicleCategory: category,
            applicationStatus: 'pending',
            kycStatus: 'pending',
            dlStatus: 'pending',
            rcStatus: 'pending',
            insuranceStatus: 'pending',
            isOnline: false,
            isBlocked: false,
            rating: 5,
            totalRides: 0,
            walletBalance: 0,
            totalEarnings: 0,
            commissionPct: commVal,
          },
          actor,
          'onboard_driver',
          `Onboarded driver ${fullName.trim()} (${category})`
        );
        pushToast('success', 'Driver Application Created', `${fullName.trim()} added to pending applications.`);
      }
      setCreateOpen(false);
    } catch (err) {
      pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDriver = async () => {
    if (!deleteTarget || !can('drivers', 'write')) return;
    setSaving(true);
    try {
      await deleteRecord(
        'drivers',
        deleteTarget.id,
        actor,
        'delete_driver',
        `Deleted driver partner ${deleteTarget.fullName} (${deleteTarget.id})`
      );
      pushToast('success', 'Driver Deleted', deleteTarget.fullName);
      setDeleteTarget(null);
      if (selectedDriverId === deleteTarget.id) {
        setSelectedDriverId('');
      }
    } catch (err) {
      pushToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDriverWalletAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDriver || !can('finance', 'write')) {
      pushToast('error', 'Permission Denied', 'Finance write permission required to adjust driver wallet.');
      return;
    }
    const amt = Number(walletAmount);
    const curBal = activeDriver.walletBalance || 0;
    if (!Number.isFinite(amt) || amt <= 0 || !walletReason.trim()) {
      pushToast('error', 'Invalid Input', 'Enter a positive amount and reason.');
      return;
    }
    if (walletDirection === 'debit' && amt > curBal) {
      pushToast('error', 'Insufficient Balance', 'Debit exceeds driver wallet balance.');
      return;
    }
    setSaving(true);
    try {
      const nextBalance = walletDirection === 'credit' ? curBal + amt : curBal - amt;
      await createRecord(
        'wallet_transactions',
        sanitizeId('wtx'),
        {
          ownerId: activeDriver.id,
          ownerType: 'driver',
          amount: amt,
          direction: walletDirection,
          reason: walletReason.trim(),
          createdBy: actor.uid,
        },
        actor,
        `driver_wallet_${walletDirection}`,
        `${walletDirection.toUpperCase()} ${formatINR(amt)} for driver ${activeDriver.fullName}`,
        false
      );
      await updateRecord(
        'drivers',
        activeDriver.id,
        { walletBalance: nextBalance },
        actor,
        'driver_wallet_sync',
        `Updated driver ${activeDriver.id} wallet to ${formatINR(nextBalance)}`
      );
      pushToast('success', 'Driver Wallet Updated', `New balance: ${formatINR(nextBalance)}`);
      setWalletOpen(false);
      setWalletReason('');
    } catch (err) {
      pushToast('error', 'Wallet Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('kyc', 'approve') && !can('drivers', 'write')) {
      pushToast('error', 'Permission Denied', 'Insufficient permission to log KYC documents.');
      return;
    }
    const targetId = docDriverId || activeDriver?.id;
    if (!targetId || docNumber.trim().length < 3) {
      pushToast('error', 'Validation Error', 'Select a driver and enter a valid document number.');
      return;
    }
    setSaving(true);
    try {
      const id = sanitizeId('doc');
      await createRecord(
        'driver_documents',
        id,
        {
          driverId: targetId,
          docType,
          docNumber: docNumber.trim(),
          status: 'pending',
          ...(expiryDate ? { expiryDate } : {}),
        },
        actor,
        'submit_driver_document',
        `Logged ${docType} (${docNumber.trim()}) for driver ${targetId}`
      );
      pushToast('success', 'Document Logged', `${String(docType || "").replace(/_/g, ' ')} queued for verification.`);
      setDocNumber('');
      setExpiryDate('');
      setDocModalOpen(false);
    } catch (err) {
      pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyDoc = async (docItem: DriverDocument, status: 'verified' | 'rejected', reason = '') => {
    if (!can('kyc', 'approve')) {
      pushToast('error', 'Permission Denied', 'KYC Admin or Super Admin role required.');
      return;
    }
    setSaving(true);
    try {
      await updateRecord(
        'driver_documents',
        docItem.id,
        {
          status,
          verifiedBy: actor.uid,
          rejectionReason: status === 'rejected' ? reason.trim() : '',
        },
        actor,
        `verify_doc_${status}`,
        `Marked ${docItem.docType} (${docItem.docNumber}) as ${status}${reason ? `: ${reason.trim()}` : ''}`
      );
      const driverFieldMap: Record<DriverDocument['docType'], string> = {
        kyc_aadhaar_pan: 'kycStatus',
        driving_licence: 'dlStatus',
        vehicle_rc: 'rcStatus',
        vehicle_insurance: 'insuranceStatus',
      };
      await updateRecord(
        'drivers',
        docItem.driverId,
        { [driverFieldMap[docItem.docType]]: status },
        actor,
        'sync_driver_doc_status',
        `Synced ${driverFieldMap[docItem.docType]} = ${status} for driver ${docItem.driverId}`
      );
      pushToast('success', `Document ${status}`, docItem.docNumber);
      setRejectDocTarget(null);
      setDocRejectReason('');
    } catch (err) {
      pushToast('error', 'Verification Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleApplicationDecision = async (driver: Driver, decision: 'under_review' | 'approved' | 'rejected') => {
    if (!can('drivers', 'approve')) {
      pushToast('error', 'Permission Denied', 'Approval requires KYC Admin or Super Admin role.');
      return;
    }
    try {
      await updateRecord(
        'drivers',
        driver.id,
        { applicationStatus: decision },
        actor,
        `driver_application_${decision}`,
        `Set driver ${driver.fullName} applicationStatus to ${decision}`
      );
      pushToast('success', `Application ${String(decision || "").replace(/_/g, ' ')}`, `${driver.fullName} updated.`);
    } catch (err) {
      pushToast('error', 'Decision Failed', err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleBlockToggle = async () => {
    if (!blockTarget || !can('drivers', 'block')) return;
    const nextBlocked = !blockTarget.isBlocked;
    if (nextBlocked && blockReason.trim().length < 3) {
      pushToast('error', 'Reason Required', 'Provide a reason for suspending this driver.');
      return;
    }
    setSaving(true);
    try {
      await updateRecord(
        'drivers',
        blockTarget.id,
        {
          isBlocked: nextBlocked,
          isOnline: nextBlocked ? false : blockTarget.isOnline,
          blockReason: nextBlocked ? blockReason.trim() : '',
        },
        actor,
        nextBlocked ? 'block_driver' : 'unblock_driver',
        `${nextBlocked ? 'Blocked' : 'Unblocked'} driver ${blockTarget.fullName}`
      );
      pushToast('success', nextBlocked ? 'Driver Blocked' : 'Driver Reinstated', blockTarget.fullName);
      setBlockTarget(null);
      setBlockReason('');
    } catch (err) {
      pushToast('error', 'Action Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const createModal = (
    <ModalDialog
      open={createOpen}
      onOpenChange={setCreateOpen}
      title={editingDriver ? `Edit Driver · ${editingDriver.fullName}` : 'Onboard Driver Partner'}
    >
      <form onSubmit={handleSaveDriver} className="space-y-4">
        <Field label="Driver Full Name">
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Rajesh Kumar" />
        </Field>
        <Field label="Phone Number">
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+91 9988776655" />
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
        <Field label="Driver Commission Override (%)">
          <input className={inputCls} type="number" min="0" max="50" step="0.5" value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} required />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingDriver ? 'Save Changes' : 'Submit Application'}</Button>
        </div>
      </form>
    </ModalDialog>
  );

  const walletModal = (
    <ModalDialog open={walletOpen} onOpenChange={setWalletOpen} title="Adjust Driver Wallet">
      <form onSubmit={handleDriverWalletAdjust} className="space-y-4">
        <Field label="Driver">
          <select className={selectCls} value={activeDriver?.id || ''} onChange={(e) => setSelectedDriverId(e.target.value)}>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.fullName} ({formatINR(d.walletBalance || 0)})</option>
            ))}
          </select>
        </Field>
        <Field label="Direction">
          <select className={selectCls} value={walletDirection} onChange={(e) => setWalletDirection(e.target.value as 'credit' | 'debit')}>
            <option value="credit">Credit (+ Incentive / Adjustment)</option>
            <option value="debit">Debit (- Recovery / Deduction)</option>
          </select>
        </Field>
        <Field label="Amount (INR)">
          <input className={inputCls} type="number" min="1" step="0.01" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} required />
        </Field>
        <Field label="Reason">
          <input className={inputCls} value={walletReason} onChange={(e) => setWalletReason(e.target.value)} required placeholder="e.g. Peak hour incentive bonus" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setWalletOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={saving}>Record Adjustment</Button>
        </div>
      </form>
    </ModalDialog>
  );

  const docModal = (
    <ModalDialog open={docModalOpen} onOpenChange={setDocModalOpen} title="Log Driver Compliance Document">
      <form onSubmit={handleCreateDoc} className="space-y-4">
        <Field label="Driver">
          <select className={selectCls} value={docDriverId || activeDriver?.id || ''} onChange={(e) => setDocDriverId(e.target.value)}>
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>{d.fullName} ({d.city})</option>
            ))}
          </select>
        </Field>
        <Field label="Document Type">
          <select className={selectCls} value={docType} onChange={(e) => setDocType(e.target.value as DriverDocument['docType'])}>
            <option value="kyc_aadhaar_pan">KYC (Aadhaar / PAN)</option>
            <option value="driving_licence">Driving Licence</option>
            <option value="vehicle_rc">Vehicle RC</option>
            <option value="vehicle_insurance">Vehicle Insurance</option>
          </select>
        </Field>
        <Field label="Document Number">
          <input className={inputCls} value={docNumber} onChange={(e) => setDocNumber(e.target.value)} required placeholder="e.g. KA01-20210045123" />
        </Field>
        <Field label="Expiry Date (Optional)">
          <input className={inputCls} type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setDocModalOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={saving}>Save Document</Button>
        </div>
      </form>
    </ModalDialog>
  );

  const rejectDocModal = (
    <ModalDialog
      open={Boolean(rejectDocTarget)}
      onOpenChange={(o) => {
        if (!o) {
          setRejectDocTarget(null);
          setDocRejectReason('');
        }
      }}
      title="Reject Driver Document"
      description={rejectDocTarget ? `${String(rejectDocTarget.docType || "").replace(/_/g, ' ')} · ${rejectDocTarget.docNumber}` : undefined}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (rejectDocTarget) {
            void handleVerifyDoc(rejectDocTarget, 'rejected', docRejectReason);
          }
        }}
        className="space-y-4"
      >
        <Field label="Rejection Reason">
          <input
            className={inputCls}
            value={docRejectReason}
            onChange={(e) => setDocRejectReason(e.target.value)}
            required
            placeholder="e.g. Blurry photo, mismatched name, or expired document"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => { setRejectDocTarget(null); setDocRejectReason(''); }}>Cancel</Button>
          <Button type="submit" variant="danger" disabled={saving || docRejectReason.trim().length < 3}>
            {saving ? 'Rejecting...' : 'Confirm Reject'}
          </Button>
        </div>
      </form>
    </ModalDialog>
  );

  const blockDialog = (
    <ModalDialog
      open={Boolean(blockTarget)}
      onOpenChange={(open) => {
        if (!open) {
          setBlockTarget(null);
          setBlockReason('');
        }
      }}
      title={blockTarget?.isBlocked ? 'Unblock Driver Partner' : 'Block Driver Partner'}
      description={blockTarget ? `${blockTarget.fullName} · ${blockTarget.city}` : undefined}
    >
      <div className="space-y-4">
        {!blockTarget?.isBlocked && (
          <Field label="Suspension Reason">
            <input className={inputCls} value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="e.g. Expired insurance or safety complaint" />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setBlockTarget(null); setBlockReason(''); }}>Cancel</Button>
          <Button variant={blockTarget?.isBlocked ? 'success' : 'danger'} onClick={handleBlockToggle} disabled={saving}>
            {blockTarget?.isBlocked ? 'Reinstate Driver' : 'Confirm Block'}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );

  const deleteConfirm = (
    <ConfirmDialog
      open={Boolean(deleteTarget)}
      onOpenChange={(o) => !o && setDeleteTarget(null)}
      title="Delete Driver Account"
      description={
        deleteTarget
          ? `Permanently delete driver partner ${deleteTarget.fullName} (${deleteTarget.id})?`
          : ''
      }
      confirmLabel="Delete Driver"
      danger
      loading={saving}
      onConfirm={handleDeleteDriver}
    />
  );

  // Pages 19, 20, 21, 22: Document Verification Queues
  const docQueueMap: Record<string, { type: DriverDocument['docType']; title: string }> = {
    'drivers/kyc': { type: 'kyc_aadhaar_pan', title: 'KYC Verification Queue (Aadhaar / PAN)' },
    'drivers/dl-verification': { type: 'driving_licence', title: 'Driving Licence Verification Queue' },
    'drivers/rc-verification': { type: 'vehicle_rc', title: 'RC Verification Queue' },
    'drivers/insurance-verification': { type: 'vehicle_insurance', title: 'Vehicle Insurance Verification Queue' },
  };

  if (docQueueMap[pageId]) {
    const cfg = docQueueMap[pageId];
    const filteredDocs = driverDocuments.filter((d) => d.docType === cfg.type);
    return (
      <div className="space-y-6">
        <Panel
          title={cfg.title}
          subtitle="Verify or reject submitted driver compliance records"
          action={
            drivers.length > 0 && (can('kyc', 'approve') || can('drivers', 'write')) ? (
              <Button
                size="sm"
                onClick={() => {
                  setDocType(cfg.type);
                  setDocModalOpen(true);
                }}
              >
                + Log Document
              </Button>
            ) : undefined
          }
        >
          <DataTable
            rows={filteredDocs}
            emptyTitle="No Documents in Queue"
            emptyDescription="Driver documents submitted via the Driver App or logged by KYC admins appear here."
            columns={[
              { key: 'driver', header: 'Driver ID', render: (d) => <span className="font-mono text-xs">{d.driverId}</span> },
              {
                key: 'num',
                header: 'Document Number',
                render: (d) => (
                  <div>
                    <div className="font-mono font-medium">{d.docNumber}</div>
                    {d.rejectionReason && <div className="text-[11px] text-[#DC2626]">{d.rejectionReason}</div>}
                  </div>
                ),
              },
              { key: 'exp', header: 'Expiry', render: (d) => d.expiryDate || '—' },
              { key: 'status', header: 'Status', render: (d) => <StatusText status={d.status} /> },
              {
                key: 'act',
                header: 'Review',
                align: 'right',
                render: (d) => (
                  <div className="inline-flex gap-1.5">
                    <Button size="sm" variant="success" disabled={!can('kyc', 'approve') || d.status === 'verified'} onClick={() => handleVerifyDoc(d, 'verified')}>
                      Verify
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!can('kyc', 'approve') || d.status === 'rejected'}
                      onClick={() => {
                        setRejectDocTarget(d);
                        setDocRejectReason(d.rejectionReason || '');
                      }}
                    >
                      Reject
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Panel>
        {docModal}
        {rejectDocModal}
      </div>
    );
  }

  // Page 18: Driver Details
  if (pageId === 'drivers/details') {
    const docs = activeDriver ? driverDocuments.filter((d) => d.driverId === activeDriver.id) : [];
    const drvVehicles = activeDriver ? vehicles.filter((v) => v.driverId === activeDriver.id) : [];
    const drvRides = activeDriver ? rides.filter((r) => r.driverId === activeDriver.id) : [];

    return (
      <div className="space-y-6">
        <Panel
          title="Driver Partner Profile"
          action={<Button size="sm" variant="outline" onClick={() => onNavigate('drivers/all')}>All Drivers</Button>}
        >
          {drivers.length === 0 ? (
            <EmptyState
              title="No Drivers Onboarded"
              description="Onboard a driver application to inspect KYC documents, vehicles, and earnings."
              action={<Button size="sm" onClick={() => openDriverModal()}>Onboard Driver</Button>}
            />
          ) : (
            <div className="space-y-5">
              <div className="max-w-sm">
                <Field label="Select Driver">
                  <select className={selectCls} value={activeDriver?.id || ''} onChange={(e) => setSelectedDriverId(e.target.value)}>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.fullName} · {d.vehicleCategory.toUpperCase()} · {d.city}</option>
                    ))}
                  </select>
                </Field>
              </div>
              {activeDriver && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatTile label="Application" value={String(activeDriver.applicationStatus || "").replace(/_/g, ' ')} highlight />
                    <StatTile label="KYC / DL" value={`${activeDriver.kycStatus} / ${activeDriver.dlStatus || 'pending'}`} />
                    <StatTile label="Total Earnings" value={formatINR(activeDriver.totalEarnings || 0)} tone="green" />
                    <StatTile label="Wallet Balance" value={formatINR(activeDriver.walletBalance || 0)} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 p-4 border border-[#E5E7EB] rounded-xl bg-[#FAFAFB]">
                    <div className="text-xs space-y-1">
                      <div className="text-sm font-semibold">{activeDriver.fullName}</div>
                      <div className="text-[#4B5563]">
                        ID: <span className="font-mono">{activeDriver.id}</span> · {maskPhone(activeDriver.phone)} · {activeDriver.city} · Commission: {activeDriver.commissionPct ?? 20}% · Vehicles: {drvVehicles.length}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {can('drivers', 'write') && (
                        <Button size="sm" variant="outline" onClick={() => openDriverModal(activeDriver)}>
                          <Pencil className="w-3.5 h-3.5" />
                          Edit Driver
                        </Button>
                      )}
                      {can('finance', 'write') && (
                        <Button size="sm" variant="outline" onClick={() => setWalletOpen(true)}>Adjust Wallet</Button>
                      )}
                      {can('kyc', 'approve') && (
                        <Button size="sm" variant="outline" onClick={() => { setDocDriverId(activeDriver.id); setDocModalOpen(true); }}>+ Add Document</Button>
                      )}
                      {can('drivers', 'approve') && activeDriver.applicationStatus !== 'approved' && (
                        <Button size="sm" variant="success" onClick={() => handleApplicationDecision(activeDriver, 'approved')}>
                          Approve Driver
                        </Button>
                      )}
                      {can('drivers', 'block') && (
                        <Button
                          size="sm"
                          variant={activeDriver.isBlocked ? 'success' : 'danger'}
                          onClick={() => {
                            setBlockTarget(activeDriver);
                            setBlockReason('');
                          }}
                        >
                          {activeDriver.isBlocked ? 'Unblock' : 'Block Driver'}
                        </Button>
                      )}
                      {can('drivers', 'write') && (
                        <Button size="sm" variant="outline" onClick={() => setDeleteTarget(activeDriver)}>
                          <Trash2 className="w-3.5 h-3.5 text-[#DC2626]" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </Panel>

        {activeDriver && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Panel title="Driver Compliance Documents" subtitle="KYC, Driving Licence, RC & Insurance status">
                <DataTable
                  rows={docs}
                  pageSize={5}
                  emptyTitle="No Documents Logged"
                  emptyDescription="Log KYC, DL, RC, or Insurance records for this driver."
                  columns={[
                    { key: 'type', header: 'Type', render: (d) => <span className="text-xs font-medium">{String(d.docType || "").replace(/_/g, ' ')}</span> },
                    {
                      key: 'num',
                      header: 'Number',
                      render: (d) => (
                        <div>
                          <div className="font-mono text-xs">{d.docNumber}</div>
                          {d.rejectionReason && <div className="text-[11px] text-[#DC2626]">{d.rejectionReason}</div>}
                        </div>
                      ),
                    },
                    { key: 'st', header: 'Status', render: (d) => <StatusText status={d.status} /> },
                    {
                      key: 'act',
                      header: 'Review',
                      align: 'right',
                      render: (d) => (
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="success" disabled={!can('kyc', 'approve') || d.status === 'verified'} onClick={() => handleVerifyDoc(d, 'verified')}>
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={!can('kyc', 'approve') || d.status === 'rejected'}
                            onClick={() => {
                              setRejectDocTarget(d);
                              setDocRejectReason(d.rejectionReason || '');
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      ),
                    },
                  ]}
                />
              </Panel>

              <Panel title="Assigned Vehicles" subtitle="Vehicles registered under this driver">
                <DataTable
                  rows={drvVehicles}
                  pageSize={5}
                  emptyTitle="No Assigned Vehicles"
                  emptyDescription="Register a vehicle for this driver under Vehicles."
                  columns={[
                    { key: 'plate', header: 'Plate', render: (v) => <span className="font-mono font-semibold">{v.plateNumber}</span> },
                    { key: 'model', header: 'Model', render: (v) => `${v.make} ${v.model}` },
                    { key: 'status', header: 'Status', render: (v) => <StatusText status={v.isActive ? 'active' : 'suspended'} /> },
                  ]}
                />
              </Panel>
            </div>

            <Panel title="Driver Trip History" subtitle={`Trips assigned to ${activeDriver.fullName}`}>
              <DataTable
                rows={drvRides}
                pageSize={5}
                emptyTitle="No Trips Assigned Yet"
                emptyDescription="Rides accepted by or dispatched to this driver appear here."
                columns={[
                  { key: 'id', header: 'Ride ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
                  { key: 'route', header: 'Route', render: (r) => <span className="text-xs">{r.pickupAddress} → {r.dropAddress}</span> },
                  { key: 'status', header: 'Status', render: (r) => <StatusText status={r.status} /> },
                  { key: 'payout', header: 'Driver Share', align: 'right', render: (r) => <span className="font-mono">{formatINR(r.driverPayoutAmount || 0)}</span> },
                ]}
                onRowClick={(r) => onNavigate('rides/details', r.id)}
              />
            </Panel>
          </>
        )}

        {createModal}
        {walletModal}
        {docModal}
        {rejectDocModal}
        {blockDialog}
        {deleteConfirm}
      </div>
    );
  }

  // Page 17: New Applications & Page 23: Approve/Reject Drivers
  if (pageId === 'drivers/applications' || pageId === 'drivers/approve-reject') {
    const list =
      pageId === 'drivers/applications'
        ? drivers.filter((d) => d.applicationStatus === 'pending' || d.applicationStatus === 'under_review' || !d.admin_approved)
        : drivers;
    return (
      <div className="space-y-6">
        <Panel
          title={pageId === 'drivers/applications' ? 'New Driver Applications' : 'Approve / Reject Driver Eligibility'}
          subtitle="Authorize verified partners to go online in the SHINE CAB Driver App"
          action={can('drivers', 'write') ? <Button size="sm" onClick={() => openDriverModal()}>+ New Application</Button> : undefined}
        >
          <DataTable
            rows={list}
            emptyTitle="No Pending Driver Applications"
            emptyDescription="Incoming driver applications from the Driver App or admin onboarding appear here."
            columns={[
              { key: 'name', header: 'Driver', render: (d) => <div><div className="font-semibold">{d.fullName}</div><div className="text-xs text-[#6B7280]">{d.city} · {d.vehicleCategory.toUpperCase()}</div></div> },
              { key: 'kyc', header: 'KYC', render: (d) => <StatusText status={d.kycStatus} /> },
              { key: 'dl', header: 'DL', render: (d) => <StatusText status={d.dlStatus || 'pending'} /> },
              { key: 'app', header: 'Application', render: (d) => <StatusText status={d.applicationStatus} /> },
              {
                key: 'act',
                header: 'Decision',
                align: 'right',
                render: (d) => (
                  <div className="inline-flex flex-wrap justify-end gap-1.5">
                    {d.applicationStatus === 'pending' && (
                      <Button size="sm" variant="outline" disabled={!can('drivers', 'approve')} onClick={() => handleApplicationDecision(d, 'under_review')}>
                        Review
                      </Button>
                    )}
                    <Button size="sm" variant="success" disabled={!can('drivers', 'approve') || d.applicationStatus === 'approved'} onClick={() => handleApplicationDecision(d, 'approved')}>
                      Approve
                    </Button>
                    <Button size="sm" variant="danger" disabled={!can('drivers', 'approve') || d.applicationStatus === 'rejected'} onClick={() => handleApplicationDecision(d, 'rejected')}>
                      Reject
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Panel>
        {createModal}
      </div>
    );
  }

  // Page 24: Driver Earnings
  if (pageId === 'drivers/earnings') {
    return (
      <div className="space-y-6">
        <Panel
          title="Driver Earnings & Wallet Ledger"
          subtitle="Net driver earnings after platform commission and manual incentive adjustments"
          action={
            can('finance', 'write') && drivers.length > 0 ? (
              <Button size="sm" onClick={() => setWalletOpen(true)}>+ Adjust Driver Wallet</Button>
            ) : undefined
          }
        >
          <DataTable
            rows={drivers}
            emptyTitle="No Driver Earnings Records"
            emptyDescription="Completed rides automatically credit driver earnings and wallet balances."
            columns={[
              { key: 'name', header: 'Driver', render: (d) => <span className="font-semibold">{d.fullName}</span> },
              { key: 'cat', header: 'Category', render: (d) => <span className="uppercase text-xs font-semibold">{d.vehicleCategory}</span> },
              { key: 'comm', header: 'Commission', align: 'right', render: (d) => <span className="font-mono">{d.commissionPct ?? 20}%</span> },
              { key: 'rides', header: 'Rides', align: 'right', render: (d) => d.totalRides || 0 },
              { key: 'earn', header: 'Total Earnings', align: 'right', render: (d) => <span className="font-mono">{formatINR(d.totalEarnings || 0)}</span> },
              { key: 'wallet', header: 'Withdrawable Wallet', align: 'right', render: (d) => <span className="font-mono font-semibold text-[#16A34A]">{formatINR(d.walletBalance || 0)}</span> },
            ]}
            onRowClick={(d) => onNavigate('drivers/details', d.id)}
          />
        </Panel>
        {walletModal}
      </div>
    );
  }

  // Page 25: Block/Unblock Drivers
  if (pageId === 'drivers/block-unblock') {
    return (
      <div className="space-y-6">
        <Panel title="Driver Suspension & Reinstatement" subtitle="Blocked drivers are immediately blocked from accepting rides">
          <DataTable
            rows={drivers}
            emptyTitle="No Drivers Registered"
            emptyDescription="Onboard drivers to manage ride eligibility and suspension controls."
            columns={[
              { key: 'name', header: 'Driver', render: (d) => <div><div className="font-semibold">{d.fullName}</div><div className="text-xs text-[#6B7280]">{maskPhone(d.phone)} · {d.city}</div></div> },
              { key: 'status', header: 'Status', render: (d) => <StatusText status={d.isBlocked ? 'blocked' : 'active'} tone={d.isBlocked ? 'red' : 'green'} /> },
              { key: 'reason', header: 'Reason', render: (d) => <span className="text-xs text-[#6B7280]">{d.blockReason || '—'}</span> },
              {
                key: 'act',
                header: 'Action',
                align: 'right',
                render: (d) => (
                  <Button
                    size="sm"
                    variant={d.isBlocked ? 'success' : 'danger'}
                    disabled={!can('drivers', 'block')}
                    onClick={() => {
                      setBlockTarget(d);
                      setBlockReason('');
                    }}
                  >
                    {d.isBlocked ? 'Unblock' : 'Block'}
                  </Button>
                ),
              },
            ]}
          />
        </Panel>
        {blockDialog}
      </div>
    );
  }

  // Page 16: All Drivers
  const filteredDrivers = drivers.filter((d) => {
    if (catFilter !== 'all' && d.vehicleCategory !== catFilter) return false;
    if (appFilter === 'blocked') return d.isBlocked;
    if (appFilter !== 'all' && d.applicationStatus !== appFilter) return false;
    return true;
  });

  const exportDriversCsv = () => {
    const header = ['DriverID', 'FullName', 'Category', 'City', 'ApplicationStatus', 'KYC', 'Online', 'Blocked', 'CommissionPct', 'WalletBalanceINR'];
    const lines = [
      header.join(','),
      ...filteredDrivers.map((d) =>
        [d.id, d.fullName, d.vehicleCategory, d.city, d.applicationStatus, d.kycStatus, d.isOnline, d.isBlocked, d.commissionPct ?? 20, d.walletBalance || 0]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shine-cab-drivers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Drivers CSV Exported', `${filteredDrivers.length} rows downloaded.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Total Drivers" value={drivers.length} highlight />
        <StatTile label="Approved" value={drivers.filter((d) => d.applicationStatus === 'approved').length} tone="green" />
        <StatTile label="Pending Review" value={drivers.filter((d) => d.applicationStatus === 'pending' || d.applicationStatus === 'under_review').length} tone="amber" />
        <StatTile label="Blocked" value={drivers.filter((d) => d.isBlocked).length} tone="red" />
      </div>
      <Panel
        title="All Drivers Directory"
        subtitle="Master partner list across Bike, Auto, and Cab categories"
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportDriversCsv}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
            {can('drivers', 'write') && (
              <Button size="sm" onClick={() => openDriverModal()}>+ Onboard Driver</Button>
            )}
          </div>
        }
      >
        <DataTable
          rows={filteredDrivers}
          searchPlaceholder="Search driver name, phone, city..."
          filterControls={
            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filter driver category"
                className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
                value={catFilter}
                onChange={(e) => setCatFilter(e.target.value as 'all' | VehicleCategory)}
              >
                <option value="all">All Categories</option>
                <option value="bike">Bike</option>
                <option value="auto">Auto</option>
                <option value="cab">Cab</option>
              </select>
              <select
                aria-label="Filter driver status"
                className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
                value={appFilter}
                onChange={(e) => setAppFilter(e.target.value as typeof appFilter)}
              >
                <option value="all">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="rejected">Rejected</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          }
          emptyTitle="No Drivers Registered"
          emptyDescription="Add a driver application or connect the SHINE CAB Driver App."
          emptyAction={can('drivers', 'write') ? <Button size="sm" onClick={() => openDriverModal()}>Onboard First Driver</Button> : undefined}
          columns={[
            { key: 'name', header: 'Driver', sortValue: (d) => d.fullName, render: (d) => <div><div className="font-semibold">{d.fullName}</div><div className="text-xs text-[#6B7280] font-mono">{d.id}</div></div> },
            { key: 'cat', header: 'Category', render: (d) => <span className="uppercase text-xs font-semibold">{d.vehicleCategory}</span> },
            { key: 'city', header: 'City', render: (d) => d.city },
            { key: 'app', header: 'Application', render: (d) => <StatusText status={d.applicationStatus} /> },
            { key: 'kyc', header: 'KYC', render: (d) => <StatusText status={d.kycStatus} /> },
            { key: 'online', header: 'Presence', render: (d) => <StatusText status={d.isBlocked ? 'blocked' : d.isOnline ? 'online' : 'offline'} /> },
          ]}
          onRowClick={(d) => onNavigate('drivers/details', d.id)}
        />
      </Panel>
      {createModal}
      {walletModal}
      {docModal}
      {rejectDocModal}
      {blockDialog}
      {deleteConfirm}
    </div>
  );
};
