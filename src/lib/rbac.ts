import { AdminRoleId } from '../types/domain';

export type PermissionModule =
  | 'dashboard'
  | 'customers'
  | 'drivers'
  | 'kyc'
  | 'rides'
  | 'vehicles'
  | 'pricing'
  | 'finance'
  | 'marketing'
  | 'support'
  | 'security';

export type PermissionAction = 'read' | 'write' | 'approve' | 'refund' | 'block' | 'admin';

export interface RoleSpec {
  id: AdminRoleId;
  label: string;
  description: string;
  permissions: Record<PermissionModule, PermissionAction[]>;
}

export const ROLE_MATRIX: Record<AdminRoleId, RoleSpec> = {
  super_admin: {
    id: 'super_admin',
    label: 'Super Admin',
    description: 'Full unrestricted platform governance, RBAC, pricing, payouts, and system settings.',
    permissions: {
      dashboard: ['read'],
      customers: ['read', 'write', 'block'],
      drivers: ['read', 'write', 'approve', 'block'],
      kyc: ['read', 'approve'],
      rides: ['read', 'write'],
      vehicles: ['read', 'write'],
      pricing: ['read', 'write'],
      finance: ['read', 'write', 'approve', 'refund'],
      marketing: ['read', 'write'],
      support: ['read', 'write'],
      security: ['read', 'write', 'admin'],
    },
  },
  operations_admin: {
    id: 'operations_admin',
    label: 'Operations Admin',
    description: 'Live ride dispatch, manual assignment, fleet management, service zones, and pricing.',
    permissions: {
      dashboard: ['read'],
      customers: ['read', 'block'],
      drivers: ['read', 'write', 'block'],
      kyc: ['read'],
      rides: ['read', 'write'],
      vehicles: ['read', 'write'],
      pricing: ['read', 'write'],
      finance: ['read'],
      marketing: ['read'],
      support: ['read', 'write'],
      security: ['read'],
    },
  },
  kyc_admin: {
    id: 'kyc_admin',
    label: 'KYC Admin',
    description: 'Driver onboarding review, Aadhaar/PAN KYC, Driving Licence, RC, and Insurance approvals.',
    permissions: {
      dashboard: ['read'],
      customers: ['read'],
      drivers: ['read', 'approve', 'block'],
      kyc: ['read', 'approve'],
      rides: ['read'],
      vehicles: ['read', 'write'],
      pricing: ['read'],
      finance: [],
      marketing: [],
      support: ['read'],
      security: [],
    },
  },
  finance_admin: {
    id: 'finance_admin',
    label: 'Finance Admin',
    description: 'Transactions, UPI/Cash reconciliation, driver payouts, wallet ledger, refunds, and commissions.',
    permissions: {
      dashboard: ['read'],
      customers: ['read'],
      drivers: ['read'],
      kyc: ['read'],
      rides: ['read'],
      vehicles: ['read'],
      pricing: ['read', 'write'],
      finance: ['read', 'write', 'approve', 'refund'],
      marketing: ['read'],
      support: ['read'],
      security: [],
    },
  },
  support_admin: {
    id: 'support_admin',
    label: 'Support Admin',
    description: 'Customer complaints, driver support tickets, and SOS emergency escalation handling.',
    permissions: {
      dashboard: ['read'],
      customers: ['read'],
      drivers: ['read'],
      kyc: ['read'],
      rides: ['read'],
      vehicles: ['read'],
      pricing: ['read'],
      finance: ['read'],
      marketing: ['read'],
      support: ['read', 'write'],
      security: [],
    },
  },
  marketing_admin: {
    id: 'marketing_admin',
    label: 'Marketing Admin',
    description: 'Coupons, promotional campaigns, and customer/driver push notifications.',
    permissions: {
      dashboard: ['read'],
      customers: ['read'],
      drivers: ['read'],
      kyc: [],
      rides: ['read'],
      vehicles: ['read'],
      pricing: ['read'],
      finance: [],
      marketing: ['read', 'write'],
      support: [],
      security: [],
    },
  },
  read_only_admin: {
    id: 'read_only_admin',
    label: 'Read-only Admin',
    description: 'Audit and executive analytics visibility with zero mutation permissions.',
    permissions: {
      dashboard: ['read'],
      customers: ['read'],
      drivers: ['read'],
      kyc: ['read'],
      rides: ['read'],
      vehicles: ['read'],
      pricing: ['read'],
      finance: ['read'],
      marketing: ['read'],
      support: ['read'],
      security: ['read'],
    },
  },
};

export function hasPermission(
  roleId: AdminRoleId,
  module: PermissionModule,
  action: PermissionAction
): boolean {
  const role = ROLE_MATRIX[roleId];
  if (!role) return false;
  return role.permissions[module]?.includes(action) ?? false;
}
