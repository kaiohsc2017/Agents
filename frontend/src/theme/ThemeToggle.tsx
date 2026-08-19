import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTheme, type Theme } from '@/theme/theme-context'

const NEXT_THEME: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

const THEME_LABELS: Record<Theme, string> = {
  light: 'Modo Claro',
  dark: 'Modo Escuro',
  system: 'Tema do Sistema',
}

const THEME_ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const Icon = THEME_ICONS[theme]
  const label = THEME_LABELS[theme]

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      onClick={() => setTheme(NEXT_THEME[theme])}
      className="text-muted-foreground hover:text-foreground"
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </Button>
  )
}
