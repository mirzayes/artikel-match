import { useEffect, useRef } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../lib/supabaseClient';

const SCORES_REALTIME_CHANNEL = 'room1';

export type ScoresInsertPayload = RealtimePostgresChangesPayload<Record<string, unknown>>;

/**
 * `public.scores` cədvəlinə INSERT üçün Realtime (Supabase Dashboard-da cədvəli replication-a əlavə edin).
 * UI yeniləməsi üçün `onInsert` ötürün (məs. Zustand set və ya sorğu refetch).
 */
export function useSupabaseScoresRealtime(onInsert?: (payload: ScoresInsertPayload) => void): void {
  const onInsertRef = useRef(onInsert);
  onInsertRef.current = onInsert;

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const channel = supabase
      .channel(SCORES_REALTIME_CHANNEL)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'scores' },
        (payload: ScoresInsertPayload) => {
          console.log('Новый рекорд в базе!', payload);
          onInsertRef.current?.(payload);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
}
