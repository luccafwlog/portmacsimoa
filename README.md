# SCO — Simulador de Custo de Operação

Calculadora interna para cotações preliminares da PORTMAC.

O usuário informa uma faina, o início da operação, o volume, a produtividade
total por período e o total de ternos da operação. O núcleo calcula a quantidade
de períodos, distribui os ternos inteiros entre eles e devolve o custo total, o
custo por tonelada e uma memória simples do cálculo.
Custos opcionais de operação podem ser informados separadamente; cada item é
dividido pelo volume do navio e somado ao custo final. Também é possível
adicionar quantos custos personalizados forem necessários.

O projeto não estima entradas, não escolhe a melhor operação e não administra a
operação. A redistribuição de ternos é um cenário manual: a soma dos ternos
precisa permanecer igual ao total informado.

As regras e os valores do OGMO entram por duas portas: `CatalogoOgmo` fornece a
faina e calcula o custo de cada período; `CalendarioOgmo` projeta os períodos a
partir de uma data e de um identificador de período. Os detalhes oficiais ainda
estão pendentes e não são substituídos por valores inventados no núcleo. O
levantamento da CCT 2024/2026 já está visível no catálogo por grupo e código da
tabela, mas suas regras continuam bloqueadas até a substituição completa do
catálogo.

## Desenvolvimento

```text
npm install
npm test
npm run typecheck
```

## Deploy no Vercel

O workflow `.github/workflows/vercel-deploy.yml` valida testes, typecheck e
build em cada PR. PRs do próprio repositório recebem um preview; pushes para
`main` publicam em produção; execuções manuais seguem a branch escolhida.

Configure estes Repository secrets no GitHub antes do primeiro workflow:

- `VERCEL_TOKEN` — token de acesso do Vercel;
- `VERCEL_ORG_ID` — `orgId` do `.vercel/project.json`;
- `VERCEL_PROJECT_ID` — `projectId` do `.vercel/project.json`.

Os arquivos `.vercel/` e `.env*.local` são locais e nunca devem ser
versionados.
