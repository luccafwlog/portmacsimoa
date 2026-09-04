# Auditoria do motor de cálculo do SCO

> **Nota posterior (setembro de 2026).** O catálogo auditado aqui não existe
> mais: a CCT foi removida do sistema por decisão de negócio e o mapeamento
> provisório da ACT foi retirado por estar incorreto. Os achados B1, B2 e B3
> descrevem dados que já não estão no repositório — mas as perguntas que eles
> levantam (a tarifa do documento é por cota ou por equipe? o que multiplica o
> quê?) continuam abertas e precisam ser respondidas **antes** do recadastro da
> ACT correta em `src/catalogo/act.ts`. O que trata do motor, e não da tabela,
> segue valendo. `baseDeCalculo`/`TARIFA_UNITARIA` e os arquivos
> `cct-provisorio.ts` e `act-provisorio.ts` citados abaixo já não existem.

**Base auditada:** commit `c7ee926`
**Método:** execução do motor real (`simular()` sobre `catalogoPortmac` e `calendarioOperacional`), sem mocks. Nenhum valor deste documento foi estimado.
**Data de início dos cenários:** 14/09/2026 (segunda-feira sem feriado), salvo onde indicado.
**Suíte existente no momento da auditoria:** 73 testes, todos passando.

---

## Veredito

O motor está **internamente consistente**. Não há erro de aritmética, de arredondamento ou de
distribuição. O problema é anterior: **o modelo de custo que ele implementa não tem trabalhador
dentro.**

Em regime de produção — 43 das 49 fainas do catálogo — o custo de um período é
`taxa × produção × encargos × majoração`. Nem `ternos`, nem `homens`, nem `cotas` (nas fainas CCT)
aparecem nessa expressão. Alocar 1 terno ou 4 ternos ao mesmo volume devolve o mesmo número.

São oito defeitos distintos. Cinco são fatos do código, verificáveis linha a linha. Três dependem
de validar as planilhas ACT/CCT contra o que o código assume.

---

## A. O que o motor realmente calcula

Toda a precificação passa por `calcularCustoComposicaoProvisoria` em `src/catalogo/portmac.ts`:

```
produção = produtividade_terno × ternos        ← único lugar em que o terno aparece
base     = fatorDaEquipe × taxaBase × produção
custo    = base × (1 + encargos) × majoração × multiplicaPorTernos
```

- `fatorDaEquipe` = `cotas` na base `COTAS_DA_EQUIPE`, e `1` na base `TARIFA_UNITARIA` — que é a
  base de *todas* as 36 fainas CCT de produção (`portmac.ts:130-135`).
- `multiplicaPorTernos` = `ternos` apenas em salário-dia; em produção é `1` (`portmac.ts:136`).

Substituindo em regime de produção:

```
custo = cotas × taxa × produtividade × ternos × encargos × majoração
```

Como `produção = produtividade × ternos` e o volume total do navio é fixo, **a soma dos períodos é
independente de quantos ternos foram alocados** — o produto `produtividade × ternos` é sempre o
mesmo volume.

### Evidência

12.000 t · CCT 4.3 Fertilizantes via Grab · 16 períodos a partir de segunda 07-13 · produtividade
por terno ajustada para manter a duração constante:

| Ternos | Homens por turno | Custo total |
| -----: | ---------------: | ----------: |
| 1 | 16 | R$ 6.327,20 |
| 2 | 32 | R$ 6.327,20 |
| 3 | 48 | R$ 6.327,20 |
| 4 | 64 | R$ 6.327,20 |

Quadruplicar o efetivo em campo move o custo em R$ 0,00. O mesmo vale para a ACT 1.0, onde os
quatro cenários fecham em R$ 72.265,78.

---

## B. Achados, em ordem de impacto

### B1 — A composição de equipe é ignorada em 36 das 41 fainas CCT

**Severidade:** crítico
**Onde:** `src/catalogo/portmac.ts:130-135` · `src/catalogo/cct-provisorio.ts:99`

Toda faina CCT em regime de produção recebe `baseDeCalculo: 'TARIFA_UNITARIA'`. Nessa base o código
descarta `regra.composicao` e a substitui por um item sintético com `homens: 0, cotas: 0` e
`fatorDaEquipe = 1`.

Os 16 trabalhadores e 19,4 cotas da `COMPOSICAO_PADRAO` existem apenas para a tela do catálogo.
Dobrando todos os campos da composição e recalculando (12.000 t, 2 ternos):

