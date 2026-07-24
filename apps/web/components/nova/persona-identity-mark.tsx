'use client';

import Image from 'next/image';

export type PersonaIdentity = 'nova' | 'legendary';

export interface PersonaIdentityMarkProps {
  persona?: PersonaIdentity;
  size?: number;
  className?: string;
}

const PERSONA_MARK_ASSET: Record<PersonaIdentity, string> = {
  nova: '/personas/nova-launcher-c.png',
  legendary: '/personas/legendary-launcher-c.png',
};

/**
 * Marca oficial reduzida dos ambientes do CONTROL OS.
 *
 * Usa as versões em vidro aprovadas para manter a mesma identidade visual
 * no seletor, nas mensagens, na navegação e em qualquer outro contexto.
 */
export function PersonaIdentityMark({ persona = 'nova', size = 28, className }: PersonaIdentityMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden rounded-full ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <Image src={PERSONA_MARK_ASSET[persona]} alt="" fill sizes={`${size}px`} className="object-cover" />
    </span>
  );
}
