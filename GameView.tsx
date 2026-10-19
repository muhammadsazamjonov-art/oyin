import { useEffect, useRef } from "react";
import { Engine, RoundResult } from "../game/engine";
import { rodStats, BOATS } from "../game/progression";

interface Props {
  rodLevel: number;
  boatIdx: number;
  discovered: Set<number>;
  paused: boolean;
  engineHandle?: React.MutableRefObject<Engine | null>;
  onEnd: (r: RoundResult) => void;
  onCatch: (speciesId: number, value: number, isNew: boolean) => void;
  onPauseToggle: () => void;
}

export default function GameView({ rodLevel, boatIdx, discovered, paused, engineHandle, onEnd, onCatch, onPauseToggle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const cbRef = useRef({ onEnd, onCatch, onPauseToggle });
  cbRef.current = { onEnd, onCatch, onPauseToggle };

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new Engine(canvasRef.current, {
      rod: rodStats(rodLevel),
      boat: BOATS[boatIdx],
      discovered,
      onEnd: (r) => cbRef.current.onEnd(r),
      onCatch: (id, v, n) => cbRef.current.onCatch(id, v, n),
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

  return <canvas ref={canvasRef} className="h-full w-full" />;
}
