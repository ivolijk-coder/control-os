import * as THREE from 'three';

/**
 * CONTROL OS — Etapa 17B (Hero Art Direction): geometria do cristal da
 * LEGENDARY — evoluída de uma bipirâmide simples (Etapa 17) pra um corte de
 * gema de 4 anéis (coroa / bezel superior / bezel inferior / pavilhão), o
 * mesmo princípio construtivo de um lapidário real: "quase nenhuma face
 * deve possuir a mesma iluminação." Uma bipirâmide lisa só tem DUAS
 * inclinações de normal (coroa e pavilhão) — o suficiente pra ler como "um
 * octaedro dourado", nunca como "um artefato tecnológico raro". Com 4 anéis
 * e uma faixa "antiprisma" (cada anel girado meio-setor em relação ao
 * vizinho, como um corte brilhante de diamante de verdade) o número de
 * inclinações de normal distintas sobe de 2 pra dezenas — é ISSO que faz
 * cada faceta pegar luz de um jeito diferente da vizinha, não um truque de
 * shader.
 *
 * Geometria NÃO-indexada de propósito (mesmo princípio da Etapa 17): cada
 * triângulo recebe seus 3 vértices próprios, então `computeVertexNormals()`
 * calcula uma normal genuinamente PLANA por face — sem tabela de
 * sombreamento manual, é o motor físico do Three (`MeshPhysicalMaterial`)
 * que resolve o contraste lendo a normal real da geometria.
 */
const CRYSTAL_SIDES = 8;
const FULL_STEP = (Math.PI * 2) / CRYSTAL_SIDES;
const HALF_STEP = FULL_STEP / 2;

const APEX_TOP_Y = 1.3;
const APEX_BOTTOM_Y = -1.15;
const CROWN_Y = 0.55;
const CROWN_RADIUS = 0.72;
const GIRDLE_Y = 0;
const GIRDLE_RADIUS = 1.0;
const PAVILION_Y = -0.62;
const PAVILION_RADIUS = 0.5;

type Point3 = readonly [number, number, number];

function buildRing(radius: number, y: number, phase: number): Point3[] {
  return Array.from({ length: CRYSTAL_SIDES }, (_, i) => {
    const theta = phase + (i / CRYSTAL_SIDES) * Math.PI * 2;
    return [Math.cos(theta) * radius, y, Math.sin(theta) * radius] as const;
  });
}

/**
 * Faixa "antiprisma" entre dois anéis girados meio-setor um em relação ao
 * outro — cada `ringB[i]` fica angularmente ENTRE `ringA[i]` e
 * `ringA[i+1]`, então a faixa fecha em `2 * CRYSTAL_SIDES` triângulos sem
 * nenhum buraco, alternando a orientação da normal a cada triângulo (o
 * "zigue-zague" que um corte de gema real usa pra multiplicar facetas).
 * A ordem de enrolamento (winding) não precisa ser perfeita aqui: o
 * material usa `side: THREE.DoubleSide` (ver `hero-legendary-crystal.tsx`)
 * exatamente pra não depender de acertar a direção da normal fora pra
 * dentro nesta construção geométrica — o próprio Three corrige o sinal da
 * normal por fragmento conforme o lado visível.
 */
function pushAntiprismBand(positions: number[], ringA: Point3[], ringB: Point3[]): void {
  for (let i = 0; i < CRYSTAL_SIDES; i += 1) {
    const a0 = ringA[i] ?? [0, 0, 0];
    const a1 = ringA[(i + 1) % CRYSTAL_SIDES] ?? [0, 0, 0];
    const b0 = ringB[i] ?? [0, 0, 0];
    const b1 = ringB[(i + 1) % CRYSTAL_SIDES] ?? [0, 0, 0];
    positions.push(...a0, ...b0, ...a1);
    positions.push(...a1, ...b0, ...b1);
  }
}

export function createCrystalGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];

  const topApex: Point3 = [0, APEX_TOP_Y, 0];
  const bottomApex: Point3 = [0, APEX_BOTTOM_Y, 0];
  const crownRing = buildRing(CROWN_RADIUS, CROWN_Y, 0);
  const girdleRing = buildRing(GIRDLE_RADIUS, GIRDLE_Y, HALF_STEP);
  // Fase = HALF_STEP + HALF_STEP (não 0!) — `pushAntiprismBand` exige que
  // ringB fique HALF_STEP à FRENTE de ringA em ângulo; como `girdleRing`
  // já está em HALF_STEP, o pavilhão precisa estar em 2×HALF_STEP, não de
  // volta em 0. Fase 0 aqui era um bug real: cada `pavilionRing[i]` ficava
  // atrás de `girdleRing[i]` em vez de entre `girdleRing[i]` e
  // `girdleRing[i+1]`, produzindo triângulos torcidos/autointerceptantes
  // nessa faixa — a causa mais provável do cristal ter sumido de tela.
  const pavilionRing = buildRing(PAVILION_RADIUS, PAVILION_Y, FULL_STEP);

  // Coroa — ápice de cima fechando no anel da coroa.
  for (let i = 0; i < CRYSTAL_SIDES; i += 1) {
    const a = crownRing[i] ?? [0, 0, 0];
    const b = crownRing[(i + 1) % CRYSTAL_SIDES] ?? [0, 0, 0];
    positions.push(...topApex, ...a, ...b);
  }

  // Bezel superior — coroa até a cintura (girada meio-setor: "torção" nº 1).
  pushAntiprismBand(positions, crownRing, girdleRing);

  // Bezel inferior — cintura até o pavilhão (torção nº 2, mais um meio-setor).
  pushAntiprismBand(positions, girdleRing, pavilionRing);

  // Pavilhão — anel do pavilhão fechando no ápice de baixo.
  for (let i = 0; i < CRYSTAL_SIDES; i += 1) {
    const a = pavilionRing[i] ?? [0, 0, 0];
    const b = pavilionRing[(i + 1) % CRYSTAL_SIDES] ?? [0, 0, 0];
    positions.push(...bottomApex, ...b, ...a);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
