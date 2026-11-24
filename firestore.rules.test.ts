import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
const rulesContent = fs.readFileSync(rulesPath, 'utf-8');

describe('Firestore Security Rules Invariants (Zero-Trust & Pillar 8 Compliance)', () => {
  it('enforces global default-deny catch-all at root', () => {
    expect(rulesContent).toContain('match /{document=**}');
    expect(rulesContent).toContain('allow read, write: if false;');
  });

  it('requires verified email authentication on all signed-in helpers', () => {
    expect(rulesContent).toContain('request.auth != null && request.auth.token.email_verified == true');
  });

  it('keeps audit_logs strictly immutable (no update or delete allowed)', () => {
    const auditSectionMatch = rulesContent.match(/match \/audit_logs\/\{logId\}\s*\{([\s\S]*?)\n\s*\}/);
    expect(auditSectionMatch).not.toBeNull();
    const body = auditSectionMatch?.[1] || '';
    expect(body).toContain('allow update, delete: if false;');
  });

  it('guards all 20 SHINE CAB collections with explicit match blocks', () => {
    const expectedCollections = [
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
      'audit_logs',
      'system_settings',
    ];
    for (const col of expectedCollections) {
      expect(rulesContent).toContain(`match /${col}/`);
    }
  });

  it('does not call get() or exists() directly inside any allow list statement', () => {
    const listLines = rulesContent
      .split('\n')
      .filter((line) => line.includes('allow list:'));
    expect(listLines.length).toBeGreaterThan(0);
    for (const line of listLines) {
      expect(line).not.toMatch(/\b(get|exists)\s*\(/);
    }
  });
});
