import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import JSZip from 'jszip';
import { z } from 'zod';
import { createServer as createViteServer } from 'vite';
import { createIntegrationRegistry } from './src/services/adapters/integrationAdapters.ts';
import { calculateFareBreakdown } from './src/lib/pricingEngine.ts';
import { hasPermission, ROLE_MATRIX } from './src/lib/rbac.ts';
import { AdminRoleId, RideStatus } from './src/types/domain.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firebaseBucket = '';
let firebaseConfigured = false;
try {
  const fbConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
  if (fs.existsSync(fbConfigPath)) {
    const raw = JSON.parse(fs.readFileSync(fbConfigPath, 'utf-8'));
    firebaseConfigured = Boolean(raw.projectId && raw.projectId !== 'remixed-project-id');
    firebaseBucket = raw.storageBucket || '';
  }
} catch {
  firebaseConfigured = false;
}

const registry = createIntegrationRegistry(firebaseConfigured, firebaseBucket);

const app = express();
app.use(express.json({ limit: '1mb' }));

function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.slice(7).trim().length < 10) {
    return res.status(401).json({ error: 'Unauthorized: Valid admin session token required.' });
  }
  const roleHeader = (req.headers['x-admin-role'] as AdminRoleId | undefined) || 'read_only_admin';
  if (!ROLE_MATRIX[roleHeader]) {
    return res.status(403).json({ error: 'Forbidden: Unrecognized admin role.' });
  }
  (req as express.Request & { adminRole: AdminRoleId }).adminRole = roleHeader;
  next();
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'shine-cab-super-admin', timestamp: new Date().toISOString() });
});

app.get('/api/integrations/status', (_req, res) => {
  res.json(registry.getStatusSummary());
});

app.get('/api/maps/config', (_req, res) => {
  const apiKey = registry.googleMaps.getPublicApiKey();
  res.json({
    configured: Boolean(apiKey),
    apiKey: apiKey || null,
  });
});

app.get('/api/integrations/env-checklist', (_req, res) => {
  const items = [
    {
      envKey: 'VITE_GOOGLE_MAPS_API_KEY',
      service: 'Google Maps Platform',
      scope: 'client',
      configured: Boolean(process.env.VITE_GOOGLE_MAPS_API_KEY || process.env.GOOGLE_MAPS_API_KEY),
      requiredFor: 'Live Ride Map & Geofence Zone Picker',
    },
    {
      envKey: 'PAYMENT_PROVIDER',
      service: 'Payment Gateway',
      scope: 'server',
      configured: Boolean(process.env.PAYMENT_PROVIDER),
      requiredFor: 'Provider name (e.g. razorpay, cashfree)',
    },
    {
      envKey: 'PAYMENT_KEY_ID',
      service: 'Payment Gateway',
      scope: 'server',
      configured: Boolean(process.env.PAYMENT_KEY_ID),
      requiredFor: 'UPI / Online transaction verification',
    },
    {
      envKey: 'PAYMENT_KEY_SECRET',
      service: 'Payment Gateway',
      scope: 'server',
      configured: Boolean(process.env.PAYMENT_KEY_SECRET),
      requiredFor: 'Server-side settlement & payout signature checks',
    },
    {
      envKey: 'PAYMENT_WEBHOOK_SECRET',
      service: 'Payment Gateway',
      scope: 'server',
      configured: Boolean(process.env.PAYMENT_WEBHOOK_SECRET),
      requiredFor: 'Webhook signature verification',
    },
    {
      envKey: 'FCM_SERVER_KEY',
      service: 'Push Notifications (FCM)',
      scope: 'server',
      configured: Boolean(process.env.FCM_SERVER_KEY),
      requiredFor: 'Customer & Driver App push broadcasts',
    },
    {
      envKey: 'SUPABASE_URL',
      service: 'Supabase Shared PostgreSQL',
      scope: 'server',
      configured: Boolean(process.env.SUPABASE_URL),
      requiredFor: 'Shared Customer/Driver/Admin PostgreSQL endpoint',
    },
    {
      envKey: 'SUPABASE_SERVICE_ROLE_KEY',
      service: 'Supabase Shared PostgreSQL',
      scope: 'server',
      configured: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      requiredFor: 'Server-side Supabase administrative sync',
    },
    {
      envKey: 'VITE_SUPABASE_URL',
      service: 'Supabase Shared PostgreSQL',
      scope: 'client',
      configured: Boolean(process.env.VITE_SUPABASE_URL),
      requiredFor: 'Client-side Supabase Realtime URL',
    },
    {
      envKey: 'VITE_SUPABASE_ANON_KEY',
      service: 'Supabase Shared PostgreSQL',
      scope: 'client',
      configured: Boolean(process.env.VITE_SUPABASE_ANON_KEY),
      requiredFor: 'Client-side Supabase public anon key',
    },
    {
      envKey: 'SMS_PROVIDER',
      service: 'SMS & OTP Gateway',
      scope: 'server',
      configured: Boolean(process.env.SMS_PROVIDER),
      requiredFor: 'Ride start OTP & driver alerts',
    },
    {
      envKey: 'SMS_API_KEY',
      service: 'SMS & OTP Gateway',
      scope: 'server',
      configured: Boolean(process.env.SMS_API_KEY),
      requiredFor: 'SMS gateway authentication key',
    },
    {
      envKey: 'GEMINI_API_KEY',
      service: 'Gemini AI Services',
      scope: 'server',
      configured: Boolean(process.env.GEMINI_API_KEY),
      requiredFor: 'Server-side AI features when enabled',
    },
  ];

  res.json({
    firebaseConfigured,
    items,
  });
});

