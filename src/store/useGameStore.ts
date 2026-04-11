import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { tryUnlockDuelMasterAchievement } from '../lib/achievements';
import { coinsWithTurboMultiplier } from '../lib/coinBonus';
import { formatLocalDate, previousLocalDateKey } from '../lib/dateKeys';
import { PLAYER_AVATARS } from '../lib/playerProfileRtdb';
import { GOETHE_LEVELS, type GoetheLevel } from '../types';
import { LEARN_BLOCKS_UNLOCK_ALL_COST } from '../lib/learnBlocks';
import { LEARNING_MISSION_ARTIK_REWARD } from '../lib/learnMissions';
import { coinUnlockCostForLevel } from '../lib/levelGate';

const defaultAvatar = PLAYER_AVATARS[0]?.id ?? 'pretzel';

function sanitizeLearningAllBlocksUnlocked(
  raw: unknown,
): Partial<Record<GoetheLevel, boolean>> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<Record<GoetheLevel, boolean>> = {};
  for (const lvl of GOETHE_LEVELS) {
    if ((raw as Record<string, unknown>)[lvl] === true) out[lvl] = true;
  }
  return out;
}

function sanitizeLevelGateCoinUnlocks(
  raw: unknown,
): Partial<Record<GoetheLevel, boolean>> {
  if (!raw || typeof raw !== 'object') return {};
  const allow: GoetheLevel[] = ['B1', 'B2', 'C1'];
  const out: Partial<Record<GoetheLevel, boolean>> = {};
  for (const lvl of allow) {
    if ((raw as Record<string, unknown>)[lvl] === true) out[lvl] = true;
  }
  return out;
}

function sanitizeLearningMissionArtikClaimed(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k !== 'string' || k.length > 48 || v !== true) continue;
    if (!/^[ABC][12]:\d+$/.test(k)) continue;
    out[k] = true;
  }
  return out;
}

/**
 * Persisted player profile + duel aggregates.
 * Core fields: `playerName`, `avatar` (id → use `avatarIdToEmoji` in UI), `score`, `isRegistered`.
 * `setPlayer(name, avatarId)` normalizes input, sets `isRegistered: true`, and persists.
 */
const STORAGE_KEY = 'artikel-player-store-v1';
const LEGACY_GAME_KEY = 'artikel-game-v1';
const LEGACY_IMPORTED_KEY = 'artikel-legacy-game-imported';

export interface DuelTier {
  id: 'sade' | 'ciddi' | 'ekspert';
  entryFee: number;
  prize: number;
}

const INITIAL_COINS = 100;

/** İlk giriş (totalXp === 0): əlavə start kapitalı. */
export const WELCOME_STARTER_COINS = 200;

/** RTDB `isAlpha` (Pioner / ilk 10) — bir dəfə bonus. */
export const PIONEER_ALPHA_BONUS_COINS = 1000;

/** Gündəlik öyrənmə (kviz) sikkə limiti — duel və s. daxil deyil. */
export const LESSON_DAILY_COIN_CAP = 300;

/** Giriş seriyası: gün 1…7, sonra yenidən 1. */
export const CHECKIN_DAY_COINS = [10, 20, 30, 40, 50, 60, 100] as const;

/**
 * 6–12 simvol A–Z0–9: oyunçu adının təmiz forması + təsadüfi rəqəmlər.
 * RTDB: `referralCodes/{kod}` → `{ uid, ts }` (kod paylaşılan identifikatordur).
 */
function buildReferralCodeFromPlayerName(playerName: string): string {
  const normalized = playerName
    .trim()
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
  const base = (normalized.length >= 2 ? normalized : 'OYUNCU').slice(0, 8);
  let suffix = '';
  try {
    const a = new Uint8Array(3);
    crypto.getRandomValues(a);
    suffix = String(1000 + ((a[0] << 8 | a[1]) % 9000));
    if (suffix.length < 4) suffix = suffix.padStart(4, '0');
  } catch {
    suffix = String(1000 + Math.floor(Math.random() * 9000));
  }
  let code = `${base}${suffix}`.replace(/[^A-Z0-9]/g, '').toUpperCase();
  if (code.length < 6) {
    const pad = String(10 + Math.floor(Math.random() * 89));
    code = `${base}${suffix}${pad}`.replace(/[^A-Z0-9]/g, '').toUpperCase().slice(0, 12);
  }
  if (code.length > 12) code = code.slice(0, 12);
  return code;
}

