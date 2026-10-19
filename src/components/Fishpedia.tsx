import { useMemo, useState } from "react";
import { SPECIES, RARITY_NAMES, RARITY_COLORS, formatMoney } from "../game/species";
import { sfx } from "../game/sound";

interface Props {
  discovered: number[];
  onClose: () => void;
}

export default function Fishpedia({ discovered, onClose }: Props) {
  const [filter, setFilter] = useState<number>(-1);
  const [search, setSearch] = useState("");
  const [onlyFound, setOnlyFound] = useState(false);

  const dset = useMemo(() => new Set(discovered), [discovered]);

  const list = useMemo(() => {
    let l = filter < 0 ? SPECIES : SPECIES.filter((s) => s.rarity === filter);
    if (onlyFound) {
      l = l.filter((s) => dset.has(s.id));
    }
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      l = l.filter((s) => s.name.toLowerCase().includes(q));
    }
    return [...l].sort((a, b) => a.price - b.price);
  }, [filter, onlyFound, search, dset]);

  const progressPct = ((discovered.length / SPECIES.length) * 100).toFixed(1);

  return (
    <div className="anim-pop fixed inset-0 z-40 flex items-center justify-center bg-sky-950/80 p-3 sm:p-5 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col rounded-3xl border border-sky-700/60 bg-gradient-to-b from-sky-900 via-sky-950 to-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-sky-800/80 px-5 py-4 bg-sky-950/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">📖</span>
              <h2 className="text-xl font-black text-sky-100 tracking-tight">
                Baliqnoma — 330 xil Dengiz Mavjudoti
              </h2>
            </div>
            <div className="mt-1 text-xs text-sky-300">
              Topilgan: <span className="font-extrabold text-emerald-400">{discovered.length}</span> / {SPECIES.length} ({progressPct}%)
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyFound((v) => !v)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                onlyFound
                  ? "bg-emerald-500 text-emerald-950"
                  : "bg-sky-800/80 text-sky-200 hover:bg-sky-700"
              }`}
            >
              {onlyFound ? "✓ Faqat topilganlar" : "Barcha baliqlar"}
            </button>
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
        </div>

        {/* Qidiruv va Filterlar */}
        <div className="border-b border-sky-800/60 px-5 py-3 space-y-2.5 bg-sky-950/40">
          <input
            type="text"
            placeholder="🔍 Baliq nomini qidiring (masalan: Oltin sazan, Akula)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-sky-700/60 bg-sky-900/60 px-3.5 py-2 text-xs sm:text-sm text-sky-100 placeholder:text-sky-400/60 focus:border-sky-400 focus:outline-none"
          />

          <div className="scroll-thin flex gap-1.5 overflow-x-auto pb-1">
            <FBtn
              active={filter === -1}
              onClick={() => {
                sfx.click();
                setFilter(-1);
              }}
              color="#e2e8f0"
              label="Hammasi (330)"
            />
            {RARITY_NAMES.map((n, i) => (
              <FBtn
                key={i}
                active={filter === i}
                onClick={() => {
                  sfx.click();
                  setFilter(i);
                }}
                color={RARITY_COLORS[i]}
                label={n}
              />
            ))}
          </div>
        </div>

        {/* Baliqlar ro'yxati */}
        <div className="scroll-thin flex-1 overflow-y-auto p-4 sm:p-5">
          {list.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center text-sky-400">
              <span className="text-4xl">🐟</span>
              <p className="mt-2 text-sm font-bold">Hech qanday baliq topilmadi</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {list.map((s) => {
                const found = dset.has(s.id);
                return (
                  <div
                    key={s.id}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 text-xs transition-all ${
                      found
                        ? "border-sky-700/80 bg-sky-900/40 shadow-sm"
                        : "border-sky-900/50 bg-sky-950/40 opacity-60"
                    }`}
                  >
                    <div
                      className="h-3.5 w-3.5 shrink-0 rounded-full shadow-sm"
                      style={{
                        backgroundColor: RARITY_COLORS[s.rarity],
                        boxShadow: `0 0 8px ${RARITY_COLORS[s.rarity]}80`,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className={`truncate font-bold ${found ? "text-sky-100" : "text-sky-400"}`}>
                        {found ? "✓ " : "🔒 "}
                        {found ? s.name : "???"}
                      </div>
                      <div className="mt-0.5 text-[11px] text-sky-400">
                        {s.depthMin.toFixed(0)}m – {s.depthMax.toFixed(0)}m
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-extrabold text-yellow-300">🪙 {formatMoney(s.price)}</div>
                      <div
                        className="text-[10px] font-bold"
                        style={{ color: RARITY_COLORS[s.rarity] }}
                      >
                        {RARITY_NAMES[s.rarity]}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FBtn({
  active,
  onClick,
  color,
  label,
}: {
  active: boolean;
  onClick: () => void;
  color: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition-all active:scale-95 ${
        active
          ? "bg-sky-600 text-white shadow-md shadow-sky-600/30"
          : "bg-sky-900/70 text-sky-300 hover:bg-sky-800/80"
      }`}
    >
      <span
        className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle shadow-sm"
        style={{ background: color }}
      />
      {label}
    </button>
  );
}
