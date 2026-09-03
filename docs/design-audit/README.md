# Auditoria de design — SCO · Simulador de Custo de Operação

**Data:** 01/09/2026  
**Snapshot:** `093544a` + working tree local  
**Ambiente:** `http://127.0.0.1:5174`  
**Escopo:** simulador local, incluindo nova simulação, resultado, memória detalhada, catálogo de fainas e clientes cadastrados.

## Método

O fluxo foi percorrido no navegador embutido, em viewport desktop de 1280×720, com capturas `fullPage` das telas principais. Foram verificados:

- entendimento da tarefa e hierarquia visual;
- navegação entre as três rotas disponíveis;
- estados vazio, preenchido, calculado, erro e expansão/recolhimento;
- busca e filtros do catálogo;
- semântica básica dos controles, campos obrigatórios e mensagens de validação;
- console do navegador após navegação e cálculo;
- regras responsivas por inspeção dos breakpoints CSS.

O navegador embutido disponível permaneceu fixo em 1280×720 e não permitiu uma captura real em 390×844. A avaliação mobile, portanto, ficou limitada à inspeção dos breakpoints e das regras de overflow; não é evidência equivalente a um teste visual em dispositivo.

## Evidências

- [Nova simulação — estado inicial](assets/nova-simulacao-desktop-inicial.png)
- [Nova simulação — resultado calculado](assets/nova-simulacao-desktop-resultado.png)
- [Clientes cadastrados](assets/clientes-desktop.png)
- [Catálogo de fainas](assets/catalogo-desktop.png)

## Resultado executivo

O simulador consegue levar o usuário do preenchimento ao cálculo e à memória detalhada. A hierarquia visual é consistente, os estados recolhidos reduzem a carga inicial e o cálculo apresenta os principais valores de forma clara. Não foram observados erros de console durante a navegação ou o cálculo.

Os principais riscos encontrados foram tratados nesta rodada. Ainda resta uma validação visual mobile real e uma possível decisão estrutural sobre a forma de explorar o catálogo em telas menores.

## Correções aplicadas nesta rodada

| Achado | Correção | Evidência |
| --- | --- | --- |
| Catálogo difícil de ler | Aumentada a tipografia da tabela, reforçada a hierarquia das fainas e referências movidas para expansão “Ver referência”. | [catálogo desktop](assets/catalogo-desktop.png) |
| Primeira ação distante | Hero da nova simulação compactado e botão “Calcular cenário” tornado persistente durante a rolagem do formulário. | [nova simulação inicial](assets/nova-simulacao-desktop-inicial.png) |
| Clientes cria expectativa | Navegação e título agora comunicam “Clientes · em breve” / “Clientes em breve”. | [clientes desktop](assets/clientes-desktop.png) |
| Rótulo ambíguo | Campo passou a usar “Volume do navio” ou “Quantidade do navio”, conforme a unidade da faina. | [nova simulação inicial](assets/nova-simulacao-desktop-inicial.png) |
| Provisório pouco destacado | Legenda “ACT/CCT · provisória” adicionada junto aos filtros do catálogo; os badges por registro foram mantidos. | [catálogo desktop](assets/catalogo-desktop.png) |

## Resumo por dimensão

| Dimensão | Nota | Leitura |
| --- | ---: | --- |
| Entendimento | 4/5 | O fluxo e os resultados são claros; “Unidade da operação” ainda é um rótulo menos direto que “Volume”. |
| Confiança | 3/5 | ACT/CCT provisórias estão identificadas, mas o catálogo é visualmente denso e Clientes ainda é placeholder. |
| Conversão | 3/5 | A ação funciona, mas a introdução e o formulário ocupam bastante espaço antes do resultado. |
| Consistência visual | 4/5 | Navegação, painéis, índices, badges e estados seguem o mesmo vocabulário. |
| Estados e feedback | 4/5 | Há estado vazio, erro, cálculo e expansão; a validação de totais é visível no detalhamento. |
| Responsividade | 3/5 | Há breakpoints e overflow horizontal previstos, mas o viewport mobile não pôde ser exercitado visualmente. |

## Achados priorizados

### P1 — Catálogo difícil de ler em uso real

**Eixos:** Entendimento / Confiança  
**Evidência:** [catálogo desktop](assets/catalogo-desktop.png)

As 49 linhas são apresentadas em uma tabela com seis colunas, textos monoespaçados pequenos e referências longas que quebram em várias linhas. A origem e o estado estão presentes, mas a comparação entre registros exige esforço elevado e a coluna de referência compete com a regra de custo.

**Recomendação:** manter busca e filtro, mas priorizar uma linha-resumo por faina e transferir referência/documentação para uma expansão, drawer ou detalhe sob demanda. Em uma etapa intermediária, aumentar a legibilidade da tabela e reduzir o peso visual da referência.

### P2 — Primeira ação fica distante da entrada

**Eixos:** Conversão  
**Evidência:** [nova simulação inicial](assets/nova-simulacao-desktop-inicial.png)

