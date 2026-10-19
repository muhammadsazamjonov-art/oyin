import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import GameView from "./GameView";
import Shop from "./Shop";
import Fishpedia from "./Fishpedia";
import { Engine, RoundResult } from "./engine";
import { loadSave, storeSave, addHighScore, mergeSaveData, SaveData } from "./save";
import { rodStats, BOATS, XP, profileLevel, ROD_MAX } from "./progression";
import { SPECIES, formatMoney, RARITY_COLORS } from "./species";
import { unlockAudio, sfx } from "./sound";
import {
  fetchGlobalLeaderboard,
  getPlayerId,
  GlobalScore,
  loadCloudProfile,
  recordGlobalScore,
  saveCloudProfile,
} from "./cloud";

type Phase = "start" | "play" | "over";
type Overlay = "none" | "shop" | "pedia";
type CloudStatus = "connecting" | "online" | "offline";

export default function App() {
  const [save, setSave] = useState<SaveData>(loadSave);
  const [phase, setPhase] = useState<Phase>("start");
  const [overlay, setOverlay] = useState<Overlay>("none");
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState<RoundResult | null>(null);
  const [profileGain, setProfileGain] = useState(0);
  const [roundKey, setRoundKey] = useState(0);
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("connecting");
  const [globalScores, setGlobalScores] = useState<GlobalScore[]>([]);

  const roundXP = useRef(0);
  const discRef = useRef<Set<number>>(new Set());
  const engineRef = useRef<Engine | null>(null);
  const playerIdRef = useRef("");
  if (!playerIdRef.current) playerIdRef.current = getPlayerId();
  const playerId = playerIdRef.current;
  const saveRef = useRef(save);
  saveRef.current = save;
  const localRevision = useRef(0);
  const cloudReady = useRef(false);
  const connectInFlight = useRef(false);
  const lastSynced = useRef("");
  const cloudWriteQueue = useRef<Promise<void>>(Promise.resolve());

  const updateSave = useCallback<Dispatch<SetStateAction<SaveData>>>((next) => {
    localRevision.current++;
    setSave(next);
  }, []);

  const connectCloud = useCallback(async () => {
    if (connectInFlight.current) return;
    connectInFlight.current = true;
    setCloudStatus("connecting");
    const revisionAtStart = localRevision.current;

    try {
      const remote = await loadCloudProfile(playerId);
      if (remote) {
        if (revisionAtStart === 0 && localRevision.current === 0) {
          lastSynced.current = JSON.stringify(remote);
          setSave(remote);
        } else {
          setSave((local) => mergeSaveData(local, remote));
        }
      } else {
        const current = saveRef.current;
        await saveCloudProfile(playerId, current);
        lastSynced.current = JSON.stringify(current);
      }

      cloudReady.current = true;
      setCloudStatus("online");
      try {
        setGlobalScores(await fetchGlobalLeaderboard());
      } catch {
        // Profil serverda saqlangan bo'lsa, reyting yuklanmasa ham o'yin davom etadi.
      }
    } catch {
      setCloudStatus("offline");
    } finally {
      connectInFlight.current = false;
    }
  }, [playerId]);

  useEffect(() => {
    void connectCloud();
  }, [connectCloud]);

  useEffect(() => {
    storeSave(save);
    if (!cloudReady.current || cloudStatus !== "online") return;

    const snapshot = JSON.stringify(save);
    if (snapshot === lastSynced.current) return;
    const timer = window.setTimeout(() => {
      cloudWriteQueue.current = cloudWriteQueue.current
        .then(async () => {
          if (snapshot === lastSynced.current) return;
          await saveCloudProfile(playerId, save);
          lastSynced.current = snapshot;
        })
        .catch(() => setCloudStatus("offline"));
    }, 250);
    return () => window.clearTimeout(timer);
  }, [save, cloudStatus, playerId]);

  const startRound = useCallback(() => {
    unlockAudio();
    localRevision.current++;
    roundXP.current = XP.roundStart;
    discRef.current = new Set(saveRef.current.discovered);
    setResult(null);
    setProfileGain(0);
    setPaused(false);
    setOverlay("none");
    setRoundKey((key) => key + 1);
    setPhase("play");
  }, []);

  const handleCatch = useCallback((_id: number, value: number, isNew: boolean) => {
    roundXP.current += XP.catch(value);
    if (isNew) roundXP.current += XP.newSpecies(value);
  }, []);

  const handleEnd = useCallback((round: RoundResult) => {
    const gainedXP = roundXP.current + XP.roundEnd(round.earned);
    setProfileGain(gainedXP);
    updateSave((current) => ({
      ...current,
      coins: current.coins + round.earned,
      totalCaught: current.totalCaught + round.caughtCount,
      totalEarned: current.totalEarned + round.earned,
      profileXP: current.profileXP + gainedXP,
      discovered: Array.from(new Set([...current.discovered, ...discRef.current])),
      highScores: addHighScore(current.highScores, {
        score: round.earned,
        date: new Date().toLocaleDateString("uz-UZ"),
        rodLevel: current.rodLevel,
        bestFish: round.bestFish?.name ?? "—",
      }),
    }));

    setResult(round);
    setPaused(false);
    setPhase("over");

    void recordGlobalScore(playerId, {
      score: round.earned,
      date: new Date().toLocaleDateString("uz-UZ"),
      rodLevel: saveRef.current.rodLevel,
      bestFish: round.bestFish?.name ?? "—",
    })
      .then(fetchGlobalLeaderboard)
      .then(setGlobalScores)
      .then(() => setCloudStatus("online"))
      .catch(() => setCloudStatus("offline"));
  }, [playerId, updateSave]);

  const togglePause = useCallback(() => {
    setPaused((current) => !current);
  }, []);

  // Enter/Space — tez boshlash yoki darhol qayta o'ynash.
  useEffect(() => {
    if (phase === "play") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key === "Enter" || event.key === " ") && overlay === "none") {
        event.preventDefault();
        startRound();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, overlay, startRound]);

  const plevel = profileLevel(save.profileXP);
  const rod = rodStats(save.rodLevel);
  const boat = BOATS[save.boatIdx];

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#061b2c] font-sans text-white">
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
            aria-label={paused ? "O'yinni davom ettirish" : "O'yinni pauza qilish"}
            className="absolute right-3 top-12 z-10 rounded-xl border border-white/15 bg-slate-950/65 px-3 py-1.5 text-sm font-black text-sky-100 shadow-lg backdrop-blur transition hover:bg-sky-800 active:scale-95"
          >
            {paused ? "▶" : "⏸"}
          </button>

          {paused && (
            <div className="anim-pop absolute inset-0 z-20 flex items-center justify-center bg-sky-950/70 p-4 backdrop-blur-sm">
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
          cloudStatus={cloudStatus}
          globalScores={globalScores}
          onPlay={startRound}
          onShop={() => { unlockAudio(); setOverlay("shop"); }}
          onPedia={() => { unlockAudio(); setOverlay("pedia"); }}
          onRetryCloud={() => { void connectCloud(); }}
        />
      )}

      {phase === "over" && result && (
        <GameOverScreen
          result={result}
          save={save}
          profileGain={profileGain}
          onRestart={startRound}
          onShop={() => setOverlay("shop")}
          onMenu={() => { sfx.tick(); setPhase("start"); }}
        />
      )}

      {overlay === "shop" && <Shop save={save} setSave={updateSave} onClose={() => setOverlay("none")} />}
      {overlay === "pedia" && <Fishpedia discovered={save.discovered} onClose={() => setOverlay("none")} />}
    </div>
  );
}

