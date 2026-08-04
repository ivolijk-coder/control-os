import type { ActionExecutionMetadata, ActionKind } from '@/services/control-hub';
import type { ActionResult } from '@/services/action-result.types';
import type { Capability } from '@/services/capability.types';
import {
  createFinancialContract,
  deriveFinancialContractIdempotencyKey,
  FinancialContractError,
  type CreateFinancialContractInput,
  type FinancialContract,
  type FinancialContractType,
} from '@/services/finance-contracts';
import { currentFinanceUserId } from '@/services/modules/finance/finance-user-context';
import type { ActionHandler } from '../../action.interfaces';
import { getNumber, getString } from '../../payload-guards';

export type CreateFinancialContract = (input: CreateFinancialContractInput) => Promise<FinancialContract>;

function creationEnabled(): boolean {
  return process.env.ENABLE_NOVA_CONTRACT_CREATION === 'true';
}

abstract class CreateFinancialContractAction implements ActionHandler {
  abstract readonly kind: ActionKind;
  abstract readonly capability: Capability;

  constructor(
    private readonly contractType: FinancialContractType,
    private readonly createContract: CreateFinancialContract = createFinancialContract,
    private readonly isEnabled: () => boolean = creationEnabled,
  ) {}

  async execute(payload: Record<string, unknown>, metadata?: ActionExecutionMetadata): Promise<ActionResult> {
    if (!this.isEnabled()) {
      return {
        success: false,
        message: 'O cadastro de empréstimos e financiamentos pela NOVA ainda está protegido até a idempotência ser ativada.',
      };
    }

    const userId = currentFinanceUserId();
    if (!userId) return { success: false, message: 'Faça login para cadastrar o contrato financeiro.' };
    if (!metadata) return { success: false, message: 'A identidade segura da operação não foi informada.' };

    const name = getString(payload, 'description') ?? getString(payload, 'name');
    const totalAmount = getNumber(payload, 'totalAmount');
    const totalInstallments = getNumber(payload, 'installments');
    const dueDay = getNumber(payload, 'dueDay');
    if (!name || totalAmount === undefined || totalInstallments === undefined || dueDay === undefined) {
      return { success: false, message: 'Informe descrição, valor total, número de parcelas e dia de vencimento.' };
    }

    try {
      const idempotencyKey = deriveFinancialContractIdempotencyKey({
        userId,
        operationId: metadata.operationId,
        channel: metadata.channel,
        actionKind: this.kind === 'loan.create' ? 'loan.create' : 'financing.create',
      });
      const contract = await this.createContract({
        userId,
        name,
        institution: getString(payload, 'institution'),
        type: this.contractType,
        totalAmount,
        totalInstallments: Math.round(totalInstallments),
        installmentAmount: getNumber(payload, 'installmentAmount'),
        dueDay: Math.round(dueDay),
        startDate: getString(payload, 'startDate'),
        source: 'NOVA',
        idempotencyKey,
      });
      return { success: true, message: 'Contrato financeiro cadastrado com sucesso.', data: contract };
    } catch (error) {
      return {
        success: false,
        message: error instanceof FinancialContractError ? error.message : 'Não foi possível cadastrar o contrato financeiro.',
        status: error instanceof FinancialContractError ? error.status : 500,
      };
    }
  }
}

const commonParameters: Capability['parameters'] = [
  { name: 'institution', type: 'string', required: false, description: 'Instituição responsável pelo contrato.' },
  { name: 'totalAmount', type: 'number', required: true, description: 'Valor total do contrato, em reais.' },
  { name: 'installments', type: 'number', required: true, description: 'Quantidade total de parcelas.' },
  { name: 'installmentAmount', type: 'number', required: false, description: 'Valor nominal da parcela, se informado.' },
  { name: 'dueDay', type: 'number', required: true, description: 'Dia de vencimento, de 1 a 31.' },
  { name: 'startDate', type: 'string', required: false, description: 'Data inicial ISO, se informada.' },
  { name: 'description', type: 'string', required: true, description: 'Descrição curta do contrato.' },
];

export class CreateLoanAction extends CreateFinancialContractAction {
  readonly kind: ActionKind = 'loan.create';
  readonly capability: Capability = {
    kind: 'loan.create',
    description: 'Cadastra um empréstimo confirmado usando o núcleo de contratos financeiros.',
    parameters: commonParameters,
    examples: ['Empréstimo Nubank de 9000 em 30x de 300, vencendo dia 10.'],
  };

  constructor(createContract?: CreateFinancialContract, isEnabled?: () => boolean) {
    super('LOAN', createContract, isEnabled);
  }
}

export class CreateFinancingAction extends CreateFinancialContractAction {
  readonly kind: ActionKind = 'financing.create';
  readonly capability: Capability = {
    kind: 'financing.create',
    description: 'Cadastra um financiamento confirmado usando o núcleo de contratos financeiros.',
    parameters: commonParameters,
    examples: ['Financiamento de veículo em 48 parcelas, vencendo dia 20.'],
  };

  constructor(createContract?: CreateFinancialContract, isEnabled?: () => boolean) {
    super('FINANCING', createContract, isEnabled);
  }
}
