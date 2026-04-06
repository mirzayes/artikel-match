import type { Article } from '../../types';

export type ArticleBtnMode =
  | 'idle'
  | 'correct'
  | 'wrong'
  | 'reveal'
  /** Öyrənmə: seçilmiş düymə — parlaq yaşıl, ağ kənar */
  | 'learnBrightCorrect'
  /** Öyrənmə: səhv seçim — parlaq qırmızı */
  | 'learnBrightWrong'
  /** Öyrənmə: düzgün artikl (səhv cavabdan sonra) — sakit yaşıl */
  | 'learnQuietCorrect';

interface ArticleButtonProps {
  article: Article;
  mode: ArticleBtnMode;
  onPick: (a: Article) => void;
  /** Öyrənmə kvizində boş buraxın — kliklər handleAnswer içində süzülür. */
  disabled?: boolean;
}

export function ArticleButton({ article, mode, onPick, disabled = false }: ArticleButtonProps) {
  const learn =
    mode === 'learnBrightCorrect'
      ? ['artikl-learn-bright-correct']
      : mode === 'learnBrightWrong'
        ? ['artikl-learn-bright-wrong']
        : mode === 'learnQuietCorrect'
          ? ['artikl-learn-quiet-correct']
          : [];

  const cls = [
    'artikl-abtn',
    `artikl-${article}`,
    ...learn,
    mode === 'correct' ? 'artikl-correct' : '',
    mode === 'wrong' ? 'artikl-wrong' : '',
    mode === 'reveal' ? 'artikl-reveal' : '',
    (mode === 'correct' || mode === 'reveal') && learn.length === 0 ? `artikl-correct-${article}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type="button" className={cls} disabled={disabled} onClick={() => onPick(article)}>
      {article}
    </button>
  );
}
