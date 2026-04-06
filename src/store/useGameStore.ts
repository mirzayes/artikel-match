import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PLAYER_AVATARS } from '../lib/playerProfileRtdb';

const defaultAvatar = PLAYER_AVATARS[0]?.id ?? 'pretzel';

/**
 * Persisted player profile + duel aggregates.
 * Core fields: `playerName`, `avatar` (id → use `avatarIdToEmoji` in UI), `score`, `isRegistered`.
 * `setPlayer(name, avatarId)` normalizes input, sets `isRegistered: true`, and persists.
 */
const STORAGE_KEY = 'artikel-player-store-v1';
const LEGACY_GAME_KEY = 'artikel-game-v1';
const LEGACY_IMPORTED_KEY = 'artikel-legacy-game-imported';

export type PlayerStore = {
  playerName: string;
  avatar: string;
  score: number;
  wins: number;
  totalDuels: number;
  isRegistered: boolean;
  /** Saves name and avatar and marks the profile as registered. */
  setPlayer: (name: string, avatarId: string) => void;
  /** Avatar selection before confirm. */
  setAvatar: (id: string) => void;
  recordDuelFinish: (won: boolean, myScore: number) => void;
};

export const useGameStore = create<PlayerStore>()(
  persist(
    (set) => ({
      playerName: '',
      avatar: defaultAvatar,
      score: 0,
      wins: 0,
      totalDuels: 0,
      isRegistered: false,
      setPlayer: (name, avatarId) => {
        const trimmed = name.trim().slice(0, 32);
        const allowed =
          PLAYER_AVATARS.some((a) => a.id === avatarId) ? avatarId : defaultAvatar;
        set({
          playerName: trimmed,
          avatar: allowed,
          isRegistered: true,
        });
      },
      setAvatar: (id) => {
        if (PLAYER_AVATARS.some((a) => a.id === id)) set({ avatar: id });
      },
      recordDuelFinish: (won, myScore) =>
        set((s) => ({
          score: s.score + Math.max(0, Math.floor(myScore)),
          wins: s.wins + (won ? 1 : 0),
          totalDuels: s.totalDuels + 1,
        })),
    }),
    { name: STORAGE_KEY },
  ),
);

/** Migrate legacy localStorage keys into this store. */
export function migrateLegacyPlayerProfileIntoGameStore(): void {
  try {
    if (!localStorage.getItem(LEGACY_IMPORTED_KEY)) {
      const legacyGame = localStorage.getItem(LEGACY_GAME_KEY);
      if (legacyGame) {
        const parsed = JSON.parse(legacyGame) as { state?: Record<string, unknown> };
        const st = parsed?.state;
        if (st) {
          const av =
            typeof st.avatar === 'string'
              ? st.avatar
              : typeof st.selectedAvatar === 'string'
                ? st.selectedAvatar
                : defaultAvatar;
          const avatar = PLAYER_AVATARS.some((a) => a.id === av) ? av : defaultAvatar;
          useGameStore.setState({
            playerName: typeof st.playerName === 'string' ? st.playerName : '',
            avatar,
            score: typeof st.score === 'number' ? st.score : 0,
            wins: typeof st.wins === 'number' ? st.wins : 0,
            totalDuels: typeof st.totalDuels === 'number' ? st.totalDuels : 0,
            isRegistered: Boolean(st.isRegistered ?? st.hasCompletedRegistration),
          });
        }
      }
      localStorage.setItem(LEGACY_IMPORTED_KEY, '1');
    }

    const raw = localStorage.getItem('artikel-player-profile-v1');
    if (!raw) return;
    const parsed = JSON.parse(raw) as {
      state?: {
        displayName?: string;
        avatarId?: string;
        hasCompletedRegistration?: boolean;
      };
    };
    const st = parsed?.state;
    if (!st) return;
    const cur = useGameStore.getState();
    if (cur.playerName && cur.isRegistered) return;
    const av =
      st.avatarId && PLAYER_AVATARS.some((a) => a.id === st.avatarId)
        ? st.avatarId
        : cur.avatar;
    useGameStore.setState({
      playerName:
        typeof st.displayName === 'string' && st.displayName ? st.displayName : cur.playerName,
      avatar: av,
      isRegistered: Boolean(st.hasCompletedRegistration || cur.isRegistered),
    });
  } catch {
    /* ignore */
  }
}
