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
import type { Article } from '../types';
import { isFirebaseConfigured, isFirebaseLive, requireRtdb, rtdb } from '../lib/firebase';
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
import { useGameStore } from '../store/useGameStore';
import { ArticleButton, type ArticleBtnMode } from './quiz/ArticleButton';

const DUELS = 'duels';
const MATCHMAKING = 'matchmaking';
const WORDS_COUNT = 10;
const ROOM_ATTEMPTS = 40;

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

async function loadA1Words(): Promise<RtdbDuelWord[]> {
  const base = import.meta.env.BASE_URL ?? '/';
  const trimmed = base.endsWith('/') ? base : `${base}/`;
  const res = await fetch(`${trimmed}goethe-lexicon.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`goethe-lexicon.json: ${res.status}`);
  const data = (await res.json()) as LexiconRoot;
  const a1 = data.A1;
  if (!Array.isArray(a1) || a1.length === 0) throw new Error('No A1 words in lexicon');
  return a1
    .filter(
      (w): w is LexiconRow =>
        typeof w?.id === 'string' &&
        typeof w?.word === 'string' &&
        (w.article === 'der' || w.article === 'die' || w.article === 'das'),
    )
    .map((w) => {
      const az = w.translations?.az?.trim();
      return {
        id: w.id,
        article: w.article,
        word: w.word,
        translation: az || w.translation,
        ...(w.category ? { category: w.category } : {}),
      };
    });
}

async function pickWords(): Promise<RtdbDuelWord[]> {
  const pool = await loadA1Words();
  if (pool.length < WORDS_COUNT) throw new Error(`Need at least ${WORDS_COUNT} A1 words`);
  shuffleInPlace(pool);
  return pool.slice(0, WORDS_COUNT);
}

/**
 * Creates `duels/{gameId}` with A1 words, scores, and player uids.
 * player1 is the matcher; player2 was waiting in the queue.
 */
async function createRtdbDuelRoom(player1Uid: string, player2Uid: string): Promise<string> {
  const db = requireRtdb();
  const words = await pickWords();
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
    await set(r, { userId: waiterId, status: 'waiting', ts: serverTimestamp() });
  } catch {
    /* ignore */
  }
}

/**
 * Random matchmaking via Realtime Database `/matchmaking`.
 * Matcher gets { gameId, role: 'player1' }; waiter gets { gameId, role: 'player2' }.
 */
export async function findRandomMatch(currentUserId: string): Promise<{
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
        }
      >
    | undefined;

  const waitingIds = Object.keys(all || {}).filter(
    (id) => id !== currentUserId && all![id]?.status === 'waiting',
  );
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
      const gameId = await createRtdbDuelRoom(currentUserId, waiterId);
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

/* ── Private lobby helpers ───────────────────────────────────────────── */

const PRIVATE_LOBBIES = 'private-lobbies';

export type PrivateLobbyStatus = 'waiting' | 'ready' | 'game';

export interface PrivateLobby {
  hostId: string;
  status: PrivateLobbyStatus;
  guestId?: string;
  gameId?: string;
}

const lsPrivateKey = (code: string) => `duel-private-${code}`;

export async function createPrivateLobby(code: string, hostId: string): Promise<void> {
  const data: PrivateLobby = { hostId, status: 'waiting' };
  if (isFirebaseConfigured && isFirebaseLive) {
    const db = requireRtdb();
    await set(ref(db, `${PRIVATE_LOBBIES}/${code}`), { ...data, createdAt: serverTimestamp() });
  } else {
    try { localStorage.setItem(lsPrivateKey(code), JSON.stringify(data)); } catch { /* ignore */ }
  }
}

export async function joinPrivateLobby(code: string, guestId: string): Promise<void> {
  if (isFirebaseConfigured && isFirebaseLive) {
    const db = requireRtdb();
    const lobbyRef = ref(db, `${PRIVATE_LOBBIES}/${code}`);
    const snap = await get(lobbyRef);
    if (!snap.exists()) throw new Error('Otaq tapılmadı');
    const lobby = snap.val() as PrivateLobby;
    if (lobby.status !== 'waiting') throw new Error('Otaq artıq doludur');
    await update(lobbyRef, { guestId, status: 'ready' });
  } else {
    const raw = localStorage.getItem(lsPrivateKey(code));
    if (!raw) throw new Error('Otaq tapılmadı');
    const lobby = JSON.parse(raw) as PrivateLobby;
    if (lobby.status !== 'waiting') throw new Error('Otaq artıq doludur');
    localStorage.setItem(lsPrivateKey(code), JSON.stringify({ ...lobby, guestId, status: 'ready' }));
  }
}

export function watchPrivateLobby(
  code: string,
  cb: (lobby: PrivateLobby | null) => void,
): () => void {
  if (isFirebaseConfigured && isFirebaseLive) {
    const db = requireRtdb();
    return onValue(ref(db, `${PRIVATE_LOBBIES}/${code}`), (snap) => {
      cb((snap.val() as PrivateLobby | null) ?? null);
    });
  }
  const id = window.setInterval(() => {
    try {
      const raw = localStorage.getItem(lsPrivateKey(code));
      cb(raw ? (JSON.parse(raw) as PrivateLobby) : null);
    } catch { cb(null); }
  }, 500);
  return () => clearInterval(id);
}

export async function activatePrivateLobby(
  code: string,
  hostId: string,
  guestId: string,
): Promise<string> {
  if (isFirebaseConfigured && isFirebaseLive) {
    const gameId = await createRtdbDuelRoom(hostId, guestId);
    const db = requireRtdb();
    await update(ref(db, `${PRIVATE_LOBBIES}/${code}`), { status: 'game', gameId });
    return gameId;
  }
  const raw = localStorage.getItem(lsPrivateKey(code));
  if (raw) {
    const lobby = JSON.parse(raw) as PrivateLobby;
    localStorage.setItem(lsPrivateKey(code), JSON.stringify({ ...lobby, status: 'game', gameId: 'sim' }));
  }
  return 'sim';
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
  /** When set, skips random matchmaking and joins this specific game. */
  initialMatch?: { gameId: string; role: 'player1' | 'player2' };
};

export function DuelGame({ currentUserId, displayName, onExit, initialMatch }: DuelGameProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<'idle' | 'matching' | 'play'>('idle');
  const storeAvatar = useGameStore((s) => s.avatar);
  const simulationRef = useRef(false);
  const [gameId, setGameId] = useState<string | null>(null);
  const [role, setRole] = useState<'player1' | 'player2' | null>(null);
  const [words, setWords] = useState<RtdbDuelWord[]>([]);
  const [idx, setIdx] = useState(0);
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
    const w = await pickWords();
    simulationRef.current = true;
    setWords(w);
    setGameId('sim');
    setRole('player1');
    setOpponentUid('sim_rival');
    const av = PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)]?.id ?? 'pretzel';
    setOpponentProfile({ displayName: t('duel.training_partner'), avatar: av });
    setP1(0);
    setP2(0);
    setIdx(0);
    setAnswered(false);
    setPicked(null);
    setPhase('play');
  }, [t]);

  /* Auto-start when an initialMatch is provided (private duel) */
  useEffect(() => {
    if (!initialMatch) return;
    const { gameId: gid, role: r } = initialMatch;
    setGameId(gid);
    setRole(r);
    if (gid === 'sim') {
      simulationRef.current = true;
      void (async () => {
        const w = await pickWords();
        setWords(w);
        setOpponentUid('sim_rival');
        const av = PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)]?.id ?? 'pretzel';
        setOpponentProfile({ displayName: t('duel.training_partner'), avatar: av });
        setP1(0); setP2(0); setIdx(0); setAnswered(false); setPicked(null);
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
        setPhase('play'); setIdx(0); setAnswered(false); setPicked(null);
      } catch {
        // Firebase unavailable — fall back to simulation
        const w = await pickWords();
        simulationRef.current = true;
        setWords(w); setGameId('sim');
        const av = PLAYER_AVATARS[Math.floor(Math.random() * PLAYER_AVATARS.length)]?.id ?? 'pretzel';
        setOpponentUid('sim_rival');
        setOpponentProfile({ displayName: t('duel.training_partner'), avatar: av });
        setP1(0); setP2(0); setIdx(0); setAnswered(false); setPicked(null);
        setPhase('play');
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startMatch = async () => {
    setPhase('matching');
    try {
      const canMatchOnline = isFirebaseConfigured && isFirebaseLive;
      if (!canMatchOnline) {
        await startSimulatedMatch();
        return;
      }
      simulationRef.current = false;
      const { gameId: gid, role: r } = await findRandomMatch(currentUserId);
      setGameId(gid);
      setRole(r);
      const snap = await get(ref(requireRtdb(), `${DUELS}/${gid}`));
      const data = snap.val() as { words?: RtdbDuelWord[] } | null;
      setWords(Array.isArray(data?.words) ? data!.words! : []);
      setPhase('play');
      setIdx(0);
      setAnswered(false);
      setPicked(null);
    } catch {
      try {
        await startSimulatedMatch();
      } catch {
        setPhase('idle');
      }
    }
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

  const exitOnlineDuel = () => {
    if (phase === 'play' && !statsRecordedRef.current) {
      statsRecordedRef.current = true;
      const { me, opp } = scoresRef.current;
      if (simulationRef.current || gameId === 'sim') {
        useGameStore.getState().recordDuelFinish(me > opp, me);
      } else if (gameId) {
        void recordOnlineDuelFinished(currentUserId, me > opp);
      }
    }
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

  useEffect(() => {
    if (gameId !== 'sim' || phase !== 'play') return;
    const tid = window.setInterval(() => {
      if (Math.random() < 0.34) setP2((x) => x + 1);
    }, 2800);
    return () => clearInterval(tid);
  }, [gameId, phase]);

  const handlePick = async (a: Article) => {
    if (!current || answered || !gameId || !role) return;
    setPicked(a);
    setAnswered(true);
    const ok = a === current.article;
    setWasCorrect(ok);
    if (ok) await bumpMyScore();
    window.setTimeout(() => {
      setAnswered(false);
      setPicked(null);
      setIdx((i) => (i + 1 >= words.length ? 0 : i + 1));
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

  if (phase === 'idle') {
    return (
      <div
        className="flex min-h-[100dvh] flex-col items-center justify-center px-4 pb-32 pt-[max(0px,env(safe-area-inset-top))]"
        style={{ background: 'var(--artikl-bg)' }}
      >
        <div className="w-full max-w-[360px] rounded-[22px] border border-white/[0.1] bg-gradient-to-b from-[rgba(124,108,248,0.12)] via-[rgba(18,18,28,0.92)] to-[rgba(12,12,18,0.98)] px-6 py-8 text-center shadow-[0_20px_56px_rgba(0,0,0,0.45)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#d4c4ff]/90">{t('nav.duel')}</p>
          <h1 className="mt-2 font-display text-xl font-bold text-white sm:text-2xl">{t('duel.find_opponent')}</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-[rgba(232,232,245,0.55)]">
            {t('duel.find_opponent_sub')}
          </p>
          <button
            type="button"
            onClick={() => void startMatch()}
            className="mt-7 w-full rounded-xl bg-gradient-to-r from-[#7c6cf8] to-[#b84fd4] py-3.5 text-sm font-bold text-white shadow-[0_10px_36px_rgba(124,108,248,0.35)] transition-transform active:scale-[0.98]"
          >
            {t('duel.start_match')}
          </button>
          <button
            type="button"
            onClick={onExit}
            className="mt-4 text-[13px] font-medium text-[rgba(232,232,245,0.45)] underline-offset-4 transition-colors hover:text-[rgba(232,232,245,0.7)]"
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
        style={{ background: 'var(--artikl-bg)', color: 'var(--artikl-muted2)' }}
      >
        <div
          className="h-11 w-11 animate-pulse rounded-full bg-gradient-to-br from-[#7c6cf8]/50 to-[#c44fd9]/35 shadow-[0_0_28px_rgba(124,108,248,0.35)]"
          aria-hidden
        />
        <p className="text-sm font-medium text-[rgba(240,238,255,0.85)]">{t('duel.matching')}</p>
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
          <div className="mt-3 flex items-stretch justify-between gap-3">
            <div className="min-w-0 flex-1 rounded-xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/10 to-white/[0.04] px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/90">
                {t('duel.online_you')}
              </span>
              <div className="mt-1.5 flex items-center gap-2">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-2xl shadow-[0_4px_16px_rgba(16,185,129,0.15)]"
                  title={myLabel}
                >
                  {myEmoji}
                </span>
                <p className="min-w-0 truncate text-[13px] font-bold leading-tight text-white">{myLabel}</p>
              </div>
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">{myScore}</p>
            </div>
            <div className="min-w-0 flex-1 rounded-xl border border-violet-400/25 bg-gradient-to-bl from-violet-500/10 to-white/[0.04] px-3 py-2.5 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300/90">
                {t('duel.online_opponent')}
              </span>
              <div className="mt-1.5 flex flex-row-reverse items-center gap-2">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/20 text-2xl shadow-[0_4px_16px_rgba(139,92,246,0.18)]"
                  title={opponentUid ?? oppLabel}
                >
                  {opponentUid ? oppEmoji : t('duel.opponent_avatar_placeholder')}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold leading-tight text-white">{oppLabel}</p>
                  {opponentUid && opponentUid !== 'sim_rival' ? (
                    <p className="truncate font-mono text-[8px] text-white/35" title={opponentUid}>
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
                      void sendFriendRequest(currentUserId, opponentUid).then(() => setFriendSent(true));
                    }}
                    className="mt-1 rounded-lg border border-[rgba(124,108,248,0.35)] bg-[rgba(124,108,248,0.12)] px-2 py-1 text-[9px] font-semibold text-[#a89ff8] transition-colors hover:border-[rgba(124,108,248,0.5)] disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    {friendSent ? t('duel.request_sent') : t('duel.add_friend')}
                  </button>
                )
              ) : (
                <p className="mt-1 text-[9px] text-[var(--artikl-muted)]">{t('duel.waiting_uid')}</p>
              )}
              <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-white">{oppScore}</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-6 text-center">
          {current ? (
            <>
              <p className="text-[10px] uppercase tracking-wider text-[var(--artikl-muted2)]">
                {t('duel.word_n_of_m', { n: idx + 1, m: words.length })}
              </p>
              <p className="mt-3 font-mono text-[clamp(1.25rem,6vw,2rem)] font-semibold text-white">
                {current.word}
              </p>
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
          <div className="mx-4 mt-4 mb-2 rounded-2xl border-[0.5px] border-white/[0.09] bg-white/[0.03] px-3 py-5 backdrop-blur-[8px]">
            <p className="text-center text-[11px] leading-relaxed text-[var(--artikl-muted)]">
              {t('duel.no_chat_training')}
            </p>
          </div>
        ) : (
          <div className="mx-4 mt-4 mb-2 flex min-h-0 flex-1 flex-col rounded-2xl border-[0.5px] border-white/[0.09] bg-white/[0.03] backdrop-blur-[8px]">
            <p className="border-b border-white/[0.06] px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--artikl-muted2)]">
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
                            : 'rounded-bl-md bg-white/[0.06] text-[rgba(240,238,255,0.88)] ring-1 ring-white/[0.06]',
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
              className="flex items-center gap-2 border-t border-white/[0.06] p-2"
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
                className="min-w-0 flex-1 rounded-xl border-[0.5px] border-white/10 bg-white/[0.05] px-3 py-2 text-[13px] text-[var(--artikl-text)] outline-none placeholder:text-[var(--artikl-muted)] focus:border-[var(--artikl-accent)]/45"
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
    </div>
  );
}
