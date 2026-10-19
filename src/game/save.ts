export interface HighScore {
  score: number;
  date: string;
  rodLevel: number;
  bestFish: string;
}

export interface SaveData {
  playerName: string;
  coins: number;
  rodLevel: number;
  boatIdx: number;
  profileXP: number;
  totalCaught: number;
  totalEarned: number;
  discovered: number[];
  highScores: HighScore[];
  soundMuted: boolean;
}

const KEY = "oltin-qarmoq-save-v2";

export const DEFAULT_SAVE: SaveData = {
  playerName: "Mohir Baliqchi",
  coins: 0,
  rodLevel: 1,
  boatIdx: 0,
  profileXP: 0,
  totalCaught: 0,
  totalEarned: 0,
  discovered: [],
  highScores: [],
  soundMuted: false,
};

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY) || localStorage.getItem("oltin-qarmoq-save-v1");
    if (!raw) return { ...DEFAULT_SAVE };
    const d = JSON.parse(raw);
    return {
      ...DEFAULT_SAVE,
      ...d,
      playerName: d.playerName || "Mohir Baliqchi",
      soundMuted: Boolean(d.soundMuted),
    };
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
  const next = [...list, hs].sort((a, b) => b.score - a.score).slice(0, 10);
  return next;
}
