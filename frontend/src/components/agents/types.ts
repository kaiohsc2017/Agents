export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

export type AgentType = 'ssh_test' | 'web_monitor' | 'log_monitor' | 'database';
export type AgentStatus = 'idle' | 'running' | 'success' | 'error' | 'partial' | 'paused';
export type ScheduleType = 'interval' | 'cron' | 'always' | 'once';

export interface AgentCheck {
  name?: string;
  cmd: string;
  expect?: string;
  fix_hint?: string;
}

export interface AgentRules {
  checks?: AgentCheck[];
  use_ai_on_failure?: boolean;
}

export interface AgentSchedule {
  type: ScheduleType;
  value?: string;
  active?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  type: AgentType;
  skill?: string;
  server_ids?: string[];
  target_urls?: string[];
  rules: AgentRules;
  schedule: AgentSchedule;
  notify_telegram?: boolean;
  telegram_chat?: string;
  notify_email?: boolean;
  notify_email_to?: string;
  notify_webhook?: boolean;
  notify_webhook_url?: string;
  status: AgentStatus;
  last_run?: string;
  next_run?: string;
}

export type AgentFormData = Omit<Agent, 'id' | 'status' | 'last_run' | 'next_run'>;

export type ServerAuthType = 'password' | 'key';

export interface ServerEntry {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  auth_type: ServerAuthType;
  password?: string;
  ssh_key?: string;
  tags: string[];
}

export interface ServerTestResult {
  ok: boolean;
  output?: string;
  error?: string;
}

export interface Execution {
  id: string;
  agent_id: string;
  agent_name: string;
  status: AgentStatus;
  passed_checks?: number;
  total_checks?: number;
  failed_checks?: number;
  duration_s?: number;
  started_at: string;
}

export interface LogEntry {
  ts: string;
  server?: string;
  level: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface DashboardSummary {
  active_agents: number;
  executions_24h: { ok: number; errors: number };
  alerts_24h: number;
  recent_executions: Execution[];
}

export interface PeriodRow {
  agent_name: string;
  total: number;
  ok: number;
  errors: number;
  avg_duration?: number;
  failures?: number;
}

export interface AlertEntry {
  id: string;
  agent_name: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  channel: string;
  message: string;
  sent_at: string;
}

export interface KnowledgeDoc {
  id: string;
  title?: string;
  filename: string;
  tags: string[];
  created_at: string;
}

export interface AgentSecret {
  id?: string;
  key: string;
  created_at: string;
}

export interface LlmStatus {
  ready: boolean;
  reason?: string;
  provider?: string;
  model?: string;
  enabled?: boolean;
  env_file?: string;
  file_exists?: boolean;
}

export interface LlmProvider {
  id: string;
  label?: string;
  models: string[];
}

export type LlmConfigForm = Record<string, string>;

export interface LlmTestResult {
  ok: boolean;
  provider?: string;
  model?: string;
  response?: string;
  error?: string;
}

// ── Flow Canvas (Pilar 5) ───────────────────────────────────────────────────

export interface FlowNodeData {
  label: string;
  subtext?: string;
  triggerType?: 'manual' | 'cron' | 'telecom_alert' | 'zabbix' | 'webhook' | 'audio_qos';
  actionType?: 'ssh' | 'sql' | 'http' | 'log' | 'audio_qos';
  cognitiveType?: 'llm' | 'rag' | 'condition';
  actuatorType?: 'telegram' | 'asterisk_action' | 'voice_call' | 'jira';
  cmd?: string;
  query?: string;
  url?: string;
  model?: string;
  prompt?: string;
  condition?: string;
  chat?: string;
  action?: string;
  trunk?: string;
  phone?: string;
  [key: string]: unknown;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: FlowNodeData;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  animated?: boolean;
  label?: string;
}

export interface FlowGraphData {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface AgentFlow {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_type: string;
  trigger_config: Record<string, any>;
  node_count?: number;
  graph_data?: FlowGraphData;
  created_at: string;
  updated_at?: string;
  created_by?: string;
}

export interface FlowExecutionStep {
  id: string;
  node_id: string;
  node_type: string;
  node_name?: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  input_payload?: Record<string, unknown>;
  output_payload?: Record<string, unknown>;
  duration_ms?: number;
  started_at: string;
  finished_at?: string;
}

export interface FlowExecution {
  id: string;
  flow_id: string;
  flow_name: string;
  trigger_source: string;
  status: 'running' | 'success' | 'failed' | 'partial';
  started_at: string;
  finished_at?: string;
  duration_s?: number;
  error_message?: string;
  context?: Record<string, any>;
}
