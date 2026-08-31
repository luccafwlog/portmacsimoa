# ADR 0004 — Nenhuma consulta ao catálogo sem data

**Status:** aceito · **Data:** 2026-08-31 · **Contexto:** [#12](https://github.com/luccafwlog/portmacsimoa/issues/12), [#18](https://github.com/luccafwlog/portmacsimoa/issues/18)

## Contexto

As tabelas mudam mais ou menos uma vez por ano, e alguém da PORTMAC as edita. Uma
simulação feita hoje precisa continuar reproduzível depois que os acordos forem
renovados. Além disso, a data que manda pode não ser a de hoje: cotar em dezembro
um navio que atraca em fevereiro, já sob o acordo novo, é caso comum.

O [#12](https://github.com/luccafwlog/portmacsimoa/issues/12) ainda não decidiu
se a simulação é fotografia ou receita. Mas essa decisão só é *possível* se toda
consulta ao catálogo for datada desde o começo — retrofitar data numa API que não
a tem significa reescrever tudo que a chama.

## Decisão

Toda linha de catálogo tem `Vigencia { de, ate }`, e todo método da porta
`Catalogo` recebe a data de referência. Não existe leitura "do catálogo atual".

Entre linhas vigentes na mesma data, vence a de início mais recente.

A data de referência sai da política `dataQueDeterminaVigencia`, com default
`DATA_DA_OPERACAO`.

## Consequências

- A "fotografia" do [#12](https://github.com/luccafwlog/portmacsimoa/issues/12)
  fica disponível de graça: guardar os inputs mais a data de referência
  reproduz o número, sem copiar as tabelas.
- Corrigir um erro de digitação e negociar um reajuste ficam naturalmente
  distintos: o primeiro edita a linha vigente, o segundo cria uma com início
  novo. O histórico não se perde nos dois casos.
- A ausência de exceção de cobertura devolve `CCT` — não é conveniência nossa, é
  o que a Cláusula Décima Terceira do ACT manda
  ([#9](https://github.com/luccafwlog/portmacsimoa/issues/9)).
- O simulador **não** implementa "condição mais favorável ao trabalhador"
  ([#18](https://github.com/luccafwlog/portmacsimoa/issues/18)). Um simulador que
  arbitra precedência entre instrumentos coletivos está resolvendo um problema
  jurídico com código, e vai errar. Ele aplica o catálogo vigente; a integração
  automática de reajuste da CCT vira procedimento humano de atualização de
  tabela. Se o [#18](https://github.com/luccafwlog/portmacsimoa/issues/18)
  decidir o contrário, é uma implementação nova da porta.
