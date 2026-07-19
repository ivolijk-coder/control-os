'use client';

import * as React from 'react';
import * as THREE from 'three';
import { Billboard } from '@react-three/drei';
import { createCrystalGeometry } from './hero-crystal-geometry';

interface HeroLegendaryCrystalProps {
  colorHex: string;
  colorBrightHex: string;
}

const GLYPH_TEXTURE_SIZE = 256;

/**
 * Textura de glifo holográfico ("L") gerada por canvas 2D — mesmo princípio
 * de `hero-nova-core.tsx` (duplicado aqui de propósito: cada arquivo da
 * Hero Scene fica autocontido, sem um módulo compartilhado extra só pra
 * uma função de ~15 linhas). Nenhuma fonte externa, nenhum asset de rede.
 */
function createGlyphTexture(letter: string, color: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = GLYPH_TEXTURE_SIZE;
  canvas.height = GLYPH_TEXTURE_SIZE;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const center = GLYPH_TEXTURE_SIZE / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${GLYPH_TEXTURE_SIZE * 0.56}px system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = GLYPH_TEXTURE_SIZE * 0.16;
    ctx.fillText(letter, center, center * 1.03);
    ctx.shadowBlur = 0;
    ctx.fillText(letter, center, center * 1.03);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
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
 *
 * CONTROL OS — v3 (após revisão em vídeo): o núcleo interno (esfera
 * `meshBasicMaterial` sem tone mapping + `pointLight intensity=3.2`) estava
 * forte demais — o Bloom (`nova-hero-scene.tsx`) estourava esse ponto num
 * halo grande que engolia o cristal inteiro, lendo como "uma lâmpada âmbar
 * em forma de diamante" em vez de facetas metálicas distintas respondendo
 * à luz EXTERNA (`hero-lighting.tsx`). O núcleo continua existindo — "luz
 * atravessando as extremidades" ainda é real — mas menor e mais fraco, pra
 * ser um detalhe interno em vez de dominar a leitura da forma inteira.
 *
 * CONTROL OS — Etapa 17B (Hero Art Direction): "não pinte o cristal,
 * construa um material." Quatro propriedades novas em relação ao v3, cada
 * uma resolvendo um pedido literal do briefing: `attenuationColor` +
 * `attenuationDistance` fazem a luz que atravessa a transmissão perder
 * saturação/brilho conforme a espessura óptica real do sólido — "interior
 * mais escuro, absorção interna" sem escurecer a superfície em si.
 * `anisotropy` alonga o reflexo especular numa direção só (em vez de um
 * ponto de brilho redondo) — a assinatura visual de metal escovado de
 * precisão, não vidro genérico. `envMapIntensity` mais alto + `roughness`
 * mais baixo concentram ainda mais o reflexo ("reflexos extremamente
 * concentrados"). E `side: THREE.DoubleSide` é uma decisão técnica, não
 * artística: com a geometria de 4 anéis (`hero-crystal-geometry.ts`) não há
 * como confirmar visualmente a direção de cada normal dentro do sandbox
 * (sem WebGL pra renderizar) — `DoubleSide` faz o Three corrigir o sinal da
 * normal por fragmento não importa a ordem dos vértices, então nenhuma
 * faceta pode nascer "invertida" (preta) por erro de winding.
 *
 * As arestas (`EdgesGeometry`) agora usam uma cor HDR (`multiplyScalar`
 * empurra os canais acima de 1) — o Bloom lê cor linear ANTES do tone
 * mapping, então uma aresta em HDR estoura o limiar de brilho de forma
 * confiável mesmo com o material da coroa ficando mais escuro no geral,
 * garantindo "bordas extremamente luminosas" mesmo quando a faceta ao lado
 * está no escuro.
 *
 * CONTROL OS — correção pós-Etapa 17B (o cristal sumiu de tela): a causa
 * raiz era um bug real em `hero-crystal-geometry.ts` — a faixa entre a
 * cintura e o pavilhão usava uma fase errada e produzia triângulos
 * torcidos/autointerceptantes (corrigido lá). Como margem de segurança
 * adicional — `transmission` combinado com `side: DoubleSide` numa malha
 * que chegou a ficar não-manifold é um caso conhecido de comportamento
 * instável no passe de transmissão do Three —, `transmission` também
 * baixou (0.16 → 0.08): o metal (`metalness=0.9`) já é o responsável
 * principal pela leitura da superfície, a transmissão era só "um resquício
 * de translucidez nas bordas", nunca o efeito dominante.
 *
 * CONTROL OS — correção nº 2 (cristal e pedestal renderizando quase pretos):
 * o bug de geometria estava corrigido, mas `metalness=0.9` é o motivo por
 * trás do preto total — metais PBR não têm componente difuso (não
 * espalham luz em todas as direções como um material comum), então SÓ
 * aparecem onde a reflexão especular de uma luz/painel pequeno aponta
 * exatamente pra câmera. Com poucos Lightformers pequenos (a correção
 * anterior), a maior parte da superfície não reflete nada — lê como preto
 * sólido, não como "metal escuro". `metalness` desce pra 0.55: a
 * superfície ganha um componente difuso real, que RESPONDE às luzes
 * direcionais/pontuais já presentes na cena (que não dependem de ângulo de
 * reflexão especular), então nunca mais fica pura preta — o `clearcoat`
 * continua garantindo o brilho especular concentrado por cima disso.
 *
 * CONTROL OS — Etapa 17C (identidade de marca): mesmo tratamento do
 * núcleo da NOVA — um glifo holográfico ("L") em `<Billboard>` preso ao
 * centro do cristal, a assinatura visual que faz reconhecer "isso é
 * LEGENDARY" mesmo sem nenhum texto ao redor. Geometria/material do
 * cristal em si NÃO foram tocados nesta rodada — depois de duas correções
 * de renderização seguidas, a prioridade agora é não mexer no que já foi
 * verificado como funcionando.
 */
export function HeroLegendaryCrystal({ colorHex, colorBrightHex }: HeroLegendaryCrystalProps) {
  const geometry = React.useMemo(() => createCrystalGeometry(), []);
  const edgesGeometry = React.useMemo(() => new THREE.EdgesGeometry(geometry, 1), [geometry]);
  const hdrEdgeColor = React.useMemo(() => new THREE.Color(colorBrightHex).multiplyScalar(2.2), [colorBrightHex]);
  const attenuationColor = React.useMemo(() => new THREE.Color(colorHex).multiplyScalar(0.25), [colorHex]);
  const glyphTexture = React.useMemo(() => createGlyphTexture('L', colorBrightHex), [colorBrightHex]);

  return (
    <group>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color={colorHex}
          side={THREE.DoubleSide}
          metalness={0.55}
          roughness={0.22}
          transmission={0.08}
          thickness={0.6}
          ior={1.5}
          attenuationColor={attenuationColor}
          attenuationDistance={0.35}
          anisotropy={0.6}
          anisotropyRotation={Math.PI / 4}
          clearcoat={1}
          clearcoatRoughness={0.04}
          emissive={colorHex}
          emissiveIntensity={0.05}
          envMapIntensity={2.2}
        />
      </mesh>

      <lineSegments geometry={edgesGeometry}>
        <lineBasicMaterial color={hdrEdgeColor} transparent opacity={0.85} toneMapped={false} />
      </lineSegments>

      <mesh>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshBasicMaterial color={colorBrightHex} toneMapped={false} />
      </mesh>
      <pointLight color={colorHex} intensity={1.3} distance={3} decay={2} />

      {/* Glifo holográfico — a assinatura de marca, sempre de frente pra câmera. */}
      <Billboard>
        <mesh>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial
            map={glyphTexture}
            transparent
            opacity={0.8}
            depthWrite={false}
            toneMapped={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </Billboard>
    </group>
  );
}
