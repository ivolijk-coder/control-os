'use client';

import * as React from 'react';
import { MeshReflectorMaterial } from '@react-three/drei';

interface HeroPedestalProps {
  colorHex: string;
}

const RING_COUNT = 4;
const BASE_Y = -1.6;

/**
 * CONTROL OS — Etapa 17 (Hero Scene R3F): pedestal tecnológico — "o Hero
 * Object nunca poderá parecer flutuando no vazio. Toda energia nasce do
 * pedestal." Anéis concêntricos empilhados (metal escuro, ligeiramente mais
 * estreitos a cada nível) com uma frincha emissiva fina entre cada um —
 * mesma cor da persona que ilumina o objeto principal (`hero-lighting.tsx`
 * usa exatamente esta posição pra `pointLight`), reforçando "o pedestal
 * ilumina o ambiente" como fato arquitetural da cena, não só um desenho.
 *
 * Piso com `MeshReflectorMaterial` (drei) — reflexo real e barato (não é
 * uma segunda câmera renderizando a cena de novo), propositalmente borrado
 * (`blur` alto, `mirror` baixo) pra ficar como sugestão de superfície
 * polida, nunca um espelho nítido competindo com o Hero Object.
 */
export function HeroPedestal({ colorHex }: HeroPedestalProps) {
  return (
    <group position={[0, BASE_Y, 0]}>
      {Array.from({ length: RING_COUNT }, (_, i) => {
        const radius = 1.9 - i * 0.32;
        const height = 0.12;
        const y = i * height;
        return (
          <group key={i}>
            <mesh position={[0, y, 0]}>
              <cylinderGeometry args={[radius, radius * 1.08, height, 48]} />
              <meshStandardMaterial color="#0a0a0c" metalness={0.85} roughness={0.32} />
            </mesh>
            <mesh position={[0, y + height / 2 + 0.004, 0]}>
              <torusGeometry args={[radius * 0.98, 0.01, 8, 64]} />
              <meshBasicMaterial color={colorHex} toneMapped={false} />
            </mesh>
          </group>
        );
      })}

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
