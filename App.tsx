import { useCallback, useEffect, useRef, useState } from "react";
import GameView from "./components/GameView";
import Shop from "./components/Shop";
import Fishpedia from "./components/Fishpedia";
import { Engine, RoundResult } from "./game/engine";
import { loadSave, storeSave, addHighScore, SaveData } from "./game/save";
import { rodStats, BOATS, XP, profileLevel, ROD_MAX } from "./game/progression";
import { SPECIES, formatMoney, RARITY_COLORS } from "./game/species";
import { unlockAudio, sfx } from "./game/sound";

type Phase = "start" | "play" | "over";
type Overlay = "none" | "shop" | "pedia";

export default function App() {
  const [save, setSave] = useState<SaveData>(loadSave);
  const [phase, setPhase] = useState<Phase>("start");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [roundKey, setRoundKey] = useState(0);

  const roundXP = useRef(0);
  const discRef = useRef<Set<number>>(new Set());
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => storeSave(save), [save]);

  const startRound = useCallback(() => {
    unlockAudio();
    roundXP.current = 0;
    discRef.current = new Set(save.discovered);
    setResult(null);
    setPaused(false);
    setOverlay("none");
    setRoundKey((k) => k + 1);
    setPhase("play");
  }, [save.discovered]);

  const handleCatch = useCallback((_id: number, value: number) => {
    roundXP.current += XP.catch(value);
  }, []);

  const handleEnd = useCallback((r: RoundResult) => {
    setSave((s) => {
      const gainedXP =
        roundXP.current + XP.roundEnd(r.earned) + r.newSpecies.length * XP.newSpecies;
      return {
        ...s,
        coins: s.coins + r.earned,
        totalCaught: s.totalCaught + r.caughtCount,
        totalEarned: s.totalEarned + r.earned,
        profileXP: s.profileXP + gainedXP,
        discovered: Array.from(discRef.current),
        highScores: addHighScore(s.highScores, {
          score: r.earned,
          date: new Date().toLocaleDateString("uz-UZ"),
          rodLevel: s.rodLevel,
          bestFish: r.bestFish?.name ?? "—",
        }),
      };
    });
    setResult(r);
    setPaused(false);
    setPhase("over");
  }, []);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  // Enter/Space — tez qayta boshlash
  useEffect(() => {
    if (phase === "play") return;
    const h = (e: KeyboardEvent) => {
      if ((e.key === "Enter" || e.key === " ") && overlay === "none") {
        e.preventDefault();
        startRound();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [phase, overlay, startRound]);

  const plevel = profileLevel(save.profileXP);
  const rod = rodStats(save.rodLevel);
  const boat = BOATS[save.boatIdx];

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-b from-sky-800 via-sky-950 to-slate-950 font-sans">
      {phase === "play" && (
        <>
          <GameView
            key={roundKey}
            rodLevel={save.rodLevel}
            boatIdx={save.boatIdx}
            discovered={discRef.current}
            paused={paused}
            engineHandle={engineRef}
            onEnd={handleEnd}
            onCatch={handleCatch}
            onPauseToggle={togglePause}
          />
          <button
            onClick={togglePause}
            className="absolute right-3 top-12 z-10 rounded-xl bg-sky-950/60 px-3 py-1.5 text-sm font-black text-sky-100 backdrop-blur transition hover:bg-sky-800 active:scale-95"
          >
            {paused ? "▶" : "⏸"}
          </button>

          {paused && (
            <div className="anim-pop absolute inset-0 z-20 flex items-center justify-center bg-sky-950/70 backdrop-blur-sm">
              <div className="w-full max-w-xs rounded-2xl border border-sky-700/60 bg-sky-900 p-6 text-center shadow-2xl">
                <div className="text-4xl">⏸</div>
                <h2 className="mt-2 text-2xl font-black text-sky-100">Pauza</h2>
                <p className="mt-1 text-xs text-sky-400">P yoki Esc — davom etish</p>
                <div className="mt-5 space-y-2">
                  <button onClick={togglePause} className="w-full rounded-xl bg-emerald-500 py-3 font-black text-emerald-950 transition hover:bg-emerald-400 active:scale-95">
                    ▶ Davom etish
                  </button>
                  <button
                    onClick={() => engineRef.current?.endNow()}
                    className="w-full rounded-xl bg-sky-800 py-2.5 font-bold text-sky-100 transition hover:bg-sky-700 active:scale-95"
                  >
                    🏁 Ovni yakunlash
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {phase === "start" && (
        <StartScreen
          save={save}
          plevel={plevel}
          rodInfo={{ level: save.rodLevel, tierName: rod.tierName, color: rod.color }}
          boatName={boat.name}
          onPlay={startRound}
          onShop={() => { unlockAudio(); setOverlay("shop"); }}
          onPedia={() => { unlockAudio(); setOverlay("pedia"); }}
        />
      )}

      {phase === "over" && result && (
        <GameOverScreen
          result={result}
          save={save}
          onRestart={startRound}
          onShop={() => setOverlay("shop")}
          onMenu={() => { sfx.tick(); setPhase("start"); }}
        />
      )}

      {overlay === "shop" && <Shop save={save} setSave={setSave} onClose={() => setOverlay("none")} />}
      {overlay === "pedia" && <Fishpedia discovered={save.discovered} onClose={() => setOverlay("none")} />}
    </div>
  );
}

/* ---------------- Start ---------------- */

function StartScreen({
  save, plevel, rodInfo, boatName, onPlay, onShop, onPedia,
}: {
  save: SaveData;
  plevel: number;
  rodInfo: { level: number; tierName: string; color: string };
  boatName: string;
  onPlay: () => void;
  onShop: () => void;
  onPedia: () => void;
}) {
  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center gap-5 px-4 py-8 text-center">
        {/* bezak baliqlar */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20">
          <span className="anim-float absolute left-[8%] top-[18%] text-5xl">🐟</span>
          <span className="anim-float absolute right-[10%] top-[30%] text-4xl" style={{ animationDelay: "0.8s" }}>🐠</span>
          <span className="anim-float absolute left-[14%] bottom-[22%] text-6xl" style={{ animationDelay: "1.4s" }}>🐡</span>
          <span className="anim-float absolute right-[16%] bottom-[14%] text-5xl" style={{ animationDelay: "0.4s" }}>🦈</span>
        </div>

        <div className="anim-pop relative">
          <div className="anim-float text-7xl drop-shadow-lg">🎣</div>
          <h1 className="gold-shine mt-2 text-5xl font-black tracking-tight sm:text-6xl">Oltin Qarmoq</h1>
          <p className="mt-2 text-sm font-semibold text-sky-300">
            330 xil baliq • 300 lvl qarmoq • 5 ta qayiq yangilash
          </p>
        </div>

        <div className="relative grid w-full grid-cols-2 gap-2 text-left text-xs sm:grid-cols-4">
          <Chip icon="🪙" label="Tangalar" value={formatMoney(save.coins)} color="text-yellow-300" />
          <Chip icon="👤" label="Profil" value={`${plevel.toFixed(1)} lvl`} color="text-violet-300" />
          <Chip icon="🎣" label={rodInfo.tierName} value={`${rodInfo.level}/${ROD_MAX} lvl`} color="text-emerald-300" />
          <Chip icon="⛵" label="Qayiq" value={boatName} color="text-sky-300" />
        </div>

        <div className="relative w-full space-y-2.5">
          <button
            onClick={onPlay}
            className="w-full rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 py-4 text-xl font-black text-emerald-950 shadow-xl shadow-emerald-500/30 transition hover:brightness-110 active:scale-[0.98]"
          >
            🎮 O'YNASH
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={onShop} className="rounded-xl bg-sky-800/80 py-3 font-black text-sky-100 transition hover:bg-sky-700 active:scale-95">
              🛒 Do'kon
            </button>
            <button onClick={onPedia} className="rounded-xl bg-sky-800/80 py-3 font-black text-sky-100 transition hover:bg-sky-700 active:scale-95">
              📖 Baliqnoma <span className="text-xs font-bold text-sky-400">{save.discovered.length}/{SPECIES.length}</span>
            </button>
          </div>
        </div>

        {save.highScores.length > 0 && (
          <div className="relative w-full rounded-xl border border-sky-800/70 bg-sky-950/50 p-3">
            <h3 className="mb-1.5 text-xs font-black tracking-widest text-sky-400">🏆 ENG YAXSHI NATIJALAR</h3>
            <HighScoreTable scores={save.highScores} highlight={-1} compact />
          </div>
        )}

        <p className="relative text-[11px] leading-relaxed text-sky-500">
          🖱 Sichqoncha/barmoq bilan boshqaring yoki ⌨ WASD / strelkalar.
          <br />
          Baliqqa tegsangiz — tutasiz! Ketma-ket tuting — 🔥 kombo. P — pauza.
        </p>
      </div>
    </div>
  );
}

function Chip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-sky-800/70 bg-sky-950/60 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-sky-500">{icon} {label}</div>
      <div className={`truncate text-sm font-black ${color}`}>{value}</div>
    </div>
  );
}

/* ---------------- Game Over ---------------- */

function GameOverScreen({
  result, save, onRestart, onShop, onMenu,
}: {
  result: RoundResult;
  save: SaveData;
  onRestart: () => void;
  onShop: () => void;
  onMenu: () => void;
}) {
  const isRecord = save.highScores.length > 0 && save.highScores[0].score === result.earned && result.earned > 0;
  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <div className="anim-pop">
          <div className="text-5xl">{isRecord ? "🏆" : "⏱"}</div>
          <h1 className="mt-1 text-3xl font-black text-sky-100">
            {isRecord ? "YANGI REKORD!" : "Vaqt tugadi!"}
          </h1>
          <div className="gold-shine mt-2 text-5xl font-black">🪙 {formatMoney(result.earned)}</div>
        </div>

        <div className="anim-pop grid w-full grid-cols-3 gap-2 text-xs" style={{ animationDelay: "0.06s" }}>
          <Chip icon="🐟" label="Tutilgan" value={`${result.caughtCount} ta`} color="text-sky-200" />
          <Chip icon="🔥" label="Maks kombo" value={`x${(1 + Math.min(20, Math.max(0, result.maxCombo - 1)) * 0.1).toFixed(1)}`} color="text-orange-300" />
          <Chip icon="✨" label="Yangi tur" value={`${result.newSpecies.length} ta`} color="text-fuchsia-300" />
        </div>

        {result.bestFish && (
          <div className="anim-pop w-full rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm" style={{ animationDelay: "0.12s" }}>
            <span className="text-sky-300">Eng qimmat ov: </span>
            <span className="font-black" style={{ color: RARITY_COLORS[result.bestFish.rarity] }}>
              {result.bestFish.name}
            </span>
            <span className="font-black text-yellow-300"> — 🪙{formatMoney(result.bestFish.price)}</span>
          </div>
        )}

        <div className="anim-pop w-full rounded-xl border border-sky-800/70 bg-sky-950/50 p-3" style={{ animationDelay: "0.18s" }}>
          <h3 className="mb-1.5 text-xs font-black tracking-widest text-sky-400">🏆 REKORDLAR JADVALI</h3>
          <HighScoreTable scores={save.highScores} highlight={result.earned} />
        </div>

        <div className="anim-pop w-full space-y-2.5" style={{ animationDelay: "0.24s" }}>
          <button
            onClick={onRestart}
            className="w-full rounded-2xl bg-gradient-to-b from-emerald-400 to-emerald-600 py-4 text-lg font-black text-emerald-950 shadow-xl shadow-emerald-500/30 transition hover:brightness-110 active:scale-[0.98]"
          >
            🔄 YANA O'YNASH <span className="text-xs font-bold opacity-70">(Enter)</span>
          </button>
          <div className="grid grid-cols-2 gap-2.5">
            <button onClick={onShop} className="rounded-xl bg-yellow-500 py-3 font-black text-yellow-950 transition hover:bg-yellow-400 active:scale-95">
              🛒 Do'kon
            </button>
            <button onClick={onMenu} className="rounded-xl bg-sky-800/80 py-3 font-black text-sky-100 transition hover:bg-sky-700 active:scale-95">
              🏠 Menyu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HighScoreTable({ scores, highlight, compact }: { scores: SaveData["highScores"]; highlight: number; compact?: boolean }) {
  const list = compact ? scores.slice(0, 5) : scores;
  let hlUsed = false;
  return (
    <div className="space-y-1">
      {list.map((hs, i) => {
        const hl = !hlUsed && hs.score === highlight;
        if (hl) hlUsed = true;
        return (
          <div
            key={i}
            className={`flex items-center gap-2 rounded-lg px-2.5 py-1 text-xs ${hl ? "bg-yellow-500/20 font-black text-yellow-200" : "text-sky-300"}`}
          >
            <span className="w-5 text-left font-black">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</span>
            <span className="font-bold text-yellow-300">🪙 {formatMoney(hs.score)}</span>
            <span className="truncate text-sky-500">{hs.bestFish}</span>
            <span className="ml-auto shrink-0 text-sky-600">🎣{hs.rodLevel} • {hs.date}</span>
          </div>
        );
      })}
      {list.length === 0 && <div className="text-xs text-sky-600">Hali natijalar yo'q</div>}
    </div>
  );
}
