const DE_LANG = 'de-DE';

function normalizeLang(lang: string): string {
  return lang.replace(/_/g, '-').toLowerCase();
}

function pickGermanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  const exact = voices.find((v) => normalizeLang(v.lang) === 'de-de');
  if (exact) return exact;
  const deAT = voices.find((v) => normalizeLang(v.lang) === 'de-at');
  if (deAT) return deAT;
  const deCH = voices.find((v) => normalizeLang(v.lang) === 'de-ch');
  if (deCH) return deCH;
  return voices.find((v) => normalizeLang(v.lang).startsWith('de')) ?? null;
}

/**
 * Alman sözünü Web Speech API ilə oxuyur; `lang: de-DE`, mümkünsə alman səsi seçilir.
 */
export function speakGermanWord(raw: string): void {
  if (typeof window === 'undefined') return;
  const text = raw.trim();
  if (!text) return;
  const ss = window.speechSynthesis;
  if (!ss) return;

  ss.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = DE_LANG;
  const voice = pickGermanVoice(ss.getVoices());
  if (voice) utterance.voice = voice;
  ss.speak(utterance);
}

export function cancelGermanSpeech(): void {
  if (typeof window === 'undefined') return;
  window.speechSynthesis?.cancel();
}

/** Bəzi brauzerlərdə səslər `voiceschanged` sonrası dolur — ilk toxunuşdan əvvəl çağırıla bilər. */
export function primeSpeechSynthesisVoices(): void {
  if (typeof window === 'undefined') return;
  try {
    window.speechSynthesis?.getVoices();
  } catch {
    /* ignore */
  }
}
