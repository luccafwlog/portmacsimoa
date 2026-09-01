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
- o workflow `.github/workflows/vercel-deploy.yml` fica responsável apenas por
  testes, typecheck e build.

Não são necessários `VERCEL_TOKEN`, `VERCEL_ORG_ID` ou `VERCEL_PROJECT_ID` como
secrets para essa integração nativa. O `vercel.json` mantém os comandos de
instalação, build e diretório de saída usados pelo projeto.

Os arquivos `.vercel/` e `.env*.local` são locais e nunca devem ser
versionados.
