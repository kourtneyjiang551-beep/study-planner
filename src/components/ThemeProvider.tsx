'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { themes, type ThemeConfig } from '@/lib/themes';
import { themeTerms } from '@/lib/themes/terms';
import { db } from '@/lib/db/database';
import { DEFAULT_PROFILE_ID } from '@/lib/constants';
import type { ThemeId } from '@/types';

const THEME_STORAGE_KEY = 'study-planner-theme';

/** 主题 → 需要加载的 Google Font family 列表（dojo 已在 HTML 中预加载，无需重复） */
const THEME_FONTS: Record<ThemeId, string[]> = {
  dojo: [],
  magic: ['Baloo+2:wght@400;500;600;700'],
  garden: ['Baloo+2:wght@400;500;600;700', 'Quicksand:wght@400;500;600;700'],
  ocean: ['Fredoka:wght@400;500;600;700', 'Quicksand:wght@400;500;600;700'],
};

function loadThemeFonts(themeId: ThemeId) {
  const families = THEME_FONTS[themeId];
  if (families.length === 0) return;
  const w = window as unknown as { __loadThemeFont?: (families: string[]) => void };
  w.__loadThemeFont?.(families);
}

/** 同步读取 localStorage 缓存的主题（仅客户端） */
function getSavedTheme(): ThemeId {
  if (typeof window === 'undefined') return 'dojo';
  const saved = localStorage.getItem(THEME_STORAGE_KEY);
  if (saved && saved in themes) return saved as ThemeId;
  return 'dojo';
}

interface ThemeContextValue {
  themeId: ThemeId;
  theme: ThemeConfig;
  setTheme: (id: ThemeId) => void;
  t: (key: string) => string;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyThemeToDOM(themeId: ThemeId) {
  const theme = themes[themeId];
  const root = document.documentElement;

  root.setAttribute('data-theme', themeId);

  root.style.setProperty('--bg-primary', theme.colors.bgPrimary);
  root.style.setProperty('--bg-secondary', theme.colors.bgSecondary);
  root.style.setProperty('--bg-card', theme.colors.bgCard);
  root.style.setProperty('--text-primary', theme.colors.textPrimary);
  root.style.setProperty('--text-secondary', theme.colors.textSecondary);
  root.style.setProperty('--accent-1', theme.colors.accent1);
  root.style.setProperty('--accent-2', theme.colors.accent2);
  root.style.setProperty('--accent-3', theme.colors.accent3);
  root.style.setProperty('--accent-4', theme.colors.accent4);
  root.style.setProperty('--accent-5', theme.colors.accent5);
  root.style.setProperty('--border', theme.colors.border);
  root.style.setProperty('--font-display', theme.fonts.display);
  root.style.setProperty('--font-body', theme.fonts.body);

  // 按需加载主题字体
  loadThemeFonts(themeId);
}

export function ThemeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // 直接从 localStorage 初始化，避免 effect 内 setState 导致级联渲染
  const [themeId, setThemeId] = useState<ThemeId>(getSavedTheme);
  const [mounted, setMounted] = useState(false);

  // 客户端挂载：应用 DOM 样式 + IndexedDB 补位
  useEffect(() => {
    applyThemeToDOM(themeId);
    setMounted(true);

    // 后台从 IndexedDB 校验（localStorage 缺失时补位）
    if (!localStorage.getItem(THEME_STORAGE_KEY)) {
      db.profiles.get(DEFAULT_PROFILE_ID).then(profile => {
        if (profile?.current_theme) {
          setThemeId(profile.current_theme);
          applyThemeToDOM(profile.current_theme);
          localStorage.setItem(THEME_STORAGE_KEY, profile.current_theme);
        }
      }).catch((e: unknown) => {
        console.warn('[ThemeProvider] IndexedDB 主题补位失败:', e);
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 仅在挂载时执行
  }, []);

  // 主题变更时更新 DOM
  useEffect(() => {
    if (mounted) applyThemeToDOM(themeId);
  }, [themeId, mounted]);

  const setTheme = useCallback((id: ThemeId) => {
    setThemeId(id);
    localStorage.setItem(THEME_STORAGE_KEY, id);
    db.profiles.update(DEFAULT_PROFILE_ID, {
      current_theme: id,
      updated_at: new Date().toISOString(),
    }).catch((e: unknown) => {
      console.warn('[ThemeProvider] 主题持久化失败:', e);
    });
  }, []);

  const t = useCallback(
    (key: string) => themeTerms[themeId][key] ?? key,
    [themeId],
  );

  // 跟踪上一个主题 ID，用于切换动画
  const prevThemeRef = useRef(themeId);

  useEffect(() => {
    if (mounted && prevThemeRef.current !== themeId) {
      const fadeOut = document.createElement('div');
      fadeOut.style.cssText = 'position:fixed;inset:0;z-index:400;background:var(--bg-primary);transition:opacity 0.3s ease;pointer-events:none;';
      fadeOut.style.opacity = '1';
      document.body.appendChild(fadeOut);
      requestAnimationFrame(() => {
        fadeOut.style.opacity = '0';
        setTimeout(() => fadeOut.remove(), 300);
      });
    }
    prevThemeRef.current = themeId;
  }, [themeId, mounted]);

  return (
    <ThemeContext.Provider value={{ themeId, theme: themes[themeId], setTheme, t }}>
      <div
        style={mounted ? undefined : { opacity: 0 }}
        className={mounted ? 'theme-ready' : undefined}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function useThemeTerms() {
  const { t } = useTheme();
  return { t };
}
