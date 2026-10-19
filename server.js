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
app.use(express.json());

// In-memory leaderboard & stats with file persistence backup
const DATA_DIR = path.join(__dirname, ".data");
const LEADERBOARD_FILE = path.join(DATA_DIR, "leaderboard.json");
const STATS_FILE = path.join(DATA_DIR, "stats.json");

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.warn("Could not create .data directory, running fully in-memory", e);
  }
}

// Default initial high scores (Uzbek themed)
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

// Try loading persisted data
try {
  if (fs.existsSync(LEADERBOARD_FILE)) {
    const raw = fs.readFileSync(LEADERBOARD_FILE, "utf-8");
    leaderboard = JSON.parse(raw);
  }
} catch (e) {
  console.warn("Error reading leaderboard file:", e);
}

try {
  if (fs.existsSync(STATS_FILE)) {
    const raw = fs.readFileSync(STATS_FILE, "utf-8");
    globalStats = { ...globalStats, ...JSON.parse(raw) };
  }
} catch (e) {
  console.warn("Error reading stats file:", e);
}

function persistData() {
  try {
    if (fs.existsSync(DATA_DIR)) {
      fs.writeFileSync(LEADERBOARD_FILE, JSON.stringify(leaderboard, null, 2));
      fs.writeFileSync(STATS_FILE, JSON.stringify(globalStats, null, 2));
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
    version: "1.0.0",
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

app.get("/api/leaderboard", (req, res) => {
  const sorted = [...leaderboard].sort((a, b) => b.score - a.score).slice(0, 20);
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
    leaderboard: leaderboard.slice(0, 20)
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
