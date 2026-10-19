// Kichik WebAudio sintez — tashqi fayllarsiz jonli audio effektlar
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;

function ensure() {
  if (!ctx) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    } catch {
      /* audio yo'q */
    }
  }
  if (ctx && ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
}

export function unlockAudio() {
  ensure();
}

export function setMuted(m: boolean) {
  muted = m;
  if (master && ctx) {
    master.gain.setValueAtTime(muted ? 0 : 0.35, ctx.currentTime);
  }
}

export function isMuted() {
  return muted;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0) {
  if (muted) return;
  ensure();
  if (!ctx || !master) return;
  try {
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(20, freq), t);
    if (slide) {
      o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    }
    g.gain.setValueAtTime(Math.min(1, Math.max(0.001, vol)), t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch {
    /* ignore audio error */
  }
}

export const sfx = {
  catch(rarity: number) {
    const f = 440 + rarity * 80;
    tone(f, 0.12, "triangle", 0.45, f * 0.5);
    tone(f * 1.5, 0.18, "sine", 0.3, f * 0.3);
    if (rarity >= 6) {
      tone(f * 2, 0.3, "sine", 0.25, 250);
      tone(f * 2.5, 0.35, "triangle", 0.2, 400);
    }
  },
  combo(n: number) {
    const freq = 520 + Math.min(n, 16) * 45;
    tone(freq, 0.09, "square", 0.14, 130);
  },
  upgrade() {
    tone(330, 0.1, "triangle", 0.4, 180);
    setTimeout(() => tone(495, 0.12, "triangle", 0.4, 220), 80);
    setTimeout(() => tone(660, 0.2, "triangle", 0.4, 280), 160);
  },
  buy() {
    tone(392, 0.12, "sine", 0.45, 100);
    setTimeout(() => tone(587, 0.18, "sine", 0.45, 180), 100);
    setTimeout(() => tone(784, 0.28, "triangle", 0.45, 240), 220);
    setTimeout(() => tone(1046, 0.35, "sine", 0.35, 150), 360);
  },
  splash() {
    tone(220, 0.25, "sine", 0.3, -150);
    tone(140, 0.3, "triangle", 0.2, -60);
  },
  tick() {
    tone(880, 0.05, "square", 0.08, 0);
  },
  over() {
    tone(392, 0.25, "sawtooth", 0.2, -120);
    setTimeout(() => tone(294, 0.4, "sawtooth", 0.2, -100), 180);
  },
  denied() {
    tone(180, 0.15, "square", 0.15, -60);
  },
  whoosh() {
    tone(160, 0.15, "sine", 0.18, 120);
  },
  levelUp() {
    tone(523, 0.12, "sine", 0.4, 100); // C5
    setTimeout(() => tone(659, 0.12, "sine", 0.4, 100), 100); // E5
    setTimeout(() => tone(784, 0.15, "sine", 0.4, 100), 200); // G5
    setTimeout(() => tone(1046, 0.35, "triangle", 0.45, 150), 320); // C6
  },
  tierUp() {
    tone(440, 0.14, "triangle", 0.45, 100);
    setTimeout(() => tone(554, 0.14, "triangle", 0.45, 120), 120);
    setTimeout(() => tone(659, 0.18, "triangle", 0.45, 150), 240);
    setTimeout(() => tone(880, 0.4, "triangle", 0.5, 200), 380);
  },
  click() {
    tone(700, 0.03, "sine", 0.1, 0);
  }
};
