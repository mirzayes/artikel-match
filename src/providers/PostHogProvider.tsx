'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { PostHogConfig } from 'posthog-js';
import { PostHogProvider as PostHogReactProvider } from 'posthog-js/react';

/** `define` (build) + `import.meta.env` (.env + envPrefix). */
function getPosthogKey(): string {
  const fromMeta = `${import.meta.env.NEXT_PUBLIC_POSTHOG_KEY ?? ''}`.trim();
  if (fromMeta) return fromMeta;
  return `${process.env.NEXT_PUBLIC_POSTHOG_KEY ?? ''}`.trim();
}

function getPosthogHost(): string {
  const fromMeta = `${import.meta.env.NEXT_PUBLIC_POSTHOG_HOST ?? ''}`.trim();
  if (fromMeta) return fromMeta;
  const fromProc = `${process.env.NEXT_PUBLIC_POSTHOG_HOST ?? ''}`.trim();
  return fromProc || 'https://eu.i.posthog.com';
}

function buildPosthogOptions(host: string): Partial<PostHogConfig> {
  return {
    api_host: host,
    capture_pageview: true,
    opt_in_site_apps: true,
    disable_session_recording: false,
    session_recording: true as unknown as PostHogConfig['session_recording'],
  };
}

type Props = { children: ReactNode };

/**
 * PostHog (`posthog-js` + `posthog-js/react`).
 *
 * **Next.js App Router** — `app/layout.tsx` içində:
 * ```tsx
 * import { PostHogProvider } from '@/providers/PostHogProvider';
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html lang="en">
 *       <body><PostHogProvider>{children}</PostHogProvider></body>
 *     </html>
 *   );
 * }
 * ```
 *
 * Bu layihə **Vite** ilə işləyir; provayder `src/main.tsx`-də bükülüb.
 * `src/app/layout.tsx` — yalnız izah faylıdır (Next App Router burada yoxdur).
 * Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` — `.env` + Vercel build `process.env` (`vite.config` `define`).
 */
export function PostHogProvider({ children }: Props) {
  const [clientReady, setClientReady] = useState(false);
  const posthogKey = useMemo(() => getPosthogKey(), []);
  const posthogHost = useMemo(() => getPosthogHost(), []);
  const posthogOptions = useMemo(() => buildPosthogOptions(posthogHost), [posthogHost]);

  useEffect(() => {
    setClientReady(true);
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV || typeof window === 'undefined') return;
    if (posthogKey) return;
    console.warn(
      '[PostHog] NEXT_PUBLIC_POSTHOG_KEY boşdur — .env və ya Vercel Environment Variables əlavə edin və dev serveri yenidən işə salın.',
    );
  }, [posthogKey]);

  if (typeof window === 'undefined' || !posthogKey || !clientReady) {
    return <>{children}</>;
  }

  return (
    <PostHogReactProvider apiKey={posthogKey} options={posthogOptions}>
      {children}
    </PostHogReactProvider>
  );
}
