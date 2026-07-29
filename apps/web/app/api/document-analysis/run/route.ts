import { NextResponse } from 'next/server';
import { processNextDocumentAnalysisJob } from '@/services/documents/contract-analysis';

/** Endpoint exclusivo de worker/cron. Nunca exponha o segredo ao navegador. */
export async function POST(request: Request) {
  const secret = process.env.DOCUMENT_JOB_RUNNER_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) return NextResponse.json({ error: 'Não autorizado.' }, { status: 401 });
  try { return NextResponse.json({ success: true, result: await processNextDocumentAnalysisJob() }); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Falha na análise.' }, { status: 502 }); }
}
