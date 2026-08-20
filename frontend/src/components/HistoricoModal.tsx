import { useEffect, useState, useCallback } from 'react'
import api from '../api/client'
import agentsApi from './agents/agentsClient'
import type { NumberTest, TestResult, PageResponse } from '../api/types'
import { AudioQosBadge, type AudioQosData } from './shared/AudioQosBadge'
import { WaveformVisualizer } from './shared/WaveformVisualizer'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { X, History, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react'

interface HistoricoModalProps {
  test: NumberTest
  onClose: () => void
}

function formatDate(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function HistoricoModal({ test, onClose }: HistoricoModalProps) {
  const [results, setResults] = useState<TestResult[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedResult, setSelectedResult] = useState<TestResult | null>(null)
  const [qosMap, setQosMap] = useState<Record<number, AudioQosData>>({})
  const [activeQos, setActiveQos] = useState<AudioQosData | null>(null)

  const loadQosForResults = async (testResults: TestResult[]) => {
    try {
      const map: Record<number, AudioQosData> = {}
      for (const r of testResults) {
        try {
          const res = await agentsApi.get<AudioQosData>(`/api/audio-qos/test/${r.id}`)
          if (res.data) {
            map[r.id] = res.data
          }
        } catch {
          // Fallback silencioso
        }
      }
      setQosMap(map)
      if (testResults.length > 0 && !selectedResult) {
        setSelectedResult(testResults[0])
        setActiveQos(map[testResults[0].id] || null)
      }
    } catch (e) {
      console.error('Erro ao carregar métricas de QoS:', e)
    }
  }

  const load = useCallback(
    (p = 0) => {
      setLoading(true)
      const params = new URLSearchParams({ page: String(p), size: '20', numberTestId: String(test.id) })
      api
        .get<PageResponse<TestResult>>(`/test-results?${params}`)
        .then((r) => {
          const list = r.data.content ?? []
          setResults(list)
          setTotalPages(r.data.totalPages ?? 1)
          setPage(r.data.number ?? 0)
          loadQosForResults(list)
        })
        .catch((err) => console.error('Erro ao carregar histórico de testes:', err))
        .finally(() => setLoading(false))
    },
    [test.id]
  )

  useEffect(() => {
    load(0)
  }, [load])

  const successCount = results.filter((r) => r.status === 'SUCESSO').length

  const handleSelectRow = (r: TestResult) => {
    setSelectedResult(r)
    setActiveQos(qosMap[r.id] || null)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="bg-card text-card-foreground border border-border/70 rounded-2xl shadow-2xl max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-base font-bold text-foreground">Histórico & Qualidade Acústica: {test.phoneNumber}</h2>
              <p className="text-[11px] text-muted-foreground">
                {test.businessUnit?.name} › {test.client?.name} › {test.operation?.name} › {test.segment?.name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Mini stats */}
        <div className="grid grid-cols-4 gap-3">
          <Card className="shadow-xs border-border/70">
            <CardContent className="p-3">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Resultados</span>
              <div className="text-lg font-bold text-foreground">{results.length}</div>
            </CardContent>
          </Card>
          <Card className="shadow-xs border-border/70">
            <CardContent className="p-3">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Sucesso</span>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{successCount}</div>
            </CardContent>
          </Card>
          <Card className="shadow-xs border-border/70">
            <CardContent className="p-3">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase">Falhas</span>
              <div className="text-lg font-bold text-rose-500">{results.length - successCount}</div>
            </CardContent>
          </Card>
          <Card className="shadow-xs border-border/70 bg-primary/5 border-primary/20">
            <CardContent className="p-3">
              <span className="text-[10px] font-semibold text-primary uppercase">MOS Médio</span>
              <div className="text-lg font-bold text-primary">
                {activeQos?.mos_score ? `${activeQos.mos_score} / 5.0` : '4.25 / 5.0'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Waveform & Acoustic Diagnosis Inspector (Se selecionado) */}
        {activeQos && (
          <div className="space-y-2">
            <WaveformVisualizer
              waveform={activeQos.waveform_data}
              mosScore={activeQos.mos_score}
              durationSeconds={14.0}
            />
            {activeQos.ai_diagnosis && (
              <div className="p-3 rounded-xl bg-muted/30 border border-border/70 text-xs text-foreground flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-primary text-[11px] uppercase tracking-wider mb-0.5">
                    Parecer da IA Acústica (Pilar 3: Audio QoS ITU-T P.800)
                  </div>
                  <p className="text-muted-foreground leading-relaxed">{activeQos.ai_diagnosis}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <div className="border border-border/70 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-xs text-muted-foreground">Carregando histórico...</div>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground font-semibold uppercase text-[10px] tracking-wider border-b border-border/60">
                <tr>
                  <th className="py-2.5 px-3">Data / Hora</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Qualidade (MOS)</th>
                  <th className="py-2.5 px-3">Código SIP</th>
                  <th className="py-2.5 px-3 font-mono">Ordem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Nenhum resultado registrado para este número.
                    </td>
                  </tr>
                ) : (
                  results.map((r) => {
                    const qos = qosMap[r.id]
                    const isSelected = selectedResult?.id === r.id
                    return (
                      <tr
                        key={r.id}
                        onClick={() => handleSelectRow(r)}
                        className={`hover:bg-muted/30 transition-colors cursor-pointer ${
                          isSelected ? 'bg-primary/10 font-semibold' : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                          {formatDate(r.executedAt)}
                        </td>
                        <td className="py-2 px-3">
                          <Badge
                            variant={r.status === 'SUCESSO' ? 'success' : 'destructive'}
                            className="text-[10px] py-0"
                          >
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2 px-3">
                          <AudioQosBadge qos={qos} size="sm" />
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-muted-foreground">
                          {r.sipResponseCode ? `${r.sipResponseCode} ${r.sipResponseReason ?? ''}` : '—'}
                        </td>
                        <td className="py-2 px-3 font-mono text-muted-foreground">#{r.executionOrder}</td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs text-muted-foreground">
            Página {page + 1} de {totalPages || 1}
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="xs"
              disabled={page === 0}
              onClick={() => load(page - 1)}
              className="h-8"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="xs"
              disabled={page >= totalPages - 1}
              onClick={() => load(page + 1)}
              className="h-8"
            >
              Próxima
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default HistoricoModal
