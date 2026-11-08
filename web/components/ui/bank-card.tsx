import clsx from 'clsx';

export type CardBrand = 'VISA' | 'MASTERCARD' | 'DEBIT';

const FINISH: Record<CardBrand, { base: string; ink: string; edge: string }> = {
  // Deep issuer blue, graphite, and brushed silver.
  VISA: {
    base: 'linear-gradient(135deg, #2346c9 0%, #1631a0 38%, #0b1d6b 100%)',
    ink: 'text-white',
    edge: 'ring-white/15',
  },
  MASTERCARD: {
    base: 'linear-gradient(135deg, #3a3a40 0%, #1f1f23 45%, #0c0c0e 100%)',
    ink: 'text-white',
    edge: 'ring-white/10',
  },
  DEBIT: {
    base: 'linear-gradient(135deg, #f1f1f3 0%, #c9c9cf 45%, #9d9da6 100%)',
    ink: 'text-[#16161a]',
    edge: 'ring-black/10',
  },
};

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.55'/%3E%3C/svg%3E\")";

/**
 * A realistic payment card (ISO ID-1 proportions): EMV chip, contactless mark, embossed number,
 * holder and expiry, brand mark, soft sheen and grain. Typography scales with the card width.
 */
export function BankCard({
  brand,
  last4,
  holder = 'ANA SILVA',
  expiry = '12/29',
  tone = 'brand',
  className,
}: {
  brand: CardBrand | string;
  /** `mono`: graphite greys only (website illustrations). */
  tone?: 'brand' | 'mono';
  last4: string;
  holder?: string;
  expiry?: string;
  className?: string;
}) {
  const kind: CardBrand = brand === 'VISA' || brand === 'MASTERCARD' ? brand : 'DEBIT';
  const finish =
    tone === 'mono'
      ? {
          base: 'linear-gradient(135deg, #6a6a70 0%, #3a3a3f 40%, #19191c 100%)',
          ink: 'text-white',
          edge: 'ring-white/15',
        }
      : FINISH[kind];
  return (
    <div
      className={clsx(
        'relative aspect-[1.586] overflow-hidden rounded-[14px] shadow-[0_18px_40px_-18px_rgb(0_0_0/0.6)] ring-1 ring-inset select-none',
        finish.ink,
        finish.edge,
        className,
      )}
      style={{ background: finish.base, containerType: 'inline-size' }}
      aria-label={`${kind === 'DEBIT' ? 'Debit' : kind === 'VISA' ? 'Visa' : 'Mastercard'} card ending ${last4}`}
      role="img"
    >
      {/* Sheen, guilloche-like arcs and grain. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 80% at 15% 0%, rgb(255 255 255 / 0.28), transparent 55%), radial-gradient(90% 70% at 100% 100%, rgb(0 0 0 / 0.25), transparent 60%)',
        }}
      />
      <svg aria-hidden className="absolute inset-0 size-full opacity-[0.09]" viewBox="0 0 320 202">
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx="300" cy="-20" r={70 + i * 22} fill="none" stroke="currentColor" />
        ))}
      </svg>
      <div
        aria-hidden
        className="absolute inset-0 mix-blend-overlay opacity-40"
        style={{ backgroundImage: GRAIN }}
      />

      <div className="relative flex h-full flex-col justify-between p-[6.5cqw]">
        <div className="flex items-start justify-between">
          <span className={tone === 'mono' ? 'grayscale' : undefined}>
            <Chip />
          </span>
          <Contactless />
        </div>
        <div>
          <p
            className="font-mono text-[6.4cqw] tracking-[0.08em] whitespace-nowrap"
            style={{
              textShadow:
                kind === 'DEBIT'
                  ? '0 1px 0 rgb(255 255 255 / 0.6), 0 -1px 0 rgb(0 0 0 / 0.25)'
                  : '0 1px 0 rgb(0 0 0 / 0.45), 0 -1px 0 rgb(255 255 255 / 0.2)',
            }}
          >
            ••••&nbsp;••••&nbsp;••••&nbsp;{last4}
          </p>
          <div className="mt-[3cqw] flex items-end justify-between gap-[3cqw]">
            <div className="flex gap-[6cqw] font-mono text-[3.2cqw] uppercase opacity-85">
              <span className="truncate">{holder}</span>
              <span className="whitespace-nowrap">
                <span className="mr-[1.5cqw] text-[2.2cqw] opacity-70">VALID THRU</span>
                {expiry}
              </span>
            </div>
            <BrandMark kind={kind} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip() {
  return (
    <svg viewBox="0 0 50 38" className="w-[14cqw]" aria-hidden>
      <defs>
        <linearGradient id="chip-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f4dea0" />
          <stop offset="0.5" stopColor="#c9a24f" />
          <stop offset="1" stopColor="#e8cd85" />
        </linearGradient>
      </defs>
      <rect
        x="0.5"
        y="0.5"
        width="49"
        height="37"
        rx="6"
        fill="url(#chip-gold)"
        stroke="#8a6a26"
        strokeOpacity="0.5"
      />
      <path
        d="M0 13h16M0 25h16M34 13h16M34 25h16M16 0v38M34 0v38M16 19h18"
        stroke="#7a5b1e"
        strokeOpacity="0.55"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}

function Contactless() {
  return (
    <svg viewBox="0 0 24 24" className="w-[7cqw] opacity-80" aria-hidden>
      {[5, 9, 13].map((r, i) => (
        <path
          key={r}
          d={`M${6 + i * 3.6} ${12 - r * 0.62}a${r} ${r} 0 0 1 0 ${r * 1.24}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function BrandMark({ kind }: { kind: CardBrand }) {
  if (kind === 'VISA') {
    return (
      <span className="text-[9.5cqw] leading-none font-black tracking-[-0.02em] italic">VISA</span>
    );
  }
  if (kind === 'MASTERCARD') {
    return (
      <svg viewBox="0 0 48 30" className="w-[16cqw]" aria-hidden>
        <circle cx="17" cy="15" r="13" fill="#EB001B" />
        <circle cx="31" cy="15" r="13" fill="#F79E1B" />
        <path d="M24 4.1a13 13 0 0 1 0 21.8a13 13 0 0 1 0-21.8z" fill="#FF5F00" />
      </svg>
    );
  }
  return (
    <span className="text-[4.2cqw] leading-none font-bold tracking-[0.12em] uppercase opacity-80">
      Debit
    </span>
  );
}
