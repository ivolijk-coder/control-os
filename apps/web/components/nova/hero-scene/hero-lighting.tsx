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
 */
export function HeroLighting({ colorHex, colorDimHex }: HeroLightingProps) {
  return (
    <>
      {/* Ambiente — preenchimento muito fraco, frio, nunca a fonte principal. */}
      <ambientLight intensity={0.12} color="#0a0a14" />

      {/* Luz inferior — nasce do pedestal, mesma cor da persona. */}
      <pointLight position={[0, -1.55, 0]} intensity={6} color={colorHex} distance={7} decay={2} />

      {/* Luz lateral — direcional neutra, dá volume/Fresnel nas arestas. */}
      <directionalLight position={[3.2, 2.2, 2.4]} intensity={0.9} color="#f5f5f0" />

      {/* Luz traseira — rim light discreto, cor escura da mesma família da persona (nunca cinza puro). */}
      <directionalLight position={[-2.4, 1.4, -3.2]} intensity={0.5} color={colorDimHex} />

      {/* Ambiente HDRI sintético — só pra alimentar reflexos/Fresnel do material físico do Hero Object, nunca visível como fundo (`background={false}`, o padrão). */}
      <Environment resolution={128}>
        <Lightformer form="rect" intensity={1.4} color="#ffffff" scale={[4, 2, 1]} position={[0, 3, 2]} target={[0, 0, 0]} />
        <Lightformer form="rect" intensity={0.6} color={colorHex} scale={[3, 1.5, 1]} position={[-3, 0.5, -1]} target={[0, 0, 0]} />
        <Lightformer form="ring" intensity={0.8} color={colorHex} scale={[2, 2, 1]} position={[0, -1.4, 1.5]} target={[0, 0, 0]} />
      </Environment>
    </>
  );
}
