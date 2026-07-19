'use client';

import * as React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
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

const NEAR_DUST_COUNT = 46;

function createNearDustPositions(): Float32Array {
  const positions = new Float32Array(NEAR_DUST_COUNT * 3);
  for (let i = 0; i < NEAR_DUST_COUNT; i += 1) {
    const radius = 3.2 + Math.random() * 3.4;
    const theta = Math.random() * Math.PI * 2;
    const y = (Math.random() - 0.5) * 5;
    positions[i * 3] = Math.cos(theta) * radius;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = Math.sin(theta) * radius;
  }
  return positions;
}

const GROUND_GLOW_SIZE = 128;

/** Textura de brilho no chão — gradiente radial por canvas, sem asset externo (mesmo princípio de `hero-nova-core.tsx`). */
function createGroundGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = GROUND_GLOW_SIZE;
  canvas.height = GROUND_GLOW_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const center = GROUND_GLOW_SIZE / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255,255,255,0.55)');
    gradient.addColorStop(0.5, 'rgba(255,255,255,0.14)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GROUND_GLOW_SIZE, GROUND_GLOW_SIZE);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
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
 *
 * CONTROL OS — Etapa 17B (Hero Art Direction): "ainda está limpo demais...
 * quero atmosfera, não quantidade." Dois elementos novos, os dois citados
 * literalmente no briefing: poeira PRÓXIMA da câmera (`<Stars>` já cobre a
 * poeira distante/de fundo — esta é uma segunda camada, mais perto, maior,
 * que gira bem mais devagar que o Hero Object, criando parallax de
 * profundidade) e um brilho no chão (`createGroundGlowTexture`, o mesmo
 * princípio de gradiente-por-canvas de `hero-nova-core.tsx`) vazando de sob
 * o pedestal — reforça "a luz nasce do pedestal" no PISO, não só no objeto.
 * O fog em si (`<fogExp2>`) é declarado em `nova-hero-scene.tsx`, não aqui
 * — fog só tem efeito quando anexado à cena raiz do Canvas, e este
 * componente é montado como um `<group>` (não a raiz), então ficaria sem
 * efeito se declarado dentro dele.
 */
export function HeroBackground({ colorHex }: HeroBackgroundProps) {
  const linePointsA = React.useMemo(() => buildEnergyLinePoints(2.6, 1, 0.4), []);
  const linePointsB = React.useMemo(() => buildEnergyLinePoints(3.1, -0.6, 2.1), []);
  const nearDustPositions = React.useMemo(() => createNearDustPositions(), []);
  const groundGlowTexture = React.useMemo(() => createGroundGlowTexture(), []);
  const nearDustRef = React.useRef<THREE.Points>(null);

  useFrame((_state, delta) => {
    if (nearDustRef.current) nearDustRef.current.rotation.y += delta * 0.015;
  });

  return (
    <group>
      <Stars radius={14} depth={30} count={260} factor={1.1} saturation={0} fade speed={0.15} />
      <Line points={linePointsA} color={colorHex} lineWidth={1} transparent opacity={0.12} />
      <Line points={linePointsB} color={colorHex} lineWidth={1} transparent opacity={0.08} />

      {/* Poeira próxima — segunda camada, mais perto, gira devagar: profundidade real por parallax. */}
      <points ref={nearDustRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[nearDustPositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.035}
          sizeAttenuation
          transparent
          opacity={0.35}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Brilho no chão — vaza de sob o pedestal, reforça a fonte de luz na base. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.59, 0]}>
        <planeGeometry args={[6, 6]} />
        <meshBasicMaterial
          map={groundGlowTexture}
          color={colorHex}
          transparent
          opacity={0.4}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
