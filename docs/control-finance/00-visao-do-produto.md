# 00 — Visão do Produto

## Objetivo

Definir CONTROL FINANCE como o produto premium de controle financeiro pessoal e empresarial do ecossistema CONTROL OS. A proposta não é uma planilha com chatbot: é uma central de decisão onde a pessoa conversa, registra, entende e age.

## Responsabilidades

- Consolidar finanças, compromissos financeiros e objetivos de cada cliente.
- Explicar prioridade, risco, projeção e próximo passo em linguagem humana.
- Receber comandos por web, voz e WhatsApp sem misturar identidades ou dados.
- Evoluir para módulos CONTROL OS sem acoplá-los prematuramente ao núcleo financeiro.

## Regras de produto

- **Control Finance primeiro:** financeiro é o domínio principal; Agenda, Hábitos, Notas e Mentor são integrações futuras, não requisitos para um lançamento financeiro sólido.
- **Uma conta, um dono:** cada dado pertence a uma pessoa/organização; o canal WhatsApp é apenas uma identidade vinculada.
- **IA como copiloto:** NOVA executa o operacional; LEGENDARY orienta estratégia. Nenhum deles inventa lançamentos ou altera dados sem evidência/consentimento.
- **Clareza antes de volume:** dashboard mostra decisões e exceções; detalhes ficam em módulos próprios.

## Fluxos principais

1. Cadastro → verificação de identidade → workspace pessoal ou organização.
2. Conectar canais → validar número/consentimento → receber comando.
3. NOVA interpreta → apresenta intenção/impacto → confirma quando necessário → grava/audita → responde.
4. Dashboard reúne estado, alertas e próximos passos.

## Entidades e componentes

`User`, `Organization`, `Membership`, `Workspace`, `FinancialAccount`, `Transaction`, `Budget`, `Goal`, `AgentProfile`, `ChannelIdentity`, `AuditEvent`. Componentes: App Shell, Navegação, Command/Conversation Surface, Dashboard, Financial Ledger e Settings.

## Relações, boas práticas, riscos e expansão

O usuário pode pertencer a múltiplas organizações; todo dado financeiro pertence a um workspace. Começar com workspace pessoal evita complexidade visual, mas o modelo já deve suportar organizações. Riscos: escopo virar “todo o Control OS” antes de o financeiro estar confiável; IA prometer autonomia sem salvaguardas. Expansões: planos, equipe, contador, Open Finance, cobranças, relatórios e marketplace de agentes.

