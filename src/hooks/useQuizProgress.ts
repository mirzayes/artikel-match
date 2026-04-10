import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AppProgressState,
  Article,
  GoetheLevel,
  LevelProgressStats,
  RecordAnswerOptions,
  WordSrsEntry,
} from '../types';
import {
  GOETHE_LEVELS,
  LEARNED_FOR_TRAINING_MASTERY,
  MAX_MASTERY_LEVEL,
  ODLU_DAILY_GOAL,
  ODLU_DAILY_GOAL_OPTIONS,
  type OdluDailyGoalOption,
} from '../types';
import { tryUnlockMarathonAchievement } from '../lib/achievements';
import { clampMastery } from '../lib/smartReview';
import { xpForCorrectAnswer } from '../lib/scoring';
import { formatLocalDate, localDateKey } from '../lib/dateKeys';
import { computeOdluSeriya } from '../lib/odluStreak';
import { nextReviewAfterCorrect, nextReviewAfterWrong } from '../lib/srs';

const STORAGE_KEY_V2 = 'german-articles-progress-v2';
const STORAGE_KEY_V1 = 'german-articles-progress-v1';
const QUIZ_LIVES_STORAGE_KEY = 'german-articles-quiz-lives-v1';

function isGoetheLevel(x: string): x is GoetheLevel {
  return (GOETHE_LEVELS as readonly string[]).includes(x);
}

const emptyArticleCell = () => ({ correct: 0, total: 0 });

const emptyLevel = (): LevelProgressStats => ({
  totalAnswered: 0,
  correctTotal: 0,
  byArticle: {
    der: emptyArticleCell(),
    die: emptyArticleCell(),
    das: emptyArticleCell(),
  },
  streak: 0,
  bestStreak: 0,
  xp: 0,
});

function normalizeLevelStats(raw: Partial<LevelProgressStats> | undefined): LevelProgressStats {
  const e = emptyLevel();
  if (!raw || typeof raw !== 'object') return e;
  const byArticle = { ...e.byArticle };
  for (const a of ['der', 'die', 'das'] as const) {
    const c = raw.byArticle?.[a];
    byArticle[a] = {
      correct: typeof c?.correct === 'number' && Number.isFinite(c.correct) ? c.correct : 0,
      total: typeof c?.total === 'number' && Number.isFinite(c.total) ? c.total : 0,
    };
  }
  return {
    totalAnswered:
      typeof raw.totalAnswered === 'number' && Number.isFinite(raw.totalAnswered)
        ? raw.totalAnswered
        : 0,
    correctTotal:
      typeof raw.correctTotal === 'number' && Number.isFinite(raw.correctTotal)
        ? raw.correctTotal
        : 0,
    byArticle,
    streak: typeof raw.streak === 'number' && Number.isFinite(raw.streak) ? raw.streak : 0,
    bestStreak:
      typeof raw.bestStreak === 'number' && Number.isFinite(raw.bestStreak) ? raw.bestStreak : 0,
    xp: typeof raw.xp === 'number' && Number.isFinite(raw.xp) ? Math.max(0, raw.xp) : 0,
  };
}

const emptyByLevel = (): Record<GoetheLevel, LevelProgressStats> => ({
  A1: emptyLevel(),
  A2: emptyLevel(),
  B1: emptyLevel(),
  B2: emptyLevel(),
  C1: emptyLevel(),
});

function normalizeWrongCounts(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
        out[k] = Math.min(1_000_000, Math.floor(v));
      }
    }
  }
  return out;
}

function normalizeHardWordIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    if (typeof x !== 'string' || !x.trim()) continue;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }
  return out;
}

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function normalizeDailyCorrectByDate(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!DATE_KEY_RE.test(k)) continue;
    if (!Array.isArray(v)) continue;
    const ids = v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0);
    if (ids.length === 0) continue;
    out[k] = [...new Set(ids)];
  }
  return out;
}

function normalizeDisplayName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().slice(0, 24);
}

function normalizeSrs(raw: unknown): Record<string, WordSrsEntry> {
  const out: Record<string, WordSrsEntry> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!v || typeof v !== 'object' || Array.isArray(v)) continue;
    const o = v as Record<string, unknown>;
    const streak =
      typeof o.streak === 'number' && Number.isFinite(o.streak) ? clampMastery(o.streak) : 0;
    const lastAttempt =
      typeof o.lastAttempt === 'string' && o.lastAttempt ? o.lastAttempt : new Date(0).toISOString();
    const nextReview =
      typeof o.nextReview === 'string' && o.nextReview ? o.nextReview : new Date(0).toISOString();
    out[k] = { streak, lastAttempt, nextReview };
  }
  return out;
}

