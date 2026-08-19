import { Badge } from '@/components/ui/badge';
import type { AgentStatus } from './types';

const STATUS_CONFIG: Record<AgentStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info'; pulse?: boolean }> = {
  idle:    { label: 'Em espera', variant: 'secondary' },
  running: { label: 'Executando', variant: 'info', pulse: true },
  success: { label: 'Sucesso', variant: 'success' },
  error:   { label: 'Falha', variant: 'destructive' },
  partial: { label: 'Parcial', variant: 'warning' },
  paused:  { label: 'Pausado', variant: 'outline' },
};

export function StatusBadge({ status }: { status: AgentStatus }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: 'secondary' };

  return (
    <Badge variant={cfg.variant} className="gap-1.5 font-mono text-[11px] font-medium uppercase tracking-wider">
      {cfg.pulse && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />}
      {cfg.label}
    </Badge>
  );
}
