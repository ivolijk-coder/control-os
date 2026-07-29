# 24 — Domínio Financeiro

**Status:** especificação oficial aprovada conceitualmente.  
**Escopo:** regras de negócio do dinheiro. Este documento não define telas, componentes, tecnologia ou infraestrutura.  
**Regra de precedência:** nenhuma implementação financeira poderá contrariar este documento sem um novo ADR aprovado.

## 1. Princípios imutáveis

1. Todo valor monetário usa moeda ISO 4217 e inteiro em unidades mínimas (centavos para BRL). Nunca `float`.
2. Todo fato financeiro pertence exatamente a um `workspace` e é autorizado pelo seu proprietário/membro; nunca há lançamento global ou implícito.
3. Um lançamento **confirmado** não é apagado ou editado de modo a reescrever a história. Correções ocorrem por estorno, cancelamento permitido ou lançamento de ajuste, sempre auditável.
4. Saldos, dashboards e fluxo de caixa são projeções derivadas dos fatos financeiros; não são fonte de verdade editável.
5. Uma operação que cria mais de um fato financeiro é atômica: ou todos persistem, ou nenhum.
6. Toda criação externa, importação, webhook ou comando de IA usa chave de idempotência e registro de origem.
7. Datas têm semântica explícita: data de competência, data de vencimento e data de liquidação/pagamento não são intercambiáveis.
8. Exclusão física só é permitida para rascunho não contabilizado e sem dependência. O padrão é arquivamento/cancelamento ou estorno.

## 2. Vocabulário e entidades canônicas

| Entidade | Significado |
| --- | --- |
| `Account` | Conta de disponibilidade: corrente, dinheiro, poupança, investimento operacional ou carteira digital. Possui moeda e saldo derivado. |
| `Transaction` | Fato financeiro atômico: receita, despesa, transferência, ajuste ou estorno. |
| `TransactionLeg` | Perna contábil de uma transação quando necessário; permite representar transferência e ajuste sem ambiguidade. |
| `Category` | Classificação de receita/despesa, pertencente ao workspace e não usada como conta. |
| `Payable` / `Receivable` | Obrigação a pagar ou direito a receber, antes ou independentemente da liquidação. |
| `Card` | Meio de pagamento com limite, ciclo e conta de liquidação; não é saldo disponível. |
| `CardPurchase` | Compra feita no cartão, que gera obrigação/fatura, não saída imediata da conta. |
| `CardStatement` | Fatura de um cartão em determinado ciclo. |
| `InstallmentPlan` / `Installment` | Contrato pai e parcelas filhas com vencimentos próprios. |
| `RecurringRule` / `MonthlyOccurrence` | Regra recorrente e sua ocorrência concreta, nunca a mesma coisa. |
| `Goal` / `Contribution` | Meta e aporte/resgate que a movimenta. |
| `Attachment` | Metadado de arquivo associado a um fato; arquivo não altera valor nem saldo. |
| `AuditEvent` | Registro imutável de ação, origem, ator, antes/depois redigidos e resultado. |

Cada entidade financeira relevante deve carregar, no mínimo, `id`, `workspace_id`, `currency`, `status`, `created_at`, `updated_at`, `created_by`, `source`, `idempotency_key` quando originada externamente, e vínculos de reversão/origem quando aplicável.

## 3. Estados e datas

### 3.1 Estados

- **Rascunho:** ainda não altera saldo realizado, fatura ou projeções confirmadas.
- **Pendente/agendado:** existe compromisso futuro; altera somente projeções autorizadas.
- **Confirmado/liquidado:** fato ocorrido; altera saldo realizado e relatórios de caixa.
- **Vencido:** obrigação pendente após vencimento; não significa que foi paga.
- **Cancelado:** obrigação ou rascunho encerrado antes da liquidação; não gera caixa realizado.
- **Estornado:** fato confirmado recebeu reversão explícita; o original permanece visível e o efeito líquido é neutralizado.

Transições inválidas são rejeitadas. Um confirmado não volta para rascunho; um estornado não é estornado novamente sem regra de ajuste aprovada.

### 3.2 Datas

- **Competência (`accrual_date`):** quando a receita/despesa pertence economicamente ao período.
- **Vencimento (`due_date`):** data limite de obrigação/recebimento.
- **Liquidação (`settled_at`):** quando dinheiro efetivamente entrou ou saiu de uma conta.
- **Data de lançamento:** quando foi registrado no sistema; nunca substitui as anteriores.

