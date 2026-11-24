import React, { useEffect, useMemo, useState } from 'react';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { createRecord, deleteRecord, updateRecord } from '../services/firestoreService';
import { formatDateTime, formatINR, maskPhone, sanitizeId } from '../lib/utils';
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
import { Customer, SupportTicket } from '../types/domain';

interface CustomerPagesProps {
  pageId: string;
  selectedId: string | null;
  onNavigate: (pageId: string, selectedId?: string) => void;
}

export const CustomerPages: React.FC<CustomerPagesProps> = ({
  pageId,
  selectedId,
  onNavigate,
}) => {
  const { user, roleId, can } = useAuth();
  const { customers, rides, payments, walletTransactions, supportTickets, pushToast } = useData();

  const [createOpen, setCreateOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('Bengaluru');
  const [saving, setSaving] = useState(false);

  const [activeCustomerId, setActiveCustomerId] = useState<string>(selectedId || '');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending' | 'rejected' | 'blocked'>('all');

  useEffect(() => {
    if (selectedId) {
      setActiveCustomerId(selectedId);
    }
  }, [selectedId]);

  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletDirection, setWalletDirection] = useState<'credit' | 'debit'>('credit');
  const [walletAmount, setWalletAmount] = useState('100');
  const [walletReason, setWalletReason] = useState('');

  const [complaintOpen, setComplaintOpen] = useState(false);
  const [complaintSubject, setComplaintSubject] = useState('');
  const [complaintDesc, setComplaintDesc] = useState('');
  const [complaintPriority, setComplaintPriority] = useState<SupportTicket['priority']>('medium');

  const [blockTarget, setBlockTarget] = useState<Customer | null>(null);
  const [blockReason, setBlockReason] = useState('');

  const actor = useMemo(
    () => ({
      uid: user?.uid || 'unknown',
      email: user?.email || 'unknown',
      roleId,
    }),
    [user, roleId]
  );

  const effectiveCustomer = useMemo(
    () =>
      customers.find((c) => c.id === (activeCustomerId || selectedId)) ||
      customers[0] ||
      null,
    [customers, selectedId, activeCustomerId]
  );

  const openCustomerModal = (cust?: Customer) => {
    if (cust) {
      setEditingCustomer(cust);
      setFullName(cust.fullName);
      setPhone(cust.phone);
      setEmail(cust.email || '');
      setCity(cust.city);
    } else {
      setEditingCustomer(null);
      setFullName('');
      setPhone('');
      setEmail('');
      setCity('Bengaluru');
    }
    setCreateOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('customers', 'write')) {
      pushToast('error', 'Permission Denied', 'Your role cannot modify customer accounts.');
      return;
    }
    if (!fullName.trim() || phone.trim().length < 7) {
      pushToast('error', 'Validation Error', 'Enter a valid full name and phone number.');
      return;
    }
    setSaving(true);
    try {
      if (editingCustomer) {
        await updateRecord(
          'customers',
          editingCustomer.id,
          {
            fullName: fullName.trim(),
            phone: phone.trim(),
            email: email.trim(),
            city: city.trim() || 'Bengaluru',
          },
          actor,
          'update_customer',
          `Updated customer profile ${fullName.trim()}`
        );
        pushToast('success', 'Customer Updated', fullName.trim());
      } else {
        const id = sanitizeId('cust');
        await createRecord(
          'customers',
          id,
          {
            profileId: id,
            fullName: fullName.trim(),
            phone: phone.trim(),
            ...(email.trim() ? { email: email.trim() } : {}),
            city: city.trim() || 'Bengaluru',
            kycStatus: 'pending',
            walletBalance: 0,
            totalRides: 0,
            rating: 5,
            isBlocked: false,
          },
          actor,
          'create_customer',
          `Registered customer ${fullName.trim()} (${city.trim()})`
        );
        pushToast('success', 'Customer Registered', `${fullName.trim()} added to shared directory.`);
      }
      setCreateOpen(false);
    } catch (err) {
      pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Unable to save customer');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCustomer = async () => {
    if (!deleteTarget || !can('customers', 'write')) return;
    setSaving(true);
    try {
      await deleteRecord(
        'customers',
        deleteTarget.id,
        actor,
        'delete_customer',
        `Deleted customer account ${deleteTarget.fullName} (${deleteTarget.id})`
      );
      pushToast('success', 'Customer Deleted', deleteTarget.fullName);
      setDeleteTarget(null);
      if (activeCustomerId === deleteTarget.id) {
        setActiveCustomerId('');
      }
    } catch (err) {
      pushToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleKycUpdate = async (cust: Customer, status: 'verified' | 'rejected') => {
    if (!can('customers', 'write')) {
      pushToast('error', 'Permission Denied', 'Insufficient privileges to verify customer.');
      return;
    }
    try {
      await updateRecord(
        'customers',
        cust.id,
        { kycStatus: status },
        actor,
        `customer_kyc_${status}`,
        `Set customer ${cust.fullName} verification status to ${status}`
      );
      pushToast('success', 'Verification Updated', `${cust.fullName} marked as ${status}.`);
    } catch (err) {
      pushToast('error', 'Update Failed', err instanceof Error ? err.message : 'Failed');
    }
  };

  const handleBlockToggle = async () => {
    if (!blockTarget) return;
    if (!can('customers', 'block')) {
      pushToast('error', 'Permission Denied', 'Your role cannot block/unblock customers.');
      return;
    }
    const nextBlocked = !blockTarget.isBlocked;
    if (nextBlocked && blockReason.trim().length < 3) {
      pushToast('error', 'Reason Required', 'Provide a reason for blocking this customer.');
      return;
    }
    setSaving(true);
    try {
      await updateRecord(
        'customers',
        blockTarget.id,
        {
          isBlocked: nextBlocked,
          blockReason: nextBlocked ? blockReason.trim() : '',
        },
        actor,
        nextBlocked ? 'block_customer' : 'unblock_customer',
        `${nextBlocked ? 'Blocked' : 'Unblocked'} customer ${blockTarget.fullName}: ${blockReason || 'Reinstated'}`
      );
      pushToast('success', nextBlocked ? 'Customer Blocked' : 'Customer Unblocked', blockTarget.fullName);
      setBlockTarget(null);
      setBlockReason('');
    } catch (err) {
      pushToast('error', 'Action Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleWalletAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveCustomer || !can('finance', 'write')) {
      pushToast('error', 'Permission Denied', 'Finance write permission required to adjust wallets.');
      return;
    }
    const amt = Number(walletAmount);
    if (!Number.isFinite(amt) || amt <= 0 || !walletReason.trim()) {
      pushToast('error', 'Invalid Input', 'Enter a positive amount and adjustment reason.');
      return;
    }
    if (walletDirection === 'debit' && amt > effectiveCustomer.walletBalance) {
      pushToast('error', 'Insufficient Balance', 'Debit exceeds customer wallet balance.');
      return;
    }
    setSaving(true);
    try {
      const nextBalance =
        walletDirection === 'credit'
          ? effectiveCustomer.walletBalance + amt
          : effectiveCustomer.walletBalance - amt;
      const txId = sanitizeId('wtx');
      await createRecord(
        'wallet_transactions',
        txId,
        {
          ownerId: effectiveCustomer.id,
          ownerType: 'customer',
          amount: amt,
          direction: walletDirection,
          reason: walletReason.trim(),
          createdBy: actor.uid,
        },
        actor,
        `customer_wallet_${walletDirection}`,
        `${walletDirection.toUpperCase()} ${formatINR(amt)} for ${effectiveCustomer.fullName}`,
        false
      );
      await updateRecord(
        'customers',
        effectiveCustomer.id,
        { walletBalance: nextBalance },
        actor,
        'customer_wallet_balance_sync',
        `Updated wallet balance to ${formatINR(nextBalance)}`
      );
      pushToast('success', 'Wallet Updated', `New balance: ${formatINR(nextBalance)}`);
      setWalletModalOpen(false);
      setWalletReason('');
    } catch (err) {
      pushToast('error', 'Wallet Error', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleFileComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('support', 'write')) {
      pushToast('error', 'Permission Denied', 'Support write permission required.');
      return;
    }
    const cid = effectiveCustomer?.id || customers[0]?.id;
    if (!cid || !complaintSubject.trim() || !complaintDesc.trim()) {
      pushToast('error', 'Validation Error', 'Select a customer and enter subject and details.');
      return;
    }
    setSaving(true);
    try {
      await createRecord(
        'support_tickets',
        sanitizeId('cmp'),
        {
          userId: cid,
          userType: 'customer',
          category: 'customer_complaint',
          priority: complaintPriority,
          status: 'open',
          subject: complaintSubject.trim(),
          description: complaintDesc.trim(),
          isSos: false,
        },
        actor,
        'file_customer_complaint',
        `Logged complaint for customer ${cid}: ${complaintSubject.trim()}`
      );
      pushToast('success', 'Complaint Logged', complaintSubject.trim());
      setComplaintSubject('');
      setComplaintDesc('');
      setComplaintOpen(false);
    } catch (err) {
      pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const createModal = (
    <ModalDialog
      open={createOpen}
      onOpenChange={setCreateOpen}
      title={editingCustomer ? `Edit Customer · ${editingCustomer.fullName}` : 'Register Customer Account'}
      description="Synchronized with the SHINE CAB Customer App."
    >
      <form onSubmit={handleSaveCustomer} className="space-y-4">
        <Field label="Full Name">
          <input className={inputCls} value={fullName} onChange={(e) => setFullName(e.target.value)} required placeholder="e.g. Aarav Sharma" />
        </Field>
        <Field label="Mobile Number">
          <input className={inputCls} value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+91 9876543210" />
        </Field>
        <Field label="Email Address (Optional)">
          <input className={inputCls} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="aarav@example.com" />
        </Field>
        <Field label="Primary City">
          <input className={inputCls} value={city} onChange={(e) => setCity(e.target.value)} required />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Create Customer'}</Button>
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
      title={blockTarget?.isBlocked ? 'Unblock Customer Account' : 'Block Customer Account'}
      description={blockTarget ? `Account: ${blockTarget.fullName} (${maskPhone(blockTarget.phone)})` : undefined}
    >
      <div className="space-y-4">
        {!blockTarget?.isBlocked && (
          <Field label="Reason for Blocking">
            <input
              className={inputCls}
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="e.g. Repeated payment chargeback or policy violation"
            />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => { setBlockTarget(null); setBlockReason(''); }}>Cancel</Button>
          <Button variant={blockTarget?.isBlocked ? 'success' : 'danger'} onClick={handleBlockToggle} disabled={saving}>
            {saving ? 'Updating...' : blockTarget?.isBlocked ? 'Unblock Customer' : 'Confirm Block'}
          </Button>
        </div>
      </div>
    </ModalDialog>
  );

  const deleteConfirm = (
    <ConfirmDialog
      open={Boolean(deleteTarget)}
      onOpenChange={(o) => !o && setDeleteTarget(null)}
      title="Delete Customer Account"
      description={
        deleteTarget
          ? `Permanently delete ${deleteTarget.fullName} (${deleteTarget.id})? Historical rides remain preserved.`
          : ''
      }
      confirmLabel="Delete Customer"
      danger
      loading={saving}
      onConfirm={handleDeleteCustomer}
    />
  );

  // Page 9: Customer Details
  if (pageId === 'customers/details') {
    const custRides = effectiveCustomer ? rides.filter((r) => r.customerId === effectiveCustomer.id) : [];
    const custWalletEntries = effectiveCustomer
      ? walletTransactions.filter((w) => w.ownerType === 'customer' && w.ownerId === effectiveCustomer.id)
      : [];

    return (
      <div className="space-y-6">
        <Panel
          title="Select Customer Profile"
          action={
            <Button size="sm" variant="outline" onClick={() => onNavigate('customers/all')}>
              Back to Directory
            </Button>
          }
        >
          {customers.length === 0 ? (
            <EmptyState
              title="No Customers Found"
              description="Register a customer first to inspect detailed ride history, wallet balance, and verification controls."
              action={<Button size="sm" onClick={() => openCustomerModal()}>Register Customer</Button>}
            />
          ) : (
            <div className="space-y-5">
              <div className="max-w-sm">
                <Field label="Active Customer">
                  <select
                    className={selectCls}
                    value={effectiveCustomer?.id || ''}
                    onChange={(e) => setActiveCustomerId(e.target.value)}
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} · {c.city}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              {effectiveCustomer && (
                <>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <StatTile label="Wallet Balance" value={formatINR(effectiveCustomer.walletBalance)} tone="green" highlight />
                    <StatTile label="Total Rides" value={custRides.length || effectiveCustomer.totalRides} />
                    <StatTile label="Verification" value={effectiveCustomer.kycStatus} />
                    <StatTile label="Account Status" value={effectiveCustomer.isBlocked ? 'Blocked' : 'Active'} tone={effectiveCustomer.isBlocked ? 'red' : 'green'} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-4 p-4 border border-[#E5E7EB] rounded-xl bg-[#FAFAFB]">
                    <div className="space-y-1 text-xs">
                      <div className="text-sm font-semibold text-[#111111]">{effectiveCustomer.fullName}</div>
                      <div className="text-[#4B5563]">
                        ID: <span className="font-mono">{effectiveCustomer.id}</span> · Phone: {maskPhone(effectiveCustomer.phone)} · City: {effectiveCustomer.city}
                        {effectiveCustomer.email ? ` · ${effectiveCustomer.email}` : ''}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {can('customers', 'write') && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openCustomerModal(effectiveCustomer)}>
                            <Pencil className="w-3.5 h-3.5" />
                            Edit Profile
                          </Button>
                          {effectiveCustomer.kycStatus !== 'verified' && (
                            <Button size="sm" variant="success" onClick={() => handleKycUpdate(effectiveCustomer, 'verified')}>
                              Verify KYC
                            </Button>
                          )}
                        </>
                      )}
                      {can('finance', 'write') && (
                        <Button size="sm" onClick={() => setWalletModalOpen(true)}>Adjust Wallet</Button>
                      )}
                      {can('customers', 'block') && (
                        <Button
                          size="sm"
                          variant={effectiveCustomer.isBlocked ? 'success' : 'danger'}
                          onClick={() => {
                            setBlockTarget(effectiveCustomer);
                            setBlockReason('');
                          }}
                        >
                          {effectiveCustomer.isBlocked ? 'Unblock' : 'Block Customer'}
                        </Button>
                      )}
                      {can('customers', 'write') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteTarget(effectiveCustomer)}
                        >
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

        {effectiveCustomer && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Panel title="Customer Trips" subtitle={`Rides booked by ${effectiveCustomer.fullName}`}>
              <DataTable
                rows={custRides}
                pageSize={5}
                emptyTitle="No Trips Yet"
                emptyDescription="Trips booked by this customer will list here."
                columns={[
                  { key: 'id', header: 'Ride', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
                  { key: 'status', header: 'Status', render: (r) => <StatusText status={r.status} /> },
                  { key: 'fare', header: 'Fare', align: 'right', render: (r) => <span className="font-mono">{formatINR(r.finalFare)}</span> },
                ]}
                onRowClick={(r) => onNavigate('rides/details', r.id)}
              />
            </Panel>
            <Panel title="Wallet Activity" subtitle="Credit and debit history for this account">
              <DataTable
                rows={custWalletEntries}
                pageSize={5}
                emptyTitle="No Wallet Activity"
                emptyDescription="Credits, refunds, and trip debits appear here."
                columns={[
                  { key: 'dir', header: 'Type', render: (w) => <StatusText status={w.direction} tone={w.direction === 'credit' ? 'green' : 'amber'} /> },
                  { key: 'amt', header: 'Amount', align: 'right', render: (w) => <span className="font-mono">{formatINR(w.amount)}</span> },
                  { key: 'reason', header: 'Reason', render: (w) => <span className="text-xs">{w.reason}</span> },
                ]}
              />
            </Panel>
          </div>
        )}

        <ModalDialog open={walletModalOpen} onOpenChange={setWalletModalOpen} title="Adjust Customer Wallet">
          <form onSubmit={handleWalletAdjust} className="space-y-4">
            <Field label="Direction">
              <select className={selectCls} value={walletDirection} onChange={(e) => setWalletDirection(e.target.value as 'credit' | 'debit')}>
                <option value="credit">Credit (+)</option>
                <option value="debit">Debit (-)</option>
              </select>
            </Field>
            <Field label="Amount (INR)">
              <input className={inputCls} type="number" min="1" step="0.01" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} required />
            </Field>
            <Field label="Reason">
              <input className={inputCls} value={walletReason} onChange={(e) => setWalletReason(e.target.value)} required placeholder="e.g. Goodwill credit or ride adjustment" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setWalletModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Submit Entry</Button>
            </div>
          </form>
        </ModalDialog>
        {createModal}
        {blockDialog}
        {deleteConfirm}
      </div>
    );
  }

  // Page 10: Customer Verification
  if (pageId === 'customers/verification') {
    return (
      <Panel title="Customer Identity Verification Queue" subtitle="Approve or reject customer verification records">
        <DataTable
          rows={customers}
          emptyTitle="No Customers Awaiting Verification"
          emptyDescription="Customer accounts synced from the Customer App appear here."
          columns={[
            { key: 'name', header: 'Customer', render: (c) => <div><div className="font-medium">{c.fullName}</div><div className="text-xs text-[#6B7280] font-mono">{c.id}</div></div> },
            { key: 'phone', header: 'Phone', render: (c) => maskPhone(c.phone) },
            { key: 'city', header: 'City', render: (c) => c.city },
            { key: 'kyc', header: 'KYC Status', render: (c) => <StatusText status={c.kycStatus} /> },
            {
              key: 'actions',
              header: 'Actions',
              align: 'right',
              render: (c) => (
                <div className="inline-flex gap-1.5">
                  <Button size="sm" variant="success" disabled={!can('customers', 'write') || c.kycStatus === 'verified'} onClick={() => handleKycUpdate(c, 'verified')}>
                    Verify
                  </Button>
                  <Button size="sm" variant="danger" disabled={!can('customers', 'write') || c.kycStatus === 'rejected'} onClick={() => handleKycUpdate(c, 'rejected')}>
                    Reject
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </Panel>
    );
  }

  // Page 11: Customer Ride History
  if (pageId === 'customers/ride-history') {
    return (
      <Panel title="Customer Ride History" subtitle="Cross-app trip records with preserved fare snapshots">
        <DataTable
          rows={rides}
          emptyTitle="No Customer Rides Recorded"
          emptyDescription="Completed and active customer bookings will populate here."
          columns={[
            { key: 'id', header: 'Ride ID', render: (r) => <span className="font-mono text-xs">{r.id}</span> },
            { key: 'customer', header: 'Customer ID', render: (r) => <span className="font-mono text-xs">{r.customerId}</span> },
            { key: 'route', header: 'Route', render: (r) => <span className="text-xs">{r.pickupAddress} → {r.dropAddress}</span> },
            { key: 'status', header: 'Status', render: (r) => <StatusText status={r.status} /> },
            { key: 'fare', header: 'Fare', align: 'right', render: (r) => <span className="font-mono">{formatINR(r.finalFare)}</span> },
            { key: 'dt', header: 'Date', render: (r) => <span className="text-xs text-[#6B7280]">{formatDateTime(r.createdAt)}</span> },
          ]}
          onRowClick={(r) => onNavigate('rides/details', r.id)}
        />
      </Panel>
    );
  }

  // Page 12: Customer Wallet
  if (pageId === 'customers/wallet') {
    const custWalletTx = walletTransactions.filter((w) => w.ownerType === 'customer');
    return (
      <div className="space-y-6">
        <Panel
          title="Customer Wallet Ledger"
          subtitle="Immutable credit and debit entries for customer wallets"
          action={
            effectiveCustomer && can('finance', 'write') ? (
              <Button size="sm" onClick={() => setWalletModalOpen(true)}>New Wallet Adjustment</Button>
            ) : undefined
          }
        >
          <DataTable
            rows={custWalletTx}
            emptyTitle="No Customer Wallet Transactions"
            emptyDescription="Wallet credits, refunds, and ride debits appear here once recorded."
            columns={[
              { key: 'id', header: 'Tx ID', render: (w) => <span className="font-mono text-xs">{w.id}</span> },
              { key: 'owner', header: 'Customer ID', render: (w) => <span className="font-mono text-xs">{w.ownerId}</span> },
              { key: 'dir', header: 'Direction', render: (w) => <StatusText status={w.direction} tone={w.direction === 'credit' ? 'green' : 'amber'} /> },
              { key: 'amt', header: 'Amount', align: 'right', render: (w) => <span className="font-mono font-medium">{formatINR(w.amount)}</span> },
              { key: 'reason', header: 'Reason', render: (w) => w.reason },
              { key: 'dt', header: 'Timestamp', render: (w) => <span className="text-xs text-[#6B7280]">{formatDateTime(w.createdAt)}</span> },
            ]}
          />
        </Panel>

        <ModalDialog open={walletModalOpen} onOpenChange={setWalletModalOpen} title="Customer Wallet Adjustment">
          <form onSubmit={handleWalletAdjust} className="space-y-4">
            <Field label="Customer">
              <select className={selectCls} value={effectiveCustomer?.id || ''} onChange={(e) => setActiveCustomerId(e.target.value)}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName} ({formatINR(c.walletBalance)})</option>
                ))}
              </select>
            </Field>
            <Field label="Direction">
              <select className={selectCls} value={walletDirection} onChange={(e) => setWalletDirection(e.target.value as 'credit' | 'debit')}>
                <option value="credit">Credit (+)</option>
                <option value="debit">Debit (-)</option>
              </select>
            </Field>
            <Field label="Amount (INR)">
              <input className={inputCls} type="number" min="1" step="0.01" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} required />
            </Field>
            <Field label="Reason">
              <input className={inputCls} value={walletReason} onChange={(e) => setWalletReason(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setWalletModalOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Record Entry</Button>
            </div>
          </form>
        </ModalDialog>
      </div>
    );
  }

  // Page 13: Customer Payments
  if (pageId === 'customers/payments') {
    return (
      <Panel title="Customer Payments Ledger" subtitle="Track payment method, verification flag, and provider transaction references">
        <DataTable
          rows={payments}
          emptyTitle="No Customer Payments Recorded"
          emptyDescription="Verified cash, UPI, online, and wallet ride payments will appear here."
          columns={[
            { key: 'id', header: 'Payment ID', render: (p) => <span className="font-mono text-xs">{p.id}</span> },
            { key: 'cust', header: 'Customer ID', render: (p) => <span className="font-mono text-xs">{p.customerId}</span> },
            { key: 'ride', header: 'Ride ID', render: (p) => <span className="font-mono text-xs">{p.rideId}</span> },
            { key: 'method', header: 'Method', render: (p) => <span className="uppercase text-xs font-semibold">{p.method}</span> },
            { key: 'status', header: 'Status', render: (p) => <StatusText status={p.status} /> },
            { key: 'amt', header: 'Amount', align: 'right', render: (p) => <span className="font-mono font-medium">{formatINR(p.amount)}</span> },
          ]}
          onRowClick={(p) => onNavigate('rides/details', p.rideId)}
        />
      </Panel>
    );
  }

  // Page 14: Customer Complaints
  if (pageId === 'customers/complaints') {
    const complaints = supportTickets.filter((t) => t.userType === 'customer');
    return (
      <div className="space-y-6">
        <Panel
          title="Customer Complaints"
          subtitle="Customer-filed service and fare disputes"
          action={
            <div className="flex gap-2">
              {can('support', 'write') && customers.length > 0 && (
                <Button size="sm" onClick={() => setComplaintOpen(true)}>+ Log Complaint</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => onNavigate('support/customer-tickets')}>
                Support Queue
              </Button>
            </div>
          }
        >
          <DataTable
            rows={complaints}
            emptyTitle="No Customer Complaints"
            emptyDescription="Open customer complaints from the SHINE CAB Customer App appear here."
            columns={[
              { key: 'id', header: 'Ticket', render: (t) => <span className="font-mono text-xs">{t.id}</span> },
              { key: 'subject', header: 'Subject', render: (t) => <span className="font-medium">{t.subject}</span> },
              { key: 'priority', header: 'Priority', render: (t) => <StatusText status={t.priority} /> },
              { key: 'status', header: 'Status', render: (t) => <StatusText status={t.status} /> },
              { key: 'dt', header: 'Filed', render: (t) => <span className="text-xs text-[#6B7280]">{formatDateTime(t.createdAt)}</span> },
            ]}
            onRowClick={() => onNavigate('support/customer-tickets')}
          />
        </Panel>

        <ModalDialog open={complaintOpen} onOpenChange={setComplaintOpen} title="Log Customer Complaint">
          <form onSubmit={handleFileComplaint} className="space-y-4">
            <Field label="Customer">
              <select className={selectCls} value={effectiveCustomer?.id || ''} onChange={(e) => setActiveCustomerId(e.target.value)}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName} ({c.city})</option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select className={selectCls} value={complaintPriority} onChange={(e) => setComplaintPriority(e.target.value as SupportTicket['priority'])}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </Field>
            <Field label="Subject">
              <input className={inputCls} value={complaintSubject} onChange={(e) => setComplaintSubject(e.target.value)} required placeholder="e.g. Overcharge dispute on Airport trip" />
            </Field>
            <Field label="Details">
              <textarea className="w-full p-3 text-sm bg-white border border-[#D1D5DB] rounded-lg" rows={3} value={complaintDesc} onChange={(e) => setComplaintDesc(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setComplaintOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Submit Complaint</Button>
            </div>
          </form>
        </ModalDialog>
      </div>
    );
  }

  // Page 15: Block/Unblock Customers
  if (pageId === 'customers/block-unblock') {
    return (
      <div className="space-y-6">
        <Panel title="Customer Access Governance" subtitle="Block or reinstate customer accounts with mandatory audit reason">
          <DataTable
            rows={customers}
            emptyTitle="No Customer Accounts"
            emptyDescription="Register customers to manage booking access controls."
            columns={[
              { key: 'name', header: 'Customer', render: (c) => <div><div className="font-medium">{c.fullName}</div><div className="text-xs text-[#6B7280]">{maskPhone(c.phone)} · {c.city}</div></div> },
              { key: 'status', header: 'Booking Access', render: (c) => <StatusText status={c.isBlocked ? 'blocked' : 'active'} tone={c.isBlocked ? 'red' : 'green'} /> },
              { key: 'reason', header: 'Block Reason', render: (c) => <span className="text-xs text-[#6B7280]">{c.blockReason || '—'}</span> },
              {
                key: 'act',
                header: 'Action',
                align: 'right',
                render: (c) => (
                  <Button
                    size="sm"
                    variant={c.isBlocked ? 'success' : 'danger'}
                    disabled={!can('customers', 'block')}
                    onClick={() => {
                      setBlockTarget(c);
                      setBlockReason('');
                    }}
                  >
                    {c.isBlocked ? 'Unblock' : 'Block'}
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

  // Page 8: All Customers
  const filteredCustomers = customers.filter((c) => {
    if (statusFilter === 'blocked') return c.isBlocked;
    if (statusFilter === 'verified' || statusFilter === 'pending' || statusFilter === 'rejected') {
      return c.kycStatus === statusFilter;
    }
    return true;
  });

  const exportCustomersCsv = () => {
    const header = ['CustomerID', 'FullName', 'City', 'KYCStatus', 'WalletBalanceINR', 'TotalRides', 'Blocked'];
    const lines = [
      header.join(','),
      ...filteredCustomers.map((c) =>
        [c.id, c.fullName, c.city, c.kycStatus, c.walletBalance, c.totalRides, c.isBlocked]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shine-cab-customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Customers CSV Exported', `${filteredCustomers.length} rows downloaded.`);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatTile label="Registered Customers" value={customers.length} highlight />
        <StatTile label="Verified" value={customers.filter((c) => c.kycStatus === 'verified').length} tone="green" />
        <StatTile label="Blocked" value={customers.filter((c) => c.isBlocked).length} tone="red" />
        <StatTile label="Wallet Liability" value={formatINR(customers.reduce((s, c) => s + (c.walletBalance || 0), 0))} />
      </div>
      <Panel
        title="Customer Directory"
        subtitle="Real-time synchronized customer accounts"
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={exportCustomersCsv}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
            {can('customers', 'write') && (
              <Button size="sm" onClick={() => openCustomerModal()}>+ Register Customer</Button>
            )}
          </div>
        }
      >
        <DataTable
          rows={filteredCustomers}
          searchPlaceholder="Search by name, phone, city..."
          filterControls={
            <select
              aria-label="Filter customer status"
              className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">All Customers ({customers.length})</option>
              <option value="verified">KYC Verified</option>
              <option value="pending">KYC Pending</option>
              <option value="rejected">KYC Rejected</option>
              <option value="blocked">Blocked Accounts</option>
            </select>
          }
          emptyTitle="No Customers Registered"
          emptyDescription="Customers signing up on the SHINE CAB Customer App or added here will appear in real time."
          emptyAction={can('customers', 'write') ? <Button size="sm" onClick={() => openCustomerModal()}>Register First Customer</Button> : undefined}
          columns={[
            { key: 'name', header: 'Customer', sortValue: (c) => c.fullName, render: (c) => <div><div className="font-semibold">{c.fullName}</div><div className="text-xs text-[#6B7280] font-mono">{c.id}</div></div> },
            { key: 'phone', header: 'Phone', render: (c) => <span className="font-mono text-xs">{maskPhone(c.phone)}</span> },
            { key: 'city', header: 'City', sortValue: (c) => c.city, render: (c) => c.city },
            { key: 'kyc', header: 'KYC', render: (c) => <StatusText status={c.kycStatus} /> },
            { key: 'wallet', header: 'Wallet', align: 'right', sortValue: (c) => c.walletBalance, render: (c) => <span className="font-mono">{formatINR(c.walletBalance)}</span> },
            { key: 'status', header: 'Access', render: (c) => <StatusText status={c.isBlocked ? 'blocked' : 'active'} tone={c.isBlocked ? 'red' : 'green'} /> },
          ]}
          onRowClick={(c) => onNavigate('customers/details', c.id)}
        />
      </Panel>
      {createModal}
      {blockDialog}
      {deleteConfirm}
    </div>
  );
};
