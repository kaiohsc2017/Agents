import React, { useEffect, useState } from 'react';
import {
  X, CheckCircle2, AlertCircle, Clock, Terminal, Zap, Brain, Send,
  ChevronDown, ChevronRight, Activity
} from 'lucide-react';
import type { FlowExecution, FlowExecutionStep } from '../types';
import agentsClient from '../agentsClient';

interface FlowExecutionModalProps {
  executionId: string;
  onClose: () => void;
}

export const FlowExecutionModal: React.FC<FlowExecutionModalProps> = ({
  executionId,
  onClose,
}) => {
  const [execution, setExecution] = useState<FlowExecution | null>(null);
  const [steps, setSteps] = useState<FlowExecutionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const fetchDetails = async () => {
    try {
      setLoading(true);
      const res = await agentsClient.get(`/flows/executions/${executionId}/details`);
      setExecution(res.data.execution);
      setSteps(res.data.steps || []);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao carregar detalhes da execução.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [executionId]);

  const toggleStep = (stepId: string) => {
    setExpandedSteps((prev) => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const getStepIcon = (type: string) => {
    if (type === 'triggerNode') return <Zap className="h-4 w-4 text-amber-500" />;
    if (type === 'cognitiveNode') return <Brain className="h-4 w-4 text-purple-500" />;
    if (type === 'actuatorNode') return <Send className="h-4 w-4 text-emerald-500" />;
    return <Terminal className="h-4 w-4 text-blue-500" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-card w-full max-w-3xl rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">
                {execution?.flow_name || 'Detalhes da Execução'}
              </h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">
                ID: {executionId} · Origem: {execution?.trigger_source || 'manual'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground gap-2">
              <Clock className="h-4 w-4 animate-spin" /> Carregando linha do tempo da execução...
            </div>
          )}

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {!loading && execution && (
            <>
              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-card border border-border">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Status Geral</span>
                  <div className="flex items-center gap-1.5 mt-1">
                    {execution.status === 'success' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    )}
                    <span className="text-sm font-semibold capitalize text-foreground">
                      {execution.status}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-card border border-border">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Duração Total</span>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    {execution.duration_s != null ? `${execution.duration_s}s` : '—'}
                  </p>
                </div>

                <div className="p-3 rounded-lg bg-card border border-border">
                  <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Passos Executados</span>
                  <p className="text-sm font-semibold text-foreground mt-1">
                    {steps.length} nós concluídos
                  </p>
                </div>
              </div>

              {/* Timeline Steps */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  Sequência de Execução DAG
                </h4>

                <div className="space-y-2.5">
                  {steps.map((step, idx) => (
                    <div
                      key={step.id}
                      className="rounded-lg border border-border bg-muted/10 overflow-hidden transition-colors"
                    >
                      <button
                        onClick={() => toggleStep(step.id)}
                        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-muted/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-muted-foreground/60 w-4">
                            #{idx + 1}
                          </span>
                          <div className="p-1.5 rounded-md bg-card border border-border">
                            {getStepIcon(step.node_type)}
                          </div>
                          <div>
                            <span className="text-sm font-medium text-foreground">
                              {step.node_name || step.node_id}
                            </span>
                            <span className="text-xs font-mono text-muted-foreground ml-2">
                              ({step.node_id})
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground font-mono">
                            {step.duration_ms != null ? `${step.duration_ms}ms` : ''}
                          </span>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded font-medium ${
                              step.status === 'success'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-destructive/10 text-destructive border border-destructive/20'
                            }`}
                          >
                            {step.status}
                          </span>
                          {expandedSteps[step.id] ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {expandedSteps[step.id] && (
                        <div className="px-4 pb-3 pt-1 border-t border-border/50 bg-background/50 space-y-2">
                          {step.output_payload && (
                            <div>
                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Payload de Saída (JSON Context)
                              </span>
                              <pre className="mt-1 p-2 rounded bg-muted/40 border border-border/60 text-[11px] font-mono text-foreground overflow-x-auto max-h-40">
                                {JSON.stringify(step.output_payload, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border bg-muted/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium rounded-lg border border-border bg-card hover:bg-muted text-foreground transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
