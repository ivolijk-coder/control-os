'use client';

import * as React from 'react';
import * as THREE from 'three';
import { Line, Stars } from '@react-three/drei';

interface HeroBackgroundProps {
  colorHex: string;
}

function buildEnergyLinePoints(radius: number, tilt: number, seed: number): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  const segments = 24;
  for (let i = 0; i <= segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    const wobble = Math.sin(t * 3 + seed) * 0.08;
    const x = Math.cos(t) * (radius + wobble);
    const z = Math.sin(t) * (radius + wobble);
    const y = Math.sin(t * 2 + seed) * 0.35 * tilt;
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

/**
 * CONTROL OS — Etapa 17 (Hero Scene R3F): ambiente ao redor do Hero Object
 * — "fundo espacial extremamente discreto... poeira espacial... campo
 * gravitacional... linhas de energia." `<Stars>` (drei) com contagem baixa
 * e `fade` ligado faz a poeira — gerada proceduralmente, sem baixar nenhuma
 * textura externa. As "linhas de energia" são curvas fechadas ao redor do
 * objeto (`<Line>`, drei), quase invisíveis (opacidade baixa) — o mesmo
 * princípio das "linhas gravitacionais" da versão Canvas 2D (Etapa 16K),
 * agora como geometria 3D de verdade em vez de um arco desenhado em 2D.
 */
export function HeroBackground({ colorHex }: HeroBackgroundProps) {
  const linePointsA = React.useMemo(() => buildEnergyLinePoints(2.6, 1, 0.4), []);
  const linePointsB = React.useMemo(() => buildEnergyLinePoints(3.1, -0.6, 2.1), []);

  return (
    <group>
      <Stars radius={14} depth={30} count={260} factor={1.1} saturation={0} fade speed={0.15} />
      <Line points={linePointsA} color={colorHex} lineWidth={1} transparent opacity={0.12} />
      <Line points={linePointsB} color={colorHex} lineWidth={1} transparent opacity={0.08} />
    </group>
  );
}
