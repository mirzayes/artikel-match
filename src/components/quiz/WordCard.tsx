import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  predictArticleFromAffixRules,
  type AffixWrongTeachHighlight,
} from '../../lib/predictArticleFromAffixRules';
import type { Article, NounTranslationLang } from '../../types';

interface WordCardProps {
  wordKey: string;
  word: string;
  translation: string;
  /** Növbəti söz keçidində prototip: əvvəl fade-out */
  wordVisible: boolean;
  showAnswer: boolean;
  highlightArticle: Article | null;
  glowArticle: Article | null;
  comboToast: string | null;
  comboToastVisible: boolean;
  /** Öyrənmə: ulduzlar və əlavə UI; Sınaq: təmiz kart, yalnız söz + tərcümə */
  variant?: 'learn' | 'exam';
  /** Boşdursa başlıq gizlənir */
  cardLabel?: string;
  /** SRS: 0…5 doldurulmuş ulduz (öyrənmə rejimi) */
  masteryStarLevel?: number;
  /** Artırılanda ulduzlar XP ilə sinxron qısa animasiya */
  starBurstSeq?: number;
  /** «Bilirəm» — kartda qızılı partlayış */
  goldFlashSeq?: number;
  /** Arap lüğəti: tərcümə sətri RTL */
  translationRtl?: boolean;
  /** Aktiv gloss kodu — CJK/AR `lang` və tipografiya */
  glossLang?: NounTranslationLang;
  /** Əksər halda öyrənmə/duel üçün; imtahanda gizlətmək üçün false */
  showGenderHint?: boolean;
  /** Düzgün artikl — forma qaydası üstə düşərsə izah göstərilir */
  correctArticle?: Article;
  /** Öyrənmə: səhv seçimdən sonra sufiks / Ge- vurğusu */
  wrongAffixTeach?: AffixWrongTeachHighlight | null;
}

