export function syntheticPdf(text = 'Contrato sintético de teste'): File {
  const body = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>
endobj
4 0 obj
<< /Length ${text.length} >>
stream
${text}
endstream
endobj
%%EOF`;
  return new File([body], 'contrato-sintetico.pdf', { type: 'application/pdf' });
}

export function syntheticPng(name = 'imagem-sintetica.png'): File {
  return new File([
    Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]),
  ], name, { type: 'image/png' });
}

export const SYNTHETIC_CONTRACT_PREVIEW = {
  documentType: 'FINANCING_CONTRACT' as const,
  documentIntent: 'FINANCIAL_ACTION_REQUIRED' as const,
  confidence: 'high' as const,
  summary: 'Contrato inteiramente sintético.',
  entities: { company: null, people: [] as string[], dates: [] as string[], amounts: [] as number[] },
  financialOperation: { detected: true, type: 'FINANCIAMENTO', creditor: 'Credor Sintético', amount: 1200, installments: 12 },
  suggestedActions: [] as string[],
  creditorName: 'Credor Sintético',
  contractNumber: 'TEST-001',
  totalAmount: 1200,
  installmentAmount: 100,
  installments: 12,
  paidInstallments: 0,
  remainingInstallments: 12,
  firstDueDate: '2030-01-10',
  dueDay: 10,
  interestRate: null,
  cet: null,
  iof: null,
  fine: null,
  guarantees: [],
  categorySuggestion: 'Teste',
  missingFields: [],
};
