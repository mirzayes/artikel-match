function safeVibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      void navigator.vibrate(pattern);
    } catch {
      /* bəzi brauzerlər / iOS məhdudiyyəti */
    }
  }
}

/** Mobil: düzgün cavab — qısa impuls. */
export function vibrateCorrectAnswer(): void {
  safeVibrate(22);
}

/** Mobil: səhv — iki qısa impuls. */
export function vibrateWrongAnswer(): void {
  safeVibrate([14, 55, 14, 55, 14]);
}

/** Mobil: sikkə / mükafat — yüngül impuls. */
export function vibrateCoinReward(): void {
  safeVibrate(16);
}

/** Qısa "bip" — düzgün cavab */
export function playCorrectAnswerBeep(): void {
  vibrateCorrectAnswer();
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

function playToneSequence(
  frequencies: number[],
  durationEach: number,
  gainPeak: number,
  type: OscillatorType = 'sine',
): void {
  try {
    const AC =
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    void ctx.resume?.();
    let t = ctx.currentTime;
    for (const freq of frequencies) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      osc.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gainPeak, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + durationEach);
      osc.start(t);
      osc.stop(t + durationEach + 0.02);
      t += durationEach * 0.72;
    }
  } catch {
    /* ignore */
  }
}

/** Sessiya bitimi: bir sikkə «ding» (daha yumşaq). */
export function playSessionCompletionCoinSound(): void {
  playToneSequence([740, 990], 0.085, 0.1, 'sine');
}

/** Tək sikkə: qısa parıltı (Web Audio). */
export function playSingleCoinBling(): void {
  try {
    const AC =
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    void ctx.resume?.();
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    const t0 = ctx.currentTime;
    osc.frequency.setValueAtTime(2100, t0);
    osc.frequency.exponentialRampToValueAtTime(3200, t0 + 0.035);
    osc.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.09, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.055);
    osc.start(t0);
    osc.stop(t0 + 0.07);
  } catch {
    /* ignore */
  }
}

/** Öyrənmə sessiyası: bir neçə sikkə üçün ardıcıl «bling» (maks. 14). */
export function playLessonCoinsBlingBurst(granted: number): void {
  const n = Math.min(Math.max(0, Math.floor(granted)), 14);
  if (n > 0) vibrateCoinReward();
  for (let i = 0; i < n; i++) {
    window.setTimeout(() => playSingleCoinBling(), i * 38);
  }
}

/** A1 sənduq + referral böyük mükafat — qısa fanfar. */
export function playMilestoneFanfare(): void {
  try {
    const AC =
      typeof window !== 'undefined' &&
      (window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    void ctx.resume?.();
    const freqs = [392, 493, 587, 784, 988, 1174];
    let t = ctx.currentTime;
    for (let i = 0; i < freqs.length; i++) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freqs[i];
      osc.connect(g);
      g.connect(ctx.destination);
      const dur = i < 3 ? 0.16 : 0.22;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.11, t + 0.028);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.start(t);
      osc.stop(t + dur + 0.04);
      t += dur * 0.52;
    }
  } catch {
    /* ignore */
  }
}

/** Səhvsiz raund bonusu: daha yüksək, zəngli iki ton. */
export function playCoinBonusChime(): void {
  vibrateCoinReward();
  playToneSequence([1320, 1760, 2093], 0.07, 0.14, 'triangle');
}