| Faina | Base de cálculo | Original | Composição × 2 | Razão |
| --- | --- | ---: | ---: | ---: |
| CCT 4.3 Fertilizantes | `TARIFA_UNITARIA` | 6.327,20 | 6.327,20 | **1,000** |
| CCT 1.1 Sacaria solta | `TARIFA_UNITARIA` | 29.834,03 | 29.834,03 | **1,000** |
| CCT 16.0 Peação | `COTAS_DA_EQUIPE` | 116.671,09 | 233.342,17 | 2,000 |
| ACT 1.0 Granéis | `COTAS_DA_EQUIPE` | 72.265,78 | 144.531,57 | 2,000 |

Só as 5 fainas CCT de salário-dia e as 8 fainas ACT respondem à composição. As outras 36 são imunes.

**Correção.** Se a tarifa da planilha CCT já é o valor total do terno, a composição não deveria
estar cadastrada nessas fainas — exibi-la no catálogo sugere que ela participa do preço. Se a
tarifa é por cota (como na ACT), `baseDeCalculo` está errado nas 36 fainas. É preciso decidir qual
das duas leituras a planilha sustenta antes de qualquer outra correção; **as duas não podem
coexistir.**

---

### B2 — Duas fainas de granel quase idênticas divergem 11,4×

**Severidade:** crítico
**Onde:** consequência direta de B1 · `src/catalogo/act-provisorio.ts` vs `src/catalogo/cct-provisorio.ts`

O flag `baseDeCalculo` é atribuído por origem da planilha, não por natureza da faina. Duas fainas
com a mesma carga, o mesmo equipamento e taxas praticamente iguais saem com preços em ordens de
grandeza diferentes (12.000 t, 750 t/terno/período, 2 ternos, semana limpa):

| Faina | Taxa | Multiplicador da equipe | R$/t |
| --- | ---: | --- | ---: |
| ACT 1.0 · Granéis com Grab | 0,2230 | 11,15 cotas | **6,0221** |
| CCT 4.3 · Fertilizantes/Carvão/Sal via Grab | 0,2177 | 1,00 | 0,5273 |
| CCT 4.2 · Granéis Agrícolas via Grab | 0,1949 | 1,00 | 0,4720 |
| CCT 3.7 · Granéis por Esteiras | 0,2523 | 1,00 | 0,6111 |

Pior: **a mesma carga aparece duas vezes no seletor de fainas.** "Blocos de Granito / Mármore"
existe como ACT 3.1 e como CCT 5.1, ambas selecionáveis, a **R$ 96,59/t e R$ 1,08/t** — 89× de
diferença. Quem cota escolhe a linha na lista sem nenhum aviso de que são a mesma coisa.

**Correção.** A regra "a ACT vence a CCT" documentada no `CONTEXT.md` **nunca dispara**:
`listarRegistros()` deduplica por `codigo`, e os códigos internos são prefixados
(`ACT_PROVISORIA_3_1` vs `CCT_PROVISORIA_5_1`), então nunca colidem. A deduplicação precisa de uma
chave de negócio — carga + equipamento — e não do código da tabela.

---

### B3 — `taxaBase` mistura três semânticas e o código aplica a mesma às três

**Severidade:** crítico
**Onde:** `src/catalogo/portmac.ts:135` · `src/catalogo/act-provisorio.ts:41-49`

O campo `observacao` de cada faina ACT descreve como a taxa da planilha deve ser tratada. São três
tratamentos diferentes — e o código multiplica os três por `cotas`, sem ler nada disso.

| Faina | Texto da referência | Se for da equipe | O motor cobra |
| --- | --- | ---: | ---: |
| ACT 7.5.2 · Contêiner cheio | "**Divisão** do valor arrecadado pela equipe por cotas" | 79,53 | **1.224,72** |
| ACT 3.1 · Blocos de granito | "Equipe com taxa fixa **global** de R$ 3,01/t" | 6,48 | **85,86** |
| ACT 3.2 · Siderúrgicos | "Taxa fixa **global** de R$ 4,00/t" | 8,61 | **114,10** |
| ACT 14.1.0 · Peação | "Fixada **por equipe** em R$ 515,20" | 1.109,16 | **4.436,65** |

