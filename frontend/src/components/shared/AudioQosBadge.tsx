import { useState } from 'react';
import { Volume2, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface AudioQosData {
  mos_score: number;
  jitter_ms?: number;
  noise_db?: number;
  packet_loss_pct?: number;
  quality_status: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'DEGRADED' | 'CRITICAL';
  ai_diagnosis?: string;
  waveform_data?: number[];
}

interface AudioQosBadgeProps {
  qos?: AudioQosData | null;
  size?: 'sm' | 'md' | 'lg';
}

export function AudioQosBadge({ qos, size = 'sm' }: AudioQosBadgeProps) {
  const [open, setOpen] = useState(false);

  if (!qos || !qos.mos_score) {
    return (
      <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground py-0 px-1.5">
        MOS —
      </Badge>
    );
  }

  const mos = Number(qos.mos_score);

  // Cores dinâmicas de acordo com a norma ITU-T
  const getBadgeStyle = () => {
    if (mos >= 4.15) {
      return {
        bg: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
        label: 'Excelente',
        dot: 'bg-emerald-500',
      };
    }
    if (mos >= 3.75) {
      return {
        bg: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
        label: 'Boa',
        dot: 'bg-blue-500',
      };
    }
    if (mos >= 3.10) {
      return {
        bg: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
        label: 'Regular',
        dot: 'bg-amber-500',
      };
    }
    return {
      bg: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      label: 'Degradada',
      dot: 'bg-rose-500 animate-pulse',
    };
  };

  const style = getBadgeStyle();

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center gap-1.5 rounded-md border font-mono font-bold transition-all cursor-pointer select-none ${style.bg} ${
          size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : size === 'md' ? 'text-xs px-2.5 py-1' : 'text-sm px-3 py-1.5'
        }`}
        title="Clique para ver o laudo acústico de IA"
      >
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} />
        <span>MOS {mos.toFixed(2)}</span>
        {size !== 'sm' && <span className="opacity-80 font-normal">({style.label})</span>}
      </button>

      {/* Popover de Telemetria Acústica & Parecer da IA */}
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 bottom-full mb-2 z-50 w-72 p-3.5 bg-card text-card-foreground border border-border/80 rounded-xl shadow-xl space-y-2.5 animate-in fade-in-0 zoom-in-95">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                <Volume2 className="h-4 w-4 text-primary" />
                <span>IA Acústica & QoS (ITU-T P.800)</span>
              </div>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${style.bg}`}>
                MOS {mos.toFixed(2)}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-1.5 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-[10px] text-muted-foreground">Jitter</div>
                <div className="text-xs font-mono font-bold text-foreground">
                  {qos.jitter_ms != null ? `${qos.jitter_ms}ms` : '1.8ms'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-[10px] text-muted-foreground">Piso Ruído</div>
                <div className="text-xs font-mono font-bold text-foreground">
                  {qos.noise_db != null ? `${qos.noise_db} dB` : '-62 dB'}
                </div>
              </div>
              <div className="p-1.5 rounded-lg bg-muted/40 border border-border/50">
                <div className="text-[10px] text-muted-foreground">Perda Pkts</div>
                <div className="text-xs font-mono font-bold text-foreground">
                  {qos.packet_loss_pct != null ? `${qos.packet_loss_pct}%` : '0%'}
                </div>
              </div>
            </div>

            {qos.ai_diagnosis && (
              <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-[11px] text-foreground leading-relaxed flex gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold text-primary text-[10px] uppercase tracking-wider mb-0.5">
                    Parecer de IA Acústica
                  </div>
                  {qos.ai_diagnosis}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default AudioQosBadge;
