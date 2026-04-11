/**
 * Bu layihə **Vite + React** istifadə edir; Next.js App Router **yoxdur**.
 * Bütün tətbiq `index.html` + `src/main.tsx` ilə yüklənir.
 *
 * **PostHog** kök səviyyədə `src/main.tsx` içində `<PostHogProvider>` ilə bükülüb
 * (`src/providers/PostHogProvider.tsx`).
 *
 * Next.js-ə keçəndə bu faylı `app/layout.tsx` kimi köçürüb belə istifadə edin:
 * ```tsx
 * import { PostHogProvider } from '../providers/PostHogProvider';
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html lang="az">
 *       <body>
 *         <PostHogProvider>{children}</PostHogProvider>
 *       </body>
 *     </html>
 *   );
 * }
 * ```
 */
export {};
