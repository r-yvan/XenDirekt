import Link from 'next/link';
import { Logo } from '@/components/ui/logo';

export function SiteFooter() {
  return (
    <footer className="border-t border-hairline py-14">
      <div className="container-x grid gap-10 md:grid-cols-[1.4fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-[38rem] text-[0.9rem] leading-relaxed text-ink-2">
            XenDirekt is in development and does not offer money transfers yet. Answers are used
            anonymously to understand the problem; contact details are only used to tell you about
            the launch, and you can ask us to delete them at any time.
          </p>
        </div>
        <div className="flex flex-col gap-2.5 text-[0.9rem] md:items-end">
          <Link href="/privacy" className="text-accent-text underline-offset-4 hover:underline">
            Privacy notice
          </Link>
          <a
            href="mailto:hello@xendirekt.rw"
            className="text-accent-text underline-offset-4 hover:underline"
          >
            Contact us
          </a>
          <Link href="/sign-in" className="text-ink-2 hover:text-ink">
            Sign in to the portal
          </Link>
          <p className="mt-2 text-ink-3">© {new Date().getFullYear()} XenDirekt · Kigali, Rwanda</p>
        </div>
      </div>
    </footer>
  );
}
