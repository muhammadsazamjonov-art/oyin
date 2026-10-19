import { useCallback, useEffect, useRef, useState } from "react";
import GameView from "./components/GameView";
import Shop from "./components/Shop";
import Fishpedia from "./components/Fishpedia";
import LeaderboardModal from "./components/LeaderboardModal";
import ProfileModal from "./components/ProfileModal";
import { Engine, RoundResult } from "./game/engine";
import { loadSave, storeSave, addHighScore, SaveData } from "./game/save";
import { rodStats, BOATS, XP, profileLevel, ROD_MAX } from "./game/progression";
import { SPECIES, formatMoney, RARITY_COLORS } from "./game/species";
import { unlockAudio, sfx, setMuted, isMuted } from "./game/sound";

type Phase = "start" | "play" | "over";
type Overlay = "none" | "shop" | "pedia" | "leaderboard" | "profile";

export default function App() {
  const [save, setSave] = useState<SaveData>(loadSave);
  const [phase, setPhase] = useState<Phase>("start");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [roundKey, setRoundKey] = useState(0);
  const [soundOff, setSoundOff] = useState<boolean>(() => {
    const s = loadSave();
    setMuted(s.soundMuted);
    return s.soundMuted;
  });

  const roundXP = useRef(0);
  const discRef = useRef<Set<number>>(new Set());
  const engineRef = useRef<Engine | null>(null);

  useEffect(() => {
    storeSave(save);
  }, [save]);

  const toggleSound = useCallback(() => {
    setSoundOff((prev) => {
      const next = !prev;
      setMuted(next);
      setSave((s) => ({ ...s, soundMuted: next }));
      return next;
    });
  }, []);

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

  const handleCatch = useCallback((_id: number, _value: number, _isNew: boolean, xpGained: number) => {
    roundXP.current += xpGained;
  }, []);

  const handleEnd = useCallback((r: RoundResult) => {
    const finalGainedXP =
      roundXP.current +
      XP.roundEnd(r.earned) +
      r.newSpecies.length * XP.newSpecies;

    setSave((s) => {
      const updatedHighScores = addHighScore(s.highScores, {
        score: r.earned,
        date: new Date().toLocaleDateString("uz-UZ"),
        rodLevel: s.rodLevel,
        bestFish: r.bestFish?.name ?? "—",
      });

      return {
        ...s,
        coins: s.coins + r.earned,
        totalCaught: s.totalCaught + r.caughtCount,
        totalEarned: s.totalEarned + r.earned,
        profileXP: s.profileXP + finalGainedXP,
        discovered: Array.from(discRef.current),
        highScores: updatedHighScores,
      };
    });

    // Avtomatik ravishda serverga onlayn reytingga yuborish
    if (r.earned > 0) {
      fetch("/api/leaderboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: save.playerName || "Mohir Baliqchi",
          score: r.earned,
          bestFish: r.bestFish?.name || "Oddiy laqqa",
          rodLevel: save.rodLevel,
          boat: BOATS[save.boatIdx].name,
        }),
      }).catch(() => {});

      fetch("/api/stats/catch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          count: r.caughtCount,
          value: r.earned,
        }),
      }).catch(() => {});
    }

    setResult(r);
    setPaused(false);
    setPhase("over");
  }, [save.playerName, save.rodLevel, save.boatIdx]);

  const togglePause = useCallback(() => {
    setPaused((p) => !p);
  }, []);

  // Enter/Space — tez qayta boshlash
  useEffect(() => {
    if (phase === "play") return;
    const h = (e: KeyboardEvent) => {
      // Input yoki matn yozilayotganda o'yinni boshlamaslik
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }
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

  const updatePlayerName = (name: string) => {
    setSave((s) => ({ ...s, playerName: name }));
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-gradient-to-b from-sky-800 via-sky-950 to-slate-950 font-sans select-none">
      {/* Sound toggle button (har doim yuqori o'ng burchakda) */}
      <button
        onClick={toggleSound}
        className="fixed left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-xl bg-sky-950/70 border border-sky-700/50 text-sm text-sky-200 backdrop-blur transition hover:bg-sky-800 active:scale-95 shadow-md"
        title={soundOff ? "Ovozni yoqish" : "Ovozni o'chirish"}
      >
        {soundOff ? "🔇" : "🔊"}
      </button>

      {phase === "play" && (
        <>
          <GameView
            key={roundKey}
            rodLevel={save.rodLevel}
            boatIdx={save.boatIdx}
            discovered={discRef.current}
            currentProfileXP={save.profileXP}
            paused={paused}
            engineHandle={engineRef}
            onEnd={handleEnd}
            onCatch={handleCatch}
            onPauseToggle={togglePause}
          />

          {/* Pauza tugmasi */}
          <button
            onClick={togglePause}
            className="absolute right-3 top-3 z-20 flex h-10 w-10 items-center justify-center rounded-xl bg-sky-950/80 border border-sky-700/60 font-black text-sky-100 backdrop-blur transition hover:bg-sky-800 active:scale-95 shadow-lg"
          >
            {paused ? "▶" : "⏸"}
          </button>

          {/* Pauza modal */}
          {paused && (
            <div className="anim-pop fixed inset-0 z-30 flex items-center justify-center bg-sky-950/80 backdrop-blur-md p-4">
              <div className="w-full max-w-sm rounded-3xl border border-sky-700/70 bg-gradient-to-b from-sky-900 to-sky-950 p-6 text-center shadow-2xl">
                <div className="text-5xl">⏸</div>
                <h2 className="mt-3 text-2xl font-black text-sky-100 tracking-tight">O'yin To'xtatildi</h2>
                <p className="mt-1 text-xs text-sky-400">P yoki Esc bosib davom etishingiz mumkin</p>

                <div className="mt-6 space-y-2.5">
                  <button
                    onClick={togglePause}
                    className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 py-3.5 text-base font-black text-emerald-950 shadow-lg shadow-emerald-500/25 transition hover:brightness-110 active:scale-95"
                  >
                    ▶ Davom etish
                  </button>
                  <button
                    onClick={() => engineRef.current?.endNow()}
                    className="w-full rounded-2xl bg-sky-800/80 py-3 font-bold text-sky-100 transition hover:bg-sky-700 active:scale-95"
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
          rodInfo={{ level: save.rodLevel, tierName: rod.tierName, color: rod.color, glowColor: rod.glowColor }}
          boatName={boat.name}
          onPlay={startRound}
          onProfile={() => {
            unlockAudio();
            sfx.click();
            setOverlay("profile");
          }}
          onShop={() => {
            unlockAudio();
            sfx.click();
            setOverlay("shop");
          }}
          onPedia={() => {
            unlockAudio();
            sfx.click();
            setOverlay("pedia");
          }}
          onLeaderboard={() => {
            unlockAudio();
            sfx.click();
            setOverlay("leaderboard");
          }}
          onUpdateName={updatePlayerName}
        />
      )}

      {phase === "over" && result && (
        <GameOverScreen
          result={result}
          save={save}
          onRestart={startRound}
          onProfile={() => {
            sfx.click();
            setOverlay("profile");
          }}
          onShop={() => {
            sfx.click();
            setOverlay("shop");
          }}
          onLeaderboard={() => {
            sfx.click();
            setOverlay("leaderboard");
          }}
          onMenu={() => {
            sfx.click();
            setPhase("start");
          }}
        />
      )}

      {overlay === "shop" && (
        <Shop save={save} setSave={setSave} onClose={() => setOverlay("none")} />
      )}

      {overlay === "pedia" && (
        <Fishpedia discovered={save.discovered} onClose={() => setOverlay("none")} />
      )}

      {overlay === "leaderboard" && (
        <LeaderboardModal
          playerName={save.playerName}
          onUpdateName={updatePlayerName}
          onClose={() => setOverlay("none")}
        />
      )}

      {overlay === "profile" && (
        <ProfileModal
          save={save}
          setSave={setSave}
          onClose={() => setOverlay("none")}
        />
      )}
    </div>
  );
}

/* ---------------- Boshlang'ich Ekran (Start Screen) ---------------- */

function StartScreen({
  save,
  plevel,
  rodInfo,
  boatName,
  onPlay,
  onProfile,
  onShop,
  onPedia,
  onLeaderboard,
  onUpdateName,
}: {
  save: SaveData;
  plevel: number;
  rodInfo: { level: number; tierName: string; color: string; glowColor: string };
  boatName: string;
  onPlay: () => void;
  onProfile: () => void;
  onShop: () => void;
  onPedia: () => void;
  onLeaderboard: () => void;
  onUpdateName: (name: string) => void;
}) {
  const [localName, setLocalName] = useState(save.playerName);
  const [savedBadge, setSavedBadge] = useState(false);

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = localName.trim().slice(0, 24);
    if (clean) {
      onUpdateName(clean);
      sfx.upgrade();
      setSavedBadge(true);
      setTimeout(() => setSavedBadge(false), 2500);
    }
  };

  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        {/* Suzuvchi bezak baliqlar */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-25">
          <span className="anim-float absolute left-[6%] top-[14%] text-5xl">🐟</span>
          <span className="anim-float absolute right-[8%] top-[24%] text-4xl" style={{ animationDelay: "0.8s" }}>🐠</span>
          <span className="anim-float absolute left-[12%] bottom-[20%] text-6xl" style={{ animationDelay: "1.4s" }}>🐡</span>
          <span className="anim-float absolute right-[14%] bottom-[12%] text-5xl" style={{ animationDelay: "0.4s" }}>🦈</span>
        </div>

        {/* Logo va Sarlavha */}
        <div className="anim-pop relative">
          <div className="anim-float text-7xl sm:text-8xl drop-shadow-2xl">🎣</div>
          <h1 className="gold-shine mt-2 text-4xl sm:text-6xl font-black tracking-tight">
            Oltin Qarmoq
          </h1>
          <p className="mt-1 text-xs sm:text-sm font-semibold text-sky-200">
            330 xil baliq • 300 lvl qarmoq • 5 ta qayiq yangilash
          </p>
        </div>

        {/* Ism kiritish va o'zgartirish bloki (Bosh sahifada darhol ko'rinadi) */}
        <form
          onSubmit={handleSave}
          className="relative w-full rounded-2xl border-2 border-emerald-500/80 bg-sky-950/85 p-3.5 shadow-2xl backdrop-blur transition-all"
        >
          <div className="mb-2 flex items-center justify-between text-xs font-black">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="text-base">👤</span>
              <span className="tracking-wide uppercase">O'yindagi Ismingiz:</span>
            </div>
            <button
              type="button"
              onClick={onProfile}
              className="text-[11px] text-sky-400 hover:text-sky-200 underline font-bold"
            >
              ID: <span className="font-mono text-sky-300">{save.playerId}</span> • Profil tafsilotlari ⚙️
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={localName}
              onChange={(e) => {
                setLocalName(e.target.value);
                onUpdateName(e.target.value);
              }}
              onBlur={() => handleSave()}
              placeholder="Ismingizni kiriting..."
              maxLength={24}
              className="flex-1 rounded-xl border border-sky-600/80 bg-sky-900/80 px-3.5 py-2.5 text-sm sm:text-base font-black text-yellow-300 placeholder:text-sky-500 focus:border-yellow-400 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs sm:text-sm font-black text-emerald-950 shadow-md transition hover:brightness-110 active:scale-95"
            >
              {savedBadge ? "✓ Saqlandi!" : "💾 Saqlash"}
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between text-[11px] text-sky-400">
            <span>
              Daraja: <strong className="text-violet-300 font-black">{plevel.toFixed(1)} lvl</strong>
            </span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse inline-block" />
              Serverda saqlanadi (o'chib ketmaydi)
            </span>
          </div>
        </form>

        {/* Profil va Asboblar ko'rsatkichlari */}
        <div className="relative grid w-full grid-cols-2 gap-2.5 text-left text-xs sm:grid-cols-4">
          <Chip icon="🪙" label="Tangalar" value={formatMoney(save.coins)} color="text-yellow-300" />
          <div onClick={onProfile} className="cursor-pointer transition hover:opacity-90">
            <Chip icon="👤" label="Profil" value={`${plevel.toFixed(1)} lvl`} color="text-violet-300" />
          </div>
          <div onClick={onShop} className="cursor-pointer transition hover:opacity-90">
            <Chip
              icon="🎣"
              label={rodInfo.tierName}
              value={`${rodInfo.level}/${ROD_MAX} lvl`}
              color="text-emerald-300"
            />
          </div>
          <div onClick={onShop} className="cursor-pointer transition hover:opacity-90">
            <Chip icon="⛵" label="Qayiq" value={boatName} color="text-sky-300" />
          </div>
        </div>

        {/* Asosiy harakat tugmalari */}
        <div className="relative w-full space-y-2.5">
          <button
            onClick={onPlay}
            className="w-full rounded-3xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 py-4 text-xl sm:text-2xl font-black text-emerald-950 shadow-2xl shadow-emerald-500/35 transition hover:brightness-110 active:scale-[0.98]"
          >
            🎮 O'YINNI BOSHLASH
          </button>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={onShop}
              className="rounded-2xl border border-sky-700/60 bg-sky-900/60 py-3 text-xs sm:text-sm font-black text-sky-100 transition hover:bg-sky-800 active:scale-95 shadow-md"
            >
              🛒 Do'kon
            </button>
            <button
              onClick={onPedia}
              className="rounded-2xl border border-sky-700/60 bg-sky-900/60 py-3 text-xs sm:text-sm font-black text-sky-100 transition hover:bg-sky-800 active:scale-95 shadow-md"
            >
              📖 Baliqnoma ({save.discovered.length}/{SPECIES.length})
            </button>
            <button
              onClick={onLeaderboard}
              className="rounded-2xl border border-sky-700/60 bg-sky-900/60 py-3 text-xs sm:text-sm font-black text-yellow-300 transition hover:bg-sky-800 active:scale-95 shadow-md"
            >
              🏆 Reyting
            </button>
            <button
              onClick={onProfile}
              className="rounded-2xl border border-sky-700/60 bg-sky-900/60 py-3 text-xs sm:text-sm font-black text-violet-300 transition hover:bg-sky-800 active:scale-95 shadow-md"
            >
              👤 Profil & Tiklash
            </button>
          </div>
        </div>

        {/* Rekordlar jadvali */}
        {save.highScores.length > 0 && (
          <div className="relative w-full rounded-2xl border border-sky-800/80 bg-sky-950/60 p-4 shadow-lg">
            <h3 className="mb-2 text-xs font-black tracking-widest text-sky-400 uppercase">
              🏆 LOKAL ENG YAXSHI NATIJALAR
            </h3>
            <HighScoreTable scores={save.highScores} highlight={-1} compact />
          </div>
        )}

        {/* Qisqacha boshqaruv yo'riqnomasi */}
        <p className="relative text-[11px] leading-relaxed text-sky-400/80">
          🖱 Sichqoncha/barmoq bilan yo'naltiring yoki ⌨ WASD / strelkalar.
          <br />
          ⚡ <strong className="text-sky-200">Bo'sh joy (Space)</strong> — tezlanish. Baliqqa tegib tuting!
        </p>
      </div>
    </div>
  );
}

function Chip({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-sky-800/70 bg-sky-950/70 p-3 shadow-md">
      <div className="text-[10px] uppercase tracking-wide text-sky-400 flex items-center gap-1">
        <span>{icon}</span> {label}
      </div>
      <div className={`mt-0.5 truncate text-sm font-black ${color}`}>{value}</div>
    </div>
  );
}

/* ---------------- O'yin Tugashi (Game Over Screen) ---------------- */

function GameOverScreen({
  result,
  save,
  onRestart,
  onProfile,
  onShop,
  onLeaderboard,
  onMenu,
}: {
  result: RoundResult;
  save: SaveData;
  onRestart: () => void;
  onProfile: () => void;
  onShop: () => void;
  onLeaderboard: () => void;
  onMenu: () => void;
}) {
  const isRecord =
    save.highScores.length > 0 &&
    save.highScores[0].score === result.earned &&
    result.earned > 0;

  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col items-center justify-center gap-4 px-4 py-8 text-center">
        <div className="anim-pop">
          <div className="text-5xl">{isRecord ? "👑" : "⏱"}</div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-black text-sky-100">
            {isRecord ? "YANGI REKORD O'RNATILDI!" : "Ov Vaqti Tugadi!"}
          </h1>
          <div className="gold-shine mt-2 text-4xl sm:text-5xl font-black">
            🪙 {formatMoney(result.earned)}
          </div>
        </div>

        {/* Natijalar ko'rsatkichlari */}
        <div className="anim-pop grid w-full grid-cols-3 gap-2 text-xs" style={{ animationDelay: "0.06s" }}>
          <Chip icon="🐟" label="Tutilgan" value={`${result.caughtCount} ta`} color="text-sky-200" />
          <Chip
            icon="🔥"
            label="Maks kombo"
            value={`x${(1 + Math.min(20, Math.max(0, result.maxCombo - 1)) * 0.1).toFixed(1)}`}
            color="text-orange-300"
          />
          <Chip icon="✨" label="Yangi turlar" value={`${result.newSpecies.length} ta`} color="text-fuchsia-300" />
        </div>

        {/* Eng qimmat ovlangan baliq */}
        {result.bestFish && (
          <div
            className="anim-pop w-full rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm shadow-md"
            style={{ animationDelay: "0.12s" }}
          >
            <span className="text-sky-300">Eng qimmat ov: </span>
            <span className="font-black" style={{ color: RARITY_COLORS[result.bestFish.rarity] }}>
              {result.bestFish.name}
            </span>
            <span className="font-black text-yellow-300"> — 🪙 {formatMoney(result.bestFish.price)}</span>
          </div>
        )}

        {/* Rekordlar */}
        <div
          className="anim-pop w-full rounded-2xl border border-sky-800/80 bg-sky-950/60 p-4 shadow-lg"
          style={{ animationDelay: "0.18s" }}
        >
          <h3 className="mb-2 text-xs font-black tracking-widest text-sky-400 uppercase">
            🏆 LOKAL REKORDLAR
          </h3>
          <HighScoreTable scores={save.highScores} highlight={result.earned} />
        </div>

        {/* Harakat tugmalari */}
        <div className="anim-pop w-full space-y-2.5" style={{ animationDelay: "0.24s" }}>
          <button
            onClick={onRestart}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 via-emerald-500 to-teal-500 py-4 text-lg font-black text-emerald-950 shadow-xl shadow-emerald-500/30 transition hover:brightness-110 active:scale-[0.98]"
          >
            🔄 YANA O'YNASH <span className="text-xs opacity-75">(Enter)</span>
          </button>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={onShop}
              className="rounded-2xl border border-yellow-500/40 bg-yellow-500/20 py-3 text-xs sm:text-sm font-black text-yellow-300 transition hover:bg-yellow-500/30 active:scale-95"
            >
              🛒 Do'kon
            </button>
            <button
              onClick={onLeaderboard}
              className="rounded-2xl border border-sky-700/60 bg-sky-900/60 py-3 text-xs sm:text-sm font-black text-sky-100 transition hover:bg-sky-800 active:scale-95"
            >
              🏆 Reyting
            </button>
            <button
              onClick={onProfile}
              className="rounded-2xl border border-sky-700/60 bg-sky-900/60 py-3 text-xs sm:text-sm font-black text-violet-300 transition hover:bg-sky-800 active:scale-95"
            >
              👤 Profil
            </button>
            <button
              onClick={onMenu}
              className="rounded-2xl border border-sky-700/60 bg-sky-900/60 py-3 text-xs sm:text-sm font-black text-sky-100 transition hover:bg-sky-800 active:scale-95"
            >
              🏠 Bosh sahifa
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function HighScoreTable({
  scores,
  highlight,
  compact,
}: {
  scores: SaveData["highScores"];
  highlight: number;
  compact?: boolean;
}) {
  const list = compact ? scores.slice(0, 5) : scores;
  let hlUsed = false;

  return (
    <div className="space-y-1.5 text-left">
      {list.map((hs, i) => {
        const hl = !hlUsed && hs.score === highlight;
        if (hl) hlUsed = true;
        return (
          <div
            key={i}
            className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs transition-all ${
              hl
                ? "bg-yellow-500/20 border border-yellow-500/40 font-black text-yellow-200"
                : "border border-sky-900/40 bg-sky-950/40 text-sky-300"
            }`}
          >
            <span className="w-5 text-left font-black">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</span>
            <span className="font-extrabold text-yellow-300">🪙 {formatMoney(hs.score)}</span>
            <span className="truncate text-sky-400">{hs.bestFish}</span>
            <span className="ml-auto shrink-0 text-sky-500 text-[11px]">
              🎣 {hs.rodLevel} lvl • {hs.date}
            </span>
          </div>
        );
      })}
      {list.length === 0 && <div className="text-xs text-sky-500 py-1">Hozircha natijalar yo'q</div>}
    </div>
  );
}
