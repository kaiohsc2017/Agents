import { useEffect, useRef, useState } from 'react';
import { BookOpen, Upload, Trash2, RefreshCw, FileText, Clock } from 'lucide-react';
import agentsApi, { getErrorMessage } from './agentsClient';
import type { KnowledgeDoc, PaginatedResponse } from './types';
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

export default function AgentsKnowledge({ canWrite = true }: { canWrite?: boolean }) {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [flashMsg, setFlashMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const flashMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Limpa o timer da mensagem flash ao desmontar, evitando setState em componente já desmontado.
  useEffect(() => {
    return () => {
      if (flashMsgTimerRef.current) clearTimeout(flashMsgTimerRef.current);
    };
  }, []);

  const notify = (text: string, type: 'success' | 'error' = 'success') => {
    setFlashMsg({ type, text });
    if (flashMsgTimerRef.current) clearTimeout(flashMsgTimerRef.current);
    flashMsgTimerRef.current = setTimeout(() => {
      flashMsgTimerRef.current = null;
      setFlashMsg(null);
    }, 4000);
  };

  const load = () => {
    setLoading(true);
    agentsApi
      .get<PaginatedResponse<KnowledgeDoc> | KnowledgeDoc[]>('/api/knowledge/?limit=200')
      .then(({ data }) => setDocs(Array.isArray(data) ? data : data.items))
      .catch((err) => notify(getErrorMessage(err, 'Erro ao carregar base de conhecimento.'), 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      notify('Por favor, selecione um arquivo em formato PDF.', 'error');
      return;
    }

    setUploading(true);
    const fd = new FormData();
    fd.append('file', file);

    agentsApi
      .post<KnowledgeDoc>('/api/knowledge/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then(({ data }) => {
        setDocs((prev) => [...prev, data]);
        notify(`Documento "${file.name}" indexado com sucesso na base de conhecimento!`);
      })
      .catch((err) => notify(getErrorMessage(err, 'Falha ao processar e indexar PDF.'), 'error'))
      .finally(() => {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      });
  };

  const handleDelete = (doc: KnowledgeDoc) => {
    if (!window.confirm(`Remover documento "${doc.filename}" da base vetorial?`)) return;
    agentsApi
      .delete(`/api/knowledge/${doc.id}`)
      .then(() => {
        notify('Documento removido da base vetorial!');
        setDocs((prev) => prev.filter((x) => x.id !== doc.id));
      })
      .catch((err) => notify(getErrorMessage(err, 'Erro ao remover documento.'), 'error'));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Base de Conhecimento (RAG)</h1>
            <Badge variant="outline" className="text-xs font-mono">
              {docs.length} Documento{docs.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manuais técnicos, SOPs e documentação de arquitetura consultados por IA em diagnósticos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="h-9 gap-1.5 font-medium">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>

          {canWrite && (
            <>
              <Button
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="h-9 gap-1.5 font-semibold bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer"
              >
                <Upload className={`h-4 w-4 ${uploading ? 'animate-bounce' : ''}`} />
                {uploading ? 'Indexando...' : 'Adicionar PDF'}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
            </>
          )}
        </div>
      </div>

      {flashMsg && (
        <div
          className={`p-3.5 rounded-lg text-xs font-medium border flex items-center justify-between animate-in slide-in-from-top duration-200 ${
            flashMsg.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
              : 'bg-destructive/10 border-destructive/20 text-destructive'
          }`}
        >
          <span>{flashMsg.text}</span>
          <button onClick={() => setFlashMsg(null)} className="cursor-pointer font-bold ml-2">
            ×
          </button>
        </div>
      )}

      {/* Info Card */}
      <Card className="border-border/60 bg-muted/10">
        <CardContent className="p-4 flex items-start gap-3">
          <BookOpen className="h-5 w-5 text-primary shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-semibold text-foreground">Como funciona a Base RAG?</p>
            <p className="text-muted-foreground leading-relaxed">
              Os arquivos PDF carregados são fragmentados em chunks semânticos e indexados via embeddings no PostgreSQL com extensão pgvector. Quando um agente autônomo encontra falhas durante verificações, o motor de IA consulta essa base para propor correções cirúrgicas e diagnósticos assertivos.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Docs Table */}
      <Card className="shadow-xs border-border/70 overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow>
                <TableHead className="font-semibold text-xs">Arquivo</TableHead>
                <TableHead className="font-semibold text-xs">Título / Identificador</TableHead>
                <TableHead className="font-semibold text-xs">Tags</TableHead>
                <TableHead className="font-semibold text-xs">Indexado em</TableHead>
                <TableHead className="font-semibold text-xs text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-2" />
                    Carregando documentos indexados...
                  </TableCell>
                </TableRow>
              ) : docs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-sm text-muted-foreground">
                    Nenhum documento PDF cadastrado na base de conhecimento.
                  </TableCell>
                </TableRow>
              ) : (
                docs.map((doc) => (
                  <TableRow key={doc.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium text-xs text-foreground">
                        <FileText className="h-4 w-4 text-rose-500 shrink-0" />
                        <span className="font-mono">{doc.filename}</span>
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {doc.title || doc.filename.replace('.pdf', '')}
                    </TableCell>

                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {doc.tags && doc.tags.length > 0 ? (
                          doc.tags.map((t) => (
                            <Badge key={t} variant="secondary" className="text-[10px] py-0">
                              {t}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">geral</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(doc.created_at).toLocaleString('pt-BR')}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      {canWrite && (
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => handleDelete(doc)}
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
