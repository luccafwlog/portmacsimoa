# SCO — Simulador de Custo de Operação

Este repositório contém o núcleo de uma calculadora interna de custo para
cotação preliminar. O resultado é um cenário calculado, não uma promessa sobre
o custo final nem uma previsão automática da operação.

## Vocabulário decidido

- **Custos opcionais** — material de peação, madeira, locação de máquina,
  material de içamento ou outros itens descritos pelo usuário. Cada item pode
  ser ativado separadamente; o usuário informa seu custo total e o SCO divide
  cada valor pelo volume do navio.
- **Cliente** — nome opcional usado para identificar a cotação. Não altera o
  cálculo do cenário.
- **Faina** — a operação que será cotada. Uma simulação trata uma única faina.
  A faina é selecionada do catálogo; o usuário não cria uma faina livremente.
  A ACT é sempre consultada primeiro. A CCT só é usada quando a faina não
  estiver prevista na ACT.
- **Período** — uma das quatro faixas diárias da operação: `01-07`, `07-13`,
  `13-19` ou `19-01`. Cada período é apresentado junto da sua data de início;
  o período `19-01` termina no dia seguinte. Valores e regras de custo ainda
  vêm do catálogo/calendário oficial.
- **Produtividade** — quantidade total que a operação deve movimentar em um
  período. É informada pelo usuário e não é multiplicada automaticamente pelos
  ternos.
- **Terno** — unidade inteira de recurso que pode ser distribuída entre os
  períodos da operação. O usuário informa o total; o sistema cria uma
  distribuição equilibrada e permite uma redistribuição manual posterior de 0
  a 4 ternos por período.
- **Catálogo do OGMO** — fonte externa dos valores e regras necessários para
  calcular o custo de um período. Cada faina cadastrada mantém sua fonte,
  vigência e referência documental. A CCT pode ter códigos repetidos entre
  grupos de tabela; nesses casos, o cadastro usa grupo e código juntos. Uma
  faina transcrita, mas ainda não validada, fica visível no catálogo e fora da
  simulação. Não existe preço criado pelo usuário.

## Fluxo decidido

1. O usuário informa opcionalmente o cliente e informa faina, data e período de
   início, volume, produtividade e total de ternos.
2. O núcleo calcula `ceil(volume / produtividade)` períodos.
3. A partir da data e da faixa inicial, o calendário avança quatro períodos por
   dia e informa a data de início de cada período.
4. O volume é distribuído pela produtividade; o último período pode ser
   parcial, mas continua sendo um período inteiro requisitado.
5. Os ternos são distribuídos como inteiros e equilibrados. Uma distribuição
   explícita aceita de 0 a 4 ternos por período e só é aceita se tiver a mesma
   quantidade de períodos e a mesma soma do total informado.
6. O calendário do OGMO projeta os períodos e o catálogo documental calcula
   cada custo. A resolução da faina segue ACT e, somente quando necessário,
   CCT.
7. O resultado mostra custo total, custo por tonelada e memória simples por
   período. O custo final soma a mão de obra aos custos opcionais informados.

## Arquitetura de páginas

- **Nova simulação** é a página principal e concentra a montagem do cenário.
- **Clientes cadastrados** será o ponto de consulta do histórico de simulações
  e orçamentos associados a cada cliente.
- **Catálogo de fainas** detalha as fainas cadastradas, sua fonte (ACT ou CCT),
  vigência e regra de cálculo.
- A navegação atual é uma composição simples de páginas no cliente. Ainda não
  existe persistência de clientes, simulações ou orçamentos.

## Limites do primeiro núcleo

- uma faina por simulação;
- sem múltiplas cargas ou navios mistos;
- sem otimização automática;
- sem relação automática entre quantidade de ternos e produtividade;
- sem regras de jornada, adicionais, pisos ou valores fora da primeira fatia
  conferida do catálogo do OGMO;
- sem banco, autenticação ou histórico.

O catálogo da aplicação contém uma primeira fatia validada da ACT para granito,
produto siderúrgico e tubos/trilhos. O levantamento da CCT 2024/2026 foi
cadastrado por grupo e código de tabela, com unidades identificadas, mas suas
regras permanecem pendentes até a substituição completa do catálogo. Os
catálogos falsos dos testes servem apenas para validar o motor.
