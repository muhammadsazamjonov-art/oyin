import { useState } from "react";
import { SaveData, fetchCloudProfile } from "../game/save";
import { rodStats, BOATS, profileLevel, ROD_MAX } from "../game/progression";
import { formatMoney, SPECIES } from "../game/species";
import { sfx } from "../game/sound";

interface Props {
  save: SaveData;
  setSave: React.Dispatch<React.SetStateAction<SaveData>>;
  onClose: () => void;
}

export default function ProfileModal({ save, setSave, onClose }: Props) {
  const [nameInput, setNameInput] = useState(save.playerName);
  const [restoreInput, setRestoreInput] = useState("");
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "ok" | "err" } | null>(null);
  const [copied, setCopied] = useState(false);

  const plevel = profileLevel(save.profileXP);
  const currentLvlInt = Math.floor(plevel);
  const nextLvlPct = Math.round((plevel - currentLvlInt) * 100);
  const rod = rodStats(save.rodLevel);
  const boat = BOATS[save.boatIdx];

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = nameInput.trim().slice(0, 24);
    if (!clean) return;

    setSave((s) => ({ ...s, playerName: clean }));
    sfx.upgrade();
    setMsg({ text: "Ismingiz muvaffaqiyatli saqlandi!", type: "ok" });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleCopyId = () => {
    navigator.clipboard?.writeText(save.playerId);
    setCopied(true);
    sfx.click();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = restoreInput.trim();
    if (!q) return;

    setRestoreLoading(true);
    setMsg(null);

    const cloudData = await fetchCloudProfile(q);
    setRestoreLoading(false);

    if (cloudData) {
      setSave(cloudData);
      sfx.buy();
      setMsg({
        text: `Profil tiklandi! Xush kelibsiz, ${cloudData.playerName}!`,
        type: "ok",
      });
      setNameInput(cloudData.playerName);
    } else {
      sfx.denied();
      setMsg({
        text: "Bunday ID yoki Ismli profil serverdan topilmadi.",
        type: "err",
      });
    }
  };

  return (
    <div className="anim-pop fixed inset-0 z-40 flex items-center justify-center bg-sky-950/80 p-3 sm:p-5 backdrop-blur-md">
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-3xl border border-sky-700/60 bg-gradient-to-b from-sky-900 via-sky-950 to-slate-950 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sky-800/80 px-5 py-4 bg-sky-950/60">
          <div className="flex items-center gap-2">
            <span className="text-2xl">👤</span>
            <div>
              <h2 className="text-xl font-black text-sky-100 tracking-tight">Mening Profilim</h2>
              <p className="text-xs text-sky-400">Natijalar serverda va qurilmangizda saqlanadi</p>
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

        {/* Content */}
        <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          {msg && (
            <div
              className={`rounded-2xl p-3 text-xs font-bold text-center transition-all ${
                msg.type === "ok"
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                  : "bg-red-500/20 border border-red-500/40 text-red-300"
              }`}
            >
              {msg.text}
            </div>
          )}

          {/* Ismni o'rnatish bloki */}
          <form onSubmit={handleSaveName} className="rounded-2xl border border-sky-800/80 bg-sky-900/30 p-4">
            <label className="block text-xs font-bold text-sky-300 mb-1.5">
              ✍️ Profilingiz nomi (Ismingiz):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={24}
                placeholder="Ismingizni yozing..."
                className="flex-1 rounded-xl border border-sky-700/80 bg-sky-950 px-3.5 py-2.5 text-sm font-bold text-sky-100 placeholder:text-sky-500 focus:border-emerald-400 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2.5 text-xs sm:text-sm font-black text-emerald-950 transition hover:brightness-110 active:scale-95 shadow-md shadow-emerald-500/20"
              >
                Saqlash
              </button>
            </div>
          </form>

          {/* Profil darajasi va Progress bar */}
          <div className="rounded-2xl border border-sky-800/80 bg-sky-900/30 p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase font-extrabold text-violet-400">Profil Darajasi</span>
                <div className="text-2xl font-black text-violet-300">{plevel.toFixed(1)} lvl</div>
              </div>
              <div className="text-right">
                <span className="text-xs text-sky-400">Keyingi darajagacha</span>
                <div className="text-sm font-bold text-sky-200">{nextLvlPct}% to'ldi</div>
              </div>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-sky-950 border border-sky-800">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all duration-300"
                style={{ width: `${nextLvlPct}%` }}
              />
            </div>
            <p className="text-[11px] text-sky-400">
              💡 Har bir baliq tutish, yangi tur ochish va qarmoq yangilash profil darajasini oshiradi.
            </p>
          </div>

          {/* Statistik ko'rsatkichlar kartalari */}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 text-xs">
            <div className="rounded-xl border border-sky-800/60 bg-sky-950/60 p-3">
              <span className="text-sky-400 block text-[10px] uppercase font-bold">🎣 Qarmoq</span>
              <span className="text-sm font-black text-emerald-300">{save.rodLevel}/{ROD_MAX} lvl</span>
              <span className="text-[10px] text-sky-500 block truncate">{rod.tierName} toifasi</span>
            </div>

            <div className="rounded-xl border border-sky-800/60 bg-sky-950/60 p-3">
              <span className="text-sky-400 block text-[10px] uppercase font-bold">⛵ Qayiq</span>
              <span className="text-sm font-black text-sky-200 truncate block">{boat.name}</span>
              <span className="text-[10px] text-sky-500 block">Bosqich {save.boatIdx + 1}/6</span>
            </div>

            <div className="rounded-xl border border-sky-800/60 bg-sky-950/60 p-3">
              <span className="text-sky-400 block text-[10px] uppercase font-bold">🪙 Tangalar</span>
              <span className="text-sm font-black text-yellow-300">{formatMoney(save.coins)}</span>
              <span className="text-[10px] text-sky-500 block">Jami: {formatMoney(save.totalEarned)}</span>
            </div>

            <div className="rounded-xl border border-sky-800/60 bg-sky-950/60 p-3">
              <span className="text-sky-400 block text-[10px] uppercase font-bold">🐟 Ovlangan</span>
              <span className="text-sm font-black text-sky-200">{save.totalCaught} ta</span>
              <span className="text-[10px] text-sky-500 block">Dengiz baliqlari</span>
            </div>

            <div className="rounded-xl border border-sky-800/60 bg-sky-950/60 p-3">
              <span className="text-sky-400 block text-[10px] uppercase font-bold">📖 Baliqnoma</span>
              <span className="text-sm font-black text-fuchsia-300">{save.discovered.length}/{SPECIES.length}</span>
              <span className="text-[10px] text-sky-500 block">Ochilgan turlar</span>
            </div>

            <div className="rounded-xl border border-sky-800/60 bg-sky-950/60 p-3">
              <span className="text-sky-400 block text-[10px] uppercase font-bold">🆔 O'yinchi ID</span>
              <span className="text-xs font-mono font-black text-sky-200 block truncate">{save.playerId}</span>
              <button
                onClick={handleCopyId}
                className="mt-0.5 text-[10px] text-emerald-400 underline font-bold"
              >
                {copied ? "✓ Nusxalandi" : "Nusxa olish"}
              </button>
            </div>
          </div>

          {/* Boshqa qurilmadan kirish yoki Natijalarni qayta yuklash */}
          <div className="rounded-2xl border border-sky-800/80 bg-sky-900/25 p-4">
            <h4 className="text-xs font-black text-sky-200 uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <span>🔄</span> Boshqa telefon yoki kompyuterdan kirish:
            </h4>
            <p className="text-[11px] text-sky-400 mb-2">
              Agar brauzer xotirasi tozalansa yoki boshqa qurilmaga o'tsangiz, avvalgi ID yoki Ismingizni kiritib o'yiningizni tiklashingiz mumkin:
            </p>
            <form onSubmit={handleRestore} className="flex items-center gap-2">
              <input
                type="text"
                value={restoreInput}
                onChange={(e) => setRestoreInput(e.target.value)}
                placeholder="ID (masalan: B-XXXX) yoki Ismingiz..."
                className="flex-1 rounded-xl border border-sky-700/70 bg-sky-950 px-3 py-2 text-xs text-sky-100 placeholder:text-sky-500 focus:border-sky-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={restoreLoading}
                className="rounded-xl bg-sky-700 hover:bg-sky-600 px-3.5 py-2 text-xs font-bold text-sky-100 transition active:scale-95 disabled:opacity-50"
              >
                {restoreLoading ? "⏳" : "Tiklash"}
              </button>
            </form>
          </div>

          <div className="flex items-center justify-center gap-2 text-center text-xs text-emerald-400 font-bold">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Natijalaringiz xavfsiz tarzda doimiy saqlanadi!</span>
          </div>
        </div>
      </div>
    </div>
  );
}
