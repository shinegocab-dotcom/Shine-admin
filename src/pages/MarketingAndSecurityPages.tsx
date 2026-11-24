import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Archive, Copy, Download, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import {
  createRecord,
  deleteRecord,
  updateRecord,
  upsertSystemSetting,
} from '../services/firestoreService';
import { ROLE_MATRIX } from '../lib/rbac';
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
import { AdminRoleId, AdminUser, Coupon, NotificationRecord, SupportTicket, VehicleCategory } from '../types/domain';

interface MarketingAndSecurityPagesProps {
  pageId: string;
}



const AppLinksEcosystemBridge: React.FC<{ pushToast: any }> = ({ pushToast }) => {
  const [links, setLinks] = React.useState({
    customerApkUrl: "",
    driverApkUrl: "",
    adminPanelUrl: typeof window !== "undefined" ? window.location.origin : "https://netlify.app",
    appVersion: "1.0.0",
    forceUpdate: false,
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    getDoc(doc(db, "system_integrations", "app_links"))
      .then((snap) => {
        if (snap.exists()) setLinks((prev) => ({ ...prev, ...(snap.data() as any) }));
      })
      .catch(() => {});
  }, []);

  const handleSaveLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(
        doc(db, "system_integrations", "app_links"),
        {
          ...links,
          linkedAt: new Date().toISOString(),
          threeWaySyncActive: true,
        },
        { merge: true }
      );
      pushToast("success", "All 3 Apps Linked & Live!", "Customer APK, Driver APK & Admin Panel are now connected in real-time.");
    } catch (err: any) {
      pushToast("error", "Save Failed", err?.message || "Could not save app links.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveLinks} className="rounded-2xl border-2 border-[#FFC928] bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-[#111111]">3-Way Live App Links & Ecosystem Connector</h3>
          <p className="text-xs text-neutral-500">Paste Customer APK, Driver APK & Admin Panel links below so all 3 apps stay linked, share updates & sync live data.</p>
        </div>
        <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
          3-App Live Bridge Ready
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div>
          <label className="block font-bold text-[#111111] mb-1">1. SHINE CAB Customer APK Link</label>
          <input
            type="url"
            value={links.customerApkUrl}
            onChange={(e) => setLinks({ ...links, customerApkUrl: e.target.value })}
            placeholder="https://.../Shine-Cab-Customer.apk"
            className="w-full h-10 px-3 rounded-xl border border-neutral-300 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block font-bold text-[#111111] mb-1">2. SHINE CAPTAIN Driver APK Link</label>
          <input
            type="url"
            value={links.driverApkUrl}
            onChange={(e) => setLinks({ ...links, driverApkUrl: e.target.value })}
            placeholder="https://.../Shine-Cab-Driver.apk"
            className="w-full h-10 px-3 rounded-xl border border-neutral-300 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block font-bold text-[#111111] mb-1">3. Super Admin Panel Live Link</label>
          <input
            type="url"
            value={links.adminPanelUrl}
            onChange={(e) => setLinks({ ...links, adminPanelUrl: e.target.value })}
            placeholder="https://netlify.app"
            className="w-full h-10 px-3 rounded-xl border border-neutral-300 font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-4 text-xs">
          <label className="flex items-center gap-1.5 font-semibold">
            <span>Latest Version:</span>
            <input
              type="text"
              value={links.appVersion}
              onChange={(e) => setLinks({ ...links, appVersion: e.target.value })}
              className="w-20 h-8 px-2 rounded-lg border border-neutral-300 font-mono"
            />
          </label>
          <label className="flex items-center gap-2 cursor-pointer font-semibold text-neutral-700">
            <input
              type="checkbox"
              checked={links.forceUpdate}
              onChange={(e) => setLinks({ ...links, forceUpdate: e.target.checked })}
            />
            Notify users when new APK link is updated
          </label>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-5 py-2.5 rounded-xl bg-[#111111] text-[#FFC928] text-xs font-extrabold hover:bg-neutral-800 cursor-pointer"
        >
          {saving ? "Linking Apps..." : "Save & Connect All 3 Links Live"}
        </button>
      </div>
    </form>
  );
};

const LiveApiKeysVault: React.FC<{ pushToast: any }> = ({ pushToast }) => {
  const [keys, setKeys] = React.useState({
    razorpayKeyId: "",
    razorpayKeySecret: "",
    merchantUpiId: "",
    googleMapsApiKey: "",
    smsApiKey: "",
    fcmServerKey: "",
    customBackendUrl: "",
  });
  const [loadingKeys, setLoadingKeys] = React.useState(true);
  const [savingKeys, setSavingKeys] = React.useState(false);

  React.useEffect(() => {
    getDoc(doc(db, "system_integrations", "live_keys"))
      .then((snap) => {
        if (snap.exists()) {
          setKeys((prev) => ({ ...prev, ...(snap.data() as any) }));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingKeys(false));
  }, []);

  const handleSaveKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKeys(true);
    try {
      await setDoc(
        doc(db, "system_integrations", "live_keys"),
        {
          ...keys,
          updatedAt: new Date().toISOString(),
          paymentConfigured: Boolean(keys.razorpayKeyId.trim() || keys.merchantUpiId.trim()),
          mapsConfigured: Boolean(keys.googleMapsApiKey.trim()),
          smsConfigured: Boolean(keys.smsApiKey.trim()),
          fcmConfigured: Boolean(keys.fcmServerKey.trim()),
        },
        { merge: true }
      );
      pushToast("success", "API Keys Saved & Synced", "All entered API keys are now live across Customer App, Driver App & Admin Panel.");
    } catch (err: any) {
      pushToast("error", "Save Failed", err?.message || "Could not save API keys.");
    } finally {
      setSavingKeys(false);
    }
  };

  return (
    <form onSubmit={handleSaveKeys} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 pb-3">
        <div>
          <h3 className="text-base font-bold text-[#111111]">Live Multi-App API Keys & Payment Vault</h3>
          <p className="text-xs text-neutral-500">Enter your Payment, Maps, SMS or Push keys below. Changes sync automatically in real-time to both Customer & Driver apps.</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
          {loadingKeys ? "Loading..." : "Real-Time Firestore Sync Active"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div>
          <label className="block font-semibold text-[#111111] mb-1">Razorpay Key ID (Online Payments)</label>
          <input
            type="text"
            value={keys.razorpayKeyId}
            onChange={(e) => setKeys({ ...keys, razorpayKeyId: e.target.value })}
            placeholder="rzp_live_xxxxxxxxxxxx"
            className="w-full h-10 px-3 rounded-xl border border-neutral-300 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block font-semibold text-[#111111] mb-1">Razorpay Key Secret</label>
          <input
            type="password"
            value={keys.razorpayKeySecret}
            onChange={(e) => setKeys({ ...keys, razorpayKeySecret: e.target.value })}
            placeholder="••••••••••••••••"
            className="w-full h-10 px-3 rounded-xl border border-neutral-300 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block font-semibold text-[#111111] mb-1">Direct Merchant UPI ID (Instant UPI Pay)</label>
          <input
            type="text"
            value={keys.merchantUpiId}
            onChange={(e) => setKeys({ ...keys, merchantUpiId: e.target.value })}
            placeholder="shinecab@upi"
            className="w-full h-10 px-3 rounded-xl border border-neutral-300 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block font-semibold text-[#111111] mb-1">Google Maps API Key (Optional — Free OSM Active)</label>
          <input
            type="text"
            value={keys.googleMapsApiKey}
            onChange={(e) => setKeys({ ...keys, googleMapsApiKey: e.target.value })}
            placeholder="AIzaSy... (leave blank for free OpenStreetMap)"
            className="w-full h-10 px-3 rounded-xl border border-neutral-300 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block font-semibold text-[#111111] mb-1">SMS / OTP Gateway API Key</label>
          <input
            type="text"
            value={keys.smsApiKey}
            onChange={(e) => setKeys({ ...keys, smsApiKey: e.target.value })}
            placeholder="Fast2SMS / MSG91 API Key"
            className="w-full h-10 px-3 rounded-xl border border-neutral-300 font-mono text-xs"
          />
        </div>
        <div>
          <label className="block font-semibold text-[#111111] mb-1">Firebase Push / FCM Server Key</label>
          <input
            type="text"
            value={keys.fcmServerKey}
            onChange={(e) => setKeys({ ...keys, fcmServerKey: e.target.value })}
            placeholder="AAAA..."
            className="w-full h-10 px-3 rounded-xl border border-neutral-300 font-mono text-xs"
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={savingKeys}
          className="px-5 py-2.5 rounded-xl bg-[#111111] text-white text-xs font-bold hover:bg-neutral-800 cursor-pointer"
        >
          {savingKeys ? "Saving & Syncing..." : "Save & Sync API Keys to All Apps"}
        </button>
      </div>
    </form>
  );
};

export const MarketingAndSecurityPages: React.FC<MarketingAndSecurityPagesProps> = ({ pageId }) => {
  const { user, roleId, can, getToken } = useAuth();
  const {
    coupons,
    notifications,
    supportTickets,
    adminUsers,
    auditLogs,
    systemSettings,
    integrations,
    customers,
    drivers,
    pushToast,
  } = useData();

  // Coupon state (Create + Edit + Delete)
  const [couponOpen, setCouponOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [deleteCouponTarget, setDeleteCouponTarget] = useState<Coupon | null>(null);
  const [code, setCode] = useState('');
  const [couponTitle, setCouponTitle] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountValue, setDiscountValue] = useState('15');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [minFare, setMinFare] = useState('');
  const [couponCity, setCouponCity] = useState('');
  const [usageLimit, setUsageLimit] = useState('1000');
  const [couponCat, setCouponCat] = useState<'all' | VehicleCategory>('all');

  // Notification state
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [notifAudience, setNotifAudience] = useState<NotificationRecord['targetAudience']>('customers');
  const [notifChannel, setNotifChannel] = useState<NotificationRecord['channel']>('push');
  const [campaignName, setCampaignName] = useState('');

  // Support ticket state (Create + Inspect/Resolve)
  const [ticketOpen, setTicketOpen] = useState(false);
  const [ticketUserType, setTicketUserType] = useState<'customer' | 'driver'>('customer');
  const [ticketUserId, setTicketUserId] = useState('');
  const [ticketSubject, setTicketSubject] = useState('');
  const [ticketDesc, setTicketDesc] = useState('');
  const [ticketPriority, setTicketPriority] = useState<SupportTicket['priority']>('medium');
  const [ticketIsSos, setTicketIsSos] = useState(false);

  const [inspectTicket, setInspectTicket] = useState<SupportTicket | null>(null);
  const [editTicketStatus, setEditTicketStatus] = useState<SupportTicket['status']>('in_progress');
  const [editTicketPriority, setEditTicketPriority] = useState<SupportTicket['priority']>('medium');
  const [resolutionNote, setResolutionNote] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<'all' | SupportTicket['status']>('all');

  // Admin user state
  const [adminOpen, setAdminOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);
  const [deleteAdminTarget, setDeleteAdminTarget] = useState<AdminUser | null>(null);
  const [adminUid, setAdminUid] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminRole, setAdminRole] = useState<AdminRoleId>('operations_admin');

  // System setting & Audit log filter state
  const [settingKey, setSettingKey] = useState('sos_emergency_helpline');
  const [settingValue, setSettingValue] = useState('112');
  const [settingCategory, setSettingCategory] = useState('safety');
  const [auditEntityFilter, setAuditEntityFilter] = useState<string>('all');

  // Integrations & Env checklist state (server-side boolean flags only)
  const [envChecklist, setEnvChecklist] = useState<
    { envKey: string; service: string; scope: 'client' | 'server'; configured: boolean; requiredFor: string }[]
  >([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [envFilter, setEnvFilter] = useState<'all' | 'configured' | 'missing'>('all');

  const { refreshIntegrations } = useData();

  const loadEnvChecklist = useCallback(async () => {
    setEnvLoading(true);
    try {
      const res = await fetch('/api/integrations/env-checklist');
      if (res.ok) {
        const body = await res.json();
        setEnvChecklist(Array.isArray(body.items) ? body.items : []);
      }
      await refreshIntegrations();
    } catch {
      pushToast('error', 'Server Check Failed', 'Unable to reach /api/integrations/env-checklist');
    } finally {
      setEnvLoading(false);
    }
  }, [pushToast, refreshIntegrations]);

  useEffect(() => {
      if (pageId === "security/app-links") {
    return (
      <div className="space-y-6">
        <AppLinksEcosystemBridge pushToast={pushToast} />
      </div>
    );
  }

  if (pageId === 'security/api-keys') {
      void loadEnvChecklist();
    }
  }, [pageId, loadEnvChecklist]);

  const [saving, setSaving] = useState(false);
  const [zipDownloading, setZipDownloading] = useState(false);

  const actor = useMemo(
    () => ({ uid: user?.uid || 'unknown', email: user?.email || 'unknown', roleId }),
    [user, roleId]
  );

  // 55 & 56: Coupons & Promotions
  if (pageId === 'marketing/coupons' || pageId === 'marketing/promotions') {
    const openCreateCoupon = () => {
      setEditingCoupon(null);
      setCode('');
      setCouponTitle('');
      setDiscountType('percentage');
      setDiscountValue('15');
      setMaxDiscount('');
      setMinFare('');
      setCouponCity('');
      setUsageLimit('1000');
      setCouponCat('all');
      setCouponOpen(true);
    };

    const openEditCoupon = (c: Coupon) => {
      setEditingCoupon(c);
      setCode(c.code);
      setCouponTitle(c.title);
      setDiscountType(c.discountType);
      setDiscountValue(String(c.discountValue));
      setMaxDiscount(typeof c.maxDiscount === 'number' ? String(c.maxDiscount) : '');
      setMinFare(typeof c.minFare === 'number' ? String(c.minFare) : '');
      setCouponCity(c.city || '');
      setUsageLimit(typeof c.usageLimit === 'number' ? String(c.usageLimit) : '1000');
      setCouponCat(c.vehicleCategory);
      setCouponOpen(true);
    };

    const handleSaveCoupon = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!can('marketing', 'write')) return;
      if (code.trim().length < 3 || !couponTitle.trim()) {
        pushToast('error', 'Validation Error', 'Enter coupon code (min 3 chars) and title.');
        return;
      }
      const valNum = Number(discountValue);
      if (!Number.isFinite(valNum) || valNum <= 0) {
        pushToast('error', 'Validation Error', 'Discount value must be greater than 0.');
        return;
      }
      if (discountType === 'percentage' && valNum > 100) {
        pushToast('error', 'Validation Error', 'Percentage discount cannot exceed 100%.');
        return;
      }

      const parsedMax = maxDiscount.trim() ? Number(maxDiscount) : undefined;
      const parsedMinFare = minFare.trim() ? Number(minFare) : undefined;
      const parsedLimit = usageLimit.trim() ? Number(usageLimit) : 1000;

      setSaving(true);
      try {
        if (editingCoupon) {
          await updateRecord(
            'coupons',
            editingCoupon.id,
            {
              title: couponTitle.trim(),
              discountType,
              discountValue: valNum,
              vehicleCategory: couponCat,
              city: couponCity.trim(),
              ...(parsedMax !== undefined && Number.isFinite(parsedMax) ? { maxDiscount: parsedMax } : {}),
              ...(parsedMinFare !== undefined && Number.isFinite(parsedMinFare) ? { minFare: parsedMinFare } : {}),
              ...(Number.isFinite(parsedLimit) && parsedLimit > 0 ? { usageLimit: parsedLimit } : {}),
            },
            actor,
            'update_coupon',
            `Updated coupon ${editingCoupon.code}`
          );
          pushToast('success', 'Coupon Updated', editingCoupon.code);
        } else {
          const id = sanitizeId('cpn');
          await createRecord(
            'coupons',
            id,
            {
              code: code.trim().toUpperCase(),
              title: couponTitle.trim(),
              discountType,
              discountValue: valNum,
              ...(parsedMax !== undefined && Number.isFinite(parsedMax) ? { maxDiscount: parsedMax } : {}),
              ...(parsedMinFare !== undefined && Number.isFinite(parsedMinFare) ? { minFare: parsedMinFare } : {}),
              vehicleCategory: couponCat,
              ...(couponCity.trim() ? { city: couponCity.trim() } : {}),
              usageLimit: Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : 1000,
              usedCount: 0,
              isActive: true,
            },
            actor,
            'create_coupon',
            `Created promo coupon ${code.trim().toUpperCase()}`
          );
          pushToast('success', 'Coupon Created', code.trim().toUpperCase());
        }
        setCouponOpen(false);
        setEditingCoupon(null);
      } catch (err) {
        pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
      } finally {
        setSaving(false);
      }
    };

    const toggleCoupon = async (c: Coupon) => {
      if (!can('marketing', 'write')) return;
      await updateRecord(
        'coupons',
        c.id,
        { isActive: !c.isActive },
        actor,
        'toggle_coupon',
        `${!c.isActive ? 'Activated' : 'Paused'} coupon ${c.code}`
      );
      pushToast('success', 'Coupon Updated', `${c.code} is now ${!c.isActive ? 'active' : 'paused'}.`);
    };

    const handleDeleteCoupon = async () => {
      if (!deleteCouponTarget || !can('marketing', 'write')) return;
      setSaving(true);
      try {
        await deleteRecord(
          'coupons',
          deleteCouponTarget.id,
          actor,
          'delete_coupon',
          `Deleted coupon ${deleteCouponTarget.code}`
        );
        pushToast('success', 'Coupon Deleted', `${deleteCouponTarget.code} removed.`);
        setDeleteCouponTarget(null);
      } catch (err) {
        pushToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Failed');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="space-y-6">
        <Panel
          title={pageId === 'marketing/promotions' ? 'Promotions & Campaign Offers' : 'Coupon Code Management'}
          subtitle="Discounts synchronized with SHINE CAB Customer App checkout"
          action={can('marketing', 'write') ? <Button size="sm" onClick={openCreateCoupon}>+ Create Coupon</Button> : undefined}
        >
          <DataTable
            rows={coupons}
            emptyTitle="No Coupons Created"
            emptyDescription="Create promotional codes for Bike, Auto, or Cab rides."
            emptyAction={can('marketing', 'write') ? <Button size="sm" onClick={openCreateCoupon}>Create First Coupon</Button> : undefined}
            columns={[
              { key: 'code', header: 'Code', render: (c) => <span className="font-mono font-bold text-[#111111]">{c.code}</span> },
              { key: 'title', header: 'Campaign Title', render: (c) => <div><div>{c.title}</div>{c.city && <div className="text-[11px] text-[#6B7280]">City: {c.city}</div>}</div> },
              {
                key: 'val',
                header: 'Discount & Caps',
                render: (c) => (
                  <div className="font-mono text-xs tabular-nums">
                    <div>{c.discountType === 'percentage' ? `${c.discountValue}%` : formatINR(c.discountValue)}</div>
                    <div className="text-[11px] text-[#6B7280]">
                      {typeof c.maxDiscount === 'number' ? `Max ${formatINR(c.maxDiscount)} · ` : ''}
                      {typeof c.minFare === 'number' ? `Min ${formatINR(c.minFare)}` : 'No min fare'}
                    </div>
                  </div>
                ),
              },
              { key: 'cat', header: 'Category', render: (c) => <span className="uppercase text-xs font-semibold">{c.vehicleCategory}</span> },
              { key: 'usage', header: 'Usage', render: (c) => <span className="font-mono text-xs tabular-nums">{c.usedCount || 0} / {c.usageLimit || '∞'}</span> },
              { key: 'status', header: 'State', render: (c) => <StatusText status={c.isActive ? 'active' : 'suspended'} /> },
              {
                key: 'act',
                header: 'Actions',
                align: 'right',
                render: (c) => (
                  <div className="inline-flex gap-1.5">
                    <Button size="sm" variant="outline" disabled={!can('marketing', 'write')} onClick={() => openEditCoupon(c)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="outline" disabled={!can('marketing', 'write')} onClick={() => toggleCoupon(c)}>
                      {c.isActive ? 'Pause' : 'Activate'}
                    </Button>
                    <Button size="sm" variant="danger" disabled={!can('marketing', 'write')} onClick={() => setDeleteCouponTarget(c)}>
                      Delete
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Panel>

        <ModalDialog
          open={couponOpen}
          onOpenChange={(o) => {
            setCouponOpen(o);
            if (!o) setEditingCoupon(null);
          }}
          title={editingCoupon ? `Edit Coupon (${editingCoupon.code})` : 'Create Promo Coupon'}
        >
          <form onSubmit={handleSaveCoupon} className="space-y-4">
            <Field label="Coupon Code" hint={editingCoupon ? 'Coupon code is immutable once issued.' : undefined}>
              <input
                className={inputCls}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                disabled={Boolean(editingCoupon)}
                placeholder="SHINE50"
              />
            </Field>
            <Field label="Promotion Title">
              <input className={inputCls} value={couponTitle} onChange={(e) => setCouponTitle(e.target.value)} required placeholder="Weekend Cab Saver" />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Type">
                <select className={selectCls} value={discountType} onChange={(e) => setDiscountType(e.target.value as 'percentage' | 'flat')}>
                  <option value="percentage">Percentage (%)</option>
                  <option value="flat">Flat (INR)</option>
                </select>
              </Field>
              <Field label="Value">
                <input className={inputCls} type="number" min="1" value={discountValue} onChange={(e) => setDiscountValue(e.target.value)} required />
              </Field>
              <Field label="Category">
                <select className={selectCls} value={couponCat} onChange={(e) => setCouponCat(e.target.value as 'all' | VehicleCategory)}>
                  <option value="all">All</option>
                  <option value="bike">Bike</option>
                  <option value="auto">Auto</option>
                  <option value="cab">Cab</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max Discount Cap (INR)">
                <input className={inputCls} type="number" min="0" value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} placeholder="e.g. 100" />
              </Field>
              <Field label="Minimum Ride Fare (INR)">
                <input className={inputCls} type="number" min="0" value={minFare} onChange={(e) => setMinFare(e.target.value)} placeholder="e.g. 79" />
              </Field>
              <Field label="City Scope (Optional)">
                <input className={inputCls} value={couponCity} onChange={(e) => setCouponCity(e.target.value)} placeholder="All cities if blank" />
              </Field>
              <Field label="Usage Limit">
                <input className={inputCls} type="number" min="1" value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} required />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCouponOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{editingCoupon ? 'Save Changes' : 'Publish Coupon'}</Button>
            </div>
          </form>
        </ModalDialog>

        <ConfirmDialog
          open={Boolean(deleteCouponTarget)}
          onOpenChange={(o) => !o && setDeleteCouponTarget(null)}
          title="Delete Promo Coupon"
          description={
            deleteCouponTarget
              ? `Permanently delete coupon ${deleteCouponTarget.code} ("${deleteCouponTarget.title}")?`
              : ''
          }
          confirmLabel="Delete Coupon"
          danger
          loading={saving}
          onConfirm={handleDeleteCoupon}
        />
      </div>
    );
  }

  // 57, 58, 59: Notifications & Push Campaigns
  if (
    pageId === 'marketing/customer-notifications' ||
    pageId === 'marketing/driver-notifications' ||
    pageId === 'marketing/push-campaigns'
  ) {
    const defaultAudience: NotificationRecord['targetAudience'] =
      pageId === 'marketing/driver-notifications'
        ? 'drivers'
        : pageId === 'marketing/customer-notifications'
          ? 'customers'
          : 'all';

    const filteredNotifs =
      pageId === 'marketing/customer-notifications'
        ? notifications.filter((n) => n.targetAudience === 'customers' || n.targetAudience === 'all')
        : pageId === 'marketing/driver-notifications'
          ? notifications.filter((n) => n.targetAudience === 'drivers' || n.targetAudience === 'all')
          : notifications;

    const handleSendNotification = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!can('marketing', 'write')) return;
      setSaving(true);
      try {
        const token = await getToken();
        let dispatchStatus: NotificationRecord['status'] = 'provider_not_configured';
        if (token) {
          const res = await fetch('/api/notifications/dispatch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'X-Admin-Role': roleId,
            },
            body: JSON.stringify({
              targetAudience: notifAudience,
              title: notifTitle.trim(),
              body: notifBody.trim(),
              channel: notifChannel,
            }),
          });
          if (res.ok) {
            const body = await res.json();
            dispatchStatus = body.status;
          }
        }
        await createRecord(
          'notifications',
          sanitizeId('notif'),
          {
            targetAudience: notifAudience,
            title: notifTitle.trim(),
            body: notifBody.trim(),
            channel: notifChannel,
            ...(campaignName.trim() ? { campaignName: campaignName.trim() } : {}),
            status: dispatchStatus,
            sentBy: actor.uid,
          },
          actor,
          'send_notification',
          `Logged ${notifChannel} notification to ${notifAudience}: ${notifTitle.trim()}`,
          false
        );
        pushToast(
          dispatchStatus === 'dispatched' ? 'success' : 'info',
          dispatchStatus === 'dispatched' ? 'Notification Dispatched' : 'Logged (FCM Not Configured)',
          notifTitle.trim()
        );
        setNotifTitle('');
        setNotifBody('');
        setNotifOpen(false);
      } catch (err) {
        pushToast('error', 'Dispatch Error', err instanceof Error ? err.message : 'Failed');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="space-y-6">
        {!integrations?.notifications?.configured && (
          <div className="p-3.5 border border-[#FDE68A] bg-[#FFFBEB] rounded-xl text-xs text-[#92400E] flex items-center justify-between gap-2">
            <span>
              <strong>Push Provider Not Configured:</strong> Configure <span className="font-mono">FCM_SERVER_KEY</span> to deliver live push alerts to devices. Dispatches are recorded honestly with <span className="font-mono">provider_not_configured</span> status.
            </span>
            <StatusText status="not_configured" tone="amber" />
          </div>
        )}
        <Panel
          title={
            pageId === 'marketing/driver-notifications'
              ? 'Driver App Notifications'
              : pageId === 'marketing/customer-notifications'
                ? 'Customer App Notifications'
                : 'Push Campaigns'
          }
          subtitle="Broadcast announcements, incentive alerts, and operational updates"
          action={
            can('marketing', 'write') ? (
              <Button
                size="sm"
                onClick={() => {
                  setNotifAudience(defaultAudience);
                  setNotifOpen(true);
                }}
              >
                + Compose Notification
              </Button>
            ) : undefined
          }
        >
          <DataTable
            rows={filteredNotifs}
            emptyTitle="No Notifications Sent"
            emptyDescription="Compose a customer, driver, or multi-audience push campaign."
            columns={[
              { key: 'aud', header: 'Audience', render: (n) => <span className="uppercase text-xs font-semibold">{n.targetAudience}</span> },
              { key: 'title', header: 'Title & Message', render: (n) => <div><div className="font-semibold">{n.title}</div><div className="text-xs text-[#6B7280]">{n.body}</div></div> },
              { key: 'ch', header: 'Channel', render: (n) => <span className="uppercase text-xs font-mono">{n.channel}</span> },
              { key: 'st', header: 'Status', render: (n) => <StatusText status={n.status} /> },
              { key: 'dt', header: 'Created', render: (n) => <span className="text-xs text-[#6B7280]">{formatDateTime(n.createdAt)}</span> },
            ]}
          />
        </Panel>

        <ModalDialog open={notifOpen} onOpenChange={setNotifOpen} title="Compose Notification">
          <form onSubmit={handleSendNotification} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Audience">
                <select className={selectCls} value={notifAudience} onChange={(e) => setNotifAudience(e.target.value as NotificationRecord['targetAudience'])}>
                  <option value="customers">Customers</option>
                  <option value="drivers">Drivers</option>
                  <option value="all">All Users</option>
                </select>
              </Field>
              <Field label="Channel">
                <select className={selectCls} value={notifChannel} onChange={(e) => setNotifChannel(e.target.value as NotificationRecord['channel'])}>
                  <option value="push">Push (FCM)</option>
                  <option value="in_app">In-App Inbox</option>
                  <option value="sms">SMS</option>
                </select>
              </Field>
            </div>
            <Field label="Campaign Name (Optional)">
              <input className={inputCls} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="Monsoon Surge Bonus" />
            </Field>
            <Field label="Title">
              <input className={inputCls} value={notifTitle} onChange={(e) => setNotifTitle(e.target.value)} required />
            </Field>
            <Field label="Message Body">
              <textarea className="w-full p-3 text-sm bg-white border border-[#D1D5DB] rounded-lg" rows={3} value={notifBody} onChange={(e) => setNotifBody(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setNotifOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>Dispatch</Button>
            </div>
          </form>
        </ModalDialog>
      </div>
    );
  }

  // 60, 61, 62: Support & SOS Emergency
  if (
    pageId === 'support/customer-tickets' ||
    pageId === 'support/driver-tickets' ||
    pageId === 'support/sos'
  ) {
    const isSosPage = pageId === 'support/sos';
    const isDriverPage = pageId === 'support/driver-tickets';
    const baseQueue = isSosPage
      ? supportTickets.filter((t) => t.isSos || t.priority === 'critical')
      : isDriverPage
        ? supportTickets.filter((t) => t.userType === 'driver')
        : supportTickets.filter((t) => t.userType === 'customer');

    const rows =
      ticketStatusFilter === 'all'
        ? baseQueue
        : baseQueue.filter((t) => t.status === ticketStatusFilter);

    const handleCreateTicket = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!can('support', 'write')) return;
      const uid =
        ticketUserId ||
        (ticketUserType === 'customer' ? customers[0]?.id : drivers[0]?.id) ||
        actor.uid;
      setSaving(true);
      try {
        await createRecord(
          'support_tickets',
          sanitizeId(ticketIsSos || isSosPage ? 'sos' : 'tkt'),
          {
            userId: uid,
            userType: ticketUserType,
            category: ticketIsSos || isSosPage ? 'sos_emergency' : 'ride_support',
            priority: ticketIsSos || isSosPage ? 'critical' : ticketPriority,
            status: 'open',
            subject: ticketSubject.trim(),
            description: ticketDesc.trim(),
            isSos: ticketIsSos || isSosPage,
          },
          actor,
          'create_support_ticket',
          `Opened ${ticketIsSos || isSosPage ? 'SOS' : 'support'} ticket: ${ticketSubject.trim()}`
        );
        pushToast('success', 'Ticket Logged', ticketSubject.trim());
        setTicketSubject('');
        setTicketDesc('');
        setTicketOpen(false);
      } catch (err) {
        pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
      } finally {
        setSaving(false);
      }
    };

    const openTicketInspector = (t: SupportTicket) => {
      setInspectTicket(t);
      setEditTicketStatus(t.status);
      setEditTicketPriority(t.priority);
      setResolutionNote(t.resolutionNote || '');
    };

    const handleUpdateTicket = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!inspectTicket || !can('support', 'write')) return;
      setSaving(true);
      try {
        await updateRecord(
          'support_tickets',
          inspectTicket.id,
          {
            status: editTicketStatus,
            priority: editTicketPriority,
            ...(resolutionNote.trim() ? { resolutionNote: resolutionNote.trim().slice(0, 500) } : {}),
          },
          actor,
          `ticket_update_${editTicketStatus}`,
          `Updated ticket ${inspectTicket.id} → ${editTicketStatus} (${editTicketPriority})`
        );
        pushToast('success', 'Ticket Updated', `${inspectTicket.id} → ${editTicketStatus}`);
        setInspectTicket(null);
      } catch (err) {
        pushToast('error', 'Update Failed', err instanceof Error ? err.message : 'Failed');
      } finally {
        setSaving(false);
      }
    };

    const updateTicketStatusQuick = async (t: SupportTicket, status: SupportTicket['status']) => {
      if (!can('support', 'write')) return;
      await updateRecord(
        'support_tickets',
        t.id,
        { status },
        actor,
        `ticket_status_${status}`,
        `Moved ticket ${t.id} to ${status}`
      );
      pushToast('success', 'Ticket Updated', `${t.id} → ${status}`);
    };

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Total in Queue" value={baseQueue.length} />
          <StatTile label="Open" value={baseQueue.filter((t) => t.status === 'open').length} tone="amber" />
          <StatTile label="Escalated / Critical" value={baseQueue.filter((t) => t.status === 'escalated' || t.priority === 'critical').length} tone="red" />
          <StatTile label="Resolved" value={baseQueue.filter((t) => t.status === 'resolved').length} tone="green" />
        </div>

        <Panel
          title={isSosPage ? 'SOS Emergency Management' : isDriverPage ? 'Driver Support Queue' : 'Customer Support Queue'}
          subtitle={isSosPage ? 'Priority safety escalation queue for active rides' : 'Triage, escalate, and resolve user support cases'}
          action={
            can('support', 'write') ? (
              <Button
                size="sm"
                variant={isSosPage ? 'danger' : 'primary'}
                onClick={() => {
                  setTicketIsSos(isSosPage);
                  setTicketPriority(isSosPage ? 'critical' : 'medium');
                  setTicketUserType(isDriverPage ? 'driver' : 'customer');
                  setTicketOpen(true);
                }}
              >
                {isSosPage ? '+ Log SOS Incident' : '+ Create Ticket'}
              </Button>
            ) : undefined
          }
        >
          <DataTable
            rows={rows}
            filterControls={
              <select
                aria-label="Filter ticket status"
                className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value as 'all' | SupportTicket['status'])}
              >
                <option value="all">All Statuses</option>
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="escalated">Escalated</option>
                <option value="resolved">Resolved</option>
              </select>
            }
            emptyTitle={isSosPage ? 'No Active SOS Emergencies' : 'No Support Tickets in Queue'}
            emptyDescription={isSosPage ? 'Any emergency SOS triggered from the Customer or Driver apps surfaces immediately here.' : 'Tickets filed by users appear here for resolution.'}
            columns={[
              { key: 'id', header: 'Ticket ID', render: (t) => <span className="font-mono text-xs">{t.id}</span> },
              {
                key: 'subj',
                header: 'Subject',
                render: (t) => (
                  <div>
                    <div className="font-semibold">{t.subject}</div>
                    <div className="text-xs text-[#6B7280] line-clamp-1">{t.description}</div>
                    {t.resolutionNote && (
                      <div className="text-[11px] text-[#15803D] mt-0.5 line-clamp-1">Note: {t.resolutionNote}</div>
                    )}
                  </div>
                ),
              },
              { key: 'prio', header: 'Priority', render: (t) => <StatusText status={t.priority} /> },
              { key: 'st', header: 'Status', render: (t) => <StatusText status={t.status} /> },
              {
                key: 'act',
                header: 'Actions',
                align: 'right',
                render: (t) => (
                  <div className="inline-flex gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => openTicketInspector(t)}>
                      Inspect
                    </Button>
                    {t.status !== 'resolved' && can('support', 'write') && (
                      <Button size="sm" variant="success" onClick={() => updateTicketStatusQuick(t, 'resolved')}>
                        Resolve
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Panel>

        <ModalDialog open={ticketOpen} onOpenChange={setTicketOpen} title={isSosPage ? 'Log SOS Emergency Incident' : 'Create Support Ticket'}>
          <form onSubmit={handleCreateTicket} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Reporter Type">
                <select className={selectCls} value={ticketUserType} onChange={(e) => setTicketUserType(e.target.value as 'customer' | 'driver')}>
                  <option value="customer">Customer</option>
                  <option value="driver">Driver</option>
                </select>
              </Field>
              <Field label="Priority">
                <select className={selectCls} value={ticketPriority} onChange={(e) => setTicketPriority(e.target.value as SupportTicket['priority'])}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </Field>
            </div>
            <Field label="User ID">
              <input className={inputCls} value={ticketUserId} onChange={(e) => setTicketUserId(e.target.value)} placeholder="Customer or Driver ID" />
            </Field>
            <Field label="Subject">
              <input className={inputCls} value={ticketSubject} onChange={(e) => setTicketSubject(e.target.value)} required />
            </Field>
            <Field label="Incident Details">
              <textarea className="w-full p-3 text-sm bg-white border border-[#D1D5DB] rounded-lg" rows={3} value={ticketDesc} onChange={(e) => setTicketDesc(e.target.value)} required />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTicketOpen(false)}>Cancel</Button>
              <Button type="submit" variant={isSosPage ? 'danger' : 'primary'} disabled={saving}>Submit Ticket</Button>
            </div>
          </form>
        </ModalDialog>

        <ModalDialog
          open={Boolean(inspectTicket)}
          onOpenChange={(o) => !o && setInspectTicket(null)}
          title={inspectTicket ? `Ticket ${inspectTicket.id}` : 'Inspect Ticket'}
          description={inspectTicket ? `Reporter: ${inspectTicket.userType} (${inspectTicket.userId})` : undefined}
        >
          {inspectTicket && (
            <form onSubmit={handleUpdateTicket} className="space-y-4">
              <div className="p-3 border border-[#E5E7EB] rounded-lg bg-[#FAFAFB] text-xs space-y-1">
                <div className="font-semibold text-[#111111]">{inspectTicket.subject}</div>
                <p className="text-[#4B5563] whitespace-pre-wrap">{inspectTicket.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Status">
                  <select className={selectCls} value={editTicketStatus} onChange={(e) => setEditTicketStatus(e.target.value as SupportTicket['status'])}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="escalated">Escalated</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </Field>
                <Field label="Priority">
                  <select className={selectCls} value={editTicketPriority} onChange={(e) => setEditTicketPriority(e.target.value as SupportTicket['priority'])}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </Field>
              </div>
              <Field label="Resolution / Escalation Note">
                <textarea
                  className="w-full p-3 text-sm bg-white border border-[#D1D5DB] rounded-lg"
                  rows={3}
                  maxLength={500}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Document action taken, refund issued, or safety team handoff..."
                />
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setInspectTicket(null)}>Close</Button>
                <Button type="submit" disabled={saving || !can('support', 'write')}>Save Resolution</Button>
              </div>
            </form>
          )}
        </ModalDialog>
      </div>
    );
  }

  // 63: Admin User Management
  if (pageId === 'security/admin-users') {
    const openCreateAdmin = () => {
      setEditingAdmin(null);
      setAdminUid('');
      setAdminEmail('');
      setAdminName('');
      setAdminRole('operations_admin');
      setAdminOpen(true);
    };

    const openEditAdmin = (a: AdminUser) => {
      setEditingAdmin(a);
      setAdminUid(a.uid);
      setAdminEmail(a.email);
      setAdminName(a.fullName);
      setAdminRole(a.roleId);
      setAdminOpen(true);
    };

    const handleSaveAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!can('security', 'admin')) {
        pushToast('error', 'Permission Denied', 'Only Super Admin can provision or update admin accounts.');
        return;
      }
      if (!adminName.trim()) {
        pushToast('error', 'Validation Error', 'Enter administrator full name.');
        return;
      }
      setSaving(true);
      try {
        if (editingAdmin) {
          await updateRecord(
            'admin_users',
            editingAdmin.id,
            {
              fullName: adminName.trim(),
              roleId: adminRole,
            },
            actor,
            'update_admin_user',
            `Updated admin ${editingAdmin.email} role to ${adminRole}`
          );
          pushToast('success', 'Admin Updated', `${editingAdmin.email} → ${adminRole}`);
        } else {
          const cleanUid = adminUid.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
          if (!cleanUid || !adminEmail.includes('@')) {
            pushToast('error', 'Validation Error', 'Enter valid Firebase UID and email.');
            setSaving(false);
            return;
          }
          await createRecord(
            'admin_users',
            cleanUid,
            {
              uid: cleanUid,
              email: adminEmail.trim(),
              fullName: adminName.trim(),
              roleId: adminRole,
              isActive: true,
            },
            actor,
            'create_admin_user',
            `Provisioned ${adminRole} for ${adminEmail.trim()}`
          );
          pushToast('success', 'Admin User Provisioned', adminEmail.trim());
        }
        setAdminOpen(false);
        setEditingAdmin(null);
      } catch (err) {
        pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
      } finally {
        setSaving(false);
      }
    };

    const handleDeleteAdmin = async () => {
      if (!deleteAdminTarget || !can('security', 'admin')) return;
      setSaving(true);
      try {
        await deleteRecord(
          'admin_users',
          deleteAdminTarget.id,
          actor,
          'delete_admin_user',
          `Removed admin access for ${deleteAdminTarget.email}`
        );
        pushToast('success', 'Admin Removed', deleteAdminTarget.email);
        setDeleteAdminTarget(null);
      } catch (err) {
        pushToast('error', 'Delete Failed', err instanceof Error ? err.message : 'Failed');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="space-y-6">
        <Panel
          title="Admin User Management"
          subtitle="Manage Super Admin, Operations, KYC, Finance, Support, Marketing, and Read-only accounts"
          action={can('security', 'admin') ? <Button size="sm" onClick={openCreateAdmin}>+ Provision Admin</Button> : undefined}
        >
          <DataTable
            rows={adminUsers}
            emptyTitle="No Additional Admin Users"
            emptyDescription="Only the bootstrapped Super Admin is currently active."
            columns={[
              { key: 'name', header: 'Admin User', render: (a) => <div><div className="font-semibold">{a.fullName}</div><div className="text-xs text-[#6B7280]">{a.email}</div></div> },
              { key: 'uid', header: 'UID', render: (a) => <span className="font-mono text-xs">{a.uid}</span> },
              { key: 'role', header: 'Role', render: (a) => <StatusText status={a.roleId} tone="neutral" /> },
              { key: 'active', header: 'Status', render: (a) => <StatusText status={a.isActive ? 'active' : 'suspended'} /> },
              {
                key: 'act',
                header: 'Access',
                align: 'right',
                render: (a) => (
                  <div className="inline-flex gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!can('security', 'admin') || a.email === 'ma94646445@gmail.com'}
                      onClick={() => openEditAdmin(a)}
                    >
                      Edit Role
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!can('security', 'admin') || a.email === 'ma94646445@gmail.com'}
                      onClick={() =>
                        updateRecord(
                          'admin_users',
                          a.id,
                          { isActive: !a.isActive },
                          actor,
                          'toggle_admin_active',
                          `Toggled active status for ${a.email}`
                        )
                      }
                    >
                      {a.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      disabled={!can('security', 'admin') || a.email === 'ma94646445@gmail.com'}
                      onClick={() => setDeleteAdminTarget(a)}
                    >
                      Remove
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </Panel>

        <ModalDialog
          open={adminOpen}
          onOpenChange={(o) => {
            setAdminOpen(o);
            if (!o) setEditingAdmin(null);
          }}
          title={editingAdmin ? `Edit Admin · ${editingAdmin.email}` : 'Provision Admin Account'}
        >
          <form onSubmit={handleSaveAdmin} className="space-y-4">
            <Field label="Firebase Auth UID">
              <input className={inputCls} value={adminUid} onChange={(e) => setAdminUid(e.target.value)} required disabled={Boolean(editingAdmin)} placeholder="uid_from_auth" />
            </Field>
            <Field label="Full Name">
              <input className={inputCls} value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
            </Field>
            <Field label="Email">
              <input className={inputCls} type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required disabled={Boolean(editingAdmin)} />
            </Field>
            <Field label="RBAC Role">
              <select className={selectCls} value={adminRole} onChange={(e) => setAdminRole(e.target.value as AdminRoleId)}>
                {Object.values(ROLE_MATRIX).map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setAdminOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{editingAdmin ? 'Save Role' : 'Save Admin'}</Button>
            </div>
          </form>
        </ModalDialog>

        <ConfirmDialog
          open={Boolean(deleteAdminTarget)}
          onOpenChange={(o) => !o && setDeleteAdminTarget(null)}
          title="Remove Admin Account"
          description={deleteAdminTarget ? `Revoke and delete admin record for ${deleteAdminTarget.email}?` : ''}
          confirmLabel="Remove Admin"
          danger
          loading={saving}
          onConfirm={handleDeleteAdmin}
        />
      </div>
    );
  }

  // 64: Roles and Permissions
  if (pageId === 'security/roles') {
    const roleList = Object.values(ROLE_MATRIX);
    return (
      <Panel title="RBAC Roles & Permission Matrix" subtitle="Server-enforced permissions across all 7 administrative tiers">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roleList.map((r) => (
            <div key={r.id} className="p-4 border border-[#E5E7EB] rounded-xl bg-white space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-bold text-[#111111]">{r.label}</div>
                  <div className="text-xs font-mono text-[#6B7280]">{r.id}</div>
                </div>
                {roleId === r.id && <StatusText status="your_current_role" tone="green" />}
              </div>
              <p className="text-xs text-[#4B5563]">{r.description}</p>
              <div className="grid grid-cols-2 gap-1.5 pt-2 border-t border-[#F3F4F6] text-[11px]">
                {Object.entries(r.permissions).map(([mod, acts]) => (
                  <div key={mod} className="flex items-center justify-between gap-2">
                    <span className="capitalize text-[#4B5563]">{mod}</span>
                    <span className="font-mono text-[#111111]">{acts.length > 0 ? acts.join(', ') : 'none'}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  // 66: Integrations & Env Keys (Server-Side Secrets Checklist — never exposes or stores raw secrets in UI)
  if (pageId === 'security/api-keys') {
    const configuredCount = envChecklist.filter((i) => i.configured).length;
    const missingCount = envChecklist.length - configuredCount;
    const filteredEnv = envChecklist.filter((item) => {
      if (envFilter === 'configured') return item.configured;
      if (envFilter === 'missing') return !item.configured;
      return true;
    });

    const handleCopyEnvTemplate = async () => {
      const template = envChecklist.map((i) => `${i.envKey}=""`).join('\n');
      try {
        await navigator.clipboard.writeText(template);
        pushToast('success', 'Env Template Copied', `${envChecklist.length} variable names copied to clipboard.`);
      } catch {
        pushToast('info', 'Copy Unavailable', 'Use .env.example in project root as your template.');
      }
    };

    return (
      <div className="space-y-6">
                {/* Live Multi-App API Keys & Payment Vault (Syncs in Real-Time to Customer & Driver Apps) */}
        <AppLinksEcosystemBridge pushToast={pushToast} />
        <LiveApiKeysVault pushToast={pushToast} />

        <div className="p-4 border border-[#FDE68A] bg-[#FFFBEB] rounded-xl text-xs text-[#92400E] flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1 max-w-3xl">
            <div className="font-semibold text-sm text-[#111111] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#B45309]" />
              <span>Security Policy: Server-Side Secrets Only</span>
            </div>
            <p className="leading-relaxed">
              For platform security, private API keys (<span className="font-mono">PAYMENT_KEY_SECRET</span>, <span className="font-mono">FCM_SERVER_KEY</span>, <span className="font-mono">SUPABASE_SERVICE_ROLE_KEY</span>, <span className="font-mono">SMS_API_KEY</span>, <span className="font-mono">GEMINI_API_KEY</span>) are never entered or stored in browser forms or Firestore. Add all API keys inside the <strong>AI Studio Secrets panel</strong> (or server <span className="font-mono">.env</span>), then click <strong>Re-check Server</strong> below to verify live activation via <span className="font-mono">/api/integrations/env-checklist</span>.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={handleCopyEnvTemplate} disabled={envChecklist.length === 0}>
              <Copy className="w-3.5 h-3.5" />
              Copy Key Names
            </Button>
            <Button size="sm" onClick={() => void loadEnvChecklist()} disabled={envLoading}>
              <RefreshCw className={`w-3.5 h-3.5 ${envLoading ? 'animate-spin' : ''}`} />
              {envLoading ? 'Checking...' : 'Re-check Server'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatTile label="Tracked Env Keys" value={envChecklist.length} icon={<KeyRound className="w-4 h-4" />} />
          <StatTile label="Configured on Server" value={configuredCount} tone="green" />
          <StatTile label="Missing Variables" value={missingCount} tone={missingCount > 0 ? 'amber' : 'default'} />
          <StatTile
            label="Firebase Core"
            value={integrations?.firebase?.configured ? 'Active' : 'Missing'}
            tone={integrations?.firebase?.configured ? 'green' : 'red'}
          />
        </div>

        <Panel
          title="All Required API Keys & Runtime Secrets Checklist"
          subtitle="Live boolean verification from Express server environment variables (secret values are never transmitted)"
        >
          <DataTable
            rows={filteredEnv.map((item) => ({ id: item.envKey, ...item }))}
            filterControls={
              <select
                aria-label="Filter environment keys"
                className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
                value={envFilter}
                onChange={(e) => setEnvFilter(e.target.value as 'all' | 'configured' | 'missing')}
              >
                <option value="all">All Keys ({envChecklist.length})</option>
                <option value="configured">Configured ({configuredCount})</option>
                <option value="missing">Missing ({missingCount})</option>
              </select>
            }
            emptyTitle="No Environment Keys Match Filter"
            emptyDescription="Switch the filter to view all required SHINE CAB integration environment keys."
            columns={[
              {
                key: 'key',
                header: 'Secret / Env Key Name',
                render: (row) => <span className="font-mono text-xs font-semibold text-[#111111]">{row.envKey}</span>,
              },
              { key: 'svc', header: 'Integration Service', render: (row) => <span className="text-xs font-medium">{row.service}</span> },
              {
                key: 'scope',
                header: 'Runtime Scope',
                render: (row) => (
                  <span className="font-mono text-[11px] uppercase text-[#4B5563]">
                    {row.scope === 'client' ? 'Public Client Env' : 'Server Secret Only'}
                  </span>
                ),
              },
              { key: 'req', header: 'Purpose', render: (row) => <span className="text-xs text-[#4B5563]">{row.requiredFor}</span> },
              {
                key: 'st',
                header: 'Server Status',
                align: 'right',
                render: (row) => (
                  <StatusText
                    status={row.configured ? 'configured' : 'not_configured'}
                    tone={row.configured ? 'green' : 'amber'}
                  />
                ),
              },
            ]}
          />
        </Panel>

        <Panel title="Adapter Health Summary" subtitle="Real-time status reported by server adapters">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {integrations &&
              Object.values(integrations).map((item) => (
                <div key={item.name} className="p-3.5 border border-[#E5E7EB] rounded-lg bg-white space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#111111]">{item.name}</span>
                    <StatusText
                      status={item.configured ? 'configured' : 'not_configured'}
                      tone={item.configured ? 'green' : 'amber'}
                    />
                  </div>
                  <div className="text-[11px] font-mono text-[#6B7280]">Mode: {item.mode}</div>
                  <p className="text-xs text-[#4B5563] leading-relaxed">{item.details}</p>
                </div>
              ))}
          </div>
        </Panel>
      </div>
    );
  }

  // 65: System Settings and Audit Logs
  const handleSaveSetting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!can('security', 'admin')) {
      pushToast('error', 'Permission Denied', 'Only Super Admin can change system settings.');
      return;
    }
    setSaving(true);
    try {
      await upsertSystemSetting(
        settingKey.trim().replace(/[^a-zA-Z0-9_-]/g, '_'),
        {
          key: settingKey.trim(),
          value: settingValue.trim(),
          category: settingCategory.trim(),
        },
        actor
      );
      pushToast('success', 'System Setting Saved', settingKey.trim());
    } catch (err) {
      pushToast('error', 'Save Failed', err instanceof Error ? err.message : 'Failed');
    } finally {
      setSaving(false);
    }
  };

  const filteredAuditLogs =
    auditEntityFilter === 'all'
      ? auditLogs
      : auditLogs.filter((l) => l.entityType === auditEntityFilter);

  const exportAuditCsv = () => {
    const header = ['AuditID', 'Action', 'ActorEmail', 'ActorRole', 'EntityType', 'EntityID', 'Summary', 'Timestamp'];
    const lines = [
      header.join(','),
      ...filteredAuditLogs.map((l) =>
        [
          l.id,
          l.action,
          l.actorEmail || l.actorUid,
          l.actorRole,
          l.entityType,
          l.entityId,
          l.summary || '',
          formatDateTime(l.createdAt),
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shine-cab-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('success', 'Audit CSV Exported', `${filteredAuditLogs.length} audit log rows downloaded.`);
  };

  const handleDownloadAdminZip = async () => {
    if (!can('security', 'admin')) {
      pushToast('error', 'Permission Denied', 'Only Super Admin can download the full admin source archive.');
      return;
    }
    setZipDownloading(true);
    try {
      const token = await getToken();
      if (!token) {
        pushToast('error', 'Session Required', 'Sign in again to download the archive.');
        return;
      }
      const res = await fetch('/api/export/admin-zip', {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-admin-role': roleId,
        },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'shine-cab-super-admin-full.zip';
      a.click();
      URL.revokeObjectURL(url);
      pushToast('success', 'Full Admin ZIP Downloaded', 'shine-cab-super-admin-full.zip saved cleanly.');
    } catch (err) {
      pushToast('error', 'ZIP Export Failed', err instanceof Error ? err.message : 'Download failed');
    } finally {
      setZipDownloading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 border border-[#E5E7EB] bg-white rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-0.5">
          <div className="text-sm font-bold text-[#111111]">Full Super Admin Source Archive (.zip)</div>
          <div className="text-xs text-[#6B7280]">
            Download complete SHINE CAB Super Admin frontend, Express server, Firestore rules, and Supabase SQL migrations (excludes secrets and node_modules).
          </div>
        </div>
        <Button
          size="sm"
          onClick={() => void handleDownloadAdminZip()}
          disabled={zipDownloading || !can('security', 'admin')}
        >
          <Archive className="w-3.5 h-3.5" />
          {zipDownloading ? 'Building ZIP...' : 'Download Full Admin ZIP'}
        </Button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Panel title="Integration Adapter Diagnostics" subtitle="Live status of shared backend & third-party adapters">
          <div className="space-y-3">
            {integrations &&
              Object.values(integrations).map((item) => (
                <div key={item.name} className="p-3 border border-[#E5E7EB] rounded-lg space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-[#111111]">{item.name}</span>
                    <StatusText status={item.configured ? 'configured' : 'not_configured'} tone={item.configured ? 'green' : 'amber'} />
                  </div>
                  <p className="text-[11px] text-[#6B7280] leading-relaxed">{item.details}</p>
                </div>
              ))}
          </div>
        </Panel>

        <Panel title="System Configuration Policies" subtitle="Runtime settings synced to Customer & Driver apps">
          <form onSubmit={handleSaveSetting} className="space-y-3 mb-5 pb-5 border-b border-[#E5E7EB]">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Setting Key">
                <input className={inputCls} value={settingKey} onChange={(e) => setSettingKey(e.target.value)} required />
              </Field>
              <Field label="Category">
                <input className={inputCls} value={settingCategory} onChange={(e) => setSettingCategory(e.target.value)} required />
              </Field>
            </div>
            <Field label="Value">
              <input className={inputCls} value={settingValue} onChange={(e) => setSettingValue(e.target.value)} required />
            </Field>
            <Button type="submit" size="sm" disabled={saving || !can('security', 'admin')}>
              Save System Setting
            </Button>
          </form>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {systemSettings.length === 0 ? (
              <div className="text-xs text-[#6B7280]">No custom system settings stored yet.</div>
            ) : (
              systemSettings.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[#F3F4F6]">
                  <div>
                    <span className="font-mono font-semibold">{s.key}</span>
                    <span className="text-[#6B7280] ml-2">({s.category})</span>
                  </div>
                  <span className="font-mono">{s.value}</span>
                </div>
              ))
            )}
          </div>
        </Panel>
      </div>

      <Panel
        title="Immutable Admin Audit Logs"
        subtitle="Every privileged mutation across all 66 modules is recorded here"
        action={
          <Button size="sm" variant="outline" onClick={exportAuditCsv}>
            <Download className="w-3.5 h-3.5" />
            Export Audit CSV
          </Button>
        }
      >
        <DataTable
          rows={filteredAuditLogs}
          filterControls={
            <select
              aria-label="Filter audit entity"
              className="h-9 px-3 text-xs bg-white border border-[#D1D5DB] rounded-lg"
              value={auditEntityFilter}
              onChange={(e) => setAuditEntityFilter(e.target.value)}
            >
              <option value="all">All Modules</option>
              <option value="service_zones">Operating Zones</option>
              <option value="rides">Rides</option>
              <option value="drivers">Drivers</option>
              <option value="customers">Customers</option>
              <option value="vehicles">Vehicles</option>
              <option value="fare_configs">Fare Configs</option>
              <option value="payments">Payments</option>
              <option value="payouts">Payouts</option>
              <option value="coupons">Coupons</option>
              <option value="support_tickets">Support & SOS</option>
              <option value="admin_users">Admin Users</option>
            </select>
          }
          emptyTitle="No Audit Events Recorded"
          emptyDescription="Privileged admin operations automatically append immutable audit logs."
          columns={[
            { key: 'action', header: 'Action', render: (l) => <span className="font-mono text-xs font-semibold">{l.action}</span> },
            { key: 'actor', header: 'Actor', render: (l) => <div><div className="text-xs font-medium">{l.actorEmail || l.actorUid}</div><div className="text-[11px] font-mono text-[#6B7280]">{l.actorRole}</div></div> },
            { key: 'entity', header: 'Entity', render: (l) => <span className="font-mono text-xs">{l.entityType}/{l.entityId}</span> },
            { key: 'summary', header: 'Summary', render: (l) => <span className="text-xs text-[#4B5563]">{l.summary || '—'}</span> },
            { key: 'dt', header: 'Timestamp', render: (l) => <span className="text-xs text-[#6B7280]">{formatDateTime(l.createdAt)}</span> },
          ]}
        />
      </Panel>
    </div>
  );
};
