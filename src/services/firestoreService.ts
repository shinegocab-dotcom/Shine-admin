import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { isValidRideTransition } from '../lib/rideStateMachine';
import { sanitizeId } from '../lib/utils';
import { AdminRoleId, Ride, RideStatus } from '../types/domain';

export interface AuditActor {
  uid: string;
  email: string;
  roleId: AdminRoleId;
}

function extractTimestampMs(val: unknown): number {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof val === 'object') {
    const rec = val as { toMillis?: () => number; seconds?: number };
    if (typeof rec.toMillis === 'function') return rec.toMillis();
    if (typeof rec.seconds === 'number') return rec.seconds * 1000;
  }
  return 0;
}

export function subscribeCollection<T extends { id: string }>(
  collectionName: string,
  onData: (items: T[]) => void,
  onError?: (err: Error) => void,
  orderField?: string
): Unsubscribe {
  const colRef = collection(db, collectionName);

  return onSnapshot(
    colRef,
    (snapshot) => {
      const rows = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as T[];
      if (orderField) {
        rows.sort((a, b) => {
          const av = extractTimestampMs((a as Record<string, unknown>)[orderField]);
          const bv = extractTimestampMs((b as Record<string, unknown>)[orderField]);
          return bv - av;
        });
      }
      onData(rows);
    },
    (error) => {
      if (onError) {
        onError(new Error(`[${collectionName}] ${error.message}`));
      } else {
        handleFirestoreError(error, OperationType.LIST, collectionName);
      }
    }
  );
}

export async function writeAuditLog(
  actor: AuditActor,
  action: string,
  entityType: string,
  entityId: string,
  summary: string
): Promise<void> {
  const logId = sanitizeId('audit');
  const path = `audit_logs/${logId}`;
  try {
    await setDoc(doc(db, 'audit_logs', logId), {
      actorUid: actor.uid,
      actorEmail: actor.email,
      actorRole: actor.roleId,
      action,
      entityType,
      entityId,
      summary: summary.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function createRecord(
  collectionName: string,
  docId: string,
  payload: Record<string, unknown>,
  actor: AuditActor,
  auditAction: string,
  auditSummary: string,
  includeUpdatedAt = true
): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    const baseData: Record<string, unknown> = {
      ...payload,
      createdAt: serverTimestamp(),
    };
    if (includeUpdatedAt) {
      baseData.updatedAt = serverTimestamp();
    }
    await setDoc(doc(db, collectionName, docId), baseData);
    await writeAuditLog(actor, auditAction, collectionName, docId, auditSummary);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateRecord(
  collectionName: string,
  docId: string,
  updates: Record<string, unknown>,
  actor: AuditActor,
  auditAction: string,
  auditSummary: string
): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    await updateDoc(doc(db, collectionName, docId), {
      ...updates,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(actor, auditAction, collectionName, docId, auditSummary);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteRecord(
  collectionName: string,
  docId: string,
  actor: AuditActor,
  auditAction: string,
  auditSummary: string
): Promise<void> {
  const path = `${collectionName}/${docId}`;
  try {
    await deleteDoc(doc(db, collectionName, docId));
    await writeAuditLog(actor, auditAction, collectionName, docId, auditSummary);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function upsertSystemSetting(
  settingId: string,
  payload: { key: string; value: string; category: string },
  actor: AuditActor
): Promise<void> {
  const path = `system_settings/${settingId}`;
  try {
    await setDoc(doc(db, 'system_settings', settingId), {
      ...payload,
      updatedBy: actor.uid,
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog(actor, 'update_system_setting', 'system_settings', settingId, `Updated ${payload.key}`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function assignDriverToRideAtomic(
  rideId: string,
  driverId: string,
  actor: AuditActor
): Promise<void> {
  const rideRef = doc(db, 'rides', rideId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(rideRef);
      if (!snap.exists()) {
        throw new Error(`Ride ${rideId} does not exist.`);
      }
      const ride = snap.data() as Ride;
      if (ride.driverId && ride.driverId !== driverId) {
        throw new Error('Ride is already assigned to another driver.');
      }
      if (ride.status !== 'requested' && ride.status !== 'searching_driver') {
        throw new Error(`Cannot assign driver while ride status is "${ride.status}".`);
      }
      tx.update(rideRef, {
        driverId,
        status: 'driver_assigned',
        updatedAt: serverTimestamp(),
      });
      const eventId = sanitizeId('evt');
      tx.set(doc(db, 'ride_events', eventId), {
        rideId,
        fromStatus: ride.status,
        toStatus: 'driver_assigned',
        actorUid: actor.uid,
        note: `Admin manually assigned driver ${driverId}`,
        createdAt: serverTimestamp(),
      });
    });
    await writeAuditLog(
      actor,
      'manual_ride_assignment',
      'rides',
      rideId,
      `Atomically assigned driver ${driverId} to ride ${rideId}`
    );
  } catch (error) {
    if (error instanceof Error && (error.message.includes('already assigned') || error.message.includes('Cannot assign'))) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `rides/${rideId}`);
  }
}

export async function transitionRideStatusAtomic(
  rideId: string,
  nextStatus: RideStatus,
  actor: AuditActor,
  note?: string,
  cancellationReason?: string
): Promise<void> {
  const rideRef = doc(db, 'rides', rideId);
  try {
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(rideRef);
      if (!snap.exists()) {
        throw new Error(`Ride ${rideId} not found.`);
      }
      const ride = snap.data() as Ride;
      if (!isValidRideTransition(ride.status, nextStatus)) {
        throw new Error(`Invalid transition from ${ride.status} to ${nextStatus}.`);
      }
      const patch: Record<string, unknown> = {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      };
      if (cancellationReason) {
        patch.cancellationReason = cancellationReason;
      }
      tx.update(rideRef, patch);

      const eventId = sanitizeId('evt');
      tx.set(doc(db, 'ride_events', eventId), {
        rideId,
        fromStatus: ride.status,
        toStatus: nextStatus,
        actorUid: actor.uid,
        note: note || `Transitioned to ${nextStatus}`,
        createdAt: serverTimestamp(),
      });
    });
    await writeAuditLog(
      actor,
      `ride_status_${nextStatus}`,
      'rides',
      rideId,
      note || `Ride ${rideId} moved to ${nextStatus}`
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid transition')) {
      throw error;
    }
    handleFirestoreError(error, OperationType.UPDATE, `rides/${rideId}`);
  }
}

export async function ensureBootstrappedAdminDoc(): Promise<void> {
  const user = auth.currentUser;
  if (!user || user.email !== 'ma94646445@gmail.com') return;
  const adminRef = doc(db, 'admin_users', user.uid);
  try {
    const existing = await getDoc(adminRef);
    if (!existing.exists()) {
      await setDoc(adminRef, {
        uid: user.uid,
        email: user.email,
        fullName: user.displayName || 'SHINE CAB Super Admin',
        roleId: 'super_admin',
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `admin_users/${user.uid}`);
  }
}
