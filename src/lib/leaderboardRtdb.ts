import {
  onValue,
  ref,
  update,
  query,
  orderByChild,
  limitToLast,
  type DataSnapshot,
} from 'firebase/database';
import { isFirebaseLive, isRealtimeDatabaseUrlConfigured, rtdb } from './firebase';

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  avatar: string;
  totalXp: number;
  /** «Bilirəm» sözləri sayı — RTDB `profile.learnedWords` / `leaderboard.learnedWords`. */
  learnedWords: number;
}

type ProfileSnap = {
  xp?: unknown;
  /** Некоторые бэкенды кладут суммарный XP под другим ключом — подстраховка для маппинга. */
  totalXp?: unknown;
  learnedWords?: unknown;
  wordsLearned?: unknown;
  name?: unknown;
  displayName?: unknown;
  avatar?: unknown;
};

/**
 * Строгий разбор XP из поля (без подстановки по умолчанию).
 * `0` и `0` в виде строки — валидны. `null` / отсутствие — `null`.
 */
function parseProfileXp(xpRaw: unknown): number | null {
  if (xpRaw === null || xpRaw === undefined) return null;
  if (typeof xpRaw === 'number' && Number.isFinite(xpRaw)) {
    return Math.max(0, Math.floor(xpRaw));
  }
  if (typeof xpRaw === 'bigint') {
    const n = Number(xpRaw);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.floor(n));
  }
  if (typeof xpRaw === 'string') {
    const t = xpRaw.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.floor(n));
  }
  return null;
}

/** Для отображения в топе: неизвестный формат → 0 (тестер остаётся в списке). */
function coerceNonNegativeXp(raw: unknown): number {
  return parseProfileXp(raw) ?? 0;
}

function pickXpRaw(p: ProfileSnap | null | undefined): unknown {
  if (!p) return undefined;
  if (p.xp !== undefined && p.xp !== null) return p.xp;
  if (p.totalXp !== undefined && p.totalXp !== null) return p.totalXp;
  return undefined;
}

function pickLearnedRaw(p: ProfileSnap | null | undefined): unknown {
  if (!p) return undefined;
  if (p.learnedWords !== undefined && p.learnedWords !== null) return p.learnedWords;
  if (p.wordsLearned !== undefined && p.wordsLearned !== null) return p.wordsLearned;
  return undefined;
}

/**
 * XP для узла `users/{uid}`: сначала `profile`, затем корень (другие клиенты / импорты).
 */
