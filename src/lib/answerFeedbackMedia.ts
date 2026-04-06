/** Qısa "bip" — düzgün cavab */
export function playCorrectAnswerBeep(): void {
  try {
    const AC =
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 920;
    osc.connect(g);
    g.connect(ctx.destination);
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.11, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
    osc.start(t0);
    osc.stop(t0 + 0.1);
    void ctx.resume?.();
  } catch {
    /* səs mövcud deyilsə və ya bloklanıbsa */
  }
}

/** İkiqat vibrasiya — səhv cavab */
export function vibrateWrongAnswer(): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    navigator.vibrate([55, 75, 55]);
  }
}
