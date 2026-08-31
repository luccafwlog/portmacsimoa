# ADR 0001 — Núcleo puro, com catálogo e calendário atrás de portas

**Status:** aceito · **Data:** 2026-08-31 · **Contexto:** [#1](https://github.com/luccafwlog/portmacsimoa/issues/1), [#2](https://github.com/luccafwlog/portmacsimoa/issues/2), [#6](https://github.com/luccafwlog/portmacsimoa/issues/6)

## Contexto

Os dados que o cálculo consome — tabelas de remuneração, composição de equipe,
calendário OGMO — ainda não estão em mãos. O dossiê ([#2](https://github.com/luccafwlog/portmacsimoa/issues/2))
entregou o ACT e a CCT, mas falta a CCT inteira digitada, o calendário e um navio
real. As restrições de hospedagem ([#6](https://github.com/luccafwlog/portmacsimoa/issues/6))
também estão abertas: não se sabe ainda se roda em nuvem ou on-premise, nem se
existe login corporativo para reaproveitar.

Esperar por tudo isso deixaria o projeto parado. Escolher agora um banco e um
framework travaria decisões que ainda são de outra pessoa.

## Decisão

O núcleo de cálculo é TypeScript puro, sem dependências de runtime. Catálogo e
calendário entram por interfaces (`Catalogo`, `CalendarioOgmo`), com
implementações em memória alimentadas por dados literais.

A dependência aponta só para dentro: o motor conhece as portas, e nada conhece o
motor.

## Consequências

- O motor roda hoje, com o pedaço do ACT que já foi conferido.
- Quando o dossiê chegar, o trabalho é preencher dados — não reescrever cálculo.
- Quando o [#6](https://github.com/luccafwlog/portmacsimoa/issues/6) responder
  onde isso roda, a escolha de banco e de hospedagem é uma implementação nova
  das portas. Nenhuma linha de cálculo muda.
- Como os PDFs são escaneados e sem camada de texto, a carga do catálogo será
  digitação revisada, não importação. Dados como literais TypeScript são
  conferíveis linha a linha contra o documento — que é exatamente a revisão que
  esse material exige.
- Preço: sem banco, não há hoje persistência de simulações. É deliberado — o que
  se persiste depende do [#12](https://github.com/luccafwlog/portmacsimoa/issues/12).
