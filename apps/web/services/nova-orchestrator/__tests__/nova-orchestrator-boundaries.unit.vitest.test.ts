import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const moduleRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const productionFiles = [
  'nova-orchestrator.contracts.ts',
  'nova-orchestrator.errors.ts',
  'nova-orchestrator.interfaces.ts',
  'nova-orchestrator.types.ts',
  'nova-turn-state-machine.ts',
  'index.ts',
];

describe('limites arquiteturais do PR10.1', () => {
  it('não importa Prisma, OpenAI nem implementações do Action Registry', () => {
    const source = productionFiles.map((file) => readFileSync(join(moduleRoot, file), 'utf8')).join('\n');
    expect(source).not.toMatch(/@prisma\/client|lib\/prisma|PrismaClient/u);
    expect(source).not.toMatch(/openai|OpenAIProvider|Responses API/iu);
    expect(source).not.toMatch(/action-registry|new ActionRegistry|actionRegistry\.execute/u);
  });

  it('não contém endpoint, frontend ou execução ativa', () => {
    const source = productionFiles.map((file) => readFileSync(join(moduleRoot, file), 'utf8')).join('\n');
    expect(source).not.toMatch(/NextRequest|NextResponse|use client|NovaWorkspace/u);
    expect(source).not.toMatch(/fetch\(|\.execute\(/u);
  });
});
