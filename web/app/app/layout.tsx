import type { Metadata } from 'next';
import { PortalShell } from '@/components/portal/shell';

export const metadata: Metadata = { title: 'Portal', robots: { index: false } };

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
