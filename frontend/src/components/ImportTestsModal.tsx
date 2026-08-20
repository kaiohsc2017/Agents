import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import api, { getErrorMessage } from '../api/client'
import type { BusinessUnit, Client, Operation, Segment } from '../api/types'
import { Button } from '@/components/ui/button'
import { Upload, Download, FileSpreadsheet, X } from 'lucide-react'

// Extraído de ModuloConectividade.tsx para reduzir o tamanho do arquivo
// principal (limite de 800 linhas). Extração pura: mesma lógica e JSX,
// apenas movidos para um componente próprio com estado local do import.

interface ImportResult {
  importados: number
  erros: number
  detalhes: { linha: number; conteudo: string; erro: string }[]
}

interface ImportTestsModalProps {
  bus: BusinessUnit[]
  clients: Client[]
  operations: Operation[]
  segments: Segment[]
  onClose: () => void
  onImported: () => void
}

export function ImportTestsModal({ bus, clients, operations, segments, onClose, onImported }: ImportTestsModalProps) {
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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
      const res = await api.post<ImportResult>('/number-tests/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setImportResult(res.data)
      onImported()
    } catch (e) {
      alert(getErrorMessage(e, 'Erro ao importar arquivo.'))
    } finally {
      setImporting(false)
    }
  }

  const handleCloseClick = () => {
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseClick()
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
            onClick={handleCloseClick}
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
              <span className="text-xs font-mono font-medium text-primary truncate max-w-xs">{importFile.name}</span>
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
          <Button variant="outline" onClick={handleCloseClick}>
            Fechar
          </Button>
          <Button onClick={handleImport} disabled={!importFile || importing} className="font-semibold">
            {importing ? 'Importando...' : 'Processar Importação'}
          </Button>
        </div>
      </div>
    </div>
  )
}
