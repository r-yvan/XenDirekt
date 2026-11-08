'use client';

import clsx from 'clsx';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Check, PenLine, Quote } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Reveal } from '@/components/ui/reveal';
import { TILE, TileGrid } from '@/components/ui/tiles';
import { ApiError, api } from '@/lib/api';
import { countryName, flag } from '@/lib/format';
import { useLaunch } from '@/lib/launch-context';
import type { Story } from '@/lib/types';
import { SectionHeading } from './section-heading';

const COUNTRIES = ['', 'BE', 'CA', 'DE', 'FR', 'GB', 'KE', 'NL', 'RW', 'UG', 'US', 'TZ', 'ZA'];

function StoryCard({ story }: { story: Story }) {
  return (
    <figure className="w-[min(380px,80vw)] shrink-0 border-r border-hairline-strong bg-tile p-8 transition-colors duration-500 hover:bg-tile-hover">
      <Quote className="size-5 text-accent-text" />
      <blockquote className="mt-3 text-[1.05rem] leading-[1.45] tracking-[-0.032em] text-ink">
        {story.body}
      </blockquote>
      <figcaption className="mono mt-4 text-[0.72rem] text-ink-3">
        — Anonymous
        {story.countryCode ? ` · ${flag(story.countryCode)} ${countryName(story.countryCode)}` : ''}
      </figcaption>
    </figure>
  );
}

export function Wall() {
  const { persona } = useLaunch();
  const stories = useQuery({
    queryKey: ['stories'],
    queryFn: () => api<{ stories: Story[] }>('v1/launch/stories?limit=20'),
  });
  const [body, setBody] = useState('');
  const [country, setCountry] = useState('');
  const submit = useMutation({
    mutationFn: () =>
      api('v1/launch/stories', {
        method: 'POST',
        body: {
          body: body.trim(),
          countryCode: country || undefined,
          persona: persona ?? undefined,
        },
      }),
    onSuccess: () => setBody(''),
  });
  const list = stories.data?.stories ?? [];
  const tooShort = body.trim().length < 20;

  return (
    <section id="wall" className="scroll-mt-20 border-t border-hairline py-24 sm:py-32">
      <div className="container-x">
        <SectionHeading
          eyebrow="The Wall of Hustle"
          title="What’s your worst [money-sending story?]"
        />
      </div>
      <div className="mt-12">
        {list.length > 0 ? (
          <div className="group relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
            <div className="flex w-max border-y border-hairline-strong [animation:xd-marquee_60s_linear_infinite] group-hover:[animation-play-state:paused]">
              {[...list, ...list].map((story, index) => (
                <StoryCard key={`${story.id}-${index}`} story={story} />
              ))}
            </div>
          </div>
        ) : (
          <div className="container-x">
            <TileGrid className="md:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <Reveal key={index} delay={index * 0.08} className={clsx(TILE, 'bg-tile p-8')}>
                  <div className="space-y-3">
                    <div className="h-2.5 w-[85%] bg-surface-3" />
                    <div className="h-2.5 w-[70%] bg-surface-3" />
                    <div className="h-2.5 w-[40%] bg-surface-3" />
                  </div>
                  <p className="mt-5 text-[0.88rem] text-ink-3">
                    {index === 1
                      ? 'Stories appear here once we’ve read them. Yours could be first.'
                      : stories.isLoading
                        ? 'Loading stories…'
                        : 'A visitor’s story, coming soon.'}
                  </p>
                </Reveal>
              ))}
            </TileGrid>
          </div>
        )}
      </div>
      <div className="container-x mt-12">
        <Reveal className="max-w-[760px]">
          <AnimatePresence mode="wait">
            {submit.isSuccess ? (
              <motion.div
                key="thanks"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-start gap-4 border border-hairline-strong bg-tile p-6"
                role="status"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-on-accent">
                  <Check className="size-5" strokeWidth={3} />
                </span>
                <div>
                  <p className="title text-ink">Thank you. We read every one.</p>
                  <p className="mt-1 text-ink-2">
                    Your story goes on the wall once a person has reviewed it. It stays anonymous.
                  </p>
                  <button
                    className="mt-3 text-[0.9rem] font-bold text-accent-text"
                    onClick={() => submit.reset()}
                  >
                    Add another
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.form
                key="form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!tooShort) submit.mutate();
                }}
                exit={{ opacity: 0 }}
              >
                <label
                  htmlFor="story"
                  className="flex items-center gap-2 text-[0.95rem] font-bold tracking-[-0.032em] text-ink"
                >
                  <PenLine className="size-4 text-accent-text" /> Tell us yours (anonymous, we read
                  every one)
                </label>
                <textarea
                  id="story"
                  value={body}
                  maxLength={600}
                  rows={4}
                  onChange={(event) => setBody(event.target.value)}
                  placeholder="The time my money took a week to arrive and…"
                  className="field mt-3 h-auto resize-y rounded-none py-3.5 leading-relaxed"
                />
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <select
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    className="field h-11 w-auto rounded-none pr-8 text-[0.9rem]"
                    aria-label="Where are you based? (optional)"
                  >
                    {COUNTRIES.map((code) => (
                      <option key={code} value={code}>
                        {code ? `${flag(code)} ${countryName(code)}` : 'Country (optional)'}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={tooShort}
                    loading={submit.isPending}
                    shape="sharp"
                    roll
                    className="border-accent/60"
                  >
                    Add to the wall
                  </Button>
                  <span className="mono ml-auto text-[0.72rem] text-ink-3 tnum">
                    {body.length}/600
                  </span>
                </div>
                {submit.isError && (
                  <p role="alert" className="mt-3 text-[0.9rem] font-medium text-error">
                    {submit.error instanceof ApiError
                      ? submit.error.message
                      : 'Couldn’t send that. Try again.'}
                  </p>
                )}
                <p className="mt-3 text-[0.8rem] text-ink-3">
                  Please leave out names, numbers and anything that identifies someone.
                </p>
              </motion.form>
            )}
          </AnimatePresence>
        </Reveal>
      </div>
    </section>
  );
}