export function WordCard({
  wordKey,
  word,
  translation,
  wordVisible,
  showAnswer,
  highlightArticle,
  glowArticle,
  comboToast,
  comboToastVisible,
  variant = 'learn',
  cardLabel = 'Yeni sözlər öyrənilir',
  masteryStarLevel,
  starBurstSeq = 0,
  goldFlashSeq = 0,
  translationRtl = false,
  glossLang,
  showGenderHint = true,
  correctArticle,
  wrongAffixTeach = null,
}: WordCardProps) {
  const { t } = useTranslation();
  const [playIn, setPlayIn] = useState(false);
  const [starPop, setStarPop] = useState(false);
  const [goldFlash, setGoldFlash] = useState(false);

  useEffect(() => {
    if (!wordVisible) return;
    setPlayIn(true);
    const t = window.setTimeout(() => setPlayIn(false), 300);
    return () => clearTimeout(t);
  }, [wordKey, wordVisible]);

  useEffect(() => {
    if (!starBurstSeq) return;
    setStarPop(true);
    const t = window.setTimeout(() => setStarPop(false), 520);
    return () => clearTimeout(t);
  }, [starBurstSeq]);

  useEffect(() => {
    if (!goldFlashSeq) return;
    setGoldFlash(true);
    const t = window.setTimeout(() => setGoldFlash(false), 580);
    return () => clearTimeout(t);
  }, [goldFlashSeq]);

  const glow =
    glowArticle === 'der'
      ? 'artikl-glow-der'
      : glowArticle === 'die'
        ? 'artikl-glow-die'
        : glowArticle === 'das'
          ? 'artikl-glow-das'
          : '';

  const showLabel = Boolean(cardLabel?.trim());
  const isExam = variant === 'exam';

  const shapeHintText = useMemo(() => {
    if (!correctArticle) return null;
    const pred = predictArticleFromAffixRules(word);
    if (!pred || pred.article !== correctArticle) return null;
    if (pred.rule === 'die_suffix') return t('quiz.article_shape_die_suffix');
    if (pred.rule === 'das_suffix') return t('quiz.article_shape_das_suffix');
    return t('quiz.gender_hint_ge_prefix');
  }, [word, correctArticle, t]);

  const showShapeHintBlock =
    showGenderHint && !isExam && !showAnswer && shapeHintText !== null;

  const showWrongAffixTeach = Boolean(
    wrongAffixTeach && showAnswer && !isExam,
  );

  const wordMainContent = useMemo(() => {
    const w = word;
    if (!showWrongAffixTeach || !wrongAffixTeach) {
      return <>{w}</>;
    }
    const { start, length } = wrongAffixTeach;
    if (start < 0 || length <= 0 || start + length > w.length) return <>{w}</>;
    const before = w.slice(0, start);
    const mid = w.slice(start, start + length);
    const after = w.slice(start + length);
    return (
      <>
        {before}
        <span className="artikl-affix-wrong">{mid}</span>
        {after}
      </>
    );
  }, [word, showWrongAffixTeach, wrongAffixTeach]);

  const wrongAffixMessage = useMemo(() => {
    if (!showWrongAffixTeach || !wrongAffixTeach) return null;
    const { rule, suffixLabel } = wrongAffixTeach;
    if (rule === 'die_suffix') return t('quiz.wrong_affix_hint_die', { suffix: suffixLabel });
    if (rule === 'das_suffix') return t('quiz.wrong_affix_hint_das', { suffix: suffixLabel });
    return t('quiz.wrong_affix_hint_ge');
  }, [showWrongAffixTeach, wrongAffixTeach, t]);

  const translationLen = showAnswer ? translation.length : 0;
  const glossLong = translationLen > 40;
  const glossLonger = translationLen > 72;
  const cjkClass =
    glossLang === 'kr' ? 'artikl-word-az--cjk-kr' : glossLang === 'zh' ? 'artikl-word-az--cjk-zh' : '';
  const glossBcp47 =
    glossLang === 'kr' ? 'ko' : glossLang === 'zh' ? 'zh-Hans' : glossLang === 'ar' ? 'ar' : undefined;

  return (
    <motion.div
      key={wordKey}
      initial={{ opacity: 0, y: 20, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', damping: 26, stiffness: 320, mass: 0.85 }}
      className={`artikl-card ${isExam ? 'artikl-card--exam' : ''} ${glow} ${goldFlash ? 'artikl-card--gold-flash' : ''}`.trim()}
    >
      {showLabel ? <div className="artikl-card-label">{cardLabel}</div> : null}
      <div className={`artikl-combo-toast ${comboToastVisible ? 'artikl-combo-toast-show' : ''}`}>
        {comboToast ?? ''}
      </div>
      <div className="artikl-word-wrap">
        <div
          className={`artikl-word-motion ${playIn && wordVisible ? 'artikl-word-in' : ''}`.trim()}
        >
          <p
            className={`artikl-word-main german-word ${!wordVisible ? 'artikl-word-fade' : ''}`.trim()}
          >
            {wordMainContent}
          </p>
        </div>
        {wrongAffixMessage ? (
          <p className="artikl-wrong-affix-msg" role="status">
            {wrongAffixMessage}
          </p>
        ) : null}
        {!isExam && showAnswer ? (
          <div className="artikl-art-indicator" aria-hidden>
            {(['der', 'die', 'das'] as const).map((a) => (
              <div
                key={a}
                className={`artikl-art-dot artikl-dot-${a} ${highlightArticle === a ? 'artikl-active' : ''}`}
              />
            ))}
          </div>
        ) : null}
        {!isExam && masteryStarLevel !== undefined ? (
          <div
            className={`artikl-word-stars ${starPop ? 'artikl-word-stars--burst' : ''}`.trim()}
            role="img"
            aria-label={`Söz səviyyəsi: ${masteryStarLevel} / 5 ulduz`}
          >
            {Array.from({ length: 5 }, (_, i) => (
              <span
                key={i}
                className={i < masteryStarLevel ? 'artikl-star artikl-star--on' : 'artikl-star'}
                aria-hidden
              >
                ★
              </span>
            ))}
          </div>
        ) : null}
      </div>
      {showShapeHintBlock ? (
        <div className="artikl-gender-hint">
          <p>
            <span aria-hidden>💡 </span>
            <strong>{t('quiz.gender_hint_title')}</strong> {shapeHintText}
          </p>
        </div>
      ) : null}
      <p
        className={[
          'artikl-word-az',
          showAnswer ? 'artikl-word-az-show' : '',
          cjkClass,
          glossLong ? 'artikl-word-az--long' : '',
          glossLonger ? 'artikl-word-az--longer' : '',
          translationRtl && showAnswer ? 'artikl-word-az--rtl' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        lang={showAnswer ? glossBcp47 : undefined}
        style={
          translationRtl && showAnswer
            ? { direction: 'rtl', textAlign: 'right' as const }
            : undefined
        }
      >
        {showAnswer ? translation : '—'}
      </p>
    </motion.div>
  );
}
