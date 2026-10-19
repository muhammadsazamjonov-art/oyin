import { useMemo, useState } from "react";
import { SPECIES, RARITY_NAMES, RARITY_COLORS, formatMoney } from "./species";

interface Props {
  discovered: number[];
  onClose: () => void;
}

export default function Fishpedia({ discovered, onClose }: Props) {
  const [filter, setFilter] = useState<number>(-1);
  const dset = useMemo(() => new Set(discovered), [discovered]);
  const list = useMemo(() => {
    const l = filter < 0 ? SPECIES : SPECIES.filter((s) => s.rarity === filter);
    return [...l].sort((a, b) => a.price - b.price);
  }, [filter]);

  return (
    <div className="anim-pop absolute inset-0 z-30 flex items-center justify-center bg-sky-950/80 p-3 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-3xl flex-col rounded-2xl border border-sky-700/60 bg-gradient-to-b from-sky-900 to-sky-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-sky-800 px-4 py-3">
          <h2 className="text-lg font-black text-sky-100">
            📖 Baliqnoma <span className="text-sm font-bold text-sky-400">({discovered.length}/{SPECIES.length} topilgan)</span>
          </h2>
          <button onClick={onClose} className="rounded-lg bg-sky-800 px-3 py-1 text-sky-100 transition hover:bg-sky-700 active:scale-95">✕</button>
        </div>
        <div className="scroll-thin flex gap-1.5 overflow-x-auto border-b border-sky-800/60 px-3 py-2">
          <FBtn active={filter === -1} onClick={() => setFilter(-1)} color="#e2e8f0" label="Hammasi" />
          {RARITY_NAMES.map((n, i) => (
            <FBtn key={i} active={filter === i} onClick={() => setFilter(i)} color={RARITY_COLORS[i]} label={n} />
          ))}
        </div>
        <div className="scroll-thin flex-1 overflow-y-auto p-3">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {list.map((s) => {
              const found = dset.has(s.id);
              return (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${found ? "border-sky-700/60 bg-sky-900/50" : "border-sky-900 bg-sky-950/50 opacity-70"}`}
                >
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: RARITY_COLORS[s.rarity] }} />
                  <span className={`truncate font-bold ${found ? "text-sky-100" : "text-sky-500"}`}>
                    {found ? "✓ " : ""}{s.name}
                  </span>
                  <span className="ml-auto shrink-0 text-sky-500">{s.depthMin.toFixed(0)}–{s.depthMax.toFixed(0)}m</span>
                  <span className="w-16 shrink-0 text-right font-black text-yellow-300">🪙{formatMoney(s.price)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function FBtn({ active, onClick, color, label }: { active: boolean; onClick: () => void; color: string; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold transition active:scale-95 ${active ? "bg-sky-700 text-white" : "bg-sky-900/60 text-sky-300 hover:bg-sky-800"}`}
    >
      <span className="mr-1 inline-block h-2 w-2 rounded-full align-middle" style={{ background: color }} />
      {label}
    </button>
  );
}
