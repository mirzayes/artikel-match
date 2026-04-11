import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { GoetheLevel } from '../types';
import { useVocabulary } from '../context/VocabularyContext';
import { isArtikelVipFromLocalStorage, useGameStore } from '../store/useGameStore';
import {
  A2_UNLOCK_MIN_TOTAL_XP,
  FAST_PASS_PRICE_AZN,
  canBuyIapUnlockForLevel,
  coinUnlockCostForLevel,
  isLevelGateUnlocked,
  previousGoetheLevel,
  type LevelGateCheckArgs,
} from '../lib/levelGate';

type LevelUnlockModalProps = {
  open: boolean;
  level: GoetheLevel | null;
  onClose: () => void;
  totalXpAllLevels: number;
  knownWordIds: string[];
  masteryByWordId: Record<string, number>;
};

function isPremiumTierLevel(level: GoetheLevel): level is 'B1' | 'B2' | 'C1' {
  return level === 'B1' || level === 'B2' || level === 'C1';
}

export function LevelUnlockModal({
  open,
  level,
  onClose,
  totalXpAllLevels,
  knownWordIds,
  masteryByWordId,
}: LevelUnlockModalProps) {
  const { t } = useTranslation();
  const { nounsByLevel } = useVocabulary();
  const iapLevelUnlocks = useGameStore((s) => s.iapLevelUnlocks);
  const levelGateCoinUnlocks = useGameStore((s) => s.levelGateCoinUnlocks);
  const grantIapLevelUnlock = useGameStore((s) => s.grantIapLevelUnlock);
  const unlockLevelWithArtik = useGameStore((s) => s.unlockLevelWithArtik);
  const coins = useGameStore((s) => s.coins);
  const [artikHint, setArtikHint] = useState<string | null>(null);

  useEffect(() => {
    if (!open) setArtikHint(null);
  }, [open]);

  const args: LevelGateCheckArgs = useMemo(
    () => ({
      totalXpAllLevels,
      knownWordIds,
      masteryByWordId,
      nounsByLevel,
      iapLevelUnlocks,
      levelGateCoinUnlocks,
    }),
    [
      totalXpAllLevels,
      knownWordIds,
      masteryByWordId,
      nounsByLevel,
      iapLevelUnlocks,
      levelGateCoinUnlocks,
    ],
  );

  if (!open || !level) return null;

  const unlocked = isLevelGateUnlocked(level, args);
  const canIap = canBuyIapUnlockForLevel(level, args);
  const artikCost = coinUnlockCostForLevel(level);
  const prevLevel = previousGoetheLevel(level);
  const isElite = level === 'B2' || level === 'C1';

  const handleIap = () => {
    if (!canIap) return;
    const ok = window.confirm(
      t('level_gate.fast_pass_confirm', { level, price: FAST_PASS_PRICE_AZN }),
    );
    if (!ok) return;
    grantIapLevelUnlock(level);
    onClose();
  };

  const handleArtik = () => {
    if (!isPremiumTierLevel(level) || artikCost == null) return;
    setArtikHint(null);
    const ok = unlockLevelWithArtik(level);
    if (!ok) {
      setArtikHint(t('level_gate.artik_insufficient', { cost: artikCost, balance: coins }));
      return;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[95] flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-12 backdrop-blur-sm sm:items-center sm:pb-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="level-unlock-title"
      onClick={onClose}
    >
      <div
        className="app-sheet-panel w-full max-w-[400px] rounded-2xl border border-white/[0.12] bg-[#14141f]/95 p-5 shadow-2xl backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="level-unlock-title" className="text-base font-bold text-artikl-text">
          {isElite ? t('level_gate.title_elite', { level }) : t('level_gate.title', { level })}
        </h2>

        {unlocked ? (
          <p className="mt-3 text-sm text-emerald-200/90">{t('level_gate.already_open')}</p>
        ) : level === 'A2' ? (
          <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-artikl-text">
            <p>
              {t('level_gate.a2_xp_line', { current: totalXpAllLevels, need: A2_UNLOCK_MIN_TOTAL_XP })}
            </p>
            <p>{t('level_gate.or_fast_pass_a2', { price: FAST_PASS_PRICE_AZN })}</p>
          </div>
        ) : isPremiumTierLevel(level) && artikCost != null && prevLevel ? (
          <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-artikl-text">
            <p>
              {isElite
                ? t('level_gate.premium_intro_elite', {
                    level,
                    prev: prevLevel,
                    cost: artikCost,
                  })
                : t('level_gate.premium_intro', {
                    level,
                    prev: prevLevel,
                    cost: artikCost,
                  })}
            </p>
            <p className="text-[12px] text-artikl-text/45">
              {t('level_gate.artik_balance_line', { coins })}
            </p>
            <p>{t('level_gate.or_fast_pass_line', { price: FAST_PASS_PRICE_AZN })}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-artikl-text">{t('level_gate.generic_hint')}</p>
        )}

        {artikHint ? (
          <p className="mt-2 text-[12px] font-medium text-[#4B5563] dark:text-amber-200/90" role="alert">
            {artikHint}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2">
          {!unlocked && isPremiumTierLevel(level) && artikCost != null ? (
            <button
              type="button"
              onClick={handleArtik}
              disabled={!isArtikelVipFromLocalStorage() && coins < artikCost}
              className="w-full rounded-xl border-2 border-purple-600 bg-purple-600 py-3 text-sm font-bold text-white shadow-lg disabled:cursor-not-allowed disabled:border-purple-200 disabled:bg-purple-200 disabled:text-[#9CA3AF] active:scale-[0.98] dark:border-violet-400/45 dark:bg-gradient-to-r dark:from-violet-600/35 dark:to-fuchsia-600/30 dark:text-violet-50 dark:disabled:opacity-40"
            >
              {t('level_gate.pay_artik', { cost: artikCost, level })}
            </button>
          ) : null}
          {canIap ? (
            <button
              type="button"
              onClick={handleIap}
              className="w-full rounded-xl border-2 border-purple-600 bg-purple-600 py-3 text-sm font-bold text-white shadow-lg active:scale-[0.98] dark:border-transparent dark:bg-gradient-to-r dark:from-violet-600 dark:to-fuchsia-600"
            >
              {t('level_gate.pay_fast_pass', { price: FAST_PASS_PRICE_AZN, level })}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-white/15 py-2.5 text-sm font-semibold text-artikl-text"
          >
            {t('level_gate.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
