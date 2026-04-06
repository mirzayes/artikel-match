import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentReference,
} from 'firebase/firestore';
import type { Article } from '../types';
import { db } from './firebase';

function requireDb() {
  if (!db) throw new Error('Firestore недоступна');
  return db;
}

const DUELS_COLLECTION = 'duels';
const MATCHMAKING_COLLECTION = 'matchmaking';
const WORDS_PER_DUEL = 10;
const ROOM_ID_ATTEMPTS = 40;

/** Документ `matchmaking/{userId}` */
export type MatchmakingDoc = {
  userId: string;
  status: 'waiting' | 'matching' | 'matched';
  /** Появляется, когда соперник создал комнату */
  gameId?: string;
  matcherId?: string;
  joinedAt?: unknown;
};

/** Элемент из `public/goethe-lexicon.json` → массив `A1`. */
export type GoetheLexiconDuelWord = {
  id: string;
  article: Article;
  word: string;
  translation: string;
  category?: string;
  translations?: Record<string, string>;
};

export type DuelPlayerState = {
  score: number;
  status: 'ready' | 'waiting' | string;
};

export type DuelRoomPayload = {
  words: GoetheLexiconDuelWord[];
  player1: DuelPlayerState;
  player2: DuelPlayerState;
  status: 'active' | string;
};

type LexiconRoot = Record<string, GoetheLexiconDuelWord[] | undefined>;

function randomFourDigitId(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

function shufflePick<T>(items: T[], n: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.min(n, copy.length));
}

async function loadA1Words(): Promise<GoetheLexiconDuelWord[]> {
  const base = import.meta.env.BASE_URL ?? '/';
  const trimmed = base.endsWith('/') ? base : `${base}/`;
  const res = await fetch(`${trimmed}goethe-lexicon.json`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`goethe-lexicon.json: HTTP ${res.status}`);
  const data = (await res.json()) as LexiconRoot;
  const a1 = data.A1;
  if (!Array.isArray(a1) || a1.length === 0) {
    throw new Error('goethe-lexicon.json: нет массива A1 или он пуст');
  }
  return a1.filter(
    (w): w is GoetheLexiconDuelWord =>
      typeof w?.id === 'string' &&
      (w.article === 'der' || w.article === 'die' || w.article === 'das') &&
      typeof w.word === 'string',
  );
}

/**
 * Создаёт документ Firestore `duels/{id}` со случайным 4-значным id,
 * 10 случайными словами уровня A1 из `goethe-lexicon.json`.
 * @returns id комнаты (например `"0456"`)
 */
export async function createDuelRoom(): Promise<string> {
  const pool = await loadA1Words();
  if (pool.length < WORDS_PER_DUEL) {
    throw new Error(`Нужно минимум ${WORDS_PER_DUEL} слов A1, сейчас: ${pool.length}`);
  }
  const words = shufflePick(pool, WORDS_PER_DUEL);

  const payload: DuelRoomPayload = {
    words,
    player1: { score: 0, status: 'ready' },
    player2: { score: 0, status: 'waiting' },
    status: 'active',
  };

  for (let a = 0; a < ROOM_ID_ATTEMPTS; a++) {
    const roomId = randomFourDigitId();
    const ref = doc(requireDb(), DUELS_COLLECTION, roomId);
    const snap = await getDoc(ref);
    if (snap.exists()) continue;
    await setDoc(ref, payload);
    return roomId;
  }

  throw new Error('Не удалось выделить свободный 4-значный id комнаты');
}

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
}

/**
 * Атомарно переводит ожидающего игрока из `waiting` в `matching`, чтобы не выбрали двое.
 */
async function tryReserveWaiter(otherUserId: string, matcherId: string): Promise<boolean> {
  const ref = doc(requireDb(), MATCHMAKING_COLLECTION, otherUserId);
  try {
    return await runTransaction(requireDb(), async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) return false;
      const data = snap.data() as Partial<MatchmakingDoc>;
      if (data.status !== 'waiting') return false;
      transaction.update(ref, {
        status: 'matching',
        matcherId,
      });
      return true;
    });
  } catch {
    return false;
  }
}

