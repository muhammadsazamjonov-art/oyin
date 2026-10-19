import { useEffect, useState } from "react";
import { formatMoney } from "../game/species";
import { sfx } from "../game/sound";

interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  bestFish: string;
  rodLevel: number;
  boat: string;
  date: string;
}

interface ServerStats {
  totalCatches: number;
  totalEarned: number;
  activeAnglers: number;
}

interface Props {
  playerName: string;
  onUpdateName: (name: string) => void;
  onClose: () => void;
}

export default function LeaderboardModal({ playerName, onUpdateName, onClose }: Props) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [online, setOnline] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(playerName);

  const fetchScores = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/leaderboard");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setEntries(data.leaderboard || []);
          if (data.stats) setStats(data.stats);
          setOnline(true);
        }
      } else {
        setOnline(false);
      }
    } catch {
      setOnline(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScores();
  }, []);

  const handleSaveName = () => {
    const clean = tempName.trim().slice(0, 20);
    if (clean) {
      onUpdateName(clean);
      setEditingName(false);
      sfx.click();
    }
  };

  return (
    <div className="anim-pop fixed inset-0 z-40 flex items-center justify-center bg-sky-950/80 p-3 sm:p-5 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-3xl border border-sky-700/60 bg-gradient-to-b from-sky-900 via-sky-950 to-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-sky-800/80 px-5 py-4 bg-sky-950/60">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <div>
              <h2 className="text-xl font-black text-sky-100 tracking-tight">Onlayn Reyting Jadvali</h2>
              <div className="flex items-center gap-2 text-xs text-sky-300">
                <span className={`h-2 w-2 rounded-full ${online ? "bg-emerald-400 animate-pulse" : "bg-amber-400"}`} />
                <span>{online ? "Serverga ulangan (Render / Express)" : "Lokal rejim"}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              sfx.click();
              onClose();
            }}
            className="rounded-xl bg-sky-800/80 px-3 py-1.5 text-sky-200 transition hover:bg-sky-700 active:scale-95"
          >
            ✕
          </button>
        </div>

        {/* Player Name Banner */}
        <div className="border-b border-sky-800/60 px-5 py-3 bg-sky-900/30 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs sm:text-sm">
            <span className="text-sky-400">Sizning taxallusingiz:</span>
            {editingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  maxLength={20}
                  className="rounded-lg border border-sky-600 bg-sky-950 px-2 py-1 text-xs text-sky-100 focus:outline-none"
                />
                <button
                  onClick={handleSaveName}
                  className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-bold text-emerald-950"
                >
                  Saqlash
                </button>
              </div>
            ) : (
              <span className="font-black text-yellow-300 flex items-center gap-1.5">
                {playerName}
                <button
                  onClick={() => {
                    setTempName(playerName);
                    setEditingName(true);
                  }}
                  className="text-xs text-sky-400 underline hover:text-sky-200"
                >
                  ✏️
                </button>
              </span>
            )}
          </div>

          <button
            onClick={fetchScores}
            disabled={loading}
            className="rounded-xl bg-sky-800/60 px-3 py-1 text-xs font-bold text-sky-200 hover:bg-sky-700 active:scale-95 disabled:opacity-50"
          >
            🔄 Yangilash
          </button>
        </div>

        {/* Global Stats if available */}
        {stats && (
          <div className="grid grid-cols-3 gap-2 border-b border-sky-800/50 p-3 bg-sky-950/40 text-center text-xs">
            <div>
              <div className="text-[10px] text-sky-400 uppercase">Jami baliqlar</div>
              <div className="font-extrabold text-sky-200">{stats.totalCatches.toLocaleString()} ta</div>
            </div>
            <div>
              <div className="text-[10px] text-sky-400 uppercase">Jami tangalar</div>
              <div className="font-extrabold text-yellow-300">🪙 {formatMoney(stats.totalEarned)}</div>
            </div>
            <div>
              <div className="text-[10px] text-sky-400 uppercase">Baliqchilar</div>
              <div className="font-extrabold text-emerald-400">{stats.activeAnglers} kishi</div>
            </div>
          </div>
        )}

        {/* Scores List */}
        <div className="scroll-thin flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sky-300">
              <span className="animate-spin text-2xl mr-2">⏳</span> Yuklanmoqda...
            </div>
          ) : entries.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center text-center text-sky-400">
              <span className="text-4xl">🐟</span>
              <p className="mt-2 text-sm font-bold">Hozircha onlayn rekordlar yo'q</p>
            </div>
          ) : (
            entries.map((item, index) => {
              const isTop3 = index < 3;
              const medal = ["🥇", "🥈", "🥉"][index] || `${index + 1}.`;
              const isMe = item.name === playerName;

              return (
                <div
                  key={item.id || index}
                  className={`flex items-center gap-3 rounded-2xl border p-3 transition-all ${
                    isMe
                      ? "border-yellow-500/80 bg-yellow-500/10 shadow-md"
                      : isTop3
                        ? "border-sky-700/80 bg-sky-900/40"
                        : "border-sky-900/40 bg-sky-950/40"
                  }`}
                >
                  <span className="w-8 text-center text-lg font-black">{medal}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-black text-sm text-sky-100">{item.name}</span>
                      {isMe && (
                        <span className="rounded bg-yellow-400/20 px-1.5 py-0.2 text-[10px] font-bold text-yellow-300">
                          Siz
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-sky-400 flex items-center gap-2">
                      <span>🎣 {item.rodLevel} lvl</span>
                      <span>•</span>
                      <span className="truncate">{item.bestFish}</span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-black text-sm text-yellow-300">🪙 {formatMoney(item.score)}</div>
                    <div className="text-[10px] text-sky-500">{item.date}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
