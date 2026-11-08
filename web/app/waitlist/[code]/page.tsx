import type { Metadata } from 'next';
import { SimplePage } from '@/components/site/simple-page';
import { WaitlistSpot } from './spot';

export const metadata: Metadata = { title: 'Your spot', robots: { index: false } };

export default async function WaitlistSpotPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return (
    <SimplePage>
      <WaitlistSpot code={code.toUpperCase()} />
    </SimplePage>
  );
}
