import { SPECIES, Species, spawnWeight, formatMoney, MAX_DEPTH_M, RARITY_COLORS } from "./species";
import { RodStats, Boat, XP, profileLevel } from "./progression";
import { sfx } from "./sound";

export interface RoundResult {
  earned: number;
  caughtCount: number;
  bestFish: { name: string; price: number; rarity: number } | null;
  maxCombo: number;
  newSpecies: string[];
  totalXpGained: number;
}

interface EngineOpts {
  rod: RodStats;
  boat: Boat;
  discovered: Set<number>;
  currentProfileXP: number;
  onEnd: (r: RoundResult) => void;
  onCatch: (speciesId: number, value: number, isNew: boolean, xpGained: number) => void;
  onPauseToggle: () => void;
}

interface ActiveFish {
  sp: Species;
  x: number;
  y: number;
  baseY: number;
  dir: number;
  spd: number;
  phase: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  sparkle?: boolean;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  life: number;
  max: number;
  color: string;
  size: number;
}

const PX_PER_M = 14;

// chuqurlik bo'yicha turlar bucketlari (har 4 metr)
const BUCKETS: number[][] = (() => {
  const b: number[][] = [];
  for (let d = 0; d < MAX_DEPTH_M; d += 4) {
    const ids: number[] = [];
    for (const s of SPECIES) {
      if (d + 2 >= s.depthMin && d + 2 <= s.depthMax) ids.push(s.id);
    }
    b.push(ids);
  }
  return b;
})();

