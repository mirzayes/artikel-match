import { useCallback, useEffect, type MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { primeSpeechSynthesisVoices, speakGermanWord } from '../lib/speakGerman';

type SpeakWordButtonProps = {
  word: string;
  className?: string;
  disabled?: boolean;
};

export function SpeakWordButton({ word, className = '', disabled }: SpeakWordButtonProps) {
  const { t } = useTranslation();

  useEffect(() => {
    primeSpeechSynthesisVoices();
    const ss = typeof window !== 'undefined' ? window.speechSynthesis : null;
    if (!ss) return;
    const onVoices = () => primeSpeechSynthesisVoices();
    ss.addEventListener('voiceschanged', onVoices);
    return () => ss.removeEventListener('voiceschanged', onVoices);
  }, []);

  const onClick = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      if (disabled || !word.trim()) return;
      speakGermanWord(word);
    },
    [disabled, word],
  );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !word.trim()}
      className={[
        'inline-flex shrink-0 items-center justify-center rounded-lg p-1 text-[15px] leading-none',
        'opacity-65 transition-[opacity,transform] hover:opacity-100 active:scale-95',
        'disabled:pointer-events-none disabled:opacity-25',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--artikl-accent)]',
        className,
      ].join(' ')}
      aria-label={t('common.speak_word_aria', { word: word.trim() || '…' })}
      title={t('common.speak_word_title')}
    >
      <span aria-hidden>🔊</span>
    </button>
  );
}
