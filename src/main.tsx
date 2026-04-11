import { StrictMode, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import { AppErrorBoundary } from './AppErrorBoundary';
import { VocabularyProvider } from './context/VocabularyContext';
import { GlossLanguageProvider } from './context/GlossLanguageContext';
import './i18n';
import './index.css';
import { initAppUpdatesBroadcast } from './lib/appUpdatesChannel';
import { registerSW } from 'virtual:pwa-register';
import { InstallBanner } from './components/InstallBanner';

initAppUpdatesBroadcast();

registerSW({ immediate: true });

const LEXICON_PERSIST_KEY = 'de-lexicon-rq-v1';
const LEXICON_PERSIST_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 14;

const idbStringStorage = {
  getItem: async (key: string) => (await get<string>(key)) ?? null,
  setItem: async (key: string, value: string) => {
    await set(key, value);
  },
  removeItem: async (key: string) => {
    await del(key);
  },
};

function Root() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const persister = useMemo(
    () =>
      createAsyncStoragePersister({
        storage: idbStringStorage,
        key: LEXICON_PERSIST_KEY,
      }),
    [],
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: LEXICON_PERSIST_MAX_AGE_MS,
        dehydrateOptions: {
          shouldDehydrateQuery: (query) => query.queryKey[0] === 'lexicon',
        },
      }}
    >
      <VocabularyProvider>
        <GlossLanguageProvider>
          <>
            <App />
            <Analytics mode={import.meta.env.DEV ? 'development' : 'production'} />
            <InstallBanner />
          </>
        </GlossLanguageProvider>
      </VocabularyProvider>
    </PersistQueryClientProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <StrictMode>
      <Root />
    </StrictMode>
  </AppErrorBoundary>,
);
