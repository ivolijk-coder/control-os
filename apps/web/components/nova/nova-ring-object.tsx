'use client';

import * as React from 'react';
import { HERO_PERSONA_COLOR, HERO_PERSONA_COLOR_BRIGHT } from './hero-scene/hero-scene-constants';

export interface NovaRingObjectProps {
  className?: string;
  /**
   * Diâmetro do anel externo, em px. Padrão `190` — o tamanho original do
   * Hero Object grande em `/nova`. Todas as outras medidas (espessura das
   * bordas, inset do anel interno, tamanho do "N") são proporcionais a
   * este valor, pra reaproveitar o MESMO objeto em qualquer escala — ex.:
   * `NovaFloatingLauncher` usa um tamanho pequeno pro botão flutuante,
   * "o mesmo objeto, materiais, iluminação e animações da página da NOVA".
   */
  size?: number;
}

/**
 * CONTROL OS — HERO SCENE REBOOT: Hero Object da NOVA fora do React Three
 * Fiber. Réplica fiel do mockup `control-os-dashboard.html` enviado pelo
 * usuário ("eu quero ele só na parte da NOVA, no dashboard dela") — um
 * anel HUD flat, em CSS puro, sem geometria 3D, sem partículas, sem
 * pedestal, sem glow decorativo além do que já está no mockup. A mesma
 * direção da referência Trilha.ia que motivou o REBOOT: "uma imagem só de
 * luz".
 *
 * LEGENDARY continua usando `NovaHeroScene` (R3F) — a troca de tecnologia
 * é só para NOVA por decisão explícita do usuário (ver `nova-hero-stage.tsx`,
 * o componente que decide qual dos dois montar).
 *
 * Cores reaproveitam os tokens já estabelecidos em `hero-scene-constants.ts`
 * (`HERO_PERSONA_COLOR`/`HERO_PERSONA_COLOR_BRIGHT.nova`) em vez de
 * introduzir um segundo sistema de cor paralelo com os hex literais do
 * mockup — mesmo azul/ciano que já aparece em toda a NOVA (Orb 2D, seletor
 * de persona, Hero Scene 3D).
 */

/** Converte `#rrggbb` em `rgba(r, g, b, alpha)` — só usado aqui, mesmo padrão de helper local isolado por arquivo já usado em `hero-scene/*.tsx`. */
function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16);
  const g = parseInt(value.substring(2, 4), 16);
  const b = parseInt(value.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Tamanho de referência (px) — todas as proporções abaixo foram medidas em cima deste valor original. */
const BASE_SIZE = 190;

export function NovaRingObject({ className, size = BASE_SIZE }: NovaRingObjectProps) {
  const color = HERO_PERSONA_COLOR.nova;
  const colorBright = HERO_PERSONA_COLOR_BRIGHT.nova;
  const scale = size / BASE_SIZE;

  return (
    <div className={`relative flex h-full w-full items-center justify-center ${className ?? ''}`}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* ring-outer — anel de casca escura, o brilho vem só do box-shadow. */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: `${9 * scale}px solid #10151d`,
            boxShadow: `0 0 0 1px ${hexToRgba(color, 0.15)}, 0 0 ${50 * scale}px ${hexToRgba(color, 0.35)}, inset 0 0 ${24 * scale}px ${hexToRgba(color, 0.15)}`,
          }}
        />
        {/* ring-arc — arco HUD parado (posição fixa, sem rotação), igual ao mockup. */}
        <div
          className="absolute rounded-full"
          style={{
            inset: -3 * scale,
            border: `${2 * scale}px solid transparent`,
            borderTopColor: color,
            borderRightColor: hexToRgba(color, 0.35),
            filter: `drop-shadow(0 0 ${6 * scale}px ${color})`,
          }}
        />
        {/* ring-inner */}
        <div
          className="absolute rounded-full"
          style={{
            inset: 35 * scale,
            border: `${1.5 * scale}px solid ${hexToRgba(color, 0.5)}`,
            boxShadow: `0 0 ${16 * scale}px ${hexToRgba(color, 0.25)}`,
          }}
        />
        {/* core-n */}
        <div
          className="absolute inset-0 flex items-center justify-center font-semibold"
          style={{ fontSize: 34 * scale, color: colorBright, textShadow: `0 0 ${16 * scale}px ${hexToRgba(color, 0.7)}` }}
        >
          N
        </div>
      </div>
    </div>
  );
}