/* ---------------- Start ---------------- */

function StartScreen({
  save, plevel, rodInfo, boatName, cloudStatus, globalScores, onPlay, onShop, onPedia, onRetryCloud,
}: {
  save: SaveData;
  plevel: number;
  rodInfo: { level: number; tierName: string; color: string };
  boatName: string;
  cloudStatus: CloudStatus;
  globalScores: GlobalScore[];
  onPlay: () => void;
  onShop: () => void;
  onPedia: () => void;
  onRetryCloud: () => void;
}) {
  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <main className="relative mx-auto grid min-h-full w-full max-w-5xl grid-cols-1 content-center gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[1.08fr_0.92fr] lg:gap-5 lg:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-20" aria-hidden="true">
          <span className="anim-float absolute left-[7%] top-[17%] text-5xl">🐟</span>
          <span className="anim-float absolute right-[12%] top-[24%] text-4xl" style={{ animationDelay: "0.8s" }}>🐠</span>
          <span className="anim-float absolute left-[14%] bottom-[18%] text-6xl" style={{ animationDelay: "1.4s" }}>🐡</span>
          <span className="anim-float absolute right-[16%] bottom-[12%] text-5xl" style={{ animationDelay: "0.4s" }}>🦈</span>
        </div>

        <section className="relative flex flex-col justify-center gap-4">
          <div className="anim-pop relative overflow-hidden rounded-[28px] border border-cyan-200/15 bg-gradient-to-br from-cyan-400/15 via-sky-950/90 to-indigo-950/80 p-5 shadow-2xl shadow-cyan-950/30 sm:p-7">
            <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-cyan-300/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-indigo-400/10 blur-3xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-100/15 bg-slate-950/40 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_#34d399]" />
                  Samarqand baliqchilik klubi
                </div>
                <h1 className="gold-shine text-4xl font-black tracking-tight sm:text-6xl">Oltin Qarmoq</h1>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-sky-200/80 sm:text-base">
                  Chuqurlikka sho'ng'ing, noyob baliqlarni tuting va qarmog'ingizni afsonaviy darajagacha olib chiqing.
                </p>
              </div>
              <div className="anim-float hidden shrink-0 text-6xl drop-shadow-[0_12px_20px_rgba(34,211,238,.25)] sm:block">🎣</div>
            </div>

            <div className="relative mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Chip icon="🪙" label="Tangalar" value={formatMoney(save.coins)} color="text-yellow-300" />
              <Chip icon="👤" label="Profil" value={`${plevel.toFixed(1)} lvl`} color="text-violet-300" />
              <Chip icon="🎣" label={rodInfo.tierName} value={`${rodInfo.level}/${ROD_MAX} lvl`} color="text-emerald-300" />
              <Chip icon="⛵" label="Qayiq" value={boatName} color="text-sky-300" />
            </div>
          </div>

          <div className="relative space-y-2.5">
            <button
              onClick={onPlay}
              className="group w-full rounded-2xl border border-emerald-200/40 bg-gradient-to-b from-emerald-300 to-emerald-500 py-4 text-xl font-black text-emerald-950 shadow-xl shadow-emerald-500/20 transition hover:-translate-y-0.5 hover:brightness-110 active:translate-y-0 active:scale-[0.99]"
            >
              🎮 O'YNASH <span className="ml-1 text-xs font-bold opacity-60">— Enter</span>
            </button>
            <div className="grid grid-cols-2 gap-2.5">
              <button onClick={onShop} className="rounded-xl border border-sky-300/10 bg-sky-900/80 py-3 font-black text-sky-100 transition hover:bg-sky-800 active:scale-95">
                🛒 Do'kon
              </button>
              <button onClick={onPedia} className="rounded-xl border border-sky-300/10 bg-sky-900/80 py-3 font-black text-sky-100 transition hover:bg-sky-800 active:scale-95">
                📖 Baliqnoma <span className="text-xs font-bold text-sky-400">{save.discovered.length}/{SPECIES.length}</span>
              </button>
            </div>
          </div>

          <div className="relative rounded-2xl border border-sky-800/70 bg-sky-950/45 p-3.5 text-xs leading-relaxed text-sky-300/90">
            <div className="mb-1.5 flex items-center gap-2 font-black text-sky-100"><span>🕹️</span> Tezkor boshqaruv</div>
            <p>🖱 Sichqoncha yoki barmoq bilan ilgakni sudrang · ⌨ WASD / strelkalar bilan yuring · P yoki Esc — pauza.</p>
            <p className="mt-1 text-sky-400">Baliqqa tegib tuting, ketma-ket ov qiling va kombo ko'paytirgichni yoqing!</p>
          </div>
        </section>

        <aside className="relative flex flex-col gap-4">
          <ServerBadge status={cloudStatus} onRetry={onRetryCloud} />

          {cloudStatus === "online" && (
            <div className="rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-950/75 to-slate-950/70 p-4 shadow-xl shadow-cyan-950/20">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-xs font-black tracking-[0.16em] text-cyan-200">🌍 DUNYO REYTINGI</h2>
                <span className="text-[10px] font-bold text-cyan-500">SERVERDA SAQLANADI</span>
              </div>
              <GlobalScoreTable scores={globalScores} />
            </div>
          )}

          <div className="rounded-2xl border border-sky-800/70 bg-sky-950/50 p-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <h2 className="text-xs font-black tracking-[0.16em] text-sky-300">🏆 SHAXSIY REKORDLAR</h2>
              <span className="text-[10px] font-bold text-sky-600">SHU QURILMADA</span>
            </div>
            <HighScoreTable scores={save.highScores} highlight={-1} compact />
          </div>

          <div className="rounded-2xl border border-violet-400/15 bg-violet-950/25 p-4 text-xs text-violet-100/80">
            <div className="mb-1 font-black text-violet-200">✨ Harakat qiling — profilingiz o'sadi</div>
            <p>Har ov, yangi baliq turi, qarmoq darajasi va qayiq xaridi profilga turlicha XP qo'shadi.</p>
            <p className="mt-1 text-violet-300">1-darajali qarmoqni 2-darajaga ko'tarsangiz profil aynan 1.5 lvl bo'ladi.</p>
          </div>

          <p className="px-1 text-center text-[11px] font-semibold text-sky-700">
            330+ narxlangan baliq turi · 300 darajali qarmoq · 5 ta ochiladigan qayiq
          </p>
        </aside>
      </main>
    </div>
  );
}