function pickXpFromUserNode(val: unknown): unknown {
  if (!val || typeof val !== 'object') return undefined;
  const o = val as Record<string, unknown>;
  const prof = o.profile;
  if (prof && typeof prof === 'object') {
    const fromProf = pickXpRaw(prof as ProfileSnap);
    if (fromProf !== undefined && fromProf !== null) return fromProf;
  }
  for (const k of ['xp', 'totalXp', 'experience', 'points', 'score'] as const) {
    const v = o[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function pickLearnedFromUserNode(val: unknown): unknown {
  if (!val || typeof val !== 'object') return undefined;
  const o = val as Record<string, unknown>;
  const prof = o.profile;
  if (prof && typeof prof === 'object') {
    const fromProf = pickLearnedRaw(prof as ProfileSnap);
    if (fromProf !== undefined && fromProf !== null) return fromProf;
  }
  for (const k of ['learnedWords', 'wordsLearned', 'wordsMastered'] as const) {
    const v = o[k];
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

function leaderboardDebugLog(): boolean {
  if (import.meta.env.DEV) return true;
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('DEBUG_LEADERBOARD') === '1';
  } catch {
    return false;
  }
}

function profileDisplayName(p: ProfileSnap | null | undefined): string {
  if (!p) return 'Oyunçu';
  if (typeof p.name === 'string' && p.name.trim()) return p.name.trim().slice(0, 32);
  if (typeof p.displayName === 'string' && p.displayName.trim()) return p.displayName.trim().slice(0, 32);
  return 'Oyunçu';
}

function userNodeDisplayName(val: unknown, p: ProfileSnap | null | undefined): string {
  const fromProfile = profileDisplayName(p);
  if (fromProfile !== 'Oyunçu') return fromProfile;
  if (val && typeof val === 'object') {
    const o = val as Record<string, unknown>;
    for (const k of ['name', 'displayName'] as const) {
      const x = o[k];
      if (typeof x === 'string' && x.trim()) return x.trim().slice(0, 32);
    }
  }
  return 'Oyunçu';
}

function userNodeAvatar(val: unknown, p: ProfileSnap | null | undefined): string {
  if (typeof p?.avatar === 'string' && p.avatar) return p.avatar;
  if (val && typeof val === 'object') {
    const a = (val as Record<string, unknown>).avatar;
    if (typeof a === 'string' && a) return a;
  }
  return 'pretzel';
}

function preferDisplayName(a: string, b: string): string {
  const def = 'Oyunçu';
  if (a && a !== def) return a;
  if (b && b !== def) return b;
  return a || b || def;
}

function preferAvatar(a: string, b: string): string {
  if (a && a !== 'pretzel') return a;
  if (b && b !== 'pretzel') return b;
  return a || 'pretzel';
}

function mergeLeaderboardSources(
  fromUsers: LeaderboardEntry[],
  fromFlat: LeaderboardEntry[],
  top: number,
): LeaderboardEntry[] {
  const map = new Map<string, LeaderboardEntry>();
  const upsert = (e: LeaderboardEntry) => {
    const prev = map.get(e.uid);
    if (!prev) {
      map.set(e.uid, { ...e });
      return;
    }
    const bestXp = Math.max(prev.totalXp, e.totalXp);
    const primary = e.totalXp > prev.totalXp ? e : prev;
    const secondary = e.totalXp > prev.totalXp ? prev : e;
    const bestWords = Math.max(prev.learnedWords ?? 0, e.learnedWords ?? 0);
    map.set(e.uid, {
      uid: e.uid,
      totalXp: bestXp,
      learnedWords: bestWords,
      displayName: preferDisplayName(primary.displayName, secondary.displayName),
      avatar: preferAvatar(primary.avatar, secondary.avatar),
    });
  };
  for (const e of fromUsers) upsert(e);
  for (const e of fromFlat) upsert(e);
  return [...map.values()]
    .sort((x, y) => {
      const d = y.totalXp - x.totalXp;
      if (d !== 0) return d;
      return y.learnedWords - x.learnedWords;
    })
    .slice(0, top);
}

function parseUsersLeaderboardSnapshot(snap: DataSnapshot): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  snap.forEach((child) => {
    const uid = child.key;
    if (!uid) return;
    const val = child.val();
    const p =
      val && typeof val === 'object' && (val as { profile?: unknown }).profile != null
        ? ((val as { profile: ProfileSnap }).profile as ProfileSnap)
        : undefined;
    const xp = coerceNonNegativeXp(pickXpFromUserNode(val));
    const learned = coerceNonNegativeXp(pickLearnedFromUserNode(val));
    entries.push({
      uid,
      displayName: userNodeDisplayName(val, p),
      avatar: userNodeAvatar(val, p),
      totalXp: xp,
      learnedWords: learned,
    });
  });
  entries.sort((a, b) => {
    const d = b.totalXp - a.totalXp;
    if (d !== 0) return d;
    return b.learnedWords - a.learnedWords;
  });
  return entries;
}

/** Узлы `leaderboard/{uid}` (см. database.rules.json — indexOn totalXp). */
function parseFlatLeaderboardSnapshot(snap: DataSnapshot): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];
  snap.forEach((child) => {
    const uid = child.key;
    if (!uid) return;
    const val = child.val();
    const xp = coerceNonNegativeXp(pickXpFromUserNode(val));
    const learned = coerceNonNegativeXp(pickLearnedFromUserNode(val));
    const p = val && typeof val === 'object' ? (val as ProfileSnap) : undefined;
    entries.push({
      uid,
      displayName: userNodeDisplayName(val, p),
      avatar: userNodeAvatar(val, p),
      totalXp: xp,
      learnedWords: learned,
    });
  });
  entries.sort((a, b) => {
    const d = b.totalXp - a.totalXp;
    if (d !== 0) return d;
    return b.learnedWords - a.learnedWords;
  });
  return entries;
}

/**
 * Syncs XP, learned-word count, name, avatar to:
 * - `users/{uid}/profile` — `xp`, `learnedWords`, … (query: orderByChild('profile/xp'))
 * - `leaderboard/{uid}` — `totalXp`, `learnedWords`, …
 *
 * `learnedWordCount` — eyni mənbə ki, Dashboard-da «öyrənilib» sayı: `knownWordIds.length`.
 */
export async function syncLeaderboardXp(
  userId: string,
  totalXp: number,
  displayName: string,
  avatar: string,
  learnedWordCount = 0,
): Promise<void> {
  if (!userId.trim() || !rtdb || !isFirebaseLive || !isRealtimeDatabaseUrlConfigured()) return;
  const trimmedName = displayName.trim().slice(0, 32) || 'Oyunçu';
  const xp = Math.max(0, Math.floor(totalXp));
  const lw = Math.max(0, Math.floor(learnedWordCount));
  const av = avatar || 'pretzel';
  try {
    await Promise.all([
      update(ref(rtdb, `users/${userId}/profile`), {
        xp,
        learnedWords: lw,
        name: trimmedName,
        avatar: av,
      }),
      update(ref(rtdb, `leaderboard/${userId}`), {
        totalXp: xp,
        learnedWords: lw,
        name: trimmedName,
        avatar: av,
      }),
    ]);
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[leaderboard RTDB] syncLeaderboardXp failed', e);
    }
  }
}

