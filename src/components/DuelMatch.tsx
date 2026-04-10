import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Article, GoetheLevel, LevelProgressStats } from '../types';
import { shuffleInPlace, type VokabelRow } from '../lib/vokabelnCsv';
import { requestDuelDeckFromWorker } from '../lib/wordPoolWorkerClient';
import { isRtlGlossLang, nounToVokabelRow, resolveVokabelRowGloss, usesRemoteGlossFile } from '../lib/nounTranslation';
import { useGlossLanguage, useGlossRemote } from '../hooks/useGlossLanguage';
import { useVocabulary } from '../context/VocabularyContext';
import { ArticleButton, type ArticleBtnMode } from './quiz/ArticleButton';
import { FeedbackBar } from './quiz/FeedbackBar';
import { QuizTopBar } from './quiz/QuizTopBar';
import { WordCard } from './quiz/WordCard';
import { getArticleFact } from '../data/articleFacts';
import { avatarIdToEmoji } from '../lib/playerProfileRtdb';
import { useGameStore } from '../store/useGameStore';
import { getAffixWrongTeachHighlight } from '../lib/predictArticleFromAffixRules';
import { readStoredDuelLevel } from '../lib/duelLevelStorage';
import {
  DuelGame,
  getOrCreateDuelUserId,
  createPrivateLobby,
  joinPrivateLobby,
  watchPrivateLobby,
  activatePrivateLobby,
  deletePrivateRoom,
} from './DuelGame';

const DUEL_GOAL = 20;
const PLAYER_WRONG_PENALTY = 2;

/* ── Invite-link helpers ─────────────────────────────────────────────── */
const INVITE_LS_PREFIX = 'duel-invite-';
const TOAST_MS = 2400;

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0, I/1 ambiguity
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function buildInviteLink(code: string): string {
  return `${window.location.origin}${window.location.pathname}?room=${code}`;
}

/** 6-character private room code from `?room=` (same charset as generated codes). */
function parseRoomCodeFromLocationSearch(search: string): string | null {
  try {
    const raw = new URLSearchParams(search).get('room')?.trim();
    if (!raw) return null;
    const code = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    return code.length === 6 ? code : null;
  } catch {
    return null;
  }
}

function storeInvite(code: string): void {
  try {
    localStorage.setItem(
      `${INVITE_LS_PREFIX}${code}`,
      JSON.stringify({ code, createdAt: Date.now(), status: 'waiting' }),
    );
  } catch { /* ignore */ }
}

function readAutoJoinRoom(): string | null {
  try {
    const code = sessionStorage.getItem('duel-auto-join-room');
    if (code) sessionStorage.removeItem('duel-auto-join-room');
    return code;
  } catch {
    return null;
  }
}
const WRONG_FEEDBACK_MS = 700;
/** Bot opponent: random +1 on a random interval within the given range. */
const OPPONENT_TICK_MIN_MS = 2500;
const OPPONENT_TICK_MAX_MS = 5000;
const CORRECT_ADVANCE_MS = 450;

function randomOpponentDelayMs(): number {
  return OPPONENT_TICK_MIN_MS + Math.random() * (OPPONENT_TICK_MAX_MS - OPPONENT_TICK_MIN_MS);
}

interface DuelMatchProps {
  level: GoetheLevel;
  levelStats: LevelProgressStats;
  displayName: string;
  onRecord: (level: GoetheLevel, article: Article, correct: boolean, wordId: string) => void;
  onExitHome: () => void;
}

