import type { MissionGermanCity } from '../lib/missionGermanCities';

type MissionCityRevealProps = {
  city: MissionGermanCity;
  visitedUniqueCount: number;
};

export function MissionCityReveal({ city, visitedUniqueCount }: MissionCityRevealProps) {
  return (
    <div
      className="fixed inset-0 z-[198] flex flex-col items-center justify-center gap-5 bg-gradient-to-b from-[#0c0a14] via-[#16122a] to-[#0a0812] px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(2rem,env(safe-area-inset-top))] text-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mission-city-welcome"
    >
      <p
        id="mission-city-welcome"
        className="max-w-[min(100%,22rem)] text-[1.35rem] font-black leading-snug tracking-tight text-white sm:text-2xl"
      >
        ✈️ {city.name}-ə xoş gəldiniz!
      </p>
      <p className="max-w-[min(100%,20rem)] text-lg font-bold leading-snug text-amber-100/95 sm:text-xl">
        <span className="mr-1.5" aria-hidden>
          {city.emoji}
        </span>
        {city.nickname}
      </p>
      <p className="max-w-[min(100%,22rem)] text-[0.95rem] font-bold leading-relaxed text-violet-200/95 sm:text-base">
        {city.funFact}
      </p>
      <p className="mt-1 text-base font-black text-emerald-200/95 sm:text-lg">
        🗺️ {visitedUniqueCount} şəhər ziyarət edildi
      </p>
    </div>
  );
}
