import clsx from 'clsx';
import { Reveal, RevealWords } from '@/components/ui/reveal';
import { ScrambleText } from '@/components/ui/text-effects';

export function SectionHeading({
  eyebrow,
  title,
  aside,
  className,
}: {
  eyebrow: string;
  title: string;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx('flex flex-col gap-6 md:flex-row md:items-end md:justify-between', className)}
    >
      <div>
        <Reveal>
          <ScrambleText as="p" text={eyebrow} className="eyebrow" />
        </Reveal>
        <RevealWords text={title} className="heading mt-3 max-w-[20ch] text-ink" />
      </div>
      {aside && (
        <Reveal delay={0.2} className="max-w-[22rem] text-[0.95rem] leading-relaxed text-ink-2">
          {aside}
        </Reveal>
      )}
    </div>
  );
}
