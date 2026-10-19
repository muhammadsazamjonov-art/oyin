// 330 baliq turi — protsedural generatsiya (deterministik)

export interface Species {
  id: number;
  name: string;
  price: number;
  rarity: number; // 0..10
  depthMin: number; // metr
  depthMax: number;
  size: number; // px radius
  speed: number;
  hue: number;
  sat: number;
  light: number;
  striped: boolean;
  glow: boolean;
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASES = [
  "Laqqa", "Zog'ora", "Sazan", "Cho'rtan", "Oqcha", "Sudak", "Tovon baliq",
  "Gulmohi", "Xon baliq", "Ilonbosh", "Marinka", "Moy baliq", "Qilquyruq",
  "Osman", "Do'ngpeshona", "Oq amur", "Tobon", "Olabug'a", "Tikanli", "Taran",
  "Qizilko'z", "Bakra", "Cho'rtansifat", "Mo'ylovdor", "Kambala", "Skat",
  "Murena", "Barrakuda", "Tunets", "Akula",
];

const MODS: { name: string; mult: number; weight: number }[] = [
  { name: "Oddiy", mult: 1, weight: 100 },
  { name: "Daryo", mult: 1.6, weight: 70 },
  { name: "Ko'l", mult: 2.4, weight: 50 },
  { name: "Qum", mult: 3.6, weight: 36 },
  { name: "Tosh", mult: 5.4, weight: 25 },
  { name: "Kumush", mult: 8.5, weight: 16 },
  { name: "Oltin", mult: 14, weight: 10 },
  { name: "Marvarid", mult: 24, weight: 6 },
  { name: "Yoqut", mult: 42, weight: 3.4 },
  { name: "Qirol", mult: 75, weight: 1.8 },
  { name: "Afsonaviy", mult: 140, weight: 0.8 },
];

export const RARITY_NAMES = [
  "Oddiy", "Daryo", "Ko'l", "Qum", "Tosh", "Kumush",
  "Oltin", "Marvarid", "Yoqut", "Qirol", "Afsonaviy",
];

export const RARITY_COLORS = [
  "#94a3b8", "#60a5fa", "#34d399", "#fbbf24", "#a8a29e", "#e2e8f0",
  "#fde047", "#f0abfc", "#f87171", "#c084fc", "#fb923c",
];

export const MAX_DEPTH_M = 306;

export const SPECIES: Species[] = (() => {
  const rnd = mulberry32(987654321);
  const list: Species[] = [];
  let id = 0;
  for (let b = 0; b < BASES.length; b++) {
    for (let m = 0; m < MODS.length; m++) {
      // chuqurlik: baza + modifikator bo'yicha taqsimlanadi (interleaved)
      const slot = (b * 11 + m * 3.17 + rnd() * 6) % 330;
      const center = 3 + (slot / 330) * (MAX_DEPTH_M - 10);
      const band = 10 + rnd() * 18 + m * 1.5;
      const depthMin = Math.max(0, center - band);
      const depthMax = Math.min(MAX_DEPTH_M, center + band);
      const basePrice = 4 + rnd() * 22;
      const depthFactor = 1 + Math.pow(center / 40, 1.35);
      const price = Math.max(3, Math.round(basePrice * MODS[m].mult * depthFactor));
      const size = 7 + rnd() * 9 + m * 0.9 + (b >= 25 ? 6 : 0);
      list.push({
        id: id++,
        name: `${MODS[m].name} ${BASES[b].toLowerCase()}`,
        price,
        rarity: m,
        depthMin,
        depthMax,
        size,
        speed: 26 + rnd() * 55 + m * 4,
        hue: m >= 6 ? [48, 290, 0, 275, 25][m - 6] ?? 48 : Math.floor(rnd() * 360),
        sat: m >= 6 ? 85 : 45 + rnd() * 45,
        light: 45 + rnd() * 20,
        striped: rnd() < 0.4,
        glow: m >= 7,
      });
    }
  }
  return list;
})();

export function spawnWeight(s: Species, luck: number): number {
  // luck (0..1) noyob baliqlar chiqishini oshiradi
  const w = MODS[s.rarity].weight;
  return w + luck * (100 - w) * 0.25;
}

export function speciesAtDepth(depthM: number): Species[] {
  return SPECIES.filter((s) => depthM >= s.depthMin && depthM <= s.depthMax);
}

export function formatMoney(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "mlrd";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "mln";
  if (n >= 1e4) return (n / 1e3).toFixed(1) + "k";
  return Math.floor(n).toLocaleString("en-US");
}
