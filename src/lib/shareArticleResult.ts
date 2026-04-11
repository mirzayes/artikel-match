import type { Article } from '../types';

const APP_URL = 'https://artikel-match.vercel.app';

function buildShareText(article: Article, noun: string, lang: 'de' | 'az'): string {
  if (lang === 'de') {
    return `Ich lerne Deutsch! 🇩🇪
Der richtige Artikel ist:
✨ ${article} ${noun}

Teste dich auch!
${APP_URL}`;
  }
  return `Mən alman dilini öyrənirəm! 🇩🇪
Düzgün artikl:
✨ ${article} ${noun}

Sən də yoxla!
${APP_URL}`;
}

export type ShareArticleResultOutcome = 'shared' | 'copied' | 'cancelled';

/**
 * Web Share API; yoxdursa və ya ləğvdirsə — müəyyən mətni buferə yazır.
 */
export async function shareArticleResult(
  article: Article,
  noun: string,
  lang: 'de' | 'az' = 'az',
): Promise<ShareArticleResultOutcome> {
  const text = buildShareText(article, noun, lang);
  const title = 'Artikel Match';

  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url: APP_URL });
      return 'shared';
    } catch (e) {
      const name = e instanceof Error ? e.name : '';
      if (name === 'AbortError') return 'cancelled';
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return 'copied';
    }
  } catch {
    /* ignore */
  }
  return 'cancelled';
}
