import React, { useState, useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant
} from '@xyflow/react';
import type {
  Connection,
  Edge,
  Node,
  NodeChange,
  EdgeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import {
  Zap, Terminal, Database, Globe, Brain, BookOpen,
  Send, PhoneCall, Bot, Play, Save, ArrowLeft, CheckCircle2, AlertCircle, Trash2
} from 'lucide-react';

import { CustomNode } from './CustomNode';
import type { AgentFlow, FlowNodeData, FlowGraphData } from '../types';
import agentsClient from '../agentsClient';

interface FlowCanvasProps {
  flow: AgentFlow;
  onBack: () => void;
  onSaveSuccess: (updated: AgentFlow) => void;
  onOpenExecution: (execId: string) => void;
}

const nodeTypes = {
  triggerNode: CustomNode,
  actionNode: CustomNode,
  cognitiveNode: CustomNode,
  actuatorNode: CustomNode,
};

export const FlowCanvas: React.FC<FlowCanvasProps> = ({
  flow,
  onBack,
  onSaveSuccess,
  onOpenExecution
}) => {
  const initialNodes = useMemo(() => {
    return (flow.graph_data?.nodes || []).map((n) => ({
      id: n.id,
      type: n.type || 'actionNode',
      position: n.position || { x: 100, y: 100 },
      data: (n.data || { label: 'Bloco' }) as FlowNodeData,
    })) as Node<FlowNodeData>[];
  }, [flow]);

  const initialEdges = useMemo(() => {
    return (flow.graph_data?.edges || []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.animated ?? true,
      label: e.label,
    })) as Edge[];
  }, [flow]);

  const [nodes, setNodes] = useState<Node<FlowNodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [flowName, setFlowName] = useState(flow.name);
  const [flowDesc, setFlowDesc] = useState(flow.description || '');
  const [isActive, setIsActive] = useState(flow.is_active);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Manipulação de Nós
  const onNodesChange = useCallback(
    (changes: NodeChange<Node<FlowNodeData>>[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  // Manipulação de Arestas/Conexões
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    []
  );

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    []
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node<FlowNodeData>) => {
    setSelectedNodeId(node.id);
  }, []);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedNodeData = selectedNode?.data as FlowNodeData | undefined;

  // Atualização dos dados do nó selecionado
  const updateSelectedNodeData = (field: keyof FlowNodeData, value: any) => {
    if (!selectedNodeId) return;
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNodeId) {
          return {
            ...n,
            data: {
              ...(n.data as FlowNodeData),
              [field]: value,
            },
          };
        }
        return n;
      })
    );
  };

  const deleteSelectedNode = () => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNodeId));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  };

  // Adicionar novo bloco no canvas
  const addNode = (category: 'triggerNode' | 'actionNode' | 'cognitiveNode' | 'actuatorNode', subType: string, label: string) => {
    const newId = `node_${Date.now().toString().slice(-4)}`;
    const newNode: Node<FlowNodeData> = {
      id: newId,
      type: category,
      position: { x: 250 + Math.random() * 80, y: 150 + Math.random() * 80 },
      data: {
        label,
        subtext: `Configuração de ${subType}`,
        ...(category === 'triggerNode' ? { triggerType: subType as any } : {}),
        ...(category === 'actionNode' ? { actionType: subType as any } : {}),
        ...(category === 'cognitiveNode' ? { cognitiveType: subType as any } : {}),
        ...(category === 'actuatorNode' ? { actuatorType: subType as any } : {}),
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNodeId(newId);
  };

  // Salvar Fluxo
  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const graphData: FlowGraphData = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type || 'actionNode',
          position: n.position,
          data: n.data,
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          animated: !!e.animated,
          label: typeof e.label === 'string' ? e.label : undefined,
        })),
      };

      await agentsClient.put(`/api/flows/${flow.id}`, {
        name: flowName,
        description: flowDesc,
        is_active: isActive,
        graph_data: graphData,
      });

      setFeedback({ type: 'success', msg: 'Fluxo salvo com sucesso!' });
      onSaveSuccess({
        ...flow,
        name: flowName,
        description: flowDesc,
        is_active: isActive,
        graph_data: graphData,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.response?.data?.detail || 'Erro ao salvar fluxo.' });
    } finally {
      setSaving(false);
    }
  };

  // Testar / Executar Fluxo
  const handleRun = async () => {
    setRunning(true);
    setFeedback(null);
    try {
      const res = await agentsClient.post(`/api/flows/${flow.id}/run`, {
        trigger_source: 'live_canvas_test',
        trigger_data: { test_mode: true },
      });
      setFeedback({ type: 'success', msg: 'Fluxo disparado com sucesso! Abrindo timeline...' });
      if (res.data?.execution_id) {
        setTimeout(() => onOpenExecution(res.data.execution_id), 800);
      }
    } catch (err: any) {
      setFeedback({ type: 'error', msg: err.response?.data?.detail || 'Falha na execução do fluxo.' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] bg-background rounded-xl border border-border overflow-hidden">
      {/* Top Header / Actions */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            title="Voltar aos Fluxos"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              className="text-base font-semibold bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 text-foreground"
              placeholder="Nome do Fluxo"
            />
            <input
              type="text"
              value={flowDesc}
              onChange={(e) => setFlowDesc(e.target.value)}
              className="text-xs text-muted-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 block mt-0.5"
              placeholder="Descrição do fluxo de automação..."
            />
          </div>
        </div>

        {/* Botoes de Acao */}
        <div className="flex items-center gap-2">
          {feedback && (
            <span
              className={`text-xs px-2.5 py-1 rounded-md flex items-center gap-1.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                  : 'bg-destructive/10 text-destructive border border-destructive/20'
              }`}
            >
              {feedback.type === 'success' ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {feedback.msg}
            </span>
          )}

          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground mr-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-border"
            />
            Ativo
          </label>

          <button
            onClick={handleRun}
            disabled={running}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            <Play className={`h-3.5 w-3.5 ${running ? 'animate-spin' : ''}`} />
            {running ? 'Executando...' : 'Testar Fluxo ▶'}
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-colors disabled:opacity-50"
          >
            <Save className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
            {saving ? 'Salvando...' : 'Salvar Fluxo'}
          </button>
        </div>
      </div>

      {/* Main Flow Canvas Area */}
      <div className="flex flex-1 relative overflow-hidden">
        {/* Left Toolbox Panel */}
        <div className="w-56 border-r border-border bg-card p-3 flex flex-col gap-4 overflow-y-auto z-10">
          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" /> Gatilhos
            </h5>
            <div className="space-y-1.5">
              <button
                onClick={() => addNode('triggerNode', 'telecom_alert', 'Falha Telecom 0800')}
                className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-foreground flex items-center gap-2"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" /> Falha Telecom
              </button>
              <button
                onClick={() => addNode('triggerNode', 'cron', 'Agendamento Cron')}
                className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all text-foreground flex items-center gap-2"
              >
                <Zap className="h-3.5 w-3.5 text-amber-500" /> Temporizador
              </button>
            </div>
          </div>

          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Terminal className="h-3.5 w-3.5 text-blue-500" /> Coletores
            </h5>
            <div className="space-y-1.5">
              <button
                onClick={() => addNode('actionNode', 'ssh', 'Diagnóstico SSH')}
                className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-foreground flex items-center gap-2"
              >
                <Terminal className="h-3.5 w-3.5 text-blue-500" /> Comando SSH
              </button>
              <button
                onClick={() => addNode('actionNode', 'sql', 'Consulta SQL')}
                className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-foreground flex items-center gap-2"
              >
                <Database className="h-3.5 w-3.5 text-blue-500" /> Query SQL
              </button>
              <button
                onClick={() => addNode('actionNode', 'http', 'API HTTP REST')}
                className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-foreground flex items-center gap-2"
              >
                <Globe className="h-3.5 w-3.5 text-blue-500" /> Requisição HTTP
              </button>
            </div>
          </div>

          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-purple-500" /> Cognição & IA
            </h5>
            <div className="space-y-1.5">
              <button
                onClick={() => addNode('cognitiveNode', 'llm', 'Raciocínio IA')}
                className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-foreground flex items-center gap-2"
              >
                <Brain className="h-3.5 w-3.5 text-purple-500" /> Avaliação LLM
              </button>
              <button
                onClick={() => addNode('cognitiveNode', 'rag', 'Consulta RAG')}
                className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-foreground flex items-center gap-2"
              >
                <BookOpen className="h-3.5 w-3.5 text-purple-500" /> Manuais SOP
              </button>
            </div>
          </div>

          <div>
            <h5 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-emerald-500" /> Ações & Saída
            </h5>
            <div className="space-y-1.5">
              <button
                onClick={() => addNode('actuatorNode', 'telegram', 'Alerta Telegram')}
                className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-foreground flex items-center gap-2"
              >
                <Send className="h-3.5 w-3.5 text-emerald-500" /> Telegram
              </button>
              <button
                onClick={() => addNode('actuatorNode', 'asterisk_action', 'Comutar Rota Asterisk')}
                className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-foreground flex items-center gap-2"
              >
                <Bot className="h-3.5 w-3.5 text-emerald-500" /> Failover Asterisk
              </button>
              <button
                onClick={() => addNode('actuatorNode', 'voice_call', 'Chamada de Voz IA')}
                className="w-full text-left text-xs p-2 rounded-lg border border-border/60 hover:border-emerald-500/50 hover:bg-emerald-500/5 transition-all text-foreground flex items-center gap-2"
              >
                <PhoneCall className="h-3.5 w-3.5 text-emerald-500" /> Chamada de Voz
              </button>
            </div>
          </div>
        </div>

        {/* Center React Flow Surface */}
        <div className="flex-1 h-full relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            fitView
          >
            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
            <Controls />
            <MiniMap
              nodeStrokeWidth={3}
              className="!bg-card !border !border-border !rounded-lg"
            />
          </ReactFlow>
        </div>

        {/* Right Properties Drawer (Inspector) */}
        {selectedNode && selectedNodeData && (
          <div className="w-72 border-l border-border bg-card p-4 flex flex-col gap-4 overflow-y-auto z-10">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Propriedades do Bloco
              </h4>
              <button
                onClick={deleteSelectedNode}
                className="p-1 rounded text-destructive hover:bg-destructive/10 transition-colors"
                title="Excluir Bloco"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Título / Rótulo</label>
                <input
                  type="text"
                  value={selectedNodeData.label ?? ''}
                  onChange={(e) => updateSelectedNodeData('label', e.target.value)}
                  className="w-full text-xs mt-1 p-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary text-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground">Subtexto / Detalhe</label>
                <input
                  type="text"
                  value={selectedNodeData.subtext ?? ''}
                  onChange={(e) => updateSelectedNodeData('subtext', e.target.value)}
                  className="w-full text-xs mt-1 p-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary text-foreground"
                />
              </div>

              {/* Campos Condicionais conforme subtipo */}
              {selectedNodeData.actionType === 'ssh' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Comando Bash</label>
                  <textarea
                    rows={3}
                    value={selectedNodeData.cmd ?? ''}
                    onChange={(e) => updateSelectedNodeData('cmd', e.target.value)}
                    className="w-full text-xs font-mono mt-1 p-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary text-foreground"
                    placeholder="asterisk -rx 'pjsip show endpoints'"
                  />
                </div>
              )}

              {selectedNodeData.cognitiveType === 'llm' && (
                <>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Modelo de IA</label>
                    <select
                      value={selectedNodeData.model || 'gemini-2.5-flash'}
                      onChange={(e) => updateSelectedNodeData('model', e.target.value)}
                      className="w-full text-xs mt-1 p-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary text-foreground"
                    >
                      <option value="gemini-2.5-flash">Google Gemini 2.5 Flash</option>
                      <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                      <option value="gpt-4o-mini">OpenAI GPT-4o Mini</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Prompt de Instrução</label>
                    <textarea
                      rows={3}
                      value={selectedNodeData.prompt ?? ''}
                      onChange={(e) => updateSelectedNodeData('prompt', e.target.value)}
                      className="w-full text-xs mt-1 p-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary text-foreground"
                      placeholder="Avalie o log e decida a ação de contingência..."
                    />
                  </div>
                </>
              )}

              {selectedNodeData.cognitiveType === 'rag' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Consulta Semântica RAG</label>
                  <input
                    type="text"
                    value={selectedNodeData.query ?? ''}
                    onChange={(e) => updateSelectedNodeData('query', e.target.value)}
                    className="w-full text-xs mt-1 p-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary text-foreground"
                    placeholder="procedimento failover tronco sip"
                  />
                </div>
              )}

              {selectedNodeData.actuatorType === 'telegram' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Chat / Canal Telegram</label>
                  <input
                    type="text"
                    value={selectedNodeData.chat ?? ''}
                    onChange={(e) => updateSelectedNodeData('chat', e.target.value)}
                    className="w-full text-xs mt-1 p-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary text-foreground"
                    placeholder="NOC_TELECOM"
                  />
                </div>
              )}

              {selectedNodeData.actuatorType === 'asterisk_action' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Tronco de Contingência</label>
                  <input
                    type="text"
                    value={selectedNodeData.trunk ?? ''}
                    onChange={(e) => updateSelectedNodeData('trunk', e.target.value)}
                    className="w-full text-xs mt-1 p-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary text-foreground"
                    placeholder="TRUNK_BACKUP_TIM"
                  />
                </div>
              )}

              {selectedNodeData.actuatorType === 'voice_call' && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Ramal / Telefone Destino</label>
                  <input
                    type="text"
                    value={selectedNodeData.phone ?? ''}
                    onChange={(e) => updateSelectedNodeData('phone', e.target.value)}
                    className="w-full text-xs mt-1 p-2 rounded-lg border border-border bg-background focus:outline-none focus:border-primary text-foreground"
                    placeholder="9001"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