## 4. Saldos, resultado e fluxo de caixa

### 4.1 Saldo realizado

É a soma de transações **liquidadas** que afetam uma `Account`, por moeda. Receita aumenta; despesa reduz; transferência reduz origem e aumenta destino; estorno aplica efeito inverso. Compras em cartão, contas a pagar pendentes e metas não alteram saldo realizado por si só.

### 4.2 Saldo previsto

É o saldo realizado acrescido de entradas e saídas futuras pendentes/agendadas dentro do horizonte consultado. Deve indicar claramente data e confiança. Não pode ser apresentado como dinheiro disponível.

### 4.3 Resultado realizado e competência

Receitas menos despesas classificadas pela **competência** compõem resultado do período. Liquidação compõe caixa. Um gasto de cartão em julho, liquidado em agosto, pode pertencer ao resultado de julho e ao caixa de agosto.

### 4.4 Fluxo de caixa

Ordena entradas e saídas liquidadas ou previstas pela data de liquidação. Transações de transferência interna não geram resultado, mas aparecem como movimentação entre contas e não podem inflar entradas/saídas consolidadas do workspace.

### 4.5 Projeções e dashboards

Dashboard, saldo por conta, fluxo de caixa, faturas e metas são recalculados de fatos confirmados/pendentes. Nenhuma atualização de dashboard cria ou modifica `Transaction`; se uma projeção estiver desatualizada, ela é reconstruída a partir do livro financeiro.

## 5. Operações financeiras

### 5.1 Receita

**O que acontece:** registra dinheiro recebido ou direito a receber. Se liquidada, cria uma transação de receita que aumenta uma conta. Se prevista, cria um recebível pendente e só afeta saldo previsto.

- **Altera:** `Transaction`/`Receivable`, `Account` apenas por projeção derivada, categoria, anexos e auditoria.
- **Não altera:** limite de cartão, saldo de outras contas, metas sem um aporte explícito.
- **Cria:** fato de receita, pernas necessárias, evento de auditoria e, se houver, vínculo de liquidação do recebível.
- **Atualiza:** saldo realizado/previsão, fluxo de caixa, resultado por competência, categorias e dashboard.
- **Notifica:** recebimento esperado, vencido ou relevante por regra do usuário.
- **NOVA:** pode registrar receita simples; deve confirmar valor, moeda, conta e data se houver ambiguidade ou se a conta não estiver definida.
- **Consistência:** idempotência por origem, validação de conta/workspace, valor positivo e uma única liquidação por recebível salvo recebimento parcial permitido.

### 5.2 Despesa

**O que acontece:** registra dinheiro gasto ou obrigação futura. Liquidação reduz a conta; despesa pendente cria pagável e impacta previsão/competência conforme configurado.

- **Altera:** `Transaction`/`Payable`, categoria, anexos e projeções da conta.
- **Não altera:** outra conta, fatura de cartão ou saldo de meta, salvo vínculo explícito.
- **Cria:** fato de despesa e auditoria; pode criar obrigação antes de pagamento.
- **Atualiza:** saldo, fluxo de caixa, resultado e alertas de orçamento/vencimento.
- **Notifica:** vencimento, gasto acima de limite ou impacto em meta.
- **NOVA:** confirmação obrigatória quando valor, conta, categoria ou data não forem claros; confirmação sempre para operação que liquide/desconte dinheiro em contexto sensível configurado pelo usuário.
- **Consistência:** uma despesa não pode ter valor zero/negativo, conta de outro workspace ou liquidação duplicada.

### 5.3 Contas

**O que acontece:** cria, arquiva ou renomeia uma fonte de disponibilidade. Saldo inicial é um ajuste auditado na data de abertura, não um campo livre posterior.

- **Altera:** `Account`; ao abrir com saldo inicial, cria `Transaction` de ajuste inicial.
- **Não altera:** transações históricas, cartões ou categorias.
- **Cria:** auditoria e, se aplicável, ajuste de abertura.
- **Atualiza:** saldo por conta e consolidados.
- **Notifica:** opcional para conta sem uso ou saldo abaixo de limite.
- **NOVA:** deve confirmar nome, tipo, moeda e saldo inicial; não pode arquivar conta com obrigações ou transações pendentes sem uma ação de migração explícita.
- **Consistência:** conta só pode ser arquivada, nunca removida, se tiver fatos históricos; moeda da conta é imutável depois de haver lançamento.

