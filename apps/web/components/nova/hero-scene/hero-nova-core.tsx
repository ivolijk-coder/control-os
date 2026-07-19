'use client';

import * as React from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface HeroNovaCoreProps {
  colorHex: string;
  colorBrightHex: string;
}

const PARTICLE_COUNT = 150;

function createParticlePositions(count: number, minRadius: number, maxRadius: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const radius = minRadius + Math.random() * (maxRadius - minRadius);
    const theta = Math.random() * Math.PI * 2;
    // Viés equatorial (em vez de `acos(1 - 2*rand())`, que distribui
    // uniformemente numa ESFERA inteira) — concentra as partículas numa
    // faixa "de halo" ao redor do equador em vez de uma nuvem esférica
    // pareja, aproximando do anel de energia da referência visual em vez
    // de uma poeira genérica em todas as direções.
    const phi = Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.75;
    positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = radius * Math.cos(phi);
    positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
  }
  return positions;
}

const GLOW_TEXTURE_SIZE = 128;

/**
 * Textura de glow gerada por canvas 2D (gradiente radial puro, nenhum
 * arquivo externo) — o mesmo princípio já usado em `nova-orb.tsx` pros
 * halos pintados na versão Canvas 2D, agora alimentando um `<sprite>`
 * aditivo dentro da cena 3D em vez de um `ctx.arc` manual. Only ever
 * called client-side (este componente só existe atrás de
 * `next/dynamic({ ssr: false })`, ver `nova-hero-scene.tsx`).
 */
function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = GLOW_TEXTURE_SIZE;
  canvas.height = GLOW_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const center = GLOW_TEXTURE_SIZE / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(255,255,255,0.85)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.28)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GLOW_TEXTURE_SIZE, GLOW_TEXTURE_SIZE);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
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
 *
 * CONTROL OS — v2 (após revisão visual): a v1 lia como "uma bola azul lisa"
 * — o campo de partículas estava lá, mas pequeno/fraco demais pra aparecer
 * (`size=0.02`, ~90 pontos) e a casca de vidro (`transmission=0.92`, quase
 * transparência total) deixava a esfera parecer uniformemente iluminada por
 * dentro, sem nenhuma camada visível própria. Corrigido: partículas maiores
 * e mais numerosas (`size=0.055`, 150 pontos, opacidade mais alta) e a
 * casca com transmissão reduzida (0.65) + um pouco mais de rugosidade
 * (0.15) — ainda energia/vidro, mas com presença própria em vez de sumir.
 *
 * CONTROL OS — Etapa 17B (Hero Art Direction): "hoje continuo vendo uma
 * esfera azul... a esfera deve quase desaparecer... a energia deve existir
 * AO REDOR da esfera, não presa dentro dela." A casca de vidro (a maior
 * responsável pela leitura de "bola sólida", pelo tamanho e pelo brilho
 * especular do clearcoat) encolhe bastante (raio 0.92 → 0.52) e fica mais
 * transparente/mais fosca (`transmission` sobe, `clearcoatRoughness` sobe)
 * — deixa de competir com o resto. O que passa a carregar a leitura visual
 * é tudo que já existia AO REDOR dela, só que agora reforçado: o anel
 * principal fica bem mais espesso/brilhante (o "halo" da referência), as
 * partículas se afastam pra fora da casca com um viés equatorial (faixa de
 * halo, não nuvem esférica genérica) e ganham um `<sprite>` de glow aditivo
 * (gradiente gerado por canvas, sem asset externo) preso ao núcleo — o
 * "plasma" que a referência mostra como uma mancha de luz suave ao redor do
 * núcleo, não um degradê pintado na esfera em si.
 */
export function HeroNovaCore({ colorHex, colorBrightHex }: HeroNovaCoreProps) {
  const ringGroupA = React.useRef<THREE.Group>(null);
  const ringGroupB = React.useRef<THREE.Group>(null);
  const ringGroupC = React.useRef<THREE.Group>(null);
  const particlesRef = React.useRef<THREE.Points>(null);

  const particlePositions = React.useMemo(() => createParticlePositions(PARTICLE_COUNT, 1.0, 2.1), []);
  const glowTexture = React.useMemo(() => createGlowTexture(), []);

  useFrame((_state, delta) => {
    if (ringGroupA.current) ringGroupA.current.rotation.z += delta * 0.35;
    if (ringGroupB.current) ringGroupB.current.rotation.x += delta * 0.22;
    if (ringGroupC.current) ringGroupC.current.rotation.y += delta * 0.28;
    if (particlesRef.current) particlesRef.current.rotation.y += delta * 0.06;
  });

  return (
    <group>
      {/* Glow aditivo — o "plasma" ao redor do núcleo, não um degradê na esfera. */}
      <sprite scale={[2.4, 2.4, 1]}>
        <spriteMaterial
          map={glowTexture}
          color={colorBrightHex}
          transparent
          opacity={0.5}
          depthWrite={false}
          toneMapped={false}
          blending={THREE.AdditiveBlending}
        />
      </sprite>

      {/* Núcleo emissivo — a fonte de luz real da cena, não uma mancha pintada. */}
      <mesh>
        <sphereGeometry args={[0.24, 32, 32]} />
        <meshBasicMaterial color={colorBrightHex} toneMapped={false} />
      </mesh>
      <pointLight color={colorHex} intensity={4.5} distance={4} decay={2} />

      {/* Casca de energia — reduzida de propósito, quase invisível: só um resquício de vidro, nunca "a bola". */}
      <mesh>
        <sphereGeometry args={[0.52, 64, 64]} />
        <meshPhysicalMaterial
          color={colorHex}
          transmission={0.85}
          roughness={0.22}
          thickness={0.4}
          ior={1.35}
          metalness={0}
          clearcoat={0.6}
          clearcoatRoughness={0.25}
          emissive={colorHex}
          emissiveIntensity={0.14}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Anel principal — o "halo" da referência: mais espesso, mais brilhante, a peça que domina a leitura da forma. */}
      <group ref={ringGroupA} rotation={[Math.PI / 2.3, 0, 0]}>
        <mesh>
          <torusGeometry args={[1.55, 0.014, 8, 96]} />
          <meshBasicMaterial color={colorBrightHex} toneMapped={false} transparent opacity={0.85} />
        </mesh>
      </group>
      {/* Anéis secundários — mais finos e discretos, complementam sem competir com o anel principal. */}
      <group ref={ringGroupB} rotation={[0, 0, Math.PI / 3.4]}>
        <mesh>
          <torusGeometry args={[1.3, 0.005, 8, 96]} />
          <meshBasicMaterial color={colorHex} toneMapped={false} transparent opacity={0.3} />
        </mesh>
      </group>
      <group ref={ringGroupC} rotation={[Math.PI / 5, Math.PI / 6, 0]}>
        <mesh>
          <torusGeometry args={[0.85, 0.005, 8, 96]} />
          <meshBasicMaterial color={colorHex} toneMapped={false} transparent opacity={0.35} />
        </mesh>
      </group>

      {/* Campo de partículas — volume real, viés de halo equatorial, afastado da casca. */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={colorBrightHex}
          size={0.05}
          sizeAttenuation
          transparent
          opacity={0.9}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
