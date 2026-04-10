import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import { AppErrorBoundary } from './AppErrorBoundary';
import { VocabularyProvider } from './context/VocabularyContext';
import { GlossLanguageProvider } from './context/GlossLanguageContext';
import './i18n';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <StrictMode>
      <VocabularyProvider>
        <GlossLanguageProvider>
          <>
            <App />
            <Analytics />
          </>
        </GlossLanguageProvider>
      </VocabularyProvider>
    </StrictMode>
  </AppErrorBoundary>,
);