### 5.4 Transferências

**O que acontece:** move dinheiro entre duas contas do mesmo workspace e mesma moeda, ou registra conversão explícita quando moedas diferirem.

- **Altera:** duas contas por projeção; vínculo de transferência.
- **Não altera:** resultado, categoria de receita/despesa ou fatura de cartão.
- **Cria:** uma transação de transferência com duas pernas atômicas, e auditoria.
- **Atualiza:** saldos individuais e fluxo por conta; consolidação do workspace não muda.
- **Notifica:** falha, saldo insuficiente se essa política existir, ou transferência agendada.
- **NOVA:** confirmação sempre antes de confirmar/liquidar transferência; nunca inferir conta destino de modo silencioso.
- **Consistência:** origem diferente de destino, valor positivo, mesma moeda ou taxa/câmbio explícitos, e chave idempotente única.

### 5.5 Cartões

**O que acontece:** um cartão representa limite, ciclo, dia de vencimento e conta de pagamento. Ele não aumenta saldo disponível nem cria receita.

- **Altera:** `Card`, ciclos/faturas e compras associadas.
- **Não altera:** saldo realizado da conta até a fatura ser paga.
- **Cria:** auditoria; ao cadastrar cartão, não cria transação automaticamente.
- **Atualiza:** limite disponível e previsão de fatura; dashboard de dívida/compromissos.
- **Notifica:** limite próximo, fechamento e vencimento de fatura.
- **NOVA:** confirma instituição, limite, dia de fechamento/vencimento e conta de pagamento.
- **Consistência:** cartão arquivado preserva faturas; não permitir troca retroativa do ciclo de uma fatura fechada.

### 5.6 Compras no cartão

**O que acontece:** a compra cria `CardPurchase` e aumenta o valor da fatura correspondente. Não reduz conta bancária no dia da compra. Sua competência é a data da compra; sua saída de caixa ocorre no pagamento da fatura.

- **Altera:** compra, fatura, categoria e previsão de obrigação.
- **Não altera:** saldo realizado de uma conta, salvo pagamento posterior; limite/saldo de outro cartão.
- **Cria:** compra, item de fatura e auditoria; em compra parcelada, plano/parcelas de cartão.
- **Atualiza:** limite disponível, total da fatura, resultado por competência e fluxo previsto do pagamento.
- **Notifica:** compra acima de política, limite ou fatura próxima.
- **NOVA:** confirma cartão, valor, data e quantidade de parcelas; confirmação reforçada acima de limiar definido.
- **Consistência:** compra pertence a uma única fatura/ciclo; pagamento de fatura não recria a despesa de competência.

### 5.7 Faturas e pagamento de fatura

**O que acontece:** fatura agrupa compras pelo ciclo. O pagamento cria uma despesa/liquidação na conta pagadora e reduz/encerra a obrigação da fatura. Pagamento parcial é permitido apenas se explicitamente modelado, com saldo remanescente e encargos separados.

- **Altera:** `CardStatement`, `Payable`, `Transaction` de pagamento e conta pagadora por projeção.
- **Não altera:** cada compra original, salvo estorno/cancelamento específico.
- **Cria:** transação de pagamento, vínculo de liquidação e auditoria.
- **Atualiza:** saldo da conta, caixa na data de pagamento, fatura e cartões; não duplica resultado das compras.
- **Notifica:** fatura vencida, pagamento parcial ou limite comprometido.
- **NOVA:** confirmação obrigatória para pagar fatura, selecionando cartão, conta, valor e data.
- **Consistência:** valor pago não excede saldo aberto sem crédito explicitamente suportado; a mesma liquidação não pode ser aplicada duas vezes.

### 5.8 Parcelamentos

**O que acontece:** contrato pai gera parcelas filhas imutáveis em quantidade, valor, competência e vencimento. Cada parcela é uma obrigação independente para cobrança/liquidação, mas mantém vínculo com o contrato.

- **Altera:** `InstallmentPlan`, `Installment`, obrigações/faturas relacionadas.
- **Não altera:** parcelas já liquidadas, exceto via estorno/ajuste.
- **Cria:** plano, N parcelas e auditoria, atomicamente.
- **Atualiza:** previsão mensal, dívida aberta, fatura/fluxo e dashboard.
- **Notifica:** parcela próxima, vencida ou alteração contratual.
- **NOVA:** confirma total, número de parcelas, primeira data, origem (cartão, empréstimo, financiamento ou compra direta).
- **Consistência:** soma das parcelas deve reconciliar com total, considerando arredondamento controlado na última parcela; não duplicar plano em reenvio de mensagem/webhook.

