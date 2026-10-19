// Kichik WebAudio sintez — tashqi fayllarsiz jonli ovozlar
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ensure() {
  if (!ctx) {
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      /* audio yo'q */
    }
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
}

export function unlockAudio() {
  ensure();
}

export function setMuted(m: boolean) {
  muted = m;
}
export function isMuted() {
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
  if (muted) return;
  ensure();
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g);
  g.connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  catch(rarity: number) {
    const f = 440 + rarity * 90;
    tone(f, 0.12, "triangle", 0.5, f * 0.6);
    tone(f * 1.5, 0.18, "sine", 0.3, f * 0.4);
    if (rarity >= 6) tone(f * 2, 0.35, "sine", 0.25, 300);
  },
  combo(n: number) {
    tone(520 + Math.min(n, 16) * 42, 0.08, "square", 0.12, 120);
  },
  upgrade() {
    tone(330, 0.1, "triangle", 0.4, 220);
    setTimeout(() => tone(495, 0.12, "triangle", 0.4, 260), 90);
    setTimeout(() => tone(660, 0.22, "triangle", 0.4, 330), 180);
  },
  buy() {
    tone(392, 0.12, "sine", 0.45, 100);
    setTimeout(() => tone(587, 0.2, "sine", 0.45, 200), 110);
    setTimeout(() => tone(784, 0.3, "triangle", 0.4, 200), 230);
  },
  splash() {
    tone(220, 0.25, "sine", 0.3, -160);
  },
  tick() {
    tone(880, 0.05, "square", 0.08, 0);
  },
  over() {
    tone(392, 0.25, "sawtooth", 0.2, -120);
    setTimeout(() => tone(294, 0.4, "sawtooth", 0.2, -100), 200);
  },
  denied() {
    tone(180, 0.15, "square", 0.15, -60);
  },
};
