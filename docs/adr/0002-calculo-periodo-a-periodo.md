# ADR 0002 — O cálculo é período a período, não uma regra de três

**Status:** aceito · **Data:** 2026-08-31 · **Contexto:** [#8](https://github.com/luccafwlog/portmacsimoa/issues/8)

## Contexto

A leitura original do domínio dizia que "a máquina por baixo é de tempo":
`volume ÷ produtividade → períodos → custo`. Os documentos mostram que está
errado. A remuneração é por produção, com piso de salário-dia, por trabalhador e
por período requisitado:

```
remuneração = max( cota × taxa × produção , salário-dia )
```

Um custo médio da operação inteira não consegue representar isso. O piso é uma
função não linear que só se avalia **dentro** de um período: se a produção
daquele período não alcança o salário-dia, o piso manda — e o período de sobra,
com pouca carga, é exatamente onde isso acontece.

## Decisão

O motor projeta a linha do tempo em períodos concretos e calcula o custo de cada
categoria em cada período, aplicando `max(produção, piso)` por trabalhador. Nunca
se calcula sobre uma média.

O resultado carrega a abertura período a período, e cada linha diz quantos
trabalhadores caíram no piso.

## Consequências

- O simulador consegue dizer **qual regime está valendo**, que é a informação
  mais acionável que ele tem: navio produtivo → R$/ton ≈ a taxa; navio lento ou
  pequeno → o R$/ton dispara.
- A abertura por classe de dia (`porClasseDeDia`) é o único recorte que sugere
  uma ação concreta — mover a atracação
  ([#15](https://github.com/luccafwlog/portmacsimoa/issues/15), item 4).
- Custo: a simulação é O(períodos × categorias × trabalhadores). Para um navio
  de dias e equipes de dezenas, é irrelevante.
- O rateio interno da taxa-equipe precisa ser calculado mesmo sendo irrelevante
  para o custo da PORTMAC — porque o piso é por trabalhador, e só o rateio diz
  se alguém ficou abaixo dele.
- **Uma fração de período incide sobre o piso, nunca sobre a produção.** Sob a
  política `EXATO`, meio período requisitado dá direito a meio salário-dia — o
  piso é a contrapartida da requisição. Mas quem moveu 100 toneladas recebe por
  100 toneladas, tenha isso ocupado a jornada inteira ou um décimo dela.
  Escaliná-la pelo tempo reintroduziria pela porta dos fundos o modelo que este
  ADR descarta. A duração publicada e os custos por período saem da soma das
  frações, para que a linha do tempo não contradiga o que o resultado diz.
