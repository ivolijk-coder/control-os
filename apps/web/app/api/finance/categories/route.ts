import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { financeService } from '@/services/modules';
import { currentSessionUserId } from '@/services/auth/session';
import { runAsFinanceUser } from '@/services/modules/finance/finance-user-context';

const KINDS = ['receita', 'despesa'] as const;
function object(value: unknown): Record<string, unknown> | undefined { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function error(message: string, status: number) { return NextResponse.json({ success: false, message }, { status }); }
function kind(value: unknown): 'receita' | 'despesa' | undefined { return typeof value === 'string' && (KINDS as readonly string[]).includes(value) ? value as 'receita' | 'despesa' : undefined; }

export async function GET(request: NextRequest) {
  const userId = currentSessionUserId(); if (!userId) return error('Faça login para consultar categorias.', 401);
  try { const categories = await runAsFinanceUser(userId, () => financeService.listCategories({ includeArchived: request.nextUrl.searchParams.get('includeArchived') === 'true' })); return NextResponse.json({ success: true, categories }); }
  catch (cause) { console.error('Falha ao consultar categorias:', cause); return error('Não foi possível carregar as categorias agora.', 500); }
}
export async function POST(request: NextRequest) {
  const userId = currentSessionUserId(); if (!userId) return error('Faça login para criar categorias.', 401);
  const body = object(await request.json().catch(() => undefined)); const type = kind(body?.kind);
  if (!body || typeof body.name !== 'string' || !type) return error('Informe nome e tipo da categoria.', 400);
  const name = body.name;
  const icon = typeof body.icon === 'string' ? body.icon : undefined;
  const color = typeof body.color === 'string' ? body.color : undefined;
  const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : undefined;
  const isFavorite = typeof body.isFavorite === 'boolean' ? body.isFavorite : undefined;
  try { const result = await runAsFinanceUser(userId, () => financeService.createCategory({ name, kind: type, icon, color, sortOrder, isFavorite })); return NextResponse.json(result, { status: result.success ? 201 : 400 }); }
  catch (cause) { console.error('Falha ao criar categoria:', cause); return error('Não foi possível criar a categoria agora.', 500); }
}
export async function PATCH(request: NextRequest) {
  const userId = currentSessionUserId(); if (!userId) return error('Faça login para alterar categorias.', 401);
  const body = object(await request.json().catch(() => undefined)); if (!body || typeof body.id !== 'string' || typeof body.action !== 'string') return error('Informe a categoria e a ação.', 400);
  const id = body.id;
  const action = body.action;
  const name = typeof body.name === 'string' ? body.name : undefined;
  const icon = typeof body.icon === 'string' ? body.icon : undefined;
  const color = typeof body.color === 'string' ? body.color : undefined;
  const sortOrder = typeof body.sortOrder === 'number' ? body.sortOrder : undefined;
  const isFavorite = typeof body.isFavorite === 'boolean' ? body.isFavorite : undefined;
  try { const result = await runAsFinanceUser(userId, () => action === 'update' ? financeService.updateCategory({ id, name, icon, color, sortOrder, isFavorite, source: 'manual' }) : action === 'archive' ? financeService.archiveCategory(id, 'manual') : action === 'restore' ? financeService.restoreCategory(id, 'manual') : Promise.resolve({ success: false, message: 'Ação de categoria inválida.' })); return NextResponse.json(result, { status: result.success ? 200 : 400 }); }
  catch (cause) { console.error('Falha ao alterar categoria:', cause); return error('Não foi possível alterar a categoria agora.', 500); }
}
