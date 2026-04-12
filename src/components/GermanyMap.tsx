import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AZ_VISITED_CITIES_STORAGE_KEY,
  getMissionCityData,
  MISSION_CITY_POOL_SIZE,
  readVisitedCityIndexes,
} from '../lib/missionGermanCities';

const VB_W = 400;
const VB_H = 500;

/** İstifadəçi verdiyi və yaxınlıq ilə tamamlanmış koordinatlar (viewBox 400×500). */
const CITY_NAME_TO_XY: Record<string, readonly [number, number]> = {
  München: [280, 420],
  Berlin: [340, 180],
  Hamburg: [220, 100],
  Frankfurt: [200, 300],
  Köln: [140, 260],
  Stuttgart: [210, 400],
  Dresden: [380, 220],
  Heidelberg: [200, 360],
  Bremen: [190, 140],
  Düsseldorf: [140, 240],
  Leipzig: [320, 220],
  Nürnberg: [280, 360],
  Hannover: [230, 180],
  Bonn: [150, 270],
  Freiburg: [190, 430],
  Regensburg: [295, 385],
  Augsburg: [245, 405],
  Würzburg: [235, 335],
  Erfurt: [285, 285],
  Jena: [305, 275],
  Rostock: [260, 95],
  Kiel: [215, 55],
  Lübeck: [235, 85],
  Potsdam: [325, 195],
  Mainz: [175, 295],
  Trier: [120, 310],
  Aachen: [125, 255],
  Münster: [175, 215],
  Dortmund: [155, 235],
  Bochum: [150, 245],
  Essen: [145, 250],
  Wiesbaden: [185, 305],
  Darmstadt: [205, 315],
  Mannheim: [195, 345],
  Karlsruhe: [185, 385],
  Konstanz: [215, 445],
  Bamberg: [265, 345],
  Bayreuth: [285, 330],
  Passau: [330, 380],
  Ulm: [225, 395],
  Rothenburg: [250, 350],
  Stralsund: [275, 115],
  Greifswald: [285, 105],
  Schwerin: [245, 125],
  Wismar: [235, 115],
  Magdeburg: [275, 215],
  Halle: [295, 245],
  Dessau: [290, 225],
  Weimar: [285, 265],
  Göttingen: [245, 205],
  Braunschweig: [255, 195],
  Osnabrück: [185, 185],
  Bielefeld: [200, 200],
  Paderborn: [195, 220],
  Siegen: [165, 265],
  Tübingen: [215, 415],
  Reutlingen: [220, 408],
  Pforzheim: [195, 378],
  Offenburg: [175, 395],
  Kaiserslautern: [155, 325],
  Koblenz: [155, 285],
  Saarbrücken: [125, 335],
  Bremerhaven: [175, 115],
  Oldenburg: [195, 155],
  Wolfsburg: [255, 205],
  Salzgitter: [248, 212],
  Hildesheim: [235, 198],
  Görlitz: [395, 255],
  Zwickau: [345, 275],
  Chemnitz: [335, 265],
  Plauen: [325, 285],
  Gera: [310, 275],
  Suhl: [255, 295],
  Eisenach: [235, 275],
  Mühlhausen: [250, 268],
  Nordhausen: [265, 238],
  Quedlinburg: [270, 228],
  Wernigerode: [255, 225],
  Halberstadt: [265, 220],
  Stendal: [285, 205],
  'Lutherstadt Wittenberg': [310, 235],
  'Dessau-Roßlau': [288, 228],
  Bitterfeld: [295, 238],
  Merseburg: [300, 250],
  Naumburg: [295, 258],
  Zeitz: [305, 252],
  Altenburg: [320, 270],
  Glauchau: [338, 272],
  Aue: [330, 282],
  'Annaberg-Buchholz': [328, 268],
  Flensburg: [205, 35],
  Neumünster: [210, 72],
  Lüneburg: [225, 165],
  Celle: [235, 175],
  Hameln: [220, 195],
  Detmold: [195, 208],
  Soest: [175, 225],
  Iserlohn: [158, 248],
  Hagen: [152, 252],
  Wuppertal: [145, 252],
};

function hashToPosition(name: string, index: number): readonly [number, number] {
  let h = index * 2654435761;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 1597334677);
  }
  const x = 95 + (Math.abs(h) % 210);
  const y = 125 + (Math.abs(h >> 12) % 310);
  return [x, y] as const;
}