"Divisão por cotas" e "taxa fixa global" descrevem um valor *da equipe*, que se reparte entre os
trabalhadores. Multiplicá-lo por cotas inverte a operação descrita. A ACT 14.1.0 é o caso mais
legível: R$ 515,20 declarado "por equipe" vira R$ 4.436,65 por período — **R$ 4.436 por homem por
dia** numa equipe de 4, quando o próprio texto diz que R$ 515,20 é o total.

Os testes em `testes/catalogo-portmac.test.ts:49,78` fixam esse comportamento
(`100 × 34,46 × 15,4 × 2,152877`), mas eles codificam o código, não o documento.

**Correção.** Promover a semântica de `observacao` a dado: um campo `tratamentoDaTaxa` com valores
`POR_COTA | POR_EQUIPE`, preenchido por faina a partir da planilha. Enquanto o texto documental e o
cálculo divergirem, o catálogo está afirmando duas coisas incompatíveis sobre a mesma linha.

---

### B4 — Alocar ternos não muda o custo, só desloca a operação no relógio

**Severidade:** crítico
**Onde:** `src/catalogo/portmac.ts:136` · `src/motor/simulador.ts:100-110`

Este é o sintoma visível na tela. Em regime de produção o custo do período é proporcional à
produção do período, e a produção do período já é `produtividade × ternos`. O volume total do navio
é fixo. Logo a soma não depende da alocação.

12.000 t · 750 t/terno/período · início segunda 07-13 (fluxo real da tela):

| Ternos | Períodos | Homens por turno | CCT 4.3 total | ACT 1.0 total |
| -----: | -------: | ---------------: | ------------: | ------------: |
| 1 | 16 | 16 | 6.327,20 | 72.265,78 |
| 2 | 8 | 32 | 6.327,20 | 72.265,78 |
| 3 | 6 | 48 | 6.151,44 | 70.258,40 |
| 4 | 4 | 64 | 6.327,20 | 72.265,78 |

A única variação — o cenário de 3 ternos, 2,8% mais barato — é **ruído de calendário**: com 6
períodos a operação pega 2 faixas noturnas em 6 em vez de 8 em 16. Não é economia de escala, é a
fração de turnos majorados mudando. Por isso a curva é não-monotônica: 3 ternos sai mais barato
que 4.

Para um simulador cuja pergunta central é "quantos ternos eu boto neste navio?", essa é a resposta
menos útil possível: "tanto faz, exceto pelo relógio".

**Correção.** O modelo só volta a ter trabalhador dentro quando existir **ou** um piso por terno
(`producaoMinimaPorTernoPorPeriodo`, ver B5), **ou** um componente fixo por terno-turno somado à
produção. O regime puramente proporcional é matematicamente indiferente à equipe, por construção.

---

### B5 — A produção mínima garantida está implementada e nunca é usada

**Severidade:** estrutural
**Onde:** `src/catalogo/portmac.ts:119-127` · nenhuma faina declara o campo

A mecânica do piso existe e funciona — `max(produção, piso × ternos)`, com testes cobrindo os três
casos. O `CONTEXT.md` já registra a pendência. Vale explicitar a consequência que ela produz na
tela, porque ela é a causa raiz de B4.

Sem piso, o custo por unidade em regime de produção é *exatamente constante* em relação à
produtividade. Rodando a análise de referência sobre as 49 fainas:

| Forma anunciada | Fainas | Amplitude | Origem real da variação |
| --- | ---: | ---: | --- |
| `CALENDARIO` | 43 | 12,7% | fração de turnos noturnos / fim de semana |
| `DECRESCENTE` | 6 | 552,1% | 1/produtividade puro (salário-dia) |

Dois valores de amplitude para 49 fainas, repetidos ao centésimo. **A análise de produtividade não
está medindo faina nenhuma** — está medindo o calendário nas 43 de produção e a aritmética do
salário-dia nas 6 restantes.

E a curva de fertilizantes que sai daí não guarda relação com a curva legada que o próprio
`CONTEXT.md` cita como referência:

| Produtividade | SCO hoje | Planilha legada PORTMAC |
| ---: | ---: | ---: |
| 500 t/terno | R$ 0,5730/t | R$ 34,05/t |
| 700 t/terno | R$ 0,5234/t | R$ 26,50/t |
| 1.200 t/terno | R$ 0,5155/t | — |

**Correção.** Levantar o piso por faina é o item de maior retorno do backlog: ele conserta B4, dá
sentido à análise de produtividade e é o que produz o joelho que o código já sabe localizar. Até
lá, a análise deveria dizer "esta faixa é o efeito do calendário", não "DECRESCENTE / o custo cai
com a produtividade".