async function releaseReservedWaiter(otherUserId: string): Promise<void> {
  const ref = doc(requireDb(), MATCHMAKING_COLLECTION, otherUserId);
  try {
    await runTransaction(requireDb(), async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists()) return;
      const data = snap.data() as Partial<MatchmakingDoc>;
      if (data.status !== 'matching') return;
      transaction.update(ref, {
        status: 'waiting',
        matcherId: deleteField(),
        gameId: deleteField(),
      });
    });
  } catch {
    /* ignore */
  }
}

async function fetchWaitingCandidates(exceptUserId: string): Promise<DocumentReference[]> {
  const q = query(collection(requireDb(), MATCHMAKING_COLLECTION), where('status', '==', 'waiting'));
  const snaps = await getDocs(q);
  const refs = snaps.docs.filter((d) => d.id !== exceptUserId).map((d) => d.ref);
  shuffleInPlace(refs);
  return refs;
}

/**
 * Ставит текущего пользователя в очередь и ждёт, пока матчер запишет в документ `gameId`.
 */
function waitForGameIdOnMyDoc(selfRef: DocumentReference): Promise<string> {
  return new Promise((resolve, reject) => {
    const unsub = onSnapshot(
      selfRef,
      (snap) => {
        const data = snap.data() as Partial<MatchmakingDoc> | undefined;
        const gid = data?.gameId;
        if (typeof gid === 'string' && gid.length > 0) {
          unsub();
          void deleteDoc(selfRef).catch(() => {});
          resolve(gid);
        }
      },
      (err) => {
        unsub();
        reject(err);
      },
    );
  });
}

/**
 * Случайный матч:
 * - Если в `matchmaking` есть игрок со статусом `waiting` (не вы): резервируем его транзакцией,
 *   создаём дуэль (`createDuelRoom`), записываем ему `gameId` и `matched` — у него сработает слушатель документа.
 *   Вам возвращается тот же `gameId`.
 * - Иначе: создаётся/обновляется документ `matchmaking/{currentUserId}` со статусом `waiting`;
 *   возвращается Promise, который резолвится, когда другой игрок запишет вам `gameId`.
 */
export async function findRandomMatch(currentUserId: string): Promise<string> {
  if (!currentUserId.trim()) throw new Error('findRandomMatch: пустой currentUserId');

  const candidates = await fetchWaitingCandidates(currentUserId);

  for (const otherRef of candidates) {
    const otherUserId = otherRef.id;
    const reserved = await tryReserveWaiter(otherUserId, currentUserId);
    if (!reserved) continue;

    let gameId: string | null = null;
    try {
      gameId = await createDuelRoom();
      const confirm = await getDoc(otherRef);
      const cd = confirm.data() as Partial<MatchmakingDoc> | undefined;
      if (
        !confirm.exists() ||
        cd?.status !== 'matching' ||
        cd?.matcherId !== currentUserId
      ) {
        await deleteDoc(doc(requireDb(), DUELS_COLLECTION, gameId)).catch(() => {});
        await releaseReservedWaiter(otherUserId);
        throw new Error('Очередь изменилась до записи gameId');
      }
      await updateDoc(otherRef, { gameId, status: 'matched' });
      return gameId;
    } catch (e) {
      if (gameId) await deleteDoc(doc(requireDb(), DUELS_COLLECTION, gameId)).catch(() => {});
      await releaseReservedWaiter(otherUserId);
      throw e;
    }
  }

  const selfRef = doc(requireDb(), MATCHMAKING_COLLECTION, currentUserId);
  await setDoc(selfRef, {
    userId: currentUserId,
    status: 'waiting',
    joinedAt: serverTimestamp(),
  });

  return waitForGameIdOnMyDoc(selfRef);
}
