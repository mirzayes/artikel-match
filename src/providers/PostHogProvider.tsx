'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { PostHogConfig } from 'posthog-js';
import { PostHogProvider as PostHogReactProvider } from 'posthog-js/react';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '').trim() || 'https://eu.i.posthog.com';

const posthogOptions = {
  api_host: POSTHOG_HOST,
  capture_pageview: true,
  /** Surveys + Site Apps üçün (SDK + PostHog UI). */
  opt_in_site_apps: true,
  disable_session_recording: false,
  /** PostHog konsolda recording aktiv olmalıdır; SDK tərəfində recorder qoşulur. */
  session_recording: true as unknown as PostHogConfig['session_recording'],
} as const satisfies Partial<PostHogConfig>;

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
 * Bu layihə **Vite** ilə işləyir; provayder `src/main.tsx`-də bükülüb (`layout.tsx` yoxdur).
 * Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (Vite üçün `vite.config` `define` + `loadEnv`).
 */
export function PostHogProvider({ children }: Props) {
  const [clientReady, setClientReady] = useState(false);

  useEffect(() => {
    setClientReady(true);
  }, []);

  if (typeof window === 'undefined' || !POSTHOG_KEY || !clientReady) {
    return <>{children}</>;
  }

  return (
    <PostHogReactProvider apiKey={POSTHOG_KEY} options={posthogOptions}>
      {children}
    </PostHogReactProvider>
  );
}
