import { useEffect, useState } from 'react';
import {
  migrateLegacyPlayerProfileIntoGameStore,
  syncLessonDailyCoinsToToday,
  useGameStore,
} from '../store/useGameStore';

/** Ждём rehydrate и при необходимости мигрируем старый профильный стор. */
export function useGameStoreRehydrated(): boolean {
  const [ok, setOk] = useState(() => useGameStore.persist.hasHydrated());

  useEffect(() => {
    if (useGameStore.persist.hasHydrated()) {
      migrateLegacyPlayerProfileIntoGameStore();
      syncLessonDailyCoinsToToday();
      setOk(true);
      return;
    }
    return useGameStore.persist.onFinishHydration(() => {
      migrateLegacyPlayerProfileIntoGameStore();
      syncLessonDailyCoinsToToday();
      setOk(true);
    });
  }, []);

  return ok;
}
