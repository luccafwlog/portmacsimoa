# ADR 0005 — O multiplicador de período é uma regra composta, com uma exceção

**Status:** aceito · **Data:** 2026-08-31 · **Contexto:** [#10](https://github.com/luccafwlog/portmacsimoa/issues/10)

## Contexto

O mapa ([#1](https://github.com/luccafwlog/portmacsimoa/issues/1)) enuncia os
multiplicadores da Cláusula Sexta do ACT como uma fórmula, com a recomendação
explícita de implementá-la assim em vez de como tabela — "a tabela esconde a
regra e convida a erro de digitação":

```
multiplicador = (1 + adicional_do_dia) × (1,25 se noturno)
```

A verificação registrada no [#8](https://github.com/luccafwlog/portmacsimoa/issues/8)
confere dois casos: domingo noturno (1,875 × 1,25 = 2,34375) e feriado noturno
(2,0 × 1,25 = 2,5). Ambos fecham.

**O sábado noturno não fecha.** Com adicional de 0% no sábado, a fórmula daria
**1,25**, contra os **1,875** que a mesma tabela documenta — 50% de diferença em
toda madrugada de sábado.

## Decisão

Implementar o adicional como função de `(classe, turno)`, e não da classe
sozinha. Assim os oito valores continuam saindo de uma regra composta, com o
fator noturno de 1,25 visível, e a irregularidade do sábado fica declarada:

| Classe | Adicional diurno | Adicional noturno |
|---|---|---|
| Comum | 0% | 0% |
| **Sábado** | **0%** | **50%** |
| Domingo | 87,5% | 87,5% |
| Feriado | 100% | 100% |

Os testes fixam os oito valores um a um, verificam que o fator 1,25 compõe limpo
nas outras três classes, e afirmam explicitamente que **não** compõe no sábado.

## Consequências

- A recomendação do mapa continua valendo em espírito — a regra está visível —
  sem introduzir um erro de 50% no sábado noturno.
- O teste que afirma a não-composição do sábado é intencionalmente estranho: ele
  existe para que a exceção não seja "simplificada" de volta por alguém que leia
  só a fórmula do mapa.
- **Isto precisa de confirmação.** Há duas leituras que dão o mesmo número: ou o
  sábado tem adicional de 50% à noite, ou a jornada 19h–7h de sábado já é
  contada como domingo. A segunda é mais provável na prática portuária e conecta
  com a política `classeDoPeriodoNoturno`. Pergunta para o diretor; o resultado
  numérico não muda, só o nome da regra.
