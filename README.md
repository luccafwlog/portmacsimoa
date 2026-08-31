# SCO — Simulador de Custo de Operação

Calculadora interna para cotações preliminares da PORTMAC.

O usuário informa uma faina, o início da operação, o volume, a produtividade
total por período e o total de ternos da operação. O núcleo calcula a quantidade
de períodos, distribui os ternos inteiros entre eles e devolve o custo total, o
custo por tonelada e uma memória simples do cálculo.
Custos opcionais de operação podem ser informados separadamente; cada um é
dividido pelo volume do navio e somado ao custo final.

O projeto não estima entradas, não escolhe a melhor operação e não administra a
operação. A redistribuição de ternos é um cenário manual: a soma dos ternos
precisa permanecer igual ao total informado.

As regras e os valores do OGMO entram por duas portas: `CatalogoOgmo` fornece a
faina e calcula o custo de cada período; `CalendarioOgmo` projeta os períodos a
partir de uma data e de um identificador de período. Os detalhes oficiais ainda
estão pendentes e não são substituídos por valores inventados no núcleo.

## Desenvolvimento

```text
npm install
npm test
npm run typecheck
```
