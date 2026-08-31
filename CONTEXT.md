# PORTMAC — Simulador de Custo de Operação Portuária

Aplicação web interna da PORTMAC (Porto de Vitória/ES). Recebe as variáveis de
um navio e devolve o custo da operação, cujo número-título é **R$ por tonelada**.

Este repositório contém o **núcleo de cálculo**. A especificação de produto vive
nas issues, sob o mapa [#1](https://github.com/luccafwlog/portmacsimoa/issues/1).

## Como este código se relaciona com a spec

O mapa produz **decisões**; este repositório produz **o motor que as executa**.
As duas coisas avançam em paralelo de propósito: a forma do cálculo já está
determinada pelos documentos lidos, mesmo que os catálogos (tabelas, calendário)
ainda não estejam em mãos.

O que ainda não foi decidido **não foi chutado**. Cada questão aberta aparece de
uma destas três formas, todas rastreáveis:

| Forma | Onde | Para quê |
|---|---|---|
| **Porta** | `src/catalogo/portas.ts`, `src/calendario/portas.ts` | O dado que falta entra por trás de uma interface. O motor não espera por ele. |
| **Política** | `src/motor/politicas.ts` | A regra em aberto vira um campo nomeado com default explícito, ligado à issue que a fecha. |
| **Premissa** | `ResultadoDeSimulacao.premissas` | Toda escolha do motor aparece no resultado. Nenhuma passa por dado do cliente. |

## Vocabulário

Provisório enquanto o [#7](https://github.com/luccafwlog/portmacsimoa/issues/7)
não fecha. O que está marcado **(aberto)** é uso interno deste código, não
terminologia aprovada.

- **Faina** — a unidade que o catálogo indexa: a carga e a operação sobre ela,
  com um código (`5.1` granito, `7.5` LO-LO contêiner) e uma **unidade de
  medida** própria. É por faina que se consulta taxa e composição de equipe.
- **Unidade de medida** — `TON`, `UND` ou `VOLUME`. Boa parte do catálogo **não**
  se remunera por tonelada, e um mesmo navio pode ter duas bases ao mesmo tempo
  ([#17](https://github.com/luccafwlog/portmacsimoa/issues/17)).
- **Categoria** — conferentes, estivadores, arrumadores, suporte, vigias.
- **Instrumento** — `ACT` ou `CCT`. Determinado pelo par `(faina, categoria)`,
  com CCT como default imposto pela norma
  ([#9](https://github.com/luccafwlog/portmacsimoa/issues/9), resolvido).
- **Terno** — frente de trabalho. Multiplica as posições de escala `POR_TERNO`
  e não as de escala `POR_NAVIO`
  ([#16](https://github.com/luccafwlog/portmacsimoa/issues/16)).
- **Período** — a jornada de 12 horas: 7h–19h (diurno) e 19h–7h (noturno). Dois
  por dia. É a unidade de requisição e a unidade em que o piso é avaliado.
- **Cota** — o peso de uma função no cálculo da remuneração.
- **Taxa homem / taxa equipe** — os dois regimes de remuneração. `Conferente =
  Taxa equipe · Demais = Taxa homem` (OBS do ANEXO I do ACT).
- **Salário-dia** — o piso por trabalhador e por período **requisitado**, pago
  mesmo sem produção.
- **Total c/E.S** — a coluna que a PORTMAC paga; `Base × 2,152842`. É a única
  que entra na conta ([#11](https://github.com/luccafwlog/portmacsimoa/issues/11)).

## A regra que governa tudo

Por trabalhador e por período requisitado (ACT, Cláusula Quinta, §2º):

```
remuneração = max( cota × taxa × produção , salário-dia ) × multiplicador_do_período
```

O tempo **não** multiplica o custo. O que ele faz é decidir quantos períodos são
requisitados — e cada período requisitado carrega o piso.

**A consequência inverte a intuição comercial.** Navio produtivo: manda a
produção, e o R$/ton é aproximadamente a taxa. Navio lento ou pequeno: manda o
piso, e o R$/ton dispara. Dizer qual regime está valendo é a informação mais
acionável que o simulador dá — por isso `regimeDominante` é campo de primeira
classe no resultado, não um detalhe da memória de cálculo.

## Mapa do código

```
src/dominio/     tempo civil sem fuso · tipos do domínio
src/catalogo/    porta + implementação em memória + semente conferida do ACT
src/calendario/  porta + calendário por feriados + lista provisória
src/motor/       políticas · multiplicadores · períodos · equipe · remuneração · simulador
testes/          testes-âncora: cada número vem do documento, não da nossa cabeça
```

A dependência aponta só para dentro: o motor conhece as portas, e nada conhece o
motor. Trocar o mapa em memória por um banco não toca uma linha de cálculo.

## Estado

O que já está no código e conferido contra o documento:

- Fator de encargos 2,152842, verificado em quatro pontos independentes.
- Os oito multiplicadores de período da Cláusula Sexta.
- Equipe referência da estiva e da conferência (ANEXO II e III), com escalas.
- Granito (5.1) sob ACT: taxa homem 0,99, taxa equipe 3,01, salário-dia 410,14.

O que falta, e por quê:

- **A CCT inteira** — fainas 1.1 a 19.x. Não é fase 2: sem ela o simulador só
  sabe cotar seis fainas ([#2](https://github.com/luccafwlog/portmacsimoa/issues/2)).
- **O calendário OGMO** — a lista provisória tem só feriados nacionais
  ([#10](https://github.com/luccafwlog/portmacsimoa/issues/10)).
- **Um navio real** — é o que valida que o modelo fecha com a realidade em vez
  de fechar só com a nossa leitura dos documentos.
- **Salário-dia dos conferentes** — ainda não lido; a linha do catálogo está
  marcada como pendente e toda simulação que a toca avisa.

## Rodando

```
npm install
npm test
npm run typecheck
```
