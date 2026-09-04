import type { RegistroDeFaina } from './portmac.js';

/**
 * Cadastro ACT em uso no simulador.
 *
 * O mapeamento anterior — a planilha provisória
 * `Analise_ACT_PORTMAC_Calculadora_Terno_Portuario.xlsx` — foi retirado por
 * estar incorreto, junto com todo o cadastro da CCT. O catálogo fica
 * deliberadamente vazio até que as fainas da ACT sejam transcritas do
 * documento correto: sem faina cadastrada não há simulação, o que é preferível
 * a cotar com número errado.
 *
 * Para recadastrar, basta acrescentar aqui registros com `fonte: 'ACT'` e uma
 * `regraAct` (taxa-base, regime, encargos e composição do terno).
 */
export const fainasAct: readonly RegistroDeFaina[] = [];