export function DuelMatch({ level, levelStats, displayName, onRecord, onExitHome }: DuelMatchProps) {
  const { t } = useTranslation();
  const { nounsByLevel } = useVocabulary();
  const nouns = nounsByLevel[level];
  const playerAvatarId = useGameStore((s) => s.avatar);
  const duelCoins = useGameStore((s) => s.coins);
  const playerEmoji = avatarIdToEmoji(playerAvatarId);
  const [onlineDuel, setOnlineDuel] = useState(false);
  // gameActive gates the local bot practice game; false = show static menu only
  const [gameActive] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const duelUid = useMemo(() => getOrCreateDuelUserId(), []);
  /** Ensures `?room=` auto-join runs once (URL is stripped after first parse). */
  const privateDuelUrlJoinStartedRef = useRef(false);

  /* ── Private duel state ───────────────────────────────────────────── */
  const [privateDuelScreen, setPrivateDuelScreen] = useState<
    'hidden' | 'menu' | 'hosting' | 'joining' | 'joined'
  >(() =>
    typeof window !== 'undefined' && parseRoomCodeFromLocationSearch(window.location.search)
      ? 'joining'
      : 'hidden',
  );
  const [privateCode, setPrivateCode] = useState('');
  const [joinInput, setJoinInput] = useState(() =>
    typeof window !== 'undefined'
      ? parseRoomCodeFromLocationSearch(window.location.search) ?? ''
      : '',
  );
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinLoading, setJoinLoading] = useState(false);
  const [privateMatch, setPrivateMatch] = useState<{
    gameId: string;
    role: 'player1' | 'player2';
  } | null>(null);
  const privateLobbyUnsubRef = useRef<(() => void) | null>(null);
  const privateActivatingRef = useRef(false);
  const [glossLang] = useGlossLanguage();
  const { remoteGlossById, remoteGlossReady } = useGlossRemote();

  const [rows, setRows] = useState<VokabelRow[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [cursor, setCursor] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'answered'>('idle');
  const [picked, setPicked] = useState<Article | null>(null);
  const [wordVisible, setWordVisible] = useState(true);
  const [xpPop, setXpPop] = useState(false);

  const [playerProgress, setPlayerProgress] = useState(0);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [winner, setWinner] = useState<'player' | 'bot' | null>(null);

  const winnerRef = useRef<'player' | 'bot' | null>(null);
  const wrongFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const xpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    winnerRef.current = winner;
  }, [winner]);

  const resetDuelSession = useCallback(() => {
    if (wrongFeedbackTimerRef.current) clearTimeout(wrongFeedbackTimerRef.current);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    wrongFeedbackTimerRef.current = null;
    advanceTimerRef.current = null;
    winnerRef.current = null;
    setWinner(null);
    setPlayerProgress(0);
    setOpponentProgress(0);
    setPhase('idle');
    setPicked(null);
    setWordVisible(true);
    if (!nouns.length) {
      setRows(null);
      setOrder([]);
      setLoadErr(t('duel.no_words', { level }));
      return;
    }
    if (usesRemoteGlossFile(glossLang) && !remoteGlossReady) {
      setRows(null);
      setOrder([]);
      setLoadErr(null);
      return;
    }
    const remote = usesRemoteGlossFile(glossLang) ? remoteGlossById : null;
    const list = nouns;
    void (async () => {
      try {
        const { rows: parsed, order: ord } = await requestDuelDeckFromWorker(list, glossLang, remote);
        setRows(parsed);
        setOrder(ord);
        setCursor(0);
        setLoadErr(null);
      } catch {
        const parsed: VokabelRow[] = list.map((n) => nounToVokabelRow(n, glossLang, remote));
        setRows(parsed);
        setOrder(shuffleInPlace(parsed.map((_, i) => i)));
        setCursor(0);
        setLoadErr(null);
      }
    })();
  }, [level, nouns, glossLang, remoteGlossReady, remoteGlossById, t]);

  useEffect(() => {
    resetDuelSession();
  }, [resetDuelSession]);

  useEffect(() => {
    return () => {
      if (wrongFeedbackTimerRef.current) clearTimeout(wrongFeedbackTimerRef.current);
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      if (xpTimerRef.current) clearTimeout(xpTimerRef.current);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      if (privateLobbyUnsubRef.current) privateLobbyUnsubRef.current();
    };
  }, []);

  /* Auto-join if app was opened via ?room= invite link */
  useEffect(() => {
    const room = readAutoJoinRoom();
    if (room) setOnlineDuel(true);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => {
      toastTimerRef.current = null;
      setToastMsg(null);
    }, TOAST_MS);
  };

  /* ── Private duel handlers ────────────────────────────────────────── */

  const closePrivateDuel = () => {
    setPrivateDuelScreen('hidden');
    if (privateLobbyUnsubRef.current) {
      privateLobbyUnsubRef.current();
      privateLobbyUnsubRef.current = null;
    }
    privateActivatingRef.current = false;
    setPrivateCode('');
    setJoinInput('');
    setJoinError(null);
  };

  const handleCopyPrivateCode = async (code: string) => {
    const link = buildInviteLink(code);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast('Kopyalandı!');
  };

  const handleCreatePrivateRoom = async () => {
    const code = generateRoomCode();
    console.log('[PrivateDuel] HOST flow start, code=', code, 'uid=', duelUid);
    setPrivateCode(code);
    setPrivateDuelScreen('hosting');
    privateActivatingRef.current = false;

    // Attach watcher BEFORE creating room so we never miss an update
    privateLobbyUnsubRef.current = watchPrivateLobby(code, (lobby) => {
      if (!lobby) return;
      console.log('[PrivateDuel] HOST watcher fired, status=', lobby.status, lobby);
      if (lobby.status === 'ready' && lobby.guestId && !privateActivatingRef.current) {
        console.log('[PrivateDuel] HOST detected guest joined — activating game');
        privateActivatingRef.current = true;
        if (privateLobbyUnsubRef.current) {
          privateLobbyUnsubRef.current();
          privateLobbyUnsubRef.current = null;
        }
        void activatePrivateLobby(code, duelUid, lobby.guestId, readStoredDuelLevel(level)).then((gameId) => {
          console.log('[PrivateDuel] HOST starting game, gameId=', gameId);
          setPrivateMatch({ gameId, role: 'player1' });
          setPrivateDuelScreen('hidden');
          setOnlineDuel(true);
        }).catch((err) => {
          console.error('[PrivateDuel] HOST activatePrivateLobby failed', err);
        });
      }
    });

    try {
      await createPrivateLobby(code, duelUid);
    } catch (err) {
      console.error('[PrivateDuel] HOST createPrivateLobby failed', err);
      // Clean up watcher and reset UI on failure
      if (privateLobbyUnsubRef.current) {
        privateLobbyUnsubRef.current();
        privateLobbyUnsubRef.current = null;
      }
      setPrivateDuelScreen('menu');
      showToast('Otaq açılmadı. Firebase icazəsini yoxla.');
    }
  };

  const handleJoinPrivateRoom = useCallback(
    async (explicitCode?: string) => {
      const code = (explicitCode ?? joinInput).trim().toUpperCase();
      if (code.length < 6) {
        setJoinError('6 simvol daxil edin');
        return;
      }
      console.log('[PrivateDuel] GUEST flow start, code=', code, 'uid=', duelUid);
      setJoinLoading(true);
      setJoinError(null);
      try {
        await joinPrivateLobby(code, duelUid);
        console.log('[PrivateDuel] GUEST joined OK, now watching for game start');
        setPrivateCode(code);
        setPrivateDuelScreen('joined');
        privateLobbyUnsubRef.current = watchPrivateLobby(code, (lobby) => {
          if (!lobby) return;
          console.log('[PrivateDuel] GUEST watcher fired, status=', lobby.status, lobby);
          if (lobby.status === 'game' && lobby.gameId) {
            console.log('[PrivateDuel] GUEST starting game, gameId=', lobby.gameId);
            if (privateLobbyUnsubRef.current) {
              privateLobbyUnsubRef.current();
              privateLobbyUnsubRef.current = null;
            }
            const gid = lobby.gameId;
            deletePrivateRoom(code);
            setPrivateMatch({ gameId: gid, role: 'player2' });
            setPrivateDuelScreen('hidden');
            setOnlineDuel(true);
          }
        });
      } catch (e) {
        console.error('[PrivateDuel] GUEST joinPrivateLobby failed', e);
        setJoinError(e instanceof Error ? e.message : 'Xəta baş verdi');
      } finally {
        setJoinLoading(false);
      }
    },
    [joinInput, duelUid],
  );

  useEffect(() => {
    if (privateDuelUrlJoinStartedRef.current) return;
    if (typeof window === 'undefined') return;
    const code = parseRoomCodeFromLocationSearch(window.location.search);
    if (!code) return;
    privateDuelUrlJoinStartedRef.current = true;
    window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`);
    void handleJoinPrivateRoom(code);
  }, [handleJoinPrivateRoom]);

  const handleShareLink = async () => {
    const code = generateRoomCode();
    storeInvite(code);
    const link = buildInviteLink(code);
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Fallback for browsers that block clipboard without user gesture
      const ta = document.createElement('textarea');
      ta.value = link;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showToast('Link kopyalandı!');
  };

  /** Bot: after a random delay, increment opponentProgress by 1. */
  useEffect(() => {
    if (!gameActive || winner) return;
    const delay = randomOpponentDelayMs();
    const id = window.setTimeout(() => {
      setOpponentProgress((o) => {
        if (winnerRef.current) return o;
        const next = o + 1;
        if (next >= DUEL_GOAL) {
          winnerRef.current = 'bot';
          setWinner('bot');
        }
        return next;
      });
    }, delay);
    return () => clearTimeout(id);
  }, [opponentProgress, winner, gameActive]);

  const triggerXpPop = useCallback(() => {
    setXpPop(true);
    if (xpTimerRef.current) clearTimeout(xpTimerRef.current);
    xpTimerRef.current = setTimeout(() => {
      xpTimerRef.current = null;
      setXpPop(false);
    }, 400);
  }, []);

  const total = order.length;
  const rowIndex = total > 0 ? order[cursor % total]! : 0;
  const current = rows && total ? rows[rowIndex]! : null;

  const currentDisplayGloss = useMemo(
    () =>
      current ? resolveVokabelRowGloss(current, nounsByLevel, glossLang, remoteGlossById) : '',
    [current, nounsByLevel, glossLang, remoteGlossById],
  );

  const advanceWord = useCallback(() => {
    setWordVisible(false);
    if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
    advanceTimerRef.current = setTimeout(() => {
      advanceTimerRef.current = null;
      setCursor((c) => c + 1);
      setPhase('idle');
      setPicked(null);
      setWordVisible(true);
    }, 120);
  }, []);

  const handlePick = useCallback(
    (a: Article) => {
      if (!current || winner || phase !== 'idle') return;
      const ok = a === current.article;
      setPicked(a);
      setPhase('answered');
      onRecord(level, current.article, ok, current.id);
      triggerXpPop();

      if (ok) {
        setPlayerProgress((p) => {
          const np = p + 1;
          if (np >= DUEL_GOAL && !winnerRef.current) {
            winnerRef.current = 'player';
            setWinner('player');
          }
          return np;
        });
        if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = setTimeout(() => {
          advanceTimerRef.current = null;
          if (!winnerRef.current) advanceWord();
        }, CORRECT_ADVANCE_MS);
      } else {
        setPlayerProgress((p) => Math.max(0, p - PLAYER_WRONG_PENALTY));
        if (wrongFeedbackTimerRef.current) clearTimeout(wrongFeedbackTimerRef.current);
        wrongFeedbackTimerRef.current = setTimeout(() => {
          wrongFeedbackTimerRef.current = null;
          setPhase('idle');
          setPicked(null);
        }, WRONG_FEEDBACK_MS);
      }
    },
    [advanceWord, current, level, onRecord, phase, triggerXpPop, winner],
  );

  const isCorrectPick = Boolean(picked !== null && current && picked === current.article);

  const wrongAffixTeachDuel =
    current && phase === 'answered' && !isCorrectPick
      ? getAffixWrongTeachHighlight(current.word, current.article)
      : null;
  const inputLocked = winner !== null || phase === 'answered';

  const btnMode = useCallback(
    (a: Article): ArticleBtnMode => {
      if (phase === 'idle' || !current) return 'idle';
      if (picked === current.article) {
        return a === current.article ? 'correct' : 'idle';
      }
      if (picked === a) return 'wrong';
      if (a === current.article) return 'reveal';
      return 'idle';
    },
    [current, phase, picked],
  );

  const barPct = (v: number) => `${Math.min(100, (v / DUEL_GOAL) * 100)}%`;

  if (onlineDuel) {
    return (
      <DuelGame
        currentUserId={duelUid}
        displayName={displayName}
        defaultDuelLevel={level}
        onExit={() => { setOnlineDuel(false); setPrivateMatch(null); }}
        initialMatch={privateMatch ?? undefined}
      />
    );
  }

  return (
    <div
      className="flex min-h-[100dvh] justify-center pb-36 pt-[max(0px,env(safe-area-inset-top))]"
      style={{ background: 'var(--artikl-bg)' }}
    >
      <div className="artikl-scene">
        <QuizTopBar stats={levelStats} xpPop={xpPop} playerEmoji={playerEmoji} />

        <div className="px-5 pb-3 pt-1">
          {/* ── Static menu buttons — always visible ── */}
          {/* Coin balance display */}
          <div className="mb-3 flex items-center justify-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5">
              <span className="font-mono text-lg font-bold tabular-nums text-[#7C3AED] dark:text-amber-200">
                {t('common.balance_display', { amount: duelCoins })}
              </span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => setOnlineDuel(true)}
            className="duel-cta-random mb-2 w-full rounded-xl border border-[rgba(168,85,247,0.5)] bg-gradient-to-r from-[rgba(124,108,248,0.28)] via-[rgba(168,85,247,0.20)] to-[rgba(196,79,217,0.18)] py-4 text-[15px] font-bold text-artikl-heading shadow-[0_8px_32px_rgba(168,85,247,0.35)] transition-all active:scale-[0.98] hover:shadow-[0_10px_40px_rgba(168,85,247,0.45)]"
          >
            <span className="flex items-center justify-center gap-2">
              <span aria-hidden>⚔️</span>
              {t('duel.random_opponent')}
              <span className="flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#7C3AED] dark:text-amber-200">
                🪙 {duelCoins}
              </span>
            </span>
          </button>
          <div className="mb-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPrivateDuelScreen('menu')}
              className="duel-cta-private rounded-xl border border-[rgba(255,190,80,0.35)] bg-gradient-to-br from-[rgba(255,160,40,0.18)] to-[rgba(255,100,60,0.12)] py-3.5 text-[13px] font-bold text-[rgba(255,220,140,0.95)] shadow-[0_4px_18px_rgba(255,150,50,0.15)] transition-transform active:scale-[0.98]"
            >
              {t('duel.private_duel_grid_btn')}
            </button>
            <button
              type="button"
              onClick={() => void handleShareLink()}
              className="rounded-xl border border-[var(--artikl-border2)] bg-[var(--artikl-surface2)] py-3.5 text-[13px] font-semibold text-artikl-text transition-transform active:scale-[0.98]"
            >
              {t('duel.share_link_btn')}
            </button>
          </div>
          <p className="mb-4 text-center text-[11px] leading-relaxed text-artikl-muted2">
            {t('duel.find_opponent_sub')}
          </p>

          {/* ── Game content: only after game is explicitly started ── */}
          {gameActive && (
            <>
              {loadErr ? (
                <p className="mt-4 text-center text-sm text-artikl-muted2">{loadErr}</p>
              ) : !current ? (
                <p className="mt-4 text-center text-sm text-artikl-caption">{t('quiz.loading')}</p>
              ) : (
                <>
                  <p className="text-center text-[11px] font-bold uppercase tracking-wider text-artikl-caption">
                    {t('duel.race_to', { n: DUEL_GOAL })}
                  </p>
                  <div className="mt-3 flex items-center justify-between gap-3 text-sm font-semibold">
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="text-emerald-300/90">{t('duel.you')}</span>
                      <div
                        className="h-2 overflow-hidden rounded-full bg-[var(--artikl-surface2)]"
                        role="progressbar"
                        aria-valuenow={playerProgress}
                        aria-valuemin={0}
                        aria-valuemax={DUEL_GOAL}
                      >
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300"
                          style={{ width: barPct(playerProgress) }}
                        />
                      </div>
                      <span className="tabular-nums text-artikl-text">{playerProgress}</span>
                    </div>
                    <span className="shrink-0 text-lg text-artikl-text/30" aria-hidden>:</span>
                    <div className="flex min-w-0 flex-1 flex-col items-end gap-1 text-right">
                      <span className="text-rose-300/90">{t('duel.opponent')}</span>
                      <div
                        className="h-2 w-full overflow-hidden rounded-full bg-[var(--artikl-surface2)]"
                        role="progressbar"
                        aria-valuenow={opponentProgress}
                        aria-valuemin={0}
                        aria-valuemax={DUEL_GOAL}
                      >
                        <div
                          className="ml-auto h-full rounded-full bg-gradient-to-l from-violet-500 to-fuchsia-400 transition-all duration-300"
                          style={{ width: barPct(opponentProgress) }}
                        />
                      </div>
                      <span className="tabular-nums text-artikl-text">{opponentProgress}</span>
                    </div>
                  </div>
                  <p className="mt-2 text-center text-[10px] text-artikl-caption">
                    {t('duel.opponent_hint', { penalty: PLAYER_WRONG_PENALTY })}
                  </p>
                </>
              )}
            </>
          )}
        </div>

        {gameActive && current && (
          <>
            <WordCard
              wordKey={current.id}
              word={current.word}
              correctArticle={current.article}
              translation={currentDisplayGloss}
              translationRtl={isRtlGlossLang(glossLang)}
              glossLang={glossLang}
              wordVisible={wordVisible}
              showAnswer={phase === 'answered'}
              highlightArticle={phase === 'answered' ? current.article : null}
              glowArticle={isCorrectPick ? current.article : null}
              comboToast={null}
              comboToastVisible={false}
              cardLabel={t('duel.card_label')}
              wrongAffixTeach={wrongAffixTeachDuel}
            />

            {phase === 'answered' ? (
              <FeedbackBar ok={isCorrectPick} fact={isCorrectPick ? getArticleFact(current.word) : null}>
                {isCorrectPick ? (
                  <>{t('duel.feedback_correct', { article: current.article, word: current.word, gloss: currentDisplayGloss })}</>
                ) : (
                  <>{t('duel.feedback_wrong', { penalty: PLAYER_WRONG_PENALTY, article: current.article, word: current.word, gloss: currentDisplayGloss })}</>
                )}
              </FeedbackBar>
            ) : null}

            <div className="artikl-btns">
              {(['der', 'die', 'das'] as const).map((a) => (
                <ArticleButton
                  key={a}
                  article={a}
                  mode={btnMode(a)}
                  disabled={inputLocked}
                  onPick={handlePick}
                />
              ))}
            </div>
          </>
        )}

        <div className="artikl-flex-space" />
      </div>

      {gameActive && winner ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm">
          <div className="glass-card max-w-sm rounded-2xl p-6 text-center shadow-2xl">
            <h2 className="font-display text-xl font-bold text-artikl-text sm:text-2xl">
              {winner === 'player' ? t('duel.victory') : t('duel.defeat')}
            </h2>
            <p className="mt-2 text-sm text-artikl-muted2">
              {t('duel.score', { you: playerProgress, opp: opponentProgress })}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <button
                type="button"
                onClick={resetDuelSession}
                className="w-full rounded-xl border-2 border-purple-600 bg-purple-600 py-3 text-sm font-semibold text-white dark:border-transparent dark:bg-gradient-to-r dark:from-violet-600 dark:to-fuchsia-600"
              >
                {t('duel.again')}
              </button>
              <button
                type="button"
                onClick={onExitHome}
                className="w-full rounded-xl border border-[var(--artikl-border2)] py-3 text-sm font-semibold text-artikl-text"
              >
                {t('duel.home')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Private Duel Panel ─────────────────────────────────────────── */}
      {privateDuelScreen !== 'hidden' ? (
        <div className="private-duel-modal-scope fixed inset-0 z-[65] flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[360px] rounded-[22px] border border-[var(--artikl-border2)] bg-gradient-to-b from-[rgba(255,140,40,0.10)] via-[rgba(18,18,28,0.96)] to-[rgba(12,12,18,0.99)] px-6 py-7 shadow-[0_24px_64px_rgba(0,0,0,0.55)]">

            {/* Header */}
            <div className="mb-5 flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffcc80]/80">
                Xüsusi duel
              </p>
              <button
                type="button"
                onClick={closePrivateDuel}
                className="text-lg leading-none text-[#9CA3AF] transition-colors hover:text-[#4B5563] dark:text-artikl-text/35 hover:dark:text-artikl-text/70"
                aria-label="Bağla"
              >
                ✕
              </button>
            </div>

            {/* ── MENU screen ── */}
            {privateDuelScreen === 'menu' && (
              <>
                <h2 className="mb-1 text-center font-display text-lg font-bold text-artikl-text">
                  Xüsusi duel
                </h2>
                <p className="mb-6 text-center text-[12px] leading-relaxed text-artikl-caption">
                  Otaq aç, kodu dostuna göndər — ya da onun kodunu daxil et
                </p>
                <button
                  type="button"
                  onClick={() => void handleCreatePrivateRoom()}
                  className="mb-3 w-full rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ef4444] py-3 text-sm font-bold text-white shadow-[0_10px_28px_rgba(245,158,11,0.28)] transition-transform active:scale-[0.98]"
                >
                  Yeni otaq aç
                </button>
                <button
                  type="button"
                  onClick={() => setPrivateDuelScreen('joining')}
                  className="w-full rounded-xl border border-[var(--artikl-border2)] bg-[var(--artikl-surface)] py-3 text-sm font-semibold text-artikl-text transition-transform active:scale-[0.98]"
                >
                  Koda qoşul
                </button>
              </>
            )}

            {/* ── HOSTING screen — waiting for guest ── */}
            {privateDuelScreen === 'hosting' && (
              <>
                <h2 className="mb-1 text-center font-display text-lg font-bold text-artikl-text">
                  Otaq açıldı
                </h2>
                <p className="mb-4 text-center text-[12px] text-artikl-muted2">
                  Bu kodu dostuna göndər
                </p>
                <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-[var(--artikl-border2)] bg-[var(--artikl-surface2)] px-4 py-3">
                  <span className="font-mono text-2xl font-bold tracking-[0.25em] text-artikl-text">
                    {privateCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleCopyPrivateCode(privateCode)}
                    className="rounded-lg border border-[var(--artikl-border2)] bg-[var(--artikl-surface2)] px-3 py-1.5 text-[11px] font-semibold text-[#4B5563] transition-colors hover:bg-[var(--artikl-surface2)] active:scale-95 dark:text-artikl-text/80"
                  >
                    Kopyala
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2 text-[13px] text-artikl-muted2">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-amber-400/70" />
                  Rəqib gözlənilir...
                </div>
              </>
            )}

            {/* ── JOINED screen — guest waiting for host to start ── */}
            {privateDuelScreen === 'joined' && (
              <>
                <h2 className="mb-1 text-center font-display text-lg font-bold text-artikl-text">
                  Qoşulundu!
                </h2>
                <p className="mb-4 text-center text-[12px] text-artikl-muted2">
                  Otaq kodu
                </p>
                <div className="mb-5 flex items-center justify-center rounded-xl border border-[var(--artikl-border2)] bg-[var(--artikl-surface2)] px-4 py-3">
                  <span className="font-mono text-2xl font-bold tracking-[0.25em] text-artikl-text">
                    {privateCode}
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 text-[13px] text-artikl-muted2">
                  <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-400/70" />
                  Oyun başlayır...
                </div>
              </>
            )}

            {/* ── JOINING screen — enter friend's code ── */}
            {privateDuelScreen === 'joining' && (
              <>
                <h2 className="mb-1 text-center font-display text-lg font-bold text-artikl-text">
                  Koda qoşul
                </h2>
                <p className="mb-5 text-center text-[12px] text-artikl-muted2">
                  Dostunun otaq kodunu daxil et
                </p>
                <input
                  type="text"
                  value={joinInput}
                  onChange={(e) =>
                    setJoinInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))
                  }
                  placeholder="AB12CD"
                  maxLength={6}
                  autoFocus
                  className="mb-3 w-full rounded-xl border border-[var(--artikl-border2)] bg-[var(--artikl-surface2)] px-4 py-3 text-center font-mono text-2xl font-bold tracking-[0.25em] text-artikl-text placeholder:text-artikl-caption outline-none focus:border-amber-500/60 transition-colors"
                />
                {joinError ? (
                  <p className="mb-3 text-center text-[12px] text-rose-400">{joinError}</p>
                ) : (
                  <div className="mb-3 h-5" />
                )}
                <button
                  type="button"
                  onClick={() => void handleJoinPrivateRoom()}
                  disabled={joinLoading || joinInput.trim().length < 6}
                  className="w-full rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#ef4444] py-3 text-sm font-bold text-white shadow-[0_10px_28px_rgba(245,158,11,0.28)] transition-transform active:scale-[0.98] disabled:opacity-40"
                >
                  {joinLoading ? 'Yüklənir...' : 'Qoşul'}
                </button>
                <button
                  type="button"
                  onClick={() => setPrivateDuelScreen('menu')}
                  className="mt-3 w-full text-center text-[12px] text-artikl-caption transition-colors hover:text-artikl-muted2"
                >
                  Geri
                </button>
              </>
            )}

          </div>
        </div>
      ) : null}

      {/* Invite-link toast */}
      {toastMsg ? (
        <div
          className="fixed bottom-24 left-1/2 z-[80] -translate-x-1/2 rounded-2xl bg-[rgba(30,28,48,0.95)] px-5 py-3 text-sm font-semibold text-artikl-text shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-md"
          role="status"
          aria-live="polite"
        >
          {toastMsg}
        </div>
      ) : null}
    </div>
  );
}
