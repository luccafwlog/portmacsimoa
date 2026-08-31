# SCO — Simulador de Custo de Operação

Este repositório contém o núcleo de uma calculadora interna de custo para
cotação preliminar. O resultado é um cenário calculado, não uma promessa sobre
o custo final nem uma previsão automática da operação.

## Vocabulário decidido

- **Custos opcionais** — material de peação, madeira, locação de máquina,
  material de içamento ou outro item descrito pelo usuário. Quando ativados, o
  usuário informa o custo total de cada item; o SCO divide cada valor pelo
  volume do navio.
- **Cliente** — nome opcional usado para identificar a cotação. Não altera o
  cálculo do cenário.
- **Faina** — a operação que será cotada. Uma simulação trata uma única faina.
- **Período** — uma das quatro faixas diárias da operação: `01-07`, `07-13`,
  `13-19` ou `19-01`. Cada período é apresentado junto da sua data de início;
  o período `19-01` termina no dia seguinte. Valores e regras de custo ainda
  vêm do catálogo/calendário oficial.
- **Produtividade** — quantidade total que a operação deve movimentar em um
  período. É informada pelo usuário e não é multiplicada automaticamente pelos
  ternos.
- **Terno** — unidade inteira de recurso que pode ser distribuída entre os
  períodos da operação. O usuário informa o total; o sistema cria uma
  distribuição equilibrada e permite uma redistribuição manual posterior.
- **Catálogo do OGMO** — fonte externa dos valores e regras necessários para
  calcular o custo de um período. Se faltar dado essencial, a cotação real deve
  ser recusada.

## Fluxo decidido

1. O usuário informa opcionalmente o cliente e informa faina, data e período de
   início, volume, produtividade e total de ternos.
2. O núcleo calcula `ceil(volume / produtividade)` períodos.
3. A partir da data e da faixa inicial, o calendário avança quatro períodos por
   dia e informa a data de início de cada período.
4. O volume é distribuído pela produtividade; o último período pode ser
   parcial, mas continua sendo um período inteiro requisitado.
5. Os ternos são distribuídos como inteiros e equilibrados. Uma distribuição
   explícita só é aceita se tiver a mesma quantidade de períodos e a mesma soma
   do total informado.
6. O calendário do OGMO projeta os períodos e o catálogo do OGMO calcula cada
   custo.
7. O resultado mostra custo total, custo por tonelada e memória simples por
   período. O custo final soma a mão de obra aos custos opcionais informados.

## Limites do primeiro núcleo

- uma faina por simulação;
- sem múltiplas cargas ou navios mistos;
- sem otimização automática;
- sem relação automática entre quantidade de ternos e produtividade;
- sem regras de jornada, adicionais, pisos ou valores codificados antes da
  conferência do catálogo do OGMO;
- sem banco, autenticação ou histórico.

O catálogo fictício usado nos testes serve somente para validar a arquitetura.
Ele não representa uma cotação oficial.
