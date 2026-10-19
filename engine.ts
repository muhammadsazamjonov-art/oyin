import { SPECIES, Species, spawnWeight, formatMoney, MAX_DEPTH_M } from "./species";
import { RodStats, Boat } from "./progression";
import { sfx } from "./sound";

export interface RoundResult {
  earned: number;
  caughtCount: number;
  bestFish: { name: string; price: number; rarity: number } | null;
  maxCombo: number;
  newSpecies: string[];
}

interface EngineOpts {
  rod: RodStats;
  boat: Boat;
  discovered: Set<number>;
  onEnd: (r: RoundResult) => void;
  onCatch: (speciesId: number, value: number, isNew: boolean) => void;
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
  x: number; y: number; vx: number; vy: number;
  life: number; max: number; size: number; color: string; grav: number;
}

interface Floater {
  x: number; y: number; text: string; life: number; max: number;
  color: string; size: number;
}

const PX_PER_M = 14;

// chuqurlik bo'yicha turlar bucketlari (har 4 metr)
const BUCKETS: number[][] = (() => {
  const b: number[][] = [];
  for (let d = 0; d < MAX_DEPTH_M; d += 4) {
    const ids: number[] = [];
    for (const s of SPECIES) if (d + 2 >= s.depthMin && d + 2 <= s.depthMax) ids.push(s.id);
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

  private hook = { x: 0, y: 70, vx: 0, vy: 0 };
  private camY = 0;
  private shake = 0;
  private flash = 0;

  private fish: ActiveFish[] = [];
  private particles: Particle[] = [];
  private floaters: Floater[] = [];
  private bubbleT = 0;

  private keys = new Set<string>();
  private pointer: { x: number; y: number } | null = null;

  private earned = 0;
  private caughtCount = 0;
  private combo = 0;
  private comboTimer = 0;
  private maxCombo = 0;
  private bestFish: RoundResult["bestFish"] = null;
  private newSpecies: string[] = [];
  private lastTick = -1;

  // dekoratsiyalar (deterministik)
  private plants: { x: number; d: number; h: number; hue: number }[] = [];
  private clouds: { x: number; y: number; s: number }[] = [];

  constructor(canvas: HTMLCanvasElement, opts: EngineOpts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.opts = opts;
    this.timeLeft = opts.boat.roundTime;
    this.maxDepthPx = opts.rod.maxDepth * PX_PER_M;

    this.resize();
    this.hook.x = this.W / 2;

    for (let i = 0; i < 40; i++) {
      this.plants.push({ x: Math.random(), d: Math.random(), h: 20 + Math.random() * 50, hue: 100 + Math.random() * 60 });
    }
    for (let i = 0; i < 6; i++) {
      this.clouds.push({ x: Math.random(), y: 20 + Math.random() * 80, s: 0.6 + Math.random() });
    }

    window.addEventListener("resize", this.resize);
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);

    for (let i = 0; i < 26; i++) this.spawnFish(true);
    sfx.splash();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
  }

  setPaused(p: boolean) {
    this.paused = p;
    this.last = performance.now();
  }

  endNow() {
    if (this.destroyed) return;
    this.opts.onEnd({
      earned: this.earned,
      caughtCount: this.caughtCount,
      bestFish: this.bestFish,
      maxCombo: this.maxCombo,
      newSpecies: this.newSpecies,
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
    if (["arrowleft", "arrowright", "arrowup", "arrowdown", " "].includes(e.key.toLowerCase()) || ["w", "a", "s", "d"].includes(k)) {
      e.preventDefault();
    }
    if (k === "p" || k === "escape") {
      if (!e.repeat) this.opts.onPauseToggle();
      return;
    }
    this.keys.add(k);
  };
  private onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  private onBlur = () => {
    this.keys.clear();
    this.pointer = null;
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

  // ---------- Baliq spawn ----------
  private spawnFish(anywhere = false) {
    const viewTop = Math.max(24, this.camY - 120);
    const viewBot = Math.min(this.maxDepthPx - 14, this.camY + this.H + 120);
    if (viewBot <= viewTop) return;
    const y = viewTop + Math.random() * (viewBot - viewTop);
    const depthM = y / PX_PER_M;
    const bucket = BUCKETS[Math.min(BUCKETS.length - 1, Math.floor(depthM / 4))];
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
      if (r <= 0) { sp = SPECIES[bucket[i]]; break; }
    }

    const dir = Math.random() < 0.5 ? 1 : -1;
    const x = anywhere
      ? Math.random() * this.W
      : dir === 1 ? -40 - Math.random() * 80 : this.W + 40 + Math.random() * 80;

    this.fish.push({
      sp, x, y, baseY: y, dir,
      spd: sp.speed * (0.7 + Math.random() * 0.6),
      phase: Math.random() * Math.PI * 2,
    });
  }

  // ---------- Tutish ----------
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

    // juicy feedback
    this.shake = Math.min(20, 3 + Math.log2(1 + f.sp.price) * 1.1 + (f.sp.rarity >= 6 ? 5 : 0));
    if (f.sp.rarity >= 7) this.flash = 0.35;
    const col = `hsl(${f.sp.hue} ${f.sp.sat}% ${f.sp.light + 10}%)`;
    for (let i = 0; i < 16 + f.sp.rarity * 3; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp2 = 40 + Math.random() * 160;
      this.particles.push({
        x: f.x, y: f.y,
        vx: Math.cos(a) * sp2, vy: Math.sin(a) * sp2 - 40,
        life: 0.5 + Math.random() * 0.5, max: 1,
        size: 2 + Math.random() * 3.5, color: i % 3 === 0 ? "#fde047" : col, grav: 120,
      });
    }
    this.floaters.push({
      x: f.x, y: f.y - 14, text: `+${formatMoney(value)}`, life: 1.1, max: 1.1,
      color: f.sp.rarity >= 6 ? "#fde047" : "#ffffff", size: 15 + Math.min(14, f.sp.rarity * 2),
    });
    this.floaters.push({
      x: f.x, y: f.y + 8, text: f.sp.name, life: 0.9, max: 0.9,
      color: "#bae6fd", size: 10,
    });
    if (this.combo >= 3) {
      this.floaters.push({
        x: this.hook.x, y: this.hook.y - 34, text: `x${mult.toFixed(1)} KOMBO!`, life: 0.7, max: 0.7,
        color: "#fb923c", size: 13,
      });
      sfx.combo(this.combo);
    }
    sfx.catch(f.sp.rarity);
    if (navigator.vibrate && f.sp.rarity >= 4) {
      try { navigator.vibrate(f.sp.rarity >= 7 ? 60 : 20); } catch { /* */ }
    }
    this.opts.onCatch(f.sp.id, value, isNew);
  }

  // ---------- Loop ----------
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
      });
      this.destroy();
      return;
    }

    // --- Boshqaruv ---
    const st = this.opts.rod;
    let ax = 0, ay = 0;
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
      if (d > 8) { ax = dx / d; ay = dy / d; }
    } else if (ax || ay) {
      const d = Math.hypot(ax, ay);
      ax /= d; ay /= d;
    }

    const accel = st.speed * 5.5;
    this.hook.vx += ax * accel * dt;
    this.hook.vy += ay * accel * dt;
    // suv qarshiligi
    const drag = Math.pow(0.0035, dt);
    this.hook.vx *= drag;
    this.hook.vy *= drag;
    const vmax = st.speed;
    const v = Math.hypot(this.hook.vx, this.hook.vy);
    if (v > vmax) { this.hook.vx = (this.hook.vx / v) * vmax; this.hook.vy = (this.hook.vy / v) * vmax; }
    this.hook.x += this.hook.vx * dt;
    this.hook.y += this.hook.vy * dt;
    if (this.hook.x < 14) { this.hook.x = 14; this.hook.vx = Math.abs(this.hook.vx) * 0.4; }
    if (this.hook.x > this.W - 14) { this.hook.x = this.W - 14; this.hook.vx = -Math.abs(this.hook.vx) * 0.4; }
    if (this.hook.y < 26) { this.hook.y = 26; this.hook.vy = Math.abs(this.hook.vy) * 0.3; }
    const maxY = this.maxDepthPx - 10;
    if (this.hook.y > maxY) {
      this.hook.y = maxY;
      if (this.hook.vy > 60) {
        this.floaters.push({ x: this.hook.x, y: this.hook.y - 20, text: "Qarmoq chegarasi! Yangilang ⬆", life: 1, max: 1, color: "#fca5a5", size: 12 });
      }
      this.hook.vy = Math.min(0, this.hook.vy);
    }

    // kamera
    const targetCam = this.hook.y - this.H * 0.42;
    const camMin = -this.H * 0.34;
    const camMax = Math.max(camMin, this.maxDepthPx + 60 - this.H);
    const tc = Math.max(camMin, Math.min(camMax, targetCam));
    this.camY += (tc - this.camY) * Math.min(1, dt * 6);

    // pufakchalar
    this.bubbleT -= dt;
    if (this.bubbleT <= 0 && v > 60) {
      this.bubbleT = 0.05;
      this.particles.push({
        x: this.hook.x + (Math.random() - 0.5) * 8, y: this.hook.y + 6,
        vx: (Math.random() - 0.5) * 20, vy: -30 - Math.random() * 40,
        life: 0.8 + Math.random() * 0.6, max: 1.4, size: 1.5 + Math.random() * 2.5,
        color: "rgba(255,255,255,0.5)", grav: -30,
      });
    }

    // --- Baliqlar ---
    const margin = 160;
    for (let i = this.fish.length - 1; i >= 0; i--) {
      const f = this.fish[i];
      f.x += f.dir * f.spd * dt;
      f.phase += dt * 3;
      f.y = f.baseY + Math.sin(f.phase) * 7;
      // qochish: katta noyob baliqlar qarmoqdan ozgina qochadi
      if (f.sp.rarity >= 5) {
        const dx = f.x - this.hook.x, dy = f.y - this.hook.y;
        const d = Math.hypot(dx, dy);
        if (d < 110 && d > 1) {
          f.baseY += (dy / d) * 26 * dt;
          f.x += (dx / d) * 30 * dt;
        }
      }
      if ((f.dir === 1 && f.x > this.W + margin) || (f.dir === -1 && f.x < -margin) ||
        f.y < this.camY - 320 || f.y > this.camY + this.H + 320) {
        this.fish.splice(i, 1);
        continue;
      }
      // tutish
      const dx = f.x - this.hook.x, dy = f.y - this.hook.y;
      const rr = st.radius + f.sp.size;
      if (dx * dx + dy * dy < rr * rr) {
        this.catchFish(f, i);
      }
    }
    const want = 26 + Math.min(14, Math.floor(st.level / 22));
    while (this.fish.length < want) this.spawnFish(this.fish.length < 8);

    // kombo
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }

    // zarralar
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    if (this.particles.length > 350) this.particles.splice(0, this.particles.length - 350);
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const fl = this.floaters[i];
      fl.life -= dt;
      fl.y -= 36 * dt;
      if (fl.life <= 0) this.floaters.splice(i, 1);
    }

    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 1.4);
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
    const surfScreen = -cam; // suv sathi ekran koordinatasi

    // --- Osmon ---
    if (surfScreen > -40) {
      const sky = ctx.createLinearGradient(0, surfScreen - H * 0.5, 0, surfScreen);
      sky.addColorStop(0, "#7dd3fc");
      sky.addColorStop(1, "#fef3c7");
      ctx.fillStyle = sky;
      ctx.fillRect(-20, -20, W + 40, Math.max(0, surfScreen) + 20);
      // quyosh
      ctx.fillStyle = "rgba(253,224,71,0.9)";
      ctx.beginPath();
      ctx.arc(W * 0.82, surfScreen - H * 0.26, 26, 0, Math.PI * 2);
      ctx.fill();
      // bulutlar
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (const c of this.clouds) {
        const cx = ((c.x + this.t * 0.008 * c.s) % 1.2 - 0.1) * W;
        const cy = surfScreen - c.y - 40;
        ctx.beginPath();
        ctx.ellipse(cx, cy, 34 * c.s, 12 * c.s, 0, 0, Math.PI * 2);
        ctx.ellipse(cx + 22 * c.s, cy + 4, 24 * c.s, 10 * c.s, 0, 0, Math.PI * 2);
        ctx.ellipse(cx - 22 * c.s, cy + 5, 20 * c.s, 9 * c.s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // --- Suv ---
    const depthM = Math.max(0, cam + H / 2) / PX_PER_M;
    const darkness = Math.min(0.82, depthM / 320);
    const wTop = Math.max(0, surfScreen);
    const water = ctx.createLinearGradient(0, wTop, 0, H);
    water.addColorStop(0, `hsl(199 ${85 - darkness * 40}% ${44 - darkness * 34}%)`);
    water.addColorStop(1, `hsl(215 ${80 - darkness * 30}% ${26 - darkness * 22}%)`);
    ctx.fillStyle = water;
    ctx.fillRect(-20, wTop, W + 40, H - wTop + 20);

    // yorug'lik nurlari (faqat sayoz joyda)
    if (cam < 400) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.16 - cam / 2600);
      ctx.fillStyle = "#e0f2fe";
      for (let i = 0; i < 4; i++) {
        const bx = W * (0.15 + i * 0.25) + Math.sin(this.t * 0.4 + i * 2) * 30;
        ctx.beginPath();
        ctx.moveTo(bx - 14, surfScreen);
        ctx.lineTo(bx + 14, surfScreen);
        ctx.lineTo(bx + 90, surfScreen + 460);
        ctx.lineTo(bx - 90, surfScreen + 460);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    // chuqurlik belgilari
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.font = "11px ui-monospace, monospace";
    ctx.textAlign = "left";
    const m0 = Math.max(0, Math.floor(cam / PX_PER_M / 20) * 20);
    for (let m = m0; m <= m0 + Math.ceil(H / PX_PER_M / 20) * 20 + 20; m += 20) {
      if (m === 0) continue;
      const sy = m * PX_PER_M - cam;
      if (sy < 0 || sy > H) continue;
      ctx.fillRect(0, sy, 26, 1.5);
      ctx.fillText(`${m}m`, 32, sy + 4);
    }

    // dengiz tubi
    const floorY = this.maxDepthPx - cam;
    if (floorY < H + 80) {
      ctx.fillStyle = "hsl(40 30% 24%)";
      ctx.beginPath();
      ctx.moveTo(-20, floorY + 16);
      for (let x = -20; x <= W + 20; x += 30) {
        ctx.lineTo(x, floorY + 16 + Math.sin(x * 0.05) * 6);
      }
      ctx.lineTo(W + 20, H + 40);
      ctx.lineTo(-20, H + 40);
      ctx.closePath();
      ctx.fill();
      // o'simliklar
      for (const pl of this.plants) {
        const px = pl.x * W;
        const ph = pl.h;
        const sway = Math.sin(this.t * 1.4 + pl.x * 12) * 7;
        ctx.strokeStyle = `hsl(${pl.hue} 55% ${30 + pl.d * 14}%)`;
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

    // --- Qarmoq ipi + ilgak ---
    const st = this.opts.rod;
    const boatX = W / 2;
    const boatY = surfScreen - 6;
    const hx = this.hook.x, hy = this.hook.y - cam;
    ctx.strokeStyle = st.lineColor;
    ctx.lineWidth = 1.5 + st.tier * 0.18;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.moveTo(boatX + 36, Math.min(boatY - 26, hy - 40));
    const midX = (boatX + 36 + hx) / 2 + this.hook.vx * -0.06;
    ctx.quadraticCurveTo(midX, (boatY + hy) / 2, hx, hy - 8);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // tutish radiusi halqasi
    ctx.strokeStyle = `rgba(255,255,255,${0.12 + Math.sin(this.t * 5) * 0.04})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(hx, hy, st.radius, 0, Math.PI * 2);
    ctx.stroke();

    // ilgak
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(this.hook.vx * 0.0012);
    if (st.tier >= 6) {
      ctx.shadowColor = st.color;
      ctx.shadowBlur = 12;
    }
    ctx.strokeStyle = st.color;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(0, 4);
    ctx.arc(-5, 4, 5, 0, Math.PI, false);
    ctx.stroke();
    ctx.fillStyle = "#f87171";
    ctx.beginPath();
    ctx.arc(0, -12, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Qayiq (suv sathida) ---
    if (surfScreen > -80 && surfScreen < H + 80) {
      this.drawBoat(boatX, surfScreen);
      // to'lqinli suv sathi chizig'i
      ctx.strokeStyle = "rgba(255,255,255,0.55)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = -10; x <= W + 10; x += 8) {
        const y = surfScreen + Math.sin(x * 0.035 + this.t * 2.2) * 3;
        x === -10 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
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

    // --- Floater matnlar ---
    ctx.textAlign = "center";
    for (const fl of this.floaters) {
      const a = Math.max(0, fl.life / fl.max);
      const pop = fl.life > fl.max - 0.12 ? 1 + (fl.max - fl.life) * 4 : 1.3 - 0.3 * a + 0.3;
      ctx.globalAlpha = a;
      ctx.font = `800 ${Math.round(fl.size * Math.min(1.5, pop))}px system-ui, sans-serif`;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 3;
      ctx.strokeText(fl.text, fl.x, fl.y - cam);
      ctx.fillStyle = fl.color;
      ctx.fillText(fl.text, fl.x, fl.y - cam);
    }
    ctx.globalAlpha = 1;

    ctx.restore(); // shake tugadi

    // flash (noyob baliq)
    if (this.flash > 0) {
      ctx.fillStyle = `rgba(253,224,71,${this.flash * 0.35})`;
      ctx.fillRect(0, 0, W, H);
    }

    this.drawHUD();
  }

  private drawFish(f: ActiveFish, sy: number) {
    const { ctx } = this;
    const s = f.sp;
    const r = s.size;
    ctx.save();
    ctx.translate(f.x, sy);
    ctx.scale(f.dir, 1);
    const wig = Math.sin(f.phase * 2.4) * 0.12;
    ctx.rotate(wig);
    if (s.glow) {
      ctx.shadowColor = `hsl(${s.hue} 90% 65%)`;
      ctx.shadowBlur = 14;
    }
    const body = `hsl(${s.hue} ${s.sat}% ${s.light}%)`;
    const belly = `hsl(${s.hue} ${s.sat * 0.5}% ${Math.min(88, s.light + 26)}%)`;
    // dum
    ctx.fillStyle = body;
    const tw = Math.sin(f.phase * 3) * r * 0.25;
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, 0);
    ctx.lineTo(-r * 1.5, -r * 0.55 + tw);
    ctx.lineTo(-r * 1.5, r * 0.55 + tw);
    ctx.closePath();
    ctx.fill();
    // tana
    ctx.beginPath();
    ctx.ellipse(0, 0, r, r * 0.58, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = belly;
    ctx.beginPath();
    ctx.ellipse(r * 0.08, r * 0.16, r * 0.8, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    // chiziqlar
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
    // suzgich
    ctx.fillStyle = `hsl(${s.hue} ${s.sat}% ${Math.max(20, s.light - 14)}%)`;
    ctx.beginPath();
    ctx.moveTo(-r * 0.15, -r * 0.5);
    ctx.lineTo(r * 0.25, -r * 0.95);
    ctx.lineTo(r * 0.4, -r * 0.45);
    ctx.closePath();
    ctx.fill();
    // ko'z
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(r * 0.55, -r * 0.12, r * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#0f172a";
    ctx.beginPath();
    ctx.arc(r * 0.6, -r * 0.12, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawBoat(x: number, surfY: number) {
    const { ctx } = this;
    const b = this.opts.boat;
    const bob = Math.sin(this.t * 1.6) * 3;
    const tilt = Math.sin(this.t * 1.1) * 0.03;
    const sc = 1 + b.idx * 0.12;
    ctx.save();
    ctx.translate(x, surfY + bob - 4);
    ctx.rotate(tilt);
    ctx.scale(sc, sc);

    // korpus
    ctx.fillStyle = b.hull;
    ctx.beginPath();
    ctx.moveTo(-54, -8);
    ctx.lineTo(54, -8);
    ctx.lineTo(40, 14);
    ctx.quadraticCurveTo(0, 20, -40, 14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(-54, -8, 108, 4);
    // paluba
    ctx.fillStyle = b.deck;
    ctx.fillRect(-46, -12, 92, 5);

    if (b.idx >= 1) {
      // yelkan/machta
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
    if (b.idx >= 2) {
      // kabina
      ctx.fillStyle = b.idx === 5 ? "#fef08a" : "#f8fafc";
      ctx.fillRect(-32, -30, 36, 18);
      ctx.fillStyle = "#38bdf8";
      ctx.fillRect(-27, -26, 9, 7);
      ctx.fillRect(-14, -26, 9, 7);
    }
    if (b.idx >= 3) {
      ctx.fillStyle = b.hull;
      ctx.fillRect(-38, -40, 30, 10);
      ctx.fillStyle = "#334155";
      ctx.fillRect(-16, -48, 7, 18); // truba
    }
    if (b.idx >= 4) {
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(8, -36, 30, 24);
      ctx.fillStyle = "#0ea5e9";
      ctx.fillRect(12, -31, 8, 7);
      ctx.fillRect(24, -31, 8, 7);
    }
    // bayroq
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(44, -8);
    ctx.lineTo(44, -34);
    ctx.stroke();
    ctx.fillStyle = b.idx === 5 ? "#facc15" : "#ef4444";
    ctx.beginPath();
    ctx.moveTo(44, -34);
    ctx.lineTo(60, -29);
    ctx.lineTo(44, -24);
    ctx.closePath();
    ctx.fill();

    // baliqchi
    ctx.fillStyle = "#fbbf24";
    ctx.beginPath();
    ctx.arc(28, -18, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#1d4ed8";
    ctx.fillRect(24, -14, 8, 10);
    // qo'ldagi qarmoq tayog'i
    ctx.strokeStyle = this.opts.rod.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(30, -12);
    ctx.lineTo(36 / sc + 8, -26);
    ctx.stroke();
    ctx.restore();
  }

  private drawHUD() {
    const { ctx, W } = this;
    const depthNow = Math.max(0, this.hook.y / PX_PER_M);

    // vaqt paneli
    const tw = Math.min(260, W * 0.5);
    const frac = Math.max(0, this.timeLeft / this.opts.boat.roundTime);
    ctx.fillStyle = "rgba(2,20,40,0.55)";
    this.rr(W / 2 - tw / 2, 10, tw, 26, 13);
    ctx.fill();
    ctx.fillStyle = frac < 0.17 ? "#ef4444" : "#38bdf8";
    this.rr(W / 2 - tw / 2 + 3, 13, (tw - 6) * frac, 20, 10);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(`⏱ ${Math.max(0, Math.ceil(this.timeLeft))}s`, W / 2, 28);

    // daromad
    ctx.fillStyle = "rgba(2,20,40,0.55)";
    this.rr(10, 10, 132, 30, 10);
    ctx.fill();
    ctx.textAlign = "left";
    ctx.fillStyle = "#fde047";
    ctx.font = "800 15px system-ui, sans-serif";
    ctx.fillText(`🪙 ${formatMoney(this.earned)}`, 20, 31);

    // chuqurlik
    ctx.fillStyle = "rgba(2,20,40,0.55)";
    this.rr(W - 142, 10, 132, 30, 10);
    ctx.fill();
    ctx.textAlign = "right";
    ctx.fillStyle = "#bae6fd";
    ctx.fillText(`🌊 ${depthNow.toFixed(0)}/${this.opts.rod.maxDepth.toFixed(0)}m`, W - 20, 31);

    // kombo
    if (this.combo >= 2 && this.comboTimer > 0) {
      const mult = 1 + Math.min(20, this.combo - 1) * 0.1;
      ctx.textAlign = "center";
      const pulse = 1 + Math.sin(this.t * 10) * 0.06;
      ctx.font = `900 ${Math.round(22 * pulse)}px system-ui, sans-serif`;
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 4;
      ctx.strokeText(`🔥 x${mult.toFixed(1)}`, W / 2, 68);
      ctx.fillStyle = "#fb923c";
      ctx.fillText(`🔥 x${mult.toFixed(1)}`, W / 2, 68);
      // kombo vaqti chizig'i
      const cw = 90 * (this.comboTimer / this.opts.rod.comboTime);
      ctx.fillStyle = "rgba(251,146,60,0.8)";
      ctx.fillRect(W / 2 - cw / 2, 76, cw, 4);
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
