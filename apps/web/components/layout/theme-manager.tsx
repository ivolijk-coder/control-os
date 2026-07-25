'use client';

import * as React from 'react';
import { getThemePreference, type AppTheme } from '@/lib/theme-preferences';

/** Mantém a preferência visual entre páginas e novas sessões. */
export function ThemeManager() {
  React.useEffect(() => {
    document.documentElement.dataset.theme = getThemePreference();
    const onThemeChange = (event: Event) => {
      document.documentElement.dataset.theme = (event as CustomEvent<AppTheme>).detail;
    };
    window.addEventListener('control-os-theme-change', onThemeChange);
    return () => window.removeEventListener('control-os-theme-change', onThemeChange);
  }, []);

  return null;
}