app.get('/api/rbac/roles', (_req, res) => {
  res.json({ roles: Object.values(ROLE_MATRIX) });
});

const pricingSchema = z.object({
  config: z.object({
    city: z.string().min(1),
    vehicleCategory: z.enum(['bike', 'auto', 'cab']),
    baseFare: z.number().min(0),
    minimumFare: z.number().min(0),
    perKmRate: z.number().min(0),
    perMinuteRate: z.number().min(0),
    waitingChargePerMin: z.number().min(0),
    surgeMultiplier: z.number().min(1).max(5),
    cancellationFee: z.number().min(0),
    commissionPct: z.number().min(0).max(50),
  }),
  distanceKm: z.number().min(0),
  durationMin: z.number().min(0),
  waitingMin: z.number().min(0).optional(),
  discountAmount: z.number().min(0).optional(),
});

app.post('/api/pricing/calculate', (req, res) => {
  const parsed = pricingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid pricing calculation payload', issues: parsed.error.issues });
  }
  try {
    const result = calculateFareBreakdown(parsed.data);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Fare calculation failed' });
  }
});

const transitionSchema = z.object({
  currentStatus: z.string().min(1),
  nextStatus: z.string().min(1),
  existingDriverId: z.string().optional(),
  targetDriverId: z.string().optional(),
});

app.post('/api/rides/validate-transition', requireAdminAuth, (req, res) => {
  const role = (req as express.Request & { adminRole: AdminRoleId }).adminRole;
  if (!hasPermission(role, 'rides', 'write')) {
    return res.status(403).json({ error: 'Forbidden: Role lacks ride dispatch write permission.' });
  }
  const parsed = transitionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid transition payload' });
  }
  const validation = registry.rideMatching.validateTransition(
    parsed.data.currentStatus as RideStatus,
    parsed.data.nextStatus as RideStatus,
    parsed.data.existingDriverId,
    parsed.data.targetDriverId
  );
  if (!validation.allowed) {
    return res.status(409).json(validation);
  }
  res.json(validation);
});

const paymentVerifySchema = z.object({
  method: z.enum(['cash', 'upi', 'online', 'wallet']),
  amount: z.number().positive(),
  providerTxId: z.string().optional(),
});

app.post('/api/payments/verify', requireAdminAuth, (req, res) => {
  const role = (req as express.Request & { adminRole: AdminRoleId }).adminRole;
  if (!hasPermission(role, 'finance', 'approve')) {
    return res.status(403).json({ error: 'Forbidden: Role lacks finance verification permission.' });
  }
  const parsed = paymentVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payment verification payload' });
  }
  const result = registry.payments.verifyTransactionConfirmation(parsed.data);
  if (!result.verified) {
    return res.status(422).json(result);
  }
  res.json(result);
});

const payoutVerifySchema = z.object({
  amount: z.number().positive(),
  providerPayoutId: z.string().optional(),
});

app.post('/api/payouts/verify', requireAdminAuth, (req, res) => {
  const role = (req as express.Request & { adminRole: AdminRoleId }).adminRole;
  if (!hasPermission(role, 'finance', 'approve')) {
    return res.status(403).json({ error: 'Forbidden: Role lacks finance payout approval permission.' });
  }
  const parsed = payoutVerifySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid payout verification payload' });
  }
  if (!registry.payments.isConfigured()) {
    return res.status(422).json({
      verified: false,
      reason: 'Payout gateway credentials (PAYMENT_PROVIDER / PAYMENT_KEY_ID / PAYMENT_KEY_SECRET) are not configured. Cannot mark bank payout succeeded without verified gateway confirmation.',
    });
  }
  if (!parsed.data.providerPayoutId || parsed.data.providerPayoutId.trim().length < 6) {
    return res.status(422).json({
      verified: false,
      reason: 'Verified provider payout reference ID is required.',
    });
  }
  res.json({ verified: true });
});

