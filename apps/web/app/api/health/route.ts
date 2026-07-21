import { NextResponse } from 'next/server';

/**
 * Health check — CONTROL OS Infra (Docker/VPS).
 *
 * Endpoint mínimo, sem dependência de banco/Redis/IA — só confirma que o
 * processo Next.js está de pé e respondendo. Usado pelo `HEALTHCHECK` do
 * container `web` (ver infra/docker-compose.yml) para o Docker saber
 * quando o serviço está pronto para receber tráfego do Traefik. Não existe
 * equivalente na Vercel (a própria plataforma já monitora liveness) — este
 * arquivo só importa para o deploy self-hosted em Docker.
 */
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
