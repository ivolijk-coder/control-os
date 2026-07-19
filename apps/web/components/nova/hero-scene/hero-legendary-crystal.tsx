'use client';

import * as React from 'react';
import * as THREE from 'three';
import { createCrystalGeometry } from './hero-crystal-geometry';

interface HeroLegendaryCrystalProps {
  colorHex: string;
  colorBrightHex: string;
}

/**
 * CONTROL OS — Etapa 17 (Hero Scene R3F): cristal da LEGENDARY — "Não quero
 * desenhar um cristal. Quero renderizar um cristal." Geometria real (ver
 * `hero-crystal-geometry.ts`) com `MeshPhysicalMaterial`: `transmission`
 * (refração simulada de verdade pelo motor físico), `metalness` moderado (o
 * "metal escovado dourado" pedido ao lado do vidro), `clearcoat` (reflexo
 * especular concentrado), `thickness` (espessura aparente) e
 * `envMapIntensity` alto (reflexos reais da luz sintética em
 * `hero-lighting.tsx`). O Fresnel em si NUNCA é desenhado à mão aqui: nasce
 * sozinho do jeito que `transmission` + `ior` calculam a passagem de luz em
 * ângulos rasos — que é exatamente o que "Fresnel" significa fisicamente,
 * ao contrário do traço de borda aproximado da versão Canvas 2D.
 *
 * Núcleo emissivo interno (pequena esfera dourada) + `pointLight` central —
 * "emissive interno... luz atravessando as extremidades": a luz do núcleo
 * atravessa o material translúcido de dentro pra fora. Arestas reforçadas
 * com `EdgesGeometry` (linhas finas douradas) — "reflexos nas arestas",
 * cada faceta lida com clareza mesmo à distância, nunca some num
 * amontoado de triângulos indistintos.
 */
export function HeroLegendaryCrystal({ colorHex, colorBrightHex }: HeroLegendaryCrystalProps) {
  const geometry = React.useMemo(() => createCrystalGeometry(), []);
  const edgesGeometry = React.useMemo(() => new THREE.EdgesGeometry(geometry, 1), [geometry]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color={colorHex}
          metalness={0.45}
          roughness={0.12}
          transmission={0.55}
          thickness={0.7}
          ior={1.5}
          clearcoat={1}
          clearcoatRoughness={0.08}
          emissive={colorHex}
          emissiveIntensity={0.12}
          envMapIntensity={1.8}
        />
      </mesh>

      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color={colorBrightHex} transparent opacity={0.5} toneMapped={false} />
      </lineSegments>

      <mesh>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshBasicMaterial color={colorBrightHex} toneMapped={false} />
      </mesh>
      <pointLight color={colorHex} intensity={3.2} distance={3.5} decay={2} />
    </group>
  );
}
