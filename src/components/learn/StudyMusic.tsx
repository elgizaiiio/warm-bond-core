import { useEffect, useRef, useState } from "react";
import { Music, Volume2, VolumeX } from "lucide-react";

/**
 * Soft ambient/lo-fi style background audio generated with Web Audio API.
 * No external assets — uses brown noise through a low-pass filter + a slow
 * sine LFO for gentle movement. Works fully offline.
 */
const StudyMusic = ({ autoStart = false }: { autoStart?: boolean }) => {
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(0.18);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);

  const start = () => {
    if (playing) return;
    try {
      const Ctx: typeof AudioContext =
        (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new Ctx();
      ctxRef.current = ctx;

      // Brown noise buffer
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        output[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer;
      noise.loop = true;

      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 520;
      lp.Q.value = 0.7;

      // gentle pad: soft sine that drifts
      const pad = ctx.createOscillator();
      pad.type = "sine";
      pad.frequency.value = 110;
      const padGain = ctx.createGain();
      padGain.gain.value = 0.04;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.025;
      lfo.connect(lfoGain);
      lfoGain.connect(padGain.gain);

      const master = ctx.createGain();
      master.gain.value = volume;
      masterRef.current = master;

      noise.connect(lp).connect(master);
      pad.connect(padGain).connect(master);
      master.connect(ctx.destination);

      noise.start();
      pad.start();
      lfo.start();
      nodesRef.current = [noise, pad, lfo];
      setPlaying(true);
    } catch (e) {
      console.warn("StudyMusic start failed", e);
    }
  };

  const stop = () => {
    nodesRef.current.forEach((n) => {
      try {
        (n as any).stop?.();
        n.disconnect();
      } catch {}
    });
    nodesRef.current = [];
    try {
      ctxRef.current?.close();
    } catch {}
    ctxRef.current = null;
    masterRef.current = null;
    setPlaying(false);
  };

  useEffect(() => {
    if (masterRef.current && ctxRef.current) {
      masterRef.current.gain.setTargetAtTime(volume, ctxRef.current.currentTime, 0.05);
    }
  }, [volume]);

  useEffect(() => {
    if (autoStart) start();
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-background/70 backdrop-blur-md border border-emerald-400/20 shadow-sm">
      <button
        onClick={playing ? stop : start}
        className="w-7 h-7 flex items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 transition-colors"
        aria-label={playing ? "إيقاف الموسيقى" : "تشغيل موسيقى المذاكرة"}
        title={playing ? "إيقاف الموسيقى" : "تشغيل موسيقى المذاكرة"}
      >
        {playing ? <Music className="w-3.5 h-3.5" /> : <Music className="w-3.5 h-3.5 opacity-50" />}
      </button>
      {playing && (
        <>
          <button
            onClick={() => setVolume((v) => (v > 0 ? 0 : 0.18))}
            className="text-foreground/60 hover:text-foreground"
            aria-label="كتم"
          >
            {volume > 0 ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="w-16 h-1 accent-emerald-400"
          />
        </>
      )}
    </div>
  );
};

export default StudyMusic;
