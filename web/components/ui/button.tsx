import clsx from 'clsx';
import Link from 'next/link';
import { forwardRef } from 'react';
import { Spinner } from './spinner';
import { RollText } from './text-effects';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';
type Shape = 'rounded' | 'sharp' | 'pill';

function radius(shape: Shape, size: Size): string {
  if (shape === 'sharp') return 'rounded-none';
  if (shape === 'pill') return 'rounded-full';
  return size === 'lg' ? 'rounded-[14px]' : 'rounded-[12px]';
}

const base =
  'relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-bold tracking-[-0.032em] transition-[background,color,border-color,transform,box-shadow] duration-200 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50';

const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent hover:bg-accent-hover shadow-[inset_0_1px_0_rgb(255_255_255/0.25)]',
  secondary:
    'border border-hairline-strong bg-surface-1 text-ink hover:border-ink-3/60 hover:bg-surface-2',
  ghost: 'text-ink-2 hover:text-ink hover:bg-surface-2',
  danger: 'border border-error/40 text-error hover:bg-error/10',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[0.875rem]',
  md: 'h-11 px-5 text-[0.95rem]',
  lg: 'h-14 px-7 text-[1.05rem]',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  /** Website CTAs: the label rolls up on hover. */
  roll?: boolean;
  /** `sharp` for the website's tile sections: square corners. `pill`: fully rounded. */
  shape?: Shape;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    shape = 'rounded',
    loading,
    roll,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      className={clsx(
        base,
        variants[variant],
        sizes[size],
        radius(shape, size),
        roll && 'group/roll',
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="size-5" /> : roll ? <RollText>{children}</RollText> : children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = 'primary',
  size = 'md',
  className,
  children,
  roll,
  shape = 'rounded',
  ...rest
}: { href: string; variant?: Variant; size?: Size; roll?: boolean; shape?: Shape } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
>) {
  return (
    <Link
      href={href}
      className={clsx(
        base,
        variants[variant],
        sizes[size],
        radius(shape, size),
        roll && 'group/roll',
        className,
      )}
      {...rest}
    >
      {roll ? <RollText>{children}</RollText> : children}
    </Link>
  );
}
