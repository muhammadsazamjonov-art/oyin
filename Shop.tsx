import { SaveData } from "../game/save";
import {
  rodStats, rodUpgradeCost, ROD_MAX, BOATS, XP, profileLevel,
} from "../game/progression";
import { formatMoney } from "../game/species";
import { sfx } from "../game/sound";

interface Props {
  save: SaveData;
  setSave: React.Dispatch<React.SetStateAction<SaveData>>;
  onClose: () => void;
}

export default function Shop({ save, setSave, onClose }: Props) {
  const rod = rodStats(save.rodLevel);
  const next = rodStats(save.rodLevel + 1);
  const cost = rodUpgradeCost(save.rodLevel);
  const plevel = profileLevel(save.profileXP);
  const maxed = save.rodLevel >= ROD_MAX;

  const upgradeRod = (times: number) => {
    setSave((s) => {
      let coins = s.coins;
      let lvl = s.rodLevel;
      let xp = s.profileXP;
      let done = 0;
      for (let i = 0; i < times && lvl < ROD_MAX; i++) {
        const c = rodUpgradeCost(lvl);
        if (coins < c) break;
        coins -= c;
        lvl++;
        xp += XP.rodUpgrade; // har yangilash profil +0.5 lvl
        done++;
      }
      if (done > 0) sfx.upgrade();
      else sfx.denied();
      return { ...s, coins, rodLevel: lvl, profileXP: xp };
    });
  };

  const buyBoat = (idx: number) => {
    const b = BOATS[idx];
    setSave((s) => {
      if (idx <= s.boatIdx || profileLevel(s.profileXP) < b.reqProfile || s.coins < b.cost) {
        sfx.denied();
        return s;
      }
      sfx.buy();
      return { ...s, coins: s.coins - b.cost, boatIdx: idx, profileXP: s.profileXP + b.xpBonus };
    });
  };

  return (
    <div className="anim-pop absolute inset-0 z-30 flex items-center justify-center bg-sky-950/80 p-3 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-3xl flex-col rounded-2xl border border-sky-700/60 bg-gradient-to-b from-sky-900 to-sky-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 border-b border-sky-800 px-4 py-3">
          <h2 className="text-lg font-black text-sky-100">🛒 Do'kon</h2>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="rounded-lg bg-yellow-500/15 px-2.5 py-1 text-yellow-300">🪙 {formatMoney(save.coins)}</span>
            <span className="rounded-lg bg-violet-500/15 px-2.5 py-1 text-violet-300">👤 {plevel.toFixed(1)} lvl</span>
            <button onClick={onClose} className="ml-1 rounded-lg bg-sky-800 px-3 py-1 text-sky-100 transition hover:bg-sky-700 active:scale-95">✕</button>
          </div>
        </div>

        <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-4">
          {/* Qarmoq */}
          <div className="rounded-xl border border-sky-800 bg-sky-900/40 p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-base font-black" style={{ color: rod.color }}>
                  🎣 {rod.tierName} qarmoq — {rod.level}/{ROD_MAX} lvl
                </div>
                <div className="text-xs text-sky-400">Har yangilash profilga +0.5 lvl beradi</div>
              </div>
              <div className="h-2 w-full max-w-[200px] overflow-hidden rounded-full bg-sky-950">
                <div className="h-full rounded-full transition-all" style={{ width: `${(rod.level / ROD_MAX) * 100}%`, background: rod.color }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <Stat label="Chuqurlik" now={`${rod.maxDepth.toFixed(0)}m`} nxt={maxed ? "" : `${next.maxDepth.toFixed(0)}m`} />
              <Stat label="Tezlik" now={rod.speed.toFixed(0)} nxt={maxed ? "" : next.speed.toFixed(0)} />
              <Stat label="Tutish radiusi" now={rod.radius.toFixed(1)} nxt={maxed ? "" : next.radius.toFixed(1)} />
              <Stat label="Omad" now={`${(rod.luck * 100).toFixed(0)}%`} nxt={maxed ? "" : `${(next.luck * 100).toFixed(0)}%`} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {maxed ? (
                <span className="rounded-xl bg-amber-500/20 px-4 py-2 text-sm font-black text-amber-300">✨ MAKSIMAL DARAJA!</span>
              ) : (
                <>
                  <button
                    onClick={() => upgradeRod(1)}
                    disabled={save.coins < cost}
                    className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
                  >
                    ⬆ Yangilash — 🪙 {formatMoney(cost)}
                  </button>
                  <button
                    onClick={() => upgradeRod(10)}
                    disabled={save.coins < cost}
                    className="rounded-xl bg-sky-700 px-4 py-2 text-sm font-bold text-sky-100 transition hover:bg-sky-600 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500"
                  >
                    x10
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Qayiqlar */}
          <div>
            <h3 className="mb-2 text-sm font-black tracking-wide text-sky-200">⛵ QAYIQLAR</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {BOATS.map((b) => {
                const owned = save.boatIdx >= b.idx;
                const active = save.boatIdx === b.idx;
                const lockedLvl = plevel < b.reqProfile;
                const canBuy = !owned && !lockedLvl && save.coins >= b.cost && b.idx === save.boatIdx + 1;
                const isNext = b.idx === save.boatIdx + 1;
                return (
                  <div
                    key={b.idx}
                    className={`rounded-xl border p-3 transition ${active
                      ? "border-emerald-500/70 bg-emerald-500/10"
                      : owned
                        ? "border-sky-800 bg-sky-900/30 opacity-70"
                        : isNext
                          ? "border-yellow-500/50 bg-yellow-500/5"
                          : "border-sky-900 bg-sky-950/40 opacity-60"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-sky-100">
                        <span className="mr-1 inline-block h-3 w-3 rounded-sm align-middle" style={{ background: b.hull }} />
                        {b.name}
                      </span>
                      {active && <span className="text-xs font-bold text-emerald-400">✓ FAOL</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-sky-400">{b.desc}</div>
                    {b.idx > 0 && !owned && (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                        <span className={lockedLvl ? "font-bold text-red-400" : "font-bold text-emerald-400"}>
                          👤 {b.reqProfile} lvl kerak
                        </span>
                        <span className="font-bold text-yellow-300">🪙 {formatMoney(b.cost)}</span>
                        <span className="font-bold text-violet-300">+{b.xpBonus} profil lvl</span>
                        <button
                          onClick={() => buyBoat(b.idx)}
                          disabled={!canBuy}
                          className="ml-auto rounded-lg bg-yellow-500 px-3 py-1 font-black text-yellow-950 transition hover:bg-yellow-400 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
                        >
                          {lockedLvl ? "🔒" : !isNext ? "Avvalgisini oling" : "Sotib olish"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, now, nxt }: { label: string; now: string; nxt: string }) {
  return (
    <div className="rounded-lg bg-sky-950/60 px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-sky-500">{label}</div>
      <div className="font-bold text-sky-100">
        {now}
        {nxt && <span className="text-emerald-400"> → {nxt}</span>}
      </div>
    </div>
  );
}