export type PlayerStore = {
  playerName: string;
  avatar: string;
  score: number;
  wins: number;
  totalDuels: number;
  coins: number;
  isRegistered: boolean;
  /** Gündəlik çek-in: son uğurlu iddia tarixi (YYYY-MM-DD) */
  checkInLastYmd: string;
  /** Son çek-indən sonra cari mərhələ 1…7 */
  checkInCyclePosition: number;
  achievementIds: string[];
  /** YYYY-MM-DD — hansı gün üçün lessonCoinsEarnedToday sayılır */
  lessonCoinsYmd: string;
  /** Bu gün öyrənmə sessiyalarından qazanılan sikkə (max LESSON_DAILY_COIN_CAP) */
  lessonCoinsEarnedToday: number;
  referralCode: string;
  pendingReferralCode: string | null;
  referralInviteProcessed: boolean;
  learningSessionsCompletedCount: number;
  a1MasterRewardClaimed: boolean;
  /** 0 və ya sandıq overlay bitənə qədər timestamp */
  goldChestVisibleUntil: number;
  /** totalXp === 0 ikən verilən start kapitalı artıq verilib */
  welcomeStarterCoinsClaimed: boolean;
  /** Pioner (isAlpha) 1000 Artik bonusu artıq verilib */
  pioneerAlphaBonusClaimed: boolean;
  /** Öyrənmə blokları: səviyyə üzrə hamısı ödənişlə açılıb */
  learningAllBlocksUnlocked: Partial<Record<GoetheLevel, boolean>>;
  /** Missiya tamamlama mükafatı (50 Artik) artıq verilib — açar: `A1:0`, `B1:12` */
  learningMissionArtikClaimed: Record<string, boolean>;
  /** Goethe səviyyəsi IAP (demo: 2 AZN təsdiqi). */
  iapLevelUnlocks: Partial<Record<GoetheLevel, boolean>>;
  /** B1/B2/C1 bir dəfə Artik ödəməklə açılıb. */
  levelGateCoinUnlocks: Partial<Record<GoetheLevel, boolean>>;
  /** Günlük reklam mükafatı (öyrənmə limitindən kənar sikkə). */
  rewardAdBonusLastYmd: string;
  /**
   * Xüsusi dueldə 5 qələbə seriyası: profildə müvəqqəti «Duel Ustası» nişanı (Unix ms bitmə).
   * 0 — aktiv deyil.
   */
  duelStreakTempBadgeUntilMs: number;
  grantIapLevelUnlock: (level: GoetheLevel) => void;
  /** Demo: 1000 sikkə — real ödəniş yoxdur. */
  purchaseCoinPack1000Demo: () => void;
  /** Gündə bir dəfə +50 🪙; null — bu gün artıq alınıb. */
  claimRewardAdBonus: () => number | null;
  setPlayer: (name: string, avatarId: string) => void;
  setAvatar: (id: string) => void;
  recordDuelFinish: (won: boolean, myScore: number) => void;
  spendCoins: (amount: number) => boolean;
  earnCoins: (amount: number) => void;
  /**
   * Yalnız öyrənmə kvizi mükafatı — gündəlik limit (LESSON_DAILY_COIN_CAP).
   * Qayıtar: faktiki əlavə olunan və limit dolub-dolmaması.
   */
  earnCoinsFromLesson: (amount: number) => { granted: number; capped: boolean; capRemaining: number };
  getLessonCoinProgress: () => { earned: number; cap: number };
  getOrCreateReferralCode: () => string;
  setPendingReferralCode: (code: string | null) => void;
  /** Sessiya bitəndə: sayğac + ilk sessiyada referral. */
  completeLearningSession: (inviteeUid: string, inviteeTotalXp?: number) => void;
  dismissGoldChest: () => void;
  /** Təkrarlanmayan nailiyyət; `coins` artıq turbo ilə hesablanıb. */
  unlockAchievement: (id: string, coins: number) => void;
  /** A1 tam mənimsəmə — +1000, limitdən kənar. */
  grantA1MasterReward: () => void;
  /** Gündə bir dəfə; qayıdır null əgər bu gün artıq alınıb. */
  claimDailyCheckIn: () => { coins: number; dayIndex: number; baseCoins: number } | null;
  /**
   * Yeni oyunçu (cəmi XP === 0): bir dəfə +WELCOME_STARTER_COINS.
   * `true` — indi verildi, tam ekran mesajı göstər.
   */
  claimWelcomeStarterBonusIfEligible: (totalXpAllLevels: number) => boolean;
  /** Yalnız `isAlpha === true` olduqda çağır; true — indi +PIONEER_ALPHA_BONUS_COINS verildi. */
  claimPioneerAlphaBonusOnce: () => boolean;
  /** true — artıq açıqdır və ya indi ödədi; false — kifayət qədər Artik yoxdur */
  unlockLearningBlocksForLevel: (level: GoetheLevel) => boolean;
  /**
   * Missiya tamamlanıbsa və bu missiya üçün mükafat hələ verilməyibsə +50 Artik (gündəlik limitdən kənar).
   * Qaytarır: verilən Artik (0 — artıq alınıb və ya tamamlanmayıb).
   */
  tryClaimLearningMissionReward: (
    level: GoetheLevel,
    missionIndex: number,
    missionComplete: boolean,
  ) => number;
  /**
   * B1/B2/C1: bir dəfə Artik çıxılır. true — indi açıldı və ya artıq açıq idi; false — qiymət yoxdur və ya kifayət qədər Artik yoxdur.
   */
  unlockLevelWithArtik: (level: GoetheLevel) => boolean;
  /** Seriya mükafatı: bitmə vaxtını uzadır (ən gec vaxt saxlanılır). */
  extendDuelStreakTempBadgeUntil: (untilMs: number) => void;
};

