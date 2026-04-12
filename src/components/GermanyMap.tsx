import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AZ_VISITED_CITIES_STORAGE_KEY,
  getMissionCityData,
  MISSION_CITY_POOL_SIZE,
  readVisitedCityIndexes,
} from '../lib/missionGermanCities';

const VB_W = 400;
const VB_H = 500;
const MAP_BG = '#FDF6E3';
const BORDER = '#D1C9B8';
/** ~6px ekran radiusu (xəritə hündürlüyü 300px olduqda) — viewBox ölçüsü ilə uyğunlaşdırılıb. */
const DOT_R = 10;
const LABEL_OFFSET = DOT_R + 8;

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

const BUNDESLAND_PATHS: readonly { id: string; d: string }[] = [
  { id: 'sh', d: 'M 120 8 L 290 28 L 275 125 L 95 105 Z' },
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

  const total = MISSION_CITY_POOL_SIZE;
  const count = visited.length;

  const visitedPins = useMemo(() => {
    return visited.map((i) => {
      const [x, y] = pinXYForCityIndex(i);
      const { name } = getMissionCityData(i);
      const labelRight = x < VB_W * 0.55;
      return {
        i,
        x,
        y,
        name,
        pulse: pulseIds.has(i),
        labelRight,
      };
    });
  }, [visited, pulseIds]);

  return (
    <div className="germany-map-wrap mt-4 w-full">
      <style>{`
        @keyframes germany-map-pin-pulse {
          0% { transform: scale(0.2); opacity: 0; }
          40% { transform: scale(1.15); opacity: 0.9; }
          100% { transform: scale(1); opacity: 1; }
        }
        .germany-map-pin--pulse {
          animation: germany-map-pin-pulse 0.75s ease-out both;
        }
      `}</style>
      <h3 className="mb-3 text-center text-[15px] font-bold tracking-tight text-[#3d3845] dark:text-artikl-heading">
        🗺️ Almaniya Səyahəti
      </h3>
      <div
        className="relative mx-auto w-full max-w-[min(100%,300px)] rounded-2xl border px-8 py-10 shadow-sm"
        style={{
          height: 300,
          backgroundColor: MAP_BG,
          borderColor: BORDER,
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full touch-manipulation"
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Almaniya xəritəsi — ziyarət olunan şəhərlər"
        >
          <rect width={VB_W} height={VB_H} fill={MAP_BG} />
          <g opacity={count === 0 ? 0.45 : 1}>
            {BUNDESLAND_PATHS.map((b) => (
              <path
                key={b.id}
                d={b.d}
                fill="transparent"
                stroke={BORDER}
                strokeWidth={1.15}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          {count > 0 ? (
            <g className="germany-map-pins">
              {visitedPins.map((p) => (
                <g key={p.i} transform={`translate(${p.x}, ${p.y})`} style={{ outline: 'none' }}>
                  {p.pulse ? (
                    <circle
                      r={22}
                      fill="rgba(124, 58, 237, 0.14)"
                      className="germany-map-pin--pulse pointer-events-none"
                    />
                  ) : null}
                  <circle
                    r={DOT_R}
                    cx={0}
                    cy={0}
                    fill="#6d28d9"
                    style={{
                      filter: 'drop-shadow(0 0 3px rgba(109, 40, 217, 0.55)) drop-shadow(0 0 8px rgba(124, 58, 237, 0.3))',
                    }}
                  />
                  <text
                    x={p.labelRight ? LABEL_OFFSET : -LABEL_OFFSET}
                    y={3}
                    textAnchor={p.labelRight ? 'start' : 'end'}
                    className="select-none font-semibold"
                    fill="#4c1d95"
                    style={{
                      fontSize: 11,
                      letterSpacing: '0.01em',
                      paintOrder: 'stroke fill',
                      stroke: MAP_BG,
                      strokeWidth: 3,
                      strokeLinejoin: 'round',
                    }}
                  >
                    {p.name.length > 22 ? `${p.name.slice(0, 21)}…` : p.name}
                  </text>
                </g>
              ))}
            </g>
          ) : null}
        </svg>
        {count === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center px-8">
            <p className="max-w-[14rem] text-[13px] font-medium leading-relaxed text-[#7a7268]">
              Hələ şəhər ziyarət edilməyib
            </p>
          </div>
        ) : null}
      </div>
      <p className="mt-3 text-center text-[12px] font-medium tabular-nums text-[#6b6560] dark:text-artikl-caption">
        {count} / {total} şəhər ziyarət edildi
      </p>
    </div>
  );
}