const notificationDispatchSchema = z.object({
  targetAudience: z.enum(['customers', 'drivers', 'all']),
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(500),
  channel: z.enum(['push', 'in_app', 'sms']),
});

app.post('/api/notifications/dispatch', requireAdminAuth, (req, res) => {
  const role = (req as express.Request & { adminRole: AdminRoleId }).adminRole;
  if (!hasPermission(role, 'marketing', 'write')) {
    return res.status(403).json({ error: 'Forbidden: Role lacks marketing dispatch permission.' });
  }
  const parsed = notificationDispatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid notification payload' });
  }
  const configured = registry.notifications.isConfigured();
  res.json({
    dispatched: configured,
    status: configured ? 'dispatched' : 'provider_not_configured',
    message: configured
      ? 'Notification queued to FCM dispatch provider.'
      : 'FCM_SERVER_KEY is not configured; notification stored with provider_not_configured status.',
  });
});

app.get('/api/docs/architecture', (_req, res) => {
  res.json({
    products: ['SHINE CAB Customer App', 'SHINE CAB Driver App', 'SHINE CAB Super Admin Panel'],
    sharedEntities: [
      'profiles',
      'customers',
      'drivers',
      'vehicles',
      'driver_documents',
      'rides',
      'ride_events',
      'driver_locations',
      'fare_configs',
      'payments',
      'wallet_transactions',
      'payouts',
      'coupons',
      'support_tickets',
      'notifications',
      'service_zones',
      'admin_users',
      'roles',
      'permissions',
      'audit_logs',
    ],
    adapters: [
      'SupabaseDatabaseAdapter',
      'AuthenticationAdapter',
      'CustomerApiAdapter',
      'DriverApiAdapter',
      'RideMatchingAdapter',
      'LiveLocationAdapter',
      'GoogleMapsAdapter',
      'PaymentsAdapter',
      'NotificationsAdapter',
      'StorageAdapter',
    ],
  });
});

const ZIP_EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.gmp_cache',
  'dist',
  'build',
  'coverage',
  '.aistudio',
]);

function shouldExcludeZipFile(fileName: string): boolean {
  if (fileName === '.env.example') return false;
  if (fileName === '.env' || fileName.startsWith('.env.')) return true;
  if (fileName === '.DS_Store') return true;
  if (
    fileName.endsWith('.zip') ||
    fileName.endsWith('.log') ||
    fileName.endsWith('.pem') ||
    fileName.endsWith('.key') ||
    fileName.endsWith('.p12')
  ) {
    return true;
  }
  if (fileName.toLowerCase().includes('serviceaccount')) return true;
  return false;
}

function collectProjectFilesForZip(
  rootDir: string,
  currentDir: string,
  zipFolder: JSZip
): void {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.resolve(currentDir, entry.name);
    if (!fullPath.startsWith(rootDir + path.sep)) continue;

    if (entry.isDirectory()) {
      if (ZIP_EXCLUDED_DIRS.has(entry.name)) continue;
      const subFolder = zipFolder.folder(entry.name);
      if (subFolder) {
        collectProjectFilesForZip(rootDir, fullPath, subFolder);
      }
    } else if (entry.isFile()) {
      if (shouldExcludeZipFile(entry.name)) continue;
      zipFolder.file(entry.name, fs.readFileSync(fullPath));
    }
  }
}

app.get('/api/export/admin-zip', requireAdminAuth, async (req, res) => {
  const role = (req as express.Request & { adminRole: AdminRoleId }).adminRole;
  if (!hasPermission(role, 'security', 'admin')) {
    return res.status(403).json({ error: 'Forbidden: Only Super Admin can export full source archive.' });
  }
  try {
    const projectRoot = path.resolve(__dirname);
    const zip = new JSZip();
    const rootFolder = zip.folder('shine-cab-super-admin');
    if (!rootFolder) {
      return res.status(500).json({ error: 'Failed to initialize zip archive.' });
    }
    collectProjectFilesForZip(projectRoot, projectRoot, rootFolder);
    const archiveBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="shine-cab-super-admin-full.zip"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(archiveBuffer);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'ZIP generation failed' });
  }
});

async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`SHINE CAB Super Admin Panel running on http://0.0.0.0:${port}`);
  });
}

startServer();
