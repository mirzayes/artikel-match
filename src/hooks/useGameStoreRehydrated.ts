import { useEffect, useState } from 'react';
import { migrateLegacyPlayerProfileIntoGameStore, useGameStore } from '../store/useGameStore';

/** Ждём rehydrate и при необходимости мигрируем старый профильный стор. */
export function useGameStoreRehydrated(): boolean {
  const [ok, setOk] = useState(() => useGameStore.persist.hasHydrated());

  useEffect(() => {
    if (useGameStore.persist.hasHydrated()) {
      migrateLegacyPlayerProfileIntoGameStore();
      setOk(true);
      return;
    }
    return useGameStore.persist.onFinishHydration(() => {
      migrateLegacyPlayerProfileIntoGameStore();
      setOk(true);
    });
  }, []);

  return ok;
}
