// Changelog estático do sistema — mantido manualmente a cada lote de mudanças
// (sem leitura de git em runtime, sem endpoint de backend). Exibido na tela de
// Release Notes (Release.tsx). Ordem: mais recente primeiro é responsabilidade
// de quem consome este array (ver Release.tsx).
//
// O conteúdo foi dividido em releases-part1.ts (v1 a v1.44) e
// releases-part2.ts (v1.45 em diante) para respeitar o limite de 800 linhas
// por arquivo — este arquivo só concatena as partes e preserva a mesma
// exportação pública (`RELEASES`) para não quebrar quem já importa daqui.

import { RELEASES_PART1 } from './releases-part1';
import { RELEASES_PART2 } from './releases-part2';

export interface ReleaseEntry {
  version: string;
  date: string; // YYYY-MM-DD
  changes: string[];
}

export const RELEASES: ReleaseEntry[] = [...RELEASES_PART1, ...RELEASES_PART2];
