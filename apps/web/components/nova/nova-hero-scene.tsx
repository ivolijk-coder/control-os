'use client';

import * as React from 'react';
import * as THREE from 'three';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import { useMediaQuery } from '@control-os/hooks';
import type { NovaPersona } from '@/services/nova';
import type { NovaOrbStatus } from '@/components/nova/nova-orb';
import { HeroLighting } from './hero-scene/hero-lighting';
import { HeroPedestal } from './hero-scene/hero-pedestal';
import { HeroBackground } from './hero-scene/hero-background';
import { HeroNovaCore } from './hero-scene/hero-nova-core';
import { HeroLegendaryCrystal } from './hero-scene/hero-legendary-crystal';
import {
  HERO_PERSONA_COLOR,
  HERO_PERSONA_COLOR_BRIGHT,
  HERO_PERSONA_COLOR_DIM,
  HERO_ROTATION_SPEED,
  HERO_BREATHE_SPEED,
  HERO_BREATHE_AMPLITUDE,
  HERO_RADIUS_SCALE,
  HERO_PULSE_DURATION_MS,
  HERO_PULSE_RADIUS_BOOST,
  HERO_PERSONA_BLEND_EASE_PER_SECOND,
} from './hero-scene/hero-scene-constants';

export interface NovaHeroSceneProps {
  /** Mesmo enum de `NovaOrb` — espelha o estado da conversa. */
  status?: NovaOrbStatus;
  /** Mesmo contrato de `NovaOrb` — incrementa a cada fronteira de fala. */
  pulseSignal?: number;
  /** Mesmo enum de `NovaOrb` — qual identidade a cena representa agora. */
  persona?: NovaPersona;
  className?: string;
}

interface HeroSceneContentProps {
  status: NovaOrbStatus;
  pulseSignal: number | undefined;
  persona: NovaPersona;
}

/**
 * CONTROL OS — Etapa 17 (Hero Scene R3F): conteúdo da cena, montado dentro
 * do `<Canvas>`. Um único `useFrame` no topo é a fonte de verdade pra
 * rotação/respiração/pulso/transição de persona — mesmo princípio de "um
 * único relógio, tudo deriva dele" já usado em `nova-orb.tsx` (`step()`) e
 * no campo de energia da Etapa 16K (`fieldAngle`), nunca múltiplos loops de
 * animação competindo entre si.
 *
 * A transição NOVA↔LEGENDARY do OBJETO em si é um cross-dissolve por
 * escala — o objeto que sai encolhe até 0 enquanto o que entra cresce até
 * 1 (os dois SEMPRE montados, nunca desmontados/remontados — trocar de
 * persona nunca reinicia nada) — suave, "nunca um corte seco". A cor do
 * AMBIENTE (luzes/pedestal/fundo, ver `colorHex` abaixo) ainda troca no
 * instante exato da mudança de persona nesta primeira versão: simplificação
 * deliberada pra entregar um v1 revisável rapidamente, não um descuido —
 * suavizar essa cor também (mesma técnica de `lerpRgb` por frame que
 * `nova-orb.tsx` já usa) é o refinamento natural de uma próxima etapa.
 *
 * CONTROL OS — Etapa 17B (Hero Art Direction): "20% Hero Object, 80%
 * atmosfera — hoje ainda acontece o contrário." `<fogExp2>` entra AQUI (não
 * dentro de `hero-background.tsx`) porque fog só tem efeito quando anexado
 * à cena raiz do Canvas — este componente É essa raiz. Densidade baixa o
 * bastante pra nunca esconder o Hero Object, alta o bastante pra fundir o
 * fundo distante numa penumbra em vez de um corte seco pro preto.
 */
