import { dojoTheme } from './dojo';
import { magicTheme } from './magic';
import { gardenTheme } from './garden';
import { oceanTheme } from './ocean';
import type { ThemeId } from '@/types';

export const themes = {
  dojo: dojoTheme,
  magic: magicTheme,
  garden: gardenTheme,
  ocean: oceanTheme,
} as const;

export interface ThemeConfig {
  id: string;
  name: string;
  colors: {
    bgPrimary: string;
    bgSecondary: string;
    bgCard: string;
    textPrimary: string;
    textSecondary: string;
    accent1: string;
    accent2: string;
    accent3: string;
    accent4: string;
    accent5: string;
    border: string;
  };
  fonts: {
    display: string;
    body: string;
  };
}

export function getTheme(id: ThemeId): ThemeConfig {
  return themes[id];
}

export { dojoTheme, magicTheme, gardenTheme, oceanTheme };
