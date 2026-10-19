import { SaveData } from "../game/save";
import {
  rodStats,
  rodUpgradeCost,
  ROD_MAX,
  BOATS,
  XP,
  profileLevel,
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

  // Hisoblash: tangaga qarab necha marta ko'tarish mumkin
  const calcMaxUpgrades = () => {
    let coins = save.coins;
    let lvl = save.rodLevel;
    let count = 0;
    while (lvl < ROD_MAX) {
      const c = rodUpgradeCost(lvl);
      if (coins < c) break;
      coins -= c;
      lvl++;
      count++;
    }
    return count;
  };

  const maxPossible = calcMaxUpgrades();

  const upgradeRod = (times: number) => {
    setSave((s) => {
      let coins = s.coins;
      let lvl = s.rodLevel;
      let xp = s.profileXP;
      let done = 0;
      const initialTier = rodStats(lvl).tier;

      for (let i = 0; i < times && lvl < ROD_MAX; i++) {
        const c = rodUpgradeCost(lvl);
        if (coins < c) break;
        coins -= c;
        lvl++;
        xp += XP.rodUpgrade; // Har yangilash profilga +0.5 lvl beradi
        done++;
      }

      if (done > 0) {
        const newTier = rodStats(lvl).tier;
        if (newTier > initialTier) {
          sfx.tierUp();
        } else {
          sfx.upgrade();
        }
      } else {
        sfx.denied();
      }
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
      return {
        ...s,
        coins: s.coins - b.cost,
        boatIdx: idx,
        profileXP: s.profileXP + b.xpBonus,
      };
    });
  };

  return (
    <div className="anim-pop fixed inset-0 z-40 flex items-center justify-center bg-sky-950/80 p-3 sm:p-5 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-sky-700/60 bg-gradient-to-b from-sky-900 via-sky-950 to-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-sky-800/80 px-5 py-4 bg-sky-950/60">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛒</span>
            <h2 className="text-xl font-black text-sky-100 tracking-tight">Dengiz Do'koni</h2>
          </div>
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            <span className="rounded-xl border border-yellow-500/30 bg-yellow-500/15 px-3 py-1.5 text-yellow-300">
              🪙 {formatMoney(save.coins)}
            </span>
            <span className="rounded-xl border border-violet-500/30 bg-violet-500/15 px-3 py-1.5 text-violet-300">
              👤 {plevel.toFixed(1)} lvl
            </span>
            <button
              onClick={() => {
                sfx.click();
                onClose();
              }}
              className="ml-2 rounded-xl bg-sky-800/80 px-3 py-1.5 text-sky-200 transition hover:bg-sky-700 active:scale-95"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {/* Qarmoq bloki */}
          <div className="rounded-2xl border border-sky-800/80 bg-sky-900/30 p-4 sm:p-5 shadow-lg">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎣</span>
                  <span className="text-lg font-black tracking-tight" style={{ color: rod.glowColor }}>
                    {rod.tierName} Qarmoq — {rod.level}/{ROD_MAX} lvl
                  </span>
                  <span className="rounded-md bg-sky-800/60 px-2 py-0.5 text-[11px] font-bold text-sky-300">
                    Bosqich {rod.tier + 1}/10
                  </span>
                </div>
                <div className="mt-1 text-xs text-sky-400">
                  Har bir yangilash profilga <span className="font-bold text-emerald-400">+0.5 lvl</span> beradi
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full sm:w-56 space-y-1">
                <div className="flex justify-between text-[11px] font-bold text-sky-300">
                  <span>Taraqqiyot</span>
                  <span>{((rod.level / ROD_MAX) * 100).toFixed(0)}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-sky-950 border border-sky-800">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${(rod.level / ROD_MAX) * 100}%`,
                      backgroundColor: rod.color,
                      boxShadow: `0 0 10px ${rod.glowColor}`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Xususiyatlar ko'rsatkichi */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <StatCard
                icon="🌊"
                label="Maks Chuqurlik"
                now={`${rod.maxDepth.toFixed(0)}m`}
                nxt={maxed ? "" : `${next.maxDepth.toFixed(0)}m`}
              />
              <StatCard
                icon="⚡"
                label="Harakat Tezligi"
                now={rod.speed.toFixed(0)}
                nxt={maxed ? "" : next.speed.toFixed(0)}
              />
              <StatCard
                icon="🎯"
                label="Tutish Radiusi"
                now={`${rod.radius.toFixed(1)}px`}
                nxt={maxed ? "" : `${next.radius.toFixed(1)}px`}
              />
              <StatCard
                icon="🍀"
                label="Omad (Noyoblik)"
                now={`${(rod.luck * 100).toFixed(0)}%`}
                nxt={maxed ? "" : `${(next.luck * 100).toFixed(0)}%`}
              />
            </div>

            {/* Yangilash tugmalari */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              {maxed ? (
                <div className="flex items-center gap-2 rounded-2xl bg-amber-500/20 border border-amber-500/40 px-5 py-2.5 font-black text-amber-300">
                  <span>👑</span> MAKSIMAL DARAJA (300 LVL)!
                </div>
              ) : (
                <>
                  <button
                    onClick={() => upgradeRod(1)}
                    disabled={save.coins < cost}
                    className="flex-1 sm:flex-initial rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-5 py-2.5 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-500/25 transition hover:brightness-110 active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400 disabled:shadow-none"
                  >
                    ⬆ +1 LVL — 🪙 {formatMoney(cost)}
                  </button>

                  <button
                    onClick={() => upgradeRod(5)}
                    disabled={save.coins < cost}
                    className="rounded-xl border border-sky-700 bg-sky-800/80 px-3.5 py-2.5 text-xs font-bold text-sky-100 transition hover:bg-sky-700 active:scale-95 disabled:opacity-40"
                  >
                    +5
                  </button>

                  <button
                    onClick={() => upgradeRod(10)}
                    disabled={save.coins < cost}
                    className="rounded-xl border border-sky-700 bg-sky-800/80 px-3.5 py-2.5 text-xs font-bold text-sky-100 transition hover:bg-sky-700 active:scale-95 disabled:opacity-40"
                  >
                    +10
                  </button>

                  {maxPossible > 1 && (
                    <button
                      onClick={() => upgradeRod(maxPossible)}
                      className="rounded-xl border border-yellow-500/50 bg-yellow-500/20 px-4 py-2.5 text-xs font-black text-yellow-300 transition hover:bg-yellow-500/30 active:scale-95"
                    >
                      MAX (+{maxPossible})
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Qayiqlar yangilanishi */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-black tracking-wide text-sky-100 flex items-center gap-2">
                <span>⛵</span> QAYIQLARNI YANGILASH (5 TA BOSQICH)
              </h3>
              <span className="text-xs text-sky-400">Kerakli darajalar: 50, 100, 150, 200, 300 lvl</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {BOATS.map((b) => {
                const owned = save.boatIdx >= b.idx;
                const active = save.boatIdx === b.idx;
                const lockedLvl = plevel < b.reqProfile;
                const isNext = b.idx === save.boatIdx + 1;
                const canBuy = !owned && !lockedLvl && save.coins >= b.cost && isNext;

                return (
                  <div
                    key={b.idx}
                    className={`relative rounded-2xl border p-4 transition-all ${
                      active
                        ? "border-emerald-500/80 bg-emerald-500/10 shadow-lg shadow-emerald-500/10"
                        : owned
                          ? "border-sky-800/60 bg-sky-900/25 opacity-75"
                          : isNext
                            ? "border-yellow-500/60 bg-yellow-500/5 shadow-md"
                            : "border-sky-900/60 bg-sky-950/40 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-4 w-4 rounded-full border border-white/40 inline-block shadow-sm"
                          style={{ background: b.hull }}
                        />
                        <span className="font-black text-sm text-sky-100">{b.name}</span>
                      </div>
                      {active ? (
                        <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 text-xs font-black text-emerald-300">
                          ✓ FAOL
                        </span>
                      ) : owned ? (
                        <span className="text-xs font-bold text-sky-400">Olingan</span>
                      ) : null}
                    </div>

                    <p className="mt-1.5 text-xs text-sky-300/90 leading-relaxed">{b.desc}</p>

                    {b.idx > 0 && !owned && (
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-sky-800/50 pt-2.5 text-xs">
                        <div className="space-y-0.5">
                          <div className={lockedLvl ? "font-bold text-red-400" : "font-bold text-emerald-400"}>
                            👤 Kerakli daraja: {b.reqProfile} lvl
                          </div>
                          <div className="text-yellow-300 font-extrabold">🪙 {formatMoney(b.cost)}</div>
                        </div>

                        <button
                          onClick={() => buyBoat(b.idx)}
                          disabled={!canBuy}
                          className={`rounded-xl px-4 py-2 font-black transition active:scale-95 ${
                            canBuy
                              ? "bg-yellow-400 text-yellow-950 hover:bg-yellow-300 shadow-md shadow-yellow-500/20"
                              : "bg-slate-800 text-slate-500 cursor-not-allowed"
                          }`}
                        >
                          {lockedLvl
                            ? `🔒 ${b.reqProfile} lvl kerak`
                            : !isNext
                              ? "Avvalgisini oling"
                              : save.coins < b.cost
                                ? "Tangalar kam"
                                : "Sotib olish"}
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

function StatCard({
  icon,
  label,
  now,
  nxt,
}: {
  icon: string;
  label: string;
  now: string;
  nxt: string;
}) {
  return (
    <div className="rounded-xl border border-sky-800/50 bg-sky-950/70 p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-sky-400">
        <span>{icon}</span> {label}
      </div>
      <div className="mt-1 text-sm font-black text-sky-100">
        {now}
        {nxt && <span className="text-emerald-400 font-bold text-xs"> → {nxt}</span>}
      </div>
    </div>
  );
}
