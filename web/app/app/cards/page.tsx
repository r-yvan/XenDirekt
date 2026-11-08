'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ShieldCheck, Star, Trash2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useState } from 'react';
import { CardArt } from '@/components/portal/payment-bits';
import { PageTitle } from '@/components/portal/shell';
import { Button } from '@/components/ui/button';
import { ApiError, api } from '@/lib/api';
import { countryName, flag } from '@/lib/format';
import type { Card, CardSetup } from '@/lib/types';

export const CARD_SETUP_KEY = 'xd-card-setup';

export default function CardsPage() {
  const queryClient = useQueryClient();
  const cards = useQuery({
    queryKey: ['cards'],
    queryFn: () => api<{ cards: Card[] }>('v1/cards'),
  });
  const [error, setError] = useState<string | null>(null);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cards'] });

  // Card numbers are typed on the partner's hosted page, never here. We come back to /app/cards/return.
  const add = useMutation({
    mutationFn: () =>
      api<CardSetup>('v1/cards/setup', { method: 'POST', body: { returnTo: 'WEB' } }),
    onSuccess: (setup) => {
      sessionStorage.setItem(CARD_SETUP_KEY, setup.setupId);
      window.location.href = setup.hostedUrl;
    },
    onError: (failure) =>
      setError(failure instanceof ApiError ? failure.message : 'Couldn’t start adding a card.'),
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) =>
      api(`v1/cards/${id}`, { method: 'PATCH', body: { isDefault: true } }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`v1/cards/${id}`, { method: 'DELETE' }),
    onSuccess: refresh,
  });
  const list = (cards.data?.cards ?? []).filter((card) => card.status !== 'REMOVED');

  return (
    <div>
      <PageTitle
        title="Cards"
        subtitle="Visa and Mastercard cards issued outside Rwanda."
        action={
          <Button onClick={() => add.mutate()} loading={add.isPending}>
            <Plus className="size-4" /> Add a card
          </Button>
        }
      />
      {error && (
        <p role="alert" className="mb-6 rounded-[12px] bg-error/10 p-3 text-[0.9rem] text-error">
          {error}
        </p>
      )}
      {cards.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1].map((i) => (
            <div key={i} className="aspect-[1.586] animate-pulse rounded-[14px] bg-surface-2" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="card flex flex-col items-center p-12 text-center">
          <div className="w-56 -rotate-6">
            <CardArt brand="VISA" last4="••••" />
          </div>
          <p className="title mt-8 text-ink">Add your first card</p>
          <p className="mt-1 max-w-[26rem] text-ink-2">
            You’ll enter it on our licensed partner’s secure page. XenDirekt never sees the number.
          </p>
          <Button size="lg" className="mt-6" onClick={() => add.mutate()} loading={add.isPending}>
            Add a card
          </Button>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((card, index) => (
            <motion.div
              key={card.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.06 }}
              className="card p-3"
            >
              <CardArt brand={card.brand} last4={card.last4} />
              <div className="flex items-center justify-between px-1 pt-3">
                <div>
                  <p className="font-bold tracking-[-0.032em] text-ink">
                    {card.brand === 'VISA' ? 'Visa' : 'Mastercard'} •••• {card.last4}
                  </p>
                  <p className="text-[0.8rem] text-ink-3">
                    Expires {String(card.expiryMonth).padStart(2, '0')}/
                    {String(card.expiryYear).slice(-2)}
                    {card.issuingCountry
                      ? ` · ${flag(card.issuingCountry)} ${countryName(card.issuingCountry)}`
                      : ''}
                  </p>
                </div>
                {card.isDefault && (
                  <span className="rounded-full bg-accent/12 px-2 py-0.5 text-[0.72rem] font-bold text-accent-text">
                    Default
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-1 border-t border-hairline pt-2">
                {!card.isDefault && (
                  <Button size="sm" variant="ghost" onClick={() => makeDefault.mutate(card.id)}>
                    <Star className="size-3.5" /> Make default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-error hover:text-error"
                  onClick={() => {
                    if (confirm('Remove this card?')) remove.mutate(card.id);
                  }}
                >
                  <Trash2 className="size-3.5" /> Remove
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      <p className="mt-8 flex items-center gap-2 text-[0.85rem] text-ink-3">
        <ShieldCheck className="size-4" /> Cards are verified by your bank (3-D Secure) on their
        first payment.
      </p>
    </div>
  );
}
