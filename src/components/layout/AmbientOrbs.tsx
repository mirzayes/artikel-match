/** Фоновые «орбы» — фиксированные, не перехватывают клики */
export function AmbientOrbs() {
  return (
    <>
      <div
        className="pointer-events-none fixed -left-[100px] -top-[100px] z-0 h-[500px] w-[500px] rounded-full blur-[120px]"
        style={{
          background: `rgb(var(--artikl-orb-violet) / var(--artikl-orb-violet-a, 0.12))`,
        }}
        aria-hidden
      />
      <div
        className="pointer-events-none fixed bottom-[100px] -right-[100px] z-0 h-[400px] w-[400px] rounded-full blur-[120px]"
        style={{
          background: `rgb(var(--artikl-orb-green) / var(--artikl-orb-green-a, 0.06))`,
        }}
        aria-hidden
      />
    </>
  );
}
