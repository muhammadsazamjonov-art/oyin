import { createServer } from "node:http";
import { readFile, mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "dist");
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, ".data", "game-state.json");
const apiOnly = process.argv.includes("--api-only");
const port = Number(process.env.PORT || (apiOnly ? 8787 : 3000));
const maxBodyBytes = 128 * 1024;
const fishCount = 330;

const pool = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
    max: 5,
    idleTimeoutMillis: 30_000,
  })
  : null;

let localState = { profiles: {}, leaderboard: {} };
let localWriteQueue = Promise.resolve();

function clampNumber(value, fallback, min = 0, max = Number.MAX_SAFE_INTEGER) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

function shortText(value, fallback, limit) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, limit)
    : fallback;
}

function sanitizeProfile(value) {
  const input = value && typeof value === "object" ? value : {};
  const discovered = Array.isArray(input.discovered)
    ? [...new Set(input.discovered
      .map((id) => Math.floor(clampNumber(id, -1, -1, fishCount - 1)))
      .filter((id) => id >= 0 && id < fishCount))]
    : [];
  const highScores = Array.isArray(input.highScores)
    ? input.highScores.slice(0, 100).map((entry) => {
      const score = entry && typeof entry === "object" ? entry : {};
      return {
        score: Math.floor(clampNumber(score.score, 0)),
        date: shortText(score.date, "—", 32),
        rodLevel: Math.floor(clampNumber(score.rodLevel, 1, 1, 300)),
        bestFish: shortText(score.bestFish, "—", 80),
      };
    }).sort((a, b) => b.score - a.score).slice(0, 8)
    : [];

  return {
    coins: Math.floor(clampNumber(input.coins, 0)),
    rodLevel: Math.floor(clampNumber(input.rodLevel, 1, 1, 300)),
    boatIdx: Math.floor(clampNumber(input.boatIdx, 0, 0, 5)),
    profileXP: clampNumber(input.profileXP, 0, 0, 1_000_000_000),
    totalCaught: Math.floor(clampNumber(input.totalCaught, 0)),
    totalEarned: Math.floor(clampNumber(input.totalEarned, 0)),
    discovered,
    highScores,
  };
}

function sanitizeLeaderboardEntry(input, playerId) {
  const score = Math.floor(clampNumber(input?.score, -1, 0, 1_000_000_000));
  if (score < 1) return null;
  return {
    playerId,
    name: shortText(input?.name, `Baliqchi ${playerId.slice(0, 4).toUpperCase()}`, 24),
    score,
    date: shortText(input?.date, new Date().toLocaleDateString("uz-UZ"), 32),
    rodLevel: Math.floor(clampNumber(input?.rodLevel, 1, 1, 300)),
    bestFish: shortText(input?.bestFish, "—", 80),
  };
}

async function loadLocalState() {
  try {
    const contents = await readFile(DATA_FILE, "utf8");
    const loaded = JSON.parse(contents);
    localState = {
      profiles: loaded?.profiles && typeof loaded.profiles === "object" ? loaded.profiles : {},
      leaderboard: loaded?.leaderboard && typeof loaded.leaderboard === "object" ? loaded.leaderboard : {},
    };
  } catch (error) {
    if (error?.code !== "ENOENT") console.warn("Local game data could not be read; starting fresh.", error);
    localState = { profiles: {}, leaderboard: {} };
  }
}

function persistLocalState() {
  const snapshot = JSON.stringify(localState, null, 2);
  localWriteQueue = localWriteQueue.catch(() => undefined).then(async () => {
    await mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temporaryFile = `${DATA_FILE}.tmp`;
    await writeFile(temporaryFile, snapshot, "utf8");
    await rename(temporaryFile, DATA_FILE);
  });
  return localWriteQueue;
}

