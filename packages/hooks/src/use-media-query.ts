import { useEffect, useState } from 'react';

/**
 * Hook de media query usado pelo sistema responsivo (Etapa 4/5: Desktop,
 * Notebook, Tablet, iPad, iPhone, Android). SSR-safe: retorna `false` até o
 * componente montar no cliente.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const listener = () => setMatches(mediaQueryList.matches);

    listener();
    mediaQueryList.addEventListener('change', listener);
    return () => mediaQueryList.removeEventListener('change', listener);
  }, [query]);

  return matches;
}