O hero ocupa uma área grande e, em seguida, o usuário percorre custos opcionais antes de chegar ao detalhamento e ao botão “Calcular cenário”. O resultado é uma primeira interação longa para uma cotação preliminar.

**Recomendação:** manter a identidade do hero, mas reduzir sua altura em telas desktop ou usar uma composição mais compacta quando a tarefa for recorrente. Considerar colocar o botão de cálculo em uma ação persistente após o primeiro preenchimento.

### P2 — “Clientes cadastrados” cria expectativa de recurso disponível

**Eixos:** Confiança / Conversão  
**Evidência:** [clientes cadastrados](assets/clientes-desktop.png)

A navegação apresenta “Clientes cadastrados” como uma área normal do produto, mas a tela informa “Em breve” e não permite cadastrar ou consultar clientes. O CTA direciona para uma nova simulação, não para resolver a expectativa criada pelo item de navegação.

**Recomendação:** enquanto a funcionalidade não existir, rotular a navegação como “Clientes — em breve” ou retirar o item da navegação principal. Quando for implementada, a tela deve explicar o próximo passo de cadastro e consulta.

### P2 — Rótulo “Unidade da operação” é ambíguo

**Eixos:** Entendimento  
**Evidência:** [nova simulação inicial](assets/nova-simulacao-desktop-inicial.png)

O campo numérico que recebe `105` aparece como “Unidade da operação”, enquanto o contexto do cálculo trata esse valor como volume/quantidade do navio. O usuário pode interpretar o campo como unidade de medida ou tipo de operação.

**Recomendação:** usar um rótulo contextual, como “Volume da operação”, “Quantidade do navio” ou “Quantidade de contêineres”, de acordo com a unidade da faina.

### P3 — Catálogo provisório depende de leitura cuidadosa dos badges

**Eixos:** Confiança  
**Evidência:** [catálogo desktop](assets/catalogo-desktop.png)

Os badges ACT/CCT e “Provisória” estão disponíveis, o que é positivo. Entretanto, como quase todo o catálogo está provisório, a distinção depende de pequenos textos e cores suaves. Em uma leitura rápida, a natureza preliminar pode passar despercebida.

**Recomendação:** manter o estado por registro, mas reforçar o filtro de origem/status e adicionar uma legenda curta próxima aos controles do catálogo.

## Pontos positivos observados

- A nova simulação possui sequência compreensível: dados, custos, detalhamento e cálculo.
- O detalhamento por períodos começa recolhido e evita uma tabela extensa no primeiro contato.
- Os totais de volume e ternos aparecem antes da edição e permitem detectar divergências.
- A memória detalhada apresenta resumo, custo total e composição por período em camadas.
- A composição por período começa recolhida e o botão informa claramente `+`/`−`.
- O cálculo foi concluído com 11 períodos e a memória exibiu a produtividade de cada período.
- Busca e filtros ACT/CCT estão presentes no catálogo.
- Não houve erros de console além das mensagens normais de conexão do Vite.

## Verificações funcionais

| Verificação | Resultado |
| --- | --- |
| Nova simulação inicial | 7 campos obrigatórios; detalhamento por períodos recolhido; projeção inicial de 11 períodos. |
| Cálculo do cenário | Resultado exibido; composição por período recolhida por padrão. |
| Expansão da memória | Botão alterna entre `Composição por período +` e `Composição por período −`; 11 períodos aparecem; nenhum item abre automaticamente. |
| Produtividade por período | A produtividade aparece no resumo de cada período e como linha da memória expandida. |
| Catálogo | 49 registros; busca presente; filtros Todas, ACT e CCT presentes. |
| Clientes | Estado vazio explícito e CTA para criar nova simulação. |
| Console | Sem erros de aplicação observados. |

## Top 5 problemas que prejudicam a conversão

1. Densidade excessiva do catálogo para comparação e conferência.
2. Distância vertical até o botão “Calcular cenário”.
3. Navegação para uma área de clientes que ainda não está disponível.
4. Rótulo ambíguo para o volume/quantidade principal da operação.
5. Estado provisório do catálogo depende de badges pequenos para ser percebido.

## Top 5 quick wins

1. Renomear “Unidade da operação” para um rótulo contextual de quantidade/volume.
2. Adicionar uma legenda de ACT/CCT e provisória ao lado dos filtros do catálogo.
3. Aumentar levemente a legibilidade da tabela e reduzir a ênfase da coluna de referência.
4. Exibir “Clientes — em breve” diretamente na navegação enquanto a tela não for implementada.
5. Testar uma variação compacta do hero e uma ação de cálculo persistente em desktop.

## Próximo passo recomendado

Priorizar a legibilidade do catálogo e fechar a decisão de produto sobre a navegação de clientes. Em seguida, fazer uma rodada mobile real em 390×844, validando que a tabela mantém overflow horizontal e que os campos e o botão de cálculo permanecem acionáveis sem zoom.
