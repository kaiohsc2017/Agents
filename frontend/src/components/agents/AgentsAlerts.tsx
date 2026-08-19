import { useEffect, useState } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import agentsApi, { getErrorMessage } from './agentsClient';
import type { AlertEntry } from './types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const LEVEL_CONFIG: Record<AlertEntry['level'], { label: string; variant: 'info' | 'warning' | 'destructive' }> = {
  info:     { label: 'INFO', variant: 'info' },
  warning:  { label: 'AVISO', variant: 'warning' },
  error:    { label: 'ERRO', variant: 'destructive' },
  critical: { label: 'CRÍTICO', variant: 'destructive' },
};

export default function AgentsAlerts() {
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    agentsApi
      .get<AlertEntry[]>('/api/executions/alerts?limit=100')
      .then(({ data }) => setAlerts(Array.isArray(data) ? data : []))
      .catch((err) => setError(getErrorMessage(err, 'Erro ao carregar histórico de alertas.')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Alertas de Agentes</h1>
            <Badge variant="outline" className="text-xs font-mono">
              {alerts.length} Notificaç{alerts.length !== 1 ? 'ões' : 'ão'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico consolidado de disparos e incidentes gerados automaticamente pelos agentes
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 gap-1.5 font-medium">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center justify-between">
          <span>{error}</span>
          <Button size="xs" variant="outline" onClick={load}>
            Tentar novamente
          </Button>
        </div>
      )}

      {/* Alerts Table */}
      <Card className="shadow-xs border-border/70 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-xs">Agente</TableHead>
                <TableHead className="font-semibold text-xs">Severidade</TableHead>
                <TableHead className="font-semibold text-xs">Canal</TableHead>
                <TableHead className="font-semibold text-xs">Mensagem</TableHead>
                <TableHead className="font-semibold text-xs">Enviado em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Carregando histórico de alertas...
                  </TableCell>
                </TableRow>
              ) : alerts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                    Nenhum alerta registrado até o momento.
                  </TableCell>
                </TableRow>
              ) : (
                alerts.map((a) => {
                  const lvlCfg = LEVEL_CONFIG[a.level] ?? { label: a.level, variant: 'warning' };
                  return (
                    <TableRow key={a.id} className="hover:bg-muted/30">
                      <TableCell className="font-semibold text-xs text-foreground">
                        {a.agent_name}
                      </TableCell>

                      <TableCell>
                        <Badge variant={lvlCfg.variant} className="text-[10px] font-mono">
                          {lvlCfg.label}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline" className="text-[10px] font-mono uppercase">
                          {a.channel}
                        </Badge>
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground max-w-md truncate">
                        {a.message}
                      </TableCell>

                      <TableCell className="text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(a.sent_at).toLocaleString('pt-BR')}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