---

### B6 — O bloco noturno 19-07 é cortado à meia-noite

**Severidade:** alto
**Onde:** `src/dominio/majoracoes.ts:69`

A tabela documentada trata a noite como um bloco de **19h às 07h do dia seguinte**: "sábado 19-07
+87,5%", "domingo 19-07 +134,375%". O código classifica cada período pelo dia da semana da *sua
própria data*. O período `01-07`, que é a segunda metade da noite anterior, recebe o tipo de dia
errado.

Operação atravessando o fim de semana de 11–14/09/2026:

| Período | Aplicado | Bloco 19-07 da tabela | Efeito |
| --- | ---: | ---: | --- |
| sáb 12/09 · 01-07 | +87,5% | sexta 19-07 → +25% noturno | cobra a mais |
| dom 13/09 · 01-07 | +134,375% | sábado 19-07 → +87,5% | cobra a mais |
| seg 14/09 · 01-07 | +25% | domingo 19-07 → +134,375% | cobra a menos |

O mesmo vale para a véspera de feriado: a madrugada do feriado é cobrada a +150%, mas a madrugada
*seguinte* ao feriado — que ainda é o bloco noturno do feriado — cai para +25%. Toda operação que
atravessa fim de semana ou feriado carrega esse erro em pelo menos dois períodos.

