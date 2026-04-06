const HARD = 'artikl-word-tags-hard';
const EASY = 'artikl-word-tags-easy';

export type WordTagBuckets = { hard: string[]; easy: string[] };

export function readWordTags(): WordTagBuckets {
  try {
    const hard = JSON.parse(localStorage.getItem(HARD) || '[]');
    const easy = JSON.parse(localStorage.getItem(EASY) || '[]');
    return {
      hard: Array.isArray(hard) ? hard : [],
      easy: Array.isArray(easy) ? easy : [],
    };
  } catch {
    return { hard: [], easy: [] };
  }
}

export function writeWordTags(s: WordTagBuckets) {
  localStorage.setItem(HARD, JSON.stringify(s.hard));
  localStorage.setItem(EASY, JSON.stringify(s.easy));
}