export class Engine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private opts: EngineOpts;
  private raf = 0;
  private last = 0;
  private W = 0;
  private H = 0;
  private dpr = 1;
  paused = false;
  private destroyed = false;

  private t = 0;
  private timeLeft: number;
  private maxDepthPx: number;

  private hook = { x: 0, y: 40, vx: 0, vy: 60 };
  private camY = 0;
  private shake = 0;
  private flash = 0;

  private isBoosting = false;
  private boostCooldown = 0;

  private fish: ActiveFish[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private bubbleT = 0;
  private sparkleT = 0;

  private keys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;

  private earned = 0;
  private caughtCount = 0;
  private combo = 0;
  private comboTimer = 0;
  private maxCombo = 0;
  private bestFish: RoundResult["bestFish"] = null;
  private newSpecies: string[] = [];
  private totalXpGained = 0;
  private currentXP: number;
  private lastProfileInt: number;
  private lastTick = -1;

  // Dekoratsiyalar
  private plants: { x: number; d: number; h: number; hue: number }[] = [];
  private clouds: { x: number; y: number; s: number }[] = [];

  constructor(canvas: HTMLCanvasElement, opts: EngineOpts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.opts = opts;
    this.timeLeft = opts.boat.roundTime;
    this.maxDepthPx = opts.rod.maxDepth * PX_PER_M;
    this.currentXP = opts.currentProfileXP;
    this.lastProfileInt = Math.floor(profileLevel(this.currentXP));

    this.resize();
    this.hook.x = this.W / 2;

    for (let i = 0; i < 45; i++) {
      this.plants.push({
        x: Math.random(),
        d: Math.random(),
        h: 25 + Math.random() * 55,
        hue: 105 + Math.random() * 55,
      });
    }
    for (let i = 0; i < 7; i++) {
      this.clouds.push({
        x: Math.random(),
        y: 20 + Math.random() * 85,
        s: 0.6 + Math.random() * 0.7,
      });
    }

    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);

    // Initial school of fish
    for (let i = 0; i < 28; i++) this.spawnFish(true);
    sfx.splash();

    // Initial splash particles at boat
    this.spawnSplash(this.W / 2, 0);

    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.last = performance.now();
  }

  setBoosting(b: boolean) {
    if (b && !this.isBoosting) sfx.whoosh();
    this.isBoosting = b;
  }

  endNow() {
    if (this.destroyed) return;
    this.opts.onEnd({
      earned: this.earned,
      caughtCount: this.caughtCount,
      bestFish: this.bestFish,
      maxCombo: this.maxCombo,
      newSpecies: this.newSpecies,
      totalXpGained: this.totalXpGained,
    });
    this.destroy();
  }

  private resize = () => {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.W = this.canvas.clientWidth;
    this.H = this.canvas.clientHeight;
    this.canvas.width = Math.floor(this.W * this.dpr);
    this.canvas.height = Math.floor(this.H * this.dpr);
  };

  private onKeyDown = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (
      ["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(e.key.toLowerCase()) ||
      ["w", "a", "s", "d", "shift"].includes(k)
    ) {
      e.preventDefault();
    }
    if (k === "p" || k === "escape") {
      this.opts.onPauseToggle();
      return;
    }
    if (k === " " || k === "shift") {
      if (!this.isBoosting) sfx.whoosh();
      this.isBoosting = true;
    }
    this.keys.add(k);
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    this.keys.delete(k);
    if (k === " " || k === "shift") {
      this.isBoosting = false;
    }
  };

  private ptFromEvent(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onPointerDown = (e: PointerEvent) => {
    this.pointer = this.ptFromEvent(e);
  };

  private onPointerMove = (e: PointerEvent) => {
    if (this.pointer) this.pointer = this.ptFromEvent(e);
  };

  private onPointerUp = () => {
    this.pointer = null;
  };

  private spawnSplash(x: number, y: number) {
    for (let i = 0; i < 20; i++) {
      const a = Math.PI + (Math.random() - 0.5) * Math.PI * 0.8;
      const spd = 40 + Math.random() * 140;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * spd,
        vy: Math.sin(a) * spd,
        life: 0.4 + Math.random() * 0.5,
        max: 0.9,
        size: 2 + Math.random() * 3,
        color: "rgba(224, 242, 254, 0.85)",
        grav: 160,
      });
    }
  }

  // ---------- Baliq spawn ----------
  private spawnFish(anywhere = false) {
    const viewTop = Math.max(20, this.camY - 120);
    const viewBot = Math.min(this.maxDepthPx - 14, this.camY + this.H + 120);
    if (viewBot <= viewTop) return;
    const y = viewTop + Math.random() * (viewBot - viewTop);
    const depthM = y / PX_PER_M;
    const bucketIdx = Math.min(BUCKETS.length - 1, Math.max(0, Math.floor(depthM / 4)));
    const bucket = BUCKETS[bucketIdx];
    if (!bucket || bucket.length === 0) return;

    const luck = this.opts.rod.luck;
    let total = 0;
    const weights: number[] = [];
    for (const id of bucket) {
      const w = spawnWeight(SPECIES[id], luck);
      weights.push(w);
      total += w;
    }
    let r = Math.random() * total;
    let sp = SPECIES[bucket[0]];
    for (let i = 0; i < bucket.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        sp = SPECIES[bucket[i]];
        break;
      }
    }

    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = anywhere
      ? Math.random() * this.W
      : dir === 1
        ? -40 - Math.random() * 80
        : this.W + 40 + Math.random() * 80;

    this.fish.push({
      sp,
      x,
      y,
      baseY: y,
      dir,
      spd: sp.speed * (0.75 + Math.random() * 0.5),
      phase: Math.random() * Math.PI * 2,
    });
  }

  // ---------- Baliq tutish (Catch) ----------
  private catchFish(f: ActiveFish, idx: number) {
    this.fish.splice(idx, 1);
    const isNew = !this.opts.discovered.has(f.sp.id);
    if (isNew) {
      this.opts.discovered.add(f.sp.id);
      this.newSpecies.push(f.sp.name);
    }

    this.combo++;
    this.comboTimer = this.opts.rod.comboTime;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const mult = 1 + Math.min(20, this.combo - 1) * 0.1;
    const value = Math.round(f.sp.price * mult * this.opts.boat.incomeMult);
    this.earned += value;
    this.caughtCount++;

    if (!this.bestFish || f.sp.price > this.bestFish.price) {
      this.bestFish = { name: f.sp.name, price: f.sp.price, rarity: f.sp.rarity };
    }

    // Dynamic XP hisoblash: har xil harakat har safar har xil XP beradi
    const xpGained = XP.catch(f.sp.price, f.sp.rarity) + (isNew ? XP.newSpecies : 0) + XP.comboBonus(this.combo);
    this.totalXpGained += xpGained;
    this.currentXP += xpGained;

    // Profil yangi butun songa yetdimi? (Masalan 1.5 -> 2.0 -> 3.0)
    const newProfileInt = Math.floor(profileLevel(this.currentXP));
    if (newProfileInt > this.lastProfileInt) {
      this.lastProfileInt = newProfileInt;
      sfx.levelUp();
      this.floaters.push({
        x: this.hook.x,
        y: this.hook.y - 50,
        text: `⭐ PROFIL OSHDI: ${newProfileInt} LVL! ⭐`,
        life: 1.6,
        max: 1.6,
        color: "#facc15",
        size: 16,
      });
    }

    // Screen shake va Juicy visual feedback
    this.shake = Math.min(24, 4 + Math.log2(1 + f.sp.price) * 1.2 + (f.sp.rarity >= 6 ? 6 : 0));
    if (f.sp.rarity >= 7) this.flash = 0.4;

    const col = `hsl(${f.sp.hue} ${f.sp.sat}% ${f.sp.light + 10}%)`;
    const particleCount = 18 + f.sp.rarity * 4;
    for (let i = 0; i < particleCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp2 = 45 + Math.random() * 180;
      this.particles.push({
        x: f.x,
        y: f.y,
        vx: Math.cos(a) * sp2,
        vy: Math.sin(a) * sp2 - 50,
        life: 0.5 + Math.random() * 0.6,
        max: 1.1,
        size: 2.5 + Math.random() * 4,
        color: i % 3 === 0 ? "#fde047" : i % 2 === 0 ? col : "#ffffff",
        grav: 120,
        sparkle: f.sp.rarity >= 6,
      });
    }

    // Floating text: tanga miqdori
    this.floaters.push({
      x: f.x,
      y: f.y - 14,
      text: `+🪙${formatMoney(value)}`,
      life: 1.2,
      max: 1.2,
      color: f.sp.rarity >= 6 ? "#fde047" : "#ffffff",
      size: 16 + Math.min(14, f.sp.rarity * 2),
    });

    // Floating text: baliq nomi va uning darajasi
    this.floaters.push({
      x: f.x,
      y: f.y + 10,
      text: `${f.sp.name} (+${xpGained.toFixed(2)} xp)`,
      life: 0.95,
      max: 0.95,
      color: RARITY_COLORS[f.sp.rarity] || "#bae6fd",
      size: 11,
    });

    if (isNew) {
      this.floaters.push({
        x: f.x,
        y: f.y - 32,
        text: "✨ YANGI TUR! ✨",
        life: 1.3,
        max: 1.3,
        color: "#38bdf8",
        size: 13,
      });
    }

    if (this.combo >= 2) {
      this.floaters.push({
        x: this.hook.x,
        y: this.hook.y - 36,
        text: `x${mult.toFixed(1)} KOMBO!`,
        life: 0.8,
        max: 0.8,
        color: "#fb923c",
        size: 14,
      });
      sfx.combo(this.combo);
    }

    sfx.catch(f.sp.rarity);
    if (navigator.vibrate && f.sp.rarity >= 4) {
      try {
        navigator.vibrate(f.sp.rarity >= 7 ? 70 : 25);
      } catch {
        /* */
      }
    }

    this.opts.onCatch(f.sp.id, value, isNew, xpGained);
  }

  // ---------- Game Loop ----------
  private loop = (now: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.033, (now - this.last) / 1000);
    this.last = now;

    if (!this.paused) {
      this.update(dt);
    }
    this.render();
    this.raf = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    this.t += dt;
    this.timeLeft -= dt;
    const tl = Math.ceil(this.timeLeft);
    if (tl <= 5 && tl >= 1 && tl !== this.lastTick) {
      this.lastTick = tl;
      sfx.tick();
    }
    if (this.timeLeft <= 0) {
      sfx.over();
      this.opts.onEnd({
        earned: this.earned,
        caughtCount: this.caughtCount,
        bestFish: this.bestFish,
        maxCombo: this.maxCombo,
        newSpecies: this.newSpecies,
        totalXpGained: this.totalXpGained,
      });
      this.destroy();
      return;
    }

    // --- Harakat boshqaruvi ---
    const st = this.opts.rod;
    let ax = 0;
    let ay = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) ax -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) ax += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) ay -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) ay += 1;

    if (this.pointer) {
      const wx = this.pointer.x;
      const wy = this.pointer.y + this.camY;
      const dx = wx - this.hook.x;
      const dy = wy - this.hook.y;
      const d = Math.hypot(dx, dy);
      if (d > 6) {
        ax = dx / d;
        ay = dy / d;
      }
    } else if (ax || ay) {
      const d = Math.hypot(ax, ay);
      ax /= d;
      ay /= d;
    }

    // Tezlanish va Turbo Boost
    const boostMult = this.isBoosting ? 1.6 : 1.0;
    const accel = st.speed * 6.0 * boostMult;
    this.hook.vx += ax * accel * dt;
    this.hook.vy += ay * accel * dt;

    // Suv qarshiligi (Drag)
    const drag = Math.pow(0.0035, dt);
    this.hook.vx *= drag;
    this.hook.vy *= drag;

    const vmax = st.speed * boostMult;
    const v = Math.hypot(this.hook.vx, this.hook.vy);
    if (v > vmax) {
      this.hook.vx = (this.hook.vx / v) * vmax;
      this.hook.vy = (this.hook.vy / v) * vmax;
    }

    this.hook.x += this.hook.vx * dt;
    this.hook.y += this.hook.vy * dt;

    // Chegaralar
    if (this.hook.x < 14) {
      this.hook.x = 14;
      this.hook.vx = Math.abs(this.hook.vx) * 0.4;
    }
    if (this.hook.x > this.W - 14) {
      this.hook.x = this.W - 14;
      this.hook.vx = -Math.abs(this.hook.vx) * 0.4;
    }
    if (this.hook.y < 26) {
      this.hook.y = 26;
      this.hook.vy = Math.abs(this.hook.vy) * 0.3;
    }
    const maxY = this.maxDepthPx - 10;
    if (this.hook.y > maxY) {
      this.hook.y = maxY;
      if (this.hook.vy > 60) {
        this.floaters.push({
          x: this.hook.x,
          y: this.hook.y - 20,
          text: "Qarmoq chegarasi! Yangilang ⬆",
          life: 0.9,
          max: 0.9,
          color: "#fca5a5",
          size: 12,
        });
      }
      this.hook.vy = Math.min(0, this.hook.vy);
    }

    // Kamera silliq ergashishi
    const targetCam = this.hook.y - this.H * 0.42;
    const camMin = -this.H * 0.34;
    const camMax = Math.max(camMin, this.maxDepthPx + 60 - this.H);
    const tc = Math.max(camMin, Math.min(camMax, targetCam));
    this.camY += (tc - this.camY) * Math.min(1, dt * 6.5);

    // Pufakchalar va zarrachalar izi
    this.bubbleT -= dt;
    if (this.bubbleT <= 0 && (v > 50 || this.isBoosting)) {
      this.bubbleT = this.isBoosting ? 0.025 : 0.05;
      this.particles.push({
        x: this.hook.x + (Math.random() - 0.5) * 8,
        y: this.hook.y + 6,
        vx: (Math.random() - 0.5) * 20 - this.hook.vx * 0.15,
        vy: -30 - Math.random() * 40 - this.hook.vy * 0.15,
        life: 0.7 + Math.random() * 0.6,
        max: 1.3,
        size: (this.isBoosting ? 2.5 : 1.5) + Math.random() * 2.5,
        color: this.isBoosting ? "rgba(125, 211, 252, 0.75)" : "rgba(255, 255, 255, 0.55)",
        grav: -30,
      });
    }

    // Qarmoqning yuqori darajalarida (Oltin, Olmos, Plazma, Kosmik, Afsonaviy) nur porlashi
    if (st.tier >= 4) {
      this.sparkleT -= dt;
      if (this.sparkleT <= 0) {
        this.sparkleT = 0.08 - st.tier * 0.005;
        this.particles.push({
          x: this.hook.x + (Math.random() - 0.5) * 16,
          y: this.hook.y + (Math.random() - 0.5) * 16,
          vx: (Math.random() - 0.5) * 30,
          vy: (Math.random() - 0.5) * 30,
          life: 0.4 + Math.random() * 0.4,
          max: 0.8,
          size: 1.5 + Math.random() * 2.5,
          color: st.glowColor,
          grav: 0,
          sparkle: true,
        });
      }
    }

    // --- Baliqlar yangilanishi ---
    const margin = 160;
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      f.x += f.dir * f.spd * dt;
      f.phase += dt * 3.2;
      f.y = f.baseY + Math.sin(f.phase) * 7.5;

      // Qochish mexanikasi: noyob baliqlar qarmoqdan ozgina qochadi
      if (f.sp.rarity >= 5) {
        const dx = f.x - this.hook.x;
        const dy = f.y - this.hook.y;
        const d = Math.hypot(dx, dy);
        if (d < 110 && d > 1) {
          f.baseY += (dy / d) * 28 * dt;
          f.x += (dx / d) * 32 * dt;
        }
      }

      // Ekranni tark etsa o'chirish
      if (
        (f.dir === 1 && f.x > this.W + margin) ||
        (f.dir === -1 && f.x < -margin) ||
        f.y < this.camY - 320 ||
        f.y > this.camY + this.H + 320
      ) {
        this.fish.splice(i, 1);
        continue;
      }

      // Tutish tekshiruvi (Radius bo'yicha)
      const dx = f.x - this.hook.x;
      const dy = f.y - this.hook.y;
      const rr = st.radius + f.sp.size;
      if (dx * dx + dy * dy < rr * rr) {
        this.catchFish(f, i);
      }
    }

    // Doimiy yetarlicha baliq bo'lishini ta'minlash
    const want = 28 + Math.min(16, Math.floor(st.level / 20));
    while (this.fish.length < want) {
      this.spawnFish(this.fish.length < 8);
    }

    // Kombo taymeri
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // Zarralar yangilanishi
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (this.particles.length > 400) this.particles.splice(0, this.particles.length - 400);

    // Suzuvchi matnlar
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const fl = this.floaters[i];
      fl.life -= dt;
      fl.y -= 38 * dt;
      if (fl.life <= 0) this.floaters.splice(i, 1);
    }

    this.shake = Math.max(0, this.shake - dt * 32);
    this.flash = Math.max(0, this.flash - dt * 1.5);
  }

  // ---------- Render ----------
  private render() {
    const { ctx, W, H } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    const shx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    ctx.save();
    ctx.translate(shx, shy);

    const cam = this.camY;
    const surfScreen = -cam; // Suv sathining ekrandagi o'rni

    // --- Osmon (Sky) ---
    if (surfScreen > -40) {
      const sky = ctx.createLinearGradient(0, surfScreen - H * 0.55, 0, surfScreen);
      sky.addColorStop(0, "#38bdf8");
      sky.addColorStop(0.7, "#bae6fd");
      sky.addColorStop(1, "#fef08a");
      ctx.fillStyle = sky;
      ctx.fillRect(-20, -20, W + 40, Math.max(0, surfScreen) + 20);

      // Quyosh
      ctx.fillStyle = "rgba(253, 224, 71, 0.92)";
      ctx.beginPath();
      ctx.arc(W * 0.82, surfScreen - H * 0.28, 28, 0, Math.PI * 2);
      ctx.fill();

      // Bulutlar
      ctx.fillStyle = "rgba(255, 255, 255, 0.88)";
      for (const c of this.clouds) {
        const cx = (((c.x + this.t * 0.007 * c.s) % 1.2) - 0.1) * W;
        const cy = surfScreen - c.y - 35;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 36 * c.s, 13 * c.s, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 24 * c.s, cy + 4, 25 * c.s, 11 * c.s, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - 24 * c.s, cy + 5, 22 * c.s, 10 * c.s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- Suv (Water depth gradient) ---
    const depthM = Math.max(0, cam + H / 2) / PX_PER_M;
    const darkness = Math.min(0.85, depthM / 310);
    const wTop = Math.max(0, surfScreen);

    const water = ctx.createLinearGradient(0, wTop, 0, H);
    water.addColorStop(0, `hsl(199 ${85 - darkness * 35}% ${45 - darkness * 35}%)`);
    water.addColorStop(1, `hsl(220 ${80 - darkness * 25}% ${22 - darkness * 18}%)`);
    ctx.fillStyle = water;
    ctx.fillRect(-20, wTop, W + 40, H - wTop + 20);

    // Quyosh nurlari (suv osti kaustikasi)
    if (cam < 450) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.18 - cam / 2800);
      ctx.fillStyle = "#e0f2fe";
      for (let i = 0; i < 5; i++) {
        const bx = W * (0.12 + i * 0.2) + Math.sin(this.t * 0.45 + i * 1.8) * 32;
        ctx.beginPath();
        ctx.moveTo(bx - 14, surfScreen);
        ctx.lineTo(bx + 14, surfScreen);
        ctx.lineTo(bx + 110, surfScreen + 500);
        ctx.lineTo(bx - 110, surfScreen + 500);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // Chuqurlik metrlari (depth markers har 20 metrda)
    ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "left";
    const m0 = Math.max(0, Math.floor(cam / PX_PER_M / 20) * 20);
    for (let m = m0; m <= m0 + Math.ceil(H / PX_PER_M / 20) * 20 + 20; m += 20) {
      if (m === 0) continue;
      const sy = m * PX_PER_M - cam;
      if (sy < 0 || sy > H) continue;
      ctx.fillRect(0, sy, 28, 1.5);
      ctx.fillText(`${m}m`, 34, sy + 4);
    }

    // Dengiz tubi (Seabed & Seaweed)
    const floorY = this.maxDepthPx - cam;
    if (floorY < H + 90) {
      ctx.fillStyle = "hsl(35 32% 22%)";
      ctx.beginPath();
      ctx.moveTo(-20, floorY + 18);
      for (let x = -20; x <= W + 20; x += 30) {
        ctx.lineTo(x, floorY + 18 + Math.sin(x * 0.05) * 6);
      }
      ctx.lineTo(W + 20, H + 40);
      ctx.lineTo(-20, H + 40);
      ctx.closePath();
      ctx.fill();

      // O'simliklar
      for (const pl of this.plants) {
        const px = pl.x * W;
        const ph = pl.h;
        const sway = Math.sin(this.t * 1.5 + pl.x * 12) * 8;
        ctx.strokeStyle = `hsl(${pl.hue} 55% ${28 + pl.d * 15}%)`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(px, floorY + 18);
        ctx.quadraticCurveTo(px + sway * 0.5, floorY + 18 - ph * 0.6, px + sway, floorY + 18 - ph);
        ctx.stroke();
      }
    }

    // --- Baliqlar ---
    for (const f of this.fish) {
      const sy = f.y - cam;
      if (sy < -60 || sy > H + 60) continue;
      this.drawFish(f, sy);
    }

    // --- Qarmoq ipi va Ilgak ---
    const st = this.opts.rod;
    const boatX = W / 2;
    const boatY = surfScreen - 6;
    const hx = this.hook.x;
    const hy = this.hook.y - cam;

    // Qarmoq ipi
    ctx.strokeStyle = st.lineColor;
    ctx.lineWidth = 1.6 + st.tier * 0.2;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(boatX + 38, Math.min(boatY - 26, hy - 40));
    const midX = (boatX + 38 + hx) / 2 + this.hook.vx * -0.05;
    ctx.quadraticCurveTo(midX, (boatY + hy) / 2, hx, hy - 8);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Tutish radiusi aylanasi
    ctx.strokeStyle = st.glowColor;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.25 + Math.sin(this.t * 5) * 0.08;
    ctx.beginPath();
    ctx.arc(hx, hy, st.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Ilgak
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(this.hook.vx * 0.0012);

    if (st.tier >= 4) {
      ctx.shadowColor = st.glowColor;
      ctx.shadowBlur = 8 + st.tier * 2;
    }

    // Ilgak metall korpusi
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 3.6;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 4);
    ctx.arc(-5, 4, 5, 0, Math.PI, false);
    ctx.stroke();

    // Ilgak boshidagi po'kak/jalob
    ctx.fillStyle = st.tier >= 6 ? st.glowColor : "#f87171";
    ctx.beginPath();
    ctx.arc(0, -12, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Maxsus tier effektlari
    if (st.tier >= 8) {
      // Kosmik/Afsonaviy energiya halqasi
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 10 + Math.sin(this.t * 8) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();

    // --- Qayiq ---
    if (surfScreen > -90 && surfScreen < H + 90) {
      this.drawBoat(boatX, surfScreen);

      // Suv sathi to'lqinlari
      ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 8) {
        const y = surfScreen + Math.sin(x * 0.035 + this.t * 2.4) * 3.5;
        if (x === -10) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // --- Zarralar ---
    for (const p of this.particles) {
      const sy = p.y - cam;
      if (sy < -20 || sy > H + 20) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, sy, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // --- Suzuvchi matnlar (Floating Numbers) ---
    ctx.textAlign = "center";
    for (const fl of this.floaters) {
      const a = Math.max(0, fl.life / fl.max);
      const pop = fl.life > fl.max - 0.12 ? 1 + (fl.max - fl.life) * 4 : 1.2 - 0.2 * a + 0.2;
      ctx.globalAlpha = a;
      ctx.font = `800 ${Math.round(fl.size * Math.min(1.4, pop))}px system-ui, sans-serif`;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
      ctx.lineWidth = 3.5;
      ctx.strokeText(fl.text, fl.x, fl.y - cam);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y - cam);
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // Screen shake tugashi

    // Noyob baliq flash effekti
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(253, 224, 71, ${this.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    // HUD (Boshqaruv paneli)
    this.drawHUD();
  }

  private drawFish(f: ActiveFish, sy: number) {
    const { ctx } = this;
    const s = f.sp;
    const r = s.size;

    ctx.save();
    ctx.translate(f.x, sy);
    ctx.scale(f.dir, 1);

    const wig = Math.sin(f.phase * 2.5) * 0.12;
    ctx.rotate(wig);

    if (s.glow) {
      ctx.shadowColor = `hsl(${s.hue} 95% 65%)`;
      ctx.shadowBlur = 15;
    }

    const body = `hsl(${s.hue} ${s.sat}% ${s.light}%)`;
    const belly = `hsl(${s.hue} ${s.sat * 0.5}% ${Math.min(88, s.light + 24)}%)`;

    // Dum
    ctx.fillStyle = body;
    const tw = Math.sin(f.phase * 3.2) * r * 0.28;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, 0);
    ctx.lineTo(-r * 1.55, -r * 0.55 + tw);
    ctx.lineTo(-r * 1.55, r * 0.55 + tw);
    ctx.closePath();
    ctx.fill();

    // Tana
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();

    // Qorin
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(r * 0.08, r * 0.16, r * 0.8, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chiziqlar (Stripes)
    if (s.striped) {
      ctx.strokeStyle = `hsl(${s.hue} ${s.sat}% ${Math.max(16, s.light - 22)}%)`;
      ctx.lineWidth = r * 0.14;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * r * 0.32, -r * 0.5);
        ctx.quadraticCurveTo(i * r * 0.32 + r * 0.12, 0, i * r * 0.32, r * 0.5);
        ctx.stroke();
      }
    }

    // Suzgich
    ctx.fillStyle = `hsl(${s.hue} ${s.sat}% ${Math.max(20, s.light - 14)}%)`;
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.5);
    ctx.lineTo(r * 0.25, -r * 0.95);
    ctx.lineTo(r * 0.4, -r * 0.45);
    ctx.closePath();
    ctx.fill();

    // Ko'z
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(r * 0.55, -r * 0.12, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(r * 0.6, -r * 0.12, r * 0.09, 0, Math.PI * 2);
    ctx.fill();

    // Noyob yulduzcha belgisi
    if (s.rarity >= 6) {
      ctx.fillStyle = RARITY_COLORS[s.rarity] || "#facc15";
      ctx.font = `${Math.round(r * 0.7)}px sans-serif`;
      ctx.fillText("★", -r * 0.3, -r * 0.65);
    }

    ctx.restore();
  }

  private drawBoat(x: number, surfY: number) {
    const { ctx } = this;
    const b = this.opts.boat;
    const bob = Math.sin(this.t * 1.6) * 3;
    const tilt = Math.sin(this.t * 1.1) * 0.03;
    const sc = 1 + b.idx * 0.11;

    ctx.save();
    ctx.translate(x, surfY + bob - 4);
    ctx.rotate(tilt);
    ctx.scale(sc, sc);

    // Korpus
    ctx.fillStyle = b.hull;
    ctx.beginPath();
    ctx.moveTo(-56, -8);
    ctx.lineTo(56, -8);
    ctx.lineTo(42, 15);
    ctx.quadraticCurveTo(0, 21, -42, 15);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    ctx.fillRect(-56, -8, 112, 4);

    // Paluba
    ctx.fillStyle = b.deck;
    ctx.fillRect(-48, -12, 96, 5);

    // Qayiq 1 (Yelkanli)
    if (b.idx >= 1) {
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-6, -12);
      ctx.lineTo(-6, -58);
      ctx.stroke();

      if (b.idx === 1) {
        ctx.fillStyle = "#fef3c7";
        ctx.beginPath();
        ctx.moveTo(-4, -56);
        ctx.quadraticCurveTo(30, -42, -4, -16);
        ctx.closePath();
        ctx.fill();
      }
    }

    // Qayiq 2 (Motorli kater)
    if (b.idx >= 2) {
      ctx.fillStyle = b.idx === 5 ? "#fef08a" : "#f8fafc";
      ctx.fillRect(-32, -30, 36, 18);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-27, -26, 9, 7);
      ctx.fillRect(-14, -26, 9, 7);

      // Motor chiqindi trubasi
      ctx.fillStyle = "#475569";
      ctx.fillRect(-50, 2, 8, 10);
    }

    // Qayiq 3 (Baliqchi kemasi)
    if (b.idx >= 3) {
      ctx.fillStyle = b.hull;
      ctx.fillRect(-38, -40, 30, 10);
      ctx.fillStyle = "#334155";
      ctx.fillRect(-16, -48, 7, 18); // Katta mo'ri (truba)
      // Tutun zarralari
      if (Math.random() < 0.2) {
        this.particles.push({
          x: x - 14 * sc,
          y: surfY + bob - 50 * sc,
          vx: -20 - Math.random() * 20,
          vy: -15 - Math.random() * 15,
          life: 0.6,
          max: 0.6,
          size: 3,
          color: "rgba(203, 213, 225, 0.4)",
          grav: -10,
        });
      }
    }

    // Qayiq 4 (Oq yaxta)
    if (b.idx >= 4) {
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(8, -36, 30, 24);
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(12, -31, 8, 7);
      ctx.fillRect(24, -31, 8, 7);
    }

    // Qayiq 5 (Afsonaviy Flagman)
    if (b.idx === 5) {
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      // Oltin toj shaklidagi bezak
      ctx.moveTo(-20, -48);
      ctx.lineTo(-10, -56);
      ctx.lineTo(0, -48);
      ctx.lineTo(10, -56);
      ctx.lineTo(20, -48);
      ctx.closePath();
      ctx.fill();
    }

    // Bayroq
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(46, -8);
    ctx.lineTo(46, -34);
    ctx.stroke();

    ctx.fillStyle = b.idx === 5 ? "#facc15" : "#ef4444";
    ctx.beginPath();
    ctx.moveTo(46, -34);
    ctx.lineTo(62, -29);
    ctx.lineTo(46, -24);
    ctx.closePath();
    ctx.fill();

    // Baliqchi
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(28, -18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(24, -14, 8, 10);

    // Qo'ldagi qarmoq tayog'i
    ctx.strokeStyle = this.opts.rod.color;
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.moveTo(30, -12);
    ctx.lineTo(38 / sc + 8, -26);
    ctx.stroke();

    ctx.restore();
  }

  private drawHUD() {
    const { ctx, W } = this;
    const depthNow = Math.max(0, this.hook.y / PX_PER_M);

    // Vaqt paneli (Time left bar)
    const tw = Math.min(260, W * 0.45);
    const frac = Math.max(0, this.timeLeft / this.opts.boat.roundTime);
    ctx.fillStyle = "rgba(2, 20, 40, 0.65)";
    this.rr(W / 2 - tw / 2, 10, tw, 28, 14);
    ctx.fill();

    ctx.fillStyle = frac < 0.18 ? "#ef4444" : frac < 0.4 ? "#f59e0b" : "#38bdf8";
    this.rr(W / 2 - tw / 2 + 3, 13, (tw - 6) * frac, 22, 11);
    ctx.fill();

    ctx.fillStyle = "#ffffff";
    ctx.font = "800 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`⏱ ${Math.max(0, Math.ceil(this.timeLeft))}s`, W / 2, 29);

    // Tangalar (Coins earned)
    ctx.fillStyle = "rgba(2, 20, 40, 0.65)";
    this.rr(12, 10, 138, 32, 12);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#fde047";
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.fillText(`🪙 ${formatMoney(this.earned)}`, 22, 31);

    // Chuqurlik (Depth)
    const depthW = 142;
    ctx.fillStyle = "rgba(2, 20, 40, 0.65)";
    this.rr(W - depthW - 55, 10, depthW, 32, 12);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = "#bae6fd";
    ctx.fillText(`🌊 ${depthNow.toFixed(0)}/${this.opts.rod.maxDepth.toFixed(0)}m`, W - 65, 31);

    // Kombo nishoni
    if (this.combo >= 2 && this.comboTimer > 0) {
      const mult = 1 + Math.min(20, this.combo - 1) * 0.1;
      ctx.textAlign = "center";
      const pulse = 1 + Math.sin(this.t * 10) * 0.06;
      ctx.font = `900 ${Math.round(22 * pulse)}px system-ui, sans-serif`;
      ctx.strokeStyle = "rgba(0,0,0,0.6)";
      ctx.lineWidth = 4;
      ctx.strokeText(`🔥 x${mult.toFixed(1)} KOMBO`, W / 2, 70);
      ctx.fillStyle = "#fb923c";
      ctx.fillText(`🔥 x${mult.toFixed(1)} KOMBO`, W / 2, 70);

      // Kombo taymeri chizig'i
      const cw = 110 * (this.comboTimer / this.opts.rod.comboTime);
      ctx.fillStyle = "rgba(251, 146, 60, 0.85)";
      ctx.fillRect(W / 2 - cw / 2, 78, cw, 4);
    }

    // Turbo holati ko'rsatkichi
    if (this.isBoosting) {
      ctx.textAlign = "center";
      ctx.fillStyle = "#38bdf8";
      ctx.font = "900 12px system-ui, sans-serif";
      ctx.fillText("⚡ TEZLANISH", W / 2, 98);
    }
  }

  private rr(x: number, y: number, w: number, h: number, r: number) {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
}