async function initializeDatabase() {
  if (!pool) {
    await loadLocalState();
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_profiles (
      player_id TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_leaderboard (
      player_id TEXT PRIMARY KEY,
      player_name TEXT NOT NULL,
      score BIGINT NOT NULL CHECK (score >= 0),
      date TEXT NOT NULL,
      rod_level INTEGER NOT NULL,
      best_fish TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await pool.query("CREATE INDEX IF NOT EXISTS game_leaderboard_score_idx ON game_leaderboard (score DESC, updated_at ASC)");
}

function sendJson(response, statusCode, data) {
  const body = JSON.stringify(data);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

async function readJson(request) {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > maxBodyBytes) {
    const error = new Error("Request body is too large.");
    error.statusCode = 413;
    throw error;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > maxBodyBytes) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const error = new Error("Request body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function decodePlayerId(encoded) {
  let id;
  try {
    id = decodeURIComponent(encoded);
  } catch {
    return null;
  }
  return /^[a-zA-Z0-9_-]{8,80}$/.test(id) ? id : null;
}

async function getProfile(playerId) {
  if (!pool) return localState.profiles[playerId] || null;
  const { rows } = await pool.query("SELECT data FROM game_profiles WHERE player_id = $1", [playerId]);
  return rows[0]?.data || null;
}

async function putProfile(playerId, profile) {
  if (!pool) {
    localState.profiles[playerId] = profile;
    await persistLocalState();
    return;
  }
  await pool.query(
    `INSERT INTO game_profiles (player_id, data, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (player_id) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
    [playerId, JSON.stringify(profile)],
  );
}

async function getLeaderboard(limit) {
  if (!pool) {
    return Object.values(localState.leaderboard)
      .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))
      .slice(0, limit)
      .map(({ playerId: _playerId, ...entry }) => entry);
  }
  const { rows } = await pool.query(
    `SELECT player_name AS name, score::int AS score, date,
            rod_level AS "rodLevel", best_fish AS "bestFish"
       FROM game_leaderboard
      ORDER BY score DESC, updated_at ASC
      LIMIT $1`,
    [limit],
  );
  return rows;
}

async function saveLeaderboardEntry(entry) {
  if (!pool) {
    const previous = localState.leaderboard[entry.playerId];
    if (!previous || entry.score > previous.score) {
      localState.leaderboard[entry.playerId] = entry;
      await persistLocalState();
    }
    return;
  }
  await pool.query(
    `INSERT INTO game_leaderboard (player_id, player_name, score, date, rod_level, best_fish)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (player_id) DO UPDATE SET
       player_name = EXCLUDED.player_name,
       score = EXCLUDED.score,
       date = EXCLUDED.date,
       rod_level = EXCLUDED.rod_level,
       best_fish = EXCLUDED.best_fish,
       updated_at = NOW()
     WHERE EXCLUDED.score > game_leaderboard.score`,
    [entry.playerId, entry.name, entry.score, entry.date, entry.rodLevel, entry.bestFish],
  );
}

async function handleApi(request, response, url) {
  const { pathname, searchParams } = url;

  if (pathname === "/api/health" && request.method === "GET") {
    if (pool) await pool.query("SELECT 1");
    return sendJson(response, 200, { ok: true, storage: pool ? "postgres" : "file" });
  }

  const profileMatch = pathname.match(/^\/api\/profile\/([^/]+)$/);
  if (profileMatch) {
    const playerId = decodePlayerId(profileMatch[1]);
    if (!playerId) return sendJson(response, 400, { error: "Player id is invalid." });

    if (request.method === "GET") {
      return sendJson(response, 200, { profile: await getProfile(playerId) });
    }
    if (request.method === "PUT") {
      const body = await readJson(request);
      const profile = sanitizeProfile(body.profile);
      await putProfile(playerId, profile);
      return sendJson(response, 200, { ok: true, profile });
    }
    response.setHeader("Allow", "GET, PUT");
    return sendJson(response, 405, { error: "Method not allowed." });
  }

  if (pathname === "/api/leaderboard" && request.method === "GET") {
    const limit = Math.floor(clampNumber(searchParams.get("limit"), 10, 1, 20));
    return sendJson(response, 200, { entries: await getLeaderboard(limit) });
  }
  if (pathname === "/api/leaderboard" && request.method === "POST") {
    const body = await readJson(request);
    const playerId = typeof body.playerId === "string" ? body.playerId : "";
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(playerId)) {
      return sendJson(response, 400, { error: "Player id is invalid." });
    }
    const entry = sanitizeLeaderboardEntry(body, playerId);
    if (entry) await saveLeaderboardEntry(entry);
    return sendJson(response, 200, { ok: true, recorded: Boolean(entry) });
  }

  return sendJson(response, 404, { error: "API route not found." });
}

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

async function serveStatic(request, response, pathname) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    return sendJson(response, 400, { error: "Invalid URL path." });
  }
  const requested = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  let filePath = path.resolve(DIST, requested);
  if (filePath !== DIST && !filePath.startsWith(`${DIST}${path.sep}`)) {
    return sendJson(response, 403, { error: "Forbidden." });
  }

  try {
    const fileInfo = await stat(filePath);
    if (!fileInfo.isFile()) filePath = path.join(DIST, "index.html");
  } catch {
    filePath = path.join(DIST, "index.html");
  }

  try {
    const content = await readFile(filePath);
    const type = mimeTypes[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": type,
      "Content-Length": content.length,
      "Cache-Control": path.basename(filePath) === "index.html" ? "no-cache" : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });
    response.end(request.method === "HEAD" ? undefined : content);
  } catch {
    sendJson(response, 503, { error: "Game files are not built yet. Run npm run build first." });
  }
}

await initializeDatabase();

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(request, response, url);
      return;
    }
    if (apiOnly) {
      sendJson(response, 200, { ok: true, service: "Oltin Qarmoq API", health: "/api/health" });
      return;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "Method not allowed." });
      return;
    }
    await serveStatic(request, response, url.pathname);
  } catch (error) {
    console.error("Request failed:", error);
    if (!response.headersSent) sendJson(response, error.statusCode || 500, { error: "Server error." });
    else response.destroy();
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Oltin Qarmoq ${apiOnly ? "API" : "server"} listening on 0.0.0.0:${port} (storage: ${pool ? "postgres" : "local file"})`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => {
      if (pool) void pool.end().finally(() => process.exit(0));
      else process.exit(0);
    });
  });
}
