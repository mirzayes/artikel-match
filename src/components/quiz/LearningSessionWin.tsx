import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Article } from '../../types';

const CONFETTI_COLORS = ['#a78bfa', '#f472b6', '#34d399', '#7C3AED', '#60a5fa', '#f87171', '#818cf8'];

export type SessionWordSummary = {
  id: string;
  word: string;
  article: Article;
  translation: string;
};

/** Sessiya sonu sikkə xülasəsi (Happy Hours artıq tətbiq olunub). */
export type SessionCoinRewardSummary = {
  correctCoins: number;
  perfectCoins: number;
  total: number;
  errors: number;
  correctAnswers: number;
  turboActive: boolean;
  /** Odlu seriyası >3 gün — +10% */
  streakBonusActive?: boolean;
  /** Günlük öyrənmə limiti doldu */
  lessonDailyCapReached?: boolean;
};

type LearningSessionWinProps = {
  goal: number;
  easyWords?: SessionWordSummary[];
  hardWords?: SessionWordSummary[];
  /** Boşdursa blok göstərilmir */
  coinReward?: SessionCoinRewardSummary | null;
  glossRtl?: boolean;
  secondaryActionLabel?: string;
  /** Veriləndə standart sessiya başlığı əvəzinə */
  titleOverride?: string | null;
  /** Veriləndə standart alt başlıq əvəzinə */
  subtitleOverride?: string | null;
  onHome: () => void;
  onRestart: () => void;
};

