# SHINE CAB Firestore Security Specification (Phase 0)

## 1. Data Invariants
1. **Master Gate & Zero-Trust**: Default deny (`allow read, write: if false;`) on all paths unless explicitly authorized.
2. **Email Verification Enforcement**: Every authenticated check requires `request.auth != null && request.auth.token.email_verified == true`.
3. **Admin Identity Verification**: Admin privileges are granted exclusively to verified bootstrapped Super Admin email (`ma94646445@gmail.com`) or active records in `/admin_users/{uid}` verified via `get()` on single-doc operations, never via client-supplied claims.
4. **No Self-Assigned Roles**: Customers and drivers cannot write to `/admin_users`, `/roles`, `/fare_configs`, `/service_zones`, `/audit_logs`, or `/system_settings`.
5. **PII Isolation**: `/profiles`, `/customers`, `/drivers`, `/payments`, `/payouts`, and `/driver_documents` forbid blanket `isSignedIn()` reads; non-admin access is restricted strictly to `isOwner()`.
6. **Temporal Integrity & Immutability**: `createdAt` and `updatedAt` are validated against `request.time` (serverTimestamp) or immutable on update; `audit_logs` and `ride_events` are append-only (no `update` or `delete`).
7. **Path Variable Hardening**: Every document ID variable (`{customerId}`, `{driverId}`, `{rideId}`, etc.) is validated with `isValidId(id)` (`^[a-zA-Z0-9_\-]+$`, max 128 chars) on single-document operations (`get`, `create`, `update`, `delete`).

## 2. The "Dirty Dozen" Attack Payloads
1. **Unauthenticated List Read**: Unauthenticated client queries `/customers` -> `PERMISSION_DENIED`.
2. **Unverified Email Admin Spoof**: User with `email: "ma94646445@gmail.com"` and `email_verified: false` reads `/admin_users` -> `PERMISSION_DENIED`.
3. **Self-Role Escalation**: Non-admin user attempts `create` on `/admin_users/{uid}` with `roleId: "super_admin"` -> `PERMISSION_DENIED`.
4. **Shadow Field Injection on Customer**: Admin or user creates `/customers/c1` with extra ghost field `isSuperUser: true` -> `PERMISSION_DENIED` (`hasOnly` rejects).
5. **ID Poisoning**: Creating `/rides/<1500-char-junk>` or `/rides/bad$id` -> `PERMISSION_DENIED` (`isValidId` rejects).
6. **PII Cross-Read**: Signed-in non-admin user reads `/customers/other_uid` -> `PERMISSION_DENIED`.
7. **Audit Log Tampering**: Even an admin attempts `update` or `delete` on `/audit_logs/log1` -> `PERMISSION_DENIED` (immutable ledger).
8. **Ride Event Tampering**: Attempts to `update` or `delete` `/ride_events/evt1` -> `PERMISSION_DENIED`.
9. **Client Timestamp Spoofing**: Creating `/fare_configs/fc1` with backdated `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
10. **Immutable Owner Swap**: Updating `/vehicles/v1` to change `createdAt` -> `PERMISSION_DENIED`.
11. **Oversized Payload Denial-of-Wallet**: Creating `/support_tickets/t1` with 10KB `description` -> `PERMISSION_DENIED` (`.size() <= 1000` rejects).
12. **Payment Verification Bypass**: Non-admin attempts to update `/payments/p1` setting `verifiedByProvider: true` -> `PERMISSION_DENIED`.
