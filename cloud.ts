import { SaveData } from "./save";

export interface GlobalScore {
  name: string;
  score: number;
  date: string;
  rodLevel: number;
  bestFish: string;
}

const PLAYER_ID_KEY = "oltin-qarmoq-player-id-v1";

export function getPlayerId(): string {
  try {
    const saved = localStorage.getItem(PLAYER_ID_KEY);
    if (saved && /^[a-zA-Z0-9_-]{8,80}$/.test(saved)) return saved;

    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `oq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    localStorage.setItem(PLAYER_ID_KEY, id);
    return id;
  } catch {
    return `oq-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`Server ${response.status}: ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export async function loadCloudProfile(playerId: string): Promise<SaveData | null> {
  const result = await request<{ profile: SaveData | null }>(`/api/profile/${encodeURIComponent(playerId)}`);
  return result.profile;
}

export async function saveCloudProfile(playerId: string, profile: SaveData): Promise<void> {
  await request<{ ok: boolean }>(`/api/profile/${encodeURIComponent(playerId)}`, {
    method: "PUT",
    body: JSON.stringify({ profile }),
  });
}

export async function fetchGlobalLeaderboard(): Promise<GlobalScore[]> {
  const result = await request<{ entries: GlobalScore[] }>("/api/leaderboard?limit=5");
  return result.entries;
}

export async function recordGlobalScore(
  playerId: string,
  score: Omit<GlobalScore, "name">,
): Promise<void> {
  await request<{ ok: boolean }>("/api/leaderboard", {
    method: "POST",
    body: JSON.stringify({
      playerId,
      name: `Baliqchi ${playerId.slice(0, 4).toUpperCase()}`,
      ...score,
    }),
  });
}
