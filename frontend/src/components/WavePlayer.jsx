import React, { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";

export default function WavePlayer({ src }) {
  const containerRef = useRef(null);
  const waveRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !src) return;

    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 60,
      barWidth: 2,
      cursorWidth: 1,
      waveColor: "#a5b4fc",
      progressColor: "#4f46e5",
      cursorColor: "#111827",
      responsive: true,
    });
    waveRef.current = ws;
    ws.load(src);

    return () => ws.destroy();
  }, [src]);

  return (
    <div>
      <div ref={containerRef} />
      <div className="mt-1 flex gap-2 text-xs">
        <button
          type="button"
          onClick={() => waveRef.current && waveRef.current.playPause()}
          className="btn-ghost px-2 py-1"
        >
          Play / Pause
        </button>
      </div>
    </div>
  );
}
