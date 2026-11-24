import React, { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { createRecord, updateRecord } from '../services/firestoreService';
import { formatDateTime, formatINR, sanitizeId } from '../lib/utils';
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
import { Payment, Payout } from '../types/domain';

interface FinancePagesProps {
  pageId: string;
}

export const FinancePages: React.FC<FinancePagesProps> = ({ pageId }) => {
  const { user, roleId, can, getToken } = useAuth();
  const { payments, payouts, walletTransactions, rides, drivers, customers, integrations, pushToast } =
    useData();

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [rideId, setRideId] = useState('');
  const [method, setMethod] = useState<Payment['method']>('cash');
  const [amount, setAmount] = useState('');
  const [providerTxId, setProviderTxId] = useState('');

  const [payoutOpen, setPayoutOpen] = useState(false);
  const [payoutDriverId, setPayoutDriverId] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [bankMask, setBankMask] = useState('XXXX-4821');
  const [ifsc, setIfsc] = useState('HDFC0000123');

  const [verifyTarget, setVerifyTarget] = useState<{ kind: 'payment' | 'payout'; id: string; method?: Payment['method']; amount: number } | null>(null);
  const [verifyRef, setVerifyRef] = useState('');

  const [rejectTarget, setRejectTarget] = useState<{ kind: 'payment' | 'payout'; id: string; amount: number } | null>(null);
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);

  // Unified Wallet Adjustment state
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletOwnerType, setWalletOwnerType] = useState<'customer' | 'driver'>('customer');
  const [walletOwnerId, setWalletOwnerId] = useState('');
  const [walletDirection, setWalletDirection] = useState<'credit' | 'debit'>('credit');
  const [walletAmount, setWalletAmount] = useState('');
  const [walletReason, setWalletReason] = useState('');
  const [walletFilter, setWalletFilter] = useState<'all' | 'customer' | 'driver'>('all');

  const [saving, setSaving] = useState(false);

  const actor = useMemo(
    () => ({ uid: user?.uid || 'unknown', email: user?.email || 'unknown', roleId }),
    [user, roleId]
  );

  const gatewayConfigured = integrations?.payments?.configured ?? false;

  const handleRecordPendingPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('finance', 'write')) {
      pushToast('error', 'Permission Denied', 'Finance write permission required.');
      return;
    }
    const targetRide = rides.find((r) => r.id === (rideId || rides[0]?.id));
    if (!targetRide) {
      pushToast('error', 'Ride Required', 'Select an existing ride to record payment.');
      return;
    }
    const amt = Number(amount) || targetRide.finalFare;
    setSaving(true);
    try {
      const id = sanitizeId('pay');
      await createRecord(
        'payments',
        id,
        {
          rideId: targetRide.id,
          customerId: targetRide.customerId,
          amount: amt,
          method,
          status: 'pending',
          provider: method === 'cash' ? 'cash_desk' : 'gateway_pending',
          ...(providerTxId.trim() ? { providerTxId: providerTxId.trim() } : {}),
          verifiedByProvider: false,
        },
        actor,
        'create_payment_ledger',
        `Recorded pending ${method} payment ${formatINR(amt)} for ride ${targetRide.id}`
      );
      pushToast('success', 'Pending Payment Logged', 'Requires provider/reconciliation verification before marking succeeded.');
      setPaymentOpen(false);
      setProviderTxId('');
    } catch (err) {
      pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleCreatePayoutRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('finance', 'write')) return;
    const drvId = payoutDriverId || drivers[0]?.id;
    const amt = Number(payoutAmount);
    if (!drvId || !Number.isFinite(amt) || amt <= 0) {
      pushToast('error', 'Invalid Input', 'Select a driver and enter a positive payout amount.');
      return;
    }
    setSaving(true);
    try {
      const id = sanitizeId('payout');
      await createRecord(
        'payouts',
        id,
        {
          driverId: drvId,
          amount: amt,
          status: 'pending',
          bankAccountMask: bankMask.trim(),
          ifscCode: ifsc.trim().toUpperCase(),
          verifiedByProvider: false,
        },
        actor,
        'create_payout_request',
        `Created payout request ${formatINR(amt)} for driver ${drvId}`
      );
      pushToast('success', 'Payout Queued', 'Requires verified payment gateway confirmation before marking succeeded.');
      setPayoutOpen(false);
      setPayoutAmount('');
    } catch (err) {
      pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyTarget || !can('finance', 'approve')) {
      pushToast('error', 'Permission Denied', 'Finance approval permission required.');
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Authenticated session token missing.');
      if (verifyTarget.kind === 'payment') {
        await updateRecord(
          'payments',
          verifyTarget.id,
          { status: 'succeeded', providerTxId: verifyRef.trim(), verifiedByProvider: true },
          actor,
          'verify_payment_succeeded',
          `Verified payment ${verifyTarget.id} with provider ref ${verifyRef.trim()}`
        );
      } else {
        await updateRecord(
          'payouts',
          verifyTarget.id,
          { status: 'succeeded', providerPayoutId: verifyRef.trim(), verifiedByProvider: true },
          actor,
          'verify_payout_succeeded',
          `Verified payout ${verifyTarget.id} with gateway payout ref ${verifyRef.trim()}`
        );
      }
      pushToast('success', 'Settlement Verified', `Reference ${verifyRef.trim()} confirmed.`);
      setVerifyTarget(null);
      setVerifyRef('');
    } catch (err) {
      pushToast('error', 'Verification Blocked', err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRejectTransaction = async () => {
    if (!rejectTarget || !can('finance', 'approve')) return;
    setSaving(true);
    try {
      if (rejectTarget.kind === 'payment') {
        await updateRecord(
          'payments',
          rejectTarget.id,
          { status: 'failed', verifiedByProvider: false },
          actor,
          'mark_payment_failed',
          `Marked payment ${rejectTarget.id} (${formatINR(rejectTarget.amount)}) as failed`
        );
        pushToast('info', 'Payment Marked Failed', rejectTarget.id);
      } else {
        await updateRecord(
          'payouts',
          rejectTarget.id,
          { status: 'rejected', verifiedByProvider: false },
          actor,
          'reject_payout',
          `Rejected payout ${rejectTarget.id} (${formatINR(rejectTarget.amount)})`
        );
        pushToast('info', 'Payout Rejected', rejectTarget.id);
      }
      setRejectTarget(null);
    } catch (err) {
      pushToast('error', 'Action Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleRefundPayment = async () => {
    if (!refundTarget) return;
    if (!can('finance', 'refund')) {
      pushToast('error', 'Permission Denied', 'Refund permission required.');
      return;
    }
    const payment = refundTarget;
    setSaving(true);
    try {
      await updateRecord(
        'payments',
        payment.id,
        { status: 'refunded' },
        actor,
        'refund_payment',
        `Issued refund status for payment ${payment.id} (${formatINR(payment.amount)})`
      );
      const cust = customers.find((c) => c.id === payment.customerId);
      if (cust) {
        await createRecord(
          'wallet_transactions',
          sanitizeId('wtx'),
          {
            ownerId: cust.id,
            ownerType: 'customer',
            amount: payment.amount,
            direction: 'credit',
            reason: `Refund for payment ${payment.id}`,
            referenceId: payment.id,
            createdBy: actor.uid,
          },
          actor,
          'refund_wallet_credit',
          `Credited ${formatINR(payment.amount)} refund to customer ${cust.id}`,
          false
        );
        await updateRecord(
          'customers',
          cust.id,
          { walletBalance: (cust.walletBalance || 0) + payment.amount },
          actor,
          'refund_wallet_balance',
          `Updated customer ${cust.id} wallet after refund`
        );
      }
      pushToast('success', 'Refund Recorded', `${formatINR(payment.amount)} refunded.`);
      setRefundTarget(null);
    } catch (err) {
      pushToast('error', 'Refund Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleAdjustWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('finance', 'write')) {
      pushToast('error', 'Permission Denied', 'Finance write permission required.');
      return;
    }
    const amt = Number(walletAmount);
    if (!Number.isFinite(amt) || amt <= 0 || !walletReason.trim()) {
      pushToast('error', 'Validation Error', 'Enter a positive amount and ledger reason.');
      return;
    }

    if (walletOwnerType === 'customer') {
      const cust = customers.find((c) => c.id === (walletOwnerId || customers[0]?.id));
      if (!cust) {
        pushToast('error', 'Customer Required', 'No customer selected.');
        return;
      }
      const curBal = cust.walletBalance || 0;
      if (walletDirection === 'debit' && amt > curBal) {
        pushToast('error', 'Insufficient Balance', `Customer balance (${formatINR(curBal)}) is less than debit amount.`);
        return;
      }
      const nextBalance = walletDirection === 'credit' ? curBal + amt : curBal - amt;

      setSaving(true);
      try {
        await createRecord(
          'wallet_transactions',
          sanitizeId('wtx'),
          {
            ownerId: cust.id,
            ownerType: 'customer',
            amount: amt,
            direction: walletDirection,
            reason: walletReason.trim(),
            createdBy: actor.uid,
          },
          actor,
          'wallet_adjustment_customer',
          `${walletDirection} ${formatINR(amt)} on customer ${cust.id}: ${walletReason.trim()}`,
          false
        );
        await updateRecord(
          'customers',
          cust.id,
          { walletBalance: nextBalance },
          actor,
          'update_customer_wallet',
          `Updated customer ${cust.id} wallet balance to ${formatINR(nextBalance)}`
        );
        pushToast('success', 'Customer Wallet Updated', `${cust.fullName} balance: ${formatINR(nextBalance)}`);
        setWalletAmount('');
        setWalletReason('');
        setWalletOpen(false);
      } catch (err) {
        pushToast('error', 'Wallet Error', err instanceof Error ? err.message : 'Failed');
      } finally {
        setSaving(false);
      }
    } else {
      const drv = drivers.find((d) => d.id === (walletOwnerId || drivers[0]?.id));
      if (!drv) {
        pushToast('error', 'Driver Required', 'No driver selected.');
        return;
      }
      const curBal = drv.walletBalance || 0;
      if (walletDirection === 'debit' && amt > curBal) {
        pushToast('error', 'Insufficient Balance', `Driver balance (${formatINR(curBal)}) is less than debit amount.`);
        return;
      }
      const nextBalance = walletDirection === 'credit' ? curBal + amt : curBal - amt;

      setSaving(true);
      try {
        await createRecord(
          'wallet_transactions',
          sanitizeId('wtx'),
          {
            ownerId: drv.id,
            ownerType: 'driver',
            amount: amt,
            direction: walletDirection,
            reason: walletReason.trim(),
            createdBy: actor.uid,
          },
          actor,
          'wallet_adjustment_driver',
          `${walletDirection} ${formatINR(amt)} on driver ${drv.id}: ${walletReason.trim()}`,
          false
        );
        await updateRecord(
          'drivers',
          drv.id,
          { walletBalance: nextBalance },
          actor,
          'update_driver_wallet',
          `Updated driver ${drv.id} wallet balance to ${formatINR(nextBalance)}`
        );
        pushToast('success', 'Driver Wallet Updated', `${drv.fullName} balance: ${formatINR(nextBalance)}`);
        setWalletAmount('');
        setWalletReason('');
        setWalletOpen(false);
      } catch (err) {
        pushToast('error', 'Wallet Error', err instanceof Error ? err.message : 'Failed');
      } finally {
        setSaving(false);
      }
    }
  };

  const exportFinancialCsv = () => {
    const header = ['PaymentID', 'RideID', 'CustomerID', 'Method', 'AmountINR', 'Status', 'VerifiedByProvider', 'ProviderTxID'];
    const lines = [
      header.join(','),
      ...payments.map((p) =>
        [p.id, p.rideId, p.customerId, p.method, p.amount, p.status, p.verifiedByProvider, p.providerTxId || '']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shine-cab-financial-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'CSV Exported', `${payments.length} payment rows downloaded.`);
  };

  const gatewayBanner = !gatewayConfigured ? (
    <div className="p-3.5 border border-[#FDE68A] bg-[#FFFBEB] rounded-xl text-xs text-[#92400E] flex flex-wrap items-center justify-between gap-2">
      <span>
        <strong>Payment Gateway Not Configured:</strong> Set <span className="font-mono">PAYMENT_PROVIDER</span>, <span className="font-mono">PAYMENT_KEY_ID</span>, and <span className="font-mono">PAYMENT_KEY_SECRET</span> in server secrets. Online/UPI payments and bank payouts cannot be marked succeeded without gateway verification.
      </span>
      <StatusText status="not_configured" tone="amber" />
    </div>
  ) : null;

  const verifyModal = (
    <ModalDialog
      open={Boolean(verifyTarget)}
      onOpenChange={(o) => !o && setVerifyTarget(null)}
      title={verifyTarget?.kind === 'payment' ? 'Verify Payment Transaction' : 'Verify Driver Payout Settlement'}
      description="Server-side gate blocks marking succeeded unless verified by payment provider."
    >
      <form onSubmit={handleVerifyTransaction} className="space-y-4">
        <Field label={verifyTarget?.method === 'cash' ? 'Cash Receipt / Desk Reference' : 'Verified Provider Transaction / Payout ID'}>
          <input className={inputCls} value={verifyRef} onChange={(e) => setVerifyRef(e.target.value)} required placeholder="e.g. pay_Px92kLm81Q" />
        </Field>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => setVerifyTarget(null)}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Verifying...' : 'Verify & Mark Succeeded'}</Button>
        </div>
      </form>
    </ModalDialog>
  );

  const rejectConfirm = (
    <ConfirmDialog
      open={Boolean(rejectTarget)}
      onOpenChange={(o) => !o && setRejectTarget(null)}
      title={rejectTarget?.kind === 'payment' ? 'Mark Payment as Failed?' : 'Reject Driver Payout Request?'}
      description={
        rejectTarget
          ? `Mark ${rejectTarget.kind} ${rejectTarget.id} (${formatINR(rejectTarget.amount)}) as ${
              rejectTarget.kind === 'payment' ? 'failed' : 'rejected'
            }? This updates the settlement ledger.`
          : ''
      }
      confirmLabel={rejectTarget?.kind === 'payment' ? 'Mark Failed' : 'Reject Payout'}
      danger
      loading={saving}
      onConfirm={handleRejectTransaction}
    />
  );

  const exportPayoutsCsv = () => {
    const header = ['PayoutID', 'DriverID', 'BankAccount', 'IFSC', 'AmountINR', 'Status', 'VerifiedByProvider', 'ProviderPayoutID'];
    const lines = [
      header.join(','),
      ...payouts.map((p) =>
        [p.id, p.driverId, p.bankAccountMask, p.ifscCode || '', p.amount, p.status, p.verifiedByProvider, p.providerPayoutId || '']
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shine-cab-payouts-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Payouts CSV Exported', `${payouts.length} payout rows downloaded.`);
  };

  // Page 51: Driver Payouts
  if (pageId === 'finance/payouts') {
    return (
      <div className="space-y-6">
        {gatewayBanner}
        <Panel
          title="Driver Payouts & Bank Settlements"
          subtitle="Payouts remain pending until confirmed by a verified payment gateway payout ID"
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportPayoutsCsv}>
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </Button>
              {can('finance', 'write') && (
                <Button size="sm" onClick={() => setPayoutOpen(true)}>+ Queue Payout</Button>
              )}
            </div>
          }
        >
          <DataTable
            rows={payouts}
            emptyTitle="No Driver Payout Requests"
            emptyDescription="Driver withdrawal requests and scheduled settlement batches appear here."
            columns={[
              { key: 'id', header: 'Payout ID', render: (p) => <span className="font-mono text-xs">{p.id}</span> },
              { key: 'drv', header: 'Driver ID', render: (p) => <span className="font-mono text-xs">{p.driverId}</span> },
              { key: 'bank', header: 'Bank Account', render: (p) => <span className="font-mono text-xs">{p.bankAccountMask} · {p.ifscCode || '—'}</span> },
              { key: 'amt', header: 'Amount', align: 'right', render: (p) => <span className="font-mono font-semibold tabular-nums">{formatINR(p.amount)}</span> },
              { key: 'status', header: 'Status', render: (p) => <StatusText status={p.status} /> },
              {
                key: 'act',
                header: 'Settlement',
                align: 'right',
                render: (p: Payout) => (
                  <div className="inline-flex gap-1.5">
                    {(p.status === 'pending' || p.status === 'processing') && can('finance', 'approve') && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setVerifyRef('');
                            setVerifyTarget({ kind: 'payout', id: p.id, amount: p.amount });
                          }}
                        >
                          Verify
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => setRejectTarget({ kind: 'payout', id: p.id, amount: p.amount })}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {p.status === 'succeeded' && <StatusText status="verified" tone="green" />}
                  </div>
                ),
              },
            ]}
          />
        </Panel>

        <ModalDialog open={payoutOpen} onOpenChange={setPayoutOpen} title="Queue Driver Bank Payout">
          <form onSubmit={handleCreatePayoutRequest} className="space-y-4">
            <Field label="Driver">
              <select className={selectCls} value={payoutDriverId || drivers[0]?.id || ''} onChange={(e) => setPayoutDriverId(e.target.value)} required>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>{d.fullName} ({formatINR(d.walletBalance || 0)})</option>
                ))}
              </select>
            </Field>
            <Field label="Amount (INR)">
              <input className={inputCls} type="number" min="1" step="0.01" value={payoutAmount} onChange={(e) => setPayoutAmount(e.target.value)} required />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Masked Account"><input className={inputCls} value={bankMask} onChange={(e) => setBankMask(e.target.value)} required /></Field>
              <Field label="IFSC Code"><input className={inputCls} value={ifsc} onChange={(e) => setIfsc(e.target.value)} required /></Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setPayoutOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || drivers.length === 0}>Queue Payout</Button>
            </div>
          </form>
        </ModalDialog>
        {verifyModal}
        {rejectConfirm}
      </div>
    );
  }

  // Page 53: Wallet Management
  if (pageId === 'finance/wallets') {
    const custWalletSum = customers.reduce((s, c) => s + (c.walletBalance || 0), 0);
    const drvWalletSum = drivers.reduce((s, d) => s + (d.walletBalance || 0), 0);
    const creditsSum = walletTransactions
      .filter((w) => w.direction === 'credit')
      .reduce((s, w) => s + w.amount, 0);
    const debitsSum = walletTransactions
      .filter((w) => w.direction === 'debit')
      .reduce((s, w) => s + w.amount, 0);

    const filteredWalletRows =
      walletFilter === 'all'
        ? walletTransactions
        : walletTransactions.filter((w) => w.ownerType === walletFilter);

    const ownerOptions = walletOwnerType === 'customer' ? customers : drivers;

    const exportWalletsCsv = () => {
      const header = ['TxID', 'OwnerType', 'OwnerID', 'Direction', 'AmountINR', 'Reason'];
      const lines = [
        header.join(','),
        ...filteredWalletRows.map((w) =>
          [w.id, w.ownerType, w.ownerId, w.direction, w.amount, w.reason]
            .map((v) => `"${String(v).replace(/"/g, '""')}"`)
            .join(',')
        ),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shine-cab-wallet-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      pushToast('success', 'Wallet Ledger CSV Exported', `${filteredWalletRows.length} rows downloaded.`);
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Customer Wallet Float" value={formatINR(custWalletSum)} />
          <StatTile label="Driver Wallet Float" value={formatINR(drvWalletSum)} />
          <StatTile label="Total Credits Logged" value={formatINR(creditsSum)} tone="green" />
          <StatTile label="Total Debits Logged" value={formatINR(debitsSum)} tone="amber" />
        </div>

        <Panel
          title="Unified Wallet Ledger"
          subtitle="All customer and driver wallet credits and debits"
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={exportWalletsCsv}>
                <Download className="w-3.5 h-3.5" />
                Export CSV
              </Button>
              {can('finance', 'write') && (
                <Button
                  size="sm"
                  onClick={() => {
                    setWalletOwnerType('customer');
                    setWalletOwnerId(customers[0]?.id || '');
                    setWalletOpen(true);
                  }}
                >
                  + Adjust Wallet Balance
                </Button>
              )}
            </div>
          }
        >
          <DataTable
            rows={filteredWalletRows}
            filterControls={
              <select
                aria-label="Filter wallet owner type"
                className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
                value={walletFilter}
                onChange={(e) => setWalletFilter(e.target.value as 'all' | 'customer' | 'driver')}
              >
                <option value="all">All Owners</option>
                <option value="customer">Customers</option>
                <option value="driver">Drivers</option>
              </select>
            }
            emptyTitle="No Wallet Ledger Entries"
            emptyDescription="Credits, refunds, trip deductions, and payouts appear in this immutable ledger."
            columns={[
              { key: 'id', header: 'Tx ID', render: (w) => <span className="font-mono text-xs">{w.id}</span> },
              { key: 'type', header: 'Owner Type', render: (w) => <span className="uppercase text-xs font-semibold">{w.ownerType}</span> },
              { key: 'owner', header: 'Owner ID', render: (w) => <span className="font-mono text-xs">{w.ownerId}</span> },
              { key: 'dir', header: 'Direction', render: (w) => <StatusText status={w.direction} tone={w.direction === 'credit' ? 'green' : 'amber'} /> },
              { key: 'amt', header: 'Amount', align: 'right', render: (w) => <span className="font-mono font-medium tabular-nums">{formatINR(w.amount)}</span> },
              { key: 'reason', header: 'Reason', render: (w) => w.reason },
              { key: 'dt', header: 'Timestamp', render: (w) => <span className="text-xs text-[#6B7280]">{formatDateTime(w.createdAt)}</span> },
            ]}
          />
        </Panel>

        <ModalDialog open={walletOpen} onOpenChange={setWalletOpen} title="Adjust Customer or Driver Wallet">
          <form onSubmit={handleAdjustWallet} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Owner Type">
                <select
                  className={selectCls}
                  value={walletOwnerType}
                  onChange={(e) => {
                    const nextType = e.target.value as 'customer' | 'driver';
                    setWalletOwnerType(nextType);
                    setWalletOwnerId(nextType === 'customer' ? customers[0]?.id || '' : drivers[0]?.id || '');
                  }}
                >
                  <option value="customer">Customer</option>
                  <option value="driver">Driver</option>
                </select>
              </Field>
              <Field label="Direction">
                <select className={selectCls} value={walletDirection} onChange={(e) => setWalletDirection(e.target.value as 'credit' | 'debit')}>
                  <option value="credit">Credit (+)</option>
                  <option value="debit">Debit (-)</option>
                </select>
              </Field>
            </div>
            <Field label={walletOwnerType === 'customer' ? 'Select Customer' : 'Select Driver'}>
              <select className={selectCls} value={walletOwnerId || ownerOptions[0]?.id || ''} onChange={(e) => setWalletOwnerId(e.target.value)} required>
                {ownerOptions.length === 0 ? (
                  <option value="">No {walletOwnerType}s available</option>
                ) : (
                  ownerOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.fullName} ({formatINR(o.walletBalance || 0)})
                    </option>
                  ))
                )}
              </select>
            </Field>
            <Field label="Amount (INR)">
              <input className={inputCls} type="number" min="1" step="0.01" value={walletAmount} onChange={(e) => setWalletAmount(e.target.value)} required />
            </Field>
            <Field label="Ledger Reason">
              <input className={inputCls} value={walletReason} onChange={(e) => setWalletReason(e.target.value)} required placeholder="e.g. Goodwill cashback or cash collection offset" />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setWalletOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving || ownerOptions.length === 0}>Apply Ledger Entry</Button>
            </div>
          </form>
        </ModalDialog>
      </div>
    );
  }

  // Page 54: Financial Reports
  if (pageId === 'finance/reports') {
    const succeeded = payments.filter((p) => p.status === 'succeeded' && p.verifiedByProvider);
    const refunded = payments.filter((p) => p.status === 'refunded');
    const totalCommission = rides
      .filter((r) => r.status === 'ride_completed' || r.status === 'payment_completed')
      .reduce((s, r) => s + (r.commissionAmount || 0), 0);

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Verified Payments" value={formatINR(succeeded.reduce((s, p) => s + p.amount, 0))} tone="green" />
          <StatTile label="Platform Commission" value={formatINR(totalCommission)} />
          <StatTile label="Driver Payouts Cleared" value={formatINR(payouts.filter((p) => p.status === 'succeeded').reduce((s, p) => s + p.amount, 0))} />
          <StatTile label="Refunded Volume" value={formatINR(refunded.reduce((s, p) => s + p.amount, 0))} tone="red" />
        </div>
        <Panel
          title="Financial Reconciliation Export"
          subtitle="Download verified transaction ledger as CSV for accounting audits"
          action={
            <Button size="sm" onClick={exportFinancialCsv}>
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
          }
        >
          <DataTable
            rows={payments}
            emptyTitle="No Financial Records to Export"
            emptyDescription="Verified payments and refunds will appear here for reconciliation."
            columns={[
              { key: 'id', header: 'Payment ID', render: (p) => <span className="font-mono text-xs">{p.id}</span> },
              { key: 'method', header: 'Method', render: (p) => <span className="uppercase text-xs font-semibold">{p.method}</span> },
              { key: 'amt', header: 'Amount', align: 'right', render: (p) => <span className="font-mono tabular-nums">{formatINR(p.amount)}</span> },
              { key: 'verified', header: 'Provider Verified', render: (p) => <StatusText status={p.verifiedByProvider ? 'verified' : 'unverified'} tone={p.verifiedByProvider ? 'green' : 'amber'} /> },
              { key: 'status', header: 'Status', render: (p) => <StatusText status={p.status} /> },
            ]}
          />
        </Panel>
      </div>
    );
  }

  // Pages 48, 49, 50, 52: Payments & Refunds
  const filteredPayments =
    pageId === 'finance/cash'
      ? payments.filter((p) => p.method === 'cash')
      : pageId === 'finance/upi-online'
        ? payments.filter((p) => p.method === 'upi' || p.method === 'online')
        : pageId === 'finance/refunds'
          ? payments.filter((p) => p.status === 'succeeded' || p.status === 'refunded')
          : payments;

  return (
    <div className="space-y-6">
      {gatewayBanner}
      <Panel
        title={
          pageId === 'finance/cash'
            ? 'Cash Payments Reconciliation'
            : pageId === 'finance/upi-online'
              ? 'UPI & Online Payments'
              : pageId === 'finance/refunds'
                ? 'Refund Management'
                : 'All Financial Transactions'
        }
        subtitle="Transactions require verified provider confirmation before marking succeeded"
        action={can('finance', 'write') ? <Button size="sm" onClick={() => setPaymentOpen(true)}>+ Log Payment Entry</Button> : undefined}
      >
        <DataTable
          rows={filteredPayments}
          emptyTitle="No Payment Records Found"
          emptyDescription="Ride payments across Cash, UPI, Online, and Wallet appear here once logged or synced."
          columns={[
            { key: 'id', header: 'Payment ID', render: (p) => <span className="font-mono text-xs">{p.id}</span> },
            { key: 'ride', header: 'Ride ID', render: (p) => <span className="font-mono text-xs">{p.rideId}</span> },
            { key: 'method', header: 'Method', render: (p) => <span className="uppercase text-xs font-semibold">{p.method}</span> },
            { key: 'amt', header: 'Amount', align: 'right', render: (p) => <span className="font-mono font-semibold tabular-nums">{formatINR(p.amount)}</span> },
            { key: 'status', header: 'Status', render: (p) => <StatusText status={p.status} /> },
            {
              key: 'act',
              header: 'Actions',
              align: 'right',
              render: (p) => (
                <div className="inline-flex gap-1.5">
                  {p.status === 'pending' && can('finance', 'approve') && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setVerifyRef('');
                          setVerifyTarget({ kind: 'payment', id: p.id, method: p.method, amount: p.amount });
                        }}
                      >
                        Verify
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRejectTarget({ kind: 'payment', id: p.id, amount: p.amount })}>
                        Mark Failed
                      </Button>
                    </>
                  )}
                  {pageId === 'finance/refunds' && p.status === 'succeeded' && can('finance', 'refund') && (
                    <Button size="sm" variant="danger" onClick={() => setRefundTarget(p)}>
                      Refund
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Panel>

      <ModalDialog open={paymentOpen} onOpenChange={setPaymentOpen} title="Log Ride Payment (Pending Verification)">
        <form onSubmit={handleRecordPendingPayment} className="space-y-4">
          <Field label="Ride">
            <select className={selectCls} value={rideId || rides[0]?.id || ''} onChange={(e) => setRideId(e.target.value)} required>
              {rides.map((r) => (
                <option key={r.id} value={r.id}>{r.id} · {formatINR(r.finalFare)}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Method">
              <select className={selectCls} value={method} onChange={(e) => setMethod(e.target.value as Payment['method'])}>
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="online">Online</option>
                <option value="wallet">Wallet</option>
              </select>
            </Field>
            <Field label="Amount (INR)">
              <input className={inputCls} type="number" min="1" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Uses ride fare if blank" />
            </Field>
          </div>
          <Field label="Provider Reference (Optional)">
            <input className={inputCls} value={providerTxId} onChange={(e) => setProviderTxId(e.target.value)} placeholder="e.g. UPI RRN" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setPaymentOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || rides.length === 0}>Create Pending Entry</Button>
          </div>
        </form>
      </ModalDialog>
      {verifyModal}
      {rejectConfirm}
      <ConfirmDialog
        open={Boolean(refundTarget)}
        onOpenChange={(o) => !o && setRefundTarget(null)}
        title="Confirm Customer Refund"
        description={
          refundTarget
            ? `Issue refund of ${formatINR(refundTarget.amount)} for payment ${refundTarget.id}? This marks the payment refunded and credits the customer wallet.`
            : ''
        }
        confirmLabel="Issue Refund"
        danger
        loading={saving}
        onConfirm={handleRefundPayment}
      />
    </div>
  );
};
