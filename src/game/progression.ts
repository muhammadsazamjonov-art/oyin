// Qarmoq (300 lvl), qayiqlar (5 ta yangilash) va profil darajasi

export const ROD_MAX = 300;

export interface RodStats {
  level: number;
  tier: number;
  tierName: string;
  color: string;
  glowColor: string;
  lineColor: string;
  maxDepth: number; // metr
  speed: number; // px/s
  radius: number; // tutish radiusi px
  luck: number; // 0..1
  comboTime: number; // s
  nextTierLvl: number;
}

export const ROD_TIERS = [
  { name: "Yog'och", color: "#b45309", glow: "#d97706", line: "#d6c7a1" },
  { name: "Bambuk", color: "#65a30d", glow: "#84cc16", line: "#d9f99d" },
  { name: "Po'lat", color: "#64748b", glow: "#94a3b8", line: "#cbd5e1" },
  { name: "Kumush", color: "#cbd5e1", glow: "#f8fafc", line: "#f1f5f9" },
  { name: "Oltin", color: "#facc15", glow: "#fde047", line: "#fef08a" },
  { name: "Platina", color: "#38bdf8", glow: "#7dd3fc", line: "#e0f2fe" },
  { name: "Olmos", color: "#22d3ee", glow: "#06b6d4", line: "#a5f3fc" },
  { name: "Plazma", color: "#c084fc", glow: "#e879f9", line: "#f5d0fe" },
  { name: "Kosmik", color: "#818cf8", glow: "#6366f1", line: "#c7d2fe" },
  { name: "Afsonaviy", color: "#f97316", glow: "#fb923c", line: "#ffedd5" },
];

export function rodStats(level: number): RodStats {
  const lvl = Math.min(ROD_MAX, Math.max(1, level));
  const tier = Math.min(9, Math.floor((lvl - 1) / 30));
  const t = ROD_TIERS[tier];
  const nextTierLvl = (tier + 1) * 30;

  return {
    level: lvl,
    tier,
    tierName: t.name,
    color: t.color,
    glowColor: t.glow,
    lineColor: t.line,
    maxDepth: Math.min(312, 14 + lvl * 1.0),
    speed: 230 + lvl * 1.5,
    radius: 19 + lvl * 0.22,
    luck: Math.min(1, lvl / 300),
    comboTime: 2.2 + lvl * 0.005,
    nextTierLvl: Math.min(ROD_MAX, nextTierLvl),
  };
}

export function rodUpgradeCost(currentLevel: number): number {
  return Math.floor(18 * Math.pow(currentLevel + 1, 1.62));
}

export interface Boat {
  idx: number;
  name: string;
  reqProfile: number; // talab qilinadigan profil darajasi (50, 100, 150, 200, 300)
  cost: number;
  incomeMult: number;
  roundTime: number; // s
  xpBonus: number; // sotib olganda profil +lvl
  hull: string;
  deck: string;
  desc: string;
}

export const BOATS: Boat[] = [
  { idx: 0, name: "Eski yog'och sol", reqProfile: 0, cost: 0, incomeMult: 1, roundTime: 60, xpBonus: 0, hull: "#8b5e34", deck: "#c0813f", desc: "Boshlang'ich yog'och sol (1.0x daromad, 60 soniya)" },
  { idx: 1, name: "Yelkanli qayiq", reqProfile: 50, cost: 6000, incomeMult: 1.3, roundTime: 70, xpBonus: 8, hull: "#b45309", deck: "#f3e8d2", desc: "+30% daromad, +10s vaqt, shamol yelkani" },
  { idx: 2, name: "Motorli tezyurar kater", reqProfile: 100, cost: 32000, incomeMult: 1.7, roundTime: 80, xpBonus: 12, hull: "#dc2626", deck: "#fecaca", desc: "+70% daromad, +20s vaqt, turbo motor" },
  { idx: 3, name: "Baliqchi kemasi", reqProfile: 150, cost: 120000, incomeMult: 2.2, roundTime: 90, xpBonus: 16, hull: "#1d4ed8", deck: "#bfdbfe", desc: "+120% daromad, +30s vaqt, chuqur turlar uchun sonar" },
  { idx: 4, name: "Oq lyuks yaxta", reqProfile: 200, cost: 420000, incomeMult: 3.0, roundTime: 100, xpBonus: 22, hull: "#e2e8f0", deck: "#f8fafc", desc: "+200% daromad, +40s vaqt, zamonaviy navigatsiya" },
  { idx: 5, name: "Afsonaviy flagman kemasi", reqProfile: 300, cost: 1500000, incomeMult: 4.5, roundTime: 120, xpBonus: 30, hull: "#facc15", deck: "#fef9c3", desc: "+350% daromad, +60s vaqt, eng boy dengizlar hukmdori" },
];

// Profil darajasi — har bir harakat har xil miqdorda qo'shadi
// Foydalanuvchi talabi: masalan qarmoqni 2 lvl qilinsa profil 1.5 lvl bo'lsin, har safar har xil bo'lsin
export const XP = {
  rodUpgrade: 0.5, // 1-lvl dan 2-lvl ga o'tganda profil 1.0 + 0.5 = 1.5 lvl
  // Har bir baliq ovlanganda narxi, noyobligi va chuqurligiga qarab har safar har xil XP:
  catch: (price: number, rarity: number = 0) => {
    const base = 0.015 + Math.sqrt(price) * 0.005 + rarity * 0.025;
    // Kichik tasodifiy farq (har safar turli bo'lishi uchun)
    const variance = (Math.sin(price * 17.3) * 0.005);
    return Math.max(0.01, base + variance);
  },
  roundEnd: (earned: number) => Math.pow(Math.max(0, earned), 0.38) * 0.08,
  newSpecies: 0.35, // Yangi baliq turi ochilganda
  comboBonus: (combo: number) => (combo >= 4 ? Math.min(0.5, combo * 0.03) : 0),
};

export function profileLevel(xp: number): number {
  return 1 + xp;
}