function HeroSceneContent({ status, pulseSignal, persona }: HeroSceneContentProps) {
  const objectGroupRef = React.useRef<THREE.Group>(null);
  const novaGroupRef = React.useRef<THREE.Group>(null);
  const legendaryGroupRef = React.useRef<THREE.Group>(null);

  const personaBlendRef = React.useRef(persona === 'legendary' ? 1 : 0);
  const rotationRef = React.useRef(0);
  const breathePhaseRef = React.useRef(0);
  const lastPulseSignalRef = React.useRef(pulseSignal);
  const pulseStartRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (pulseSignal !== undefined && pulseSignal !== lastPulseSignalRef.current) {
      lastPulseSignalRef.current = pulseSignal;
      pulseStartRef.current = performance.now();
    }
  }, [pulseSignal]);

  useFrame((_state, delta) => {
    const target = persona === 'legendary' ? 1 : 0;
    personaBlendRef.current += (target - personaBlendRef.current) * Math.min(1, HERO_PERSONA_BLEND_EASE_PER_SECOND * delta);
    const blend = personaBlendRef.current;

    rotationRef.current += HERO_ROTATION_SPEED[status] * delta;
    breathePhaseRef.current += HERO_BREATHE_SPEED[status] * delta;

    const breatheFactor = 1 + Math.sin(breathePhaseRef.current) * HERO_BREATHE_AMPLITUDE[status];

    let pulseBoost = 0;
    if (pulseStartRef.current !== null) {
      const elapsed = performance.now() - pulseStartRef.current;
      if (elapsed < HERO_PULSE_DURATION_MS) {
        pulseBoost = (1 - elapsed / HERO_PULSE_DURATION_MS) * HERO_PULSE_RADIUS_BOOST;
      } else {
        pulseStartRef.current = null;
      }
    }

    const scale = HERO_RADIUS_SCALE[status] * breatheFactor * (1 + pulseBoost);

    if (objectGroupRef.current) {
      objectGroupRef.current.rotation.y = rotationRef.current;
      objectGroupRef.current.scale.setScalar(scale);
    }
    if (novaGroupRef.current) {
      const s = 1 - blend;
      novaGroupRef.current.scale.setScalar(s);
      novaGroupRef.current.visible = s > 0.005;
    }
    if (legendaryGroupRef.current) {
      const s = blend;
      legendaryGroupRef.current.scale.setScalar(s);
      legendaryGroupRef.current.visible = s > 0.005;
    }
  });

  const colorHex = HERO_PERSONA_COLOR[persona];
  const colorBrightHex = HERO_PERSONA_COLOR_BRIGHT[persona];
  const colorDimHex = HERO_PERSONA_COLOR_DIM[persona];

  return (
    <>
      <fogExp2 attach="fog" args={['#040308', 0.05]} />
      <HeroLighting colorHex={colorHex} colorDimHex={colorDimHex} />
      <HeroBackground colorHex={colorHex} />
      <HeroPedestal colorHex={colorHex} colorBrightHex={colorBrightHex} />

      <group ref={objectGroupRef} position={[0, -0.05, 0]}>
        <group ref={novaGroupRef}>
          <HeroNovaCore colorHex={colorHex} colorBrightHex={colorBrightHex} />
        </group>
        <group ref={legendaryGroupRef}>
          <HeroLegendaryCrystal colorHex={colorHex} colorBrightHex={colorBrightHex} />
        </group>
      </group>
    </>
  );
}

