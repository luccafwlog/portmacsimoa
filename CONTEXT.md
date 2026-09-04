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
  A ACT é a única fonte documental do catálogo: a CCT foi removida do sistema.
- **Período** — uma das quatro faixas diárias da operação: `01-07`, `07-13`,
  `13-19` ou `19-01`. Cada período é apresentado junto da sua data de início;
  o período `19-01` termina no dia seguinte. A remuneração do período segue a
  tabela da ACT: dia normal preço normal; sábado 07-19 preço normal e
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
  vigência e referência documental. Levantamentos alternativos ficam fora do
  catálogo até serem validados. Uma faina transcrita, mas ainda não validada,
  fica visível no catálogo e fora da simulação. Não existe preço criado pelo
  usuário. **O catálogo está vazio**: o cadastro anterior — CCT inteira e o
  mapeamento provisório da ACT — foi retirado, o primeiro por decisão de
  negócio e o segundo por estar incorreto.

- **ACT 2026/2028** — o acordo coletivo assinado em 02/06/2026 é a única fonte
  de taxas, salários, composição de equipe e adicionais. A segunda e última
  referência é o calendário: fins de semana, feriados nacionais e os feriados
  municipais de **Vila Velha**. `docs/act-2026-2028.md` resume as regras
  confirmadas e a extração completa está em `docs/fontes/`.

## Fluxo decidido

1. O usuário informa opcionalmente o cliente e informa faina, data e período de
   início. O cenário em si tem três entradas: **volume do navio**,
   **produtividade por terno por período** e **ternos por período**. Tudo o
   mais — quantidade de períodos e total de ternos — é derivado delas.
2. O núcleo calcula `ceil(volume ÷ produtividade ÷ ternos por período)`
   períodos, e o total de ternos da operação é `períodos × ternos por período`.
   Exemplo: 19.500 toneladas a 750 t por terno por período com 2 ternos dão
   13 períodos e 26 ternos no total. Aumentar os ternos por período encurta a
   operação; reduzi-los a alonga.
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
   A faina vem sempre da ACT; a regra calcula um terno completo.
7. O resultado mostra custo total, custo por unidade e memória simples por
   período. O custo final soma a mão de obra aos custos opcionais informados.
8. O detalhamento por períodos é onde o cenário é desenhado: cada período
   aceita a sua própria produtividade e de 0 a 4 ternos. Um gráfico dentro
   dessa seção acompanha a edição ao vivo, período a período, com o custo de
   cada um e a cor separando preço normal de período com adicional de jornada.
   O rascunho é custeado pelo mesmo catálogo que o motor usa, sem passar pela
   validação da simulação — é o que permite ver o efeito de um ajuste enquanto
   a soma dos ternos ainda não fechou. O gráfico do resultado repete esse
   desenho depois do cálculo, agora sobre o cenário aceito pelo motor.
   Não existe varredura automática de produtividades dentro do editor: ali
   comparar cenários é mover ternos e produtividades e ler o gráfico.
9. Antes de fechar o cenário, a **análise de produtividade** apresenta duas
   leituras separadas de propósito.
   - A **referência da faina** varre produtividades em um calendário neutro —
     a primeira segunda-feira sem feriado na janela varrida — com volume e
     ternos de referência declarados. Ela não depende de nada que o usuário
     tenha digitado, e por isso é comparável entre fainas.
   - O **cenário informado** varre a mesma grade sobre a data, o volume e os
     ternos reais, e mostra quanto a duração escolhida custa em relação à mais
     barata daquela semana.
   A diferença entre as duas é a informação de negócio: o que a tabela cobra
   contra o que aquela semana específica entrega. A mesma faina, com o mesmo
   volume, tem ótimo em produtividades muito diferentes conforme a data — é o
   feriado e o fim de semana que mandam, não a produtividade.
10. A forma da curva de referência é classificada pelo produto
   `custo por unidade × produtividade`, que é a quantidade efetivamente cobrada
   por período e por terno. Enquanto a operação paga um piso, o produto fica
   constante; assim que a produção supera o piso, ele passa a crescer. O
   **joelho** é essa fronteira, e é o único "ótimo da faina" que se sustenta.
   Sem piso cadastrado, o produto cresce desde o primeiro ponto (faina por
   produção) ou fica constante do começo ao fim (salário-dia), e a análise diz
   isso em vez de apontar um ótimo inexistente.