### 5.9 Empréstimos e financiamentos

**O que acontece:** representam contrato financeiro, principal, juros/taxas e cronograma. Recebimento do principal aumenta caixa quando aplicável; pagamento de parcela reduz caixa. Juros são despesa; amortização reduz principal. Financiamento de bem pode vincular ativo, mas não altera a regra do passivo.

- **Altera:** contrato, cronograma de parcelas, passivo e transações de recebimento/pagamento.
- **Não altera:** saldo de principal por edição manual; ativo vinculado sem operação explícita.
- **Cria:** contrato, parcelas, auditoria e fatos de caixa quando liquidados.
- **Atualiza:** dívida, fluxo previsto, compromissos, resultado de juros e dashboards.
- **Notifica:** parcela/vencimento, aumento de custo ou atraso.
- **NOVA:** confirmação obrigatória para cadastrar, quitar antecipadamente, renegociar ou pagar; deve solicitar instituição, total, taxa quando conhecida e cronograma.
- **Consistência:** juros, principal e saldo devem reconciliar; quitação antecipada cria evento próprio e cancela apenas parcelas futuras não liquidadas.

### 5.10 Contas fixas e ocorrências mensais

**O que acontece:** uma `RecurringRule` define padrão, e cada `MonthlyOccurrence` materializa um compromisso daquele período. A regra não é a despesa; a ocorrência só vira fato de caixa quando liquidada.

- **Altera:** regra e ocorrência do período; ao pagar, cria/liquida transação.
- **Não altera:** ocorrências passadas confirmadas ao editar uma regra futura.
- **Cria:** ocorrência idempotente por regra + período, obrigação e auditoria.
- **Atualiza:** fluxo previsto, contas a pagar, previsão por categoria e alertas.
- **Notifica:** criação próxima, vencimento, atraso ou variação relevante.
- **NOVA:** confirma criação/alteração de regra; para pagamento, confirma ocorrência, conta, valor e data.
- **Consistência:** `unique(rule_id, reference_period)`; editar regra define data efetiva; nunca regenerar ou duplicar o passado.

### 5.11 Metas e aportes

**O que acontece:** meta define objetivo, horizonte e critério. Aporte é um evento que move valor para uma conta/caixa reservado ou apenas registra progresso, conforme tipo da meta. Resgate é operação explícita inversa.

- **Altera:** `Goal`, `Contribution` e, se houver transferência real, contas envolvidas.
- **Não altera:** saldo disponível sem uma transação real; resultado financeiro por simples alteração de objetivo.
- **Cria:** aporte/resgate, transferência quando aplicável e auditoria.
- **Atualiza:** progresso de meta, saldo reservado, projeções e dashboard.
- **Notifica:** marco, atraso ou risco de não atingir a meta.
- **NOVA:** confirma valor, meta, origem/destino e se o aporte move dinheiro ou apenas registra progresso.
- **Consistência:** aporte não pode existir sem meta; não confundir reserva lógica com nova conta ou nova receita.

### 5.12 Estornos, cancelamentos e exclusões

**Estorno:** reversão de fato já confirmado. Cria nova transação com efeito oposto, vínculo `reversal_of` e justificativa. Atualiza saldos, caixa e dashboards pelo efeito líquido; não apaga o original.

**Cancelamento:** encerra rascunho, pendência futura, compra não liquidada ou parcela futura de contrato conforme regras. Não gera caixa realizado. Não pode cancelar fato que já foi pago sem usar estorno.

**Exclusão:** permitida apenas para rascunho sem dependência, anexo órfão ou dado auxiliar permitido. Exclusão física de lançamento financeiro confirmado é proibida.

- **NOVA:** confirmação obrigatória para estornar, cancelar compromisso que afete previsão, excluir rascunho e toda operação irreversível; deve resumir o impacto antes de executar.
- **Consistência:** transação já estornada não aceita estorno automático adicional; exclusão preserva audit event e referências exigidas por retenção.

## 6. Categorias, anexos e comprovantes

Categorias classificam receitas/despesas, têm escopo de workspace e podem ser arquivadas, nunca removidas se usadas. Reclassificar um lançamento mantém histórico de auditoria e recalcula relatórios por competência; não altera caixa.

