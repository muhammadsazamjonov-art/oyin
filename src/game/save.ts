export interface HighScore {
  score: number;
  date: string;
  rodLevel: number;
  bestFish: string;
}

export interface SaveData {
  playerId: string;
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
  lastSavedAt: number;
}

const PRIMARY_KEY = "oltin-qarmoq-save-v2";
const BACKUP_KEY = "oltin-qarmoq-save-backup";
const LEGACY_KEY = "oltin-qarmoq-save-v1";

function genPlayerId(): string {
  return "B-" + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const DEFAULT_SAVE: SaveData = {
  playerId: genPlayerId(),
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
  lastSavedAt: Date.now(),
};

export function loadSave(): SaveData {
  let parsed: Partial<SaveData> | null = null;

  try {
    const rawPrimary = localStorage.getItem(PRIMARY_KEY);
    if (rawPrimary) {
      parsed = JSON.parse(rawPrimary);
    }
  } catch {
    /* ignore */
  }

  if (!parsed) {
    try {
      const rawBackup = localStorage.getItem(BACKUP_KEY);
      if (rawBackup) parsed = JSON.parse(rawBackup);
    } catch {
      /* ignore */
    }
  }

  if (!parsed) {
    try {
      const rawLegacy = localStorage.getItem(LEGACY_KEY);
      if (rawLegacy) parsed = JSON.parse(rawLegacy);
    } catch {
      /* ignore */
    }
  }

  if (!parsed) {
    const fresh = { ...DEFAULT_SAVE, playerId: genPlayerId() };
    storeSave(fresh);
    return fresh;
  }

  const merged: SaveData = {
    ...DEFAULT_SAVE,
    ...parsed,
    playerId: parsed.playerId || genPlayerId(),
    playerName: (parsed.playerName && parsed.playerName.trim()) || "Mohir Baliqchi",
    rodLevel: Math.min(300, Math.max(1, Number(parsed.rodLevel) || 1)),
    boatIdx: Math.min(5, Math.max(0, Number(parsed.boatIdx) || 0)),
    soundMuted: Boolean(parsed.soundMuted),
    discovered: Array.isArray(parsed.discovered) ? parsed.discovered : [],
    highScores: Array.isArray(parsed.highScores) ? parsed.highScores : [],
    lastSavedAt: parsed.lastSavedAt || Date.now(),
  };

  return merged;
}

let syncTimeout: any = null;

export function storeSave(s: SaveData) {
  const updated = { ...s, lastSavedAt: Date.now() };

  try {
    const serialized = JSON.stringify(updated);
    localStorage.setItem(PRIMARY_KEY, serialized);
    localStorage.setItem(BACKUP_KEY, serialized);
  } catch (err) {
    console.warn("Lokal saqlashda xatolik:", err);
  }

  // Serverga avtomatik sinxronizatsiya (Debounced)
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => {
    fetch("/api/profile/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(() => {
      // Offline bo'lsa lokal saqlash ishlaydi
    });
  }, 1000);
}

export async function fetchCloudProfile(query: string): Promise<SaveData | null> {
  try {
    const res = await fetch(`/api/profile/load/${encodeURIComponent(query.trim())}`);
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.profile) {
        return {
          ...DEFAULT_SAVE,
          ...data.profile,
        };
      }
    }
  } catch (e) {
    console.warn("Bulutdan yuklashda xatolik:", e);
  }
  return null;
}

export function addHighScore(list: HighScore[], hs: HighScore): HighScore[] {
  const next = [...list, hs].sort((a, b) => b.score - a.score).slice(0, 10);
  return next;
}
