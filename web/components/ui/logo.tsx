import Link from 'next/link';

/** The XenDirekt mark: two interlocking chevrons. Orange sends, the ink chevron receives. */
export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden className={className}>
      <polygon points="25.4,15.2 54.2,44.2 16.7,80.8 35.8,44.4 25.4,33.8" fill="#FF640A" />
      <polygon points="83.1,18.8 45.8,55.8 74.6,84.6 74.6,66.3 64.2,55.8" fill="currentColor" />
    </svg>
  );
}

export function Logo({ href = '/', compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 text-ink"
      aria-label="XenDirekt home"
    >
      <LogoMark
        size={30}
        className="transition-transform duration-500 ease-[var(--ease-spring)] group-hover:rotate-[8deg]"
      />
      {!compact && <span className="text-[1.2rem] font-bold tracking-[-0.06em]">XenDirekt</span>}
    </Link>
  );
}
