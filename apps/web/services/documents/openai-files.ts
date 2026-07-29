import 'server-only';

const OPENAI_FILES_URL = 'https://api.openai.com/v1/files';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024;

export interface ContractExtraction {
  creditorName: string | null;
  contractReference: string | null;
  totalAmount: number | null;
  installmentAmount: number | null;
  installments: number | null;
  paidInstallments: number | null;
  firstDueDate: string | null;
  dueDay: number | null;
  categorySuggestion: string | null;
  summary: string;
  confidence: 'high' | 'medium' | 'low';
  missingFields: string[];
}

function apiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('A leitura de documentos ainda não está configurada.');
  return key;
}

function model(): string {
  return process.env.OPENAI_MODEL || 'gpt-5.5';
}

function responseText(payload: unknown): string | undefined {
  if (typeof payload !== 'object' || payload === null || !('output' in payload) || !Array.isArray(payload.output)) return undefined;
  for (const output of payload.output) {
    if (typeof output !== 'object' || output === null || !('content' in output) || !Array.isArray(output.content)) continue;
    for (const content of output.content) {
      if (typeof content === 'object' && content !== null && 'text' in content && typeof content.text === 'string') return content.text;
    }
  }
  return undefined;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function nullableInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;
}

function asExtraction(value: unknown): ContractExtraction {
  const raw = typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
  const confidence = raw.confidence === 'high' || raw.confidence === 'medium' || raw.confidence === 'low' ? raw.confidence : 'low';
  return {
    creditorName: nullableString(raw.creditorName),
    contractReference: nullableString(raw.contractReference),
    totalAmount: nullableNumber(raw.totalAmount),
    installmentAmount: nullableNumber(raw.installmentAmount),
    installments: nullableInteger(raw.installments),
    paidInstallments: nullableInteger(raw.paidInstallments),
    firstDueDate: nullableString(raw.firstDueDate),
    dueDay: nullableInteger(raw.dueDay),
    categorySuggestion: nullableString(raw.categorySuggestion),
    summary: nullableString(raw.summary) ?? 'Não foi possível resumir o contrato.',
    confidence,
    missingFields: Array.isArray(raw.missingFields) ? raw.missingFields.filter((item): item is string => typeof item === 'string') : [],
  };
}

export function validateDocument(file: File): void {
  if (file.size <= 0) throw new Error('O arquivo está vazio.');
  if (file.size > MAX_DOCUMENT_SIZE_BYTES) throw new Error('Envie um arquivo de até 15 MB.');
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'text/plain'];
  if (!allowed.includes(file.type)) throw new Error('Envie PDF, imagem (JPG, PNG, WebP) ou texto.');
}

export async function uploadPrivateFile(file: File): Promise<string> {
  validateDocument(file);
  const body = new FormData();
  body.set('purpose', 'user_data');
  body.set('file', file, file.name);
  const response = await fetch(OPENAI_FILES_URL, { method: 'POST', headers: { Authorization: `Bearer ${apiKey()}` }, body });
  if (!response.ok) throw new Error('Não foi possível guardar o arquivo agora.');
  const payload = await response.json() as { id?: unknown };
  if (typeof payload.id !== 'string') throw new Error('O arquivo não recebeu uma identificação válida.');
  return payload.id;
}

export async function downloadPrivateFile(fileId: string): Promise<Response> {
  const response = await fetch(`${OPENAI_FILES_URL}/${encodeURIComponent(fileId)}/content`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!response.ok) throw new Error('Não foi possível recuperar o arquivo agora.');
  return response;
}

export async function extractContract(fileId: string): Promise<ContractExtraction> {
  const instructions = [
    'Você é um leitor de contratos financeiros no Brasil.',
    'Extraia apenas informações explícitas no documento; não invente valores.',
    'Valores devem ser números em reais, sem símbolo de moeda. Datas devem ser ISO YYYY-MM-DD quando completas.',
    'Retorne JSON válido com exatamente: creditorName, contractReference, totalAmount, installmentAmount, installments, paidInstallments, firstDueDate, dueDay, categorySuggestion, summary, confidence, missingFields.',
    'confidence é high, medium ou low. Campos ausentes devem ser null e listados em missingFields.',
  ].join(' ');
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model(),
      instructions,
      input: [{ role: 'user', content: [{ type: 'input_file', file_id: fileId }, { type: 'input_text', text: 'Leia este contrato e prepare a prévia de renegociação.' }] }],
      text: { format: { type: 'json_object' } },
      max_output_tokens: 900,
    }),
  });
  if (!response.ok) throw new Error('Não foi possível ler este contrato agora.');
  const text = responseText(await response.json());
  if (!text) throw new Error('A leitura do contrato não retornou uma prévia.');
  try {
    return asExtraction(JSON.parse(text));
  } catch {
    throw new Error('A leitura do contrato retornou um formato inválido.');
  }
}
