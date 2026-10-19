import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// In-memory leaderboard, stats and profiles with file persistence backup
const DATA_DIR = path.join(__dirname, ".data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");
const STATS_FILE = path.join(DATA_DIR, "stats.json");
const PROFILES_FILE = path.join(DATA_DIR, "profiles.json");

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn("Could not create .data directory, running fully in-memory", e);
  }
}

// Default initial high scores
let leaderboard = [
  { id: "1", name: "Dengiz Bo'risi", score: 854000, bestFish: "Afsonaviy akula", rodLevel: 285, boat: "Afsonaviy kema", date: "Bugun" },
  { id: "2", name: "Amudaryo Ustasi", score: 492000, bestFish: "Qirol laqqa", rodLevel: 210, boat: "Oq yaxta", date: "Kecha" },
  { id: "3", name: "Chorvoq Ovchisi", score: 268000, bestFish: "Yoqut gulmohi", rodLevel: 165, boat: "Baliqchi kemasi", date: "2 kun oldin" },
  { id: "4", name: "Sardor Baliqchi", score: 145000, bestFish: "Marvarid sudak", rodLevel: 120, boat: "Motorli kater", date: "3 kun oldin" },
  { id: "5", name: "Orol Sayyohi", score: 62000, bestFish: "Oltin sazan", rodLevel: 75, boat: "Yelkanli qayiq", date: "4 kun oldin" },
];

let globalStats = {
  totalCatches: 12450,
  totalEarned: 48500000,
  activeAnglers: 34,
};

let profiles = {}; // key: playerId or name

// Load persisted data
try {
  if (fs.existsSync(LEADERBOARD_FILE)) {
    leaderboard = JSON.parse(fs.readFileSync(LEADERBOARD_FILE, "utf-8"));
  }
} catch (e) {
  console.warn("Error reading leaderboard:", e);
}

try {
  if (fs.existsSync(STATS_FILE)) {
    globalStats = { ...globalStats, ...JSON.parse(fs.readFileSync(STATS_FILE, "utf-8")) };
  }
} catch (e) {
  console.warn("Error reading stats:", e);
}

try {
  if (fs.existsSync(PROFILES_FILE)) {
    profiles = JSON.parse(fs.readFileSync(PROFILES_FILE, "utf-8"));
  }
} catch (e) {
  console.warn("Error reading profiles:", e);
}

function persistData() {
  try {
    if (fs.existsSync(DATA_DIR)) {
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
      fs.writeFileSync(STATS_FILE, JSON.stringify(globalStats, null, 2));
      fs.writeFileSync(PROFILES_FILE, JSON.stringify(profiles, null, 2));
    }
  } catch (e) {
    // ignore
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    game: "Oltin Qarmoq",
    version: "1.1.0",
    speciesCount: 330,
    maxRodLevel: 300,
    boats: [
      { name: "Eski sol", reqProfile: 0 },
      { name: "Yelkanli qayiq", reqProfile: 50 },
      { name: "Motorli kater", reqProfile: 100 },
      { name: "Baliqchi kemasi", reqProfile: 150 },
      { name: "Oq yaxta", reqProfile: 200 },
      { name: "Afsonaviy kema", reqProfile: 300 }
    ],
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

// Profile Cloud Save
app.post("/api/profile/save", (req, res) => {
  const data = req.body;
  if (!data || (!data.playerId && !data.playerName)) {
    return res.status(400).json({ success: false, error: "Profil ma'lumotlari to'liq emas" });
  }

  const pid = (data.playerId || ("B-" + Math.random().toString(36).substring(2, 8).toUpperCase())).trim();
  const cleanName = (typeof data.playerName === "string" && data.playerName.trim())
    ? data.playerName.trim().slice(0, 24)
    : "Mohir Baliqchi";

  const profileRecord = {
    playerId: pid,
    playerName: cleanName,
    coins: Number(data.coins) || 0,
    rodLevel: Math.min(300, Math.max(1, Number(data.rodLevel) || 1)),
    boatIdx: Math.min(5, Math.max(0, Number(data.boatIdx) || 0)),
    profileXP: Number(data.profileXP) || 0,
    totalCaught: Number(data.totalCaught) || 0,
    totalEarned: Number(data.totalEarned) || 0,
    discovered: Array.isArray(data.discovered) ? data.discovered : [],
    highScores: Array.isArray(data.highScores) ? data.highScores : [],
    soundMuted: Boolean(data.soundMuted),
    updatedAt: Date.now()
  };

  profiles[pid] = profileRecord;
  profiles[cleanName.toLowerCase()] = profileRecord;

  persistData();
  res.json({ success: true, profile: profileRecord });
});

// Profile Cloud Load
app.get("/api/profile/load/:idOrName", (req, res) => {
  const query = (req.params.idOrName || "").trim();
  if (!query) {
    return res.status(400).json({ success: false, error: "ID yoki Ism ko'rsatilmadi" });
  }

  const found = profiles[query] || profiles[query.toLowerCase()];
  if (found) {
    res.json({ success: true, profile: found });
  } else {
    res.status(404).json({ success: false, error: "Profil topilmadi" });
  }
});

// Leaderboard
app.get("/api/leaderboard", (req, res) => {
  const sorted = [...leaderboard].sort((a, b) => b.score - a.score).slice(0, 25);
  res.json({
    success: true,
    leaderboard: sorted,
    stats: globalStats
  });
});

app.post("/api/leaderboard", (req, res) => {
  const { name, score, bestFish, rodLevel, boat } = req.body || {};
  if (!score || typeof score !== "number" || score <= 0) {
    return res.status(400).json({ success: false, error: "Noto'g'ri ball" });
  }

  const cleanName = (typeof name === "string" && name.trim()) ? name.trim().slice(0, 24) : "Noma'lum Baliqchi";
  const newEntry = {
    id: Math.random().toString(36).substring(2, 9),
    name: cleanName,
    score: Math.floor(score),
    bestFish: typeof bestFish === "string" ? bestFish.slice(0, 32) : "—",
    rodLevel: Number(rodLevel) || 1,
    boat: typeof boat === "string" ? boat.slice(0, 32) : "Eski sol",
    date: new Date().toLocaleDateString("uz-UZ", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  };

  leaderboard.push(newEntry);
  leaderboard.sort((a, b) => b.score - a.score);
  leaderboard = leaderboard.slice(0, 50);

  globalStats.totalEarned += Math.floor(score);
  persistData();

  const rank = leaderboard.findIndex((item) => item.id === newEntry.id) + 1;
  res.json({
    success: true,
    rank,
    entry: newEntry,
    leaderboard: leaderboard.slice(0, 25)
  });
});

app.post("/api/stats/catch", (req, res) => {
  const count = Number(req.body?.count) || 1;
  const value = Number(req.body?.value) || 0;
  globalStats.totalCatches += count;
  globalStats.totalEarned += value;
  res.json({ success: true, totalCatches: globalStats.totalCatches });
});

// Serve frontend static files from dist
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.use((req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
} else {
  app.use((req, res) => {
    res.send("<h1>Oltin Qarmoq Serveri ishlayapti!</h1><p>Frontendni qurish uchun 'npm run build' buyrug'ini ishga tushiring.</p>");
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🎣 Oltin Qarmoq serveri 0.0.0.0:${PORT} portida ishga tushdi`);
});
