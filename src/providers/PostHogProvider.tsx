import { useEffect, type ReactNode } from 'react';
import posthog from 'posthog-js';
import { PostHogProvider as PostHogReactProvider } from 'posthog-js/react';

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? '';
const POSTHOG_HOST = (process.env.NEXT_PUBLIC_POSTHOG_HOST ?? '').trim() || 'https://eu.i.posthog.com';

function capturePageView() {
  posthog.capture('$pageview', {
    $current_url: window.location.href,
  });
}

/**
 * History / SPA: capture manual $pageview on navigation (pushState, replaceState, popstate, hashchange).
 */
function PostHogRouteCapture() {
  useEffect(() => {
    const origPush = history.pushState.bind(history);
    const origReplace = history.replaceState.bind(history);

    history.pushState = (...args: Parameters<History['pushState']>) => {
      const ret = origPush(...args);
      queueMicrotask(capturePageView);
      return ret;
    };
    history.replaceState = (...args: Parameters<History['replaceState']>) => {
      const ret = origReplace(...args);
      queueMicrotask(capturePageView);
      return ret;
    };

    window.addEventListener('popstate', capturePageView);
    window.addEventListener('hashchange', capturePageView);

    return () => {
      window.removeEventListener('popstate', capturePageView);
      window.removeEventListener('hashchange', capturePageView);
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  return null;
}

type Props = { children: ReactNode };

/**
 * PostHog (EU by default). Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` (injected at build via Vite).
 * This app is Vite + React (no Next.js `layout.tsx`); wrap the root in `main.tsx`.
 */
export function PostHogProvider({ children }: Props) {
  if (!POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PostHogReactProvider
      apiKey={POSTHOG_KEY}
      options={{
        api_host: POSTHOG_HOST,
        disable_session_recording: false,
        session_recording: {},
        capture_pageview: false,
        loaded: (client) => {
          client.capture('$pageview', { $current_url: window.location.href });
        },
      }}
    >
      <PostHogRouteCapture />
      {children}
    </PostHogReactProvider>
  );
}
