import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { isFirebaseLive } from './firebase';
import { subscribeLeaderboard, type LeaderboardEntry } from './leaderboardRtdb';

export const LEADERBOARD_LIVE_QUERY_KEY = ['leaderboard', 'live'] as const;

export type LeaderboardLiveState = {
  entries: LeaderboardEntry[];
  /** İlk RTDB snapshot gəldi (və ya Firebase söndürülüb). */
  seeded: boolean;
};

function initialLiveState(): LeaderboardLiveState {
  return {
    entries: [],
    seeded: !isFirebaseLive,
  };
}

/** RTDB top-10 → React Query; Dashboard və Leaderboard eyni cache paylaşır. */
export function LeaderboardLiveSync() {
  const qc = useQueryClient();

  useEffect(() => {
    if (!isFirebaseLive) {
      qc.setQueryData(LEADERBOARD_LIVE_QUERY_KEY, initialLiveState());
      return;
    }
    return subscribeLeaderboard(10, (entries) => {
      qc.setQueryData(LEADERBOARD_LIVE_QUERY_KEY, { entries, seeded: true });
    });
  }, [qc]);

  return null;
}

export function useLeaderboardLiveQuery() {
  return useQuery({
    queryKey: LEADERBOARD_LIVE_QUERY_KEY,
    queryFn: (): Promise<LeaderboardLiveState> => Promise.resolve(initialLiveState()),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 1000 * 60 * 30,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}
