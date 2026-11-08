'use client';

import { KeyRound, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CodeInput } from '@/components/auth/code-input';
import { PinDialog } from '@/components/portal/pin-dialog';
import { PageTitle } from '@/components/portal/shell';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { ApiError, api } from '@/lib/api';
import { countryName, flag } from '@/lib/format';
import { signOut, useProfile } from '@/lib/session';

export default function SettingsPage() {
  const router = useRouter();
  const me = useProfile();
  const [pinOpen, setPinOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [newPin, setNewPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const p = me.data;
  if (!p) return null;

  async function changePin(pin: string) {
    try {
      await api('v1/me/pin/change', {
        method: 'POST',
        headers: { 'X-Step-Up-Token': token! },
        body: { pin },
      });
      setMessage('PIN changed. Other devices have been signed out.');
    } catch (failure) {
      setMessage(failure instanceof ApiError ? failure.message : 'Couldn’t change the PIN.');
    }
    setToken(null);
    setNewPin('');
  }

  const rows: [string, string][] = [
    ['Name', p.fullName ?? ''],
    ['Email', p.email ?? ''],
    [
      'Country',
      p.countryOfResidence
        ? `${flag(p.countryOfResidence)} ${countryName(p.countryOfResidence)}`
        : '',
    ],
    ['Date of birth', p.dateOfBirth ?? ''],
  ];

  return (
    <div className="max-w-[720px]">
      <PageTitle title="Settings" />
      <section className="card divide-y divide-hairline">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-5 py-4 text-[0.95rem]">
            <span className="text-ink-3">{k}</span>
            <span className="font-medium text-ink">{v}</span>
          </div>
        ))}
        <p className="px-5 py-3 text-[0.8rem] text-ink-3">
          To change your name, country or date of birth, contact support.
        </p>
      </section>
      <section className="card mt-5 flex items-center justify-between gap-4 p-5">
        <div>
          <p className="font-bold tracking-[-0.032em] text-ink">Appearance</p>
          <p className="text-[0.85rem] text-ink-3">Follows your system unless you choose.</p>
        </div>
        <ThemeToggle />
      </section>
      <section className="card mt-5 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-bold tracking-[-0.032em] text-ink">PIN</p>
            <p className="text-[0.85rem] text-ink-3">Used to confirm every payment.</p>
          </div>
          {!token && (
            <Button variant="secondary" onClick={() => setPinOpen(true)}>
              <KeyRound className="size-4" /> Change PIN
            </Button>
          )}
        </div>
        {token && (
          <div className="mt-5">
            <p className="mb-3 text-[0.9rem] text-ink-2">Enter your new 6-digit PIN</p>
            <CodeInput
              label="New PIN"
              secret
              value={newPin}
              onChange={setNewPin}
              onComplete={changePin}
            />
          </div>
        )}
        {message && <p className="mt-3 text-[0.9rem] text-ink-2">{message}</p>}
      </section>
      <Button
        variant="danger"
        className="mt-8"
        onClick={async () => {
          await signOut();
          router.replace('/sign-in');
        }}
      >
        <LogOut className="size-4" /> Sign out
      </Button>
      <PinDialog
        open={pinOpen}
        purpose="CHANGE_PIN"
        title="Enter your current PIN"
        onClose={() => setPinOpen(false)}
        onGranted={async (t) => {
          setToken(t);
          setPinOpen(false);
        }}
      />
    </div>
  );
}
