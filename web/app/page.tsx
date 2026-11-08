import { BothSides } from '@/components/site/both-sides';
import { ClassifiedFiles } from '@/components/site/classified-files';
import { Faq } from '@/components/site/faq';
import { FinalCta } from '@/components/site/final-cta';
import { Hero } from '@/components/site/hero';
import { HustleCheck } from '@/components/site/hustle-check';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteNav } from '@/components/site/site-nav';
import { TwoHustles } from '@/components/site/two-hustles';
import { Wall } from '@/components/site/wall';
import { LaunchProvider } from '@/lib/launch-context';

export default function HomePage() {
  return (
    <LaunchProvider>
      <SiteNav />
      {/* Clip, not hidden: glows may bleed past the viewport without making the page scroll
          sideways, and clip (unlike hidden) keeps sticky columns working. */}
      <main className="overflow-x-clip">
        <Hero />
        <TwoHustles />
        <ClassifiedFiles />
        <HustleCheck />
        <BothSides />
        <Wall />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </LaunchProvider>
  );
}
