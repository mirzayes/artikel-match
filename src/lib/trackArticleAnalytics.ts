import { track } from '@vercel/analytics';
import type { Article } from '../types';

/** Vercel Web Analytics — custom event `Article Clicked`. */
export function trackArticleClicked(params: {
  word: string;
  selected: Article;
  isCorrect: boolean;
  context: 'learn' | 'duel' | 'exam';
}): void {
  track('Article Clicked', {
    word: params.word,
    selected: params.selected,
    correct: params.isCorrect ? 'yes' : 'no',
    context: params.context,
  });
}
