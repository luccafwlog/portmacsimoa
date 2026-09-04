# SCO — Simulador de Custo de Operação

Calculadora interna para cotações preliminares da PORTMAC.

O usuário informa uma faina, o início da operação, o volume, a produtividade
total por período e o total de ternos da operação. O núcleo calcula a quantidade
de períodos, distribui os ternos inteiros entre eles e devolve o custo total, o
custo unitário e uma memória detalhada do cálculo. As majorações de jornada
da ACT/CCT são aplicadas por período; sábados e domingos e feriados nacionais
fixos são reconhecidos pela data pelo calendário nacional da aplicação.
Custos opcionais de operação podem ser informados separadamente; cada item é
dividido pelo volume do navio e somado ao custo final. Também é possível
adicionar quantos custos personalizados forem necessários.

O projeto não estima entradas, não escolhe a melhor operação e não administra a
operação. A redistribuição de ternos é um cenário manual: a soma dos ternos
precisa permanecer igual ao total informado.

O cenário tem três entradas: volume do navio, produtividade por terno por
período e ternos por período. A quantidade de períodos é
`ceil(volume ÷ produtividade ÷ ternos)` e o total de ternos é
`períodos × ternos por período` — 19.500 toneladas a 750 t com 2 ternos dão
13 períodos e 26 ternos.

O detalhamento por períodos permite redistribuir ternos e produtividade período
a período, com um gráfico que acompanha cada ajuste ao vivo e mostra onde o
adicional de jornada encarece a operação. Depois do cálculo, o mesmo desenho
reaparece no resultado sobre o cenário aceito pelo motor.

Antes de fechar o cenário, a análise de produtividade mostra duas curvas: a
referência da faina, medida em calendário neutro e independente do que foi
digitado, e o cenário informado, varrido sobre a data e o volume reais. A mesma
faina tem ótimo em produtividades muito diferentes conforme a data de início —
o feriado e o fim de semana pesam mais que a produtividade.

O cálculo aceita uma produção mínima garantida por faina, que é o que faz o
custo unitário parar de cair a partir de certa produtividade. Nenhuma faina do
catálogo declara esse valor ainda; enquanto isso, a análise informa a forma da
curva em vez de apontar um ótimo que o modelo não sustenta.

Os orçamentos salvos ficam apenas no `localStorage` do navegador.

As regras e os valores do OGMO entram por duas portas: `CatalogoOgmo` fornece a
faina e calcula o custo de cada período; `CalendarioOgmo` projeta os períodos a
partir de uma data e de um identificador de período. Os detalhes oficiais ainda
estão pendentes; os mapeamentos das planilhas ACT 2026/2028 e CCT 2024/2026
estão habilitados apenas como regras provisórias, claramente identificadas no
catálogo e no resultado.

## Desenvolvimento

```text
npm install
npm test
npm run typecheck
```

## Deploy no Vercel

O projeto `portmacsimoa` está vinculado ao repositório GitHub
`luccafwlog/portmacsimoa` pela integração nativa da Vercel:

- cada PR aberta ou atualizada gera um Preview Deployment;
- cada merge ou push em `main` gera o deploy de produção;
- o workflow `.github/workflows/validate.yml` fica responsável apenas por
  testes, typecheck e build.

Não são necessários `VERCEL_TOKEN`, `VERCEL_ORG_ID` ou `VERCEL_PROJECT_ID` como
secrets para essa integração nativa. O `vercel.json` mantém os comandos de
instalação, build e diretório de saída usados pelo projeto.

Os arquivos `.vercel/` e `.env*.local` são locais e nunca devem ser
versionados.
