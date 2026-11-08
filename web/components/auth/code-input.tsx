'use client';

import clsx from 'clsx';
import { motion } from 'motion/react';
import { useEffect, useRef } from 'react';

/** Six boxes backed by one real input: paste, autofill (one-time-code) and screen readers work. */
export function CodeInput({
  value,
  onChange,
  onComplete,
  length = 6,
  secret = false,
  disabled,
  error,
  label,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete: (value: string) => void;
  length?: number;
  secret?: boolean;
  disabled?: boolean;
  error?: boolean;
  label: string;
  autoFocus?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) input.current?.focus();
  }, [autoFocus, disabled]);
  return (
    <motion.div
      className="relative"
      animate={error ? { x: [0, -8, 8, -5, 5, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      onClick={() => input.current?.focus()}
    >
      <input
        ref={input}
        aria-label={label}
        value={value}
        disabled={disabled}
        inputMode="numeric"
        autoComplete={secret ? 'off' : 'one-time-code'}
        maxLength={length}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '').slice(0, length);
          onChange(next);
          if (next.length === length) onComplete(next);
        }}
        className="absolute inset-0 z-10 opacity-0"
      />
      <div className="flex gap-2" aria-hidden>
        {Array.from({ length }).map((_, index) => {
          const char = value[index];
          const active = index === value.length && !disabled;
          return (
            <div
              key={index}
              className={clsx(
                'grid h-16 flex-1 place-items-center rounded-[14px] border bg-surface-1 text-[1.6rem] font-bold tracking-[-0.032em] text-ink transition-[border-color,box-shadow] duration-200 tnum',
                error
                  ? 'border-error'
                  : active
                    ? 'border-accent shadow-[0_0_0_4px_rgb(255_100_10/0.14)]'
                    : char
                      ? 'border-hairline-strong'
                      : 'border-hairline',
              )}
            >
              {char ? (
                <motion.span
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                >
                  {secret ? <span className="block size-3 rounded-full bg-ink" /> : char}
                </motion.span>
              ) : active ? (
                <span className="h-7 w-0.5 animate-pulse bg-accent" />
              ) : null}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
