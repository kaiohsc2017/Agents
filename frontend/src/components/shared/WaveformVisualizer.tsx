import { useState } from 'react';
import { Volume2 } from 'lucide-react';

interface WaveformVisualizerProps {
  waveform?: number[];
  mosScore?: number;
  durationSeconds?: number;
}

export function WaveformVisualizer({
  waveform = [25, 45, 70, 85, 95, 70, 50, 60, 85, 90, 80, 65, 40, 30, 55, 75, 85, 60, 45, 30, 50, 70, 90, 80, 55, 35, 25, 20],
  mosScore = 4.25,
  durationSeconds = 14.0,
}: WaveformVisualizerProps) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const getBarColor = (_val: number, idx: number) => {
    if (activeIdx !== null && idx <= activeIdx) {
      return 'bg-primary';
    }
    if (mosScore >= 4.0) return 'bg-emerald-500/70 hover:bg-emerald-500';
    if (mosScore >= 3.2) return 'bg-amber-500/70 hover:bg-amber-500';
    return 'bg-rose-500/70 hover:bg-rose-500';
  };

  return (
    <div className="p-3 bg-muted/20 border border-border/70 rounded-xl space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-foreground font-semibold">
          <Volume2 className="h-4 w-4 text-primary" />
          <span>Espectrograma & Waveform Acústica</span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span>Duração: <strong className="text-foreground">{durationSeconds}s</strong></span>
          <span>MOS: <strong className={mosScore >= 4.0 ? 'text-emerald-500' : mosScore >= 3.2 ? 'text-amber-500' : 'text-rose-500'}>{mosScore.toFixed(2)}</strong></span>
        </div>
      </div>

      {/* Waveform Bars Container */}
      <div className="h-14 flex items-end gap-1 px-2 py-1 bg-background/50 border border-border/40 rounded-lg overflow-hidden">
        {waveform.map((val, idx) => {
          const heightPct = Math.max(8, Math.min(100, val));
          return (
            <div
              key={idx}
              onMouseEnter={() => setActiveIdx(idx)}
              onMouseLeave={() => setActiveIdx(null)}
              style={{ height: `${heightPct}%` }}
              className={`flex-1 rounded-xs transition-all duration-150 cursor-pointer ${getBarColor(val, idx)}`}
              title={`Frame ${idx + 1}: ${val}% amplitude`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground font-mono">
        <span>00:00</span>
        <span className="text-primary font-bold">● Amostragem ITU-T P.800 (PCM 8/16kHz)</span>
        <span>00:{Math.round(durationSeconds).toString().padStart(2, '0')}</span>
      </div>
    </div>
  );
}

export default WaveformVisualizer;
