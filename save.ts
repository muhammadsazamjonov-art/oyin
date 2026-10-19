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

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const d = JSON.parse(raw);
    return { ...DEFAULT_SAVE, ...d };
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

export function storeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function addHighScore(list: HighScore[], hs: HighScore): HighScore[] {
  const next = [...list, hs].sort((a, b) => b.score - a.score).slice(0, 8);
  return next;
}
