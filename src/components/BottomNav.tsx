import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

export type Tab = 'home' | 'quiz' | 'exam' | 'duel' | 'lexicon';

interface BottomNavProps {
  active: Tab;
  onChange: (t: Tab) => void;
  variant?: 'light' | 'dark';
}

function DarkNavIcon({ tab }: { tab: Tab }) {
  if (tab === 'home') {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        <path
          d="M2 7L8 2L14 7V14H10.5V10H5.5V14H2V7Z"
          stroke="currentColor"
          strokeWidth="1.2"
          fill="none"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tab === 'quiz') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tab === 'exam') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 012-2z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (tab === 'duel') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M14.5 4l2.1 2.1M4 20l4-4M9 9l-5 5M19 9l-4-4M9 9l4 4M5 5l4 4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BottomNav({ active, onChange, variant = 'dark' }: BottomNavProps) {
  const { t } = useTranslation();
  const items: { id: Tab; labelKey: string }[] = [
    { id: 'home', labelKey: 'nav.home' },
    { id: 'quiz', labelKey: 'nav.quiz' },
    { id: 'exam', labelKey: 'nav.exam' },
    { id: 'duel', labelKey: 'nav.duel' },
    { id: 'lexicon', labelKey: 'nav.lexicon' },
  ];

  if (variant === 'dark') {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-[100] bg-gradient-to-t from-[var(--artikl-bg)] from-40% to-transparent pb-[max(0px,env(safe-area-inset-bottom))]">
        <div className="artikl-nav-bar artikl-nav-bar--five">
          {items.map((item) => {
            const on = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={`artikl-ni ${on ? 'artikl-ni-on' : ''}`}
              >
                <span className="artikl-ni-icon">
                  <DarkNavIcon tab={item.id} />
                </span>
                <span>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </nav>
    );
  }

  const shell =
    'border border-stone-200/80 bg-white/85 shadow-lift backdrop-blur-2xl';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="mx-auto flex max-w-lg justify-center">
        <div className={`flex w-full max-w-md items-stretch gap-1 rounded-[24px] p-1.5 ${shell}`}>
          {items.map((item) => {
            const isOn = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className="relative flex flex-1 flex-col items-center gap-0.5 rounded-[18px] py-2 text-[10px] font-semibold transition-colors"
              >
                {isOn ? (
                  <motion.div
                    layoutId="nav-pill-light"
                    className="absolute inset-0 rounded-[18px] bg-stone-900 shadow-md shadow-stone-900/25"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  />
                ) : null}
                <span className={`relative z-10 ${isOn ? 'text-white' : 'text-stone-400'}`} aria-hidden>
                  {item.id === 'home' ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                      />
                    </svg>
                  ) : item.id === 'quiz' ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
                      />
                    </svg>
                  ) : item.id === 'exam' ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12h6m-6 4h6M7 4h10a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 012-2z"
                      />
                    </svg>
                  ) : item.id === 'duel' ? (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path
                        strokeLinecap="round"
                        d="M14.5 4l2.1 2.1M4 20l4-4M9 9l-5 5M19 9l-4-4M9 9l4 4M5 5l4 4"
                      />
                    </svg>
                  ) : (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  )}
                </span>
                <span className={`relative z-10 ${isOn ? 'text-white' : 'text-stone-500'}`}>{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
