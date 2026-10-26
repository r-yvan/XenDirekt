import type { AdminRole } from '../../database/schema';

/**
 * Server-side admin authorisation matrix (FR-ADM-01). Viewers get masked personal data
 * (NFR-SEC-05). Refund approval requires a different Admin from the requester (maker-checker).
 */
const ALL: AdminRole[] = ['VIEWER', 'SUPPORT_AGENT', 'RISK_ANALYST', 'ADMIN'];

export const PERMISSIONS = {
  'payments:read': ALL,
  'personal-data:unmasked': ['SUPPORT_AGENT', 'RISK_ANALYST', 'ADMIN'],
  'payments:review': ['RISK_ANALYST', 'ADMIN'],
  'refunds:request': ['SUPPORT_AGENT', 'RISK_ANALYST', 'ADMIN'],
  'refunds:approve': ['ADMIN'],
  'blocks:manage': ['RISK_ANALYST', 'ADMIN'],
  'users:read': ALL,
  'tickets:read': ALL,
  'tickets:manage': ['SUPPORT_AGENT', 'ADMIN'],
  'config:read': ALL,
  'config:manage': ['ADMIN'],
  'audit:read': ['RISK_ANALYST', 'ADMIN'],
  'reconciliation:read': ['VIEWER', 'RISK_ANALYST', 'ADMIN'],
  'reconciliation:manage': ['RISK_ANALYST', 'ADMIN'],
  'risk:read': ['RISK_ANALYST', 'ADMIN'],
  'metrics:read': ALL,
  'admins:manage': ['ADMIN'],
  self: ALL,
} as const satisfies Record<string, readonly AdminRole[]>;

export type AdminPermission = keyof typeof PERMISSIONS;

export function roleHasPermission(role: AdminRole, permission: AdminPermission): boolean {
  return (PERMISSIONS[permission] as readonly AdminRole[]).includes(role);
}
