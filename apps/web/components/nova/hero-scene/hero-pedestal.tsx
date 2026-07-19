'use client';

import * as React from 'react';
import * as THREE from 'three';
import { MeshReflectorMaterial } from '@react-three/drei';

interface HeroPedestalProps {
  colorHex: string;
  colorBrightHex: string;
}

const RING_COUNT = 4;
const BASE_Y = -1.6;
const CHANNEL_COUNT = 12;

interface PedestalChannelsProps {
  radius: number;
  y: number;
  height: number;
  color: string;
}

/**
 * CONTROL OS — Etapa 17B (Hero Art Direction): "canaletas emissivas" — uma
 * fileira de barras verticais finas ao redor de cada nível do pedestal,
 * como as réguas de refrigeração/energia de uma máquina de verdade, não só
 * um anel liso. `instancedMesh` porque são estáticas (calculadas uma vez,
 * nunca recalculadas por frame) — uma única draw call pras `CHANNEL_COUNT`
 * barras de cada nível em vez de `CHANNEL_COUNT` meshes separados.
 */
function PedestalChannels({ radius, y, height, color }: PedestalChannelsProps) {
  const meshRef = React.useRef<THREE.InstancedMesh>(null);

  React.useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < CHANNEL_COUNT; i += 1) {
      const theta = (i / CHANNEL_COUNT) * Math.PI * 2;
      matrix.makeRotationY(-theta);
      matrix.setPosition(Math.cos(theta) * radius, y, Math.sin(theta) * radius);
      mesh.setMatrixAt(i, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [radius, y]);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, CHANNEL_COUNT]}>
      <boxGeometry args={[0.022, height, 0.05]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </instancedMesh>
  );
}

/**
 * CONTROL OS — Etapa 17 (Hero Scene R3F): pedestal tecnológico — "o Hero
 * Object nunca poderá parecer flutuando no vazio. Toda energia nasce do
 * pedestal." Anéis concêntricos empilhados (metal escuro, ligeiramente mais
 * estreitos a cada nível) com uma frincha emissiva fina entre cada um —
 * mesma cor da persona que ilumina o objeto principal (`hero-lighting.tsx`
 * usa exatamente esta posição pra `pointLight`), reforçando "o pedestal
 * ilumina o ambiente" como fato arquitetural da cena, não só um desenho.
 *
 * CONTROL OS — v2 (após revisão visual): a v1 tinha os cilindros quase
 * preto-puro (`#0a0a0c`) — contra um fundo também preto, eles ficavam
 * invisíveis, e só as tiras emissivas finas apareciam (lia como "arcos
 * flutuando", não uma base sólida). Corrigido clareando o metal (ainda
 * escuro, mas capaz de pegar luz), aumentando a altura de cada degrau (mais
 * silhueta visível) e engordando/clareando as tiras emissivas
 * (`colorBrightHex`, mais fácil de estourar o limiar do Bloom).
 *
 * Piso com `MeshReflectorMaterial` (drei) — reflexo real e barato (não é
 * uma segunda câmera renderizando a cena de novo), propositalmente borrado
 * (`blur` alto, `mirror` baixo) pra ficar como sugestão de superfície
 * polida, nunca um espelho nítido competindo com o Hero Object.
 *
 * CONTROL OS — Etapa 17B (Hero Art Direction): "hoje ainda parece um
 * suporte. Quero uma máquina." Três acréscimos por nível, cada um um
 * substantivo literal do briefing: `PedestalChannels` são as "canaletas
 * emissivas" (barras verticais, não um anel liso); o toro escuro logo
 * abaixo do toro brilhante é o "sulco" (a borda recuada que separa a tira
 * de luz do corpo metálico, como uma peça usinada de verdade teria); e o
 * tom de metal alterna entre dois cinzas quase-pretos a cada nível — muito
 * sutil pra chamar atenção sozinho, mas o suficiente pra cada degrau deixar
 * de ser uma cópia idêntica do vizinho. Uma segunda `pointLight` na base
 * reforça "a luz nasce dali" em mais de uma altura, não só no topo.
 */
export function HeroPedestal({ colorHex, colorBrightHex }: HeroPedestalProps) {
  return (
    <group position={[0, BASE_Y, 0]}>
      {Array.from({ length: RING_COUNT }, (_, i) => {
        const radius = 1.9 - i * 0.32;
        const height = 0.2;
        const y = i * height;
        const metalColor = i % 2 === 0 ? '#1c1c20' : '#151519';
        return (
          <group key={i}>
            <mesh position={[0, y, 0]}>
              <cylinderGeometry args={[radius, radius * 1.08, height, 48]} />
              <meshStandardMaterial color={metalColor} metalness={0.9} roughness={0.24} />
            </mesh>
            <PedestalChannels radius={radius * 1.005} y={y} height={height * 0.72} color={colorBrightHex} />
            {/* Sulco — borda escura recuada, logo abaixo da tira emissiva. */}
            <mesh position={[0, y + height / 2 - 0.01, 0]}>
              <torusGeometry args={[radius * 0.965, 0.01, 8, 64]} />
              <meshStandardMaterial color="#050505" metalness={0.7} roughness={0.5} />
            </mesh>
            {/* Anel emissivo — a tira de luz que corre no topo de cada nível. */}
            <mesh position={[0, y + height / 2 + 0.006, 0]}>
              <torusGeometry args={[radius * 0.98, 0.022, 8, 64]} />
              <meshBasicMaterial color={colorBrightHex} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
      <pointLight position={[0, RING_COUNT * 0.2 + 0.3, 0]} intensity={2} color={colorHex} distance={4} decay={2} />
      <pointLight position={[0, 0.04, 0]} intensity={1.1} color={colorHex} distance={2.6} decay={2} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <circleGeometry args={[9, 64]} />
        <MeshReflectorMaterial
          mirror={0.15}
          blur={[300, 100]}
          resolution={512}
          mixBlur={1}
          mixStrength={2}
          roughness={0.9}
          depthScale={1}
          minDepthThreshold={0.85}
          color="#050505"
          metalness={0.6}
        />
      </mesh>
    </group>
  );
}
