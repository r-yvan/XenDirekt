'use client';

import { useQueryClient } from '@tanstack/react-query';
import { Check, X } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { CardArt } from '@/components/portal/payment-bits';
import { ButtonLink } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import type { Card } from '@/lib/types';

/** The partner's hosted card page returns here; the server, not this page, decides if it worked. */
export default function CardReturnPage() {
  const queryClient = useQueryClient();
  const [card, setCard] = useState<Card | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const setupId = sessionStorage.getItem('xd-card-setup');
    (setupId
      ? api<Card>('v1/cards', { method: 'POST', body: { setupId } })
      : Promise.reject(new Error('We lost track of this card setup. Start again from Cards.'))
    )
      .then((added) => {
        sessionStorage.removeItem('xd-card-setup');
        setCard(added);
        void queryClient.invalidateQueries({ queryKey: ['cards'] });
      })
      .catch((failure: unknown) =>
        setError(failure instanceof Error ? failure.message : 'The card couldn’t be added.'),
      );
  }, [queryClient]);

  return (
    <div className="mx-auto max-w-[440px] py-10 text-center">
      {!card && !error && (
        <>
          <Spinner className="mx-auto size-7 text-ink-3" />
          <p className="mt-4 text-ink-2">Adding your card…</p>
        </>
      )}
      {card && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <motion.div
            initial={{ rotate: -14, scale: 0.8 }}
            animate={{ rotate: -4, scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            className="mx-auto w-64"
          >
            <CardArt brand={card.brand} last4={card.last4} />
          </motion.div>
          <span className="mx-auto mt-6 grid size-11 place-items-center rounded-full bg-accent text-on-accent">
            <Check className="size-5" strokeWidth={3} />
          </span>
          <h1 className="mt-4 text-[1.8rem] font-bold tracking-[-0.072em] text-ink">Card added</h1>
          <p className="mt-1 text-ink-2">
            {card.brand} •••• {card.last4} is ready to use.
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <ButtonLink href="/app">Send a payment</ButtonLink>
            <ButtonLink href="/app/cards" variant="secondary">
              Your cards
            </ButtonLink>
          </div>
        </motion.div>
      )}
      {error && (
        <div>
          <span className="mx-auto grid size-11 place-items-center rounded-full bg-error/12 text-error">
            <X className="size-5" />
          </span>
          <h1 className="mt-4 text-[1.6rem] font-bold tracking-[-0.066em] text-ink">
            Card not added
          </h1>
          <p className="mt-1 text-ink-2">{error}</p>
          <ButtonLink href="/app/cards" className="mt-6">
            Back to cards
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