function pinXYForCityIndex(cityIndex: number): readonly [number, number] {
  const { name } = getMissionCityData(cityIndex);
  const hit = CITY_NAME_TO_XY[name];
  if (hit) return hit;
  return hashToPosition(name, cityIndex);
}

/** 16 Almaniya əyaləti — sadələşdirilmiş konturlar (400×500). */
const BUNDESLAND_PATHS: readonly { id: string; d: string }[] = [
  {
    id: 'sh',
    d: 'M 120 8 L 290 28 L 275 125 L 95 105 Z',
  },
  { id: 'mv', d: 'M 275 25 L 365 45 L 355 140 L 255 120 Z' },
  { id: 'ni', d: 'M 95 95 L 255 115 L 245 210 L 75 195 Z' },
  { id: 'hb', d: 'M 168 118 L 198 118 L 198 138 L 168 138 Z' },
  { id: 'hh', d: 'M 218 88 L 248 88 L 248 108 L 218 108 Z' },
  { id: 'bb', d: 'M 300 130 L 385 145 L 378 240 L 295 225 Z' },
  { id: 'be', d: 'M 318 168 L 352 168 L 352 198 L 318 198 Z' },
  { id: 'st', d: 'M 265 200 L 355 215 L 340 295 L 255 280 Z' },
  { id: 'th', d: 'M 235 255 L 320 268 L 305 340 L 225 325 Z' },
  { id: 'sn', d: 'M 315 235 L 398 255 L 388 340 L 308 318 Z' },
  { id: 'nw', d: 'M 95 200 L 195 215 L 185 295 L 88 285 Z' },
  { id: 'he', d: 'M 155 255 L 255 275 L 240 355 L 145 338 Z' },
  { id: 'rp', d: 'M 105 285 L 175 298 L 165 365 L 95 350 Z' },
  { id: 'sl', d: 'M 88 328 L 138 335 L 130 378 L 82 368 Z' },
  { id: 'bw', d: 'M 145 340 L 280 365 L 255 485 L 125 455 Z' },
  { id: 'by', d: 'M 255 300 L 395 330 L 375 485 L 240 455 Z' },
];

function readVisitedSorted(): number[] {
  return [...readVisitedCityIndexes()].sort((a, b) => a - b);
}

function visitedKey(ids: number[]): string {
  return JSON.stringify(ids);
}

