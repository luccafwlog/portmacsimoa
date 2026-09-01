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
  o período `19-01` termina no dia seguinte. A remuneração do período segue a
  tabela da ACT/CCT: dia normal preço normal; sábado 07-19 preço normal e
  19-07 +87,5%; domingo 07-19 +87,5% e 19-07 +134,375%; feriado 07-19
  +100% e 19-07 +150%. O adicional é somado ao preço normal.
  Quando o feriado cai no domingo, somente a tabela de feriado é aplicada.
- **Produtividade** — quantidade movimentada por um terno em um período. É
  informada pelo usuário; a capacidade nominal do período é a produtividade
  multiplicada pela quantidade de ternos alocados nele.
- **Terno** — unidade inteira de recurso alocada em cada período da operação.
  O usuário informa de 1 a 4 ternos por período; o sistema calcula o total
  multiplicando essa quantidade pelos períodos e permite uma redistribuição
  manual posterior, preservando o total calculado.
- **Catálogo do OGMO** — fonte externa dos valores e regras necessários para
  calcular o custo de um período. Cada faina cadastrada mantém sua fonte,
  vigência e referência documental. O cadastro CCT provisório usa uma única
  linha por faina da planilha autorizada; levantamentos alternativos ficam fora
  do catálogo até serem validados. Uma faina transcrita, mas ainda não
  validada, fica visível no catálogo e fora da simulação. Não existe preço
  criado pelo usuário.

## Fluxo decidido

1. O usuário informa opcionalmente o cliente e informa faina, data e período de
   início, volume, produtividade e ternos por período. O total de ternos é
   calculado automaticamente.
2. O núcleo calcula `ceil(volume / (produtividade × ternos por período))`
   períodos.
3. A partir da data e da faixa inicial, o calendário avança quatro períodos por
   dia e informa a data de início de cada período.
4. O volume é distribuído pela capacidade de cada período (`produtividade por
   terno × ternos`); o último período pode ser parcial, mas continua sendo um
   período inteiro requisitado.
5. Os ternos são distribuídos como inteiros e equilibrados a partir da
   quantidade informada por período. Uma distribuição explícita aceita de 0 a
   4 ternos por período e só é aceita se tiver a mesma quantidade de períodos e
   a mesma soma do total calculado.
6. O calendário do OGMO projeta os períodos e o catálogo documental calcula
   cada custo com a remuneração da faixa e do dia. Sábados e domingos são
   identificados pela data; feriados nacionais fixos também são reconhecidos
   automaticamente pelo calendário nacional da aplicação.
   A resolução da faina segue ACT e, somente quando necessário, CCT. As regras
   das planilhas ACT/CCT são provisórias e calculam um terno completo.
7. O resultado mostra custo total, custo por unidade e memória simples por
   período. O custo final soma a mão de obra aos custos opcionais informados.
8. A sensibilidade à produtividade compara uma grade fixa e independente da
   produtividade informada. Para cada candidato, o núcleo recalcula os
   períodos, redistribui os ternos e executa o mesmo motor de custos. O ótimo é
   o menor custo por unidade entre os candidatos viáveis; a produtividade-base
   serve apenas para o cenário informado.

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
- a grade de produtividade da otimização permanece provisória até a validação
  documental das faixas e limites operacionais;
- sem cobertura de feriados municipais, estaduais ou portuários;
- sem banco, autenticação ou histórico.

O catálogo da aplicação usa provisoriamente o mapeamento da planilha ACT
2026/2028 para 8 fainas; o mapeamento da planilha CCT
2024/2026 está habilitado provisoriamente para 41 fainas. Ambos usam composição
por terno, regime de produção ou salário-dia e encargos/contribuições conforme
as próprias planilhas. Os levantamentos documentais restantes continuam
pendentes até a substituição pelos documentos oficiais. Os catálogos falsos dos
testes servem apenas para validar o motor.
