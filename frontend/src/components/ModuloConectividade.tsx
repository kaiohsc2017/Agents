import { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import api, { getErrorMessage } from '../api/client'
import agentsApi from './agents/agentsClient'
import type {
  NumberTest,
  NumberTestCreate,
  TestResult,
  BusinessUnit,
  Client,
  Operation,
  Segment,
  PageResponse,
} from '../api/types'
import { HistoricoModal } from './HistoricoModal'
import { DashboardKPIs } from './DashboardKPIs'
import { TestModal } from './TestModal'
import { AudioQosBadge, type AudioQosData } from './shared/AudioQosBadge'
import { formatDate, nextExecution, getPeriodRange } from './connectivityHelpers'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  PhoneCall,
  Plus,
  Search,
  Upload,
  Download,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  X,
} from 'lucide-react'

const EMPTY_FORM: NumberTestCreate = {
  phoneNumber: '',
  businessUnit: { id: 0 },
  client: { id: 0 },
  operation: { id: 0 },
  segment: { id: 0 },
  startTime: '08:00:00',
  intervalMinutes: 60,
  quantity: 3,
  isActive: true,
}

export default function ModuloConectividade() {
  const [tab, setTab] = useState<'tests' | 'results' | 'dashboard'>('tests')
  const [tests, setTests] = useState<NumberTest[]>([])
  const [results, setResults] = useState<TestResult[]>([])
  const [bus, setBus] = useState<BusinessUnit[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [operations, setOperations] = useState<Operation[]>([])
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState<NumberTestCreate>({ ...EMPTY_FORM })
  const [editId, setEditId] = useState<number | null>(null)
  const [resPage, setResPage] = useState(0)
  const [resTotalPages, setResTotalPages] = useState(1)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterBu, setFilterBu] = useState('')
  const [filterClient, setFilterClient] = useState('')
  const [filterOperation, setFilterOperation] = useState('')
  const [filterSegment, setFilterSegment] = useState('')
  const [filterPeriod, setFilterPeriod] = useState<'today' | 'week' | 'month' | 'custom'>('month')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [histTest, setHistTest] = useState<NumberTest | null>(null)
  const [exporting, setExporting] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{
    importados: number
    erros: number
    detalhes: { linha: number; conteudo: string; erro: string }[]
  } | null>(null)
  const [search, setSearch] = useState('')
  const [qosMap, setQosMap] = useState<Record<number, AudioQosData>>({})
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadTests = () => {
    setLoading(true)
    api
      .get<NumberTest[]>('/number-tests')
      .then((r) => setTests(r.data))
      .catch((err) => {
        console.error('Erro ao carregar testes de conectividade:', err)
        setTests([])
      })
      .finally(() => setLoading(false))
  }

  const buildResultParams = (
    p = 0,
    status = filterStatus,
    period = filterPeriod,
    from = dateFrom,
    to = dateTo,
    bu = filterBu,
    client = filterClient,
    operation = filterOperation,
    segment = filterSegment
  ) => {
    const params = new URLSearchParams({ page: String(p), size: '30' })
    if (status) params.set('status', status)
    if (bu) params.set('businessUnitId', bu)
    if (client) params.set('clientId', client)
    if (operation) params.set('operationId', operation)
    if (segment) params.set('segmentId', segment)
    let fromVal = from,
      toVal = to
    if (period !== 'custom') {
      const r = getPeriodRange(period as 'today' | 'week' | 'month')
      fromVal = r.from
      toVal = r.to
    }
    if (fromVal) params.set('dateFrom', fromVal)
    if (toVal) params.set('dateTo', toVal)
    return params
  }

  const loadResults = (
    p = 0,
    status = filterStatus,
    period = filterPeriod,
    from = dateFrom,
    to = dateTo,
    bu = filterBu,
    client = filterClient,
    operation = filterOperation,
    segment = filterSegment
  ) => {
    setLoading(true)
    const params = buildResultParams(p, status, period, from, to, bu, client, operation, segment)
    api
      .get<PageResponse<TestResult>>(`/test-results?${params}`)
      .then((r) => {
        const list = r.data.content ?? []
        setResults(list)
        setResTotalPages(r.data.totalPages)
        setResPage(r.data.number)
        // Carrega métricas de QoS assincronamente
        for (const res of list) {
          agentsApi
            .get<AudioQosData>(`/api/audio-qos/test/${res.id}`)
            .then((q) => {
              if (q.data) setQosMap((prev: Record<number, AudioQosData>) => ({ ...prev, [res.id]: q.data }))
            })
            .catch(() => {})
        }
      })
      .catch((err) => console.error('Erro ao carregar resultados de conectividade:', err))
      .finally(() => setLoading(false))
  }

  const loadMasterData = () => {
    Promise.all([
      api.get<BusinessUnit[]>('/business-units?active=true'),
      api.get<Client[]>('/clients?active=true'),
      api.get<Operation[]>('/operations?active=true'),
      api.get<Segment[]>('/segments?active=true'),
    ])
      .then(([b, c, o, s]) => {
        setBus(b.data)
        setClients(c.data)
        setOperations(o.data)
        setSegments(s.data)
      })
      .catch((err) => console.error('Erro ao carregar dados mestres:', err))
  }

  useEffect(() => {
    loadMasterData()
    if (tab === 'tests') loadTests()
    else if (tab === 'results') loadResults()
  }, [tab])

  const openCreate = () => {
    setEditId(null)
    setForm({ ...EMPTY_FORM })
    setShowModal(true)
  }

  const openEdit = (t: NumberTest) => {
    setEditId(t.id)
    setForm({
      phoneNumber: t.phoneNumber,
      businessUnit: { id: t.businessUnit.id },
      client: { id: t.client.id },
      operation: { id: t.operation.id },
      segment: { id: t.segment.id },
      startTime: t.startTime,
      intervalMinutes: t.intervalMinutes,
      quantity: t.quantity,
      isActive: t.isActive,
    })
    setShowModal(true)
  }

  const save = async () => {
    if (!form.phoneNumber?.trim()) {
      alert('Informe o número de telefone.')
      return
    }
    if (!form.businessUnit?.id) {
      alert('Selecione a Business Unit.')
      return
    }
    if (!form.client?.id) {
      alert('Selecione o Cliente.')
      return
    }
    if (!form.operation?.id) {
      alert('Selecione a Operação.')
      return
    }
    if (!form.segment?.id) {
      alert('Selecione o Segmento.')
      return
    }
    if (!form.startTime) {
      alert('Informe o horário inicial.')
      return
    }
    if (!form.intervalMinutes || form.intervalMinutes < 1) {
      alert('Intervalo deve ser de ao menos 1 minuto.')
      return
    }
    if (!form.quantity || form.quantity < 1) {
      alert('Quantidade deve ser de ao menos 1.')
      return
    }
    try {
      if (editId) {
        await api.put(`/number-tests/${editId}`, form)
      } else {
        await api.post('/number-tests', form)
      }
      setShowModal(false)
      loadTests()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao salvar teste.'))
    }
  }

  const toggleActive = async (t: NumberTest) => {
    try {
      await api.put(`/number-tests/${t.id}`, {
        phoneNumber: t.phoneNumber,
        businessUnit: { id: t.businessUnit.id },
        client: { id: t.client.id },
        operation: { id: t.operation.id },
        segment: { id: t.segment.id },
        startTime: t.startTime,
        intervalMinutes: t.intervalMinutes,
        quantity: t.quantity,
        isActive: !t.isActive,
      })
      loadTests()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao alterar status.'))
    }
  }

  const deleteTest = async (id: number) => {
    if (!confirm('Deseja excluir este teste de conectividade?')) return
    try {
      await api.delete(`/number-tests/${id}`)
      loadTests()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao excluir teste.'))
    }
  }

  const handlePeriodFilter = (p: 'today' | 'week' | 'month') => {
    setFilterPeriod(p)
    setDateFrom('')
    setDateTo('')
    loadResults(0, filterStatus, p, '', '', filterBu, filterClient, filterOperation, filterSegment)
  }

  const handleCustomFilter = () => {
    if (dateFrom && dateTo) {
      setFilterPeriod('custom')
      loadResults(0, filterStatus, 'custom', dateFrom, dateTo, filterBu, filterClient, filterOperation, filterSegment)
    }
  }

  const exportConnectivity = async () => {
    setExporting(true)
    try {
      const params = buildResultParams(0, filterStatus, filterPeriod, dateFrom, dateTo, filterBu, filterClient, filterOperation, filterSegment)
      params.set('size', '10000')
      const res = await api.get<PageResponse<TestResult>>(`/test-results?${params}`)
      const data = res.data.content ?? []
      const rows = data.map((r) => ({
        ID: r.id,
        'Data Execução': formatDate(r.executedAt),
        Telefone: r.numberTest?.phoneNumber ?? '',
        BU: r.numberTest?.businessUnit?.name ?? '',
        Cliente: r.numberTest?.client?.name ?? '',
        Operação: r.numberTest?.operation?.name ?? '',
        Segmento: r.numberTest?.segment?.name ?? '',
        Status: r.status,
        'Código SIP': r.sipResponseCode ?? '',
        'Motivo SIP': r.sipResponseReason ?? '',
        Ordem: r.executionOrder,
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Resultados')
      XLSX.writeFile(wb, `conectividade_${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao exportar dados.'))
    } finally {
      setExporting(false)
    }
  }

  const downloadTemplate = () => {
    const wb = XLSX.utils.book_new()
    const templateData = [
      {
        telefone: '+5511999999999',
        bu: bus[0]?.name ?? 'BU Exemplo',
        cliente: clients[0]?.name ?? 'Cliente Exemplo',
        operacao: operations[0]?.name ?? 'Operação Exemplo',
        segmento: segments[0]?.name ?? 'Segmento Exemplo',
        horario_inicio: '08:00',
        intervalo_min: 60,
        quantidade: 3,
        ativo: 'sim',
      },
    ]
    const ws = XLSX.utils.json_to_sheet(templateData)
    XLSX.utils.book_append_sheet(wb, ws, 'Importação')
    XLSX.writeFile(wb, 'modelo_importacao_conectividade.xlsx')
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    setImportResult(null)
    const formData = new FormData()
    formData.append('file', importFile)
    try {
      const res = await api.post<{
        importados: number
        erros: number
        detalhes: { linha: number; conteudo: string; erro: string }[]
      }>('/number-tests/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(res.data)
      loadTests()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao importar arquivo.'))
    } finally {
      setImporting(false)
    }
  }

  const filteredTests = tests.filter(
    (t) =>
      t.phoneNumber.toLowerCase().includes(search.toLowerCase()) ||
      (t.client?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (t.businessUnit?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (t.operation?.name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Conectividade SIP & Discagens
          </h1>
          <p className="text-xs text-muted-foreground">
            Testes automatizados de rota e saúde telefônica por Unidade de Negócio e Operação
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/40 p-1 rounded-lg border border-border/60">
            <button
              onClick={() => setTab('tests')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                tab === 'tests'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Testes Cadastrados
            </button>
            <button
              onClick={() => setTab('results')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                tab === 'results'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Resultados
            </button>
            <button
              onClick={() => setTab('dashboard')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                tab === 'dashboard'
                  ? 'bg-card text-foreground shadow-2xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Dashboard KPIs
            </button>
          </div>

          {tab === 'tests' && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowImport(true)
                  setImportResult(null)
                }}
                className="font-semibold"
              >
                <Upload className="h-3.5 w-3.5 mr-1" />
                Importar
              </Button>
              <Button onClick={openCreate} className="font-semibold shadow-xs">
                <Plus className="h-4 w-4 mr-1" />
                Novo Teste
              </Button>
            </div>
          )}

          {tab === 'results' && (
            <Button
              variant="outline"
              size="sm"
              onClick={exportConnectivity}
              disabled={exporting}
              className="font-semibold"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              {exporting ? 'Exportando...' : 'Exportar CSV'}
            </Button>
          )}
        </div>
      </div>

      {/* ── Content: Tests Tab ── */}
      {tab === 'tests' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por telefone, cliente ou BU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2 border border-border/70 rounded-lg bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>
            <span className="text-xs text-muted-foreground self-end sm:self-center font-medium">
              Exibindo {filteredTests.length} de {tests.length} testes configurados
            </span>
          </div>

          <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Carregando testes configurados...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                    <tr>
                      <th className="py-3 px-4 w-16">#</th>
                      <th className="py-3 px-4">Número</th>
                      <th className="py-3 px-4">Unidade (BU)</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Operação</th>
                      <th className="py-3 px-4">Segmento</th>
                      <th className="py-3 px-4">Início</th>
                      <th className="py-3 px-4">Intervalo</th>
                      <th className="py-3 px-4">Qtd</th>
                      <th className="py-3 px-4">Próximo Teste</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {filteredTests.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-10 text-center text-muted-foreground">
                          Nenhum teste configurado.
                        </td>
                      </tr>
                    ) : (
                      filteredTests.map((t) => (
                        <tr
                          key={t.id}
                          className="hover:bg-muted/25 transition-colors cursor-pointer"
                          onClick={(e) => {
                            const target = e.target as HTMLElement
                            if (!target.closest('button')) setHistTest(t)
                          }}
                          title="Clique para ver histórico completo"
                        >
                          <td className="py-3 px-4 font-mono text-muted-foreground">{t.id}</td>
                          <td className="py-3 px-4 font-mono font-bold text-foreground">{t.phoneNumber}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-[10px] py-0">
                              {t.businessUnit?.name}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-foreground font-medium">{t.client?.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{t.operation?.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{t.segment?.name}</td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">{t.startTime?.slice(0, 5)}</td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">{t.intervalMinutes}m</td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">{t.quantity}×</td>
                          <td className="py-3 px-4 font-mono text-muted-foreground text-[11px]">
                            {t.isActive ? nextExecution(t.startTime, t.intervalMinutes) : '—'}
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={t.isActive ? 'success' : 'destructive'} className="text-[10px] py-0">
                              {t.isActive ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  openEdit(t)
                                }}
                                className="text-xs font-semibold text-primary hover:underline cursor-pointer"
                              >
                                Editar
                              </button>
                              <span className="text-border">·</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  toggleActive(t)
                                }}
                                className="text-xs font-semibold text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
                              >
                                {t.isActive ? 'Pausar' : 'Ativar'}
                              </button>
                              <span className="text-border">·</span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteTest(t.id)
                                }}
                                className="text-xs font-semibold text-destructive hover:underline cursor-pointer"
                              >
                                Excluir
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Content: Results Tab ── */}
      {tab === 'results' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border/70 bg-card shadow-xs">
            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border border-border/60">
              {(['today', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodFilter(p)}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                    filterPeriod === p
                      ? 'bg-card text-foreground shadow-2xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {p === 'today' ? 'Hoje' : p === 'week' ? 'Esta Semana' : 'Este Mês'}
                </button>
              ))}
            </div>

            <select
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value)
                loadResults(0, e.target.value, filterPeriod, dateFrom, dateTo, filterBu, filterClient, filterOperation, filterSegment)
              }}
            >
              <option value="">Todos os Status</option>
              {['SUCESSO', 'FALHA', 'OCUPADO', 'TIMEOUT', 'SEM_RESPOSTA', 'INVALIDO', 'INDISPONIVEL', 'RECUSADO'].map(
                (s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                )
              )}
            </select>

            <select
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filterBu}
              onChange={(e) => {
                setFilterBu(e.target.value)
                loadResults(0, filterStatus, filterPeriod, dateFrom, dateTo, e.target.value, filterClient, filterOperation, filterSegment)
              }}
            >
              <option value="">Todas as BUs</option>
              {bus.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  {b.name}
                </option>
              ))}
            </select>

            <select
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filterClient}
              onChange={(e) => {
                setFilterClient(e.target.value)
                loadResults(0, filterStatus, filterPeriod, dateFrom, dateTo, filterBu, e.target.value, filterOperation, filterSegment)
              }}
            >
              <option value="">Todos os Clientes</option>
              {clients.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filterOperation}
              onChange={(e) => {
                setFilterOperation(e.target.value)
                loadResults(0, filterStatus, filterPeriod, dateFrom, dateTo, filterBu, filterClient, e.target.value, filterSegment)
              }}
            >
              <option value="">Todas as Operações</option>
              {operations.map((o) => (
                <option key={o.id} value={String(o.id)}>
                  {o.name}
                </option>
              ))}
            </select>

            <select
              className="h-8 rounded-lg border border-border/70 bg-background px-2.5 py-1 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              value={filterSegment}
              onChange={(e) => {
                setFilterSegment(e.target.value)
                loadResults(0, filterStatus, filterPeriod, dateFrom, dateTo, filterBu, filterClient, filterOperation, e.target.value)
              }}
            >
              <option value="">Todos os Segmentos</option>
              {segments.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.name}
                </option>
              ))}
            </select>

            <input
              type="datetime-local"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 rounded-lg border border-border/70 bg-background px-2 py-1 text-xs text-foreground font-mono"
            />
            <span className="text-muted-foreground text-xs">→</span>
            <input
              type="datetime-local"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 rounded-lg border border-border/70 bg-background px-2 py-1 text-xs text-foreground font-mono"
            />
            <Button size="xs" onClick={handleCustomFilter} className="h-8 font-semibold">
              Filtrar
            </Button>
          </div>

          <div className="bg-card border border-border/70 rounded-xl overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                Carregando resultados de discagem...
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                    <tr>
                      <th className="py-3 px-4 w-16">#</th>
                      <th className="py-3 px-4">Execução</th>
                      <th className="py-3 px-4">Telefone</th>
                      <th className="py-3 px-4">BU</th>
                      <th className="py-3 px-4">Cliente</th>
                      <th className="py-3 px-4">Operação</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Qualidade (MOS)</th>
                      <th className="py-3 px-4">Código SIP</th>
                      <th className="py-3 px-4">Motivo SIP</th>
                      <th className="py-3 px-4 font-mono">Ordem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {results.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-10 text-center text-muted-foreground">
                          Nenhum resultado registrado para o filtro selecionado.
                        </td>
                      </tr>
                    ) : (
                      results.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/25 transition-colors">
                          <td className="py-3 px-4 font-mono text-muted-foreground">{r.id}</td>
                          <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground">
                            {formatDate(r.executedAt)}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-foreground">
                            {r.numberTest?.phoneNumber ?? '—'}
                          </td>
                          <td className="py-3 px-4">{r.numberTest?.businessUnit?.name ?? '—'}</td>
                          <td className="py-3 px-4 text-foreground">{r.numberTest?.client?.name ?? '—'}</td>
                          <td className="py-3 px-4 text-muted-foreground">{r.numberTest?.operation?.name ?? '—'}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                r.status === 'SUCESSO'
                                  ? 'success'
                                  : r.status === 'OCUPADO'
                                  ? 'warning'
                                  : 'destructive'
                              }
                              className="text-[10px] py-0"
                            >
                              {r.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <AudioQosBadge qos={qosMap[r.id]} size="sm" />
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">{r.sipResponseCode ?? '—'}</td>
                          <td className="py-3 px-4 text-muted-foreground truncate max-w-xs">
                            {r.sipResponseReason || '—'}
                          </td>
                          <td className="py-3 px-4 font-mono text-muted-foreground">#{r.executionOrder}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center justify-between p-3 border-t border-border/60 bg-muted/20">
              <span className="text-xs text-muted-foreground">
                Página {resPage + 1} de {resTotalPages || 1}
              </span>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="xs"
                  disabled={resPage === 0}
                  onClick={() => loadResults(resPage - 1)}
                  className="h-8"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="xs"
                  disabled={resPage >= resTotalPages - 1}
                  onClick={() => loadResults(resPage + 1)}
                  className="h-8"
                >
                  Próxima
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Content: Dashboard Tab ── */}
      {tab === 'dashboard' && <DashboardKPIs />}

      {/* Modals */}
      {showModal && (
        <TestModal
          editId={editId}
          form={form}
          setForm={setForm}
          bus={bus}
          clients={clients}
          operations={operations}
          segments={segments}
          onClose={() => setShowModal(false)}
          onSave={save}
        />
      )}

      {histTest && <HistoricoModal test={histTest} onClose={() => setHistTest(null)} />}

      {showImport && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowImport(false)
              setImportResult(null)
            }
          }}
        >
          <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">Importar Testes em Lote</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowImport(false)
                  setImportResult(null)
                }}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-muted/40 border border-border/60 text-xs text-muted-foreground space-y-1.5">
                <div className="font-semibold text-foreground">Instruções de Importação:</div>
                <ul className="list-disc pl-4 space-y-0.5">
                  <li>Baixe a planilha modelo e preencha os dados de teste</li>
                  <li>BU, Cliente, Operação e Segmento devem corresponder aos cadastros</li>
                  <li>Horário no formato HH:mm (ex: 08:00)</li>
                </ul>
              </div>

              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="text-xs">
                  <Download className="h-3.5 w-3.5 mr-1" />
                  Baixar Modelo .xlsx
                </Button>
                {importFile && (
                  <span className="text-xs font-mono font-medium text-primary truncate max-w-xs">
                    {importFile.name}
                  </span>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  setImportFile(e.target.files?.[0] ?? null)
                  setImportResult(null)
                }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-primary/60 rounded-xl p-6 text-center cursor-pointer transition-all bg-muted/10 hover:bg-muted/20"
              >
                <Upload className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-xs font-medium text-foreground">Clique para selecionar o arquivo da planilha</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Formatos suportados: .xlsx, .xls, .csv</p>
              </div>

              {importResult && (
                <div
                  className={`p-3.5 rounded-xl border text-xs ${
                    importResult.erros === 0
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                  }`}
                >
                  <p className="font-semibold">
                    Resultado: {importResult.importados} importados, {importResult.erros} erros.
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/60">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImport(false)
                  setImportResult(null)
                }}
              >
                Fechar
              </Button>
              <Button onClick={handleImport} disabled={!importFile || importing} className="font-semibold">
                {importing ? 'Importando...' : 'Processar Importação'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
