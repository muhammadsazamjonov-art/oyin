// Qarmoq (300 lvl), qayiqlar (5 ta yangilash) va profil darajasi

export const ROD_MAX = 300;

export interface RodStats {
  level: number;
  tier: number;
  tierName: string;
  color: string;
  lineColor: string;
  maxDepth: number; // metr
  speed: number; // px/s
  radius: number; // tutish radiusi px
  luck: number; // 0..1
  comboTime: number; // s
}

export const ROD_TIERS = [
  { name: "Yog'och", color: "#a16207", line: "#d6c7a1" },
  { name: "Bambuk", color: "#65a30d", line: "#d9f99d" },
  { name: "Po'lat", color: "#64748b", line: "#cbd5e1" },
  { name: "Kumush", color: "#cbd5e1", line: "#f1f5f9" },
  { name: "Oltin", color: "#facc15", line: "#fef08a" },
  { name: "Platina", color: "#a5f3fc", line: "#e0f2fe" },
  { name: "Olmos", color: "#67e8f9", line: "#a5f3fc" },
  { name: "Plazma", color: "#c084fc", line: "#e9d5ff" },
  { name: "Kosmik", color: "#818cf8", line: "#c7d2fe" },
  { name: "Afsonaviy", color: "#fb923c", line: "#fed7aa" },
];

export function rodStats(level: number): RodStats {
  const lvl = Math.min(ROD_MAX, Math.max(1, level));
  const tier = Math.min(9, Math.floor((lvl - 1) / 30));
  const t = ROD_TIERS[tier];
  return {
    level: lvl,
    tier,
    tierName: t.name,
    color: t.color,
    lineColor: t.line,
    maxDepth: Math.min(306, 14 + lvl * 1.0),
    speed: 230 + lvl * 1.5,
    radius: 19 + lvl * 0.22,
    luck: Math.min(1, lvl / 300),
    comboTime: 2 + lvl * 0.005,
  };
}

export function rodUpgradeCost(currentLevel: number): number {
  return Math.floor(18 * Math.pow(currentLevel + 1, 1.62));
}

export interface Boat {
  idx: number;
  name: string;
  reqProfile: number; // kerakli profil darajasi
  cost: number;
  incomeMult: number;
  roundTime: number; // s
  xpBonus: number; // sotib olganda profil +lvl
  hull: string;
  deck: string;
  desc: string;
}

export const BOATS: Boat[] = [
  { idx: 0, name: "Eski sol", reqProfile: 0, cost: 0, incomeMult: 1, roundTime: 60, xpBonus: 0, hull: "#8b5e34", deck: "#c0813f", desc: "Boshlang'ich yog'och sol" },
  { idx: 1, name: "Yelkanli qayiq", reqProfile: 50, cost: 6000, incomeMult: 1.3, roundTime: 70, xpBonus: 8, hull: "#b45309", deck: "#f3e8d2", desc: "+30% daromad, +10s vaqt" },
  { idx: 2, name: "Motorli kater", reqProfile: 100, cost: 32000, incomeMult: 1.7, roundTime: 80, xpBonus: 12, hull: "#dc2626", deck: "#fecaca", desc: "+70% daromad, +20s vaqt" },
  { idx: 3, name: "Baliqchi kemasi", reqProfile: 150, cost: 120000, incomeMult: 2.2, roundTime: 90, xpBonus: 16, hull: "#1d4ed8", deck: "#bfdbfe", desc: "+120% daromad, +30s vaqt" },
  { idx: 4, name: "Oq yaxta", reqProfile: 200, cost: 420000, incomeMult: 3, roundTime: 100, xpBonus: 22, hull: "#e2e8f0", deck: "#f8fafc", desc: "+200% daromad, +40s vaqt" },
  { idx: 5, name: "Afsonaviy kema", reqProfile: 300, cost: 1500000, incomeMult: 4.5, roundTime: 120, xpBonus: 30, hull: "#facc15", deck: "#fef9c3", desc: "+350% daromad, +60s vaqt" },
];

// Profil darajasi — har bir harakat har xil miqdorda qo'shadi
export const XP = {
  rodUpgrade: 0.5, // qarmoq 2-lvl bo'lsa profil 1.5 bo'ladi
  catch: (price: number) => 0.01 + Math.sqrt(price) * 0.006,
  roundEnd: (earned: number) => Math.pow(Math.max(0, earned), 0.38) * 0.08,
  newSpecies: 0.25,
};

export function profileLevel(xp: number): number {
  return 1 + xp;
}
