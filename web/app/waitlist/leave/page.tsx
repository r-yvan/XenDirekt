import type { Metadata } from 'next';
import { SimplePage } from '@/components/site/simple-page';
import { LeaveWaitlist } from './leave';

export const metadata: Metadata = { title: 'Leave the waitlist', robots: { index: false } };

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  return (
    <SimplePage>
      <LeaveWaitlist token={token ?? ''} />
    </SimplePage>
  );
}
