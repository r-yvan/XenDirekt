'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { Spinner } from '@/components/ui/spinner';

/** 3-D Secure comes back here (?paymentId=…); the payment page then shows the live status. */
function Return() {
  const router = useRouter();
  const id = useSearchParams().get('paymentId');
  useEffect(() => {
    router.replace(id && /^[0-9a-f-]{36}$/.test(id) ? `/app/activity/${id}` : '/app/activity');
  }, [id, router]);
  return (
    <div className="grid min-h-[40vh] place-items-center">
      <Spinner className="size-6 text-ink-3" />
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense>
      <Return />
    </Suspense>
  );
}