Anexos e comprovantes pertencem a uma entidade financeira e possuem hash, tipo, tamanho, origem e status de verificação. Eles não comprovam automaticamente liquidação nem podem editar valor/data. A remoção do arquivo respeita retenção; a desvinculação é auditada. Dados sensíveis são minimizados.

## 7. Duplicidade e idempotência

1. Toda chamada que pode ser repetida tem `idempotency_key` única por `workspace + operação + origem`.
2. Webhooks usam identificador imutável do provedor; mensagens repetidas não criam novo lançamento.
3. Importações usam fingerprint de origem, valor, data, conta e referência, com fila de revisão para casos ambíguos; nunca deduplicação destrutiva silenciosa.
4. Recorrências usam unicidade de regra/período; parcelas usam contrato/número; faturas usam cartão/ciclo.
5. Ao receber chave já concluída, retornar o resultado original; ao receber chave em processamento, aguardar/bloquear com lock; nunca executar novamente.

## 8. Impactos entre módulos

| Fato | Saldo realizado | Caixa previsto | Resultado por competência | Cartão/fatura | Meta | Auditoria |
| --- | --- | --- | --- | --- | --- | --- |
| Receita liquidada | aumenta | atualiza | aumenta | não | somente se aporte | obrigatória |
| Despesa liquidada | reduz | atualiza | reduz | não | não | obrigatória |
| Transferência | move entre contas | atualiza | não altera | não | pode ser aporte | obrigatória |
| Compra no cartão | não altera | prevê fatura | reduz | aumenta fatura | não | obrigatória |
| Pagamento de fatura | reduz | atualiza | não duplica | reduz aberto | não | obrigatória |
| Conta fixa pendente | não altera | reduz previsto | conforme competência | não | não | obrigatória |
| Aporte real | move entre contas | atualiza | não altera | não | aumenta progresso | obrigatória |
| Estorno | efeito oposto | recalcula | efeito oposto | ajusta se aplicável | ajusta se aplicável | obrigatória |

## 9. NOVA: permissões e confirmações

NOVA nunca recebe acesso SQL direto. Ela propõe operações tipadas e chama ferramentas do domínio. A ferramenta valida contexto, permissão, estado, idempotência e invariantes antes da escrita.

**Confirmação obrigatória:** transferir, pagar fatura, liquidar despesa/receita em cenário ambíguo, criar empréstimo/financiamento, parcelar, estornar, cancelar compromisso com impacto, excluir, enviar mensagem externa e qualquer operação acima do limiar configurado pelo usuário.

**Pode executar sem confirmação adicional**, se a preferência permitir e todos os campos forem inequívocos: criar rascunho, consultar dados do próprio workspace, classificar sugestão, criar lembrete sem impacto financeiro e registrar informação não financeira.

## 10. Invariantes de integridade e auditoria

- Toda mutação financeira gera `AuditEvent` com ator, canal, correlação e resultado; nunca contém segredo ou conteúdo de comprovante completo.
- Uma transação multi-perna deve equilibrar por moeda. Transferência interna não altera patrimônio consolidado.
- Todo lançamento deve ter origem, status e datas válidas; conta/cartão/categoria/meta pertencem ao mesmo workspace.
- Todo dashboard é reconstruível a partir dos fatos e não pode ser usado para gravar saldo manual.
- Toda ação destrutiva ou sensível é reversível quando possível, explicável para o usuário e registrada.
- Em conflito, preservar o fato financeiro e abrir reconciliação é preferível a apagar/ajustar silenciosamente.

## 11. Exemplos normativos

1. **“Gastei R$ 20 no almoço”**: NOVA pede conta/data se não inferíveis, cria despesa liquidada e atualiza saldo, caixa, resultado e categoria Alimentação. Não toca cartão nem meta.
2. **Compra de R$ 1.200 em 12x no cartão**: cria compra e 12 parcelas ligadas a faturas/ciclos; não reduz conta no dia. Cada pagamento de fatura reduz caixa sem duplicar a despesa de competência.
3. **“Paguei a internet”**: localiza ocorrência mensal pendente; cria liquidação uma vez. A regra continua; a ocorrência daquele mês não pode ser recriada.
4. **“Cancele a compra” após ela estar paga**: NOVA explica que será estorno, pede confirmação e cria reversão vinculada ao fato original; não apaga o gasto.