function normalizeActivityByDate(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw)) {
    if (!DATE_KEY_RE.test(k)) continue;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) continue;
    out[k] = Math.min(1_000_000, Math.floor(v));
  }
  return out;
}

function trimDateKeyedMaps(
  daily: Record<string, string[]>,
  activity: Record<string, number>,
  dailyCorrect: Record<string, number>,
  learningCorrect: Record<string, number>,
  retainDays = 50,
) {
  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - retainDays);
  const cutoffKey = formatLocalDate(cutoff);
  for (const k of Object.keys(daily)) {
    if (k < cutoffKey) delete daily[k];
  }
  for (const k of Object.keys(activity)) {
    if (k < cutoffKey) delete activity[k];
  }
  for (const k of Object.keys(dailyCorrect)) {
    if (k < cutoffKey) delete dailyCorrect[k];
  }
  for (const k of Object.keys(learningCorrect)) {
    if (k < cutoffKey) delete learningCorrect[k];
  }
}

function load(): AppProgressState {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEY_V2);
    if (rawV2) {
      const p = JSON.parse(rawV2) as Partial<AppProgressState>;
      if (p?.byLevel && typeof p.selectedLevel === 'string' && isGoetheLevel(p.selectedLevel)) {
        const rawMastery = p.masteryByWordId;
        const masteryByWordId: Record<string, number> = {};
        if (rawMastery && typeof rawMastery === 'object' && !Array.isArray(rawMastery)) {
          for (const [k, v] of Object.entries(rawMastery)) {
            if (typeof v === 'number' && Number.isFinite(v)) masteryByWordId[k] = clampMastery(v);
          }
        }
        const byLevel = emptyByLevel();
        for (const lvl of GOETHE_LEVELS) {
          byLevel[lvl] = normalizeLevelStats(p.byLevel?.[lvl]);
        }
        let srsByWordId = normalizeSrs((p as AppProgressState).srsByWordId);
        if (Object.keys(srsByWordId).length === 0 && Object.keys(masteryByWordId).length > 0) {
          const epoch = new Date(0).toISOString();
          const nowIso = new Date().toISOString();
          for (const [id, m] of Object.entries(masteryByWordId)) {
            srsByWordId[id] = { streak: clampMastery(m), lastAttempt: nowIso, nextReview: epoch };
          }
        }
        const rawGoal = (p as AppProgressState & { odluDailyGoal?: unknown }).odluDailyGoal;
        const odluDailyGoal: OdluDailyGoalOption =
          typeof rawGoal === 'number' && (ODLU_DAILY_GOAL_OPTIONS as readonly number[]).includes(rawGoal)
            ? (rawGoal as OdluDailyGoalOption)
            : ODLU_DAILY_GOAL;

        return {
          selectedLevel: p.selectedLevel,
          byLevel,
          masteryByWordId,
          srsByWordId,
          wrongCountByWordId: normalizeWrongCounts(p.wrongCountByWordId),
          hardWordIds: normalizeHardWordIds(p.hardWordIds),
          knownWordIds: normalizeHardWordIds(p.knownWordIds),
          dailyCorrectWordIdsByDate: normalizeDailyCorrectByDate(
            (p as AppProgressState).dailyCorrectWordIdsByDate,
          ),
          activityAnswerCountByDate: normalizeActivityByDate(
            (p as AppProgressState).activityAnswerCountByDate,
          ),
          dailyCorrectCountByDate: normalizeActivityByDate(
            (p as AppProgressState & { dailyCorrectCountByDate?: unknown }).dailyCorrectCountByDate,
          ),
          learningCorrectByDate: normalizeActivityByDate(
            (p as AppProgressState & { learningCorrectByDate?: unknown }).learningCorrectByDate,
          ),
          displayName: normalizeDisplayName(
            (p as AppProgressState & { displayName?: unknown }).displayName,
          ),
          odluDailyGoal,
        };
      }
    }

    const rawV1 = localStorage.getItem(STORAGE_KEY_V1);
    if (rawV1) {
      const old = JSON.parse(rawV1) as {
        totalAnswered?: number;
        correctTotal?: number;
        streak?: number;
        bestStreak?: number;
        byArticle?: LevelProgressStats['byArticle'];
      };
      const byLevel = emptyByLevel();
      byLevel.A1 = normalizeLevelStats({
        totalAnswered: old.totalAnswered,
        correctTotal: old.correctTotal,
        streak: old.streak,
        bestStreak: old.bestStreak,
        byArticle: old.byArticle,
      });
      return {
        selectedLevel: 'A1',
        byLevel,
        masteryByWordId: {},
        srsByWordId: {},
        wrongCountByWordId: {},
        hardWordIds: [],
        knownWordIds: [],
        dailyCorrectWordIdsByDate: {},
        activityAnswerCountByDate: {},
        dailyCorrectCountByDate: {},
        learningCorrectByDate: {},
        displayName: '',
        odluDailyGoal: ODLU_DAILY_GOAL,
      };
    }
  } catch {
    /* ignore */
  }
  return {
    selectedLevel: 'A1',
    byLevel: emptyByLevel(),
    masteryByWordId: {},
    srsByWordId: {},
    wrongCountByWordId: {},
    hardWordIds: [],
    knownWordIds: [],
    dailyCorrectWordIdsByDate: {},
    activityAnswerCountByDate: {},
    dailyCorrectCountByDate: {},
    learningCorrectByDate: {},
    displayName: '',
    odluDailyGoal: ODLU_DAILY_GOAL,
  };
}

