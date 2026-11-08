import { LaunchProvider } from '@/lib/launch-context';
import { SiteFooter } from './site-footer';
import { SiteNav } from './site-nav';

export function SimplePage({ children }: { children: React.ReactNode }) {
  return (
    <LaunchProvider>
      <SiteNav />
      <main className="container-x min-h-[70vh] pt-32 pb-24">{children}</main>
      <SiteFooter />
    </LaunchProvider>
  );
}