**Correção.** `obterMajoracaoDoPeriodo` deve classificar o período `01-07` pelo **dia anterior**, e
`ehFeriadoVilaVelha` deve ser consultado na mesma data deslocada. É uma correção pequena e
localizada — mas confirme antes contra a redação literal da ACT, porque a convenção oposta ("a
madrugada pertence ao dia civil em que ocorre") também existe em alguns instrumentos.

---

### B7 — Salário-dia é cobrado quatro vezes por dia civil

**Severidade:** a validar
**Onde:** `src/catalogo/portmac.ts:125-137`

Em `SALARIO_DIA` o código usa `quantidadeBase = 1` e cobra a diária inteira *em cada período de 6
horas*. Uma operação de um dia com 1 terno paga 4 diárias.

ACT 14.1.0 · Peação · "Fixada por equipe em R$ 515,20 (Salário-Dia)" · equipe de 4 homens:

| Passo | Valor |
| --- | ---: |
| Taxa da tabela | 515,20 |
| × 4 cotas × 2,152877 encargos = custo de um período | 4.436,65 |
| × 4 períodos = custo de um dia civil | **17.746,60** |
| por trabalhador, por dia | **4.436,65** |

Se "salário-dia" na planilha significa a diária do trabalhador, o motor infla o custo dessas fainas
em 4×. Se significa a remuneração do turno, está correto e o nome é que engana. Não dá para decidir
isso pelo código — mas o número de saída (R$ 4.436 por homem/dia numa peação) sugere fortemente a
primeira leitura, e ele se compõe com o erro de cotas de B3.

**Correção.** Se for diária: cobrar uma vez por dia civil ocupado, não por período. Isso exige
agrupar os períodos por data antes de custear — hoje `calcularCustoDoPeriodo` não tem essa visão.

---

### B8 — Detalhes menores que valem corrigir junto

**Severidade:** baixo

- **`homens` é decoração.** `ComposicaoCctProvisoria.homens` não é lido por nenhum cálculo em todo o
  repositório — só por strings de exibição (`portmac.ts:142`, `app.ts:294`). O campo que o usuário
  lê como "quantidade de trabalhadores" é, literalmente, ornamento.
- **A constante de encargos está duplicada e sem origem.** `ENCARGOS_E_CONTRIBUICOES = 1.152877`
  aparece em `act-provisorio.ts:19` e `cct-provisorio.ts:19`, sem citação de célula. Aplicado como
  `1 + 1,152877 = 2,152877`, ele mais que dobra toda cotação; se a planilha quis dizer "fator
  1,152877", tudo está 87% acima. Vale uma constante única com a origem no comentário.
- **`simular()` tem dois modos.** Conforme `ternosPorPeriodoPadrao` ser ou não informado: sem ele, a
  produtividade é do período e os ternos não afetam a produção. A interface sempre informa. O modo
  legado só vive nos testes e é um convite a erro silencioso.
- **O período parcial tem dois tratamentos.** O último período é truncado por
  `Math.min(..., restante)`. Em produção ele custa proporcionalmente menos; em salário-dia custa
  cheio. Um período com produção zero custa R$ 0,00 na produção e a diária inteira no salário-dia —
  dois tratamentos para o mesmo terno requisitado.

---

## C. O que está correto

O problema é o modelo, não a engenharia. Estas partes conferem e não precisam ser tocadas:

- **Contagem de períodos.** `ceil(volume ÷ produtividade ÷ ternos)` confere, e o volume distribuído
  soma exatamente o volume do navio em todos os cenários testados.
- **Distribuição de ternos.** Inteira e equilibrada, incluindo o resto (`[2,3,3]` para 8 em 3
  períodos). A redistribuição manual valida comprimento, faixa 0–4 e preservação do total.
- **Calendário.** A projeção de 4 períodos por dia e a aritmética de datas sem `Date` local estão
  corretas; a virada do mês e do ano confere.
- **Majoração.** A tabela de percentuais bate com o `CONTEXT.md`, feriado sobrepõe domingo
  corretamente, e `majoracaoDoPeriodoProjetado` é de fato a única fonte — motor e rascunho não
  divergem. O defeito é só o corte à meia-noite (B6).

---

## D. Ordem sugerida

B1 e B3 são decisões documentais, não de código: nenhuma correção é possível sem abrir as
planilhas. Elas vêm primeiro porque tudo depende delas.

1. **Decidir a semântica de `taxaBase`, faina a faina.** Por cota ou pela equipe. É uma coluna nova
   na transcrição das planilhas ACT e CCT. Sem isso, B1, B2 e B3 não têm resposta — e o erro varia
   de 4× a 89× conforme a faina.
2. **Unificar ACT e CCT sob a mesma base de cálculo.** Fainas equivalentes precisam produzir preços
   comparáveis. Enquanto CCT usa `TARIFA_UNITARIA` e ACT usa `COTAS_DA_EQUIPE`, a fonte da linha
   vale mais que a operação cotada.
3. **Levantar a produção mínima por faina.** É o que devolve significado ao número de ternos e à
   análise de produtividade. A mecânica já está pronta e testada — falta o dado.
4. **Corrigir o bloco noturno 19-07.** Independente dos anteriores, localizado, e afeta toda
   operação que cruza fim de semana ou feriado. Confirme a convenção no texto da ACT antes de mexer.
5. **Resolver a unidade do salário-dia.** Diária ou turno. Muda o custo dessas 6 fainas em 4×.
6. **Trocar os testes de regressão por testes documentais.** Hoje os testes reproduzem a fórmula do
   código. Depois de fixar a semântica, cada faina deveria ter um caso cujo valor esperado saia da
   planilha, não do `portmac.ts`.

---

## E. Como reproduzir os números

Os valores das tabelas foram medidos com um arquivo de teste temporário sob `testes/`, executado
com `npx vitest run`. O padrão de cada cenário:

```ts
import { data } from '../src/dominio/tempo.js';
import { calendarioOperacional } from '../src/calendario/operacional.js';
import { catalogoPortmac } from '../src/catalogo/portmac.js';
import { simular } from '../src/motor/simulador.js';

const INICIO = { data: data(2026, 9, 14), periodo: '07-13' }; // segunda sem feriado

function rodar(codigo: string, volume: number, prod: number, ternos: number) {
  const periodos = Math.ceil(volume / (prod * ternos));
  return simular({
    faina: codigo,
    inicio: INICIO,
    volumeToneladas: volume,
    produtividadeToneladasPorPeriodo: prod,
    ternosPorPeriodoPadrao: ternos,
    totalDeTernos: ternos * periodos,
  }, catalogoPortmac, calendarioOperacional);
}
```

- **B1** compara `rodar(...)` no `catalogoPortmac` contra um `new CatalogoPortmac(...)` construído a
  partir de `listarRegistros()` com `composicao` mapeada para `homens × 2, cotas × 2`.
- **B5** usa `analisarFainaDeReferencia(faina, catalogoPortmac, calendarioOperacional)` sobre
  `catalogoPortmac.listarFainas()`.
- **B6** usa `obterMajoracaoDoPeriodo({ data, periodo, fonte: 'ACT' })` diretamente.

Cuidado ao escolher a data de início: 07/09 é feriado nacional e distorce qualquer comparação entre
durações diferentes.