function WordColumn({
  title,
  tone,
  words,
  glossRtl,
}: {
  title: string;
  tone: 'easy' | 'hard';
  words: SessionWordSummary[];
  glossRtl?: boolean;
}) {
  const border =
    tone === 'easy' ? 'border-emerald-500/25 bg-emerald-950/20' : 'border-rose-500/25 bg-rose-950/20';
  const label = tone === 'easy' ? 'text-emerald-200/90' : 'text-rose-200/90';

  return (
    <div className={`learning-win-col rounded-2xl border p-3 ${border}`}>
      <p className={`mb-2 text-center text-[0.65rem] font-bold uppercase tracking-widest ${label}`}>{title}</p>
      {words.length === 0 ? (
        <p className="py-2 text-center text-xs text-artikl-caption">—</p>
      ) : (
        <ul className="max-h-40 space-y-1.5 overflow-y-auto text-left text-sm">
          {words.map((w) => (
            <li key={w.id} className="leading-snug text-artikl-text">
              <span className="font-semibold text-violet-200/90">{w.article}</span> {w.word}
              <span
                className="block text-xs font-normal text-artikl-caption"
                style={
                  glossRtl ? { direction: 'rtl', textAlign: 'right' as const } : undefined
                }
              >
                {w.translation}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const COIN_RAIN_COUNT = 22;

function FlyingCoinsLayer() {
  const seeds = useMemo(
    () =>
      Array.from({ length: COIN_RAIN_COUNT }, (_, i) => ({
        i,
        leftPct: (i * 37 + 11) % 100,
        delay: (i % 12) * 0.045,
        duration: 2.1 + (i % 5) * 0.18,
        drift: ((i % 7) - 3) * 14,
      })),
    [],
  );

  return (
    <div className="learning-win-coin-rain" aria-hidden>
      {seeds.map((s) => (
        <motion.span
          key={s.i}
          className="learning-win-coin-emoji"
          initial={{ y: '-8%', x: 0, opacity: 0, rotate: -25, scale: 0.6 }}
          animate={{
            y: ['0%', '108vh'],
            x: [0, s.drift, s.drift * -0.4],
            opacity: [0, 1, 1, 0.85, 0],
            rotate: [-25, 40, 120],
            scale: [0.6, 1.05, 1],
          }}
          transition={{
            duration: s.duration,
            delay: s.delay,
            ease: [0.22, 0.65, 0.36, 1],
            times: [0, 0.12, 0.45, 0.78, 1],
          }}
          style={{ left: `${s.leftPct}%` }}
        >
          🪙
        </motion.span>
      ))}
    </div>
  );
}

export function LearningSessionWin({
  goal,
  easyWords = [],
  hardWords = [],
  coinReward = null,
  glossRtl = false,
  secondaryActionLabel = 'Ana səhifə',
  titleOverride = null,
  subtitleOverride = null,
  onHome,
  onRestart,
}: LearningSessionWinProps) {
  const { t } = useTranslation();
  const showCoins = coinReward && coinReward.total > 0;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="learning-win-root"
      role="dialog"
      aria-modal
      aria-labelledby="learning-win-title"
    >
      <div className="learning-win-confetti" aria-hidden>
        {Array.from({ length: 22 }, (_, i) => (
          <span
            key={i}
            className="learning-win-confetti-piece"
            style={{
              left: `${(i * 53) % 100}%`,
              background: CONFETTI_COLORS[i % CONFETTI_COLORS.length]!,
              animationDelay: `${(i % 10) * 0.07}s`,
            }}
          />
        ))}
      </div>

      {showCoins ? <FlyingCoinsLayer /> : null}

      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 26 }}
        className="learning-win-card glass-card learning-win-card--wide"
      >
        <p className="learning-win-emoji" aria-hidden>
          🎉
        </p>
        <h2 id="learning-win-title" className="learning-win-title">
          {titleOverride ?? t('rewards.session_complete_title')}
        </h2>
        <p className="learning-win-sub">
          {subtitleOverride ?? t('rewards.session_complete_sub', { goal })}
        </p>

        {showCoins && coinReward ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.35 }}
            className="learning-win-coin-breakdown mb-4 rounded-2xl border border-[#F59E0B]/28 bg-gradient-to-b from-[#F59E0B]/12 to-orange-950/10 px-4 py-3 text-left"
          >
            {coinReward.turboActive || coinReward.streakBonusActive ? (
              <div className="mb-2 space-y-1">
                {coinReward.turboActive ? (
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-[#FEF3C7]/88">
                    {t('rewards.session_turbo_chip')}
                  </p>
                ) : null}
                {coinReward.streakBonusActive ? (
                  <p className="text-center text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200/85">
                    {t('rewards.odlu_streak_artik_bonus')}
                  </p>
                ) : null}
              </div>
            ) : null}
            <div className="space-y-2 text-[13px] text-artikl-text">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2">
                <span>{t('rewards.session_line_correct')}</span>
                <span className="font-mono font-bold tabular-nums text-[#FEF3C7]/92">
                  {t('common.plus_amount_artik', { amount: coinReward.correctCoins })}
                </span>
              </div>
              {coinReward.perfectCoins > 0 ? (
                <div className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2">
                  <span className="text-emerald-200/95">{t('rewards.session_line_perfect')}</span>
                  <span className="font-mono font-bold tabular-nums text-emerald-300">
                    {t('common.plus_amount_artik', { amount: coinReward.perfectCoins })}
                  </span>
                </div>
              ) : (
                <p className="text-[11px] text-artikl-caption">
                  {t('rewards.session_no_perfect_hint', { n: coinReward.errors })}
                </p>
              )}
              <div className="flex items-center justify-between gap-3 pt-1">
                <span className="text-sm font-bold uppercase tracking-wider text-artikl-text">
                  {t('rewards.session_total')}
                </span>
                <motion.span
                  className="font-mono text-lg font-bold tabular-nums text-[#F59E0B]"
                  initial={{ scale: 0.85 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 22, delay: 0.25 }}
                >
                  {t('common.amount_artik', { amount: coinReward.total })}
                </motion.span>
              </div>
              {coinReward.lessonDailyCapReached ? (
                <p className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-center text-[11px] font-medium leading-snug text-rose-100/90">
                  {t('rewards.lesson_daily_cap_message')}
                </p>
              ) : null}
            </div>
          </motion.div>
        ) : null}

        <div className="learning-win-columns">
          <WordColumn title="Asan (bilirəm)" tone="easy" words={easyWords} glossRtl={glossRtl} />
          <WordColumn title="Çətin (təkrar)" tone="hard" words={hardWords} glossRtl={glossRtl} />
        </div>

        <div className="learning-win-actions">
          <button type="button" className="learning-win-btn learning-win-btn-primary" onClick={onRestart}>
            {t('rewards.session_restart')}
          </button>
          <button type="button" className="learning-win-btn learning-win-btn-ghost" onClick={onHome}>
            {secondaryActionLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export { LearningSessionWin as ResultView };