/**
 * Топ N: объединяет
 * - `users` + orderByChild('profile/xp') (основной путь приложения);
 * - `leaderboard` + orderByChild('totalXp') (плоский топ из правил БД).
 * Узлы без валидного XP не отбрасываются — показываются с 0 XP.
 */
export function subscribeLeaderboard(limit: number, cb: (entries: LeaderboardEntry[]) => void): () => void {
  if (!rtdb || !isFirebaseLive || !isRealtimeDatabaseUrlConfigured()) {
    cb([]);
    return () => {};
  }

  const fetchSize = Math.max(limit, 30);
  let usersPart: LeaderboardEntry[] = [];
  let flatPart: LeaderboardEntry[] = [];

  const emit = () => {
    const merged = mergeLeaderboardSources(usersPart, flatPart, limit);

    if (leaderboardDebugLog()) {
      console.log('[leaderboard RTDB] merged sources → rows', {
        queryLimit: limit,
        fetchSize,
        paths: ['users (orderBy profile/xp)', 'leaderboard (orderBy totalXp)'],
        parsedUsersCount: usersPart.length,
        parsedFlatCount: flatPart.length,
        mergedCount: merged.length,
        merged,
      });
    }

    cb(merged);
  };

  const unsubUsers = onValue(
    query(ref(rtdb, 'users'), orderByChild('profile/xp'), limitToLast(fetchSize)),
    (snap) => {
      usersPart = parseUsersLeaderboardSnapshot(snap);
      emit();
    },
  );

  const unsubFlat = onValue(
    query(ref(rtdb, 'leaderboard'), orderByChild('totalXp'), limitToLast(fetchSize)),
    (snap) => {
      flatPart = parseFlatLeaderboardSnapshot(snap);
      emit();
    },
  );

  return () => {
    unsubUsers();
    unsubFlat();
  };
}
