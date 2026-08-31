# ADR 0003 — Decisões em aberto viram políticas nomeadas e premissas no resultado

**Status:** aceito · **Data:** 2026-08-31 · **Contexto:** [#5](https://github.com/luccafwlog/portmacsimoa/issues/5), [#8](https://github.com/luccafwlog/portmacsimoa/issues/8), [#10](https://github.com/luccafwlog/portmacsimoa/issues/10), [#11](https://github.com/luccafwlog/portmacsimoa/issues/11), [#12](https://github.com/luccafwlog/portmacsimoa/issues/12), [#15](https://github.com/luccafwlog/portmacsimoa/issues/15), [#16](https://github.com/luccafwlog/portmacsimoa/issues/16)

## Contexto

Várias regras do cálculo continuam abertas: arredondamento de período, se o
adicional incide sobre o piso, se homens extras entram por padrão, como
classificar o período que atravessa a meia-noite, se existe taxa de administração
do OGMO, qual data determina a vigência do catálogo.

Construir mesmo assim exige escolher alguma coisa. O risco é que a escolha
desapareça dentro do código e, meses depois, ninguém saiba distinguir o que veio
do documento do que foi palpite nosso.

Numa ferramenta de cotação isso é o pior modo de falha: um número silenciosamente
errado é pior que um erro na tela, porque produz confiança.

## Decisão

Duas construções, nenhuma opcional.

**1. Política.** Toda regra em aberto é um campo de `PoliticasDeCalculo`, com
default explícito e comentário apontando a issue que a fecha. O motor lê a
política; nunca embute a resposta.

**2. Premissa.** Toda escolha que o motor faz por falta de decisão ou de dado
entra em `ResultadoDeSimulacao.premissas`, com código, descrição em português e
o número da issue.

Isso vale também para dados: uma linha de catálogo pode se marcar
`pendenteDeConferencia`, e toda simulação que a toca carrega a pendência.

## Consequências

- Quando o diretor responder, muda-se um default e os testes dizem o que o número
  fez — em vez de caçar a regra espalhada pelo código.
- Dá para rodar a mesma simulação sob duas políticas e medir a diferença, que é o
  argumento mais persuasivo numa conversa de grilling.
- A tela de resultado já tem de onde tirar a seção "premissas usadas" que o
  [#15](https://github.com/luccafwlog/portmacsimoa/issues/15) pede.
- Preço: a lista de premissas é longa hoje, e vai encurtando à medida que as
  issues fecham. É desconfortável de propósito — mede o quanto ainda falta.
- Uma política não é uma preferência de usuário. Quando uma issue fechar, o campo
  correspondente deve **sair** daqui e virar regra, não permanecer configurável.
