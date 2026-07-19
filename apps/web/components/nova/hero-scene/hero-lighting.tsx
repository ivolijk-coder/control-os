'use client';

import * as React from 'react';
import { Environment, Lightformer } from '@react-three/drei';

interface HeroLightingProps {
  colorHex: string;
  colorDimHex: string;
}

/**
 * CONTROL OS — Etapa 17 (Hero Scene R3F): iluminação REAL da cena — "não
 * depender apenas de glows pintados". Três luzes nomeadas pelo próprio
 * briefing (inferior/lateral/traseira) mais um "ambiente HDRI simples ou
 * equivalente" via `<Environment>` com `<Lightformer>` como filhos — isso
 * gera um cubemap sintético renderizado na hora (alguns painéis retangulares
 * de luz suave), SEM baixar nenhum arquivo `.hdr` externo. Isso importa: um
 * `Environment preset="city"` pronto baixa um HDRI de um CDN a cada carga —
 * dependência de rede em runtime que não existia antes e pode falhar/atrasar
 * em conexões restritas. Os `Lightformer` dão reflexos/Fresnel plausíveis
 * pro vidro/metal do Hero Object sem esse custo.
 *
 * A luz inferior nasce exatamente na posição do pedestal (`hero-pedestal.tsx`)
 * — arquiteturalmente, não só visualmente, "toda energia nasce do pedestal".
 *
 * CONTROL OS — v2 (após revisão visual): a v1 estava fraca demais pra criar
 * contraste real nas facetas metálicas do cristal (que dependem quase
 * inteiramente da luz/ambiente refletido, não de cor própria — ver
 * `hero-legendary-crystal.tsx`). Intensidades da luz lateral e dos
 * Lightformers praticamente dobradas.
 *
 * CONTROL OS — Etapa 17B (Hero Art Direction): "faces extremamente claras,
 * faces extremamente escuras" não é uma propriedade só do material — é uma
 * decisão de ILUMINAÇÃO. Um `Environment` com Lightformers grandes e
 * espalhados (a v2) preenche o ambiente de forma quase uniforme: toda
 * faceta recebe uma quantidade parecida de luz refletida, então mesmo com
 * `metalness` alto o resultado lê "uniformemente dourado". A correção é a
 * oposta de "mais luz": AMBIENTE quase zero (`ambientLight` cortado a
 * quase nada) e Lightformers MENORES/mais concentrados — luz de estúdio de
 * produto, não luz de dia nublado. Cada faceta só recebe luz forte se sua
 * normal apontar quase exatamente pra uma dessas fontes pequenas; todas as
 * outras caem no escuro. É esse recorte, não a intensidade total, que cria
 * o contraste "extremo" pedido.
 *
 * CONTROL OS — correção pós-Etapa 17B (o cristal sumiu de tela): a causa
 * raiz principal foi um bug de geometria (`hero-crystal-geometry.ts`,
 * corrigido). Como margem de segurança adicional — ambiente quase-zero
 * significa que QUALQUER problema (geometria, winding, ângulo de câmera)
 * pode fazer o objeto ler como "invisível" contra o fundo preto, sem
 * nenhuma luz de base garantindo um mínimo de visibilidade — o ambiente
 * sobe um pouco (ainda bem abaixo do v2) e o painel de preenchimento
 * ganha mais intensidade. Contraste extremo continua sendo a meta; "nunca
 * pode desaparecer" passa a ser um piso não-negociável por baixo dela.
 */
export function HeroLighting({ colorHex, colorDimHex }: HeroLightingProps) {
  return (
    <>
      {/* Ambiente — baixo, mas nunca zero: um piso mínimo de visibilidade que o contraste extremo não pode violar. */}
      <ambientLight intensity={0.07} color="#0a0a14" />

      {/* Luz inferior — nasce do pedestal, mesma cor da persona. */}
      <pointLight position={[0, -1.55, 0]} intensity={9} color={colorHex} distance={7} decay={2} />

      {/* Luz-chave — dura, direcional, concentrada num só lado: desenha a fronteira clara/escura entre facetas vizinhas. */}
      <directionalLight position={[3.2, 2.2, 2.4]} intensity={2.8} color="#f5f5f0" />

      {/* Luz traseira — rim light discreto, cor escura da mesma família da persona (nunca cinza puro). */}
      <directionalLight position={[-2.4, 1.4, -3.2]} intensity={1} color={colorDimHex} />

      {/* Ambiente HDRI sintético — só pra alimentar reflexos/Fresnel do material físico do Hero Object, nunca visível como fundo (`background={false}`, o padrão). Painéis pequenos e intensos (luz de estúdio de produto) em vez de painéis grandes e fracos (luz de preenchimento) — reflexo concentrado, não brilho difuso. */}
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={4.2} color="#ffffff" scale={[2.2, 1.3, 1]} position={[0, 3, 2]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.7} color={colorHex} scale={[3, 1.5, 1]} position={[-3, 0.5, -1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={1.1} color={colorHex} scale={[2, 2, 1]} position={[0, -1.4, 1.5]} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}
