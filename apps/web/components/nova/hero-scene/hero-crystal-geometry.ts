import * as THREE from 'three';

/**
 * CONTROL OS — Etapa 17 (Hero Scene R3F): geometria do cristal da
 * LEGENDARY — uma bipirâmide octogonal simétrica (8 faces na coroa, 8 no
 * pavilhão, como um corte de gema), o mesmo princípio geométrico da versão
 * Canvas 2D (`nova-orb.tsx`, `buildCrystalGeometry`), agora como um sólido
 * REAL do Three.js em vez de triângulos pintados manualmente por frame.
 *
 * Geometria NÃO-indexada de propósito: cada triângulo recebe seus 3
 * vértices próprios (nunca compartilhados entre faces) — isso faz
 * `computeVertexNormals()` calcular uma normal genuinamente PLANA por face
 * (não uma média suavizada entre faces vizinhas), então cada faceta do
 * cristal responde à luz de forma independente e nítida — "cada face deve
 * responder à iluminação de forma diferente" — sem precisar de nenhuma
 * tabela de sombreamento manual: é o próprio motor de iluminação físico do
 * Three (`MeshPhysicalMaterial`) que resolve isso, lendo a normal real da
 * geometria.
 */
const CRYSTAL_SIDES = 8;
const CRYSTAL_APEX_HEIGHT = 1.2;
const CRYSTAL_GIRDLE_RADIUS = 0.95;

export function createCrystalGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];

  const topApex: readonly [number, number, number] = [0, CRYSTAL_APEX_HEIGHT, 0];
  const bottomApex: readonly [number, number, number] = [0, -CRYSTAL_APEX_HEIGHT, 0];
  const girdle: Array<readonly [number, number, number]> = Array.from({ length: CRYSTAL_SIDES }, (_, i) => {
    const theta = (i / CRYSTAL_SIDES) * Math.PI * 2;
    return [Math.cos(theta) * CRYSTAL_GIRDLE_RADIUS, 0, Math.sin(theta) * CRYSTAL_GIRDLE_RADIUS] as const;
  });

  const pushTriangle = (
    a: readonly [number, number, number],
    b: readonly [number, number, number],
    c: readonly [number, number, number]
  ) => {
    positions.push(...a, ...b, ...c);
  };

  for (let i = 0; i < CRYSTAL_SIDES; i += 1) {
    const next = (i + 1) % CRYSTAL_SIDES;
    const gi = girdle[i] ?? [0, 0, 0];
    const gn = girdle[next] ?? [0, 0, 0];
    // Coroa (topo) — ápice de cima + duas arestas consecutivas do anel.
    pushTriangle(topApex, gi, gn);
    // Pavilhão (base) — ápice de baixo, ordem invertida pra manter a
    // normal (calculada por `computeVertexNormals`) apontando pra fora.
    pushTriangle(bottomApex, gn, gi);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