function ServerBadge({ status, onRetry }: { status: CloudStatus; onRetry: () => void }) {
  const labels: Record<CloudStatus, string> = {
    connecting: "Server bilan ulanmoqda…",
    online: "Server ulandi · saqlash faol",
    offline: "Mahalliy saqlash faol",
  };
  const tone = status === "online"
    ? "border-emerald-400/20 bg-emerald-950/35 text-emerald-200"
    : status === "connecting"
      ? "border-amber-400/20 bg-amber-950/25 text-amber-200"
      : "border-sky-800/70 bg-sky-950/40 text-sky-300";

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-xs font-bold ${tone}`}>
      <span className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${status === "online" ? "bg-emerald-400 shadow-[0_0_10px_#34d399]" : status === "connecting" ? "animate-pulse bg-amber-300" : "bg-sky-500"}`} />
        {labels[status]}
      </span>
      {status === "offline" && (
        <button onClick={onRetry} className="rounded-lg bg-sky-800 px-2.5 py-1 text-sky-100 transition hover:bg-sky-700">Qayta ulash</button>
      )}
    </div>
  );
}

function Chip({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-sky-700/55 bg-slate-950/45 px-3 py-2">
      <div className="truncate text-[10px] uppercase tracking-wide text-sky-500">{icon} {label}</div>
      <div className={`truncate text-sm font-black ${color}`}>{value}</div>
    </div>
  );
}

