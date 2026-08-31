# portmacsimoa

**PORTMAC — Simulador de Custo de Operação Portuária.** Núcleo de cálculo.

Recebe as variáveis de um navio — volume, faina, produtividade, ternos,
data/hora de início — e devolve o custo da operação, aberto por período, por
categoria e por instrumento coletivo.

- **O domínio, o vocabulário e o estado atual:** [`CONTEXT.md`](CONTEXT.md)
- **As decisões de arquitetura e o porquê de cada uma:** [`docs/adr/`](docs/adr/)
- **A especificação de produto:** issues, sob o mapa [#1](https://github.com/luccafwlog/portmacsimoa/issues/1)

```bash
npm install
npm test          # 68 testes-âncora sobre números conferidos no ACT
npm run typecheck
```

## O que este código já faz

```ts
import {
  CATALOGO_SEMENTE,
  CatalogoEmMemoria,
  calendarioProvisorio,
  instante,
  simular,
} from './src/index.js';

const resultado = simular(
  {
    cargas: [{ faina: '5.1', quantidade: 12_000, produtividadePorTernoPorPeriodo: 450 }],
    ternos: 2,
    inicio: instante(2026, 7, 11, 19, 0), // sábado, jornada noturna
  },
  new CatalogoEmMemoria(CATALOGO_SEMENTE),
  calendarioProvisorio(2026, 2028),
);

resultado.indicadorPrincipal; // { rotulo: 'R$/ton', valor: … }
resultado.regimeDominante;    // 'PRODUCAO' | 'PISO' | 'MISTO'
resultado.porClasseDeDia;     // quantos períodos caem em domingo, e quanto custam
resultado.premissas;          // tudo que o motor assumiu, com a issue que fecha cada uma
```

## O que ele ainda não faz

O catálogo carregado é só o pedaço do ACT já conferido (granito e as fainas de
estiva do acordo). A CCT inteira, o calendário OGMO oficial e um navio real de
validação dependem do dossiê ([#2](https://github.com/luccafwlog/portmacsimoa/issues/2)).

Nada disso bloqueia o motor: os dados entram por trás de interfaces, e toda
lacuna aparece como premissa no resultado em vez de virar um número errado com
cara de certo.
