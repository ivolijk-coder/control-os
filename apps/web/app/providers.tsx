'use client';

import * as React from 'react';
import { QueryProvider } from '@/lib/query-client';
import { ThemeManager } from '@/components/layout/theme-manager';

/** Composição de todos os providers globais do CONTROL OS. */
export function Providers({ children }: { children: React.ReactNode }) {
  return <QueryProvider><ThemeManager />{children}</QueryProvider>;
}
