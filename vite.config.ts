import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * workbox-build bundles `sw.js` with its own Rollup pipeline and always adds
 * `@rollup/plugin-terser` when `mode` is `production`. In low-RAM / sandboxed
 * CI that step can fail with "Unexpected early exit" from unfinished Terser hooks.
 *
 * - Default: skip SW Terser (`development`) + no SW sourcemaps → stable builds.
 * - Opt in to a smaller `sw.js`: `VITE_PWA_MINIFY_SW=1 npm run build` (needs enough Node heap).
 */
const workboxBundleMode =
  process.env.VITE_PWA_MINIFY_SW === '1' || process.env.VITE_PWA_MINIFY_SW === 'true'
    ? 'production'
    : 'development';

export default defineConfig(() => {
  /** `@vercel/analytics` reads `REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG`; Vercel injects the Vite-prefixed var at build. */
  const vercelObservabilityClientConfig =
    process.env.VITE_VERCEL_OBSERVABILITY_CLIENT_CONFIG ??
    process.env.VERCEL_OBSERVABILITY_CLIENT_CONFIG ??
    '';

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'Artikel Match',
          short_name: 'AM',
          description: 'Artikel Match — der, die, das.',
          start_url: '/',
          scope: '/',
          display: 'standalone',
          orientation: 'portrait-primary',
          theme_color: '#ffffff',
          background_color: '#0a0a0f',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          mode: workboxBundleMode,
          sourcemap: false,
          navigateFallback: '/index.html',
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,json,webmanifest}'],
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) =>
                request.method === 'GET' && /\.json(\?.*)?$/i.test(url.pathname),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'artikel-json',
                expiration: {
                  maxEntries: 48,
                  maxAgeSeconds: 60 * 60 * 24 * 30,
                },
              },
            },
            {
              urlPattern: ({ url, request }) =>
                request.method === 'GET' && url.hostname.includes('supabase'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'artikel-supabase',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
            {
              urlPattern: ({ url, request }) =>
                request.method === 'GET' &&
                (url.hostname.includes('firebaseio.com') ||
                  url.hostname.includes('firebasedatabase.app') ||
                  url.hostname.includes('googleapis.com')),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'artikel-firebase-google',
                expiration: {
                  maxEntries: 80,
                  maxAgeSeconds: 60 * 60 * 24 * 7,
                },
              },
            },
            {
              urlPattern: ({ request, url }) =>
                request.method === 'GET' &&
                /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i.test(url.href),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'artikel-fonts',
                expiration: {
                  maxEntries: 12,
                  maxAgeSeconds: 60 * 60 * 24 * 365,
                },
              },
            },
          ],
        },
      }),
    ],
    define: {
      'process.env.REACT_APP_VERCEL_OBSERVABILITY_CLIENT_CONFIG':
        JSON.stringify(vercelObservabilityClientConfig),
    },
    build: {
      minify: 'esbuild',
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('@tanstack/react-query') || id.includes('@tanstack/query-core')) {
              return 'vendor-tanstack-query';
            }
            if (id.includes('@tanstack/react-virtual') || id.includes('@tanstack/virtual-core')) {
              return 'vendor-tanstack-virtual';
            }
          },
        },
      },
    },
    server: {
      /** Слушать 0.0.0.0 — открывается и как localhost, и по LAN (телефон в той же Wi‑Fi) */
      host: true,
      port: 5173,
      strictPort: false,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  };
});