export function useQuizProgress() {
  const [state, setState] = useState<AppProgressState>(load);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_V2, JSON.stringify(state));
  }, [state]);

  const selectedLevel = state.selectedLevel;
  const stats = state.byLevel[selectedLevel];
  const totalXpAllLevels = useMemo(
    () => GOETHE_LEVELS.reduce((sum, l) => sum + (state.byLevel[l].xp ?? 0), 0),
    [state.byLevel],
  );

  const todayKey = formatLocalDate(new Date());
  const odluSeriya = useMemo(
    () => computeOdluSeriya(state.dailyCorrectCountByDate, todayKey, state.odluDailyGoal),
    [state.dailyCorrectCountByDate, todayKey, state.odluDailyGoal],
  );

  const setSelectedLevel = useCallback((level: GoetheLevel) => {
    setState((s) => ({ ...s, selectedLevel: level }));
  }, []);

  const setDisplayName = useCallback((name: string) => {
    setState((s) => ({ ...s, displayName: normalizeDisplayName(name) }));
  }, []);

  const setOdluDailyGoal = useCallback((goal: OdluDailyGoalOption) => {
    setState((s) => ({ ...s, odluDailyGoal: goal }));
  }, []);

  /** UI/modal/sessiya yoxdur — yalnız state + localStorage. */
  const recordAnswer = useCallback(
    (
      level: GoetheLevel,
      article: Article,
      correct: boolean,
      wordId: string,
      options?: RecordAnswerOptions,
    ) => {
      const mult = options?.xpMultiplier ?? 1;
      setState((prev) => {
        const prevLevel = prev.byLevel[level];
        const byArticle = { ...prevLevel.byArticle };
        const cell = { ...byArticle[article] };
        cell.total += 1;
        if (correct) cell.correct += 1;
        byArticle[article] = cell;

        const streak = correct ? prevLevel.streak + 1 : 0;
        const bestStreak = Math.max(prevLevel.bestStreak, streak);
        const xpGain = correct ? Math.round(xpForCorrectAnswer(streak) * mult) : 0;
        const prevXp = prevLevel.xp ?? 0;

        const learningSrs = options?.learningSrs === true;
        const masteryByWordId = { ...prev.masteryByWordId };
        const srsByWordId = { ...prev.srsByWordId };

        let knownWordIds = prev.knownWordIds;
        let hardWordIds = prev.hardWordIds;

        if (learningSrs) {
          const now = new Date();
          const lastIso = now.toISOString();
          if (!correct) {
            srsByWordId[wordId] = {
              streak: 0,
              lastAttempt: lastIso,
              nextReview: nextReviewAfterWrong(now).toISOString(),
            };
            masteryByWordId[wordId] = 0;
            knownWordIds = prev.knownWordIds.filter((id) => id !== wordId);
          } else {
            const prevStreak = srsByWordId[wordId]?.streak ?? 0;
            const newStreak = prevStreak + 1;
            srsByWordId[wordId] = {
              streak: newStreak,
              lastAttempt: lastIso,
              nextReview: nextReviewAfterCorrect(newStreak, now).toISOString(),
            };
            masteryByWordId[wordId] = Math.min(MAX_MASTERY_LEVEL, newStreak);
            if (newStreak >= LEARNED_FOR_TRAINING_MASTERY && !prev.knownWordIds.includes(wordId)) {
              knownWordIds = [...prev.knownWordIds, wordId];
              const hs = new Set(prev.hardWordIds);
              hs.delete(wordId);
              hardWordIds = Array.from(hs);
            }
          }
        } else {
          const prevM = clampMastery(masteryByWordId[wordId] ?? 0);
          const newM = correct ? Math.min(MAX_MASTERY_LEVEL, prevM + 1) : 0;
          masteryByWordId[wordId] = newM;
          if (correct && newM >= LEARNED_FOR_TRAINING_MASTERY && !prev.knownWordIds.includes(wordId)) {
            knownWordIds = [...prev.knownWordIds, wordId];
            const hs = new Set(prev.hardWordIds);
            hs.delete(wordId);
            hardWordIds = Array.from(hs);
          }
        }

        const wrongCountByWordId = { ...prev.wrongCountByWordId };
        if (!correct) {
          wrongCountByWordId[wordId] = (wrongCountByWordId[wordId] ?? 0) + 1;
        }

        const day = localDateKey();
        const dailyCorrectWordIdsByDate = { ...prev.dailyCorrectWordIdsByDate };
        const todaySet = new Set(dailyCorrectWordIdsByDate[day] ?? []);
        if (correct) todaySet.add(wordId);
        dailyCorrectWordIdsByDate[day] = [...todaySet];

        const activityAnswerCountByDate = { ...prev.activityAnswerCountByDate };
        activityAnswerCountByDate[day] = (activityAnswerCountByDate[day] ?? 0) + 1;

        const dailyCorrectCountByDate = { ...prev.dailyCorrectCountByDate };
        if (correct) {
          dailyCorrectCountByDate[day] = (dailyCorrectCountByDate[day] ?? 0) + 1;
        }

        const learningCorrectByDate = { ...prev.learningCorrectByDate };
        if (learningSrs && correct) {
          learningCorrectByDate[day] = (learningCorrectByDate[day] ?? 0) + 1;
        }

        trimDateKeyedMaps(
          dailyCorrectWordIdsByDate,
          activityAnswerCountByDate,
          dailyCorrectCountByDate,
          learningCorrectByDate,
        );

        if (learningSrs && correct) {
          queueMicrotask(() => tryUnlockMarathonAchievement(learningCorrectByDate));
        }

        return {
          ...prev,
          knownWordIds,
          hardWordIds,
          masteryByWordId,
          srsByWordId,
          wrongCountByWordId,
          dailyCorrectWordIdsByDate,
          activityAnswerCountByDate,
          dailyCorrectCountByDate,
          learningCorrectByDate,
          byLevel: {
            ...prev.byLevel,
            [level]: {
              totalAnswered: prevLevel.totalAnswered + 1,
              correctTotal: prevLevel.correctTotal + (correct ? 1 : 0),
              byArticle,
              streak,
              bestStreak,
              xp: prevXp + xpGain,
            },
          },
        };
      });
    },
    [],
  );

  const resetProgress = useCallback(() => {
    try {
      localStorage.removeItem(QUIZ_LIVES_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    setState((s) => ({
      ...s,
      byLevel: emptyByLevel(),
      masteryByWordId: {},
      srsByWordId: {},
      wrongCountByWordId: {},
      hardWordIds: [],
      knownWordIds: [],
      dailyCorrectWordIdsByDate: {},
      activityAnswerCountByDate: {},
      dailyCorrectCountByDate: {},
      learningCorrectByDate: {},
    }));
  }, []);

  const toggleHardWord = useCallback((wordId: string) => {
    setState((prev) => {
      const next = new Set(prev.hardWordIds);
      if (next.has(wordId)) next.delete(wordId);
      else next.add(wordId);
      return { ...prev, hardWordIds: Array.from(next) };
    });
  }, []);

  const toggleKnownWord = useCallback((wordId: string) => {
    setState((prev) => {
      const known = new Set(prev.knownWordIds);
      const hard = new Set(prev.hardWordIds);
      const srsByWordId = { ...prev.srsByWordId };
      const masteryByWordId = { ...prev.masteryByWordId };
      if (known.has(wordId)) {
        known.delete(wordId);
      } else {
        known.add(wordId);
        hard.delete(wordId);
        const now = new Date();
        const far = new Date(now);
        far.setFullYear(far.getFullYear() + 1);
        srsByWordId[wordId] = {
          streak: Math.max(srsByWordId[wordId]?.streak ?? 0, LEARNED_FOR_TRAINING_MASTERY),
          lastAttempt: now.toISOString(),
          nextReview: far.toISOString(),
        };
        masteryByWordId[wordId] = Math.max(
          clampMastery(masteryByWordId[wordId] ?? 0),
          LEARNED_FOR_TRAINING_MASTERY,
        );
      }
      return {
        ...prev,
        knownWordIds: Array.from(known),
        hardWordIds: Array.from(hard),
        srsByWordId,
        masteryByWordId,
      };
    });
  }, []);

  /** Öyrənmə: sözü «çətin» siyahısına əlavə et (təkrarlamaya). */
  const ensureHardWord = useCallback((wordId: string) => {
    setState((prev) => {
      if (prev.hardWordIds.includes(wordId)) return prev;
      return { ...prev, hardWordIds: [...prev.hardWordIds, wordId] };
    });
  }, []);

  const removeHardWord = useCallback((wordId: string) => {
    setState((prev) => ({
      ...prev,
      hardWordIds: prev.hardWordIds.filter((id) => id !== wordId),
    }));
  }, []);

  /**
   * Ana səhifə «Çıxart»: çətin işarəsini sil, SRS-i adi növbəyə qaytar (dərhal təkrar üçün hazır).
   */
  const releaseHardWord = useCallback((wordId: string) => {
    setState((prev) => {
      if (!prev.hardWordIds.includes(wordId)) return prev;
      const hardWordIds = prev.hardWordIds.filter((id) => id !== wordId);
      const now = new Date();
      const lastIso = now.toISOString();
      const srsByWordId = { ...prev.srsByWordId };
      const prevEntry = srsByWordId[wordId];
      const streak =
        prevEntry && typeof prevEntry.streak === 'number' && Number.isFinite(prevEntry.streak)
          ? clampMastery(prevEntry.streak)
          : 0;
      srsByWordId[wordId] = {
        streak,
        lastAttempt: prevEntry?.lastAttempt ?? lastIso,
        nextReview: nextReviewAfterWrong(now).toISOString(),
      };
      return { ...prev, hardWordIds, srsByWordId };
    });
  }, []);

  /** Öyrənmə: «bu sözü bilirəm» — yalnız əlavə edir (çıxarmır). */
  const markWordAsKnown = useCallback((wordId: string) => {
    setState((prev) => {
      if (prev.knownWordIds.includes(wordId)) return prev;
      const hard = new Set(prev.hardWordIds);
      hard.delete(wordId);
      const now = new Date();
      const far = new Date(now);
      far.setFullYear(far.getFullYear() + 1);
      const srsByWordId = { ...prev.srsByWordId };
      srsByWordId[wordId] = {
        streak: Math.max(srsByWordId[wordId]?.streak ?? 0, LEARNED_FOR_TRAINING_MASTERY),
        lastAttempt: now.toISOString(),
        nextReview: far.toISOString(),
      };
      const masteryByWordId = { ...prev.masteryByWordId };
      masteryByWordId[wordId] = Math.max(
        clampMastery(masteryByWordId[wordId] ?? 0),
        LEARNED_FOR_TRAINING_MASTERY,
      );
      return {
        ...prev,
        knownWordIds: [...prev.knownWordIds, wordId],
        hardWordIds: Array.from(hard),
        srsByWordId,
        masteryByWordId,
      };
    });
  }, []);

  return {
    selectedLevel,
    setSelectedLevel,
    stats,
    byLevel: state.byLevel,
    totalXpAllLevels,
    masteryByWordId: state.masteryByWordId,
    srsByWordId: state.srsByWordId,
    wrongCountByWordId: state.wrongCountByWordId,
    hardWordIds: state.hardWordIds,
    knownWordIds: state.knownWordIds,
    recordAnswer,
    resetProgress,
    toggleHardWord,
    toggleKnownWord,
    markWordAsKnown,
    ensureHardWord,
    removeHardWord,
    releaseHardWord,
    odluSeriya,
    displayName: state.displayName,
    setDisplayName,
    odluDailyGoal: state.odluDailyGoal,
    setOdluDailyGoal,
  };
}
