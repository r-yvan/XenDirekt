'use client';

import { Lock } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { CodeInput } from '@/components/auth/code-input';
import { Spinner } from '@/components/ui/spinner';
import { ApiError, api } from '@/lib/api';

type Purpose = 'PAYMENT' | 'CHANGE_PIN' | 'DELETE_ACCOUNT';

/**
 * Asks for the PIN and exchanges it for a single-use, 2-minute step-up token (POST
 * /v1/auth/step-up). The token goes straight into the protected call.
 */
export function PinDialog(props: {
  open: boolean;
  purpose: Purpose;
  title: string;
  detail?: React.ReactNode;
  onClose: () => void;
  onGranted: (stepUpToken: string) => Promise<void>;
}) {
  // The panel mounts fresh each time it opens, so no state carries over between attempts.
  return <AnimatePresence>{props.open && <PinPanel key="pin" {...props} />}</AnimatePresence>;
}

function PinPanel({
  purpose,
  title,
  detail,
  onClose,
  onGranted,
}: {
  purpose: Purpose;
  title: string;
  detail?: React.ReactNode;
  onClose: () => void;
  onGranted: (stepUpToken: string) => Promise<void>;
}) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && !busy && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose]);

  async function submit(value: string) {
    setBusy(true);
    setError(null);
    try {
      const grant = await api<{ stepUpToken: string }>('v1/auth/step-up', {
        method: 'POST',
        body: { purpose, method: 'PIN', pin: value },
      });
      await onGranted(grant.stepUpToken);
    } catch (failure) {
      setError(failure instanceof ApiError ? failure.message : 'Something went wrong.');
      setPin('');
      setBusy(false);
    }
  }

  return (
    <motion.div
      className="fixed inset-0 z-50 grid place-items-end bg-black/50 backdrop-blur-sm sm:place-items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => !busy && onClose()}
    >
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pin-title"
        onClick={(event) => event.stopPropagation()}
        initial={{ y: 40, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 30, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        className="w-full max-w-[440px] rounded-t-[24px] border border-hairline bg-surface-1 p-6 sm:rounded-[24px]"
      >
        <span className="grid size-11 place-items-center rounded-full bg-accent/14 text-accent-text">
          <Lock className="size-5" />
        </span>
        <h2 id="pin-title" className="mt-4 text-[1.5rem] font-bold tracking-[-0.066em] text-ink">
          {title}
        </h2>
        {detail && <div className="mt-1 text-[0.95rem] text-ink-2">{detail}</div>}
        <div className="mt-6">
          <CodeInput
            label="PIN"
            secret
            value={pin}
            onChange={setPin}
            onComplete={submit}
            disabled={busy}
            error={Boolean(error)}
          />
        </div>
        <div className="mt-4 flex min-h-6 items-center justify-between">
          {busy ? (
            <span className="flex items-center gap-2 text-[0.9rem] text-ink-2">
              <Spinner className="size-4" /> Confirming…
            </span>
          ) : error ? (
            <p role="alert" className="text-[0.9rem] font-medium text-error">
              {error}
            </p>
          ) : (
            <span />
          )}
          <button
            className="text-[0.9rem] font-medium text-ink-2 hover:text-ink"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
