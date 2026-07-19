'use client';

import * as React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface HeroNovaCoreProps {
  colorHex: string;
  colorBrightHex: string;
}

const PARTICLE_COUNT = 90;

function createParticlePositions(count: number, minRadius: number, maxRadius: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = minRadius + Math.random() * (maxRadius - minRadius);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - 2 * Math.random());
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  return positions;
}

/**
 * CONTROL OS — Etapa 17 (Hero Scene R3F): núcleo energético da NOVA —
 * "Não quero desenhar uma orb. Quero renderizar um núcleo energético."
 * Quatro elementos reais em vez de partículas presas dentro de uma esfera
 * pintada: núcleo emissivo pequeno com luz de verdade (`pointLight`, não
 * uma mancha de cor), casca de energia com transmissão real (refração
 * calculada pelo motor físico do Three, não um gradiente imitando
 * profundidade), anéis orbitais em três eixos diferentes, e um campo de
 * partículas orbitando em volume real — profundidade de verdade (mais perto
 * da câmera é maior/mais nítido de fato, não uma ilusão calculada à mão
 * como no Canvas 2D). O halo em si é responsabilidade inteira do Bloom
 * (`nova-hero-scene.tsx`) — nenhum sprite de glow pintado aqui: "não quero
 * glow, quero emissão de energia."
 */
export function HeroNovaCore({ colorHex, colorBrightHex }: HeroNovaCoreProps) {
  const ringGroupA = React.useRef<THREE.Group>(null);
  const ringGroupB = React.useRef<THREE.Group>(null);
  const ringGroupC = React.useRef<THREE.Group>(null);
  const particlesRef = React.useRef<THREE.Points>(null);

  const particlePositions = React.useMemo(() => createParticlePositions(PARTICLE_COUNT, 1.15, 1.85), []);

  useFrame((_state, delta) => {
    if (ringGroupA.current) ringGroupA.current.rotation.z += delta * 0.35;
    if (ringGroupB.current) ringGroupB.current.rotation.x += delta * 0.22;
    if (ringGroupC.current) ringGroupC.current.rotation.y += delta * 0.28;
    if (particlesRef.current) particlesRef.current.rotation.y += delta * 0.06;
  });

  return (
    <group>
      {/* Núcleo emissivo — a fonte de luz real da cena, não uma mancha pintada. */}
      <mesh>
        <sphereGeometry args={[0.32, 32, 32]} />
        <meshBasicMaterial color={colorBrightHex} toneMapped={false} />
      </mesh>
      <pointLight color={colorHex} intensity={4} distance={4} decay={2} />

      {/* Casca de energia — transmissão real (refração), nunca um gradiente. */}
      <mesh>
        <sphereGeometry args={[0.92, 64, 64]} />
        <meshPhysicalMaterial
          color={colorHex}
          transmission={0.92}
          roughness={0.08}
          thickness={0.6}
          ior={1.35}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.1}
          emissive={colorHex}
          emissiveIntensity={0.18}
          envMapIntensity={1.6}
        />
      </mesh>

      {/* Anéis orbitais — três eixos diferentes, cada um girando num ritmo próprio. */}
      <group ref={ringGroupA} rotation={[Math.PI / 2.3, 0, 0]}>
        <mesh>
          <torusGeometry args={[1.25, 0.006, 8, 96]} />
          <meshBasicMaterial color={colorHex} toneMapped={false} transparent opacity={0.55} />
        </mesh>
      </group>
      <group ref={ringGroupB} rotation={[0, 0, Math.PI / 3.4]}>
        <mesh>
          <torusGeometry args={[1.45, 0.005, 8, 96]} />
          <meshBasicMaterial color={colorBrightHex} toneMapped={false} transparent opacity={0.4} />
        </mesh>
      </group>
      <group ref={ringGroupC} rotation={[Math.PI / 5, Math.PI / 6, 0]}>
        <mesh>
          <torusGeometry args={[1.05, 0.005, 8, 96]} />
          <meshBasicMaterial color={colorHex} toneMapped={false} transparent opacity={0.5} />
        </mesh>
      </group>

      {/* Campo de partículas — volume real (profundidade de verdade, não simulada). */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={colorBrightHex}
          size={0.02}
          sizeAttenuation
          transparent
          opacity={0.75}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
