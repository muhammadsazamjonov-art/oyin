import { useEffect, useRef, useState } from "react";
import { Engine, RoundResult } from "../game/engine";
import { rodStats, BOATS } from "../game/progression";

interface Props {
  rodLevel: number;
  boatIdx: number;
  discovered: Set<number>;
  currentProfileXP: number;
  paused: boolean;
  engineHandle?: React.MutableRefObject<Engine | null>;
  onEnd: (r: RoundResult) => void;
  onCatch: (speciesId: number, value: number, isNew: boolean, xpGained: number) => void;
  onPauseToggle: () => void;
}

export default function GameView({
  rodLevel,
  boatIdx,
  discovered,
  currentProfileXP,
  paused,
  engineHandle,
  onEnd,
  onCatch,
  onPauseToggle,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [isBoosting, setIsBoosting] = useState(false);

  const cbRef = useRef({ onEnd, onCatch, onPauseToggle });
  cbRef.current = { onEnd, onCatch, onPauseToggle };

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new Engine(canvasRef.current, {
      rod: rodStats(rodLevel),
      boat: BOATS[boatIdx],
      discovered,
      currentProfileXP,
      onEnd: (r) => cbRef.current.onEnd(r),
      onCatch: (id, v, n, xp) => cbRef.current.onCatch(id, v, n, xp),
      onPauseToggle: () => cbRef.current.onPauseToggle(),
    });
    engineRef.current = engine;
    if (engineHandle) engineHandle.current = engine;

    return () => {
      engine.destroy();
      if (engineHandle) engineHandle.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    engineRef.current?.setPaused(paused);
  }, [paused]);

  const handleTurboDown = () => {
    setIsBoosting(true);
    engineRef.current?.setBoosting(true);
  };

  const handleTurboUp = () => {
    setIsBoosting(false);
    engineRef.current?.setBoosting(false);
  };

  return (
    <div className="relative h-full w-full select-none touch-none overflow-hidden">
      <canvas ref={canvasRef} className="h-full w-full block" />

      {/* Mobile Turbo Boost Button */}
      <button
        onPointerDown={handleTurboDown}
        onPointerUp={handleTurboUp}
        onPointerCancel={handleTurboUp}
        className={`absolute bottom-6 right-6 z-10 flex h-16 w-16 sm:h-20 sm:w-20 items-center justify-center rounded-full border-2 text-center font-black shadow-2xl backdrop-blur transition-all active:scale-95 ${
          isBoosting
            ? "border-sky-300 bg-sky-400 text-sky-950 scale-105 shadow-sky-400/50"
            : "border-sky-500/60 bg-sky-950/70 text-sky-200 hover:bg-sky-900/80"
        }`}
        title="Tezlanish (Space)"
      >
        <div className="flex flex-col items-center leading-tight">
          <span className="text-xl sm:text-2xl">⚡</span>
          <span className="text-[10px] sm:text-xs font-bold tracking-tighter">TEZLIK</span>
        </div>
      </button>

      {/* Info indicator for controls */}
      <div className="pointer-events-none absolute bottom-3 left-4 z-10 text-[11px] text-sky-300/60 hidden sm:block">
        🕹 WASD / Strelkalar / Sichqoncha • ⚡ Bo'sh joy (Space) • ⏸ P
      </div>
    </div>
  );
}
