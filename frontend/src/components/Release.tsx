import { RELEASES } from '../data/releases'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Calendar, CheckCircle2 } from 'lucide-react'

function formatDate(s: string) {
  const [year, month, day] = s.split('-')
  return `${day}/${month}/${year}`
}

export default function Release() {
  const releasesDesc = [...RELEASES].reverse()

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Notas de Release & Changelog
          </h1>
          <p className="text-xs text-muted-foreground">
            Histórico contínuo de atualizações, novas features e melhorias de segurança da plataforma
          </p>
        </div>
      </div>

      {/* ── Timeline of Releases ── */}
      <div className="space-y-4">
        {releasesDesc.map((release, rIdx) => (
          <Card key={release.version} className="shadow-xs border-border/70">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2.5">
                <Badge variant={rIdx === 0 ? 'default' : 'secondary'} className="font-mono text-xs font-bold py-0.5 px-2.5">
                  v{release.version}
                </Badge>
                {rIdx === 0 && (
                  <Badge variant="success" className="text-[10px] py-0">
                    Versão Atual
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(release.date)}
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <ul className="space-y-2">
                {release.changes.map((change, idx) => (
                  <li key={idx} className="text-xs text-foreground/90 flex items-start gap-2 leading-relaxed">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{change}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
