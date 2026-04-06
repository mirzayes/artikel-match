/** Boşluqları, registrı, ß/ss uyğunlaşdırır; əvvəldə der/die/das çıxarır. */
export function stripArticlesAndNormalizeLemma(s: string): string {
  let t = s.trim().toLowerCase().replace(/\s+/g, ' ').replace(/ß/g, 'ss');
  t = t.replace(/^(der|die|das)\s+/i, '').trim();
  return t;
}

/** Məs: istifadəçi «Hund» və ya «der Hund» yazar, leksikonda «Hund». */
export function germanLemmaMatchesInput(userInput: string, lemma: string): boolean {
  return (
    stripArticlesAndNormalizeLemma(userInput) === stripArticlesAndNormalizeLemma(lemma)
  );
}
