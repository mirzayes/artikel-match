import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  increment,
  onChildAdded,
  onValue,
  push,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  set,
  update,
  get,
  type DataSnapshot,
} from 'firebase/database';
import type { Article, GoetheLevel, NounEntry } from '../types';
import { GOETHE_LEVELS } from '../types';
import { duelBracketForLevel, getDuelTiersForBracket } from '../lib/duelBracket';
import { persistDuelLevel, readStoredDuelLevel } from '../lib/duelLevelStorage';
import { isFirebaseConfigured, isFirebaseLive, requireRtdb, rtdb } from '../lib/firebase';
import { db as _roomsDb } from '../firebase';

const roomsDb = _roomsDb!;
import { sendFriendRequest } from '../lib/friendsRtdb';
import {
  PLAYER_AVATARS,
  avatarIdToEmoji,
  recordOnlineDuelFinished,
  setPlayerProfileDisplayName,
  subscribeUserProfile,
  type PublicPlayerProfile,
} from '../lib/playerProfileRtdb';
import { setUserActivity } from '../lib/userPresenceRtdb';
import { vibrateCoinReward, vibrateCorrectAnswer, vibrateWrongAnswer } from '../lib/answerFeedbackMedia';
import { useGameStore, type DuelTier } from '../store/useGameStore';
import { ArticleButton, type ArticleBtnMode } from './quiz/ArticleButton';
import { SpeakWordButton } from './SpeakWordButton';

const DUELS = 'duels';
const MATCHMAKING = 'matchmaking';
const ROOM_ATTEMPTS = 40;
const DUEL_DURATION_S = 60;

function randomMsInRange(minMs: number, maxMs: number): number {
  return minMs + Math.random() * (maxMs - minMs);
}

/** Simulated opponent: reaction delay per duel tier (unpredictable each turn). */
function simBotDelayRangeMs(tier: DuelTier | null): { minMs: number; maxMs: number } {
  switch (tier?.id) {
    case 'sade':
      return { minMs: 3500, maxMs: 5000 };
    case 'ekspert':
      return { minMs: 1500, maxMs: 2500 };
    case 'ciddi':
    default:
      return { minMs: 2500, maxMs: 3500 };
  }
}

/** Probability the bot answers wrong (no score bump). Sadə 30%, Ciddi 20%, Ekspert 10%. */
function simBotWrongChance(tier: DuelTier | null): number {
  switch (tier?.id) {
    case 'sade':
      return 0.3;
    case 'ekspert':
      return 0.1;
    case 'ciddi':
    default:
      return 0.2;
  }
}

export type RtdbDuelWord = {
  id: string;
  article: Article;
  word: string;
  translation: string;
  category?: string;
};

type LexiconRoot = Record<string, RtdbDuelWord[] | undefined>;

type LexiconRow = RtdbDuelWord & {
  translations?: Partial<Record<string, string>>;
};

export function getOrCreateDuelUserId(): string {
  try {
    let id = localStorage.getItem('artikel-duel-uid');
    if (!id) {
      id = `u_${crypto.randomUUID()}`;
      localStorage.setItem('artikel-duel-uid', id);
    }
    return id;
  } catch {
    return `guest_${Math.random().toString(36).slice(2, 12)}`;
  }
}

