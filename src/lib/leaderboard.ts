/** Lokal «liderlər»: NPC + bir real oyunçu (ümumi XP). */

export interface LeaderboardNpc {
  id: string;
  name: string;
  xp: number;
}

/** Təcrübə üzrə pilləkan — oyunçu vaxt keçdikcə yuxarı çıxır. */
export const LEADERBOARD_NPCS: LeaderboardNpc[] = [
  { id: 'npc-nərmin', name: 'Nərmin', xp: 52_400 },
  { id: 'npc-elvin', name: 'Elvin', xp: 41_200 },
  { id: 'npc-leyla', name: 'Leyla', xp: 33_800 },
  { id: 'npc-rəşad', name: 'Rəşad', xp: 26_500 },
  { id: 'npc-aygün', name: 'Aygün', xp: 20_100 },
  { id: 'npc-orxan', name: 'Orxan', xp: 16_400 },
  { id: 'npc-səbinə', name: 'Səbinə', xp: 12_900 },
  { id: 'npc-tural', name: 'Tural', xp: 9_800 },
  { id: 'npc-dəniz', name: 'Dəniz', xp: 7_200 },
  { id: 'npc-zülfü', name: 'Zülfü', xp: 5_100 },
  { id: 'npc-günel', name: 'Günel', xp: 3_600 },
  { id: 'npc-əmil', name: 'Əmil', xp: 2_400 },
  { id: 'npc-lalə', name: 'Lalə', xp: 1_550 },
  { id: 'npc-kamran', name: 'Kamran', xp: 980 },
  { id: 'npc-ülkər', name: 'Ülkər', xp: 620 },
  { id: 'npc-bəhruz', name: 'Bəhruz', xp: 380 },
  { id: 'npc-şahnaz', name: 'Şahnaz', xp: 210 },
  { id: 'npc-cavid', name: 'Cavid', xp: 95 },
];

export interface LeaderboardRow {
  rank: number;
  id: string;
  name: string;
  xp: number;
  isUser: boolean;
}

export interface LeaderboardSnapshot {
  rows: LeaderboardRow[];
  userRank: number;
  totalPlayers: number;
  /** Bir pillə yuxarıdakı oyunçu (obıq etmək üçün). */
  nextAbove: LeaderboardRow | null;
  /** `nextAbove`-ı keçmək üçün lazım olan təxmini XP (+1 üstünlük). */
  xpToOvertake: number | null;
}

const USER_ID = '__user__';

export function buildLeaderboard(userXp: number, rawDisplayName: string): LeaderboardSnapshot {
  const trimmed = rawDisplayName.trim();
  const userName = trimmed.length > 0 ? trimmed : 'Sən';

  const combined = [
    ...LEADERBOARD_NPCS.map((n) => ({
      id: n.id,
      name: n.name,
      xp: n.xp,
      isUser: false as const,
    })),
    { id: USER_ID, name: userName, xp: Math.max(0, Math.floor(userXp)), isUser: true as const },
  ];

  combined.sort((a, b) => {
    if (b.xp !== a.xp) return b.xp - a.xp;
    if (a.isUser !== b.isUser) return a.isUser ? -1 : 1;
    return a.name.localeCompare(b.name, 'az');
  });

  const rows: LeaderboardRow[] = combined.map((r, i) => ({
    rank: i + 1,
    id: r.id,
    name: r.name,
    xp: r.xp,
    isUser: r.isUser,
  }));

  const userRow = rows.find((r) => r.isUser);
  const userRank = userRow?.rank ?? rows.length;
  const userIdx = rows.findIndex((r) => r.isUser);
  const nextAbove = userIdx > 0 ? rows[userIdx - 1]! : null;
  const uXp = userRow?.xp ?? 0;
  const xpToOvertake =
    nextAbove != null && nextAbove.xp >= uXp ? nextAbove.xp - uXp + 1 : null;

  return {
    rows,
    userRank,
    totalPlayers: rows.length,
    nextAbove,
    xpToOvertake,
  };
}
