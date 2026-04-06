import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'german-articles-quiz-lives-v1';

export const QUIZ_MAX_LIVES = 5;
const REGEN_MS = 30 * 60 * 1000;

export type QuizLivesPersisted = {
  lives: number;
  /** Son həftə canı bərpa intervalının hesablanması üçün (ms) */
  lastRegenAt: number;
};

function clampLives(n: number): number {
  return Math.max(0, Math.min(QUIZ_MAX_LIVES, Math.floor(n)));
}

function readRaw(): unknown {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

/** Tam dolu olanda taymer dayanır; can itkisi sonrası lastRegenAt eyni qalır. */
export function applyLifeRegen(state: QuizLivesPersisted, now: number): QuizLivesPersisted {
  let { lives, lastRegenAt } = state;
  lives = clampLives(lives);
  if (!Number.isFinite(lastRegenAt)) lastRegenAt = now;

  if (lives >= QUIZ_MAX_LIVES) {
    return { lives: QUIZ_MAX_LIVES, lastRegenAt };
  }

  while (lives < QUIZ_MAX_LIVES && now - lastRegenAt >= REGEN_MS) {
    lives += 1;
    lastRegenAt += REGEN_MS;
  }

  return { lives, lastRegenAt };
}

function loadState(now: number): QuizLivesPersisted {
  const raw = readRaw();
  if (raw && typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    const lives = clampLives(typeof o.lives === 'number' ? o.lives : QUIZ_MAX_LIVES);
    const lastRegenAt = typeof o.lastRegenAt === 'number' ? o.lastRegenAt : now;
    return applyLifeRegen({ lives, lastRegenAt }, now);
  }
  return { lives: QUIZ_MAX_LIVES, lastRegenAt: now };
}

function persist(state: QuizLivesPersisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function useQuizLives() {
  const [livesState, setLivesState] = useState<QuizLivesPersisted>(() => loadState(Date.now()));

  const tickRegen = useCallback(() => {
    const now = Date.now();
    setLivesState((prev) => {
      const next = applyLifeRegen(prev, now);
      if (next.lives === prev.lives && next.lastRegenAt === prev.lastRegenAt) return prev;
      return next;
    });
  }, []);

  useEffect(() => {
    setLivesState(loadState(Date.now()));
  }, []);

  useEffect(() => {
    persist(livesState);
  }, [livesState]);

  useEffect(() => {
    const id = window.setInterval(tickRegen, 15_000);
    return () => clearInterval(id);
  }, [tickRegen]);

  const loseLife = useCallback(() => {
    setLivesState((prev) => {
      const now = Date.now();
      let lastRegenAt = prev.lastRegenAt;
      const newLives = clampLives(prev.lives - 1);
      if (prev.lives === QUIZ_MAX_LIVES && newLives < QUIZ_MAX_LIVES) {
        lastRegenAt = now;
      }
      return applyLifeRegen({ lives: newLives, lastRegenAt }, now);
    });
  }, []);

  const gainLifeFromRecovery = useCallback(() => {
    setLivesState((prev) => {
      const now = Date.now();
      const nextLives = clampLives(prev.lives + 1);
      return applyLifeRegen(
        {
          lives: nextLives,
          lastRegenAt: nextLives >= QUIZ_MAX_LIVES ? now : prev.lastRegenAt,
        },
        now,
      );
    });
  }, []);

  return { lives: livesState.lives, loseLife, gainLifeFromRecovery };
}
