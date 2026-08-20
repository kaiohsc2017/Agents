import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import {
  Zap, Terminal, Database, Globe, Brain, BookOpen, GitFork,
  Send, PhoneCall, Bot, Volume2
} from 'lucide-react';
import type { FlowNodeData } from '../types';

interface CustomNodeProps {
  id: string;
  data: FlowNodeData;
  selected?: boolean;
  type?: string;
}

export const CustomNode = memo(({ id, data, selected, type }: CustomNodeProps) => {
  const nodeType = type || 'actionNode';

  // Configuração de estilo por categoria
  let categoryLabel = 'Ação';
  let badgeColor = 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
  let borderColor = selected ? 'border-primary ring-2 ring-primary/20' : 'border-border';
  let IconComponent = Terminal;

  if (nodeType === 'triggerNode') {
    categoryLabel = 'Gatilho';
    badgeColor = 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    IconComponent = data.triggerType === 'audio_qos' ? Volume2 : Zap;
  } else if (nodeType === 'cognitiveNode') {
    categoryLabel = 'IA & Raciocínio';
    badgeColor = 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    IconComponent = data.cognitiveType === 'rag' ? BookOpen : data.cognitiveType === 'condition' ? GitFork : Brain;
  } else if (nodeType === 'actuatorNode') {
    categoryLabel = 'Atuador / Saída';
    badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
    IconComponent = data.actuatorType === 'telegram' ? Send : data.actuatorType === 'voice_call' ? PhoneCall : Bot;
  } else {
    // Action sub-types
    if (data.actionType === 'sql') IconComponent = Database;
    if (data.actionType === 'http') IconComponent = Globe;
    if (data.actionType === 'audio_qos') IconComponent = Volume2;
  }

  const isTrigger = nodeType === 'triggerNode';

  return (
    <div
      className={`relative min-w-[240px] max-w-[280px] rounded-xl bg-card p-3 shadow-md transition-all ${borderColor} ${
        selected ? 'shadow-lg' : 'hover:border-primary/50'
      }`}
    >
      {/* Target Handle (Entrada) — Exceto em Gatilhos */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !bg-primary !border-2 !border-background"
        />
      )}

      {/* Header do Card */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg border ${badgeColor}`}>
            <IconComponent className="h-4 w-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {categoryLabel}
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground/60 truncate max-w-[80px]">
          {id}
        </span>
      </div>

      {/* Corpo do Nó */}
      <div className="pt-2">
        <h4 className="text-sm font-medium text-foreground leading-snug">
          {data.label || 'Novo Bloco'}
        </h4>
        {data.subtext && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {data.subtext}
          </p>
        )}

        {/* Prévia de Configuração */}
        <div className="mt-2 text-[11px] font-mono bg-muted/40 p-1.5 rounded border border-border/40 text-muted-foreground truncate">
          {data.cmd && <span>$ {data.cmd}</span>}
          {data.model && <span>Model: {data.model}</span>}
          {data.query && <span>Query: {data.query}</span>}
          {data.chat && <span>Telegram: @{data.chat}</span>}
          {data.trunk && <span>Trunk: {data.trunk}</span>}
          {data.phone && <span>Destino: {data.phone}</span>}
          {!data.cmd && !data.model && !data.query && !data.chat && !data.trunk && !data.phone && (
            <span className="italic opacity-60">Configuração padrão</span>
          )}
        </div>
      </div>

      {/* Source Handle (Saída) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
});

CustomNode.displayName = 'CustomNode';
