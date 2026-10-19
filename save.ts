export interface HighScore {
  score: number;
  date: string;
  rodLevel: number;
  bestFish: string;
}

export interface SaveData {
  coins: number;
  rodLevel: number;
  boatIdx: number;
  profileXP: number;
  totalCaught: number;
  totalEarned: number;
  discovered: number[];
  highScores: HighScore[];
}

const KEY = "oltin-qarmoq-save-v1";
const FISH_COUNT = 330;

export const DEFAULT_SAVE: SaveData = {
  coins: 0,
  rodLevel: 1,
  boatIdx: 0,
  profileXP: 0,
  totalCaught: 0,
  totalEarned: 0,
  discovered: [],
  highScores: [],
};

const asNumber = (value: unknown, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function normalizeSave(input: unknown): SaveData {
  const d = input && typeof input === "object" ? input as Partial<SaveData> : {};
  const discovered = Array.isArray(d.discovered)
    ? [...new Set(d.discovered
      .map((id) => Math.floor(asNumber(id, -1, -1, FISH_COUNT - 1)))
      .filter((id) => id >= 0 && id < FISH_COUNT))]
    : [];
  const highScores = Array.isArray(d.highScores)
    ? d.highScores.slice(0, 100).map((entry) => {
      const hs = entry && typeof entry === "object" ? entry as Partial<HighScore> : {};
      return {
        score: Math.floor(asNumber(hs.score, 0)),
        date: typeof hs.date === "string" ? hs.date.slice(0, 32) : "—",
        rodLevel: Math.floor(asNumber(hs.rodLevel, 1, 1, 300)),
        bestFish: typeof hs.bestFish === "string" ? hs.bestFish.slice(0, 80) : "—",
      };
    }).sort((a, b) => b.score - a.score).slice(0, 8)
    : [];

  return {
    coins: Math.floor(asNumber(d.coins, 0)),
    rodLevel: Math.floor(asNumber(d.rodLevel, 1, 1, 300)),
    boatIdx: Math.floor(asNumber(d.boatIdx, 0, 0, 5)),
    profileXP: asNumber(d.profileXP, 0, 0, 1_000_000_000),
    totalCaught: Math.floor(asNumber(d.totalCaught, 0)),
    totalEarned: Math.floor(asNumber(d.totalEarned, 0)),
    discovered,
    highScores,
  };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    return normalizeSave(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function storeSave(save: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
  } catch {
    // Saqlash joyi to'lgan yoki maxfiy rejimda o'chirilgan bo'lsa ham, o'yin davom etadi.
  }
}

/** Bir qurilma va serverdagi saqlangan natijalarni yo'qotmasdan birlashtiradi. */
export function mergeSaveData(local: SaveData, remote: SaveData): SaveData {
  const scores = new Map<string, HighScore>();
  for (const hs of [...local.highScores, ...remote.highScores]) {
    const key = `${hs.score}|${hs.date}|${hs.rodLevel}|${hs.bestFish}`;
    scores.set(key, hs);
  }

  return normalizeSave({
    coins: Math.max(local.coins, remote.coins),
    rodLevel: Math.max(local.rodLevel, remote.rodLevel),
    boatIdx: Math.max(local.boatIdx, remote.boatIdx),
    profileXP: Math.max(local.profileXP, remote.profileXP),
    totalCaught: Math.max(local.totalCaught, remote.totalCaught),
    totalEarned: Math.max(local.totalEarned, remote.totalEarned),
    discovered: [...local.discovered, ...remote.discovered],
    highScores: [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 8),
  });
}

export function addHighScore(list: HighScore[], hs: HighScore): HighScore[] {
  return [...list, hs].sort((a, b) => b.score - a.score).slice(0, 8);
}