## Arquitetura de páginas

- **Nova simulação** é a página principal e concentra a montagem do cenário.
- **Clientes cadastrados** será o ponto de consulta do histórico de simulações
  e orçamentos associados a cada cliente.
- **Catálogo de fainas** detalha as fainas cadastradas, sua vigência e sua
  regra de cálculo. A fonte é sempre a ACT.
- A navegação atual é uma composição simples de páginas no cliente.
- Os orçamentos salvos ficam no `localStorage` do navegador, agrupados por
  cliente na página de clientes. Não existe banco, sincronização entre
  máquinas ou histórico compartilhado: limpar os dados do navegador apaga o
  registro.

## Apresentação

- `dominio/formato.ts` é a única fonte de moeda, número, percentual e do nome
  da unidade de cada faina. Tela, impressão e memória de cálculo passam por
  ele; nenhum módulo formata `Intl` por conta própria.
- Cada linha da memória declara se é `MOEDA` ou `QUANTIDADE`. A camada de
  apresentação lê essa marca em vez de adivinhar pela posição da linha.
- Os dois gráficos de cenário — o do editor e o do resultado — são a mesma
  função de desenho alimentada por dados diferentes, para que o rascunho e o
  cálculo nunca divirjam na leitura.
- `majoracaoDoPeriodoProjetado` é a única regra de majoração por período:
  o motor a usa para custear e a interface para desenhar o rascunho.
- A grade de produtividades é linear e derivada da operação: os candidatos são
  igualmente espaçados entre a produtividade que fecharia na duração mais longa
  considerada e a que fecharia na mais curta. Uma grade construída a partir de
  durações inteiras amontoaria os pontos justamente na faixa baixa, que é onde
  um piso faz o custo unitário virar.
- Toda varredura começa em um ciclo diário completo (quatro períodos).
  Operações de um ou dois períodos cabem inteiras nas faixas diurnas e não
  pagam adicional, o que as torna artificialmente baratas: isso é propriedade
  do relógio, não da faina.
- `src/styles.css` é uma camada única: os tokens vivem em um único `:root`,
  cada seletor aparece uma vez e as variações por largura ficam nas três
  media queries do fim do arquivo.

## Limites do primeiro núcleo

- uma faina por simulação;
- sem múltiplas cargas ou navios mistos;
- a grade de produtividade da otimização permanece provisória até a validação
  documental das faixas e limites operacionais;
- sem cobertura de feriados municipais, estaduais ou portuários;
- sem banco, autenticação ou histórico.

## Produção mínima garantida — pendente

A regra de custo aceita `producaoMinimaPorTernoPorPeriodo`: com um piso, a
quantidade cobrada é `max(produção, piso × ternos)`. **Nenhuma faina declara
esse valor** — o catálogo está vazio —, e enquanto isso não mudar o cálculo não
aplica piso algum.

É esse piso que cria o joelho da curva de custo por produtividade — abaixo dele
o custo unitário cai como 1/produtividade, acima dele fica plano. A curva de
referência levantada pela PORTMAC na planilha legada de fertilizantes cai de
R$ 34,05 a cerca de R$ 26,50 entre 500 e 700 t por terno e depois estabiliza;
essa razão de 1,28 na ponta baixa implica um piso perto de 650 t por terno por
período. Sem os valores documentais por faina, o simulador não tem como apontar
um ótimo próprio da faina, e diz isso na análise em vez de inventar um número.

## Catálogo vazio — estado atual

`src/catalogo/act.ts` exporta uma lista vazia. A CCT saiu do sistema por
completo (arquivos, tipos, filtro de fonte e tabela de majoração) e o
mapeamento provisório da ACT foi apagado por estar errado. Sem faina
cadastrada não há simulação: a interface diz isso no combobox e no catálogo em
vez de oferecer um número inventado.

O recadastro acrescenta registros em `src/catalogo/act.ts` com `fonte: 'ACT'` e
uma `regraAct` — taxa-base, regime (produção ou salário-dia), unidade,
encargos/contribuições e a composição do terno em cotas. Antes de transcrever,
vale responder o que a auditoria em `docs/auditoria-do-calculo.md` deixou em
aberto: se a taxa do documento é por cota ou pela equipe inteira. Os catálogos
falsos dos testes (`testes/fainas-de-teste.ts`) servem apenas para validar o
motor e não representam nenhuma tabela real.
