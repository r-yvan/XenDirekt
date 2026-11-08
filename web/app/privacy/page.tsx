import type { Metadata } from 'next';
import { SimplePage } from '@/components/site/simple-page';
import { RevealWords } from '@/components/ui/reveal';
import { ScrambleText } from '@/components/ui/text-effects';

export const metadata: Metadata = { title: 'Privacy notice' };

const SECTIONS: [string, string][] = [
  [
    'What we collect',
    'If you join the waitlist: your email address, and if you choose to give them, your name, who you are (visitor, sender, Rwandan abroad, receiver), country and the page you joined from. Hustle Check answers are anonymous multiple-choice codes and are never linked to you. Wall of Hustle stories are anonymous and reviewed by a person before anything is shown.',
  ],
  [
    'Why',
    'To tell you about XenDirekt’s launch and your early access, and to understand how hard it is to pay into Rwanda today.',
  ],
  [
    'What we don’t do',
    'We don’t sell your details, add tracking pixels to emails, or store your IP address with your entry.',
  ],
  [
    'How long',
    'Until launch, or until you leave. Every email has a link to leave the list, which deletes your entry immediately. You can also email hello@xendirekt.rw.',
  ],
  [
    'The portal',
    'If you sign in to the XenDirekt portal, your account is handled under the Terms of Service and Privacy Policy you accept during sign-up.',
  ],
];

export default function PrivacyPage() {
  return (
    <SimplePage>
      <article className="mx-auto max-w-[720px]">
        <ScrambleText as="p" trigger="mount" text="Privacy notice · waitlist" className="eyebrow" />
        <RevealWords
          as="h1"
          trigger="mount"
          text="Your details, plainly."
          className="display mt-3 text-ink"
        />
        <p className="lead mt-5">
          XenDirekt is in development in Kigali, Rwanda. This notice covers this website: the
          waitlist, the Hustle Check and the Wall of Hustle.
        </p>
        <div className="mt-12 divide-y divide-hairline border-y border-hairline">
          {SECTIONS.map(([title, body]) => (
            <section key={title} className="grid gap-3 py-7 md:grid-cols-[200px_1fr]">
              <h2 className="text-[1.05rem] font-bold tracking-[-0.046em] text-ink">{title}</h2>
              <p className="leading-relaxed text-ink-2">{body}</p>
            </section>
          ))}
        </div>
      </article>
    </SimplePage>
  );
}
