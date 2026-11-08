import clsx from 'clsx';

/**
 * Sharp, adjacent tiles that share 1px lines. The grid draws its top and left edges and every
 * tile draws its right and bottom edges, so lines never double up at any column count, and
 * they draw themselves in as tiles reveal.
 */
export const TILE = 'border-r border-b border-hairline-strong';

export function TileGrid({
  className,
  children,
  marks = true,
}: {
  className?: string;
  children: React.ReactNode;
  /** Small crosshairs on the four outer corners. */
  marks?: boolean;
}) {
  return (
    <div className={clsx('relative grid border-t border-l border-hairline-strong', className)}>
      {marks && (
        <>
          <Crosshair className="-top-[5px] -left-[5px]" />
          <Crosshair className="-top-[5px] -right-[5px]" />
          <Crosshair className="-bottom-[5px] -left-[5px]" />
          <Crosshair className="-right-[5px] -bottom-[5px]" />
        </>
      )}
      {children}
    </div>
  );
}

function Crosshair({ className }: { className: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 11 11"
      className={clsx('pointer-events-none absolute z-10 size-[11px] text-ink-3', className)}
    >
      <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
