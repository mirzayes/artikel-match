import confetti from 'canvas-confetti';

/** Dost dəvəti +500 sikkə — tam ekran partlayış. */
export function fireReferralRewardConfetti(): void {
  if (typeof window === 'undefined') return;
  const count = 160;
  const defaults = { origin: { y: 0.72, x: 0.5 } };

  const fire = (particleRatio: number, opts: confetti.Options) => {
    void confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  };

  fire(0.22, { spread: 28, startVelocity: 52, colors: ['#7C3AED', '#f59e0b', '#a78bfa', '#34d399'] });
  fire(0.18, { spread: 58, colors: ['#c4b5fd', '#fb923c', '#a78bfa'] });
  fire(0.32, { spread: 92, decay: 0.9, scalar: 0.85, colors: ['#818cf8', '#f472b6', '#60a5fa'] });
  fire(0.14, { spread: 118, startVelocity: 38, decay: 0.92 });
  window.setTimeout(() => {
    void confetti({
      ...defaults,
      particleCount: 55,
      spread: 360,
      startVelocity: 28,
      ticks: 55,
      scalar: 0.75,
      colors: ['#7C3AED', '#f97316', '#818cf8'],
    });
  }, 180);
}

const PIONER_COLORS = ['#7C3AED', '#f59e0b', '#a78bfa', '#c4b5fd', '#34d399', '#a855f7', '#ea580c'];

/** Pioner (isAlpha) +1000 Artik — daha sıx, qızıl-bənövşəyi partlayış. */
export function firePioneerBonusConfetti(): void {
  if (typeof window === 'undefined') return;
  const count = 220;
  const defaults = { origin: { y: 0.55, x: 0.5 } };

  const fire = (particleRatio: number, opts: confetti.Options) => {
    void confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
    });
  };

  fire(0.2, { spread: 32, startVelocity: 58, colors: PIONER_COLORS });
  fire(0.2, { spread: 68, startVelocity: 48, colors: PIONER_COLORS });
  fire(0.28, { spread: 100, decay: 0.88, scalar: 0.9, colors: PIONER_COLORS });
  fire(0.18, { spread: 125, startVelocity: 36, decay: 0.9 });
  window.setTimeout(() => {
    void confetti({
      ...defaults,
      particleCount: 80,
      spread: 360,
      startVelocity: 32,
      ticks: 70,
      scalar: 0.82,
      colors: PIONER_COLORS,
    });
  }, 120);
  window.setTimeout(() => {
    void confetti({
      origin: { y: 0.35, x: 0.5 },
      particleCount: 45,
      angle: 90,
      spread: 55,
      startVelocity: 42,
      colors: ['#7C3AED', '#c4b5fd', '#a78bfa'],
    });
  }, 280);
}