/* ---------------- Game Over ---------------- */

function GameOverScreen({
  result, save, profileGain, onRestart, onShop, onMenu,
}: {
  result: RoundResult;
  save: SaveData;
  profileGain: number;
  onRestart: () => void;
  onShop: () => void;
  onMenu: () => void;
}) {
  const isRecord = save.highScores.length > 0 && save.highScores[0].score === result.earned && result.earned > 0;
  return (
    <div className="scroll-thin absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex min-h-full w-full max-w-xl flex-col items-center justify-center gap-4 px-4 py-7 text-center">
        <div className="anim-pop">
          <div className="text-5xl">{isRecord ? "🏆" : "⏱"}</div>
          <h1 className="mt-1 text-3xl font-black text-sky-100">
            {isRecord ? "YANGI REKORD!" : "Ov yakunlandi!"}
          </h1>
          <div className="gold-shine mt-2 text-5xl font-black">🪙 {formatMoney(result.earned)}</div>
        </div>

        <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
          <Chip icon="🐟" label="Tutilgan" value={`${result.caughtCount} ta`} color="text-sky-200" />
          <Chip icon="🔥" label="Maks kombo" value={`x${(1 + Math.min(20, Math.max(0, result.maxCombo - 1)) * 0.1).toFixed(1)}`} color="text-orange-300" />
          <Chip icon="✨" label="Yangi tur" value={`${result.newSpecies.length} ta`} color="text-fuchsia-300" />
          <Chip icon="👤" label="Profil XP" value={`+${profileGain.toFixed(2)} lvl`} color="text-violet-300" />
        </div>
        <div className="w-full rounded-xl border border-violet-400/20 bg-violet-950/25 px-3 py-2 text-xs font-bold text-violet-200">
          Jami profil: {profileLevel(save.profileXP).toFixed(1)} lvl
        </div>

        {result.bestFish && (
          <div className="w-full rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-sm">
            <span className="text-sky-300">Eng qimmat ov: </span>
            <span className="font-black" style={{ color: RARITY_COLORS[result.bestFish.rarity] }}>
              {result.bestFish.name}
            </span>
            <span className="font-black text-yellow-300"> — 🪙{formatMoney(result.bestFish.price)}</span>
          </div>
        )}

        <div className="w-full rounded-xl border border-sky-800/70 bg-sky-950/50 p-3">
          <h2 className="mb-1.5 text-xs font-black tracking-widest text-sky-400">🏆 SHAXSIY REKORDLAR</h2>
          <HighScoreTable scores={save.highScores} highlight={result.earned} />
        </div>

        <div className="w-full space-y-2.5">
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
  let highlightUsed = false;
  return (
    <div className="space-y-1">
      {list.map((score, index) => {
        const highlighted = !highlightUsed && score.score === highlight;
        if (highlighted) highlightUsed = true;
        return (
          <div
            key={`${score.date}-${score.score}-${score.rodLevel}-${index}`}
            className={`flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1 text-xs ${highlighted ? "bg-yellow-500/20 font-black text-yellow-200" : "text-sky-300"}`}
          >
            <span className="w-5 shrink-0 text-left font-black">{["🥇", "🥈", "🥉"][index] ?? `${index + 1}.`}</span>
            <span className="shrink-0 font-bold text-yellow-300">🪙 {formatMoney(score.score)}</span>
            <span className="min-w-0 truncate text-sky-500">{score.bestFish}</span>
            <span className="ml-auto shrink-0 text-sky-600">🎣{score.rodLevel} · {score.date}</span>
          </div>
        );
      })}
      {list.length === 0 && <div className="py-2 text-center text-xs text-sky-600">Birinchi ov natijangizni yarating!</div>}
    </div>
  );
}

function GlobalScoreTable({ scores }: { scores: GlobalScore[] }) {
  return (
    <div className="space-y-1">
      {scores.map((score, index) => (
        <div key={`${score.name}-${score.score}`} className="flex min-w-0 items-center gap-2 rounded-lg bg-slate-950/35 px-2.5 py-1.5 text-xs">
          <span className="w-5 shrink-0 text-left font-black text-cyan-300">{["🥇", "🥈", "🥉"][index] ?? `${index + 1}.`}</span>
          <span className="max-w-28 shrink-0 truncate font-bold text-sky-100">{score.name}</span>
          <span className="shrink-0 font-black text-yellow-300">🪙 {formatMoney(score.score)}</span>
          <span className="min-w-0 truncate text-cyan-500">{score.bestFish}</span>
          <span className="ml-auto shrink-0 text-sky-600">{score.date}</span>
        </div>
      ))}
      {scores.length === 0 && <div className="py-3 text-center text-xs text-cyan-500">Global reytingga birinchi natijani yozing!</div>}
    </div>
  );
}
