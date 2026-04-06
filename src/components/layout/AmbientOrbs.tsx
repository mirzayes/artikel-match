/** Фоновые «орбы» — фиксированные, не перехватывают клики */
export function AmbientOrbs() {
  return (
    <>
      <div
        className="pointer-events-none fixed -left-[100px] -top-[100px] z-0 h-[500px] w-[500px] rounded-full bg-[rgba(124,108,248,0.12)] blur-[120px]"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed bottom-[100px] -right-[100px] z-0 h-[400px] w-[400px] rounded-full bg-[rgba(74,222,128,0.06)] blur-[120px]"
        aria-hidden
      />
    </>
  );
}
