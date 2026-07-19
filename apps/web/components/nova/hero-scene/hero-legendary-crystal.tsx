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
 * `hero-crystal-geometry.ts`) com `MeshPhysicalMaterial`: `metalness` ALTO
 * (o "metal escovado dourado" pedido) domina a leitura da superfície,
 * `transmission` BAIXO (só um resquício de translucidez nas bordas, não uma
 * bola de vidro uniforme) e `clearcoat` (reflexo especular concentrado). O
 * Fresnel em si NUNCA é desenhado à mão aqui: nasce sozinho do jeito que
 * `transmission` + `ior` calculam a passagem de luz em ângulos rasos.
 *
 * CONTROL OS — v2 (após revisão visual do usuário): a v1 usava
 * `metalness=0.45`/`transmission=0.55` — o resultado lia como "plástico
 * dourado uniforme", sem o contraste de valor entre facetas claras/escuras
 * que faz metal parecer metal de verdade (superfícies metálicas refletem o
 * AMBIENTE, quase não têm cor própria — o contraste vem inteiramente de
 * quais facetas "veem" uma luz/lightformer e quais não). Corrigido subindo
 * `metalness` pra 0.82 (a superfície passa a responder quase só ao
 * ambiente/luzes, não a uma cor plana), derrubando `transmission` pra 0.12
 * (deixa de parecer uma bola de vidro por dentro) e subindo
 * `envMapIntensity` — junto com o reforço de intensidade das luzes em
 * `hero-lighting.tsx`, é isso que cria as facetas ora escuras ora acesas.
 *
 * Núcleo emissivo interno (pequena esfera dourada) + `pointLight` central —
 * "emissive interno... luz atravessando as extremidades". Arestas
 * reforçadas com `EdgesGeometry` (linhas finas douradas) — "reflexos nas
 * arestas", cada faceta lida com clareza mesmo à distância.
 */
export function HeroLegendaryCrystal({ colorHex, colorBrightHex }: HeroLegendaryCrystalProps) {
  const geometry = React.useMemo(() => createCrystalGeometry(), []);
  const edgesGeometry = React.useMemo(() => new THREE.EdgesGeometry(geometry, 1), [geometry]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color={colorHex}
          metalness={0.82}
          roughness={0.16}
          transmission={0.12}
          thickness={0.5}
          ior={1.5}
          clearcoat={1}
          clearcoatRoughness={0.06}
          emissive={colorHex}
          emissiveIntensity={0.06}
          envMapIntensity={2.6}
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