/**
 * NovaHeroScene — Hero Object do CONTROL OS renderizado em React Three
 * Fiber (CONTROL OS — Etapa 17: "não quero desenhar um objeto 2D com
 * aparência 3D... vamos reconstruir a Hero Scene utilizando renderização 3D
 * em tempo real"). Substitui a `NovaOrb` (Canvas 2D) SÓ na posição de
 * destaque da Home (`NovaWorkspace`, variante `docked`) — "toda a mudança
 * fica isolada na Hero Scene": a `NovaOrb` original continua existindo e
 * sendo usada pelo `NovaFloatingLauncher` e qualquer outro uso pequeno da
 * esfera, intocada.
 *
 * Client-only por natureza (WebGL) — o CONSUMIDOR deste componente é quem
 * decide importar via `next/dynamic({ ssr: false })`, mesmo padrão já usado
 * pra `NovaOrb`/`BackgroundNetwork` em todo o projeto (ver
 * `nova-workspace.tsx`) — este arquivo não se auto-envolve em `dynamic()`,
 * consistente com como `nova-orb.tsx` também não faz isso por conta própria.
 *
 * Respeita `prefers-reduced-motion` — `frameloop="demand"` desliga o loop
 * contínuo de renderização (a cena renderiza um frame e para de se
 * redesenhar sozinha), mesmo comportamento de acessibilidade que a
 * `NovaOrb` já tinha.
 *
 * CONTROL OS — "otimização completa da experiência mobile" (Performance,
 * "otimizar componentes pesados"): abaixo de `md`, o teto de `dpr` cai pra
 * `1.5` (em vez de `2`) e o `<EffectComposer>` (Bloom com `mipmapBlur` +
 * Vignette + Noise) não é montado — pós-processamento é passe(s) de render
 * extra sobre a cena inteira, a parte mais cara de qualquer pipeline WebGL,
 * e GPUs de celular sentem isso muito mais que desktop. A cena continua
 * 100% 3D, com a mesma geometria/material/iluminação/emissive — a
 * identidade visual do Hero Object não muda; só o polimento de pós-
 * produção (glow "vazando", vinheta, grão) fica reservado pra onde a GPU
 * aguenta de sobra. `performance={{ min: 0.4 }}` (já existia) continua
 * ativo nos dois casos — regulagem automática do R3F pra quedas de frame
 * em tempo real, independente deste ajuste por breakpoint.
 *
 * CONTROL OS — Etapa 17B (Hero Art Direction): câmera afastada (`z: 5.4 →
 * 6.2`) — a forma mais direta de fazer o Hero Object ocupar uma fatia menor
 * do quadro sem tocar em nenhuma das constantes de escala/respiração que já
 * governam o comportamento por status (`HERO_RADIUS_SCALE` etc. em
 * `hero-scene-constants.ts`, intocadas). É uma decisão de enquadramento
 * (onde a câmera está), não de tamanho do objeto em si — a diferença entre
 * "meu objeto é pequeno" e "meu objeto está numa cena grande". (Recuado de
 * 6.6 pra 6.2 na correção seguinte — um objeto já pequeno na tela é a
 * pior combinação possível com qualquer problema de iluminação/geometria
 * residual: mais margem de segurança visual sem abrir mão do reenquadramento.)
 *
 * CONTROL OS — Etapa 17C (identidade de marca): "diminuiria a Hero Scene
 * em uns 30%... muito espaço vazio faz tudo parecer mais premium" e "a
 * câmera hoje está praticamente frontal — testaria um leve ângulo de
 * cima." Câmera recuada mais uma vez (z: 6.2 → 9.0) e a lente fecha um
 * pouco (fov: 36 → 33, menos distorção de perspectiva — mais "still de
 * produto", menos "grande angular") — juntos, isso reduz a área que o
 * Hero Object ocupa no quadro em ~25–30% sem tocar em nenhuma escala
 * própria do objeto. `position.y` sobe (0.5 → 1.5): como nenhuma
 * `rotation` é passada em `camera`, o R3F automaticamente aponta a câmera
 * pra origem (`camera.lookAt(0,0,0)`, comportamento padrão quando
 * `camera.rotation` não é definido) — então subir o Y sozinho já cria o
 * "leve ângulo de cima" pedido, sem nenhuma matemática de rotação manual.
 */
export function NovaHeroScene({ status = 'idle', pulseSignal, persona = 'nova', className }: NovaHeroSceneProps) {
  const prefersReducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <div className={className ?? 'h-full w-full'}>
      <Canvas
        dpr={isMobile ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 33, position: [0, 1.5, 9.0], near: 0.1, far: 50 }}
        frameloop={prefersReducedMotion ? 'demand' : 'always'}
        performance={{ min: 0.4 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
      >
        <HeroSceneContent status={status} pulseSignal={pulseSignal} persona={persona} />

        {/* Pós-processamento discreto — "jamais exagerar". Tone mapping em
            si já acontece no renderer (`gl.toneMapping` acima, mais correto
            fisicamente que uma passada extra no composer); aqui só Bloom
            (luz de verdade "vazando" onde a cena já é muito brilhante, não
            um filtro cosmético por cima de tudo), Vignette (foco sutil no
            centro) e Noise (grão finíssimo, tira o aspecto "plástico" de
            CGI limpo demais). Fica fora do mobile (ver doc do componente) —
            a cena em si (geometria, material, luz) é idêntica nos dois
            casos. */}
        {!isMobile && (
          <EffectComposer multisampling={0}>
            <Bloom intensity={0.55} luminanceThreshold={0.35} luminanceSmoothing={0.2} mipmapBlur radius={0.6} />
            <Vignette eskil={false} offset={0.25} darkness={0.6} />
            <Noise opacity={0.02} />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}