export function GermanyMap() {
  const [visited, setVisited] = useState<number[]>(() => readVisitedSorted());
  const [pulseIds, setPulseIds] = useState<Set<number>>(() => new Set());
  const [tipIndex, setTipIndex] = useState<number | null>(null);
  const prevKeyRef = useRef<string | null>(null);
  const pulseClearTimerRef = useRef<number | null>(null);

  const refreshVisited = useCallback(() => {
    setVisited(readVisitedSorted());
  }, []);

  useEffect(() => {
    refreshVisited();
    const onStorage = (e: StorageEvent) => {
      if (e.key === AZ_VISITED_CITIES_STORAGE_KEY || e.key === null) refreshVisited();
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') refreshVisited();
    };
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', onVis);
    const id = window.setInterval(refreshVisited, 2000);
    return () => {
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', onVis);
      window.clearInterval(id);
      if (pulseClearTimerRef.current != null) window.clearTimeout(pulseClearTimerRef.current);
      pulseClearTimerRef.current = null;
    };
  }, [refreshVisited]);

  useEffect(() => {
    const key = visitedKey(visited);
    if (prevKeyRef.current === null) {
      prevKeyRef.current = key;
      return;
    }
    if (prevKeyRef.current === key) return;
    let prevArr: number[] = [];
    try {
      const parsed = JSON.parse(prevKeyRef.current!) as unknown;
      if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'number')) prevArr = parsed as number[];
    } catch {
      prevArr = [];
    }
    const prev = new Set(prevArr);
    const now = new Set(visited);
    const added: number[] = [];
    for (const id of now) {
      if (!prev.has(id)) added.push(id);
    }
    prevKeyRef.current = key;
    if (added.length === 0) return;
    if (pulseClearTimerRef.current != null) window.clearTimeout(pulseClearTimerRef.current);
    setPulseIds(new Set(added));
    pulseClearTimerRef.current = window.setTimeout(() => {
      pulseClearTimerRef.current = null;
      setPulseIds(new Set());
    }, 2600);
  }, [visited]);

  const visitedSet = useMemo(() => new Set(visited), [visited]);
  const total = MISSION_CITY_POOL_SIZE;
  const count = visited.length;

  const pins = useMemo(() => {
    const out: { i: number; x: number; y: number; name: string; on: boolean; pulse: boolean }[] = [];
    for (let i = 0; i < total; i++) {
      const [x, y] = pinXYForCityIndex(i);
      const { name } = getMissionCityData(i);
      out.push({
        i,
        x,
        y,
        name,
        on: visitedSet.has(i),
        pulse: pulseIds.has(i),
      });
    }
    return out;
  }, [total, visitedSet, pulseIds]);

  return (
    <div className="germany-map-wrap mt-4 w-full">
      <style>{`
        @keyframes germany-map-pin-pulse {
          0% { transform: scale(0.3); opacity: 0; }
          35% { transform: scale(1.25); opacity: 1; }
          55% { transform: scale(1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes germany-map-pin-glow {
          0%, 100% { filter: drop-shadow(0 0 6px rgba(167, 139, 250, 0.95)); }
          50% { filter: drop-shadow(0 0 14px rgba(192, 132, 252, 1)) drop-shadow(0 0 22px rgba(124, 58, 237, 0.65)); }
        }
        .germany-map-pin--pulse {
          animation: germany-map-pin-pulse 0.85s ease-out both, germany-map-pin-glow 1.2s ease-in-out 0.2s 2;
        }
      `}</style>
      <h3 className="mb-2 text-center text-[15px] font-bold tracking-tight text-artikl-heading">
        🗺️ Almaniya Səyahəti
      </h3>
      <div
        className="relative mx-auto w-full max-w-[min(100%,320px)] overflow-visible rounded-2xl border border-violet-500/25 bg-gradient-to-b from-[#14101f] to-[#0c0a12] shadow-[0_12px_40px_rgba(124,58,237,0.12)]"
        style={{ height: 300 }}
      >
        <svg
          className="h-full w-full touch-manipulation"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Almaniya xəritəsi və səyahət iğnələri"
        >
          <g className="germany-map-lander" opacity={0.95}>
            {BUNDESLAND_PATHS.map((b) => (
              <path
                key={b.id}
                d={b.d}
                fill="rgba(124, 58, 237, 0.07)"
                stroke="rgba(167, 139, 250, 0.35)"
                strokeWidth={1.1}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <g className="germany-map-pins">
            {pins.map((p) => (
              <g
                key={p.i}
                transform={`translate(${p.x}, ${p.y})`}
                className="cursor-pointer"
                style={{
                  outline: 'none',
                  filter: p.on
                    ? 'drop-shadow(0 0 5px rgba(167, 139, 250, 0.9)) drop-shadow(0 0 10px rgba(124, 58, 237, 0.55))'
                    : 'grayscale(1)',
                  opacity: p.on ? 1 : 0.48,
                }}
                onPointerEnter={() => setTipIndex(p.i)}
                onPointerLeave={() => setTipIndex((cur) => (cur === p.i ? null : cur))}
                onPointerDown={() => setTipIndex(p.i)}
                role="button"
                tabIndex={0}
                aria-label={p.name}
              >
                <title>{p.name}</title>
                {p.pulse && p.on ? (
                  <circle
                    r={18}
                    fill="rgba(167, 139, 250, 0.25)"
                    className="germany-map-pin--pulse pointer-events-none"
                  />
                ) : null}
                <text y={5} textAnchor="middle" className="select-none text-[15px] leading-none">
                  📍
                </text>
                {tipIndex === p.i ? (
                  <g transform="translate(0,-22)">
                    <rect
                      x={-Math.min(140, p.name.length * 7 + 16) / 2}
                      y={-14}
                      width={Math.min(140, p.name.length * 7 + 16)}
                      height={20}
                      rx={6}
                      fill="rgba(12,10,20,0.92)"
                      stroke="rgba(167,139,250,0.5)"
                      strokeWidth={0.75}
                    />
                    <text
                      y={2}
                      textAnchor="middle"
                      className="fill-violet-100 text-[9px] font-bold"
                      style={{ fontSize: 9 }}
                    >
                      {p.name.length > 18 ? `${p.name.slice(0, 17)}…` : p.name}
                    </text>
                  </g>
                ) : null}
              </g>
            ))}
          </g>
        </svg>
      </div>
      <p className="mt-2 text-center text-[12px] font-semibold tabular-nums text-artikl-caption">
        {count} / {total} şəhər ziyarət edildi
      </p>
    </div>
  );
}