function randomFourDigitId(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

const BUNDLED_LEVEL_LOADERS: Record<GoetheLevel, () => Promise<NounEntry[]>> = {
  A1: () => import('../data/words/a1').then((m) => m.A1_NOUNS),
  A2: () => import('../data/words/a2').then((m) => m.A2_NOUNS),
  B1: () => import('../data/words/b1').then((m) => m.B1_NOUNS),
  B2: () => import('../data/words/b2').then((m) => m.B2_NOUNS),
  C1: () => import('../data/words/c1').then((m) => m.C1_NOUNS),
};

function nounToDuelWord(n: NounEntry): RtdbDuelWord {
  return {
    id: n.id,
    article: n.article,
    word: n.word,
    translation: n.translations?.az || n.translation,
    ...(n.category ? { category: n.category } : {}),
  };
}

async function loadDuelWordPoolForLevels(levels: readonly GoetheLevel[]): Promise<RtdbDuelWord[]> {
  const levelSet = new Set<string>(levels);
  const base = import.meta.env.BASE_URL ?? '/';
  const trimmed = base.endsWith('/') ? base : `${base}/`;
  const res = await fetch(`${trimmed}goethe-lexicon.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`goethe-lexicon.json: ${res.status}`);
  const data = (await res.json()) as LexiconRoot;
  const rows: RtdbDuelWord[] = [];
  const jsonLevelCounts = new Map<string, number>();

  for (const level of Object.keys(data)) {
    if (!levelSet.has(level)) continue;
    const bucket = data[level];
    if (!Array.isArray(bucket)) continue;
    let count = 0;
    for (const w of bucket as LexiconRow[]) {
      if (
        typeof w?.id !== 'string' ||
        typeof w?.word !== 'string' ||
        (w.article !== 'der' && w.article !== 'die' && w.article !== 'das')
      ) continue;
      const az = w.translations?.az?.trim();
      rows.push({
        id: w.id,
        article: w.article,
        word: w.word,
        translation: az || w.translation,
        ...(w.category ? { category: w.category } : {}),
      });
      count++;
    }
    jsonLevelCounts.set(level, count);
  }

  for (const lvl of levels) {
    if ((jsonLevelCounts.get(lvl) ?? 0) > 0) continue;
    const nouns = await BUNDLED_LEVEL_LOADERS[lvl]();
    for (const n of nouns) rows.push(nounToDuelWord(n));
  }

  if (rows.length === 0) throw new Error('No words in lexicon');
  return rows;
}

async function pickWordsForDuelLevel(level: GoetheLevel): Promise<RtdbDuelWord[]> {
  const pool = await loadDuelWordPoolForLevels([level]);
  shuffleInPlace(pool);
  return pool;
}

/**
 * Creates `duels/{gameId}` with words for the chosen Goethe level, scores, and player uids.
 * player1 is the matcher; player2 was waiting in the queue.
 */
async function createRtdbDuelRoom(
  player1Uid: string,
  player2Uid: string,
  duelLevel: GoetheLevel,
): Promise<string> {
  const db = requireRtdb();
  const words = await pickWordsForDuelLevel(duelLevel);
  for (let a = 0; a < ROOM_ATTEMPTS; a++) {
    const gameId = randomFourDigitId();
    const duelRef = ref(db, `${DUELS}/${gameId}`);
    const snap = await get(duelRef);
    if (snap.exists()) continue;
    await set(duelRef, {
      words,
      player1_score: 0,
      player2_score: 0,
      player1_uid: player1Uid,
      player2_uid: player2Uid,
    });
    return gameId;
  }
  throw new Error('Could not allocate room id');
}

async function releaseMatcherLock(waiterId: string): Promise<void> {
  const db = requireRtdb();
  const r = ref(db, `${MATCHMAKING}/${waiterId}`);
  try {
    const snap = await get(r);
    const row = snap.val() as { duelLevel?: GoetheLevel } | null;
    await set(r, {
      userId: waiterId,
      status: 'waiting',
      ts: serverTimestamp(),
      ...(row?.duelLevel ? { duelLevel: row.duelLevel } : {}),
    });
  } catch {
    /* ignore */
  }
}

/**
 * Random matchmaking via Realtime Database `/matchmaking`.
 * Matcher gets { gameId, role: 'player1' }; waiter gets { gameId, role: 'player2' }.
 */
export async function findRandomMatch(
  currentUserId: string,
  duelLevel: GoetheLevel,
): Promise<{
  gameId: string;
  role: 'player1' | 'player2';
}> {
  if (!currentUserId.trim()) throw new Error('Empty currentUserId');
  if (!isFirebaseConfigured || !isFirebaseLive) throw new Error('offline');

  const db = requireRtdb();
  const mmRef = ref(db, MATCHMAKING);
  const mmSnap = await get(mmRef);
  const all = mmSnap.val() as
    | Record<
        string,
        {
          status?: string;
          userId?: string;
          gameId?: string;
          matcherId?: string;
          duelLevel?: GoetheLevel;
        }
      >
    | undefined;

  const waitingIds = Object.keys(all || {}).filter((id) => {
    if (id === currentUserId || all![id]?.status !== 'waiting') return false;
    return all![id]?.duelLevel === duelLevel;
  });
  shuffleInPlace(waitingIds);

  for (const waiterId of waitingIds) {
    const t = await runTransaction(ref(db, `${MATCHMAKING}/${waiterId}`), (cur) => {
      const row = cur as { status?: string; userId?: string } | null;
      if (row && row.status === 'waiting') {
        return { ...row, status: 'matching', matcherId: currentUserId };
      }
      return undefined;
    });

    if (!t.committed) continue;
    const after = t.snapshot.val() as { status?: string; matcherId?: string } | undefined;
    if (after?.status !== 'matching' || after?.matcherId !== currentUserId) continue;

    try {
      const gameId = await createRtdbDuelRoom(currentUserId, waiterId, duelLevel);
      await update(ref(db, `${MATCHMAKING}/${waiterId}`), {
        gameId,
        status: 'matched',
      });
      return { gameId, role: 'player1' };
    } catch (e) {
      await releaseMatcherLock(waiterId);
      throw e;
    }
  }

  const selfRef = ref(db, `${MATCHMAKING}/${currentUserId}`);
  await set(selfRef, {
    userId: currentUserId,
    status: 'waiting',
    ts: serverTimestamp(),
    duelLevel,
  });

  return new Promise((resolve, reject) => {
    const unsub = onValue(
      selfRef,
      (snap: DataSnapshot) => {
        const v = snap.val() as { gameId?: string } | null;
        const gid = v?.gameId;
        if (typeof gid === 'string' && gid.length > 0) {
          unsub();
          void remove(selfRef).catch(() => {});
          resolve({ gameId: gid, role: 'player2' });
        }
      },
      reject,
    );
  });
}

/* ── Private lobby helpers (Firebase RTDB /rooms/{code}) ─────────────── */

const ROOMS = 'rooms';

export type PrivateLobbyStatus = 'waiting' | 'ready' | 'game';

export interface PrivateLobby {
  status: PrivateLobbyStatus;
  host?: boolean;
  guest?: boolean;
  hostId?: string;
  guestId?: string;
  gameId?: string;
}

/** Returns a DatabaseReference for /rooms/{code}. */
function roomRef(code: string) {
  return ref(roomsDb, `${ROOMS}/${code}`);
}

/** Host: creates /rooms/{code} with status "waiting". */
export async function createPrivateLobby(code: string, hostId: string): Promise<void> {
  const path = `rooms/${code}`;
  console.log(`[PrivateDuel] HOST creating room at /${path}`, { hostId });
  try {
    await set(roomRef(code), {
      status: 'waiting',
      host: true,
      hostId,
      createdAt: serverTimestamp(),
    });
    console.log(`[PrivateDuel] HOST room created OK at /${path}`);
  } catch (err) {
    console.error(`[PrivateDuel] HOST failed to create room at /${path}`, err);
    throw err;
  }
}

/** Guest: reads /rooms/{code}, validates it is still open, then marks "ready". */
export async function joinPrivateLobby(code: string, guestId: string): Promise<void> {
  const path = `rooms/${code}`;
  console.log(`[PrivateDuel] GUEST joining room at /${path}`, { guestId });
  const snap = await get(roomRef(code));
  if (!snap.exists()) {
    console.error(`[PrivateDuel] GUEST room not found at /${path}`);
    throw new Error('Otaq tapılmadı');
  }
  const lobby = snap.val() as PrivateLobby;
  console.log(`[PrivateDuel] GUEST read room:`, lobby);
  if (lobby.status !== 'waiting') {
    console.error(`[PrivateDuel] GUEST room not open, status=${lobby.status}`);
    throw new Error('Otaq artıq doludur');
  }
  await update(roomRef(code), { status: 'ready', guest: true, guestId });
  console.log(`[PrivateDuel] GUEST wrote status=ready to /${path}`);
}

/** Subscribe to /rooms/{code} via onValue; returns the unsubscribe fn. */
export function watchPrivateLobby(
  code: string,
  cb: (lobby: PrivateLobby | null) => void,
): () => void {
  const path = `rooms/${code}`;
  console.log(`[PrivateDuel] Attaching onValue listener to /${path}`);
  return onValue(
    roomRef(code),
    (snap) => {
      const data = (snap.val() as PrivateLobby | null) ?? null;
      console.log(`[PrivateDuel] onValue fired for /${path}:`, data);
      cb(data);
    },
    (err) => {
      console.error(`[PrivateDuel] onValue error for /${path}:`, err);
    },
  );
}

/**
 * Host: creates the shared duel room, writes gameId back to /rooms/{code},
 * then schedules cleanup so the guest has time to read gameId.
 */
export async function activatePrivateLobby(
  code: string,
  hostId: string,
  guestId: string,
  duelLevel: GoetheLevel,
): Promise<string> {
  console.log(`[PrivateDuel] HOST activating room rooms/${code}`, { hostId, guestId, duelLevel });
  const gameId = await createRtdbDuelRoom(hostId, guestId, duelLevel);
  await update(roomRef(code), { status: 'game', gameId });
  console.log(`[PrivateDuel] HOST wrote status=game, gameId=${gameId}`);
  // Remove room after 8 s — gives guest time to read gameId
  window.setTimeout(() => void remove(roomRef(code)), 8000);
  return gameId;
}

/** Guest (or either side): explicitly removes /rooms/{code} once game is live. */
export function deletePrivateRoom(code: string): void {
  console.log(`[PrivateDuel] Removing room rooms/${code}`);
  void remove(roomRef(code));
}

/* ─────────────────────────────────────────────────────────────────────── */

export type DuelChatMessage = {
  key: string;
  senderId: string;
  text: string;
  /** Unix ms from server (RTDB serverTimestamp) */
  timestamp: number;
};

type DuelGameProps = {
  currentUserId: string;
  displayName: string;
  onExit: () => void;
  /** İlk açılış üçün default (localStorage boş olanda). */
  defaultDuelLevel?: GoetheLevel;
  /** When set, skips random matchmaking and joins this specific game. */
  initialMatch?: { gameId: string; role: 'player1' | 'player2' };
};

const MATCHMAKING_TIMEOUT_MS = 15_000;

export function DuelGame({
  currentUserId,
  displayName,
  onExit,
  defaultDuelLevel = 'A1',
  initialMatch,
}: DuelGameProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'tier' | 'idle' | 'matching' | 'play'>(initialMatch ? 'idle' : 'tier');
  const storeAvatar = useGameStore((s) => s.avatar);
  const coins = useGameStore((s) => s.coins);
  const [duelLevel, setDuelLevel] = useState<GoetheLevel>(() =>
    readStoredDuelLevel(defaultDuelLevel),
  );
  const duelBracket = useMemo(() => duelBracketForLevel(duelLevel), [duelLevel]);
  const duelTiers = useMemo(() => getDuelTiersForBracket(duelBracket), [duelBracket]);
  const [selectedTier, setSelectedTier] = useState<DuelTier>(() =>
    getDuelTiersForBracket(duelBracketForLevel(readStoredDuelLevel(defaultDuelLevel)))[0]!,
  );
  const [activeTier, setActiveTier] = useState<DuelTier | null>(null);

  useEffect(() => {
    persistDuelLevel(duelLevel);
  }, [duelLevel]);

  useEffect(() => {
    setSelectedTier((prev) => {
      const list = getDuelTiersForBracket(duelBracket);
      return list.find((tier) => tier.id === prev.id) ?? list[0]!;
    });
  }, [duelBracket]);
  const matchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const simulationRef = useRef(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [role, setRole] = useState<'player1' | 'player2' | null>(null);
  const [words, setWords] = useState<RtdbDuelWord[]>([]);
  const [idx, setIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(DUEL_DURATION_S);
  const [timesUp, setTimesUp] = useState(false);
  const timerIntervalRef = useRef<any>(null);
  /** Indices already shown in this session — never repeat. */
  const shownIdxsRef = useRef<Set<number>>(new Set());
  const [p1, setP1] = useState(0);
  const [p2, setP2] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const [picked, setPicked] = useState<Article | null>(null);

  const [messages, setMessages] = useState<DuelChatMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const chatListRef = useRef<HTMLDivElement>(null);
  const [opponentUid, setOpponentUid] = useState<string | null>(null);
  const [isFriend, setIsFriend] = useState(false);
  const [friendSent, setFriendSent] = useState(false);
  const [opponentProfile, setOpponentProfile] = useState<PublicPlayerProfile | null>(null);
  const [myProfile, setMyProfile] = useState<PublicPlayerProfile | null>(null);
  const scoresRef = useRef({ me: 0, opp: 0 });
  const statsRecordedRef = useRef(false);

  const current = words[idx] ?? null;
  const myScore = role === 'player1' ? p1 : role === 'player2' ? p2 : 0;
  const oppScore = role === 'player1' ? p2 : role === 'player2' ? p1 : 0;

  useEffect(() => {
    scoresRef.current = { me: myScore, opp: oppScore };
  }, [myScore, oppScore]);

  useEffect(() => {
    if (!isFirebaseLive || !displayName.trim()) return;
    void setPlayerProfileDisplayName(currentUserId, displayName.trim());
  }, [currentUserId, displayName]);

  useEffect(() => {
    return subscribeUserProfile(currentUserId, setMyProfile);
  }, [currentUserId]);

  const myLabel = displayName.trim() || t('duel.player_default');
  const myEmoji = avatarIdToEmoji(myProfile?.avatar ?? storeAvatar);
  const oppEmoji = avatarIdToEmoji(opponentProfile?.avatar);
  const oppLabel =
    opponentProfile?.displayName?.trim() ||
    (opponentUid
      ? t('duel.guest', { id: opponentUid.slice(0, 5) })
      : t('duel.opponent_fallback'));

  const startSimulatedMatch = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 550 + Math.random() * 450));
    const w = await pickWordsForDuelLevel(duelLevel);
    simulationRef.current = true;
    shownIdxsRef.current = new Set();
    setWords(w);
    setGameId('sim');
    setRole('player1');
    setOpponentUid('sim_rival');
    const av = PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)]?.id ?? 'pretzel';
    setOpponentProfile({ displayName: t('duel.training_partner'), avatar: av });
    setP1(0);
    setP2(0);
    setIdx(0);
    setTimeLeft(DUEL_DURATION_S);
    setTimesUp(false);
    setAnswered(false);
    setPicked(null);
    setPhase('play');
  }, [t, duelLevel]);

  /* Auto-start when an initialMatch is provided (private duel) */
  useEffect(() => {
    if (!initialMatch) return;
    const { gameId: gid, role: r } = initialMatch;
    setGameId(gid);
    setRole(r);
    if (gid === 'sim') {
      simulationRef.current = true;
      void (async () => {
        const w = await pickWordsForDuelLevel(duelLevel);
        shownIdxsRef.current = new Set();
        setWords(w);
        setOpponentUid('sim_rival');
        const av = PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)]?.id ?? 'pretzel';
        setOpponentProfile({ displayName: t('duel.training_partner'), avatar: av });
        setP1(0); setP2(0); setIdx(0);
        setTimeLeft(DUEL_DURATION_S); setTimesUp(false);
        setAnswered(false); setPicked(null);
        setPhase('play');
      })();
      return;
    }
    simulationRef.current = false;
    setPhase('matching');
    void (async () => {
      try {
        const snap = await get(ref(requireRtdb(), `${DUELS}/${gid}`));
        const data = snap.val() as { words?: RtdbDuelWord[] } | null;
        setWords(Array.isArray(data?.words) ? data!.words! : []);
        shownIdxsRef.current = new Set();
        setTimeLeft(DUEL_DURATION_S); setTimesUp(false);
        setPhase('play'); setIdx(0); setAnswered(false); setPicked(null);
      } catch {
        // Firebase unavailable — fall back to simulation
        const w = await pickWordsForDuelLevel(duelLevel);
        simulationRef.current = true;
        shownIdxsRef.current = new Set();
        setWords(w); setGameId('sim');
        const av = PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)]?.id ?? 'pretzel';
        setOpponentUid('sim_rival');
        setOpponentProfile({ displayName: t('duel.training_partner'), avatar: av });
        setP1(0); setP2(0); setIdx(0);
        setTimeLeft(DUEL_DURATION_S); setTimesUp(false);
        setAnswered(false); setPicked(null);
        setPhase('play');
      }
    })();
  }, [initialMatch?.gameId, initialMatch?.role, duelLevel, t]);

  const startMatch = async () => {
    const tier = selectedTier;
    const ok = useGameStore.getState().spendCoins(tier.entryFee);
    if (!ok) return;
    setActiveTier(tier);
    setPhase('matching');

    const canMatchOnline = isFirebaseConfigured && isFirebaseLive;
    if (!canMatchOnline) {
      await startSimulatedMatch();
      return;
    }

    let settled = false;
    const matchPromise = (async () => {
      try {
        simulationRef.current = false;
        const { gameId: gid, role: r } = await findRandomMatch(currentUserId, duelLevel);
        if (settled) return;
        settled = true;
        if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
        setGameId(gid);
        setRole(r);
        const snap = await get(ref(requireRtdb(), `${DUELS}/${gid}`));
        const data = snap.val() as { words?: RtdbDuelWord[] } | null;
        setWords(Array.isArray(data?.words) ? data!.words! : []);
        shownIdxsRef.current = new Set();
        setTimeLeft(DUEL_DURATION_S);
        setTimesUp(false);
        setPhase('play');
        setIdx(0);
        setAnswered(false);
        setPicked(null);
      } catch {
        if (!settled) {
          settled = true;
          if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
          await startSimulatedMatch();
        }
      }
    })();

    matchTimeoutRef.current = setTimeout(() => {
      matchTimeoutRef.current = null;
      if (!settled) {
        settled = true;
        try {
          void remove(ref(requireRtdb(), `${MATCHMAKING}/${currentUserId}`)).catch(() => {});
        } catch {
          /* ignore */
        }
        void startSimulatedMatch();
      }
    }, MATCHMAKING_TIMEOUT_MS);

    await matchPromise;
  };

  useEffect(() => {
    if (!rtdb || !gameId || gameId === 'sim' || phase !== 'play') return;
    const duelRef = ref(rtdb, `${DUELS}/${gameId}`);
    const unsub = onValue(duelRef, (snap) => {
      const v = snap.val() as {
        player1_score?: number;
        player2_score?: number;
        player1_uid?: string;
        player2_uid?: string;
      } | null;
      setP1(typeof v?.player1_score === 'number' ? v.player1_score : 0);
      setP2(typeof v?.player2_score === 'number' ? v.player2_score : 0);
      const p1u = typeof v?.player1_uid === 'string' ? v.player1_uid : '';
      const p2u = typeof v?.player2_uid === 'string' ? v.player2_uid : '';
      if (currentUserId === p1u && p2u) setOpponentUid(p2u);
      else if (currentUserId === p2u && p1u) setOpponentUid(p1u);
      else setOpponentUid(null);
    });
    return unsub;
  }, [gameId, phase, currentUserId]);

  useEffect(() => {
    setOpponentUid(null);
    setFriendSent(false);
    setIsFriend(false);
    setOpponentProfile(null);
    statsRecordedRef.current = false;
  }, [gameId]);

  useEffect(() => {
    if (!rtdb || !opponentUid || opponentUid === 'sim_rival') {
      setIsFriend(false);
      return;
    }
    const fr = ref(rtdb, `users/${currentUserId}/friends/${opponentUid}`);
    const unsub = onValue(fr, (snap) => setIsFriend(snap.exists()));
    return unsub;
  }, [currentUserId, opponentUid]);

  useEffect(() => {
    if (!opponentUid) {
      setOpponentProfile(null);
      return;
    }
    if (opponentUid === 'sim_rival') return;
    return subscribeUserProfile(opponentUid, setOpponentProfile);
  }, [opponentUid]);

  const settleCoins = useCallback(() => {
    if (!statsRecordedRef.current) {
      statsRecordedRef.current = true;
      const { me, opp } = scoresRef.current;
      const won = me > opp;
      const draw = me === opp;
      if (simulationRef.current || gameId === 'sim') {
        useGameStore.getState().recordDuelFinish(won, me);
      } else if (gameId) {
        void recordOnlineDuelFinished(currentUserId, won);
      }
      if (activeTier) {
        if (won) {
          vibrateCoinReward();
          useGameStore.getState().earnCoins(activeTier.prize);
        } else if (draw) {
          vibrateCoinReward();
          useGameStore.getState().earnCoins(activeTier.entryFee);
        }
      }
    }
  }, [gameId, currentUserId, activeTier]);

  const exitOnlineDuel = () => {
    if (phase === 'play') settleCoins();
    if (phase === 'matching' && activeTier) {
      vibrateCoinReward();
      useGameStore.getState().earnCoins(activeTier.entryFee);
    }
    if (matchTimeoutRef.current) clearTimeout(matchTimeoutRef.current);
    simulationRef.current = false;
    onExit();
  };

  useEffect(() => {
    if (phase !== 'play') return;
    setUserActivity(currentUserId, 'in_game');
    return () => setUserActivity(currentUserId, 'menu');
  }, [phase, currentUserId]);

  useEffect(() => {
    if (!rtdb || !gameId || gameId === 'sim' || phase !== 'play') return;
    setMessages([]);
    const messagesRef = ref(rtdb, `${DUELS}/${gameId}/messages`);
    const unsub = onChildAdded(messagesRef, (snapshot) => {
      const key = snapshot.key ?? '';
      const val = snapshot.val() as { senderId?: string; text?: string; timestamp?: unknown };
      const rawTs = val.timestamp;
      const ts = typeof rawTs === 'number' && !Number.isNaN(rawTs) ? rawTs : Date.now();
      setMessages((prev) => {
        if (prev.some((m) => m.key === key)) return prev;
        const next: DuelChatMessage[] = [
          ...prev,
          {
            key,
            senderId: typeof val.senderId === 'string' ? val.senderId : '',
            text: typeof val.text === 'string' ? val.text : '',
            timestamp: ts,
          },
        ];
        next.sort((a, b) => a.timestamp - b.timestamp);
        return next;
      });
    });
    return unsub;
  }, [gameId, phase]);

  useEffect(() => {
    const el = chatListRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || !gameId) return;
      try {
        const db = requireRtdb();
        void push(ref(db, `${DUELS}/${gameId}/messages`), {
        senderId: currentUserId,
        text: trimmed,
        timestamp: serverTimestamp(),
        });
      } catch {
        /* Firebase unavailable */
      }
    },
    [gameId, currentUserId],
  );

  const bumpMyScore = useCallback(async () => {
    if (!gameId || !role) return;
    if (simulationRef.current || gameId === 'sim') {
      if (role === 'player1') setP1((x) => x + 1);
      else setP2((x) => x + 1);
      return;
    }
    try {
      const db = requireRtdb();
      const key = role === 'player1' ? 'player1_score' : 'player2_score';
      await update(ref(db, `${DUELS}/${gameId}`), { [key]: increment(1) });
    } catch {
      /* ignore */
    }
  }, [gameId, role]);

  /** Training bot: random delay per tier, imperfect accuracy; score updates right after each "answer". */
  useEffect(() => {
    if (gameId !== 'sim' || phase !== 'play' || timesUp) return;

    let cancelled = false;
    let timeoutId: number | null = null;

    const bumpOpponent = () => {
      if (role === 'player2') setP1((x) => x + 1);
      else setP2((x) => x + 1);
    };

    const scheduleNext = () => {
      const { minMs, maxMs } = simBotDelayRangeMs(activeTier);
      const delay = randomMsInRange(minMs, maxMs);
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        if (cancelled) return;
        if (Math.random() >= simBotWrongChance(activeTier)) bumpOpponent();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [gameId, phase, activeTier, role, timesUp]);

  /** 60-second countdown — starts when game begins, ends game when it hits 0. */
  useEffect(() => {
    if (phase !== 'play' || timesUp) {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      return;
    }
    // @ts-ignore
    timerIntervalRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          if (rtdb && gameId && gameId !== 'sim') {
            update(ref(rtdb, `${DUELS}/${gameId}`), {
              status: 'finished',
              endedAt: serverTimestamp(),
            }).catch(() => {});
          }
          setTimesUp(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [phase, timesUp]);

  const handlePick = async (a: Article) => {
    if (!current || answered || !gameId || !role || timesUp) return;
    setPicked(a);
    setAnswered(true);
    const ok = a === current.article;
    setWasCorrect(ok);
    if (ok) {
      vibrateCorrectAnswer();
      await bumpMyScore();
    } else {
      vibrateWrongAnswer();
    }
    window.setTimeout(() => {
      setAnswered(false);
      setPicked(null);
      // Mark current index as shown — never revisit it this session
      shownIdxsRef.current.add(idx);
      const unseen = words.map((_, i) => i).filter((i) => !shownIdxsRef.current.has(i));
      // Pick randomly from remaining unseen words
      setIdx(unseen[Math.floor(Math.random() * unseen.length)] ?? idx);
    }, 650);
  };

  const btnMode = (a: Article): ArticleBtnMode => {
    if (!answered || !current) return 'idle';
    if (a === current.article) return wasCorrect ? 'correct' : 'reveal';
    return picked === a ? 'wrong' : 'idle';
  };

  const summary = useMemo(() => {
    if (!gameId) return '';
    if (gameId === 'sim') {
      return t('duel.summary_quick', { name: myLabel });
    }
    const side = role === 'player1' ? t('duel.role_p1') : role === 'player2' ? t('duel.role_p2') : '';
    return t('duel.summary_room', {
      id: gameId,
      role: side,
      you: myLabel,
      opp: opponentUid ? oppLabel : t('duel.opponent_ellipsis'),
    });
  }, [gameId, role, myLabel, opponentUid, oppLabel, t]);

  if (phase === 'tier' || phase === 'idle') {
    const canAfford = coins >= selectedTier.entryFee;
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center px-4 pb-32 pt-[max(0px,env(safe-area-inset-top))]"
        style={{ background: 'var(--artikl-bg)' }}
      >
        <div className="w-full max-w-[400px] rounded-[22px] border border-[rgba(168,85,247,0.3)] bg-gradient-to-b from-[rgba(124,108,248,0.16)] via-[rgba(18,18,28,0.95)] to-[rgba(12,12,18,0.99)] px-6 py-8 text-center shadow-[0_20px_56px_rgba(0,0,0,0.55),0_0_80px_rgba(124,108,248,0.12)]">
          {/* Artik balance */}
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 rounded-full border border-amber-400/30 bg-amber-500/10 px-4 py-1.5">
            <span className="font-mono text-lg font-bold tabular-nums text-[#7C3AED] dark:text-amber-200">
              {t('common.balance_display', { amount: coins })}
            </span>
          </div>

          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d4c4ff]/90">⚔️ {t('duel.pvp_title')}</p>
          <h1 className="mt-2 font-display text-xl font-bold text-artikl-text sm:text-2xl">{t('duel.choose_tier')}</h1>
          <p className="mt-2 text-[12px] leading-relaxed text-artikl-muted2">
            {t('duel.tier_hint')}
          </p>

          <p className="mt-5 text-[10px] font-semibold uppercase tracking-wider text-artikl-caption">
            {t('duel.word_level')}
          </p>
          <p className="mt-1 text-[11px] leading-snug text-artikl-caption">
            {t('duel.word_level_hint')}
          </p>
          <div
            className="mt-3 flex flex-wrap justify-center gap-1.5"
            role="radiogroup"
            aria-label={t('duel.word_level')}
          >
            {GOETHE_LEVELS.map((lvl) => {
              const on = duelLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setDuelLevel(lvl)}
                  className={[
                    'min-w-[2.75rem] rounded-lg px-2.5 py-2 text-xs font-bold tabular-nums transition-all',
                    on
                      ? 'border-2 border-violet-400/80 bg-violet-500/25 text-white shadow-[0_0_16px_rgba(139,92,246,0.25)]'
                      : 'border border-[var(--artikl-border2)] bg-[var(--artikl-surface)] text-artikl-muted2 hover:border-white/[0.22] hover:bg-white/[0.08]',
                  ].join(' ')}
                >
                  {lvl}
                </button>
              );
            })}
          </div>

          {/* Tier cards */}
          <div className="mt-5 flex flex-col gap-3">
            {duelTiers.map((tier) => {
              const active = selectedTier.id === tier.id;
              const affordable = coins >= tier.entryFee;
              const tierIcons: Record<string, string> = { sade: '🎯', ciddi: '🔥', ekspert: '💎' };
              return (
                <button
                  key={tier.id}
                  type="button"
                  disabled={!affordable}
                  onClick={() => setSelectedTier(tier)}
                  className={[
                    'relative flex items-center gap-4 rounded-2xl px-4 py-4 text-left transition-all',
                    active && affordable
                      ? 'border-2 border-purple-400/70 bg-gradient-to-r from-purple-500/20 via-purple-900/15 to-fuchsia-900/10 shadow-[0_0_28px_rgba(168,85,247,0.25)]'
                      : affordable
                        ? 'border border-[var(--artikl-border2)] bg-[var(--artikl-surface)] hover:border-white/[0.2] hover:bg-white/[0.08]'
                        : 'border border-[var(--artikl-border)] bg-white/[0.02] cursor-not-allowed opacity-40',
                  ].join(' ')}
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--artikl-surface2)] text-2xl">
                    {tierIcons[tier.id] ?? '⚔️'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${active && affordable ? 'text-white' : 'text-artikl-text'}`}>
                      {t(`duel.tier_${tier.id}`)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-artikl-caption">
                      {t('duel.entry_fee')}: {t('common.amount_artik', { amount: tier.entryFee })}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-artikl-caption">
                      {t('duel.prize')}
                    </p>
                    <p className="font-mono text-lg font-bold tabular-nums text-[#F59E0B]">
                      {t('common.amount_artik', { amount: tier.prize })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {!canAfford && (
            <p className="mt-3 text-[11px] font-medium text-rose-400/80">{t('duel.not_enough_coins')}</p>
          )}

          {/* Fund preview */}
          <div className="mt-4 rounded-xl border border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-artikl-caption">{t('duel.total_fund')}</p>
            <p className="mt-0.5 font-mono text-xl font-bold tabular-nums text-[#7C3AED] dark:text-[#F59E0B]">
              {t('common.amount_artik', { amount: selectedTier.prize })}
            </p>
          </div>

          <button
            type="button"
            disabled={!canAfford}
            onClick={() => void startMatch()}
            className="mt-6 w-full rounded-xl border-2 border-purple-600 bg-purple-600 py-3.5 text-sm font-bold text-white shadow-[0_10px_36px_rgba(168,85,247,0.35)] transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:border-purple-200 disabled:bg-purple-200 disabled:text-[#9CA3AF] dark:border-transparent dark:bg-gradient-to-r dark:from-[#7c6cf8] dark:via-[#a855f7] dark:to-[#c44fd9] dark:disabled:opacity-35"
          >
            {t('duel.find_opponent_btn')} — {t('common.amount_artik', { amount: selectedTier.entryFee })}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 text-[13px] font-medium text-artikl-caption underline-offset-4 transition-colors hover:text-artikl-text"
          >
            {t('duel.back_to_duel')}
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'matching') {
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 pb-32"
        style={{ background: 'var(--artikl-bg)' }}
      >
        {/* Pulsing search animation */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-24 w-24 animate-ping rounded-full bg-purple-500/10" />
          <div className="absolute h-16 w-16 animate-pulse rounded-full bg-purple-500/20 shadow-[0_0_40px_rgba(168,85,247,0.25)]" />
          <span className="relative text-4xl">⚔️</span>
        </div>
        <p className="text-sm font-bold text-[rgba(240,238,255,0.9)]">{t('duel.searching')}</p>
        <p className="text-[11px] text-artikl-caption">{t('duel.searching_hint')}</p>
        {activeTier && (
          <div className="rounded-full border border-amber-400/25 bg-amber-500/10 px-3 py-1">
            <span className="text-[11px] font-bold tabular-nums text-[#7C3AED] dark:text-amber-200">
              {t('duel.prize')}: {t('common.amount_artik', { amount: activeTier.prize })}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] justify-center pb-36 pt-[max(0px,env(safe-area-inset-top))]"
      style={{ background: 'var(--artikl-bg)' }}
    >
      <div className="artikl-scene w-full max-w-[420px]">
        <div className="px-4 pt-3">
          <p className="text-center text-[10px] text-[var(--artikl-muted)]">{summary}</p>

          {/* ── Countdown timer ── */}
          <div className="mt-2 flex items-center justify-center gap-1.5">
            <span
              className={`font-mono text-2xl font-bold tabular-nums transition-colors ${
                timeLeft <= 10
                  ? 'animate-pulse text-rose-400'
                  : timeLeft <= 20
                  ? 'text-[#7C3AED] dark:text-amber-400'
                  : 'text-[#4B5563] dark:text-artikl-text/60'
              }`}
            >
              0:{String(timeLeft).padStart(2, '0')}
            </span>
          </div>

          {/* Fund indicator */}
          {activeTier && (
            <div className="mt-2 flex items-center justify-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#4B5563] dark:text-amber-400/70">
                {t('duel.prize')}:
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-[#7C3AED] dark:text-[#F59E0B]">
                {t('common.amount_artik', { amount: activeTier.prize })}
              </span>
            </div>
          )}

          {/* Split-screen player panels */}
          <div className="mt-3 flex items-stretch justify-between gap-3">
            {/* Player (purple/neon) */}
            <div className="min-w-0 flex-1 rounded-xl border border-purple-400/30 bg-gradient-to-br from-purple-500/15 to-purple-900/10 px-3 py-2.5 shadow-[0_0_20px_rgba(168,85,247,0.1),inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-300/90">
                {t('duel.online_you')}
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-500/10 text-2xl shadow-[0_4px_16px_rgba(168,85,247,0.2)]"
                  title={myLabel}
                >
                  {myEmoji}
                </span>
                <p className="min-w-0 truncate text-[13px] font-bold leading-tight text-artikl-text">{myLabel}</p>
              </div>
              {/* Progress bar */}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--artikl-surface2)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-purple-500 to-fuchsia-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (myScore / Math.max(1, myScore + oppScore)) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-artikl-text">{myScore}</p>
            </div>
            {/* Opponent (red/neon) */}
            <div className="min-w-0 flex-1 rounded-xl border border-rose-400/25 bg-gradient-to-bl from-rose-500/12 to-rose-900/8 px-3 py-2.5 text-right shadow-[0_0_20px_rgba(244,63,94,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300/90">
                {t('duel.online_opponent')}
              </span>
              <div className="mt-1.5 flex flex-row-reverse items-center gap-2">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-rose-400/20 bg-rose-500/10 text-2xl shadow-[0_4px_16px_rgba(244,63,94,0.15)]"
                  title={opponentUid ?? oppLabel}
                >
                  {opponentUid ? oppEmoji : t('duel.opponent_avatar_placeholder')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-tight text-artikl-text">{oppLabel}</p>
                  {opponentUid && opponentUid !== 'sim_rival' ? (
                    <p className="truncate font-mono text-[8px] text-artikl-text/35" title={opponentUid}>
                      {opponentUid}
                    </p>
                  ) : null}
                </div>
              </div>
              {opponentUid === 'sim_rival' ? (
                <p className="mt-1 text-[9px] text-[var(--artikl-muted)]">{t('duel.auto_matched')}</p>
              ) : opponentUid ? (
                isFriend ? (
                  <p className="mt-1 text-[9px] font-medium text-emerald-400/90">{t('duel.already_friends')}</p>
                ) : (
                  <button
                    type="button"
                    disabled={friendSent}
                    onClick={() => {
                      void sendFriendRequest(
                        currentUserId,
                        opponentUid,
                        myLabel,
                        myProfile?.avatar ?? storeAvatar,
                      ).then(() => setFriendSent(true));
                    }}
                    className="mt-1 rounded-lg border border-[rgba(244,63,94,0.35)] bg-[rgba(244,63,94,0.12)] px-2 py-1 text-[9px] font-semibold text-rose-300 transition-colors hover:border-[rgba(244,63,94,0.5)] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {friendSent ? t('duel.request_sent') : t('duel.add_friend')}
                  </button>
                )
              ) : (
                <p className="mt-1 text-[9px] text-[var(--artikl-muted)]">{t('duel.waiting_uid')}</p>
              )}
              {/* Opponent progress bar */}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--artikl-surface2)]">
                <div
                  className="ml-auto h-full rounded-full bg-gradient-to-l from-rose-500 to-red-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (oppScore / Math.max(1, myScore + oppScore)) * 100)}%` }}
                />
              </div>
              <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-artikl-text">{oppScore}</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-6 text-center">
          {current ? (
            <>
              <p className="text-[10px] uppercase tracking-wider text-[var(--artikl-muted2)]">
                {t('duel.word_n_of_m', { n: idx + 1, m: words.length })}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                <p className="font-mono text-[clamp(1.25rem,6vw,2rem)] font-semibold text-artikl-text">
                  {current.word}
                </p>
                <SpeakWordButton word={current.word} className="text-[clamp(1rem,4vw,1.5rem)]" />
              </div>
            </>
          ) : (
            <p className="text-sm text-[var(--artikl-muted2)]">{t('duel.online_no_words')}</p>
          )}
        </div>

        <div className="artikl-btns px-2">
          {(['der', 'die', 'das'] as const).map((a) => (
            <ArticleButton
              key={a}
              article={a}
              mode={btnMode(a)}
              disabled={answered}
              onPick={(a) => {
                void handlePick(a);
              }}
            />
          ))}
        </div>

        {gameId === 'sim' ? (
          <div className="mx-4 mt-4 mb-2 rounded-2xl border-[0.5px] border-white/[0.09] bg-[var(--artikl-surface)] px-3 py-5 backdrop-blur-[8px]">
            <p className="text-center text-[11px] leading-relaxed text-[var(--artikl-muted)]">
              {t('duel.no_chat_training')}
            </p>
          </div>
        ) : (
          <div className="mx-4 mt-4 mb-2 flex min-h-0 flex-1 flex-col rounded-2xl border-[0.5px] border-white/[0.09] bg-[var(--artikl-surface)] backdrop-blur-[8px]">
            <p className="border-b border-[var(--artikl-border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--artikl-muted2)]">
              {t('duel.chat')}
            </p>
            <div
              ref={chatListRef}
              className="max-h-[min(11rem,28dvh)] min-h-[6.5rem] space-y-2 overflow-y-auto px-3 py-2"
            >
              {messages.length === 0 ? (
                <p className="text-center text-[11px] text-[var(--artikl-muted)]">
                  {t('duel.chat_empty')}
                </p>
              ) : (
                messages.map((m) => {
                  const mine = m.senderId === currentUserId;
                  const time =
                    m.timestamp > 0
                      ? new Date(m.timestamp).toLocaleTimeString(undefined, {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '';
                  return (
                    <div
                      key={m.key}
                      className={`flex flex-col ${mine ? 'items-end' : 'items-start'}`}
                    >
                      <span className="mb-0.5 text-[9px] text-[var(--artikl-muted)]">
                        {mine ? `${myEmoji} ${myLabel}` : `${oppEmoji} ${oppLabel}`}
                        {time ? ` ${t('duel.chat_time_dot')} ${time}` : ''}
                      </span>
                      <div
                        className={[
                          'max-w-[92%] rounded-2xl px-2.5 py-1.5 text-[12px] leading-snug',
                          mine
                            ? 'rounded-br-md bg-[rgba(124,108,248,0.14)] text-[var(--artikl-text)] ring-1 ring-[rgba(124,108,248,0.28)]'
                            : 'rounded-bl-md bg-[var(--artikl-surface2)] text-[rgba(240,238,255,0.88)] ring-1 ring-white/[0.06]',
                        ].join(' ')}
                      >
                        {m.text}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <form
              className="flex items-center gap-2 border-t border-[var(--artikl-border)] p-2"
              onSubmit={(e) => {
                e.preventDefault();
                sendMessage(chatDraft);
                setChatDraft('');
              }}
            >
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder={t('duel.message_placeholder')}
                maxLength={280}
                className="min-w-0 flex-1 rounded-xl border-[0.5px] border-[var(--artikl-border)] bg-[var(--artikl-surface)] px-3 py-2 text-[13px] text-[var(--artikl-text)] outline-none placeholder:text-[var(--artikl-muted)] focus:border-[var(--artikl-accent)]/45"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={!chatDraft.trim()}
                title={t('duel.send_aria')}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--artikl-accent)] text-base text-white shadow-[0_4px_18px_rgba(124,108,248,0.28)] transition-transform hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35 active:scale-[0.97]"
              >
                {t('duel.send_emoji')}
              </button>
            </form>
          </div>
        )}

        <button
          type="button"
          onClick={exitOnlineDuel}
          className="mx-auto mt-4 block text-xs text-[var(--artikl-muted2)] underline-offset-2 hover:underline"
        >
          {t('duel.exit')}
        </button>
      </div>

      {/* ── Times-up result overlay ── */}
      {timesUp && (() => {
        settleCoins();
        const won = myScore > oppScore;
        const draw = myScore === oppScore;
        const prize = activeTier?.prize ?? 0;
        const entryFee = activeTier?.entryFee ?? 0;
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 px-4 backdrop-blur-md">
            <div
              className={[
                'duel-result-card w-full max-w-sm rounded-2xl border p-6 text-center shadow-2xl',
                won
                  ? 'border-emerald-400/30 bg-gradient-to-b from-[rgba(16,185,129,0.12)] via-[rgba(18,18,28,0.98)] to-[rgba(12,12,18,0.99)] shadow-[0_0_60px_rgba(16,185,129,0.15)]'
                  : draw
                    ? 'border-amber-400/25 bg-gradient-to-b from-[rgba(245,158,11,0.08)] via-[rgba(18,18,28,0.98)] to-[rgba(12,12,18,0.99)]'
                    : 'border-rose-400/25 bg-gradient-to-b from-[rgba(244,63,94,0.10)] via-[rgba(18,18,28,0.98)] to-[rgba(12,12,18,0.99)]',
              ].join(' ')}
            >
              <p className="text-4xl">{won ? '🏆' : draw ? '🤝' : '😞'}</p>
              <h2 className="mt-2 font-display text-2xl font-bold text-artikl-text">
                {won ? t('duel.victory') : draw ? t('duel.draw') : t('duel.defeat')}
              </h2>

              {/* Inspirational congratulations for winner */}
              {won && activeTier && (
                <p className="mt-3 text-[13px] leading-relaxed text-emerald-200/80">
                  {t('duel.victory_congrats', { amount: prize })}
                </p>
              )}

              <div className="mt-5 flex items-center justify-center gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/80">
                    {myLabel}
                  </p>
                  <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-artikl-text">
                    {myScore}
                  </p>
                </div>
                <span className="text-2xl text-artikl-text/20">:</span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-rose-300/80">
                    {oppLabel}
                  </p>
                  <p className="mt-1 font-mono text-4xl font-bold tabular-nums text-artikl-text">
                    {oppScore}
                  </p>
                </div>
              </div>

              {/* Coin reward / loss */}
              {activeTier && (
                <div className={[
                  'mx-auto mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2',
                  won
                    ? 'border border-emerald-400/35 bg-emerald-500/15 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                    : draw
                      ? 'border border-amber-400/25 bg-amber-500/10'
                      : 'border border-rose-400/25 bg-rose-500/10',
                ].join(' ')}>
                  <span className="text-xl" aria-hidden>
                    🪙
                  </span>
                  <span
                    className={[
                      'font-mono text-lg font-bold tabular-nums',
                      won ? 'text-emerald-300' : draw ? 'text-[#F59E0B]' : 'text-rose-300',
                    ].join(' ')}
                  >
                    {won
                      ? t('common.plus_amount_artik', { amount: prize })
                      : draw
                        ? t('common.plus_amount_artik', { amount: entryFee })
                        : t('common.minus_amount_artik', { amount: entryFee })}
                  </span>
                  <span className="text-[10px] text-artikl-caption">
                    {won ? t('duel.winner_prize') : draw ? t('duel.draw_refund') : t('duel.entry_lost')}
                  </span>
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    statsRecordedRef.current = false;
                    shownIdxsRef.current = new Set();
                    setTimeLeft(DUEL_DURATION_S);
                    setTimesUp(false);
                    setP1(0);
                    setP2(0);
                    setIdx(0);
                    setAnswered(false);
                    setPicked(null);
                    setPhase('tier');
                    setActiveTier(null);
                  }}
                  className="w-full rounded-xl border-2 border-purple-600 bg-purple-600 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(168,85,247,0.35)] transition-transform active:scale-[0.98] dark:border-transparent dark:bg-gradient-to-r dark:from-[#7c6cf8] dark:via-[#a855f7] dark:to-[#c44fd9]"
                >
                  {t('duel.again')} ⚔️
                </button>
                <button
                  type="button"
                  onClick={exitOnlineDuel}
                  className="w-full rounded-xl border border-[var(--artikl-border2)] py-3 text-sm font-semibold text-artikl-text"
                >
                  {t('duel.exit')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