export const useGameStore = create<PlayerStore>()(
  persist(
    (set, get) => ({
      playerName: '',
      avatar: defaultAvatar,
      score: 0,
      wins: 0,
      totalDuels: 0,
      coins: INITIAL_COINS,
      isRegistered: false,
      checkInLastYmd: '',
      checkInCyclePosition: 0,
      achievementIds: [],
      lessonCoinsYmd: '',
      lessonCoinsEarnedToday: 0,
      referralCode: '',
      pendingReferralCode: null,
      referralInviteProcessed: false,
      learningSessionsCompletedCount: 0,
      a1MasterRewardClaimed: false,
      goldChestVisibleUntil: 0,
      welcomeStarterCoinsClaimed: false,
      pioneerAlphaBonusClaimed: false,
      learningAllBlocksUnlocked: {},
      learningMissionArtikClaimed: {},
      iapLevelUnlocks: {},
      levelGateCoinUnlocks: {},
      rewardAdBonusLastYmd: '',
      duelStreakTempBadgeUntilMs: 0,
      extendDuelStreakTempBadgeUntil: (untilMs) =>
        set((s) => {
          const u = Math.max(0, Math.floor(untilMs));
          if (u <= 0) return s;
          return {
            duelStreakTempBadgeUntilMs: Math.max(s.duelStreakTempBadgeUntilMs, u),
          };
        }),
      grantIapLevelUnlock: (level) =>
        set((s) => ({
          iapLevelUnlocks: { ...s.iapLevelUnlocks, [level]: true },
        })),
      purchaseCoinPack1000Demo: () =>
        set((s) => ({ coins: s.coins + 1000 })),
      claimRewardAdBonus: () => {
        const today = formatLocalDate(new Date());
        const s = get();
        if (s.rewardAdBonusLastYmd === today) return null;
        const bonus = 50;
        set({ rewardAdBonusLastYmd: today, coins: s.coins + bonus });
        return bonus;
      },
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
        set((s) => {
          const nextWins = s.wins + (won ? 1 : 0);
          queueMicrotask(() => tryUnlockDuelMasterAchievement(nextWins));
          return {
            score: s.score + Math.max(0, Math.floor(myScore)),
            wins: nextWins,
            totalDuels: s.totalDuels + 1,
          };
        }),
      unlockAchievement: (id, coins) =>
        set((s) => {
          if (s.achievementIds.includes(id)) return s;
          const add = Math.max(0, Math.floor(coins));
          return {
            achievementIds: [...s.achievementIds, id],
            coins: s.coins + add,
          };
        }),
      claimDailyCheckIn: () => {
        const today = formatLocalDate(new Date());
        const s = get();
        if (s.checkInLastYmd === today) return null;

        let nextPos: number;
        if (!s.checkInLastYmd) {
          nextPos = 1;
        } else {
          const yday = previousLocalDateKey(today);
          if (s.checkInLastYmd === yday) {
            nextPos = s.checkInCyclePosition >= 7 ? 1 : s.checkInCyclePosition + 1;
          } else {
            nextPos = 1;
          }
        }

        const baseCoins = CHECKIN_DAY_COINS[nextPos - 1] ?? CHECKIN_DAY_COINS[0];
        const coins = coinsWithTurboMultiplier(baseCoins);
        set((cur) => ({
          checkInLastYmd: today,
          checkInCyclePosition: nextPos,
          coins: cur.coins + coins,
        }));
        return { coins, dayIndex: nextPos, baseCoins };
      },
      spendCoins: (amount) => {
        const cur = get().coins;
        if (cur < amount) return false;
        set({ coins: cur - amount });
        return true;
      },
      earnCoins: (amount) => set((s) => ({ coins: s.coins + Math.max(0, Math.floor(amount)) })),
      earnCoinsFromLesson: (amount) => {
        const today = formatLocalDate(new Date());
        const raw = Math.max(0, Math.floor(amount));
        let cur = get();
        if (cur.lessonCoinsYmd !== today) {
          set({ lessonCoinsYmd: today, lessonCoinsEarnedToday: 0 });
          cur = get();
        }
        const cap = LESSON_DAILY_COIN_CAP;
        const room = Math.max(0, cap - cur.lessonCoinsEarnedToday);
        const grant = Math.min(raw, room);
        const capped = grant < raw;
        if (grant > 0) {
          set((s) => ({
            coins: s.coins + grant,
            lessonCoinsEarnedToday: s.lessonCoinsEarnedToday + grant,
            lessonCoinsYmd: today,
          }));
        }
        const after = get();
        return {
          granted: grant,
          capped,
          capRemaining: Math.max(0, cap - after.lessonCoinsEarnedToday),
        };
      },
      getLessonCoinProgress: () => {
        const today = formatLocalDate(new Date());
        const s = get();
        const earned = s.lessonCoinsYmd === today ? s.lessonCoinsEarnedToday : 0;
        return { earned, cap: LESSON_DAILY_COIN_CAP };
      },
      getOrCreateReferralCode: () => {
        let c = get().referralCode;
        if (!c || c.length < 6) {
          c = buildReferralCodeFromPlayerName(get().playerName);
          set({ referralCode: c });
        }
        return c;
      },
      setPendingReferralCode: (code) => {
        const c = code?.trim().toUpperCase() ?? '';
        if (!c || c.length < 6) return;
        const s = get();
        if (s.referralInviteProcessed || s.learningSessionsCompletedCount > 0) return;
        let own = s.referralCode;
        if (!own || own.length < 6) {
          own = buildReferralCodeFromPlayerName(s.playerName);
          set({ referralCode: own });
        }
        if (c === own) return;
        set({ pendingReferralCode: c });
      },
      completeLearningSession: (inviteeUid, inviteeTotalXp = 0) => {
        set((s) => ({
          learningSessionsCompletedCount: s.learningSessionsCompletedCount + 1,
        }));
        const s = get();
        if (s.referralInviteProcessed) return;
        void import('../lib/referralRtdb').then((m) =>
          m.tryProcessInviteeReferral(inviteeUid, s.pendingReferralCode, inviteeTotalXp),
        );
      },
      dismissGoldChest: () => set({ goldChestVisibleUntil: 0 }),
      grantA1MasterReward: () => {
        const s = get();
        if (s.a1MasterRewardClaimed) return;
        set({
          a1MasterRewardClaimed: true,
          coins: s.coins + 1000,
          goldChestVisibleUntil: Date.now() + 8000,
        });
      },
      claimWelcomeStarterBonusIfEligible: (totalXpAllLevels) => {
        const s = get();
        if (s.welcomeStarterCoinsClaimed) return false;
        if (totalXpAllLevels !== 0) return false;
        set({
          welcomeStarterCoinsClaimed: true,
          coins: s.coins + WELCOME_STARTER_COINS,
        });
        return true;
      },
      claimPioneerAlphaBonusOnce: () => {
        const s = get();
        if (s.pioneerAlphaBonusClaimed) return false;
        set({
          pioneerAlphaBonusClaimed: true,
          coins: s.coins + PIONEER_ALPHA_BONUS_COINS,
        });
        return true;
      },
      unlockLearningBlocksForLevel: (level) => {
        const s = get();
        if (s.learningAllBlocksUnlocked[level]) return true;
        if (s.coins < LEARN_BLOCKS_UNLOCK_ALL_COST) return false;
        set({
          coins: s.coins - LEARN_BLOCKS_UNLOCK_ALL_COST,
          learningAllBlocksUnlocked: { ...s.learningAllBlocksUnlocked, [level]: true },
        });
        return true;
      },
      tryClaimLearningMissionReward: (level, missionIndex, missionComplete) => {
        if (!missionComplete || missionIndex < 0) return 0;
        const key = `${level}:${missionIndex}`;
        const s = get();
        if (s.learningMissionArtikClaimed[key]) return 0;
        set({
          learningMissionArtikClaimed: { ...s.learningMissionArtikClaimed, [key]: true },
          coins: s.coins + LEARNING_MISSION_ARTIK_REWARD,
        });
        return LEARNING_MISSION_ARTIK_REWARD;
      },
      unlockLevelWithArtik: (level) => {
        const cost = coinUnlockCostForLevel(level);
        if (cost == null) return false;
        const s = get();
        if (s.levelGateCoinUnlocks[level]) return true;
        if (s.coins < cost) return false;
        set({
          coins: s.coins - cost,
          levelGateCoinUnlocks: { ...s.levelGateCoinUnlocks, [level]: true },
        });
        return true;
      },
    }),
    {
      name: STORAGE_KEY,
      merge: (persisted, current) => {
        const p = persisted as Partial<PlayerStore> | undefined;
        if (!p || typeof p !== 'object') return current;
        const today = formatLocalDate(new Date());
        let lessonCoinsYmd =
          typeof p.lessonCoinsYmd === 'string' ? p.lessonCoinsYmd : '';
        let lessonCoinsEarnedToday =
          typeof p.lessonCoinsEarnedToday === 'number' && p.lessonCoinsEarnedToday >= 0
            ? p.lessonCoinsEarnedToday
            : 0;
        if (lessonCoinsYmd !== today) {
          lessonCoinsYmd = today;
          lessonCoinsEarnedToday = 0;
        }
        return {
          ...current,
          ...p,
          achievementIds: Array.isArray(p.achievementIds) ? p.achievementIds : [],
          checkInLastYmd: typeof p.checkInLastYmd === 'string' ? p.checkInLastYmd : '',
          checkInCyclePosition:
            typeof p.checkInCyclePosition === 'number' && p.checkInCyclePosition >= 0
              ? p.checkInCyclePosition
              : 0,
          lessonCoinsYmd,
          lessonCoinsEarnedToday,
          referralCode: typeof p.referralCode === 'string' ? p.referralCode : '',
          pendingReferralCode:
            typeof p.pendingReferralCode === 'string' && p.pendingReferralCode.trim()
              ? p.pendingReferralCode.trim().toUpperCase()
              : null,
          referralInviteProcessed: Boolean(p.referralInviteProcessed),
          learningSessionsCompletedCount:
            typeof p.learningSessionsCompletedCount === 'number'
              ? Math.max(0, p.learningSessionsCompletedCount)
              : 0,
          a1MasterRewardClaimed: Boolean(p.a1MasterRewardClaimed),
          goldChestVisibleUntil:
            typeof p.goldChestVisibleUntil === 'number' ? p.goldChestVisibleUntil : 0,
          welcomeStarterCoinsClaimed: Boolean(p.welcomeStarterCoinsClaimed),
          pioneerAlphaBonusClaimed: Boolean(p.pioneerAlphaBonusClaimed),
          learningAllBlocksUnlocked: sanitizeLearningAllBlocksUnlocked(p.learningAllBlocksUnlocked),
          learningMissionArtikClaimed: sanitizeLearningMissionArtikClaimed(
            p.learningMissionArtikClaimed,
          ),
          iapLevelUnlocks:
            p.iapLevelUnlocks && typeof p.iapLevelUnlocks === 'object' ? p.iapLevelUnlocks : {},
          levelGateCoinUnlocks: sanitizeLevelGateCoinUnlocks(p.levelGateCoinUnlocks),
          rewardAdBonusLastYmd:
            typeof p.rewardAdBonusLastYmd === 'string' ? p.rewardAdBonusLastYmd : '',
          duelStreakTempBadgeUntilMs:
            typeof p.duelStreakTempBadgeUntilMs === 'number' && p.duelStreakTempBadgeUntilMs > 0
              ? p.duelStreakTempBadgeUntilMs
              : 0,
        };
      },
    },
  ),
);

/**
 * Gündəlik öyrənmə Artik sayğacını cari təqvim gününə uyğunlaşdırır (tətbiq açıq qalanda gecə yarısı,
 * başqa tabdan qayıdanda və s.).
 */
export function syncLessonDailyCoinsToToday(): void {
  const today = formatLocalDate(new Date());
  const s = useGameStore.getState();
  if (s.lessonCoinsYmd === today) return;
  useGameStore.setState({ lessonCoinsYmd: today, lessonCoinsEarnedToday: 0 });
}

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
